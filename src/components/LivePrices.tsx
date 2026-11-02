import { useState } from 'react';
import { type LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { formatPercent, formatTimeWithSeconds, formatUnitPrice } from '../logic/format';
import { METAL_LABEL } from '../logic/ledger';
import { metalTrend } from '../logic/priceHistory';
import { METALS, type WeightUnit } from '../logic/types';
import { LIVE_REFRESH_MS, useBank } from '../state/BankProvider';
import { colors, metalColor, metalSymbol } from '../theme';

const SPARK_H = 30;

/** Cours en direct de l'or, de l'argent et du platine, avec leur évolution sur 24 h. */
export function LivePrices({ unit }: { unit: WeightUnit }) {
  const { quote, priceHistory } = useBank();
  const live = quote.source === 'live';
  const other: WeightUnit = unit === 'g' ? 'oz' : 'g';

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={[styles.liveDot, { backgroundColor: live ? colors.up : colors.warning }]} />
        <Text style={styles.headerText}>
          {live
            ? `En direct · ${formatTimeWithSeconds(quote.fetchedAt)} · toutes les ${LIVE_REFRESH_MS / 1000} s`
            : 'Cours réels indisponibles pour le moment'}
        </Text>
      </View>

      {METALS.map((m, i) => {
        const trend = metalTrend(priceHistory, m, quote.prices);
        const up = trend.changePct >= 0;
        return (
          <View key={m} style={[styles.row, i > 0 && styles.rowBorder]}>
            <View style={[styles.symbol, { borderColor: metalColor[m] }]}>
              <Text style={[styles.symbolText, { color: metalColor[m] }]}>{metalSymbol[m]}</Text>
            </View>
            <View style={styles.name}>
              <Text style={styles.metal}>{METAL_LABEL[m]}</Text>
              <Text style={[styles.change, { color: up ? colors.up : colors.down }]}>
                {trend.values.length > 1 ? formatPercent(trend.changePct) : '—'}
              </Text>
            </View>
            <Sparkline values={trend.values} color={metalColor[m]} />
            <View style={styles.prices}>
              <Text style={styles.price}>{formatUnitPrice(quote.prices[m], unit, m)}</Text>
              <Text style={styles.priceOther}>{formatUnitPrice(quote.prices[m], other)}</Text>
            </View>
          </View>
        );
      })}

      <Text style={styles.footnote}>
        Cours au comptant, convertis en euros. Variation et courbe : relevés faits par l’appli sur les dernières 24 h.
      </Text>
    </View>
  );
}

function Sparkline({ values, color }: { values: number[]; color: string }) {
  const [width, setWidth] = useState(0);
  let d = '';
  if (values.length > 1 && width > 0) {
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    d = values
      .map((v, i) => {
        const x = (i / (values.length - 1)) * width;
        const y = 2 + (1 - (v - min) / range) * (SPARK_H - 4);
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  }
  return (
    <View style={styles.spark} onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}>
      {d ? (
        <Svg width={width} height={SPARK_H}>
          <Path d={d} stroke={color} strokeWidth={1.6} fill="none" strokeLinejoin="round" />
        </Svg>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  liveDot: { width: 8, height: 8, borderRadius: 4 },
  headerText: { color: colors.textMuted, fontSize: 12, fontVariant: ['tabular-nums'], flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  rowBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  symbol: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  symbolText: { fontSize: 13, fontWeight: '800' },
  name: { width: 78 },
  metal: { color: colors.text, fontSize: 15, fontWeight: '700' },
  change: { fontSize: 11, fontWeight: '600', fontVariant: ['tabular-nums'] },
  spark: { flex: 1, height: SPARK_H, minWidth: 30 },
  prices: { alignItems: 'flex-end', minWidth: 96 },
  price: { color: colors.text, fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'] },
  priceOther: { color: colors.textMuted, fontSize: 11, fontVariant: ['tabular-nums'] },
  footnote: { color: colors.textMuted, fontSize: 11, lineHeight: 15, marginTop: 4 },
});
