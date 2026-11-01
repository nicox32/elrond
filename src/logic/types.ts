export type Metal = 'gold' | 'silver' | 'platinum';

export const METALS: Metal[] = ['gold', 'silver', 'platinum'];

/** Prix en euros par gramme, pour chaque métal. */
export type Prices = Record<Metal, number>;

/** Quantités en grammes, pour chaque métal. */
export type Holdings = Record<Metal, number>;

export type PriceSource = 'live' | 'cache' | 'reference';

export interface PriceQuote {
  prices: Prices;
  /** Date des cours (ISO). */
  fetchedAt: string;
  source: PriceSource;
}

/** Unité d'affichage et de saisie des quantités. */
export type WeightUnit = 'g' | 'oz';

/** Unité d'une saisie : en euros ou en poids. */
export type AmountUnit = 'eur' | WeightUnit;

export interface Quantity {
  unit: AmountUnit;
  value: number;
}

export type TransactionKind = 'buy' | 'sell' | 'convert' | 'transfer_member' | 'transfer_iban';

export interface Transaction {
  id: string;
  kind: TransactionKind;
  date: string; // ISO
  /** Variation des grammes détenus, par métal (négatif = sortie). */
  deltas: Holdings;
  /** Montant en euros de l'opération. */
  eur: number;
  label: string;
}

export type BeneficiaryKind = 'member' | 'iban';

export interface Beneficiary {
  id: string;
  kind: BeneficiaryKind;
  name: string;
  /** Identifiant membre (e-mail ou téléphone) ou IBAN. */
  identifier: string;
}

export interface BalancePoint {
  date: string; // ISO
  total: number; // euros
}

export interface Settings {
  unit: WeightUnit;
  biometrics: boolean;
}

export interface Account {
  version: 2;
  holder: string;
  /** Identifiant membre, utilisé pour recevoir des virements de métal. */
  memberId: string;
  iban: string;
  createdAt: string;
  holdings: Holdings;
  transactions: Transaction[];
  beneficiaries: Beneficiary[];
  balanceHistory: BalancePoint[];
  settings: Settings;
}
