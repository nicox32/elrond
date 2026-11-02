/**
 * Programme de fidélité Orvia : les louis (LOU).
 *
 * Volontairement modeste (au plus 0,4 % des sommes concernées) et tourné vers la régularité, l'esprit d'un compte
 * d'épargne en métal :
 * - investir : 1 LOU par tranche de 500 € de métal acheté (0,2 %) ;
 * - épargner chaque mois : 1 LOU pour chaque mois civil avec au moins 50 € investis, et 5 LOU de plus à chaque
 *   série de 12 mois consécutifs ;
 * - payer avec la carte Orvia : 1 LOU par tranche de 250 € dépensés (0,4 %) ;
 * - ancienneté : 1 LOU à chaque anniversaire du compte.
 * Rien n'est gagné sur les ventes, conversions, virements, ni sur les euros laissés dans le compte d'attente.
 *
 * 1 LOU s'échange contre 1 € de métal, sans frais, à partir de 10 LOU. Les points sont recalculés à partir de
 * l'historique : ils ne peuvent ni se perdre ni être comptés deux fois.
 */
import type { Transaction, Wallet } from './types.ts';

export const LOYALTY = {
  /** Valeur d'un LOU à l'échange, en euros de métal. */
  eurPerLou: 1,
  minRedeem: 10,
  buyEurPerLou: 500,
  monthMinEur: 50,
  monthLou: 1,
  streakMonths: 12,
  streakLou: 5,
  cardEurPerLou: 250,
  anniversaryLou: 1,
} as const;

export interface LoyaltyBreakdown {
  invested: number;
  fromBuys: number;
  months: number;
  fromMonths: number;
  streaks: number;
  fromStreaks: number;
  cardSpent: number;
  fromCard: number;
  years: number;
  fromYears: number;
  earned: number;
  spent: number;
  balance: number;
  /** Mois en cours : déjà validé (au moins 50 € investis) ? */
  monthDone: boolean;
  /** Série en cours de mois consécutifs (jusqu'au mois dernier, ou au mois en cours s'il est validé). */
  currentStreak: number;
  /** Euros à investir pour le prochain LOU d'achat. */
  toNextBuyLou: number;
}

const monthKey = (d: Date) => d.getFullYear() * 12 + d.getMonth();

/** Achats de métal ouvrant droit à des points (hors bonus et échanges de points). */
const isEarningBuy = (t: Transaction) => t.kind === 'buy';

export function loyalty(wallet: Pick<Wallet, 'transactions' | 'createdAt'>, now = new Date()): LoyaltyBreakdown {
  const L = LOYALTY;
  let invested = 0;
  let cardSpent = 0;
  let spent = 0;
  const perMonth = new Map<number, number>();
  for (const t of wallet.transactions) {
    const d = new Date(t.date);
    if (d.getTime() > now.getTime()) continue;
    if (isEarningBuy(t)) {
      invested += t.eur;
      perMonth.set(monthKey(d), (perMonth.get(monthKey(d)) ?? 0) + t.eur);
    } else if (t.kind === 'card_payment') cardSpent += t.eur;
    else if (t.kind === 'loyalty_redeem') spent += t.loyaltyLou ?? 0;
  }
  const validMonths = [...perMonth.entries()]
    .filter(([, eur]) => eur >= L.monthMinEur)
    .map(([k]) => k)
    .sort((a, b) => a - b);
  // Séries de 12 mois consécutifs : chaque tranche complète de 12 rapporte le bonus.
  let streaks = 0;
  let run = 0;
  let prev = -2;
  for (const k of validMonths) {
    run = k === prev + 1 ? run + 1 : 1;
    if (run % L.streakMonths === 0) streaks += 1;
    prev = k;
  }
  const nowKey = monthKey(now);
  const monthDone = validMonths.includes(nowKey);
  let currentStreak = 0;
  for (let k = monthDone ? nowKey : nowKey - 1; validMonths.includes(k); k--) currentStreak++;

  const created = new Date(wallet.createdAt);
  let years = now.getFullYear() - created.getFullYear();
  const anniversary = new Date(created);
  anniversary.setFullYear(created.getFullYear() + years);
  if (anniversary.getTime() > now.getTime()) years -= 1;
  years = Math.max(0, years);

  const fromBuys = Math.floor(invested / L.buyEurPerLou);
  const fromMonths = validMonths.length * L.monthLou;
  const fromStreaks = streaks * L.streakLou;
  const fromCard = Math.floor(cardSpent / L.cardEurPerLou);
  const fromYears = years * L.anniversaryLou;
  const earned = fromBuys + fromMonths + fromStreaks + fromCard + fromYears;
  return {
    invested,
    fromBuys,
    months: validMonths.length,
    fromMonths,
    streaks,
    fromStreaks,
    cardSpent,
    fromCard,
    years,
    fromYears,
    earned,
    spent,
    balance: Math.max(0, earned - spent),
    monthDone,
    currentStreak,
    toNextBuyLou: L.buyEurPerLou - (invested % L.buyEurPerLou),
  };
}

export function formatLou(n: number): string {
  return `${n.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} LOU`;
}
