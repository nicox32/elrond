import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { Segmented } from '../components/Segmented';
import { Button, Card, Hint, Screen } from '../components/ui';
import { metalOfServerTitle } from '../logic/alerts';
import { formatDate } from '../logic/format';
import { type InboxKind, inboxKind, isValidTopic } from '../logic/ntfyClient';
import { useAccount } from '../state/BankProvider';
import { useNtfyInbox } from '../state/useNtfyInbox';
import { colors } from '../theme';

type Filter = 'all' | InboxKind;
const KIND_LABEL: Record<InboxKind, string> = { alert: 'Alerte', bot: 'Bot d’achat', test: 'Test', other: 'Message' };
const KIND_COLOR: Record<InboxKind, string> = {
  alert: colors.gold,
  bot: colors.up,
  test: colors.textMuted,
  other: colors.textMuted,
};

/** Tout ce qui arrive sur le canal ntfy : alertes du serveur, achats du bot, tests. */
export default function NotificationsScreen() {
  const account = useAccount();
  const topic = account.ntfyTopic;
  const { messages, loading, error, checkedAt, refresh } = useNtfyInbox(topic);
  const [filter, setFilter] = useState<Filter>('all');
  const shown = messages.filter((m) => filter === 'all' || inboxKind(m.title) === filter);

  if (!isValidTopic(topic)) {
    return (
      <Screen testID="screen-notifications">
        <Card style={{ gap: 8 }}>
          <Text style={styles.title}>Aucun canal ntfy</Text>
          <Hint>Indiquez votre canal dans Profil → Bot d’achat sur baisse → Canal ntfy, puis revenez ici.</Hint>
          <Button title="Régler le canal" variant="ghost" onPress={() => router.push('/bot')} />
        </Card>
      </Screen>
    );
  }

  return (
    <Screen
      testID="screen-notifications"
      refreshControl={
        <RefreshControl refreshing={loading && messages.length > 0} onRefresh={refresh} tintColor={colors.gold} />
      }
    >
      <Segmented
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'all', label: 'Tout' },
          { value: 'alert', label: 'Alertes' },
          { value: 'bot', label: 'Bot' },
          { value: 'test', label: 'Tests' },
        ]}
      />
      <Hint>
        Canal {topic.slice(0, 10)}… ·{' '}
        {checkedAt ? `vérifié à ${formatDate(checkedAt).split(', ')[1] ?? ''}` : 'vérification…'}
        {error ? ' · ntfy injoignable pour l’instant' : ''}. Mis à jour toutes les 30 secondes ; tirez pour actualiser.
      </Hint>

      {shown.length === 0 ? (
        <Hint>{loading ? 'Chargement…' : 'Aucun message pour l’instant.'}</Hint>
      ) : (
        shown.map((m) => {
          const kind = inboxKind(m.title);
          const metal = metalOfServerTitle(m.title);
          return (
            <Card key={m.id} style={{ gap: 6 }}>
              <View style={styles.head}>
                <Text style={[styles.kind, { color: KIND_COLOR[kind] }]}>{KIND_LABEL[kind]}</Text>
                <Text style={styles.date}>{formatDate(m.date)}</Text>
              </View>
              <Text style={styles.title}>{m.title}</Text>
              {m.body ? <Text style={styles.body}>{m.body}</Text> : null}
              {kind === 'alert' && metal && (
                <View style={styles.actions}>
                  <Pressable
                    onPress={() =>
                      router.push({ pathname: '/operations', params: { mode: 'buy', metal, t: Date.now() } })
                    }
                    accessibilityRole="button"
                  >
                    <Text style={styles.link}>Acheter ›</Text>
                  </Pressable>
                  <Pressable
                    onPress={() =>
                      router.push({ pathname: '/operations', params: { mode: 'sell', metal, t: Date.now() } })
                    }
                    accessibilityRole="button"
                  >
                    <Text style={styles.link}>Vendre ›</Text>
                  </Pressable>
                </View>
              )}
            </Card>
          );
        })
      )}
      <Hint style={{ marginTop: 8 }}>
        ntfy.sh ne garde les messages que 12 heures : Orvia garde sur ce téléphone tous ceux qu’elle a vus (300 au
        plus).
      </Hint>
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  kind: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  date: { color: colors.textMuted, fontSize: 12 },
  title: { color: colors.text, fontSize: 15, fontWeight: '700' },
  body: { color: colors.text, fontSize: 14, lineHeight: 20 },
  actions: { flexDirection: 'row', gap: 24, marginTop: 4 },
  link: { color: colors.gold, fontSize: 14, fontWeight: '700' },
});
