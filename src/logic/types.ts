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
  /** Lingotin donné à un enfant : reste chez le parent, seule la propriété change (pas de métal déplacé). */
  | 'gift_bar'
  /** Frais d'oxydation prélevés sur un compte inactif. */
  | 'fee_dormancy'
  /** Frais de garde en coffre, prélevés en métal chaque mois. */
  | 'fee_custody'
  /** Or retiré du coffre en lingotins, livré au titulaire (pas une vente). */
  | 'withdraw_physical'
  /** Lingotin défectueux retiré du compte : or recrédité et frais remboursés. */
  | 'bar_refund'
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
  /** Coût pour Orvia (retrait physique : lingotins achetés au vendeur et livraison), quand il est connu. */
  costEur?: number;
  /** Valeur de chaque métal quand l'opération en touche plusieurs à la fois (frais de garde, d'oxydation). */
  eurByMetal?: Partial<Record<Metal, number>>;
  label: string;
  /** Achat repris de l'épargne depuis 2019 (et non passé dans l'appli). */
  origin?: 'history2019' | 'childGifts2022' | 'history900';
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
  /** Frais du retrait physique réglables dans Société Orvia (absent = valeurs par défaut). */
  physicalFees?: {
    /** Fabrication ou prime facturée au client, par produit (« g5 », « g10 »…), en part de la valeur de l'or. */
    premiums?: Record<string, number>;
    /** Prime payée au vendeur, par produit : sert à calculer la marge et le coût dans Société Orvia. */
    vendor?: Record<string, number>;
    /** Livraison facturée par envoi, en euros. */
    delivery?: number;
    /** Livraison payée au vendeur par commande, en euros (sert au coût dans Société Orvia). */
    vendorDelivery?: number;
    /** Délai de livraison en jours selon l'origine du lingotin : stock d'Orvia, stock chez le revendeur, commande. */
    leadDays?: { maison?: number; pro?: number; commande?: number };
    /** Remises de quantité du revendeur par produit (mêmes paliers pour tous : 10, 20 et 50 pièces), en part de l'or. */
    vendorTiers?: Record<string, { from: number; off: number }[]>;
    /** Livraison payée au vendeur selon la valeur de la commande : à partir de `fromEur`, elle coûte `cost` euros. */
    vendorDeliveryTiers?: { fromEur: number; cost: number }[];
    /** Livraison offerte à partir de ce poids d'or dans l'envoi (g). */
    freeFromGrams?: number;
    /** Marge d'Orvia autorisée sur la prime du vendeur, en points de % de la valeur de l'or (défaut : 0,5 à 3). */
    marginMinPt?: number;
    marginMaxPt?: number;
  };
  /**
   * Primes de Godot & Fils relevées avec le calcul de prime (seul moyen de les changer) : prime nette de 1 à 9 pièces et
   * remises des tranches suivantes, en part de la valeur de l'or, avec la date du relevé.
   */
  vendorQuotes?: Record<string, { premium: number; offs: number[]; at: string }>;
  /** Marges des contrôles de lingots (Société Orvia) : pesée en grammes, dimensions en millimètres. */
  barTolerance?: { weightG: number; dimMm: number };
  /** Délai passé en arrière-plan avant de redemander le code, en secondes (absent = 5 minutes ; 0 = tout de suite). */
  lockDelaySec?: number;
  /** Afficher la dernière alerte sur l'accueil (absent = non : la notification suffit). */
  homeAlerts?: boolean;
  /** Alertes de l'accueil déjà masquées : celles datées d'avant cet instant (ISO) ne s'affichent plus. */
  homeAlertSeenAt?: string;
  /** Plafond de l'assurance des lingotins et pièces en stock, en euros (absent : 250 000 €). */
  insuranceCapEur?: number;
  /** Afficher la carte Orvia sur l'accueil (absent = oui). Masquée, elle reste accessible depuis le profil. */
  homeCard?: boolean;
  /** Mode discret : montants masqués sur l'accueil (œil à côté du solde). */
  discreet?: boolean;
  /** Frais de garde en coffre appliqués (réglage de la société ; absent = oui). */
  custodyFees?: boolean;
  /** Adresse postale du titulaire, affichée sur les relevés (et ceux des comptes enfants). */
  address?: PostalAddress;
  /** L'adresse des relevés est enregistrée et verrouillée : seule la société peut la rouvrir (Société Orvia). */
  addressUnlocked?: boolean;
}

/** Signature dessinée à l'écran : tracé SVG (coordonnées dans une boîte w × h) et date. */
export interface QuarterSignature {
  signedAt: string;
  path: string;
  w: number;
  h: number;
}

/** Ordre en attente de la réouverture du marché. */
export interface PendingOrder {
  id: string;
  createdAt: string;
  kind: 'buy' | 'sell' | 'convert' | 'split' | 'gift';
  metal?: Metal;
  target?: Metal;
  q?: Quantity;
  speed?: 'deferred' | 'immediate';
  source?: 'card' | 'cash';
  /** Achat réparti : euros par métal. */
  amounts?: Partial<Record<Metal, number>>;
  /** Don à un enfant. */
  childId?: string;
}

