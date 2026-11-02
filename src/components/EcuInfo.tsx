import { Pressable, StyleSheet, Text, View } from 'react-native';

import { clampPremium, ECU } from '../logic/ecu';
import { formatEur, formatUnitPrice } from '../logic/format';
import { useAccount, useBank } from '../state/BankProvider';
import { colors } from '../theme';
import { Card, Hint, SectionTitle } from './ui';

const pct = (n: number) => `${(n * 100).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %`;
const STEP = 0.005;

/** Composition et prix de l'Écu Orvia, avec le réglage de la prime (démonstration, côté Orvia). */
export function EcuInfo() {
  const account = useAccount();
  const { quote, updateSettings } = useBank();
  const premium = clampPremium(account.settings.ecuPremium);
  const gold = quote.prices.gold * ECU.goldGrams;
  const setPremium = (p: number) => updateSettings({ ecuPremium: Math.round(clampPremium(p) * 1000) / 1000 });

  return (
    <>
      <SectionTitle>Qu’est-ce que le Gold Oriental ?</SectionTitle>
      <Card style={{ gap: 8 }}>
        <Text style={styles.para}>
          Un jeton d’investissement frappé pour Orvia : {ECU.goldGrams} g d’or fin {ECU.fineness}, conservé au coffre à
          votre nom. Vous pouvez en acheter une fraction, le revendre, l’envoyer ou le verser à vos enfants comme vos
          autres métaux.
        </Text>
        <SectionTitle>Son prix, en détail</SectionTitle>
        <Row label={`Or contenu (${ECU.goldGrams} g au cours du moment)`} value={formatEur(gold)} />
        <Row label={`Prime Orvia (${pct(premium)})`} value={`+ ${formatEur(gold * premium)}`} />
        <View style={styles.sep} />
        <Row label="Prix d’un jeton" value={formatUnitPrice(quote.prices.ecu, 'g', 'ecu')} strong />
        <Text style={styles.muted}>
          Le prix bouge tout seul avec le cours de l’or, en direct. La prime couvre la frappe et reflète la demande :
          vous la retrouvez à la revente.
        </Text>
      </Card>

      <SectionTitle>Faire varier la prime (démonstration)</SectionTitle>
      <Card style={{ gap: 10 }}>
        <Text style={styles.para}>
          Dans une vraie fintech, c’est Orvia qui fixe la prime selon la demande et ses coûts de frappe, entre{' '}
          {pct(ECU.minPremium)} et {pct(ECU.maxPremium)}. Ici, vous pouvez la régler pour voir l’effet sur le prix.
        </Text>
        <View style={styles.stepper}>
          <Pressable
            onPress={() => setPremium(premium - STEP)}
            style={styles.step}
            accessibilityRole="button"
            accessibilityLabel="Baisser la prime"
          >
            <Text style={styles.stepText}>− 0,5</Text>
          </Pressable>
          <Text style={styles.premium}>{pct(premium)}</Text>
          <Pressable
            onPress={() => setPremium(premium + STEP)}
            style={styles.step}
            accessibilityRole="button"
            accessibilityLabel="Monter la prime"
          >
            <Text style={styles.stepText}>+ 0,5</Text>
          </Pressable>
        </View>
        {premium !== ECU.defaultPremium && (
          <Pressable onPress={() => setPremium(ECU.defaultPremium)} accessibilityRole="button">
            <Text style={styles.link}>Revenir à la prime par défaut ({pct(ECU.defaultPremium)})</Text>
          </Pressable>
        )}
        <Hint>
          La prime compte à l’achat comme à la revente : si elle baisse après votre achat, votre jeton perd un peu de
          valeur même si l’or ne bouge pas ; si elle monte, il en gagne.
        </Hint>
      </Card>

      <Hint>
        Fiscalité des jetons : aucun impôt pour une vente jusqu’à 5 000 € ; au-delà, 6,5 % du prix de vente (6 % + 0,5 %
        de CRDS), ou le régime des plus-values s’il coûte moins cher.
      </Hint>
    </>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={[styles.label, strong && styles.bold]}>{label}</Text>
      <Text style={[styles.value, strong && styles.bold]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  para: { color: colors.text, fontSize: 13, lineHeight: 19 },
  muted: { color: colors.textMuted, fontSize: 12, lineHeight: 17 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  label: { color: colors.textMuted, fontSize: 13, flexShrink: 1 },
  value: { color: colors.text, fontSize: 14, fontVariant: ['tabular-nums'] },
  bold: { color: colors.text, fontWeight: '700' },
  sep: { height: 1, backgroundColor: colors.border },
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16 },
  step: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  stepText: { color: colors.gold, fontSize: 15, fontWeight: '700' },
  premium: { color: colors.text, fontSize: 22, fontWeight: '800', minWidth: 80, textAlign: 'center' },
  link: { color: colors.gold, fontSize: 13, fontWeight: '600', textAlign: 'center' },
});
