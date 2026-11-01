import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { PinPad } from '../components/PinPad';
import { useBank } from '../state/BankProvider';
import { authenticateWithBiometrics, biometricsAvailable, verifyPin } from '../security';
import { colors } from '../theme';

const MAX_ATTEMPTS = 5;
const COOLDOWN_MS = 30_000;

/** Écran de déverrouillage : code à 4 chiffres ou empreinte, à chaque ouverture de l'appli. */
export function LockScreen() {
  const { account, unlock } = useBank();
  const [error, setError] = useState<string | null>(null);
  const [bio, setBio] = useState(false);
  const [blockedUntil, setBlockedUntil] = useState(0);
  const attempts = useRef(0);

  const tryBiometrics = useCallback(async () => {
    if (await authenticateWithBiometrics('Déverrouiller Elrond')) unlock();
  }, [unlock]);

  useEffect(() => {
    if (!account?.settings.biometrics) return;
    biometricsAvailable().then((ok) => {
      setBio(ok);
      if (ok) tryBiometrics();
    });
  }, [account?.settings.biometrics, tryBiometrics]);

  // Réactive le clavier après le délai d'attente.
  useEffect(() => {
    if (!blockedUntil) return;
    const t = setTimeout(() => {
      setBlockedUntil(0);
      setError(null);
    }, blockedUntil - Date.now());
    return () => clearTimeout(t);
  }, [blockedUntil]);

  return (
    <View style={styles.wrap}>
      <Text style={styles.logo}>◆</Text>
      <Text style={styles.hello}>Bonjour {account?.holder}</Text>
      <PinPad
        title="Entre ton code d’accès"
        error={error}
        disabled={blockedUntil > 0}
        onComplete={async (pin) => {
          if (await verifyPin(pin)) {
            attempts.current = 0;
            unlock();
            return true;
          }
          attempts.current += 1;
          if (attempts.current >= MAX_ATTEMPTS) {
            attempts.current = 0;
            setBlockedUntil(Date.now() + COOLDOWN_MS);
            setError('Trop d’essais. Réessaie dans 30 secondes.');
          } else {
            setError(`Code incorrect (${MAX_ATTEMPTS - attempts.current} essai(s) restant(s)).`);
          }
          return false;
        }}
        extraKey={bio ? { label: 'Empreinte', onPress: tryBiometrics } : undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 6 },
  logo: { color: colors.gold, fontSize: 36 },
  hello: { color: colors.textMuted, fontSize: 15, marginBottom: 12 },
});
