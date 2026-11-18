import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { agencyLabel, GODOT_AGENCIES } from '../logic/physical';
import { colors } from '../theme';
import { styles as ui } from './ui';

const OTHER = 'Autre agence…';

/** Menu déroulant des agences Godot & Fils, avec une saisie libre pour une agence absente de la liste. */
export function AgencyPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [other, setOther] = useState(false);
  const known = GODOT_AGENCIES.some((a) => agencyLabel(a) === value);
  return (
    <View style={{ gap: 6 }}>
      <Pressable
        onPress={() => setOpen((o) => !o)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel="Choisir l’agence Godot & Fils"
        style={styles.field}
        testID="agency-picker"
      >
        <Text style={[styles.fieldText, !value && { color: colors.textMuted }]} numberOfLines={2}>
          {value || 'Choisir une agence Godot & Fils'}
        </Text>
        <Text style={styles.chevron}>{open ? '▴' : '▾'}</Text>
      </Pressable>
      {open && (
        <ScrollView style={styles.list} nestedScrollEnabled testID="agency-list">
          {GODOT_AGENCIES.map((a) => {
            const label = agencyLabel(a);
            return (
              <Pressable
                key={label}
                onPress={() => {
                  onChange(label);
                  setOther(false);
                  setOpen(false);
                }}
                accessibilityRole="button"
                accessibilityLabel={`Agence ${label}`}
                style={[styles.item, label === value && { backgroundColor: 'rgba(212,175,55,0.12)' }]}
              >
                <Text style={styles.itemName}>{a.name}</Text>
                {a.address ? <Text style={styles.itemSub}>{a.address}</Text> : null}
              </Pressable>
            );
          })}
          <Pressable
            onPress={() => {
              setOther(true);
              if (known) onChange('');
              setOpen(false);
            }}
            accessibilityRole="button"
            style={styles.item}
          >
            <Text style={styles.itemName}>{OTHER}</Text>
          </Pressable>
        </ScrollView>
      )}
      {other && !known && (
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder="Ville de l’agence Godot & Fils"
          placeholderTextColor={colors.textMuted}
          style={ui.input}
          accessibilityLabel="Agence de retrait"
          testID="pickup-agency"
        />
      )}
      <Text style={styles.note}>
        Liste relevée sur les sites de Godot & Fils, non exhaustive : confirmez l’adresse et les horaires avant de vous
        déplacer.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  fieldText: { flex: 1, color: colors.text, fontSize: 15 },
  chevron: { color: colors.gold, fontSize: 16 },
  list: { maxHeight: 260, borderWidth: 1, borderColor: colors.border, borderRadius: 10 },
  item: { paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  itemName: { color: colors.text, fontSize: 14.5, fontWeight: '600' },
  itemSub: { color: colors.textMuted, fontSize: 12.5 },
  note: { color: colors.textMuted, fontSize: 11.5 },
});
