/**
 * Simulation d'une grande population de clients fictifs (15 000), répartie par tranche de revenu d'après l'Insee
 * (salariés du privé, équivalent temps plein, net mensuel). Modèle agrégé : chaque client n'est que quelques nombres
 * (soldes en grammes, budget mensuel), les frais sont calculés avec les mêmes tarifs que l'appli, et la société
 * gère un stock de lingotins avec délai de livraison et plafond d'assurance. Un pas = une semaine.
 */
import { COMPANY } from './company.ts';
import { FEES } from './fees.ts';
import { priceAtDate } from './historyPrices.ts';
import { BAR_PRODUCTS, lotUnitCost, minProfitableLot, physicalFeesOf, PHYSICAL, sellableOnDemand } from './physical.ts';
import { INSURANCE_CAP_EUR } from './stock.ts';
import type { Metal, Prices } from './types.ts';

export type Segment = 'debank' | 'physical' | 'small' | 'daily';
const SEGMENTS: Segment[] = ['debank', 'physical', 'small', 'daily'];

export const SEGMENT_LABEL: Record<Segment, string> = {
  debank: 'Débancarisés',
  physical: 'Métaux physiques',
  small: 'Petits budgets',
  daily: 'Quotidiens (carte)',
};

/**
 * Tranches de revenu net mensuel, en multiples du SMIC net (≈ 1 492 €, le 1ᵉʳ décile). Parts des salariés du privé :
 * 10 % sous 1 SMIC ; la médiane (2 190 €) vaut ≈ 1,5 SMIC ; la moyenne (2 733 €) ≈ 1,9 SMIC ; 1 % gagne plus de 7 SMIC.
 * La part d'épargne et les segments sont des hypothèses du simulateur, pas des données de l'Insee.
 */
export const INCOME_BANDS = [
  {
    id: 'b0',
    label: 'Moins de 1 SMIC',
    share: 0.1,
    incomeEur: 1300,
    savingsRate: 0.03,
    metalShare: 0.4,
    segs: [2, 3, 55, 40],
  },
  {
    id: 'b1',
    label: '1 à 1,5 SMIC',
    share: 0.4,
    incomeEur: 1850,
    savingsRate: 0.05,
    metalShare: 0.4,
    segs: [7, 8, 50, 35],
  },
  {
    id: 'b2',
    label: '1,5 à 2 SMIC',
    share: 0.225,
    incomeEur: 2550,
    savingsRate: 0.07,
    metalShare: 0.4,
    segs: [15, 20, 40, 25],
  },
  {
    id: 'b3',
    label: '2 à 3 SMIC',
    share: 0.17,
    incomeEur: 3500,
    savingsRate: 0.1,
    metalShare: 0.4,
    segs: [30, 30, 25, 15],
  },
  {
    id: 'b4',
    label: '3 à 5 SMIC',
    share: 0.08,
    incomeEur: 5600,
    savingsRate: 0.12,
    metalShare: 0.45,
    segs: [45, 35, 10, 10],
  },
  {
    id: 'b5',
    label: '5 à 7 SMIC',
    share: 0.015,
    incomeEur: 8700,
    savingsRate: 0.15,
    metalShare: 0.5,
    segs: [50, 40, 5, 5],
  },
  {
    id: 'b6',
    label: 'Plus de 7 SMIC',
    share: 0.01,
    incomeEur: 14000,
    savingsRate: 0.18,
    metalShare: 0.5,
    segs: [60, 35, 2, 3],
  },
] as const;

/** Part des clients qui quittent Orvia chaque année, par segment. */
const CHURN: Record<Segment, number> = { debank: 0.06, physical: 0.08, small: 0.2, daily: 0.18 };
/** Part de retraits en coffre sécurisé chez Godot & Fils. */
const VAULT_SHARE: Record<Segment, number> = { debank: 0.7, physical: 0.5, small: 0, daily: 0 };

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

