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
  serialBar: 'VC-482917',
  serialCard: 'vc 482917',
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
  assert.deepEqual(tol, { weightG: 0.05, dimMm: 0.2 });
  const good = evaluateControl(bar5, ok5, tol);
  assert.ok(
    good.every((l) => l.ok),
    JSON.stringify(good),
  );
  // Numéro différent de la carte, poids hors marge, dimension hors marge, VERISCAN non fait.
  const bad = evaluateControl(
    bar5,
    { ...ok5, serialCard: 'VC-000000', weight: 4.9, width: 14.5, veriscan: false },
    tol,
  );
  assert.deepEqual(
    bad.filter((l) => !l.ok).map((l) => l.key),
    ['serial', 'weight', 'dims', 'veriscan'],
  );
  const r = recordControl(a, bar5.id, ok5, new Date('2026-11-21T12:00:00'));
  const done = r.homeVault!.find((b) => b.id === bar5.id)!;
  assert.equal(done.serial, 'VC-482917');
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
    { ...ok5, serialBar: 'VC-1', weight: 10, serialCard: 'VC-1', length: 26.5, width: 15.8, thickness: 1.25 },
    new Date(),
  );
  assert.equal(barState(an.homeVault!.find((b) => b.id === b10.id)!), 'ok');
});

test('base : recherche par numéro, doublons refusés, pièces à millésime répété', () => {
  let a = withBars();
  const [b5, b10, coin] = a.homeVault!;
  a = recordControl(a, b5.id, ok5, new Date());
  assert.equal(searchBars(a, 'vc 482917').length, 1);
  assert.equal(searchBars(a, 'zz').length, 0);
  assert.equal(searchBars(a, '').length, 3);
  assert.throws(
    () =>
      recordControl(a, b10.id, {
        ...ok5,
        weight: 10,
        serialCard: 'VC-482917',
        length: 26.5,
        width: 15.8,
        thickness: 1.25,
      }),
    /déjà dans la base/,
  );
  assert.throws(() => receiveBar(a, b10.id, 'vc482917'), /déjà dans la base/);
  assert.equal(duplicateSerials(a).length, 0);
  // Pièce : millésime accepté même s'il se répète.
  a = receiveBar(a, coin.id, '1912');
  assert.doesNotThrow(() => receiveBar(a, b10.id, '1912'));
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
      serialBar: 'VC-9',
      serialCard: 'VC-9',
      weight: 10.01,
      length: 26.5,
      width: 15.8,
      thickness: 1.25,
      veriscan: true,
    },
    new Date('2026-11-21T12:00:00'),
  );
  a = recheckWeight(a, b.id, 10.03, new Date('2027-03-02T12:00:00'));
  let cur = a.homeVault!.find((x) => x.id === b.id)!;
  assert.equal(barState(cur), 'ok'); // +0,02 g : dans la marge
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
