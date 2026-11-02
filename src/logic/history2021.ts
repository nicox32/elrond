import { emptyHoldings, newId, TROY_OUNCE } from './ledger.ts';
import type { Account, BalancePoint, Transaction } from './types.ts';

/**
 * Cours APPROXIMATIFS de 2021, en euros par once troy, autour du 5 de chaque mois
 * (cours au comptant en dollars convertis au taux EUR/USD de l'époque, arrondis).
 * Ce ne sont pas des cours officiels : ils servent à reconstituer un historique de démonstration.
 */
export const PRICES_2021: { month: number; goldEurOz: number; silverEurOz: number }[] = [
  { month: 1, goldEurOz: 1590, silverEurOz: 22.0 },
  { month: 2, goldEurOz: 1515, silverEurOz: 22.2 },
  { month: 3, goldEurOz: 1430, silverEurOz: 20.9 },
  { month: 4, goldEurOz: 1465, silverEurOz: 21.2 },
  { month: 5, goldEurOz: 1555, silverEurOz: 22.6 },
  { month: 6, goldEurOz: 1535, silverEurOz: 22.9 },
  { month: 7, goldEurOz: 1520, silverEurOz: 22.2 },
  { month: 8, goldEurOz: 1525, silverEurOz: 21.6 },
  { month: 9, goldEurOz: 1525, silverEurOz: 20.3 },
  { month: 10, goldEurOz: 1515, silverEurOz: 19.5 },
  { month: 11, goldEurOz: 1550, silverEurOz: 20.8 },
  { month: 12, goldEurOz: 1575, silverEurOz: 19.7 },
];

export interface History2021Plan {
  /** Total investi sur l'année, en euros. */
  total: number;
  /** Part de l'argent (0 à 1), le reste en or. */
  silverShare: number;
}

export const DEFAULT_PLAN_2021: History2021Plan = { total: 3845, silverShare: 0.75 };

const purchaseDate = (month: number) => new Date(Date.UTC(2021, month - 1, 5, 10, 0, 0));

/** Aperçu : grammes et onces achetés en 2021 selon le plan. */
export function preview2021(plan: History2021Plan) {
  const monthly = plan.total / PRICES_2021.length;
  let silverG = 0;
  let goldG = 0;
  for (const p of PRICES_2021) {
    silverG += ((monthly * plan.silverShare) / p.silverEurOz) * TROY_OUNCE;
    goldG += ((monthly * (1 - plan.silverShare)) / p.goldEurOz) * TROY_OUNCE;
  }
  return { monthly, silverG, goldG, silverOz: silverG / TROY_OUNCE, goldOz: goldG / TROY_OUNCE };
}

/**
 * Reprend l'historique : 12 achats le 5 de chaque mois de 2021 (or et argent), sans frais (Orvia n'existait pas),
 * compte ouvert le 5 janvier 2021. Aucun frais d'oxydation n'est dû pour la période passée.
 */
export function import2021History(
  account: Account,
  plan: History2021Plan = DEFAULT_PLAN_2021,
  now = new Date(),
): Account {
  if (account.history2021Imported) return account;
  if (!(plan.total > 0) || plan.silverShare < 0 || plan.silverShare > 1) return account;
  // Montants en centimes : le dernier mois absorbe l'arrondi pour retomber pile sur le total.
  const totalCents = Math.round(plan.total * 100);
  const baseCents = Math.floor(totalCents / PRICES_2021.length);
  const txs: Transaction[] = [];
  const points: BalancePoint[] = [];
  const holdings = { ...account.holdings };
  const cumulative = emptyHoldings();
  for (const p of PRICES_2021) {
    const date = purchaseDate(p.month).toISOString();
    const isLast = p.month === PRICES_2021[PRICES_2021.length - 1].month;
    const monthCents = isLast ? totalCents - baseCents * (PRICES_2021.length - 1) : baseCents;
    const silverCents = Math.round(monthCents * plan.silverShare);
    const silverEur = silverCents / 100;
    const goldEur = (monthCents - silverCents) / 100;
    const silverG = (silverEur / p.silverEurOz) * TROY_OUNCE;
    const goldG = (goldEur / p.goldEurOz) * TROY_OUNCE;
    cumulative.silver += silverG;
    cumulative.gold += goldG;
    if (silverEur > 0) {
      txs.push({
        id: newId(),
        kind: 'buy',
        date,
        deltas: { ...emptyHoldings(), silver: silverG },
        eur: silverEur,
        label: 'Achat d’argent · historique 2021',
      });
    }
    if (goldEur > 0) {
      txs.push({
        id: newId(),
        kind: 'buy',
        date,
        deltas: { ...emptyHoldings(), gold: goldG },
        eur: goldEur,
        label: 'Achat d’or · historique 2021',
      });
    }
    // Valeur du compte à chaque achat, aux cours approximatifs du mois.
    const value = (cumulative.silver * p.silverEurOz + cumulative.gold * p.goldEurOz) / TROY_OUNCE;
    points.push({ date, total: Math.round(value * 100) / 100 });
  }
  holdings.silver += cumulative.silver;
  holdings.gold += cumulative.gold;
  const transactions = [...account.transactions, ...txs].sort((a, b) => b.date.localeCompare(a.date));
  const balanceHistory = [...points, ...account.balanceHistory].sort((a, b) => a.date.localeCompare(b.date));
  const createdAt =
    account.createdAt < purchaseDate(1).toISOString() ? account.createdAt : purchaseDate(1).toISOString();
  return {
    ...account,
    createdAt,
    holdings,
    transactions,
    balanceHistory,
    dormancyNotBefore: now.toISOString(),
    history2021Imported: true,
  };
}
