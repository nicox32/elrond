/**
 * Rapport de chasse du jeu (fin de chasse : Aperçu, Poids et prix, Trophée) : libellés, listes de choix
 * et calculs pour la saisie à la main.
 */
import type { Hunt, HuntNumbers, OrganId } from './types.ts';

export type NumKey = keyof HuntNumbers;

export interface NumField {
  key: NumKey;
  label: string;
  placeholder: string;
  /** Unité affichée dans la case (m, kg, J…). */
  unit?: string;
}

export const ANIMAL_FIELDS: NumField[] = [
  { key: 'ageYears', label: 'Âge', placeholder: '12', unit: 'ans' },
  { key: 'animalClass', label: 'Classe', placeholder: '6' },
  { key: 'conditionPct', label: 'Condition physique', placeholder: '31,7', unit: '%' },
  { key: 'weightKg', label: 'Poids', placeholder: '99,78', unit: 'kg' },
];

export const SHOT_FIELDS: NumField[] = [
  { key: 'trackingDistanceM', label: 'Distance de traque', placeholder: '60', unit: 'm' },
  { key: 'impactEnergyJ', label: "Énergie à l'impact", placeholder: '2138', unit: 'J' },
  { key: 'windMs', label: 'Vent', placeholder: '3,8', unit: 'm/s' },
];

export const PRICE_FIELDS: NumField[] = [
  { key: 'timeDegradationKg', label: 'Dégradation temps', placeholder: '0', unit: 'kg' },
  { key: 'shotDegradationKg', label: 'Dégradation tir', placeholder: '3,35', unit: 'kg' },
  { key: 'butcherWasteKg', label: 'Déchets de découpe', placeholder: '39,91', unit: 'kg' },
  { key: 'netWeightKg', label: 'Poids après découpe', placeholder: '56,52', unit: 'kg' },
  { key: 'pricePerKg', label: "Prix à l'unité", placeholder: '2,6', unit: '/kg' },
  { key: 'salePrice', label: 'Prix de vente', placeholder: '146' },
];

export const ALL_NUM_FIELDS: NumField[] = [...ANIMAL_FIELDS, ...SHOT_FIELDS, ...PRICE_FIELDS];

export const ORGAN_LABELS: Record<OrganId, string> = {
  chair: 'Chair',
  'poumon-gauche': 'Poumon gauche',
  'poumon-droit': 'Poumon droit',
  coeur: 'Cœur',
  artere: 'Artère',
  foie: 'Foie',
  os: 'Os',
  colonne: 'Colonne vertébrale',
  crane: 'Crâne',
  cerveau: 'Cerveau',
  estomac: 'Estomac',
  intestin: 'Intestin',
};

/** Choix rapides vus en jeu ; chaque champ accepte aussi un texte libre. */
export const WEATHER_CHOICES = ['Ensoleillé', 'Partiellement nuageux', 'Nuageux', 'Pluie', 'Brouillard', 'Neige'];
/** Classement de chasse, du meilleur (S++ : prélèvement parfait) au pire (E : carcasse saccagée). */
export const RATING_CHOICES = ['S++', 'S+', 'S', 'A++', 'A+', 'A', 'B', 'C', 'D', 'E'];

/** Ce que veut dire la note, d'après sa place dans l'échelle. */
export function ratingMeaning(rating: string | undefined): string | undefined {
  const i = rating ? RATING_CHOICES.indexOf(rating.trim().toUpperCase()) : -1;
  if (i < 0) return undefined;
  if (i === 0) return 'Prélèvement parfait : tir éthique, viande préservée.';
  if (i === RATING_CHOICES.length - 1) return 'Carcasse saccagée, presque invendable.';
  return `${i + 1}e palier sur ${RATING_CHOICES.length} : la note suit la part de viande intacte que vous pourrez vendre (elle ne change pas la valeur génétique du trophée).`;
}

export interface RatingFacts {
  rating?: string;
  oneShot?: boolean;
  /** Zone touchée : libellé et bon tir ou non (défaut de l'épaule). */
  zone?: { label: string; good: boolean };
  energy?: 'ok' | 'faible' | 'forte' | 'inadapte';
  /** La classe de l'arme couvre-t-elle celle de l'animal ? */
  weaponFit?: boolean;
  organWarnings?: string[];
  trackingDistanceM?: number;
  trackingTimeSec?: number;
  weightKg?: number;
  shotDegradationKg?: number;
}

