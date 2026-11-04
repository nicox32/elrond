import * as WebBrowser from 'expo-web-browser';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { type NewsItem, sourceName } from '../logic/news';
import { colors } from '../theme';

/** « il y a 3 h », « hier », « 21 oct. » */
export function newsAge(iso?: string, now = Date.now()): string {
  if (!iso) return '';
  const d = new Date(iso);
  const min = Math.round((now - d.getTime()) / 60_000);
  if (min < 60) return `il y a ${Math.max(1, min)} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `il y a ${h} h`;
  if (h < 48) return 'hier';
  return d.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: d.getFullYear() !== new Date(now).getFullYear() ? 'numeric' : undefined,
  });
}

export function openArticle(link: string) {
  WebBrowser.openBrowserAsync(link, { toolbarColor: colors.background, controlsColor: colors.gold }).catch(() => {});
}

/** Un article : source, date, titre, résumé et image ; touche pour lire l'article sur le site. */
export function NewsRow({
  item,
  compact = false,
  border = false,
}: {
  item: NewsItem;
  compact?: boolean;
  border?: boolean;
}) {
  return (
    <Pressable
      onPress={() => openArticle(item.link)}
      style={({ pressed }) => [styles.row, border && styles.border, pressed && { opacity: 0.7 }]}
      accessibilityRole="link"
      accessibilityLabel={`${item.title}, ${sourceName(item.source)}`}
    >
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={styles.meta}>
          <Text style={styles.source}>{sourceName(item.source)}</Text>
          {item.date ? ` · ${newsAge(item.date)}` : ''}
        </Text>
        <Text style={styles.title} numberOfLines={compact ? 2 : 3}>
          {item.title}
        </Text>
        {!compact && item.summary ? (
          <Text style={styles.summary} numberOfLines={3}>
            {item.summary}
          </Text>
        ) : null}
      </View>
      {item.image && !compact ? <Image source={{ uri: item.image }} style={styles.image} resizeMode="cover" /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12, paddingVertical: 12, alignItems: 'flex-start' },
  border: { borderTopWidth: 1, borderTopColor: colors.border },
  meta: { color: colors.textMuted, fontSize: 12 },
  source: { color: colors.gold, fontWeight: '700' },
  title: { color: colors.text, fontSize: 15, fontWeight: '700', lineHeight: 20 },
  summary: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
  image: { width: 76, height: 76, borderRadius: 10, backgroundColor: colors.surfaceAlt },
});
