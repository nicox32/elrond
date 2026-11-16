import { useMemo, useState } from 'react';
import { type LayoutChangeEvent, PanResponder, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop } from 'react-native-svg';

import { nearestIndex, type SeriesPoint } from '../logic/priceSeries';
import { colors } from '../theme';

const HEIGHT = 230;
const PAD_TOP = 14;
const PAD_BOTTOM = 8;
const AXIS_W = 58;
const TIP_W = 150;

interface Props {
  points: SeriesPoint[];
  color: string;
  format: (v: number) => string;
  /** Date affichée sous le doigt (plus précise sur les courtes périodes). */
  formatTime: (t: number) => string;
  testID?: string;
  /** Point touché (null quand le doigt se lève), pour l'afficher ailleurs à l'écran. */
  onScrub?: (p: SeriesPoint | null) => void;
}

const shortDate = (t: number) =>
  new Date(t).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });

/**
 * Courbe de cours : glissez le doigt de gauche à droite pour lire la date et la valeur de chaque point.
 */
export function ScrubChart({ points, color, format, formatTime, testID, onScrub }: Props) {
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<number | null>(null);
  const plotW = Math.max(0, width - AXIS_W);

  const geo = useMemo(() => {
    if (points.length < 2 || plotW <= 0) return null;
    const t0 = points[0].t;
    const t1 = points[points.length - 1].t;
    let min = Math.min(...points.map((p) => p.v));
    let max = Math.max(...points.map((p) => p.v));
    if (max - min < 1e-9) {
      min -= 1;
      max += 1;
    }
    const pad = (max - min) * 0.06;
    min -= pad;
    max += pad;
    const x = (t: number) => ((t - t0) / (t1 - t0 || 1)) * plotW;
    const y = (v: number) => PAD_TOP + (1 - (v - min) / (max - min)) * (HEIGHT - PAD_TOP - PAD_BOTTOM);
    // Au-delà de ~600 points, on n'en dessine qu'une partie (le doigt lit toujours tous les points).
    const step = Math.max(1, Math.floor(points.length / 600));
    const drawn = points.filter((_, i) => i % step === 0 || i === points.length - 1);
    const line = drawn.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ');
    const area = `${line} L${plotW.toFixed(1)},${HEIGHT} L0,${HEIGHT} Z`;
    const ticks = [0, 1, 2, 3].map((k) => min + ((max - min) * (3 - k)) / 3);
    return { t0, t1, x, y, line, area, ticks };
  }, [points, plotW]);

  const responder = useMemo(() => {
    const pick = (locationX: number) => {
      if (!geo) return;
      const rel = Math.min(Math.max(locationX, 0), plotW);
      const i = nearestIndex(points, geo.t0 + (rel / (plotW || 1)) * (geo.t1 - geo.t0));
      setActive(i);
      onScrub?.(points[i]);
    };
    const end = () => {
      setActive(null);
      onScrub?.(null);
    };
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      // Le défilement de la page ne reprend pas le geste tant que le doigt est sur la courbe.
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => pick(e.nativeEvent.locationX),
      onPanResponderMove: (e) => pick(e.nativeEvent.locationX),
      onPanResponderRelease: end,
      onPanResponderTerminate: end,
    });
  }, [geo, plotW, points, onScrub]);

  const p = active !== null ? points[active] : null;
  const px = p && geo ? geo.x(p.t) : 0;
  const py = p && geo ? geo.y(p.v) : 0;
  const tipLeft = Math.min(Math.max(px - TIP_W / 2, 0), Math.max(0, plotW - TIP_W));
  const gradId = `grad-${color.replace('#', '')}`;

  return (
    <View testID={testID} onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}>
      <View style={{ height: HEIGHT, flexDirection: 'row' }}>
        <View
          style={{ width: plotW, height: HEIGHT }}
          {...responder.panHandlers}
          testID={testID ? `${testID}-touch` : undefined}
        >
          {geo ? (
            <Svg width={plotW} height={HEIGHT} pointerEvents="none">
              <Defs>
                <LinearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={color} stopOpacity={0.45} />
                  <Stop offset="1" stopColor={color} stopOpacity={0.02} />
                </LinearGradient>
              </Defs>
              {geo.ticks.map((v) => (
                <Line key={v} x1={0} x2={plotW} y1={geo.y(v)} y2={geo.y(v)} stroke={colors.border} strokeWidth={1} />
              ))}
              <Path d={geo.area} fill={`url(#${gradId})`} />
              <Path d={geo.line} stroke={color} strokeWidth={1.8} fill="none" strokeLinejoin="round" />
              {p && (
                <>
                  <Line x1={px} x2={px} y1={0} y2={HEIGHT} stroke={colors.text} strokeOpacity={0.5} strokeWidth={1} />
                  <Circle cx={px} cy={py} r={5} fill={color} stroke={colors.background} strokeWidth={2} />
                </>
              )}
            </Svg>
          ) : (
            <Text style={styles.empty}>Chargement de l’historique…</Text>
          )}
          {p && (
            <View pointerEvents="none" style={[styles.tip, { left: tipLeft }]} testID="scrub-tip">
              <Text style={styles.tipDate}>{formatTime(p.t)}</Text>
              <Text style={styles.tipValue}>{format(p.v)}</Text>
            </View>
          )}
        </View>
        <View style={{ width: AXIS_W, height: HEIGHT }} pointerEvents="none">
          {geo?.ticks.map((v) => (
            <Text key={v} style={[styles.axis, { top: geo.y(v) - 8 }]} numberOfLines={1}>
              {format(v).replace(/\s?€.*$/, '')}
            </Text>
          ))}
        </View>
      </View>
      {geo && (
        <View style={[styles.dates, { width: plotW }]}>
          <Text style={styles.axisDate}>{shortDate(geo.t0)}</Text>
          <Text style={styles.axisDate}>{shortDate(geo.t1)}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { color: colors.textMuted, fontSize: 13, textAlign: 'center', marginTop: HEIGHT / 2 - 10 },
  tip: {
    position: 'absolute',
    top: 4,
    width: TIP_W,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tipDate: { color: colors.textMuted, fontSize: 12 },
  tipValue: { color: colors.text, fontSize: 16, fontWeight: '800', fontVariant: ['tabular-nums'] },
  axis: {
    position: 'absolute',
    left: 6,
    color: colors.textMuted,
    fontSize: 10.5,
    fontVariant: ['tabular-nums'],
  },
  dates: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  axisDate: { color: colors.textMuted, fontSize: 11 },
});
