import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { formatDate, formatEur } from '../logic/format';
import { LedgerError } from '../logic/ledger';
import { barsOfChild, giveBarToChild, productOf } from '../logic/physical';
import type { ChildAccount, HomeBar } from '../logic/types';
import { useAccount, useBank } from '../state/BankProvider';
import { colors } from '../theme';
import { BarImage } from './BarImage';
import { PinConfirm } from './PinConfirm';
import { Banner, Button, Card, Hint, KeyValue, Message } from './ui';

const name = (b: HomeBar) => productOf(b.product).label.replace(/ \(.*/, '');

/** Don d'un lingotin ou d'une pièce à un enfant : il reste chez vous, seule la propriété (son numéro) est cédée. */
export function ChildBarGifts({ child }: { child: ChildAccount }) {
  const account = useAccount();
  const { quote, commit } = useBank();
  const [picked, setPicked] = useState<HomeBar | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const owned = barsOfChild(account, child.id);
  const free = (account.homeVault ?? []).filter((b) => !b.ownerChildId && b.status === 'received' && b.serial);
  const waiting = (account.homeVault ?? []).filter((b) => !b.ownerChildId && (b.status !== 'received' || !b.serial));

  function give() {
    if (!picked) return;
    const bar = picked;
    setPicked(null);
    setConfirm(false);
    try {
      commit((a, p) => giveBarToChild(a, p, bar.id, child.id));
      setMsg({
        ok: true,
        text: `${name(bar)} donné à ${child.name}. Il reste chez vous ; le don est inscrit dans ses dons (formulaire 2735).`,
      });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof LedgerError ? e.message : 'Don impossible.' });
    }
  }

  return (
    <>
      <Hint>
        Le lingotin reste chez vous : seule sa propriété, son numéro de série, est cédée à {child.name}. Le don est
        compté à la valeur de l’or du jour dans ses dons et dans l’abattement de 100 000 € (formulaire 2735).
      </Hint>

      {owned.length > 0 && (
        <Card style={{ gap: 10 }}>
          {owned.map((b) => (
            <View key={b.id} style={styles.row} testID={`child-bar-${b.id}`}>
              <BarImage product={b.product} size={44} />
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{name(b)}</Text>
                <Text style={styles.sub}>
                  {productOf(b.product).coin ? 'Millésime' : 'N°'} {b.serial}
                </Text>
                <Text style={styles.sub}>
                  Donné le {b.giftedAt ? formatDate(b.giftedAt) : ''} · {formatEur(b.giftValue ?? 0)}
                </Text>
              </View>
            </View>
          ))}
          <KeyValue
            label="Valeur donnée en lingotins"
            value={formatEur(owned.reduce((s, b) => s + (b.giftValue ?? 0), 0))}
          />
        </Card>
      )}

      {free.length === 0 ? (
        <Banner icon="ℹ️">
          {waiting.length
            ? 'Vos lingotins en préparation pourront être donnés une fois reçus, avec leur numéro noté.'
            : 'Aucun lingotin disponible. Retirez de l’or en lingotins, puis notez leur numéro à la réception.'}
        </Banner>
      ) : (
        <Card style={{ gap: 8 }}>
          <Text style={styles.name}>Choisir le lingotin à donner</Text>
          {free.map((b) => (
            <View key={b.id} style={[styles.row, picked?.id === b.id && styles.picked]} testID={`give-bar-${b.id}`}>
              <BarImage product={b.product} size={44} />
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{name(b)}</Text>
                <Text style={styles.sub}>
                  {productOf(b.product).coin ? 'Millésime' : 'N°'} {b.serial} · ≈{' '}
                  {formatEur(b.grams * quote.prices.gold)}
                </Text>
              </View>
              <Button
                title={picked?.id === b.id ? 'Choisi ✓' : 'Choisir'}
                variant="ghost"
                onPress={() => setPicked(picked?.id === b.id ? null : b)}
              />
            </View>
          ))}
          <Button
            title={picked ? `Donner ce lingotin à ${child.name}` : 'Choisissez un lingotin'}
            onPress={() => setConfirm(true)}
            disabled={!picked}
          />
        </Card>
      )}
      {msg && <Message {...msg} />}

      <PinConfirm
        visible={confirm}
        summary={
          picked
            ? `Donner ${name(picked)} (${picked.serial}) à ${child.name} : ≈ ${formatEur(picked.grams * quote.prices.gold)} à la valeur de l’or du jour. Il reste chez vous.`
            : ''
        }
        onConfirm={give}
        onCancel={() => setConfirm(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, padding: 4 },
  picked: { backgroundColor: colors.surfaceAlt },
  name: { color: colors.text, fontSize: 14.5, fontWeight: '700' },
  sub: { color: colors.textMuted, fontSize: 12.5 },
});
