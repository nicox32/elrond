import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ageLabel,
  buildCloudPopulation,
  buildCloudSummary,
  isCloudPopulation,
  isCloudSummary,
  POPULATION_CAPS,
  POPULATION_MODEL_VERSION,
} from '../src/logic/cloudSim.ts';
import { HISTORY_PRESETS } from '../src/logic/historyPrices.ts';
import { catchUp, createSimulation, restoreSimulation, serializeSimulation } from '../src/logic/simulation.ts';

const live = { gold: 103.53, silver: 1.24, platinum: 38.33 };

test('simulation cloud : exécutions toutes les heures, retards rattrapés, série d’un point par jour', () => {
  const t0 = new Date('2026-11-23T08:00:00Z');
  let sim = createSimulation(50, 2026, t0, { mix: 'balanced', priceMode: 'live', rampDays: 180 });
  let summary = buildCloudSummary(sim, live, null, t0);
  assert.equal(summary.series.length, 1);
  let state = serializeSimulation(sim, t0);
  let at = t0;
  // Heures normales, un retard de GitHub de 5 h, puis de 3 jours : le temps écoulé est rattrapé à chaque fois.
  for (const delayH of [1, 1, 5, 1, 72, 1, 24]) {
    at = new Date(at.getTime() + delayH * 3_600_000);
    const saved = restoreSimulation(state)!;
    catchUp(saved.sim, live, (at.getTime() - saved.savedAt.getTime()) / 1000);
    sim = saved.sim;
    summary = buildCloudSummary(sim, live, JSON.parse(JSON.stringify(summary)), at);
    state = serializeSimulation(sim, at);
  }
  assert.equal(sim.now.getTime() - t0.getTime(), 105 * 3_600_000, '105 h écoulées au total, retards compris');
  assert.equal(summary.summary.days, 4);
  // Un point par jour simulé où une exécution a eu lieu : le premier jour, puis les jours 3 et 4 après le gros retard.
  assert.equal(summary.series.length, 3);
  // Un seul point par jour simulé, dans l'ordre.
  const days = summary.series.map((p) => p.date);
  assert.deepEqual(days, [...new Set(days)].sort());
  assert.ok(isCloudSummary(JSON.parse(JSON.stringify(summary))));
  assert.equal(summary.config.clients, 50);
  assert.equal(summary.config.priceMode, 'live');
  // L'état reste petit : l'exécution horaire reste rapide.
  assert.ok(state.length < 200_000, `état de ${state.length} octets`);
  // Pas de données personnelles : que des clients simulés.
  assert.ok(!/@|IBAN|FR76/.test(JSON.stringify(summary)));
});

test('simulation cloud : même résultat qu’une exécution d’une traite', () => {
  const t0 = new Date('2026-11-23T08:00:00Z');
  const direct = createSimulation(30, 5, t0, { priceMode: 'live' });
  catchUp(direct, live, 3 * 86_400);
  let sim = createSimulation(30, 5, t0, { priceMode: 'live' });
  let state = serializeSimulation(sim, t0);
  let at = t0;
  for (let i = 0; i < 72; i++) {
    at = new Date(at.getTime() + 3_600_000);
    const saved = restoreSimulation(state)!;
    catchUp(saved.sim, live, 3600);
    sim = saved.sim;
    state = serializeSimulation(sim, at);
  }
  const a = buildCloudSummary(direct, live, null, at);
  const b = buildCloudSummary(sim, live, null, at);
  assert.deepEqual(a.summary, b.summary);
  assert.deepEqual(a.stock, b.stock);
});

test('population cloud : tous les scénarios (périodes × plafonds), valide et reproductible', () => {
  const pop = buildCloudPopulation(new Date('2026-11-23T08:00:00Z'));
  assert.equal(pop.modelVersion, POPULATION_MODEL_VERSION);
  assert.deepEqual(
    Object.keys(pop.presets),
    HISTORY_PRESETS.map((p) => p.id),
  );
  for (const p of HISTORY_PRESETS) {
    for (const cap of POPULATION_CAPS) {
      const sc = pop.presets[p.id].caps[String(cap)];
      assert.ok(sc.summary.peakInsured <= cap + 1, `${p.id} ${cap}`);
      assert.equal(sc.summary.clients, 15_000);
      assert.ok(sc.series.length >= 2);
    }
  }
  assert.ok(isCloudPopulation(JSON.parse(JSON.stringify(pop))));
  // Le plafond plus haut débloque des commandes.
  const r = pop.presets.recent.caps;
  assert.ok(r['500000'].summary.insuranceBlocked >= r['2000000'].summary.insuranceBlocked);
  // Un fichier de taille raisonnable pour le téléphone.
  assert.ok(JSON.stringify(pop).length < 100_000);
});

test('ancienneté d’une mise à jour et validation des fichiers', () => {
  const now = new Date('2026-11-23T12:00:00Z');
  assert.equal(ageLabel('2026-11-23T11:59:30Z', now), 'à l’instant');
  assert.equal(ageLabel('2026-11-23T11:30:00Z', now), 'il y a 30 min');
  assert.equal(ageLabel('2026-11-23T09:00:00Z', now), 'il y a 3 h');
  assert.equal(ageLabel('2026-11-18T12:00:00Z', now), 'il y a 5 jours');
  assert.equal(isCloudSummary(null), false);
  assert.equal(isCloudSummary({ v: 2 }), false);
  assert.equal(isCloudPopulation({ v: 1 }), false);
});
