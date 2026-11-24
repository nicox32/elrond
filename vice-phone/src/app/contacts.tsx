import { router } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppScreen, Avatar } from '../components/phone';
import { knownContacts, usePhone } from '../state/PhoneProvider';
import { colors } from '../theme';

export default function Contacts() {
  const { state } = usePhone();
  const sorted = [...knownContacts(state)].sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  return (
    <AppScreen title="Contacts" color={colors.sun}>
      <FlatList
        data={sorted}
        keyExtractor={(c) => c.id}
        contentContainerStyle={{ padding: 12, gap: 10 }}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Avatar name={item.name} color={item.color} size={48} />
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.num}>{item.number}</Text>
            </View>
            <Pressable style={[styles.action, { backgroundColor: colors.cyan }]} onPress={() => router.push(`/messages/${item.id}`)} accessibilityLabel={`Écrire à ${item.name}`}>
              <Text style={styles.icon}>💬</Text>
            </Pressable>
            <Pressable style={[styles.action, { backgroundColor: colors.green }]} onPress={() => router.push(`/call/${item.id}`)} accessibilityLabel={`Appeler ${item.name}`}>
              <Text style={styles.icon}>📞</Text>
            </Pressable>
          </View>
        )}
      />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 16, backgroundColor: colors.surface },
  name: { color: colors.text, fontSize: 16, fontWeight: '700' },
  num: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  action: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  icon: { fontSize: 18 },
});
