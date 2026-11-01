import {
  type Account,
  type BalancePoint,
  type Beneficiary,
  type Holdings,
  type Metal,
  METALS,
  type Prices,
  type Quantity,
  type Transaction,
  type TransactionKind,
} from './types.ts';

/** Écart achat/vente appliqué aux achats, ventes, conversions et virements vers IBAN (0,5 %). */
export const SPREAD = 0.005;

/** Une once troy, en grammes. */
export const TROY_OUNCE = 31.1034768;

/** En dessous de ce nombre de grammes, un écart est considéré comme un arrondi. */
const DUST = 1e-5;

/** Nombre maximal de points gardés pour le graphique du solde. */
const MAX_BALANCE_POINTS = 1000;

/** Deux points du graphique plus proches que ça sont fusionnés. */
const BALANCE_MERGE_MS = 60_000;

export class LedgerError extends Error {}

export const METAL_LABEL: Record<Metal, string> = {
  gold: 'Or',
  silver: 'Argent',
  platinum: 'Platine',
};

/** « d'or », « d'argent », « de platine ». */
export const METAL_OF: Record<Metal, string> = {
  gold: 'd’or',
  silver: 'd’argent',
  platinum: 'de platine',
};

export function emptyHoldings(): Holdings {
  return { gold: 0, silver: 0, platinum: 0 };
}

export function buyPrice(prices: Prices, metal: Metal): number {
  return prices[metal] * (1 + SPREAD);
}

export function sellPrice(prices: Prices, metal: Metal): number {
  return prices[metal] * (1 - SPREAD);
}

/** Valeur de revente du compte en euros, par métal et au total. */
export function accountValue(account: Pick<Account, 'holdings'>, prices: Prices) {
  const byMetal = emptyHoldings();
  let total = 0;
  for (const m of METALS) {
    byMetal[m] = account.holdings[m] * sellPrice(prices, m);
    total += byMetal[m];
  }
  return { byMetal, total };
}

function randomDigits(n: number): string {
  return Array.from({ length: n }, () => Math.floor(Math.random() * 10)).join('');
}

function mod97(numeric: string): number {
  let r = 0;
  for (const d of numeric) r = (r * 10 + Number(d)) % 97;
  return r;
}

/** Génère un IBAN français fictif mais dont la clé de contrôle est valide. */
function generateIban(): string {
  const bban = randomDigits(23);
  const check = 98 - mod97(`${bban}152700`); // « FR00 » → F=15, R=27
  return formatIban(`FR${String(check).padStart(2, '0')}${bban}`);
}

export function createAccount(holder: string, now = new Date()): Account {
  return {
    version: 2,
    holder,
    memberId: `EL-${randomDigits(4)}-${randomDigits(4)}`,
    iban: generateIban(),
    createdAt: now.toISOString(),
    holdings: emptyHoldings(),
    transactions: [],
    beneficiaries: [],
    balanceHistory: [],
    settings: { unit: 'g', biometrics: false },
  };
}

/** Met à niveau un compte enregistré par une ancienne version de l'appli. */
export function migrateAccount(raw: unknown): Account | null {
  if (!raw || typeof raw !== 'object') return null;
  const a = raw as Record<string, any>;
  if (a.version === 2) return a as Account;
  if (typeof a.holder !== 'string') return null;

  // Version 1 : or et argent seulement, champs goldGrams / silverGrams.
  const base = createAccount(a.holder);
  const kindMap: Record<string, TransactionKind> = {
    deposit: 'buy',
    withdraw: 'sell',
    convert: 'convert',
    transfer: 'transfer_member',
  };
  const transactions: Transaction[] = Array.isArray(a.transactions)
    ? a.transactions.map((t: any) => ({
        id: String(t.id),
        kind: kindMap[t.kind] ?? 'buy',
        date: String(t.date),
        deltas: { gold: Number(t.goldDelta) || 0, silver: Number(t.silverDelta) || 0, platinum: 0 },
        eur: Number(t.eur) || 0,
        label: String(t.label ?? ''),
      }))
    : [];
  return {
    ...base,
    iban: typeof a.iban === 'string' ? a.iban : base.iban,
    holdings: { gold: Number(a.goldGrams) || 0, silver: Number(a.silverGrams) || 0, platinum: 0 },
    transactions,
  };
}

