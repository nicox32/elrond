import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, type TextInputProps, View, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, fonts, space } from '../theme';

/** Liseré à carreaux (clin d'œil au pavillon de chasse) en haut des onglets. */
export function PlaidStrip() {
  return (
    <View style={styles.plaid} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {Array.from({ length: 80 }, (_, i) => (
        <View key={i} style={{ width: 6, height: 6, backgroundColor: i % 2 ? colors.background : colors.plaid }} />
      ))}
    </View>
  );
}

/** Réticule de lunette dessiné en vues (sans dépendance SVG). */
export function Reticle({ size = 48, color = colors.accent }: { size?: number; color?: string }) {
  const r = size * 0.36;
  const line = Math.max(2, Math.round(size / 24));
  const arm = (size - r * 2) / 2 + r * 0.45;
  return (
    <View style={{ width: size, height: size }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View
        style={{
          position: 'absolute',
          left: size / 2 - r,
          top: size / 2 - r,
          width: r * 2,
          height: r * 2,
          borderRadius: r,
          borderWidth: line,
          borderColor: color,
        }}
      />
      <View style={{ position: 'absolute', left: size / 2 - line / 2, top: 0, width: line, height: arm, backgroundColor: color }} />
      <View style={{ position: 'absolute', left: size / 2 - line / 2, bottom: 0, width: line, height: arm, backgroundColor: color }} />
      <View style={{ position: 'absolute', top: size / 2 - line / 2, left: 0, height: line, width: arm, backgroundColor: color }} />
      <View style={{ position: 'absolute', top: size / 2 - line / 2, right: 0, height: line, width: arm, backgroundColor: color }} />
      <View
        style={{ position: 'absolute', left: size / 2 - line * 1.2, top: size / 2 - line * 1.2, width: line * 2.4, height: line * 2.4, borderRadius: line * 1.2, backgroundColor: color }}
      />
    </View>
  );
}

/** Écran défilant avec marges et fond. `top` : marge de la barre d'état (onglets). */
export function Screen({ children, top = true }: { children: ReactNode; top?: boolean }) {
  return (
    <SafeAreaView style={styles.screen} edges={top ? ['top'] : []}>
      {top ? <PlaidStrip /> : null}
      <ScrollView contentContainerStyle={styles.screenContent} keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function Eyebrow({ children, color = colors.textMuted }: { children: ReactNode; color?: string }) {
  return <Text style={[styles.eyebrow, { color }]}>{children}</Text>;
}

export function Title({ children, subtitle }: { children: ReactNode; subtitle?: string }) {
  return (
    <View style={{ marginBottom: space.sm }}>
      <Text style={styles.title}>{children}</Text>
      {subtitle ? <Text style={styles.muted}>{subtitle}</Text> : null}
    </View>
  );
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <View style={styles.sectionRow}>
      <Text style={styles.section}>{children}</Text>
      {right}
    </View>
  );
}

export function Card({ children, style, onPress }: { children: ReactNode; style?: ViewStyle; onPress?: () => void }) {
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.card, style, pressed && { backgroundColor: colors.surfaceAlt }]}
      >
        {children}
      </Pressable>
    );
  }
  return <View style={[styles.card, style]}>{children}</View>;
}

/** Cadre doré double (salle des trophées). */
export function TrophyFrame({ children, onPress }: { children: ReactNode; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={styles.trophyOuter}>
      <View style={styles.trophyInner}>{children}</View>
    </Pressable>
  );
}

/** Section repliable du formulaire : titre, résumé de ce qui est rempli, contenu. */
export function Fold({
  title,
  summary,
  open,
  onToggle,
  children,
}: {
  title: string;
  summary?: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <View style={[styles.card, { padding: 0, marginTop: space.sm }]}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.md, minHeight: 52 }}
      >
        <View style={{ flex: 1 }}>
          <Text style={[styles.section, { fontSize: 19 }]}>{title}</Text>
          {summary ? (
            <Text style={styles.muted} numberOfLines={1}>
              {summary}
            </Text>
          ) : null}
        </View>
        <Text style={{ color: colors.accent, fontFamily: fonts.heading, fontSize: 22 }}>{open ? '−' : '+'}</Text>
      </Pressable>
      {open ? <View style={{ paddingHorizontal: space.md, paddingBottom: space.md }}>{children}</View> : null}
    </View>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  tone = 'accent',
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  tone?: 'accent' | 'olive' | 'danger';
}) {
  const tint = tone === 'olive' ? colors.olive : tone === 'danger' ? colors.danger : colors.accent;
  const soft = tone === 'olive' ? colors.oliveSoft : tone === 'danger' ? colors.dangerSoft : colors.accentSoft;
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityState={onPress ? { selected: !!selected } : undefined}
      style={[styles.chip, selected && { borderColor: tint, backgroundColor: soft }]}
    >
      <Text style={[styles.chipText, selected && { color: tint }]}>{label}</Text>
    </Pressable>
  );
}

