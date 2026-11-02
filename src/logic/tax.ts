/**
 * Plus-value latente et impôt à la revente des métaux précieux pour un particulier en France (règles 2026).
 *
 * Deux régimes au choix du vendeur, à chaque vente (CGI art. 150 VI à 150 VM) :
 * - taxe forfaitaire sur les métaux précieux (TMP), par défaut : 11 % + 0,5 % de CRDS = 11,5 % du prix de vente,
 *   gain ou perte ;
 * - régime des plus-values, sur option, si l'on peut prouver la date et le prix d'achat (facture, relevé) :
 *   19 % d'impôt + 18,6 % de prélèvements sociaux (LFSS 2026, taux à confirmer : 17,2 % si non concerné) = 37,6 %
 *   de la plus-value, avec un abattement (CGI art. 150 VC) de
 *   5 % par année de détention au-delà de la 2e : exonération totale après 22 ans. Pas d'impôt en cas de perte.
 * Pas de seuil d'exonération pour l'or, l'argent et le platine d'investissement (le seuil de 5 000 € vise les bijoux
 * et objets d'art). Estimation indicative : à faire confirmer par un conseiller fiscal.
 */
import { FEES } from './fees.ts';
import { type Metal, METALS, type Prices, type Wallet } from './types.ts';

export const TAX = {
  /** Taxe forfaitaire sur les métaux précieux, CRDS comprise, sur le prix de vente. */
  flat: 0.115,
  /** Impôt sur le revenu au taux forfaitaire, sur la plus-value. */
  incomeTax: 0.19,
  /** Prélèvements sociaux 2026 (CSG, CRDS, prélèvement de solidarité), sur la plus-value. */
  /** Hausse de la CSG de la LFSS 2026 : application à cette plus-value à confirmer (17,2 % sinon). */
  social: 0.186,
  /** Abattement par année pleine de détention au-delà de la 2e. */
  allowancePerYear: 0.05,
  allowanceFromYear: 3,
  exemptAfterYears: 22,
  /** Écu Orvia, régime des jetons : taxe forfaitaire de 6 % + 0,5 % de CRDS sur le prix de vente… */
  tokenFlat: 0.065,
  /** … et aucune taxe pour une vente jusqu'à ce montant. */
  tokenExemptUpTo: 5000,
} as const;

export const GAIN_RATE = TAX.incomeTax + TAX.social;

/** Un lot de métal acquis à une date, pour un coût en euros (frais d'achat compris). */
export interface Lot {
  date: string;
  grams: number;
  cost: number;
}

/** Années pleines entre deux dates. */
export function fullYears(from: Date, to: Date): number {
  let years = to.getFullYear() - from.getFullYear();
  const anniversary = new Date(from);
  anniversary.setFullYear(from.getFullYear() + years);
  if (anniversary.getTime() > to.getTime()) years -= 1;
  return Math.max(0, years);
}

/** Abattement pour durée de détention : 0 % les 2 premières années, puis 5 % par an, 100 % après 22 ans. */
export function holdingAllowance(years: number): number {
  if (years < TAX.allowanceFromYear) return 0;
  return Math.min(1, (years - (TAX.allowanceFromYear - 1)) * TAX.allowancePerYear);
}

/**
 * Lots détenus aujourd'hui, par métal, en premier entré, premier sorti : chaque sortie (vente, virement, paiement,
 * frais…) consomme d'abord les lots les plus anciens. Achats : prix payé ; versement familial ou conversion : valeur
 * au cours du jour ; bonus de parrainage : coût nul.
 */
export function holdingLots(wallet: Pick<Wallet, 'transactions'>): Record<Metal, Lot[]> {
  const lots: Record<Metal, Lot[]> = { gold: [], silver: [], platinum: [], ecu: [] };
  const txs = [...wallet.transactions].sort((a, b) => a.date.localeCompare(b.date));
  for (const tx of txs) {
    const inflows = METALS.filter((m) => tx.deltas[m] > 0);
    const inflowGrams = inflows.reduce((s, m) => s + tx.deltas[m], 0);
    for (const m of METALS) {
      const delta = tx.deltas[m];
      if (delta > 0) {
        // Conversion : le nouveau métal coûte ce qui a été réinvesti (après frais de conversion et impôt).
        const paid = tx.kind === 'convert' ? tx.eur * (1 - FEES.conversion) - (tx.tax ?? 0) : tx.eur;
        const cost = tx.kind === 'referral_bonus' ? 0 : inflows.length === 1 ? paid : (paid * delta) / inflowGrams;
        lots[m].push({ date: tx.date, grams: delta, cost });
      } else if (delta < 0) {
        let out = -delta;
        while (out > 1e-9 && lots[m].length) {
          const lot = lots[m][0];
          if (lot.grams <= out + 1e-9) {
            out -= lot.grams;
            lots[m].shift();
          } else {
            const share = out / lot.grams;
            lots[m][0] = { ...lot, grams: lot.grams - out, cost: lot.cost * (1 - share) };
            out = 0;
          }
        }
      }
    }
  }
  return lots;
}

