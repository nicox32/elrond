import { ActivityIndicator, Linking, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { isAllowedHost } from '../logic/maps';
import { colors } from '../theme';

/** Carte Shackmaps dans un navigateur intégré ; les liens vers d'autres sites s'ouvrent dans le navigateur du téléphone. */
export function MapFrame({ url, onUrlChange }: { url: string; onUrlChange?: (url: string) => void }) {
  return (
    <WebView
      source={{ uri: url }}
      style={{ flex: 1, backgroundColor: colors.background }}
      startInLoadingState
      renderLoading={() => (
        <View style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
          <ActivityIndicator color={colors.accent} />
        </View>
      )}
      setSupportMultipleWindows={false}
      onShouldStartLoadWithRequest={(req) => {
        if (req.url.startsWith('about:') || isAllowedHost(req.url)) return true;
        if (/^https?:\/\//i.test(req.url)) Linking.openURL(req.url).catch(() => {});
        return false;
      }}
      onNavigationStateChange={(nav) => onUrlChange?.(nav.url)}
    />
  );
}
