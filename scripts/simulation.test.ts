import assert from 'node:assert/strict';
import test from 'node:test';

import { createSimulation, stepSimulation, summarize } from '../src/logic/simulation.ts';
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
  assert.equal(s.operations, sim.counters.buys + sim.counters.sells + sim.counters.withdrawals);
  assert.equal(s.days, 90);
  // Même graine : même simulation.
  const again = summarize(run(50, 90), prices);
  assert.deepEqual(again, s);
});
