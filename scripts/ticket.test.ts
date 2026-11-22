import assert from 'node:assert/strict';
import { createHash, createHmac } from 'node:crypto';
import test from 'node:test';

import { buy, createAccount, creditCash, LedgerError } from '../src/logic/ledger.ts';
import { decodeTicket, receiveTicket, sendBarToMember, sendMetalToMember } from '../src/logic/memberTicket.ts';
import { withdrawPhysical } from '../src/logic/physical.ts';
import { addStock } from '../src/logic/stock.ts';
import { hmacSha256, sha256, toHex, utf8 } from '../src/logic/sha256.ts';

/** Ajoute du stock pour les formats commandés (un format à perte à l'unité ne se sert que sur stock). */
const stocked = <T extends { stock?: unknown }>(a: T, order: Record<string, number>): T =>
  Object.entries(order).reduce(
    (acc, [product, qty]) => addStock(acc as never, { product, qty, source: 'maison' }) as never,
    a,
  );

const prices = { gold: 100, silver: 1, platinum: 30 };
const close = (a: number, b: number, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} ≉ ${b}`);

test('SHA-256 et HMAC : mêmes résultats que la bibliothèque de Node', () => {
  for (const s of [
    '',
    'abc',
    'Orvia',
    'é'.repeat(100),
    'x'.repeat(55),
    'x'.repeat(56),
    'x'.repeat(64),
    'x'.repeat(1000),
  ]) {
    assert.equal(toHex(sha256(utf8(s))), createHash('sha256').update(s).digest('hex'));
    assert.equal(toHex(hmacSha256(utf8('clé'), utf8(s))), createHmac('sha256', 'clé').update(s).digest('hex'));
  }
  const longKey = 'k'.repeat(100);
  assert.equal(toHex(hmacSha256(utf8(longKey), utf8('m'))), createHmac('sha256', longKey).update('m').digest('hex'));
});

const pair = () => {
  const t0 = new Date('2026-11-01T10:00:00');
  const dad = buy(createAccount('Papa', new Date('2020-01-01')), prices, 'gold', { unit: 'g', value: 20 }, t0);
  const son = createAccount('Théo', new Date('2020-01-01'));
  const toSon = { id: 'b', name: 'Théo', kind: 'member' as const, identifier: son.memberId };
  return { dad, son, toSon, t0 };
};

test('virement par QR : l’expéditeur est débité, le destinataire crédité une seule fois', () => {
  const { dad, son, toSon, t0 } = pair();
  const sent = sendMetalToMember(dad, prices, 'gold', { unit: 'g', value: 2 }, toSon, t0);
  close(sent.account.holdings.gold, dad.holdings.gold - 2);
  const got = receiveTicket(son, prices, sent.ticket, t0);
  close(got.account.holdings.gold, 2);
  assert.match(got.summary, /2 g de métal/);
  assert.equal(got.account.transactions[0].label, `Reçu du membre ${dad.memberId}`);
  // Le même bon ne s'encaisse qu'une fois.
  assert.throws(() => receiveTicket(got.account, prices, sent.ticket, t0), /déjà été encaissé/);
});

test('virement par QR : bon falsifié, mal adressé ou illisible refusé', () => {
  const { dad, son, toSon, t0 } = pair();
  const sent = sendMetalToMember(dad, prices, 'gold', { unit: 'g', value: 1 }, toSon, t0);
  // Signature changée : refusé.
  const [head, sig] = sent.ticket.split('.');
  const forged = `${head}.${sig.replace(/.$/, sig.endsWith('0') ? '1' : '0')}`;
  assert.throws(() => decodeTicket(forged), /signature/);
  // Contenu changé (autre quantité) avec la même signature : refusé.
  const body = JSON.parse(Buffer.from(head.split(':')[2].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString());
  body.m[1] = 1000;
  const swapped = `ORVIA:VIREMENT:${Buffer.from(JSON.stringify(body)).toString('base64url')}.${sig}`;
  assert.throws(() => decodeTicket(swapped), /signature/);
  assert.throws(() => decodeTicket('https://exemple.fr'), /pas un virement Orvia/);
  // Adressé à quelqu'un d'autre : refusé.
  const other = createAccount('Autre', new Date('2020-01-01'));
  assert.throws(() => receiveTicket(other, prices, sent.ticket, t0), /autre membre/);
  // Son propre bon : refusé.
  assert.throws(() => receiveTicket(dad, prices, sent.ticket, t0), LedgerError);
  assert.ok(son);
});

test('virement par QR : la limite de 300 € sur 30 jours reste appliquée à l’expéditeur', () => {
  const { dad, toSon, t0 } = pair();
  assert.throws(() => sendMetalToMember(dad, prices, 'gold', { unit: 'eur', value: 301 }, toSon, t0), /300 €/);
});

test('lingotin envoyé par QR : il quitte le coffre maison de l’expéditeur et arrive chez le destinataire', () => {
  const { dad, son, toSon, t0 } = pair();
  // Un lingotin de 5 g vaut 500 € ici : au-dessus de la limite. On baisse le cours pour le test (3 g ≈ 150 €).
  const cheap = { gold: 30, silver: 1, platinum: 30 };
  let acc = creditCash(dad, 500);
  acc = withdrawPhysical(stocked(acc, { g5: 1 }), cheap, { g5: 1 }, t0);
  const bar = acc.homeVault![0];
  // Pas encore arrivé : refusé ; puis reçu avec son numéro de série.
  assert.throws(() => sendBarToMember(acc, cheap, bar.id, toSon, t0), /pas encore arrivé/);
  acc = { ...acc, homeVault: [{ ...bar, status: 'received' as const, serial: 'C841201' }] };
  const sent = sendBarToMember(acc, cheap, bar.id, toSon, t0);
  assert.equal(sent.account.homeVault!.length, 0);
  const got = receiveTicket(son, cheap, sent.ticket, t0);
  assert.equal(got.account.homeVault!.length, 1);
  const rb = got.account.homeVault![0];
  assert.equal(rb.product, 'g5');
  assert.equal(rb.serial, 'C841201');
  assert.equal(rb.status, 'received');
  close(rb.cost, 5 * 30, 0.01);
  assert.throws(() => receiveTicket(got.account, cheap, sent.ticket, t0), /déjà été encaissé/);
  // Un lingotin trop cher pour la limite est refusé.
  const rich = { ...acc, homeVault: [{ ...acc.homeVault![0] }] };
  assert.throws(() => sendBarToMember(rich, prices, bar.id, toSon, t0), /limite de 300 €/);
});
