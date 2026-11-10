import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { CarnetProvider, useCarnet } from '../state/CarnetProvider';
import { colors } from '../theme';

function AppStack() {
  const { loading } = useCarnet();
  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.accent,
        headerTitleStyle: { color: colors.text },
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="chasse/edition" options={{ title: 'Nouvelle chasse', presentation: 'modal' }} />
      <Stack.Screen name="chasse/[id]" options={{ title: 'Chasse' }} />
      <Stack.Screen name="sauvegarde" options={{ title: 'Sauvegarde' }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <CarnetProvider>
        <StatusBar style="light" />
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          <AppStack />
        </View>
      </CarnetProvider>
    </SafeAreaProvider>
  );
}
