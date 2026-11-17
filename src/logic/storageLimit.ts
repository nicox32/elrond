// Stockage chez le revendeur (Gold Avenue) : gratuit jusqu'à un seuil en euros, puis un forfait mensuel.
// Les montants viennent des pages du revendeur : à confirmer auprès de lui (le forfait est annoncé en francs suisses
// ou en euros selon la page).
import { BAR_PRODUCTS } from './physical.ts';
import type { Account } from './types.ts';

export const STORAGE_LIMIT = { freeEur: 10_000, feePerMonth: 8, upToEur: 100_000 } as const;

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
  /** Forfait mensuel si le seuil est dépassé (jusqu'au plafond du forfait). */
  monthlyFeeEur: number;
}

export function storageStatus(usedEur: number): StorageStatus {
  const limitEur = STORAGE_LIMIT.freeEur;
  const over = usedEur > limitEur;
  return {
    limitEur,
    usedEur,
    leftEur: Math.max(0, limitEur - usedEur),
    share: Math.min(1, usedEur / limitEur),
    over,
    monthlyFeeEur: over ? STORAGE_LIMIT.feePerMonth : 0,
  };
}
