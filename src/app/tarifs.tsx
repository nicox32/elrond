import { StyleSheet, Text, View } from 'react-native';

import { Card, Hint, Screen, SectionTitle } from '../components/ui';
import { FEE_TABLE, FEES } from '../logic/fees';
import { colors } from '../theme';

export default function FeesScreen() {
  return (
    <Screen testID="screen-tarifs">
      <Hint>Tous les tarifs d’Orvia. Les frais sont calculés sur le cours réel du métal au moment de l’opération.</Hint>

      {FEE_TABLE.map((section) => (
        <View key={section.title} style={{ gap: 10 }}>
          <SectionTitle>{section.title}</SectionTitle>
          <Card style={{ paddingVertical: 4 }}>
            {section.rows.map((row, i) => (
              <View key={row.label} style={[styles.row, i > 0 && styles.rowBorder]}>
                <Text style={styles.label}>{row.label}</Text>
                <Text style={styles.value}>{row.orvia}</Text>
              </View>
            ))}
          </Card>
        </View>
      ))}

      <SectionTitle>Frais d’oxydation, en détail</SectionTitle>
      <Card style={{ gap: 6 }}>
        <Text style={styles.para}>
          Un compte est considéré comme inactif s’il n’a connu aucun mouvement pendant plus de{' '}
          {FEES.dormancyAfterMonths} mois glissants (achat, vente, conversion, virement ou versement familial).
        </Text>
        <Text style={styles.para}>
          À partir de là, {(FEES.dormancyDaily * 100).toLocaleString('fr-FR')} % du solde est prélevé chaque jour, en
          métal, jusqu’au prochain mouvement. Les frais eux-mêmes ne comptent pas comme un mouvement.
        </Text>
        <Text style={styles.para}>
          La règle s’applique à chaque compte séparément, comptes enfants compris. L’appli te prévient un mois avant.
        </Text>
      </Card>

      <Hint>Compte de démonstration : aucun frais réel n’est prélevé.</Hint>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  rowBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  label: { color: colors.text, fontSize: 14, flex: 1, lineHeight: 19 },
  value: { color: colors.gold, fontSize: 14, fontWeight: '700', textAlign: 'right', maxWidth: '42%' },
  para: { color: colors.text, fontSize: 14, lineHeight: 20 },
});
