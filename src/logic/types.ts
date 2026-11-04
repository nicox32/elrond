import type { AlertEvent, PriceAlert } from './alerts.ts';

/** Métaux cotés en direct. */
export type SpotMetal = 'gold' | 'silver' | 'platinum';

export const SPOT_METALS: SpotMetal[] = ['gold', 'silver', 'platinum'];

/** Métaux détenus. */
export type Metal = SpotMetal;

export const METALS: Metal[] = ['gold', 'silver', 'platinum'];

export type SpotPrices = Record<SpotMetal, number>;

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

export type TransactionKind =
  | 'buy'
  | 'sell'
  | 'convert'
  | 'transfer_member'
  | 'transfer_iban'
  /** Métal envoyé vers un autre compte de la famille (parent ↔ enfant). */
  | 'family_out'
  /** Métal reçu d'un autre compte de la famille. */
  | 'family_in'
  /** Frais d'oxydation prélevés sur un compte inactif. */
  | 'fee_dormancy'
  /** Paiement chez un commerçant avec la carte Orvia. */
  | 'card_payment'
  /** Retrait au distributeur avec la carte Orvia. */
  | 'card_withdrawal'
  /** Bonus de parrainage crédité. */
  | 'referral_bonus'
  /** Euros crédités sur le compte d'attente. */
  | 'cash_in'
  /** Euros du compte d'attente renvoyés vers le compte bancaire. */
  | 'cash_out'
  /** Louis de fidélité échangés contre du métal. */
  | 'loyalty_redeem';

export interface Transaction {
  id: string;
  kind: TransactionKind;
  date: string; // ISO
  /** Variation des grammes détenus, par métal (négatif = sortie). */
  deltas: Holdings;
  /**
   * Montant en euros de l'opération : payé (achat), reçu ou envoyé net de frais (vente, virement SEPA),
   * valeur au cours du moment (conversion, virement de métal, frais d'oxydation).
   */
  eur: number;
  /** Frais facturés sur l'opération, en euros. */
  fees?: number;
  label: string;
  /** Achat repris de l'épargne depuis 2019 (et non passé dans l'appli). */
  origin?: 'history2019' | 'childGifts2022';
  /** Achat passé par le bot d'achat sur baisse (simple ou double). */
  dip?: 'normal' | 'strong';
  /** Versement annulé (erreur corrigée sous 24 h). */
  reversed?: boolean;
  /** Louis de fidélité échangés (opération « loyalty_redeem »). */
  loyaltyLou?: number;
  /** Variation du compte d'attente en euros (achat payé depuis ce compte : négatif). */
  cash?: number;
  /** Impôt retenu sur une cession (vente, virement bancaire, carte, conversion), en euros. */
  tax?: number;
  /** Régime fiscal retenu pour cet impôt : taxe forfaitaire ou plus-values. */
  taxRegime?: 'flat' | 'gain';
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
  /** Répartition cible des achats, en % par métal (total 100). */
  allocation?: Record<SpotMetal, number>;
  /** Tableau de bord Société Orvia : empreinte salée de son code d'accès (le code lui-même n'est pas gardé). */
  devCodeHash?: string;
}

/** Ce qu'un compte détient et son historique (compte principal ou compte enfant). */
export interface Wallet {
  holdings: Holdings;
  transactions: Transaction[];
  createdAt: string;
  /** Les frais d'oxydation ont été prélevés jusqu'à cette date (ISO). */
  dormancyChargedThrough?: string;
  /** Aucun frais d'oxydation pour la période d'avant cette date : les 6 mois comptent à partir d'ici (ISO). */
  dormancyNotBefore?: string;
}

/** Motif obligatoire d'un retrait sur le compte d'un enfant : une dépense faite dans son intérêt. */
export type ChildWithdrawalPurpose = 'education' | 'health' | 'equipment' | 'activities' | 'other';

export interface ChildWithdrawalRequest {
  id: string;
  metal: Metal;
  grams: number;
  /** Valeur au moment de la demande, pour information. */
  eur: number;
  purpose: ChildWithdrawalPurpose;
  note?: string;
  createdAt: string;
  status: 'pending' | 'approved' | 'refused' | 'cancelled';
  decidedAt?: string;
}

export interface CoParent {
  name: string;
  /** Empreinte salée de son code de validation (jamais le code lui-même). */
  secret: string;
}

/** Compte enfant, géré depuis le compte principal. Gratuit. */
export interface ChildAccount extends Wallet {
  id: string;
  name: string;
  /** Date de naissance (AAAA-MM-JJ). Aucun frais avant les 18 ans ; sans date, le compte reste exonéré. */
  birthDate?: string;
  /** Autorité parentale : partagée (retraits validés par les deux parents) ou exercée seul. */
  authority?: 'joint' | 'sole';
  /** Second parent, qui valide les retraits quand l'autorité est partagée. */
  coParent?: CoParent;
  withdrawalRequests?: ChildWithdrawalRequest[];
  /** Le compte a été transféré à l'enfant devenu majeur (il n'est plus géré par le parent). */
  transferredAt?: string;
  transferCode?: string;
  /** Message affiché en haut du lien en lecture seule envoyé à l'autre parent. */
  shareNote?: string;
  /** Les dons mensuels depuis 2022 ont été repris (une seule fois). */
  gifts2022Imported?: boolean;
  /** Don mensuel du parent : rappel le jour prévu, ou don automatique. */
  giftPlan?: import('./childGiftPlan.ts').ChildGiftPlan;
}

/** Carte de paiement Orvia, adossée aux métaux du compte. */
export interface Card {
  /** Seuls les 4 derniers chiffres sont connus de l'appli. */
  last4: string;
  /** Date d'expiration « MM/AA ». */
  expiry: string;
  holderName: string;
  /** Métal vendu pour régler les paiements et retraits. */
  fundingMetal: Metal;
  frozen: boolean;
  issuedAt: string;
}

export interface Referral {
  /** Code à partager pour parrainer quelqu'un. */
  code: string;
  /** Code du parrain saisi par ce compte, s'il y en a un. */
  sponsorCode?: string;
  /** Le bonus de filleul a été versé. */
  bonusPaid?: boolean;
}

export interface Account extends Wallet {
  version: 2;
  holder: string;
  /** Identifiant membre, utilisé pour recevoir des virements de métal. */
  memberId: string;
  iban: string;
  beneficiaries: Beneficiary[];
  children: ChildAccount[];
  balanceHistory: BalancePoint[];
  settings: Settings;
  card?: Card;
  referral: Referral;
  /** Alertes de prix choisies par l'utilisateur. */
  alerts?: PriceAlert[];
  /** Alertes déclenchées (les plus récentes d'abord). */
  alertEvents?: AlertEvent[];
  /** L'épargne régulière depuis 2019 a été reprise (une seule fois). */
  history2019Imported?: boolean;
  /** Cours utilisés pour cette reprise : moyennes mensuelles réelles (sinon, anciennes moyennes annuelles). */
  history2019Prices?: 'monthly';
  /** Canal ntfy secret pour les alertes 24 h/24 envoyées par le serveur. */
  ntfyTopic?: string;
  /** Compte d'attente : euros disponibles pour acheter des métaux. */
  cashEur?: number;
  /** Achats programmés. */
  plan?: import('./plan.ts').BuyPlan;
  /** Bot d'achat sur baisse (en plus des achats programmés). */
  dipBot?: import('./dipBot.ts').DipBot;
}
