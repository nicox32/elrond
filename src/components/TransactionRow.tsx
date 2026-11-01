import { StyleSheet, Text, View } from 'react-native';

import { formatDate, formatEur, formatWeightDelta } from '../logic/format';
import { METAL_LABEL } from '../logic/ledger';
import { METALS, type Transaction, type TransactionKind, type WeightUnit } from '../logic/types';
import { colors } from '../theme';

const ICON: Record<TransactionKind, string> = {
  buy: '+',
  sell: '−',
  convert: '⇄',
  transfer_member: '→',
  transfer_iban: '↗',
};

export function TransactionRow({ tx, unit }: { tx: Transaction; unit: WeightUnit }) {
  const parts = METALS.filter((m) => tx.deltas[m]).map(
    (m) => `${formatWeightDelta(tx.deltas[m], unit)} ${METAL_LABEL[m].toLowerCase()}`,
  );
  const incoming = tx.kind === 'buy';
  const neutral = tx.kind === 'convert';

  return (
    <View style={styles.row}>
      <View style={styles.icon}>
        <Text style={styles.iconText}>{ICON[tx.kind]}</Text>
      </View>
      <View style={styles.body}>
        <Text style={styles.label} numberOfLines={1}>
          {tx.label}
        </Text>
        <Text style={styles.detail}>{parts.join(' · ')}</Text>
      </View>
      <View style={styles.right}>
        <Text style={[styles.amount, incoming && { color: colors.up }]}>
          {neutral ? '' : incoming ? '+' : '−'}
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
  body: { flex: 1, minWidth: 0 },
  label: { color: colors.text, fontSize: 15, fontWeight: '600' },
  detail: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  right: { alignItems: 'flex-end' },
  amount: { color: colors.text, fontSize: 15, fontWeight: '600', fontVariant: ['tabular-nums'] },
  date: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
});
