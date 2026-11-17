import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { type BarPlace, PLACE_LABEL, placeLabel } from '../logic/physical';
import type { HomeBar } from '../logic/types';
import { colors } from '../theme';
import { styles as ui } from './ui';

/** Lieu où est gardé un lingotin ou une pièce : chez vous, coffre en banque ou ailleurs, avec une précision. */
export function PlaceEditor({
  bar,
  onChange,
  title = 'Lieu de garde',
}: {
  bar: Pick<HomeBar, 'id' | 'place' | 'placeNote'>;
  onChange: (place: BarPlace, note?: string) => void;
  title?: string;
}) {
  const [note, setNote] = useState(bar.placeNote ?? '');
  const current: BarPlace = bar.place ?? 'maison';
  return (
    <View style={{ gap: 6 }} testID={`place-${bar.id}`}>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.row}>
        {(Object.keys(PLACE_LABEL) as BarPlace[]).map((k) => (
          <Pressable
            key={k}
            onPress={() => onChange(k, k === current ? note : '')}
            style={[styles.chip, k === current && styles.chipOn]}
            accessibilityRole="button"
            accessibilityState={{ selected: k === current }}
          >
            <Text style={[styles.chipText, k === current && { color: colors.gold }]}>{PLACE_LABEL[k]}</Text>
          </Pressable>
        ))}
      </View>
      {current !== 'maison' || bar.placeNote ? (
        <TextInput
          value={note}
          onChangeText={setNote}
          onEndEditing={() => onChange(current, note)}
          onBlur={() => onChange(current, note)}
          placeholder={current === 'banque' ? 'Banque et agence (facultatif)' : 'Où il est gardé'}
          placeholderTextColor={colors.textMuted}
          style={ui.input}
          accessibilityLabel="Précision du lieu"
        />
      ) : null}
      <Text style={styles.sub}>Gardé : {placeLabel(bar)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.text, fontSize: 13.5, fontWeight: '700' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 5,
    backgroundColor: colors.surfaceAlt,
  },
  chipOn: { borderColor: colors.gold },
  chipText: { color: colors.text, fontSize: 12.5, fontWeight: '600' },
  sub: { color: colors.textMuted, fontSize: 12.5 },
});
