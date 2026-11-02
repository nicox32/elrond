/**
 * L'Écu Orvia : jeton d'investissement maison, 1 g d'or fin 999,9 frappé pour Orvia et conservé au coffre.
 *
 * Son prix suit l'or en direct : prix d'un écu = 1 g × cours de l'or × (1 + prime). La prime couvre la frappe et
 * reflète la demande : Orvia la fixe (entre 0 et 15 %) et peut la faire varier. Elle est retrouvée à la revente.
 * Fiscalité : traité comme de l'or d'investissement (taxe forfaitaire ou plus-values), tant que le statut
 * particulier des jetons n'est pas confirmé par un texte officiel.
 */
import type { Prices, SpotPrices } from './types.ts';

export const ECU = {
  name: 'Gold Oria',
  /** Or fin contenu dans un écu, en grammes. */
  goldGrams: 1,
  fineness: '999,9',
  /** Prime sur la valeur de l'or contenu, par défaut. */
  defaultPremium: 0.04,
  minPremium: 0,
  maxPremium: 0.15,
} as const;

export function clampPremium(p: number | undefined): number {
  if (p === undefined || !Number.isFinite(p)) return ECU.defaultPremium;
  return Math.min(ECU.maxPremium, Math.max(ECU.minPremium, p));
}

/** Prix d'un écu en euros, à partir du cours de l'or (€/g). */
export function ecuPrice(goldPerGram: number, premium?: number): number {
  return goldPerGram * ECU.goldGrams * (1 + clampPremium(premium));
}

/** Ajoute (ou recalcule) le prix de l'écu à des cours de métaux. */
export function withEcu(prices: SpotPrices | Prices, premium?: number): Prices {
  return { ...prices, ecu: ecuPrice(prices.gold, premium) };
}
