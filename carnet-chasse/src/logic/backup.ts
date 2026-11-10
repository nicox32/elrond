import type {
  CarnetState,
  Hunt,
  HuntMode,
  NeedType,
  NeedZone,
  ReserveId,
  ShotZone,
  TrophyType,
  Weapon,
  WeaponType,
} from './types.ts';

export const BACKUP_APP = 'carnet-chasse-woth2';
export const BACKUP_VERSION = 1;

const RESERVE_IDS: ReserveId[] = ['new-laurentia', 'kilimaya', 'headquarters'];
const SHOT_ZONES: ShotZone[] = ['coeur', 'poumons', 'foie', 'tete', 'cou', 'colonne', 'autre'];
const TROPHY_TYPES: TrophyType[] = ['normal', 'non-typique'];
const MODES: HuntMode[] = ['solo', 'coop'];
const NEED_TYPES: NeedType[] = ['boire', 'manger', 'dormir'];
const WEAPON_TYPES: WeaponType[] = ['carabine', 'fusil', 'arc', 'arbalete'];

type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): string | undefined => (typeof v === 'string' && v.length > 0 ? v : undefined);
const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
const oneOf = <T extends string>(v: unknown, list: T[]): T | undefined =>
  typeof v === 'string' && (list as string[]).includes(v) ? (v as T) : undefined;

function parseHunt(v: unknown): Hunt | null {
  if (!isObj(v)) return null;
  const id = str(v.id);
  const date = str(v.date);
  const reserveId = oneOf(v.reserveId, RESERVE_IDS);
  const speciesId = str(v.speciesId);
  const weaponId = str(v.weaponId);
  if (!id || !date || !reserveId || !speciesId || !weaponId) return null;
  return {
    id,
    date,
    reserveId,
    speciesId,
    weaponId,
    ammo: str(v.ammo),
    distanceM: num(v.distanceM),
    shotZone: oneOf(v.shotZone, SHOT_ZONES),
    oneShot: v.oneShot === true,
    trophyScore: num(v.trophyScore),
    trophyType: oneOf(v.trophyType, TROPHY_TYPES) ?? 'normal',
    mode: oneOf(v.mode, MODES) ?? 'solo',
    toPlace: v.toPlace === true,
    photoUri: str(v.photoUri),
    notes: str(v.notes),
  };
}

function parseWeapon(v: unknown): Weapon | null {
  if (!isObj(v)) return null;
  const id = str(v.id);
  const name = str(v.name);
  const caliber = str(v.caliber);
  const type = oneOf(v.type, WEAPON_TYPES);
  if (!id || !name || !caliber || !type) return null;
  return { id, name, caliber, type, custom: true };
}

const minuteOfDay = (v: unknown): number | undefined => {
  const n = num(v);
  return n !== undefined && Number.isInteger(n) && n >= 0 && n < 24 * 60 ? n : undefined;
};

function parseZone(v: unknown): NeedZone | null {
  if (!isObj(v)) return null;
  const id = str(v.id);
  const speciesId = str(v.speciesId);
  const reserveId = oneOf(v.reserveId, RESERVE_IDS);
  const need = oneOf(v.need, NEED_TYPES);
  const startMin = minuteOfDay(v.startMin);
  const endMin = minuteOfDay(v.endMin);
  if (!id || !speciesId || !reserveId || !need || startMin === undefined || endMin === undefined) return null;
  return { id, speciesId, reserveId, need, startMin, endMin, place: str(v.place) };
}

/** Valide des données lues (stockage ou sauvegarde importée). Les entrées illisibles sont ignorées. */
export function parseState(raw: unknown): CarnetState | null {
  if (!isObj(raw)) return null;
  const hunts = Array.isArray(raw.hunts) ? raw.hunts.map(parseHunt).filter((h): h is Hunt => h !== null) : [];
  const customWeapons = Array.isArray(raw.customWeapons)
    ? raw.customWeapons.map(parseWeapon).filter((w): w is Weapon => w !== null)
    : [];
  const ownedWeaponIds = Array.isArray(raw.ownedWeaponIds)
    ? [...new Set(raw.ownedWeaponIds.filter((id): id is string => typeof id === 'string'))]
    : [];
  const needZones = Array.isArray(raw.needZones)
    ? raw.needZones.map(parseZone).filter((z): z is NeedZone => z !== null)
    : [];
  return {
    hunts,
    customWeapons,
    needZones,
    ownedWeaponIds,
    lastReserveId: oneOf(raw.lastReserveId, RESERVE_IDS),
    lastWeaponId: str(raw.lastWeaponId),
  };
}

export function exportBackup(state: CarnetState, now = new Date()): string {
  return JSON.stringify(
    { app: BACKUP_APP, version: BACKUP_VERSION, exportedAt: now.toISOString(), data: state },
    null,
    2,
  );
}

export type ImportResult = { ok: true; state: CarnetState } | { ok: false; error: string };

export function importBackup(text: string): ImportResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: "Ce texte n'est pas une sauvegarde valide (JSON illisible)." };
  }
  if (!isObj(raw) || raw.app !== BACKUP_APP) {
    return { ok: false, error: "Ce texte ne vient pas d'une sauvegarde du carnet de chasse." };
  }
  if (typeof raw.version !== 'number' || raw.version > BACKUP_VERSION) {
    return { ok: false, error: "Sauvegarde créée par une version plus récente de l'appli." };
  }
  const state = parseState(raw.data);
  if (!state) return { ok: false, error: 'Sauvegarde vide ou abîmée.' };
  return { ok: true, state };
}
