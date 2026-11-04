/**
 * Bot d'achat sur baisse, en plus de l'achat régulier : pour chaque métal, achat si le cours passe sous un prix
 * fixe (€/g) OU tombe d'au moins X % sous sa moyenne des 30 derniers jours ; achat double si la baisse est forte.
 * Garde-fous : un achat de baisse par métal sur 7 jours glissants, et un plafond mensuel pour ces achats.
 * Les prix fixes sont remis à jour chaque mois d'après la moyenne 30 jours.
 */
import { buy, LedgerError, METAL_LABEL } from './ledger.ts';
import type { PricePoint } from './priceHistory.ts';
import { type Account, type Prices, SPOT_METALS, type SpotMetal } from './types.ts';

export interface DipRule {
  enabled: boolean;
  /** Achat si le cours est au moins X % sous la moyenne 30 jours. */
  avgDropPct: number;
  /** Baisse forte (achat double) : au moins X % sous la moyenne 30 jours. */
  strongDropPct: number;
  /** Achat si le cours passe sous ce prix (€/g). */
  fixedPrice: number;
  /** Écart du prix fixe sous la moyenne 30 jours, appliqué à chaque mise à jour mensuelle. */
  fixedGapPct: number;
}

export interface DipBot {
  active: boolean;
  /** Montant d'un achat de baisse (€) ; le double en baisse forte. */
  amount: number;
  /** Plafond des achats de baisse par mois (€), tous métaux. */
  monthlyCap: number;
  source: 'cash' | 'card';
  rules: Record<SpotMetal, DipRule>;
  /** Date de démarrage (pour la comparaison avec l'achat régulier). */
  startedAt: string;
  /** Dernière mise à jour des prix fixes. */
  fixedUpdatedAt: string;
  /** Dernier achat de baisse par métal. */
  lastBuyAt: Partial<Record<SpotMetal, string>>;
  /** Dernier achat impossible signalé (par métal), pour ne pas prévenir en boucle. */
  lastSkipAt?: Partial<Record<SpotMetal, string>>;
}

export const DIP_LIMITS = {
  weekMs: 7 * 86_400_000,
  refreshMs: 30 * 86_400_000,
  /** Jours d'historique nécessaires pour une moyenne 30 jours fiable. */
  minHistoryDays: 20,
} as const;

export function newDipBot(now = new Date()): DipBot {
  return {
    active: true,
    amount: 25,
    monthlyCap: 216,
    source: 'cash',
    rules: {
      gold: { enabled: true, avgDropPct: 5, strongDropPct: 10, fixedPrice: 108, fixedGapPct: 7 },
      silver: { enabled: true, avgDropPct: 8, strongDropPct: 15, fixedPrice: 1.35, fixedGapPct: 10 },
      platinum: { enabled: true, avgDropPct: 7, strongDropPct: 10, fixedPrice: 38, fixedGapPct: 10 },
    },
    startedAt: now.toISOString(),
    fixedUpdatedAt: now.toISOString(),
    lastBuyAt: {},
  };
}

/** Moyenne 30 jours, seulement si l'historique couvre au moins 20 jours. */
export function dipAverage(history: PricePoint[], metal: SpotMetal, now = new Date()): number | null {
  const t = now.getTime();
  const pts = history.filter((p) => {
    const x = new Date(p.t).getTime();
    return x >= t - 30 * 86_400_000 && x <= t;
  });
  if (pts.length < 2) return null;
  const covered = (t - new Date(pts[0].t).getTime()) / 86_400_000;
  if (covered < DIP_LIMITS.minHistoryDays) return null;
  return pts.reduce((s, p) => s + p.prices[metal], 0) / pts.length;
}

/** Jours d'historique encore nécessaires avant que la moyenne 30 jours compte. */
export function daysUntilAverage(history: PricePoint[], now = new Date()): number {
  const first = history[0] ? new Date(history[0].t).getTime() : now.getTime();
  return Math.max(0, Math.ceil(DIP_LIMITS.minHistoryDays - (now.getTime() - first) / 86_400_000));
}

const round = (n: number, metal: SpotMetal) =>
  metal === 'silver' ? Math.round(n * 100) / 100 : Math.round(n * 10) / 10;

export type DipSignal = { kind: 'none' | 'fixed' | 'avg' | 'strong'; dropPct: number | null; avg: number | null };

/** Signal pour un métal : baisse forte, baisse vs moyenne, prix fixe franchi, ou rien. */
export function dipSignal(rule: DipRule, price: number, avg: number | null): DipSignal {
  const dropPct = avg ? ((avg - price) / avg) * 100 : null;
  if (dropPct !== null && dropPct >= rule.strongDropPct) return { kind: 'strong', dropPct, avg };
  if (dropPct !== null && dropPct >= rule.avgDropPct) return { kind: 'avg', dropPct, avg };
  if (price < rule.fixedPrice) return { kind: 'fixed', dropPct, avg };
  return { kind: 'none', dropPct, avg };
}

/** Euros déjà dépensés en achats de baisse ce mois-ci (mois civil). */
export function dipSpentThisMonth(account: Pick<Account, 'transactions'>, now = new Date()): number {
  const y = now.getFullYear();
  const m = now.getMonth();
  return account.transactions
    .filter((t) => t.dip && new Date(t.date).getFullYear() === y && new Date(t.date).getMonth() === m)
    .reduce((s, t) => s + t.eur, 0);
}

