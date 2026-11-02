/**
 * Règles des comptes enfants, alignées sur le droit français (à faire valider par un juriste avant un vrai lancement) :
 * - l'argent versé à un enfant lui appartient (c'est un don) : le parent ne peut pas le reprendre pour lui-même ;
 * - un retrait est un « acte de disposition » : seulement pour une dépense dans l'intérêt de l'enfant, avec
 *   l'accord des deux parents quand ils exercent ensemble l'autorité parentale (Cass. com., 12 juin 2025) ;
 * - à 18 ans, le compte devient celui de l'enfant : le parent ne le gère plus et le lui transfère.
 */
import {
  getChild,
  LedgerError,
  majorityDate,
  newId,
  replaceChildAccount,
  toGrams,
  withdrawFromChild,
} from './ledger.ts';
import type {
  Account,
  ChildAccount,
  ChildWithdrawalPurpose,
  ChildWithdrawalRequest,
  CoParent,
  Metal,
  Prices,
  Quantity,
} from './types.ts';

export const PURPOSE_LABEL: Record<ChildWithdrawalPurpose, string> = {
  education: 'Études, école',
  health: 'Santé',
  equipment: 'Équipement, vie quotidienne',
  activities: 'Loisirs, sport, vacances',
  other: 'Autre dépense pour l’enfant',
};

/** Délai pendant lequel le parent peut annuler seul un versement fait par erreur. */
export const DEPOSIT_UNDO_MS = 24 * 3_600_000;

const DUST = 1e-5;

export type ChildStage = 'minor' | 'adult' | 'transferred';

/** Mineur, majeur (compte à lui transférer) ou déjà transféré. Sans date de naissance : traité comme mineur. */
export function childStage(child: ChildAccount, now = new Date()): ChildStage {
  if (child.transferredAt) return 'transferred';
  if (child.birthDate && majorityDate(child.birthDate).getTime() <= now.getTime()) return 'adult';
  return 'minor';
}

function requireMinor(child: ChildAccount, now: Date) {
  const stage = childStage(child, now);
  if (stage === 'transferred') throw new LedgerError(`Le compte de ${child.name} lui a été transféré.`);
  if (stage === 'adult') {
    throw new LedgerError(`${child.name} est majeur : son compte lui appartient, il faut le lui transférer.`);
  }
}

/** Déclare comment l'autorité parentale est exercée, et le second parent le cas échéant. */
export function setChildParents(
  account: Account,
  childId: string,
  authority: 'joint' | 'sole',
  coParent?: CoParent,
): Account {
  const child = getChild(account, childId);
  if (authority === 'joint' && !coParent && !child.coParent) {
    throw new LedgerError('Ajoute le second parent : il validera les retraits avec son propre code.');
  }
  const coParentName = coParent?.name.trim();
  if (coParent && !coParentName) throw new LedgerError('Indique le prénom du second parent.');
  return replaceChildAccount(account, {
    ...child,
    authority,
    coParent: authority === 'joint' ? (coParent ? { ...coParent, name: coParentName! } : child.coParent) : undefined,
  });
}

/** Grammes déjà réservés par des demandes de retrait en attente. */
function reservedGrams(child: ChildAccount, metal: Metal): number {
  return (child.withdrawalRequests ?? [])
    .filter((r) => r.status === 'pending' && r.metal === metal)
    .reduce((s, r) => s + r.grams, 0);
}

function execute(account: Account, prices: Prices, child: ChildAccount, req: ChildWithdrawalRequest, now: Date) {
  const label = `Dépense pour ${child.name} · ${PURPOSE_LABEL[req.purpose]}${req.note ? ` (${req.note})` : ''}`;
  return withdrawFromChild(account, prices, child.id, req.metal, { unit: 'g', value: req.grams }, now, {
    child: label,
    parent: label,
  });
}

function updateRequest(account: Account, childId: string, requestId: string, patch: Partial<ChildWithdrawalRequest>) {
  const child = getChild(account, childId);
  return replaceChildAccount(account, {
    ...child,
    withdrawalRequests: (child.withdrawalRequests ?? []).map((r) => (r.id === requestId ? { ...r, ...patch } : r)),
  });
}

/**
 * Demande de retrait sur le compte d'un enfant, pour une dépense dans son intérêt (motif obligatoire).
 * Autorité partagée : la demande attend la validation du second parent. Autorité exercée seul : exécutée tout de suite.
 */
