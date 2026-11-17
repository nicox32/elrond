import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { AmountInput } from '../../components/AmountInput';
import { MetalPicker } from '../../components/MetalPicker';
import { MarketHours } from '../../components/MarketHours';
import { isWeekendClosed, marketStatus } from '../../logic/market';
import { cancelOrder, describeOrder, placeOrder } from '../../logic/orders';
import { PriceStatus } from '../../components/PriceStatus';
import { Segmented } from '../../components/Segmented';
import { SpeedPicker } from '../../components/SpeedPicker';
import { Button, Hint, Label, Message, Screen, styles as ui, Title } from '../../components/ui';
import { formatEur, formatQty, formatUnitPrice, formatWeight, parseAmount } from '../../logic/format';
import { FEES, type SaleSpeed } from '../../logic/fees';
import {
  buy,
  buyPrice,
  convert,
  LedgerError,
  minOrderError,
  quoteBuy,
  quoteConvert,
  quoteSale,
  sell,
  sellPrice,
} from '../../logic/ledger';
import { type AmountUnit, type Metal, METALS } from '../../logic/types';
import { useAccount, useBank } from '../../state/BankProvider';
import { describeTax } from '../../logic/tax';
import { colors } from '../../theme';

const pct = (n: number) => `${(n * 100).toLocaleString('fr-FR', { maximumFractionDigits: 2 })}\u00a0%`;

type Mode = 'buy' | 'sell' | 'convert';

const isMode = (v: unknown): v is Mode => v === 'buy' || v === 'sell' || v === 'convert';
const isMetal = (v: unknown): v is Metal => METALS.includes(v as Metal);

export default function OperationsScreen() {
  // Un raccourci (« Acheter », « Vendre »…) arrive avec ses réglages et un jeton `t` :
  // le formulaire repart alors de zéro avec ces réglages.
  const params = useLocalSearchParams<{ mode?: string; metal?: string; t?: string }>();
  return (
    <OperationForm
      key={`${params.mode}-${params.metal}-${params.t}`}
      initialMode={isMode(params.mode) ? params.mode : 'buy'}
      initialMetal={isMetal(params.metal) ? params.metal : 'gold'}
    />
  );
}

