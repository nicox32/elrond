import type { Account, Metal, Prices, Transaction, TransactionKind } from './types';

/** Écart achat/vente appliqué à chaque opération (0,5 %). */
export const SPREAD = 0.005;

/** En dessous de ce nombre de grammes, un écart est considéré comme un arrondi. */
const DUST = 1e-5;

export class LedgerError extends Error {}

export const METAL_LABEL: Record<Metal, string> = { gold: 'Or', silver: 'Argent' };

export function buyPrice(prices: Prices, metal: Metal): number {
  return prices[metal] * (1 + SPREAD);
}

export function sellPrice(prices: Prices, metal: Metal): number {
  return prices[metal] * (1 - SPREAD);
}

/** Valeur de revente du compte en euros. */
export function accountValue(account: Account, prices: Prices) {
  const gold = account.goldGrams * sellPrice(prices, 'gold');
  const silver = account.silverGrams * sellPrice(prices, 'silver');
  return { gold, silver, total: gold + silver };
}

export function createAccount(holder: string): Account {
  const digits = Array.from({ length: 20 }, () => Math.floor(Math.random() * 10)).join('');
  return {
    holder,
    iban: `FR76 ${digits.replace(/(.{4})/g, '$1 ').trim()}`,
    goldGrams: 0,
    silverGrams: 0,
    goldAllocation: 70,
    transactions: [],
  };
}

function round(n: number, decimals = 6): number {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}

function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function apply(
  account: Account,
  kind: TransactionKind,
  goldDelta: number,
  silverDelta: number,
  eur: number,
  label: string,
  now: Date,
): Account {
  let goldGrams = round(account.goldGrams + goldDelta);
  let silverGrams = round(account.silverGrams + silverDelta);
  // Tolère les miettes d'arrondi quand on vide entièrement un solde.
  if (goldGrams < 0 && goldGrams > -DUST) goldGrams = 0;
  if (silverGrams < 0 && silverGrams > -DUST) silverGrams = 0;
  if (goldGrams < 0 || silverGrams < 0) {
    throw new LedgerError('Solde insuffisant.');
  }
  const tx: Transaction = {
    id: newId(),
    kind,
    date: now.toISOString(),
    goldDelta: round(goldDelta),
    silverDelta: round(silverDelta),
    eur: round(eur, 2),
    label,
  };
  return { ...account, goldGrams, silverGrams, transactions: [tx, ...account.transactions] };
}

function assertPositive(n: number, what: string) {
  if (!Number.isFinite(n) || n <= 0) {
    throw new LedgerError(`${what} doit être un nombre positif.`);
  }
}

/** Dépose des euros : ils sont aussitôt convertis en or et en argent selon la répartition du compte. */
export function deposit(account: Account, prices: Prices, eur: number, now = new Date()): Account {
  assertPositive(eur, 'Le montant');
  const goldEur = (eur * account.goldAllocation) / 100;
  const silverEur = eur - goldEur;
  const goldDelta = goldEur / buyPrice(prices, 'gold');
  const silverDelta = silverEur / buyPrice(prices, 'silver');
  return apply(account, 'deposit', goldDelta, silverDelta, eur, 'Dépôt', now);
}

/**
 * Retire des euros en vendant du métal.
 * source = 'mix' vend l'or et l'argent au prorata de leur valeur.
 */
export function withdraw(
  account: Account,
  prices: Prices,
  eur: number,
  source: Metal | 'mix' = 'mix',
  now = new Date(),
): Account {
  assertPositive(eur, 'Le montant');
  const value = accountValue(account, prices);
  let goldEur: number;
  if (source === 'gold') goldEur = eur;
  else if (source === 'silver') goldEur = 0;
  else {
    if (value.total <= 0) throw new LedgerError('Solde insuffisant.');
    goldEur = eur * (value.gold / value.total);
  }
  const silverEur = eur - goldEur;
  const goldDelta = -goldEur / sellPrice(prices, 'gold');
  const silverDelta = -silverEur / sellPrice(prices, 'silver');
  return apply(account, 'withdraw', goldDelta, silverDelta, eur, 'Retrait', now);
}

/** Convertit des grammes d'un métal vers l'autre (vente puis achat, écart appliqué deux fois). */
export function convert(
  account: Account,
  prices: Prices,
  from: Metal,
  grams: number,
  now = new Date(),
): Account {
  assertPositive(grams, 'La quantité');
  const to: Metal = from === 'gold' ? 'silver' : 'gold';
  const eur = grams * sellPrice(prices, from);
  const received = eur / buyPrice(prices, to);
  const goldDelta = from === 'gold' ? -grams : received;
  const silverDelta = from === 'silver' ? -grams : received;
  return apply(
    account,
    'convert',
    goldDelta,
    silverDelta,
    eur,
    `${METAL_LABEL[from]} → ${METAL_LABEL[to]}`,
    now,
  );
}

/** Envoie des grammes de métal à un bénéficiaire (fictif). Pas d'écart : le métal change juste de propriétaire. */
export function transfer(
  account: Account,
  prices: Prices,
  metal: Metal,
  grams: number,
  beneficiary: string,
  now = new Date(),
): Account {
  assertPositive(grams, 'La quantité');
  const name = beneficiary.trim();
  if (!name) throw new LedgerError('Indique un bénéficiaire.');
  const goldDelta = metal === 'gold' ? -grams : 0;
  const silverDelta = metal === 'silver' ? -grams : 0;
  return apply(account, 'transfer', goldDelta, silverDelta, grams * prices[metal], `Virement à ${name}`, now);
}
