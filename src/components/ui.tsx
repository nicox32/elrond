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
});
