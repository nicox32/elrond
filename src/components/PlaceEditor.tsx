import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { type BarPlace, isLocked, PLACE_CHOICES, PLACE_LABEL, placeLabel } from '../logic/physical';
import type { HomeBar } from '../logic/types';
import { colors } from '../theme';
import { styles as ui } from './ui';

/** Lieu où est gardé un lingotin ou une pièce : chez vous, coffre en banque ou ailleurs, avec une précision. */
export function PlaceEditor({
  bar,
  onChange,
  title = 'Lieu de garde',
}: {
  bar: Pick<
    HomeBar,
    'id' | 'place' | 'placeNote' | 'lockedUntil' | 'status' | 'vault' | 'exitedAt' | 'exitRequest' | 'pickupAgency'
  >;
  onChange: (place: BarPlace | 'auto', note?: string) => void;
  title?: string;
}) {
  const [note, setNote] = useState(bar.placeNote ?? '');
  const manual = bar.place;
  if (isLocked(bar)) {
    return (
      <View style={{ gap: 6 }} testID={`place-${bar.id}`}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.sub}>Gardé : {placeLabel(bar)}</Text>
        <Text style={styles.sub}>
          🔒 Sécurité maximale : le lieu ne peut pas être changé avant le{' '}
          {new Date(bar.lockedUntil!).toLocaleDateString('fr-FR')} (majorité de l’enfant).
        </Text>
      </View>
    );
  }
  return (
    <View style={{ gap: 6 }} testID={`place-${bar.id}`}>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.row}>
        <Pressable
          onPress={() => {
            setNote('');
            onChange('auto');
          }}
          style={[styles.chip, !manual && styles.chipOn]}
          accessibilityRole="button"
          accessibilityState={{ selected: !manual }}
        >
          <Text style={[styles.chipText, !manual && { color: colors.gold }]}>Automatique</Text>
        </Pressable>
        {PLACE_CHOICES.map((k) => (
          <Pressable
            key={k}
            onPress={() => onChange(k, k === manual ? note : '')}
            style={[styles.chip, k === manual && styles.chipOn]}
            accessibilityRole="button"
            accessibilityState={{ selected: k === manual }}
          >
            <Text style={[styles.chipText, k === manual && { color: colors.gold }]}>{PLACE_LABEL[k]}</Text>
          </Pressable>
        ))}
      </View>
      {manual && (manual === 'agence' || manual === 'autre' || manual === 'coffre' || bar.placeNote) ? (
        <TextInput
          value={note}
          onChangeText={setNote}
          onEndEditing={() => onChange(manual, note)}
          onBlur={() => onChange(manual, note)}
          placeholder={manual === 'agence' ? 'Ville de l’agence (facultatif)' : 'Précision (facultatif)'}
          placeholderTextColor={colors.textMuted}
          style={ui.input}
          accessibilityLabel="Précision du lieu"
        />
      ) : null}
      <Text style={styles.sub}>
        Gardé : {placeLabel(bar)}
        {manual ? '' : ' (automatique)'}
      </Text>
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
