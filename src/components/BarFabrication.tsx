import { useEffect, useState } from 'react';
import { Animated, Platform, StyleSheet, Text, View } from 'react-native';

import { fabricationProgress } from '../logic/physical';
import { colors, metalColor } from '../theme';

/**
 * Lingotin « en fabrication » : un lingot qui se remplit d'or selon l'avancement estimé de la commande, avec ses
 * quatre étapes. L'avancement est une estimation (jours écoulés), pas un suivi du revendeur.
 */
export function BarFabrication({
  orderedAt,
  pickup,
  vault,
  totalDays,
  fromStock,
}: {
  orderedAt: string;
  pickup?: boolean;
  vault?: boolean;
  /** Délai total en jours (plus court si le lingotin part du stock d'Orvia). */
  totalDays?: number;
  fromStock?: boolean;
}) {
  const p = fabricationProgress(orderedAt, new Date(), !!pickup, !!vault, totalDays, !!fromStock);
  const [pulse] = useState(() => new Animated.Value(0.55));
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(pulse, { toValue: 0.55, duration: 900, useNativeDriver: Platform.OS !== 'web' }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  const done = p.step >= 3;
  return (
    <View style={styles.wrap} testID="bar-fabrication" accessibilityLabel={`Avancement estimé : ${p.label}`}>
      <View style={styles.ingot}>
        <View style={[styles.fill, { width: `${Math.max(8, Math.round(p.ratio * 100))}%` }, done && styles.fillDone]}>
          {!done && <Animated.View style={[styles.shine, { opacity: pulse }]} />}
        </View>
      </View>
      <View style={styles.steps}>
        {p.labels.map((l, i) => (
          <View key={l} style={styles.step}>
            <View
              style={[
                styles.dot,
                i <= p.step && (done ? styles.dotDone : styles.dotOn),
                i === p.step && !done && styles.dotNow,
              ]}
            />
            <Text
              style={[styles.stepText, i === p.step && (done ? styles.stepDone : styles.stepNow)]}
              numberOfLines={2}
            >
              {l}
            </Text>
          </View>
        ))}
      </View>
      <Text style={[styles.note, done && { color: colors.up }]}>
        {done
          ? 'Arrivé : à vous de le noter dès que vous l’avez en main.'
          : `Avancement estimé d’après les jours écoulés (${totalDays ?? 8} jours en tout).`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8, paddingVertical: 4 },
  ingot: {
    height: 22,
    borderRadius: 6,
    backgroundColor: colors.border,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  fill: { height: '100%', backgroundColor: metalColor.gold, borderRadius: 5 },
  shine: { position: 'absolute', right: 0, top: 0, bottom: 0, width: 24, backgroundColor: '#fff3bf' },
  steps: { flexDirection: 'row', gap: 4 },
  step: { flex: 1, alignItems: 'center', gap: 4 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.border },
  fillDone: { backgroundColor: colors.up },
  dotDone: { backgroundColor: colors.up },
  stepDone: { color: colors.up, fontWeight: '700' },
  dotOn: { backgroundColor: metalColor.gold },
  dotNow: { borderWidth: 2, borderColor: '#fff3bf' },
  stepText: { color: colors.textMuted, fontSize: 11, textAlign: 'center' },
  stepNow: { color: metalColor.gold, fontWeight: '700' },
  note: { color: colors.textMuted, fontSize: 11 },
});
