import { Tabs } from 'expo-router/js-tabs';
import { type ColorValue, Platform, Text } from 'react-native';

import { colors, fonts } from '../../theme';

function TabIcon({ glyph, color }: { glyph: string; color: ColorValue }) {
  return <Text style={{ color, fontSize: 17, lineHeight: 20 }}>{glyph}</Text>;
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.tabBar,
          borderTopColor: colors.border,
          ...(Platform.OS === 'web' ? { height: 58, paddingBottom: 6 } : null),
        },
        tabBarLabelStyle: { fontSize: 11, lineHeight: 14, fontFamily: fonts.semibold },
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Journal', tabBarIcon: ({ color }) => <TabIcon glyph="◎" color={color} /> }} />
      <Tabs.Screen name="trophees" options={{ title: 'Trophées', tabBarIcon: ({ color }) => <TabIcon glyph="♛" color={color} /> }} />
      <Tabs.Screen name="armurerie" options={{ title: 'Armes', tabBarIcon: ({ color }) => <TabIcon glyph="⌖" color={color} /> }} />
      <Tabs.Screen name="gestion" options={{ title: 'Gestion', tabBarIcon: ({ color }) => <TabIcon glyph="⚖" color={color} /> }} />
      <Tabs.Screen name="horaires" options={{ title: 'Horaires', tabBarIcon: ({ color }) => <TabIcon glyph="◷" color={color} /> }} />
      <Tabs.Screen name="especes" options={{ title: 'Espèces', tabBarIcon: ({ color }) => <TabIcon glyph="❦" color={color} /> }} />
    </Tabs>
  );
}
