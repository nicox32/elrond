import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { formatDate, parseAmount } from '../logic/format';
import { LedgerError } from '../logic/ledger';
import { BAR_PRODUCTS, productOf } from '../logic/physical';
import { addStock, adjustStock, MAX_BATCH, parseSerials, removeLot, stockSummary } from '../logic/stock';
import type { StockLot } from '../logic/types';
import { useAccount, useBank } from '../state/BankProvider';
import { colors } from '../theme';
import { BarImage } from './BarImage';
import { Segmented } from './Segmented';
import { Banner, Button, Card, Hint, KeyValue, Label, Message, SectionTitle, styles as ui } from './ui';

const QUICK = [1, 10, 50, 100];
const SOURCE_LABEL = { maison: 'Chez la société', pro: 'Coffre professionnel' } as const;
const shortName = (id: string) => productOf(id).label.replace(/ \(.*/, '');

/** Société Orvia › Stock : lots de lingotins et de pièces (x1, x10, x100…), chez la société ou en coffre pro. */
export function StockManager({ onBack }: { onBack: () => void }) {
  const account = useAccount();
  const { updateAccount } = useBank();
  const [product, setProduct] = useState(BAR_PRODUCTS[1].id);
  const [qty, setQty] = useState('10');
  const [source, setSource] = useState<'maison' | 'pro'>('maison');
  const [vault, setVault] = useState('');
  const [cost, setCost] = useState('');
  const [serials, setSerials] = useState('');
  const [note, setNote] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [counts, setCounts] = useState<Record<string, string>>({});

  const lots = (account.stock ?? []).filter((l) => l.qty > 0 || (l.serials?.length ?? 0) > 0);
  const summary = stockSummary(account);
  const n = Math.floor(parseAmount(qty));
  const list = parseSerials(serials);
  const coin = productOf(product).coin;

  function add() {
    try {
      updateAccount((a) =>
        addStock(a, {
          product,
          qty: n,
          source,
          vault,
          unitCost: cost.trim() ? parseAmount(cost) : undefined,
          serials: list,
          note,
        }),
      );
      setMsg({
        ok: true,
        text: `${n} × ${shortName(product).toLowerCase()} ajouté${n > 1 ? 's' : ''} au stock (${SOURCE_LABEL[source].toLowerCase()}).`,
      });
      setSerials('');
      setNote('');
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
      <Button title="← Société Orvia" variant="ghost" onPress={onBack} />
      <Hint>
        Le stock des lingotins et pièces que la société détient, par lot. Quand un client retire de l’or, l’appli prend
        d’abord dans le stock de la société, puis dans le coffre professionnel ; sans stock, il faut commander chez le
        revendeur.
      </Hint>

      <SectionTitle>En stock</SectionTitle>
      <Card style={{ gap: 8 }}>
        {BAR_PRODUCTS.map((b) => {
          const r = summary.find((x) => x.product === b.id);
          return (
            <View key={b.id} style={styles.sumRow} testID={`stock-${b.id}`}>
              <BarImage product={b.id} size={34} />
              <Text style={styles.name}>{shortName(b.id)}</Text>
              <Text style={[styles.sum, !r?.total && { color: colors.textMuted }]}>
                {r?.total ? `${r.total}${r.pro ? ` (dont ${r.pro} en coffre pro)` : ''}` : 'aucun'}
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
            { value: 'maison', label: 'Chez la société' },
            { value: 'pro', label: 'Coffre pro' },
          ]}
        />
        {source === 'pro' && (
          <TextInput
            value={vault}
            onChangeText={setVault}
            placeholder="Nom du coffre (ex. Gold Avenue)"
            placeholderTextColor={colors.textMuted}
            style={ui.input}
            accessibilityLabel="Nom du coffre professionnel"
          />
        )}
        <TextInput
          value={cost}
          onChangeText={setCost}
          keyboardType="decimal-pad"
          placeholder="Prix payé par pièce, métal compris (facultatif)"
          placeholderTextColor={colors.textMuted}
          style={ui.input}
          accessibilityLabel="Prix payé par exemplaire"
        />
        <Label>
          {coin ? 'Millésimes connus (un par ligne, facultatif)' : 'Numéros de série connus (un par ligne)'}
        </Label>
        <TextInput
          value={serials}
          onChangeText={setSerials}
          multiline
          autoCapitalize="characters"
          placeholder={coin ? '1910\n1912' : 'C123456\nC123457'}
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
        <Banner icon="ℹ️">Aucun lot en stock. Les retraits des clients sont commandés chez le revendeur.</Banner>
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
              value={l.source === 'pro' ? `Coffre pro${l.vault ? ` · ${l.vault}` : ''}` : 'Chez la société'}
            />
            <KeyValue label="Entré le" value={formatDate(l.addedAt)} />
            {l.serials?.length ? <KeyValue label="N° connus restants" value={String(l.serials.length)} /> : null}
            {l.note ? <Text style={ui.hint}>{l.note}</Text> : null}
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
              <Button
                title="Noter"
                variant="ghost"
                onPress={() => recount(l)}
                disabled={!Number.isFinite(parseAmount(counts[l.id] ?? ''))}
              />
            </View>
            {l.qty === 0 && (
              <Button
                title="Retirer ce lot vide"
                variant="ghost"
                onPress={() => updateAccount((a) => removeLot(a, l.id))}
              />
            )}
          </Card>
        ))
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
              {formatDate(m.date)} · {SOURCE_LABEL[m.source].toLowerCase()}
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
