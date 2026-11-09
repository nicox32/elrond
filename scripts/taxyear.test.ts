import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buy, createAccount, sell } from '../src/logic/ledger.ts';
import { retirementStatus } from '../src/logic/retirement.ts';
import { exemptionCalendar, taxYearHtml, taxYearRecap } from '../src/logic/taxYear.ts';

const p = { gold: 100, silver: 1, platinum: 30 };

test('calendrier d’exonération : par année d’achat, exonéré 22 ans après le dernier achat de l’année', () => {
  let a = createAccount('T', new Date('2019-01-01'));
  a = buy(a, p, 'gold', { unit: 'g', value: 2 }, new Date('2019-03-04T12:00:00'));
  a = buy(a, p, 'gold', { unit: 'g', value: 1 }, new Date('2019-09-10T12:00:00'));
  a = buy(a, p, 'silver', { unit: 'g', value: 100 }, new Date('2024-05-02T12:00:00'));
  const cal = exemptionCalendar(a, p, new Date('2026-11-09T12:00:00'));
  assert.deepEqual(
    cal.map((c) => c.year),
    [2019, 2024],
  );
  assert.equal(cal[0].grams.gold, 3);
  assert.equal(cal[0].exemptFrom.slice(0, 10), '2041-09-10');
  assert.equal(cal[0].allowance, 0.25); // 7 ans pleins depuis le dernier achat (sept. 2019) → 5 × 5 %
  assert.equal(cal[1].allowance, 0);
  assert.equal(cal[0].exempt, false);
});

test('récapitulatif fiscal annuel : ventes imposées de l’année, impôt, frais', () => {
  let a = createAccount('T', new Date('2025-01-01'));
  a = buy(a, p, 'gold', { unit: 'eur', value: 1000 }, new Date('2025-02-01T12:00:00'));
  // Le cours a monté : la vente dégage une plus-value, donc un impôt.
  a = sell(a, { ...p, gold: 150 }, 'gold', { unit: 'g', value: 2 }, 'deferred', new Date('2026-03-01T12:00:00'));
  const r25 = taxYearRecap(a, 2025);
  assert.equal(r25.taxed.length, 0);
  assert.equal(r25.invested, 1000);
  const r26 = taxYearRecap(a, 2026);
  assert.equal(r26.taxed.length, 1);
  assert.ok(r26.taxFlat + r26.taxGain > 0);
  const html = taxYearHtml(a, 2026, p, new Date('2026-11-09T12:00:00'));
  assert.match(html, /Récapitulatif fiscal 2026/);
  assert.match(html, /1 cession/);
  assert.match(html, /Calendrier d’exonération/);
});

test('objectif retraite : progression et versement mensuel nécessaire', () => {
  const now = new Date('2026-11-09T12:00:00');
  const s = retirementStatus({ target: 12_000, date: '2036-11-09T12:00:00Z' }, 2_400, now);
  assert.equal(s.months, 120);
  assert.equal(s.progress, 0.2);
  assert.equal(Math.round(s.monthly), 80); // (12 000 − 2 400) / 120
  const g = retirementStatus({ target: 12_000, date: '2036-11-09T12:00:00Z', growth: 0.04 }, 2_400, now);
  assert.ok(g.monthly < s.monthly && g.projectedWithoutSaving > 2_400);
  assert.equal(retirementStatus({ target: 1000, date: '2030-01-01' }, 1500, now).reached, true);
});