function poisson(rng: () => number, lambda: number): number {
  if (lambda <= 0) return 0;
  if (lambda > 30) return Math.max(0, Math.round(lambda + Math.sqrt(lambda) * gauss(rng)));
  const l = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= rng();
  } while (p > l);
  return k - 1;
}

function gauss(rng: () => number): number {
  const u1 = Math.max(rng(), 1e-12);
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * rng());
}

export interface PopOptions {
  clients?: number;
  seed?: number;
  /** Début de la simulation (cours historiques réels à cette date, si `prices` = « history »). */
  start: Date;
  /** Semaines sur lesquelles les clients arrivent (0 : tous dès le départ). */
  rampWeeks?: number;
  prices?: 'history' | Prices;
  /** Plafond de l'assurance du stock, en euros. */
  insuranceCap?: number;
}

interface FormatStock {
  qty: number;
  /** Coût moyen de prime payé au vendeur par pièce (hors or), livraison comprise. */
  premiumCost: number;
  /** Valeur assurée moyenne d'une pièce (prix payé au vendeur). */
  insuredEach: number;
  pending: { qty: number; arrivesWeek: number; premiumCost: number; insuredEach: number }[];
  /** Demande moyenne par semaine (moyenne mobile), pour dimensionner les commandes. */
  demand: number;
}

export interface PopPoint {
  week: number;
  date: string;
  clients: number;
  active: number;
  revenue: number;
  costs: number;
  assets: number;
  insured: number;
  gold: number;
}

export interface Population {
  n: number;
  rng: () => number;
  start: Date;
  week: number;
  rampWeeks: number;
  priceSource: 'history' | Prices;
  insuranceCap: number;
  band: Uint8Array;
  seg: Uint8Array;
  joinWeek: Uint16Array;
  active: Uint8Array;
  gold: Float64Array;
  silver: Float64Array;
  plat: Float64Array;
  /** Or des lingotins gardés en coffre sécurisé chez Godot & Fils, en grammes. */
  vaultG: Float64Array;
  budget: Float64Array;
  stock: Record<string, FormatStock>;
  prices: Prices;
  totals: {
    revenue: { buy: number; bars: number; card: number; custody: number; vault: number };
    costs: { bars: number; kyc: number; custody: number; vault: number; fixed: number };
    withdrawals: number;
    stockouts: number;
    onDemandOrders: number;
    cardEur: number;
    boughtEur: number;
    churned: number;
    insuranceBlocked: number;
  };
  bySegment: Record<Segment, { clients: number; revenue: number; costs: number }>;
  byBand: { clients: number; revenue: number }[];
  peakInsured: number;
  series: PopPoint[];
}