export function ChipRow({ children }: { children: ReactNode }) {
  return <View style={styles.chipRow}>{children}</View>;
}

export function Button({
  label,
  onPress,
  kind = 'primary',
  disabled,
}: {
  label: string;
  onPress: () => void;
  kind?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
}) {
  const bg = kind === 'primary' ? colors.accent : kind === 'danger' ? colors.dangerSoft : colors.surfaceAlt;
  const fg = kind === 'primary' ? colors.onAccent : kind === 'danger' ? colors.danger : colors.text;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, opacity: disabled ? 0.45 : pressed ? 0.8 : 1 },
        kind !== 'primary' && { borderWidth: 1, borderColor: colors.border },
      ]}
    >
      <Text style={[kind === 'primary' ? styles.buttonTextPrimary : styles.buttonText, { color: fg }]}>
        {kind === 'primary' ? label.toUpperCase() : label}
      </Text>
    </Pressable>
  );
}

export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return (
    <View style={{ flex: 1, minWidth: 120 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput placeholderTextColor={colors.textMuted} {...props} style={[styles.input, props.style]} />
    </View>
  );
}

export function Label({ children }: { children: ReactNode }) {
  return <Text style={styles.label}>{children}</Text>;
}

/** Une case de l'affichage « lunette » : petit libellé en capitales, grand chiffre. */
export function Stat({ value, label, divider }: { value: string; label: string; divider?: boolean }) {
  return (
    <View style={[styles.stat, divider && { borderLeftWidth: 1, borderLeftColor: colors.border }]}>
      <Text style={styles.statLabel}>{label.toUpperCase()}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

export function StatRow({ children }: { children: ReactNode }) {
  return <View style={styles.statRow}>{children}</View>;
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <Card style={{ alignItems: 'center', paddingVertical: space.xl }}>
      <Text style={[styles.muted, { textAlign: 'center' }]}>{children}</Text>
    </Card>
  );
}

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  screenContent: { padding: space.lg, paddingTop: 20, paddingBottom: 48, gap: space.sm, maxWidth: 720, width: '100%', alignSelf: 'center' },
  plaid: { height: 6, flexDirection: 'row', overflow: 'hidden', backgroundColor: colors.plaid },
  eyebrow: { fontFamily: fonts.semibold, fontSize: 12, letterSpacing: 2.2, textTransform: 'uppercase' },
  title: { color: colors.text, fontFamily: fonts.display, fontSize: 34, letterSpacing: 0.8, textTransform: 'uppercase', lineHeight: 38 },
  display: { color: colors.accent, fontFamily: fonts.display, fontSize: 46, letterSpacing: 1, lineHeight: 48 },
  section: { color: colors.text, fontFamily: fonts.heading, fontSize: 21, letterSpacing: 0.8, textTransform: 'uppercase' },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space.lg, marginBottom: space.xs },
  text: { color: colors.text, fontSize: 15, fontFamily: fonts.body, lineHeight: 21 },
  strong: { color: colors.text, fontSize: 16, fontFamily: fonts.semibold },
  muted: { color: colors.textMuted, fontSize: 13, fontFamily: fonts.body, lineHeight: 18 },
  score: { color: colors.gold, fontFamily: fonts.heading, fontSize: 22 },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 14,
    padding: space.md,
  },
  trophyOuter: { borderWidth: 1, borderColor: colors.gold, borderRadius: 16, padding: 3 },
  trophyInner: { borderWidth: 1, borderColor: colors.goldFrame, borderRadius: 13, backgroundColor: colors.trophyBg, padding: 14 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: {
    paddingHorizontal: space.md,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipText: { color: colors.textMuted, fontSize: 14, fontFamily: fonts.semibold },
  button: { borderRadius: 14, minHeight: 50, paddingVertical: 12, paddingHorizontal: space.lg, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontSize: 16, fontFamily: fonts.semibold },
  buttonTextPrimary: { fontSize: 20, fontFamily: fonts.display, letterSpacing: 1.4 },
  label: { color: colors.textMuted, fontSize: 12, fontFamily: fonts.semibold, letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: space.xs, marginTop: space.md },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    color: colors.text,
    fontSize: 16,
    fontFamily: fonts.body,
    paddingHorizontal: space.md,
    paddingVertical: 10,
  },
  statRow: { flexDirection: 'row', borderWidth: 1, borderColor: colors.border, borderRadius: 14, backgroundColor: colors.hud },
  stat: { flex: 1, paddingVertical: 10, paddingHorizontal: 12, gap: 2 },
  statValue: { color: colors.text, fontFamily: fonts.heading, fontSize: 26 },
  statLabel: { color: colors.textMuted, fontSize: 11, fontFamily: fonts.semibold, letterSpacing: 1.4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
});
