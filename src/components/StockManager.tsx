import { useEffect, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { formatDate, formatEur, parseAmount } from '../logic/format';
import { fetchChfToEur } from '../logic/prices';
import { CHF_EUR_FALLBACK, proStockValue, STORAGE_LIMIT, storageStatus } from '../logic/storageLimit';
import { LedgerError } from '../logic/ledger';
import { BAR_PRODUCTS, productOf } from '../logic/physical';
import {
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
const SOURCE_LABEL = { maison: 'Orvia', pro: 'Pro (revendeur)' } as const;
const shortName = (id: string) => productOf(id).label.replace(/ \(.*/, '');

/** Société Orvia › Stock : lots de lingotins et de pièces (x1, x10, x100…), chez Orvia ou chez un pro (revendeur). */
export function StockManager({ onBack }: { onBack: () => void }) {
  const account = useAccount();
  const { updateAccount, quote } = useBank();
  const [chfEur, setChfEur] = useState<{ rate: number; live: boolean }>({ rate: CHF_EUR_FALLBACK, live: false });
  useEffect(() => {
    let on = true;
    fetchChfToEur()
      .then((rate) => on && setChfEur({ rate, live: true }))
      .catch(() => undefined);
    return () => {
      on = false;
    };
  }, []);
  const storage = storageStatus(proStockValue(account, quote.prices.gold), chfEur.rate);
  const [product, setProduct] = useState(BAR_PRODUCTS[1].id);
  const [qty, setQty] = useState('10');
  const [source, setSource] = useState<'maison' | 'pro'>('maison');
  const [vault, setVault] = useState('');
  const [cost, setCost] = useState('');
  const [serials, setSerials] = useState('');
  const [note, setNote] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [lotSerials, setLotSerials] = useState<Record<string, string>>({});

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
        text: `${n} × ${shortName(product).toLowerCase()} ajouté${n > 1 ? 's' : ''} au stock : ${SOURCE_LABEL[source]}.`,
      });
      setSerials('');
      setNote('');
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
      <Button title="← Société Orvia" variant="ghost" onPress={onBack} />
      <Hint>
        Le stock des lingotins et pièces, par lot : chez Orvia, ou chez un pro (revendeur) qui les garde pour vous.
        Quand un client retire de l’or, l’appli prend d’abord dans le stock d’Orvia, puis chez le pro (revendeur) ; sans
        stock, il faut commander chez le revendeur.
      </Hint>

      <SectionTitle>Stockage chez le revendeur</SectionTitle>
      <Card style={{ gap: 6 }}>
        <KeyValue
          label={`Stockage gratuit jusqu’à ${STORAGE_LIMIT.freeChf.toLocaleString('fr-FR')} CHF`}
          value={`≈ ${formatEur(storage.limitEur)}`}
        />
        <KeyValue
          label="Votre stock chez le pro (valeur de l’or)"
          value={`${formatEur(storage.usedEur)} ≈ ${Math.round(storage.usedChf).toLocaleString('fr-FR')} CHF`}
        />
        <View style={styles.meter}>
          <View style={[styles.meterFill, { flex: Math.max(0.0001, storage.share) }]} />
          <View style={{ flex: Math.max(0.0001, 1 - storage.share) }} />
        </View>
        <Text style={ui.hint}>
          {storage.tier === 'free'
            ? `Il reste environ ${formatEur(storage.leftEur)} de stockage gratuit.`
            : `Au-delà du seuil : environ ${formatEur(storage.yearlyFeeEur)} par an (${storage.yearlyFeePct.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} % de votre stock).`}
        </Text>
        <Text style={ui.hint}>
          Grille depuis le 1er novembre 2026 : gratuit jusqu’à {STORAGE_LIMIT.freeChf.toLocaleString('fr-FR')} CHF, puis{' '}
          {STORAGE_LIMIT.midFeeChfPerMonth} CHF par mois jusqu’à {STORAGE_LIMIT.midChf.toLocaleString('fr-FR')} CHF,
          puis 0,5 % par an. Assurance comprise. Taux {chfEur.live ? 'du jour' : 'approximatif'} : 1 CHF ={' '}
          {chfEur.rate.toFixed(3).replace('.', ',')} €.
        </Text>
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
            { value: 'pro', label: 'Pro (revendeur)' },
          ]}
        />
        {source === 'pro' && (
          <TextInput
            value={vault}
            onChangeText={setVault}
            placeholder="Nom du revendeur (ex. Gold Avenue)"
            placeholderTextColor={colors.textMuted}
            style={ui.input}
            accessibilityLabel="Nom du pro (revendeur)"
          />
        )}
        <TextInput
          value={cost}
          onChangeText={setCost}
          keyboardType="decimal-pad"
          placeholder="Prix payé par pièce, métal compris"
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
              value={l.source === 'pro' ? `Pro (revendeur)${l.vault ? ` · ${l.vault}` : ''}` : 'Orvia'}
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
                  placeholder="Collez ici la liste des numéros du revendeur (un par ligne)"
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
  sumRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  name: { color: colors.text, fontSize: 14, fontWeight: '600' },
  sum: { color: colors.text, fontSize: 14, fontWeight: '700', marginLeft: 'auto' },
  meter: { flexDirection: 'row', height: 6, borderRadius: 3, overflow: 'hidden', backgroundColor: colors.surfaceAlt },
  meterFill: { backgroundColor: colors.gold },
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
