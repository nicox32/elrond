import { Pressable, StyleSheet, Text, View } from 'react-native';

import { METAL_LABEL } from '../logic/ledger';
import { type Metal, METALS } from '../logic/types';
import { colors, metalColor } from '../theme';

interface Props {
  value: Metal;
  onChange: (metal: Metal) => void;
  /** Métal à ne pas proposer (ex. le métal de départ d'une conversion). */
  exclude?: Metal;
  /** Actifs proposés (par défaut : les trois métaux et l'Écu Orvia). */
  metals?: Metal[];
}

export function MetalPicker({ value, onChange, exclude, metals = METALS }: Props) {
  return (
    <View style={styles.row}>
      {metals
        .filter((m) => m !== exclude)
        .map((m) => {
          const active = m === value;
          return (
            <Pressable
              key={m}
              onPress={() => onChange(m)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              style={[styles.item, active && { borderColor: metalColor[m], backgroundColor: colors.surfaceAlt }]}
            >
              <View style={[styles.dot, { backgroundColor: metalColor[m] }]} />
              <Text style={[styles.text, active && { color: colors.text }]} numberOfLines={1}>
                {m === 'ecu' ? 'Écu' : METAL_LABEL[m]}
              </Text>
            </Pressable>
          );
        })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  item: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  text: { color: colors.textMuted, fontSize: 14, fontWeight: '600' },
});
