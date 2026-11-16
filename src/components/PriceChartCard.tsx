import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { formatPercent } from '../logic/format';
import {
  fullSeries,
  type Range,
  RANGES,
  rangeSeries,
  type SeriesKind,
  type SeriesPoint,
  seriesStats,
  type PriceMode,
} from '../logic/priceSeries';
import { useBank } from '../state/BankProvider';
import { useCours } from '../state/useCours';
import { colors } from '../theme';
import { ScrubChart } from './ScrubChart';
import { Segmented } from './Segmented';

const DAY_FMT: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' };

/** Série complète d'un métal (ou du ratio), au cours du moment compris. */
export function useSeries(kind: SeriesKind) {
  const { quote, priceHistory, hourlyHistory } = useBank();
  const data = useCours();
  const series = useMemo(
    () =>
      fullSeries(
        data,
        kind,
        [...hourlyHistory, ...priceHistory],
        quote.source === 'live' ? { t: new Date(quote.fetchedAt).getTime(), prices: quote.prices } : null,
      ),
    [data, kind, hourlyHistory, priceHistory, quote],
  );
  return { series, updated: data.updated };
}

/**
 * Valeur du moment (ou sous le doigt), variation sur la période, courbe glissable et choix de la période.
 */
export function PriceChartCard({
  series,
  color,
  format,
  big,
  mode = 'spot',
  metal,
  initialRange = '1y',
  testID,
}: {
  series: SeriesPoint[];
  color: string;
  format: (v: number) => string;
  /** Format du grand chiffre (par défaut, le même). */
  big?: (v: number) => string;
  mode?: PriceMode;
  metal?: 'gold' | 'silver' | 'platinum';
  initialRange?: Range;
  testID?: string;
}) {
  const [range, setRange] = useState<Range>(initialRange);
  const [scrub, setScrub] = useState<SeriesPoint | null>(null);
  const points = useMemo(() => rangeSeries(series, range, mode, metal), [series, range, mode, metal]);
  const stats = seriesStats(points);
  const short = range === '5d' || range === '1m';
  const formatTime = useCallback(
    (t: number) => {
      const d = new Date(t);
      return short
        ? `${d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} · ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
        : d.toLocaleDateString('fr-FR', DAY_FMT);
    },
    [short],
  );
  const shown = scrub ?? (points.length ? points[points.length - 1] : null);
  const changeFromStart = stats && shown ? ((shown.v - stats.first) / stats.first) * 100 : 0;
  const up = changeFromStart >= 0;
  const label = RANGES.find((r) => r.value === range)?.label ?? '';

  return (
    <View style={{ gap: 10 }} testID={testID}>
      <View style={styles.head}>
        <Text style={styles.big} testID={testID ? `${testID}-value` : undefined}>
          {shown ? (big ?? format)(shown.v) : '—'}
        </Text>
        {stats && (
          <View style={[styles.badge, { backgroundColor: up ? 'rgba(46,204,113,0.16)' : 'rgba(231,76,60,0.16)' }]}>
            <Text style={[styles.badgeText, { color: up ? colors.up : colors.down }]}>
              {formatPercent(changeFromStart)} · {label}
            </Text>
          </View>
        )}
      </View>
      <Text style={styles.when}>
        {scrub ? formatTime(scrub.t) : 'Maintenant · glissez le doigt sur la courbe pour lire chaque date'}
      </Text>
      <ScrubChart
        points={points}
        color={color}
        format={format}
        formatTime={formatTime}
        onScrub={setScrub}
        testID={testID ? `${testID}-chart` : undefined}
      />
      <Segmented value={range} onChange={setRange} options={RANGES.map((r) => ({ value: r.value, label: r.label }))} />
      {stats && (
        <View style={styles.stats}>
          <Stat label="Plus haut" value={format(stats.max.v)} sub={new Date(stats.max.t).toLocaleDateString('fr-FR')} />
          <Stat label="Plus bas" value={format(stats.min.v)} sub={new Date(stats.min.t).toLocaleDateString('fr-FR')} />
          <Stat label="Moyenne" value={format(stats.avg)} sub={`sur ${label}`} />
        </View>
      )}
    </View>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={styles.statSub}>{sub}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' },
  big: { color: colors.text, fontSize: 30, fontWeight: '800', fontVariant: ['tabular-nums'] },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 13, fontWeight: '800', fontVariant: ['tabular-nums'] },
  when: { color: colors.textMuted, fontSize: 12.5, marginTop: -6 },
  stats: { flexDirection: 'row', gap: 8 },
  stat: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 10,
    gap: 2,
  },
  statLabel: { color: colors.textMuted, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4 },
  statValue: { color: colors.text, fontSize: 14, fontWeight: '800', fontVariant: ['tabular-nums'] },
  statSub: { color: colors.textMuted, fontSize: 11 },
});
