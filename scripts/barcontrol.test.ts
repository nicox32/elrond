import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  barState,
  barSummary,
  controlledOn,
  duplicateSerials,
  evaluateControl,
  recheckWeight,
  recordControl,
  resolveAnomaly,
  searchBars,
  toleranceOf,
} from '../src/logic/barControl.ts';
import { barQrText } from '../src/logic/homeVaultDoc.ts';
import { buy, createAccount, creditCash, LedgerError } from '../src/logic/ledger.ts';
import { receiveBar, withdrawPhysical } from '../src/logic/physical.ts';

const p = { gold: 100, silver: 1, platinum: 30 };

function withBars() {
  let a = creditCash(
    buy(
      createAccount('T', new Date('2019-01-01')),
      p,
      'gold',
      { unit: 'g', value: 80 },
      new Date('2019-03-04T12:00:00'),
    ),
    300,
  );
  a = withdrawPhysical(a, p, { g5: 1, g10: 1, nap20: 1 }, new Date('2026-11-16T12:00:00'));
  return a;
}
const ok5 = {
  sealed: true,
  serialBar: 'C482917',
  serialCard: 'c 482-917',
  weight: 5.01,
  length: 23.3,
  width: 14,
  thickness: 0.8,
  veriscan: true,
};

test('contrôle à la réception : série = carte d’essai, pesée, dimensions, VERISCAN', () => {
  const a = withBars();
  const bar5 = a.homeVault!.find((b) => b.grams === 5)!;
  assert.equal(barState(bar5), 'todo');
  const tol = toleranceOf(a);
  assert.deepEqual(tol, { weightG: 0.01, dimMm: 0.2 });
  const good = evaluateControl(bar5, ok5, tol);
  assert.ok(
    good.every((l) => l.ok),
    JSON.stringify(good),
  );
  // Numéro différent de la carte, poids hors marge, dimension hors marge, VERISCAN non fait.
  const bad = evaluateControl(bar5, { ...ok5, serialCard: 'C000000', weight: 4.9, width: 14.5, veriscan: false }, tol);
  assert.deepEqual(
    bad.filter((l) => !l.ok).map((l) => l.key),
    ['serial', 'weight', 'dims', 'veriscan'],
  );
  const r = recordControl(a, bar5.id, ok5, new Date('2026-11-21T12:00:00'));
  const done = r.homeVault!.find((b) => b.id === bar5.id)!;
  assert.equal(done.serial, 'C482917'); // « C482917 » normalisé
  assert.equal(done.weightRef, 5.01);
  assert.equal(done.status, 'received');
  assert.equal(barState(done), 'ok');
  assert.equal(controlledOn(done)?.slice(0, 10), '2026-11-21');
  assert.match(barQrText(done), /Contrôlé par Orvia le 21\/11\/2026 · poids de référence 5,01 g/);
  // Contrôle non conforme : enregistré comme anomalie.
  const b10 = a.homeVault!.find((b) => b.grams === 10)!;
  const an = recordControl(
    a,
    b10.id,
    { ...ok5, serialBar: 'C000001', weight: 10, serialCard: 'C000001', length: 26.5, width: 15.8, thickness: 1.25 },
    new Date(),
  );
  assert.equal(barState(an.homeVault!.find((b) => b.id === b10.id)!), 'ok');
});

test('base : recherche par numéro, doublons refusés, pièces à millésime répété', () => {
  let a = withBars();
  const [b5, b10, coin] = a.homeVault!;
  a = recordControl(a, b5.id, ok5, new Date());
  assert.equal(searchBars(a, 'c 482917').length, 1);
  assert.equal(searchBars(a, 'çç').length, 0);
  assert.equal(searchBars(a, '').length, 3);
  assert.throws(
    () =>
      recordControl(a, b10.id, {
        ...ok5,
        weight: 10,
        serialCard: 'C482917',
        length: 26.5,
        width: 15.8,
        thickness: 1.25,
      }),
    /déjà dans la base/,
  );
  assert.throws(() => receiveBar(a, b10.id, 'c482917'), /déjà dans la base/);
  assert.equal(duplicateSerials(a).length, 0);
  // Pièce : millésime accepté même s'il se répète.
  a = receiveBar(a, coin.id, '1912');
  assert.throws(() => receiveBar(a, b10.id, '1912'), /« C » suivi de 6 chiffres/); // numéro PAMP mal formé
  assert.doesNotThrow(() => receiveBar(a, b10.id, 'c 100-200'));
  assert.throws(() => recordControl(a, b5.id, { ...ok5, serialBar: ' ', serialCard: ' ' }), LedgerError);
  const s = barSummary(a);
  assert.deepEqual(s, { total: 3, todo: 2, anomalies: 0 });
});

