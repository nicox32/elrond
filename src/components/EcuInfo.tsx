import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AUTO_PREMIUM, currentPremium, ECU, ecuHistory } from '../logic/ecu';
import { FEES } from '../logic/fees';
import { GAIN_RATE, TAX } from '../logic/tax';
import { formatEur, formatUnitPrice, formatWeight } from '../logic/format';
import { useAccount, useBank } from '../state/BankProvider';
import { colors } from '../theme';
import { EcuChart } from './EcuChart';
import { Card, Hint, SectionTitle } from './ui';

const pct = (n: number) => `${(n * 100).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %`;
const pts = (n: number) =>
  `${n >= 0 ? '+' : '−'}${Math.abs(n * 100).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} pt`;

/** Composition et prix de l'Écu Orvia, avec le réglage de la prime (démonstration, côté Orvia). */
export function EcuInfo() {
  const account = useAccount();
  const { quote, hourlyHistory } = useBank();
  const parts = currentPremium(account, quote.prices.gold, hourlyHistory, new Date());
  const premium = parts.premium;
  const chart = useMemo(
    () => [
      ...ecuHistory(account, hourlyHistory),
      { t: quote.fetchedAt, gold: quote.prices.gold, ecu: quote.prices.ecu, premium },
    ],
    [account, hourlyHistory, quote, premium],
  );
  const gold = quote.prices.gold * ECU.goldGrams;

  return (
    <>
      <SectionTitle>Ce que représente le Gold Oria</SectionTitle>
      <Card style={{ gap: 8 }}>
        <Text style={styles.para}>
          Le Gold Oria est de l’<Text style={styles.bold}>or physique pur</Text>, au titre de {ECU.fineness} ‰, frappé
          en jetons pour Orvia et conservé dans son coffre. Vous l’achetez <Text style={styles.bold}>au gramme</Text> :
          chaque gramme acheté est 1 g d’or fin qui vous appartient, inscrit à votre nom.
        </Text>
        <Bullet>
          <Text style={styles.bold}>Gold Spot</Text> : de l’or au prix du marché, sans prime. Idéal pour épargner.
        </Bullet>
        <Bullet>
          <Text style={styles.bold}>Gold Oria</Text> : le même or, sous forme de jetons frappés. Il coûte un peu plus
          (la prime), mais sa vente est exonérée d’impôt jusqu’à 5 000 €.
        </Bullet>
        <Text style={styles.para}>
          Vous pouvez le revendre à tout moment, le convertir, l’envoyer à un membre, payer avec par carte ou le verser
          à vos enfants, comme vos autres métaux.
        </Text>
      </Card>

      <SectionTitle>Son prix, en détail</SectionTitle>
      <Card style={{ gap: 8 }}>
        <Row label="Or fin (1 g au cours du Gold Spot)" value={formatEur(gold)} />
        <Row label={`Prime Orvia (${pct(premium)})`} value={`+ ${formatEur(gold * premium)}`} />
        <View style={styles.sep} />
        <Row label="Prix d’un gramme de Gold Oria" value={formatUnitPrice(quote.prices.ecu, 'g')} strong />
        <Text style={styles.muted}>
          Le prix suit le cours de l’or en direct. La prime couvre la frappe et reflète la demande : vous la retrouvez à
          la revente. À l’achat s’ajoutent {pct(FEES.buy.ecu)} de frais, à la revente {pct(FEES.sale)}.
        </Text>
      </Card>

      <SectionTitle>Sa fiscalité</SectionTitle>
      <Card style={{ gap: 8 }}>
        <Text style={styles.para}>
          Le Gold Oria relève du régime des jetons. L’impôt est calculé et retenu automatiquement à chaque vente :
        </Text>
        <Bullet>
          <Text style={styles.bold}>Vente jusqu’à {formatEur(TAX.tokenExemptUpTo)}</Text> : aucun impôt.
        </Bullet>
        <Bullet>
          <Text style={styles.bold}>Au-delà</Text> : {pct(TAX.tokenFlat)} du prix de vente (6 % + 0,5 % de CRDS), ou le
          régime des plus-values s’il coûte moins cher : {pct(GAIN_RATE)} de la plus-value, réduite de 5 % par année de
          détention à partir de la 3e, exonération totale après 22 ans.
        </Bullet>
        <Bullet>
          Le seuil s’apprécie à chaque vente. Une conversion, un paiement par carte ou un virement vers une banque sont
          aussi des ventes ; un envoi à un membre ou un versement à un enfant n’en sont pas (règles des dons).
        </Bullet>
        <Text style={[styles.para, styles.bold]}>Impôt selon le montant vendu, comparé au Gold Spot</Text>
        <View style={styles.table}>
          <View style={styles.tr}>
            <Text style={[styles.th, { flex: 1.2 }]}>Vente de</Text>
            <Text style={styles.th}>Gold Oria</Text>
            <Text style={styles.th}>Gold Spot</Text>
          </View>
          {[1000, 5000, 10000, 20000].map((v) => (
            <View key={v} style={styles.tr}>
              <Text style={[styles.td, { flex: 1.2 }]}>
                {formatEur(v)}
                {'\n'}
                <Text style={styles.muted}>≈ {formatWeight(v / (quote.prices.ecu * (1 - FEES.sale)), 'g')}</Text>
              </Text>
              <Text style={[styles.td, v <= TAX.tokenExemptUpTo && { color: colors.up }]}>
                {v <= TAX.tokenExemptUpTo ? '0 €' : formatEur(v * TAX.tokenFlat)}
              </Text>
              <Text style={styles.td}>{formatEur(v * TAX.flat)}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.muted}>
          Taux forfaitaires : {pct(TAX.tokenFlat)} au-delà de 5 000 € pour le Gold Oria, {pct(TAX.flat)} dès le premier
          euro pour le Gold Spot. Si le régime des plus-values coûte moins cher, c’est lui qui est appliqué.
        </Text>
      </Card>

      <SectionTitle>Comment bouge la prime</SectionTitle>
      <Card style={{ gap: 10 }}>
        <Text style={styles.para}>
          La prime évolue d’elle-même, entre {pct(AUTO_PREMIUM.min)} et {pct(AUTO_PREMIUM.max)}, comme sur un vrai
          marché :
        </Text>
        <Row label="Prime de base" value={pct(parts.base)} />
        <Row
          label="Cours de l’or face à sa moyenne 30 j"
          value={parts.market === null ? 'dans 7 jours' : pts(parts.market)}
        />
        <Text style={styles.muted}>
          Or sous sa moyenne : les investisseurs achètent, la prime monte. Or qui s’envole : elle baisse.
        </Text>
        <Row label="Demande des autres investisseurs" value={pts(parts.community)} />
        <Text style={styles.muted}>Une vague lente, de quelques jours à un mois.</Text>
        <Row label="Vos achats et ventes sur 7 jours" value={pts(parts.flow)} />
        <Text style={styles.muted}>Acheter pousse la prime vers le haut, vendre la fait redescendre.</Text>
        {parts.adjustment !== 0 && (
          <Row label="Ajustement Orvia (conditions de marché)" value={pts(parts.adjustment)} />
        )}
        <View style={styles.sep} />
        <Row label="Prime en ce moment" value={pct(parts.premium)} strong />
        <Hint>
          La prime compte à l’achat comme à la revente : si elle baisse après votre achat, votre Gold Oria perd un peu
          de valeur même si l’or ne bouge pas ; si elle monte, il en gagne.
        </Hint>
      </Card>

      <SectionTitle>Gold Oria face au Gold Spot</SectionTitle>
      <Card>
        <EcuChart points={chart} />
      </Card>
    </>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      <Text style={{ color: colors.gold, lineHeight: 19 }}>•</Text>
      <Text style={[styles.para, { flex: 1 }]}>{children}</Text>
    </View>
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
  table: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, overflow: 'hidden' },
  tr: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: colors.border, marginTop: -1 },
  th: { flex: 1, color: colors.textMuted, fontSize: 12, fontWeight: '700', padding: 8 },
  td: { flex: 1, color: colors.text, fontSize: 13, padding: 8, fontVariant: ['tabular-nums'] },
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
