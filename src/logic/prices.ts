import type { Prices } from './types';

/** Cours de départ approximatifs, en euros par gramme. La simulation part de là. */
export const INITIAL_PRICES: Prices = { gold: 105, silver: 1.25 };

/** Volatilité par tick (écart-type relatif). */
const VOLATILITY: Prices = { gold: 0.0015, silver: 0.0025 };

/** Tirage gaussien (Box-Muller). */
function gaussian(random: () => number): number {
  const u = 1 - random();
  const v = random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** Fait avancer les cours d'un pas (marche aléatoire lognormale, sans tendance). */
export function nextPrices(current: Prices, random: () => number = Math.random): Prices {
  return {
    gold: current.gold * Math.exp(VOLATILITY.gold * gaussian(random)),
    silver: current.silver * Math.exp(VOLATILITY.silver * gaussian(random)),
  };
}

/** Génère un historique fictif pour que les graphiques ne soient pas vides au démarrage. */
export function seedHistory(length: number, start: Prices = INITIAL_PRICES): Prices[] {
  const history: Prices[] = [start];
  for (let i = 1; i < length; i++) history.push(nextPrices(history[i - 1]));
  return history;
}
