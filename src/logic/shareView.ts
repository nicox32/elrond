/**
 * Lien en lecture seule d'un compte enfant, pour l'autre parent : il s'ouvre dans un navigateur, sans appli ni code,
 * et ne permet aucune opération. Les données sont dans la partie après « # » du lien : elle n'est jamais envoyée au
 * serveur du site, seul le navigateur qui ouvre le lien la lit. C'est une photo du compte au moment du partage ; la
 * valeur, elle, est recalculée aux cours du moment à chaque ouverture.
 */
import { majorityDate } from './ledger.ts';
import { holdingLots } from './tax.ts';
import type { ChildAccount, Metal, Prices } from './types.ts';
import { METALS } from './types.ts';

export const VIEW_BASE_URL = 'https://nicox32.github.io/elrond/';
export const VIEW_PREFIX = '#vue=';
const MAX_OPS = 25;

export interface ChildView {
  v: 1;
  /** Prénom de l'enfant. */
  n: string;
  /** Parent qui partage. */
  p: string;
  /** Date de naissance (AAAA-MM-JJ). */
  b?: string;
  /** Date du partage. */
  at: string;
  /** Grammes par métal. */
  h: Record<Metal, number>;
  /** Montant versé (coût d'acquisition) par métal, en euros. */
  c: Record<Metal, number>;
  /** Cours au moment du partage (€/g), si les cours du moment ne se chargent pas. */
  px: Prices;
  /** Autorité parentale partagée : retraits validés par les deux parents. */
  j: boolean;
  /** Dernières opérations : [date, libellé, euros, grammes par métal]. */
  o: [string, string, number, number, number, number][];
  /** Nombre total d'opérations. */
  t: number;
}

const r = (x: number, d: number) => Math.round(x * 10 ** d) / 10 ** d;

export function makeChildView(child: ChildAccount, parent: string, prices: Prices, now = new Date()): ChildView {
  const lots = holdingLots(child);
  const cost = { gold: 0, silver: 0, platinum: 0 } as Record<Metal, number>;
  for (const m of METALS)
    cost[m] = r(
      lots[m].reduce((s, l) => s + l.cost, 0),
      2,
    );
  return {
    v: 1,
    n: child.name,
    p: parent,
    ...(child.birthDate ? { b: child.birthDate } : {}),
    at: now.toISOString(),
    h: {
      gold: r(child.holdings.gold, 4),
      silver: r(child.holdings.silver, 4),
      platinum: r(child.holdings.platinum, 4),
    },
    c: cost,
    px: { gold: r(prices.gold, 4), silver: r(prices.silver, 4), platinum: r(prices.platinum, 4) },
    j: child.authority !== 'sole',
    o: child.transactions
      .slice(0, MAX_OPS)
      .map((t) => [
        t.date.slice(0, 10),
        t.label ?? '',
        r(t.eur, 2),
        r(t.deltas.gold ?? 0, 4),
        r(t.deltas.silver ?? 0, 4),
        r(t.deltas.platinum ?? 0, 4),
      ]),
    t: child.transactions.length,
  };
}

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(s: string): string {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

export function childViewLink(view: ChildView): string {
  return `${VIEW_BASE_URL}${VIEW_PREFIX}${toBase64Url(JSON.stringify(view))}`;
}

/** Lit le lien (ou sa partie « # ») ; null s'il n'est pas valide. */
export function readChildView(hashOrUrl: string): ChildView | null {
  const i = hashOrUrl.indexOf(VIEW_PREFIX);
  if (i < 0) return null;
  try {
    const v = JSON.parse(fromBase64Url(hashOrUrl.slice(i + VIEW_PREFIX.length))) as ChildView;
    if (v?.v !== 1 || typeof v.n !== 'string' || !v.h || !Array.isArray(v.o)) return null;
    return v;
  } catch {
    return null;
  }
}

/** Date des 18 ans, si la date de naissance est connue. */
export function viewMajority(v: ChildView): Date | null {
  return v.b ? majorityDate(v.b) : null;
}
