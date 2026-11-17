// Stockage chez le revendeur (Gold Avenue) : grille en francs suisses, en vigueur depuis le 1er novembre 2026.
//  - jusqu'à 10 000 CHF : gratuit ;
//  - de 10 000 à 40 000 CHF : 15 CHF par mois ;
//  - au-delà de 40 000 CHF : 0,5 % par an de la valeur stockée.
// L'assurance (vol, dommages, perte) est incluse. À confirmer auprès du revendeur (les pages ne sont pas toutes à jour).
import { BAR_PRODUCTS } from './physical.ts';
import type { Account } from './types.ts';

export const STORAGE_LIMIT = { freeChf: 10_000, midChf: 40_000, midFeeChfPerMonth: 15, topRatePerYear: 0.005 } as const;
/** Taux de repli (1 CHF en euros) quand le taux du jour n'est pas disponible. */
export const CHF_EUR_FALLBACK = 1.07;

/** Valeur de l'or des lingotins et pièces en stock chez le revendeur, au cours de l'or (en euros). */
export function proStockValue(account: Pick<Account, 'stock'>, goldEurPerGram: number): number {
  let grams = 0;
  for (const l of account.stock ?? []) {
    if (l.source !== 'pro' || l.qty <= 0) continue;
    grams += l.qty * (BAR_PRODUCTS.find((p) => p.id === l.product)?.grams ?? 0);
  }
  return grams * goldEurPerGram;
}

export type StorageTier = 'free' | 'mid' | 'top';

export interface StorageStatus {
  tier: StorageTier;
  limitEur: number;
  usedEur: number;
  usedChf: number;
  /** Il reste ce montant de stockage gratuit (0 si le seuil est dépassé). */
  leftEur: number;
  /** Part du seuil gratuit utilisée, de 0 à 1 (plafonnée). */
  share: number;
  over: boolean;
  /** Frais estimés par an, en euros, selon le palier. */
  yearlyFeeEur: number;
  /** Frais estimés par an, en pourcentage de la valeur stockée. */
  yearlyFeePct: number;
}

export function storageStatus(usedEur: number, chfToEur: number): StorageStatus {
  const L = STORAGE_LIMIT;
  const usedChf = chfToEur > 0 ? usedEur / chfToEur : 0;
  const limitEur = L.freeChf * chfToEur;
  const tier: StorageTier = usedChf <= L.freeChf ? 'free' : usedChf <= L.midChf ? 'mid' : 'top';
  const yearlyChf = tier === 'free' ? 0 : tier === 'mid' ? L.midFeeChfPerMonth * 12 : usedChf * L.topRatePerYear;
  const yearlyFeeEur = yearlyChf * chfToEur;
  return {
    tier,
    limitEur,
    usedEur,
    usedChf,
    leftEur: Math.max(0, limitEur - usedEur),
    share: limitEur > 0 ? Math.min(1, usedEur / limitEur) : 0,
    over: tier !== 'free',
    yearlyFeeEur,
    yearlyFeePct: usedEur > 0 ? (yearlyFeeEur / usedEur) * 100 : 0,
  };
}