/** Crée la population : tranche de revenu, segment et budget de chaque client. */
export function createPopulation(opts: PopOptions): Population {
  const n = opts.clients ?? 15_000;
  const rng = mulberry32(opts.seed ?? 2026);
  const band = new Uint8Array(n);
  const seg = new Uint8Array(n);
  const joinWeek = new Uint16Array(n);
  const budget = new Float64Array(n);
  const rampWeeks = Math.max(0, opts.rampWeeks ?? 0);
  for (let i = 0; i < n; i++) {
    let x = rng();
    let b = 0;
    for (; b < INCOME_BANDS.length - 1; b++) {
      x -= INCOME_BANDS[b].share;
      if (x <= 0) break;
    }
    band[i] = b;
    const w = INCOME_BANDS[b].segs;
    let y = rng() * w.reduce((a, c) => a + c, 0);
    let sIdx = 0;
    for (; sIdx < w.length - 1; sIdx++) {
      y -= w[sIdx];
      if (y <= 0) break;
    }
    seg[i] = sIdx;
    // Budget mensuel en métaux : revenu × taux d'épargne × part en métaux, avec une dispersion de ±30 %.
    const B = INCOME_BANDS[b];
    budget[i] = Math.max(10, B.incomeEur * B.savingsRate * B.metalShare * Math.exp(0.3 * gauss(rng) - 0.045));
    joinWeek[i] = rampWeeks > 0 ? Math.floor((i / Math.max(1, n - 1)) * rampWeeks) : 0;
  }
  const stock: Record<string, FormatStock> = {};
  for (const p of BAR_PRODUCTS) stock[p.id] = { qty: 0, premiumCost: 0, insuredEach: 0, pending: [], demand: 0 };
  const sg = () => ({ clients: 0, revenue: 0, costs: 0 });
  const pop: Population = {
    n,
    rng,
    start: opts.start,
    week: 0,
    rampWeeks,
    priceSource: opts.prices ?? 'history',
    insuranceCap: opts.insuranceCap ?? INSURANCE_CAP_EUR,
    band,
    seg,
    joinWeek,
    active: new Uint8Array(n),
    gold: new Float64Array(n),
    silver: new Float64Array(n),
    plat: new Float64Array(n),
    vaultG: new Float64Array(n),
    budget,
    stock,
    prices: { gold: 0, silver: 0, platinum: 0 },
    totals: {
      revenue: { buy: 0, bars: 0, card: 0, custody: 0, vault: 0 },
      costs: { bars: 0, kyc: 0, custody: 0, vault: 0, fixed: 0 },
      withdrawals: 0,
      stockouts: 0,
      onDemandOrders: 0,
      cardEur: 0,
      boughtEur: 0,
      churned: 0,
      insuranceBlocked: 0,
    },
    bySegment: { debank: sg(), physical: sg(), small: sg(), daily: sg() },
    byBand: INCOME_BANDS.map(() => ({ clients: 0, revenue: 0 })),
    peakInsured: 0,
    series: [],
  };
  return pop;
}

const dateOfWeek = (pop: Population, w: number) => new Date(pop.start.getTime() + w * 7 * 86_400_000);

/** Valeur assurée du stock : pièces en stock au prix payé au vendeur. */
function insuredValue(pop: Population): number {
  let v = 0;
  for (const k of Object.keys(pop.stock)) v += pop.stock[k].qty * pop.stock[k].insuredEach;
  return v;
}

function pendingValue(pop: Population): number {
  let v = 0;
  for (const k of Object.keys(pop.stock)) for (const o of pop.stock[k].pending) v += o.qty * o.insuredEach;
  return v;
}

const METALS3: Metal[] = ['gold', 'silver', 'platinum'];

