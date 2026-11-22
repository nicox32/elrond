/**
 * Simulateur d'une base de clients fictifs (Espace DEV) : des comptes d'essai achètent, vendent et retirent des
 * lingotins et des pièces aux cours en direct, avec les vraies règles de l'appli (frais, prix tout compris, stock,
 * blocage des formats à perte, assurance). Rien n'est lié au vrai compte : tout est fictif et reste en mémoire.
 */
import { companyReport } from './company.ts';
import { buy, createAccount, creditCash, LedgerError, sell } from './ledger.ts';
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

export type Profile = 'saver' | 'investor' | 'bars' | 'seller';

/** Opérations par jour et par client, selon le profil. */
const RATE_PER_DAY: Record<Profile, number> = { saver: 0.3, investor: 0.15, bars: 0.12, seller: 0.2 };

export interface SimEvent {
  at: string;
  text: string;
  kind: 'buy' | 'sell' | 'withdraw' | 'refused' | 'restock';
}

export interface SimClient {
  name: string;
  profile: Profile;
  account: Account;
}

export interface Simulation {
  seed: number;
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
    refused: number;
    restocks: number;
    boughtEur: number;
    soldEur: number;
    supplierEur: number;
  };
  peakInsuredEur: number;
  events: SimEvent[];
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
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

export function createSimulation(clients = 50, seed = 2026, now = new Date()): Simulation {
  const rng = mulberry32(seed);
  const list: SimClient[] = [];
  for (let i = 1; i <= clients; i++) {
    const profile = pick<Profile>(rng, [
      ['saver', 50],
      ['investor', 30],
      ['bars', 15],
      ['seller', 5],
    ]);
    const name = `Client ${String(i).padStart(3, '0')} (simulé)`;
    list.push({ name, profile, account: createAccount(name, now) });
  }
  return {
    seed,
    rng,
    now,
    startedAt: now,
    clients: list,
    company: createAccount('Société Orvia (simulée)', now),
    counters: {
      buys: 0,
      sells: 0,
      withdrawals: 0,
      refused: 0,
      restocks: 0,
      boughtEur: 0,
      soldEur: 0,
      supplierEur: 0,
    },
    peakInsuredEur: 0,
    events: [],
  };
}

function log(sim: Simulation, kind: SimEvent['kind'], text: string) {
  sim.events.unshift({ at: sim.now.toISOString(), kind, text });
  if (sim.events.length > 40) sim.events.length = 40;
}

/** Retrait physique d'un client, servi depuis le stock de la société quand il y en a. */
function withdraw(sim: Simulation, c: SimClient, prices: Prices) {
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
  const out = withdrawPhysical(tmp, prices, { [product]: qty }, sim.now);
  const { stock, stockLog, ...rest } = out;
  sim.company = { ...sim.company, stock, stockLog };
  c.account = rest as Account;
  sim.counters.withdrawals += 1;
  log(sim, 'withdraw', `${c.name} retire ${qty} × ${p.label.replace(/ \(.*/, '')}`);
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

function oneOperation(sim: Simulation, c: SimClient, prices: Prices) {
  const w: Record<Profile, [string, number][]> = {
    saver: [
      ['buy', 85],
      ['sell', 5],
      ['withdraw', 10],
    ],
    investor: [
      ['buy', 70],
      ['sell', 10],
      ['withdraw', 20],
    ],
    bars: [
      ['buy', 40],
      ['sell', 5],
      ['withdraw', 55],
    ],
    seller: [
      ['buy', 50],
      ['sell', 45],
      ['withdraw', 5],
    ],
  };
  const op = pick<string>(sim.rng, w[c.profile]);
  try {
    if (op === 'buy') {
      const big = c.profile === 'investor' || c.profile === 'bars';
      const amount = Math.round(big ? 200 + sim.rng() * 1800 : 30 + sim.rng() * 170);
      const metal = pick<Metal>(sim.rng, [
        ['gold', 70],
        ['silver', 20],
        ['platinum', 10],
      ]);
      c.account = buy(c.account, prices, metal, { unit: 'eur', value: amount }, sim.now);
      sim.counters.buys += 1;
      sim.counters.boughtEur += amount;
      log(
        sim,
        'buy',
        `${c.name} achète ${amount} € de ${metal === 'gold' ? 'or' : metal === 'silver' ? 'argent' : 'platine'}`,
      );
    } else if (op === 'sell') {
      const metal: Metal = c.account.holdings.gold > 0 ? 'gold' : c.account.holdings.silver > 0 ? 'silver' : 'platinum';
      const grams = Math.round(c.account.holdings[metal] * (0.1 + sim.rng() * 0.4) * 1000) / 1000;
      if (!(grams > 0)) return;
      const before = c.account.transactions.length;
      c.account = sell(c.account, prices, metal, { unit: 'g', value: grams }, 'deferred', sim.now);
      const eur = c.account.transactions.length > before ? c.account.transactions[0].eur : 0;
      sim.counters.sells += 1;
      sim.counters.soldEur += eur;
      log(
        sim,
        'sell',
        `${c.name} vend ${grams} g de ${metal === 'gold' ? 'or' : metal === 'silver' ? 'argent' : 'platine'}`,
      );
    } else {
      withdraw(sim, c, prices);
    }
  } catch (e) {
    if (!(e instanceof LedgerError)) throw e;
    sim.counters.refused += 1;
    log(sim, 'refused', `${c.name} : ${e.message}`);
  }
}

/** Fait avancer la simulation de `seconds` secondes (temps simulé) aux cours donnés. */
export function stepSimulation(sim: Simulation, prices: Prices, seconds: number): Simulation {
  sim.now = new Date(sim.now.getTime() + seconds * 1000);
  for (const c of sim.clients) {
    const p = (RATE_PER_DAY[c.profile] * seconds) / 86_400;
    if (sim.rng() < p) oneOperation(sim, c, prices);
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
    operations: sim.counters.buys + sim.counters.sells + sim.counters.withdrawals,
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
