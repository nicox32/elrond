import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PriceStatus } from '../components/PriceStatus';
import { Card, Hint, Label, Screen, SectionTitle } from '../components/ui';
import { formatEur, formatPercent, formatWeight } from '../logic/format';
import { METAL_LABEL } from '../logic/ledger';
import { estimateTax, GAIN_RATE, type MetalTax, TAX, type TaxOutlook, taxOutlook } from '../logic/tax';
import type { ChildAccount, Prices } from '../logic/types';
import { useAccount, useBank } from '../state/BankProvider';
import { colors, metalColor } from '../theme';

const rate = (n: number) => `${(n * 100).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %`;
const signed = (n: number) => `${n >= 0 ? '+' : '−'}${formatEur(Math.abs(n))}`;
const tone = (n: number) => ({ color: n >= 0 ? colors.up : colors.down });

const OPERATIONS = [
  {
    title: 'Vente de métal',
    taxed: true,
    text: 'C’est une cession : l’impôt est calculé et retenu automatiquement, au régime le moins cher, dès le premier euro. En euros, vous saisissez le montant reçu après impôt.',
  },
  {
    title: 'Virement vers un compte bancaire (IBAN)',
    taxed: true,
    text: 'Le métal est vendu pour envoyer des euros : même règle qu’une vente, même pour un petit montant. Il n’existe pas de franchise pour l’or, l’argent et le platine.',
  },
  {
    title: 'Paiement ou retrait par carte',
    taxed: true,
    text: 'Chaque paiement vend du métal : c’est une cession. Orvia vend un peu plus de métal pour couvrir l’impôt, le commerçant reçoit le montant exact.',
  },
  {
    title: 'Conversion entre métaux',
    taxed: true,
    text: 'Échanger un métal contre un autre est une vente du premier : l’impôt est retenu avant le rachat et réduit le métal reçu.',
  },
  {
    title: 'Virement de métal à un membre',
    taxed: false,
    text: 'Le métal change de main sans être vendu : pas d’impôt sur la plus-value. Si c’est un cadeau, c’est un don : petit cadeau d’anniversaire ou de fêtes (présent d’usage, raisonnable par rapport à vos revenus) sans formalité ; sinon droits de donation après abattement (100 000 € par parent et par enfant, 31 865 € par grand-parent et petit-enfant, 15 932 € entre frères et sœurs, 7 967 € pour un neveu ou une nièce, tous les 15 ans ; aucun abattement entre personnes non parentes) et déclaration du don (formulaire 2735 ou en ligne). S’il paie un achat entre particuliers, c’est une cession imposable à déclarer vous-même.',
  },
  {
    title: 'Versement sur un compte enfant',
    taxed: false,
    text: 'C’est un don à votre enfant : pas d’impôt sur la plus-value, abattement de 100 000 € par parent tous les 15 ans. Au-delà d’un présent d’usage, déclarez le don (formulaire 2735 ou en ligne).',
  },
];

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
        revente déduits, puis après l’impôt prévu par la loi française.
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
            <MetalCard key={m.metal} m={m} unit={unit} outlook={taxOutlook(account, quote.prices, m.metal)} />
          ))}
        </>
      )}

      {account.children.length > 0 && (
        <>
          <SectionTitle>Comptes enfants</SectionTitle>
          {account.children.map((c) => (
            <ChildTax key={c.id} child={c} prices={quote.prices} unit={unit} />
          ))}
          <Hint>
            Le métal versé à un enfant est un don : son prix de revient est sa valeur le jour du versement, et sa durée
            de détention part de cette date. S’il est vendu, l’impôt suit les mêmes règles, au nom du foyer fiscal
            auquel l’enfant est rattaché (le vôtre tant qu’il est mineur). Un retrait pour une dépense faite pour lui
            n’est pas une vente : le métal revient sur votre compte, sans impôt.
          </Hint>
        </>
      )}

      <SectionTitle>Selon l’opération</SectionTitle>
      <Card style={{ paddingVertical: 4 }}>
        {OPERATIONS.map((o, i) => (
          <View key={o.title} style={[styles.op, i > 0 && styles.opBorder]}>
            <View style={styles.rowBetween}>
              <Text style={[styles.para, styles.bold, { flex: 1 }]}>{o.title}</Text>
              <Text style={[styles.badge, o.taxed ? styles.badgeTaxed : styles.badgeFree]}>
                {o.taxed ? 'impôt retenu' : 'pas une vente'}
              </Text>
            </View>
            <Text style={styles.muted}>{o.text}</Text>
          </View>
        ))}
      </Card>

      <SectionTitle>Les règles en France (2026)</SectionTitle>
      <Card style={{ gap: 8 }}>
        <Text style={styles.para}>
          À chaque vente d’or, d’argent ou de platine d’investissement, vous choisissez entre deux régimes. Orvia
          calcule les deux à chaque opération et retient automatiquement celui qui vous coûte le moins.
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
          Pas de seuil d’exonération pour l’or, l’argent et le platine : celui de 5 000 € concerne les bijoux et objets
          d’art ou de collection.
        </Bullet>
        <Bullet>
          <Text style={styles.bold}>Orvia s’occupe de tout :</Text> à chaque vente, elle calcule l’impôt, le retient sur
          le montant versé, remplit la déclaration (formulaire 2091-SD pour la taxe forfaitaire, 2048-M pour la
          plus-value) et le reverse aux impôts. Vous n’avez rien à déclarer pour ces ventes.
        </Bullet>
        <Bullet>
          Sont concernés l’or, l’argent et le platine (lingots, barres, pièces frappées après 1800). Le palladium n’en
          fait pas partie. Un don ou une succession n’est pas une vente : pas de taxe forfaitaire, mais les règles des
          donations.
        </Bullet>
      </Card>
    </Screen>
  );
}

