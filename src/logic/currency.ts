import type { Prices } from './types.ts';

/**
 * Monnaie interne d'Orvia : le louis (LOU), en clin d'œil au louis d'or.
 * 1 louis = 1 euro de métal précieux détenu, au cours du moment.
 */
export const CURRENCY = { name: 'louis', code: 'LOU', eurPerUnit: 1 } as const;

/** Convertit un montant en euros en louis (1 LOU = 1 €). */
export function toLouis(eur: number, _prices?: Prices): number {
  return eur / CURRENCY.eurPerUnit;
}

export function formatLouis(louis: number): string {
  return `${louis.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${CURRENCY.code}`;
}
