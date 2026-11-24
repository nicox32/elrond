import { useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';

import { AppScreen } from '../../components/phone';
import { ARTICLES } from '../../data/world';
import { usePhone } from '../../state/PhoneProvider';
import { colors } from '../../theme';

export default function ArticleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { readNews } = usePhone();
  const a = ARTICLES.find((x) => x.id === id);

  useEffect(() => {
    if (a) readNews(a.id);
  }, [a, readNews]);

  return (
    <AppScreen title="Corail Info" color={colors.red} back="pop">
      {a ? (
        <ScrollView contentContainerStyle={styles.body}>
          <Text style={styles.emoji}>{a.emoji}</Text>
          <Text style={styles.category}>{a.category.toUpperCase()}</Text>
          <Text style={styles.title}>{a.title}</Text>
          <Text style={styles.summary}>{a.summary}</Text>
          <Text style={styles.text}>{a.body}</Text>
          <Text style={styles.footer}>Corail Info — information parodique. Toute ressemblance avec des faits réels serait fortuite.</Text>
        </ScrollView>
      ) : (
        <Text style={styles.summary}>Article introuvable.</Text>
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  body: { padding: 18, gap: 10 },
  emoji: { fontSize: 64 },
  category: { color: colors.red, fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  title: { color: colors.text, fontSize: 24, fontWeight: '800', lineHeight: 30 },
  summary: { color: colors.textMuted, fontSize: 16, fontStyle: 'italic', lineHeight: 22 },
  text: { color: colors.text, fontSize: 16, lineHeight: 25 },
  footer: { color: colors.textMuted, fontSize: 12, marginTop: 20 },
});
