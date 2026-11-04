import { useState } from 'react';
import { Platform, Share, StyleSheet, Text, TextInput } from 'react-native';

import { replaceChildAccount } from '../logic/ledger';
import { childViewLink, defaultShareNote, makeChildView } from '../logic/shareView';
import { useBank } from '../state/BankProvider';
import type { ChildAccount, Prices } from '../logic/types';
import { colors } from '../theme';
import { Button, Card, Hint, Label, Message, styles as ui } from './ui';

/** Partage d'un lien en lecture seule du compte enfant (pour l'autre parent). */
export function ShareViewCard({ child, parent, prices }: { child: ChildAccount; parent: string; prices: Prices }) {
  const { updateAccount } = useBank();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [note, setNote] = useState(child.shareNote ?? defaultShareNote(child));

  async function share() {
    // Le message est gardé pour le prochain partage.
    if (note !== child.shareNote) updateAccount((a) => replaceChildAccount(a, { ...child, shareNote: note }));
    const link = childViewLink(makeChildView(child, parent, prices, new Date(), note));
    const text = `Compte Orvia de ${child.name}, en lecture seule :\n${link}`;
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
      <Label>Message affiché en haut de la page (modifiable)</Label>
      <TextInput
        value={note}
        onChangeText={setNote}
        multiline
        style={[ui.input, styles.note]}
        accessibilityLabel="Message pour l’autre parent"
      />
      <Button title={`Partager le compte de ${child.name}`} variant="ghost" onPress={share} />
      {message && <Message {...message} />}
    </Card>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.text, fontSize: 16, fontWeight: '700' },
  note: { minHeight: 160, textAlignVertical: 'top', fontSize: 14, lineHeight: 20 },
});
