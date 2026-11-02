import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Platform, StyleSheet, Text, View } from 'react-native';

import { AmountInput } from '../../components/AmountInput';
import { DormancyNotice } from '../../components/DormancyNotice';
import { MetalPicker } from '../../components/MetalPicker';
import { Segmented } from '../../components/Segmented';
import { TransactionRow } from '../../components/TransactionRow';
import { Button, Card, Hint, Label, Message, Screen, SectionTitle } from '../../components/ui';
import { formatEur, formatWeight, parseAmount } from '../../logic/format';
import {
  accountValue,
  fundChild,
  LedgerError,
  METAL_LABEL,
  METAL_OF,
  removeChild,
  toGrams,
  withdrawFromChild,
} from '../../logic/ledger';
import { type AmountUnit, type Metal, METALS } from '../../logic/types';
import { useAccount, useBank } from '../../state/BankProvider';
import { colors, metalColor } from '../../theme';

type Direction = 'fund' | 'withdraw';

export default function ChildScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const account = useAccount();
  const { quote, commit } = useBank();
  const unit = account.settings.unit;
  const child = account.children.find((c) => c.id === id);

  const [direction, setDirection] = useState<Direction>('fund');
  const [metal, setMetal] = useState<Metal>('gold');
  const [amountUnit, setAmountUnit] = useState<AmountUnit>('g');
  const [text, setText] = useState('');
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  if (!child) {
    return (
      <Screen>
        <Hint>Ce compte enfant n’existe plus.</Hint>
      </Screen>
    );
  }

  const value = accountValue(child, quote.prices);
  const amount = parseAmount(text);
  const grams =
    Number.isFinite(amount) && amount > 0 ? toGrams({ unit: amountUnit, value: amount }, quote.prices[metal]) : 0;
  const source = direction === 'fund' ? account : child;

  function submit() {
    if (!child) return;
    const q = { unit: amountUnit, value: amount };
    try {
      commit((acc, p) =>
        direction === 'fund' ? fundChild(acc, p, child.id, metal, q) : withdrawFromChild(acc, p, child.id, metal, q),
      );
      setText('');
      setMessage({
        ok: true,
        text: direction === 'fund' ? `Versé sur le compte de ${child.name}.` : `Repris sur ton compte.`,
      });
    } catch (e) {
      setMessage({ ok: false, text: e instanceof LedgerError ? e.message : 'Une erreur est survenue.' });
    }
  }

  function close() {
    if (!child) return;
    const run = () => {
      try {
        commit((acc) => removeChild(acc, child.id));
        router.back();
      } catch (e) {
        setMessage({ ok: false, text: e instanceof LedgerError ? e.message : 'Une erreur est survenue.' });
      }
    };
    if (Platform.OS === 'web') return run();
    Alert.alert(`Fermer le compte de ${child.name} ?`, 'Le compte doit être vide.', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Fermer', style: 'destructive', onPress: run },
    ]);
  }

  return (
    <Screen testID="screen-enfant">
      <Stack.Screen options={{ title: `Compte de ${child.name}` }} />

      <View style={styles.hero}>
        <Text style={styles.heroLabel}>Solde du compte de {child.name}</Text>
        <Text style={styles.heroValue}>{formatEur(value.total)}</Text>
        <View style={styles.metals}>
          {METALS.map((m) => (
            <View key={m} style={{ alignItems: 'center', flex: 1 }}>
              <Text style={[styles.metalName, { color: metalColor[m] }]}>{METAL_LABEL[m]}</Text>
              <Text style={styles.metalWeight}>{formatWeight(child.holdings[m], unit)}</Text>
            </View>
          ))}
        </View>
      </View>

      <DormancyNotice wallet={child} name={child.name} />

      <SectionTitle>{direction === 'fund' ? 'Verser du métal' : 'Reprendre du métal'}</SectionTitle>
      <Segmented
        value={direction}
        onChange={(d) => {
          setDirection(d);
          setMessage(null);
        }}
        options={[
          { value: 'fund', label: `Verser à ${child.name}` },
          { value: 'withdraw', label: 'Reprendre' },
        ]}
      />
      <View style={{ gap: 8 }}>
        <Label>Métal</Label>
        <MetalPicker value={metal} onChange={setMetal} />
        <Hint>
          Disponible sur {direction === 'fund' ? 'ton compte' : `le compte de ${child.name}`} :{' '}
          {formatWeight(source.holdings[metal], unit)}
        </Hint>
      </View>
      <View style={{ gap: 8 }}>
        <Label>Quantité</Label>
        <AmountInput
          text={text}
          onChangeText={(t) => {
            setText(t);
            setMessage(null);
          }}
          unit={amountUnit}
          onUnitChange={setAmountUnit}
        />
      </View>
      {grams > 0 && (
        <Text style={styles.preview}>
          {direction === 'fund'
            ? `${formatWeight(grams, unit)} ${METAL_OF[metal]} passent de ton compte à celui de ${child.name}`
            : `${formatWeight(grams, unit)} ${METAL_OF[metal]} reviennent sur ton compte`}{' '}
          ({formatEur(grams * quote.prices[metal])}), sans frais.
        </Text>
      )}
      <Button title="Valider" onPress={submit} />
      {message && <Message {...message} />}

      <SectionTitle>Mouvements</SectionTitle>
      {child.transactions.length === 0 ? (
        <Hint>Aucun mouvement pour l’instant.</Hint>
      ) : (
        <Card style={{ paddingVertical: 0 }}>
          {child.transactions.slice(0, 20).map((tx) => (
            <TransactionRow key={tx.id} tx={tx} unit={unit} />
          ))}
        </Card>
      )}

      <Button title={`Fermer le compte de ${child.name}`} variant="danger" onPress={close} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.gold,
    padding: 18,
    alignItems: 'center',
    gap: 4,
  },
  heroLabel: { color: colors.textMuted, fontSize: 13 },
  heroValue: { color: colors.text, fontSize: 30, fontWeight: '800', fontVariant: ['tabular-nums'] },
  metals: { flexDirection: 'row', marginTop: 10, alignSelf: 'stretch' },
  metalName: { fontSize: 12, fontWeight: '700' },
  metalWeight: { color: colors.text, fontSize: 14, fontWeight: '600', fontVariant: ['tabular-nums'] },
  preview: {
    color: colors.text,
    backgroundColor: colors.goldSoft,
    padding: 12,
    borderRadius: 12,
    fontSize: 14,
    lineHeight: 20,
  },
});
