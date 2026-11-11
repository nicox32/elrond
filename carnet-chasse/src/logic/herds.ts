/** Suivi de troupeau : verdicts du guide pour chaque animal, résumé et règle « un seul mâle par session ». */
import { type Advice, advise, type Verdict } from './management.ts';
import type { Herd, HerdAnimal, PopulationStatus } from './types.ts';

export const POPULATION_LABELS: Record<PopulationStatus, string> = {
  vulnerable: 'Vulnérable',
  stable: 'Stable',
  saine: 'Saine',
  prospere: 'Prospère',
};

export const AGE_LABELS = { jeune: 'Jeune', adulte: 'Adulte', mur: 'Mûr' } as const;

export function adviceFor(a: HerdAnimal): Advice {
  return advise({ sex: a.sex, age: a.age, stars: a.stars, conditionPct: a.conditionPct });
}

export interface HerdSummary {
  alive: number;
  males: number;
  females: number;
  young: number;
  taken: number;
  /** Animaux vivants par verdict du guide. */
  byVerdict: Record<Verdict, number>;
}

export function summarizeHerd(herd: Herd): HerdSummary {
  const byVerdict: Record<Verdict, number> = { eliminer: 0, trophee: 0, surveiller: 0, possible: 0, epargner: 0, libre: 0 };
  let alive = 0;
  let males = 0;
  let females = 0;
  let young = 0;
  let taken = 0;
  for (const a of herd.animals) {
    if (a.status === 'preleve') taken += 1;
    if (a.status !== 'vivant') continue;
    alive += 1;
    if (a.sex === 'male') males += 1;
    else females += 1;
    if (a.age === 'jeune') young += 1;
    byVerdict[adviceFor(a).verdict] += 1;
  }
  return { alive, males, females, young, taken, byVerdict };
}

const sameDay = (a: string, b: Date) => {
  const d = new Date(a);
  return d.getFullYear() === b.getFullYear() && d.getMonth() === b.getMonth() && d.getDate() === b.getDate();
};

/** Mâles du troupeau prélevés aujourd'hui (règle d'or : un seul mâle par troupeau et par session). */
export function malesTakenToday(herd: Herd, now = new Date()): number {
  return herd.animals.filter((a) => a.sex === 'male' && a.status === 'preleve' && a.takenAt && sameDay(a.takenAt, now)).length;
}

/** Ordre d'affichage : vivants d'abord, cibles en tête, puis trophées, à surveiller, à épargner. */
const VERDICT_ORDER: Verdict[] = ['eliminer', 'trophee', 'possible', 'surveiller', 'libre', 'epargner'];

export function sortAnimals(animals: HerdAnimal[]): HerdAnimal[] {
  const rank = (a: HerdAnimal) => (a.status === 'vivant' ? VERDICT_ORDER.indexOf(adviceFor(a).verdict) : 10 + (a.status === 'preleve' ? 0 : 1));
  return [...animals].sort((a, b) => rank(a) - rank(b) || a.label.localeCompare(b.label));
}

/** Nombre de jours (réels) depuis la dernière visite. */
export function daysSince(iso: string, now = new Date()): number {
  return Math.max(0, Math.floor((now.getTime() - new Date(iso).getTime()) / 86_400_000));
}
