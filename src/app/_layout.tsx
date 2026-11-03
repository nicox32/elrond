import { type ErrorBoundaryProps, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { LockScreen } from '../features/LockScreen';
import { Onboarding } from '../features/Onboarding';
import { BankProvider, useBank } from '../state/BankProvider';
import { registerBackgroundChecks } from '../background';
import { setupPwa } from '../pwa';
import { colors } from '../theme';

setupPwa();
// Vérification des cours en arrière-plan (téléphone) : la tâche est déclarée dès le chargement de l'appli.
registerBackgroundChecks();

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
      <Stack.Screen name="fidelite" options={{ title: 'Fidélité' }} />
      <Stack.Screen name="attente" options={{ title: 'Compte d’attente' }} />
      <Stack.Screen name="dev" options={{ title: 'Société Orvia' }} />
      <Stack.Screen name="or-fractionne" options={{ title: 'L’or fractionné' }} />
      <Stack.Screen name="fiscalite" options={{ title: 'Plus-value et impôts' }} />
    </Stack>
  );
}

/** Une erreur d'affichage montre un message (à envoyer en capture) au lieu de fermer l'appli. */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return (
    <SafeAreaProvider>
      <SafeAreaView style={[styles.center, { padding: 24, gap: 14 }]}>
        <Text style={{ color: colors.text, fontSize: 20, fontWeight: '800', textAlign: 'center' }}>
          Orvia a rencontré un problème
        </Text>
        <Text style={{ color: colors.textMuted, fontSize: 14, textAlign: 'center' }}>
          Vos données sont conservées. Faites une capture de cet écran pour l’envoyer, puis réessayez.
        </Text>
        <ScrollView style={{ maxHeight: 220, alignSelf: 'stretch' }}>
          <Text selectable style={{ color: colors.down, fontSize: 12 }}>
            {error.message}
            {'\n'}
            {error.stack?.split('\n').slice(0, 6).join('\n')}
          </Text>
        </ScrollView>
        <Pressable
          onPress={retry}
          accessibilityRole="button"
          style={{ backgroundColor: colors.gold, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 28 }}
        >
          <Text style={{ color: colors.background, fontSize: 16, fontWeight: '800' }}>Réessayer</Text>
        </Pressable>
      </SafeAreaView>
    </SafeAreaProvider>
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
