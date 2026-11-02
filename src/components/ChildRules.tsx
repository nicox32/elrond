import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme';

/** Les règles d'un compte enfant, affichées partout où on le gère. */
export function ChildRules({ name, compact }: { name: string; compact?: boolean }) {
  const rules = [
    `L’argent versé appartient à ${name} : c’est un don, tu ne peux pas le reprendre pour toi.`,
    `Un retrait n’est possible que pour une dépense faite pour ${name} (études, santé, équipement…), avec l’accord des deux parents si vous exercez ensemble l’autorité parentale.`,
    'Un versement fait par erreur peut être annulé seul, dans les 24 h.',
    `Aucun frais avant ses 18 ans. À sa majorité, le compte devient celui de ${name} et lui est transféré.`,
  ];
  const extra = [
    'Dons à un enfant : jusqu’à 100 000 € par parent sans droits, tous les 15 ans (formulaire 2735 pour déclarer un don).',
  ];
  return (
    <View style={styles.box}>
      <Text style={styles.title}>Les règles de ce compte</Text>
      {[...rules, ...(compact ? [] : extra)].map((r) => (
        <View key={r} style={styles.row}>
          <Text style={styles.dot} aria-hidden>
            •
          </Text>
          <Text style={styles.text}>{r}</Text>
        </View>
      ))}
      {!compact && (
        <Text style={styles.note}>
          Règles inspirées du droit français (administration légale, Code civil art. 382 et suivants). Compte de
          démonstration : à faire valider par un juriste avant un vrai lancement.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 8,
  },
  title: { color: colors.text, fontSize: 15, fontWeight: '700' },
  row: { flexDirection: 'row', gap: 8 },
  dot: { color: colors.gold, fontSize: 14, lineHeight: 19 },
  text: { color: colors.text, fontSize: 13, lineHeight: 19, flex: 1 },
  note: { color: colors.textMuted, fontSize: 11, lineHeight: 16, marginTop: 2 },
});
