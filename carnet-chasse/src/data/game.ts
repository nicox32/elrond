/**
 * Données du jeu Way of the Hunter 2 : réserves, espèces (avec leur classe) et armes, d'après les infos du joueur.
 * Les calibres conseillés sont indicatifs : vérifiez en jeu.
 */
import type {
  Reserve,
  ReserveId,
  ShotZone,
  Species,
  SpeciesCategory,
  TrophyType,
  Weapon,
  WeaponType,
} from '../logic/types.ts';
import { inReserve } from '../logic/stats.ts';


export const RESERVES: Reserve[] = [
  {
    id: 'new-laurentia',
    name: 'New Laurentia',
    region: 'Canada',
    areaKm2: 100,
    story: true,
    description: "Grande réserve canadienne avec un mode histoire complet, axé sur l'étude de la faune nord-américaine (élans, ours, bisons…).",
  },
  {
    id: 'kilimaya',
    name: 'Kilimaya Reserve',
    region: 'Afrique',
    areaKm2: 100,
    story: true,
    description: 'Réserve africaine avec sa propre campagne narrative et ses espèces locales (hippopotames, zèbres…).',
  },
  {
    id: 'headquarters',
    name: 'Hearth & Hunt HQ',
    region: 'Montagnes Rocheuses',
    areaKm2: 16,
    story: false,
    description:
      "Quartier général compact dans les Rocheuses, sans scénario dédié : chasse rapide (wapiti, cerf mulet, lièvre, lagopède, canard colvert), pavillon principal à agrandir pour exposer tous vos trophées, stand de tir pour régler vos armes, et Elijah pour vous guider dans l'aménagement du domaine.",
  },
];

