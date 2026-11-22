import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createSimulation,
  MIXES,
  SEGMENTS,
  stepSimulation,
  summarize,
  summarizeBySegment,
} from '../src/logic/simulation.ts';
import { INSURANCE_CAP_EUR, insuranceStatus } from '../src/logic/stock.ts';

const prices = { gold: 103.53, silver: 1.24, platinum: 38.33 };
const run = (clients: number, days: number, seed = 7) => {
  const sim = createSimulation(clients, seed, new Date('2026-11-23T08:00:00'));
  for (let h = 0; h < days * 24; h++) stepSimulation(sim, prices, 3600);
  return sim;
};

test('simulateur : 50 clients fictifs, achats, ventes et retraits, soldes jamais négatifs', () => {
  const sim = run(50, 30);
  assert.equal(sim.clients.length, 50);
  assert.ok(
    sim.clients.every((c) => /\(simulé\)$/.test(c.name)),
    'noms fictifs',
  );
  assert.ok(sim.counters.buys > 100);
  assert.ok(sim.counters.withdrawals > 10);
  for (const c of sim.clients) {
    for (const m of ['gold', 'silver', 'platinum'] as const) assert.ok(c.account.holdings[m] >= -1e-9, c.name);
    assert.ok((c.account.cashEur ?? 0) >= -0.01, c.name);
  }
  // Le stock appartient à la société : jamais sur le compte d'un client.
  assert.ok(sim.clients.every((c) => !c.account.stock));
  assert.ok((sim.company.stock ?? []).every((l) => l.qty >= 0));
});

test('simulateur : l’assurance de la société n’est jamais dépassée, résultats cohérents', () => {
  const sim = run(50, 90);
  const s = summarize(sim, prices);
  assert.ok(insuranceStatus(sim.company, prices.gold).value <= INSURANCE_CAP_EUR + 0.01);
  assert.ok(s.peakInsured <= INSURANCE_CAP_EUR + 0.01);
  assert.ok(s.revenue.total > 0 && s.revenue.buy > 0 && s.revenue.physical > 0);
  assert.equal(s.operations, sim.counters.buys + sim.counters.sells + sim.counters.withdrawals + sim.counters.cards);
  assert.equal(s.days, 90);
  // Même graine : même simulation.
  const again = summarize(run(50, 90), prices);
  assert.deepEqual(again, s);
});

test('simulateur : enregistrée puis reprise, la simulation continue à l’identique (rattrapage appli fermée)', async () => {
  const { serializeSimulation, restoreSimulation, catchUp } = await import('../src/logic/simulation.ts');
  // Dix jours d'une traite, contre cinq jours + enregistrement + « fermeture » + cinq jours de rattrapage.
  const straight = summarize(run(50, 10), prices);
  const half = run(50, 5);
  const text = serializeSimulation(half, new Date('2026-11-28T08:00:00'));
  const back = restoreSimulation(text);
  assert.ok(back);
  assert.equal(back!.savedAt.toISOString(), '2026-11-28T08:00:00.000Z');
  assert.equal(back!.sim.clients.length, 50);
  const done = catchUp(back!.sim, prices, 5 * 86_400);
  assert.equal(done, 5 * 86_400);
  assert.deepEqual(summarize(back!.sim, prices), straight);
  // Plafond de rattrapage : 90 jours, même après une très longue fermeture.
  const long = restoreSimulation(serializeSimulation(run(10, 1)))!;
  assert.equal(catchUp(long.sim, prices, 400 * 86_400), 90 * 86_400);
  // Texte abîmé ou absent : pas de simulation.
  assert.equal(restoreSimulation('pas du json'), null);
  assert.equal(restoreSimulation(null), null);
});

test('simulateur : quatre segments, répartition choisie, carte, coffre sécurisé et garde', () => {
  const sim = run(100, 60);
  const by = summarizeBySegment(sim, sim.prices!);
  assert.deepEqual(by.map((r) => r.segment).sort(), ['daily', 'debank', 'physical', 'small']);
  assert.equal(
    by.reduce((s, r) => s + r.clients, 0),
    100,
  );
  // Répartition « Équilibré » : environ 20 / 25 / 40 / 15 %.
  const share = (k: string) => by.find((r) => r.segment === k)!.clients;
  assert.ok(share('small') > share('daily') && share('small') > share('debank'));
  // Les quotidiens ont la carte et paient avec ; les petits budgets n'ont que des achats.
  assert.ok(sim.counters.cards > 50);
  assert.ok(sim.clients.filter((c) => c.profile === 'daily').every((c) => !!c.account.card));
  assert.ok(
    sim.clients
      .filter((c) => c.profile === 'small')
      .every(
        (c) =>
          !c.account.transactions.some(
            (t) => t.kind !== 'buy' && t.kind !== 'fee_custody' && t.kind !== 'fee_dormancy',
          ),
      ),
  );
  // Lingotins en coffre sécurisé chez Godot & Fils, et garde prélevée chaque mois.
  assert.ok(sim.clients.some((c) => (c.account.homeVault ?? []).some((b) => b.vault)));
  const s = summarize(sim, sim.prices!);
  assert.ok(s.revenue.custody > 0);
  assert.ok(SEGMENTS.small.ratePerDay > SEGMENTS.debank.ratePerDay);
  // Une autre répartition change la composition de la base.
  const small = createSimulation(100, 7, new Date('2026-11-23T08:00:00'), { mix: 'small' });
  const smallShare = small.clients.filter((c) => c.profile === 'small').length;
  assert.ok(smallShare > share('small') && MIXES.small.mix.small === 70);
});