function OperationForm({ initialMode, initialMetal }: { initialMode: Mode; initialMetal: Metal }) {
  const account = useAccount();
  const { quote, commit, updateAccount } = useBank();
  const unit = account.settings.unit;

  const [mode, setMode] = useState<Mode>(initialMode);
  const [metal, setMetal] = useState<Metal>(initialMetal);
  const [chosenTarget, setTarget] = useState<Metal>('silver');
  const target: Metal = chosenTarget !== metal ? chosenTarget : (METALS.find((m) => m !== metal) ?? 'silver');
  const [amountUnit, setAmountUnit] = useState<AmountUnit>('eur');
  const [text, setText] = useState('');
  const [speed, setSpeed] = useState<SaleSpeed>('deferred');
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  // Week-end : ordre au cours de lundi (sans supplément) ou tout de suite (+0,5 %).
  const weekend = isWeekendClosed();
  const [when, setWhen] = useState<'monday' | 'now'>('monday');
  const extra = weekend && when === 'now' ? FEES.weekendSpread : 0;
  const deferred = weekend && when === 'monday';
  const pending = account.pendingOrders ?? [];

  const value = parseAmount(text);
  const prices = quote.prices;
  const unitPrice = mode === 'buy' ? buyPrice(prices, metal, extra) : sellPrice(prices, metal, speed, extra);

  // Aperçu chiffré, frais compris.
  const preview = useMemo(() => {
    if (!Number.isFinite(value) || value <= 0) return null;
    const q = { unit: amountUnit, value };
    const later = deferred
      ? ' Estimation au cours d’aujourd’hui : l’ordre passera lundi à la réouverture, au cours du moment.'
      : '';
    if (mode === 'buy') {
      const r = quoteBuy(prices, metal, q, extra);
      return `Vous achetez ${formatQty(metal, r.grams, unit)} pour ${formatEur(r.paid)}, dont ${formatEur(r.fees)} de frais (${pct(FEES.buy[metal] + extra)}).${later}`;
    }
    if (mode === 'sell') {
      const r = quoteSale(prices, metal, q, speed, false, account, new Date(), extra);
      return `Vous vendez ${formatQty(metal, r.grams, unit)} et recevez ${formatEur(r.received)}, après ${formatEur(r.fees)} de frais.${r.tax ? ` ${describeTax(r.tax)}` : ''}${later}`;
    }
    const r = quoteConvert(prices, metal, target, q, account, new Date(), extra);
    return `${formatQty(metal, r.grams, unit)} deviennent ${formatQty(target, r.received, unit)}, après ${formatEur(r.fees)} de frais (${pct(FEES.conversion)} + ${pct(FEES.buy[target])}).${r.tax ? ` Une conversion est une vente pour le fisc. ${describeTax(r.tax)}` : ''}`;
  }, [value, amountUnit, mode, metal, target, prices, unit, speed, account, extra, deferred]);

  function submit() {
    const q = { unit: amountUnit, value };
    try {
      if (mode === 'buy') {
        const err = minOrderError(quoteBuy(prices, metal, q, extra).paid);
        if (err) throw new LedgerError(err);
      }
      if (deferred) {
        updateAccount((acc) =>
          placeOrder(acc, {
            kind: mode,
            metal,
            q,
            ...(mode === 'convert' ? { target } : {}),
            ...(mode === 'sell' ? { speed } : {}),
          }),
        );
        setText('');
        setMessage({
          ok: true,
          text: 'Ordre enregistré : il passera lundi à la réouverture du marché, au cours du moment.',
        });
        return;
      }
      commit((acc, p) =>
        mode === 'buy'
          ? buy(acc, p, metal, q, new Date(), 'card', extra)
          : mode === 'sell'
            ? sell(acc, p, metal, q, speed, new Date(), extra)
            : convert(acc, p, metal, target, q, new Date(), extra),
      );
      setText('');
      setMessage({ ok: true, text: 'Opération effectuée.' });
    } catch (e) {
      setMessage({ ok: false, text: e instanceof LedgerError ? e.message : 'Une erreur est survenue.' });
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen testID="screen-operations">
        <Title>Opérations</Title>
        <PriceStatus />
        <MarketHours />
        <Pressable onPress={() => router.push('/repartition')} style={styles.splitLink} accessibilityRole="link">
          <Text style={styles.splitText}>Achat réparti Gold Spot / argent / platine en un geste</Text>
          <Text style={ui.link}>Répartition ›</Text>
        </Pressable>
        <Segmented
          value={mode}
          onChange={(m) => {
            setMode(m);
            setMessage(null);
          }}
          options={[
            { value: 'buy', label: 'Acheter' },
            { value: 'sell', label: 'Vendre' },
            { value: 'convert', label: 'Convertir' },
          ]}
        />

        <View style={styles.block}>
          <Label>{mode === 'convert' ? 'Depuis' : 'Métal'}</Label>
          <MetalPicker value={metal} onChange={setMetal} />
          <Hint>
            {mode === 'buy' ? 'Prix d’achat' : 'Prix de vente'} : {formatUnitPrice(unitPrice, unit, metal)} · Disponible
            : {formatWeight(account.holdings[metal], unit, metal)}
          </Hint>
        </View>

        {mode === 'sell' && <SpeedPicker value={speed} onChange={setSpeed} />}

        {mode === 'convert' && (
          <View style={styles.block}>
            <Label>Vers</Label>
            <MetalPicker value={target} onChange={setTarget} exclude={metal} />
          </View>
        )}

        <View style={styles.block}>
          <Label>
            {mode === 'buy'
              ? 'Montant à acheter (en euros : montant payé)'
              : mode === 'sell'
                ? 'Montant à vendre (en euros : montant reçu après impôt)'
                : 'Quantité à convertir'}
          </Label>
          <AmountInput
            text={text}
            onChangeText={(t) => {
              setText(t);
              setMessage(null);
            }}
            unit={amountUnit}
            onUnitChange={setAmountUnit}
            metal={metal}
          />
          {mode !== 'buy' && account.holdings[metal] > 0 && (
            <Pressable
              onPress={() => {
                setAmountUnit('g');
                setText(String(Math.floor(account.holdings[metal] * 1e6) / 1e6).replace('.', ','));
                setMessage(null);
              }}
              accessibilityRole="button"
            >
              <Text style={ui.link}>
                {mode === 'sell' ? 'Tout vendre' : 'Tout convertir'} (
                {formatWeight(account.holdings[metal], unit, metal)})
              </Text>
            </Pressable>
          )}
        </View>

        {preview && (
          <Text style={styles.preview}>
            {preview}
            {!marketStatus().open && !weekend && mode !== 'convert'
              ? ' Marché en pause : opération au dernier cours connu, celui affiché ici.'
              : ''}
          </Text>
        )}
        {quote.source === 'reference' && (
          <Hint style={{ color: colors.warning }}>
            Attention : les cours réels n’ont pas pu être chargés, l’opération utilise des cours indicatifs.
          </Hint>
        )}

        {weekend && (
          <View style={styles.block}>
            <Label>Marché fermé le week-end</Label>
            <Segmented
              value={when}
              onChange={setWhen}
              options={[
                { value: 'monday', label: 'Au cours de lundi' },
                { value: 'now', label: `Tout de suite (+${pct(FEES.weekendSpread)})` },
              ]}
            />
            <Hint>
              {when === 'monday'
                ? 'Sans supplément : l’ordre passe à la réouverture du marché, au cours du moment.'
                : `Au dernier cours du vendredi, avec ${pct(FEES.weekendSpread)} de supplément (le cours peut bouger d’ici lundi).`}
            </Hint>
          </View>
        )}

        <Button title={deferred ? 'Passer l’ordre pour lundi' : 'Valider'} onPress={submit} />
        {message && <Message {...message} />}

        {pending.length > 0 && (
          <View style={styles.pending} testID="pending-orders">
            <Text style={styles.pendingTitle}>Ordres en attente de la réouverture ({pending.length})</Text>
            {pending.map((o) => (
              <View key={o.id} style={styles.pendingRow}>
                <Text style={styles.pendingText}>{describeOrder(o, account)}</Text>
                <Pressable onPress={() => updateAccount((a) => cancelOrder(a, o.id))} accessibilityRole="button">
                  <Text style={ui.link}>Annuler</Text>
                </Pressable>
              </View>
            ))}
          </View>
        )}

        <Hint>
          {mode === 'buy'
            ? `Paiement par carte bancaire. Frais d’achat : ${pct(FEES.buy[metal])} du montant. Achat minimum : ${FEES.minOrder} €.`
            : mode === 'sell'
              ? `Les euros sont versés sur votre compte bancaire en France. Revente sans commission. L’impôt est calculé et retenu automatiquement, au régime le moins cher.`
              : `Frais de conversion : ${pct(FEES.conversion)} + frais d’achat du métal reçu.`}{' '}
          1 once troy = 31,1035 g.
        </Hint>
        <Pressable onPress={() => router.push('/tarifs')} accessibilityRole="link">
          <Text style={ui.link}>Voir tous les tarifs</Text>
        </Pressable>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  block: { gap: 8 },
  splitLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    backgroundColor: colors.goldSoft,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  splitText: { color: colors.text, fontSize: 13, flex: 1 },
  pending: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pendingTitle: { color: colors.text, fontWeight: '700', fontSize: 14 },
  pendingRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pendingText: { color: colors.textMuted, fontSize: 13, flex: 1 },
  preview: {
    color: colors.text,
    backgroundColor: colors.goldSoft,
    padding: 12,
    borderRadius: 12,
    fontSize: 14,
    lineHeight: 20,
  },
});
