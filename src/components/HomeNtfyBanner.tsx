import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { formatDate } from '../logic/format';
import { inboxKind } from '../logic/ntfyClient';
import { useNtfyInbox } from '../state/useNtfyInbox';
import { colors } from '../theme';

/** Dernière alerte ou dernier achat du bot reçu sur le canal ntfy (moins de 24 h), sur l'écran du compte. */
export function HomeNtfyBanner({ topic, after }: { topic?: string; after?: string }) {
  const { messages, checkedAt } = useNtfyInbox(topic);
  // « Maintenant » = dernière vérification du canal (pas d'horloge lue pendant l'affichage).
  const [openedAt] = useState(() => new Date().toISOString());
  const now = new Date(checkedAt ?? openedAt).getTime();
  const last = messages.find((m) => inboxKind(m.title) === 'alert' || inboxKind(m.title) === 'bot');
  if (!last || now - new Date(last.date).getTime() > 86_400_000) return null;
  if (after && after >= last.date) return null; // une alerte plus récente de l'appli est déjà affichée
  return (
    <Pressable onPress={() => router.push('/notifications')} style={styles.banner} accessibilityRole="button">
      <Text style={styles.title}>{last.title}</Text>
      <Text style={styles.body}>
        {last.body} · {formatDate(last.date)}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: { backgroundColor: colors.goldSoft, borderRadius: 14, padding: 12, gap: 4 },
  title: { color: colors.text, fontSize: 14, fontWeight: '700' },
  body: { color: colors.text, fontSize: 13 },
});
