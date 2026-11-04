import { useState } from 'react';
import { ActivityIndicator, Platform, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { NewsRow, openArticle } from '../components/NewsRow';
import { Segmented } from '../components/Segmented';
import { Card, Hint, Screen } from '../components/ui';
import { NEWS_SOURCES, type NewsSourceId, sourceName } from '../logic/news';
import { useNews } from '../state/useNews';
import { colors } from '../theme';

type Filter = 'all' | NewsSourceId;

/** Actualités des métaux précieux : Or.fr, Gold.fr, BullionVault et AuCOFFRE. */
export default function NewsScreen() {
  const { news, loading, error, refresh } = useNews();
  const [filter, setFilter] = useState<Filter>('all');
  const items = (news?.items ?? []).filter((n) => filter === 'all' || n.source === filter);

  return (
    <Screen
      testID="screen-actualites"
      refreshControl={<RefreshControl refreshing={loading && !!news} onRefresh={refresh} tintColor={colors.gold} />}
    >
      <Segmented
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'all', label: 'Tout' },
          ...NEWS_SOURCES.map((s) => ({ value: s.id, label: s.name === 'BullionVault' ? 'Bullion' : s.name })),
        ]}
      />
      {news?.fetchedAt && (
        <Hint>
          Mis à jour{' '}
          {new Date(news.fetchedAt).toLocaleString('fr-FR', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
          })}
          {news.failed.length ? ` · indisponible pour l’instant : ${news.failed.map(sourceName).join(', ')}` : ''}.
          Tirez vers le bas pour actualiser.
        </Hint>
      )}

      {!news && loading && (
        <View style={{ paddingVertical: 40 }}>
          <ActivityIndicator color={colors.gold} />
        </View>
      )}

      {!news && !loading && error && (
        <Card style={{ gap: 8 }}>
          <Text style={styles.title}>Actualités indisponibles</Text>
          <Hint>
            {Platform.OS === 'web'
              ? 'Ces sites ne permettent pas la lecture de leurs actualités depuis un navigateur : ouvrez l’appli Android, ou consultez-les directement :'
              : 'Vérifiez votre connexion, puis tirez vers le bas pour réessayer. Vous pouvez aussi les consulter directement :'}
          </Hint>
          {NEWS_SOURCES.map((s) => (
            <Pressable key={s.id} onPress={() => openArticle(s.site)} accessibilityRole="link">
              <Text style={styles.link}>{s.name} ›</Text>
            </Pressable>
          ))}
        </Card>
      )}

      {items.length > 0 && (
        <Card style={{ paddingVertical: 0 }}>
          {items.map((n, i) => (
            <NewsRow key={n.id} item={n} border={i > 0} />
          ))}
        </Card>
      )}
      {news && items.length === 0 && <Hint>Aucun article récent pour cette source.</Hint>}

      <Hint style={{ marginTop: 8 }}>
        Titres et résumés issus des flux publics de chaque site ; touchez un article pour le lire en entier sur son
        site. Ces articles expriment l’avis de leurs auteurs, pas celui d’Orvia, et ne sont pas des conseils de
        placement.
      </Hint>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.text, fontSize: 16, fontWeight: '700' },
  link: { color: colors.gold, fontSize: 15, fontWeight: '700', paddingVertical: 4 },
});
