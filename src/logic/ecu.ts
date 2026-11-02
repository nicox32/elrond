/**
 * L'Écu Orvia : jeton d'investissement maison, 1 g d'or fin 999,9 frappé pour Orvia et conservé au coffre.
 *
 * Son prix suit l'or en direct : prix d'un écu = 1 g × cours de l'or × (1 + prime). La prime couvre la frappe et
 * reflète la demande : Orvia la fixe (entre 0 et 15 %) et peut la faire varier. Elle est retrouvée à la revente.
 * Fiscalité : traité comme de l'or d'investissement (taxe forfaitaire ou plus-values), tant que le statut
 * particulier des jetons n'est pas confirmé par un texte officiel.
 */
import { average30 } from './alerts.ts';
import type { PricePoint } from './priceHistory.ts';
import type { Account, Prices, SpotPrices } from './types.ts';

export const ECU = {
  name: 'Gold Oria',
  /** Or fin contenu dans un écu, en grammes. */
  goldGrams: 1,
  fineness: '999,9',
  /** Prime sur la valeur de l'or contenu, par défaut. */
  defaultPremium: 0.04,
  minPremium: 0,
  maxPremium: 0.15,
} as const;

export function clampPremium(p: number | undefined): number {
  if (p === undefined || !Number.isFinite(p)) return ECU.defaultPremium;
  return Math.min(ECU.maxPremium, Math.max(ECU.minPremium, p));
}

/** Prix d'un écu en euros, à partir du cours de l'or (€/g). */
export function ecuPrice(goldPerGram: number, premium?: number): number {
  return goldPerGram * ECU.goldGrams * (1 + clampPremium(premium));
}

/** Ajoute (ou recalcule) le prix de l'écu à des cours de métaux. */
export function withEcu(prices: SpotPrices | Prices, premium?: number): Prices {
  return { ...prices, ecu: ecuPrice(prices.gold, premium) };
}

// ——— Prime automatique : un marché simulé ————————————————————————————————
//
// Avec un seul utilisateur, il n'y a pas de vrai marché. La prime automatique imite donc ce qui fait bouger la prime
// d'une pièce d'or dans la réalité :
// 1. le cours de l'or : quand il passe sous sa moyenne 30 jours, les investisseurs achètent et la prime monte ;
//    quand il s'envole, la demande se calme et la prime baisse ;
// 2. la demande des autres investisseurs, simulée : une vague lente et régulière (quelques jours à un mois),
//    identique pour tout le monde à un instant donné ;
// 3. vos propres achats et ventes de Gold Oria sur 7 jours : acheter pousse un peu la prime, vendre la fait baisser.

export const AUTO_PREMIUM = {
  base: ECU.defaultPremium,
  /** Points de prime par point d'écart à la moyenne 30 j (or sous la moyenne → prime plus haute). */
  dipFactor: 0.4,
  dipMin: -0.01,
  dipMax: 0.025,
  /** Vague de demande simulée : amplitudes et périodes (jours). */
  waves: [
    { amp: 0.003, days: 3.3, phase: 0.4 },
    { amp: 0.002, days: 11, phase: 1.7 },
    { amp: 0.0015, days: 29, phase: 3.1 },
  ],
  /** Points de prime par tranche de 1 000 € achetés (net) sur 7 jours. */
  flowPer1000: 0.001,
  flowMin: -0.005,
  flowMax: 0.01,
  min: 0.01,
  max: 0.12,
  /** Ajustement Orvia (Espace Dev), en points. */
  adjustMin: -0.03,
  adjustMax: 0.06,
} as const;

