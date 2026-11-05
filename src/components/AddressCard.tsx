import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { useAccount, useBank } from '../state/BankProvider';
import { colors } from '../theme';
import { Button, Card, Hint, Label, Message, styles as ui } from './ui';

/** Adresse postale imprimée sur les relevés (les vôtres et ceux de vos enfants). Gardée sur ce téléphone. */
export function AddressCard() {
  const account = useAccount();
  const { updateSettings } = useBank();
  const a = account.settings.address;
  const [name, setName] = useState(a?.name ?? '');
  const [street, setStreet] = useState(a?.street ?? '');
  const [postcode, setPostcode] = useState(a?.postcode ?? '');
  const [city, setCity] = useState(a?.city ?? '');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const filled = street.trim() && postcode.trim() && city.trim();
  const validCode = /^\d{5}$/.test(postcode.trim());

  function save() {
    if (!filled) {
      updateSettings({ address: undefined });
      setMsg({ ok: true, text: 'Adresse retirée des relevés.' });
      return;
    }
    if (!validCode) return setMsg({ ok: false, text: 'Le code postal doit avoir 5 chiffres.' });
    updateSettings({
      address: { name: name.trim() || undefined, street: street.trim(), postcode: postcode.trim(), city: city.trim() },
    });
    setMsg({ ok: true, text: 'Adresse enregistrée : elle figure sur vos relevés et ceux de vos enfants.' });
  }

  return (
    <Card style={{ gap: 8 }}>
      <Text style={styles.title}>Adresse sur les relevés</Text>
      <Label>Nom imprimé</Label>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder={`ex. M. ${account.holder} Dupont`}
        placeholderTextColor={colors.textMuted}
        style={ui.input}
        accessibilityLabel="Nom imprimé sur les relevés"
      />
      <Label>Adresse</Label>
      <TextInput
        value={street}
        onChangeText={setStreet}
        placeholder="N° et rue"
        placeholderTextColor={colors.textMuted}
        style={ui.input}
        accessibilityLabel="Rue"
      />
      <View style={styles.row}>
        <TextInput
          value={postcode}
          onChangeText={setPostcode}
          placeholder="Code postal"
          placeholderTextColor={colors.textMuted}
          keyboardType="number-pad"
          maxLength={5}
          style={[ui.input, { width: 120 }]}
          accessibilityLabel="Code postal"
        />
        <TextInput
          value={city}
          onChangeText={setCity}
          placeholder="Ville"
          placeholderTextColor={colors.textMuted}
          style={[ui.input, { flex: 1, minWidth: 0 }]}
          accessibilityLabel="Ville"
        />
      </View>
      <Hint>Gardée sur ce téléphone (et dans vos sauvegardes), jamais envoyée ailleurs.</Hint>
      {msg && <Message {...msg} />}
      <Button title="Enregistrer l’adresse" variant="ghost" onPress={save} />
    </Card>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.text, fontSize: 16, fontWeight: '700' },
  row: { flexDirection: 'row', gap: 8 },
});