function round(n: number, decimals = 6): number {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}

export function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function apply(
  account: Account,
  kind: TransactionKind,
  deltas: Partial<Holdings>,
  eur: number,
  label: string,
  now: Date,
): Account {
  const holdings = { ...account.holdings };
  const full = emptyHoldings();
  for (const m of METALS) {
    const d = deltas[m] ?? 0;
    full[m] = round(d);
    let next = round(holdings[m] + d);
    // Tolère les miettes d'arrondi quand on vide entièrement un solde.
    if (next < 0 && next > -DUST) next = 0;
    if (next < 0) throw new LedgerError(`Solde ${METAL_OF[m]} insuffisant.`);
    holdings[m] = next;
  }
  const tx: Transaction = {
    id: newId(),
    kind,
    date: now.toISOString(),
    deltas: full,
    eur: round(eur, 2),
    label,
  };
  return { ...account, holdings, transactions: [tx, ...account.transactions] };
}

function assertPositive(n: number, what: string) {
  if (!Number.isFinite(n) || n <= 0) {
    throw new LedgerError(`${what} doit être un nombre positif.`);
  }
}

/** Convertit une saisie en grammes. Pour une saisie en euros, `pricePerGram` donne le taux. */
export function toGrams(q: Quantity, pricePerGram: number): number {
  switch (q.unit) {
    case 'g':
      return q.value;
    case 'oz':
      return q.value * TROY_OUNCE;
    case 'eur':
      return q.value / pricePerGram;
  }
}

/** Achète du métal, payé par carte bancaire (fictive). Saisie en euros, grammes ou onces. */
export function buy(account: Account, prices: Prices, metal: Metal, q: Quantity, now = new Date()): Account {
  assertPositive(q.value, 'La quantité');
  const price = buyPrice(prices, metal);
  const grams = toGrams(q, price);
  return apply(account, 'buy', { [metal]: grams }, grams * price, `Achat ${METAL_OF[metal]}`, now);
}

/** Vend du métal ; les euros sont versés sur le compte bancaire du titulaire (fictif). */
export function sell(account: Account, prices: Prices, metal: Metal, q: Quantity, now = new Date()): Account {
  assertPositive(q.value, 'La quantité');
  const price = sellPrice(prices, metal);
  const grams = toGrams(q, price);
  return apply(account, 'sell', { [metal]: -grams }, grams * price, `Vente ${METAL_OF[metal]}`, now);
}

/** Convertit un métal en un autre : vente puis achat, l'écart s'applique deux fois. */
export function convert(
  account: Account,
  prices: Prices,
  from: Metal,
  to: Metal,
  q: Quantity,
  now = new Date(),
): Account {
  assertPositive(q.value, 'La quantité');
  if (from === to) throw new LedgerError('Choisis deux métaux différents.');
  const grams = toGrams(q, sellPrice(prices, from));
  const eur = grams * sellPrice(prices, from);
  const received = eur / buyPrice(prices, to);
  return apply(
    account,
    'convert',
    { [from]: -grams, [to]: received },
    eur,
    `${METAL_LABEL[from]} → ${METAL_LABEL[to]}`,
    now,
  );
}

/** Virement de métal à un autre membre : gratuit et immédiat, le métal change de propriétaire. */
export function transferToMember(
  account: Account,
  prices: Prices,
  metal: Metal,
  q: Quantity,
  beneficiary: Beneficiary,
  now = new Date(),
): Account {
  assertPositive(q.value, 'La quantité');
  if (beneficiary.kind !== 'member') throw new LedgerError('Ce bénéficiaire n’est pas un membre.');
  if (beneficiary.identifier === account.memberId) {
    throw new LedgerError('Tu ne peux pas te faire un virement à toi-même.');
  }
  const grams = toGrams(q, prices[metal]);
  return apply(
    account,
    'transfer_member',
    { [metal]: -grams },
    grams * prices[metal],
    `Virement à ${beneficiary.name}`,
    now,
  );
}

