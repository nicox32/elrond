import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from 'react-native';

import { PinConfirm } from '../components/PinConfirm';
import { Segmented } from '../components/Segmented';
import { TransactionRow } from '../components/TransactionRow';
import { Button, Card, Hint, Label, Message, Screen, SectionTitle, styles as ui } from '../components/ui';
import { formatEur, parseAmount } from '../logic/format';
import { CASH_SOURCE_LABEL, creditCash, LedgerError, withdrawCash } from '../logic/ledger';
import { useAccount, useBank } from '../state/BankProvider';
import { colors } from '../theme';

type Source = keyof typeof CASH_SOURCE_LABEL;

/** Compte d'attente : euros crédités, prêts à être investis en métaux selon la répartition. */
export default function CashScreen() {
  const account = useAccount();
  const { commit } = useBank();
  const cash = account.cashEur ?? 0;
  const [credit, setCredit] = useState('');
  const [source, setSource] = useState<Source>('transfer');
  const [out, setOut] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const txs = account.transactions.filter((t) => t.cash).slice(0, 15);

  const run = (op: Parameters<typeof commit>[0], ok: string) => {
    try {
      commit(op);
      setMessage({ ok: true, text: ok });
      return true;
    } catch (e) {
      setMessage({ ok: false, text: e instanceof LedgerError ? e.message : 'Une erreur est survenue.' });
      return false;
    }
  };

  const outAmount = parseAmount(out);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen testID="screen-attente">
        <View style={styles.hero}>
          <Text style={styles.heroLabel}>Compte d’attente</Text>
          <Text style={styles.heroValue}>{formatEur(cash)}</Text>
          <Text style={styles.heroSub}>disponibles pour acheter des métaux</Text>
        </View>

        <Button
          title={cash > 0 ? `Investir ${formatEur(cash)} selon ma répartition` : 'Investir selon ma répartition'}
          onPress={() => router.push({ pathname: '/repartition', params: { source: 'cash', t: Date.now() } })}
          disabled={cash < 1}
        />

        <SectionTitle>Créditer le compte</SectionTitle>
        <Card style={{ gap: 10 }}>
          <Segmented
            value={source}
            onChange={setSource}
            options={[
              { value: 'transfer', label: 'Virement' },
              { value: 'card', label: 'Carte bancaire' },
            ]}
          />
          <View style={styles.amountRow}>
            <TextInput
              value={credit}
              onChangeText={(t) => {
                setCredit(t);
                setMessage(null);
              }}
              placeholder="0"
              placeholderTextColor={colors.textMuted}
              keyboardType="decimal-pad"
              style={[ui.input, styles.amount]}
              accessibilityLabel="Montant à créditer en euros"
            />
            <Text style={styles.unit}>€</Text>
          </View>
          <Button
            title="Créditer"
            onPress={() => {
              const v = parseAmount(credit);
              if (!(v > 0)) return setMessage({ ok: false, text: 'Indiquez un montant.' });
              if (run((acc) => creditCash(acc, v, source), `${formatEur(v)} crédités sur le compte d’attente.`))
                setCredit('');
            }}
          />
          <Hint>
            {source === 'transfer'
              ? `Virement depuis votre banque vers votre IBAN Orvia : ${account.iban}. Sans frais.`
              : 'Paiement par carte bancaire, crédité tout de suite. Sans frais.'}
          </Hint>
        </Card>

        {message && <Message {...message} />}

        <SectionTitle>Retirer vers ma banque</SectionTitle>
        <Card style={{ gap: 10 }}>
          <View style={styles.amountRow}>
            <TextInput
              value={out}
              onChangeText={(t) => {
                setOut(t);
                setMessage(null);
              }}
              placeholder="0"
              placeholderTextColor={colors.textMuted}
              keyboardType="decimal-pad"
              style={[ui.input, styles.amount]}
              accessibilityLabel="Montant à retirer en euros"
            />
            <Text style={styles.unit}>€</Text>
          </View>
          <Button
            title="Retirer"
            variant="ghost"
            onPress={() => {
              if (!(outAmount > 0)) return setMessage({ ok: false, text: 'Indiquez un montant.' });
              if (outAmount > cash + 0.005)
                return setMessage({ ok: false, text: 'Solde du compte d’attente insuffisant.' });
              setConfirming(true);
            }}
          />
          <Label>Les euros en attente ne sont pas investis : ils ne prennent ni ne perdent de valeur.</Label>
        </Card>

        <SectionTitle>Mouvements</SectionTitle>
        {txs.length === 0 ? (
          <Hint>Aucun mouvement pour l’instant.</Hint>
        ) : (
          <Card style={{ paddingVertical: 0 }}>
            {txs.map((tx) => (
              <TransactionRow key={tx.id} tx={tx} unit={account.settings.unit} />
            ))}
          </Card>
        )}

        <PinConfirm
          visible={confirming}
          summary={`Retirer ${formatEur(outAmount || 0)} du compte d’attente vers votre banque.`}
          onConfirm={() => {
            setConfirming(false);
            if (run((acc) => withdrawCash(acc, outAmount), `${formatEur(outAmount)} renvoyés vers votre banque.`)) {
              setOut('');
            }
          }}
          onCancel={() => setConfirming(false)}
        />
      </Screen>
    </KeyboardAvoidingView>
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
  heroLabel: { color: colors.textMuted, fontSize: 14, fontWeight: '600' },
  heroValue: { color: colors.text, fontSize: 34, fontWeight: '800', fontVariant: ['tabular-nums'] },
  heroSub: { color: colors.textMuted, fontSize: 13 },
  amountRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  amount: { flex: 1, minWidth: 0, fontSize: 22, fontWeight: '700' },
  unit: { color: colors.textMuted, fontSize: 20, fontWeight: '700' },
});
