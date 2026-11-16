/**
 * Séries de cours pour les graphiques : historique quotidien sur 20 ans (cours.json, mis à jour chaque soir par
 * .github/workflows/cours-historiques.yml), relevés horaires et en direct de l'appli, et cours du moment.
 */
import { FEES } from './fees.ts';
import type { PricePoint } from './priceHistory.ts';
import type { Metal, Prices } from './types.ts';

export const COURS_URL = 'https://github.com/nicox32/elrond/releases/download/cours/cours.json';

/** Historique compact : jours depuis le 1er janvier 1970 et cours en €/g. */
export interface CoursData {
  updated: string;
  d: number[];
  g: number[];
  s: number[];
  p: number[];
}

/** Un métal, le ratio or/argent (« ratio ») ou le ratio or/platine (« ratioPt »). */
export type SeriesKind = Metal | 'ratio' | 'ratioPt';
export type PriceMode = 'spot' | 'buy' | 'sell';
export type Range = '5d' | '1m' | '6m' | '1y' | '5y' | '20y';

export const RANGES: { value: Range; label: string; days: number }[] = [
  { value: '5d', label: '5J', days: 5 },
  { value: '1m', label: '1M', days: 30 },
  { value: '6m', label: '6M', days: 182 },
  { value: '1y', label: '1A', days: 365 },
  { value: '5y', label: '5A', days: 1826 },
  { value: '20y', label: '20A', days: 7305 },
];

export interface SeriesPoint {
  t: number;
  v: number;
}

const DAY = 86_400_000;

export function isCoursData(x: unknown): x is CoursData {
  const c = x as CoursData | null;
  return (
    !!c &&
    typeof c.updated === 'string' &&
    [c.d, c.g, c.s, c.p].every((a) => Array.isArray(a) && a.length === c.d.length) &&
    c.d.length > 100
  );
}

/** Prix au tarif Orvia : cours au comptant, prix d'achat frais compris, ou prix net à la revente. */
export function applyMode(v: number, metal: Metal, mode: PriceMode): number {
  if (mode === 'buy') return v / (1 - FEES.buy[metal]);
  if (mode === 'sell') return v * (1 - FEES.sale);
  return v;
}

const valueOf = (kind: SeriesKind, p: Prices) =>
  kind === 'ratio' ? p.gold / p.silver : kind === 'ratioPt' ? p.gold / p.platinum : p[kind];

/**
 * Série complète (cours au comptant) : l'historique quotidien jusqu'au premier relevé de l'appli, puis les relevés
 * horaires et en direct, puis le cours du moment.
 */
export function fullSeries(
  data: CoursData | null,
  kind: SeriesKind,
  live: PricePoint[],
  now: { t: number; prices: Prices } | null,
): SeriesPoint[] {
  const own = [...live]
    .map((p) => ({ t: new Date(p.t).getTime(), prices: p.prices }))
    .filter((p) => Number.isFinite(p.t))
    .sort((a, b) => a.t - b.t);
  if (now) own.push(now);
  const firstOwn = own.length ? own[0].t : Number.POSITIVE_INFINITY;
  const out: SeriesPoint[] = [];
  if (data) {
    for (let i = 0; i < data.d.length; i++) {
      // Cours de clôture : placé en fin de journée (Paris).
      const t = data.d[i] * DAY + 17 * 3_600_000;
      if (t >= firstOwn) break;
      const prices = { gold: data.g[i], silver: data.s[i], platinum: data.p[i] };
      out.push({ t, v: valueOf(kind, prices) });
    }
  }
  for (const p of own) {
    if (out.length && p.t <= out[out.length - 1].t) continue;
    out.push({ t: p.t, v: valueOf(kind, p.prices) });
  }
  return out;
}

/** La partie de la série sur la période, avec le dernier point d'avant comme départ (si la période en manque). */
export function rangeSeries(series: SeriesPoint[], range: Range, mode: PriceMode = 'spot', metal?: Metal) {
  if (!series.length) return [];
  const end = series[series.length - 1].t;
  const from = end - (RANGES.find((r) => r.value === range)?.days ?? 365) * DAY;
  let i = series.findIndex((p) => p.t >= from);
  if (i > 0) i -= 1;
  const part = series.slice(Math.max(0, i));
  return mode === 'spot' || !metal ? part : part.map((p) => ({ t: p.t, v: applyMode(p.v, metal, mode) }));
}

export function seriesStats(points: SeriesPoint[]) {
  if (points.length < 2) return null;
  const first = points[0].v;
  const last = points[points.length - 1].v;
  let min = points[0];
  let max = points[0];
  for (const p of points) {
    if (p.v < min.v) min = p;
    if (p.v > max.v) max = p;
  }
  const avg = points.reduce((s, p) => s + p.v, 0) / points.length;
  return { first, last, change: last - first, changePct: ((last - first) / first) * 100, min, max, avg };
}

/** Indice du point le plus proche d'un instant (séries triées). */
export function nearestIndex(points: SeriesPoint[], t: number): number {
  let lo = 0;
  let hi = points.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (points[mid].t < t) lo = mid + 1;
    else hi = mid;
  }
  if (lo > 0 && Math.abs(points[lo - 1].t - t) <= Math.abs(points[lo].t - t)) return lo - 1;
  return lo;
}

/** Zone du ratio or/argent. */
export function ratioZone(r: number): { label: string; tone: 'silver' | 'neutral' | 'gold' } {
  if (r >= 80) return { label: 'Argent bon marché par rapport à l’or', tone: 'silver' };
  if (r <= 50) return { label: 'Argent cher par rapport à l’or', tone: 'gold' };
  return { label: 'Zone habituelle', tone: 'neutral' };
}
