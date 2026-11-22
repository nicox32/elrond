/**
 * Simulation de clients fictifs, exécutée toutes les heures par GitHub Actions (.github/workflows/simulation.yml).
 * - 50 clients en temps réel, aux cours réels du moment : l'état est repris de la dernière exécution, et le temps écoulé
 *   (même si GitHub a retardé la tâche) est rattrapé.
 * - 15 000 clients par tranche de revenu sur des périodes historiques réelles : recalculé si le modèle a changé.
 * Rien n'est lié aux vrais comptes. Sortie : out/state.json (état), out/summary.json et out/population.json (lus par
 * l'appli, Espace DEV).
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';

import {
  buildCloudPopulation,
  buildCloudSummary,
  type CloudPopulation,
  type CloudSummary,
  isCloudPopulation,
  isCloudSummary,
  POPULATION_MODEL_VERSION,
  POPULATION_URL,
  SIMULATION_RELEASE_URL,
  SUMMARY_URL,
} from '../src/logic/cloudSim.ts';
import { fetchLivePrices, referenceQuote } from '../src/logic/prices.ts';
import {
  catchUp,
  createSimulation,
  type MixId,
  MIXES,
  restoreSimulation,
  serializeSimulation,
} from '../src/logic/simulation.ts';
import type { Prices } from '../src/logic/types.ts';

async function download(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { redirect: 'follow' });
    return res.ok ? await res.text() : null;
  } catch {
    return null;
  }
}

function parse<T>(text: string | null, guard: (x: unknown) => x is T): T | null {
  if (!text) return null;
  try {
    const x: unknown = JSON.parse(text);
    return guard(x) ? x : null;
  } catch {
    return null;
  }
}

async function main() {
  const now = new Date();
  const reset = process.env.SIM_RESET === 'true';
  const forcePop = process.env.SIM_FORCE_POPULATION === 'true';
  const mixEnv = process.env.SIM_MIX ?? 'balanced';
  const mix: MixId = mixEnv in MIXES ? (mixEnv as MixId) : 'balanced';
  const rampDays = Number(process.env.SIM_RAMP_DAYS ?? 180);

  // Cours réels du moment (sinon cours de référence).
  let live: Prices;
  try {
    live = (await fetchLivePrices()).prices;
  } catch (e) {
    console.warn('Cours en direct indisponibles :', e instanceof Error ? e.message : e);
    live = referenceQuote(now).prices;
  }

  const previousSummary = reset ? null : parse(await download(SUMMARY_URL), isCloudSummary);
  const saved = reset ? null : restoreSimulation(await download(`${SIMULATION_RELEASE_URL}/state.json`));
  let sim;
  let advanced = 0;
  if (saved) {
    sim = saved.sim;
    advanced = catchUp(sim, live, (now.getTime() - saved.savedAt.getTime()) / 1000);
    console.log(`Simulation reprise : ${Math.round(advanced / 3600)} h rattrapées.`);
  } else {
    sim = createSimulation(50, 2026, now, { mix, priceMode: 'live', rampDays });
    console.log(`Nouvelle simulation : 50 clients, répartition ${mix}, arrivée sur ${rampDays} jours.`);
  }

  mkdirSync('out', { recursive: true });
  writeFileSync('out/state.json', serializeSimulation(sim, now));
  writeFileSync('out/summary.json', JSON.stringify(buildCloudSummary(sim, live, previousSummary, now)));

  // Population de 15 000 clients : recalculée seulement si le modèle a changé (ou sur demande).
  const previousPop: CloudPopulation | null = forcePop ? null : parse(await download(POPULATION_URL), isCloudPopulation);
  if (!previousPop || previousPop.modelVersion !== POPULATION_MODEL_VERSION) {
    const t0 = Date.now();
    const pop = buildCloudPopulation(now);
    writeFileSync('out/population.json', JSON.stringify(pop));
    console.log(`Population recalculée en ${Math.round((Date.now() - t0) / 1000)} s.`);
  } else {
    writeFileSync('out/population.json', JSON.stringify(previousPop));
    console.log('Population inchangée.');
  }
  if (!existsSync('out/summary.json')) throw new Error('Résumé non écrit.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