/** Fait avancer la population d'une semaine. */
export function stepWeek(pop: Population): Population {
  const { rng } = pop;
  const w = pop.week;
  const date = dateOfWeek(pop, w);
  const prices = pop.priceSource === 'history' ? priceAtDate(date) : pop.priceSource;
  pop.prices = prices;
  const fees = physicalFeesOf();
  const rev = pop.totals.revenue;
  const cost = pop.totals.costs;
  const gP = prices.gold;

  // Arrivée des commandes de la société.
  for (const p of BAR_PRODUCTS) {
    const st = pop.stock[p.id];
    const due = st.pending.filter((o) => o.arrivesWeek <= w);
    if (!due.length) continue;
    st.pending = st.pending.filter((o) => o.arrivesWeek > w);
    for (const o of due) {
      const q0 = st.qty;
      st.qty += o.qty;
      st.premiumCost = (st.premiumCost * q0 + o.premiumCost * o.qty) / st.qty;
      st.insuredEach = (st.insuredEach * q0 + o.insuredEach * o.qty) / st.qty;
    }
  }

  const weeklyChurn = SEGMENTS.map((k) => 1 - Math.pow(1 - CHURN[k], 1 / 52));
  const demand: Record<string, number> = {};
  for (const p of BAR_PRODUCTS) demand[p.id] = 0;
  let active = 0;
  let joined = 0;
  let assetsEur = 0;
  let goldGrams = 0;
  let silverGrams = 0;
  let platGrams = 0;
  let vaultGrams = 0;
  const onDemandOk: Record<string, boolean> = {};
  for (const p of BAR_PRODUCTS) onDemandOk[p.id] = sellableOnDemand(p.id, gP, fees);

  for (let i = 0; i < pop.n; i++) {
    if (pop.joinWeek[i] > w) continue;
    joined++;
    const s = pop.seg[i];
    const segKey = SEGMENTS[s];
    const bi = pop.band[i];
    if (pop.joinWeek[i] === w) {
      pop.active[i] = 1;
      cost.kyc += COMPANY.kycPerAccount;
      pop.bySegment[segKey].clients++;
      pop.bySegment[segKey].costs += COMPANY.kycPerAccount;
      pop.byBand[bi].clients++;
    }
    if (pop.active[i]) {
      if (rng() < weeklyChurn[s]) {
        pop.active[i] = 0;
        pop.totals.churned++;
      } else {
        active++;
        const monthly = pop.budget[i];
        const buyEur = (amount: number, metal: Metal) => {
          if (amount < FEES.minOrder) return;
          const fee = amount * FEES.buy[metal];
          const grams = (amount - fee) / prices[metal];
          if (metal === 'gold') pop.gold[i] += grams;
          else if (metal === 'silver') pop.silver[i] += grams;
          else pop.plat[i] += grams;
          rev.buy += fee;
          pop.bySegment[segKey].revenue += fee;
          pop.byBand[bi].revenue += fee;
          pop.totals.boughtEur += amount;
        };
        const pickMetal = (): Metal => {
          const x = rng();
          return x < 0.75 ? 'gold' : x < 0.92 ? 'silver' : 'platinum';
        };
        // Retrait de lingotins ou de pièces pour une valeur voulue d'or.
        const withdrawBars = (wantedEur: number) => {
          const usable = pop.gold[i] * gP;
          const target = Math.min(wantedEur, usable);
          const choices = BAR_PRODUCTS.filter((p) => p.grams * gP <= target);
          if (!choices.length) return;
          const p = choices[Math.floor(rng() * choices.length)];
          const value = p.grams * gP;
          const nPieces = Math.max(1, Math.min(3, Math.floor(target / value)));
          for (let k = 0; k < nPieces; k++) {
            const st = pop.stock[p.id];
            demand[p.id] += 1;
            let pc: number;
            if (st.qty > 0) {
              st.qty -= 1;
              pc = st.premiumCost;
            } else if (onDemandOk[p.id]) {
              // Commandée à l'unité à Godot & Fils, au prix de 1 à 9 pièces, livraison comprise.
              pc = lotUnitCost(p.id, 1, gP, fees) - value + PHYSICAL.vendorDelivery;
              pop.totals.onDemandOrders++;
            } else {
              pop.totals.stockouts++;
              continue;
            }
            const price = value * fees.premiums[p.id];
            pop.gold[i] -= p.grams;
            rev.bars += price;
            cost.bars += pc;
            pop.totals.withdrawals++;
            pop.bySegment[segKey].revenue += price;
            pop.bySegment[segKey].costs += pc;
            pop.byBand[bi].revenue += price;
            if (rng() < VAULT_SHARE[segKey]) pop.vaultG[i] += p.grams;
          }
        };
        if (segKey === 'small') {
          // Achat programmé chaque semaine, dès 10 €.
          buyEur(((monthly * 12) / 52) * Math.exp(0.25 * gauss(rng) - 0.03), pickMetal());
        } else if (segKey === 'daily') {
          // Paiements par carte (vente d'or sans frais, commission du commerçant) financés par un achat hebdomadaire.
          const spendWeek = (monthly * 12) / 52;
          const n = poisson(rng, 3.5);
          let spent = 0;
          for (let k = 0; k < n; k++) {
            const e = (spendWeek / 3.5) * (0.6 + rng() * 0.8);
            const g = e / gP;
            if (pop.gold[i] >= g) {
              pop.gold[i] -= g;
              spent += e;
            }
          }
          rev.card += spent * COMPANY.interchange;
          pop.bySegment[segKey].revenue += spent * COMPANY.interchange;
          pop.byBand[bi].revenue += spent * COMPANY.interchange;
          pop.totals.cardEur += spent;
          buyEur(spendWeek * 1.05, 'gold');
        } else if (segKey === 'physical') {
          buyEur((monthly * 12) / 52, pickMetal());
          if (rng() < 0.035) withdrawBars(pop.gold[i] * gP * (0.3 + rng() * 0.5));
        } else {
          // Débancarisés : achats groupés, tous les deux mois en moyenne.
          if (rng() < 1 / 8) buyEur(monthly * 8 * (0.6 + rng() * 0.8), pickMetal());
          if (rng() < 0.03) withdrawBars(pop.gold[i] * gP * (0.4 + rng() * 0.5));
        }
        // Revente occasionnelle d'un peu d'or.
        if (rng() < 0.004) pop.gold[i] *= 0.8;
      }
    }
    goldGrams += pop.gold[i];
    silverGrams += pop.silver[i];
    platGrams += pop.plat[i];
    vaultGrams += pop.vaultG[i];
  }
  assetsEur = goldGrams * prices.gold + silverGrams * prices.silver + platGrams * prices.platinum;

  // Garde hebdomadaire : recette des clients, coût chez Godot & Fils ; lingotins en coffre sécurisé refacturés au coût.
  rev.custody +=
    (goldGrams * prices.gold * FEES.custodyYearly.gold +
      silverGrams * prices.silver * FEES.custodyYearly.silver +
      platGrams * prices.platinum * FEES.custodyYearly.platinum) /
    52;
  cost.custody +=
    (goldGrams * (COMPANY.custodyPerGramYear.gold ?? 0) +
      silverGrams * (COMPANY.custodyPerGramYear.silver ?? 0) +
      platGrams * prices.platinum * COMPANY.custodyYearly.platinum) /
    52;
  rev.vault += (vaultGrams * FEES.vaultPerGramYear) / 52;
  cost.vault += (vaultGrams * FEES.vaultPerGramYear) / 52;
  cost.fixed += COMPANY.fixedYearly / 52;

  // Commandes de la société : stock visé = quelques semaines de demande, par lots rentables, dans l'assurance.
  for (const p of BAR_PRODUCTS) {
    const st = pop.stock[p.id];
    st.demand = st.demand * 0.8 + demand[p.id] * 0.2;
    const inTransit = st.pending.reduce((a, o) => a + o.qty, 0);
    const target = Math.max(3, Math.ceil(st.demand * 3));
    if (st.qty + inTransit >= Math.ceil(target * 0.6)) continue;
    const minLot = minProfitableLot(p.id, gP, fees) ?? 1;
    const qty = Math.max(minLot, 10, target - st.qty - inTransit);
    const unit = lotUnitCost(p.id, qty, gP, fees);
    if (insuredValue(pop) + pendingValue(pop) + qty * unit > pop.insuranceCap) {
      pop.totals.insuranceBlocked++;
      continue;
    }
    const value = p.grams * gP;
    st.pending.push({
      qty,
      arrivesWeek: w + Math.ceil(fees.leadDays.commande / 7),
      premiumCost: Math.max(0, unit - value) + PHYSICAL.vendorDelivery / qty,
      insuredEach: unit,
    });
  }

  const insured = insuredValue(pop);
  if (insured > pop.peakInsured) pop.peakInsured = insured;
  // Un point par mois : pour suivre la montée du résultat.
  if (w % 4 === 0) {
    const revenue = rev.buy + rev.bars + rev.card + rev.custody + rev.vault;
    const costs = cost.bars + cost.kyc + cost.custody + cost.vault + cost.fixed;
    pop.series.push({
      week: w,
      date: date.toISOString().slice(0, 10),
      clients: joined,
      active,
      revenue: Math.round(revenue),
      costs: Math.round(costs),
      assets: Math.round(assetsEur),
      insured: Math.round(insured),
      gold: Math.round(prices.gold * 100) / 100,
    });
  }
  pop.week += 1;
  void METALS3;
  return pop;
}