/** Virement en euros vers un IBAN : le métal est vendu, puis les euros sont envoyés. */
export function transferToIban(
  account: Account,
  prices: Prices,
  metal: Metal,
  q: Quantity,
  beneficiary: Beneficiary,
  now = new Date(),
): Account {
  assertPositive(q.value, 'Le montant');
  if (beneficiary.kind !== 'iban') throw new LedgerError('Ce bénéficiaire n’a pas d’IBAN.');
  const price = sellPrice(prices, metal);
  const grams = toGrams(q, price);
  return apply(
    account,
    'transfer_iban',
    { [metal]: -grams },
    grams * price,
    `Virement SEPA à ${beneficiary.name}`,
    now,
  );
}

/** Vérifie un IBAN (longueur et clé de contrôle ISO 13616). */
export function isValidIban(input: string): boolean {
  const iban = input.replace(/\s/g, '').toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(iban)) return false;
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  const numeric = rearranged.replace(/[A-Z]/g, (ch) => String(ch.charCodeAt(0) - 55));
  return mod97(numeric) === 1;
}

export function formatIban(input: string): string {
  return input
    .replace(/\s/g, '')
    .toUpperCase()
    .replace(/(.{4})/g, '$1 ')
    .trim();
}

/** Ajoute un bénéficiaire après validation de son identifiant. */
export function addBeneficiary(
  account: Account,
  kind: Beneficiary['kind'],
  name: string,
  identifier: string,
): { account: Account; beneficiary: Beneficiary } {
  const cleanName = name.trim();
  if (!cleanName) throw new LedgerError('Indique le nom du bénéficiaire.');
  let id = identifier.trim();
  if (kind === 'iban') {
    if (!isValidIban(id)) throw new LedgerError('IBAN invalide.');
    id = formatIban(id);
  } else if (!id) {
    throw new LedgerError('Indique l’identifiant, l’e-mail ou le téléphone du membre.');
  }
  const existing = account.beneficiaries.find((b) => b.kind === kind && b.identifier === id);
  if (existing) return { account, beneficiary: existing };
  const beneficiary: Beneficiary = { id: newId(), kind, name: cleanName, identifier: id };
  return { account: { ...account, beneficiaries: [...account.beneficiaries, beneficiary] }, beneficiary };
}

export function removeBeneficiary(account: Account, id: string): Account {
  return { ...account, beneficiaries: account.beneficiaries.filter((b) => b.id !== id) };
}

/**
 * Euros nets placés sur le compte : achats − ventes − virements sortants.
 * Les conversions ne déplacent pas d'argent (leur coût apparaît dans la plus-value).
 */
export function netInvested(account: Pick<Account, 'transactions'>): number {
  let total = 0;
  for (const tx of account.transactions) {
    if (tx.kind === 'buy') total += tx.eur;
    else if (tx.kind !== 'convert') total -= tx.eur;
  }
  return round(total, 2);
}

/** Plus ou moins-value latente : valeur de revente actuelle − euros nets placés. */
export function unrealizedGain(account: Account, prices: Prices) {
  const invested = netInvested(account);
  const gain = accountValue(account, prices).total - invested;
  return { invested, gain, percent: invested > 0 ? (gain / invested) * 100 : 0 };
}

/** Enregistre la valeur du compte pour le graphique d'évolution du solde. */
export function recordBalance(account: Account, prices: Prices, now = new Date()): Account {
  const point: BalancePoint = {
    date: now.toISOString(),
    total: round(accountValue(account, prices).total, 2),
  };
  const history = [...account.balanceHistory];
  const last = history[history.length - 1];
  if (last && now.getTime() - new Date(last.date).getTime() < BALANCE_MERGE_MS) {
    history[history.length - 1] = point;
  } else {
    history.push(point);
  }
  return { ...account, balanceHistory: history.slice(-MAX_BALANCE_POINTS) };
}
