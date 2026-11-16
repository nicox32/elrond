import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PinConfirm } from '../components/PinConfirm';
import { Button, Card, Hint, Message, Screen, SectionTitle, styles as ui } from '../components/ui';
import { formatEur, formatWeight } from '../logic/format';
import { LedgerError } from '../logic/ledger';
import {
  BAR_PRODUCTS,
  type BarOrder,
  PHYSICAL,
  quoteWithdrawal,
  vatIfWithdrawn,
  withdrawPhysical,
} from '../logic/physical';
import { useAccount, useBank } from '../state/BankProvider';
import { colors, metalColor } from '../theme';

const pct = (n: number) => `${(n * 100).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %`;

/** Retrait physique : de l'or du coffre livré en lingotins. */
export default function WithdrawScreen() {
  const account = useAccount();
  const { quote, commit } = useBank();
  const [order, setOrder] = useState<BarOrder>({});
  const [confirm, setConfirm] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const q = quoteWithdrawal(quote.prices, order);
  const cash = account.cashEur ?? 0;
  const gold = account.holdings.gold;
  const tooMuch = q.grams > gold + 1e-9;
  const noCash = q.fees > cash + 0.005;

  const set = (id: string, n: number) => {
    setOrder((o) => ({ ...o, [id]: Math.max(0, n) }));
    setMessage(null);
  };

  function submit() {
    setConfirm(false);
    try {
      commit((a, p) => withdrawPhysical(a, p, order));
      setOrder({});
      setMessage({
        ok: true,
        text: `Retrait enregistré : livraison assurée sous ${PHYSICAL.delayDays} jours ouvrés. Notez le numéro de série de chaque lingotin à réception, dans « Mon coffre maison ».`,
      });
    } catch (e) {
      setMessage({ ok: false, text: e instanceof LedgerError ? e.message : 'Retrait impossible.' });
    }
  }

  const silverValue = 1000 * quote.prices.silver;
  const ptValue = 31.1035 * quote.prices.platinum;

  return (
    <Screen testID="screen-retrait">
      <Hint>
        Recevez une partie de votre Gold Spot en lingotins d’or 999,9 d’affineries agréées LBMA (numéro de série et
        certificat) ou en Napoléons 20 F. Ce n’est pas une vente : pas d’impôt, et la durée de détention de votre or
        continue.
      </Hint>
      <Text style={styles.avail}>
        Or au coffre : <Text style={{ color: metalColor.gold }}>{formatWeight(gold, 'g', 'gold')}</Text> · compte
        d’attente : {formatEur(cash)}
      </Text>

      <Card style={{ paddingVertical: 4 }}>
        {BAR_PRODUCTS.map((p, i) => {
          const n = order[p.id] ?? 0;
          return (
            <View key={p.id} style={[styles.row, i > 0 && styles.border]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{p.label}</Text>
                <Text style={styles.sub}>
                  ≈ {formatEur(p.grams * quote.prices.gold)} ·{' '}
                  {p.coin ? `prime ≈ ${pct(p.premium)}, variable` : `fabrication ≈ ${pct(p.premium)}`}
                  {p.id === 'g10' ? ' · conseillé' : p.coin ? ' · la pièce la plus facile à revendre en France' : ''}
                </Text>
              </View>
              <Pressable
                onPress={() => set(p.id, n - 1)}
                style={styles.step}
                accessibilityLabel={`Moins de ${p.label}`}
              >
                <Text style={styles.stepText}>−</Text>
              </Pressable>
              <Text style={styles.qty} testID={`qty-${p.id}`}>
                {n}
              </Text>
              <Pressable onPress={() => set(p.id, n + 1)} style={styles.step} accessibilityLabel={`Plus de ${p.label}`}>
                <Text style={styles.stepText}>+</Text>
              </Pressable>
            </View>
          );
        })}
      </Card>

      {q.lines.length > 0 && (
        <Card style={{ gap: 6 }}>
          <Line label="Or retiré du coffre" value={formatWeight(q.grams, 'g', 'gold')} />
          <Line label="Valeur au cours du jour" value={formatEur(q.value)} />
          <Line
            label={
              q.lines.some((l) => l.product.coin) ? 'Fabrication et prime des pièces' : 'Fabrication des lingotins'
            }
            value={formatEur(q.premium)}
          />
          {q.lines.some((l) => l.product.coin) && (
            <Text style={styles.sub}>
              La prime du Napoléon varie avec la demande : son prix exact est fixé le jour de la préparation.
            </Text>
          )}
          <Line
            label={`Livraison assurée, remise contre signature${q.delivery ? ` (offerte dès ${PHYSICAL.freeDeliveryFromGrams} g)` : ''}`}
            value={q.delivery ? formatEur(q.delivery) : 'Offerte'}
          />
          <View style={styles.sep} />
          <Line label={`Frais payés depuis le compte d’attente (${pct(q.feesPct)})`} value={formatEur(q.fees)} strong />
          {tooMuch && <Text style={styles.err}>Pas assez d’or au coffre pour ce retrait.</Text>}
          {noCash && (
            <Text style={styles.err}>
              Compte d’attente insuffisant : créditez-le d’au moins {formatEur(q.fees - cash)} (les frais ne sont pas
              pris sur votre or : ce serait une vente, donc imposée).
            </Text>
          )}
        </Card>
      )}
      {noCash && q.lines.length > 0 && (
        <Button title="Créditer le compte d’attente" variant="ghost" onPress={() => router.push('/attente')} />
      )}
      <Button
        title="Retirer ces lingotins"
        onPress={() => setConfirm(true)}
        disabled={!q.lines.length || tooMuch || noCash}
      />
      {message && <Message {...message} />}
      <Pressable onPress={() => router.push('/coffre-maison')} accessibilityRole="link">
        <Text style={ui.link}>Mon coffre maison ›</Text>
      </Pressable>

      <SectionTitle>Argent et platine</SectionTitle>
      <Card style={{ gap: 6 }}>
        <Text style={styles.para}>
          Ils restent au coffre : à la sortie du port franc, l’argent et le platine paient{' '}
          {pct(PHYSICAL.vatSilverPlatinum)} de TVA (l’or d’investissement en est exonéré).
        </Text>
        <Text style={styles.sub}>
          1 kg d’argent ≈ {formatEur(silverValue)} → {formatEur(vatIfWithdrawn(silverValue))} de TVA. 1 once de platine
          ≈ {formatEur(ptValue)} → {formatEur(vatIfWithdrawn(ptValue))} de TVA.
        </Text>
      </Card>
      <Hint>
        Gardez l’essentiel au coffre : la garde y coûte 0,12 % par an pour l’or, et la revente 0,8 %. Chez vous, pensez
        à l’assurance habitation et à la discrétion.
      </Hint>

      <PinConfirm
        visible={confirm}
        summary={`Retirer ${q.lines.map((l) => `${l.qty} × ${l.product.label.toLowerCase()}`).join(', ')} : ${formatWeight(q.grams, 'g', 'gold')} d’or, ${formatEur(q.fees)} de frais.`}
        onConfirm={submit}
        onCancel={() => setConfirm(false)}
      />
    </Screen>
  );
}

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.line}>
      <Text style={[styles.lineLabel, strong && styles.strong]}>{label}</Text>
      <Text style={[styles.lineValue, strong && styles.strong]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  avail: { color: colors.textMuted, fontSize: 13.5 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  border: { borderTopWidth: 1, borderTopColor: colors.border },
  name: { color: colors.text, fontSize: 15, fontWeight: '700' },
  sub: { color: colors.textMuted, fontSize: 12.5, lineHeight: 17 },
  step: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: { color: colors.gold, fontSize: 20, fontWeight: '800' },
  qty: { color: colors.text, fontSize: 16, fontWeight: '800', minWidth: 22, textAlign: 'center' },
  line: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  lineLabel: { color: colors.textMuted, fontSize: 13.5, flex: 1 },
  lineValue: { color: colors.text, fontSize: 13.5, fontVariant: ['tabular-nums'] },
  strong: { color: colors.text, fontWeight: '800' },
  sep: { height: 1, backgroundColor: colors.border, marginVertical: 2 },
  err: { color: colors.down, fontSize: 13, lineHeight: 18 },
  para: { color: colors.text, fontSize: 13.5, lineHeight: 19 },
});
