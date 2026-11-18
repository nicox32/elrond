/**
 * Lingotin ou pièce refusé au contrôle (anomalie) : il est retiré du compte du client, l'or est recrédité et les frais
 * sont remboursés. L'objet part dans la liste des retours, à renvoyer à Godot & Fils (renvoi, remplacement ou
 * remboursement à Orvia).
 */
import { barState, lastCheck } from './barControl.ts';
import { applyTx, getChild, LedgerError, replaceChildAccount } from './ledger.ts';
import type { Account, ReturnedBar } from './types.ts';

const round2 = (n: number) => Math.round(n * 100) / 100;

export const RETURN_STATUS_LABEL: Record<ReturnedBar['status'], string> = {
  to_send: 'À renvoyer à Godot & Fils',
  sent: 'Renvoyé à Godot & Fils',
  replaced: 'Remplacé par Godot & Fils',
  credited: 'Remboursé à Orvia',
};

/** Motif par défaut : les vérifications non conformes du dernier contrôle. */
export function defaultReturnReason(bar: Parameters<typeof lastCheck>[0]): string {
  const c = lastCheck(bar);
  const list = c?.failed?.length ? c.failed.join(' ; ') : 'anomalie au contrôle';
  return c?.note ? `${list} (${c.note})` : list;
}

/**
 * Refuse un lingotin en anomalie : il disparaît du compte du client (coffre maison, coffre sécurisé, compte enfant), qui
 * récupère son or et ses frais. Fonctionne aussi pour un lingotin verrouillé (sécurité maximale) : le défaut ne vient
 * pas du client.
 */
export function rejectBar(account: Account, barId: string, reason?: string, now = new Date()): Account {
  const bar = (account.homeVault ?? []).find((b) => b.id === barId);
  if (!bar) throw new LedgerError('Lingotin introuvable.');
  if (barState(bar) !== 'anomaly') throw new LedgerError('Seul un lingotin en anomalie peut être refusé.');
  const why = reason?.trim() || defaultReturnReason(bar);
  const name = `${bar.serial ? `n° ${bar.serial}` : bar.ref ? `réf. ${bar.ref}` : 'sans numéro'}`;
  const label = `Lingotin défectueux retiré (${name}) : or recrédité, frais remboursés · ${why}`;
  const fees = round2(bar.feesPaid ?? 0);
  const value = 0;

  // Le compte qui avait payé l'or : l'enfant pour une conversion à son nom, sinon le titulaire.
  const child = bar.ownerChildId ? account.children.find((c) => c.id === bar.ownerChildId) : undefined;
  const childPaid = !!child && !!bar.txId && child.transactions.some((t) => t.id === bar.txId);
  let next: Account = account;
  if (childPaid && child) {
    next = replaceChildAccount(
      next,
      applyTx(getChild(next, child.id), 'bar_refund', { gold: bar.grams }, value, label, now),
    );
  } else {
    next = applyTx(next, 'bar_refund', { gold: bar.grams }, value, label, now);
    // Lingotin donné à un enfant : le don est annulé, on le note dans son compte.
    if (child && !childPaid) {
      next = replaceChildAccount(
        next,
        applyTx(getChild(next, child.id), 'bar_refund', {}, 0, `Don d'un lingotin défectueux annulé (${name})`, now),
      );
    }
  }
  if (fees > 0) {
    const [tx, ...rest] = next.transactions;
    next = {
      ...next,
      cashEur: round2((next.cashEur ?? 0) + fees),
      transactions: [{ ...tx, fees: undefined, cash: fees, eur: fees }, ...rest],
    };
  }
  const returned: ReturnedBar = {
    id: bar.id,
    product: bar.product,
    grams: bar.grams,
    ...(bar.serial ? { serial: bar.serial } : {}),
    ...(bar.ref ? { ref: bar.ref } : {}),
    reason: why,
    returnedAt: now.toISOString(),
    refundGold: bar.grams,
    refundEur: fees,
    ...(bar.ownerChildId ? { ownerChildId: bar.ownerChildId } : {}),
    status: 'to_send',
  };
  return {
    ...next,
    homeVault: (next.homeVault ?? []).filter((b) => b.id !== barId),
    returnedBars: [returned, ...(next.returnedBars ?? [])],
  };
}

/** Suivi du retour chez le fournisseur. */
export function setReturnStatus(
  account: Account,
  barId: string,
  status: ReturnedBar['status'],
  note?: string,
  now = new Date(),
): Account {
  if (!(account.returnedBars ?? []).some((r) => r.id === barId)) throw new LedgerError('Retour introuvable.');
  return {
    ...account,
    returnedBars: (account.returnedBars ?? []).map((r) =>
      r.id === barId
        ? { ...r, status, statusAt: now.toISOString(), ...(note?.trim() ? { note: note.trim().slice(0, 200) } : {}) }
        : r,
    ),
  };
}
