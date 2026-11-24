// Carte de l’État fictif de Solenne (même repère que la carte de la ville : 1000 × 1400).
import type { Pt } from './map';

export const STATE_NAME = 'État de Solenne';

export const STATE_LAND: Pt[] = [
  [0, 90], [640, 90], [700, 60], [880, 70], [900, 200], [925, 420], [905, 640], [885, 820], [845, 980], [785, 1120],
  [705, 1170], [625, 1120], [565, 980], [505, 820], [470, 640], [420, 470], [350, 330], [220, 300], [100, 320], [0, 345],
];

export const KEYS: { at: Pt; r: number }[] = [
  { at: [665, 1215], r: 26 }, { at: [595, 1250], r: 22 }, { at: [525, 1272], r: 28 }, { at: [452, 1288], r: 20 },
  { at: [385, 1298], r: 24 }, { at: [318, 1304], r: 18 },
];

export type Region = { id: string; name: string; color: string; poly: Pt[]; label: Pt; text: string };

export const REGIONS: Region[] = [
  { id: 'monts', name: 'Monts Ardents', color: '#3E8E5A', poly: [[600, 90], [640, 90], [700, 60], [880, 70], [900, 200], [890, 260], [600, 260]], label: [790, 130], text: 'Forêts, sources chaudes et chalets perdus : le grand nord sauvage de Solenne.' },
  { id: 'bellerive', name: 'Bellerive', color: '#C77DFF', poly: [[0, 90], [600, 90], [600, 260], [350, 330], [220, 300], [100, 320], [0, 345]], label: [330, 150], text: 'Ancienne station balnéaire : motels fatigués, néons cassés et centres commerciaux à l’abandon.' },
  { id: 'canneville', name: 'Canneville', color: '#E8B04B', poly: [[600, 260], [890, 260], [925, 420], [915, 560], [470, 560], [420, 470], [350, 330]], label: [610, 330], text: 'Champs de canne, raffinerie de sucre et clubs de motards au bord du lac Miroir. Le pénitencier est ici.' },
  { id: 'marais', name: 'Marais des Sauriens', color: '#2D9B4E', poly: [[470, 560], [915, 560], [905, 640], [885, 820], [700, 820], [700, 1080], [625, 1120], [565, 980], [505, 820]], label: [610, 700], text: 'Mangroves, hydroglisseurs et alligators. Personne ne pose de questions ici.' },
  { id: 'corail', name: 'Port Corail', color: '#FF3D8B', poly: [[700, 820], [885, 820], [845, 980], [785, 1120], [705, 1170], [700, 1080]], label: [800, 860], text: 'La grande ville de la côte : plages, néons, yachts et argent facile.' },
  { id: 'iles', name: 'Îles Coquillages', color: '#4CC9F0', poly: [], label: [480, 1345], text: 'Un chapelet d’îles reliées par un long pont : pêcheurs, bars de plage et contrebandiers.' },
];

export const STATE_ROADS: Pt[][] = [
  [[120, 200], [600, 190], [700, 330], [860, 520], [860, 700], [820, 900], [760, 1080], [690, 1190], [525, 1272], [318, 1304]],
  [[700, 330], [610, 560], [600, 760], [760, 1000]],
];

export type Place = { id: string; name: string; emoji: string; at: Pt; region: string; description: string };

export const PLACES: Place[] = [
  { id: 'penitencier', name: 'Pénitencier de Canneville', emoji: '🏢', at: [560, 430], region: 'canneville', description: 'Hauts murs et barbelés au milieu des champs de canne. Mara y a passé trois ans.' },
  { id: 'raffinerie', name: 'Raffinerie Sucre-d’Or', emoji: '🏭', at: [780, 330], region: 'canneville', description: 'La cheminée qui parfume tout le comté au caramel brûlé.' },
  { id: 'motel', name: 'Motel Le Flamant Bleu', emoji: '🏨', at: [180, 200], region: 'bellerive', description: 'Piscine vide, enseigne qui grésille. Un jour, peut-être, le vôtre.' },
  { id: 'chalet', name: 'Chalet des Sources', emoji: '🏕️', at: [670, 205], region: 'monts', description: 'Le seul endroit de Solenne où il fait frais en août.' },
  { id: 'cabane', name: 'Cabane du Marais', emoji: '🛶', at: [600, 780], region: 'marais', description: 'Une cabane sur pilotis, un ponton pourri et des yeux qui brillent dans l’eau.' },
  { id: 'ponton', name: 'Ponton de Boyd', emoji: '⚓', at: [525, 1272], region: 'iles', description: 'Le ponton du Pélican, au bout des Îles Coquillages. On n’y vient pas par hasard.' },
  { id: 'portcorail', name: 'Port Corail', emoji: '🌴', at: [770, 1010], region: 'corail', description: 'Ouvrir le plan de la ville.' },
];

export const placeById = (id: string) => PLACES.find((p) => p.id === id);
