import type { Metal } from './types.ts';

/**
 * Grille tarifaire d'Orvia : frais d'achat modérés et garde en coffre transparente, prélevée en métal chaque mois.
 * Les frais suivent la place prise au coffre et la liquidité de chaque métal : l'or et le platine, denses, sont peu
 * encombrants (garde 0,12 % et 0,2 % par an) ; l'argent, environ 80 fois plus volumineux à valeur égale, coûte plus
 * cher à stocker et à négocier (achat 6,3 %, garde 0,4 % par an).
 */
export const FEES = {
  /** Frais de gestion à l'achat, en part du montant payé. */
  buy: { gold: 0.025, silver: 0.063, platinum: 0.045 } as Record<Metal, number>,
  /** Garde en coffre, par an, en part du métal détenu ; prélevée en métal chaque mois (1/12). */
  custodyYearly: { gold: 0.0012, silver: 0.004, platinum: 0.002 } as Record<Metal, number>,
  /** Frais de gestion sur revente par virement vers un compte bancaire. */
  sale: 0.008,
  /** Supplément fixe pour un virement vers un compte bancaire hors de France. */
  saleAbroadFixed: 30,
  /** Écart supplémentaire pour un virement immédiat (aucun en différé). */
  immediateSpread: 0.01,
  /** Frais de gestion sur la revente lors d'une conversion (s'ajoutent aux frais d'achat du métal reçu). */
  conversion: 0.008,
  /** Frais d'oxydation : part du solde facturée par jour d'une période de 6 mois sans mouvement. */
  dormancyDaily: 0.0002,
  /** Un compte est inactif après ce nombre de mois sans mouvement. */
  dormancyAfterMonths: 6,
  /** Montant minimum d'un achat, en euros, sur le total de l'opération (un achat réparti compte pour un). */
  minOrder: 10,
  /** Le week-end (marché fermé), supplément d'un achat, d'une vente ou d'une conversion faits tout de suite. */
  weekendSpread: 0.005,
} as const;

/** Délai d'un virement différé (sans écart), en jours ouvrés. */
export const DEFERRED_DAYS = 2;

export type SaleSpeed = 'deferred' | 'immediate';

export interface FeeRow {
  label: string;
  orvia: string;
}

const pct = (n: number) => `${(n * 100).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} %`;

/** Tableau affiché dans l'écran « Tarifs ». */
export const FEE_TABLE: { title: string; rows: FeeRow[] }[] = [
  {
    title: 'Achat de métaux précieux',
    rows: [
      { label: 'Gold Spot : conversion d’euros en grammes d’or', orvia: pct(FEES.buy.gold) },
      { label: 'Argent : conversion d’euros en grammes d’argent', orvia: pct(FEES.buy.silver) },
      { label: 'Platine : conversion d’euros en grammes de platine', orvia: pct(FEES.buy.platinum) },
    ],
  },
  {
    title: 'Règles d’achat',
    rows: [
      { label: 'Montant minimum d’un achat (total de l’opération)', orvia: `${FEES.minOrder} €` },
      { label: 'Minimum de frais par opération', orvia: 'Aucun' },
      { label: 'Week-end (marché fermé) : ordre au cours de la réouverture', orvia: 'Sans supplément' },
      { label: 'Week-end : achat, vente ou conversion tout de suite', orvia: `+${pct(FEES.weekendSpread)}` },
    ],
  },
  {
    title: 'Garde en coffre',
    rows: [
      { label: 'Gold Spot : garde, assurance et audit du coffre', orvia: `${pct(FEES.custodyYearly.gold)} par an` },
      { label: 'Argent : garde, assurance et audit du coffre', orvia: `${pct(FEES.custodyYearly.silver)} par an` },
      { label: 'Platine : garde, assurance et audit du coffre', orvia: `${pct(FEES.custodyYearly.platinum)} par an` },
      { label: 'Prélèvement', orvia: 'En métal, 1/12 au début de chaque mois' },
      { label: 'Compte enfant avant les 18 ans', orvia: 'Aucun' },
    ],
  },
  {
    title: 'Revente de métaux précieux',
    rows: [
      { label: 'Virement vers un compte bancaire en France', orvia: pct(FEES.sale) },
      {
        label: 'Virement vers un compte bancaire à l’étranger',
        orvia: `${pct(FEES.sale)} + ${FEES.saleAbroadFixed} €`,
      },
      { label: 'Écart en virement immédiat', orvia: pct(FEES.immediateSpread) },
      { label: `Écart en virement différé (${DEFERRED_DAYS} jours ouvrés)`, orvia: 'Aucun' },
      {
        label: 'Conversion d’un métal en un autre',
        orvia: `${pct(FEES.conversion)} + frais d’achat`,
      },
    ],
  },
  {
    title: 'Retrait physique (or uniquement)',
    rows: [
      { label: 'Lingotin 5 g (affinerie LBMA, numéro de série, certificat)', orvia: 'Fabrication ≈ 4,5 %' },
      { label: 'Lingotin 10 g', orvia: 'Fabrication ≈ 3 %' },
      { label: 'Lingotin 20 g', orvia: 'Fabrication ≈ 2,5 %' },
      { label: 'Lingot 1 once (31,1 g)', orvia: 'Fabrication ≈ 2 %' },
      { label: 'Napoléon 20 F (5,81 g d’or fin)', orvia: 'Prime ≈ 6 %, variable' },
      { label: 'Livraison assurée, remise contre signature', orvia: '12 € par envoi, offerte dès 20 g' },
      { label: 'Argent et platine', orvia: 'Non retirables (20 % de TVA)' },
    ],
  },
  {
    title: 'Transferts et comptes',
    rows: [
      { label: 'Envoi de métal à un membre', orvia: 'Gratuit' },
      { label: 'Réception de métal d’un membre', orvia: 'Gratuit' },
      { label: 'Compte enfant (ouverture, tenue, alimentation)', orvia: 'Gratuit' },
      { label: 'Bonus de parrainage du filleul (1er achat d’au moins 50 €)', orvia: '+10 € en or' },
      { label: 'Frais sur un compte enfant avant les 18 ans', orvia: 'Aucun' },
      {
        label: 'Retrait d’un compte enfant : pour une dépense faite pour l’enfant, validé par les deux parents',
        orvia: 'Gratuit',
      },
      { label: 'Annulation d’un versement fait par erreur (sous 24 h)', orvia: 'Gratuit' },
      { label: 'Transfert du compte à l’enfant à ses 18 ans', orvia: 'Gratuit' },
      {
        label: `Frais d’oxydation : ${FEES.dormancyAfterMonths} mois calendaires sans opération éligible d’au moins 1 €`,
        orvia: `${pct(FEES.dormancyDaily)} du solde par jour, sur ces ${FEES.dormancyAfterMonths} mois`,
      },
    ],
  },
  {
    title: 'Fidélité (louis, LOU)',
    rows: [
      { label: 'Chaque mois avec au moins 50 € investis', orvia: '+1 LOU' },
      { label: 'Tous les 12 mois d’épargne consécutifs', orvia: '+5 LOU' },
      { label: 'Achat de métal', orvia: '+1 LOU / 500 €' },
      { label: 'Chaque mois avec au moins 25 € versés à un compte enfant', orvia: '+1 LOU' },
      { label: 'Anniversaire du compte', orvia: '+1 LOU' },
      { label: 'Tous les 5 ans d’ancienneté', orvia: '+5 LOU' },
      { label: 'Échange contre du métal (dès 10 LOU)', orvia: '1 LOU = 1 €, sans frais' },
    ],
  },
];
