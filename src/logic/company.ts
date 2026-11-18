/**
 * Tableau de bord « Société Orvia » : ce que la société aurait gagné et dépensé avec les opérations de ce compte
 * (compte principal et comptes enfants). Les revenus viennent des frais réellement prélevés ; les coûts sont des
 * estimations (garde, assurance, vérification d'identité, fidélité). Repères indicatifs, à affiner.
 */
import { loyalty, LOYALTY } from './loyalty.ts';
import { accountValue } from './ledger.ts';
import { type Account, type Metal, METALS, type Prices, type Transaction } from './types.ts';

export const COMPANY = {
  /**
   * Garde chez Godot & Fils (GardienOr, stockage en France) : 0,04 € par mois et par gramme d'or (0,48 € par an),
   * 0,005 € par mois pour l'argent (0,06 € par an). Tarif public : un tarif professionnel est à négocier.
   */
  custodyPerGramYear: { gold: 0.48, silver: 0.06 } as Partial<Record<Metal, number>>,
  /** Garde des métaux sans tarif au gramme connu (platine), par an, en part de leur valeur. */
  custodyYearly: { gold: 0, silver: 0, platinum: 0.0012 } as Record<Metal, number>,
  /** Commission versée par le commerçant sur un paiement par carte (plafond européen d'une carte de débit). */
  interchange: 0.002,
  /** Vérification d'identité et anti-blanchiment, par compte ouvert. */
  kycPerAccount: 3,
  /** Frais fixes d'une petite fintech (équipe, conformité, audit, appli), par an. */
  fixedYearly: 400_000,
} as const;

export type CompanyPeriod = 'year' | 'all';

export interface CompanyReport {
  years: number;
  revenue: {
    buy: number;
    sale: number;
    conversion: number;
    dormancy: number;
    custody: number;
    physical: number;
    card: number;
    total: number;
  };
  costs: { custody: number; kyc: number; loyalty: number; referral: number; physical: number; total: number };
  margin: number;
  marginPerYear: number;
  /** Clients comme celui-ci nécessaires pour couvrir les frais fixes. */
  breakEvenClients: number | null;
  /** Impôt retenu pour l'État (pas un revenu). */
  taxCollected: number;
  assets: number;
  operations: number;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export function companyReport(
  account: Account,
  prices: Prices,
  period: CompanyPeriod = 'all',
  now = new Date(),
): CompanyReport {
  const from = period === 'year' ? now.getTime() - 365.25 * 86_400_000 : new Date(account.createdAt).getTime();
  const years = Math.max(1 / 12, (now.getTime() - from) / (365.25 * 86_400_000));
  const wallets = [account, ...account.children];
  const txs: Transaction[] = wallets.flatMap((w) =>
    w.transactions.filter((t) => {
      const time = new Date(t.date).getTime();
      return time >= from && time <= now.getTime();
    }),
  );
  const sum = (f: (t: Transaction) => number) => txs.reduce((s, t) => s + f(t), 0);
  const revenue = {
    buy: sum((t) => (t.kind === 'buy' ? (t.fees ?? 0) : 0)),
    sale: sum((t) => (t.kind === 'sell' || t.kind === 'transfer_iban' ? (t.fees ?? 0) : 0)),
    conversion: sum((t) => (t.kind === 'convert' ? (t.fees ?? 0) : 0)),
    dormancy: sum((t) => (t.kind === 'fee_dormancy' ? t.eur : 0)),
    custody: sum((t) => (t.kind === 'fee_custody' ? t.eur : 0)),
    physical: sum((t) => (t.kind === 'withdraw_physical' ? (t.fees ?? 0) : 0)),
    card: sum((t) => (t.kind === 'card_payment' ? t.eur * COMPANY.interchange : 0)),
    total: 0,
  };
  revenue.total =
    revenue.buy +
    revenue.sale +
    revenue.conversion +
    revenue.dormancy +
    revenue.custody +
    revenue.physical +
    revenue.card;

  const assets = wallets.reduce((s, w) => s + accountValue(w, prices).total, 0);
  // Louis gagnés sur la période (échangés ou encore dus) : un coût pour la société.
  const earnedBefore = period === 'all' ? 0 : loyalty(account, new Date(from)).earned;
  const loyaltyCost = (loyalty(account, now).earned - earnedBefore) * LOYALTY.eurPerLou;
  const accountsOpened = wallets.filter((w) => new Date(w.createdAt).getTime() >= from).length;
  const costs = {
    custody:
      // Lingotins gardés en coffre chez Godot & Fils : leur garde est facturée à Orvia, au gramme.
      (account.homeVault ?? [])
        .filter((b) => b.vault || /godot|gold avenue/i.test(b.placeNote ?? '') || b.origin === 'pro')
        .reduce((s, b) => s + b.grams * (COMPANY.custodyPerGramYear.gold ?? 0), 0) *
        years +
      wallets.reduce(
        (s, w) =>
          s +
          METALS.reduce(
            (m, metal) =>
              m +
              (COMPANY.custodyPerGramYear[metal] !== undefined
                ? w.holdings[metal] * (COMPANY.custodyPerGramYear[metal] ?? 0)
                : accountValue(w, prices).byMetal[metal] * COMPANY.custodyYearly[metal]),
            0,
          ),
        0,
      ) *
        years,
    kyc: accountsOpened * COMPANY.kycPerAccount,
    loyalty: loyaltyCost,
    referral: sum((t) => (t.kind === 'referral_bonus' ? t.eur : 0)),
    // Lingotins et transport assuré achetés au prix de gros : environ 80 % de ce que paie le client.
    // Coût réel quand les primes du vendeur sont connues, sinon environ 80 % de ce que paie le client.
    physical: sum((t) => (t.kind === 'withdraw_physical' ? (t.costEur ?? (t.fees ?? 0) * 0.8) : 0)),
    total: 0,
  };
  costs.total = costs.custody + costs.kyc + costs.loyalty + costs.referral + costs.physical;
  const margin = revenue.total - costs.total;
  const marginPerYear = margin / years;
  return {
    years,
    revenue: Object.fromEntries(Object.entries(revenue).map(([k, v]) => [k, r2(v)])) as CompanyReport['revenue'],
    costs: Object.fromEntries(Object.entries(costs).map(([k, v]) => [k, r2(v)])) as CompanyReport['costs'],
    margin: r2(margin),
    marginPerYear: r2(marginPerYear),
    breakEvenClients: marginPerYear > 0 ? Math.ceil(COMPANY.fixedYearly / marginPerYear) : null,
    taxCollected: r2(sum((t) => t.tax ?? 0)),
    assets: r2(assets),
    operations: txs.length,
  };
}
