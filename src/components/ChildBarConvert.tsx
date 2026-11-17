import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatEur, formatWeight } from '../logic/format';
import { LedgerError, majorityDate } from '../logic/ledger';
import {
  BAR_PRODUCTS,
  type BarOrder,
  CHILD_STORAGE_NOTE,
  convertChildToBars,
  physicalFeesOf,
  quoteWithdrawal,
} from '../logic/physical';
import type { ChildAccount } from '../logic/types';
import { useAccount, useBank } from '../state/BankProvider';
import { colors } from '../theme';
import { BarImage } from './BarImage';
import { PinConfirm } from './PinConfirm';
import { Segmented } from './Segmented';
import { Banner, Button, Card, Hint, KeyValue, Message } from './ui';

type Mode = 'standard' | 'locked';

/** Convertir l'or d'un enfant en lingotins : gardés uniquement chez le revendeur, au nom de l'enfant. */
export function ChildBarConvert({ child }: { child: ChildAccount }) {
  const account = useAccount();
  const { quote, commit } = useBank();
  const [order, setOrder] = useState<BarOrder>({});
  const [mode, setMode] = useState<Mode>('standard');
  const [confirm, setConfirm] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const q = quoteWithdrawal(quote.prices, order, physicalFeesOf(account.settings));
  const fee = q.premium;
  const cash = account.cashEur ?? 0;
  const gold = child.holdings.gold;
  const tooMuch = q.grams > gold + 1e-9;
  const noCash = fee > cash + 0.005;
  const majority = child.birthDate ? majorityDate(child.birthDate) : null;
  const noBirth = mode === 'locked' && !majority;
  const set = (id: string, n: number) => {
    setOrder((o) => ({ ...o, [id]: Math.max(0, n) }));
    setMsg(null);
  };

  function submit() {
    setConfirm(false);
    try {
      commit((a, p) => convertChildToBars(a, p, child.id, order, mode === 'locked'));
      setOrder({});
      setMsg({
        ok: true,
        text: `Lingotin(s) enregistré(s) au nom de ${child.name}, gardés chez Gold Avenue.${mode === 'locked' ? ` Verrouillés jusqu’au ${majority ? majority.toLocaleDateString('fr-FR') : 'la majorité'}.` : ''}`,
      });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof LedgerError ? e.message : 'Conversion impossible.' });
    }
  }

  return (
    <>
      <Hint>
        Transformez de l’or de {child.name} en lingotins ou en pièce. Ils restent{' '}
        <Text style={styles.b}>uniquement chez Gold Avenue</Text>, au nom de {child.name} : jamais livrés. Il y a{' '}
        {formatWeight(gold, 'g', 'gold')} d’or sur son compte.
      </Hint>
      <Card style={{ paddingVertical: 4 }}>
        {BAR_PRODUCTS.map((p, i) => {
          const n = order[p.id] ?? 0;
          return (
            <View key={p.id} style={[styles.row, i > 0 && styles.border]} testID={`child-convert-${p.id}`}>
              <BarImage product={p.id} size={40} />
              <Text style={styles.name}>{p.label.replace(/ \(.*/, '')}</Text>
              <Pressable
                onPress={() => set(p.id, n - 1)}
                style={styles.step}
                accessibilityLabel={`Moins de ${p.label}`}
              >
                <Text style={styles.stepText}>−</Text>
              </Pressable>
              <Text style={styles.qty}>{n}</Text>
              <Pressable onPress={() => set(p.id, n + 1)} style={styles.step} accessibilityLabel={`Plus de ${p.label}`}>
                <Text style={styles.stepText}>+</Text>
              </Pressable>
            </View>
          );
        })}
      </Card>

      <Segmented
        value={mode}
        onChange={setMode}
        options={[
          { value: 'standard', label: 'Standard' },
          { value: 'locked', label: '🔒 Sécurité maximale' },
        ]}
      />
      <Hint>
        {mode === 'locked'
          ? `Sécurité maximale : le lingotin est verrouillé jusqu’aux 18 ans de ${child.name}${majority ? ` (${majority.toLocaleDateString('fr-FR')})` : ''}. Il ne peut être ni déplacé ni vendu avant, par personne.`
          : `Standard : le lingotin reste chez Gold Avenue, au nom de ${child.name}. Il suit les règles du compte enfant.`}
      </Hint>

      {q.lines.length > 0 && (
        <Card style={{ gap: 6 }}>
          <KeyValue label="Or retiré du compte de l’enfant" value={formatWeight(q.grams, 'g', 'gold')} />
          <KeyValue label="Valeur au cours du jour" value={formatEur(q.value)} />
          <KeyValue label="Fabrication, payée par vous" value={formatEur(fee)} strong />
          <Text style={styles.sub}>
            Pas de livraison. La fabrication est payée depuis votre compte d’attente, jamais sur l’or de {child.name}.
          </Text>
          {tooMuch && <Text style={styles.err}>Pas assez d’or sur le compte de {child.name}.</Text>}
          {noCash && (
            <Text style={styles.err}>
              Votre compte d’attente est insuffisant : créditez-le d’au moins {formatEur(fee - cash)}.
            </Text>
          )}
          {noBirth && (
            <Text style={styles.err}>La sécurité maximale demande la date de naissance de {child.name}.</Text>
          )}
        </Card>
      )}
      <Button
        title={mode === 'locked' ? 'Convertir et verrouiller' : 'Convertir en lingotin'}
        onPress={() => setConfirm(true)}
        disabled={!q.lines.length || tooMuch || noCash || noBirth}
      />
      {msg && <Message {...msg} />}
      {q.lines.length === 0 && (
        <Banner icon="ℹ️">
          Gardé uniquement chez Gold Avenue ({CHILD_STORAGE_NOTE.toLowerCase()}). Choisissez ce que vous voulez
          convertir.
        </Banner>
      )}

      <PinConfirm
        visible={confirm}
        summary={`Convertir ${q.lines.map((l) => `${l.qty} × ${l.product.label.replace(/ \(.*/, '').toLowerCase()}`).join(', ')} au nom de ${child.name} : ${formatWeight(q.grams, 'g', 'gold')} d’or, fabrication ${formatEur(fee)}${mode === 'locked' ? ', verrouillé jusqu’à sa majorité' : ''}.`}
        onConfirm={submit}
        onCancel={() => setConfirm(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  border: { borderTopWidth: 1, borderTopColor: colors.border },
  name: { color: colors.text, fontSize: 14.5, fontWeight: '700', flex: 1 },
  sub: { color: colors.textMuted, fontSize: 12.5, lineHeight: 17 },
  b: { color: colors.text, fontWeight: '700' },
  step: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: { color: colors.gold, fontSize: 19, fontWeight: '800' },
  qty: { color: colors.text, fontSize: 16, fontWeight: '800', minWidth: 22, textAlign: 'center' },
  err: { color: colors.down, fontSize: 13, lineHeight: 18 },
});
