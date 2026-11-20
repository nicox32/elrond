import { useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { formatDate, formatEur, parseAmount } from '../logic/format';
import { LedgerError } from '../logic/ledger';
import { BAR_PRODUCTS, lotUnitCost, physicalFeesOf, productOf } from '../logic/physical';
import {
  assertInsuranceRoom,
  insuranceStatus,
  addSerialsToLot,
  addStock,
  adjustStock,
  clearStock,
  MAX_BATCH,
  parseSerials,
  removeLot,
  stockSummary,
} from '../logic/stock';
import type { StockLot } from '../logic/types';
import { useAccount, useBank } from '../state/BankProvider';
import { colors } from '../theme';
import { BarImage } from './BarImage';
import { InsuranceMeter } from './InsuranceMeter';
import { MarginAlert } from './MarginAlert';
import { Segmented } from './Segmented';
import { Banner, Button, Card, Hint, KeyValue, Label, Message, SectionTitle, styles as ui } from './ui';

const QUICK = [1, 10, 50, 100];

/** Demande une confirmation avant une suppression (fenêtre du navigateur sur le web, alerte sur le téléphone). */
function confirmAction(text: string, onYes: () => void) {
  if (Platform.OS === 'web') {
    if (window.confirm(text)) onYes();
  } else {
    Alert.alert('Confirmer', text, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: onYes },
    ]);
  }
}
const SOURCE_LABEL = { maison: 'Orvia', pro: 'Godot & Fils' } as const;
const shortName = (id: string) => productOf(id).label.replace(/ \(.*/, '');

/** Société Orvia › Stock : lots de lingotins et de pièces (x1, x10, x100…), chez Orvia ou chez un pro (revendeur). */
export function StockManager({ onBack }: { onBack: () => void }) {
  const account = useAccount();
  const { updateAccount, updateSettings, quote } = useBank();
  const [product, setProduct] = useState(BAR_PRODUCTS[1].id);
  const [qty, setQty] = useState('10');
  const [source, setSource] = useState<'maison' | 'pro'>('maison');
  const [vault, setVault] = useState('');
  const [cost, setCost] = useState('');
  const [total, setTotal] = useState('');
  const [serials, setSerials] = useState('');
  const [note, setNote] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [lotSerials, setLotSerials] = useState<Record<string, string>>({});

  const insurance = insuranceStatus(account, quote.prices.gold);
  const [capText, setCapText] = useState(String(insurance.cap).replace('.', ','));
  const lots = (account.stock ?? []).filter((l) => l.qty > 0 || (l.serials?.length ?? 0) > 0);
  const summary = stockSummary(account);
  const n = Math.floor(parseAmount(qty));
  const list = parseSerials(serials);
  const coin = productOf(product).coin;
  const expectedLot = lotUnitCost(
    product,
    Number.isFinite(n) && n > 0 ? n : 1,
    quote.prices.gold,
    physicalFeesOf(account.settings),
  );

  // Prix d'une pièce : total de la facture du lot ÷ nombre de pièces, sinon prix saisi par pièce, sinon prix attendu.
  const unitPaid = (): number | undefined => {
    if (total.trim()) {
      const t = parseAmount(total);
      return t > 0 && n > 0 ? Math.round((t / n) * 10000) / 10000 : undefined;
    }
    return cost.trim() ? parseAmount(cost) : undefined;
  };

  function add() {
    try {
      if (total.trim() && unitPaid() === undefined)
        throw new LedgerError('Indiquez un total de facture et un nombre de pièces valides.');
      const unit = unitPaid() ?? expectedLot;
      assertInsuranceRoom(account, quote.prices.gold, (Number.isFinite(n) ? n : 0) * unit);
      updateAccount((a) =>
        addStock(a, {
          product,
          qty: n,
          source,
          vault,
          unitCost: unitPaid(),
          goldPrice: quote.prices.gold,
          serials: list,
          note,
        }),
      );
      setMsg({
        ok: true,
        text: `${n} × ${shortName(product).toLowerCase()} ajouté${n > 1 ? 's' : ''} au stock : ${SOURCE_LABEL[source]}.`,
      });
      setSerials('');
      setNote('');
      setTotal('');
    } catch (e) {
      setMsg({ ok: false, text: e instanceof LedgerError ? e.message : 'Ajout impossible.' });
    }
  }

  function addSerials(lot: StockLot) {
    const list = parseSerials(lotSerials[lot.id] ?? '');
    try {
      updateAccount((a) => addSerialsToLot(a, lot.id, list));
      setLotSerials((c) => ({ ...c, [lot.id]: '' }));
      setMsg({
        ok: true,
        text: `${list.length} numéro${list.length > 1 ? 's' : ''} ajouté${list.length > 1 ? 's' : ''} au lot.`,
      });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof LedgerError ? e.message : 'Ajout impossible.' });
    }
  }

  function recount(lot: StockLot) {
    const v = Math.floor(parseAmount(counts[lot.id] ?? ''));
    try {
      updateAccount((a) => adjustStock(a, lot.id, v));
      setCounts((c) => ({ ...c, [lot.id]: '' }));
      setMsg({ ok: true, text: 'Inventaire noté au journal.' });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof LedgerError ? e.message : 'Inventaire impossible.' });
    }
  }

  return (
    <>
      <Button title="← Espace DEV" variant="ghost" onPress={onBack} />
      <Hint>
        Le stock des lingotins et pièces, par lot : chez Orvia, ou chez Godot & Fils qui les garde pour vous. Quand un
        client retire de l’or, l’appli prend d’abord dans le stock d’Orvia, puis chez Godot & Fils ; sans stock, il faut
        commander chez Godot & Fils.
      </Hint>

      <Banner icon="ℹ️">
        La garde des lingotins en coffre sécurisé chez Godot & Fils est refacturée au client au coût (0,04 € par mois et
        par gramme). L’assurance couvre ce que vous commandez et gardez en stock, jusqu’au plafond ci-dessous.
      </Banner>

      <SectionTitle>Assurance du stock</SectionTitle>
      <Card style={{ gap: 6 }}>
        <KeyValue
          label="Valeur du stock assuré"
          value={`${formatEur(insurance.value)} sur ${formatEur(insurance.cap)}`}
          strong
        />
        <InsuranceMeter />
        <Label>Plafond de l’assurance (€)</Label>
        <TextInput
          value={capText}
          onChangeText={(t) => {
            setCapText(t);
            const v = parseAmount(t);
            if (Number.isFinite(v) && v >= 0) updateSettings({ insuranceCapEur: v });
          }}
          keyboardType="decimal-pad"
          style={ui.input}
          accessibilityLabel="Plafond de l’assurance"
        />
      </Card>
      <SectionTitle>En stock</SectionTitle>
      <Card style={{ gap: 8 }}>
        {BAR_PRODUCTS.map((b) => {
          const r = summary.find((x) => x.product === b.id);
          return (
            <View key={b.id} style={styles.sumRow} testID={`stock-${b.id}`}>
              <BarImage product={b.id} size={34} />
              <Text style={styles.name}>{shortName(b.id)}</Text>
              <Text style={[styles.sum, !r?.total && { color: colors.textMuted }]}>
                {r?.total ? `${r.total}${r.pro ? ` (dont ${r.pro} chez le pro)` : ''}` : 'aucun'}
              </Text>
            </View>
          );
        })}
      </Card>

      <SectionTitle>Ajouter un lot</SectionTitle>
      <Card style={{ gap: 10 }}>
        <View style={styles.chips}>
          {BAR_PRODUCTS.map((b) => (
            <Pressable
              key={b.id}
              onPress={() => setProduct(b.id)}
              style={[styles.chip, b.id === product && styles.chipOn]}
              accessibilityRole="button"
              accessibilityState={{ selected: b.id === product }}
            >
              <Text style={[styles.chipText, b.id === product && { color: colors.gold }]}>
                {shortName(b.id).replace('Lingotin ', '').replace('Lingot ', '').replace('Napoléon 20 F', 'Napoléon')}
              </Text>
            </Pressable>
          ))}
        </View>
        <Label>Quantité</Label>
        <View style={styles.chips}>
          {QUICK.map((q) => (
            <Pressable
              key={q}
              onPress={() => setQty(String(q))}
              style={[styles.chip, String(q) === qty.trim() && styles.chipOn]}
              accessibilityRole="button"
            >
              <Text style={[styles.chipText, String(q) === qty.trim() && { color: colors.gold }]}>× {q}</Text>
            </Pressable>
          ))}
        </View>
        <TextInput
          value={qty}
          onChangeText={setQty}
          keyboardType="number-pad"
          style={ui.input}
          accessibilityLabel="Quantité du lot"
        />
        <Segmented
          value={source}
          onChange={setSource}
          options={[
            { value: 'maison', label: 'Orvia' },
            { value: 'pro', label: 'Godot & Fils' },
          ]}
        />
        {source === 'pro' && (
          <TextInput
            value={vault}
            onChangeText={setVault}
            placeholder="Lieu de garde (ex. Godot & Fils, Albi)"
            placeholderTextColor={colors.textMuted}
            style={ui.input}
            accessibilityLabel="Lieu de garde chez Godot & Fils"
          />
        )}
        {source === 'pro' || source === 'maison' ? (
          <Pressable
            onPress={() => setCost(String(Math.round(expectedLot * 100) / 100).replace('.', ','))}
            accessibilityRole="button"
            testID="use-expected-lot-price"
          >
            <Text style={ui.link}>
              Prix attendu chez Godot & Fils pour un lot de {Number.isFinite(n) && n > 0 ? n : 1} :{' '}
              {formatEur(expectedLot)} par pièce, métal compris (utiliser)
            </Text>
          </Pressable>
        ) : null}
        <TextInput
          value={cost}
          onChangeText={setCost}
          keyboardType="decimal-pad"
          placeholder="Prix payé par pièce, métal compris (facture)"
          placeholderTextColor={colors.textMuted}
          style={ui.input}
          accessibilityLabel="Prix payé par exemplaire"
        />
        <TextInput
          value={total}
          onChangeText={setTotal}
          keyboardType="decimal-pad"
          placeholder="ou Prix total de la facture du lot (livraison non comprise)"
          placeholderTextColor={colors.textMuted}
          style={ui.input}
          accessibilityLabel="Prix total de la facture du lot"
        />
        {total.trim() && unitPaid() !== undefined ? (
          <Text style={ui.hint} testID="stock-unit-from-total">
            Soit {formatEur(unitPaid() ?? 0)} par pièce d’après la facture.
          </Text>
        ) : null}
        <InsuranceMeter
          extraEur={
            (Number.isFinite(n) && n > 0 ? n : 0) * (unitPaid() ?? (cost.trim() ? parseAmount(cost) || 0 : expectedLot))
          }
        />
        {source === 'pro' || cost.trim() || total.trim() ? (
          <MarginAlert
            productId={product}
            unitCost={unitPaid() ?? expectedLot}
            qty={Number.isFinite(n) ? n : 0}
            gold={quote.prices.gold}
          />
        ) : null}
        <Label>
          {coin ? 'Millésimes connus (un par ligne, facultatif)' : 'Numéros de série connus (un par ligne)'}
        </Label>
        <TextInput
          value={serials}
          onChangeText={setSerials}
          multiline
          autoCapitalize="characters"
          placeholder={coin ? 'Un millésime par ligne' : 'C + 6 chiffres, un par ligne'}
          placeholderTextColor={colors.textMuted}
          style={[ui.input, { minHeight: 72, textAlignVertical: 'top' }]}
          accessibilityLabel="Numéros de série du lot"
        />
        <Text style={ui.hint}>
          {list.length
            ? `${list.length} numéro${list.length > 1 ? 's' : ''} sur ${Number.isFinite(n) ? n : 0}. Les autres seront notés à l’expédition.`
            : 'Vous pouvez laisser vide : chaque numéro sera noté à l’expédition ou à la réception.'}
        </Text>
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="Note (facultatif)"
          placeholderTextColor={colors.textMuted}
          style={ui.input}
          accessibilityLabel="Note du lot"
        />
        <Button
          title={`Ajouter ${Number.isFinite(n) && n > 0 ? n : ''} au stock`.replace('  ', ' ')}
          onPress={add}
          disabled={!(n >= 1 && n <= MAX_BATCH)}
        />
        {msg ? <Message {...msg} /> : null}
      </Card>

      <SectionTitle>Lots</SectionTitle>
      {lots.length === 0 ? (
        <Banner icon="ℹ️">Aucun lot en stock. Les retraits des clients sont commandés chez Godot & Fils.</Banner>
      ) : (
        lots.map((l) => (
          <Card key={l.id} style={{ gap: 6 }}>
            <View style={styles.sumRow}>
              <BarImage product={l.product} size={34} />
              <Text style={[styles.name, { flex: 1 }]}>
                {l.qty} / {l.qtyInitial} × {shortName(l.product)}
              </Text>
            </View>
            <KeyValue
              label="Lieu"
              value={l.source === 'pro' ? `Godot & Fils${l.vault ? ` · ${l.vault}` : ''}` : 'Orvia'}
            />
            <KeyValue label="Entré le" value={formatDate(l.addedAt)} />
            {l.serials?.length ? <KeyValue label="N° connus restants" value={String(l.serials.length)} /> : null}
            {l.note ? <Text style={ui.hint}>{l.note}</Text> : null}
            {l.qty > (l.serials?.length ?? 0) && (
              <View style={{ gap: 6 }}>
                <TextInput
                  value={lotSerials[l.id] ?? ''}
                  onChangeText={(t) => setLotSerials((c) => ({ ...c, [l.id]: t }))}
                  multiline
                  autoCapitalize="characters"
                  placeholder="Collez ici la liste des numéros de Godot & Fils (un par ligne)"
                  placeholderTextColor={colors.textMuted}
                  style={[ui.input, { minHeight: 56, textAlignVertical: 'top' }]}
                  accessibilityLabel="Numéros de série à ajouter au lot"
                />
                <Button
                  title="Ajouter ces numéros au lot"
                  variant="ghost"
                  onPress={() => addSerials(l)}
                  disabled={!parseSerials(lotSerials[l.id] ?? '').length}
                />
              </View>
            )}
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              <TextInput
                value={counts[l.id] ?? ''}
                onChangeText={(t) => setCounts((c) => ({ ...c, [l.id]: t }))}
                keyboardType="number-pad"
                placeholder="Inventaire : nombre compté"
                placeholderTextColor={colors.textMuted}
                style={[ui.input, { flex: 1, minWidth: 0 }]}
                accessibilityLabel="Nombre compté"
              />
              <View style={{ minWidth: 96 }}>
                <Button
                  title="Noter"
                  variant="ghost"
                  onPress={() => recount(l)}
                  disabled={!Number.isFinite(parseAmount(counts[l.id] ?? ''))}
                />
              </View>
            </View>
            <Button
              title={l.qty === 0 ? 'Retirer ce lot vide' : 'Supprimer ce lot'}
              variant="ghost"
              onPress={() =>
                confirmAction(
                  l.qty === 0
                    ? 'Retirer ce lot vide ?'
                    : `Supprimer ce lot de ${l.qty} exemplaire${l.qty > 1 ? 's' : ''} ?`,
                  () => updateAccount((a) => removeLot(a, l.id)),
                )
              }
            />
          </Card>
        ))
      )}

      {(account.stock ?? []).length > 0 && (
        <Button
          title="Effacer tout le stock et son journal"
          variant="danger"
          onPress={() =>
            confirmAction(
              'Effacer tous les lots et le journal du stock ? Les lingotins déjà donnés à vos clients ne changent pas.',
              () => {
                updateAccount((a) => clearStock(a));
                setMsg({ ok: true, text: 'Stock effacé.' });
              },
            )
          }
        />
      )}

      <SectionTitle>Journal</SectionTitle>
      <Card style={{ gap: 6 }}>
        {(account.stockLog ?? []).slice(0, 15).map((m) => (
          <View key={m.id} style={{ gap: 1 }}>
            <Text style={styles.name}>
              {m.qty > 0 ? '+' : '−'}
              {Math.abs(m.qty)} × {shortName(m.product)} ·{' '}
              {m.kind === 'in' ? 'entrée' : m.kind === 'out' ? 'sortie client' : 'inventaire'}
            </Text>
            <Text style={ui.hint}>
              {formatDate(m.date)} · {SOURCE_LABEL[m.source]}
              {m.note ? ` · ${m.note}` : ''}
            </Text>
          </View>
        ))}
        {!(account.stockLog ?? []).length && <Text style={ui.hint}>Aucun mouvement pour le moment.</Text>}
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  meter: { flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden', backgroundColor: colors.surfaceAlt },
  meterFill: { backgroundColor: colors.gold },
  sumRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  name: { color: colors.text, fontSize: 14, fontWeight: '600' },
  sum: { color: colors.text, fontSize: 14, fontWeight: '700', marginLeft: 'auto' },
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
});
