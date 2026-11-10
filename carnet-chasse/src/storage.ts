import AsyncStorage from '@react-native-async-storage/async-storage';

import { parseState } from './logic/backup';
import { type CarnetState, EMPTY_STATE } from './logic/types';

const KEY = 'carnet-chasse.state.v1';

export async function loadState(): Promise<CarnetState> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return EMPTY_STATE;
    return parseState(JSON.parse(raw)) ?? EMPTY_STATE;
  } catch {
    return EMPTY_STATE;
  }
}

export async function saveState(state: CarnetState): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // L'appli continue même si l'enregistrement échoue.
  }
}
