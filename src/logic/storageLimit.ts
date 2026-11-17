// Stockage chez le revendeur (Gold Avenue) : gratuit jusqu'à un seuil en francs suisses, puis un forfait mensuel.
// Les montants viennent des pages du revendeur : à vérifier auprès de lui (la devise du seuil n'est pas la même partout).
import { BAR_PRODUCTS } from './physical.ts';
import type { Account } from './types.ts';

export const STORAGE_LIMIT = { freeChf: 10_000, feeChfPerMonth: 8, upToChf: 100_000 } as const;
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

export interface StorageStatus {
  limitEur: number;
  usedEur: number;
  leftEur: number;
  /** Part du seuil utilisée, de 0 à 1 (plafonnée). */
  share: number;
  over: boolean;
  /** Forfait mensuel en euros si le seuil est dépassé (jusqu'au plafond du forfait). */
  monthlyFeeEur: number;
}

export function storageStatus(usedEur: number, chfToEur: number): StorageStatus {
  const limitEur = STORAGE_LIMIT.freeChf * chfToEur;
  const over = usedEur > limitEur;
  return {
    limitEur,
    usedEur,
    leftEur: Math.max(0, limitEur - usedEur),
    share: limitEur > 0 ? Math.min(1, usedEur / limitEur) : 0,
    over,
    monthlyFeeEur: over ? STORAGE_LIMIT.feeChfPerMonth * chfToEur : 0,
  };
}
