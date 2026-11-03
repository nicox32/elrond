/**
 * Allègement de l'historique : les petits achats de plus de 12 mois sont regroupés en un achat par mois et par
 * métal (même total payé, mêmes frais, mêmes grammes). Le compte reste ainsi bien sous la limite d'enregistrement
 * d'Android, même avec des achats plusieurs fois par semaine depuis des années.
 *
 * La date du regroupement est celle du dernier achat du mois : la durée de détention, pour l'impôt, n'est jamais
 * surestimée.
 */
import type { Metal, Transaction, Wallet } from './types.ts';
import { METALS } from './types.ts';

/** Au-delà de ce nombre d'opérations, l'historique est allégé. */
export const COMPACT_ABOVE = 600;
/** Les 12 derniers mois restent détaillés. */
const KEEP_DETAIL_MS = 365 * 86_400_000;

const MONTHS = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
];
const OF: Record<Metal, string> = { gold: 'de Gold Spot', silver: 'd’argent', platinum: 'de platine' };

const r = (n: number, d: number) => Math.round(n * 10 ** d) / 10 ** d;

/** Achat simple d'un seul métal, regroupable. */
function groupKey(t: Transaction): string | null {
  if (t.kind !== 'buy' || t.tax || t.reversed) return null;
  const metals = METALS.filter((m) => (t.deltas[m] ?? 0) > 0);
  if (metals.length !== 1) return null;
  const d = new Date(t.date);
  return `${d.getFullYear()}-${d.getMonth()}|${metals[0]}|${t.cash ? 'cash' : 'card'}`;
}

export function compactHistory<W extends Wallet>(wallet: W, now = new Date(), force = false): W {
  if (!force && wallet.transactions.length <= COMPACT_ABOVE) return wallet;
  const limit = now.getTime() - KEEP_DETAIL_MS;
  const groups = new Map<string, Transaction[]>();
  const kept: Transaction[] = [];
  for (const t of wallet.transactions) {
    const key = new Date(t.date).getTime() < limit ? groupKey(t) : null;
    if (!key) {
      kept.push(t);
      continue;
    }
    const g = groups.get(key);
    if (g) g.push(t);
    else groups.set(key, [t]);
  }
  for (const [key, txs] of groups) {
    if (txs.length === 1) {
      kept.push(txs[0]);
      continue;
    }
    const metal = key.split('|')[1] as Metal;
    const last = txs.reduce((a, b) => (a.date > b.date ? a : b));
    const d = new Date(last.date);
    const sum = (f: (t: Transaction) => number) => txs.reduce((s, t) => s + f(t), 0);
    const cash = sum((t) => t.cash ?? 0);
    kept.push({
      id: last.id,
      kind: 'buy',
      date: last.date,
      deltas: {
        gold: 0,
        silver: 0,
        platinum: 0,
        [metal]: r(
          sum((t) => t.deltas[metal]),
          6,
        ),
      },
      eur: r(
        sum((t) => t.eur),
        4,
      ),
      fees: r(
        sum((t) => t.fees ?? 0),
        4,
      ),
      ...(cash ? { cash: r(cash, 4) } : {}),
      label: `Achats ${OF[metal]} · ${MONTHS[d.getMonth()]} ${d.getFullYear()} (${txs.length} achats regroupés)`,
    });
  }
  kept.sort((a, b) => b.date.localeCompare(a.date));
  return { ...wallet, transactions: kept };
}
