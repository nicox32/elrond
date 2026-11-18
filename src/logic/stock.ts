// Société Orvia : stock de lingotins et de pièces. Les lots sont créés par quantité (x1, x10, x100…) ; un retrait
// client prend d'abord dans le stock de la société, puis dans le coffre professionnel, sinon il faut commander.
import { LedgerError, newId } from './ledger.ts';
import { newRef, normalizeSerial, physicalFeesOf, productOf, serialFormatError } from './physical.ts';
import type { Account, StockLot, StockMove } from './types.ts';

export const MAX_BATCH = 10000;
const LOG_LIMIT = 500;
const key = (s: string) => s.replace(/[\s\-_.]/g, '').toUpperCase();

export interface StockInput {
  product: string;
  qty: number;
  source: 'maison' | 'pro';
  vault?: string;
  unitCost?: number;
  /** Cours de l'or (€/g) au moment de l'achat du lot. */
  goldPrice?: number;
  /** Numéros de série connus, un par exemplaire au plus (les autres seront notés à l'expédition). */
  serials?: string[];
  note?: string;
}

/** Sépare une liste de numéros collée (un par ligne, ou séparés par des espaces ou des virgules). */
export function parseSerials(text: string): string[] {
  return text
    .split(/[\n\r,;]+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

/** Tous les numéros de série déjà connus : lingots du coffre maison et numéros en attente dans le stock. */
function knownSerials(account: Account): Set<string> {
  const set = new Set<string>();
  for (const b of account.homeVault ?? []) {
    if (b.serial) set.add(key(b.serial));
    if (b.expectedSerial) set.add(key(b.expectedSerial));
  }
  for (const l of account.stock ?? []) for (const s of l.serials ?? []) set.add(key(s));
  return set;
}

function pushLog(account: Account, move: StockMove): StockMove[] {
  return [move, ...(account.stockLog ?? [])].slice(0, LOG_LIMIT);
}

/** Entre un lot en stock : plusieurs exemplaires d'un même format, au même endroit. */
export function addStock(
  account: Account,
  input: StockInput,
  now = new Date(),
  random: () => number = Math.random,
): Account {
  const product = productOf(input.product);
  if (!Number.isInteger(input.qty) || input.qty < 1 || input.qty > MAX_BATCH) {
    throw new LedgerError(`La quantité doit être un nombre entier entre 1 et ${MAX_BATCH}.`);
  }
  if (input.unitCost !== undefined && !(input.unitCost >= 0)) throw new LedgerError('Prix payé invalide.');
  const serials: string[] = [];
  if (input.serials?.length) {
    if (input.serials.length > input.qty) {
      throw new LedgerError(`${input.serials.length} numéros pour ${input.qty} exemplaire(s) : il y en a trop.`);
    }
    const taken = knownSerials(account);
    for (const raw of input.serials) {
      const s = normalizeSerial(product.id, raw);
      const err = serialFormatError(product.id, s);
      if (err) throw new LedgerError(`${raw} : ${err}`);
      // Pour une pièce, le millésime se répète : seuls les lingots ont un numéro unique.
      if (!product.coin) {
        if (taken.has(key(s))) throw new LedgerError(`Le numéro ${s} est déjà dans la base.`);
        taken.add(key(s));
      }
      serials.push(s);
    }
  }
  // Une référence interne aléatoire par exemplaire : jamais une suite, jamais le numéro gravé de l'affinerie.
  const taken = new Set<string>([
    ...(account.homeVault ?? []).flatMap((b) => (b.ref ? [b.ref] : [])),
    ...(account.stock ?? []).flatMap((l) => l.refs ?? []),
  ]);
  const refs = Array.from({ length: input.qty }, () => newRef(taken, random));
  const lot: StockLot = {
    id: newId(),
    product: product.id,
    source: input.source,
    qty: input.qty,
    qtyInitial: input.qty,
    addedAt: now.toISOString(),
    ...(input.source === 'pro' && input.vault?.trim() ? { vault: input.vault.trim() } : {}),
    ...(input.unitCost !== undefined && Number.isFinite(input.unitCost) ? { unitCost: input.unitCost } : {}),
    ...(input.goldPrice !== undefined && input.goldPrice > 0 ? { goldPriceAtEntry: input.goldPrice } : {}),
    ...(serials.length ? { serials } : {}),
    refs,
    ...(input.note?.trim() ? { note: input.note.trim() } : {}),
  };
  const move: StockMove = {
    id: newId(),
    date: now.toISOString(),
    kind: 'in',
    product: product.id,
    qty: input.qty,
    source: input.source,
    lotId: lot.id,
    note: input.note?.trim() || undefined,
  };
  return { ...account, stock: [...(account.stock ?? []), lot], stockLog: pushLog(account, move) };
}

/** Inventaire : on compte ce qu'il y a vraiment dans un lot, l'écart est noté au journal. */
export function adjustStock(account: Account, lotId: string, counted: number, now = new Date()): Account {
  const lot = (account.stock ?? []).find((l) => l.id === lotId);
  if (!lot) throw new LedgerError('Lot introuvable.');
  if (!Number.isInteger(counted) || counted < 0 || counted > MAX_BATCH) {
    throw new LedgerError('Indiquez le nombre d’exemplaires comptés (un nombre entier).');
  }
  const diff = counted - lot.qty;
  if (diff === 0) return account;
  const serials = lot.serials && lot.serials.length > counted ? lot.serials.slice(0, counted) : lot.serials;
  const refs = lot.refs && lot.refs.length > counted ? lot.refs.slice(0, counted) : lot.refs;
  const move: StockMove = {
    id: newId(),
    date: now.toISOString(),
    kind: 'adjust',
    product: lot.product,
    qty: diff,
    source: lot.source,
    lotId: lot.id,
    note: `Inventaire : ${counted} compté${counted > 1 ? 's' : ''}, ${lot.qty} attendu${lot.qty > 1 ? 's' : ''}`,
  };
  return {
    ...account,
    stock: (account.stock ?? []).map((l) =>
      l.id === lotId ? { ...l, qty: counted, ...(serials ? { serials } : {}), ...(refs ? { refs } : {}) } : l,
    ),
    stockLog: pushLog(account, move),
  };
}

/**
 * Ajoute à un lot déjà créé les numéros de série envoyés par le revendeur (liste collée). Ils sortent dans l'ordre
 * avec les exemplaires du lot : le numéro prévu est alors déjà dans la fiche quand le lingotin arrive.
 */
export function addSerialsToLot(account: Account, lotId: string, serials: string[]): Account {
  const lot = (account.stock ?? []).find((l) => l.id === lotId);
  if (!lot) throw new LedgerError('Lot introuvable.');
  const product = productOf(lot.product);
  const known = lot.serials ?? [];
  if (!serials.length) throw new LedgerError('Collez au moins un numéro.');
  if (known.length + serials.length > lot.qty) {
    throw new LedgerError(
      `Ce lot n’a plus que ${lot.qty} exemplaire${lot.qty > 1 ? 's' : ''} pour ${known.length + serials.length} numéros.`,
    );
  }
  const taken = knownSerials(account);
  const added: string[] = [];
  for (const raw of serials) {
    const s = normalizeSerial(product.id, raw);
    const err = serialFormatError(product.id, s);
    if (err) throw new LedgerError(`${raw} : ${err}`);
    if (!product.coin) {
      if (taken.has(key(s))) throw new LedgerError(`Le numéro ${s} est déjà dans la base.`);
      taken.add(key(s));
    }
    added.push(s);
  }
  return {
    ...account,
    stock: (account.stock ?? []).map((l) => (l.id === lotId ? { ...l, serials: [...known, ...added] } : l)),
  };
}

/** Supprime un lot vide ou entré par erreur. */
export function removeLot(account: Account, lotId: string, now = new Date()): Account {
  const lot = (account.stock ?? []).find((l) => l.id === lotId);
  if (!lot) return account;
  // Un lot supprimé avec des exemplaires restants laisse une trace au journal.
  const log =
    lot.qty > 0
      ? pushLog(account, {
          id: newId(),
          date: now.toISOString(),
          kind: 'adjust',
          product: lot.product,
          qty: -lot.qty,
          source: lot.source,
          lotId: lot.id,
          note: 'Lot supprimé',
        })
      : account.stockLog;
  return { ...account, stock: (account.stock ?? []).filter((l) => l.id !== lotId), stockLog: log };
}

/** Efface tout le stock et son journal (remise à zéro, par exemple après des essais). */
export function clearStock(account: Account): Account {
  const { stock: _stock, stockLog: _log, ...rest } = account;
  return rest as Account;
}

export interface StockSummaryRow {
  product: string;
  maison: number;
  pro: number;
  total: number;
  /** Numéros de série connus restants. */
  serials: number;
}

/** Exemplaires en stock par format. */
export function stockSummary(account: Pick<Account, 'stock'>): StockSummaryRow[] {
  const rows = new Map<string, StockSummaryRow>();
  for (const l of account.stock ?? []) {
    const r = rows.get(l.product) ?? { product: l.product, maison: 0, pro: 0, total: 0, serials: 0 };
    r[l.source] += l.qty;
    r.total += l.qty;
    r.serials += l.serials?.length ?? 0;
    rows.set(l.product, r);
  }
  return [...rows.values()];
}

/** Exemplaires disponibles d'un format (chez la société, et en coffre professionnel). */
export function stockCount(account: Pick<Account, 'stock'>, product: string): { maison: number; pro: number } {
  const r = stockSummary(account).find((x) => x.product === product);
  return { maison: r?.maison ?? 0, pro: r?.pro ?? 0 };
}

/** Plafond par défaut de l'assurance du stock de lingotins et de pièces. */
export const INSURANCE_CAP_EUR = 250_000;

/**
 * Valeur assurée du stock : chaque exemplaire à son prix payé quand il est connu, sinon la valeur de son or au cours du
 * jour plus la prime de base du revendeur.
 */
export function stockInsuredValue(account: Pick<Account, 'stock' | 'settings'>, goldEurPerGram: number): number {
  const fees = physicalFeesOf(account.settings);
  return (account.stock ?? [])
    .filter((l) => l.qty > 0)
    .reduce((s, l) => {
      const p = productOf(l.product);
      const unit = l.unitCost ?? p.grams * goldEurPerGram * (1 + (fees.vendor[l.product] ?? 0));
      return s + l.qty * unit;
    }, 0);
}

export function insuranceStatus(account: Pick<Account, 'stock' | 'settings'>, goldEurPerGram: number) {
  const cap = account.settings.insuranceCapEur ?? INSURANCE_CAP_EUR;
  const value = stockInsuredValue(account, goldEurPerGram);
  return { cap, value, left: Math.max(0, cap - value), share: cap > 0 ? value / cap : 1 };
}

/** Refuse l'entrée d'un lot qui ferait dépasser le plafond de l'assurance. */
export function assertInsuranceRoom(
  account: Pick<Account, 'stock' | 'settings'>,
  goldEurPerGram: number,
  addedEur: number,
): void {
  const st = insuranceStatus(account, goldEurPerGram);
  if (st.value + addedEur > st.cap + 0.005) {
    const eur = (n: number) => Math.round(n).toLocaleString('fr-FR');
    throw new LedgerError(
      `Ce lot (${eur(addedEur)} €) dépasse le plafond de l’assurance : ${eur(st.value)} € en stock sur ${eur(st.cap)} €. Il reste ${eur(st.left)} € de place.`,
    );
  }
}
