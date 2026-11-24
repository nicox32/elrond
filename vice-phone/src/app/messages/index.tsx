import { router } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppScreen, Avatar, Badge } from '../../components/phone';
import { ago } from '../../logic/format';
import { knownContacts, useNow, usePhone } from '../../state/PhoneProvider';
import { colors } from '../../theme';

export default function Messages() {
  const { state, typing } = usePhone();
  const now = useNow(30_000);
  const rows = knownContacts(state).map((c) => {
    const t = state.threads[c.id];
    return { c, t, last: t?.messages[t.messages.length - 1] };
  }).sort((a, b) => (b.last?.at ?? 0) - (a.last?.at ?? 0));

  return (
    <AppScreen title="Messages" color={colors.cyan}>
      <FlatList
        data={rows}
        keyExtractor={(r) => r.c.id}
        ItemSeparatorComponent={() => <View style={styles.sep} />}
        renderItem={({ item: { c, t, last } }) => (
          <Pressable style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surface }]} onPress={() => router.push(`/messages/${c.id}`)}>
            <Avatar name={c.name} color={c.color} size={50} />
            <View style={{ flex: 1 }}>
              <View style={styles.line}>
                <Text style={[styles.name, (t?.unread ?? 0) > 0 && { color: colors.cyan }]}>{c.name}</Text>
                {last && <Text style={styles.time}>{ago(last.at, now)}</Text>}
              </View>
              <View style={styles.line}>
                <Text style={styles.preview} numberOfLines={2}>
                  {typing[c.id] ? 'est en train d’écrire…' : last ? `${last.from === 'me' ? 'Vous : ' : ''}${last.text}` : 'Aucun message'}
                </Text>
                <Badge count={t?.unread ?? 0} />
              </View>
            </View>
          </Pressable>
        )}
      />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingVertical: 12, alignItems: 'center' },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: 78 },
  line: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  name: { color: colors.text, fontSize: 16, fontWeight: '700' },
  time: { color: colors.textMuted, fontSize: 12 },
  preview: { color: colors.textMuted, fontSize: 14, flex: 1, marginTop: 2 },
});