export interface PremiumParts {
  base: number;
  /** Effet du cours de l'or par rapport à sa moyenne 30 jours (null : pas encore 7 jours de relevés). */
  market: number | null;
  /** Demande simulée des autres investisseurs. */
  community: number;
  /** Vos achats et ventes de Gold Oria sur 7 jours. */
  flow: number;
  /** Ajustement décidé par Orvia (Espace Dev). */
  adjustment: number;
  premium: number;
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** Demande simulée des autres investisseurs à un instant donné (somme de vagues lentes, sans hasard). */
export function communityDemand(at: Date): number {
  const days = at.getTime() / 86_400_000;
  return AUTO_PREMIUM.waves.reduce((s, w) => s + w.amp * Math.sin((2 * Math.PI * days) / w.days + w.phase), 0);
}

/** Achats nets de Gold Oria (en euros) sur les 7 jours précédant `at`. */
export function ecuNetFlow(
  transactions: { kind: string; date: string; eur: number; deltas: Partial<Record<string, number>> }[],
  at: Date,
): number {
  const from = at.getTime() - 7 * 86_400_000;
  let flow = 0;
  for (const t of transactions) {
    const time = new Date(t.date).getTime();
    const d = t.deltas.ecu ?? 0;
    if (!d || time < from || time > at.getTime()) continue;
    if (t.kind === 'buy') flow += t.eur;
    else if (t.kind === 'sell' || t.kind === 'transfer_iban' || t.kind.startsWith('card_')) flow -= t.eur;
    else if (t.kind === 'convert') flow += d > 0 ? t.eur : -t.eur;
  }
  return flow;
}

/** Prime automatique à un instant donné, avec le détail de ce qui la compose. */
export function autoPremium(input: {
  at: Date;
  gold: number;
  goldAvg30: number | null;
  netFlowEur: number;
  adjustment?: number;
}): PremiumParts {
  const A = AUTO_PREMIUM;
  const market =
    input.goldAvg30 && input.goldAvg30 > 0
      ? clamp(((input.goldAvg30 - input.gold) / input.goldAvg30) * A.dipFactor, A.dipMin, A.dipMax)
      : null;
  const community = communityDemand(input.at);
  const flow = clamp((input.netFlowEur / 1000) * A.flowPer1000, A.flowMin, A.flowMax);
  const adjustment = clamp(input.adjustment ?? 0, A.adjustMin, A.adjustMax);
  const premium = clamp(A.base + (market ?? 0) + community + flow + adjustment, A.min, A.max);
  return { base: A.base, market, community, flow, adjustment, premium };
}

/** Ajustement Orvia (Espace Dev) en vigueur à une date : le dernier décidé avant elle. */
export function adjustmentAt(account: Pick<Account, 'settings'> | null | undefined, at: Date): number {
  let offset = 0;
  for (const a of account?.settings.ecuPremiumAdjustments ?? []) {
    if (new Date(a.at).getTime() <= at.getTime()) offset = a.offset;
  }
  return offset;
}

/** Prime en vigueur : marché simulé, plus l'ajustement éventuel décidé par Orvia dans l'Espace Dev. */
export function currentPremium(
  account: Pick<Account, 'settings' | 'transactions'> | null | undefined,
  gold: number,
  hourly: PricePoint[],
  at = new Date(),
): PremiumParts {
  return autoPremium({
    at,
    gold,
    goldAvg30: average30(hourly, 'gold', at.getTime()),
    netFlowEur: account ? ecuNetFlow(account.transactions, at) : 0,
    adjustment: adjustmentAt(account, at),
  });
}

/** Scénarios de marché réels, pour l'Espace Dev (ajustement en points ajouté à la prime automatique). */
export const PREMIUM_SCENARIOS: { id: string; label: string; offset: number; when: string }[] = [
  {
    id: 'calm',
    label: 'Désaffection',
    offset: -0.015,
    when: 'Or au plus haut, beaucoup de clients vendent pour encaisser leurs gains, peu d’acheteurs.',
  },
  {
    id: 'normal',
    label: 'Normal',
    offset: 0,
    when: 'Marché habituel : prime de 4 à 5 %, comme un or fractionné stocké.',
  },
  {
    id: 'demand',
    label: 'Forte demande',
    offset: 0.02,
    when: 'Or en forte baisse ou inquiétude économique : les achats affluent, les fondeurs sont chargés.',
  },
  {
    id: 'crisis',
    label: 'Crise',
    offset: 0.05,
    when: 'Panique financière (2008, mars 2020) : pénurie de pièces et petits lingots, primes de 8 à 12 %.',
  },
];

/** Historique du prix du Gold Oria et du Gold Spot (€/g), à partir des relevés horaires. */
export function ecuHistory(
  account: Pick<Account, 'settings' | 'transactions'> | null | undefined,
  hourly: PricePoint[],
): { t: string; gold: number; ecu: number; premium: number }[] {
  return hourly.map((p, i) => {
    const at = new Date(p.t);
    const premium = currentPremium(account, p.prices.gold, hourly.slice(0, i + 1), at).premium;
    return { t: p.t, gold: p.prices.gold, ecu: ecuPrice(p.prices.gold, premium), premium };
  });
}
