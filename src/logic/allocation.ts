import { accountValue, buy, emptyHoldings, quoteBuy } from './ledger.ts';
import { type Account, type Metal, METALS, type Prices } from './types.ts';

/** Répartition en pourcentages par métal (total 100). */
export type Allocation = Record<Metal, number>;

export const DEFAULT_ALLOCATION: Allocation = { gold: 50, silver: 25, platinum: 25 };

export const ALLOCATION_PRESETS: { label: string; value: Allocation }[] = [
  { label: '50 / 25 / 25', value: { gold: 50, silver: 25, platinum: 25 } },
  { label: '60 / 20 / 20', value: { gold: 60, silver: 20, platinum: 20 } },
  { label: '40 / 30 / 30', value: { gold: 40, silver: 30, platinum: 30 } },
  { label: '100 % or', value: { gold: 100, silver: 0, platinum: 0 } },
];

export type SplitMode = 'percent' | 'target';

export function allocationTotal(a: Allocation): number {
  return METALS.reduce((s, m) => s + (Number.isFinite(a[m]) ? a[m] : 0), 0);
}

export function isValidAllocation(a: Allocation): boolean {
  return METALS.every((m) => Number.isFinite(a[m]) && a[m] >= 0) && Math.abs(allocationTotal(a) - 100) < 0.01;
}

/** Ramène une répartition à 100 % en gardant les proportions (arrondi à l'unité, l'or absorbe l'écart). */
export function normalizeAllocation(a: Allocation): Allocation {
  const total = allocationTotal(a);
  if (total <= 0) return { ...DEFAULT_ALLOCATION };
  const out = emptyHoldings();
  for (const m of METALS) out[m] = Math.round((Math.max(0, a[m] || 0) / total) * 100);
  out.gold += 100 - allocationTotal(out);
  return out;
}

/** Répartition actuelle du compte, en % de sa valeur. */
export function currentAllocation(account: Pick<Account, 'holdings'>, prices: Prices): Allocation {
  const v = accountValue(account, prices);
  const out = emptyHoldings();
  if (v.total <= 0) return out;
  for (const m of METALS) out[m] = (v.byMetal[m] / v.total) * 100;
  return out;
}

/** Partage un montant en centimes selon des poids, au centime près (le plus gros reste va au plus gros poids). */
function splitCents(amount: number, weights: Record<Metal, number>): Record<Metal, number> {
  const cents = Math.round(amount * 100);
  const totalW = METALS.reduce((s, m) => s + Math.max(0, weights[m]), 0);
  const out = emptyHoldings();
  if (totalW <= 0 || cents <= 0) return out;
  const raw = METALS.map((m) => ({ m, exact: (cents * Math.max(0, weights[m])) / totalW }));
  let given = 0;
  for (const r of raw) {
    out[r.m] = Math.floor(r.exact);
    given += out[r.m];
  }
  // Distribue les centimes restants aux plus grandes parts décimales.
  raw.sort((a, b) => b.exact - Math.floor(b.exact) - (a.exact - Math.floor(a.exact)));
  for (let i = 0; given < cents; i = (i + 1) % raw.length) {
    if (weights[raw[i].m] > 0) {
      out[raw[i].m] += 1;
      given += 1;
    }
  }
  for (const m of METALS) out[m] /= 100;
  return out;
}

/**
 * Partage un montant en euros entre les métaux.
 * - `percent` : selon les pourcentages de la cible ;
 * - `target` : en priorité vers les métaux en retard sur la cible, pour s'en rapprocher sans rien vendre.
 */
export function splitAmount(
  amount: number,
  target: Allocation,
  mode: SplitMode,
  account?: Pick<Account, 'holdings'>,
  prices?: Prices,
): Record<Metal, number> {
  if (!(amount > 0)) return emptyHoldings();
  if (mode === 'percent' || !account || !prices) return splitCents(amount, target);
  const v = accountValue(account, prices);
  const after = v.total + amount;
  const needs = emptyHoldings();
  for (const m of METALS) needs[m] = Math.max(0, (after * target[m]) / 100 - v.byMetal[m]);
  const totalNeed = METALS.reduce((s, m) => s + needs[m], 0);
  // Déjà sur la cible (ou au-delà partout) : partage simple.
  if (totalNeed <= 0.005) return splitCents(amount, target);
  return splitCents(amount, needs);
}

/** Aperçu chiffré d'un achat réparti : grammes et frais par métal. */
export function quoteSplitBuy(prices: Prices, amounts: Record<Metal, number>) {
  const lines = METALS.filter((m) => amounts[m] > 0).map((m) => {
    const q = quoteBuy(prices, m, { unit: 'eur', value: amounts[m] });
    return { metal: m, eur: amounts[m], grams: q.grams, fees: q.fees };
  });
  return { lines, total: lines.reduce((s, l) => s + l.eur, 0), fees: lines.reduce((s, l) => s + l.fees, 0) };
}

/** Achète plusieurs métaux d'un coup (un achat par métal, chacun avec ses frais). */
export function buySplit(account: Account, prices: Prices, amounts: Record<Metal, number>, now = new Date()): Account {
  let acc = account;
  for (const m of METALS) {
    if (amounts[m] >= 0.01) acc = buy(acc, prices, m, { unit: 'eur', value: amounts[m] }, now);
  }
  return acc;
}
