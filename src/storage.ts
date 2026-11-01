import AsyncStorage from '@react-native-async-storage/async-storage';

import { migrateAccount } from './logic/ledger';
import type { Account, PriceQuote } from './logic/types';

const ACCOUNT_KEY = 'elrond.account.v2';
const LEGACY_ACCOUNT_KEY = 'elrond.account.v1';
const QUOTE_KEY = 'elrond.quote.v1';

async function readJson(key: string): Promise<unknown> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

async function writeJson(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // La démo continue même si l'enregistrement échoue.
  }
}

/** Charge le compte, en reprenant au besoin celui de la première version de l'appli. */
export async function loadAccount(): Promise<Account | null> {
  const current = migrateAccount(await readJson(ACCOUNT_KEY));
  if (current) return current;
  return migrateAccount(await readJson(LEGACY_ACCOUNT_KEY));
}

export function saveAccount(account: Account): Promise<void> {
  return writeJson(ACCOUNT_KEY, account);
}

export async function clearAccount(): Promise<void> {
  try {
    await AsyncStorage.multiRemove([ACCOUNT_KEY, LEGACY_ACCOUNT_KEY]);
  } catch {
    // ignoré
  }
}

/** Derniers cours réels obtenus, pour fonctionner hors ligne. */
export async function loadCachedQuote(): Promise<PriceQuote | null> {
  const q = (await readJson(QUOTE_KEY)) as PriceQuote | null;
  return q && q.prices && q.fetchedAt ? { ...q, source: 'cache' } : null;
}

export function saveQuote(quote: PriceQuote): Promise<void> {
  return writeJson(QUOTE_KEY, quote);
}
