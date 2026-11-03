import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { MetalPicker } from '../components/MetalPicker';
import { Button, Card, Hint, Label, Message, Screen, SectionTitle, styles as ui } from '../components/ui';
import { formatEur } from '../logic/format';
import { LedgerError, METAL_LABEL, redeemLoyalty } from '../logic/ledger';
import { formatLou, LOYALTY, loyalty } from '../logic/loyalty';
import type { Metal } from '../logic/types';
import { useAccount, useBank } from '../state/BankProvider';
import { colors } from '../theme';

export default function LoyaltyScreen() {
  const account = useAccount();
  const { commit } = useBank();
  const l = loyalty(account);
  const [metal, setMetal] = useState<Metal>('gold');
  const [text, setText] = useState('');
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const L = LOYALTY;
  const n = Math.floor(Number(text.replace(',', '.')) || 0);

  return (
    <Screen testID="screen-fidelite">
      <View style={styles.hero}>
        <Text style={styles.heroLabel}>Vos louis de fidélité</Text>
        <Text style={styles.heroValue}>{formatLou(l.balance)}</Text>
        <Text style={styles.heroSub}>
          soit {formatEur(l.balance * L.eurPerLou)} de métal à recevoir · {formatLou(l.earned)} gagnés depuis
          l’ouverture
        </Text>
      </View>

      <SectionTitle>Ce mois-ci</SectionTitle>
      <Card style={{ gap: 6 }}>
        <Text style={styles.para}>
          {l.monthDone
            ? `✓ Mois validé : +${L.monthLou} LOU pour votre épargne de ce mois.`
            : `Investissez au moins ${formatEur(L.monthMinEur)} ce mois-ci pour gagner ${L.monthLou} LOU.`}
        </Text>
        <Text style={styles.muted}>
          Série en cours : {l.currentStreak} mois d’affilée · bonus de {L.streakLou} LOU dans{' '}
          {L.streakMonths - (l.currentStreak % L.streakMonths)} mois.
        </Text>
        <Text style={styles.muted}>Prochain LOU d’achat : encore {formatEur(l.toNextBuyLou)} à investir.</Text>
      </Card>

      <SectionTitle>Comment vous gagnez des louis</SectionTitle>
      <Card style={{ gap: 8 }}>
        <Rule
          title="Épargner chaque mois"
          rule={`${L.monthLou} LOU par mois avec au moins ${formatEur(L.monthMinEur)} investis, et ${L.streakLou} LOU de plus tous les ${L.streakMonths} mois consécutifs`}
          mine={`${l.months} mois · ${l.streaks} série(s)`}
          lou={l.fromMonths + l.fromStreaks}
        />
        <Rule
          title="Investir"
          rule={`1 LOU par tranche de ${formatEur(L.buyEurPerLou)} de métal acheté`}
          mine={`${formatEur(l.invested)} investis`}
          lou={l.fromBuys}
        />
        <Rule
          title="Payer avec la carte Orvia"
          rule={`1 LOU par tranche de ${formatEur(L.cardEurPerLou)} dépensés`}
          mine={`${formatEur(l.cardSpent)} dépensés`}
          lou={l.fromCard}
        />
        <Rule
          title="Ancienneté"
          rule={`${L.anniversaryLou} LOU à chaque anniversaire du compte`}
          mine={`${l.years} an${l.years > 1 ? 's' : ''}`}
          lou={l.fromYears}
        />
        <View style={styles.sep} />
        <View style={styles.row}>
          <Text style={styles.bold}>Total gagné</Text>
          <Text style={styles.bold}>{formatLou(l.earned)}</Text>
        </View>
        {l.spent > 0 && (
          <View style={styles.row}>
            <Text style={styles.label}>Déjà échangés</Text>
            <Text style={styles.value}>− {formatLou(l.spent)}</Text>
          </View>
        )}
        <Text style={styles.muted}>
          Aucun louis sur les ventes, conversions, virements ou euros laissés dans le compte d’attente : le programme
          récompense l’épargne régulière, pas les allers-retours.
        </Text>
      </Card>

      <SectionTitle>Échanger mes louis</SectionTitle>
      <Card style={{ gap: 10 }}>
        <Text style={styles.para}>
          1 LOU = {formatEur(L.eurPerLou)} de métal, sans frais, à partir de {L.minRedeem} LOU. Le métal arrive tout de
          suite dans votre coffre.
        </Text>
        <Label>Recevoir en</Label>
        <MetalPicker value={metal} onChange={setMetal} />
        <TextInput
          value={text}
          onChangeText={(t) => {
            setText(t);
            setMessage(null);
          }}
          placeholder={`Nombre de LOU (${l.balance} disponibles)`}
          placeholderTextColor={colors.textMuted}
          keyboardType="number-pad"
          style={ui.input}
          accessibilityLabel="Nombre de louis à échanger"
        />
        <Button
          title={
            n >= L.minRedeem
              ? `Échanger ${formatLou(n)} contre ${formatEur(n * L.eurPerLou)} de ${METAL_LABEL[metal]}`
              : 'Échanger'
          }
          disabled={l.balance < L.minRedeem}
          onPress={() => {
            try {
              commit((acc, p) => redeemLoyalty(acc, p, n, metal));
              setText('');
              setMessage({
                ok: true,
                text: `${formatLou(n)} échangés : ${formatEur(n * L.eurPerLou)} de ${METAL_LABEL[metal]} ajoutés.`,
              });
            } catch (e) {
              setMessage({ ok: false, text: e instanceof LedgerError ? e.message : 'Une erreur est survenue.' });
            }
          }}
        />
        {l.balance < L.minRedeem && <Hint>Encore {L.minRedeem - l.balance} LOU avant votre premier échange.</Hint>}
        {message && <Message {...message} />}
      </Card>
    </Screen>
  );
}

function Rule({ title, rule, mine, lou }: { title: string; rule: string; mine: string; lou: number }) {
  return (
    <View style={{ gap: 2 }}>
      <View style={styles.row}>
        <Text style={styles.bold}>{title}</Text>
        <Text style={[styles.bold, { color: colors.gold }]}>+{formatLou(lou)}</Text>
      </View>
      <Text style={styles.muted}>{rule}</Text>
      <Text style={styles.muted}>Vous : {mine}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.gold,
    padding: 18,
    alignItems: 'center',
    gap: 4,
  },
  heroLabel: { color: colors.textMuted, fontSize: 14, fontWeight: '600' },
  heroValue: { color: colors.gold, fontSize: 34, fontWeight: '800', fontVariant: ['tabular-nums'] },
  heroSub: { color: colors.textMuted, fontSize: 12, textAlign: 'center' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  label: { color: colors.textMuted, fontSize: 13 },
  value: { color: colors.text, fontSize: 14, fontVariant: ['tabular-nums'] },
  bold: { color: colors.text, fontWeight: '700', fontSize: 14 },
  para: { color: colors.text, fontSize: 13, lineHeight: 19 },
  muted: { color: colors.textMuted, fontSize: 12, lineHeight: 17 },
  sep: { height: 1, backgroundColor: colors.border },
});
