import { useEffect, useState } from 'react';
import Constants from 'expo-constants';
import { Linking, Platform, Pressable, StyleSheet, Text } from 'react-native';

import { availableUpdate, fetchLatestRelease, type UpdateInfo } from '../logic/update';
import { colors } from '../theme';

/** Bandeau « nouvelle version » sur l'accueil (appli Android) : ouvre le téléchargement de l'APK. */
export function UpdateBanner() {
  const [update, setUpdate] = useState<UpdateInfo | null>(null);
  const installed = Constants.expoConfig?.version;

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const ctrl = new AbortController();
    fetchLatestRelease(ctrl.signal)
      .then((latest) => setUpdate(availableUpdate(installed, latest)))
      .catch(() => undefined); // hors ligne : on réessaiera à la prochaine ouverture
    return () => ctrl.abort();
  }, [installed]);

  if (!update) return null;
  return (
    <Pressable
      testID="update-banner"
      onPress={() => Linking.openURL(update.apkUrl)}
      style={styles.banner}
      accessibilityRole="link"
    >
      <Text style={styles.title}>Nouvelle version {update.version} disponible</Text>
      <Text style={styles.body}>
        Vous avez la {installed}. Touchez pour télécharger orvia-{update.version}.apk, puis ouvrez-le pour l’installer :
        votre compte est conservé.
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: colors.surface,
    borderColor: colors.gold,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 3,
  },
  title: { color: colors.gold, fontSize: 14, fontWeight: '800' },
  body: { color: colors.textMuted, fontSize: 12.5, lineHeight: 17 },
});
