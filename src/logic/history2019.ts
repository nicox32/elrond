/**
 * Reprise d'une épargne régulière depuis 2019 : 25 € par semaine, en 4 achats de 6,25 € (lundi, mercredi, vendredi
 * et dimanche), du 4 janvier 2019 à aujourd'hui, répartis 50 % Gold Spot, 25 % argent, 25 % platine, frais d'achat
 * Orvia compris. Les cours sont des moyennes annuelles estimées (€/once), pas les cours exacts de chaque jour.
 */
import { FEES } from './fees.ts';
import { compactHistory } from './compact.ts';
import { emptyHoldings, newId, TROY_OUNCE } from './ledger.ts';
import type { Account, BalancePoint, Metal, Transaction } from './types.ts';

export const PLAN_2019 = {
  start: '2019-01-04',
  weekly: 25,
  /** Jours d'achat : 0 = dimanche, 1 = lundi, 3 = mercredi, 5 = vendredi. */
  days: [1, 3, 5, 0],
  share: { gold: 0.5, silver: 0.25, platinum: 0.25 } as Record<Metal, number>,
} as const;

/** Cours moyens estimés par année, en euros par once. */
export const AVG_EUR_OZ: Record<number, Record<Metal, number>> = {
  2019: { gold: 1255, silver: 14.5, platinum: 775 },
  2020: { gold: 1550, silver: 18, platinum: 775 },
  2021: { gold: 1520, silver: 21.5, platinum: 920 },
  2022: { gold: 1700, silver: 20.5, platinum: 910 },
  2023: { gold: 1800, silver: 21.8, platinum: 890 },
  2024: { gold: 2200, silver: 26.5, platinum: 880 },
  2025: { gold: 2950, silver: 33, platinum: 1050 },
  2026: { gold: 3450, silver: 42, platinum: 1250 },
};

const LABEL: Record<Metal, string> = { gold: 'de Gold Spot', silver: 'd’argent', platinum: 'de platine' };

function purchaseDays(now: Date): Date[] {
  const out: Date[] = [];
  const d = new Date(`${PLAN_2019.start}T10:00:00`);
  while (d.getTime() <= now.getTime()) {
    if ((PLAN_2019.days as readonly number[]).includes(d.getDay())) out.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

export function preview2019(now = new Date()) {
  const days = purchaseDays(now);
  const each = PLAN_2019.weekly / PLAN_2019.days.length;
  return { purchases: days.length, each, total: Math.round(days.length * each * 100) / 100 };
}

/** Ajoute l'épargne depuis 2019 au compte (une seule fois) : achats, métal, frais, courbe du solde. */
export function import2019History(account: Account, now = new Date()): Account {
  if (account.history2019Imported) return account;
  const each = PLAN_2019.weekly / PLAN_2019.days.length;
  const holdings = { ...account.holdings };
  const txs: Transaction[] = [];
  const points: BalancePoint[] = [];
  const cumulative = emptyHoldings();
  let lastMonth = -1;
  for (const day of purchaseDays(now)) {
    const prices = AVG_EUR_OZ[day.getFullYear()] ?? AVG_EUR_OZ[2026];
    for (const m of ['gold', 'silver', 'platinum'] as Metal[]) {
      const eur = Math.round(each * PLAN_2019.share[m] * 10000) / 10000;
      // Frais gardés au dixième de centime : sur des achats de quelques euros, l'arrondi au centime fausserait le total.
      const fees = Math.round(eur * FEES.buy[m] * 10000) / 10000;
      const grams = ((eur - fees) / prices[m]) * TROY_OUNCE;
      cumulative[m] += grams;
      txs.push({
        id: newId(),
        kind: 'buy',
        date: day.toISOString(),
        deltas: { ...emptyHoldings(), [m]: grams },
        eur,
        fees,
        label: `Achat ${LABEL[m]} · épargne depuis 2019`,
      });
    }
    // Un point de solde par mois, aux cours moyens de l'année.
    if (day.getMonth() !== lastMonth) {
      lastMonth = day.getMonth();
      const value = (['gold', 'silver', 'platinum'] as Metal[]).reduce(
        (s, m) => s + (cumulative[m] * prices[m]) / TROY_OUNCE,
        0,
      );
      points.push({ date: day.toISOString(), total: Math.round(value * 100) / 100 });
    }
  }
  for (const m of ['gold', 'silver', 'platinum'] as Metal[]) holdings[m] += cumulative[m];
  const start = new Date(`${PLAN_2019.start}T10:00:00`).toISOString();
  return compactHistory(
    {
      ...account,
      createdAt: account.createdAt < start ? account.createdAt : start,
      holdings,
      transactions: [...account.transactions, ...txs.reverse()].sort((a, b) => b.date.localeCompare(a.date)),
      balanceHistory: [...points, ...account.balanceHistory].sort((a, b) => a.date.localeCompare(b.date)),
      // Les achats ont eu lieu régulièrement : pas de frais d'oxydation rétroactifs.
      dormancyNotBefore: now.toISOString(),
      history2019Imported: true,
    },
    now,
  );
}