test('recontrôle par pesée : écart hors marge = anomalie, levée après vérification', () => {
  let a = withBars();
  const b = a.homeVault!.find((x) => x.grams === 10)!;
  assert.throws(() => recheckWeight(a, b.id, 10), /d’abord le contrôle/);
  a = recordControl(
    a,
    b.id,
    {
      sealed: true,
      serialBar: 'C000009',
      serialCard: 'C000009',
      weight: 10.01,
      length: 26.5,
      width: 15.8,
      thickness: 1.25,
      veriscan: true,
    },
    new Date('2026-11-21T12:00:00'),
  );
  a = recheckWeight(a, b.id, 10.015, new Date('2027-03-02T12:00:00'));
  let cur = a.homeVault!.find((x) => x.id === b.id)!;
  assert.equal(barState(cur), 'ok'); // +0,005 g : dans la marge
  a = recheckWeight(a, b.id, 9.92, new Date('2027-03-03T12:00:00'));
  cur = a.homeVault!.find((x) => x.id === b.id)!;
  assert.equal(barState(cur), 'anomaly');
  assert.equal(controlledOn(cur), null); // le client ne voit plus « contrôlé »
  assert.match(cur.checks!.at(-1)!.note!, /écart −0,09 g/);
  assert.equal(barSummary(a).anomalies, 1);
  assert.throws(() => resolveAnomaly(a, searchBars(a, 'zzz')[0]?.id ?? 'x', 'ok'), LedgerError);
  a = resolveAnomaly(a, b.id, 'VERISCAN conforme après nouvelle pesée', new Date('2027-03-04T12:00:00'));
  assert.equal(barState(a.homeVault!.find((x) => x.id === b.id)!), 'ok');
  assert.throws(() => resolveAnomaly(a, b.id, 'encore'), /Aucune anomalie/);
});

test('pièce : poids brut 6,45 g, marge d’usure, pas de carte d’essai', () => {
  const a = withBars();
  const coin = a.homeVault!.find((x) => x.product === 'nap20')!;
  const lines = evaluateControl(coin, { sealed: true, serialBar: '1912', weight: 6.41, diameter: 21 }, toleranceOf(a));
  assert.ok(
    lines.every((l) => l.ok),
    JSON.stringify(lines),
  );
  assert.ok(!lines.some((l) => l.key === 'veriscan'));
  const worn = evaluateControl(coin, { sealed: true, serialBar: '1912', weight: 6.2, diameter: 21 }, toleranceOf(a));
  assert.equal(worn.find((l) => l.key === 'weight')!.ok, false);
});

test('numéro PAMP : « C » + 6 chiffres, normalisé, vérifié au contrôle', async () => {
  const { normalizeSerial, serialFormatError } = await import('../src/logic/physical.ts');
  assert.equal(normalizeSerial('g5', ' c 841-201 '), 'C841201');
  assert.equal(serialFormatError('g5', 'C841201'), null);
  assert.match(serialFormatError('g5', 'C84120') ?? '', /6 chiffres/);
  assert.match(serialFormatError('g10', 'VC-482915') ?? '', /« C » suivi de 6 chiffres/);
  assert.equal(serialFormatError('nap20', '1912'), null); // une pièce : millésime
  const a = withBars();
  const bar5 = a.homeVault!.find((b) => b.grams === 5)!;
  const lines = evaluateControl(bar5, { ...ok5, serialBar: 'C84120', serialCard: 'C84120' }, toleranceOf(a));
  assert.equal(lines.find((l) => l.key === 'format')!.ok, false);
  assert.equal(lines.find((l) => l.key === 'serial')!.ok, true);
  const bad = recordControl(a, bar5.id, { ...ok5, serialBar: 'C84120', serialCard: 'C84120' }, new Date());
  assert.equal(barState(bad.homeVault!.find((b) => b.id === bar5.id)!), 'anomaly'); // enregistré comme anomalie
});