/** Remet les prix fixes à jour (tous les 30 jours) : moyenne 30 jours moins l'écart choisi. */
export function refreshFixedPrices(bot: DipBot, history: PricePoint[], now = new Date()): DipBot {
  if (now.getTime() - new Date(bot.fixedUpdatedAt).getTime() < DIP_LIMITS.refreshMs) return bot;
  const rules = { ...bot.rules };
  let changed = false;
  for (const m of SPOT_METALS) {
    const avg = dipAverage(history, m, now);
    if (avg === null) continue;
    rules[m] = { ...rules[m], fixedPrice: round(avg * (1 - rules[m].fixedGapPct / 100), m) };
    changed = true;
  }
  return changed ? { ...bot, rules, fixedUpdatedAt: now.toISOString() } : bot;
}

export interface DipNotice {
  title: string;
  body: string;
}

const NAME = (m: SpotMetal) => (m === 'gold' ? METAL_LABEL.gold : METAL_LABEL[m].toLowerCase());
const eur = (n: number) => `${n.toFixed(2).replace('.', ',')} €`;

/** Passage du bot : met à jour les prix fixes si besoin, puis achète sur les métaux en baisse. */
export function runDipBot(
  account: Account,
  prices: Prices,
  history: PricePoint[],
  now = new Date(),
): { account: Account; notices: DipNotice[] } {
  const start = account.dipBot;
  if (!start?.active) return { account, notices: [] };
  const notices: DipNotice[] = [];
  let bot = refreshFixedPrices(start, history, now);
  if (bot !== start) {
    notices.push({
      title: 'Bot d’achat : prix fixes mis à jour',
      body: SPOT_METALS.map((m) => `${NAME(m)} sous ${eur(bot.rules[m].fixedPrice)}/g`).join(' · '),
    });
  }
  let acc: Account = { ...account, dipBot: bot };
  for (const m of SPOT_METALS) {
    const rule = bot.rules[m];
    if (!rule.enabled) continue;
    const last = bot.lastBuyAt[m];
    if (last && now.getTime() - new Date(last).getTime() < DIP_LIMITS.weekMs) continue;
    const signal = dipSignal(rule, prices[m], dipAverage(history, m, now));
    if (signal.kind === 'none') continue;
    const wanted = signal.kind === 'strong' ? bot.amount * 2 : bot.amount;
    const left = Math.floor((bot.monthlyCap - dipSpentThisMonth(acc, now)) * 100) / 100;
    const amount = Math.min(wanted, left);
    if (amount < 5) continue; // plafond du mois atteint
    const why =
      signal.kind === 'fixed'
        ? `sous ${eur(rule.fixedPrice)}/g`
        : `${signal.dropPct!.toFixed(1).replace('.', ',')} % sous sa moyenne 30 jours`;
    try {
      const before = acc.transactions.length;
      acc = buy(acc, prices, m, { unit: 'eur', value: amount }, now, bot.source);
      const added = acc.transactions.length - before;
      acc = {
        ...acc,
        transactions: acc.transactions.map((t, i) =>
          i < added && t.kind === 'buy'
            ? { ...t, dip: signal.kind === 'strong' ? 'strong' : 'normal', label: `${t.label} · achat sur baisse` }
            : t,
        ),
      };
      bot = { ...bot, lastBuyAt: { ...bot.lastBuyAt, [m]: now.toISOString() } };
      acc = { ...acc, dipBot: bot };
      notices.push({
        title: `Achat sur baisse : ${NAME(m)}${signal.kind === 'strong' ? ' (baisse forte, achat double)' : ''}`,
        body: `${eur(amount)} achetés à ${eur(prices[m])}/g, ${why}.`,
      });
    } catch (e) {
      const lastSkip = bot.lastSkipAt?.[m];
      if (!lastSkip || now.getTime() - new Date(lastSkip).getTime() > 86_400_000) {
        bot = { ...bot, lastSkipAt: { ...bot.lastSkipAt, [m]: now.toISOString() } };
        acc = { ...acc, dipBot: bot };
        notices.push({
          title: `Achat sur baisse impossible : ${NAME(m)}`,
          body: `${NAME(m)} ${why}, mais ${e instanceof LedgerError ? e.message.charAt(0).toLowerCase() + e.message.slice(1) : 'l’achat a échoué.'}`,
        });
      }
    }
  }
  return { account: acc, notices };
}

export interface DipComparison {
  metal: SpotMetal;
  dip: { grams: number; eur: number; perGram: number | null; count: number };
  regular: { grams: number; eur: number; perGram: number | null; count: number };
  /** Écart du prix payé par gramme : négatif = l'achat sur baisse paie moins cher. */
  diffPct: number | null;
}

/** Prix moyen payé par gramme (frais compris) depuis le démarrage du bot : achats de baisse vs autres achats. */
export function compareDip(account: Pick<Account, 'transactions'>, since: string): DipComparison[] {
  return SPOT_METALS.map((m) => {
    const acc = { dip: { grams: 0, eur: 0, count: 0 }, regular: { grams: 0, eur: 0, count: 0 } };
    for (const t of account.transactions) {
      if (t.kind !== 'buy' || t.date < since || !(t.deltas[m] > 0)) continue;
      const k = t.dip ? 'dip' : 'regular';
      acc[k].grams += t.deltas[m];
      acc[k].eur += t.eur;
      acc[k].count++;
    }
    const per = (x: { grams: number; eur: number }) => (x.grams > 0 ? x.eur / x.grams : null);
    const d = per(acc.dip);
    const r = per(acc.regular);
    return {
      metal: m,
      dip: { ...acc.dip, perGram: d },
      regular: { ...acc.regular, perGram: r },
      diffPct: d !== null && r !== null ? ((d - r) / r) * 100 : null,
    };
  });
}
