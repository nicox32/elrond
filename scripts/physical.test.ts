import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buy, createAccount, creditCash, LedgerError, minOrderError, quoteBuy, sell } from '../src/logic/ledger.ts';
import { isWeekendClosed } from '../src/logic/market.ts';
import { cancelOrder, placeOrder, runPendingOrders } from '../src/logic/orders.ts';
import { homeVaultTotal, quoteWithdrawal, receiveBar, withdrawPhysical } from '../src/logic/physical.ts';
import { holdingLots } from '../src/logic/tax.ts';
import { companyReport } from '../src/logic/company.ts';

const p = { gold: 100, silver: 1, platinum: 30 };
const close = (a: number, b: number, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} ≉ ${b}`);

test('retrait physique : lingotins d’or, frais depuis le compte d’attente, registre du coffre maison', () => {
  let a = createAccount('T', new Date('2020-01-01'));
  a = buy(a, p, 'gold', { unit: 'g', value: 12 }, new Date('2020-03-01T12:00:00'));
  a = buy(a, p, 'gold', { unit: 'g', value: 20 }, new Date('2024-06-01T12:00:00'));
  const q = quoteWithdrawal(p, { g10: 2, g5: 1 });
  assert.equal(q.grams, 25);
  close(q.premium, 10 * 100 * 0.03 * 2 + 5 * 100 * 0.045);
  close(q.fees, 60 + 22.5, 0.01); // 25 g : livraison offerte (dès 20 g)
  close(quoteWithdrawal(p, { g10: 1 }).fees, 30 + 12, 0.01); // 10 g seul : livraison 12 €
  // Frais à payer depuis le compte d'attente : vide → refusé (payer en or serait une vente imposée).
  assert.throws(() => withdrawPhysical(a, p, { g10: 2, g5: 1 }), LedgerError);
  a = creditCash(a, 150);
  // Plus d'or que disponible : refusé.
  assert.throws(() => withdrawPhysical(a, p, { oz1: 2 }), /Or insuffisant/);
  const now = new Date('2026-11-16T12:00:00');
  const w = withdrawPhysical(a, p, { g10: 2, g5: 1 }, now);
  close(w.holdings.gold, 7);
  close(w.cashEur!, 150 - q.fees, 0.01);
  assert.equal(w.transactions[0].kind, 'withdraw_physical');
  assert.equal(w.transactions[0].tax, undefined); // pas une vente
  assert.equal(w.homeVault!.length, 3);
  // Premier entré, premier sorti : 5 g puis 7 g de l'or de 2020, le reste de 2024.
  const bars = w.homeVault!;
  assert.equal(bars[0].grams, 5);
  assert.equal(bars[0].acquiredTo.slice(0, 4), '2020');
  close(bars[0].cost, (5 * 100) / (1 - 0.025), 0.01); // prix de revient d'origine, frais compris
  assert.equal(bars[1].acquiredFrom.slice(0, 4), '2020');
  assert.equal(bars[1].acquiredTo.slice(0, 4), '2024');
  assert.equal(bars[2].acquiredFrom.slice(0, 4), '2024');
  // Le coffre ne contient plus que l'or de 2024 restant.
  close(
    holdingLots(w).gold.reduce((s, l) => s + l.grams, 0),
    7,
  );
  const r = receiveBar(w, bars[0].id, ' ab-123456 ');
  assert.equal(r.homeVault![0].serial, 'AB-123456');
  assert.equal(r.homeVault![0].status, 'received');
  assert.throws(() => receiveBar(w, bars[0].id, ' '), LedgerError);
  assert.deepEqual(homeVaultTotal(r, p).grams, 25);
  const rep = companyReport(r, p, 'all', now);
  close(rep.revenue.physical, q.fees, 0.01);
});

test('minimum d’achat 10 € sur le total, supplément du week-end, ordres passés lundi', () => {
  assert.match(minOrderError(9.99) ?? '', /10 €/);
  assert.equal(minOrderError(10), null);
  // Supplément immédiat du week-end : 0,5 % de plus sur les frais.
  const normal = quoteBuy(p, 'gold', { unit: 'eur', value: 100 });
  const weekend = quoteBuy(p, 'gold', { unit: 'eur', value: 100 }, 0.005);
  close(weekend.fees - normal.fees, 0.5, 0.01);
  // Samedi : fermé ; lundi 10 h : ouvert.
  assert.equal(isWeekendClosed(new Date('2026-11-14T12:00:00')), true);
  assert.equal(isWeekendClosed(new Date('2026-11-16T10:00:00')), false);
  let a = buy(createAccount('T', new Date('2026-11-01')), p, 'gold', { unit: 'g', value: 10 });
  assert.throws(() => placeOrder(a, { kind: 'buy', metal: 'gold', q: { unit: 'eur', value: 5 } }), /minimum/);
  a = placeOrder(a, { kind: 'buy', metal: 'silver', q: { unit: 'eur', value: 20 } });
  a = placeOrder(a, { kind: 'split', amounts: { gold: 15, silver: 5 } }); // 5 € d'argent : permis dans un achat de 20 €
  a = placeOrder(a, { kind: 'sell', metal: 'gold', q: { unit: 'g', value: 100 } }); // trop : refusé lundi
  const cancel = placeOrder(a, { kind: 'buy', metal: 'gold', q: { unit: 'eur', value: 30 } });
  assert.equal(cancelOrder(cancel, cancel.pendingOrders!.at(-1)!.id).pendingOrders!.length, 3);
  const monday = { gold: 101, silver: 1.02, platinum: 30 };
  const r = runPendingOrders(a, monday, new Date('2026-11-16T10:00:00'));
  assert.equal(r.account.pendingOrders!.length, 0);
  const labels = r.account.transactions.filter((t) => t.label.includes('ordre du week-end')).map((t) => t.label);
  assert.equal(labels.length, 3); // argent + or et argent répartis
  assert.equal(r.notices.length, 2);
  assert.match(r.notices[1].body, /Vente/);
  // L'ordre passe au cours de lundi.
  const silverBuy = r.account.transactions.find((t) => t.label.startsWith('Achat d’argent') && t.eur === 20)!;
  close(silverBuy.deltas.silver, (20 * (1 - 0.063)) / 1.02, 1e-5);
  // Une vente immédiate du week-end porte le supplément dans son libellé.
  const s = sell(a, p, 'gold', { unit: 'g', value: 1 }, 'deferred', new Date(), 0.005);
  assert.match(s.transactions[0].label, /week-end immédiat/);
});

test('Napoléon 20 F : 5,806 g d’or fin, prime indicative, millésime au coffre maison', async () => {
  const { napoleonPrice } = await import('../src/logic/physical.ts');
  const n = napoleonPrice(100);
  close(n.metal, 580.6);
  close(n.withPremium, 580.6 * 1.06);
  // 4 Napoléons = 23,2 g d'or : livraison offerte (dès 20 g).
  const q = quoteWithdrawal(p, { nap20: 4 });
  close(q.grams, 23.224);
  assert.equal(q.delivery, 0);
  let a = creditCash(buy(createAccount('T'), p, 'gold', { unit: 'g', value: 10 }), 100);
  a = withdrawPhysical(a, p, { nap20: 1 });
  a = receiveBar(a, a.homeVault![0].id, '1910');
  assert.equal(a.homeVault![0].serial, '1910');
  close(a.holdings.gold, 10 - 5.806);
});

test('coffre maison : fiche QR de chaque objet et inventaire imprimable', async () => {
  const { barQrText, homeVaultHtml } = await import('../src/logic/homeVaultDoc.ts');
  const { qrMatrix } = await import('../src/logic/qr.ts');
  let a = creditCash(
    buy(
      createAccount('T', new Date('2019-03-01')),
      p,
      'gold',
      { unit: 'g', value: 30 },
      new Date('2019-03-04T12:00:00'),
    ),
    100,
  );
  a = withdrawPhysical(a, p, { g10: 1, nap20: 1 }, new Date('2026-11-16T12:00:00'));
  a = receiveBar(a, a.homeVault![0].id, 'ab123456', new Date('2026-11-20T12:00:00'));
  const text = barQrText(a.homeVault![0]);
  assert.match(text, /Lingotin 10 g/);
  assert.match(text, /N° de série : AB123456/);
  assert.match(text, /Exonéré de plus-value en 2041/);
  assert.match(text, /pas un certificat d’authenticité/);
  assert.match(barQrText(a.homeVault![1]), /Millésime : à noter|N° de série : à noter/);
  assert.ok(qrMatrix(text).length >= 21);
  const html = homeVaultHtml(a, p, new Date('2026-11-20T12:00:00'));
  assert.equal((html.match(/<svg /g) ?? []).length, 2);
  assert.match(html, /Inventaire du coffre maison/);
  assert.match(html, /2 objets/);
});

test('fiche technique : lingotin 5 g PAMP Suisse et Napoléon, dans la fiche QR', async () => {
  const { productOf, specLine } = await import('../src/logic/physical.ts');
  const { barQrText } = await import('../src/logic/homeVaultDoc.ts');
  assert.equal(specLine(productOf('g5').spec), 'PAMP Suisse · or 999,9 · 23,3 × 14 × 0,79 mm');
  assert.equal(specLine(productOf('nap20').spec), 'Monnaie de Paris · or 900 ‰ · Ø 21 mm');
  assert.equal(specLine(productOf('g10').spec), 'PAMP Suisse · or 999,9 · 26,5 × 15,8 × 1,25 mm');
  assert.equal(specLine(productOf('g20').spec), 'PAMP Suisse · or 999,9 · 32 × 18 × 1,88 mm');
  assert.equal(specLine(productOf('oz1').spec), 'PAMP Suisse · or 999,9 · 41 × 24 × 1,66 mm');
  const a = withdrawPhysical(creditCash(buy(createAccount('T'), p, 'gold', { unit: 'g', value: 10 }), 100), p, {
    g5: 1,
  });
  assert.match(barQrText(a.homeVault![0]), /PAMP Suisse · or 999,9 · 23,3 × 14 × 0,79 mm/);
  assert.match(barQrText(a.homeVault![0]), /à vérifier avec PAMP VERISCAN/);
  assert.equal(productOf('nap20').spec?.veriscan, undefined);
});