/** Ce qui, dans le rapport noté, a pu faire baisser la note (sous S++). */
export function ratingHints(f: RatingFacts): string[] {
  const r = f.rating?.trim().toUpperCase();
  if (!r || r === 'S++') return [];
  const out: string[] = [];
  if (f.oneShot === false) out.push('Plusieurs tirs : un seul tir dans le cœur ou les poumons fait grimper la note.');
  if (f.zone && !f.zone.good) out.push(`Zone touchée : ${f.zone.label}. Visez le défaut de l’épaule (cœur, poumons) pour garder les morceaux nobles.`);
  if (f.energy && f.energy !== 'ok') out.push('Énergie à l’impact hors de la fourchette du jeu pour cette espèce.');
  if (f.weaponFit === false) out.push('Classe de l’arme différente de celle de l’animal : la bonne classe donne l’énergie d’impact idéale.');
  for (const w of f.organWarnings ?? []) out.push(w);
  if (f.trackingDistanceM !== undefined || f.trackingTimeSec !== undefined) {
    const parts = [
      f.trackingDistanceM !== undefined ? `${f.trackingDistanceM} m` : null,
      f.trackingTimeSec !== undefined ? formatDuration(f.trackingTimeSec) : null,
    ].filter(Boolean);
    out.push(`Traque : ${parts.join(' en ')} avant la mort. Plus l’animal meurt vite, sans courir, meilleure est la note.`);
  }
  if (f.shotDegradationKg && f.weightKg) {
    out.push(`${String(f.shotDegradationKg).replace('.', ',')} kg de viande abîmée par le tir (${String(Math.round((f.shotDegradationKg / f.weightKg) * 1000) / 10).replace('.', ',')} % du poids).`);
  }
  if (!out.length) out.push('Rien de ce que vous avez noté n’explique la note : remplissez la zone, l’énergie, la traque et les dégâts aux organes.');
  return out;
}
export const MEASUREMENT_PRESETS = [
  'Longueur du merrain',
  'Écart intérieur',
  'Circonférence à la base',
  'Longueur des cors typiques',
  'Écart extérieur',
  'Longueur de corne',
  'Circonférence au 1er quart',
  'Circonférence au 2e quart',
  'Circonférence au 3e quart',
];

/** « 9m49s », « 9 min 49 s », « 9:49 », « 49s », « 9m » → secondes. */
export function parseDuration(text: string): number | undefined {
  const t = text.trim().toLowerCase().replace(/\s+/g, '');
  if (!t) return undefined;
  let m = t.match(/^(\d+):(\d{1,2})$/);
  if (m) return Number(m[2]) < 60 ? Number(m[1]) * 60 + Number(m[2]) : undefined;
  m = t.match(/^(?:(\d+)(?:m|min))?(?:(\d+)(?:s|sec))?$/);
  if (m && (m[1] !== undefined || m[2] !== undefined)) {
    const sec = Number(m[2] ?? 0);
    return sec < 60 || m[1] === undefined ? Number(m[1] ?? 0) * 60 + sec : undefined;
  }
  return undefined;
}

export function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return m ? `${m} min ${String(s).padStart(2, '0')} s` : `${s} s`;
}

/** Poids après découpe = poids brut − dégradations − déchets (si toutes les valeurs sont connues). */
export function computeNetWeight(h: HuntNumbers): number | undefined {
  if (h.weightKg === undefined || h.butcherWasteKg === undefined) return undefined;
  const net = h.weightKg - (h.timeDegradationKg ?? 0) - (h.shotDegradationKg ?? 0) - h.butcherWasteKg;
  return net >= 0 ? Math.round(net * 100) / 100 : undefined;
}

/** Prix de la viande estimé = poids après découpe × prix au kilo, arrondi à l'unité inférieure comme en jeu. */
export function estimateMeatPrice(h: HuntNumbers): number | undefined {
  const net = h.netWeightKg ?? computeNetWeight(h);
  if (net === undefined || h.pricePerKg === undefined) return undefined;
  return Math.floor(net * h.pricePerKg + 1e-9);
}

