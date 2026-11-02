import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const PIN_KEY = 'elrond.pin';

export const PIN_LENGTH = 4;

/** Le code est gardé dans le trousseau sécurisé du téléphone (navigateur : stockage local, démo). */
async function getSecret(): Promise<string | null> {
  if (Platform.OS === 'web') return AsyncStorage.getItem(PIN_KEY);
  return SecureStore.getItemAsync(PIN_KEY);
}

async function setSecret(value: string): Promise<void> {
  if (Platform.OS === 'web') return AsyncStorage.setItem(PIN_KEY, value);
  return SecureStore.setItemAsync(PIN_KEY, value);
}

async function hash(salt: string, pin: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${salt}:${pin}`);
}

export function isValidPinFormat(pin: string): boolean {
  return new RegExp(`^\\d{${PIN_LENGTH}}$`).test(pin);
}

/** Enregistre le code d'accès (seule son empreinte salée est conservée). */
export async function setPin(pin: string): Promise<void> {
  if (!isValidPinFormat(pin)) throw new Error(`Le code doit faire ${PIN_LENGTH} chiffres.`);
  const salt = Crypto.randomUUID();
  await setSecret(`${salt}:${await hash(salt, pin)}`);
}

export async function hasPin(): Promise<boolean> {
  return (await getSecret()) != null;
}

export async function verifyPin(pin: string): Promise<boolean> {
  const stored = await getSecret();
  if (!stored) return false;
  const [salt, expected] = stored.split(':');
  return (await hash(salt, pin)) === expected;
}

export async function clearPin(): Promise<void> {
  if (Platform.OS === 'web') return AsyncStorage.removeItem(PIN_KEY);
  return SecureStore.deleteItemAsync(PIN_KEY);
}

/** Empreinte digitale ou reconnaissance faciale disponible et configurée sur le téléphone ? */
export async function biometricsAvailable(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    return (await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync());
  } catch {
    return false;
  }
}

export async function authenticateWithBiometrics(reason: string): Promise<boolean> {
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: reason,
      cancelLabel: 'Utiliser le code',
      disableDeviceFallback: true,
    });
    return result.success;
  } catch {
    return false;
  }
}

/** Empreinte salée d'un code (ex. code du second parent), à garder à la place du code lui-même. */
export async function createSecret(pin: string): Promise<string> {
  if (!isValidPinFormat(pin)) throw new Error(`Le code doit faire ${PIN_LENGTH} chiffres.`);
  const salt = Crypto.randomUUID();
  return `${salt}:${await hash(salt, pin)}`;
}

export async function verifySecret(pin: string, stored: string | undefined): Promise<boolean> {
  if (!stored) return false;
  const [salt, expected] = stored.split(':');
  return (await hash(salt, pin)) === expected;
}
