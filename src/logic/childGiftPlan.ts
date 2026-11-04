/**
 * Don mensuel à un enfant : le jour prévu, l'appli rappelle le don (ou le fait seule, si vous l'avez choisi).
 * Un don = un achat de métal sur le compte du parent, aussitôt versé (gratuitement) sur le compte de l'enfant.
 */
import { buy, fundChild, getChild, LedgerError, METAL_LABEL, replaceChildAccount } from './ledger.ts';
import { type Account, type Metal, METALS, type Prices } from './types.ts';

export interface ChildGiftPlan {
  active: boolean;
  /** Montant du don, en euros (frais d'achat compris). */
  amount: number;
  /** Jour du mois (1 à 28). */
  dayOfMonth: number;
  /** Répartition en % (total 100). */
  share: Record<Metal, number>;
  /** Don fait seul le jour prévu ; sinon, rappel et don en un geste. */
  auto: boolean;
  /** Dernier mois réglé (don fait ou sauté), « AAAA-MM ». */
  doneMonth?: string;
  /** Dernier mois rappelé par notification. */
  remindedMonth?: string;
}

export const GIFT_PRESETS: { label: string; share: Record<Metal, number> }[] = [
  { label: '80 / 20', share: { gold: 80, silver: 20, platinum: 0 } },
  { label: '75 / 20 / 5', share: { gold: 75, silver: 20, platinum: 5 } },
  { label: '100 % or', share: { gold: 100, silver: 0, platinum: 0 } },
  { label: '50 / 50', share: { gold: 50, silver: 50, platinum: 0 } },
];

export function newGiftPlan(): ChildGiftPlan {
  return { active: true, amount: 50, dayOfMonth: 5, share: { ...GIFT_PRESETS[0].share }, auto: false };
}

export const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

export function giftPlanError(p: ChildGiftPlan): string | null {
  if (!(p.amount >= 5)) return 'Montant minimum : 5 €.';
  if (p.amount > 5000) return 'Montant maximum : 5 000 €.';
  if (!(p.dayOfMonth >= 1 && p.dayOfMonth <= 28)) return 'Jour du mois : 1 à 28.';
  const total = METALS.reduce((s, m) => s + (p.share[m] || 0), 0);
  if (Math.abs(total - 100) > 0.01) return 'La répartition doit faire 100 %.';
  return null;
}

/** Le don de ce mois est-il à faire ? */
export function giftDue(p: ChildGiftPlan | undefined, now = new Date()): boolean {
  return !!p && p.active && !giftPlanError(p) && now.getDate() >= p.dayOfMonth && p.doneMonth !== monthKey(now);
}

/** Montants en euros par métal, au centime (le reste va au Gold Spot). */
export function giftAmounts(p: ChildGiftPlan): Record<Metal, number> {
  const out = { gold: 0, silver: 0, platinum: 0 } as Record<Metal, number>;
  for (const m of METALS) out[m] = Math.floor(((p.amount * (p.share[m] || 0)) / 100) * 100) / 100;
  out.gold = Math.round((out.gold + p.amount - METALS.reduce((s, m) => s + out[m], 0)) * 100) / 100;
  return out;
}

export function describeGift(p: ChildGiftPlan): string {
  const a = giftAmounts(p);
  return METALS.filter((m) => a[m] > 0)
    .map(
      (m) => `${a[m].toFixed(2).replace('.', ',')} € ${m === 'gold' ? METAL_LABEL.gold : METAL_LABEL[m].toLowerCase()}`,
    )
    .join(' + ');
}

function setPlan(account: Account, childId: string, patch: Partial<ChildGiftPlan>): Account {
  const child = getChild(account, childId);
  if (!child.giftPlan) return account;
  return replaceChildAccount(account, { ...child, giftPlan: { ...child.giftPlan, ...patch } });
}

/** Fait le don du mois : achat sur le compte du parent (carte), puis versement sur le compte de l'enfant. */
export function giveMonthlyGift(account: Account, prices: Prices, childId: string, now = new Date()): Account {
  const child = getChild(account, childId);
  const p = child.giftPlan;
  if (!p) throw new LedgerError('Aucun don mensuel prévu.');
  const err = giftPlanError(p);
  if (err) throw new LedgerError(err);
  const amounts = giftAmounts(p);
  let acc = account;
  for (const m of METALS) {
    if (amounts[m] < 0.01) continue;
    const before = acc.holdings[m];
    acc = buy(acc, prices, m, { unit: 'eur', value: amounts[m] }, now, 'card');
    const [tx, ...rest] = acc.transactions;
    acc = { ...acc, transactions: [{ ...tx, label: `${tx.label} · don à ${child.name}` }, ...rest] };
    const grams = acc.holdings[m] - before;
    acc = fundChild(acc, prices, childId, m, { unit: 'g', value: grams }, now);
  }
  return setPlan(acc, childId, { doneMonth: monthKey(now) });
}

/** Pas de don ce mois-ci : le rappel s'arrête jusqu'au mois prochain. */
export function skipMonthlyGift(account: Account, childId: string, now = new Date()): Account {
  return setPlan(account, childId, { doneMonth: monthKey(now) });
}

/**
 * Passage du jour (ouverture de l'appli, actualisation, arrière-plan) : dons automatiques dus, et rappels à
 * envoyer (une fois par mois) pour les dons manuels.
 */
export function runGiftPlans(
  account: Account,
  prices: Prices,
  now = new Date(),
): { account: Account; notices: { title: string; body: string }[] } {
  let acc = account;
  const notices: { title: string; body: string }[] = [];
  for (const c of account.children) {
    const p = c.giftPlan;
    if (c.transferredAt || !giftDue(p, now)) continue;
    if (p!.auto) {
      try {
        acc = giveMonthlyGift(acc, prices, c.id, now);
        notices.push({ title: `Don à ${c.name} effectué`, body: `${describeGift(p!)}, versé sur son compte.` });
      } catch (e) {
        const reason = e instanceof LedgerError ? e.message : 'Don impossible.';
        if (p!.remindedMonth !== monthKey(now)) {
          acc = setPlan(acc, c.id, { remindedMonth: monthKey(now) });
          notices.push({ title: `Don à ${c.name} non effectué`, body: reason });
        }
      }
    } else if (p!.remindedMonth !== monthKey(now)) {
      acc = setPlan(acc, c.id, { remindedMonth: monthKey(now) });
      notices.push({
        title: `Don du mois à ${c.name}`,
        body: `${describeGift(p!)} : ouvrez son compte dans Orvia pour le faire en un geste.`,
      });
    }
  }
  return { account: acc, notices };
}
