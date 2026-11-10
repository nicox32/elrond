import { useState } from 'react';
import { Platform, Share, Text, TextInput, View } from 'react-native';

import { Button, Card, Label, Screen, styles } from '../components/ui';
import { exportBackup, importBackup } from '../logic/backup';
import type { CarnetState } from '../logic/types';
import { useCarnet } from '../state/CarnetProvider';
import { colors } from '../theme';

export default function SauvegardeScreen() {
  const { state, replaceAll } = useCarnet();
  const [exported, setExported] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [pending, setPending] = useState<CarnetState | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function doExport() {
    const json = exportBackup(state);
    setExported(json);
    if (Platform.OS !== 'web') {
      try {
        await Share.share({ message: json, title: 'Sauvegarde du carnet de chasse' });
      } catch {
        // Partage annulé : le texte reste affiché ci-dessous.
      }
    }
  }

  function check() {
    const res = importBackup(text);
    if (!res.ok) {
      setPending(null);
      setMessage({ ok: false, text: res.error });
      return;
    }
    setPending(res.state);
    setMessage(null);
  }

  return (
    <Screen top={false}>
      <Card style={{ gap: 8 }}>
        <Text style={styles.strong}>Exporter</Text>
        <Text style={styles.muted}>
          Vos {state.hunts.length} chasses, vos armes, vos zones de besoin et vos réglages sont enregistrés uniquement sur ce téléphone.
          Exportez-les régulièrement (dans vos notes, un e-mail, Drive…) pour ne rien perdre. Les photos ne sont pas
          incluses.
        </Text>
        <Button label="Exporter mes données" onPress={doExport} />
        {exported ? (
          <TextInput
            value={exported}
            multiline
            editable={false}
            selectTextOnFocus
            style={[styles.input, { maxHeight: 160, fontSize: 12, fontFamily: Platform.OS === 'android' ? 'monospace' : undefined }]}
          />
        ) : null}
      </Card>

      <Card style={{ gap: 8, marginTop: 8 }}>
        <Text style={styles.strong}>Restaurer</Text>
        <Label>Collez ici le texte d&apos;une sauvegarde</Label>
        <TextInput
          value={text}
          onChangeText={(t) => {
            setText(t);
            setPending(null);
            setMessage(null);
          }}
          multiline
          placeholder='{"app": "carnet-chasse-woth2", …}'
          placeholderTextColor={colors.textMuted}
          style={[styles.input, { minHeight: 100, textAlignVertical: 'top', fontSize: 12 }]}
        />
        {!pending ? <Button label="Vérifier la sauvegarde" kind="secondary" disabled={!text.trim()} onPress={check} /> : null}
        {pending ? (
          <View style={{ gap: 8 }}>
            <Text style={styles.text}>
              Sauvegarde valide : {pending.hunts.length} chasses, {pending.customWeapons.length} armes ajoutées,{' '}
              {pending.needZones.length} zones de besoin. Elle
              remplacera toutes les données actuelles ({state.hunts.length} chasses).
            </Text>
            <Button
              label="Remplacer mes données"
              kind="danger"
              onPress={() => {
                replaceAll(pending);
                setPending(null);
                setText('');
                setMessage({ ok: true, text: 'Données restaurées.' });
              }}
            />
          </View>
        ) : null}
        {message ? (
          <Text style={{ color: message.ok ? colors.olive : colors.danger, fontWeight: '700' }}>{message.text}</Text>
        ) : null}
      </Card>
    </Screen>
  );
}
