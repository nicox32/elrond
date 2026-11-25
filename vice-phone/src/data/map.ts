// Plan de Port Corail (unités de carte : 1 unité = 5 mètres ; la carte fait 1000 × 1400).

export const MAP_W = 1000;
export const MAP_H = 1400;
export const METERS_PER_UNIT = 5;

export type Pt = [number, number];

export const LAND: Pt[] = [
  [0, 0], [720, 0], [760, 180], [700, 330], [760, 470], [820, 620], [760, 780], [640, 860],
  [560, 960], [600, 1080], [700, 1160], [720, 1300], [640, 1400], [0, 1400],
];

export const ISLAND: Pt[] = [[800, 930], [930, 880], [985, 990], [920, 1110], [820, 1085], [790, 1010]];

export type District = { id: string; name: string; color: string; poly: Pt[]; label: Pt };

export const DISTRICTS: District[] = [
  { id: 'industrie', name: 'Zone industrielle', color: '#5B5F73', poly: [[0, 0], [720, 0], [740, 250], [0, 250]], label: [330, 60] },
  { id: 'collines', name: 'Les Collines', color: '#3E8E5A', poly: [[0, 250], [280, 250], [280, 840], [0, 840]], label: [140, 300] },
  { id: 'neon', name: 'Quartier Néon', color: '#B5179E', poly: [[280, 250], [740, 250], [700, 330], [760, 470], [560, 560], [280, 560]], label: [470, 285] },
  { id: 'port', name: 'Vieux Port', color: '#4361EE', poly: [[280, 560], [560, 560], [760, 470], [820, 620], [760, 780], [640, 860], [280, 860]], label: [420, 600] },
  { id: 'golf', name: 'Golf des Palmiers', color: '#2D9B4E', poly: [[0, 840], [280, 840], [280, 1400], [0, 1400]], label: [140, 880] },
  { id: 'plage', name: 'Plage Corail', color: '#F4A259', poly: [[280, 860], [640, 860], [560, 960], [600, 1080], [700, 1160], [720, 1300], [640, 1400], [280, 1400]], label: [420, 1120] },
  { id: 'ile', name: 'Île aux Flamants', color: '#FF8FB1', poly: ISLAND, label: [885, 1135] },
];

/** Carrefours du réseau routier. */
export const NODES: Record<string, Pt> = {
  A: [150, 140], B: [450, 140], C: [705, 140],
  D: [150, 400], E: [450, 400], F: [720, 400],
  G: [150, 700], H: [450, 700], I: [740, 650],
  J: [150, 1000], K: [450, 1000], L: [585, 1000],
  M: [150, 1300], N: [450, 1300], O: [665, 1300],
  P: [820, 1000], Q: [905, 950],
};

export type Road = { a: string; b: string; kind: 'street' | 'highway' | 'bridge' };

export const ROADS: Road[] = [
  { a: 'A', b: 'B', kind: 'street' }, { a: 'B', b: 'C', kind: 'street' },
  { a: 'A', b: 'D', kind: 'street' }, { a: 'B', b: 'E', kind: 'street' },
  { a: 'D', b: 'E', kind: 'street' }, { a: 'E', b: 'F', kind: 'street' },
  { a: 'D', b: 'G', kind: 'street' }, { a: 'E', b: 'H', kind: 'street' },
  { a: 'G', b: 'H', kind: 'street' }, { a: 'H', b: 'I', kind: 'street' },
  { a: 'G', b: 'J', kind: 'street' }, { a: 'H', b: 'K', kind: 'street' },
  { a: 'J', b: 'K', kind: 'street' }, { a: 'K', b: 'L', kind: 'street' },
  { a: 'J', b: 'M', kind: 'street' }, { a: 'K', b: 'N', kind: 'street' },
  { a: 'M', b: 'N', kind: 'street' }, { a: 'N', b: 'O', kind: 'street' },
  // Route côtière, du nord au sud.
  { a: 'C', b: 'F', kind: 'highway' }, { a: 'F', b: 'I', kind: 'highway' },
  { a: 'I', b: 'L', kind: 'highway' }, { a: 'L', b: 'O', kind: 'highway' },
  { a: 'L', b: 'P', kind: 'bridge' }, { a: 'P', b: 'Q', kind: 'street' },
];

export type PoiCategory = 'sorties' | 'services' | 'lieux' | 'maison';

export type Poi = {
  id: string;
  name: string;
  emoji: string;
  category: PoiCategory;
  at: Pt;
  description: string;
  /** Contact à appeler depuis la fiche du lieu. */
  contactId?: string;
};

export const POIS: Poi[] = [
  { id: 'maison', name: 'Votre appartement', emoji: '🏠', category: 'maison', at: [400, 660], description: 'Un deux-pièces avec vue sur le port… si on se penche beaucoup.' },
  { id: 'garage', name: 'Garage de Rico', emoji: '🔧', category: 'services', at: [215, 190], description: 'Réparations, néons et conseils pas toujours demandés.', contactId: 'rico' },
  { id: 'agence', name: 'Agence Soleil', emoji: '💼', category: 'services', at: [510, 355], description: 'Petits boulots payés le jour même.', contactId: 'agence' },
  { id: 'banque', name: 'Banque Flamant', emoji: '🦩', category: 'services', at: [375, 450], description: 'Le siège de la banque la plus rose de la côte.' },
  { id: 'club', name: 'Club Néon 23', emoji: '🍸', category: 'sorties', at: [610, 395], description: 'Le club le plus bruyant du Quartier Néon. Propriétaire des murs : Big Momo.', contactId: 'momo' },
  { id: 'mairie', name: 'Mairie', emoji: '🏛️', category: 'lieux', at: [590, 300], description: 'Le maire y fait la sieste de 13 h à 15 h.' },
  { id: 'studio', name: 'Studio de Jade', emoji: '🎧', category: 'sorties', at: [640, 450], description: 'Le studio insonorisé (enfin) où Jade prépare ses sets.', contactId: 'jade' },
  { id: 'marina', name: 'Marina', emoji: '⛵', category: 'lieux', at: [690, 730], description: 'Yachts, mouettes et le demi-bateau de Tonton Vince.', contactId: 'vince' },
  { id: 'tacos', name: 'Tacos de Bruno', emoji: '🌮', category: 'sorties', at: [525, 930], description: 'Le food-truck le plus célèbre de Port Corail.' },
  { id: 'plage', name: 'Plage Corail', emoji: '🏖️', category: 'sorties', at: [600, 1240], description: 'Sable blanc, eau à 29 °C et flamants roses en liberté.' },
  { id: 'golf', name: 'Golf des Palmiers', emoji: '⛳', category: 'lieux', at: [120, 1150], description: 'Attention au trou n°7 : Gérard l’alligator y veille.' },
  { id: 'belvedere', name: 'Belvédère', emoji: '🌄', category: 'lieux', at: [105, 560], description: 'La plus belle vue sur la ville au coucher du soleil.' },
  { id: 'flamingo', name: 'Flamingo Club', emoji: '🪩', category: 'sorties', at: [865, 1045], description: 'La boîte de nuit de l’île. Tenue colorée exigée.' },
  { id: 'phare', name: 'Le Phare', emoji: '🗼', category: 'lieux', at: [935, 915], description: 'Un phare… et parfois un mystérieux rendez-vous à minuit.', contactId: 'inconnu' },
];

export const poiById = (id: string) => POIS.find((p) => p.id === id);