export interface MetalTax {
  metal: Metal;
  grams: number;
  /** Prix de revient (euros payés, frais d'achat compris). */
  cost: number;
  /** Prix de vente au cours du jour, après frais de revente. */
  value: number;
  /** Plus-value brute (négative = moins-value). */
  gain: number;
  gainPercent: number;
  /** Taxe forfaitaire (11,5 % du prix de vente). */
  flatTax: number;
  /** Impôt au régime des plus-values (37,6 % après abattement) ; null sans justificatif d'achat. */
  gainTax: number | null;
  /** Durée de détention moyenne pondérée, en années pleines. */
  avgYears: number;
  /** Abattement moyen appliqué (0 à 1), pondéré par la plus-value. */
  allowance: number;
  best: 'flat' | 'gain';
  /** Écu Orvia vendu pour 5 000 € au plus : exonéré. */
  tokenExempt?: boolean;
  tax: number;
  net: number;
  netGain: number;
  netGainPercent: number;
}

export interface TaxEstimate {
  metals: MetalTax[];
  cost: number;
  value: number;
  gain: number;
  gainPercent: number;
  tax: number;
  netGain: number;
  netGainPercent: number;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Estime l'impôt si tout le métal était vendu aujourd'hui, en choisissant pour chaque métal le régime le moins cher. */
export function estimateTax(
  wallet: Pick<Wallet, 'transactions' | 'holdings'>,
  prices: Prices,
  now = new Date(),
): TaxEstimate {
  const allLots = holdingLots(wallet);
  const metals: MetalTax[] = [];
  for (const m of METALS) {
    const grams = wallet.holdings[m];
    const value = grams * prices[m] * (1 - FEES.sale);
    if (grams <= 1e-6 || value <= 0) continue;
    const t = saleTax(wallet, m, grams, value, now, allLots[m]);
    metals.push({
      metal: m,
      grams,
      cost: t.cost,
      value: t.price,
      gain: t.gain,
      gainPercent: t.cost > 0 ? (t.gain / t.cost) * 100 : 0,
      flatTax: t.flatTax,
      gainTax: t.gainTax,
      avgYears: t.years,
      allowance: t.allowance,
      best: t.regime,
      tokenExempt: t.tokenExempt,
      tax: t.tax,
      net: t.net,
      netGain: r2(t.net - t.cost),
      netGainPercent: t.cost > 0 ? ((t.net - t.cost) / t.cost) * 100 : 0,
    });
  }
  const cost = metals.reduce((s, x) => s + x.cost, 0);
  const total = metals.reduce((s, x) => s + x.value, 0);
  const tax = metals.reduce((s, x) => s + x.tax, 0);
  return {
    metals,
    cost: r2(cost),
    value: r2(total),
    gain: r2(total - cost),
    gainPercent: cost > 0 ? ((total - cost) / cost) * 100 : 0,
    tax: r2(tax),
    netGain: r2(total - tax - cost),
    netGainPercent: cost > 0 ? ((total - tax - cost) / cost) * 100 : 0,
  };
}

export type TaxRegime = 'flat' | 'gain';

export const REGIME_LABEL: Record<TaxRegime, string> = {
  flat: 'taxe forfaitaire',
  gain: 'régime des plus-values',
};

/** Impôt d'une cession (vente, virement vers une banque, paiement par carte, conversion). */
export interface SaleTax {
  grams: number;
  /** Prix de cession, frais Orvia déduits, avant impôt. */
  price: number;
  /** Prix de revient des grammes cédés (premiers achetés). */
  cost: number;
  gain: number;
  /** Abattement pour durée de détention, pondéré par la plus-value (0 à 1). */
  allowance: number;
  /** Durée de détention moyenne des grammes cédés, en années pleines. */
  years: number;
  flatTax: number;
  /** null : pas de justificatif d'achat pour tous les grammes, seule la taxe forfaitaire est possible. */
  gainTax: number | null;
  regime: TaxRegime;
  tax: number;
  /** Ce qui reste après impôt. */
  net: number;
  /** Vente d'Écus Orvia jusqu'à 5 000 € : exonérée. */
  tokenExempt?: boolean;
  /** Écu Orvia : régime des jetons (taxe forfaitaire de 6,5 %). */
  token?: boolean;
}

/**
 * Impôt dû sur la cession de `grams` de métal pour `price` euros : les grammes cédés sont les premiers achetés.
 * Le régime le moins cher est retenu.
 */
export function saleTax(
  wallet: Pick<Wallet, 'transactions'>,
  metal: Metal,
  grams: number,
  price: number,
  now = new Date(),
  lots = holdingLots(wallet)[metal],
): SaleTax {
  const perGram = grams > 0 ? price / grams : 0;
  let left = grams;
  let cost = 0;
  let taxable = 0;
  let positive = 0;
  let allowed = 0;
  let weightedYears = 0;
  for (const lot of lots) {
    if (left <= 1e-9) break;
    const g = Math.min(lot.grams, left);
    const lotCost = lot.cost * (g / lot.grams);
    const years = fullYears(new Date(lot.date), now);
    const lotGain = g * perGram - lotCost;
    const allowance = lotGain > 0 ? holdingAllowance(years) : 0;
    cost += lotCost;
    taxable += lotGain * (1 - allowance);
    if (lotGain > 0) {
      positive += lotGain;
      allowed += lotGain * allowance;
    }
    weightedYears += years * g;
    left -= g;
  }
  const proven = left <= 1e-6;
  // Écu Orvia : régime des jetons, exonéré jusqu'à 5 000 € de prix de vente, puis 6,5 %.
  const token = metal === 'ecu';
  const exempt = token && price <= TAX.tokenExemptUpTo + 1e-9;
  const flatTax = exempt ? 0 : r2(Math.max(0, price) * (token ? TAX.tokenFlat : TAX.flat));
  const gainTax = exempt ? 0 : proven ? r2(Math.max(0, taxable) * GAIN_RATE) : null;
  const regime: TaxRegime = gainTax !== null && gainTax <= flatTax ? 'gain' : 'flat';
  const tax = regime === 'gain' ? gainTax! : flatTax;
  return {
    grams,
    price: r2(price),
    cost: r2(cost),
    gain: r2(price - cost),
    allowance: positive > 0 ? allowed / positive : 0,
    years: grams > 0 ? Math.floor(weightedYears / grams) : 0,
    flatTax,
    gainTax,
    regime,
    tax,
    net: r2(price - tax),
    tokenExempt: exempt,
    token,
  };
}

/**
 * Grammes à céder pour obtenir `target` euros nets d'impôt (et de `fixed` euros de frais fixes), au prix de
 * `perGram` euros par gramme frais compris. L'impôt croît moins vite que le prix : recherche par dichotomie.
 */
export function gramsForNet(
  wallet: Pick<Wallet, 'transactions'>,
  metal: Metal,
  target: number,
  perGram: number,
  fixed = 0,
  now = new Date(),
): number {
  const lots = holdingLots(wallet)[metal];
  const net = (g: number) => {
    const price = g * perGram - fixed;
    return price - saleTax(wallet, metal, g, Math.max(0, price), now, lots).tax;
  };
  // Sans impôt (vente exonérée ou sans plus-value) : calcul direct.
  const direct = (target + fixed) / perGram;
  if (saleTax(wallet, metal, direct, target, now, lots).tax === 0) return direct;
  const owned = lots.reduce((sum, l) => sum + l.grams, 0);
  let lo = 0;
  // Tout le métal suffit (au centime près) : on cherche dans ce qu'on possède, sinon au-delà (solde insuffisant).
  let hi = owned > 0 && net(owned) >= target - 0.005 ? owned : (target + fixed) / (perGram * (1 - GAIN_RATE)) + 1e-6;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (net(mid) < target) lo = mid;
    else hi = mid;
  }
  return hi;
}

