import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatDate, formatEur, formatWeightDelta } from '../logic/format';
import { METAL_LABEL } from '../logic/ledger';
import { METALS, type Transaction, type TransactionKind, type WeightUnit } from '../logic/types';
import { colors } from '../theme';
import { OperationSheet } from './Statement';

const ICON: Record<TransactionKind, string> = {
  buy: '+',
  sell: '−',
  convert: '⇄',
  transfer_member: '→',
  transfer_iban: '↗',
  family_out: '↘',
  family_in: '↙',
  fee_dormancy: '!',
  fee_custody: '⌂',
  card_payment: '▭',
  card_withdrawal: '€',
  referral_bonus: '★',
  cash_in: '€',
  cash_out: '↗',
  loyalty_redeem: '★',
};

export function TransactionRow({
  tx,
  unit,
  walletName = 'Compte principal',
  discreet = false,
}: {
  tx: Transaction;
  unit: WeightUnit;
  /** Compte concerné, repris dans l'avis d'opération. */
  walletName?: string;
  /** Mode discret : montants et grammes masqués. */
  discreet?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const parts = METALS.filter((m) => tx.deltas[m]).map(
    (m) => `${formatWeightDelta(tx.deltas[m], unit)} ${m === 'gold' ? METAL_LABEL[m] : METAL_LABEL[m].toLowerCase()}`,
  );
  // Anciennes opérations en Gold Oria (jeton arrêté) : affichées telles qu'elles ont eu lieu.
  const oria = (tx.deltas as Record<string, number>).ecu;
  if (oria) parts.push(`${oria > 0 ? '+' : '−'}${Math.abs(oria).toFixed(3).replace('.', ',')} g Gold Oria`);
  if (tx.kind === 'cash_in' || tx.kind === 'cash_out')
    parts.push(`compte d’attente ${tx.kind === 'cash_in' ? '+' : '−'}${formatEur(tx.eur)}`);
  else if (tx.cash) parts.push(`payé depuis le compte d’attente`);
  const incoming =
    tx.kind === 'buy' ||
    tx.kind === 'family_in' ||
    tx.kind === 'referral_bonus' ||
    tx.kind === 'cash_in' ||
    tx.kind === 'loyalty_redeem';
  const neutral = tx.kind === 'convert';
  const fee = tx.kind === 'fee_dormancy' || tx.kind === 'fee_custody';

  return (
    <Pressable
      style={styles.row}
      onPress={() => setOpen(true)}
      accessibilityRole="button"
      accessibilityHint="Détail et avis d’opération en PDF"
    >
      <View style={styles.icon}>
        <Text style={styles.iconText}>{ICON[tx.kind]}</Text>
      </View>
      <View style={styles.body}>
        <Text style={styles.label} numberOfLines={1}>
          {tx.label}
        </Text>
        <Text style={styles.detail}>{discreet ? '•••' : parts.join(' · ')}</Text>
        {discreet ? null : tx.fees && !fee ? <Text style={styles.fees}>dont {formatEur(tx.fees)} de frais</Text> : null}
        {tx.tax && !discreet ? (
          <Text style={styles.fees}>
            impôt retenu : {formatEur(tx.tax)} ({tx.taxRegime === 'gain' ? 'plus-values' : 'taxe forfaitaire'})
          </Text>
        ) : null}
      </View>
      <View style={styles.right}>
        <Text style={[styles.amount, incoming && { color: colors.up }, fee && { color: colors.down }]}>
          {discreet ? '•••• €' : `${neutral ? '' : incoming ? '+' : '−'}${formatEur(tx.eur)}`}
        </Text>
        <Text style={styles.date}>{formatDate(tx.date)}</Text>
      </View>
      <OperationSheet tx={open ? tx : null} walletName={walletName} onClose={() => setOpen(false)} />
    </Pressable>
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
  fees: { color: colors.textMuted, fontSize: 11, marginTop: 1, fontStyle: 'italic' },
  right: { alignItems: 'flex-end' },
  amount: { color: colors.text, fontSize: 15, fontWeight: '600', fontVariant: ['tabular-nums'] },
  date: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
});
