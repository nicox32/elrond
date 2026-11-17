import { useState } from 'react';
import { Image, type LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { METAL_LABEL } from '../logic/ledger';
import type { Card } from '../logic/types';
import { colors, metalColor } from '../theme';

const LOGO = require('../../assets/logo.png');

/** Visuel de la carte Orvia (format carte bancaire, 85,6 × 54 mm). */
export function OrviaCard({ card }: { card: Card }) {
  const [width, setWidth] = useState(0);
  const height = width / 1.586;
  return (
    <View
      style={[styles.wrap, { height: height || undefined, aspectRatio: width ? undefined : 1.586 }]}
      onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
      accessibilityLabel={`Carte Orvia se terminant par ${card.last4}${card.frozen ? ', gelée' : ''}`}
    >
      {width > 0 && (
        <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id="cardBg" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor="#2A2416" />
              <Stop offset="0.55" stopColor="#14120C" />
              <Stop offset="1" stopColor="#3A2E12" />
            </LinearGradient>
            <LinearGradient id="chip" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor="#F3D77A" />
              <Stop offset="1" stopColor="#B8892A" />
            </LinearGradient>
          </Defs>
          <Rect x={0} y={0} width={width} height={height} rx={18} fill="url(#cardBg)" />
          <Rect
            x={0.5}
            y={0.5}
            width={width - 1}
            height={height - 1}
            rx={18}
            stroke={colors.gold}
            strokeOpacity={0.5}
            fill="none"
          />
          <Rect
            x={width * 0.08}
            y={height * 0.36}
            width={width * 0.13}
            height={height * 0.2}
            rx={5}
            fill="url(#chip)"
          />
        </Svg>
      )}
      <View style={styles.top}>
        <Text style={styles.brand}>ORVIA</Text>
        <Image source={LOGO} style={styles.logo} resizeMode="contain" />
      </View>
      <View style={styles.bottom}>
        <Text style={styles.number}>•••• •••• •••• {card.last4}</Text>
        <View style={styles.row}>
          <View>
            <Text style={styles.small}>TITULAIRE</Text>
            <Text style={styles.value}>{card.holderName}</Text>
          </View>
          <View>
            <Text style={styles.small}>EXPIRE FIN</Text>
            <Text style={styles.value}>{card.expiry}</Text>
          </View>
          <View style={[styles.metal, { borderColor: metalColor[card.fundingMetal] }]}>
            <Text style={[styles.metalText, { color: metalColor[card.fundingMetal] }]}>
              {METAL_LABEL[card.fundingMetal]}
            </Text>
          </View>
        </View>
      </View>
      {card.frozen && (
        <View style={styles.frozen}>
          <Text style={styles.frozenText}>❄ Carte gelée</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', borderRadius: 18, overflow: 'hidden', padding: 18, justifyContent: 'space-between' },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  brand: { color: colors.gold, fontSize: 20, fontWeight: '800', letterSpacing: 4 },
  logo: { width: 46, height: 46 },
  bottom: { gap: 10 },
  number: { color: colors.text, fontSize: 19, letterSpacing: 2, fontVariant: ['tabular-nums'], fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10 },
  small: { color: colors.textMuted, fontSize: 9, letterSpacing: 1 },
  value: { color: colors.text, fontSize: 13, fontWeight: '700', letterSpacing: 1 },
  metal: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  metalText: { fontSize: 11, fontWeight: '700' },
  frozen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(14, 15, 19, 0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  frozenText: { color: '#BFE3FF', fontSize: 18, fontWeight: '800' },
});
