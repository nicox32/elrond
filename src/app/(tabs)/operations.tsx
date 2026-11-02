import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { AmountInput } from '../../components/AmountInput';
import { MetalPicker } from '../../components/MetalPicker';
import { PriceStatus } from '../../components/PriceStatus';
import { Segmented } from '../../components/Segmented';
import { SpeedPicker } from '../../components/SpeedPicker';
import { Button, Hint, Label, Message, Screen, styles as ui, Title } from '../../components/ui';
import { formatEur, formatUnitPrice, formatWeight, parseAmount } from '../../logic/format';
import { FEES, type SaleSpeed } from '../../logic/fees';
import {
  buy,
  buyPrice,
  convert,
  LedgerError,
  METAL_OF,
  quoteBuy,
  quoteConvert,
  quoteSale,
  sell,
  sellPrice,
} from '../../logic/ledger';
import { type AmountUnit, type Metal, METALS } from '../../logic/types';
import { useAccount, useBank } from '../../state/BankProvider';
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
  const { quote, commit } = useBank();
  const unit = account.settings.unit;

  const [mode, setMode] = useState<Mode>(initialMode);
  const [metal, setMetal] = useState<Metal>(initialMetal);
  const [chosenTarget, setTarget] = useState<Metal>('silver');
  const target: Metal = chosenTarget !== metal ? chosenTarget : (METALS.find((m) => m !== metal) ?? 'silver');
  const [amountUnit, setAmountUnit] = useState<AmountUnit>('eur');
  const [text, setText] = useState('');
  const [speed, setSpeed] = useState<SaleSpeed>('deferred');
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const value = parseAmount(text);
  const prices = quote.prices;
  const unitPrice = mode === 'buy' ? buyPrice(prices, metal) : sellPrice(prices, metal, speed);

  // Aperçu chiffré, frais compris.
  const preview = useMemo(() => {
    if (!Number.isFinite(value) || value <= 0) return null;
    const q = { unit: amountUnit, value };
    if (mode === 'buy') {
      const r = quoteBuy(prices, metal, q);
      return `Tu achètes ${formatWeight(r.grams, unit)} ${METAL_OF[metal]} pour ${formatEur(r.paid)}, dont ${formatEur(r.fees)} de frais (${pct(FEES.buy[metal])}).`;
    }
    if (mode === 'sell') {
      const r = quoteSale(prices, metal, q, speed);
      return `Tu vends ${formatWeight(r.grams, unit)} ${METAL_OF[metal]} et reçois ${formatEur(r.received)}, après ${formatEur(r.fees)} de frais.`;
    }
    const r = quoteConvert(prices, metal, target, q);
    return `${formatWeight(r.grams, unit)} ${METAL_OF[metal]} deviennent ${formatWeight(r.received, unit)} ${METAL_OF[target]}, après ${formatEur(r.fees)} de frais (${pct(FEES.conversion)} + ${pct(FEES.buy[target])}).`;
  }, [value, amountUnit, mode, metal, target, prices, unit, speed]);

  function submit() {
    const q = { unit: amountUnit, value };
    try {
      commit((acc, p) =>
        mode === 'buy'
          ? buy(acc, p, metal, q)
          : mode === 'sell'
            ? sell(acc, p, metal, q, speed)
            : convert(acc, p, metal, target, q),
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
            {mode === 'buy' ? 'Prix d’achat' : 'Prix de vente'} : {formatUnitPrice(unitPrice, unit)} · Disponible :{' '}
            {formatWeight(account.holdings[metal], unit)}
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
                ? 'Montant à vendre (en euros : montant reçu)'
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
          />
        </View>

        {preview && <Text style={styles.preview}>{preview}</Text>}
        {quote.source === 'reference' && (
          <Hint style={{ color: colors.warning }}>
            Attention : les cours réels n’ont pas pu être chargés, l’opération utilise des cours indicatifs.
          </Hint>
        )}

        <Button title="Valider" onPress={submit} />
        {message && <Message {...message} />}

        <Hint>
          {mode === 'buy'
            ? `Paiement par carte bancaire (fictive). Frais d’achat : ${pct(FEES.buy[metal])} du montant.`
            : mode === 'sell'
              ? `Les euros sont versés sur ton compte bancaire en France (fictif). Frais de revente : ${pct(FEES.sale)}.`
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
  preview: {
    color: colors.text,
    backgroundColor: colors.goldSoft,
    padding: 12,
    borderRadius: 12,
    fontSize: 14,
    lineHeight: 20,
  },
});
