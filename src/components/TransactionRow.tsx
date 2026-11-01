import { StyleSheet, Text, View } from 'react-native';

import { formatDate, formatEur, formatGrams } from '../logic/format';
import type { Transaction, TransactionKind } from '../logic/types';
import { colors } from '../theme';

const ICON: Record<TransactionKind, string> = {
  deposit: '↓',
  withdraw: '↑',
  convert: '⇄',
  transfer: '→',
};

export function TransactionRow({ tx }: { tx: Transaction }) {
  const incoming = tx.kind === 'deposit';
  const parts: string[] = [];
  if (tx.goldDelta) parts.push(`${tx.goldDelta > 0 ? '+' : ''}${formatGrams(tx.goldDelta)} or`);
  if (tx.silverDelta) parts.push(`${tx.silverDelta > 0 ? '+' : ''}${formatGrams(tx.silverDelta)} argent`);

  return (
    <View style={styles.row}>
      <View style={styles.icon}>
        <Text style={styles.iconText}>{ICON[tx.kind]}</Text>
      </View>
      <View style={styles.body}>
        <Text style={styles.label}>{tx.label}</Text>
        <Text style={styles.detail}>{parts.join(' · ')}</Text>
      </View>
      <View style={styles.right}>
        <Text style={[styles.amount, incoming && { color: colors.up }]}>
          {tx.kind === 'convert' ? '' : incoming ? '+' : '−'}
          {formatEur(tx.eur)}
        </Text>
        <Text style={styles.date}>{formatDate(tx.date)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 12 },
  icon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: { color: colors.gold, fontSize: 18, fontWeight: '700' },
  body: { flex: 1 },
  label: { color: colors.text, fontSize: 15, fontWeight: '600' },
  detail: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  right: { alignItems: 'flex-end' },
  amount: { color: colors.text, fontSize: 15, fontWeight: '600', fontVariant: ['tabular-nums'] },
  date: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
});
