import { StyleSheet, Text, View } from 'react-native';

import { PriceStatus } from '../components/PriceStatus';
import { Card, Hint, Label, Screen, SectionTitle } from '../components/ui';
import { formatEur, formatPercent, formatWeight } from '../logic/format';
import { METAL_LABEL } from '../logic/ledger';
import { estimateTax, GAIN_RATE, type MetalTax, TAX } from '../logic/tax';
import { useAccount, useBank } from '../state/BankProvider';
import { colors, metalColor } from '../theme';

const rate = (n: number) => `${(n * 100).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %`;
const signed = (n: number) => `${n >= 0 ? '+' : '−'}${formatEur(Math.abs(n))}`;
const tone = (n: number) => ({ color: n >= 0 ? colors.up : colors.down });

export default function TaxScreen() {
  const account = useAccount();
  const { quote } = useBank();
  const unit = account.settings.unit;
  const est = estimateTax(account, quote.prices);

  return (
    <Screen testID="screen-fiscalite">
      <PriceStatus />
      <Hint>
        Ce que rapporterait votre compte si vous vendiez tout votre métal aujourd’hui, au cours du moment, frais de
        revente déduits, puis après l’impôt prévu par la loi française. Estimation indicative.
      </Hint>

      {est.metals.length === 0 ? (
        <Card>
          <Text style={styles.para}>Aucun métal sur le compte pour l’instant.</Text>
        </Card>
      ) : (
        <>
          <Card style={{ gap: 10 }}>
            <Row label="Prix de revient (frais d’achat compris)" value={formatEur(est.cost)} />
            <Row label="Valeur de revente aujourd’hui" value={formatEur(est.value)} />
            <View style={styles.sep} />
            <Row
              label="Plus-value latente, avant impôt"
              value={`${signed(est.gain)} · ${formatPercent(est.gainPercent)}`}
              valueStyle={tone(est.gain)}
              strong
            />
            <Row label="Impôt estimé si vous vendiez tout" value={`− ${formatEur(est.tax)}`} />
            <View style={styles.sep} />
            <Row
              label="Plus-value nette, après impôt"
              value={`${signed(est.netGain)} · ${formatPercent(est.netGainPercent)}`}
              valueStyle={tone(est.netGain)}
              strong
            />
          </Card>

          <SectionTitle>Par métal</SectionTitle>
          {est.metals.map((m) => (
            <MetalCard key={m.metal} m={m} unit={unit} />
          ))}
        </>
      )}

      <SectionTitle>Les règles en France (2026)</SectionTitle>
      <Card style={{ gap: 8 }}>
        <Text style={styles.para}>
          À chaque vente d’or, d’argent ou de platine d’investissement, vous choisissez entre deux régimes. Orvia
          retient pour chaque métal celui qui vous coûte le moins.
        </Text>
        <Bullet>
          <Text style={styles.bold}>Taxe forfaitaire (par défaut) :</Text> {rate(TAX.flat)} du prix de vente (11 % + 0,5
          % de CRDS), que vous gagniez ou perdiez de l’argent.
        </Bullet>
        <Bullet>
          <Text style={styles.bold}>Régime des plus-values (sur option) :</Text> {rate(GAIN_RATE)} de la plus-value (
          {rate(TAX.incomeTax)} d’impôt + {rate(TAX.social)} de prélèvements sociaux). Abattement de 5 % par année de
          détention à partir de la 3e : exonération totale après {TAX.exemptAfterYears} ans. Aucun impôt en cas de
          perte.
        </Bullet>
        <Bullet>
          Le régime des plus-values demande de prouver la date et le prix d’achat : vos relevés Orvia servent de
          justificatif. Pour la durée de détention, le métal acheté en premier est considéré comme vendu en premier.
        </Bullet>
        <Bullet>
          Pas de seuil d’exonération pour les métaux d’investissement (celui de 5 000 € concerne les bijoux et objets
          d’art). La déclaration (formulaire 2092-SD ou 2048-M) et le paiement sont en général faits par le
          professionnel qui rachète le métal.
        </Bullet>
        <Text style={styles.note}>
          Code général des impôts, art. 150 VI à 150 VM ; prélèvements sociaux à 18,6 % depuis la loi de financement de
          la Sécurité sociale pour 2026. Estimation pour un particulier résidant en France, sans valeur de conseil
          fiscal : à faire confirmer par un conseiller avant une vente importante.
        </Text>
      </Card>
    </Screen>
  );
}

