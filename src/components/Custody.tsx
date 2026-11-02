import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme';

/** Rappel court : métal gardé par Orvia en port franc, mais propriété du client. Lien vers l'explication. */
export function CustodyNote() {
  return (
    <Pressable onPress={() => router.push('/or-fractionne')} style={styles.box} accessibilityRole="link">
      <Text style={styles.icon} aria-hidden>
        🔒
      </Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>Votre métal vous appartient</Text>
        <Text style={styles.text}>
          Gardé par Orvia en coffre-fort, en port franc, assuré et audité. Il est inscrit à votre nom et ne fait pas
          partie des biens d’Orvia.
        </Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 12,
  },
  icon: { fontSize: 18 },
  title: { color: colors.text, fontSize: 14, fontWeight: '700' },
  text: { color: colors.textMuted, fontSize: 12, lineHeight: 17, marginTop: 2 },
  chevron: { color: colors.textMuted, fontSize: 20 },
});
