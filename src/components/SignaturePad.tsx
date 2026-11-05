import { useState } from 'react';
import { Modal, PanResponder, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import type { QuarterSignature } from '../logic/types';
import { colors } from '../theme';
import { Button } from './ui';

const W = 320;
const H = 160;

/** Signature au doigt : le tracé est gardé en SVG (léger, net à toutes les tailles). */
export function SignaturePad({
  visible,
  title,
  summary,
  onSign,
  onCancel,
}: {
  visible: boolean;
  title: string;
  summary: string;
  onSign: (sig: QuarterSignature) => void;
  onCancel: () => void;
}) {
  // Chaque trait : « M x y L x y … » ; le dernier est celui en cours de dessin.
  const [strokes, setStrokes] = useState<string[]>([]);
  const [pan] = useState(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        const { locationX: x, locationY: y } = e.nativeEvent;
        setStrokes((s) => [...s, `M${x.toFixed(1)} ${y.toFixed(1)}`]);
      },
      onPanResponderMove: (e) => {
        const { locationX: x, locationY: y } = e.nativeEvent;
        if (x < 0 || y < 0 || x > W || y > H) return;
        setStrokes((s) => (s.length ? [...s.slice(0, -1), `${s[s.length - 1]} L${x.toFixed(1)} ${y.toFixed(1)}`] : s));
      },
      // Un simple point (sans tracé) n'est pas gardé.
      onPanResponderRelease: () => setStrokes((s) => s.filter((d) => d.includes('L'))),
    }),
  );
  const all = strokes.join(' ');
  const drawn = strokes.some((d) => d.includes('L'));
  const close = (fn: () => void) => {
    setStrokes([]);
    fn();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={() => close(onCancel)}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.summary}>{summary}</Text>
          <View style={styles.pad} {...pan.panHandlers} accessibilityLabel="Zone de signature">
            <Svg width={W} height={H}>
              <Path
                d={all || 'M0 0'}
                stroke="#1d3a8a"
                strokeWidth={2.5}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
            {!all && <Text style={styles.placeholder}>Signez ici avec le doigt</Text>}
          </View>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Button title="Effacer" variant="ghost" onPress={() => setStrokes([])} disabled={!drawn} />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                title="Signer"
                onPress={() =>
                  close(() => onSign({ signedAt: new Date().toISOString(), path: strokes.join(' '), w: W, h: H }))
                }
                disabled={!strokes.length}
              />
            </View>
          </View>
          <Button title="Annuler" variant="ghost" onPress={() => close(onCancel)} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    gap: 12,
    alignItems: 'center',
  },
  title: { color: colors.text, fontSize: 17, fontWeight: '700', textAlign: 'center' },
  summary: { color: colors.textMuted, fontSize: 13, textAlign: 'center' },
  pad: { width: W, height: H, backgroundColor: '#FFFFFF', borderRadius: 12, overflow: 'hidden' },
  placeholder: {
    position: 'absolute',
    top: H / 2 - 10,
    left: 0,
    right: 0,
    textAlign: 'center',
    color: '#9CA3AF',
    fontSize: 14,
  },
  row: { flexDirection: 'row', gap: 10, alignSelf: 'stretch' },
});
