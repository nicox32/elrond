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
  /** Mode histoire propre à la réserve. */
  story: boolean;
  description: string;
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
  /** Courte description (habitat, comportement). */
  blurb?: string;
  /** Classe (niveau) de l'animal, de 1 à 9 : sert à choisir arme et munition. */
  animalClass?: number;
  /** Autres zones où l'espèce est aussi présente (ex. le QG). */
  alsoIn?: ReserveId[];
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

export type AgeStage = 'jeune' | 'adulte' | 'mur';

export type AnimalStatus = 'vivant' | 'preleve' | 'disparu';

/** Animal observé dans un troupeau suivi. */
export interface HerdAnimal {
  id: string;
  /** Repère libre : « Grand mâle », « Mâle bois cassé »… */
  label: string;
  sex: AnimalSex;
  age: AgeStage;
  stars?: number;
  conditionPct?: number;
  status: AnimalStatus;
  /** Date ISO de la dernière observation. */
  lastSeen: string;
  /** Date ISO du prélèvement, si prélevé. */
  takenAt?: string;
  /** Robe observée (Standard, Albinos, Leucique, Mélanique, Érythrique). */
  coat?: string;
  notes?: string;
}

export type PopulationStatus = 'vulnerable' | 'stable' | 'saine' | 'prospere';

/** Troupeau suivi d'une session à l'autre. */
export interface Herd {
  id: string;
  name: string;
  speciesId: string;
  reserveId: ReserveId;
  place?: string;
  /** Tente (ou chalet) la plus proche pour dormir et revenir vite. */
  camp?: string;
  population?: PopulationStatus;
  animals: HerdAnimal[];
  createdAt: string;
  lastVisit: string;
  notes?: string;
  /** Identifiant du rappel « toutes les 24 h » programmé sur ce téléphone. */
  reminderId?: string;
}

export type EnergyRange = [number, number] | null;

/** Fiche espèce recopiée par le joueur (même forme que les fiches fournies, tout facultatif). */
export interface SpeciesSheet {
  animalClass?: number;
  trophyType?: string;
  trophyRange?: [number, number];
  energy: { balle?: EnergyRange; grenaille?: EnergyRange; chevrotineM?: EnergyRange; slug?: EnergyRange; fleche?: EnergyRange };
  activity?: string;
  activityNote?: string;
  routine?: { hour: number; need: NeedType }[];
  senses?: { vue: string; odorat: string; ouie: string };
  biomes?: string;
  description?: string;
  anecdote?: string;
}

/** Fiche d'arme recopiée depuis l'armurerie du jeu (tout facultatif), avec la photo du joueur. */
export interface WeaponSheet {
  action?: string;
  description?: string;
  /** « Niveau » affiché en jeu : classes d'animaux visées. */
  classRange?: [number, number];
  magazine?: number;
  precision?: string;
  recoil?: string;
  noise?: string;
  photoUri?: string;
}

/** Munition du jeu (fournie ou ajoutée par le joueur). */
export interface Ammo {
  id: string;
  name: string;
  brand?: string;
  caliber: string;
  classRange?: [number, number];
  description?: string;
  projectile?: string;
  penetration?: string;
  recoilReduced?: string;
  precision?: string;
  cavity?: string;
  photoUri?: string;
  custom?: boolean;
}

export interface CarnetState {
  hunts: Hunt[];
  ownedWeaponIds: string[];
  customWeapons: Weapon[];
  needZones: NeedZone[];
  herds: Herd[];
  /** Fiches espèces recopiées depuis l'encyclopédie du jeu, par identifiant d'espèce. */
  speciesSheets: Record<string, SpeciesSheet>;
  /** Lien de la carte interactive (Shackmaps) choisi pour chaque réserve. */
  mapUrls: Partial<Record<ReserveId, string>>;
  /** Fiches d'armes du joueur (corrections, photos), par identifiant d'arme. */
  weaponSheets: Record<string, WeaponSheet>;
  /** Munitions corrigées ou ajoutées par le joueur, par identifiant. */
  ammoSheets: Record<string, Ammo>;
  ownedAmmoIds: string[];
  lastReserveId?: ReserveId;
  lastWeaponId?: string;
}

export const EMPTY_STATE: CarnetState = {
  hunts: [],
  ownedWeaponIds: [],
  customWeapons: [],
  needZones: [],
  herds: [],
  speciesSheets: {},
  mapUrls: {},
  weaponSheets: {},
  ammoSheets: {},
  ownedAmmoIds: [],
};
