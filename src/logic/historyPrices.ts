/**
 * Cours historiques réels (20 ans, un point par semaine, en €/g) livrés avec l'appli, pour rejouer une période passée
 * dans le simulateur de l'Espace DEV : crise de 2008, baisse de 2012, Covid, hausse récente.
 */
import { COURS_SNAPSHOT } from './coursData.ts';
import type { Prices } from './types.ts';

const DAY = 86_400_000;

/** Premier et dernier jour couverts par l'historique. */
export function historyBounds(): { first: Date; last: Date } {
  const d = COURS_SNAPSHOT.d;
  return { first: new Date(d[0] * DAY), last: new Date(d[d.length - 1] * DAY) };
}

/** Cours des trois métaux à une date, par interpolation entre deux points de l'historique (borné aux extrémités). */
export function priceAtDate(date: Date, data = COURS_SNAPSHOT): Prices {
  const days = date.getTime() / DAY;
  const d = data.d;
  if (days <= d[0]) return { gold: data.g[0], silver: data.s[0], platinum: data.p[0] };
  const n = d.length - 1;
  if (days >= d[n]) return { gold: data.g[n], silver: data.s[n], platinum: data.p[n] };
  // Recherche dichotomique du premier point après la date.
  let lo = 0;
  let hi = n;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (d[mid] <= days) lo = mid;
    else hi = mid;
  }
  const t = (days - d[lo]) / (d[hi] - d[lo]);
  const mix = (a: number[]) => a[lo] + (a[hi] - a[lo]) * t;
  return { gold: mix(data.g), silver: mix(data.s), platinum: mix(data.p) };
}

/** Périodes proposées pour rejouer l'histoire. */
export const HISTORY_PRESETS = [
  { id: 'crisis', label: '2008-2011 : crise financière', start: '2008-01-07', years: 3 },
  { id: 'fall', label: '2012-2015 : baisse de l’or', start: '2012-01-02', years: 3 },
  { id: 'covid', label: '2019-2022 : Covid et inflation', start: '2019-01-07', years: 3 },
  { id: 'recent', label: '2023-2026 : hausse récente', start: '2023-11-20', years: 3 },
  { id: 'ten', label: '10 ans : 2016-2026', start: '2016-11-21', years: 10 },
] as const;
export type HistoryPresetId = (typeof HISTORY_PRESETS)[number]['id'];

export const historyPreset = (id: HistoryPresetId) => HISTORY_PRESETS.find((p) => p.id === id) ?? HISTORY_PRESETS[0];
