import { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Segmented } from '../components/Segmented';
import { formatEur, formatGrams, parseAmount } from '../logic/format';
import {
  accountValue,
  buyPrice,
  convert,
  deposit,
  LedgerError,
  METAL_LABEL,
  sellPrice,
  transfer,
  withdraw,
} from '../logic/ledger';
import type { Account, Metal, Prices } from '../logic/types';
import { colors } from '../theme';

export type Action = 'deposit' | 'withdraw' | 'convert' | 'transfer';

interface Props {
  account: Account;
  prices: Prices;
  action: Action;
  onActionChange: (action: Action) => void;
  onAccountChange: (account: Account) => void;
}

const ALLOCATIONS = [0, 30, 50, 70, 100];

export function OperateScreen({ account, prices, action, onActionChange, onAccountChange }: Props) {
  const [amount, setAmount] = useState('');
  const [metal, setMetal] = useState<Metal>('gold');
  const [source, setSource] = useState<Metal | 'mix'>('mix');
  const [beneficiary, setBeneficiary] = useState('');
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const value = accountValue(account, prices);
  const n = parseAmount(amount);
  const usesGrams = action === 'convert' || action === 'transfer';

  // Aperçu de l'opération avant validation.
  const preview = useMemo(() => {
    if (!Number.isFinite(n) || n <= 0) return null;
    switch (action) {
      case 'deposit': {
        const goldEur = (n * account.goldAllocation) / 100;
        return `Tu recevras ${formatGrams(goldEur / buyPrice(prices, 'gold'))} d'or et ${formatGrams(
          (n - goldEur) / buyPrice(prices, 'silver'),
        )} d'argent.`;
      }
      case 'withdraw':
        return `Tu recevras ${formatEur(n)} sur ton compte courant (fictif).`;
      case 'convert': {
        const to: Metal = metal === 'gold' ? 'silver' : 'gold';
        const got = (n * sellPrice(prices, metal)) / buyPrice(prices, to);
        return `Tu recevras ${formatGrams(got)} d'${METAL_LABEL[to].toLowerCase()}.`;
      }
      case 'transfer':
        return `Valeur envoyée : ${formatEur(n * prices[metal])}.`;
    }
  }, [action, n, metal, prices, account.goldAllocation]);

  function submit() {
    try {
      let next: Account;
      switch (action) {
        case 'deposit':
          next = deposit(account, prices, n);
          break;
        case 'withdraw':
          next = withdraw(account, prices, n, source);
          break;
        case 'convert':
          next = convert(account, prices, metal, n);
          break;
        case 'transfer':
          next = transfer(account, prices, metal, n, beneficiary);
          break;
      }
      onAccountChange(next);
      setAmount('');
      setBeneficiary('');
      setMessage({ ok: true, text: 'Opération effectuée.' });
    } catch (e) {
      setMessage({
        ok: false,
        text: e instanceof LedgerError ? e.message : 'Une erreur est survenue.',
      });
    }
  }

  const available = usesGrams
    ? `Disponible : ${formatGrams(metal === 'gold' ? account.goldGrams : account.silverGrams)}`
    : action === 'withdraw'
      ? `Disponible : ${formatEur(
          source === 'gold' ? value.gold : source === 'silver' ? value.silver : value.total,
        )}`
      : null;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Opérations</Text>
        <Segmented
          value={action}
          onChange={(a) => {
            onActionChange(a);
            setMessage(null);
          }}
          options={[
            { value: 'deposit', label: 'Dépôt' },
            { value: 'withdraw', label: 'Retrait' },
            { value: 'convert', label: 'Convertir' },
            { value: 'transfer', label: 'Virement' },
          ]}
        />

        {action === 'deposit' && (
          <View style={styles.block}>
            <Text style={styles.label}>Répartition de chaque dépôt</Text>
            <View style={styles.chips}>
              {ALLOCATIONS.map((a) => {
                const active = account.goldAllocation === a;
                return (
                  <Pressable
                    key={a}
                    onPress={() => onAccountChange({ ...account, goldAllocation: a })}
                    style={[styles.chip, active && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{a} % or</Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={styles.hint}>
              {account.goldAllocation} % en or, {100 - account.goldAllocation} % en argent
            </Text>
          </View>
        )}

        {action === 'withdraw' && (
          <View style={styles.block}>
            <Text style={styles.label}>Vendre</Text>
            <Segmented
              value={source}
              onChange={setSource}
              options={[
                { value: 'mix', label: 'Les deux' },
                { value: 'gold', label: 'Or' },
                { value: 'silver', label: 'Argent' },
              ]}
            />
          </View>
        )}

        {usesGrams && (
          <View style={styles.block}>
            <Text style={styles.label}>{action === 'convert' ? 'Convertir depuis' : 'Métal envoyé'}</Text>
            <Segmented
              value={metal}
              onChange={setMetal}
              options={[
                { value: 'gold', label: 'Or' },
                { value: 'silver', label: 'Argent' },
              ]}
            />
          </View>
        )}

        {action === 'transfer' && (
          <View style={styles.block}>
            <Text style={styles.label}>Bénéficiaire</Text>
            <TextInput
              value={beneficiary}
              onChangeText={setBeneficiary}
              placeholder="Nom du bénéficiaire"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
            />
          </View>
        )}

        <View style={styles.block}>
          <Text style={styles.label}>{usesGrams ? 'Quantité (grammes)' : 'Montant (euros)'}</Text>
          <View style={styles.amountRow}>
            <TextInput
              value={amount}
              onChangeText={(t) => {
                setAmount(t);
                setMessage(null);
              }}
              placeholder="0"
              placeholderTextColor={colors.textMuted}
              keyboardType="decimal-pad"
              style={[styles.input, styles.amountInput]}
            />
            <Text style={styles.unit}>{usesGrams ? 'g' : '€'}</Text>
          </View>
          {available && <Text style={styles.hint}>{available}</Text>}
        </View>

        {preview && <Text style={styles.preview}>{preview}</Text>}

        <Pressable
          onPress={submit}
          style={({ pressed }) => [styles.button, pressed && { opacity: 0.8 }]}
          accessibilityRole="button"
        >
          <Text style={styles.buttonText}>Valider</Text>
        </Pressable>

        {message && (
          <Text style={[styles.message, { color: message.ok ? colors.up : colors.down }]}>
            {message.text}
          </Text>
        )}

        <Text style={styles.footnote}>
          Écart achat/vente de 0,5 % sur les dépôts, retraits et conversions. Les virements de métal
          sont sans frais. Tout est fictif : aucun argent réel n'est utilisé.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 40, gap: 16 },
  title: { color: colors.text, fontSize: 26, fontWeight: '800' },
  block: { gap: 8 },
  label: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  hint: { color: colors.textMuted, fontSize: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipActive: { borderColor: colors.gold, backgroundColor: colors.goldSoft },
  chipText: { color: colors.textMuted, fontSize: 13 },
  chipTextActive: { color: colors.gold, fontWeight: '700' },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.text,
    fontSize: 16,
  },
  amountRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  amountInput: { flex: 1, minWidth: 0, fontSize: 24, fontWeight: '700' },
  unit: { color: colors.textMuted, fontSize: 22, fontWeight: '700' },
  preview: {
    color: colors.text,
    backgroundColor: colors.goldSoft,
    padding: 12,
    borderRadius: 12,
    fontSize: 14,
    lineHeight: 20,
  },
  button: {
    backgroundColor: colors.gold,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  buttonText: { color: colors.background, fontSize: 16, fontWeight: '800' },
  message: { textAlign: 'center', fontSize: 14, fontWeight: '600' },
  footnote: { color: colors.textMuted, fontSize: 11, lineHeight: 16, marginTop: 8 },
});