/** Un lingotin d'or retiré du coffre Orvia. */
export interface HomeBar {
  id: string;
  /** Produit : « g5 », « g10 », « g20 » ou « oz1 ». */
  product: string;
  grams: number;
  orderedAt: string;
  status: 'preparing' | 'received';
  receivedAt?: string;
  /** Retrait en agence du revendeur (ville ou agence) : le lingotin n'est pas livré à domicile. */
  pickupAgency?: string;
  /** Lingotin gardé en coffre sécurisé chez le revendeur (jamais livré chez le client). */
  vault?: boolean;
  /** Retrait demandé d'un lingotin gardé en coffre : livraison à domicile ou retrait en agence. */
  exitRequest?: { mode: 'home' | 'agency'; agency?: string; at: string };
  /** Date à laquelle le lingotin est sorti du coffre et remis au client. */
  exitedAt?: string;
  serial?: string;
  /** Prix de revient du métal (achat d'origine, frais compris), pour l'impôt à la revente. */
  cost: number;
  /** Part des frais du retrait payée pour ce lingotin (€) : remboursée s'il est refusé au contrôle. */
  feesPaid?: number;
  /** Dates d'achat d'origine du métal (le plus ancien et le plus récent) : la durée de détention continue. */
  acquiredFrom: string;
  acquiredTo: string;
  /** Opération de retrait correspondante. */
  txId: string;
  /** Poids de référence mesuré à la réception (g) : sert aux recontrôles par pesée. */
  weightRef?: number;
  /** Le poids de référence a été pris avec le blister (lingotin scellé, jamais ouvert). */
  weightRefBlister?: boolean;
  /** Contrôles faits sur cet objet (réception, recontrôles, levée d'anomalie), du plus ancien au plus récent. */
  checks?: BarCheck[];
  /** D'où vient l'objet : stock de la société, coffre professionnel, ou commande chez le revendeur. */
  origin?: 'maison' | 'pro' | 'commande';
  /** Lot du stock dans lequel il a été pris. */
  lotId?: string;
  /** Numéro de série prévu par le stock (à confirmer à la réception). */
  expectedSerial?: string;
  /**
   * Où il est gardé, choisi à la main. Absent : le lieu suit automatiquement l'état du lingotin (préparation, coffre
   * sécurisé, agence, remis). « maison » et « banque » sont d'anciennes valeurs, encore lues.
   */
  place?: 'maison' | 'banque' | 'orvia' | 'coffre' | 'agence' | 'route' | 'client' | 'autre';
  /** Précision du lieu : nom de la banque, adresse, proche… */
  placeNote?: string;
  /** Sécurité maximale : ni déplacé ni vendu avant cette date (la majorité de l'enfant), ISO. */
  lockedUntil?: string;
  /** Enfant propriétaire du lingotin (don : l'objet reste chez le parent, seule la propriété est cédée). */
  ownerChildId?: string;
  giftedAt?: string;
  /** Valeur de l'or au jour du don (€). */
  giftValue?: number;
  /** Référence interne Orvia, tirée au hasard (jamais le numéro gravé par l'affinerie). */
  ref?: string;
}

/** Un lot de lingotins ou de pièces en stock : plusieurs exemplaires du même format, au même endroit. */
export interface StockLot {
  id: string;
  /** Produit : « g5 », « g10 », « g20 », « oz1 » ou « nap20 ». */
  product: string;
  /** « maison » : chez la société ; « pro » : coffre professionnel (expédié à la demande). */
  source: 'maison' | 'pro';
  /** Exemplaires restants et exemplaires entrés. */
  qty: number;
  qtyInitial: number;
  addedAt: string;
  /** Nom du coffre professionnel. */
  vault?: string;
  /** Prix payé au vendeur par exemplaire, métal compris (€). Information : n'entre pas dans les comptes. */
  unitCost?: number;
  /** Cours de l'or (€/g) au moment de l'entrée du lot : sépare, dans le prix payé, le métal et la prime du vendeur. */
  goldPriceAtEntry?: number;
  /** Numéros de série connus et pas encore attribués, dans l'ordre de sortie. */
  serials?: string[];
  /** Références internes Orvia (aléatoires) des exemplaires restants, dans l'ordre de sortie. */
  refs?: string[];
  note?: string;
}

/** Un mouvement du stock : entrée, sortie vers un client, ou ajustement à l'inventaire. */
export interface StockMove {
  id: string;
  date: string;
  kind: 'in' | 'out' | 'adjust';
  product: string;
  /** Quantité (positive pour une entrée, négative pour une sortie ou une perte). */
  qty: number;
  source: 'maison' | 'pro';
  lotId?: string;
  note?: string;
}

