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
          Un compte laissé inactif pendant {FEES.dormancyAfterMonths} mois calendaires subit des frais de gestion de{' '}
          {(FEES.dormancyDaily * 100).toLocaleString('fr-FR')} % par jour, appliqués pour ces {FEES.dormancyAfterMonths}{' '}
          mois inactifs (environ {(Math.round(FEES.dormancyDaily * 182 * 1000) / 10).toLocaleString('fr-FR')} % du
          solde), prélevés en métal.
        </Text>
        <Text style={styles.para}>
          Pour éviter ces frais, il suffit de réaliser une opération à partir d’un euro : achat, vente, conversion,
          virement ou versement sur un compte enfant. Les frais eux-mêmes ne comptent pas comme une opération.
        </Text>
        <Text style={styles.para}>
          Si l’inactivité continue, chaque nouvelle période de {FEES.dormancyAfterMonths} mois est facturée de la même
          façon. La règle s’applique à chaque compte séparément, comptes enfants compris. L’appli te prévient un mois
          avant.
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
