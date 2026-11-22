import assert from 'node:assert/strict';
import test from 'node:test';

import { historyBounds, historyPreset, HISTORY_PRESETS, priceAtDate } from '../src/logic/historyPrices.ts';
import { createPopulation, INCOME_BANDS, runPopulation, stepWeek } from '../src/logic/population.ts';
import { createSimulation, stepSimulation } from '../src/logic/simulation.ts';

test('cours historiques : interpolation entre les points hebdomadaires, bornes', () => {
  const { first, last } = historyBounds();
  assert.ok(first.getFullYear() <= 2006 && last.getFullYear() >= 2026);
  // Aux extrémités, le premier et le dernier point ; avant et après, les valeurs sont bornées.
  const a = priceAtDate(first);
  const before = priceAtDate(new Date(first.getTime() - 400 * 86_400_000));
  assert.deepEqual(before, a);
  const z = priceAtDate(new Date(last.getTime() + 400 * 86_400_000));
  assert.equal(z.gold, priceAtDate(last).gold);
  // Entre deux semaines, un cours intermédiaire.
  const mid = priceAtDate(new Date(first.getTime() + 3.5 * 86_400_000));
  assert.ok(mid.gold >= Math.min(a.gold, priceAtDate(new Date(first.getTime() + 7 * 86_400_000)).gold) - 1e-9);
  // Repères réels : l'or valait environ 58 €/g fin 2023 et plus de 100 €/g fin 2026 ; 2008 bien moins.
  assert.ok(priceAtDate(new Date('2023-11-20')).gold > 50 && priceAtDate(new Date('2023-11-20')).gold < 65);
  assert.ok(priceAtDate(new Date('2026-11-16')).gold > 100);
  assert.ok(priceAtDate(new Date('2008-01-07')).gold < 30);
  for (const p of HISTORY_PRESETS) assert.equal(historyPreset(p.id).id, p.id);
});

test('simulateur détaillé : rejouer l’histoire avec les vrais cours de la date simulée', () => {
  const start = new Date('2020-03-02T08:00:00');
  const sim = createSimulation(10, 4, start, { priceMode: 'history' });
  const live = { gold: 999, silver: 9, platinum: 99 };
  stepSimulation(sim, live, 3600);
  assert.ok(sim.prices!.gold < 100, 'cours de 2020, pas le cours en direct donné');
  assert.deepEqual(sim.prices, priceAtDate(sim.now));
  for (let h = 0; h < 24 * 30; h++) stepSimulation(sim, live, 3600);
  assert.deepEqual(sim.prices, priceAtDate(sim.now));
});

test('population : tranches de revenu de l’Insee, 15 000 clients, segments cohérents', () => {
  // Les parts des tranches font 100 % ; médiane à 1,5 SMIC (les deux premières tranches = 50 %).
  assert.ok(Math.abs(INCOME_BANDS.reduce((s, b) => s + b.share, 0) - 1) < 1e-9);
  assert.ok(Math.abs(INCOME_BANDS[0].share + INCOME_BANDS[1].share - 0.5) < 1e-9);
  assert.equal(INCOME_BANDS[INCOME_BANDS.length - 1].share, 0.01);
  const pop = createPopulation({ start: new Date('2023-11-20T08:00:00') });
  assert.equal(pop.n, 15_000);
  const counts = new Array(INCOME_BANDS.length).fill(0);
  for (let i = 0; i < pop.n; i++) counts[pop.band[i]]++;
  INCOME_BANDS.forEach((b, i) => {
    const got = counts[i] / pop.n;
    assert.ok(Math.abs(got - b.share) < 0.012, `${b.label} : ${got} vs ${b.share}`);
  });
  // Les petits revenus ont plutôt des petits budgets, les hauts revenus plutôt des débancarisés.
  const share = (band: number, seg: number) => {
    let n = 0;
    let t = 0;
    for (let i = 0; i < pop.n; i++) if (pop.band[i] === band) (t++, pop.seg[i] === seg && n++);
    return n / t;
  };
  assert.ok(share(1, 2) > share(1, 0), 'petits budgets > débancarisés vers 1 à 1,5 SMIC');
  assert.ok(share(4, 0) > share(4, 2), 'débancarisés > petits budgets vers 3 à 5 SMIC');
  // Le budget mensuel en métaux croît avec le revenu et reste d'au moins 10 €.
  const avg = (band: number) => {
    let s = 0;
    let c = 0;
    for (let i = 0; i < pop.n; i++) if (pop.band[i] === band) ((s += pop.budget[i]), c++);
    return s / c;
  };
  assert.ok(avg(0) < avg(2) && avg(2) < avg(4) && avg(4) < avg(6));
  for (let i = 0; i < pop.n; i++) assert.ok(pop.budget[i] >= 10);
});

