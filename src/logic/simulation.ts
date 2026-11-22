/**
 * Simulateur d'une base de clients fictifs (Espace DEV) : des comptes d'essai achètent, vendent et retirent des
 * lingotins et des pièces aux cours en direct, avec les vraies règles de l'appli (frais, prix tout compris, stock,
 * blocage des formats à perte, assurance). Rien n'est lié au vrai compte : tout est fictif et reste en mémoire.
 */
import { companyReport } from './company.ts';
import { applyDormancy, buy, cardPay, createAccount, creditCash, issueCard, LedgerError, sell } from './ledger.ts';
import {
  BAR_PRODUCTS,
  lotUnitCost,
  minProfitableLot,
  physicalFeesOf,
  productOf,
  stockedPieces,
  withdrawPhysical,
} from './physical.ts';
import { addStock, assertInsuranceRoom, insuranceStatus } from './stock.ts';
import type { Account, Metal, Prices } from './types.ts';

/** Segments de clients (cible d'Orvia) : débancarisés, épargnants en métaux physiques, petits budgets, quotidiens. */
export type Profile = 'debank' | 'physical' | 'small' | 'daily';

export const SEGMENTS: Record<Profile, { label: string; ratePerDay: number }> = {
  debank: { label: 'Débancarisés', ratePerDay: 0.12 },
  physical: { label: 'Épargnants en métaux physiques', ratePerDay: 0.15 },
  small: { label: 'Petits budgets (dès 10 €)', ratePerDay: 0.5 },
  daily: { label: 'Quotidiens et voyageurs (carte)', ratePerDay: 1.2 },
};

/** Répartitions proposées de la base de clients, en pourcentage par segment. */
export const MIXES = {
  balanced: { label: 'Équilibré', mix: { debank: 20, physical: 25, small: 40, daily: 15 } },
  small: { label: 'Petits budgets', mix: { debank: 10, physical: 10, small: 70, daily: 10 } },
  physical: { label: 'Épargne physique', mix: { debank: 25, physical: 55, small: 15, daily: 5 } },
} as const;
export type MixId = keyof typeof MIXES;

/** Volatilité annuelle des cours simulés. */
const VOLATILITY: Record<Metal, number> = { gold: 0.15, silver: 0.28, platinum: 0.25 };

export interface SimEvent {
  at: string;
  text: string;
  kind: 'buy' | 'sell' | 'withdraw' | 'refused' | 'restock' | 'card';
}

export interface SimClient {
  name: string;
  profile: Profile;
  account: Account;
  /** Dernier jour simulé où la garde et l'oxydation ont été prélevées (AAAA-MM-JJ). */
  chargedDay?: string;
}

export interface Simulation {
  seed: number;
  mixId: MixId;
  /** « sim » : cours simulés (marche aléatoire autour du cours de départ) ; « live » : cours en direct. */
  priceMode: 'sim' | 'live';
  /** Cours utilisés par la simulation (simulés ou en direct). */
  prices: Prices | null;
  /** État du générateur aléatoire : permet d'enregistrer la simulation et de la reprendre à l'identique. */
  rngState: number;
  rng: () => number;
  now: Date;
  startedAt: Date;
  clients: SimClient[];
  /** Compte de la société : son stock de lingotins et de pièces. */
  company: Account;
  counters: {
    buys: number;
    sells: number;
    withdrawals: number;
    cards: number;
    cardEur: number;
    refused: number;
    restocks: number;
    boughtEur: number;
    soldEur: number;
    supplierEur: number;
  };
  peakInsuredEur: number;
  events: SimEvent[];
}

