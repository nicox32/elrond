/**
 * Reprise des dons à un enfant depuis 2022 : 50 € le 5 de chaque mois, depuis le 5 janvier 2022, investis 50 %
 * en Gold Spot et 50 % en argent, chacun au cours moyen réel de son mois (monthlyPrices.ts), frais d'achat Orvia
 * compris. Les dons viennent de la poche du parent : le compte principal ne bouge pas.
 */
import { FEES } from './fees.ts';
import { emptyHoldings, getChild, LedgerError, newId, replaceChildAccount, TROY_OUNCE } from './ledger.ts';
import { monthlyEurOz } from './monthlyPrices.ts';
import type { Account, Metal, Transaction } from './types.ts';

export const GIFTS_2022 = {
  start: '2022-01-05',
  dayOfMonth: 5,
  monthly: 50,
  share: { gold: 0.5, silver: 0.5 } as Partial<Record<Metal, number>>,
} as const;

const OF: Partial<Record<Metal, string>> = { gold: 'Gold Spot', silver: 'argent' };

function giftDays(now: Date): Date[] {
  const out: Date[] = [];
  const d = new Date(`${GIFTS_2022.start}T10:00:00`);
  while (d.getTime() <= now.getTime()) {
    out.push(new Date(d));
    d.setMonth(d.getMonth() + 1);
  }
  return out;
}

export function previewGifts2022(now = new Date()) {
  const n = giftDays(now).length;
  return { gifts: n, total: n * GIFTS_2022.monthly };
}

/** Ajoute les dons mensuels au compte de l'enfant (une seule fois). */
export function importGifts2022(account: Account, childId: string, now = new Date()): Account {
  const child = getChild(account, childId);
  if (child.gifts2022Imported) return account;
  if (child.transferredAt) throw new LedgerError(`Le compte de ${child.name} lui a été transféré.`);
  const holdings = { ...child.holdings };
  const txs: Transaction[] = [];
  for (const day of giftDays(now)) {
    const prices = monthlyEurOz(day);
    for (const [m, share] of Object.entries(GIFTS_2022.share) as [Metal, number][]) {
      const eur = GIFTS_2022.monthly * share;
      const fees = Math.round(eur * FEES.buy[m] * 10000) / 10000;
      const grams = ((eur - fees) / prices[m]) * TROY_OUNCE;
      holdings[m] += grams;
      txs.push({
        id: newId(),
        kind: 'family_in',
        date: day.toISOString(),
        deltas: { ...emptyHoldings(), [m]: grams },
        eur,
        fees,
        label: `Don de ${account.holder} · ${OF[m]} (${GIFTS_2022.monthly} € le ${GIFTS_2022.dayOfMonth} du mois)`,
        origin: 'childGifts2022',
      });
    }
  }
  const start = new Date(`${GIFTS_2022.start}T10:00:00`).toISOString();
  return replaceChildAccount(account, {
    ...child,
    createdAt: child.createdAt < start ? child.createdAt : start,
    holdings,
    transactions: [...child.transactions, ...txs].sort((a, b) => b.date.localeCompare(a.date)),
    gifts2022Imported: true,
  });
}