/** Phrase courte pour l'aperçu d'une opération. */
export function describeTax(t: SaleTax): string {
  if (t.tokenExempt) return `Pas d’impôt : vente de Gold Oriental jusqu’à 5 000 €.`;
  if (t.tax <= 0) {
    return t.gain <= 0
      ? 'Pas d’impôt : pas de plus-value sur ce métal (régime des plus-values).'
      : `Pas d’impôt : plus-value exonérée après ${TAX.exemptAfterYears} ans de détention.`;
  }
  if (t.gainTax === null) {
    return `Impôt retenu : ${formatMoney(t.tax)} (taxe forfaitaire : pas de justificatif d’achat pour tout ce métal).`;
  }
  const other =
    t.regime === 'gain'
      ? `au lieu de ${formatMoney(t.flatTax)} en taxe forfaitaire${t.token ? ' des jetons' : ''}`
      : `au lieu de ${formatMoney(t.gainTax)} au régime des plus-values`;
  const label = t.token && t.regime === 'flat' ? 'taxe forfaitaire des jetons, 6,5 %' : REGIME_LABEL[t.regime];
  return `Impôt retenu : ${formatMoney(t.tax)} (${label}, le moins cher, ${other}).`;
}

const money = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });

function formatMoney(n: number): string {
  return money.format(n);
}