export interface PopSummary {
  weeks: number;
  years: number;
  clients: number;
  active: number;
  revenue: Population['totals']['revenue'] & { total: number };
  costs: Population['totals']['costs'] & { total: number };
  /** Résultat avant frais fixes (revenus moins coûts variables). */
  contribution: number;
  /** Résultat après les frais fixes de la société. */
  result: number;
  assets: number;
  insured: number;
  peakInsured: number;
  insuranceCap: number;
  withdrawals: number;
  stockouts: number;
  onDemandOrders: number;
  insuranceBlocked: number;
  churned: number;
  goldStart: number;
  goldEnd: number;
  bySegment: { segment: Segment; label: string; clients: number; revenue: number; costs: number }[];
  byBand: { id: string; label: string; share: number; clients: number; revenue: number }[];
}

export function summarizePopulation(pop: Population): PopSummary {
  const r = pop.totals.revenue;
  const c = pop.totals.costs;
  const revenue = r.buy + r.bars + r.card + r.custody + r.vault;
  const costs = c.bars + c.kyc + c.custody + c.vault + c.fixed;
  let joined = 0;
  let active = 0;
  let g = 0;
  let s = 0;
  let p = 0;
  for (let i = 0; i < pop.n; i++) {
    if (pop.joinWeek[i] <= pop.week - 1) joined++;
    active += pop.active[i];
    g += pop.gold[i];
    s += pop.silver[i];
    p += pop.plat[i];
  }
  const r2 = (x: number) => Math.round(x * 100) / 100;
  const first = pop.series[0]?.gold ?? pop.prices.gold;
  return {
    weeks: pop.week,
    years: r2(pop.week / 52),
    clients: joined,
    active,
    revenue: { ...mapValues(r, r2), total: r2(revenue) },
    costs: { ...mapValues(c, r2), total: r2(costs) },
    contribution: r2(revenue - (costs - c.fixed)),
    result: r2(revenue - costs),
    assets: r2(g * pop.prices.gold + s * pop.prices.silver + p * pop.prices.platinum),
    insured: r2(insuredValue(pop)),
    peakInsured: r2(pop.peakInsured),
    insuranceCap: pop.insuranceCap,
    withdrawals: pop.totals.withdrawals,
    stockouts: pop.totals.stockouts,
    onDemandOrders: pop.totals.onDemandOrders,
    insuranceBlocked: pop.totals.insuranceBlocked,
    churned: pop.totals.churned,
    goldStart: first,
    goldEnd: Math.round(pop.prices.gold * 100) / 100,
    bySegment: SEGMENTS.map((k) => ({
      segment: k,
      label: SEGMENT_LABEL[k],
      clients: pop.bySegment[k].clients,
      revenue: r2(pop.bySegment[k].revenue),
      costs: r2(pop.bySegment[k].costs),
    })),
    byBand: INCOME_BANDS.map((b, i) => ({
      id: b.id,
      label: b.label,
      share: b.share,
      clients: pop.byBand[i].clients,
      revenue: r2(pop.byBand[i].revenue),
    })),
  };
}

function mapValues<T extends Record<string, number>>(o: T, f: (n: number) => number): T {
  return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, f(v)])) as T;
}

/** Simulation complète d'une durée donnée (sans écran). */
export function runPopulation(opts: PopOptions & { weeks: number }): { pop: Population; summary: PopSummary } {
  const pop = createPopulation(opts);
  for (let w = 0; w < opts.weeks; w++) stepWeek(pop);
  return { pop, summary: summarizePopulation(pop) };
}
