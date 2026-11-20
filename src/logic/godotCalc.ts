/**
 * Calculateur des commandes chez Godot & Fils : à partir du relevé de prix d'un format (un prix par pièce pour chaque
 * tranche de quantité) et du cours de l'or à la date du relevé, il déduit la prime de base du revendeur et la remise de
 * chaque tranche. Ces valeurs règlent ensuite le coût, la marge et le prix attendu des lots.
 */
import { LedgerError } from './ledger.ts';
import { productOf, rangesOf } from './physical.ts';

/**
 * Remise négociée avec Godot & Fils sur ses prix publics, selon la taille du lot : de 3 % pour la plus petite tranche à
 * 5 % pour la plus grande, en progression régulière entre les deux.
 */
export const NEGOTIATED_DISCOUNT = { min: 0.03, max: 0.05 } as const;

/** Remise de la tranche `i` (0 = la plus petite) parmi `n` tranches. */
export function tierDiscount(n: number, i: number): number {
  if (n <= 1) return NEGOTIATED_DISCOUNT.min;
  return NEGOTIATED_DISCOUNT.min + ((NEGOTIATED_DISCOUNT.max - NEGOTIATED_DISCOUNT.min) * i) / (n - 1);
}

/** Prix net payé par Orvia pour la tranche `i` d'un format qui en compte `n`, d'après le prix public de la fiche. */
export function negotiatedPrice(publicPrice: number, n: number, i: number): number {
  return Math.round(publicPrice * (1 - tierDiscount(n, i)) * 100) / 100;
}

export interface PriceSheet {
  productId: string;
  /** Cours de l'or (€/g) à la date du relevé ou de l'achat. */
  gold: number;
  /** Prix du revendeur par pièce, métal compris, pour chaque tranche du produit (quatre, cinq pour le 20 F). */
  prices: number[];
}

export interface SheetResult {
  /** Prime de base du revendeur (1 à 9 pièces), en part de la valeur de l'or. */
  premium: number;
  /** Remise de chaque tranche par rapport au prix de base, en points de prime (une de moins que de tranches). */
  offs: number[];
  /** Prix du métal d'une pièce au cours du relevé. */
  metalValue: number;
  warnings: string[];
}

export function sheetResult(sheet: PriceSheet): SheetResult {
  const p = productOf(sheet.productId);
  if (!(sheet.gold > 0)) throw new LedgerError('Indiquez le cours de l’or du jour du relevé.');
  const ranges = rangesOf(sheet.productId);
  const prices = sheet.prices.slice(0, ranges.length);
  if (prices.length < ranges.length || prices.some((x) => !(x > 0))) {
    throw new LedgerError(`Indiquez le prix de chacune des ${ranges.length === 5 ? 'cinq' : 'quatre'} tranches.`);
  }
  const metal = p.grams * sheet.gold;
  const premium = prices[0] / metal - 1;
  if (premium < -0.02 || premium > 0.5) {
    throw new LedgerError('Ces prix sont très loin de la valeur de l’or : vérifiez le cours et les montants.');
  }
  const warnings: string[] = [];
  const offs = ranges.slice(1).map((r, k) => {
    const d = (prices[0] - prices[k + 1]) / metal;
    if (d < 0) warnings.push(`Le prix de la tranche ${r.label} est plus élevé que le prix de base.`);
    return Math.max(0, Math.round(d * 1e6) / 1e6);
  });
  return { premium: Math.round(premium * 1e6) / 1e6, offs, metalValue: metal, warnings };
}

/** Prix par pièce d'un lot de cette taille, d'après le relevé. */
export function lotPriceOf(sheet: PriceSheet, qty: number): number {
  const i = rangesOf(sheet.productId).findIndex((r) => qty >= r.from && (r.to === null || qty <= r.to));
  return sheet.prices[i < 0 ? 0 : i];
}

/** Date saisie « JJ/MM/AAAA » (midi, heure locale), jamais dans le futur. */
export function parseDay(text: string, now = new Date()): Date {
  const m = /^\s*(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})\s*$/.exec(text);
  if (!m) throw new LedgerError('Date au format JJ/MM/AAAA.');
  const [day, month, year] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const d = new Date(year, month - 1, day, 12, 0, 0);
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) {
    throw new LedgerError('Cette date n’existe pas.');
  }
  if (d.getTime() > now.getTime() + 12 * 3600 * 1000) throw new LedgerError('La date est dans le futur.');
  return d;
}

export const formatDay = (d: Date) =>
  `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
