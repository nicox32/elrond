import { ALL_NUM_FIELDS } from './details.ts';
import { isMapUrl } from './maps.ts';
import { ORGAN_IDS } from './types.ts';
import type {
  Ammo,
  WeaponSheet,
  EnergyRange,
  SpeciesSheet,
  AgeStage,
  AnimalStatus,
  Herd,
  HerdAnimal,
  PopulationStatus,
  AnimalSex,
  CarnetState,
  Measurement,
  OrganId,
  Outcome,
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

const SEXES: AnimalSex[] = ['male', 'femelle'];
const OUTCOMES: Outcome[] = ['vendu', 'empaille'];
const bool = (v: unknown): boolean | undefined => (typeof v === 'boolean' ? v : undefined);

function parseOrgans(v: unknown): Partial<Record<OrganId, number>> | undefined {
  if (!isObj(v)) return undefined;
  const out: Partial<Record<OrganId, number>> = {};
  for (const id of ORGAN_IDS) {
    const n = num(v[id]);
    if (n !== undefined && n >= 0) out[id] = n;
  }
  return Object.keys(out).length ? out : undefined;
}

function parseMeasurements(v: unknown): Measurement[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out = v.flatMap((m) => {
    if (!isObj(m)) return [];
    const label = str(m.label);
    const value = num(m.value);
    return label && value !== undefined ? [{ label, value }] : [];
  });
  return out.length ? out : undefined;
}

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
    ...Object.fromEntries(
      ALL_NUM_FIELDS.map((f) => [f.key, num(v[f.key])]).filter((e) => e[1] !== undefined && (e[1] as number) >= 0),
    ),
    sex: oneOf(v.sex, SEXES),
    coat: str(v.coat),
    rarity: str(v.rarity),
    ammoType: str(v.ammoType),
    ammoClass: str(v.ammoClass),
    killTimeMin: (() => {
      const n = num(v.killTimeMin);
      return n !== undefined && Number.isInteger(n) && n >= 0 && n < 1440 ? n : undefined;
    })(),
    trackingTimeSec: num(v.trackingTimeSec),
    hunterDetected: bool(v.hunterDetected),
    dogUsed: bool(v.dogUsed),
    weather: str(v.weather),
    organs: parseOrgans(v.organs),
    measurements: parseMeasurements(v.measurements),
    huntRating: str(v.huntRating),
    trophyStars: (() => {
      const n = num(v.trophyStars);
      return n !== undefined && Number.isInteger(n) && n >= 1 && n <= 5 ? n : undefined;
    })(),
    outcome: oneOf(v.outcome, OUTCOMES),
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

const AGES: AgeStage[] = ['jeune', 'adulte', 'mur'];
const STATUSES: AnimalStatus[] = ['vivant', 'preleve', 'disparu'];
const POPULATIONS: PopulationStatus[] = ['vulnerable', 'stable', 'saine', 'prospere'];

function parseAnimal(v: unknown): HerdAnimal | null {
  if (!isObj(v)) return null;
  const id = str(v.id);
  const sex = oneOf(v.sex, SEXES);
  const age = oneOf(v.age, AGES);
  const lastSeen = str(v.lastSeen);
  if (!id || !sex || !age || !lastSeen) return null;
  const stars = num(v.stars);
  const cond = num(v.conditionPct);
  return {
    id,
    label: str(v.label) ?? '',
    sex,
    age,
    stars: stars !== undefined && Number.isInteger(stars) && stars >= 1 && stars <= 5 ? stars : undefined,
    conditionPct: cond !== undefined && cond >= 0 && cond <= 100 ? cond : undefined,
    status: oneOf(v.status, STATUSES) ?? 'vivant',
    lastSeen,
    takenAt: str(v.takenAt),
    coat: str(v.coat),
    notes: str(v.notes),
  };
}

function parseHerd(v: unknown): Herd | null {
  if (!isObj(v)) return null;
  const id = str(v.id);
  const name = str(v.name);
  const speciesId = str(v.speciesId);
  const reserveId = oneOf(v.reserveId, RESERVE_IDS);
  const createdAt = str(v.createdAt);
  if (!id || !name || !speciesId || !reserveId || !createdAt) return null;
  return {
    id,
    name,
    speciesId,
    reserveId,
    place: str(v.place),
    camp: str(v.camp),
    population: oneOf(v.population, POPULATIONS),
    animals: Array.isArray(v.animals) ? v.animals.map(parseAnimal).filter((a): a is HerdAnimal => a !== null) : [],
    createdAt,
    lastVisit: str(v.lastVisit) ?? createdAt,
    notes: str(v.notes),
    reminderId: str(v.reminderId),
  };
}

const pair = (v: unknown): [number, number] | undefined => {
  if (!Array.isArray(v) || v.length !== 2) return undefined;
  const a = num(v[0]);
  const b = num(v[1]);
  return a !== undefined && b !== undefined && a >= 0 && b >= a ? [a, b] : undefined;
};
const energyRange = (v: unknown): EnergyRange | undefined => (v === null ? null : pair(v));
const ENERGY_KEYS = ['balle', 'grenaille', 'chevrotineM', 'slug', 'fleche'] as const;

function parseSheet(v: unknown): SpeciesSheet | null {
  if (!isObj(v)) return null;
  const energy: SpeciesSheet['energy'] = {};
  if (isObj(v.energy)) {
    for (const k of ENERGY_KEYS) {
      const r = energyRange(v.energy[k]);
      if (r !== undefined) energy[k] = r;
    }
  }
  const cls = num(v.animalClass);
  const routine = Array.isArray(v.routine)
    ? v.routine
        .flatMap((p) => {
          if (!isObj(p)) return [];
          const hour = num(p.hour);
          const need = oneOf(p.need, NEED_TYPES);
          return hour !== undefined && Number.isInteger(hour) && hour >= 0 && hour < 24 && need ? [{ hour, need }] : [];
        })
        .sort((a, b) => a.hour - b.hour)
    : undefined;
  const senses =
    isObj(v.senses) && (str(v.senses.vue) || str(v.senses.odorat) || str(v.senses.ouie))
      ? { vue: str(v.senses.vue) ?? '', odorat: str(v.senses.odorat) ?? '', ouie: str(v.senses.ouie) ?? '' }
      : undefined;
  return {
    animalClass: cls !== undefined && Number.isInteger(cls) && cls >= 1 && cls <= 10 ? cls : undefined,
    trophyType: str(v.trophyType),
    trophyRange: pair(v.trophyRange),
    energy,
    activity: str(v.activity),
    activityNote: str(v.activityNote),
    routine: routine?.length ? routine : undefined,
    senses,
    biomes: str(v.biomes),
    description: str(v.description),
    anecdote: str(v.anecdote),
  };
}

const classRange = (v: unknown): [number, number] | undefined => {
  const r = pair(v);
  return r && Number.isInteger(r[0]) && Number.isInteger(r[1]) && r[0] >= 1 && r[1] <= 10 ? r : undefined;
};

function parseWeaponSheet(v: unknown): WeaponSheet | null {
  if (!isObj(v)) return null;
  const mag = num(v.magazine);
  return {
    action: str(v.action),
    description: str(v.description),
    classRange: classRange(v.classRange),
    magazine: mag !== undefined && Number.isInteger(mag) && mag > 0 && mag < 100 ? mag : undefined,
    precision: str(v.precision),
    recoil: str(v.recoil),
    noise: str(v.noise),
    photoUri: str(v.photoUri),
  };
}

function parseAmmo(id: string, v: unknown): Ammo | null {
  if (!isObj(v)) return null;
  const name = str(v.name);
  const caliber = str(v.caliber);
  if (!name || !caliber) return null;
  return {
    id,
    name,
    brand: str(v.brand),
    caliber,
    classRange: classRange(v.classRange),
    description: str(v.description),
    projectile: str(v.projectile),
    penetration: str(v.penetration),
    recoilReduced: str(v.recoilReduced),
    precision: str(v.precision),
    cavity: str(v.cavity),
    photoUri: str(v.photoUri),
    custom: v.custom === true,
  };
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
  const speciesSheets: Record<string, SpeciesSheet> = {};
  if (isObj(raw.speciesSheets)) {
    for (const [id, v] of Object.entries(raw.speciesSheets)) {
      const sheet = parseSheet(v);
      if (sheet) speciesSheets[id] = sheet;
    }
  }
  const mapUrls: Partial<Record<ReserveId, string>> = {};
  if (isObj(raw.mapUrls)) {
    for (const r of RESERVE_IDS) {
      const u = str(raw.mapUrls[r]);
      if (u && isMapUrl(u)) mapUrls[r] = u;
    }
  }
  const weaponSheets: Record<string, WeaponSheet> = {};
  if (isObj(raw.weaponSheets)) {
    for (const [id, v] of Object.entries(raw.weaponSheets)) {
      const w = parseWeaponSheet(v);
      if (w) weaponSheets[id] = w;
    }
  }
  const ammoSheets: Record<string, Ammo> = {};
  if (isObj(raw.ammoSheets)) {
    for (const [id, v] of Object.entries(raw.ammoSheets)) {
      const a = parseAmmo(id, v);
      if (a) ammoSheets[id] = a;
    }
  }
  const ownedAmmoIds = Array.isArray(raw.ownedAmmoIds)
    ? [...new Set(raw.ownedAmmoIds.filter((x): x is string => typeof x === 'string'))]
    : [];
  const customChoices: Record<string, string[]> = {};
  if (isObj(raw.customChoices)) {
    for (const [k, v] of Object.entries(raw.customChoices)) {
      if (!Array.isArray(v)) continue;
      const list = [...new Set(v.filter((x): x is string => typeof x === 'string' && x.trim().length > 0).map((x) => x.trim()))];
      if (list.length) customChoices[k] = list.slice(0, 50);
    }
  }
  const herds = Array.isArray(raw.herds) ? raw.herds.map(parseHerd).filter((h): h is Herd => h !== null) : [];
  return {
    hunts,
    customWeapons,
    needZones,
    herds,
    speciesSheets,
    mapUrls,
    weaponSheets,
    ammoSheets,
    ownedAmmoIds,
    customChoices,
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
