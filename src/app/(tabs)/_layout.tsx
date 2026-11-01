import { Tabs } from 'expo-router/js-tabs';
import { type ColorValue, Platform, Text } from 'react-native';

import { colors } from '../../theme';

function TabIcon({ glyph, color }: { glyph: string; color: ColorValue }) {
  return <Text style={{ color, fontSize: 17, lineHeight: 20 }}>{glyph}</Text>;
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.gold,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          // Sur le web, la hauteur par défaut coupe le bas des libellés.
          ...(Platform.OS === 'web' ? { height: 58, paddingBottom: 6 } : null),
        },
        tabBarLabelStyle: { fontSize: 11, lineHeight: 14, fontWeight: '600' },
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Compte', tabBarIcon: ({ color }) => <TabIcon glyph="◆" color={color} /> }}
      />
      <Tabs.Screen
        name="operations"
        options={{ title: 'Opérer', tabBarIcon: ({ color }) => <TabIcon glyph="⇄" color={color} /> }}
      />
      <Tabs.Screen
        name="virements"
        options={{ title: 'Virements', tabBarIcon: ({ color }) => <TabIcon glyph="→" color={color} /> }}
      />
      <Tabs.Screen
        name="historique"
        options={{ title: 'Historique', tabBarIcon: ({ color }) => <TabIcon glyph="≡" color={color} /> }}
      />
      <Tabs.Screen
        name="profil"
        options={{ title: 'Profil', tabBarIcon: ({ color }) => <TabIcon glyph="●" color={color} /> }}
      />
    </Tabs>
  );
}
