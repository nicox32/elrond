/**
 * Fiches espèces de l'encyclopédie du jeu (onglet Animaux), recopiées depuis les captures du joueur.
 * Une espèce absente ici n'a pas encore de fiche : on n'invente rien.
 */
import type { NeedType } from '../logic/types.ts';

export type EnergyKind = 'balle' | 'slug' | 'fleche';

/** Plage en joules, ou `null` quand le jeu dit « Inadapté ». */
export type Range = [number, number] | null;

export interface SpeciesInfo {
  animalClass: number;
  trophyType: string;
  /** Rangs de trophée estimés (score). */
  trophyRange?: [number, number];
  energy: {
    balle?: Range;
    grenaille?: Range;
    /** Pour la chevrotine, le jeu donne une distance (m), pas une énergie. */
    chevrotineM?: Range;
    slug?: Range;
    fleche?: Range;
  };
  activity: string;
  activityNote?: string;
  /** Début de chaque phase de la journée, dans l'ordre (la dernière court jusqu'à la première). */
  routine?: { hour: number; need: NeedType }[];
  senses?: { vue: string; odorat: string; ouie: string };
  biomes?: string;
  description?: string;
  anecdote?: string;
}

export const SPECIES_INFO: Record<string, SpeciesInfo> = {
  'cerf-mulet': {
    animalClass: 6,
    trophyType: 'Bois',
    trophyRange: [115, 610],
    energy: { balle: [1500, 4000], grenaille: null, chevrotineM: [10, 30], slug: [700, 3000], fleche: [70, 300] },
    activity: 'Crépusculaire',
    activityNote: 'Actif le soir et le matin',
    routine: [
      { hour: 0, need: 'boire' },
      { hour: 2, need: 'dormir' },
      { hour: 7, need: 'manger' },
      { hour: 12, need: 'boire' },
      { hour: 16, need: 'dormir' },
      { hour: 20, need: 'manger' },
    ],
    senses: { vue: 'Bonne', odorat: 'Bon', ouie: 'Bonne' },
    biomes: 'Forêts, prairies, régions arides et montagnes ; pratiquement partout, grâce à son adaptabilité.',
    description:
      "La sous-espèce de cerf mulet la plus répandue, dont la population s'étend des régions septentrionales des États américains du sud-ouest aux provinces du nord du Canada.",
    anecdote: "Les cerfs mulets n'ont pas d'incisives ; leur palais est simplement très solide.",
  },
};

export function getSpeciesInfo(id: string | undefined): SpeciesInfo | undefined {
  return id ? SPECIES_INFO[id] : undefined;
}

/** Phases de la routine sous forme de créneaux [début, fin[ en heures. */
export function routineSlots(info: SpeciesInfo): { from: number; to: number; need: NeedType }[] {
  const r = info.routine ?? [];
  return r.map((p, i) => ({ from: p.hour, to: r[(i + 1) % r.length].hour, need: p.need }));
}

/** Plage d'énergie à comparer selon le type d'arme. */
export function energyKindFor(weaponType: string | undefined): EnergyKind | undefined {
  if (weaponType === 'carabine') return 'balle';
  if (weaponType === 'fusil') return 'slug';
  if (weaponType === 'arc' || weaponType === 'arbalete') return 'fleche';
  return undefined;
}

export type EnergyCheck = 'ok' | 'faible' | 'forte' | 'inadapte';

export function checkEnergy(info: SpeciesInfo | undefined, kind: EnergyKind | undefined, joules: number | undefined): EnergyCheck | undefined {
  if (!info || !kind || joules === undefined) return undefined;
  const range = info.energy[kind];
  if (range === undefined) return undefined;
  if (range === null) return 'inadapte';
  if (joules < range[0]) return 'faible';
  if (joules > range[1]) return 'forte';
  return 'ok';
}

export const ENERGY_LABELS: { key: keyof SpeciesInfo['energy']; label: string; unit: string }[] = [
  { key: 'balle', label: 'Balle', unit: 'J' },
  { key: 'grenaille', label: 'Grenaille', unit: 'J' },
  { key: 'chevrotineM', label: 'Cartouches à chevrotine', unit: 'm' },
  { key: 'slug', label: 'Balles slug', unit: 'J' },
  { key: 'fleche', label: 'Flèche / carreau', unit: 'J' },
];

export function formatRange(r: Range | undefined, unit: string): string | undefined {
  if (r === undefined) return undefined;
  if (r === null) return 'Inadapté';
  return `${r[0]} – ${r[1]} ${unit}`;
}