function MetalCard({ m, unit }: { m: MetalTax; unit: 'g' | 'oz' }) {
  return (
    <Card style={{ gap: 8 }}>
      <View style={styles.rowBetween}>
        <Text style={[styles.metal, { color: metalColor[m.metal] }]}>{METAL_LABEL[m.metal]}</Text>
        <Text style={styles.muted}>{formatWeight(m.grams, unit)}</Text>
      </View>
      <Row label="Prix de revient" value={formatEur(m.cost)} />
      <Row label="Valeur de revente" value={formatEur(m.value)} />
      <Row
        label="Plus-value latente"
        value={`${signed(m.gain)} · ${formatPercent(m.gainPercent)}`}
        valueStyle={tone(m.gain)}
        strong
      />
      <Text style={styles.muted}>
        Détention moyenne : {m.avgYears} an{m.avgYears > 1 ? 's' : ''}
        {m.allowance > 0 ? ` · abattement ${rate(m.allowance)}` : ' · pas encore d’abattement'}
      </Text>
      <View style={styles.regimes}>
        <Regime title="Taxe forfaitaire" amount={m.flatTax} chosen={m.best === 'flat'} />
        <Regime title="Régime des plus-values" amount={m.gainTax} chosen={m.best === 'gain'} />
      </View>
      <Row
        label="Plus-value nette après impôt"
        value={`${signed(m.netGain)} · ${formatPercent(m.netGainPercent)}`}
        valueStyle={tone(m.netGain)}
        strong
      />
    </Card>
  );
}

function Regime({ title, amount, chosen }: { title: string; amount: number; chosen: boolean }) {
  return (
    <View style={[styles.regime, chosen && styles.regimeChosen]}>
      <Label>{title}</Label>
      <Text style={styles.regimeAmount}>{formatEur(amount)}</Text>
      <Text style={[styles.muted, chosen && { color: colors.gold }]}>{chosen ? '✓ le moins cher' : 'plus cher'}</Text>
    </View>
  );
}

function Row({
  label,
  value,
  valueStyle,
  strong,
}: {
  label: string;
  value: string;
  valueStyle?: { color: string };
  strong?: boolean;
}) {
  return (
    <View style={styles.rowBetween}>
      <Text style={[styles.label, strong && styles.bold]}>{label}</Text>
      <Text style={[styles.value, strong && styles.bold, valueStyle]}>{value}</Text>
    </View>
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

const styles = StyleSheet.create({
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  label: { color: colors.textMuted, fontSize: 13, flexShrink: 1 },
  value: { color: colors.text, fontSize: 14, fontVariant: ['tabular-nums'], textAlign: 'right' },
  bold: { fontWeight: '700', color: colors.text },
  sep: { height: 1, backgroundColor: colors.border },
  metal: { fontSize: 16, fontWeight: '700' },
  muted: { color: colors.textMuted, fontSize: 12 },
  para: { color: colors.text, fontSize: 13, lineHeight: 19 },
  note: { color: colors.textMuted, fontSize: 11, lineHeight: 16 },
  regimes: { flexDirection: 'row', gap: 8 },
  regime: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 10,
    gap: 2,
    backgroundColor: colors.surfaceAlt,
  },
  regimeChosen: { borderColor: colors.gold },
  regimeAmount: { color: colors.text, fontSize: 16, fontWeight: '700', fontVariant: ['tabular-nums'] },
});