function ChildTax({ child, prices, unit }: { child: ChildAccount; prices: Prices; unit: 'g' | 'oz' }) {
  const [open, setOpen] = useState(false);
  const est = estimateTax(child, prices);
  if (est.metals.length === 0) {
    return (
      <Card>
        <Text style={[styles.para, styles.bold]}>{child.name}</Text>
        <Text style={styles.muted}>Aucun métal sur ce compte pour l’instant.</Text>
      </Card>
    );
  }
  return (
    <Card style={{ gap: 8 }}>
      <View style={styles.rowBetween}>
        <Text style={[styles.metal, { color: colors.text }]}>{child.name}</Text>
        <Text style={styles.muted}>{child.transferredAt ? 'compte transféré' : formatEur(est.value)}</Text>
      </View>
      <Row label="Prix de revient (valeur des dons)" value={formatEur(est.cost)} />
      <Row
        label="Plus-value latente"
        value={`${signed(est.gain)} · ${formatPercent(est.gainPercent)}`}
        valueStyle={tone(est.gain)}
        strong
      />
      <Row label="Impôt si tout était vendu" value={`− ${formatEur(est.tax)}`} />
      <Row
        label="Après impôt"
        value={`${signed(est.netGain)} · ${formatPercent(est.netGainPercent)}`}
        valueStyle={tone(est.netGain)}
        strong
      />
      <Pressable onPress={() => setOpen((o) => !o)} accessibilityRole="button">
        <Text style={styles.link}>{open ? 'Masquer le détail par métal' : 'Voir le détail par métal'}</Text>
      </Pressable>
      {open &&
        est.metals.map((m) => (
          <View key={m.metal} style={styles.childMetal}>
            <MetalCard m={m} unit={unit} outlook={taxOutlook(child, prices, m.metal)} />
          </View>
        ))}
    </Card>
  );
}

