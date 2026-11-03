/**
 * Achats programmés : un montant fixe investi automatiquement, chaque semaine (réparti sur les jours choisis) ou
 * chaque mois, selon votre répartition. Les achats dus sont passés à l'ouverture de l'appli, pendant son utilisation
 * et en arrière-plan, au cours du moment.
 */
import { buySplit, type SplitMode, splitAmount, DEFAULT_ALLOCATION } from './allocation.ts';
import { LedgerError, type PaySource } from './ledger.ts';
import type { Account, Prices } from './types.ts';

export interface BuyPlan {
  active: boolean;
  /** Montant par semaine (hebdomadaire) ou par mois (mensuel), en euros. */
  amount: number;
  frequency: 'weekly' | 'monthly';
  /** Jours d'achat pour l'hebdomadaire (0 = dimanche … 6 = samedi) : le montant y est partagé. */
  days: number[];
  /** Jour du mois pour le mensuel (1 à 28). */
  dayOfMonth: number;
  source: PaySource;
  mode: SplitMode;
  /** Dernier passage : les achats prévus après cette date restent à faire. */
  lastRunAt: string;
  lastResult?: { at: string; done: number; skipped: number; message?: string };
}

export const PLAN_LIMITS = { min: 5, max: 5000, catchUpDays: 31, hour: 10 } as const;
export const WEEKDAYS = ['Dim.', 'Lun.', 'Mar.', 'Mer.', 'Jeu.', 'Ven.', 'Sam.'];

export function newPlan(now = new Date()): BuyPlan {
  return {
    active: true,
    amount: 25,
    frequency: 'weekly',
    days: [1, 3, 5, 0],
    dayOfMonth: 5,
    source: 'card',
    mode: 'target',
    lastRunAt: now.toISOString(),
  };
}

export function planError(plan: BuyPlan): string | null {
  if (!(plan.amount >= PLAN_LIMITS.min)) return `Montant minimum : ${PLAN_LIMITS.min} €.`;
  if (plan.amount > PLAN_LIMITS.max) return `Montant maximum : ${PLAN_LIMITS.max} €.`;
  if (plan.frequency === 'weekly' && plan.days.length === 0) return 'Choisissez au moins un jour.';
  if (plan.frequency === 'monthly' && !(plan.dayOfMonth >= 1 && plan.dayOfMonth <= 28)) return 'Jour du mois : 1 à 28.';
  return null;
}

/** Montant de chaque achat. */
export function amountPerRun(plan: BuyPlan): number {
  const n = plan.frequency === 'weekly' ? Math.max(1, plan.days.length) : 1;
  return Math.floor((plan.amount / n) * 100) / 100;
}

const at = (d: Date) => {
  const x = new Date(d);
  x.setHours(PLAN_LIMITS.hour, 0, 0, 0);
  return x;
};

function isPlanDay(plan: BuyPlan, d: Date): boolean {
  return plan.frequency === 'weekly' ? plan.days.includes(d.getDay()) : d.getDate() === plan.dayOfMonth;
}

/** Achats prévus après `lastRunAt` et jusqu'à maintenant (au plus 31 jours de rattrapage). */
export function dueRuns(plan: BuyPlan, now = new Date()): Date[] {
  if (!plan.active || planError(plan)) return [];
  const since = Math.max(new Date(plan.lastRunAt).getTime(), now.getTime() - PLAN_LIMITS.catchUpDays * 86_400_000);
  const out: Date[] = [];
  for (
    let d = at(new Date(since));
    d.getTime() <= now.getTime();
    d = at(new Date(d.getTime() + 86_400_000 + 3_600_000))
  ) {
    if (d.getTime() > since && isPlanDay(plan, d)) out.push(d);
  }
  return out;
}

/** Prochain achat prévu. */
export function nextRun(plan: BuyPlan, now = new Date()): Date | null {
  if (!plan.active || planError(plan)) return null;
  for (let i = 0, d = at(now); i < 62; i++, d = at(new Date(d.getTime() + 86_400_000 + 3_600_000))) {
    if (d.getTime() > now.getTime() && isPlanDay(plan, d)) return d;
  }
  return null;
}

/** Passe les achats dus. Un achat impossible (compte d'attente vide…) est sauté et signalé. */
export function runPlan(
  account: Account,
  prices: Prices,
  now = new Date(),
): { account: Account; done: number; skipped: number; message?: string } {
  const plan = account.plan;
  if (!plan) return { account, done: 0, skipped: 0 };
  const runs = dueRuns(plan, now);
  if (runs.length === 0) return { account, done: 0, skipped: 0 };
  const target = account.settings.allocation ?? DEFAULT_ALLOCATION;
  const each = amountPerRun(plan);
  let acc = account;
  let done = 0;
  let skipped = 0;
  let message: string | undefined;
  for (let i = 0; i < runs.length; i++) {
    try {
      const before = acc.transactions.length;
      const next = buySplit(acc, prices, splitAmount(each, target, plan.mode, acc, prices), now, plan.source);
      const added = next.transactions.length - before;
      acc = {
        ...next,
        transactions: next.transactions.map((t, i) =>
          i < added && t.kind === 'buy' ? { ...t, label: `${t.label} · achat programmé` } : t,
        ),
      };
      done++;
    } catch (e) {
      skipped++;
      message = e instanceof LedgerError ? e.message : 'Achat impossible.';
    }
  }
  const lastResult = { at: now.toISOString(), done, skipped, ...(message ? { message } : {}) };
  return { account: { ...acc, plan: { ...plan, lastRunAt: now.toISOString(), lastResult } }, done, skipped, message };
}

/** Notification à afficher après un passage (null s'il n'y avait rien à faire). */
export function planNotice(r: { done: number; skipped: number; message?: string }, each: number) {
  const eur = each.toFixed(2).replace('.', ',');
  if (r.done && !r.skipped) {
    return {
      title: 'Achat programmé effectué',
      body: `${r.done > 1 ? `${r.done} achats` : '1 achat'} de ${eur} € selon votre répartition.`,
    };
  }
  if (r.skipped) {
    return {
      title: 'Achat programmé non effectué',
      body: `${r.skipped > 1 ? `${r.skipped} achats sautés` : '1 achat sauté'}${r.done ? `, ${r.done} effectués` : ''}. ${r.message ?? ''}`.trim(),
    };
  }
  return null;
}
