import { useState } from 'react';
import { Platform, Share, StyleSheet, Text } from 'react-native';

import { childViewLink, makeChildView } from '../logic/shareView';
import type { ChildAccount, Prices } from '../logic/types';
import { colors } from '../theme';
import { Button, Card, Hint, Message } from './ui';

/** Partage d'un lien en lecture seule du compte enfant (pour l'autre parent). */
export function ShareViewCard({ child, parent, prices }: { child: ChildAccount; parent: string; prices: Prices }) {
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function share() {
    const link = childViewLink(makeChildView(child, parent, prices));
    const text = `Compte Orvia de ${child.name}, en lecture seule (aucune opération possible) :\n${link}`;
    try {
      if (Platform.OS === 'web' && !navigator.share) {
        await navigator.clipboard.writeText(link);
        setMessage({ ok: true, text: 'Lien copié : collez-le dans un SMS ou un e-mail.' });
        return;
      }
      await Share.share(Platform.OS === 'web' ? { message: text, url: link } : { message: text });
      setMessage(null);
    } catch {
      setMessage({ ok: false, text: 'Le partage n’a pas pu s’ouvrir. Réessayez.' });
    }
  }

  return (
    <Card style={{ gap: 10 }}>
      <Text style={styles.title}>Lien en lecture seule</Text>
      <Hint>
        Envoyez à l’autre parent un lien qui s’ouvre dans le navigateur, sans appli ni code : il voit la valeur du
        compte aux cours du moment, les coffres, les règles et les derniers mouvements, mais ne peut rien faire. C’est
        une photo du compte : renvoyez un lien pour montrer les nouveaux mouvements. Toute personne qui a le lien peut
        le consulter : envoyez-le seulement à la bonne personne.
      </Hint>
      <Button title={`Partager le compte de ${child.name}`} variant="ghost" onPress={share} />
      {message && <Message {...message} />}
    </Card>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.text, fontSize: 16, fontWeight: '700' },
});