function MetalCard({ m, unit, outlook }: { m: MetalTax; unit: 'g' | 'oz'; outlook: TaxOutlook | null }) {
  return (
    <Card style={{ gap: 8 }}>
      <View style={styles.rowBetween}>
        <Text style={[styles.metal, { color: metalColor[m.metal] }]}>{METAL_LABEL[m.metal]}</Text>
        <Text style={styles.muted}>{formatWeight(m.grams, unit, m.metal)}</Text>
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
      {outlook && <Outlook o={outlook} />}
    </Card>
  );
}

const monthYear = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
const year = (iso: string) => new Date(iso).getFullYear();

/** Ce que coûterait la vente si vous attendez, à cours constant. */
function Outlook({ o }: { o: TaxOutlook }) {
  if (!o.exemptAt) {
    return (
      <Text style={styles.muted}>
        {o.points.length === 0 && o.today.tax > 0
          ? 'Sans justificatif d’achat pour tout ce métal, seule la taxe forfaitaire s’applique : attendre ne change rien.'
          : 'Ce métal est déjà exonéré : aucun impôt à la vente.'}
      </Text>
    );
  }
  const saving = o.today.tax;
  return (
    <View style={styles.outlook}>
      <Text style={[styles.para, styles.bold]}>Si vous attendez (à cours constant)</Text>
      <View style={styles.timeline}>
        <Step label="Aujourd’hui" tax={o.today.tax} />
        {o.points.map((p) => (
          <Step key={p.date} label={String(year(p.date))} tax={p.tax} />
        ))}
      </View>
      {o.gainRegimeFrom && (
        <Text style={styles.muted}>
          Le régime des plus-values devient le moins cher dès {monthYear(o.gainRegimeFrom)}.
        </Text>
      )}
      <Text style={styles.para}>
        Exonéré en <Text style={styles.bold}>{monthYear(o.exemptAt)}</Text> : en attendant, vous économisez{' '}
        <Text style={[styles.bold, { color: colors.up }]}>{formatEur(saving)}</Text> d’impôt.
      </Text>
    </View>
  );
}

function Step({ label, tax }: { label: string; tax: number }) {
  return (
    <View style={styles.step}>
      <Text style={styles.muted}>{label}</Text>
      <Text style={[styles.stepTax, tax === 0 && { color: colors.up }]}>{tax === 0 ? '0 €' : formatEur(tax)}</Text>
    </View>
  );
}

function Regime({ title, amount, chosen }: { title: string; amount: number | null; chosen: boolean }) {
  return (
    <View style={[styles.regime, chosen && styles.regimeChosen]}>
      <Label>{title}</Label>
      <Text style={styles.regimeAmount}>{amount === null ? '—' : formatEur(amount)}</Text>
      <Text style={[styles.muted, chosen && { color: colors.gold }]}>
        {chosen ? '✓ le moins cher' : amount === null ? 'sans justificatif' : 'plus cher'}
      </Text>
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
  link: { color: colors.gold, fontSize: 13, fontWeight: '700' },
  childMetal: { marginHorizontal: -8 },
  outlook: { gap: 6, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10, marginTop: 2 },
  timeline: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  step: {
    flexGrow: 1,
    minWidth: 64,
    borderRadius: 10,
    backgroundColor: colors.surfaceAlt,
    paddingVertical: 6,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  stepTax: { color: colors.text, fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] },
  op: { paddingVertical: 12, gap: 4 },
  opBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  badge: {
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    overflow: 'hidden',
  },
  badgeTaxed: { color: colors.gold, backgroundColor: colors.goldSoft },
  badgeFree: { color: colors.up, backgroundColor: colors.surfaceAlt },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  label: { color: colors.textMuted, fontSize: 13, flexShrink: 1 },
  value: { color: colors.text, fontSize: 14, fontVariant: ['tabular-nums'], textAlign: 'right' },
  bold: { fontWeight: '700', color: colors.text },
  sep: { height: 1, backgroundColor: colors.border },
  metal: { fontSize: 16, fontWeight: '700' },
  muted: { color: colors.textMuted, fontSize: 12 },
  para: { color: colors.text, fontSize: 13, lineHeight: 19 },
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
