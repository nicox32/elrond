import { useCallback, useEffect, useRef, useState } from 'react';
import Constants from 'expo-constants';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';

import { PinPad } from '../components/PinPad';
import { metalTrend } from '../logic/priceHistory';
import { SPOT_METALS, type SpotMetal } from '../logic/types';
import { useBank } from '../state/BankProvider';
import { authenticateWithBiometrics, biometricsAvailable, verifyPin } from '../security';
import { colors, metalColor, metalSymbol } from '../theme';

const LOGO = require('../../assets/logo.png');
/** Lingots dessinés pour Orvia (sans poids affiché). */
const INGOTS: Record<SpotMetal, number> = {
  gold: require('../../assets/ingots/gold.png'),
  silver: require('../../assets/ingots/silver.png'),
  platinum: require('../../assets/ingots/platinum.png'),
};
const VERSION = Constants.expoConfig?.version ?? '';

const perGram = (n: number, m: SpotMetal) =>
  `${n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: m === 'silver' ? 3 : 2 })} €/g`;

const MAX_ATTEMPTS = 5;
const COOLDOWN_MS = 30_000;

/** Écran de déverrouillage : code à 4 chiffres ou empreinte, à chaque ouverture de l'appli. */
export function LockScreen() {
  const { account, unlock, quote, priceHistory } = useBank();
  const [error, setError] = useState<string | null>(null);
  const [bio, setBio] = useState(false);
  const [blockedUntil, setBlockedUntil] = useState(0);
  const attempts = useRef(0);

  const tryBiometrics = useCallback(async () => {
    if (await authenticateWithBiometrics('Déverrouiller Orvia')) unlock();
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
    <ScrollView contentContainerStyle={styles.wrap} bounces={false}>
      <View style={styles.header}>
        <Image source={LOGO} style={styles.logo} accessibilityLabel="Orvia" resizeMode="contain" />
        <View>
          <Text style={styles.brand}>ORVIA</Text>
          <Text style={styles.hello}>Bonjour {account?.holder}</Text>
        </View>
      </View>

      <View style={styles.ingots} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Image source={INGOTS.silver} style={styles.ingotSide} resizeMode="contain" />
        <Image source={INGOTS.gold} style={styles.ingotMain} resizeMode="contain" />
        <Image source={INGOTS.platinum} style={styles.ingotSide} resizeMode="contain" />
      </View>

      {quote.source === 'live' && (
        <View style={styles.prices}>
          {SPOT_METALS.map((m) => {
            const change = metalTrend(priceHistory, m, quote.prices).changePct;
            const up = change > 0.05;
            const down = change < -0.05;
            return (
              <View key={m} style={[styles.chip, { backgroundColor: `${metalColor[m]}22` }]}>
                <Text style={[styles.chipSymbol, { color: metalColor[m] }]}>{metalSymbol[m]}</Text>
                <Text style={styles.chipPrice}>{perGram(quote.prices[m], m)}</Text>
                {(up || down) && (
                  <Text style={[styles.chipTrend, { color: up ? colors.up : colors.down }]}>{up ? '▲' : '▼'}</Text>
                )}
              </View>
            );
          })}
        </View>
      )}

      <Text style={styles.slogan}>
        Votre épargne en métal,{'\n'}
        <Text style={{ color: colors.gold }}>gardée pour vous.</Text>
      </Text>

      <PinPad
        title="Code d’accès"
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
            setError('Trop d’essais. Réessayez dans 30 secondes.');
          } else {
            setError(`Code incorrect (${MAX_ATTEMPTS - attempts.current} essai(s) restant(s)).`);
          }
          return false;
        }}
        extraKey={bio ? { label: 'Empreinte', onPress: tryBiometrics } : undefined}
      />
      <Text style={styles.version}>Orvia · version {VERSION}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 28,
    gap: 12,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, alignSelf: 'stretch' },
  logo: { width: 46, height: 46 },
  brand: { color: colors.text, fontSize: 17, fontWeight: '800', letterSpacing: 3 },
  hello: { color: colors.textMuted, fontSize: 13 },
  ingots: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 4, marginTop: 6 },
  ingotSide: { width: 100, height: 52 },
  ingotMain: { width: 124, height: 64 },
  prices: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
  },
  chipSymbol: { fontSize: 13, fontWeight: '800' },
  chipPrice: { color: colors.text, fontSize: 13, fontVariant: ['tabular-nums'] },
  chipTrend: { fontSize: 11, fontWeight: '800' },
  slogan: { color: colors.text, fontSize: 21, textAlign: 'center', fontFamily: 'serif', marginVertical: 4 },
  version: { color: colors.textMuted, fontSize: 12, opacity: 0.8, marginTop: 8 },
});
