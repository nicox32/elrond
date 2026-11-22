/**
 * Simulation de clients fictifs exécutée dans le cloud (GitHub Actions, .github/workflows/simulation.yml) : le
 * serveur fait avancer la simulation de 50 clients en temps réel et recalcule la population de 15 000 clients sur des
 * périodes historiques réelles, puis publie des fichiers JSON que l'appli lit en lecture seule (Espace DEV).
 */
import { HISTORY_PRESETS } from "./historyPrices.ts";
import { percentiles } from "./simulation.ts";
import {
  type CustodyScheme,
  runPopulation,
  type PopSummary,
} from "./population.ts";
import {
  type Simulation,
  type SimSummary,
  summarize,
  summarizeBySegment,
  type SegmentRow,
} from "./simulation.ts";
import type { Prices } from "./types.ts";

export const SIMULATION_RELEASE_URL =
  "https://github.com/nicox32/elrond/releases/download/simulation";
export const SUMMARY_URL = `${SIMULATION_RELEASE_URL}/summary.json`;
export const POPULATION_URL = `${SIMULATION_RELEASE_URL}/population.json`;

/** À changer quand le modèle de la population change : le serveur recalcule alors tous les scénarios. */
export const POPULATION_MODEL_VERSION = 4;

export interface DailyPoint {
  /** Jour simulé (AAAA-MM-JJ). */
  date: string;
  operations: number;
  revenue: number;
  margin: number;
  insured: number;
  gold: number;
}

export interface CloudSummary {
  v: 1;
  updatedAt: string;
  startedAt: string;
  simNow: string;
  config: { clients: number; mix: string; rampDays: number; priceMode: string };
  prices: Prices;
  summary: SimSummary;
  segments: SegmentRow[];
  counters: Simulation["counters"];
  stock: { product: string; qty: number; inTransit: number }[];
  events: { at: string; text: string; kind: string }[];
  series: DailyPoint[];
}

/** Résumé publié pour l'appli : chiffres, segments, stock, dernières opérations et un point par jour simulé. */
export function buildCloudSummary(
  sim: Simulation,
  live: Prices,
  previous: CloudSummary | null,
  now = new Date(),
): CloudSummary {
  const prices = sim.prices ?? live;
  const summary = summarize(sim, prices);
  const series = [...(previous?.series ?? [])];
  const day = sim.now.toISOString().slice(0, 10);
  const point: DailyPoint = {
    date: day,
    operations: summary.operations,
    revenue: summary.revenue.total,
    margin: summary.margin,
    insured: summary.insured,
    gold: Math.round(prices.gold * 100) / 100,
  };
  if (series.length && series[series.length - 1].date === day)
    series[series.length - 1] = point;
  else series.push(point);
  const products = new Set<string>();
  for (const l of sim.company.stock ?? []) products.add(l.product);
  for (const o of sim.pending) products.add(o.product);
  return {
    v: 1,
    updatedAt: now.toISOString(),
    startedAt: sim.startedAt.toISOString(),
    simNow: sim.now.toISOString(),
    config: {
      clients: sim.clients.length,
      mix: sim.mixId,
      rampDays: sim.rampDays,
      priceMode: sim.priceMode,
    },
    prices,
    summary,
    segments: summarizeBySegment(sim, prices),
    counters: sim.counters,
    stock: [...products].map((product) => ({
      product,
      qty: (sim.company.stock ?? [])
        .filter((l) => l.product === product)
        .reduce((n, l) => n + l.qty, 0),
      inTransit: sim.pending
        .filter((o) => o.product === product)
        .reduce((n, o) => n + o.qty, 0),
    })),
    events: sim.events
      .slice(0, 20)
      .map((e) => ({ at: e.at, text: e.text, kind: e.kind })),
    series: series.slice(-400),
  };
}

/** Fourchette d'une série d'essais avec des hasards différents : minimum, 10 %, médiane, 90 %, maximum. */
export interface Range {
  min: number;
  p10: number;
  median: number;
  p90: number;
  max: number;
}

