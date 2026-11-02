import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { LockScreen } from '../features/LockScreen';
import { Onboarding } from '../features/Onboarding';
import { BankProvider, useBank } from '../state/BankProvider';
import { setupPwa } from '../pwa';
import { colors } from '../theme';

setupPwa();

function Gate() {
  const { loading, account, locked, needsPin } = useBank();

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.gold} />
      </View>
    );
  }
  if (!account) return <Onboarding />;
  if (needsPin) return <Onboarding existingHolder={account.holder} />;

  // Le verrou se superpose à la navigation : on retrouve l'écran où l'on était après le code.
  return (
    <View style={{ flex: 1 }}>
      <AppStack />
      {locked && (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.background }]}>
          <LockScreen />
        </View>
      )}
    </View>
  );
}

function AppStack() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.gold,
        headerTitleStyle: { color: colors.text },
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="coffre/[metal]" options={{ title: 'Coffre' }} />
      <Stack.Screen name="enfants/index" options={{ title: 'Comptes enfants' }} />
      <Stack.Screen name="enfants/[id]" options={{ title: 'Compte enfant' }} />
      <Stack.Screen name="tarifs" options={{ title: 'Tarifs' }} />
      <Stack.Screen name="carte" options={{ title: 'Ma carte Orvia' }} />
      <Stack.Screen name="parrainage" options={{ title: 'Parrainage' }} />
      <Stack.Screen name="alertes" options={{ title: 'Alertes de prix' }} />
      <Stack.Screen name="repartition" options={{ title: 'Répartition' }} />
      <Stack.Screen name="fiscalite" options={{ title: 'Plus-value et impôts' }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.root} edges={['top']}>
        <StatusBar style="light" />
        <BankProvider>
          <Gate />
        </BankProvider>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
