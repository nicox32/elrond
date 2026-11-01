import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Account } from './logic/types';

const KEY = 'elrond.account.v1';

export async function loadAccount(): Promise<Account | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Account) : null;
  } catch {
    return null;
  }
}

export async function saveAccount(account: Account): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(account));
  } catch {
    // La démo continue même si l'enregistrement échoue.
  }
}

export async function clearAccount(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    // ignoré
  }
}
