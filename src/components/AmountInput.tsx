import { StyleSheet, Text, TextInput, View } from 'react-native';

import type { AmountUnit, Metal } from '../logic/types';
import { colors } from '../theme';
import { Segmented } from './Segmented';
import { styles as ui } from './ui';

interface Props {
  text: string;
  onChangeText: (text: string) => void;
  unit: AmountUnit;
  onUnitChange: (unit: AmountUnit) => void;
  /** Unités proposées (par défaut : euros, grammes, onces). */
  units?: AmountUnit[];
  /** Actif concerné (réservé : toutes les quantités se saisissent en grammes ou en onces). */
  metal?: Metal;
}

const UNIT_LABEL: Record<AmountUnit, string> = { eur: 'Euros', g: 'Grammes', oz: 'Onces' };

/** Saisie d'un montant en euros, en grammes ou en onces troy. */
export function AmountInput({ text, onChangeText, unit, onUnitChange, units = ['eur', 'g', 'oz'], metal }: Props) {
  const shown = units;
  const label = (u: AmountUnit) => UNIT_LABEL[u];
  return (
    <View style={styles.wrap}>
      <Segmented value={unit} onChange={onUnitChange} options={shown.map((u) => ({ value: u, label: label(u) }))} />
      <View style={styles.row}>
        <TextInput
          value={text}
          onChangeText={onChangeText}
          placeholder="0"
          placeholderTextColor={colors.textMuted}
          keyboardType="decimal-pad"
          style={[ui.input, styles.input]}
          accessibilityLabel={`Montant en ${label(unit).toLowerCase()}`}
        />
        <Text style={styles.unit}>{unit === 'eur' ? '€' : unit}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  input: { flex: 1, minWidth: 0, fontSize: 24, fontWeight: '700' },
  unit: { width: 40, color: colors.textMuted, fontSize: 22, fontWeight: '700', textAlign: 'center' },
});
