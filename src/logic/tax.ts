/**
 * Plus-value latente et impôt à la revente des métaux précieux pour un particulier en France (règles 2026).
 *
 * Deux régimes au choix du vendeur, à chaque vente (CGI art. 150 VI à 150 VM) :
 * - taxe forfaitaire sur les métaux précieux (TMP), par défaut : 11 % + 0,5 % de CRDS = 11,5 % du prix de vente,
 *   gain ou perte ;
 * - régime des plus-values, sur option, si l'on peut prouver la date et le prix d'achat (facture, relevé) :
 *   19 % d'impôt + 18,6 % de prélèvements sociaux (LFSS 2026) = 37,6 % de la plus-value, avec un abattement de
 *   5 % par année de détention au-delà de la 2e : exonération totale après 22 ans. Pas d'impôt en cas de perte.
 * Pas de seuil d'exonération pour l'or, l'argent et le platine d'investissement (le seuil de 5 000 € vise les bijoux
 * et objets d'art). Estimation indicative : à faire confirmer par un conseiller fiscal.
 */
import { accountValue } from './ledger.ts';
import { type Metal, METALS, type Prices, type Wallet } from './types.ts';

export const TAX = {
  /** Taxe forfaitaire sur les métaux précieux, CRDS comprise, sur le prix de vente. */
  flat: 0.115,
  /** Impôt sur le revenu au taux forfaitaire, sur la plus-value. */
  incomeTax: 0.19,
  /** Prélèvements sociaux 2026 (CSG, CRDS, prélèvement de solidarité), sur la plus-value. */
  social: 0.186,
  /** Abattement par année pleine de détention au-delà de la 2e. */
  allowancePerYear: 0.05,
  allowanceFromYear: 3,
  exemptAfterYears: 22,
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
  const lots = { gold: [], silver: [], platinum: [] } as Record<Metal, Lot[]>;
  const txs = [...wallet.transactions].sort((a, b) => a.date.localeCompare(b.date));
  for (const tx of txs) {
    const inflows = METALS.filter((m) => tx.deltas[m] > 0);
    const inflowGrams = inflows.reduce((s, m) => s + tx.deltas[m], 0);
    for (const m of METALS) {
      const delta = tx.deltas[m];
      if (delta > 0) {
        const cost = tx.kind === 'referral_bonus' ? 0 : inflows.length === 1 ? tx.eur : (tx.eur * delta) / inflowGrams;
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
  /** Impôt au régime des plus-values (37,6 % après abattement). */
  gainTax: number;
  /** Durée de détention moyenne pondérée, en années pleines. */
  avgYears: number;
  /** Abattement moyen appliqué (0 à 1), pondéré par la plus-value. */
  allowance: number;
  best: 'flat' | 'gain';
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
  const lots = holdingLots(wallet);
  const value = accountValue(wallet, prices).byMetal;
  const metals: MetalTax[] = [];
  for (const m of METALS) {
    const grams = wallet.holdings[m];
    if (grams <= 1e-6 || value[m] <= 0) continue;
    const metalLots = lots[m];
    const lotGrams = metalLots.reduce((s, l) => s + l.grams, 0) || grams;
    const pricePerGram = value[m] / grams;
    let cost = 0;
    let taxableGain = 0;
    let positiveGain = 0;
    let allowedGain = 0;
    let weightedYears = 0;
    for (const lot of metalLots) {
      const years = fullYears(new Date(lot.date), now);
      const lotValue = lot.grams * pricePerGram;
      const lotGain = lotValue - lot.cost;
      cost += lot.cost;
      weightedYears += years * lot.grams;
      // La plus-value se calcule sur la vente entière : les pertes d'un lot compensent les gains d'un autre.
      const allowance = lotGain > 0 ? holdingAllowance(years) : 0;
      taxableGain += lotGain * (1 - allowance);
      if (lotGain > 0) {
        positiveGain += lotGain;
        allowedGain += lotGain * allowance;
      }
    }
    const gain = value[m] - cost;
    const flatTax = value[m] * TAX.flat;
    const gainTax = Math.max(0, taxableGain) * GAIN_RATE;
    const best = gainTax <= flatTax ? 'gain' : 'flat';
    const tax = Math.min(flatTax, gainTax);
    const net = value[m] - tax;
    metals.push({
      metal: m,
      grams,
      cost: r2(cost),
      value: r2(value[m]),
      gain: r2(gain),
      gainPercent: cost > 0 ? (gain / cost) * 100 : 0,
      flatTax: r2(flatTax),
      gainTax: r2(gainTax),
      avgYears: Math.floor(weightedYears / lotGrams),
      allowance: positiveGain > 0 ? allowedGain / positiveGain : 0,
      best,
      tax: r2(tax),
      net: r2(net),
      netGain: r2(net - cost),
      netGainPercent: cost > 0 ? ((net - cost) / cost) * 100 : 0,
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
