import type { Hunt, ReserveId, Species } from './types.ts';

export interface SpeciesSummary {
  speciesId: string;
  count: number;
  bestScore?: number;
  bestHuntId?: string;
  lastDate?: string;
}

export interface WeaponStats {
  count: number;
  oneShotRate?: number;
  avgDistanceM?: number;
  maxDistanceM?: number;
}

export interface Overview {
  total: number;
  speciesHunted: number;
  speciesTotal: number;
  maxDistanceM?: number;
  toPlace: number;
}

/** Chasses de la plus récente à la plus ancienne. */
export function sortByDateDesc(hunts: Hunt[]): Hunt[] {
  return [...hunts].sort((a, b) => b.date.localeCompare(a.date));
}

export function summarizeSpecies(hunts: Hunt[]): Map<string, SpeciesSummary> {
  const out = new Map<string, SpeciesSummary>();
  for (const h of hunts) {
    const s = out.get(h.speciesId) ?? { speciesId: h.speciesId, count: 0 };
    s.count += 1;
    if (h.trophyScore !== undefined && (s.bestScore === undefined || h.trophyScore > s.bestScore)) {
      s.bestScore = h.trophyScore;
      s.bestHuntId = h.id;
    }
    if (!s.lastDate || h.date > s.lastDate) s.lastDate = h.date;
    out.set(h.speciesId, s);
  }
  return out;
}

export function weaponStats(hunts: Hunt[], weaponId: string): WeaponStats {
  const mine = hunts.filter((h) => h.weaponId === weaponId);
  if (mine.length === 0) return { count: 0 };
  const distances = mine.map((h) => h.distanceM).filter((d): d is number => d !== undefined);
  return {
    count: mine.length,
    oneShotRate: mine.filter((h) => h.oneShot).length / mine.length,
    avgDistanceM: distances.length ? distances.reduce((a, b) => a + b, 0) / distances.length : undefined,
    maxDistanceM: distances.length ? Math.max(...distances) : undefined,
  };
}

/** L'espèce vit-elle dans cette zone (réserve principale ou zones supplémentaires) ? */
export function inReserve(s: Species, reserveId: ReserveId): boolean {
  return s.reserveId === reserveId || !!s.alsoIn?.includes(reserveId);
}

export function overview(hunts: Hunt[], species: Species[], reserveId?: ReserveId): Overview {
  const scoped = reserveId ? hunts.filter((h) => h.reserveId === reserveId) : hunts;
  const pool = reserveId ? species.filter((s) => inReserve(s, reserveId)) : species;
  const poolIds = new Set(pool.map((s) => s.id));
  const hunted = new Set(scoped.map((h) => h.speciesId).filter((id) => poolIds.has(id)));
  const distances = scoped.map((h) => h.distanceM).filter((d): d is number => d !== undefined);
  return {
    total: scoped.length,
    speciesHunted: hunted.size,
    speciesTotal: pool.length,
    maxDistanceM: distances.length ? Math.max(...distances) : undefined,
    toPlace: scoped.filter((h) => h.toPlace).length,
  };
}

/** Lit un nombre saisi au clavier (virgule ou point). Renvoie undefined si le champ est vide ou invalide. */
export function parseNumber(text: string): number | undefined {
  const cleaned = text.trim().replace(',', '.');
  if (cleaned === '') return undefined;
  const n = Number(cleaned);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

export function formatNumber(n: number, digits = 0): string {
  return n.toFixed(digits).replace('.', ',');
}

/** Score de trophée : jusqu'à 2 décimales, sans zéros inutiles (48,6 ; 152,25 ; 40). */
export function formatScore(n: number): string {
  return String(Math.round(n * 100) / 100).replace('.', ',');
}

const pad = (n: number) => String(n).padStart(2, '0');

/** 10/11/2026 à 17:45 */
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} à ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

export function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
