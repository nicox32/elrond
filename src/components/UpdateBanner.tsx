import { useEffect, useState } from 'react';
import Constants from 'expo-constants';
import { Linking, Platform } from 'react-native';

import { availableUpdate, fetchLatestRelease, type UpdateInfo } from '../logic/update';
import { Banner } from './ui';

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
    <Banner
      tone="gold"
      icon="⬇"
      title={`Nouvelle version ${update.version} disponible`}
      onPress={() => Linking.openURL(update.apkUrl)}
      testID="update-banner"
    >
      {`Vous avez la ${installed}. Touchez pour télécharger orvia-${update.version}.apk, puis ouvrez-le pour l’installer : votre compte est conservé.`}
    </Banner>
  );
}
