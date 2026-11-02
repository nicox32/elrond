import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { Button, Card, Screen, SectionTitle } from '../components/ui';
import { formatEur } from '../logic/format';
import { TROY_OUNCE } from '../logic/ledger';
import { useBank } from '../state/BankProvider';
import { colors } from '../theme';

export default function FractionalGoldScreen() {
  const { quote } = useBank();
  const kilo = quote.prices.gold * 1000;
  const ounce = quote.prices.gold * TROY_OUNCE;

  return (
    <Screen testID="screen-or-fractionne">
      <Text style={styles.title}>L’or fractionné, c’est quoi ?</Text>
      <Text style={styles.lead}>
        Acheter de l’or physique a longtemps été compliqué et réservé aux gros patrimoines. L’or fractionné change cela
        : vous achetez la quantité que vous voulez, dès 1 €, et le métal est conservé pour vous, en toute sécurité.
      </Text>

      <SectionTitle>Avant : un parcours du combattant</SectionTitle>
      <Card style={{ gap: 8 }}>
        <Obstacle title="Lingot entier hors de portée">
          Un lingot d’1 kg vaut aujourd’hui environ {formatEur(kilo)}.
        </Obstacle>
        <Obstacle title="Pièces chères">Une once d’or coûte déjà plus de {formatEur(ounce)}, prime en plus.</Obstacle>
        <Obstacle title="Coffre à louer">
          Il faut un coffre à la banque ou chez soi, avec ses frais et ses risques.
        </Obstacle>
        <Obstacle title="Assurance à souscrire">Et une assurance pour couvrir le vol ou la perte.</Obstacle>
      </Card>

      <SectionTitle>Avec Orvia : l’or à portée de main</SectionTitle>
      <Card style={{ gap: 8 }}>
        <Benefit title="Dès 1 €">
          Achetez au gramme près, ou en euros : vous détenez exactement la part d’or, d’argent ou de platine payée.
        </Benefit>
        <Benefit title="Aucun stockage à gérer">
          Orvia garde le métal pour vous : ni coffre à louer, ni transport.
        </Benefit>
        <Benefit title="Assuré et audité">
          Les stocks sont assurés et contrôlés régulièrement par un auditeur indépendant : chaque gramme inscrit sur les
          comptes existe dans le coffre.
        </Benefit>
        <Benefit title="Disponible à tout moment">
          Revendez, convertissez, envoyez à un proche ou payez par carte, au cours du moment.
        </Benefit>
      </Card>

      <SectionTitle>Où est votre métal ?</SectionTitle>
      <Card style={{ gap: 8 }}>
        <Text style={styles.para}>
          Tous les métaux (Gold Spot, Gold Oria, argent et platine) sont gardés par Orvia dans un{' '}
          <Text style={styles.bold}>coffre-fort situé en port franc</Text>, une zone sous douane très sécurisée.
        </Text>
        <Text style={styles.para}>
          <Text style={styles.bold}>Le métal vous appartient.</Text> Orvia en est seulement le gardien : votre or est
          inscrit à votre nom, séparé des biens d’Orvia. Même si Orvia cessait son activité, il resterait à vous et vous
          serait rendu ou revendu pour votre compte.
        </Text>
        <Text style={styles.para}>
          Le port franc a un autre avantage : tant qu’ils y restent, l’argent et le platine ne supportent pas de TVA à
          l’achat (l’or d’investissement en est exonéré dans tous les cas).
        </Text>
      </Card>

      <Button
        title="Acheter de l’or"
        onPress={() => router.push({ pathname: '/operations', params: { mode: 'buy', t: Date.now() } })}
      />
    </Screen>
  );
}

function Obstacle({ title, children }: { title: string; children: React.ReactNode }) {
  return <Item mark="✕" color={colors.down} title={title} text={children} />;
}

function Benefit({ title, children }: { title: string; children: React.ReactNode }) {
  return <Item mark="✓" color={colors.up} title={title} text={children} />;
}

function Item({ mark, color, title, text }: { mark: string; color: string; title: string; text: React.ReactNode }) {
  return (
    <View style={styles.item}>
      <Text style={[styles.mark, { color }]}>{mark}</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.itemTitle}>{title}</Text>
        <Text style={styles.para}>{text}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.text, fontSize: 24, fontWeight: '800' },
  lead: { color: colors.text, fontSize: 15, lineHeight: 22 },
  para: { color: colors.text, fontSize: 13, lineHeight: 19 },
  bold: { fontWeight: '700' },
  item: { flexDirection: 'row', gap: 10 },
  mark: { fontSize: 15, fontWeight: '800', width: 16, textAlign: 'center', lineHeight: 20 },
  itemTitle: { color: colors.text, fontSize: 14, fontWeight: '700' },
});
