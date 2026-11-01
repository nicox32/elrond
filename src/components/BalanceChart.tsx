import { useMemo, useState } from 'react';
import { type LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Line, Path, Stop } from 'react-native-svg';

import { formatDate, formatEur } from '../logic/format';
import type { BalancePoint } from '../logic/types';
import { colors } from '../theme';
import { Segmented } from './Segmented';

type Period = '1d' | '7d' | '30d' | 'all';

const PERIOD_MS: Record<Period, number> = {
  '1d': 86_400_000,
  '7d': 7 * 86_400_000,
  '30d': 30 * 86_400_000,
  all: Number.POSITIVE_INFINITY,
};

const HEIGHT = 150;
const PAD_Y = 10;

interface Props {
  points: BalancePoint[];
}

/** Courbe d'évolution du solde, à partir des points enregistrés par l'appli. */
export function BalanceChart({ points }: Props) {
  const [period, setPeriod] = useState<Period>('7d');
  const [width, setWidth] = useState(0);

  const visible = useMemo(() => {
    // La période se compte depuis le dernier point (enregistré à chaque ouverture de l'appli).
    const lastTime = points.length ? new Date(points[points.length - 1].date).getTime() : 0;
    const from = lastTime - PERIOD_MS[period];
    return points.filter((p) => new Date(p.date).getTime() >= from);
  }, [points, period]);

  const geometry = useMemo(() => {
    if (visible.length < 2 || width === 0) return null;
    const times = visible.map((p) => new Date(p.date).getTime());
    const t0 = times[0];
    const t1 = times[times.length - 1];
    const values = visible.map((p) => p.total);
    let min = Math.min(...values);
    let max = Math.max(...values);
    if (max - min < 0.01) {
      // Solde stable : on centre la ligne.
      min -= 1;
      max += 1;
    }
    const x = (t: number) => (t1 === t0 ? 0 : ((t - t0) / (t1 - t0)) * width);
    const y = (v: number) => PAD_Y + (1 - (v - min) / (max - min)) * (HEIGHT - 2 * PAD_Y);
    const coords = visible.map((p, i) => [x(times[i]), y(p.total)] as const);
    const line = coords.map(([cx, cy], i) => `${i === 0 ? 'M' : 'L'}${cx.toFixed(1)},${cy.toFixed(1)}`).join(' ');
    const area = `${line} L${width},${HEIGHT} L0,${HEIGHT} Z`;
    return { line, area, last: coords[coords.length - 1], min, max };
  }, [visible, width]);

  const first = visible[0]?.total ?? 0;
  const last = visible[visible.length - 1]?.total ?? 0;
  const change = last - first;
  const changeColor = change >= 0 ? colors.up : colors.down;

  return (
    <View style={styles.wrap}>
      {visible.length >= 2 && (
        <View style={styles.header}>
          <Text style={[styles.change, { color: changeColor }]}>
            {change >= 0 ? '+' : '−'}
            {formatEur(Math.abs(change))}
          </Text>
          <Text style={styles.since}>
            depuis le {formatDate(visible[0].date)} · achats, ventes et virements compris
          </Text>
        </View>
      )}

      <View style={{ height: HEIGHT }} onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}>
        {geometry ? (
          <Svg width={width} height={HEIGHT}>
            <Defs>
              <LinearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={colors.gold} stopOpacity={0.35} />
                <Stop offset="1" stopColor={colors.gold} stopOpacity={0} />
              </LinearGradient>
            </Defs>
            <Line x1={0} x2={width} y1={HEIGHT - 1} y2={HEIGHT - 1} stroke={colors.border} strokeWidth={1} />
            <Path d={geometry.area} fill="url(#fill)" />
            <Path d={geometry.line} stroke={colors.gold} strokeWidth={2} fill="none" strokeLinejoin="round" />
            <Circle cx={geometry.last[0]} cy={geometry.last[1]} r={4} fill={colors.gold} />
          </Svg>
        ) : (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>
              Pas encore assez de points sur cette période. Le graphique se remplit à chaque ouverture et fermeture de
              l’appli et à chaque opération.
            </Text>
          </View>
        )}
      </View>

      {geometry && (
        <View style={styles.scale}>
          <Text style={styles.scaleText}>min {formatEur(Math.min(...visible.map((p) => p.total)))}</Text>
          <Text style={styles.scaleText}>max {formatEur(Math.max(...visible.map((p) => p.total)))}</Text>
        </View>
      )}

      <Segmented
        value={period}
        onChange={setPeriod}
        options={[
          { value: '1d', label: '24 h' },
          { value: '7d', label: '7 j' },
          { value: '30d', label: '30 j' },
          { value: 'all', label: 'Tout' },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  header: { gap: 2 },
  change: { fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'] },
  since: { color: colors.textMuted, fontSize: 12 },
  empty: { flex: 1, justifyContent: 'center', paddingHorizontal: 12 },
  emptyText: { color: colors.textMuted, fontSize: 13, textAlign: 'center', lineHeight: 19 },
  scale: { flexDirection: 'row', justifyContent: 'space-between' },
  scaleText: { color: colors.textMuted, fontSize: 11, fontVariant: ['tabular-nums'] },
});