test('population : trois ans de cours réels, résultats cohérents et reproductibles', () => {
  const opts = { start: new Date('2023-11-20T08:00:00'), weeks: 156, rampWeeks: 104 };
  const { pop, summary: s } = runPopulation(opts);
  assert.equal(s.weeks, 156);
  // Les clients qui soldent leur compte sont remplacés : la base reste à sa taille, avec des comptes dormants en plus.
  assert.ok(s.clients > 14_800 && s.clients <= 15_000);
  assert.ok(s.active > 11_000 && s.active < 15_000);
  assert.ok(s.dormant > 500 && s.liquidated > 500 && s.churned >= s.liquidated);
  // Revenus et coûts : tout est positif, le total est la somme des lignes.
  const r = s.revenue;
  assert.ok(Math.abs(r.total - (r.buy + r.bars + r.card + r.custody + r.vault + r.dormancy)) < 0.5);
  assert.ok(r.buy > 0 && r.bars > 0 && r.card > 0 && r.custody > 0 && r.dormancy > 0);
  const c = s.costs;
  assert.ok(
    Math.abs(
      c.total - (c.bars + c.kyc + c.custody + c.vault + c.loyalty + c.referral + c.support + c.cards + c.fixed),
    ) < 0.5,
  );
  assert.ok(c.loyalty > 0 && c.referral > 0 && c.support > 0 && c.cards > 0);
  assert.ok(Math.abs(s.result - (s.revenue.total - s.costs.total)) < 0.05);
  assert.ok(Math.abs(s.contribution - (s.result + s.costs.fixed)) < 0.05);
  // L'effet du cours de l'or sur le stock s'ajoute au résultat opérationnel ; l'or a doublé : l'effet est positif.
  assert.ok(Math.abs(s.resultWithGold - (s.result + s.goldEffect + s.goldEffectUnrealized)) < 0.05);
  assert.ok(s.goldEffect > 0);
  // Les frais fixes sur trois ans : 3 × 400 000 €.
  assert.ok(Math.abs(s.costs.fixed - 1_200_000) < 1);
  // Les cours sont ceux de l'histoire : l'or double environ sur la période.
  assert.ok(s.goldStart > 50 && s.goldStart < 65 && s.goldEnd > 100);
  // Les soldes ne sont jamais négatifs.
  for (let i = 0; i < pop.n; i++) assert.ok(pop.gold[i] >= -1e-9 && pop.silver[i] >= -1e-9 && pop.plat[i] >= -1e-9);
  // Segments et tranches : les clients se répartissent sans en perdre.
  // Clients acquis : les places libérées par un départ sont reprises par un nouveau client.
  assert.ok(s.bySegment.reduce((a, g) => a + g.clients, 0) >= 15_000);
  assert.equal(
    s.byBand.reduce((a, b) => a + b.clients, 0),
    s.bySegment.reduce((a, g) => a + g.clients, 0),
  );
  // L'assurance : le stock assuré ne dépasse jamais le plafond.
  assert.ok(s.peakInsured <= s.insuranceCap + 1);
  // Même graine, même résultat.
  assert.deepEqual(runPopulation(opts).summary, s);
});

test('population : un plafond d’assurance plus haut débloque des commandes et réduit les ruptures', () => {
  const base = { start: new Date('2023-11-20T08:00:00'), weeks: 156, rampWeeks: 104 };
  const low = runPopulation({ ...base, insuranceCap: 100_000 }).summary;
  const high = runPopulation({ ...base, insuranceCap: 2_000_000 }).summary;
  assert.ok(low.insuranceBlocked > high.insuranceBlocked);
  assert.ok(low.stockouts >= high.stockouts);
  assert.ok(low.peakInsured <= 100_000 + 1);
});

test('population : arrivée progressive en courbe en S', () => {
  const pop = createPopulation({ start: new Date('2023-11-20T08:00:00'), clients: 1000, rampWeeks: 12 });
  stepWeek(pop);
  assert.ok(pop.series[0].clients < 1000 && pop.series[0].clients > 0);
  // Courbe en S : peu de clients au début et à la fin, beaucoup au milieu.
  const per = new Array(12).fill(0);
  for (let i = 0; i < pop.n; i++) per[Math.min(11, pop.joinWeek[i])]++;
  assert.ok(per[5] > per[0] * 2 && per[6] > per[11] * 2, JSON.stringify(per));
  for (let w = 0; w < 14; w++) stepWeek(pop);
  assert.ok(pop.series[pop.series.length - 1].clients > 950);
});
test('population : départs, comptes dormants facturés après six mois, stock par tranche', () => {
  const opts = { start: new Date('2023-11-20T08:00:00'), clients: 3000, rampWeeks: 0 };
  const pop = createPopulation(opts);
  for (let w = 0; w < 104; w++) stepWeek(pop);
  // Des comptes dormants existent et paient des frais d'oxydation ; les comptes soldés n'ont plus rien.
  let dormant = 0;
  for (let i = 0; i < pop.n; i++) {
    if (pop.state[i] === 2) dormant++;
    if (pop.state[i] === 0 && pop.joinWeek[i] <= pop.week) assert.equal(pop.gold[i] + pop.silver[i] + pop.plat[i], 0);
  }
  assert.ok(dormant > 50 && pop.totals.revenue.dormancy > 0);
  // Les lots commandés sont des débuts de tranche de prix.
  const sizes = new Set<number>();
  const tiers = new Set([1, 10, 20, 50, 100, 500]);
  const p2 = createPopulation(opts);
  for (let w = 0; w < 60; w++) {
    stepWeek(p2);
    for (const k of Object.keys(p2.stock)) for (const o of p2.stock[k].pending) sizes.add(o.qty);
  }
  assert.ok(sizes.size > 0 && [...sizes].every((q) => tiers.has(q)), [...sizes].join(','));
  // Même graine, même résultat ; une autre graine, un autre résultat.
  const a = runPopulation({ ...opts, weeks: 52 }).summary;
  assert.deepEqual(runPopulation({ ...opts, weeks: 52 }).summary, a);
  assert.notDeepEqual(runPopulation({ ...opts, weeks: 52, seed: 99 }).summary.revenue, a.revenue);
});