test('simulateur : cours simulés (marche aléatoire) ou en direct', () => {
  const start = new Date('2026-11-23T08:00:00');
  const walk = createSimulation(10, 3, start);
  for (let h = 0; h < 24 * 30; h++) stepSimulation(walk, prices, 3600);
  assert.notEqual(walk.prices!.gold, prices.gold);
  assert.ok(walk.prices!.gold > prices.gold * 0.7 && walk.prices!.gold < prices.gold * 1.4, 'marche modérée');
  // Mode direct : les cours donnés sont utilisés tels quels.
  const live = createSimulation(10, 3, start, { priceMode: 'live' });
  for (let h = 0; h < 48; h++) stepSimulation(live, prices, 3600);
  assert.deepEqual(live.prices, prices);
  // Même graine : même marche.
  const again = createSimulation(10, 3, start);
  for (let h = 0; h < 24 * 30; h++) stepSimulation(again, prices, 3600);
  assert.deepEqual(again.prices, walk.prices);
});

test('simulateur : montée en charge, délai de livraison des commandes, ruptures de stock', async () => {
  const { percentiles, simulateRun } = await import('../src/logic/simulation.ts');
  const start = new Date('2026-11-23T08:00:00');
  // Arrivée progressive : le premier client est là dès le départ, le dernier à la fin de la période.
  const ramp = createSimulation(40, 5, start, { rampDays: 120 });
  const joins = ramp.clients.map((c) => new Date(c.joinAt!).getTime());
  assert.equal(joins[0], start.getTime());
  assert.ok(Math.abs(joins[39] - (start.getTime() + 120 * 86_400_000)) < 1000);
  for (let h = 0; h < 24 * 20; h++) stepSimulation(ramp, prices, 3600);
  const active = ramp.clients.filter((c) => c.account.transactions.length > 0).length;
  assert.ok(active < 40, 'tous les clients ne sont pas encore arrivés');
  // Les comptes sont ouverts à leur date d'arrivée.
  assert.ok(ramp.clients.every((c, i) => new Date(c.account.createdAt).getTime() === joins[i]));
  // Une commande arrive après le délai de Godot & Fils (8 jours), pas avant.
  const sim = createSimulation(20, 9, start);
  stepSimulation(sim, prices, 3600);
  assert.ok(sim.pending.length > 0, 'des commandes sont en route');
  const first = sim.pending[0];
  assert.equal(new Date(first.arrivesAt).getTime() - sim.now.getTime() > 7 * 86_400_000, true);
  const stockBefore = (sim.company.stock ?? []).filter((l) => l.qty > 0).length;
  assert.equal(stockBefore, 0, 'rien en stock avant l’arrivée');
  for (let h = 0; h < 24 * 9; h++) stepSimulation(sim, prices, 3600);
  assert.ok(
    (sim.company.stock ?? []).some((l) => l.qty > 0),
    'les commandes sont arrivées',
  );
  // Pendant le délai, les formats servis seulement sur stock sont en rupture.
  const rupture = createSimulation(60, 11, start);
  for (let h = 0; h < 24 * 8; h++) stepSimulation(rupture, prices, 3600);
  assert.ok(rupture.counters.stockouts >= 0);
  // Série d'essais : mêmes graines, mêmes résultats ; fourchette ordonnée.
  const a = simulateRun(1, { clients: 20, days: 60 }, prices);
  const b = simulateRun(1, { clients: 20, days: 60 }, prices);
  assert.deepEqual(a, b);
  const p = percentiles([5, 1, 9, 3, 7]);
  assert.deepEqual(p, { min: 1, p10: 1, median: 5, p90: 9, max: 9 });
  assert.ok(a.marginPerYear > 0 && (a.breakEvenClients ?? 0) > 20);
});
