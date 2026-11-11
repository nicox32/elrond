export type ReserveId = 'new-laurentia' | 'kilimaya' | 'headquarters';

export type SpeciesCategory = 'petit' | 'oiseau' | 'moyen' | 'grand' | 'dangereux';

export type WeaponType = 'carabine' | 'fusil' | 'arc' | 'arbalete';

export type ShotZone = 'coeur' | 'poumons' | 'foie' | 'tete' | 'cou' | 'colonne' | 'autre';

export type TrophyType = 'normal' | 'non-typique';

export type HuntMode = 'solo' | 'coop';

export interface Reserve {
  id: ReserveId;
  name: string;
  region: string;
  areaKm2: number;
}

export interface Species {
  id: string;
  name: string;
  /** Nom anglais affiché dans le jeu. */
  gameName: string;
  reserveId: ReserveId;
  category: SpeciesCategory;
  /** Animal capable de charger le chasseur. */
  dangerous?: boolean;
  /** Mise à jour qui a ajouté l'espèce, si elle n'était pas là au départ. */
  addedIn?: string;
}

export interface Weapon {
  id: string;
  name: string;
  caliber: string;
  type: WeaponType;
  /** Arme ajoutée par le joueur (absente de la liste fournie avec l'appli). */
  custom?: boolean;
}

export type AnimalSex = 'male' | 'femelle';

export type Outcome = 'vendu' | 'empaille';

export const ORGAN_IDS = [
  'chair',
  'poumon-gauche',
  'poumon-droit',
  'coeur',
  'artere',
  'foie',
  'os',
  'colonne',
  'crane',
  'cerveau',
  'estomac',
  'intestin',
] as const;

export type OrganId = (typeof ORGAN_IDS)[number];

export interface Measurement {
  label: string;
  /** En cm. */
  value: number;
}

/** Valeurs numériques du rapport de chasse du jeu (toutes facultatives). */
export interface HuntNumbers {
  animalClass?: number;
  conditionPct?: number;
  ageYears?: number;
  weightKg?: number;
  trackingDistanceM?: number;
  windMs?: number;
  impactEnergyJ?: number;
  timeDegradationKg?: number;
  shotDegradationKg?: number;
  butcherWasteKg?: number;
  netWeightKg?: number;
  pricePerKg?: number;
  salePrice?: number;
}

export interface Hunt extends HuntNumbers {
  id: string;
  /** Date ISO de la chasse. */
  date: string;
  reserveId: ReserveId;
  speciesId: string;
  weaponId: string;
  ammo?: string;
  distanceM?: number;
  shotZone?: ShotZone;
  /** Tué d'une seule balle (ou flèche). */
  oneShot: boolean;
  trophyScore?: number;
  trophyType: TrophyType;
  mode: HuntMode;
  /** Trophée encore à exposer au pavillon. */
  toPlace: boolean;
  photoUri?: string;
  notes?: string;
  // Rapport de chasse du jeu (écrans Aperçu, Poids et prix, Trophée).
  sex?: AnimalSex;
  coat?: string;
  rarity?: string;
  ammoType?: string;
  ammoClass?: string;
  /** Heure de la mort en jeu, minutes depuis minuit. */
  killTimeMin?: number;
  trackingTimeSec?: number;
  hunterDetected?: boolean;
  dogUsed?: boolean;
  weather?: string;
  organs?: Partial<Record<OrganId, number>>;
  measurements?: Measurement[];
  huntRating?: string;
  trophyStars?: number;
  outcome?: Outcome;
}

export type NeedType = 'boire' | 'manger' | 'dormir';

/** Zone de besoin repérée en jeu, avec l'horaire affiché sur la carte. */
export interface NeedZone {
  id: string;
  speciesId: string;
  reserveId: ReserveId;
  need: NeedType;
  /** Minutes depuis minuit. */
  startMin: number;
  endMin: number;
  place?: string;
}

export interface CarnetState {
  hunts: Hunt[];
  ownedWeaponIds: string[];
  customWeapons: Weapon[];
  needZones: NeedZone[];
  lastReserveId?: ReserveId;
  lastWeaponId?: string;
}

export const EMPTY_STATE: CarnetState = { hunts: [], ownedWeaponIds: [], customWeapons: [], needZones: [] };
