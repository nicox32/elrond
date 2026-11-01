import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { PriceCard } from '../components/PriceCard';
import { TransactionRow } from '../components/TransactionRow';
import { formatEur, formatGrams } from '../logic/format';
import { accountValue } from '../logic/ledger';
import type { Account, Prices } from '../logic/types';
import { colors } from '../theme';
import type { Action } from './OperateScreen';

interface Props {
  account: Account;
  prices: Prices;
  history: Prices[];
  onAction: (action: Action) => void;
  onSeeHistory: () => void;
}

const QUICK: { action: Action; label: string; icon: string }[] = [
  { action: 'deposit', label: 'Déposer', icon: '↓' },
  { action: 'withdraw', label: 'Retirer', icon: '↑' },
  { action: 'convert', label: 'Convertir', icon: '⇄' },
  { action: 'transfer', label: 'Virer', icon: '→' },
];

export function HomeScreen({ account, prices, history, onAction, onSeeHistory }: Props) {
  const value = accountValue(account, prices);
  const goldShare = value.total > 0 ? (value.gold / value.total) * 100 : account.goldAllocation;

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.hello}>Bonjour {account.holder}</Text>

      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>Solde total</Text>
        <Text style={styles.balance}>{formatEur(value.total)}</Text>
        <Text style={styles.iban}>{account.iban}</Text>

        <View style={styles.split}>
          <View style={[styles.splitGold, { flex: goldShare }]} />
          <View style={[styles.splitSilver, { flex: 100 - goldShare }]} />
        </View>

        <View style={styles.holdings}>
          <View style={styles.holding}>
            <Text style={[styles.holdingMetal, { color: colors.gold }]}>Or</Text>
            <Text style={styles.holdingGrams}>{formatGrams(account.goldGrams)}</Text>
            <Text style={styles.holdingEur}>{formatEur(value.gold)}</Text>
          </View>
          <View style={styles.holding}>
            <Text style={[styles.holdingMetal, { color: colors.silver }]}>Argent</Text>
            <Text style={styles.holdingGrams}>{formatGrams(account.silverGrams)}</Text>
            <Text style={styles.holdingEur}>{formatEur(value.silver)}</Text>
          </View>
        </View>
      </View>

      <View style={styles.quickRow}>
        {QUICK.map((q) => (
          <Pressable key={q.action} style={styles.quick} onPress={() => onAction(q.action)}>
            <View style={styles.quickIcon}>
              <Text style={styles.quickIconText}>{q.icon}</Text>
            </View>
            <Text style={styles.quickLabel}>{q.label}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.section}>Cours en direct (simulés)</Text>
      <View style={styles.prices}>
        <PriceCard metal="gold" history={history} />
        <PriceCard metal="silver" history={history} />
      </View>

      <View style={styles.sectionRow}>
        <Text style={styles.section}>Dernières opérations</Text>
        {account.transactions.length > 0 && (
          <Pressable onPress={onSeeHistory}>
            <Text style={styles.link}>Tout voir</Text>
          </Pressable>
        )}
      </View>
      {account.transactions.length === 0 ? (
        <Text style={styles.empty}>
          Aucune opération. Fais un premier dépôt : il sera converti en or et en argent.
        </Text>
      ) : (
        account.transactions.slice(0, 3).map((tx) => <TransactionRow key={tx.id} tx={tx} />)
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 32, gap: 12 },
  hello: { color: colors.textMuted, fontSize: 15 },
  balanceCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.gold,
    gap: 4,
  },
  balanceLabel: { color: colors.textMuted, fontSize: 13 },
  balance: { color: colors.text, fontSize: 34, fontWeight: '800', fontVariant: ['tabular-nums'] },
  iban: { color: colors.textMuted, fontSize: 11, letterSpacing: 0.5 },
  split: {
    flexDirection: 'row',
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: 14,
    backgroundColor: colors.surfaceAlt,
  },
  splitGold: { backgroundColor: colors.gold },
  splitSilver: { backgroundColor: colors.silver },
  holdings: { flexDirection: 'row', marginTop: 12, gap: 12 },
  holding: { flex: 1 },
  holdingMetal: { fontSize: 13, fontWeight: '700' },
  holdingGrams: { color: colors.text, fontSize: 17, fontWeight: '600', fontVariant: ['tabular-nums'] },
  holdingEur: { color: colors.textMuted, fontSize: 12, fontVariant: ['tabular-nums'] },
  quickRow: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 4 },
  quick: { alignItems: 'center', gap: 6, flex: 1 },
  quickIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.goldSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickIconText: { color: colors.gold, fontSize: 22, fontWeight: '700' },
  quickLabel: { color: colors.text, fontSize: 12 },
  section: { color: colors.text, fontSize: 17, fontWeight: '700', marginTop: 8 },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  link: { color: colors.gold, fontSize: 13, fontWeight: '600' },
  prices: { flexDirection: 'row', gap: 12 },
  empty: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
});
