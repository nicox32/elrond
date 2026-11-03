import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { Segmented } from '../components/Segmented';
import { Button, Card, Hint, Label, Message, Screen, SectionTitle, styles as ui } from '../components/ui';
import { DEFAULT_ALLOCATION, splitAmount } from '../logic/allocation';
import { formatDate, formatEur, parseAmount } from '../logic/format';
import { METAL_LABEL } from '../logic/ledger';
import { amountPerRun, type BuyPlan, newPlan, nextRun, planError, WEEKDAYS } from '../logic/plan';
import { SPOT_METALS } from '../logic/types';
import { useAccount, useBank } from '../state/BankProvider';
import { colors } from '../theme';

/** Ordre d'affichage des jours : du lundi au dimanche. */
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

/** Achats programmés : un montant investi automatiquement chaque semaine ou chaque mois. */
export default function PlanScreen() {
  const account = useAccount();
  const { updateAccount, quote } = useBank();
  const saved = account.plan;
  const [plan, setPlan] = useState<BuyPlan>(() => saved ?? newPlan());
  const [amountText, setAmountText] = useState(String(plan.amount).replace('.', ','));
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const draft: BuyPlan = { ...plan, amount: parseAmount(amountText) };
  const error = planError(draft);
  const each = amountPerRun(draft);
  const target = account.settings.allocation ?? DEFAULT_ALLOCATION;
  const split = splitAmount(each, target, draft.mode, account, quote.prices);
  const next = nextRun(draft);
  const cash = account.cashEur ?? 0;
  const set = (p: Partial<BuyPlan>) => {
    setPlan((x) => ({ ...x, ...p }));
    setMessage(null);
  };

  function save() {
    if (error) return;
    // Un nouveau programme (ou une reprise) ne rattrape pas les achats passés : il démarre maintenant.
    const restart = !saved || (!saved.active && draft.active);
    const value: BuyPlan = { ...draft, lastRunAt: restart ? new Date().toISOString() : (saved?.lastRunAt ?? '') };
    updateAccount((a) => ({ ...a, plan: value }));
    setPlan(value);
    setMessage({ ok: true, text: draft.active ? 'Achats programmés enregistrés.' : 'Achats programmés en pause.' });
  }

  function remove() {
    updateAccount((a) => {
      const { plan: _removed, ...rest } = a;
      return rest;
    });
    setPlan(newPlan());
    setAmountText('25');
    setMessage({ ok: true, text: 'Achats programmés supprimés.' });
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen testID="screen-programme">
        <Hint>
          Orvia achète pour vous, automatiquement, selon votre répartition ({target.gold} % Gold Spot, {target.silver} %
          argent, {target.platinum} % platine), au cours du moment. Les frais d’achat habituels s’appliquent.
        </Hint>

        <Card style={styles.switchRow}>
          <Text style={styles.switchLabel}>Achats programmés actifs</Text>
          <Switch
            value={plan.active}
            onValueChange={(active) => set({ active })}
            trackColor={{ true: colors.gold, false: colors.surfaceAlt }}
          />
        </Card>

        <SectionTitle>Montant</SectionTitle>
        <Segmented
          value={plan.frequency}
          onChange={(frequency) => set({ frequency })}
          options={[
            { value: 'weekly', label: 'Par semaine' },
            { value: 'monthly', label: 'Par mois' },
          ]}
        />
        <View style={styles.amountRow}>
          <TextInput
            value={amountText}
            onChangeText={(t) => {
              setAmountText(t);
              setMessage(null);
            }}
            keyboardType="decimal-pad"
            style={[ui.input, styles.amount]}
            accessibilityLabel="Montant"
          />
          <Text style={styles.unit}>€</Text>
        </View>

        {plan.frequency === 'weekly' ? (
          <>
            <Label>Jours d’achat (le montant y est partagé)</Label>
            <View style={styles.days}>
              {DAY_ORDER.map((d) => {
                const on = plan.days.includes(d);
                return (
                  <Pressable
                    key={d}
                    onPress={() => set({ days: on ? plan.days.filter((x) => x !== d) : [...plan.days, d] })}
                    style={[styles.day, on && styles.dayOn]}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: on }}
                  >
                    <Text style={[styles.dayText, on && styles.dayTextOn]}>{WEEKDAYS[d]}</Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        ) : (
          <>
            <Label>Jour du mois</Label>
            <View style={styles.days}>
              {[1, 5, 10, 15, 20, 25, 28].map((d) => (
                <Pressable
                  key={d}
                  onPress={() => set({ dayOfMonth: d })}
                  style={[styles.day, plan.dayOfMonth === d && styles.dayOn]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: plan.dayOfMonth === d }}
                >
                  <Text style={[styles.dayText, plan.dayOfMonth === d && styles.dayTextOn]}>{d}</Text>
                </Pressable>
              ))}
            </View>
          </>
        )}

        <SectionTitle>Paiement</SectionTitle>
        <Segmented
          value={plan.source}
          onChange={(source) => set({ source })}
          options={[
            { value: 'card', label: 'Carte bancaire' },
            { value: 'cash', label: 'Compte d’attente' },
          ]}
        />
        {plan.source === 'cash' && (
          <Hint>
            {formatEur(cash)} disponibles. Si le compte d’attente ne suffit pas, l’achat est sauté et vous êtes prévenu.{' '}
            <Text style={ui.link} onPress={() => router.push('/attente')}>
              Créditer ›
            </Text>
          </Hint>
        )}
        <Segmented
          value={plan.mode}
          onChange={(mode) => set({ mode })}
          options={[
            { value: 'target', label: 'Vers mon objectif' },
            { value: 'percent', label: 'Selon mes %' },
          ]}
        />
        <Hint>
          {plan.mode === 'target'
            ? 'Chaque achat va d’abord aux métaux en retard sur votre répartition, pour vous en rapprocher sans rien vendre.'
            : 'Chaque achat est partagé exactement selon vos pourcentages.'}
        </Hint>

        {!error && (
          <Card style={{ gap: 4 }}>
            <Text style={styles.recapTitle}>
              {formatEur(each)} par achat
              {draft.frequency === 'weekly' ? `, ${draft.days.length} fois par semaine` : ', une fois par mois'}
            </Text>
            {SPOT_METALS.filter((m) => split[m] > 0).map((m) => (
              <Text key={m} style={styles.recapLine}>
                {METAL_LABEL[m]} : {formatEur(split[m])}
              </Text>
            ))}
            {draft.active && next && <Hint>Prochain achat : {formatDate(next.toISOString())}</Hint>}
            <Hint>
              L’achat se fait à l’heure prévue si le téléphone le permet, sinon à la prochaine ouverture de l’appli
              (rattrapage jusqu’à 31 jours).
            </Hint>
          </Card>
        )}
        {error && <Message ok={false} text={error} />}
        {message && <Message ok={message.ok} text={message.text} />}
        <Button title="Enregistrer" onPress={save} disabled={!!error} />
        {saved?.lastResult && (
          <Hint>
            Dernier passage le {formatDate(saved.lastResult.at)} : {saved.lastResult.done} achat
            {saved.lastResult.done > 1 ? 's' : ''} effectué{saved.lastResult.done > 1 ? 's' : ''}
            {saved.lastResult.skipped
              ? `, ${saved.lastResult.skipped} sauté(s) — ${saved.lastResult.message ?? ''}`
              : ''}
            .
          </Hint>
        )}
        {saved && <Button title="Supprimer les achats programmés" variant="ghost" onPress={remove} />}
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  switchLabel: { color: colors.text, fontSize: 16, fontWeight: '600', flex: 1 },
  amountRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  amount: { flex: 1, minWidth: 0, fontSize: 22, fontWeight: '700' },
  unit: { color: colors.textMuted, fontSize: 20, fontWeight: '700' },
  days: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  day: {
    minWidth: 44,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  dayOn: { backgroundColor: colors.gold, borderColor: colors.gold },
  dayText: { color: colors.text, fontWeight: '600' },
  dayTextOn: { color: colors.background },
  recapTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  recapLine: { color: colors.textMuted, fontSize: 14 },
});
