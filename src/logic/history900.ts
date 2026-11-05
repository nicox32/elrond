/**
 * Compte d'essai « 900 € avec des pauses » : 36 versements de 25 € depuis l'ouverture du compte (4 janvier 2019),
 * le 5 du mois, avec de longues pauses (9 à 15 mois). Chaque pause de plus de 6 mois entraîne des frais
 * d'oxydation, prélevés en métal par la même règle que l'appli. Chaque versement est réparti selon la répartition
 * du compte (75 / 20 / 5 par défaut), au cours moyen réel de son mois, frais d'achat compris.
 * Le versement du mois en cours n'est pas ajouté.
 */
import { buySplit, DEFAULT_ALLOCATION, splitAmount } from './allocation.ts';
import { applyDormancy, LedgerError, recordBalance, resetVaults, TROY_OUNCE } from './ledger.ts';
import { monthlyEurOz } from './monthlyPrices.ts';
import type { Account, Prices } from './types.ts';

export const HISTORY900 = {
  start: '2019-01-04',
  amount: 25,
  dayOfMonth: 5,
  /** Mois de versement (« AAAA-MM ») : 6 + 6 + 8 + 6 + 5 + 5 = 36 versements, soit 900 €. */
  months: [
    '2019-01',
    '2019-02',
    '2019-03',
    '2019-04',
    '2019-05',
    '2019-06',
    '2020-04',
    '2020-05',
    '2020-06',
    '2020-07',
    '2020-08',
    '2020-09',
    '2022-01',
    '2022-02',
    '2022-03',
    '2022-04',
    '2022-05',
    '2022-06',
    '2022-07',
    '2022-08',
    '2023-07',
    '2023-08',
    '2023-09',
    '2023-10',
    '2023-11',
    '2023-12',
    '2025-02',
    '2025-03',
    '2025-04',
    '2025-05',
    '2025-06',
    '2026-04',
    '2026-05',
    '2026-06',
    '2026-09',
    '2026-10',
  ],
} as const;

/** Cours du mois en €/g (les cours mensuels sont en €/once). */
export function pricesOfMonth(d: Date): Prices {
  const oz = monthlyEurOz(d);
  return { gold: oz.gold / TROY_OUNCE, silver: oz.silver / TROY_OUNCE, platinum: oz.platinum / TROY_OUNCE };
}

function paymentDates(now: Date): Date[] {
  return HISTORY900.months
    .map((m) => new Date(`${m}-${String(HISTORY900.dayOfMonth).padStart(2, '0')}T10:00:00`))
    .filter(
      (d) => d.getTime() < now.getTime() && !(d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()),
    );
}

export function preview900(now = new Date()) {
  const n = paymentDates(now).length;
  return { payments: n, total: n * HISTORY900.amount };
}

/** Charge le compte d'essai (une seule fois, sur des coffres vides). */
export function import900History(account: Account, now = new Date()): Account {
  if (account.history900Imported) return account;
  if (account.transactions.length > 0 || Object.values(account.holdings).some((g) => g > 1e-9)) {
    throw new LedgerError('Videz d’abord vos coffres (Profil → Vider mes coffres) : ce compte d’essai part de zéro.');
  }
  const start = new Date(`${HISTORY900.start}T09:00:00`);
  const target = account.settings.allocation ?? DEFAULT_ALLOCATION;
  let acc: Account = {
    ...account,
    createdAt: start.toISOString(),
    // Les frais d'oxydation s'appliquent depuis l'ouverture, comme pour un vrai compte.
    dormancyNotBefore: start.toISOString(),
    dormancyChargedThrough: undefined,
    balanceHistory: [],
  };
  for (const d of paymentDates(now)) {
    const p = pricesOfMonth(d);
    acc = applyDormancy(acc, p, d); // pause de plus de 6 mois : frais prélevés avant le versement
    const before = acc.transactions.length;
    acc = buySplit(acc, p, splitAmount(HISTORY900.amount, target, 'percent'), d);
    const added = acc.transactions.length - before;
    acc = {
      ...acc,
      transactions: acc.transactions.map((t, i) => (i < added ? { ...t, origin: 'history900' as const } : t)),
    };
    acc = recordBalance(acc, p, d);
  }
  // Pause en cours (depuis le dernier versement) : frais dus jusqu'à aujourd'hui.
  acc = applyDormancy(acc, pricesOfMonth(now), now);
  return { ...acc, history900Imported: true };
}

/**
 * Remplace le compte principal par le compte d'essai : coffres et historique remis à zéro, puis chargés. Les
 * comptes enfants, les réglages, l'adresse, les alertes, le bot et les achats programmés sont gardés tels quels.
 */
export function replaceWith900History(account: Account, now = new Date()): Account {
  return import900History(resetVaults(account), now);
}
