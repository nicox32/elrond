import { DEFERRED_DAYS, FEES, type SaleSpeed } from './fees.ts';
import { gramsForNet, type SaleTax, saleTax } from './tax.ts';
import {
  type Account,
  type ChildAccount,
  type BalancePoint,
  type Beneficiary,
  type Holdings,
  type Metal,
  METALS,
  type Prices,
  type Quantity,
  type Transaction,
  type TransactionKind,
  type Wallet,
} from './types.ts';

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

/** Prix effectif d'un gramme à l'achat, frais de gestion compris (frais en part du montant payé). */
export function buyPrice(prices: Prices, metal: Metal): number {
  return prices[metal] / (1 - FEES.buy[metal]);
}

/** Prix net d'un gramme à la revente par virement, hors frais fixe vers l'étranger. */
export function sellPrice(prices: Prices, metal: Metal, speed: SaleSpeed = 'deferred'): number {
  return prices[metal] * (1 - FEES.sale - (speed === 'immediate' ? FEES.immediateSpread : 0));
}

/** Valeur de revente d'un compte en euros (virement différé en France), par métal et au total. */
export function accountValue(account: Pick<Wallet, 'holdings'>, prices: Prices) {
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
    memberId: `OV-${randomDigits(4)}-${randomDigits(4)}`,
    iban: generateIban(),
    createdAt: now.toISOString(),
    holdings: emptyHoldings(),
    transactions: [],
    beneficiaries: [],
    children: [],
    referral: { code: generateReferralCode() },
    balanceHistory: [],
    settings: { unit: 'g', biometrics: false },
  };
}

