/**
 * Ordres du week-end : le marché est fermé du vendredi soir au dimanche soir. Un achat, une vente, une conversion,
 * un achat réparti ou un don peuvent attendre la réouverture et passer au cours du lundi, sans supplément.
 */
import { buySplit } from './allocation.ts';
import { giveMonthlyGift } from './childGiftPlan.ts';
import { buy, convert, LedgerError, METAL_LABEL, METAL_OF, minOrderError, newId, sell } from './ledger.ts';
import type { Account, PendingOrder, Prices, SpotMetal } from './types.ts';

const eur = (n: number) => n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
const qty = (o: PendingOrder) =>
  o.q ? (o.q.unit === 'eur' ? eur(o.q.value) : `${o.q.value.toLocaleString('fr-FR')} ${o.q.unit}`) : '';

/** Description lisible d'un ordre en attente. */
export function describeOrder(o: PendingOrder, account?: Account): string {
  switch (o.kind) {
    case 'buy':
      return `Achat ${qty(o)} ${METAL_OF[o.metal!]}`;
    case 'sell':
      return `Vente ${qty(o)} ${METAL_OF[o.metal!]}`;
    case 'convert':
      return `Conversion ${qty(o)} : ${METAL_LABEL[o.metal!]} → ${METAL_LABEL[o.target!]}`;
    case 'split':
      return `Achat réparti de ${eur(Object.values(o.amounts ?? {}).reduce((s, v) => s + (v ?? 0), 0))}`;
    case 'gift':
      return `Don du mois à ${account?.children.find((c) => c.id === o.childId)?.name ?? 'l’enfant'}`;
  }
}

/** Ajoute un ordre à exécuter à la réouverture (le minimum d'achat est vérifié tout de suite). */
export function placeOrder(account: Account, order: Omit<PendingOrder, 'id' | 'createdAt'>, now = new Date()): Account {
  if (order.kind === 'buy' && order.q?.unit === 'eur') {
    const err = minOrderError(order.q.value);
    if (err) throw new LedgerError(err);
  }
  if (order.kind === 'split') {
    const err = minOrderError(Object.values(order.amounts ?? {}).reduce((s, v) => s + (v ?? 0), 0));
    if (err) throw new LedgerError(err);
  }
  if (
    order.kind === 'gift' &&
    (account.pendingOrders ?? []).some((o) => o.kind === 'gift' && o.childId === order.childId)
  ) {
    throw new LedgerError('Ce don est déjà prévu pour lundi.');
  }
  const o: PendingOrder = { ...order, id: newId(), createdAt: now.toISOString() };
  return { ...account, pendingOrders: [...(account.pendingOrders ?? []), o] };
}

export function cancelOrder(account: Account, id: string): Account {
  return { ...account, pendingOrders: (account.pendingOrders ?? []).filter((o) => o.id !== id) };
}

/** Exécute les ordres en attente au cours du moment (marché rouvert), dans l'ordre où ils ont été passés. */
export function runPendingOrders(
  account: Account,
  prices: Prices,
  now = new Date(),
): { account: Account; notices: { title: string; body: string }[] } {
  const orders = account.pendingOrders ?? [];
  if (!orders.length) return { account, notices: [] };
  let acc: Account = { ...account, pendingOrders: [] };
  const done: string[] = [];
  const failed: string[] = [];
  for (const o of orders) {
    const before = acc.transactions.length;
    try {
      if (o.kind === 'buy') acc = buy(acc, prices, o.metal!, o.q!, now, o.source ?? 'card');
      else if (o.kind === 'sell') acc = sell(acc, prices, o.metal!, o.q!, o.speed ?? 'deferred', now);
      else if (o.kind === 'convert') acc = convert(acc, prices, o.metal!, o.target!, o.q!, now);
      else if (o.kind === 'split')
        acc = buySplit(
          acc,
          prices,
          { gold: 0, silver: 0, platinum: 0, ...o.amounts } as Record<SpotMetal, number>,
          now,
          o.source ?? 'card',
        );
      else if (o.kind === 'gift') acc = giveMonthlyGift(acc, prices, o.childId!, now);
      const added = acc.transactions.length - before;
      acc = {
        ...acc,
        transactions: acc.transactions.map((t, i) =>
          i < added ? { ...t, label: `${t.label} · ordre du week-end` } : t,
        ),
      };
      done.push(describeOrder(o, account));
    } catch (e) {
      failed.push(`${describeOrder(o, account)} : ${e instanceof LedgerError ? e.message : 'impossible'}`);
    }
  }
  const notices = [];
  if (done.length)
    notices.push({
      title: `Ordres du week-end passés (${done.length})`,
      body: `Au cours de la réouverture : ${done.join(' ; ')}.`,
    });
  if (failed.length) notices.push({ title: 'Ordres du week-end non passés', body: failed.join(' ; ') });
  return { account: acc, notices };
}
