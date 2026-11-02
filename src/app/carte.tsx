import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { MetalPicker } from '../components/MetalPicker';
import { OrviaCard } from '../components/OrviaCard';
import { PinConfirm } from '../components/PinConfirm';
import { Segmented } from '../components/Segmented';
import { TransactionRow } from '../components/TransactionRow';
import { Button, Card, Hint, Label, Message, Screen, SectionTitle, styles as ui } from '../components/ui';
import { formatEur, formatWeight, parseAmount } from '../logic/format';
import {
  CARD,
  cardPay,
  cardUsage,
  cardWithdraw,
  issueCard,
  LedgerError,
  METAL_OF,
  setCardFrozen,
  setCardMetal,
} from '../logic/ledger';
import { useAccount, useBank } from '../state/BankProvider';
import { colors } from '../theme';

type Mode = 'pay' | 'withdraw';

export default function CardScreen() {
  const account = useAccount();
  const { quote, commit } = useBank();
  const unit = account.settings.unit;
  const card = account.card;

  const [mode, setMode] = useState<Mode>('pay');
  const [merchant, setMerchant] = useState('');
  const [text, setText] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  if (!card) {
    return (
      <Screen testID="screen-carte">
        <Text style={styles.title}>La carte Orvia</Text>
        <Text style={styles.para}>
          Paie partout et retire des espèces avec l’or, l’argent ou le platine de ton compte. À chaque paiement, le
          métal choisi est vendu au cours du moment, sans frais.
        </Text>
        <Card style={{ gap: 6 }}>
          <Text style={styles.point}>• Carte virtuelle gratuite, sans frais de tenue</Text>
          <Text style={styles.point}>• Paiements et retraits sans frais</Text>
          <Text style={styles.point}>
            • Plafonds : {formatEur(CARD.paymentLimit30d)} de paiements sur 30 jours,{' '}
            {formatEur(CARD.withdrawalLimit7d)} de retraits sur 7 jours
          </Text>
          <Text style={styles.point}>• Gel et dégel en un geste</Text>
          <Text style={styles.point}>• Chaque paiement ou retrait d’au moins 1 € évite les frais d’oxydation</Text>
        </Card>
        <Button
          title="Commander ma carte (gratuite)"
          onPress={() => {
            commit((acc) => issueCard(acc));
          }}
        />
        <Hint>
          Démonstration : la carte est simulée. Une carte réelle nécessitera un partenaire émetteur agréé et un réseau
          de paiement.
        </Hint>
      </Screen>
    );
  }

  const amount = parseAmount(text);
  const valid = Number.isFinite(amount) && amount > 0;
  const metal = card.fundingMetal;
  const grams = valid ? amount / quote.prices[metal] : 0;
  const usedPay = cardUsage(account, 'card_payment', 30);
  const usedCash = cardUsage(account, 'card_withdrawal', 7);
  const summary = valid
    ? mode === 'pay'
      ? `Payer ${formatEur(amount)} chez ${merchant.trim() || 'un commerçant'} : ${formatWeight(grams, unit)} ${METAL_OF[metal]} vendus, sans frais.`
      : `Retirer ${formatEur(amount)} au distributeur : ${formatWeight(grams, unit)} ${METAL_OF[metal]} vendus, sans frais.`
    : '';
  const cardTx = account.transactions.filter((t) => t.kind === 'card_payment' || t.kind === 'card_withdrawal');

  function execute() {
    setConfirming(false);
    try {
      commit((acc, p) => (mode === 'pay' ? cardPay(acc, p, merchant, amount) : cardWithdraw(acc, p, amount)));
      setText('');
      setMerchant('');
      setMessage({ ok: true, text: mode === 'pay' ? 'Paiement accepté.' : 'Retrait effectué.' });
    } catch (e) {
      setMessage({ ok: false, text: e instanceof LedgerError ? e.message : 'Une erreur est survenue.' });
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen testID="screen-carte">
        <OrviaCard card={card} />

        <Card style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.switchLabel}>Geler la carte</Text>
            <Hint>Bloque aussitôt les paiements et retraits. Dégèle-la quand tu veux.</Hint>
          </View>
          <Switch
            value={card.frozen}
            onValueChange={(v) => {
              commit((acc) => setCardFrozen(acc, v));
            }}
            trackColor={{ true: '#7FB8E6', false: colors.surfaceAlt }}
            accessibilityLabel="Geler la carte"
          />
        </Card>

        <View style={{ gap: 8 }}>
          <Label>Métal utilisé pour payer</Label>
          <MetalPicker
            value={metal}
            onChange={(m) => {
              commit((acc) => setCardMetal(acc, m));
            }}
          />
          <Hint>Disponible : {formatWeight(account.holdings[metal], unit)}</Hint>
        </View>

        <Card style={{ gap: 10 }}>
          <Usage label="Paiements · 30 jours" used={usedPay} limit={CARD.paymentLimit30d} />
          <Usage label="Retraits · 7 jours" used={usedCash} limit={CARD.withdrawalLimit7d} />
        </Card>

        <SectionTitle>Simuler une opération</SectionTitle>
        <Segmented
          value={mode}
          onChange={(m) => {
            setMode(m);
            setMessage(null);
          }}
          options={[
            { value: 'pay', label: 'Paiement' },
            { value: 'withdraw', label: 'Retrait' },
          ]}
        />
        {mode === 'pay' && (
          <TextInput
            value={merchant}
            onChangeText={setMerchant}
            placeholder="Commerçant (ex. Boulangerie)"
            placeholderTextColor={colors.textMuted}
            style={ui.input}
          />
        )}
        <View style={styles.amountRow}>
          <TextInput
            value={text}
            onChangeText={(t) => {
              setText(t);
              setMessage(null);
            }}
            placeholder="0"
            placeholderTextColor={colors.textMuted}
            keyboardType="decimal-pad"
            style={[ui.input, styles.amount]}
            accessibilityLabel="Montant en euros"
          />
          <Text style={styles.unit}>€</Text>
        </View>
        {summary ? <Text style={styles.preview}>{summary}</Text> : null}
        <Button
          title={mode === 'pay' ? 'Payer' : 'Retirer'}
          onPress={() => {
            setMessage(null);
            if (!valid) return setMessage({ ok: false, text: 'Indique un montant.' });
            setConfirming(true);
          }}
        />
        {message && <Message {...message} />}

        <SectionTitle>Opérations par carte</SectionTitle>
        {cardTx.length === 0 ? (
          <Hint>Aucune opération pour l’instant.</Hint>
        ) : (
          <Card style={{ paddingVertical: 0 }}>
            {cardTx.slice(0, 15).map((tx) => (
              <TransactionRow key={tx.id} tx={tx} unit={unit} />
            ))}
          </Card>
        )}
        <Hint>Démonstration : la carte est simulée, aucun paiement réel n’est effectué.</Hint>

        <PinConfirm visible={confirming} summary={summary} onConfirm={execute} onCancel={() => setConfirming(false)} />
      </Screen>
    </KeyboardAvoidingView>
  );
}