test('défaut au contrôle : le lingotin quitte le compte du client, qui récupère son or et ses frais', async () => {
  const { rejectBar, setReturnStatus } = await import('../src/logic/barReturn.ts');
  const a = withBars();
  const goldBefore = a.holdings.gold;
  const cashBefore = a.cashEur ?? 0;
  const b5 = a.homeVault!.find((b) => b.grams === 5)!;
  assert.ok((b5.feesPaid ?? 0) > 0);
  // Pas d'anomalie : refus impossible.
  assert.throws(() => rejectBar(a, b5.id), /en anomalie/);
  // Poids hors marge : anomalie, puis refus.
  const bad = recordControl(a, b5.id, { ...ok5, weight: 4.5 }, new Date('2026-11-21T12:00:00'));
  assert.equal(barState(bad.homeVault!.find((b) => b.id === b5.id)!), 'anomaly');
  const r = rejectBar(bad, b5.id, undefined, new Date('2026-11-22T12:00:00'));
  assert.equal(
    r.homeVault!.some((b) => b.id === b5.id),
    false,
  );
  close5(r.holdings.gold, goldBefore + 5);
  close5(r.cashEur ?? 0, cashBefore + b5.feesPaid!);
  assert.equal(r.transactions[0].kind, 'bar_refund');
  assert.match(r.transactions[0].label, /Lingotin défectueux retiré/);
  assert.equal(r.returnedBars![0].status, 'to_send');
  assert.match(r.returnedBars![0].reason, /Pesée/);
  assert.equal(r.returnedBars![0].refundGold, 5);
  const sent = setReturnStatus(r, b5.id, 'sent', 'colis n° 123');
  assert.equal(sent.returnedBars![0].status, 'sent');
  assert.equal(sent.returnedBars![0].note, 'colis n° 123');
  assert.throws(() => setReturnStatus(r, 'x', 'sent'));
});
const close5 = (x: number, y: number) => assert.ok(Math.abs(x - y) < 1e-6, `${x} ≉ ${y}`);

test('pesée d’un lingot de 5 g : jamais sous 5,00 g (à la marge de la balance près)', () => {
  const a = withBars();
  const bar5 = a.homeVault!.find((b) => b.grams === 5)!;
  const tol = toleranceOf(a);
  const weightOk = (w: number) => evaluateControl(bar5, { ...ok5, weight: w }, tol).find((l) => l.key === 'weight')!.ok;
  assert.equal(weightOk(5.0), true);
  assert.equal(weightOk(5.005), true);
  assert.equal(weightOk(4.99), true); // marge de la balance
  assert.equal(weightOk(4.98), false); // sous le poids nominal : rejet
  assert.equal(weightOk(5.2), false); // trop lourd : suspect
});

test('lingotin sous blister scellé : pesée avec la carte indicative, pas de dimensions, VERISCAN exigé', () => {
  const a = withBars();
  const bar10 = a.homeVault!.find((b) => b.grams === 10)!;
  const tol = toleranceOf(a);
  const sealed = {
    sealed: true,
    serialBar: 'C000009',
    serialCard: 'C000009',
    weight: 16.2,
    veriscan: true,
    blister: true,
  };
  const lines = evaluateControl(bar10, sealed, tol);
  assert.deepEqual(
    lines.map((l) => l.key),
    ['seal', 'format', 'serial', 'weight', 'veriscan'],
  );
  assert.ok(
    lines.every((l) => l.ok),
    JSON.stringify(lines),
  );
  // Plus léger que le lingotin seul : impossible, donc refusé. VERISCAN absent : refusé.
  assert.equal(evaluateControl(bar10, { ...sealed, weight: 9.5 }, tol).find((l) => l.key === 'weight')!.ok, false);
  assert.equal(
    evaluateControl(bar10, { ...sealed, veriscan: false }, tol).find((l) => l.key === 'veriscan')!.ok,
    false,
  );
  // Poids inhabituel : signalé mais pas refusé.
  const odd = evaluateControl(bar10, { ...sealed, weight: 22 }, tol).find((l) => l.key === 'weight')!;
  assert.equal(odd.ok, true);
  assert.match(odd.detail, /hors de l’ordre habituel/);
  const r = recordControl(a, bar10.id, sealed, new Date('2026-11-21T12:00:00'));
  const done = r.homeVault!.find((b) => b.id === bar10.id)!;
  assert.equal(done.weightRef, 16.2);
  assert.equal(done.weightRefBlister, true);
  assert.equal(done.checks![0].blister, true);
  assert.equal(barState(done), 'ok');
});