export const SPECIES: Species[] = [
  // New Laurentia
  { id: 'carcajou', name: "Glouton d'Amérique", gameName: 'American Wolverine', reserveId: 'new-laurentia', category: 'moyen', animalClass: 3 },
  { id: 'grizzly', name: 'Grizzli', gameName: 'Grizzly Bear', reserveId: 'new-laurentia', category: 'grand', animalClass: 7 },
  { id: 'mouflon-dall', name: 'Mouflon de Dall', gameName: 'Dall Sheep', reserveId: 'new-laurentia', category: 'moyen', animalClass: 5 },
  { id: 'dindon', name: "Dindon sauvage de l'Est", gameName: 'Eastern Wild Turkey', reserveId: 'new-laurentia', category: 'oiseau', animalClass: 2 },
  { id: 'loup', name: 'Loup gris du Nord-Ouest', gameName: 'Northwestern Grey Wolf', reserveId: 'new-laurentia', category: 'moyen', animalClass: 4 },
  { id: 'colvert', name: 'Canard colvert', gameName: 'Mallard', reserveId: 'new-laurentia', category: 'oiseau', animalClass: 1, alsoIn: ['headquarters'] },
  { id: 'orignal', name: "Élan de l'Ouest", gameName: 'Western Moose', reserveId: 'new-laurentia', category: 'grand', animalClass: 8 },
  { id: 'lagopede', name: 'Lagopède à queue blanche', gameName: 'White-tailed Ptarmigan', reserveId: 'new-laurentia', category: 'oiseau', animalClass: 1, alsoIn: ['headquarters'] },
  { id: 'wapiti', name: 'Wapiti des Rocheuses', gameName: 'Rocky Mountain Elk', reserveId: 'new-laurentia', category: 'grand', animalClass: 7, alsoIn: ['headquarters'] },
  { id: 'cerf-mulet', name: 'Cerf mulet des Rocheuses', gameName: 'Rocky Mountain Mule Deer', reserveId: 'new-laurentia', category: 'moyen', animalClass: 6, alsoIn: ['headquarters'] },
  { id: 'lievre', name: "Lièvre d'Amérique", gameName: 'Snowshoe Hare', reserveId: 'new-laurentia', category: 'petit', animalClass: 1, alsoIn: ['headquarters'] },
  { id: 'cerf-virginie', name: 'Cerf de Virginie du Nord-Ouest', gameName: 'Northern White-tailed Deer', reserveId: 'new-laurentia', category: 'moyen', animalClass: 4 },
  { id: 'bison', name: 'Bison des bois', gameName: 'Wood Bison', reserveId: 'new-laurentia', category: 'grand', animalClass: 8 },
  { id: 'pronghorn', name: 'Antilocapre des Rocheuses', gameName: 'Rocky Mountain Pronghorn', reserveId: 'new-laurentia', category: 'moyen', animalClass: 4 },
  { id: 'sanglier', name: "Sanglier d'Europe centrale", gameName: 'Central European Boar', reserveId: 'new-laurentia', category: 'moyen', animalClass: 5 },
  // Kilimaya Reserve
  { id: 'koudou', name: 'Grand koudou', gameName: 'Greater Kudu', reserveId: 'kilimaya', category: 'grand', blurb: 'Grande antilope aux cornes torsadées.' },
  { id: 'gnou', name: 'Gnou bleu', gameName: 'Blue Wildebeest', reserveId: 'kilimaya', category: 'grand', blurb: 'Herbivore migrateur des prairies ouvertes.' },
  { id: 'crocodile', name: 'Crocodile du Nil', gameName: 'Nile Crocodile', reserveId: 'kilimaya', category: 'dangereux', dangerous: true, blurb: 'Reptile dangereux qui fréquente les zones humides et les rivières.' },
  { id: 'hyene', name: 'Hyène tachetée', gameName: 'Spotted Hyena', reserveId: 'kilimaya', category: 'moyen', blurb: 'Prédateur opportuniste des plaines.' },
  { id: 'blesbok', name: 'Blesbok', gameName: 'Blesbok', reserveId: 'kilimaya', category: 'moyen', blurb: 'Antilope de taille moyenne, reconnaissable à la tache blanche sur le front.' },
  { id: 'zebre', name: 'Zèbre de montagne du Cap', gameName: 'Cape Mountain Zebra', reserveId: 'kilimaya', category: 'grand', blurb: 'Équidé adapté aux reliefs et aux plateaux de la réserve.' },
  { id: 'hippopotame', name: 'Hippopotame commun', gameName: 'Common Hippopotamus', reserveId: 'kilimaya', category: 'dangereux', dangerous: true, blurb: 'Gibier massif et redoutable, présent autour des points d\'eau.' },
  { id: 'ratel', name: 'Ratel du Cap', gameName: 'Cape Honey Badger', reserveId: 'kilimaya', category: 'petit', blurb: 'Petit carnivore tenace.' },
  { id: 'lion', name: 'Lion du sud', gameName: 'Southern Lion', reserveId: 'kilimaya', category: 'dangereux', dangerous: true, blurb: 'Le grand félin emblématique de la savane.' },
  { id: 'autruche', name: "Autruche d'Afrique du Sud", gameName: 'South African Ostrich', reserveId: 'kilimaya', category: 'moyen', blurb: 'Le plus grand oiseau terrestre de la carte.' },
  { id: 'buffle', name: 'Buffle africain du Cap', gameName: 'Cape Buffalo', reserveId: 'kilimaya', category: 'dangereux', dangerous: true, blurb: 'Bovidé robuste qui se déplace souvent en troupeau.' },
  { id: 'canard-bec-jaune', name: 'Canard à bec jaune du sud', gameName: 'Southern Yellow-billed Duck', reserveId: 'kilimaya', category: 'oiseau', blurb: 'Gibier d\'eau des marécages et des lacs.' },
  { id: 'phacochere', name: 'Phacochère commun du sud', gameName: 'Southern Common Warthog', reserveId: 'kilimaya', category: 'moyen', blurb: 'Suidé de la réserve.' },
  { id: 'impala', name: 'Impala commun', gameName: 'Common Impala', reserveId: 'kilimaya', category: 'moyen' },
];

