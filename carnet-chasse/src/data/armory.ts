/**
 * Armurerie : fiches d'armes et munitions recopiées depuis les écrans du jeu (captures du joueur).
 * Le joueur complète le reste dans l'appli (fiches et munitions perso, photos de sa galerie).
 */
import type { Ammo, WeaponSheet } from '../logic/types.ts';

export const WEAPON_SHEETS: Record<string, WeaponSheet> = {
  'primacy-classic-hunter-mk2': {
    action: 'Carabine à verrou',
    description: 'Carabine de chasse à verrou, idéale pour les gros gibiers de petite et moyenne taille.',
    classRange: [3, 6],
    magazine: 4,
    precision: 'Supérieur(e)',
    recoil: 'Réduit(e)',
    noise: 'Standard',
  },
};

export const AMMO: Ammo[] = [
  {
    id: 'lewellings-firefly-shock-308',
    name: 'Lewellings Firefly Shock',
    brand: 'Lewellings',
    caliber: '.308 Winchester',
    classRange: [4, 6],
    description: 'Cartouche de puissance moyenne, idéale pour les gros gibiers de taille moyenne.',
    projectile: 'Têtes creuses',
    penetration: 'Faible',
    recoilReduced: 'Standard',
    precision: 'Standard',
    cavity: 'Très élevé(e)',
  },
  {
    id: 'lewellings-nucleus-break-308',
    name: 'Lewellings Nucleus Break',
    brand: 'Lewellings',
    caliber: '.308 Winchester',
    classRange: [4, 6],
    description: 'Cartouche de haute puissance, idéale pour les gros gibiers de taille moyenne.',
    projectile: 'Têtes molles',
    penetration: 'Très élevé(e)',
    recoilReduced: 'Standard',
    precision: 'Supérieur(e)',
    cavity: 'Faible',
  },
  {
    // Vue dans un rapport de chasse : seuls le type et la classe sont connus.
    id: 'lewellings-grande-swift-308',
    name: 'Lewellings Grande Swift',
    brand: 'Lewellings',
    caliber: '.308 Winchester',
    classRange: [3, 5],
    projectile: 'Têtes creuses à pointe polymère',
  },
];

/** Niveaux affichés par le jeu sous les jauges (choix rapides ; texte libre accepté). */
export const STAT_LEVELS = ['Très faible', 'Faible', 'Réduit(e)', 'Standard', 'Élevé(e)', 'Supérieur(e)', 'Très élevé(e)'];
export const PROJECTILE_TYPES = ['Têtes creuses', 'Têtes molles', 'Têtes creuses à pointe polymère', 'Blindée', 'Plombs', 'Slug', 'Flèche'];
export const ACTION_TYPES = ['Carabine à verrou', 'Carabine semi-automatique', 'Carabine à levier', 'Fusil à pompe', 'Fusil juxtaposé', 'Fusil superposé', 'Arc à poulies', 'Arc', 'Arbalète'];

const defined = <T extends object>(o: T) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;

/** Calibre réduit à sa désignation : « .308 Win » et « .308 Winchester » donnent la même clé. */
export function caliberKey(caliber: string): string {
  return caliber
    .toLowerCase()
    .replace(/winchester|magnum|springfield|government|swedish|\bwin\b|\bmag\b/g, '')
    .replace(/[\s()]/g, '')
    .replace(/,/g, '.');
}

export function sameCaliber(a: string, b: string): boolean {
  return caliberKey(a) === caliberKey(b);
}

export function getWeaponSheet(id: string, sheets: Record<string, WeaponSheet>): WeaponSheet | undefined {
  const base = WEAPON_SHEETS[id];
  const mine = sheets[id];
  if (!mine) return base;
  return base ? { ...base, ...defined(mine) } : mine;
}

/** Munitions fournies (corrigées par le joueur si besoin) puis munitions ajoutées par le joueur. */
export function allAmmo(sheets: Record<string, Ammo>): Ammo[] {
  const builtIn = AMMO.map((a) => (sheets[a.id] ? { ...a, ...defined(sheets[a.id]), id: a.id, custom: false } : a));
  const custom = Object.values(sheets).filter((a) => a.custom && !AMMO.some((b) => b.id === a.id));
  return [...builtIn, ...custom];
}

export function ammoForCaliber(caliber: string, sheets: Record<string, Ammo>): Ammo[] {
  return allAmmo(sheets).filter((a) => sameCaliber(a.caliber, caliber));
}

export function formatClassRange(r: [number, number] | undefined): string | undefined {
  if (!r) return undefined;
  return r[0] === r[1] ? `${r[0]}` : `${r[0]}-${r[1]}`;
}

/** « 3-5 » ou « 4 » → plage de classes. */
export function parseClassRange(text: string): [number, number] | undefined {
  const m = text.trim().match(/^(\d{1,2})(?:\s*[-–à]\s*(\d{1,2}))?$/);
  if (!m) return undefined;
  const a = Number(m[1]);
  const b = m[2] ? Number(m[2]) : a;
  return a >= 1 && b <= 10 && a <= b ? [a, b] : undefined;
}

export function classFits(animalClass: number | undefined, range: [number, number] | undefined): boolean | undefined {
  if (animalClass === undefined || !range) return undefined;
  return animalClass >= range[0] && animalClass <= range[1];
}

/** Munitions dont la classe couvre celle de l'animal : celles en stock d'abord. */
export function ammoForAnimalClass(animalClass: number | undefined, sheets: Record<string, Ammo>, owned: string[]): Ammo[] {
  if (animalClass === undefined) return [];
  return allAmmo(sheets)
    .filter((a) => classFits(animalClass, a.classRange))
    .sort((a, b) => Number(owned.includes(b.id)) - Number(owned.includes(a.id)) || a.name.localeCompare(b.name));
}