/** Met à niveau un compte enregistré par une ancienne version de l'appli. */
export function migrateAccount(raw: unknown): Account | null {
  if (!raw || typeof raw !== 'object') return null;
  const a = raw as Record<string, any>;
  if (a.version === 2) {
    // Champs ajoutés au fil des versions.
    return {
      ...(a as Account),
      children: Array.isArray(a.children) ? a.children : [],
      referral: a.referral && typeof a.referral.code === 'string' ? a.referral : { code: generateReferralCode() },
    };
  }
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

function apply<W extends Wallet>(
  wallet: W,
  kind: TransactionKind,
  deltas: Partial<Holdings>,
  eur: number,
  label: string,
  now: Date,
  fees = 0,
  tax?: SaleTax | null,
): W {
  const holdings = { ...wallet.holdings };
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
  if (fees > 0) tx.fees = round(fees, 2);
  if (tax) {
    tx.tax = round(tax.tax, 2);
    tx.taxRegime = tax.regime;
  }
  return { ...wallet, holdings, transactions: [tx, ...wallet.transactions] };
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

const SPEED_LABEL: Record<SaleSpeed, string> = {
  immediate: 'virement immédiat',
  deferred: `virement différé J+${DEFERRED_DAYS}`,
};

/** Détail chiffré d'un achat, pour l'aperçu et l'opération. */
export function quoteBuy(prices: Prices, metal: Metal, q: Quantity) {
  const grams = toGrams(q, buyPrice(prices, metal));
  const paid = grams * buyPrice(prices, metal);
  return { grams, paid, fees: paid - grams * prices[metal] };
}

/**
 * Achète du métal, payé par carte bancaire (fictive). Saisie en euros (montant payé), grammes ou onces.
 * Premier achat d'au moins 50 € d'un filleul : son bonus de parrainage est versé dans la foulée.
 */
export function buy(account: Account, prices: Prices, metal: Metal, q: Quantity, now = new Date()): Account {
  assertPositive(q.value, 'La quantité');
  const { grams, paid, fees } = quoteBuy(prices, metal, q);
  const bought = apply(account, 'buy', { [metal]: grams }, paid, `Achat ${METAL_OF[metal]}`, now, fees);
  return paid >= REFERRAL.minFirstPurchase ? payReferralBonus(bought, prices, now) : bought;
}

/**
 * Détail chiffré d'une revente par virement. Saisie en euros = montant reçu net de frais.
 * `abroad` : compte bancaire hors de France (frais fixe en plus).
 */
export function quoteSale(
  prices: Prices,
  metal: Metal,
  q: Quantity,
  speed: SaleSpeed,
  abroad = false,
  wallet?: Pick<Wallet, 'transactions'>,
  now = new Date(),
) {
  const net = sellPrice(prices, metal, speed);
  const fixed = abroad ? FEES.saleAbroadFixed : 0;
  // Saisie en euros = montant reçu, impôt déduit quand le compte est connu.
  const grams =
    q.unit === 'eur'
      ? wallet
        ? gramsForNet(wallet, metal, q.value, net, fixed, now)
        : (q.value + fixed) / net
      : toGrams(q, net);
  const gross = grams * net - fixed;
  const tax = wallet ? saleTax(wallet, metal, grams, Math.max(0, gross), now) : null;
  const received = gross - (tax?.tax ?? 0);
  return { grams, gross, received, fees: grams * prices[metal] - gross, tax };
}

/** Vend du métal ; les euros sont versés sur le compte bancaire du titulaire (fictif, en France). */
export function sell(
  account: Account,
  prices: Prices,
  metal: Metal,
  q: Quantity,
  speed: SaleSpeed = 'deferred',
  now = new Date(),
): Account {
  assertPositive(q.value, 'La quantité');
  const { grams, received, fees, tax } = quoteSale(prices, metal, q, speed, false, account, now);
  return apply(
    account,
    'sell',
    { [metal]: -grams },
    received,
    `Vente ${METAL_OF[metal]} · ${SPEED_LABEL[speed]}`,
    now,
    fees,
    tax,
  );
}

/** Détail chiffré d'une conversion : revente (frais de conversion) puis achat (frais d'achat du métal reçu). */
export function quoteConvert(
  prices: Prices,
  from: Metal,
  to: Metal,
  q: Quantity,
  wallet?: Pick<Wallet, 'transactions'>,
  now = new Date(),
) {
  const grams = toGrams(q, prices[from]);
  const gross = grams * prices[from];
  // Échanger un métal contre un autre est une cession : l'impôt est retenu avant le rachat.
  const cession = gross * (1 - FEES.conversion);
  const tax = wallet ? saleTax(wallet, from, grams, cession, now) : null;
  const reinvested = cession - (tax?.tax ?? 0);
  const received = (reinvested * (1 - FEES.buy[to])) / prices[to];
  return { grams, gross, received, fees: gross - (tax?.tax ?? 0) - received * prices[to], tax };
}

/** Convertit un métal en un autre. Saisie en euros = valeur au cours du métal cédé. */
export function convert(
  account: Account,
  prices: Prices,
  from: Metal,
  to: Metal,
  q: Quantity,
  now = new Date(),
): Account {
  assertPositive(q.value, 'La quantité');
  if (from === to) throw new LedgerError('Choisissez deux métaux différents.');
  const { grams, gross, received, fees, tax } = quoteConvert(prices, from, to, q, account, now);
  return apply(
    account,
    'convert',
    { [from]: -grams, [to]: received },
    gross,
    `${METAL_LABEL[from]} → ${METAL_LABEL[to]}`,
    now,
    fees,
    tax,
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
    throw new LedgerError('Vous ne pouvez pas vous faire un virement à vous-même.');
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

/** Un IBAN hors de France entraîne le frais fixe de virement vers l'étranger. */
export function isForeignIban(iban: string): boolean {
  return !iban.replace(/\s/g, '').toUpperCase().startsWith('FR');
}

/** Virement en euros vers un IBAN : le métal est vendu, puis les euros sont envoyés. Saisie en euros = montant reçu. */
export function transferToIban(
  account: Account,
  prices: Prices,
  metal: Metal,
  q: Quantity,
  beneficiary: Beneficiary,
  speed: SaleSpeed = 'deferred',
  now = new Date(),
): Account {
  assertPositive(q.value, 'Le montant');
  if (beneficiary.kind !== 'iban') throw new LedgerError('Ce bénéficiaire n’a pas d’IBAN.');
  const { grams, received, fees, tax } = quoteSale(
    prices,
    metal,
    q,
    speed,
    isForeignIban(beneficiary.identifier),
    account,
    now,
  );
  if (received <= 0) throw new LedgerError('Montant trop faible pour couvrir les frais du virement.');
  return apply(
    account,
    'transfer_iban',
    { [metal]: -grams },
    received,
    `Virement SEPA à ${beneficiary.name} · ${SPEED_LABEL[speed]}`,
    now,
    fees,
    tax,
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
  if (!cleanName) throw new LedgerError('Indiquez le nom du bénéficiaire.');
  let id = identifier.trim();
  if (kind === 'iban') {
    if (!isValidIban(id)) throw new LedgerError('IBAN invalide.');
    id = formatIban(id);
  } else if (!id) {
    throw new LedgerError('Indiquez l’identifiant, l’e-mail ou le téléphone du membre.');
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
 * Euros nets placés sur le compte : achats − ventes − virements sortants ± transferts familiaux.
 * Conversions et frais d'oxydation ne déplacent pas d'argent : leur coût apparaît dans la plus-value.
 */
export function netInvested(account: Pick<Wallet, 'transactions'>): number {
  let total = 0;
  for (const tx of account.transactions) {
    if (tx.kind === 'buy' || tx.kind === 'family_in') total += tx.eur;
    // Le bonus de parrainage est un gain, pas un apport : il apparaît dans la plus-value.
    else if (tx.kind !== 'convert' && tx.kind !== 'fee_dormancy' && tx.kind !== 'referral_bonus') total -= tx.eur;
  }
  return round(total, 2);
}

/** Plus ou moins-value latente : valeur de revente actuelle − euros nets placés. */
export function unrealizedGain(account: Wallet, prices: Prices) {
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

// ——— Comptes enfants ———————————————————————————————————————————————

/** Âge de la majorité : aucun frais sur un compte enfant avant. */
export const MAJORITY_AGE = 18;

/** Lit une date de naissance « JJ/MM/AAAA » et la renvoie au format AAAA-MM-JJ. L'enfant doit être mineur. */
export function parseBirthDate(text: string, now = new Date()): string {
  const m = /^\s*(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})\s*$/.exec(text);
  if (!m) throw new LedgerError('Date de naissance au format JJ/MM/AAAA.');
  const [day, month, year] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const d = new Date(Date.UTC(year, month - 1, day));
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) {
    throw new LedgerError('Cette date n’existe pas.');
  }
  if (d.getTime() > now.getTime()) throw new LedgerError('La date de naissance est dans le futur.');
  const iso = d.toISOString().slice(0, 10);
  if (majorityDate(iso).getTime() <= now.getTime()) {
    throw new LedgerError(`Un compte enfant est réservé aux moins de ${MAJORITY_AGE} ans.`);
  }
  return iso;
}

/** Date des 18 ans. */
export function majorityDate(birthDate: string): Date {
  const [y, mo, d] = birthDate.split('-').map(Number);
  return new Date(Date.UTC(y + MAJORITY_AGE, mo - 1, d));
}

export function addChild(account: Account, name: string, birthDate?: string, now = new Date()) {
  const clean = name.trim();
  if (!clean) throw new LedgerError('Indiquez le prénom de l’enfant.');
  const child: ChildAccount = {
    id: newId(),
    name: clean,
    createdAt: now.toISOString(),
    holdings: emptyHoldings(),
    transactions: [],
  };
  if (birthDate) child.birthDate = birthDate;
  return { account: { ...account, children: [...account.children, child] }, child };
}

function findChild(account: Account, childId: string): ChildAccount {
  const child = account.children.find((c) => c.id === childId);
  if (!child) throw new LedgerError('Compte enfant introuvable.');
  return child;
}

function replaceChild(account: Account, child: ChildAccount): Account {
  return { ...account, children: account.children.map((c) => (c.id === child.id ? child : c)) };
}

/** Verse du métal du compte principal vers un compte enfant. Gratuit. */
export function fundChild(
  account: Account,
  prices: Prices,
  childId: string,
  metal: Metal,
  q: Quantity,
  now = new Date(),
): Account {
  assertPositive(q.value, 'La quantité');
  const child = findChild(account, childId);
  if (child.transferredAt) throw new LedgerError(`Le compte de ${child.name} lui a été transféré.`);
  if (child.birthDate && majorityDate(child.birthDate).getTime() <= now.getTime()) {
    throw new LedgerError(
      `${child.name} est majeur : transférez-lui son compte, puis faites-lui un virement à un membre.`,
    );
  }
  const grams = toGrams(q, prices[metal]);
  const value = grams * prices[metal];
  const parent = apply(account, 'family_out', { [metal]: -grams }, value, `Vers le compte de ${child.name}`, now);
  const credited = apply(child, 'family_in', { [metal]: grams }, value, `Versement de ${account.holder}`, now);
  return replaceChild(parent, credited);
}

/**
 * Mouvement brut du compte enfant vers le compte du parent. À n'utiliser qu'au travers des règles de
 * src/logic/childRules.ts (retrait motivé et validé, ou annulation d'un versement par erreur) : l'argent
 * versé à un enfant lui appartient.
 */
export function withdrawFromChild(
  account: Account,
  prices: Prices,
  childId: string,
  metal: Metal,
  q: Quantity,
  now = new Date(),
  labels: { child?: string; parent?: string } = {},
): Account {
  assertPositive(q.value, 'La quantité');
  const child = findChild(account, childId);
  const grams = toGrams(q, prices[metal]);
  const value = grams * prices[metal];
  const debited = apply(
    child,
    'family_out',
    { [metal]: -grams },
    value,
    labels.child ?? `Vers le compte de ${account.holder}`,
    now,
  );
  const parent = apply(
    account,
    'family_in',
    { [metal]: grams },
    value,
    labels.parent ?? `Depuis le compte de ${child.name}`,
    now,
  );
  return replaceChild(parent, debited);
}

export function replaceChildAccount(account: Account, child: ChildAccount): Account {
  return replaceChild(account, child);
}

export function getChild(account: Account, childId: string): ChildAccount {
  return findChild(account, childId);
}

/** Renseigne (ou corrige) la date de naissance d'un enfant. */
export function setChildBirthDate(account: Account, childId: string, birthDate: string): Account {
  return replaceChild(account, { ...findChild(account, childId), birthDate });
}

/** Ferme un compte enfant vide. */
export function removeChild(account: Account, childId: string): Account {
  const child = findChild(account, childId);
  if (METALS.some((m) => child.holdings[m] > DUST)) {
    throw new LedgerError('Videz d’abord ce compte enfant vers votre compte.');
  }
  return { ...account, children: account.children.filter((c) => c.id !== childId) };
}

// ——— Frais d'oxydation (compte inactif) ————————————————————————————

const DAY_MS = 86_400_000;

function addMonths(date: Date, months: number): Date {
  const d = new Date(date.getTime());
  d.setMonth(d.getMonth() + months);
  return d;
}

/** Montant minimal d'une opération pour qu'elle compte comme un mouvement (et évite les frais d'oxydation). */
export const MIN_MOVEMENT_EUR = 1;

/**
 * Opérations qui évitent les frais d'oxydation, à partir d'un euro : crédit du compte (achat) et échanges de louis
 * (envoi à un membre, conversion, versements entre comptes de la famille). Ventes, virements vers un IBAN et frais
 * ne comptent pas. Les paiements et retraits par carte et le parrainage compteront quand ils existeront.
 */
export const MOVEMENT_KINDS: ReadonlySet<TransactionKind> = new Set<TransactionKind>([
  'buy',
  'card_payment',
  'card_withdrawal',
  'referral_bonus',
  'convert',
  'transfer_member',
  'family_out',
  'family_in',
]);

/** Une opération de la liste ci-dessus, d'au moins 1 €, compte comme un mouvement. */
export function isMovement(tx: Transaction): boolean {
  return MOVEMENT_KINDS.has(tx.kind) && tx.eur >= MIN_MOVEMENT_EUR;
}

/** Date du dernier mouvement (opération d'au moins 1 €), ou de l'ouverture du compte. */
export function lastMovement(wallet: Wallet): Date {
  let last = new Date(wallet.createdAt).getTime();
  for (const tx of wallet.transactions) {
    if (isMovement(tx)) last = Math.max(last, new Date(tx.date).getTime());
  }
  return new Date(last);
}

/**
 * Où en est le compte vis-à-vis de l'inactivité. Les périodes d'inactivité durent 6 mois calendaires
 * à partir du dernier mouvement ; `nextChargeAt` est la fin de la prochaine période non facturée.
 */
/**
 * Jusqu'à quand le compte est exonéré de frais d'oxydation : pour un enfant, ses 18 ans
 * (sans date de naissance connue, toujours). `null` : pas d'exonération.
 */
export function feesExemptUntil(wallet: Wallet): Date | null {
  if (!('name' in wallet) || 'holder' in wallet) return null; // compte principal
  const child = wallet as ChildAccount;
  return child.birthDate ? majorityDate(child.birthDate) : new Date(8.64e15);
}

/** Point de départ des 6 mois : le dernier mouvement, ou la majorité pour un compte enfant devenu majeur. */
function dormancyAnchor(wallet: Wallet): Date {
  let anchor = lastMovement(wallet).getTime();
  const exempt = feesExemptUntil(wallet);
  if (exempt) anchor = Math.max(anchor, exempt.getTime());
  if (wallet.dormancyNotBefore) anchor = Math.max(anchor, new Date(wallet.dormancyNotBefore).getTime());
  return new Date(anchor);
}

export function dormancyStatus(wallet: Wallet, now = new Date()) {
  const exemptUntil = feesExemptUntil(wallet);
  const exempt = !!exemptUntil && now < exemptUntil;
  const last = dormancyAnchor(wallet);
  const inactiveFrom = addMonths(last, FEES.dormancyAfterMonths);
  const charged = wallet.dormancyChargedThrough ? new Date(wallet.dormancyChargedThrough).getTime() : 0;
  let k = 1;
  while (addMonths(last, FEES.dormancyAfterMonths * k).getTime() <= Math.max(charged, last.getTime())) k++;
  const nextChargeAt = addMonths(last, FEES.dormancyAfterMonths * k);
  const daysLeft = Math.ceil((nextChargeAt.getTime() - now.getTime()) / DAY_MS);
  return {
    inactive: !exempt && now >= inactiveFrom,
    exempt,
    exemptUntil,
    inactiveFrom,
    nextChargeAt,
    daysLeft: exempt ? Number.POSITIVE_INFINITY : daysLeft,
    lastMovement: lastMovement(wallet),
  };
}

/**
 * Prélève les frais d'oxydation dus. Chaque période de 6 mois calendaires sans mouvement, une fois écoulée,
 * est facturée 0,02 % du solde par jour de la période (environ 3,6 % pour 6 mois), en métal.
 * Une période déjà facturée ne l'est jamais deux fois.
 */
export function chargeDormancy<W extends Wallet>(wallet: W, prices: Prices, now = new Date()): W {
  const exemptUntil = feesExemptUntil(wallet);
  if (exemptUntil && now < exemptUntil) return wallet; // enfant mineur : aucun frais
  if ((wallet as Partial<ChildAccount>).transferredAt) return wallet; // compte remis à l'enfant majeur
  const last = dormancyAnchor(wallet);
  const charged = wallet.dormancyChargedThrough ? new Date(wallet.dormancyChargedThrough).getTime() : 0;
  let result = wallet;
  for (let k = 1; ; k++) {
    const periodStart = addMonths(last, FEES.dormancyAfterMonths * (k - 1));
    const periodEnd = addMonths(last, FEES.dormancyAfterMonths * k);
    if (periodEnd.getTime() > now.getTime()) break;
    if (periodEnd.getTime() <= charged) continue;
    const days = Math.round((periodEnd.getTime() - periodStart.getTime()) / DAY_MS);
    const share = Math.min(1, FEES.dormancyDaily * days);
    const deltas: Partial<Holdings> = {};
    let value = 0;
    for (const m of METALS) {
      const fee = result.holdings[m] * share;
      if (fee > 0) {
        deltas[m] = -fee;
        value += fee * prices[m];
      }
    }
    const through = periodEnd.toISOString();
    if (value > 0) {
      const from = periodStart.toLocaleDateString('fr-FR');
      const to = periodEnd.toLocaleDateString('fr-FR');
      const label = `Frais d’oxydation · ${days} jours d’inactivité (${from} → ${to})`;
      result = {
        ...apply(result, 'fee_dormancy', deltas, value, label, periodEnd, value),
        dormancyChargedThrough: through,
      };
    } else {
      result = { ...result, dormancyChargedThrough: through };
    }
  }
  return result;
}

/** Applique les frais d'oxydation au compte principal et à chaque compte enfant. */
export function applyDormancy(account: Account, prices: Prices, now = new Date()): Account {
  const parent = chargeDormancy(account, prices, now);
  const children = account.children.map((c) => chargeDormancy(c, prices, now));
  const changed = parent !== account || children.some((c, i) => c !== account.children[i]);
  return changed ? { ...parent, children } : account;
}

// ——— Parrainage ——————————————————————————————————————————————————

export const REFERRAL = {
  /** Bonus versé au filleul, en louis (1 LOU = 1 €), crédité en or. */
  bonusLou: 10,
  /** Montant minimal du premier achat qui déclenche le bonus. */
  minFirstPurchase: 50,
} as const;

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sans 0/O ni 1/I

export function generateReferralCode(): string {
  let code = '';
  for (let i = 0; i < 6; i++) code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  return `ORVIA-${code}`;
}

export function normalizeReferralCode(input: string): string {
  return input.trim().toUpperCase().replace(/\s+/g, '');
}

/** Saisit le code d'un parrain (une seule fois). Le bonus arrive au premier achat d'au moins 50 €. */
export function enterSponsorCode(account: Account, input: string): Account {
  const code = normalizeReferralCode(input);
  if (account.referral.sponsorCode) throw new LedgerError('Vous avez déjà saisi un code de parrainage.');
  if (!/^ORVIA-[A-Z0-9]{6}$/.test(code)) throw new LedgerError('Code de parrainage invalide (format ORVIA-XXXXXX).');
  if (code === account.referral.code) throw new LedgerError('Vous ne pouvez pas utiliser votre propre code.');
  return { ...account, referral: { ...account.referral, sponsorCode: code } };
}

/** Verse le bonus de filleul s'il est dû (code saisi, pas encore versé). */
export function payReferralBonus(account: Account, prices: Prices, now = new Date()): Account {
  const r = account.referral;
  if (!r?.sponsorCode || r.bonusPaid) return account;
  const eur = REFERRAL.bonusLou;
  const credited = apply(
    account,
    'referral_bonus',
    { gold: eur / prices.gold },
    eur,
    `Bonus de parrainage (${r.sponsorCode})`,
    now,
  );
  return { ...credited, referral: { ...r, bonusPaid: true } };
}

// ——— Carte Orvia ————————————————————————————————————————————————

export const CARD = {
  /** Plafond de paiements sur 30 jours glissants. */
  paymentLimit30d: 3000,
  /** Plafond de retraits sur 7 jours glissants. */
  withdrawalLimit7d: 500,
} as const;

/** Émet la carte virtuelle (gratuite). */
export function issueCard(account: Account, now = new Date()): Account {
  if (account.card) return account;
  const exp = new Date(now.getTime());
  exp.setFullYear(exp.getFullYear() + 4);
  return {
    ...account,
    card: {
      last4: randomDigits(4),
      expiry: `${String(exp.getMonth() + 1).padStart(2, '0')}/${String(exp.getFullYear()).slice(-2)}`,
      holderName: account.holder.toUpperCase(),
      fundingMetal: 'gold',
      frozen: false,
      issuedAt: now.toISOString(),
    },
  };
}

function requireCard(account: Account) {
  if (!account.card) throw new LedgerError('Commandez d’abord votre carte.');
  return account.card;
}

export function setCardFrozen(account: Account, frozen: boolean): Account {
  return { ...account, card: { ...requireCard(account), frozen } };
}

export function setCardMetal(account: Account, fundingMetal: Metal): Account {
  return { ...account, card: { ...requireCard(account), fundingMetal } };
}

/** Montant déjà utilisé sur une période glissante (en euros). */
export function cardUsage(account: Account, kind: 'card_payment' | 'card_withdrawal', days: number, now = new Date()) {
  const from = now.getTime() - days * 86_400_000;
  return account.transactions
    .filter((t) => t.kind === kind && new Date(t.date).getTime() > from)
    .reduce((sum, t) => sum + t.eur, 0);
}

function cardDebit(
  account: Account,
  prices: Prices,
  kind: 'card_payment' | 'card_withdrawal',
  amount: number,
  label: string,
  now: Date,
): Account {
  assertPositive(amount, 'Le montant');
  const card = requireCard(account);
  if (card.frozen) throw new LedgerError('Votre carte est gelée. Dégelez-la pour l’utiliser.');
  const [limit, days, what] =
    kind === 'card_payment'
      ? [CARD.paymentLimit30d, 30, 'de paiement sur 30 jours']
      : [CARD.withdrawalLimit7d, 7, 'de retrait sur 7 jours'];
  const used = cardUsage(account, kind, days, now);
  if (used + amount > limit + 1e-9) {
    throw new LedgerError(
      `Plafond ${what} atteint : il reste ${Math.max(0, limit - used)
        .toFixed(2)
        .replace('.', ',')} €.`,
    );
  }
  // Paiements et retraits par carte : revente du métal sans frais, au cours du moment. C'est une cession : on vend
  // un peu plus de métal pour couvrir l'impôt, le commerçant reçoit le montant exact.
  const metal = card.fundingMetal;
  const grams = gramsForNet(account, metal, amount, prices[metal], 0, now);
  const tax = saleTax(account, metal, grams, grams * prices[metal], now);
  return apply(account, kind, { [metal]: -grams }, amount, label, now, 0, tax);
}

/** Paiement chez un commerçant : le métal choisi est vendu au cours du moment, sans frais. */
export function cardPay(account: Account, prices: Prices, merchant: string, amount: number, now = new Date()): Account {
  const name = merchant.trim() || 'Commerçant';
  return cardDebit(account, prices, 'card_payment', amount, `Carte · ${name}`, now);
}

/** Retrait au distributeur : le métal choisi est vendu au cours du moment, sans frais. */
export function cardWithdraw(account: Account, prices: Prices, amount: number, now = new Date()): Account {
  return cardDebit(account, prices, 'card_withdrawal', amount, 'Carte · Retrait au distributeur', now);
}
