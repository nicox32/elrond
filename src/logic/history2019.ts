/**
 * Reprise d'une épargne régulière depuis 2019 : 25 € par semaine, en 4 achats de 6,25 € (lundi, mercredi, vendredi
 * et dimanche), du 4 janvier 2019 à aujourd'hui, répartis 50 % Gold Spot, 25 % argent, 25 % platine, frais d'achat
 * Orvia compris. Chaque achat est passé au cours moyen réel de son mois (€/once, voir monthlyPrices.ts).
 */
import { FEES } from './fees.ts';
import { compactHistory } from './compact.ts';
import { emptyHoldings, LedgerError, newId, TROY_OUNCE } from './ledger.ts';
import { monthlyEurOz } from './monthlyPrices.ts';
import type { Account, BalancePoint, Metal, Transaction } from './types.ts';

export const PLAN_2019 = {
  start: '2019-01-04',
  weekly: 25,
  /** Jours d'achat : 0 = dimanche, 1 = lundi, 3 = mercredi, 5 = vendredi. */
  days: [1, 3, 5, 0],
  share: { gold: 0.5, silver: 0.25, platinum: 0.25 } as Record<Metal, number>,
} as const;

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
    const prices = monthlyEurOz(day);
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
        origin: 'history2019',
      });
    }
    // Un point de solde par mois, au cours moyen du mois.
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
      history2019Prices: 'monthly',
    },
    now,
  );
}

/** Achat venant d'une reprise 2019 (y compris regroupé par l'allègement de l'historique d'une version précédente). */
function isImported(t: Transaction): boolean {
  if (t.origin === 'history2019') return true;
  if (t.kind !== 'buy' || t.cash) return false;
  return t.label.includes('épargne depuis 2019') || /achats regroupés\)$/.test(t.label);
}

/** Point du graphique ajouté par la reprise (posé pile à l'heure, contrairement aux points enregistrés en direct). */
const isImportedPoint = (p: BalancePoint) => /T\d\d:00:00\.000Z$/.test(p.date);

/** La reprise doit-elle être recalculée avec les cours mensuels ? */
export function needsMonthlyReprice(account: Account): boolean {
  return !!account.history2019Imported && account.history2019Prices !== 'monthly';
}

/**
 * Recalcule une reprise faite avec les anciennes moyennes annuelles : mêmes achats et mêmes montants, grammes au
 * cours réel de chaque mois. Les opérations passées dans l'appli ne bougent pas.
 */
export function reprice2019History(account: Account, now = new Date()): Account {
  if (!needsMonthlyReprice(account)) return account;
  const removed = emptyHoldings();
  const kept: Transaction[] = [];
  for (const t of account.transactions) {
    if (isImported(t)) for (const m of ['gold', 'silver', 'platinum'] as Metal[]) removed[m] += t.deltas[m] ?? 0;
    else kept.push(t);
  }
  const fresh = import2019History(
    { ...account, holdings: emptyHoldings(), transactions: [], balanceHistory: [], history2019Imported: false },
    now,
  );
  const holdings = emptyHoldings();
  for (const m of ['gold', 'silver', 'platinum'] as Metal[]) {
    holdings[m] = account.holdings[m] - removed[m] + fresh.holdings[m];
    if (holdings[m] < -1e-6) {
      throw new LedgerError('Recalcul impossible : une partie de ce métal a déjà été vendue ou transférée.');
    }
    holdings[m] = Math.max(0, holdings[m]);
  }
  return compactHistory(
    {
      ...account,
      holdings,
      transactions: [...kept, ...fresh.transactions].sort((a, b) => b.date.localeCompare(a.date)),
      balanceHistory: [...account.balanceHistory.filter((p) => !isImportedPoint(p)), ...fresh.balanceHistory].sort(
        (a, b) => a.date.localeCompare(b.date),
      ),
      history2019Prices: 'monthly',
    },
    now,
  );
}
