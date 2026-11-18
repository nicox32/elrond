/**
 * Virement entre deux téléphones, sans serveur, par QR codes :
 *  1. le destinataire montre le QR code de son numéro de membre ; l'expéditeur le scanne ;
 *  2. l'expéditeur envoie (son compte est débité) et l'appli affiche un « bon de virement » en QR code ;
 *  3. le destinataire scanne ce bon : son compte est crédité, une seule fois.
 *
 * Limite : sans serveur, personne ne peut vérifier qu'un bon vient d'un vrai débit. Le bon est signé (HMAC) avec une clé
 * contenue dans l'appli, ce qui arrête les erreurs et les copies, mais pas quelqu'un de décidé à falsifier l'appli. À
 * réserver à des proches de confiance.
 */
import {
  applyTx,
  LedgerError,
  memberTransferRoom,
  MEMBER_TRANSFER_LIMIT,
  newId,
  sameMember,
  transferToMember,
} from './ledger.ts';
import { isLocked, newRef, productOf } from './physical.ts';
import { hmacSha256, toHex, utf8 } from './sha256.ts';
import type { Account, Beneficiary, HomeBar, Metal, Prices, Quantity } from './types.ts';

const PREFIX = 'ORVIA:VIREMENT:';
const TICKET_KEY = 'orvia-bon-de-virement-v1';

export interface Ticket {
  v: 1;
  /** Identifiant unique du bon. */
  i: string;
  /** N° de membre de l'expéditeur. */
  f: string;
  /** N° de membre du destinataire. */
  t: string;
  /** Date d'envoi (ISO). */
  a: string;
  /** Métal et grammes envoyés. */
  m?: [Metal, number];
  /** Lingotin envoyé : produit, grammes, numéro de série. */
  b?: { p: string; g: number; s?: string };
}

