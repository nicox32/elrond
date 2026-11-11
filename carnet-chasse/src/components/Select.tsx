import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { useCarnet } from '../state/CarnetProvider';
import { colors, fonts, space } from '../theme';
import { Label, styles } from './ui';

export interface SelectOption {
  value: string;
  label?: string;
  hint?: string;
}

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * Menu de sélection : on touche le champ, une liste s'ouvre (avec recherche si elle est longue).
 * « Autre » permet de taper sa propre valeur ; avec `customKey`, elle est retenue pour les fois suivantes
 * et peut être retirée de la liste (×).
 */
export function Select({
  label,
  value,
  onChange,
  options,
  placeholder = 'Choisir…',
  customKey,
  allowCustom = true,
  allowClear = true,
  searchable,
}: {
  label: string;
  value: string | undefined;
  onChange: (value: string, option?: SelectOption) => void;
  options: (string | SelectOption)[];
  placeholder?: string;
  customKey?: string;
  allowCustom?: boolean;
  allowClear?: boolean;
  searchable?: boolean;
}) {
  const { state, addChoice, removeChoice } = useCarnet();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [custom, setCustom] = useState('');

  const base: SelectOption[] = useMemo(() => options.map((o) => (typeof o === 'string' ? { value: o } : o)), [options]);
  const mine = customKey ? (state.customChoices[customKey] ?? []).filter((c) => !base.some((b) => b.value === c)) : [];
  const all: (SelectOption & { mine?: boolean })[] = [...base, ...mine.map((m) => ({ value: m, mine: true }))];
  const showSearch = searchable ?? all.length > 8;
  const shown = query.trim() ? all.filter((o) => norm(`${o.label ?? o.value} ${o.hint ?? ''}`).includes(norm(query.trim()))) : all;
  const current = all.find((o) => o.value === value);
  const display = current ? (current.label ?? current.value) : value;

  function close() {
    setOpen(false);
    setQuery('');
    setCustom('');
  }

  function pick(o: SelectOption) {
    onChange(o.value, o);
    close();
  }

  function pickCustom() {
    const v = custom.trim();
    if (!v) return;
    if (customKey) addChoice(customKey, v);
    onChange(v);
    close();
  }

  return (
    <View>
      <Label>{label}</Label>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`${label} : ${display || 'non renseigné'}`}
        style={({ pressed }) => [
          styles.input,
          { flexDirection: 'row', alignItems: 'center', minHeight: 46, opacity: pressed ? 0.85 : 1 },
        ]}
      >
        <Text style={{ flex: 1, color: display ? colors.text : colors.textMuted, fontFamily: fonts.body, fontSize: 16 }} numberOfLines={1}>
          {display || placeholder}
        </Text>
        <Text style={{ color: colors.accent, fontFamily: fonts.heading, fontSize: 16 }}>▾</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="slide" onRequestClose={close}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' }} onPress={close} accessibilityLabel="Fermer le menu" />
          <View
            style={{
              backgroundColor: colors.surface,
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              borderTopWidth: 1,
              borderColor: colors.border,
              paddingHorizontal: space.lg,
              paddingTop: space.md,
              paddingBottom: space.xl,
              maxHeight: '80%',
            }}
          >
            <View style={[styles.row, { justifyContent: 'space-between', marginBottom: space.sm }]}>
              <Text style={[styles.section, { fontSize: 20 }]}>{label}</Text>
              <Pressable onPress={close} accessibilityRole="button" hitSlop={10} style={{ padding: 6 }}>
                <Text style={{ color: colors.accent, fontFamily: fonts.semibold, fontSize: 15 }}>Fermer</Text>
              </Pressable>
            </View>
            {showSearch ? (
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Rechercher…"
                placeholderTextColor={colors.textMuted}
                style={[styles.input, { marginBottom: space.sm }]}
                autoCorrect={false}
              />
            ) : null}
            <ScrollView keyboardShouldPersistTaps="handled" style={{ flexGrow: 0 }}>
              {allowClear && value ? (
                <Pressable onPress={() => pick({ value: '' })} style={rowStyle} accessibilityRole="button">
                  <Text style={{ color: colors.textMuted, fontFamily: fonts.semibold, fontSize: 15 }}>— Aucun (effacer)</Text>
                </Pressable>
              ) : null}
              {shown.map((o) => {
                const selected = o.value === value;
                return (
                  <View key={`${o.mine ? 'm' : 'b'}:${o.value}`} style={[rowStyle, selected && { borderColor: colors.accent, backgroundColor: colors.accentSoft }]}>
                    <Pressable onPress={() => pick(o)} accessibilityRole="button" accessibilityState={{ selected }} style={{ flex: 1, paddingVertical: 4 }}>
                      <Text style={{ color: selected ? colors.accent : colors.text, fontFamily: fonts.semibold, fontSize: 16 }}>
                        {o.label ?? o.value}
                      </Text>
                      {o.hint ? <Text style={styles.muted}>{o.hint}</Text> : null}
                      {o.mine ? <Text style={[styles.muted, { fontSize: 11 }]}>ajouté par vous</Text> : null}
                    </Pressable>
                    {selected ? <Text style={{ color: colors.accent, fontSize: 18, marginLeft: 8 }}>✓</Text> : null}
                    {o.mine && customKey ? (
                      <Pressable
                        onPress={() => removeChoice(customKey, o.value)}
                        accessibilityRole="button"
                        accessibilityLabel={`Retirer ${o.value} de la liste`}
                        hitSlop={8}
                        style={{ paddingHorizontal: 10, paddingVertical: 6 }}
                      >
                        <Text style={{ color: colors.danger, fontFamily: fonts.heading, fontSize: 20 }}>×</Text>
                      </Pressable>
                    ) : null}
                  </View>
                );
              })}
              {shown.length === 0 ? <Text style={[styles.muted, { paddingVertical: 8 }]}>Aucun résultat.</Text> : null}
            </ScrollView>
            {allowCustom ? (
              <View style={[styles.row, { marginTop: space.md }]}>
                <TextInput
                  value={custom}
                  onChangeText={setCustom}
                  placeholder={customKey ? 'Autre (sera retenu)…' : 'Autre…'}
                  placeholderTextColor={colors.textMuted}
                  onSubmitEditing={pickCustom}
                  returnKeyType="done"
                  style={[styles.input, { flex: 1 }]}
                />
                <Pressable
                  onPress={pickCustom}
                  disabled={!custom.trim()}
                  accessibilityRole="button"
                  style={{
                    backgroundColor: colors.accent,
                    borderRadius: 12,
                    paddingHorizontal: 16,
                    minHeight: 46,
                    justifyContent: 'center',
                    opacity: custom.trim() ? 1 : 0.4,
                  }}
                >
                  <Text style={{ color: colors.onAccent, fontFamily: fonts.display, fontSize: 18 }}>OK</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const rowStyle = {
  flexDirection: 'row' as const,
  alignItems: 'center' as const,
  minHeight: 50,
  paddingHorizontal: space.md,
  marginBottom: 6,
  borderRadius: 12,
  borderWidth: 1,
  borderColor: colors.border,
  backgroundColor: colors.surfaceAlt,
};
