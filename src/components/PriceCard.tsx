import { StyleSheet, Text, View } from 'react-native';

import { formatEur, formatPercent } from '../logic/format';
import { METAL_LABEL } from '../logic/ledger';
import type { Metal, Prices } from '../logic/types';
import { colors, metalColor } from '../theme';
import { Sparkline } from './Sparkline';

interface Props {
  metal: Metal;
  history: Prices[];
}

export function PriceCard({ metal, history }: Props) {
  const values = history.map((p) => p[metal]);
  const current = values[values.length - 1];
  const first = values[0];
  const change = ((current - first) / first) * 100;
  const changeColor = change >= 0 ? colors.up : colors.down;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={[styles.dot, { backgroundColor: metalColor[metal] }]} />
        <Text style={styles.name}>{METAL_LABEL[metal]}</Text>
      </View>
      <Text style={styles.price}>{formatEur(current)}</Text>
      <Text style={styles.unit}>par gramme</Text>
      <Text style={[styles.change, { color: changeColor }]}>{formatPercent(change)}</Text>
      <Sparkline values={values} color={metalColor[metal]} height={32} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 2,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  name: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  price: { color: colors.text, fontSize: 20, fontWeight: '700', fontVariant: ['tabular-nums'] },
  unit: { color: colors.textMuted, fontSize: 11 },
  change: { fontSize: 12, fontWeight: '600', marginBottom: 6, fontVariant: ['tabular-nums'] },
});