const toB64Url = (text: string) => {
  const bytes = utf8(text);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const fromB64Url = (s: string) => {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
};
const sign = (body: string) => toHex(hmacSha256(utf8(TICKET_KEY), utf8(body))).slice(0, 32);

export function encodeTicket(t: Ticket): string {
  const body = toB64Url(JSON.stringify(t));
  return `${PREFIX}${body}.${sign(body)}`;
}

/** Lit un bon de virement : signature vérifiée, sinon erreur. */
export function decodeTicket(text: string): Ticket {
  const raw = text.trim();
  if (!raw.toUpperCase().startsWith(PREFIX)) throw new LedgerError('Ce QR code n’est pas un virement Orvia.');
  const [body, sig] = raw.slice(PREFIX.length).split('.');
  if (!body || !sig || sig.toLowerCase() !== sign(body)) {
    throw new LedgerError('Ce virement n’est pas valide (signature incorrecte).');
  }
  try {
    const t = JSON.parse(fromB64Url(body)) as Ticket;
    if (t.v !== 1 || typeof t.i !== 'string' || typeof t.f !== 'string' || typeof t.t !== 'string') throw new Error();
    if (!t.m && !t.b) throw new Error();
    return t;
  } catch {
    throw new LedgerError('Ce QR code est abîmé : le virement ne peut pas être lu.');
  }
}

/** Envoie du métal à un membre : l'expéditeur est débité, et reçoit le bon à faire scanner au destinataire. */
export function sendMetalToMember(
  account: Account,
  prices: Prices,
  metal: Metal,
  q: Quantity,
  beneficiary: Beneficiary,
  now = new Date(),
): { account: Account; ticket: string } {
  const next = transferToMember(account, prices, metal, q, beneficiary, now);
  const tx = next.transactions[0];
  const grams = -(tx.deltas[metal] ?? 0);
  return {
    account: next,
    ticket: encodeTicket({
      v: 1,
      i: tx.id,
      f: account.memberId,
      t: beneficiary.identifier,
      a: now.toISOString(),
      m: [metal, Math.round(grams * 1e6) / 1e6],
    }),
  };
}

/** Envoie un lingotin ou une pièce à un membre. Même limite de 300 € sur 30 jours que pour le métal. */
export function sendBarToMember(
  account: Account,
  prices: Prices,
  barId: string,
  beneficiary: Beneficiary,
  now = new Date(),
): { account: Account; ticket: string } {
  if (beneficiary.kind !== 'member') throw new LedgerError('Ce bénéficiaire n’est pas un membre.');
  if (sameMember(beneficiary.identifier, account.memberId)) {
    throw new LedgerError('Vous ne pouvez pas vous faire un virement à vous-même.');
  }
  const bar = (account.homeVault ?? []).find((b) => b.id === barId);
  if (!bar) throw new LedgerError('Lingotin introuvable.');
  if (bar.vault) throw new LedgerError('Ce lingotin est gardé en coffre : retirez-le d’abord du coffre.');
  if (bar.ownerChildId) throw new LedgerError('Ce lingotin appartient à un enfant.');
  if (bar.status !== 'received') throw new LedgerError('Le lingotin n’est pas encore arrivé.');
  if (isLocked(bar, now)) throw new LedgerError('Ce lingotin est verrouillé.');
  const value = bar.grams * prices.gold;
  const room = memberTransferRoom(account, now);
  if (value > room.left + 0.005) {
    throw new LedgerError(
      `Ce lingotin vaut ${value.toFixed(2).replace('.', ',')} € : au-dessus de la limite de ${MEMBER_TRANSFER_LIMIT.eur} € de virements à des membres sur ${MEMBER_TRANSFER_LIMIT.days} jours glissants (il reste ${room.left.toFixed(2).replace('.', ',')} €).`,
    );
  }
  const label = `Envoi du ${productOf(bar.product).label.toLowerCase()} à ${beneficiary.name}`;
  const paid = applyTx(account, 'transfer_member', {}, value, label, now);
  const tx = paid.transactions[0];
  return {
    account: { ...paid, homeVault: (paid.homeVault ?? []).filter((b) => b.id !== barId) },
    ticket: encodeTicket({
      v: 1,
      i: tx.id,
      f: account.memberId,
      t: beneficiary.identifier,
      a: now.toISOString(),
      b: { p: bar.product, g: bar.grams, ...(bar.serial ? { s: bar.serial } : {}) },
    }),
  };
}

/** Encaisse un bon scanné : une seule fois, et seulement s'il est adressé à ce compte. */
export function receiveTicket(
  account: Account,
  prices: Prices,
  text: string,
  now = new Date(),
): { account: Account; summary: string } {
  const t = decodeTicket(text);
  if (!sameMember(t.t, account.memberId)) {
    throw new LedgerError('Ce virement est adressé à un autre membre : il ne peut pas être encaissé ici.');
  }
  if (sameMember(t.f, account.memberId)) throw new LedgerError('Vous ne pouvez pas encaisser votre propre virement.');
  if ((account.receivedTickets ?? []).includes(t.i)) throw new LedgerError('Ce virement a déjà été encaissé.');
  const received = [...(account.receivedTickets ?? []), t.i].slice(-300);
  if (t.m) {
    const [metal, grams] = t.m;
    if (!(grams > 0) || !['gold', 'silver', 'platinum'].includes(metal)) {
      throw new LedgerError('Ce QR code est abîmé : le virement ne peut pas être lu.');
    }
    const next = applyTx(account, 'family_in', { [metal]: grams }, grams * prices[metal], `Reçu du membre ${t.f}`, now);
    return {
      account: { ...next, receivedTickets: received },
      summary: `${grams.toLocaleString('fr-FR', { maximumFractionDigits: 4 })} g de métal reçus du membre ${t.f}.`,
    };
  }
  const b = t.b!;
  const product = productOf(b.p);
  const value = b.g * prices.gold;
  const paid = applyTx(account, 'family_in', {}, value, `Reçu du membre ${t.f} : ${product.label.toLowerCase()}`, now);
  const used = new Set<string>([...(paid.homeVault ?? []).flatMap((x) => (x.ref ? [x.ref] : []))]);
  const bar: HomeBar = {
    id: newId(),
    product: b.p,
    grams: b.g,
    orderedAt: now.toISOString(),
    status: 'received',
    receivedAt: now.toISOString(),
    ...(b.s ? { serial: b.s } : {}),
    cost: Math.round(value * 100) / 100,
    acquiredFrom: now.toISOString(),
    acquiredTo: now.toISOString(),
    txId: paid.transactions[0].id,
    ref: newRef(used),
    place: 'maison',
  };
  return {
    account: { ...paid, homeVault: [...(paid.homeVault ?? []), bar], receivedTickets: received },
    summary: `${product.label} reçu du membre ${t.f}.`,
  };
}
