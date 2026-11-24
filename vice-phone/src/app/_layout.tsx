import { router, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, AppState, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { NotificationBanner } from '../components/phone';
import { PhoneProvider, usePhone } from '../state/PhoneProvider';
import { colors } from '../theme';

function Root() {
  const { ready, lock } = usePhone();

  // Comme un vrai téléphone : quitter l’appli verrouille l’écran.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'background') {
        lock();
        router.replace('/');
      }
    });
    return () => sub.remove();
  }, [lock]);

  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.pink} />
      </View>
    );
  }
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background }, animation: 'fade_from_bottom' }}>
        <Stack.Screen name="index" options={{ animation: 'fade' }} />
        <Stack.Screen name="home" options={{ animation: 'fade', gestureEnabled: false }} />
        <Stack.Screen name="call/[id]" options={{ animation: 'fade', gestureEnabled: false }} />
      </Stack>
      <NotificationBanner />
    </View>
  );
}

export default function Layout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" hidden />
      <PhoneProvider>
        <Root />
      </PhoneProvider>
    </SafeAreaProvider>
  );
}