/** Total des prix de vente notés. */
export function totalEarnings(hunts: Hunt[]): number {
  return hunts.reduce((sum, h) => sum + (h.salePrice ?? 0), 0);
}

export type OrganDamage = Partial<Record<OrganId, number>>;

/** Tous les tirs notés : tir 1 puis les suivants. */
export function organShots(h: Pick<Hunt, 'organs' | 'moreShots'>): OrganDamage[] {
  return [h.organs ?? {}, ...(h.moreShots ?? [])];
}

/** Organes touchés par un tir, du plus abîmé au moins abîmé. */
export function damagedOrgans(h: Pick<Hunt, 'organs'>): { id: OrganId; label: string; pct: number }[] {
  return Object.entries(h.organs ?? {})
    .filter((e): e is [OrganId, number] => typeof e[1] === 'number' && e[1] > 0)
    .map(([id, pct]) => ({ id, label: ORGAN_LABELS[id], pct }))
    .sort((a, b) => b.pct - a.pct);
}

export const OS_WARNING_PCT = 5;

/** Alertes tirées des dégâts aux organes : os (épaule) et ventre (estomac, intestin). */
export function organWarnings(shots: Partial<Record<OrganId, number>>[]): string[] {
  const hit = (o: OrganId, min = 0) => shots.some((d) => (d[o] ?? 0) > min);
  const out: string[] = [];
  // Quelques % d'os (côtes) restent normaux sur un tir au défaut de l'épaule : alerte au-delà de 5 %.
  if (hit('os', OS_WARNING_PCT)) out.push('Os nettement touché : trop en avant, l’os de l’épaule détruit de la viande de qualité et peut bloquer la balle avant les poumons.');
  if (hit('estomac') || hit('intestin'))
    out.push('Ventre touché : hémorragie très lente, l’animal court longtemps avant de mourir. Visez plus en avant, juste derrière la patte avant.');
  return out;
}

/** Robes vues en jeu : « Standard » et les quatre conditions rares de l'encyclopédie. */
export const COAT_CHOICES: { label: string; rare: boolean; hint?: string }[] = [
  { label: 'Standard', rare: false },
  { label: 'Albinos', rare: true, hint: 'fourrure blanche, yeux rouges' },
  { label: 'Leucique', rare: true, hint: 'fourrure blanche, yeux normaux' },
  { label: 'Mélanique', rare: true, hint: 'fourrure noire ou foncée' },
  { label: 'Érythrique', rare: true, hint: 'fourrure rose ou rougeâtre' },
];

const norm = (s: string) => s.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const RARE_ROOTS = ['albin', 'leuci', 'melan', 'erythr'];

/** Robe rare (albinisme, leucisme, mélanisme, érythrisme) : trophée « Ultime » potentiel, à empailler. */
export function isRareCoat(coat: string | undefined): boolean {
  if (!coat) return false;
  const c = norm(coat);
  return RARE_ROOTS.some((r) => c.includes(r));
}

export interface ConditionBand {
  label: string;
  min: number;
  max: number;
  count: number;
  avgScore?: number;
  avgStars?: number;
}

/**
 * « Tout est dans le journal » : moyenne des scores et des étoiles par tranche de condition physique,
 * pour voir le lien entre condition et qualité des trophées (rien n'est garanti, ce sont des tendances).
 */
export function conditionVsTrophy(hunts: Hunt[]): ConditionBand[] {
  const bands: ConditionBand[] = [
    { label: 'Moins de 40 %', min: 0, max: 40, count: 0 },
    { label: '40 à 69 %', min: 40, max: 70, count: 0 },
    { label: '70 % et plus', min: 70, max: 101, count: 0 },
  ];
  for (const b of bands) {
    const inBand = hunts.filter((h) => h.conditionPct !== undefined && h.conditionPct >= b.min && h.conditionPct < b.max);
    b.count = inBand.length;
    const scores = inBand.map((h) => h.trophyScore).filter((n): n is number => n !== undefined);
    const stars = inBand.map((h) => h.trophyStars).filter((n): n is number => n !== undefined);
    if (scores.length) b.avgScore = scores.reduce((a, c) => a + c, 0) / scores.length;
    if (stars.length) b.avgStars = stars.reduce((a, c) => a + c, 0) / stars.length;
  }
  return bands;
}
