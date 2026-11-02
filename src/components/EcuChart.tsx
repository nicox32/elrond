import { useMemo, useState } from 'react';
import { type LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import Svg, { Line, Path } from 'react-native-svg';

import { formatEur } from '../logic/format';
import { colors } from '../theme';
import { Segmented } from './Segmented';

type Period = '1d' | '7d' | '30d';
const PERIOD_MS: Record<Period, number> = { '1d': 86_400_000, '7d': 7 * 86_400_000, '30d': 30 * 86_400_000 };
const HEIGHT = 140;
const PAD = 8;

export interface EcuChartPoint {
  t: string;
  gold: number;
  ecu: number;
  premium: number;
}

/** Prix du Gold Oria comparé au Gold Spot (€/g) : l'écart entre les deux courbes est la prime. */
export function EcuChart({ points }: { points: EcuChartPoint[] }) {
  const [period, setPeriod] = useState<Period>('7d');
  const [width, setWidth] = useState(0);
  const visible = useMemo(() => {
    const last = points.length ? new Date(points[points.length - 1].t).getTime() : 0;
    return points.filter((p) => new Date(p.t).getTime() >= last - PERIOD_MS[period]);
  }, [points, period]);

  const geo = useMemo(() => {
    if (visible.length < 2 || width === 0) return null;
    const times = visible.map((p) => new Date(p.t).getTime());
    const t0 = times[0];
    const t1 = times[times.length - 1];
    const all = visible.flatMap((p) => [p.gold, p.ecu]);
    const min = Math.min(...all);
    const max = Math.max(...all) || min + 1;
    const x = (t: number) => (t1 === t0 ? 0 : ((t - t0) / (t1 - t0)) * width);
    const y = (v: number) => PAD + (1 - (v - min) / (max - min || 1)) * (HEIGHT - 2 * PAD);
    const path = (key: 'gold' | 'ecu') =>
      visible.map((p, i) => `${i ? 'L' : 'M'}${x(times[i]).toFixed(1)},${y(p[key]).toFixed(1)}`).join(' ');
    return { gold: path('gold'), ecu: path('ecu') };
  }, [visible, width]);

  const premiums = visible.map((p) => p.premium * 100);
  const fmt = (n: number) => `${n.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %`;

  return (
    <View style={{ gap: 8 }}>
      <View style={{ height: HEIGHT }} onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}>
        {geo ? (
          <Svg width={width} height={HEIGHT}>
            <Line x1={0} x2={width} y1={HEIGHT - 1} y2={HEIGHT - 1} stroke={colors.border} strokeWidth={1} />
            <Path d={geo.gold} stroke={colors.textMuted} strokeWidth={1.5} strokeDasharray="4 3" fill="none" />
            <Path d={geo.ecu} stroke={colors.gold} strokeWidth={2} fill="none" strokeLinejoin="round" />
          </Svg>
        ) : (
          <View style={styles.empty}>
            <Text style={styles.muted}>
              Pas encore assez de relevés sur cette période : l’appli en enregistre un par heure quand elle est ouverte.
            </Text>
          </View>
        )}
      </View>
      <View style={styles.legend}>
        <Text style={[styles.muted, { color: colors.gold }]}>━ Gold Oria</Text>
        <Text style={styles.muted}>┅ Gold Spot</Text>
        {premiums.length > 1 && (
          <Text style={styles.muted}>
            prime {fmt(Math.min(...premiums))} → {fmt(Math.max(...premiums))}
          </Text>
        )}
      </View>
      {visible.length > 1 && (
        <Text style={styles.muted}>
          De {formatEur(visible[0].ecu)} à {formatEur(visible[visible.length - 1].ecu)} le gramme sur la période.
        </Text>
      )}
      <Segmented
        value={period}
        onChange={setPeriod}
        options={[
          { value: '1d', label: '24 h' },
          { value: '7d', label: '7 j' },
          { value: '30d', label: '30 j' },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 12 },
  muted: { color: colors.textMuted, fontSize: 12, lineHeight: 17, textAlign: 'center' },
  legend: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 },
});
