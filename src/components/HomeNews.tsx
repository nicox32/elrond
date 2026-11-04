import { router } from 'expo-router';
import { Pressable, Text } from 'react-native';

import { useNews } from '../state/useNews';
import { NewsRow } from './NewsRow';
import { Card, Hint, SectionTitle, styles as ui } from './ui';

/** Les 3 dernières actualités sur l'écran du compte. */
export function HomeNews() {
  const { news, loading } = useNews();
  const items = news?.items.slice(0, 3) ?? [];
  return (
    <>
      <SectionTitle
        right={
          <Pressable onPress={() => router.push('/actualites')} accessibilityRole="link">
            <Text style={ui.link}>Tout voir</Text>
          </Pressable>
        }
      >
        Actualités
      </SectionTitle>
      {items.length ? (
        <Card style={{ paddingVertical: 0 }}>
          {items.map((n, i) => (
            <NewsRow key={n.id} item={n} compact border={i > 0} />
          ))}
        </Card>
      ) : (
        <Pressable onPress={() => router.push('/actualites')} accessibilityRole="link">
          <Hint>
            {loading
              ? 'Chargement des actualités…'
              : 'Or.fr, Gold.fr, BullionVault et AuCOFFRE : touchez pour voir les actualités.'}
          </Hint>
        </Pressable>
      )}
    </>
  );
}