export function requestChildWithdrawal(
  account: Account,
  prices: Prices,
  childId: string,
  metal: Metal,
  q: Quantity,
  purpose: ChildWithdrawalPurpose | undefined,
  note = '',
  now = new Date(),
): { account: Account; request: ChildWithdrawalRequest; executed: boolean } {
  const child = getChild(account, childId);
  requireMinor(child, now);
  if (!child.authority) {
    throw new LedgerError('Indique d’abord si tu exerces l’autorité parentale seul ou avec un second parent.');
  }
  if (!purpose) throw new LedgerError(`Choisis la dépense faite pour ${child.name}.`);
  if (purpose === 'other' && !note.trim()) throw new LedgerError('Précise la dépense en quelques mots.');
  if (!Number.isFinite(q.value) || q.value <= 0) throw new LedgerError('La quantité doit être un nombre positif.');
  const grams = toGrams(q, prices[metal]);
  if (grams > child.holdings[metal] - reservedGrams(child, metal) + DUST) {
    throw new LedgerError(`Solde insuffisant sur le compte de ${child.name}.`);
  }
  const request: ChildWithdrawalRequest = {
    id: newId(),
    metal,
    grams,
    eur: Math.round(grams * prices[metal] * 100) / 100,
    purpose,
    note: note.trim() || undefined,
    createdAt: now.toISOString(),
    status: 'pending',
  };
  let next = replaceChildAccount(account, {
    ...child,
    withdrawalRequests: [request, ...(child.withdrawalRequests ?? [])],
  });
  if (child.authority === 'sole') {
    next = execute(next, prices, getChild(next, childId), request, now);
    next = updateRequest(next, childId, request.id, { status: 'approved', decidedAt: now.toISOString() });
    return { account: next, request: { ...request, status: 'approved' }, executed: true };
  }
  return { account: next, request, executed: false };
}

/** Le second parent valide la demande (son code est vérifié avant l'appel). */
export function approveChildWithdrawal(
  account: Account,
  prices: Prices,
  childId: string,
  requestId: string,
  now = new Date(),
): Account {
  const child = getChild(account, childId);
  requireMinor(child, now);
  const req = (child.withdrawalRequests ?? []).find((r) => r.id === requestId);
  if (!req || req.status !== 'pending') throw new LedgerError('Cette demande n’est plus en attente.');
  if (req.grams > child.holdings[req.metal] + DUST)
    throw new LedgerError(`Solde insuffisant sur le compte de ${child.name}.`);
  const next = execute(account, prices, child, req, now);
  return updateRequest(next, childId, requestId, { status: 'approved', decidedAt: now.toISOString() });
}

/** Refus par le second parent, ou annulation par le parent qui a fait la demande. */
export function closeChildWithdrawal(
  account: Account,
  childId: string,
  requestId: string,
  status: 'refused' | 'cancelled',
  now = new Date(),
): Account {
  const req = (getChild(account, childId).withdrawalRequests ?? []).find((r) => r.id === requestId);
  if (!req || req.status !== 'pending') throw new LedgerError('Cette demande n’est plus en attente.');
  return updateRequest(account, childId, requestId, { status, decidedAt: now.toISOString() });
}

/** Versements encore annulables (faits il y a moins de 24 h, non annulés). */
export function undoableDeposits(child: ChildAccount, now = new Date()) {
  return child.transactions.filter(
    (t) => t.kind === 'family_in' && !t.reversed && now.getTime() - new Date(t.date).getTime() < DEPOSIT_UNDO_MS,
  );
}

/** Annule un versement fait par erreur, dans les 24 h : le parent qui l'a fait peut le récupérer seul. */
export function cancelDeposit(
  account: Account,
  prices: Prices,
  childId: string,
  txId: string,
  now = new Date(),
): Account {
  const child = getChild(account, childId);
  requireMinor(child, now);
  const tx = undoableDeposits(child, now).find((t) => t.id === txId);
  if (!tx) throw new LedgerError('Ce versement ne peut plus être annulé (délai de 24 h dépassé).');
  const metal = (Object.keys(tx.deltas) as Metal[]).find((m) => tx.deltas[m] > 0);
  if (!metal) throw new LedgerError('Versement introuvable.');
  const grams = tx.deltas[metal];
  if (grams > child.holdings[metal] + DUST) throw new LedgerError('Le métal de ce versement n’est plus disponible.');
  let next = withdrawFromChild(account, prices, childId, metal, { unit: 'g', value: grams }, now, {
    child: `Annulation d’un versement fait par erreur`,
    parent: `Annulation du versement à ${child.name}`,
  });
  const updated = getChild(next, childId);
  next = replaceChildAccount(next, {
    ...updated,
    transactions: updated.transactions.map((t) => (t.id === txId ? { ...t, reversed: true } : t)),
  });
  return next;
}

/**
 * Transfert du compte à l'enfant devenu majeur : il reçoit un code pour rattacher le compte à son propre
 * accès Orvia (avec sa propre vérification d'identité). Le parent n'a plus la main dessus.
 */
export function transferChildAccount(account: Account, childId: string, now = new Date()): Account {
  const child = getChild(account, childId);
  const stage = childStage(child, now);
  if (stage === 'transferred') return account;
  if (stage !== 'adult') throw new LedgerError(`Le compte ne peut être transféré qu’aux 18 ans de ${child.name}.`);
  const code = Array.from({ length: 8 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join(
    '',
  );
  return replaceChildAccount(account, {
    ...child,
    transferredAt: now.toISOString(),
    transferCode: `ORVIA-T-${code.slice(0, 4)}-${code.slice(4)}`,
    withdrawalRequests: (child.withdrawalRequests ?? []).map((r) =>
      r.status === 'pending' ? { ...r, status: 'cancelled' as const, decidedAt: now.toISOString() } : r,
    ),
  });
}
