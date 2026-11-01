import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PIN_LENGTH } from '../security';
import { colors } from '../theme';

interface Props {
  title: string;
  subtitle?: string;
  error?: string | null;
  /** Appelé quand les 4 chiffres sont saisis. Renvoie false pour effacer et recommencer. */
  onComplete: (pin: string) => Promise<boolean> | boolean;
  /** Bouton facultatif à gauche du 0 (ex. empreinte digitale). */
  extraKey?: { label: string; onPress: () => void };
  disabled?: boolean;
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

export function PinPad({ title, subtitle, error, onComplete, extraKey, disabled }: Props) {
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);

  const press = (d: string) => {
    if (busy || disabled || pin.length >= PIN_LENGTH) return;
    const next = pin + d;
    setPin(next);
    if (next.length < PIN_LENGTH) return;
    setBusy(true);
    Promise.resolve(onComplete(next)).then((ok) => {
      setBusy(false);
      if (!ok) setPin('');
    });
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      <View style={styles.dots} accessibilityLabel={`${pin.length} chiffres saisis sur ${PIN_LENGTH}`}>
        {Array.from({ length: PIN_LENGTH }, (_, i) => (
          <View key={i} style={[styles.dot, i < pin.length && styles.dotFilled]} />
        ))}
      </View>
      <Text style={styles.error}>{error ?? ' '}</Text>
      <View style={styles.grid}>
        {KEYS.map((k) => (
          <Key key={k} label={k} onPress={() => press(k)} />
        ))}
        {extraKey ? <Key label={extraKey.label} small onPress={extraKey.onPress} /> : <View style={styles.key} />}
        <Key label="0" onPress={() => press('0')} />
        <Key label="⌫" onPress={() => setPin((p) => p.slice(0, -1))} accessibilityLabel="Effacer" />
      </View>
    </View>
  );
}

function Key({
  label,
  onPress,
  small,
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  small?: boolean;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      style={({ pressed }) => [styles.key, styles.keyButton, pressed && { backgroundColor: colors.surfaceAlt }]}
    >
      <Text style={[styles.keyText, small && styles.keyTextSmall]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 10, width: '100%' },
  title: { color: colors.text, fontSize: 20, fontWeight: '700', textAlign: 'center' },
  subtitle: { color: colors.textMuted, fontSize: 14, textAlign: 'center' },
  dots: { flexDirection: 'row', gap: 18, marginTop: 12 },
  dot: { width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: colors.gold },
  dotFilled: { backgroundColor: colors.gold },
  error: { color: colors.down, fontSize: 13, minHeight: 18 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', width: 270, justifyContent: 'space-between', rowGap: 14 },
  key: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center' },
  keyButton: { backgroundColor: colors.surface },
  keyText: { color: colors.text, fontSize: 28, fontWeight: '500' },
  keyTextSmall: { fontSize: 13, fontWeight: '600', color: colors.gold, textAlign: 'center' },
});
