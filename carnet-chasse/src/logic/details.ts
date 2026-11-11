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
}

export const ANIMAL_FIELDS: NumField[] = [
  { key: 'ageYears', label: 'Âge (ans)', placeholder: '12' },
  { key: 'animalClass', label: 'Classe', placeholder: '6' },
  { key: 'conditionPct', label: 'Condition physique (%)', placeholder: '31,7' },
  { key: 'weightKg', label: 'Poids (kg)', placeholder: '99,78' },
];

export const SHOT_FIELDS: NumField[] = [
  { key: 'trackingDistanceM', label: 'Distance de traque (m)', placeholder: '60' },
  { key: 'impactEnergyJ', label: "Énergie à l'impact (J)", placeholder: '2138' },
  { key: 'windMs', label: 'Vent (m/s)', placeholder: '3,8' },
];

export const PRICE_FIELDS: NumField[] = [
  { key: 'timeDegradationKg', label: 'Dégradation temps (kg)', placeholder: '0' },
  { key: 'shotDegradationKg', label: 'Dégradation tir (kg)', placeholder: '3,35' },
  { key: 'butcherWasteKg', label: 'Déchets de découpe (kg)', placeholder: '39,91' },
  { key: 'netWeightKg', label: 'Poids après découpe (kg)', placeholder: '56,52' },
  { key: 'pricePerKg', label: "Prix à l'unité (/kg)", placeholder: '2,6' },
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
export const RATING_CHOICES = ['S++', 'S+', 'S', 'A', 'B', 'C', 'D'];
export const MEASUREMENT_PRESETS = [
  'Longueur du merrain',
  'Écart intérieur',
  'Circonférence à la base',
  'Longueur des cors typiques',
  'Écart extérieur',
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

/** Organes touchés, du plus abîmé au moins abîmé. */
export function damagedOrgans(h: Hunt): { id: OrganId; label: string; pct: number }[] {
  return Object.entries(h.organs ?? {})
    .filter((e): e is [OrganId, number] => typeof e[1] === 'number' && e[1] > 0)
    .map(([id, pct]) => ({ id, label: ORGAN_LABELS[id], pct }))
    .sort((a, b) => b.pct - a.pct);
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