export const WEAPONS: Weapon[] = [
  // Carabines
  { id: 'vanhoutte-stringer-22', name: 'Vanhoutte Stringer 22', caliber: '.22 LR', type: 'carabine' },
  { id: 'strasser-rs700-22', name: 'Strasser RS 700-22', caliber: '.22 LR', type: 'carabine' },
  { id: 'christensen-evoke', name: 'Christensen Arms Evoke', caliber: '.243 Win', type: 'carabine' },
  { id: 'cva-cascade-lrx', name: 'CVA Cascade LRX', caliber: '.270 Win', type: 'carabine' },
  { id: 'primacy-7700', name: 'Primacy 7700', caliber: '.270 Win', type: 'carabine' },
  { id: 'primacy-classic-hunter-mk2', name: 'Primacy Classic Hunter MK II', caliber: '.308 Win', type: 'carabine' },
  { id: 'primacy-advance-dk94', name: 'Primacy Advance DK94', caliber: '6,5x55 Swedish', type: 'carabine' },
  { id: 'bergara-b14-hmr', name: 'Bergara B14 HMR', caliber: '6,5 Creedmoor', type: 'carabine' },
  { id: 'primacy-classic-1907', name: 'Primacy Classic 1907', caliber: '.30-06 Springfield', type: 'carabine' },
  { id: 'merkel-helix-speedster', name: 'Merkel Helix Speedster', caliber: '.30-06 Springfield', type: 'carabine' },
  { id: 'primacy-advance-shift', name: 'Primacy Advance Shift', caliber: '.338 Lapua Magnum', type: 'carabine' },
  { id: 'primacy-safari-elite', name: 'Primacy Safari Elite', caliber: '.375 H&H Magnum', type: 'carabine' },
  { id: 'jack-bear-hunter', name: 'Jack Bear Hunter', caliber: '.45-70 Government', type: 'carabine' },
  // Fusils
  { id: 'primacy-hunter', name: 'Primacy Hunter (pompe)', caliber: 'Calibre 12', type: 'fusil' },
  { id: 'primacy-rasenbaum', name: 'Primacy Rasenbaum', caliber: 'Calibre 12', type: 'fusil' },
  { id: 'bonser-klein-standard', name: 'Bonser & Klein Standard', caliber: 'Calibre 16', type: 'fusil' },
  { id: 'merkel-sxs-45e', name: 'Merkel SxS 45E', caliber: 'Calibre 20', type: 'fusil' },
  { id: 'primacy-morning-silence', name: 'Primacy Morning Silence', caliber: 'Calibre 20', type: 'fusil' },
  { id: 'primacy-stalker', name: 'Primacy Stalker', caliber: 'Calibre 28', type: 'fusil' },
  // Arcs et arbalètes
  { id: 'terra-fractal-tr', name: 'Terra Fractal TR (poulies)', caliber: 'Flèche 30"', type: 'arc' },
  { id: 'skye-ferran-wonder', name: 'Skye Ferran Wonder', caliber: 'Flèche 32"', type: 'arc' },
  { id: 'buffden-apex-predator', name: 'Buffden Apex Predator', caliber: 'Carreau 18"', type: 'arbalete' },
];

export const CATEGORY_LABELS: Record<SpeciesCategory, string> = {
  petit: 'Petit gibier',
  oiseau: 'Oiseaux',
  moyen: 'Gibier moyen',
  grand: 'Grand gibier',
  dangereux: 'Gibier dangereux',
};

/** Calibres conseillés par type de gibier : indicatifs, à vérifier en jeu. */
export const SUGGESTED_CALIBERS: Record<SpeciesCategory, string[]> = {
  petit: ['.22 LR', 'Calibre 28', 'Calibre 20'],
  oiseau: ['Calibre 12', 'Calibre 16', 'Calibre 20', 'Calibre 28'],
  moyen: ['.243 Win', '6,5 Creedmoor', '6,5x55 Swedish', '.270 Win', '.308 Win'],
  grand: ['.30-06 Springfield', '.338 Lapua Magnum', '.45-70 Government'],
  dangereux: ['.375 H&H Magnum'],
};

