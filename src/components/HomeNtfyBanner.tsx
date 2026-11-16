import { router } from 'expo-router';
import { useState } from 'react';

import { formatDate } from '../logic/format';
import { inboxKind } from '../logic/ntfyClient';
import { useNtfyInbox } from '../state/useNtfyInbox';
import { Banner } from './ui';

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
    <Banner tone="gold" icon="🔔" title={last.title} onPress={() => router.push('/notifications')}>
      {`${last.body} · ${formatDate(last.date)}`}
    </Banner>
  );
}
