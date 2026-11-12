/**
 * Fiches espèces de l'encyclopédie du jeu (onglet Animaux). Le jeu ne montre une fiche qu'après le premier
 * prélèvement de l'espèce : le joueur la recopie alors dans l'appli (fiches « perso », dans l'état).
 * Les fiches fournies ici viennent de captures du joueur ; on n'invente rien.
 */
import type { RoutineNeed } from '../logic/types.ts';
import { getSpecies } from './game.ts';

export type EnergyKind = 'balle' | 'slug' | 'fleche';

/** Plage en joules, ou `null` quand le jeu dit « Inadapté ». */
export type Range = [number, number] | null;

export interface SpeciesInfo {
  animalClass?: number;
  matureAgeYears?: number;
  lifespanYears?: number;
  trophyType?: string;
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
  activity?: string;
  activityNote?: string;
  /** Début de chaque phase de la journée, dans l'ordre (la dernière court jusqu'à la première). */
  routine?: { hour: number; need: RoutineNeed }[];
  senses?: { vue: string; odorat: string; ouie: string };
  biomes?: string;
  description?: string;
  anecdote?: string;
}

export const SPECIES_INFO: Record<string, SpeciesInfo> = {
  'cerf-mulet': {
    animalClass: 6,
    // Espérance de vie donnée par le joueur.
    lifespanYears: 12,
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
  'mouflon-dall': {
    // Habitat et horaires donnés par le joueur ; le reste de la fiche est à recopier depuis l'encyclopédie.
    energy: {},
    routine: [
      { hour: 5, need: 'manger' },
      { hour: 9, need: 'boire' },
      { hour: 13, need: 'inconnu' },
      { hour: 17, need: 'manger' },
      { hour: 21, need: 'inconnu' },
    ],
    biomes:
      'Exclusivement en altitude, dans les zones rocheuses et montagneuses : crêtes, falaises, plateaux enneigés ou rocailleux. Pas dans les forêts denses ni au fond des vallées.',
    activityNote: 'Boit de 9 h à 13 h autour des lacs et ruisseaux de montagne : le plus facile pour le repérer à découvert. Mange sur les versants herbeux et rocheux.',
  },
};

/**
 * Fiche d'une espèce : celle recopiée par le joueur (`sheets`) complète ou remplace celle fournie avec l'appli.
 */
export function getSpeciesInfo(id: string | undefined, sheets?: Record<string, SpeciesInfo>): SpeciesInfo | undefined {
  if (!id) return undefined;
  const base = SPECIES_INFO[id];
  const mine = sheets?.[id];
  if (!mine) return base;
  if (!base) return mine;
  const defined = <T extends object>(o: T) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;
  return { ...base, ...defined(mine), energy: { ...base.energy, ...defined(mine.energy) } };
}

/** Une fiche a-t-elle au moins une information utile ? */
export function isSheetEmpty(info: SpeciesInfo): boolean {
  const { energy, routine, senses, ...rest } = info;
  return (
    Object.values(rest).every((v) => v === undefined || v === '') &&
    Object.values(energy).every((v) => v === undefined) &&
    !routine?.length &&
    !senses
  );
}

/** Phases de la routine sous forme de créneaux [début, fin[ en heures. */
export function routineSlots(info: SpeciesInfo): { from: number; to: number; need: RoutineNeed }[] {
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

/** Classe de l'animal : celle de la fiche du jeu recopiée, sinon celle de la liste des espèces. */
export function speciesClass(id: string | undefined, sheets?: Record<string, SpeciesInfo>): number | undefined {
  if (!id) return undefined;
  return getSpeciesInfo(id, sheets)?.animalClass ?? getSpecies(id)?.animalClass;
}