/** Générateur aléatoire (mulberry32) dont l'état vit dans la simulation, donc enregistrable. */
function rngOf(sim: { rngState: number }): () => number {
  return () => {
    sim.rngState = (sim.rngState + 0x6d2b79f5) >>> 0;
    let t = sim.rngState;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rng: () => number, items: [T, number][]): T {
  const total = items.reduce((s, [, w]) => s + w, 0);
  let x = rng() * total;
  for (const [item, w] of items) {
    x -= w;
    if (x <= 0) return item;
  }
  return items[items.length - 1][0];
}

/** Stock à garder par format : sous ce seuil, la société commande un lot. */
const RESTOCK: Record<string, { below: number; lot: number }> = {
  g5: { below: 3, lot: 10 },
  g10: { below: 3, lot: 10 },
  g20: { below: 2, lot: 10 },
  oz1: { below: 1, lot: 5 },
  nap20: { below: 3, lot: 20 },
};

export function createSimulation(
  clients = 50,
  seed = 2026,
  now = new Date(),
  options: { mix?: MixId; priceMode?: 'sim' | 'live' } = {},
): Simulation {
  const mixId = options.mix ?? 'balanced';
  const mix = MIXES[mixId].mix;
  const holder = { rngState: seed >>> 0 };
  const rng = rngOf(holder);
  const list: SimClient[] = [];
  for (let i = 1; i <= clients; i++) {
    const profile = pick<Profile>(
      rng,
      (Object.keys(mix) as Profile[]).map((k) => [k, mix[k]]),
    );
    const name = `Client ${String(i).padStart(3, '0')} (simulé)`;
    let account = createAccount(name, now);
    // Les quotidiens ont la carte Orvia, financée par leur or.
    if (profile === 'daily') account = issueCard(account, now);
    list.push({ name, profile, account });
  }
  const sim: Simulation = {
    seed,
    mixId,
    priceMode: options.priceMode ?? 'sim',
    prices: null,
    rngState: holder.rngState,
    rng,
    now,
    startedAt: now,
    clients: list,
    company: createAccount('Société Orvia (simulée)', now),
    counters: {
      buys: 0,
      sells: 0,
      withdrawals: 0,
      cards: 0,
      cardEur: 0,
      refused: 0,
      restocks: 0,
      boughtEur: 0,
      soldEur: 0,
      supplierEur: 0,
    },
    peakInsuredEur: 0,
    events: [],
  };
  // Le générateur doit écrire son état dans la simulation elle-même.
  holder.rngState = sim.rngState;
  sim.rng = rngOf(sim);
  return sim;
}

function log(sim: Simulation, kind: SimEvent['kind'], text: string) {
  sim.events.unshift({ at: sim.now.toISOString(), kind, text });
  if (sim.events.length > 40) sim.events.length = 40;
}

/** Retrait physique d'un client (à domicile ou en coffre sécurisé), servi depuis le stock de la société. */
function withdraw(sim: Simulation, c: SimClient, prices: Prices, vault: boolean) {
  const fees = physicalFeesOf();
  const product = pick<string>(sim.rng, [
    ['g10', 30],
    ['g5', 25],
    ['nap20', 20],
    ['oz1', 15],
    ['g20', 10],
  ]);
  const p = productOf(product);
  const qty = sim.rng() < 0.85 ? 1 : 2;
  const need = p.grams * qty;
  const f = fees.premiums[product] * p.grams * qty * prices.gold + 20;
  let a = c.account;
  if (a.holdings.gold < need + 1e-9) {
    a = buy(a, prices, 'gold', { unit: 'g', value: Math.ceil((need - a.holdings.gold + 0.5) * 10) / 10 }, sim.now);
  }
  a = creditCash(a, Math.ceil(f), 'transfer', sim.now);
  // Le stock appartient à la société : on le prête au compte du client le temps du retrait.
  const tmp: Account = { ...a, stock: sim.company.stock, stockLog: sim.company.stockLog };
  const out = withdrawPhysical(tmp, prices, { [product]: qty }, sim.now, undefined, vault);
  const { stock, stockLog, ...rest } = out;
  sim.company = { ...sim.company, stock, stockLog };
  c.account = rest as Account;
  sim.counters.withdrawals += 1;
  log(sim, 'withdraw', `${c.name} ${vault ? 'met en coffre' : 'retire'} ${qty} × ${p.label.replace(/ \(.*/, '')}`);
}

/** La société commande un lot quand le stock d'un format est bas, dans la limite de son assurance. */
function restock(sim: Simulation, prices: Prices) {
  const fees = physicalFeesOf();
  for (const p of BAR_PRODUCTS) {
    const rule = RESTOCK[p.id];
    if (!rule || stockedPieces(sim.company, p.id) >= rule.below) continue;
    const qty = Math.max(rule.lot, minProfitableLot(p.id, prices.gold, fees) ?? 1);
    const unit = lotUnitCost(p.id, qty, prices.gold, fees);
    try {
      assertInsuranceRoom(sim.company, prices.gold, qty * unit);
    } catch (e) {
      if (e instanceof LedgerError) {
        log(sim, 'refused', `Commande de ${qty} × ${p.label.replace(/ \(.*/, '')} reportée : assurance pleine`);
        continue;
      }
      throw e;
    }
    sim.company = addStock(
      sim.company,
      { product: p.id, qty, source: 'maison', unitCost: unit, goldPrice: prices.gold },
      sim.now,
      sim.rng,
    );
    sim.counters.restocks += 1;
    sim.counters.supplierEur += qty * unit;
    log(
      sim,
      'restock',
      `Commande Godot & Fils : ${qty} × ${p.label.replace(/ \(.*/, '')} à ${Math.round(unit)} € pièce`,
    );
  }
}

/** Ce que fait un client à chaque opération, selon son segment : [opération, poids]. */
const OPERATIONS: Record<Profile, [string, number][]> = {
  debank: [
    ['buy', 65],
    ['sell', 5],
    ['withdraw', 30],
  ],
  physical: [
    ['buy', 40],
    ['sell', 3],
    ['withdraw', 57],
  ],
  small: [['buy', 100]],
  daily: [
    ['card', 75],
    ['buy', 20],
    ['sell', 5],
  ],
};

/** Part des retraits mis en coffre sécurisé chez Godot & Fils, par segment. */
const VAULT_SHARE: Record<Profile, number> = { debank: 0.7, physical: 0.5, small: 0, daily: 0 };

const METAL_NAME: Record<Metal, string> = { gold: 'or', silver: 'argent', platinum: 'platine' };

function oneOperation(sim: Simulation, c: SimClient, prices: Prices) {
  const op = pick<string>(sim.rng, OPERATIONS[c.profile]);
  try {
    if (op === 'buy') {
      const amount = Math.round(
        c.profile === 'debank'
          ? 500 + sim.rng() * 4500
          : c.profile === 'physical'
            ? 100 + sim.rng() * 700
            : c.profile === 'small'
              ? 10 + sim.rng() * 50
              : 100 + sim.rng() * 200,
      );
      const metal =
        c.profile === 'daily'
          ? 'gold'
          : pick<Metal>(sim.rng, [
              ['gold', 70],
              ['silver', 20],
              ['platinum', 10],
            ]);
      c.account = buy(c.account, prices, metal, { unit: 'eur', value: amount }, sim.now);
      sim.counters.buys += 1;
      sim.counters.boughtEur += amount;
      log(sim, 'buy', `${c.name} achète ${amount} € de ${METAL_NAME[metal]}`);
    } else if (op === 'card') {
      const amount = Math.round((5 + sim.rng() * 75) * 100) / 100;
      // La carte vend de l'or : on en rachète un peu si le compte est vide.
      if (c.account.holdings.gold * prices.gold < amount * 1.2 + 5) {
        c.account = buy(c.account, prices, 'gold', { unit: 'eur', value: 200 }, sim.now);
        sim.counters.buys += 1;
        sim.counters.boughtEur += 200;
      }
      c.account = cardPay(c.account, prices, 'Commerce simulé', amount, sim.now);
      sim.counters.cards += 1;
      sim.counters.cardEur += amount;
      log(sim, 'card', `${c.name} paie ${amount.toLocaleString('fr-FR')} € par carte`);
    } else if (op === 'sell') {
      const metal: Metal = c.account.holdings.gold > 0 ? 'gold' : c.account.holdings.silver > 0 ? 'silver' : 'platinum';
      const grams = Math.round(c.account.holdings[metal] * (0.1 + sim.rng() * 0.4) * 1000) / 1000;
      if (!(grams > 0)) return;
      const before = c.account.transactions.length;
      c.account = sell(c.account, prices, metal, { unit: 'g', value: grams }, 'deferred', sim.now);
      const eur = c.account.transactions.length > before ? c.account.transactions[0].eur : 0;
      sim.counters.sells += 1;
      sim.counters.soldEur += eur;
      log(sim, 'sell', `${c.name} vend ${grams} g de ${METAL_NAME[metal]}`);
    } else {
      withdraw(sim, c, prices, sim.rng() < VAULT_SHARE[c.profile]);
    }
  } catch (e) {
    if (!(e instanceof LedgerError)) throw e;
    sim.counters.refused += 1;
    log(sim, 'refused', `${c.name} : ${e.message}`);
  }
}

/** Cours simulés : marche aléatoire log-normale de chaque métal autour du cours de départ. */
function walkPrices(sim: Simulation, live: Prices, seconds: number): Prices {
  if (sim.priceMode === 'live' || !sim.prices) {
    sim.prices = { ...live };
    return sim.prices;
  }
  const next = { ...sim.prices };
  for (const m of ['gold', 'silver', 'platinum'] as Metal[]) {
    const u1 = Math.max(sim.rng(), 1e-12);
    const u2 = sim.rng();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    const sigma = (VOLATILITY[m] * Math.sqrt(seconds)) / Math.sqrt(365 * 86_400);
    next[m] = Math.max(0.01, next[m] * Math.exp(sigma * z - (sigma * sigma) / 2));
  }
  sim.prices = next;
  return next;
}

const dayKey = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Fait avancer la simulation de `seconds` secondes (temps simulé). `live` : cours en direct, utilisés tels quels en
 * mode « live » et comme point de départ des cours simulés.
 */
export function stepSimulation(sim: Simulation, live: Prices, seconds: number): Simulation {
  sim.now = new Date(sim.now.getTime() + seconds * 1000);
  const prices = walkPrices(sim, live, seconds);
  const today = dayKey(sim.now);
  for (const c of sim.clients) {
    const p = (SEGMENTS[c.profile].ratePerDay * seconds) / 86_400;
    if (sim.rng() < p) oneOperation(sim, c, prices);
    // Une fois par jour simulé : garde en coffre, frais d'oxydation, garde des lingotins en coffre sécurisé.
    if (c.chargedDay !== today) {
      c.account = applyDormancy(c.account, prices, sim.now);
      c.chargedDay = today;
    }
  }
  restock(sim, prices);
  const insured = insuranceStatus(sim.company, prices.gold).value;
  if (insured > sim.peakInsuredEur) sim.peakInsuredEur = insured;
  return sim;
}

export interface SimSummary {
  clients: number;
  days: number;
  operations: number;
  revenue: { buy: number; sale: number; physical: number; custody: number; total: number };
  physicalCost: number;
  margin: number;
  assets: number;
  insured: number;
  insuranceCap: number;
  peakInsured: number;
}

/** Chiffres de la société d'après les opérations de tous les clients simulés. */
export function summarize(sim: Simulation, prices: Prices): SimSummary {
  const sum = { buy: 0, sale: 0, physical: 0, custody: 0, total: 0, cost: 0, margin: 0, assets: 0, ops: 0 };
  for (const c of sim.clients) {
    const r = companyReport(c.account, prices, 'all', sim.now);
    sum.buy += r.revenue.buy;
    sum.sale += r.revenue.sale;
    sum.physical += r.revenue.physical;
    sum.custody += r.revenue.custody;
    sum.total += r.revenue.total;
    sum.cost += r.costs.physical;
    sum.margin += r.margin;
    sum.assets += r.assets;
    sum.ops += r.operations;
  }
  const ins = insuranceStatus(sim.company, prices.gold);
  const r0 = (n: number) => Math.round(n * 100) / 100;
  return {
    clients: sim.clients.length,
    days: Math.max(0, Math.floor((sim.now.getTime() - sim.startedAt.getTime()) / 86_400_000)),
    operations: sim.counters.buys + sim.counters.sells + sim.counters.withdrawals + sim.counters.cards,
    revenue: {
      buy: r0(sum.buy),
      sale: r0(sum.sale),
      physical: r0(sum.physical),
      custody: r0(sum.custody),
      total: r0(sum.total),
    },
    physicalCost: r0(sum.cost),
    margin: r0(sum.margin),
    assets: r0(sum.assets),
    insured: r0(ins.value),
    insuranceCap: ins.cap,
    peakInsured: r0(sim.peakInsuredEur),
  };
}

/** Texte enregistrable de la simulation (le générateur aléatoire est reconstruit à la lecture). */
export function serializeSimulation(sim: Simulation, savedAt = new Date()): string {
  return JSON.stringify({ v: 2, savedAt: savedAt.toISOString(), sim });
}

/** Relit une simulation enregistrée, avec la date d'enregistrement ; null si le texte est abîmé. */
export function restoreSimulation(text: string | null): { sim: Simulation; savedAt: Date } | null {
  if (!text) return null;
  try {
    const d = JSON.parse(text);
    const s = d?.sim;
    if (d?.v !== 2 || !s || !Array.isArray(s.clients) || typeof s.rngState !== 'number' || !s.company) return null;
    const sim: Simulation = { ...s, now: new Date(s.now), startedAt: new Date(s.startedAt) };
    sim.rng = rngOf(sim);
    return { sim, savedAt: new Date(d.savedAt) };
  } catch {
    return null;
  }
}

/** Temps simulé rattrapé au maximum à chaque ouverture (la simulation « tourne » même appli fermée). */
export const MAX_CATCH_UP_DAYS = 90;

/**
 * Fait avancer la simulation du temps écoulé appli fermée, en temps réel, par pas d'une heure aux cours donnés.
 * Rend le nombre de secondes rattrapées (plafonné à 90 jours).
 */
export function catchUp(sim: Simulation, prices: Prices, elapsedSeconds: number): number {
  const total = Math.min(Math.max(0, elapsedSeconds), MAX_CATCH_UP_DAYS * 86_400);
  let left = total;
  while (left > 1e-9) {
    const dt = Math.min(3600, left);
    stepSimulation(sim, prices, dt);
    left -= dt;
  }
  return total;
}

export interface SegmentRow {
  segment: Profile;
  label: string;
  clients: number;
  operations: number;
  revenue: number;
  /** Coût des lingotins et de la garde, estimé. */
  costs: number;
  margin: number;
}

/** Revenus, coûts et résultat de chaque segment de clients. */
export function summarizeBySegment(sim: Simulation, prices: Prices): SegmentRow[] {
  const rows = new Map<Profile, SegmentRow>();
  for (const k of Object.keys(SEGMENTS) as Profile[]) {
    rows.set(k, { segment: k, label: SEGMENTS[k].label, clients: 0, operations: 0, revenue: 0, costs: 0, margin: 0 });
  }
  for (const c of sim.clients) {
    const r = companyReport(c.account, prices, 'all', sim.now);
    const row = rows.get(c.profile)!;
    row.clients += 1;
    row.operations += r.operations;
    row.revenue += r.revenue.total;
    row.costs += r.costs.total;
    row.margin += r.margin;
  }
  const r2 = (n: number) => Math.round(n * 100) / 100;
  return [...rows.values()]
    .filter((r) => r.clients > 0)
    .map((r) => ({ ...r, revenue: r2(r.revenue), costs: r2(r.costs), margin: r2(r.margin) }));
}
