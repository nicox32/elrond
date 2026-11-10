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

export interface Hunt {
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
}

export interface CarnetState {
  hunts: Hunt[];
  ownedWeaponIds: string[];
  customWeapons: Weapon[];
  lastReserveId?: ReserveId;
  lastWeaponId?: string;
}

export const EMPTY_STATE: CarnetState = { hunts: [], ownedWeaponIds: [], customWeapons: [] };
