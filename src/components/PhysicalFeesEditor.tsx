import { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { formatEur, parseAmount } from '../logic/format';
import {
  BAR_PRODUCTS,
  normalizeDeliveryTiers,
  physicalFeesOf,
  PHYSICAL,
  QTY_RANGES,
  vendorPremiumFrom,
} from '../logic/physical';
import { useAccount, useBank } from '../state/BankProvider';
import { colors } from '../theme';
import { Button, Card, Hint, Label, Message, styles as ui } from './ui';

const PREMIUM_CALCULATOR_URL = 'https://lingot-dor.fr/calculateur-prime-or';

const toText = (n: number | undefined) =>
  n === undefined ? '' : (Math.round(n * 10000) / 100).toLocaleString('fr-FR', { maximumFractionDigits: 2 });
const toRate = (t: string) => Math.round(parseAmount(t) * 100) / 10000;

/** Société Orvia : frais du retrait physique (fabrication par format, prime du vendeur, livraison), réglables. */
export function PhysicalFeesEditor() {
  const account = useAccount();
  const { quote, updateSettings } = useBank();
  const fees = physicalFeesOf(account.settings);
  const [premiums, setPremiums] = useState<Record<string, string>>(() =>
    Object.fromEntries(BAR_PRODUCTS.map((p) => [p.id, toText(fees.premiums[p.id])])),
  );
  const [vendor, setVendor] = useState<Record<string, string>>(() =>
    Object.fromEntries(BAR_PRODUCTS.map((p) => [p.id, toText(fees.vendor[p.id])])),
  );
  // Remise du revendeur (points de %) pour chaque tranche de quantité : 10 à 19, 20 à 49, 50 et plus.
  const offsOf = (id: string) => {
    const t = fees.vendorTiers[id] ?? [];
    return QTY_RANGES.slice(1).map((r) => toText(t.find((x) => x.from === r.from)?.off ?? 0));
  };
  const [offs, setOffs] = useState<Record<string, string[]>>(() =>
    Object.fromEntries(BAR_PRODUCTS.map((p) => [p.id, offsOf(p.id)])),
  );
  const [range, setRange] = useState<Record<string, number>>({});
  const [delivery, setDelivery] = useState(String(fees.delivery).replace('.', ','));
  const [free, setFree] = useState(String(fees.freeFromGrams).replace('.', ','));
  const [tiers, setTiers] = useState<{ from: string; cost: string }[]>(() =>
    fees.vendorDeliveryTiers.map((t) => ({
      from: String(t.fromEur).replace('.', ','),
      cost: String(t.cost).replace('.', ','),
    })),
  );
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [calcId, setCalcId] = useState(BAR_PRODUCTS[BAR_PRODUCTS.length - 1].id);
  const [calcPrice, setCalcPrice] = useState('');
  const [calcFees, setCalcFees] = useState('');
  const calcProduct = BAR_PRODUCTS.find((p) => p.id === calcId) ?? BAR_PRODUCTS[0];
  const calcRate = vendorPremiumFrom(
    parseAmount(calcPrice),
    calcFees.trim() ? parseAmount(calcFees) : null,
    calcProduct.grams * quote.prices.gold,
  );

  const valid =
    BAR_PRODUCTS.every((p) => {
      const r = toRate(premiums[p.id]);
      const v = vendor[p.id].trim() ? toRate(vendor[p.id]) : 0;
      return r >= 0 && r <= 0.5 && v >= 0 && v <= 0.5;
    }) &&
    parseAmount(delivery) >= 0 &&
    parseAmount(delivery) <= 200 &&
    parseAmount(free) >= 0 &&
    parseAmount(free) <= 1000 &&
    tiers.every((t) => parseAmount(t.cost) >= 0 && parseAmount(t.cost) <= 500 && parseAmount(t.from) >= 0);

  function save() {
    const prem: Record<string, number> = {};
    const vend: Record<string, number> = {};
    for (const p of BAR_PRODUCTS) {
      prem[p.id] = toRate(premiums[p.id]);
      if (vendor[p.id].trim()) vend[p.id] = toRate(vendor[p.id]);
    }
    updateSettings({
      physicalFees: {
        premiums: prem,
        vendor: vend,
        vendorTiers: Object.fromEntries(
          BAR_PRODUCTS.map((p) => [
            p.id,
            QTY_RANGES.slice(1).map((r, i) => ({ from: r.from, off: Math.max(0, toRate(offs[p.id][i] || '0')) })),
          ]),
        ),
        delivery: parseAmount(delivery),
        vendorDeliveryTiers: normalizeDeliveryTiers(
          tiers.map((t) => ({ fromEur: parseAmount(t.from), cost: parseAmount(t.cost) })),
          PHYSICAL.vendorDelivery,
        ),
        freeFromGrams: parseAmount(free),
      },
    });
    setMsg({
      ok: true,
      text: 'Frais enregistrés : ils s’appliquent aux prochains retraits, aux Tarifs et à l’accueil.',
    });
  }

  function reset() {
    updateSettings({ physicalFees: undefined });
    setPremiums(Object.fromEntries(BAR_PRODUCTS.map((p) => [p.id, toText(physicalFeesOf().premiums[p.id])])));
    setVendor(Object.fromEntries(BAR_PRODUCTS.map((p) => [p.id, toText(physicalFeesOf().vendor[p.id])])));
    setOffs(
      Object.fromEntries(
        BAR_PRODUCTS.map((p) => [
          p.id,
          QTY_RANGES.slice(1).map((r) => toText(p.vendorTiers?.find((x) => x.from === r.from)?.off ?? 0)),
        ]),
      ),
    );
    setDelivery(String(PHYSICAL.delivery));
    setFree(String(PHYSICAL.freeDeliveryFromGrams));
    setTiers(
      physicalFeesOf().vendorDeliveryTiers.map((t) => ({
        from: String(t.fromEur).replace('.', ','),
        cost: String(t.cost).replace('.', ','),
      })),
    );
    setMsg({ ok: true, text: 'Valeurs par défaut rétablies.' });
  }

  return (
    <Card style={{ gap: 12 }}>
      <Text style={styles.title}>Frais du retrait physique</Text>
      <Hint>
        Pour chaque format : ce que paie le client (fabrication ou prime, en % de la valeur de l’or) et ce que vous
        payez au vendeur. La marge est la différence. Les valeurs servent au retrait, aux Tarifs, à l’accueil et au coût
        dans l’Espace DEV.
      </Hint>
      <View style={styles.head}>
        <Text style={[styles.col, { flexGrow: 1.4 }]}>Format</Text>
        <Text style={styles.col}>Client %</Text>
        <Text style={styles.col}>Vendeur %</Text>
      </View>
      {BAR_PRODUCTS.map((p) => {
        const client = toRate(premiums[p.id]);
        const vend = vendor[p.id].trim() ? toRate(vendor[p.id]) : null;
        const value = p.grams * quote.prices.gold;
        const margin = vend === null || !Number.isFinite(client) ? null : value * (client - vend);
        return (
          <View key={p.id} style={{ gap: 4 }}>
            <View style={styles.line}>
              <Text style={[styles.name, { flexGrow: 1.4, flexBasis: 0, minWidth: 0 }]}>
                {p.label.replace(/ \(.*/, '')}
              </Text>
              <TextInput
                value={premiums[p.id]}
                onChangeText={(t) => setPremiums((x) => ({ ...x, [p.id]: t }))}
                keyboardType="decimal-pad"
                style={[ui.input, styles.input]}
                accessibilityLabel={`Frais client ${p.label}`}
              />
              <TextInput
                value={vendor[p.id]}
                onChangeText={(t) => setVendor((x) => ({ ...x, [p.id]: t }))}
                keyboardType="decimal-pad"
                placeholder="—"
                placeholderTextColor={colors.textMuted}
                style={[ui.input, styles.input]}
                accessibilityLabel={`Prime vendeur ${p.label}`}
              />
            </View>
            <Text style={[styles.margin, margin !== null && { color: margin >= 0 ? colors.up : colors.down }]}>
              {margin === null
                ? 'Prime vendeur inconnue : marge non calculée'
                : `Marge ${margin >= 0 ? '+' : '−'}${formatEur(Math.abs(margin))} par ${p.coin ? 'pièce' : 'lingotin'} (${(
                    (client - (vend ?? 0)) *
                    100
                  ).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} pt)`}
            </Text>
            {margin !== null && (
              <View testID={`ranges-${p.id}`} style={{ gap: 6 }}>
                <Text style={styles.tiers}>Marge par pièce selon la quantité commandée :</Text>
                <View style={styles.ranges}>
                  {QTY_RANGES.map((r, i) => {
                    const off = i === 0 ? 0 : Math.max(0, toRate(offs[p.id][i - 1] || '0'));
                    const m = margin + off * value * (1 - PHYSICAL.clientDiscountShare);
                    const on = (range[p.id] ?? 0) === i;
                    return (
                      <Pressable
                        key={r.label}
                        onPress={() => setRange((x) => ({ ...x, [p.id]: i }))}
                        accessibilityRole="button"
                        accessibilityState={{ selected: on }}
                        accessibilityLabel={`${p.label} : ${r.label} pièces`}
                        style={[styles.rangeBtn, on && { borderColor: colors.gold }]}
                      >
                        <Text style={[styles.rangeLabel, on && { color: colors.gold }]}>{r.label}</Text>
                        <Text style={styles.rangeValue}>{formatEur(m)}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                {(range[p.id] ?? 0) === 0 ? (
                  <Text style={styles.tiers}>1 à 9 pièces : prix de base, colonne « Vendeur % ».</Text>
                ) : (
                  <View style={{ gap: 4 }}>
                    <Label>Remise du revendeur de {QTY_RANGES[range[p.id]].label} pièces (points de %)</Label>
                    <TextInput
                      value={offs[p.id][range[p.id] - 1]}
                      onChangeText={(t) =>
                        setOffs((x) => ({
                          ...x,
                          [p.id]: x[p.id].map((v, j) => (j === range[p.id] - 1 ? t : v)),
                        }))
                      }
                      keyboardType="decimal-pad"
                      style={ui.input}
                      accessibilityLabel={`Remise du revendeur ${p.label} ${QTY_RANGES[range[p.id]].label} pièces`}
                    />
                    <Text style={styles.tiers}>
                      La moitié de cette remise est reversée au client ; l’autre moitié améliore votre marge.
                    </Text>
                  </View>
                )}
              </View>
            )}
          </View>
        );
      })}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1, gap: 5 }}>
          <Label>Livraison par envoi (€)</Label>
          <TextInput
            value={delivery}
            onChangeText={setDelivery}
            keyboardType="decimal-pad"
            style={ui.input}
            accessibilityLabel="Livraison par envoi"
          />
        </View>
        <View style={{ flex: 1, gap: 5 }}>
          <Label>Offerte dès (g d’or)</Label>
          <TextInput
            value={free}
            onChangeText={setFree}
            keyboardType="decimal-pad"
            style={ui.input}
            accessibilityLabel="Livraison offerte dès"
          />
        </View>
      </View>
      <View style={{ gap: 6 }} testID="vendor-delivery-tiers">
        <Label>Livraison payée au vendeur, selon la valeur de la commande</Label>
        {tiers.map((t, i) => (
          <View key={i} style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <TextInput
              value={i === 0 ? '0' : t.from}
              editable={i > 0}
              onChangeText={(v) => setTiers((all) => all.map((x, j) => (j === i ? { ...x, from: v } : x)))}
              keyboardType="decimal-pad"
              placeholder="À partir de (€)"
              placeholderTextColor={colors.textMuted}
              style={[ui.input, { flex: 1 }, i === 0 && { opacity: 0.6 }]}
              accessibilityLabel={`Palier ${i + 1} : à partir de (euros)`}
            />
            <TextInput
              value={t.cost}
              onChangeText={(v) => setTiers((all) => all.map((x, j) => (j === i ? { ...x, cost: v } : x)))}
              keyboardType="decimal-pad"
              placeholder="Coût (€)"
              placeholderTextColor={colors.textMuted}
              style={[ui.input, { flex: 1 }]}
              accessibilityLabel={`Palier ${i + 1} : coût de la livraison (euros)`}
            />
            {i > 0 ? (
              <Pressable
                onPress={() => setTiers((all) => all.filter((_, j) => j !== i))}
                accessibilityLabel={`Retirer le palier ${i + 1}`}
              >
                <Text style={ui.link}>✕</Text>
              </Pressable>
            ) : (
              <View style={{ width: 16 }} />
            )}
          </View>
        ))}
        <Pressable
          onPress={() => setTiers((all) => [...all, { from: '', cost: '' }])}
          accessibilityRole="button"
          testID="add-delivery-tier"
        >
          <Text style={ui.link}>+ Ajouter un palier</Text>
        </Pressable>
        <Hint>
          Chaque ligne : à partir de ce montant de commande (l’or et sa prime payés au vendeur), la livraison vous coûte
          tant. Avec 12 € facturés au client, elle laisse la différence de marge (rien si elle est offerte ou en
          agence).
        </Hint>
      </View>
      <View style={styles.calc}>
        <Text style={styles.title}>Calculateur de prime vendeur</Text>
        <Pressable
          onPress={() => Linking.openURL(PREMIUM_CALCULATOR_URL).catch(() => {})}
          accessibilityRole="link"
          accessibilityLabel="Ouvrir le calculateur de prime de lingot-dor.fr"
          testID="premium-calculator-link"
        >
          <Text style={styles.link}>Calculateur de prime en ligne (lingot-dor.fr) ›</Text>
        </Pressable>
        <Hint>
          Sur la page du revendeur, choisissez « Livrer en France » et relevez le prix. Si elle affiche les frais en
          euros, saisissez-les aussi : le calcul est exact. Sinon, il compare le prix à la valeur de l’or du moment.
        </Hint>
        <View style={styles.chips}>
          {BAR_PRODUCTS.map((p) => (
            <Pressable
              key={p.id}
              onPress={() => setCalcId(p.id)}
              style={[styles.chip, p.id === calcId && styles.chipOn]}
              accessibilityRole="button"
              accessibilityState={{ selected: p.id === calcId }}
            >
              <Text style={[styles.chipText, p.id === calcId && { color: colors.gold }]}>
                {p.label
                  .replace(/ \(.*/, '')
                  .replace('Lingotin ', '')
                  .replace('Lingot ', '')
                  .replace('Napoléon 20 F', 'Napoléon')}
              </Text>
            </Pressable>
          ))}
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1, gap: 5 }}>
            <Label>Prix du site (€)</Label>
            <TextInput
              value={calcPrice}
              onChangeText={setCalcPrice}
              keyboardType="decimal-pad"
              placeholder="698,91"
              placeholderTextColor={colors.textMuted}
              style={ui.input}
              accessibilityLabel="Prix du site"
            />
          </View>
          <View style={{ flex: 1, gap: 5 }}>
            <Label>Frais du site (€)</Label>
            <TextInput
              value={calcFees}
              onChangeText={setCalcFees}
              keyboardType="decimal-pad"
              placeholder="42,83 (facultatif)"
              placeholderTextColor={colors.textMuted}
              style={ui.input}
              accessibilityLabel="Frais du site"
            />
          </View>
        </View>
        <Text style={styles.result} testID="calc-result">
          {calcRate === null
            ? 'Saisissez le prix pour calculer.'
            : `Prime vendeur : ${toText(calcRate)} % de la valeur de l’or`}
        </Text>
        <Button
          title={`Mettre dans Vendeur % (${calcProduct.label.replace(/ \(.*/, '')})`}
          variant="ghost"
          disabled={calcRate === null}
          onPress={() => {
            if (calcRate === null) return;
            setVendor((x) => ({ ...x, [calcId]: toText(calcRate) }));
            setMsg({ ok: true, text: 'Valeur placée dans la colonne Vendeur %. Enregistrez pour la garder.' });
          }}
        />
      </View>
      <Button title="Enregistrer les frais" onPress={save} disabled={!valid} />
      <Button title="Rétablir les valeurs par défaut" variant="ghost" onPress={reset} />
      {msg ? <Message {...msg} /> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.text, fontSize: 16, fontWeight: '700' },
  head: { flexDirection: 'row', gap: 8 },
  col: {
    color: colors.textMuted,
    fontSize: 11.5,
    fontWeight: '700',
    flexGrow: 1,
    flexBasis: 0,
    minWidth: 0,
    textTransform: 'uppercase',
  },
  line: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { color: colors.text, fontSize: 14, fontWeight: '600' },
  input: { flexGrow: 1, flexBasis: 0, minWidth: 0, paddingVertical: 9, paddingHorizontal: 10, fontSize: 15 },
  link: { color: colors.gold, fontSize: 13, fontWeight: '600' },
  calc: { gap: 8, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colors.surfaceAlt,
  },
  chipOn: { borderColor: colors.gold },
  chipText: { color: colors.text, fontSize: 13, fontWeight: '600' },
  result: { color: colors.text, fontSize: 14, fontWeight: '700' },
  margin: { color: colors.textMuted, fontSize: 12 },
  tiers: { color: colors.textMuted, fontSize: 11 },
  ranges: { flexDirection: 'row', gap: 6 },
  rangeBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: 'center',
    gap: 2,
  },
  rangeLabel: { color: colors.textMuted, fontSize: 11.5, fontWeight: '600', textAlign: 'center' },
  rangeValue: { color: colors.text, fontSize: 12.5, fontWeight: '700' },
});
