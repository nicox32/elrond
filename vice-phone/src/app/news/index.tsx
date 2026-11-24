import { router } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppScreen } from '../../components/phone';
import { ARTICLES } from '../../data/world';
import { usePhone } from '../../state/PhoneProvider';
import { colors } from '../../theme';

export default function News() {
  const { state } = usePhone();
  return (
    <AppScreen title="Corail Info" color={colors.red}>
      <FlatList
        data={ARTICLES}
        keyExtractor={(a) => a.id}
        contentContainerStyle={{ padding: 14, gap: 12 }}
        ListHeaderComponent={<Text style={styles.kicker}>L’actualité (presque) vraie de Port Corail</Text>}
        renderItem={({ item, index }) => {
          const read = state.newsRead.includes(item.id);
          return (
            <Pressable onPress={() => router.push(`/news/${item.id}`)} style={({ pressed }) => [styles.card, index === 0 && styles.hero, pressed && { opacity: 0.8 }]}>
              <Text style={index === 0 ? styles.heroEmoji : styles.emoji}>{item.emoji}</Text>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.category}>{item.category.toUpperCase()}</Text>
                  {!read && <View style={styles.dot} />}
                </View>
                <Text style={[styles.title, index === 0 && { fontSize: 20 }, read && { color: colors.textMuted }]}>{item.title}</Text>
                <Text style={styles.summary} numberOfLines={2}>
                  {item.summary}
                </Text>
              </View>
            </Pressable>
          );
        }}
      />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  kicker: { color: colors.textMuted, fontSize: 13, marginBottom: 2 },
  card: { flexDirection: 'row', gap: 12, padding: 14, borderRadius: 16, backgroundColor: colors.surface, alignItems: 'center' },
  hero: { flexDirection: 'column', alignItems: 'flex-start', backgroundColor: colors.surfaceAlt },
  emoji: { fontSize: 34 },
  heroEmoji: { fontSize: 56 },
  category: { color: colors.red, fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.red },
  title: { color: colors.text, fontSize: 16, fontWeight: '700', marginTop: 3, lineHeight: 22 },
  summary: { color: colors.textMuted, fontSize: 14, marginTop: 4 },
});