export interface TaxOutlookPoint {
  date: string;
  tax: number;
  regime: TaxRegime;
}

export interface TaxOutlook {
  metal: Metal;
  /** Impôt si tout ce métal était vendu aujourd'hui. */
  today: TaxOutlookPoint;
  /** Impôt à quelques dates à venir, à cours constant. */
  points: TaxOutlookPoint[];
  /** Premier mois où le régime des plus-values devient le moins cher (null : déjà le cas, ou jamais avant l'exonération). */
  gainRegimeFrom: string | null;
  /** Date à laquelle tout le métal détenu aujourd'hui sera exonéré (22 ans après le dernier achat). */
  exemptAt: string | null;
}

function addMonths(d: Date, months: number): Date {
  const x = new Date(d);
  x.setMonth(x.getMonth() + months);
  return x;
}

/**
 * Évolution de l'impôt si l'on garde tout le métal d'aujourd'hui, à cours constant : l'abattement pour durée de
 * détention fait baisser l'impôt au régime des plus-values jusqu'à l'exonération, 22 ans après chaque achat.
 */
export function taxOutlook(
  wallet: Pick<Wallet, 'transactions' | 'holdings'>,
  prices: Prices,
  metal: Metal,
  now = new Date(),
): TaxOutlook | null {
  const grams = wallet.holdings[metal];
  const price = grams * prices[metal] * (1 - FEES.sale);
  if (grams <= 1e-6 || price <= 0) return null;
  const lots = holdingLots(wallet)[metal];
  const at = (d: Date): TaxOutlookPoint => {
    const t = saleTax(wallet, metal, grams, price, d, lots);
    return { date: d.toISOString(), tax: t.tax, regime: t.regime };
  };
  const today = at(now);
  const proven = saleTax(wallet, metal, grams, price, now, lots).gainTax !== null;
  if (!proven) return { metal, today, points: [], gainRegimeFrom: null, exemptAt: null };

  const last = lots.reduce((d, l) => (l.date > d ? l.date : d), lots[0].date);
  const exempt = new Date(last);
  exempt.setFullYear(exempt.getFullYear() + TAX.exemptAfterYears);
  const exemptAt = exempt.getTime() > now.getTime() ? exempt.toISOString() : null;

  let gainRegimeFrom: string | null = null;
  if (today.regime !== 'gain') {
    for (let m = 1; m <= (TAX.exemptAfterYears + 1) * 12; m++) {
      const d = addMonths(now, m);
      if (at(d).regime === 'gain') {
        gainRegimeFrom = d.toISOString();
        break;
      }
    }
  }

  const points: TaxOutlookPoint[] = [];
  for (const years of [5, 10, 15]) {
    const d = addMonths(now, years * 12);
    if (!exemptAt || d.getTime() < exempt.getTime()) points.push(at(d));
  }
  if (exemptAt) points.push(at(addMonths(exempt, 0)));
  return { metal, today, points, gainRegimeFrom, exemptAt };
}
