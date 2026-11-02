import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Card, Hint, Screen, SectionTitle } from '../components/ui';
import { adjustmentAt, AUTO_PREMIUM, currentPremium, PREMIUM_SCENARIOS } from '../logic/ecu';
import { formatEur, formatUnitPrice } from '../logic/format';
import { useAccount, useBank } from '../state/BankProvider';
import { colors } from '../theme';

const pct = (n: number) => `${(n * 100).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} %`;
const pts = (n: number) =>
  `${n >= 0 ? '+' : '−'}${Math.abs(n * 100).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} pt`;
const STEP = 0.0025;

/** Espace Dev : réglages réservés à Orvia (démonstration), dont l'ajustement de la prime du Gold Oria. */
export default function DevScreen() {
  const account = useAccount();
  const { quote, hourlyHistory, updateSettings } = useBank();
  const now = new Date();
  const parts = currentPremium(account, quote.prices.gold, hourlyHistory, now);
  const offset = adjustmentAt(account, now);
  const history = account.settings.ecuPremiumAdjustments ?? [];

  const setOffset = (value: number, reason: string) => {
    const next = Math.round(Math.min(AUTO_PREMIUM.adjustMax, Math.max(AUTO_PREMIUM.adjustMin, value)) * 10000) / 10000;
    if (next === offset) return;
    updateSettings({
      ecuPremiumAdjustments: [...history, { at: new Date().toISOString(), offset: next, reason }].slice(-50),
    });
  };

  return (
    <Screen testID="screen-dev">
      <Hint>
        Espace réservé à Orvia (démonstration). Les clients ne choisissent pas la prime : c’est Orvia qui l’ajuste selon
        le marché. Chaque ajustement s’applique à partir de maintenant, sans modifier le passé.
      </Hint>

      <SectionTitle>Prime du Gold Oria</SectionTitle>
      <Card style={{ gap: 8 }}>
        <Row label="Marché simulé (base + or + demande + flux)" value={pct(parts.premium - parts.adjustment)} />
        <Row label="Ajustement Orvia" value={pts(parts.adjustment)} />
        <View style={styles.sep} />
        <Row label="Prime appliquée" value={pct(parts.premium)} strong />
        <Row label="Prix d’un gramme de Gold Oria" value={formatUnitPrice(quote.prices.ecu, 'g')} />
        <Text style={styles.muted}>
          Gold Spot : {formatUnitPrice(quote.prices.gold, 'g')} · écart{' '}
          {formatEur(quote.prices.ecu - quote.prices.gold)}
          /g · prime toujours entre {pct(AUTO_PREMIUM.min)} et {pct(AUTO_PREMIUM.max)}.
        </Text>

        <View style={styles.stepper}>
          <Pressable
            onPress={() => setOffset(offset - STEP, 'Baisse manuelle')}
            style={styles.step}
            accessibilityRole="button"
            accessibilityLabel="Baisser la prime"
          >
            <Text style={styles.stepText}>− 0,25 pt</Text>
          </Pressable>
          <Text style={styles.offset}>{pts(offset)}</Text>
          <Pressable
            onPress={() => setOffset(offset + STEP, 'Hausse manuelle')}
            style={styles.step}
            accessibilityRole="button"
            accessibilityLabel="Monter la prime"
          >
            <Text style={styles.stepText}>+ 0,25 pt</Text>
          </Pressable>
        </View>
        <Text style={styles.muted}>
          Ajustement possible de {pts(AUTO_PREMIUM.adjustMin)} à {pts(AUTO_PREMIUM.adjustMax)}.
        </Text>
      </Card>

      <SectionTitle>Scénarios de marché</SectionTitle>
      <Card style={{ gap: 10 }}>
        {PREMIUM_SCENARIOS.map((s) => {
          const active = Math.abs(offset - s.offset) < 1e-6;
          return (
            <Pressable
              key={s.id}
              onPress={() => setOffset(s.offset, `Scénario : ${s.label}`)}
              style={[styles.scenario, active && styles.scenarioActive]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <View style={styles.row}>
                <Text style={styles.bold}>{s.label}</Text>
                <Text style={[styles.bold, { color: colors.gold }]}>{pts(s.offset)}</Text>
              </View>
              <Text style={styles.muted}>{s.when}</Text>
            </Pressable>
          );
        })}
      </Card>

      <SectionTitle>Quand et comment la faire bouger</SectionTitle>
      <Card style={{ gap: 8 }}>
        <Text style={styles.para}>
          <Text style={styles.bold}>Repères réels.</Text> Sur l’or physique, la prime dépend de la taille : 0,5 à 1,5 %
          pour un lingot d’1 kg, 3 à 6 % pour une pièce d’une once, 8 à 15 % pour un petit lingot d’1 g. Un or
          fractionné stocké en coffre se situe autour de 4 à 5 % : c’est la base du Gold Oria.
        </Text>
        <Text style={styles.para}>
          <Text style={styles.bold}>Montez-la</Text> quand la demande dépasse ce que vous pouvez faire frapper : or en
          chute brutale (les clients achètent « en solde »), crise financière ou géopolitique, coûts de frappe ou
          d’assurance en hausse. En 2008 et en mars 2020, les primes des pièces ont doublé, voire triplé, en quelques
          jours.
        </Text>
        <Text style={styles.para}>
          <Text style={styles.bold}>Baissez-la</Text> quand les ventes l’emportent (or au plus haut, prises de
          bénéfices), quand le marché est calme ou pour une offre commerciale (attirer de nouveaux clients).
        </Text>
        <Text style={styles.para}>
          <Text style={styles.bold}>Rythme.</Text> Par petits paliers de 0,25 à 0,5 point, au plus une fois par semaine
          en temps normal ; plus vite seulement en crise. Revenez au scénario « Normal » quand la situation se calme :
          le marché simulé continue de faire varier la prime au jour le jour.
        </Text>
      </Card>

      {history.length > 0 && (
        <>
          <SectionTitle>Derniers ajustements</SectionTitle>
          <Card style={{ gap: 6 }}>
            {[...history]
              .reverse()
              .slice(0, 8)
              .map((a) => (
                <View key={a.at} style={styles.row}>
                  <Text style={styles.muted}>
                    {new Date(a.at).toLocaleString('fr-FR', {
                      day: '2-digit',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}{' '}
                    · {a.reason ?? 'Ajustement'}
                  </Text>
                  <Text style={styles.bold}>{pts(a.offset)}</Text>
                </View>
              ))}
          </Card>
        </>
      )}
    </Screen>
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
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  label: { color: colors.textMuted, fontSize: 13, flexShrink: 1 },
  value: { color: colors.text, fontSize: 14, fontVariant: ['tabular-nums'] },
  bold: { color: colors.text, fontWeight: '700', fontSize: 14 },
  para: { color: colors.text, fontSize: 13, lineHeight: 19 },
  muted: { color: colors.textMuted, fontSize: 12, lineHeight: 17, flexShrink: 1 },
  sep: { height: 1, backgroundColor: colors.border },
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14, marginTop: 4 },
  step: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  stepText: { color: colors.gold, fontSize: 14, fontWeight: '700' },
  offset: { color: colors.text, fontSize: 20, fontWeight: '800', minWidth: 90, textAlign: 'center' },
  scenario: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 10, gap: 4 },
  scenarioActive: { borderColor: colors.gold, backgroundColor: colors.goldSoft },
});
