import { type Metal, type PriceQuote, type Prices, SPOT_METALS } from './types.ts';

/** Un relevé de cours réels, pour les mini-courbes « en direct ». */
export interface PricePoint {
  t: string; // ISO
  prices: Prices;
}

/** On garde 24 h de relevés. */
export const PRICE_HISTORY_MS = 24 * 3_600_000;

/** Deux relevés plus proches que ça sont fusionnés (le dernier gagne). */
const MERGE_MS = 20_000;

const MAX_POINTS = 3000;

/** Ajoute un relevé de cours réels et oublie ceux de plus de 24 h. Les cours non réels sont ignorés. */
export function addPricePoint(history: PricePoint[], quote: PriceQuote): PricePoint[] {
  if (quote.source !== 'live') return history;
  const time = new Date(quote.fetchedAt).getTime();
  const from = time - PRICE_HISTORY_MS;
  const kept = history.filter((p) => {
    const t = new Date(p.t).getTime();
    return t >= from && t < time;
  });
  const last = kept[kept.length - 1];
  if (last && time - new Date(last.t).getTime() < MERGE_MS) kept.pop();
  kept.push({ t: quote.fetchedAt, prices: { ...quote.prices } });
  return kept.slice(-MAX_POINTS);
}

export interface MetalTrend {
  /** Valeurs (€/g) dans l'ordre chronologique. */
  values: number[];
  /** Variation en % entre le premier relevé gardé et le cours actuel. */
  changePct: number;
  /** Date du premier relevé gardé. */
  since: string | null;
}

/** Évolution d'un métal sur les relevés gardés (jusqu'à 24 h), terminée par le cours actuel. */
export function metalTrend(history: PricePoint[], metal: Metal, current: Prices): MetalTrend {
  // L'écu suit l'or : sa courbe est celle de l'or, à la prime actuelle.
  const ecuRatio = current.gold > 0 ? current.ecu / current.gold : 0;
  const values = history.map((p) => (metal === 'ecu' ? p.prices.gold * ecuRatio : p.prices[metal]));
  if (values.length === 0 || values[values.length - 1] !== current[metal]) values.push(current[metal]);
  const first = values[0];
  return {
    values,
    changePct: first > 0 ? ((current[metal] - first) / first) * 100 : 0,
    since: history[0]?.t ?? null,
  };
}

export function isPriceHistory(raw: unknown): raw is PricePoint[] {
  return (
    Array.isArray(raw) &&
    raw.every(
      (p) => p && typeof p.t === 'string' && p.prices && SPOT_METALS.every((m) => typeof p.prices[m] === 'number'),
    )
  );
}
