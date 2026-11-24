import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { AppScreen, Avatar } from '../components/phone';
import { FEED_AUTHORS } from '../data/world';
import { ago, compact } from '../logic/format';
import { useNow, usePhone } from '../state/PhoneProvider';
import { colors } from '../theme';

export default function Feed() {
  const { state, publish, like } = usePhone();
  const now = useNow(30_000);
  const [draft, setDraft] = useState('');
  const me = { name: state.name, handle: `@${state.name.toLowerCase().replace(/[^a-z0-9]+/g, '') || 'moi'}`, avatar: '😎', color: colors.pink };

  return (
    <AppScreen title="Palmfeed" color={colors.pink}>
      <FlatList
        data={state.posts}
        keyExtractor={(p) => p.id}
        ListHeaderComponent={
          <View style={styles.composer}>
            <Avatar emoji={me.avatar} color={me.color} size={40} />
            <View style={{ flex: 1, gap: 8 }}>
              <TextInput
                value={draft}
                onChangeText={setDraft}
                placeholder="Quoi de neuf à Port Corail ?"
                placeholderTextColor={colors.textMuted}
                style={styles.input}
                multiline
                maxLength={280}
              />
              <View style={styles.composerRow}>
                <Text style={styles.count}>{280 - draft.length}</Text>
                <Pressable
                  style={[styles.publish, { opacity: draft.trim() ? 1 : 0.4 }]}
                  disabled={!draft.trim()}
                  onPress={() => {
                    publish(draft);
                    setDraft('');
                  }}
                >
                  <Text style={styles.publishText}>Publier</Text>
                </Pressable>
              </View>
            </View>
          </View>
        }
        ItemSeparatorComponent={() => <View style={styles.sep} />}
        renderItem={({ item }) => {
          const a = item.author === 'me' ? me : FEED_AUTHORS[item.author];
          return (
            <View style={styles.post}>
              <Avatar emoji={a.avatar} color={a.color} size={42} />
              <View style={{ flex: 1 }}>
                <Text style={styles.author}>
                  {a.name} <Text style={styles.handle}>{a.handle} · {ago(item.at, now)}</Text>
                </Text>
                <Text style={styles.text}>{item.text}</Text>
                <Pressable onPress={() => like(item.id)} style={styles.likeRow} hitSlop={8} accessibilityLabel="J’aime">
                  <Text style={[styles.like, item.liked && { color: colors.pink }]}>{item.liked ? '♥' : '♡'}</Text>
                  <Text style={[styles.likeCount, item.liked && { color: colors.pink }]}>{compact(item.likes)}</Text>
                </Pressable>
              </View>
            </View>
          );
        }}
      />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  composer: { flexDirection: 'row', gap: 10, padding: 14, borderBottomWidth: 6, borderBottomColor: colors.surface },
  input: { color: colors.text, fontSize: 16, minHeight: 44, textAlignVertical: 'top' },
  composerRow: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 12 },
  count: { color: colors.textMuted, fontSize: 12 },
  publish: { backgroundColor: colors.pink, borderRadius: 18, paddingHorizontal: 16, paddingVertical: 8 },
  publishText: { color: '#fff', fontWeight: '700' },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  post: { flexDirection: 'row', gap: 10, padding: 14 },
  author: { color: colors.text, fontWeight: '700', fontSize: 15 },
  handle: { color: colors.textMuted, fontWeight: '400', fontSize: 13 },
  text: { color: colors.text, fontSize: 15, lineHeight: 21, marginTop: 3 },
  likeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, alignSelf: 'flex-start' },
  like: { color: colors.textMuted, fontSize: 18 },
  likeCount: { color: colors.textMuted, fontSize: 13 },
});
