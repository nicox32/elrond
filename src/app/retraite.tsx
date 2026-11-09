import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { Segmented } from '../components/Segmented';
import { Button, Card, Hint, Label, Message, Screen, SectionTitle, styles as ui } from '../components/ui';
import { formatDate, formatEur, parseAmount } from '../logic/format';
import { accountValue } from '../logic/ledger';
import { DEFAULT_ALLOCATION } from '../logic/allocation';
import { retirementStatus } from '../logic/retirement';
import type { RetirementGoal } from '../logic/types';
import { useAccount, useBank } from '../state/BankProvider';
import { colors } from '../theme';

const toFr = (iso: string) => iso.slice(0, 10).split('-').reverse().join('/');

function parseFrDate(text: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text.trim());
  if (!m) return null;
  const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]), 12);
  if (d.getMonth() !== Number(m[2]) - 1 || d <= new Date()) return null;
  return d.toISOString();
}

/** Objectif retraite : montant visé, date, progression et versement mensuel nécessaire. */
export default function RetirementScreen() {
  const account = useAccount();
  const { quote, updateAccount } = useBank();
  const saved = account.retirement;
  const [target, setTarget] = useState(saved ? String(saved.target) : '50000');
  const [date, setDate] = useState(saved ? toFr(saved.date) : `01/01/${new Date().getFullYear() + 20}`);
  const [growth, setGrowth] = useState(String(saved?.growth ?? 0));
  const [scope, setScope] = useState<'all' | 'gold'>(saved?.scope ?? 'gold');
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const value = accountValue(account, quote.prices);
  const current = scope === 'gold' ? value.byMetal.gold : value.total;
  const iso = parseFrDate(date);
  const amount = parseAmount(target);
  const goal: RetirementGoal | null =
    iso && amount > 0 ? { target: amount, date: iso, growth: Number(growth), scope } : null;
  const st = goal ? retirementStatus(goal, current) : null;
  // Achats programmés ramenés au mois (et à la part d'or si seul l'or compte).
  const plan = account.plan;
  const goldShare = (account.settings.allocation ?? DEFAULT_ALLOCATION).gold / 100;
  const planMonthly = plan?.active
    ? plan.amount * (plan.frequency === 'weekly' ? 52 / 12 : 1) * (scope === 'gold' ? goldShare : 1)
    : 0;

  return (
    <Screen testID="screen-retraite">
      <Hint>
        Fixez un montant à atteindre pour votre retraite. Orvia calcule où vous en êtes et combien mettre de côté chaque
        mois, au cours d’aujourd’hui (ou avec une hausse supposée des métaux, sans garantie).
      </Hint>

      <Card style={{ gap: 8 }}>
        <Label>Montant visé (€)</Label>
        <TextInput value={target} onChangeText={setTarget} keyboardType="decimal-pad" style={ui.input} />
        <Label>Date (JJ/MM/AAAA)</Label>
        <TextInput value={date} onChangeText={setDate} keyboardType="numbers-and-punctuation" style={ui.input} />
        <Label>Ce qui compte</Label>
        <Segmented
          value={scope}
          onChange={setScope}
          options={[
            { value: 'gold', label: 'Gold Spot seul' },
            { value: 'all', label: 'Tout le compte' },
          ]}
        />
        <Label>Hausse des métaux supposée</Label>
        <Segmented
          value={growth}
          onChange={setGrowth}
          options={[
            { value: '0', label: '0 %/an' },
            { value: '0.02', label: '2 %/an' },
            { value: '0.04', label: '4 %/an' },
          ]}
        />
        {!iso && <Text style={styles.err}>Date invalide ou passée.</Text>}
        <Button
          title="Enregistrer l’objectif"
          disabled={!goal}
          onPress={() => {
            if (!goal) return;
            updateAccount((a) => ({ ...a, retirement: goal }));
            setMessage({ ok: true, text: 'Objectif enregistré.' });
          }}
        />
        {message && <Message ok={message.ok} text={message.text} />}
      </Card>

      {st && goal && (
        <>
          <SectionTitle>Où vous en êtes</SectionTitle>
          <Card style={{ gap: 8 }}>
            <Text style={styles.big}>
              {formatEur(current)} <Text style={styles.muted}>sur {formatEur(goal.target)}</Text>
            </Text>
            <View style={styles.bar}>
              <View style={[styles.fill, { width: `${Math.round(st.progress * 100)}%` }]} />
            </View>
            <Text style={styles.muted}>
              {Math.round(st.progress * 100)} % · {Math.floor(st.months / 12)} ans et {st.months % 12} mois jusqu’au{' '}
              {formatDate(goal.date)}
            </Text>
            {st.reached ? (
              <Text style={[styles.line, { color: colors.up }]}>Objectif atteint au cours d’aujourd’hui.</Text>
            ) : (
              <>
                <Text style={styles.line}>
                  À mettre de côté : <Text style={styles.strong}>{formatEur(st.monthly)} par mois</Text>
                </Text>
                <Text style={styles.muted}>
                  Hors frais d’achat (2,5 % sur l’or). Sans nouveau versement, votre épargne vaudrait{' '}
                  {formatEur(st.projectedWithoutSaving)} à cette date
                  {Number(growth) > 0 ? ` avec ${Number(growth) * 100} % de hausse par an` : ' au cours d’aujourd’hui'}.
                </Text>
                {planMonthly > 0 && (
                  <Text style={[styles.line, { color: planMonthly >= st.monthly ? colors.up : colors.down }]}>
                    Vos achats programmés : {formatEur(planMonthly)} par mois
                    {planMonthly >= st.monthly ? ' — suffisant.' : ' — à augmenter pour tenir l’objectif.'}
                  </Text>
                )}
              </>
            )}
          </Card>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  big: { color: colors.text, fontSize: 22, fontWeight: '800' },
  muted: { color: colors.textMuted, fontSize: 13, fontWeight: '500', lineHeight: 18 },
  line: { color: colors.text, fontSize: 14, lineHeight: 20 },
  strong: { fontWeight: '800', color: colors.gold },
  err: { color: colors.down, fontSize: 13 },
  bar: { height: 10, borderRadius: 5, backgroundColor: colors.surfaceAlt, overflow: 'hidden' },
  fill: { height: 10, backgroundColor: colors.gold },
});
