import type { ReactNode } from 'react';
import {
  Pressable,
  ScrollView,
  type ScrollViewProps,
  StyleSheet,
  Text,
  type TextStyle,
  View,
  type ViewStyle,
} from 'react-native';

import { colors } from '../theme';

export function Screen({ children, ...props }: ScrollViewProps & { children: ReactNode }) {
  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.screen}
      keyboardShouldPersistTaps="handled"
      {...props}
    >
      {children}
    </ScrollView>
  );
}

export function Title({ children }: { children: ReactNode }) {
  return <Text style={styles.title}>{children}</Text>;
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <View style={styles.sectionRow}>
      <Text style={styles.section}>{children}</Text>
      {right}
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Label({ children }: { children: ReactNode }) {
  return <Text style={styles.label}>{children}</Text>;
}

export function Hint({ children, style }: { children: ReactNode; style?: TextStyle }) {
  return <Text style={[styles.hint, style]}>{children}</Text>;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'ghost' | 'danger';
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.button,
        variant === 'ghost' && styles.buttonGhost,
        variant === 'danger' && styles.buttonDanger,
        (pressed || disabled) && { opacity: disabled ? 0.4 : 0.8 },
      ]}
    >
      <Text
        style={[
          styles.buttonText,
          variant === 'ghost' && { color: colors.gold },
          variant === 'danger' && { color: colors.down },
        ]}
      >
        {title}
      </Text>
    </Pressable>
  );
}

/**
 * Ligne de liste (navigation ou information) : titre, sous-titre, valeur à droite, chevron si elle s'ouvre.
 * À placer dans une `Card` sans marge verticale (`style={{ paddingVertical: 4 }}`), `first` pour la première.
 */
export function ListRow({
  title,
  subtitle,
  right,
  left,
  onPress,
  first,
  testID,
  accessibilityHint,
}: {
  title: string;
  subtitle?: ReactNode;
  right?: ReactNode;
  left?: ReactNode;
  onPress?: () => void;
  first?: boolean;
  testID?: string;
  accessibilityHint?: string;
}) {
  const body = (
    <>
      {left}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.rowTitle}>{title}</Text>
        {subtitle ? <Text style={styles.rowSub}>{subtitle}</Text> : null}
      </View>
      {typeof right === 'string' ? <Text style={styles.rowRight}>{right}</Text> : right}
      {onPress ? <Text style={styles.chevron}>›</Text> : null}
    </>
  );
  return onPress ? (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, !first && styles.rowBorder, pressed && { opacity: 0.7 }]}
      accessibilityRole="link"
      accessibilityHint={accessibilityHint}
      testID={testID}
    >
      {body}
    </Pressable>
  ) : (
    <View style={[styles.row, !first && styles.rowBorder]} testID={testID}>
      {body}
    </View>
  );
}

/** Ligne « libellé … valeur », la même partout (cartes de chiffres, récapitulatifs). */
export function KeyValue({
  label,
  value,
  strong,
  tone,
}: {
  label: string;
  value: string;
  strong?: boolean;
  tone?: 'up' | 'down' | 'gold';
}) {
  const color = tone === 'up' ? colors.up : tone === 'down' ? colors.down : tone === 'gold' ? colors.gold : undefined;
  return (
    <View style={styles.kv}>
      <Text style={[styles.kvLabel, strong && styles.kvStrong]}>{label}</Text>
      <Text style={[styles.kvValue, strong && styles.kvStrong, color ? { color } : null]}>{value}</Text>
    </View>
  );
}

export function Divider() {
  return <View style={styles.divider} />;
}

type BannerTone = 'info' | 'gold' | 'success' | 'warning' | 'danger';
const BANNER: Record<BannerTone, { border: string; bg: string; title: string }> = {
  info: { border: colors.border, bg: colors.surface, title: colors.text },
  gold: { border: colors.gold, bg: colors.goldSoft, title: colors.gold },
  success: { border: colors.up, bg: 'rgba(52, 211, 153, 0.10)', title: colors.up },
  warning: { border: colors.warning, bg: 'rgba(251, 191, 36, 0.10)', title: colors.warning },
  danger: { border: colors.down, bg: 'rgba(248, 113, 113, 0.10)', title: colors.down },
};

/** Bandeau d'information, le même pour tous les messages (alerte, mise à jour, rappel, règle). */
export function Banner({
  tone = 'info',
  icon,
  title,
  children,
  onPress,
  testID,
}: {
  tone?: BannerTone;
  icon?: string;
  title?: string;
  children?: ReactNode;
  onPress?: () => void;
  testID?: string;
}) {
  const t = BANNER[tone];
  const body = (
    <>
      {icon ? <Text style={styles.bannerIcon}>{icon}</Text> : null}
      <View style={{ flex: 1, gap: 3 }}>
        {title ? <Text style={[styles.bannerTitle, { color: t.title }]}>{title}</Text> : null}
        {typeof children === 'string' ? <Text style={styles.bannerText}>{children}</Text> : children}
      </View>
      {onPress ? <Text style={styles.chevron}>›</Text> : null}
    </>
  );
  const style = [styles.banner, { borderColor: t.border, backgroundColor: t.bg }];
  return onPress ? (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [...style, pressed && { opacity: 0.8 }]}
      accessibilityRole="button"
      testID={testID}
    >
      {body}
    </Pressable>
  ) : (
    <View style={style} testID={testID}>
      {body}
    </View>
  );
}

export function Message({ ok, text }: { ok: boolean; text: string }) {
  return <Text style={[styles.message, { color: ok ? colors.up : colors.down }]}>{text}</Text>;
}

export const styles = StyleSheet.create({
  screen: { padding: 16, paddingBottom: 40, gap: 14 },
  title: { color: colors.text, fontSize: 26, fontWeight: '800' },
  section: { color: colors.text, fontSize: 17, fontWeight: '700' },
  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 8,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  label: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  hint: { color: colors.textMuted, fontSize: 12, lineHeight: 17 },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.text,
    fontSize: 16,
  },
  button: {
    backgroundColor: colors.gold,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
  },
  buttonGhost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.gold },
  buttonDanger: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.down },
  buttonText: { color: colors.background, fontSize: 16, fontWeight: '800' },
  message: { textAlign: 'center', fontSize: 14, fontWeight: '600' },
  link: { color: colors.gold, fontSize: 13, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13 },
  rowBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  rowTitle: { color: colors.text, fontSize: 15, fontWeight: '600' },
  rowSub: { color: colors.textMuted, fontSize: 12.5, lineHeight: 17, marginTop: 2 },
  rowRight: { color: colors.text, fontSize: 14, fontWeight: '700', fontVariant: ['tabular-nums'] },
  chevron: { color: colors.textMuted, fontSize: 22, marginLeft: 2 },
  kv: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 },
  kvLabel: { color: colors.textMuted, fontSize: 14, flex: 1 },
  kvValue: { color: colors.text, fontSize: 14, fontWeight: '600', fontVariant: ['tabular-nums'], textAlign: 'right' },
  kvStrong: { color: colors.text, fontWeight: '800' },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 2 },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 14, padding: 14 },
  bannerIcon: { fontSize: 20 },
  bannerTitle: { fontSize: 14.5, fontWeight: '800' },
  bannerText: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
});