function Usage({ label, used, limit }: { label: string; used: number; limit: number }) {
  const share = Math.min(1, used / limit);
  return (
    <View style={{ gap: 4 }}>
      <View style={styles.usageRow}>
        <Text style={styles.usageLabel}>{label}</Text>
        <Text style={styles.usageValue}>
          {formatEur(used)} / {formatEur(limit)}
        </Text>
      </View>
      <View style={styles.bar}>
        <View style={[styles.barFill, { flex: share }]} />
        <View style={{ flex: 1 - share }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.text, fontSize: 24, fontWeight: '800' },
  para: { color: colors.text, fontSize: 15, lineHeight: 22 },
  point: { color: colors.text, fontSize: 14, lineHeight: 21 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  switchLabel: { color: colors.text, fontSize: 15, fontWeight: '600', marginBottom: 2 },
  usageRow: { flexDirection: 'row', justifyContent: 'space-between' },
  usageLabel: { color: colors.textMuted, fontSize: 13 },
  usageValue: { color: colors.text, fontSize: 13, fontWeight: '600', fontVariant: ['tabular-nums'] },
  bar: { flexDirection: 'row', height: 6, borderRadius: 3, overflow: 'hidden', backgroundColor: colors.surfaceAlt },
  barFill: { backgroundColor: colors.gold },
  amountRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  amount: { flex: 1, minWidth: 0, fontSize: 24, fontWeight: '700' },
  unit: { width: 40, color: colors.textMuted, fontSize: 22, fontWeight: '700', textAlign: 'center' },
  preview: {
    color: colors.text,
    backgroundColor: colors.goldSoft,
    padding: 12,
    borderRadius: 12,
    fontSize: 14,
    lineHeight: 20,
  },
});
