/**
 * Horaires des zones de besoin (boire, manger, dormir). Routine standard tirée du guide du joueur ;
 * l'horaire exact d'un troupeau est celui affiché sur la carte quand on examine sa zone de besoin.
 */
import type { NeedType, NeedZone } from './types.ts';

export const MINUTES_PER_DAY = 24 * 60;

export const NEED_LABELS: Record<NeedType, string> = {
  boire: 'Boire',
  manger: 'Manger',
  dormir: 'Dormir',
};

export const NEED_ICONS: Record<NeedType, string> = {
  boire: '💧',
  manger: '🌿',
  dormir: '💤',
};

export interface RoutinePeriod {
  icon: string;
  label: string;
  /** Heure de début (incluse) et de fin (exclue), 0-24. */
  from: number;
  to: number;
  need: NeedType | 'nuit';
  title: string;
  text: string;
}

export const STANDARD_ROUTINE: RoutinePeriod[] = [
  {
    icon: '☀️',
    label: 'Matin',
    from: 8,
    to: 12,
    need: 'boire',
    title: "Zone d'abreuvement (boire)",
    text: 'Le meilleur moment : les animaux se regroupent au bord des rivières et des lacs, les lignes de vue sont dégagées, le tir à 150-200 m est facile.',
  },
  {
    icon: '🌤️',
    label: 'Après-midi',
    from: 12,
    to: 16,
    need: 'dormir',
    title: 'Zone de repos (dormir)',
    text: 'Cachés dans les hautes herbes, les fourrés ou sous les arbres : difficiles à voir et très vigilants au bruit.',
  },
  {
    icon: '🌆',
    label: 'Soir',
    from: 16,
    to: 20,
    need: 'manger',
    title: "Zone d'alimentation (manger)",
    text: 'Les troupeaux sortent dans les clairières, plaines et champs : idéal pour analyser la génétique du groupe à distance.',
  },
  {
    icon: '🌙',
    label: 'Nuit',
    from: 20,
    to: 8,
    need: 'nuit',
    title: 'Sommeil et déplacements nocturnes',
    text: 'Alternance repos et alimentation dans des zones plus denses. Visibilité faible, chasse plus complexe.',
  },
];

/** « 9:05 », « 09h05 », « 0905 » → minutes depuis minuit. */
export function parseTime(text: string): number | undefined {
  const m = text.trim().match(/^(\d{1,2})\s*[:hH.]?\s*(\d{2})?$/);
  if (!m) return undefined;
  const h = Number(m[1]);
  const min = m[2] ? Number(m[2]) : 0;
  if (h > 23 || min > 59) return undefined;
  return h * 60 + min;
}

export function formatTime(minutes: number): string {
  const m = ((Math.round(minutes) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/** Période de la routine standard à une heure donnée (minutes depuis minuit). */
export function routineAt(minute: number): RoutinePeriod {
  const h = (((minute % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY) / 60;
  return (
    STANDARD_ROUTINE.find((p) => (p.from < p.to ? h >= p.from && h < p.to : h >= p.from || h < p.to)) ??
    STANDARD_ROUTINE[STANDARD_ROUTINE.length - 1]
  );
}

/** La zone est-elle occupée à cette minute ? Gère les créneaux qui passent minuit. */
export function isActive(zone: NeedZone, minute: number): boolean {
  const { startMin: s, endMin: e } = zone;
  return s <= e ? minute >= s && minute < e : minute >= s || minute < e;
}

/** Minutes à attendre avant le début de la zone (0 si elle est en cours). */
export function minutesUntil(zone: NeedZone, minute: number): number {
  if (isActive(zone, minute)) return 0;
  return (zone.startMin - minute + MINUTES_PER_DAY) % MINUTES_PER_DAY;
}

/** Heure de réveil conseillée : un peu avant l'arrivée du troupeau, pour s'installer. */
export function wakeUpTime(zone: NeedZone, marginMin = 15): number {
  return (zone.startMin - marginMin + MINUTES_PER_DAY) % MINUTES_PER_DAY;
}

/** Zones en cours d'abord, puis les prochaines dans l'ordre d'arrivée. */
export function sortByNext(zones: NeedZone[], minute: number): NeedZone[] {
  return [...zones].sort((a, b) => minutesUntil(a, minute) - minutesUntil(b, minute) || a.startMin - b.startMin);
}
