import { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { formatEur, parseAmount } from '../logic/format';
import { BAR_PRODUCTS, normalizeDeliveryTiers, physicalFeesOf, PHYSICAL, QTY_RANGES } from '../logic/physical';
import { useAccount, useBank } from '../state/BankProvider';
import { formatDay, lotPriceOf, parseDay, sheetResult } from '../logic/godotCalc';
import { addStock, assertInsuranceRoom } from '../logic/stock';
import { colors } from '../theme';
import { InsuranceMeter } from './InsuranceMeter';
import { Button, Card, Hint, Label, Message, styles as ui } from './ui';

const PREMIUM_CALCULATOR_URL = 'https://lingot-dor.fr/calculateur-prime-or';

const toText = (n: number | undefined) =>
  n === undefined ? '' : (Math.round(n * 10000) / 100).toLocaleString('fr-FR', { maximumFractionDigits: 2 });
const perGram = (g: number) => g.toLocaleString('fr-FR', { maximumFractionDigits: 3 });
const toRate = (t: string) => Math.round(parseAmount(t) * 100) / 10000;

/** Société Orvia : frais du retrait physique (fabrication par format, prime du vendeur, livraison), réglables. */
export function PhysicalFeesEditor({ part }: { part: 'client' | 'vendor' }) {
  const account = useAccount();
  const { quote, updateSettings, updateAccount } = useBank();
  const fees = physicalFeesOf(account.settings);
  const [premiums, setPremiums] = useState<Record<string, string>>(() =>
    Object.fromEntries(BAR_PRODUCTS.map((p) => [p.id, toText(fees.premiums[p.id])])),
  );
  const [vendor, setVendor] = useState<Record<string, string>>(() =>
    Object.fromEntries(BAR_PRODUCTS.map((p) => [p.id, toText(fees.vendor[p.id])])),
  );
  // Remise du revendeur (points de %) pour chaque tranche de quantité : 10 à 19, 20 à 49, 50 et plus.
  const offsFrom = (t: { from: number; off: number }[] = []) =>
    QTY_RANGES.slice(1).map((r) => toText(t.find((x) => x.from === r.from)?.off ?? 0));
  const offsOf = (id: string) => offsFrom(fees.vendorTiers[id]);
  const [offs, setOffs] = useState<Record<string, string[]>>(() =>
    Object.fromEntries(BAR_PRODUCTS.map((p) => [p.id, offsOf(p.id)])),
  );
  const [range, setRange] = useState<Record<string, number>>({});
  const [lead, setLead] = useState({
    maison: String(fees.leadDays.maison),
    pro: String(fees.leadDays.pro),
    commande: String(fees.leadDays.commande),
  });
  const [delivery, setDelivery] = useState(String(fees.delivery).replace('.', ','));
  const [free, setFree] = useState(String(fees.freeFromGrams).replace('.', ','));
  const [tiers, setTiers] = useState<{ from: string; cost: string }[]>(() =>
    fees.vendorDeliveryTiers.map((t) => ({
      from: String(t.fromEur).replace('.', ','),
      cost: String(t.cost).replace('.', ','),
    })),
  );
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  // Calculateur de commande Godot & Fils : relevé de prix par tranche, cours de l'or et date.
  const [calcId, setCalcId] = useState(BAR_PRODUCTS[1].id);
  const [calcDate, setCalcDate] = useState(() => formatDay(new Date()));
  // Valeur intrinsèque de la fiche (le métal d'une pièce, selon Godot & Fils) : le cours de l'or en découle.
  const [calcIntrinsic, setCalcIntrinsic] = useState('');
  const [calcPrices, setCalcPrices] = useState<string[]>(['', '', '', '']);
  const [lotQty, setLotQty] = useState('10');
  const calcProduct = BAR_PRODUCTS.find((p) => p.id === calcId) ?? BAR_PRODUCTS[0];
  const defaultIntrinsic = Math.round(calcProduct.grams * quote.prices.gold * 100) / 100;
  const intrinsic = calcIntrinsic.trim() ? parseAmount(calcIntrinsic) : defaultIntrinsic;
  const calcGold = Math.round((intrinsic / calcProduct.grams) * 10000) / 10000;
  const calc = (() => {
    try {
      const sheet = {
        productId: calcId,
        gold: calcGold,
        prices: calcPrices.map((x) => parseAmount(x)) as [number, number, number, number],
      };
      return { sheet, result: sheetResult(sheet), error: null as string | null };
    } catch (e) {
      return { sheet: null, result: null, error: e instanceof Error ? e.message : 'Relevé invalide.' };
    }
  })();

  const validClient =
    BAR_PRODUCTS.every((p) => {
      const r = toRate(premiums[p.id]);
      return r >= 0 && r <= 0.5;
    }) &&
    parseAmount(delivery) >= 0 &&
    parseAmount(delivery) <= 200 &&
    parseAmount(free) >= 0 &&
    parseAmount(free) <= 1000 &&
    Object.values(lead).every((v) => parseAmount(v) >= 1 && parseAmount(v) <= 60);
  const validVendor =
    BAR_PRODUCTS.every((p) => {
      const v = vendor[p.id].trim() ? toRate(vendor[p.id]) : 0;
      return v >= 0 && v <= 0.5;
    }) && tiers.every((t) => parseAmount(t.cost) >= 0 && parseAmount(t.cost) <= 500 && parseAmount(t.from) >= 0);

  function save() {
    const cur = account.settings.physicalFees ?? {};
    if (part === 'client') {
      const prem: Record<string, number> = {};
      for (const p of BAR_PRODUCTS) prem[p.id] = toRate(premiums[p.id]);
      updateSettings({
        physicalFees: {
          ...cur,
          premiums: prem,
          delivery: parseAmount(delivery),
          freeFromGrams: parseAmount(free),
          leadDays: {
            maison: Math.round(parseAmount(lead.maison)),
            pro: Math.round(parseAmount(lead.pro)),
            commande: Math.round(parseAmount(lead.commande)),
          },
        },
      });
      setMsg({
        ok: true,
        text: 'Frais enregistrés : ils s’appliquent aux prochains retraits, aux Tarifs et à l’accueil.',
      });
      return;
    }
    const vend: Record<string, number> = {};
    for (const p of BAR_PRODUCTS) if (vendor[p.id].trim()) vend[p.id] = toRate(vendor[p.id]);
    updateSettings({
      physicalFees: {
        ...cur,
        vendor: vend,
        vendorTiers: Object.fromEntries(
          BAR_PRODUCTS.map((p) => [
            p.id,
            QTY_RANGES.slice(1).map((r, i) => ({ from: r.from, off: Math.max(0, toRate(offs[p.id][i] || '0')) })),
          ]),
        ),
        vendorDeliveryTiers: normalizeDeliveryTiers(
          tiers.map((t) => ({ fromEur: parseAmount(t.from), cost: parseAmount(t.cost) })),
          PHYSICAL.vendorDelivery,
        ),
      },
    });
    setMsg({ ok: true, text: 'Commande Godot & Fils enregistrée : elle sert au coût et à la marge.' });
  }

  function reset() {
    const cur: Record<string, unknown> = { ...(account.settings.physicalFees ?? {}) };
    const drop =
      part === 'client'
        ? ['premiums', 'delivery', 'freeFromGrams', 'leadDays']
        : ['vendor', 'vendorTiers', 'vendorDeliveryTiers', 'vendorDelivery'];
    for (const k of drop) delete cur[k];
    updateSettings({
      physicalFees: Object.keys(cur).length ? (cur as typeof account.settings.physicalFees) : undefined,
    });
    const d = physicalFeesOf({ physicalFees: cur as typeof account.settings.physicalFees });
    if (part === 'client') {
      setPremiums(Object.fromEntries(BAR_PRODUCTS.map((p) => [p.id, toText(d.premiums[p.id])])));
      setDelivery(String(PHYSICAL.delivery));
      setFree(String(PHYSICAL.freeDeliveryFromGrams));
      setLead({
        maison: String(PHYSICAL.leadDays.maison),
        pro: String(PHYSICAL.leadDays.pro),
        commande: String(PHYSICAL.leadDays.commande),
      });
    } else {
      setVendor(Object.fromEntries(BAR_PRODUCTS.map((p) => [p.id, toText(d.vendor[p.id])])));
      setOffs(Object.fromEntries(BAR_PRODUCTS.map((p) => [p.id, offsFrom(d.vendorTiers[p.id])])));
      setTiers(
        d.vendorDeliveryTiers.map((t) => ({
          from: String(t.fromEur).replace('.', ','),
          cost: String(t.cost).replace('.', ','),
        })),
      );
    }
    setMsg({ ok: true, text: 'Valeurs par défaut rétablies.' });
  }

  if (part === 'client') {
    return (
      <Card style={{ gap: 12 }}>
        <Text style={styles.title}>Frais du retrait physique</Text>
        <Hint>
          Ce que paie le client pour chaque format (fabrication ou prime, en % de la valeur de l’or), la livraison et le
          seuil de livraison offerte. Ce que vous payez à Godot & Fils se règle dans « Commande Godot & Fils ».
        </Hint>
        <View style={styles.head}>
          <Text style={[styles.col, { flexGrow: 1.4 }]}>Format</Text>
          <Text style={styles.col}>Client %</Text>
        </View>
        {BAR_PRODUCTS.map((p) => {
          const client = toRate(premiums[p.id]);
          const vend = fees.vendor[p.id];
          const value = p.grams * quote.prices.gold;
          const margin = vend === undefined || !Number.isFinite(client) ? null : value * (client - vend);
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
              </View>
              <Text style={[styles.margin, margin !== null && { color: margin >= 0 ? colors.up : colors.down }]}>
                {margin === null
                  ? 'Prime de Godot & Fils inconnue : marge non calculée'
                  : `Marge de base ${margin >= 0 ? '+' : '−'}${formatEur(Math.abs(margin))} par ${p.coin ? 'pièce' : 'lingotin'}`}
              </Text>
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
        <Label>Délai de livraison (jours)</Label>
        <View style={{ flexDirection: 'row', gap: 8 }} testID="lead-days">
          {(
            [
              ['maison', 'En stock Orvia'],
              ['pro', 'Stock Godot & Fils'],
              ['commande', 'À commander'],
            ] as const
          ).map(([k, label]) => (
            <View key={k} style={{ flex: 1, gap: 4 }}>
              <Text style={styles.tiers}>{label}</Text>
              <TextInput
                value={lead[k]}
                onChangeText={(t) => setLead((x) => ({ ...x, [k]: t }))}
                keyboardType="number-pad"
                style={[ui.input, { minWidth: 0 }]}
                accessibilityLabel={`Délai ${label}`}
              />
            </View>
          ))}
        </View>
        <Hint>
          La livraison est plus rapide quand les lingotins sont déjà chez Orvia. Le client voit le délai le plus long de
          sa commande avant de la passer, et le suivi s’y adapte.
        </Hint>
        <Button title="Enregistrer les frais" onPress={save} disabled={!validClient} />
        <Button title="Rétablir les valeurs par défaut" variant="ghost" onPress={reset} />
        {msg ? <Message {...msg} /> : null}
      </Card>
    );
  }

  return (
    <Card style={{ gap: 12 }}>
      <Text style={styles.title}>Commande Godot & Fils</Text>
      <Hint>
        Ce que vous payez à Godot & Fils : la prime de chaque format (1 à 9 pièces), la remise selon la taille du lot
        commandé (mêmes tranches pour tous : 1 à 9, 10 à 19, 20 à 49, 50 et plus) et la livraison. Orvia commande par
        lots : chaque lot est enregistré au stock avec son prix, et les lingotins sortent du lot le plus ancien.
      </Hint>
      <View style={styles.head}>
        <Text style={[styles.col, { flexGrow: 1.4 }]}>Format</Text>
        <Text style={styles.col}>Prime vendeur %</Text>
      </View>
      {BAR_PRODUCTS.map((p) => {
        const client = fees.premiums[p.id];
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
                <Text style={styles.tiers}>Marge par pièce selon la taille du lot commandé à Godot & Fils :</Text>
                <View style={styles.ranges}>
                  {QTY_RANGES.map((r, i) => {
                    const off = i === 0 ? 0 : Math.max(0, toRate(offs[p.id][i - 1] || '0'));
                    const m = margin + off * value;
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
                  <Text style={styles.tiers}>1 à 9 pièces : prix de base, colonne « Prime vendeur % ».</Text>
                ) : (
                  <View style={{ gap: 4 }}>
                    <Label>Remise de Godot & Fils de {QTY_RANGES[range[p.id]].label} pièces (points de %)</Label>
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
                      accessibilityLabel={`Remise de Godot & Fils ${p.label} ${QTY_RANGES[range[p.id]].label} pièces`}
                    />
                    <Text style={styles.tiers}>
                      Elle baisse le prix d’un lot de cette taille : tout reste à Orvia, le client paie la même
                      fabrication.
                    </Text>
                  </View>
                )}
              </View>
            )}
          </View>
        );
      })}
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
              style={[ui.input, { flex: 1, minWidth: 0 }, i === 0 && { opacity: 0.6 }]}
              accessibilityLabel={`Palier ${i + 1} : à partir de (euros)`}
            />
            <TextInput
              value={t.cost}
              onChangeText={(v) => setTiers((all) => all.map((x, j) => (j === i ? { ...x, cost: v } : x)))}
              keyboardType="decimal-pad"
              placeholder="Coût (€)"
              placeholderTextColor={colors.textMuted}
              style={[ui.input, { flex: 1, minWidth: 0 }]}
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
      <View style={styles.calc} testID="godot-calculator">
        <Text style={styles.title}>Calculateur de commande</Text>
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
          calculateur règle la prime de base et la remise de chaque tranche, et peut enregistrer un lot acheté avec sa
          date et son prix.
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
        <Label>Prix de {calcProduct.label.replace(/ \(.*/, '')} par pièce, métal compris (€)</Label>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {QTY_RANGES.map((r, i) => (
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
              Remises : 10 à 19 : {toText(calc.result.offs[0])} pt · 20 à 49 : {toText(calc.result.offs[1])} pt · 50 et
              plus : {toText(calc.result.offs[2])} pt
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
        <Button
          title={`Régler ${calcProduct.label.replace(/ \(.*/, '')} avec ce relevé`}
          variant="ghost"
          disabled={!calc.result}
          onPress={() => {
            const r = calc.result;
            if (!r) return;
            setVendor((x) => ({ ...x, [calcId]: toText(r.premium) }));
            setOffs((x) => ({ ...x, [calcId]: r.offs.map((o) => toText(o)) }));
            setMsg({
              ok: true,
              text: 'Prime et remises réglées pour ce format. Appuyez sur Enregistrer pour les garder.',
            });
          }}
        />
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
                  QTY_RANGES[
                    Math.max(
                      0,
                      QTY_RANGES.findIndex(
                        (r) =>
                          Math.floor(Number(lotQty)) >= r.from && (r.to === null || Math.floor(Number(lotQty)) <= r.to),
                      ),
                    )
                  ].label
                })`
              : ''}
          </Text>
        </View>
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
      <Button title="Enregistrer" onPress={save} disabled={!validVendor} />
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
