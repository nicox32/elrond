/**
 * Calculateur des commandes chez Godot & Fils : à partir du relevé de prix d'un format (un prix par pièce pour chaque
 * tranche de quantité) et du cours de l'or à la date du relevé, il déduit la prime de base du revendeur et la remise de
 * chaque tranche. Ces valeurs règlent ensuite le coût, la marge et le prix attendu des lots.
 */
import { LedgerError } from './ledger.ts';
import { productOf, QTY_RANGES } from './physical.ts';

export interface PriceSheet {
  productId: string;
  /** Cours de l'or (€/g) à la date du relevé ou de l'achat. */
  gold: number;
  /** Prix du revendeur par pièce, métal compris, pour chaque tranche : 1 à 9, 10 à 19, 20 à 49, 50 et plus. */
  prices: [number, number, number, number];
}

export interface SheetResult {
  /** Prime de base du revendeur (1 à 9 pièces), en part de la valeur de l'or. */
  premium: number;
  /** Remise de chaque tranche par rapport au prix de base, en points de prime : 10 à 19, 20 à 49, 50 et plus. */
  offs: [number, number, number];
  /** Prix du métal d'une pièce au cours du relevé. */
  metalValue: number;
  warnings: string[];
}

export function sheetResult(sheet: PriceSheet): SheetResult {
  const p = productOf(sheet.productId);
  if (!(sheet.gold > 0)) throw new LedgerError('Indiquez le cours de l’or du jour du relevé.');
  if (sheet.prices.some((x) => !(x > 0))) throw new LedgerError('Indiquez le prix de chacune des quatre tranches.');
  const metal = p.grams * sheet.gold;
  const premium = sheet.prices[0] / metal - 1;
  if (premium < -0.02 || premium > 0.5) {
    throw new LedgerError('Ces prix sont très loin de la valeur de l’or : vérifiez le cours et les montants.');
  }
  const warnings: string[] = [];
  const offs = [1, 2, 3].map((i) => {
    const d = (sheet.prices[0] - sheet.prices[i]) / metal;
    if (d < 0) warnings.push(`Le prix de la tranche ${QTY_RANGES[i].label} est plus élevé que le prix de base.`);
    return Math.max(0, Math.round(d * 1e6) / 1e6);
  }) as [number, number, number];
  return { premium: Math.round(premium * 1e6) / 1e6, offs, metalValue: metal, warnings };
}

/** Prix par pièce d'un lot de cette taille, d'après le relevé. */
export function lotPriceOf(sheet: PriceSheet, qty: number): number {
  const i = QTY_RANGES.findIndex((r) => qty >= r.from && (r.to === null || qty <= r.to));
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
