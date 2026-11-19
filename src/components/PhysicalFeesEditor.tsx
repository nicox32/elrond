import { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { formatEur, parseAmount } from '../logic/format';
import { formatDay, lotPriceOf, parseDay, sheetResult } from '../logic/godotCalc';
import { BAR_PRODUCTS, physicalFeesOf, PREMIUM_TARGET, rangesOf } from '../logic/physical';
import { addStock, assertInsuranceRoom } from '../logic/stock';
import { useAccount, useBank } from '../state/BankProvider';
import { colors } from '../theme';
import { InsuranceMeter } from './InsuranceMeter';
import { MarginAlert } from './MarginAlert';
import { Button, Card, Hint, Label, Message, styles as ui } from './ui';

const PREMIUM_CALCULATOR_URL = 'https://lingot-dor.fr/calculateur-prime-or';

const pct = (n: number | undefined) =>
  n === undefined ? '—' : `${(Math.round(n * 10000) / 100).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} %`;
const toText = (n: number | undefined) =>
  n === undefined ? '' : (Math.round(n * 10000) / 100).toLocaleString('fr-FR', { maximumFractionDigits: 2 });
const perGram = (g: number) => g.toLocaleString('fr-FR', { maximumFractionDigits: 3 });
const shortName = (label: string) => label.replace(/ \(.*/, '');

/**
 * Société Orvia : tarifs du retrait physique, verrouillés (non modifiables à la main), et commande à Godot & Fils par
 * lots avec son calculateur de prime.
 */
export function PhysicalFeesEditor({ part }: { part: 'client' | 'vendor' }) {
  const account = useAccount();
  const { quote, updateAccount } = useBank();
  const fees = physicalFeesOf(account.settings);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  // Calculateur de prime et de lot : relevé de prix par tranche, cours de l'or et date.
  const [calcId, setCalcId] = useState(BAR_PRODUCTS[1].id);
  const [calcDate, setCalcDate] = useState(() => formatDay(new Date()));
  // Valeur intrinsèque de la fiche (le métal d'une pièce, selon Godot & Fils) : le cours de l'or en découle.
  const [calcIntrinsic, setCalcIntrinsic] = useState('');
  const [calcPrices, setCalcPrices] = useState<string[]>(['', '', '', '', '']);
  const [lotQty, setLotQty] = useState('10');
  const calcProduct = BAR_PRODUCTS.find((p) => p.id === calcId) ?? BAR_PRODUCTS[0];
  const calcRanges = rangesOf(calcId);
  const defaultIntrinsic = Math.round(calcProduct.grams * quote.prices.gold * 100) / 100;
  const intrinsic = calcIntrinsic.trim() ? parseAmount(calcIntrinsic) : defaultIntrinsic;
  const calcGold = Math.round((intrinsic / calcProduct.grams) * 10000) / 10000;
  const calc = (() => {
    try {
      const sheet = {
        productId: calcId,
        gold: calcGold,
        prices: calcPrices.slice(0, calcRanges.length).map((x) => parseAmount(x)),
      };
      return { sheet, result: sheetResult(sheet), error: null as string | null };
    } catch (e) {
      return { sheet: null, result: null, error: e instanceof Error ? e.message : 'Relevé invalide.' };
    }
  })();

  if (part === 'client') {
    return (
      <Card style={{ gap: 10 }}>
        <Text style={styles.title}>🔒 Tarifs du retrait physique (verrouillés)</Text>
        <Hint>
          Ces valeurs ne se modifient pas à la main. Le client paie au plus le prix maximum tout compris de chaque
          format (fabrication, commission et livraison éventuelle comprises). La prime de Godot & Fils se calcule dans «
          Commande Godot & Fils ».
        </Hint>
        <View style={styles.head}>
          <Text style={[styles.col, { flexGrow: 1.4 }]}>Format</Text>
          <Text style={styles.col}>Client</Text>
          <Text style={styles.col}>Godot & Fils</Text>
        </View>
        {BAR_PRODUCTS.map((p) => {
          const client = fees.premiums[p.id];
          const vend = fees.vendor[p.id];
          const value = p.grams * quote.prices.gold;
          const target = PREMIUM_TARGET[p.id];
          return (
            <View key={p.id} style={{ gap: 2 }} testID={`locked-${p.id}`}>
              <View style={styles.line}>
                <Text style={[styles.name, { flexGrow: 1.4, flexBasis: 0, minWidth: 0 }]}>{shortName(p.label)}</Text>
                <Text style={[styles.name, styles.cell]}>{pct(client)}</Text>
                <Text style={[styles.name, styles.cell]}>{pct(vend)}</Text>
              </View>
              {(() => {
                if (vend === undefined) return <Text style={styles.margin}>Prime de Godot & Fils inconnue</Text>;
                // Une pièce seule : prix client moins prix payé à Godot & Fils et sa livraison.
                const net = value * (client - vend) - fees.vendorDelivery;
                return (
                  <Text style={[styles.margin, { color: net >= 0 ? colors.up : colors.down }]}>
                    {net >= 0 ? 'Marge' : 'Perte'} {net >= 0 ? '+' : '−'}
                    {formatEur(Math.abs(net))} par {p.coin ? 'pièce' : 'lingotin'} seul (livraison payée à Godot & Fils
                    comprise)
                    {target ? ` · prix max ${formatEur(value * (1 + target.max))} (${pct(target.max)})` : ''}
                  </Text>
                );
              })()}
            </View>
          );
        })}
        <Text style={styles.margin}>
          Livraison {fees.delivery} € par envoi, offerte dès {fees.freeFromGrams} g d’or · délais :{' '}
          {fees.leadDays.maison} j en stock Orvia, {fees.leadDays.pro} j stock Godot & Fils, {fees.leadDays.commande} j
          à commander.
        </Text>
      </Card>
    );
  }

  return (
    <Card style={{ gap: 12 }}>
      <Text style={styles.title}>Commande Godot & Fils</Text>
      <Hint>
        Orvia commande par lots (1 à 9, 10 à 19, 20 à 49, 50 et plus). Calculez la prime d’après la fiche de Godot &
        Fils, puis enregistrez le lot acheté : il entre au stock avec son prix, et les lingotins sortent du lot le plus
        ancien. Les primes et les tarifs sont verrouillés : le calcul ne les modifie pas.
      </Hint>
      <View style={styles.calc} testID="godot-calculator">
        <Text style={styles.title}>Calcul de prime</Text>
        <Pressable
          onPress={() => Linking.openURL(PREMIUM_CALCULATOR_URL).catch(() => {})}
          accessibilityRole="link"
          accessibilityLabel="Ouvrir le calculateur de prime de lingot-dor.fr"
          testID="premium-calculator-link"
        >
          <Text style={styles.link}>Calculateur de prime en ligne (lingot-dor.fr) ›</Text>
        </Pressable>
        <Hint>
          Relevez sur la fiche de Godot & Fils la « valeur intrinsèque » du format et son prix pour chaque tranche. Le
          calcul donne la prime de base et la remise de chaque tranche, comparées à la prime verrouillée.
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
                {shortName(p.label)
                  .replace('Lingotin ', '')
                  .replace('Lingot ', '')
                  .replace('Napoléon 20 F', 'Napoléon')}
              </Text>
            </Pressable>
          ))}
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1, gap: 5 }}>
            <Label>Date du relevé ou de l’achat</Label>
            <TextInput
              value={calcDate}
              onChangeText={setCalcDate}
              placeholder="JJ/MM/AAAA"
              placeholderTextColor={colors.textMuted}
              style={[ui.input, { minWidth: 0 }]}
              accessibilityLabel="Date du relevé"
            />
          </View>
          <View style={{ flex: 1, gap: 5 }}>
            <Label>Valeur intrinsèque de la fiche (€)</Label>
            <TextInput
              value={calcIntrinsic}
              onChangeText={setCalcIntrinsic}
              keyboardType="decimal-pad"
              placeholder={String(defaultIntrinsic).replace('.', ',')}
              placeholderTextColor={colors.textMuted}
              style={[ui.input, { minWidth: 0 }]}
              accessibilityLabel="Valeur intrinsèque de la fiche"
            />
          </View>
        </View>
        <Text style={styles.tiers} testID="godot-calc-gold">
          Cours de l’or déduit : {Number.isFinite(calcGold) ? perGram(calcGold) : '—'} €/g (
          {calcProduct.grams.toLocaleString('fr-FR', { maximumFractionDigits: 3 })} g d’or fin)
          {calcIntrinsic.trim() ? '' : ' · valeur du cours Orvia, à remplacer par celle de la fiche'}
        </Text>
        <Label>Prix de {shortName(calcProduct.label)} par pièce, métal compris (€)</Label>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {calcRanges.map((r, i) => (
            <View key={r.label} style={{ flexBasis: '47%', flexGrow: 1, gap: 4 }}>
              <Text style={styles.tiers}>{r.label} pièces</Text>
              <TextInput
                value={calcPrices[i]}
                onChangeText={(t) => setCalcPrices((all) => all.map((v, j) => (j === i ? t : v)))}
                keyboardType="decimal-pad"
                placeholder="€"
                placeholderTextColor={colors.textMuted}
                style={[ui.input, { minWidth: 0 }]}
                accessibilityLabel={`Prix ${r.label} pièces`}
              />
            </View>
          ))}
        </View>
        {calc.result ? (
          <View style={{ gap: 3 }} testID="godot-calc-result">
            <Text style={styles.result}>Prime de base : {toText(calc.result.premium)} % de la valeur de l’or</Text>
            <Text style={styles.tiers}>
              Remises :{' '}
              {calcRanges
                .slice(1)
                .map((r, k) => `${r.label} : ${toText(calc.result?.offs[k])} pt`)
                .join(' · ')}
            </Text>
            <Text style={styles.tiers}>
              Prime verrouillée de l’appli : {pct(fees.vendor[calcId])} · prix client : {pct(fees.premiums[calcId])}
            </Text>
            {calc.result.warnings.map((w) => (
              <Text key={w} style={[styles.tiers, { color: colors.warning }]}>
                {w}
              </Text>
            ))}
          </View>
        ) : (
          <Text style={styles.tiers}>{calc.error}</Text>
        )}
        <Label>Enregistrer un lot acheté à ce relevé</Label>
        <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
          <TextInput
            value={lotQty}
            onChangeText={setLotQty}
            keyboardType="number-pad"
            style={[ui.input, { flex: 1, minWidth: 0 }]}
            accessibilityLabel="Nombre de pièces du lot"
          />
          <Text style={[styles.tiers, { flex: 2 }]}>
            {calc.sheet && Number(lotQty) > 0
              ? `${formatEur(lotPriceOf(calc.sheet, Math.floor(Number(lotQty))))} par pièce (tranche ${
                  calcRanges[
                    Math.max(
                      0,
                      calcRanges.findIndex(
                        (r) =>
                          Math.floor(Number(lotQty)) >= r.from && (r.to === null || Math.floor(Number(lotQty)) <= r.to),
                      ),
                    )
                  ].label
                })`
              : ''}
          </Text>
        </View>
        {calc.sheet && Number(lotQty) > 0 ? (
          <MarginAlert
            productId={calcId}
            unitCost={lotPriceOf(calc.sheet, Math.floor(Number(lotQty)))}
            qty={Math.floor(Number(lotQty))}
            gold={calc.sheet.gold}
          />
        ) : null}
        <InsuranceMeter
          extraEur={
            calc.sheet && Number(lotQty) > 0
              ? Math.floor(Number(lotQty)) * lotPriceOf(calc.sheet, Math.floor(Number(lotQty)))
              : 0
          }
        />
        <Button
          title="Enregistrer ce lot au stock"
          variant="ghost"
          disabled={!calc.sheet || !(Math.floor(Number(lotQty)) > 0)}
          onPress={() => {
            try {
              if (!calc.sheet) return;
              const when = parseDay(calcDate);
              const q = Math.floor(Number(lotQty));
              const unit = lotPriceOf(calc.sheet, q);
              assertInsuranceRoom(account, quote.prices.gold, q * unit);
              updateAccount((a) =>
                addStock(
                  a,
                  {
                    product: calcId,
                    qty: q,
                    source: 'pro',
                    vault: 'Godot & Fils',
                    unitCost: unit,
                    goldPrice: calc.sheet!.gold,
                  },
                  when,
                ),
              );
              setMsg({
                ok: true,
                text: `Lot de ${q} enregistré au stock : ${formatEur(unit)} par pièce, or à ${perGram(calc.sheet.gold)} €/g, le ${formatDay(when)}.`,
              });
            } catch (e) {
              setMsg({ ok: false, text: e instanceof Error ? e.message : 'Impossible d’enregistrer ce lot.' });
            }
          }}
        />
      </View>
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
  cell: { flexGrow: 1, flexBasis: 0, minWidth: 0, textAlign: 'right' },
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