export interface PopulationScenario {
  /** Détail d'un essai (la première graine). */
  summary: PopSummary;
  /** Fourchette sur plusieurs essais. */
  range: {
    runs: number;
    result: Range;
    resultWithGold: Range;
    peakInsured: Range;
    stockouts: Range;
  };
  /** Un point tous les 6 mois environ. */
  series: {
    date: string;
    clients: number;
    assets: number;
    insured: number;
    gold: number;
  }[];
}

export interface CloudPopulation {
  v: 1;
  modelVersion: number;
  updatedAt: string;
  /** Scénarios : période historique puis plafond d'assurance (en euros). */
  presets: Record<
    string,
    {
      label: string;
      /** Garde actuelle, par plafond d'assurance. */
      caps: Record<string, PopulationScenario>;
      /** Autres façons de facturer la garde (plafond d'assurance de 500 000 €). */
      custody: Partial<Record<CustodyScheme, PopulationScenario>>;
    }
  >;
}

export const POPULATION_CAPS = [500_000, 2_000_000] as const;

/** Recalcule tous les scénarios de la population de 15 000 clients (arrivée en courbe en S sur 24 mois), sur `runs` essais. */
export function buildCloudPopulation(
  now = new Date(),
  runs = 8,
): CloudPopulation {
  const presets: CloudPopulation["presets"] = {};
  const scenario = (
    opts: Parameters<typeof runPopulation>[0],
  ): PopulationScenario => {
    const { pop, summary } = runPopulation(opts);
    const all = [summary];
    for (let k = 1; k < runs; k++)
      all.push(runPopulation({ ...opts, seed: 2026 + k }).summary);
    const pct = (f: (s: PopSummary) => number): Range =>
      percentiles(all.map(f));
    return {
      summary,
      range: {
        runs: all.length,
        result: pct((s) => s.result),
        resultWithGold: pct((s) => s.resultWithGold),
        peakInsured: pct((s) => s.peakInsured),
        stockouts: pct((s) => s.stockouts),
      },
      series: pop.series
        .filter((_, i) => i % 26 === 0)
        .map((x) => ({
          date: x.date,
          clients: x.clients,
          assets: x.assets,
          insured: x.insured,
          gold: x.gold,
        })),
    };
  };
  for (const p of HISTORY_PRESETS) {
    const base = {
      start: new Date(`${p.start}T08:00:00Z`),
      weeks: Math.round(p.years * 52),
      rampWeeks: 104,
      prices: "history" as const,
    };
    const caps: Record<string, PopulationScenario> = {};
    for (const cap of POPULATION_CAPS)
      caps[String(cap)] = scenario({ ...base, insuranceCap: cap });
    const custody: Partial<Record<CustodyScheme, PopulationScenario>> = {};
    for (const scheme of ["perGram", "mixed", "negotiated"] as const) {
      custody[scheme] = scenario({
        ...base,
        insuranceCap: POPULATION_CAPS[0],
        custody: scheme,
      });
    }
    presets[p.id] = { label: p.label, caps, custody };
  }
  return {
    v: 1,
    modelVersion: POPULATION_MODEL_VERSION,
    updatedAt: now.toISOString(),
    presets,
  };
}

export function isCloudSummary(x: unknown): x is CloudSummary {
  const s = x as CloudSummary | null;
  return (
    !!s &&
    s.v === 1 &&
    typeof s.updatedAt === "string" &&
    !!s.summary &&
    Array.isArray(s.segments)
  );
}

export function isCloudPopulation(x: unknown): x is CloudPopulation {
  const p = x as CloudPopulation | null;
  return !!p && p.v === 1 && !!p.presets && typeof p.updatedAt === "string";
}

/** « il y a 3 h », « il y a 2 jours » : ancienneté d'une mise à jour. */
export function ageLabel(iso: string, now = new Date()): string {
  const min = Math.max(
    0,
    Math.round((now.getTime() - new Date(iso).getTime()) / 60_000),
  );
  if (min < 2) return "à l’instant";
  if (min < 90) return `il y a ${min} min`;
  const h = Math.round(min / 60);
  if (h < 48) return `il y a ${h} h`;
  return `il y a ${Math.round(h / 24)} jours`;
}
