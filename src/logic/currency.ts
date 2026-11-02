import type { Prices } from './types.ts';

/**
 * Monnaie interne d'Orvia : le louis (LOU), en clin d'œil au louis d'or.
 * 1 louis = la valeur d'un gramme d'or au cours du moment ; tout le compte peut s'exprimer en louis.
 */
export const CURRENCY = { name: 'louis', code: 'LOU' } as const;

/** Convertit un montant en euros en louis. */
export function toLouis(eur: number, prices: Prices): number {
  return prices.gold > 0 ? eur / prices.gold : 0;
}

export function formatLouis(louis: number): string {
  const decimals = Math.abs(louis) >= 100 ? 2 : 3;
  return `${louis.toLocaleString('fr-FR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })} ${CURRENCY.code}`;
}
