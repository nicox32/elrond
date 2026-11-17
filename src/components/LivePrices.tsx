import { useState } from 'react';
import { router } from 'expo-router';
import { type LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { formatEur as formatEurShort, formatPercent, formatTimeWithSeconds, formatUnitPrice } from '../logic/format';
import { BAR_PRODUCTS, physicalFeesOf, productPrice } from '../logic/physical';
import { BarImage } from './BarImage';
import { METAL_LABEL } from '../logic/ledger';
import { metalTrend } from '../logic/priceHistory';
import { METALS, type WeightUnit } from '../logic/types';
import { marketStatus } from '../logic/market';
import { LIVE_REFRESH_MS, useBank } from '../state/BankProvider';
import { colors, metalColor, metalSymbol } from '../theme';

const SPARK_H = 30;

/** Cours en direct de l'or, de l'argent et du platine, avec leur évolution sur 24 h. */
export function LivePrices({ unit }: { unit: WeightUnit }) {
  const { quote, priceHistory, account } = useBank();
  const physFees = physicalFeesOf(account?.settings);
  const live = quote.source === 'live';
  const market = marketStatus();
  const other: WeightUnit = unit === 'g' ? 'oz' : 'g';

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={[styles.liveDot, { backgroundColor: live && market.open ? colors.up : colors.warning }]} />
        <Text style={styles.headerText}>
          {!live
            ? 'Cours réels indisponibles pour le moment'
            : market.open
              ? `En direct · ${formatTimeWithSeconds(quote.fetchedAt)} · toutes les ${LIVE_REFRESH_MS / 1000} s`
              : `Marché ${market.reason === 'pause' ? 'en pause' : 'fermé'} · dernier cours, ${market.next}`}
        </Text>
      </View>

      {METALS.map((m, i) => {
        const trend = metalTrend(priceHistory, m, quote.prices);
        const up = trend.changePct >= 0;
        return (
          <Pressable
            key={m}
            onPress={() => router.push({ pathname: '/cours/[metal]', params: { metal: m } })}
            style={[styles.row, i > 0 && styles.rowBorder]}
            accessibilityRole="button"
            accessibilityHint="Graphique du cours sur 20 ans"
          >
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
          </Pressable>
        );
      })}

      <Pressable
        onPress={() => router.push('/retrait')}
        style={[styles.bars, styles.rowBorder]}
        accessibilityRole="button"
        accessibilityHint="Retrait physique d’or"
        testID="bars-block"
      >
        <View style={styles.barsHead}>
          <Text style={styles.metal}>Lingotins et pièce</Text>
          <Text style={styles.barsCol}>valeur de l’or</Text>
          <Text style={styles.barsCol}>avec frais</Text>
        </View>
        {BAR_PRODUCTS.map((b) => {
          const p = productPrice(b, quote.prices.gold, physFees.premiums[b.id]);
          return (
            <View key={b.id} style={styles.barsLine} testID={`bar-${b.id}`}>
              <BarImage product={b.id} size={40} />
              <Text style={styles.barsName} numberOfLines={1}>
                {b.coin ? 'Napoléon 20 F' : b.id === 'oz1' ? 'Lingot 1 once' : `Lingotin ${b.grams} g`}
              </Text>
              <Text style={styles.barsVal}>{formatEurShort(p.metal)}</Text>
              <Text style={[styles.barsVal, styles.barsGold]}>{formatEurShort(p.withPremium)}</Text>
            </View>
          );
        })}
        <Text style={[styles.priceOther, { marginTop: 4, lineHeight: 16 }]}>
          Fabrication ou prime incluse · livraison {physFees.delivery.toLocaleString('fr-FR')} €, offerte dès{' '}
          {physFees.freeFromGrams} g · touchez pour un retrait physique
        </Text>
      </Pressable>

      <Pressable
        onPress={() => router.push('/ratio')}
        style={[styles.row, styles.rowBorder, { paddingVertical: 10 }]}
        accessibilityRole="button"
        testID="ratio-row"
      >
        <Text style={[styles.metal, { flex: 1 }]}>Ratio or/argent</Text>
        <Text style={styles.price}>
          {(quote.prices.gold / quote.prices.silver).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} ›
        </Text>
      </Pressable>

      <Text style={styles.footnote}>
        Cours au comptant, convertis en euros. Variation et courbe : dernières 24 h. Touchez un métal pour son graphique
        sur 20 ans. Lingotins et pièce : valeur de leur or, et prix indicatif avec fabrication ou prime.
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
  bars: { paddingVertical: 14, gap: 10 },
  barsHead: { flexDirection: 'row', alignItems: 'baseline', gap: 10, marginBottom: 4 },
  barsCol: { color: colors.textMuted, fontSize: 10.5, width: 76, textAlign: 'right' },
  barsLine: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 5 },
  barsName: { color: colors.text, fontSize: 14, fontWeight: '600', flex: 1 },
  barsVal: { color: colors.textMuted, fontSize: 13, width: 76, textAlign: 'right', fontVariant: ['tabular-nums'] },
  barsGold: { color: colors.text, fontWeight: '700' },
  footnote: { color: colors.textMuted, fontSize: 11, lineHeight: 15, marginTop: 4 },
});
