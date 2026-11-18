import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AgencyPicker } from '../components/AgencyPicker';
import { BarImage } from '../components/BarImage';
import { PinConfirm } from '../components/PinConfirm';
import { Button, Card, Hint, KeyValue, Message, Screen, SectionTitle, styles as ui } from '../components/ui';
import { formatEur, formatWeight } from '../logic/format';
import { LedgerError } from '../logic/ledger';
import {
  BAR_PRODUCTS,
  type BarOrder,
  PHYSICAL,
  physicalFeesOf,
  quoteWithdrawal,
  specLine,
  VERISCAN_NOTE,
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
  const fees = physicalFeesOf(account.settings);
  const [mode, setMode] = useState<'home' | 'agency' | 'vault'>('home');
  const pickup = mode === 'agency';
  const vault = mode === 'vault';
  const [agency, setAgency] = useState('');
  const q = quoteWithdrawal(quote.prices, order, fees, pickup || vault);
  const cash = account.cashEur ?? 0;
  const gold = account.holdings.gold;
  const tooMuch = q.grams > gold + 1e-9;
  const noCash = q.fees > cash + 0.005;

  const missingGrams = Math.max(0, q.grams - gold);
  const summary = `${q.pieces} ${q.pieces > 1 ? 'lingotins' : 'lingotin'} · ${pickup ? 'retrait en agence' : vault ? 'gardés en coffre chez Godot & Fils' : 'livraison à domicile'} · ${formatEur(q.fees)} de frais`;
  // Un seul bouton d'action : il dit ce qui manque et y mène, plutôt que de rester grisé.
  const cta: { title: string; action: 'none' | 'buy' | 'credit' | 'order'; disabled?: boolean; hint?: string } = !q
    .lines.length
    ? { title: 'Choisissez un lingotin', action: 'none', disabled: true }
    : pickup && agency.trim().length < 2
      ? { title: 'Choisissez l’agence de retrait', action: 'none', disabled: true }
      : tooMuch
        ? {
            title: `Acheter ${formatWeight(missingGrams, 'g', 'gold')} d’or`,
            action: 'buy',
            hint: 'Il manque de l’or au coffre pour cette commande.',
          }
        : noCash
          ? {
              title: `Créditer le compte d’attente de ${formatEur(q.fees - cash)}`,
              action: 'credit',
              hint: 'Les frais se paient depuis le compte d’attente, pas avec votre or.',
            }
          : { title: `Commander · ${formatEur(q.fees)}`, action: 'order' };

  const set = (id: string, n: number) => {
    setOrder((o) => ({ ...o, [id]: Math.max(0, n) }));
    setMessage(null);
  };

  function submit() {
    setConfirm(false);
    try {
      const city = agency.trim();
      commit((a, p) => withdrawPhysical(a, p, order, new Date(), pickup ? city : undefined, vault));
      setOrder({});
      setMessage({
        ok: true,
        text: vault
          ? 'Commande enregistrée : vos lingotins seront gardés en coffre sécurisé chez Godot & Fils, à votre nom. Vous pourrez noter leur numéro de série dès leur entrée au coffre, dans « Mon coffre maison ».'
          : pickup
            ? `Retrait enregistré : vous serez prévenu dès que vos lingotins sont disponibles à l’agence Godot & Fils (${city}). Apportez une pièce d’identité et signez le bon de remise. Notez ensuite le numéro de série de chaque lingotin dans « Mon coffre maison ».`
            : `Retrait enregistré : livraison assurée sous ${PHYSICAL.delayDays} jours environ. Notez le numéro de série de chaque lingotin à réception, dans « Mon coffre maison ».`,
      });
    } catch (e) {
      setMessage({ ok: false, text: e instanceof LedgerError ? e.message : 'Retrait impossible.' });
    }
  }

  const silverValue = 1000 * quote.prices.silver;
  const ptValue = 31.1035 * quote.prices.platinum;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Screen testID="screen-retrait">
        <Hint>
          Recevez une partie de votre Gold Spot en lingotins d’or 999,9 d’affineries agréées LBMA (numéro de série et
          certificat) ou en Napoléons 20 F. Ce n’est pas une vente : pas d’impôt, et la durée de détention de votre or
          continue.
        </Hint>
        <Hint>Lingots PAMP Suisse : {VERISCAN_NOTE}</Hint>
        <Text style={styles.avail}>
          Or au coffre : <Text style={{ color: metalColor.gold }}>{formatWeight(gold, 'g', 'gold')}</Text> · compte
          d’attente : {formatEur(cash)}
        </Text>

        <Card style={{ paddingVertical: 4 }}>
          {BAR_PRODUCTS.map((p, i) => {
            const n = order[p.id] ?? 0;
            return (
              <View key={p.id} style={[styles.row, i > 0 && styles.border]}>
                <BarImage product={p.id} size={58} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{p.label}</Text>
                  <Text style={styles.sub}>
                    ≈ {formatEur(p.grams * quote.prices.gold)} ·{' '}
                    {p.coin
                      ? `prime ≈ ${pct(fees.premiums[p.id])}, variable`
                      : `fabrication ${pct(fees.premiums[p.id])}`}
                    {` · ${formatEur(quote.prices.gold * fees.premiums[p.id])}/g`}
                    {p.id === 'g10' ? ' · conseillé' : p.coin ? ' · la pièce la plus facile à revendre en France' : ''}
                  </Text>
                  {specLine(p.spec) ? <Text style={styles.sub}>{specLine(p.spec)}</Text> : null}
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
                <Pressable
                  onPress={() => set(p.id, n + 1)}
                  style={styles.step}
                  accessibilityLabel={`Plus de ${p.label}`}
                >
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
            {q.clientDiscount > 0 && (
              <Text style={[styles.sub, { color: colors.up }]} testID="quantity-discount">
                Remise de quantité comprise : −{formatEur(q.clientDiscount)}
              </Text>
            )}
            {q.lines.some((l) => l.product.coin) && (
              <Text style={styles.sub}>
                La prime du Napoléon varie avec la demande : son prix exact est fixé le jour de la préparation.
              </Text>
            )}
            <View style={styles.modes}>
              {(
                [
                  { id: 'home', label: 'À domicile' },
                  { id: 'agency', label: 'En agence' },
                  { id: 'vault', label: 'Coffre sécurisé' },
                ] as const
              ).map((m) => (
                <Pressable
                  key={m.id}
                  onPress={() => setMode(m.id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: mode === m.id }}
                  style={[styles.mode, mode === m.id && { borderColor: colors.gold }]}
                >
                  <Text style={[styles.modeText, mode === m.id && { color: colors.gold }]}>{m.label}</Text>
                </Pressable>
              ))}
            </View>
            {pickup && <AgencyPicker value={agency} onChange={setAgency} />}
            {vault && (
              <Text style={styles.sub} testID="vault-note">
                Vos lingotins restent en coffre sécurisé chez Godot & Fils, à votre nom, sans livraison. Ils
                apparaissent dans « Mon coffre maison » dès leur entrée au coffre. Leur garde est refacturée au coût par
                Orvia : 0,04 € par mois et par gramme, prélevée chaque mois en or.
              </Text>
            )}
            <Line
              label={
                pickup
                  ? 'Retrait en agence, contre pièce d’identité et bon de remise'
                  : vault
                    ? 'Garde en coffre chez Godot & Fils : pas de livraison'
                    : `Livraison assurée, remise contre signature${q.delivery ? ` (offerte dès ${fees.freeFromGrams} g)` : ''}`
              }
              value={q.delivery ? formatEur(q.delivery) : pickup || vault ? 'Gratuit' : 'Offerte'}
            />
            <View style={styles.sep} />
            <Line
              label={`Frais payés depuis le compte d’attente (${pct(q.feesPct)})`}
              value={formatEur(q.fees)}
              strong
            />
            {tooMuch && <Text style={styles.err}>Pas assez d’or au coffre pour ce retrait.</Text>}
            {noCash && (
              <Text style={styles.err}>
                Compte d’attente insuffisant : créditez-le d’au moins {formatEur(q.fees - cash)} (les frais ne sont pas
                pris sur votre or : ce serait une vente, donc imposée).
              </Text>
            )}
          </Card>
        )}
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
            1 kg d’argent ≈ {formatEur(silverValue)} → {formatEur(vatIfWithdrawn(silverValue))} de TVA. 1 once de
            platine ≈ {formatEur(ptValue)} → {formatEur(vatIfWithdrawn(ptValue))} de TVA.
          </Text>
        </Card>
        <Hint>
          Gardez l’essentiel au coffre : la garde y coûte 0,15 % par an pour l’or, et la revente est sans commission.
          Chez vous, pensez à l’assurance habitation et à la discrétion.
        </Hint>

        <PinConfirm
          visible={confirm}
          summary={`Retirer ${q.lines.map((l) => `${l.qty} × ${l.product.label.toLowerCase()}`).join(', ')} : ${formatWeight(q.grams, 'g', 'gold')} d’or, ${formatEur(q.fees)} de frais.`}
          onConfirm={submit}
          onCancel={() => setConfirm(false)}
        />
      </Screen>
      <View style={styles.footer} testID="order-footer">
        {q.lines.length > 0 && (
          <Text style={styles.footerSub} numberOfLines={2}>
            {summary}
          </Text>
        )}
        <Button
          title={cta.title}
          onPress={() => {
            if (cta.action === 'buy')
              router.push({ pathname: '/operations', params: { mode: 'buy', metal: 'gold', t: Date.now() } });
            else if (cta.action === 'credit') router.push('/attente');
            else if (cta.action === 'order') setConfirm(true);
          }}
          disabled={cta.disabled}
        />
        {cta.hint ? <Text style={styles.footerSub}>{cta.hint}</Text> : null}
      </View>
    </View>
  );
}

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return <KeyValue label={label} value={value} strong={strong} />;
}

const styles = StyleSheet.create({
  footer: {
    gap: 6,
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  footerSub: { color: colors.textMuted, fontSize: 12.5, textAlign: 'center' },
  modes: { flexDirection: 'row', gap: 8 },
  mode: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  modeText: { color: colors.textMuted, fontSize: 13.5, fontWeight: '600', textAlign: 'center' },
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
