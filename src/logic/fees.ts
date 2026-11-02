import type { Metal } from './types.ts';

/**
 * Grille tarifaire d'Orvia : celle de Veracash, avec 0,2 point de moins sur chaque frais en pourcentage.
 * (Veracash n'a pas de platine : il suit le tarif de l'argent.)
 */
export const FEES = {
  /** Frais de gestion à l'achat, en part du montant payé. */
  buy: { gold: 0.028, silver: 0.068, platinum: 0.068, ecu: 0.01 } as Record<Metal, number>,
  /** Frais de gestion sur revente par virement vers un compte bancaire. */
  sale: 0.008,
  /** Supplément fixe pour un virement vers un compte bancaire hors de France. */
  saleAbroadFixed: 30,
  /** Écart supplémentaire pour un virement immédiat (aucun en différé). */
  immediateSpread: 0.028,
  /** Frais de gestion sur la revente lors d'une conversion (s'ajoutent aux frais d'achat du métal reçu). */
  conversion: 0.008,
  /** Frais d'oxydation : part du solde facturée par jour d'une période de 6 mois sans mouvement. */
  dormancyDaily: 0.0002,
  /** Un compte est inactif après ce nombre de mois sans mouvement. */
  dormancyAfterMonths: 6,
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
      {
        label: 'Gold Oriental (jeton d’1 g d’or fin) : frais d’achat, en plus de la prime incluse dans son prix',
        orvia: pct(FEES.buy.ecu),
      },
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
    title: 'Carte Orvia',
    rows: [
      { label: 'Émission et tenue de la carte virtuelle', orvia: 'Gratuit' },
      { label: 'Paiement par carte (revente du métal au cours du moment)', orvia: 'Gratuit' },
      { label: 'Retrait au distributeur', orvia: 'Gratuit' },
      { label: 'Plafond de paiements', orvia: '3 000 € / 30 jours' },
      { label: 'Plafond de retraits', orvia: '500 € / 7 jours' },
    ],
  },
  {
    title: 'Transferts et comptes',
    rows: [
      { label: 'Envoi de louis (métaux) à un membre', orvia: 'Gratuit' },
      { label: 'Réception de louis (métaux) d’un membre', orvia: 'Gratuit' },
      { label: 'Compte enfant (ouverture, tenue, alimentation)', orvia: 'Gratuit' },
      { label: 'Bonus de parrainage du filleul (1er achat d’au moins 50 €)', orvia: '+10 LOU en or' },
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
];
