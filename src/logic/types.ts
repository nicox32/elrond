export type Metal = 'gold' | 'silver';

/** Prix en euros par gramme. */
export interface Prices {
  gold: number;
  silver: number;
}

export type TransactionKind = 'deposit' | 'withdraw' | 'convert' | 'transfer';

export interface Transaction {
  id: string;
  kind: TransactionKind;
  date: string; // ISO
  /** Variation des grammes détenus (négatif = sortie). */
  goldDelta: number;
  silverDelta: number;
  /** Montant en euros concerné (dépôt, retrait ou valeur au moment de l'opération). */
  eur: number;
  label: string;
}

export interface Account {
  holder: string;
  iban: string;
  goldGrams: number;
  silverGrams: number;
  /** Part de chaque dépôt placée en or (0 à 100), le reste en argent. */
  goldAllocation: number;
  transactions: Transaction[];
}
