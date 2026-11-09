/**
 * Export CSV de toutes les opérations (compte principal et comptes enfants), au format du modèle de tableur
 * `docs/modele-orvia.xlsx` : séparateur « ; », virgule décimale, UTF-8 avec BOM (Excel, Google Sheets, LibreOffice).
 */
import { METAL_LABEL } from './ledger.ts';
import { type Account, type Metal, METALS, type Transaction, type TransactionKind, type Wallet } from './types.ts';

export const CSV_COLUMNS = [
  'Date',
  'Année',
  'Compte',
  'Opération',
  'Type',
  'Métal',
  'Grammes',
  'Prix au gramme (€)',
  'Montant (€)',
  'Frais (€)',
  'Impôt (€)',
  'Régime fiscal',
] as const;

export const KIND_TYPE: Record<TransactionKind, string> = {
  buy: 'Achat',
  sell: 'Vente',
  convert: 'Conversion',
  transfer_member: 'Envoi à un membre',
  transfer_iban: 'Vente',
  family_out: 'Versement famille',
  family_in: 'Reçu famille',
  fee_dormancy: 'Frais d’oxydation',
  fee_custody: 'Frais de garde',
  card_payment: 'Paiement carte',
  card_withdrawal: 'Retrait carte',
  referral_bonus: 'Parrainage',
  cash_in: 'Compte d’attente',
  cash_out: 'Compte d’attente',
  loyalty_redeem: 'Fidélité',
};

const num = (n: number, digits: number) => (Number.isFinite(n) ? n.toFixed(digits).replace('.', ',') : '');

function cell(v: string): string {
  return /[;"\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

const frDate = (iso: string) => {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
};

interface Row {
  t: Transaction;
  wallet: string;
  metal: Metal | null;
  grams: number;
  eur: number;
  fees: number;
  tax: number;
}

/** Une ligne par métal touché ; une conversion donne une ligne de sortie et une ligne d'entrée. */
function rowsOf(t: Transaction, wallet: string): Row[] {
  const moved = METALS.filter((m) => Math.abs(t.deltas[m] ?? 0) > 1e-9);
  // Frais prélevés en métal : leur montant est la valeur du métal prélevé, pas des frais en plus.
  const feeKind = t.kind === 'fee_custody' || t.kind === 'fee_dormancy';
  const fees = feeKind ? 0 : (t.fees ?? 0);
  const tax = t.tax ?? 0;
  if (feeKind && moved.length > 1) {
    const total = moved.reduce((s, m) => s + (t.eurByMetal?.[m] ?? 0), 0);
    return moved.map((m) => ({
      t,
      wallet,
      metal: m,
      grams: t.deltas[m],
      // Ancienne opération sans détail par métal : montant réparti au prorata des grammes.
      eur:
        total > 0
          ? (t.eurByMetal?.[m] ?? 0)
          : (t.eur * Math.abs(t.deltas[m])) / moved.reduce((s, x) => s + Math.abs(t.deltas[x]), 0),
      fees: 0,
      tax: 0,
    }));
  }
  if (moved.length === 0) return [{ t, wallet, metal: null, grams: 0, eur: t.eur, fees, tax }];
  if (moved.length === 1) return [{ t, wallet, metal: moved[0], grams: t.deltas[moved[0]], eur: t.eur, fees, tax }];
  if (t.kind === 'convert') {
    // Sortie : valeur du métal cédé (frais et impôt dessus) ; entrée : ce qui a été réinvesti.
    return moved.map((m) =>
      t.deltas[m] < 0
        ? { t, wallet, metal: m, grams: t.deltas[m], eur: t.eur, fees, tax }
        : { t, wallet, metal: m, grams: t.deltas[m], eur: t.eur - fees - tax, fees: 0, tax: 0 },
    );
  }
  // Plusieurs métaux dans le même sens (rare) : montants sur la première ligne.
  return moved.map((m, i) => ({
    t,
    wallet,
    metal: m,
    grams: t.deltas[m],
    eur: i === 0 ? t.eur : 0,
    fees: i === 0 ? fees : 0,
    tax: i === 0 ? tax : 0,
  }));
}

export function operationsCsv(account: Account): string {
  const wallets: { name: string; w: Wallet }[] = [
    { name: 'Compte principal', w: account },
    ...account.children.map((c) => ({ name: c.name, w: c as Wallet })),
  ];
  const rows = wallets
    .flatMap(({ name, w }) => w.transactions.filter((t) => !t.reversed).flatMap((t) => rowsOf(t, name)))
    .sort((a, b) => a.t.date.localeCompare(b.t.date));
  const lines = rows.map((r) => {
    const perGram =
      r.metal &&
      Math.abs(r.grams) > 1e-9 &&
      r.t.kind !== 'convert' &&
      r.t.kind !== 'fee_custody' &&
      r.t.kind !== 'fee_dormancy'
        ? r.grams > 0
          ? (r.eur - r.fees) / r.grams
          : (r.eur + r.fees + r.tax) / -r.grams
        : NaN;
    return [
      frDate(r.t.date),
      String(new Date(r.t.date).getFullYear()),
      r.wallet,
      r.t.label,
      KIND_TYPE[r.t.kind],
      r.metal ? METAL_LABEL[r.metal] : '',
      r.metal ? num(r.grams, 6) : '',
      num(perGram, 4),
      num(r.eur, 2),
      r.fees ? num(r.fees, 2) : '',
      r.tax ? num(r.tax, 2) : '',
      r.t.taxRegime === 'gain' ? 'Plus-values' : r.t.taxRegime === 'flat' ? 'Taxe forfaitaire' : '',
    ]
      .map(cell)
      .join(';');
  });
  return `﻿${[CSV_COLUMNS.join(';'), ...lines].join('\r\n')}\r\n`;
}

export const csvFileName = (now = new Date()) => `orvia-operations-${now.toISOString().slice(0, 10)}.csv`;