/** Distance de tir conseillée par type de gibier (guide du joueur, à vérifier en jeu). */
export const SUGGESTED_DISTANCE: Record<SpeciesCategory, string> = {
  petit: '50 à 100 m (au sol)',
  oiseau: '25 à 50 m au fusil (50 à 100 m posé, à la .22)',
  moyen: '150 à 250 m',
  grand: '150 à 250 m',
  dangereux: '150 à 250 m',
};

export const WEAPON_TYPE_LABELS: Record<WeaponType, string> = {
  carabine: 'Carabines',
  fusil: 'Fusils',
  arc: 'Arcs',
  arbalete: 'Arbalètes',
};

export const SHOT_ZONE_LABELS: Record<ShotZone, string> = {
  coeur: 'Cœur',
  poumons: 'Poumons',
  foie: 'Foie',
  tete: 'Tête',
  cou: 'Cou',
  colonne: 'Colonne',
  epaule: 'Épaule (os)',
  arriere: 'Arrière-train',
  ventre: 'Ventre / intestins',
  pattes: 'Pattes',
  autre: 'Autre',
};

/** Où viser : le défaut de l'épaule, de profil. */
export const BEST_SHOT =
  'Visez le défaut de l’épaule : juste derrière la patte avant, à mi-hauteur du corps, l’animal de profil. La balle perfore poumons et cœur, et garde 100 % de la viande noble et le trophée intacts.';

/** Ce que coûte chaque zone touchée (conseils du joueur). Pas de texte = rien de connu. */
export const SHOT_ZONE_ADVICE: Partial<Record<ShotZone, { good: boolean; text: string }>> = {
  coeur: { good: true, text: 'Défaut de l’épaule : cœur touché, mort rapide, viande noble et trophée intacts.' },
  poumons: { good: true, text: 'Défaut de l’épaule : poumons perforés, mort rapide, viande noble et trophée intacts.' },
  epaule: {
    good: false,
    text: 'Trop en avant : l’os massif de l’épaule détruit beaucoup de viande de qualité et peut bloquer la balle avant les poumons.',
  },
  arriere: {
    good: false,
    text: 'Cuissots et hanches : la zone la plus riche en viande. Des dizaines de kilos détruits, prix de revente en chute, et l’animal blessé ne meurt pas vite.',
  },
  ventre: {
    good: false,
    text: 'Trop en arrière : estomac ou intestins, hémorragie très lente. L’animal court plusieurs centaines de mètres pendant de longues minutes : pistage long et pénible.',
  },
  pattes: {
    good: false,
    text: 'Aucun organe vital : l’animal est seulement blessé, il prend la fuite, survit et guérit.',
  },
};

export const TROPHY_TYPE_LABELS: Record<TrophyType, string> = {
  normal: 'Normal',
  'non-typique': 'Non typique',
};

const speciesById = new Map(SPECIES.map((s) => [s.id, s]));
const reserveById = new Map(RESERVES.map((r) => [r.id, r]));

export function getSpecies(id: string): Species | undefined {
  return speciesById.get(id);
}

export function getReserve(id: ReserveId): Reserve | undefined {
  return reserveById.get(id);
}

export function speciesOfReserve(reserveId: ReserveId): Species[] {
  return SPECIES.filter((s) => inReserve(s, reserveId));
}

/** Zones où l'on peut chasser (au moins une espèce) : New Laurentia, Kilimaya, le QG. */
export const HUNTING_RESERVES: Reserve[] = RESERVES.filter((r) => SPECIES.some((s) => inReserve(s, r.id)));

/** Armes fournies avec l'appli, puis celles ajoutées par le joueur. */
export function allWeapons(customWeapons: Weapon[]): Weapon[] {
  return [...WEAPONS, ...customWeapons];
}

export function findWeapon(id: string, customWeapons: Weapon[]): Weapon | undefined {
  return WEAPONS.find((w) => w.id === id) ?? customWeapons.find((w) => w.id === id);
}
