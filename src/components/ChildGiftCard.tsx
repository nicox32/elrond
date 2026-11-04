import { useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import {
  type ChildGiftPlan,
  describeGift,
  GIFT_PRESETS,
  giftDue,
  giftPlanError,
  giveMonthlyGift,
  monthKey,
  newGiftPlan,
  skipMonthlyGift,
} from '../logic/childGiftPlan';
import { formatEur, parseAmount } from '../logic/format';
import { LedgerError, replaceChildAccount } from '../logic/ledger';
import type { ChildAccount } from '../logic/types';
import { useBank } from '../state/BankProvider';
import { colors } from '../theme';
import { Button, Card, Hint, Label, Message, styles as ui } from './ui';

const DAYS = [1, 5, 10, 15, 20, 25, 28];
const MONTH = (d: Date) => d.toLocaleDateString('fr-FR', { month: 'long' });

/** Don mensuel à un enfant : réglage, rappel du jour, et don en un geste. */
export function ChildGiftCard({ child }: { child: ChildAccount }) {
  const { commit, updateAccount } = useBank();
  const saved = child.giftPlan;
  const [editing, setEditing] = useState(!saved);
  const [plan, setPlan] = useState<ChildGiftPlan>(() => saved ?? newGiftPlan());
  const [amountText, setAmountText] = useState(String((saved ?? newGiftPlan()).amount).replace('.', ','));
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const draft: ChildGiftPlan = { ...plan, amount: parseAmount(amountText) };
  const error = giftPlanError(draft);
  const now = new Date();
  const due = giftDue(saved, now);

  const save = () => {
    if (error) return;
    // Un don déjà passé ce mois-ci (avant le jour choisi) ne doit pas être redemandé.
    const value: ChildGiftPlan = { ...draft, doneMonth: saved?.doneMonth, remindedMonth: saved?.remindedMonth };
    updateAccount((a) => replaceChildAccount(a, { ...child, giftPlan: value }));
    setEditing(false);
    setMsg({ ok: true, text: value.auto ? 'Don automatique enregistré.' : 'Rappel mensuel enregistré.' });
  };
  const remove = () => {
    updateAccount((a) => {
      const { giftPlan: _removed, ...rest } = child;
      return replaceChildAccount(a, rest);
    });
    setPlan(newGiftPlan());
    setEditing(true);
    setMsg({ ok: true, text: 'Don mensuel supprimé.' });
  };
  const give = () => {
    try {
      commit((a, prices) => giveMonthlyGift(a, prices, child.id));
      setMsg({ ok: true, text: `Don de ${MONTH(now)} versé à ${child.name}.` });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof LedgerError ? e.message : 'Don impossible.' });
    }
  };

  return (
    <Card style={{ gap: 10 }}>
      <Text style={styles.title}>Don mensuel à {child.name}</Text>

      {saved && due && (
        <View style={styles.due}>
          <Text style={styles.dueTitle}>
            Don de {MONTH(now)} à faire : {formatEur(saved.amount)}
          </Text>
          <Text style={styles.dueSub}>
            {describeGift(saved)}, acheté sur votre compte puis versé à {child.name}.
          </Text>
          <Button title={`Faire le don à ${child.name}`} onPress={give} />
          <Pressable onPress={() => updateAccount((a) => skipMonthlyGift(a, child.id))} accessibilityRole="button">
            <Text style={[ui.link, { textAlign: 'center', color: colors.textMuted }]}>Pas ce mois-ci</Text>
          </Pressable>
        </View>
      )}

      {saved && !editing && (
        <>
          <Hint>
            {saved.active ? '' : 'En pause. '}
            {formatEur(saved.amount)} le {saved.dayOfMonth} de chaque mois ({describeGift(saved)}).{' '}
            {saved.auto
              ? 'Le don se fait tout seul ce jour-là, et vous êtes prévenu.'
              : 'Ce jour-là, un rappel arrive et le don se fait en un geste ici.'}
            {saved.doneMonth === monthKey(now) ? ` Don de ${MONTH(now)} réglé.` : ''}
          </Hint>
          <Button title="Modifier" variant="ghost" onPress={() => setEditing(true)} />
        </>
      )}

      {editing && (
        <>
          <Hint>
            Chaque mois, le métal est acheté sur votre compte (frais d’achat habituels) puis versé gratuitement sur le
            compte de {child.name}.
          </Hint>
          <Label>Montant</Label>
          <View style={styles.row}>
            <TextInput
              value={amountText}
              onChangeText={setAmountText}
              keyboardType="decimal-pad"
              style={[ui.input, { flex: 1, minWidth: 0 }]}
              accessibilityLabel="Montant du don"
            />
            <Text style={styles.unit}>€</Text>
          </View>
          <Label>Jour du mois</Label>
          <View style={styles.chips}>
            {DAYS.map((d) => (
              <Pressable
                key={d}
                onPress={() => setPlan({ ...plan, dayOfMonth: d })}
                style={[styles.chip, plan.dayOfMonth === d && styles.chipOn]}
                accessibilityRole="radio"
                accessibilityState={{ selected: plan.dayOfMonth === d }}
              >
                <Text style={[styles.chipText, plan.dayOfMonth === d && styles.chipTextOn]}>{d}</Text>
              </Pressable>
            ))}
          </View>
          <Label>Répartition (Gold Spot / argent / platine)</Label>
          <View style={styles.chips}>
            {GIFT_PRESETS.map((p) => {
              const on = p.share.gold === plan.share.gold && p.share.silver === plan.share.silver;
              return (
                <Pressable
                  key={p.label}
                  onPress={() => setPlan({ ...plan, share: { ...p.share } })}
                  style={[styles.chip, on && styles.chipOn]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                >
                  <Text style={[styles.chipText, on && styles.chipTextOn]}>{p.label}</Text>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.switchLabel}>Don automatique</Text>
              <Hint>Désactivé : un rappel le jour prévu, vous validez le don vous-même.</Hint>
            </View>
            <Switch
              value={plan.auto}
              onValueChange={(auto) => setPlan({ ...plan, auto })}
              trackColor={{ true: colors.gold, false: colors.surfaceAlt }}
            />
          </View>
          {saved && (
            <View style={styles.switchRow}>
              <Text style={[styles.switchLabel, { flex: 1 }]}>Don mensuel actif</Text>
              <Switch
                value={plan.active}
                onValueChange={(active) => setPlan({ ...plan, active })}
                trackColor={{ true: colors.gold, false: colors.surfaceAlt }}
              />
            </View>
          )}
          {!error && <Hint>Chaque mois : {describeGift(draft)}.</Hint>}
          {error && <Message ok={false} text={error} />}
          <Button title="Enregistrer" onPress={save} disabled={!!error} />
          {saved && <Button title="Supprimer le don mensuel" variant="ghost" onPress={remove} />}
        </>
      )}
      {msg && <Message {...msg} />}
    </Card>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.text, fontSize: 16, fontWeight: '700' },
  due: { backgroundColor: colors.goldSoft, borderRadius: 12, padding: 12, gap: 8 },
  dueTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
  dueSub: { color: colors.text, fontSize: 13 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  unit: { color: colors.textMuted, fontSize: 18, fontWeight: '700' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    minWidth: 44,
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  chipOn: { backgroundColor: colors.gold, borderColor: colors.gold },
  chipText: { color: colors.text, fontWeight: '600' },
  chipTextOn: { color: colors.background },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  switchLabel: { color: colors.text, fontSize: 15, fontWeight: '600' },
});