/** Lingotin ou pièce refusé au contrôle : retiré du compte du client, renvoyé à Godot & Fils. */
export interface ReturnedBar {
  id: string;
  product: string;
  grams: number;
  serial?: string;
  ref?: string;
  /** Motif : les vérifications non conformes, ou le motif saisi. */
  reason: string;
  returnedAt: string;
  /** Or recrédité au client (g) et frais remboursés (€). */
  refundGold: number;
  refundEur: number;
  /** Propriétaire : enfant, ou le titulaire (absent). */
  ownerChildId?: string;
  /** Suivi chez le fournisseur : à renvoyer, renvoyé, remplacé ou remboursé à Orvia. */
  status: 'to_send' | 'sent' | 'replaced' | 'credited';
  statusAt?: string;
  note?: string;
}

/** Un contrôle d'un lingotin ou d'une pièce (base interne, Société Orvia). */
export interface BarCheck {
  date: string;
  kind: 'reception' | 'recheck' | 'resolved';
  /** Poids mesuré (g). */
  weight?: number;
  /** Dimensions mesurées (mm). */
  measures?: { length?: number; width?: number; thickness?: number; diameter?: number };
  ok: boolean;
  /** Vérifications non conformes. */
  failed?: string[];
  /** Contrôle fait sous blister scellé : pesée avec la carte, dimensions non mesurées. */
  blister?: boolean;
  note?: string;
}

export interface RetirementGoal {
  target: number;
  date: string;
  /** Hausse annuelle supposée des métaux pour la projection (0 = prudente). */
  growth?: number;
  /** Ce qui compte pour l'objectif : tout le compte principal, ou l'or seul. */
  scope?: 'all' | 'gold';
}

export interface PostalAddress {
  /** Civilité et nom tels qu'imprimés (ex. « M. Nicolas Moga ») ; sinon le prénom du compte. */
  name?: string;
  street: string;
  postcode: string;
  city: string;
}

/** Ce qu'un compte détient et son historique (compte principal ou compte enfant). */
export interface Wallet {
  holdings: Holdings;
  transactions: Transaction[];
  createdAt: string;
  /** Les frais d'oxydation ont été prélevés jusqu'à cette date (ISO). */
  dormancyChargedThrough?: string;
  /** Frais de garde prélevés jusqu'à ce début de mois (ISO). Absent : la garde commence au prochain mois. */
  custodyChargedThrough?: string;
  /** Aucun frais d'oxydation pour la période d'avant cette date : les 6 mois comptent à partir d'ici (ISO). */
  dormancyNotBefore?: string;
  /** Garde des lingotins en coffre sécurisé prélevée jusqu'à ce début de mois (ISO). */
  vaultChargedThrough?: string;
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
  /** Numéro de membre Orvia du compte enfant, aléatoire : « OV-E-XXXX-XXXX » (jamais un numéro officiel). */
  memberNumber?: string;
  /** Le choix des parents (autorité parentale) est verrouillé une fois fait : la société peut le rouvrir. */
  parentsUnlocked?: boolean;
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
  /** Trimestres dont les dons ont été déclarés (« 2026-T4 »). */
  declaredQuarters?: string[];
  /** Récapitulatifs de dons signés dans l'appli, par trimestre (« 2026-T4 »). */
  signedQuarters?: Record<string, QuarterSignature>;
  /** Dernier trimestre pour lequel le rappel de déclaration a été envoyé. */
  declarationRemindedFor?: string;
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
  /** Ancien n° de membre du compte enfant, quand ce compte adulte en est issu (à la majorité). */
  formerMemberNumber?: string;
  /** Identifiants des virements de membre déjà reçus (par QR code) : un virement ne peut être encaissé qu'une fois. */
  receivedTickets?: string[];
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
  /** Le compte d'essai « 900 € avec pauses » a été chargé. */
  history900Imported?: boolean;
  /** Cours utilisés pour cette reprise : moyennes mensuelles réelles (sinon, anciennes moyennes annuelles). */
  history2019Prices?: 'monthly';
  /** Objectif retraite : montant visé et date (ISO, jour). */
  retirement?: RetirementGoal;
  /** Ordres passés le week-end, exécutés à la réouverture du marché, au cours du lundi. */
  pendingOrders?: PendingOrder[];
  /** Lingotins retirés du coffre et gardés chez soi. */
  homeVault?: HomeBar[];
  /** Lingotins refusés au contrôle, retirés des comptes et à renvoyer au fournisseur (suivi du retour). */
  returnedBars?: ReturnedBar[];
  /** Stock de lingotins et de pièces de la société (Société Orvia), et son journal. */
  stock?: StockLot[];
  stockLog?: StockMove[];
  /** Canal ntfy secret pour les alertes 24 h/24 envoyées par le serveur. */
  ntfyTopic?: string;
  /** Compte d'attente : euros disponibles pour acheter des métaux. */
  cashEur?: number;
  /** Achats programmés. */
  plan?: import('./plan.ts').BuyPlan;
  /** Bot d'achat sur baisse (en plus des achats programmés). */
  dipBot?: import('./dipBot.ts').DipBot;
}
