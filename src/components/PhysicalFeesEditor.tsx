import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { formatEur, parseAmount } from '../logic/format';
import { BAR_PRODUCTS, physicalFeesOf, PHYSICAL } from '../logic/physical';
import { useAccount, useBank } from '../state/BankProvider';
import { colors } from '../theme';
import { Button, Card, Hint, Label, Message, styles as ui } from './ui';

const toText = (n: number | undefined) =>
  n === undefined ? '' : (Math.round(n * 10000) / 100).toLocaleString('fr-FR', { maximumFractionDigits: 2 });
const toRate = (t: string) => Math.round(parseAmount(t) * 100) / 10000;

/** Société Orvia : frais du retrait physique (fabrication par format, prime du vendeur, livraison), réglables. */
export function PhysicalFeesEditor() {
  const account = useAccount();
  const { quote, updateSettings } = useBank();
  const fees = physicalFeesOf(account.settings);
  const [premiums, setPremiums] = useState<Record<string, string>>(() =>
    Object.fromEntries(BAR_PRODUCTS.map((p) => [p.id, toText(fees.premiums[p.id])])),
  );
  const [vendor, setVendor] = useState<Record<string, string>>(() =>
    Object.fromEntries(BAR_PRODUCTS.map((p) => [p.id, toText(fees.vendor[p.id])])),
  );
  const [delivery, setDelivery] = useState(String(fees.delivery).replace('.', ','));
  const [free, setFree] = useState(String(fees.freeFromGrams).replace('.', ','));
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const valid =
    BAR_PRODUCTS.every((p) => {
      const r = toRate(premiums[p.id]);
      const v = vendor[p.id].trim() ? toRate(vendor[p.id]) : 0;
      return r >= 0 && r <= 0.5 && v >= 0 && v <= 0.5;
    }) &&
    parseAmount(delivery) >= 0 &&
    parseAmount(delivery) <= 200 &&
    parseAmount(free) >= 0 &&
    parseAmount(free) <= 1000;

  function save() {
    const prem: Record<string, number> = {};
    const vend: Record<string, number> = {};
    for (const p of BAR_PRODUCTS) {
      prem[p.id] = toRate(premiums[p.id]);
      if (vendor[p.id].trim()) vend[p.id] = toRate(vendor[p.id]);
    }
    updateSettings({
      physicalFees: { premiums: prem, vendor: vend, delivery: parseAmount(delivery), freeFromGrams: parseAmount(free) },
    });
    setMsg({
      ok: true,
      text: 'Frais enregistrés : ils s’appliquent aux prochains retraits, aux Tarifs et à l’accueil.',
    });
  }

  function reset() {
    updateSettings({ physicalFees: undefined });
    setPremiums(Object.fromEntries(BAR_PRODUCTS.map((p) => [p.id, toText(physicalFeesOf().premiums[p.id])])));
    setVendor(Object.fromEntries(BAR_PRODUCTS.map((p) => [p.id, toText(physicalFeesOf().vendor[p.id])])));
    setDelivery(String(PHYSICAL.delivery));
    setFree(String(PHYSICAL.freeDeliveryFromGrams));
    setMsg({ ok: true, text: 'Valeurs par défaut rétablies.' });
  }

  return (
    <Card style={{ gap: 12 }}>
      <Text style={styles.title}>Frais du retrait physique</Text>
      <Hint>
        Pour chaque format : ce que paie le client (fabrication ou prime, en % de la valeur de l’or) et ce que vous
        payez au vendeur. La marge est la différence. Les valeurs servent au retrait, aux Tarifs, à l’accueil et au coût
        dans Société Orvia.
      </Hint>
      <View style={styles.head}>
        <Text style={[styles.col, { flexGrow: 1.4 }]}>Format</Text>
        <Text style={styles.col}>Client %</Text>
        <Text style={styles.col}>Vendeur %</Text>
      </View>
      {BAR_PRODUCTS.map((p) => {
        const client = toRate(premiums[p.id]);
        const vend = vendor[p.id].trim() ? toRate(vendor[p.id]) : null;
        const value = p.grams * quote.prices.gold;
        const margin = vend === null || !Number.isFinite(client) ? null : value * (client - vend);
        return (
          <View key={p.id} style={{ gap: 4 }}>
            <View style={styles.line}>
              <Text style={[styles.name, { flexGrow: 1.4, flexBasis: 0, minWidth: 0 }]}>
                {p.label.replace(/ \(.*/, '')}
              </Text>
              <TextInput
                value={premiums[p.id]}
                onChangeText={(t) => setPremiums((x) => ({ ...x, [p.id]: t }))}
                keyboardType="decimal-pad"
                style={[ui.input, styles.input]}
                accessibilityLabel={`Frais client ${p.label}`}
              />
              <TextInput
                value={vendor[p.id]}
                onChangeText={(t) => setVendor((x) => ({ ...x, [p.id]: t }))}
                keyboardType="decimal-pad"
                placeholder="—"
                placeholderTextColor={colors.textMuted}
                style={[ui.input, styles.input]}
                accessibilityLabel={`Prime vendeur ${p.label}`}
              />
            </View>
            <Text style={[styles.margin, margin !== null && { color: margin >= 0 ? colors.up : colors.down }]}>
              {margin === null
                ? 'Prime vendeur inconnue : marge non calculée'
                : `Marge ${margin >= 0 ? '+' : '−'}${formatEur(Math.abs(margin))} par ${p.coin ? 'pièce' : 'lingotin'} (${(
                    (client - (vend ?? 0)) *
                    100
                  ).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} pt)`}
            </Text>
          </View>
        );
      })}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1, gap: 5 }}>
          <Label>Livraison par envoi (€)</Label>
          <TextInput
            value={delivery}
            onChangeText={setDelivery}
            keyboardType="decimal-pad"
            style={ui.input}
            accessibilityLabel="Livraison par envoi"
          />
        </View>
        <View style={{ flex: 1, gap: 5 }}>
          <Label>Offerte dès (g d’or)</Label>
          <TextInput
            value={free}
            onChangeText={setFree}
            keyboardType="decimal-pad"
            style={ui.input}
            accessibilityLabel="Livraison offerte dès"
          />
        </View>
      </View>
      <Button title="Enregistrer les frais" onPress={save} disabled={!valid} />
      <Button title="Rétablir les valeurs par défaut" variant="ghost" onPress={reset} />
      {msg ? <Message {...msg} /> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.text, fontSize: 16, fontWeight: '700' },
  head: { flexDirection: 'row', gap: 8 },
  col: {
    color: colors.textMuted,
    fontSize: 11.5,
    fontWeight: '700',
    flexGrow: 1,
    flexBasis: 0,
    minWidth: 0,
    textTransform: 'uppercase',
  },
  line: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { color: colors.text, fontSize: 14, fontWeight: '600' },
  input: { flexGrow: 1, flexBasis: 0, minWidth: 0, paddingVertical: 9, paddingHorizontal: 10, fontSize: 15 },
  margin: { color: colors.textMuted, fontSize: 12 },
});
