import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { PriceStatus } from '../components/PriceStatus';
import { Segmented } from '../components/Segmented';
import { Button, Card, Hint, Label, Message, Screen, SectionTitle, styles as ui } from '../components/ui';
import {
  type Allocation,
  ALLOCATION_PRESETS,
  allocationTotal,
  buySplit,
  currentAllocation,
  DEFAULT_ALLOCATION,
  isValidAllocation,
  normalizeAllocation,
  quoteSplitBuy,
  splitAmount,
  type SplitMode,
} from '../logic/allocation';
import { formatEur, formatWeight, parseAmount } from '../logic/format';
import { LedgerError, METAL_LABEL } from '../logic/ledger';
import { SPOT_METALS } from '../logic/types';
import { useAccount, useBank } from '../state/BankProvider';
import { colors, metalColor } from '../theme';

const pct = (n: number) => `${n.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %`;

export default function AllocationScreen() {
  const account = useAccount();
  const { quote, commit, updateSettings } = useBank();
  const unit = account.settings.unit;
  const saved = account.settings.allocation ?? DEFAULT_ALLOCATION;

  const [target, setTarget] = useState<Allocation>({ ...saved });
  const [text, setText] = useState('');
  const [mode, setMode] = useState<SplitMode>('target');
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const current = currentAllocation(account, quote.prices);
  const total = allocationTotal(target);
  const valid = isValidAllocation(target);
  const dirty = SPOT_METALS.some((m) => target[m] !== saved[m]);
  const hasHoldings = SPOT_METALS.some((m) => account.holdings[m] > 0);

  const amount = parseAmount(text);
  const amounts = valid && amount > 0 ? splitAmount(amount, target, mode, account, quote.prices) : null;
  const preview = amounts ? quoteSplitBuy(quote.prices, amounts) : null;

  function setValue(metal: keyof Allocation, v: number) {
    setTarget((t) => ({ ...t, [metal]: Math.max(0, Math.min(100, Math.round(v))) }));
    setMessage(null);
  }

  function save() {
    updateSettings({ allocation: target });
    setMessage({ ok: true, text: 'Répartition enregistrée.' });
  }

  function submit() {
    if (!amounts) return;
    try {
      commit((acc, p) => buySplit(acc, p, splitAmount(amount, target, mode, acc, p)));
      if (dirty) updateSettings({ allocation: target });
      setText('');
      setMessage({ ok: true, text: `Achat réparti de ${formatEur(amount)} effectué.` });
    } catch (e) {
      setMessage({ ok: false, text: e instanceof LedgerError ? e.message : 'Une erreur est survenue.' });
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen testID="screen-repartition">
        <PriceStatus />

        <SectionTitle>Ma répartition</SectionTitle>
        <Card style={{ gap: 12 }}>
          {SPOT_METALS.map((m) => (
            <View key={m} style={{ gap: 6 }}>
              <View style={styles.rowBetween}>
                <Text style={[styles.metal, { color: metalColor[m] }]}>{METAL_LABEL[m]}</Text>
                <Text style={styles.compare}>
                  actuel {hasHoldings ? pct(current[m]) : '—'} · cible {pct(target[m])}
                </Text>
              </View>
              <Bars current={hasHoldings ? current[m] : 0} target={target[m]} color={metalColor[m]} />
              <View style={styles.editor}>
                <Step label="−5" onPress={() => setValue(m, target[m] - 5)} />
                <TextInput
                  value={String(target[m])}
                  onChangeText={(t) => setValue(m, parseAmount(t) || 0)}
                  keyboardType="number-pad"
                  style={[ui.input, styles.pctInput]}
                  accessibilityLabel={`Part ${METAL_LABEL[m].toLowerCase()} en %`}
                />
                <Text style={styles.pctSign}>%</Text>
                <Step label="+5" onPress={() => setValue(m, target[m] + 5)} />
              </View>
            </View>
          ))}
          <View style={styles.rowBetween}>
            <Text style={[styles.total, { color: valid ? colors.up : colors.down }]}>Total : {pct(total)}</Text>
            {!valid && (
              <Pressable onPress={() => setTarget(normalizeAllocation(target))} accessibilityRole="button">
                <Text style={ui.link}>Ajuster à 100 %</Text>
              </Pressable>
            )}
          </View>
          <View style={styles.presets}>
            {ALLOCATION_PRESETS.map((p) => (
              <Pressable
                key={p.label}
                onPress={() => {
                  setTarget({ ...p.value });
                  setMessage(null);
                }}
                style={styles.preset}
                accessibilityRole="button"
              >
                <Text style={styles.presetText}>{p.label}</Text>
              </Pressable>
            ))}
          </View>
          <Hint>Or / argent / platine. Votre répartition sert à chaque achat réparti.</Hint>
          {dirty && <Button title="Enregistrer ma répartition" variant="ghost" onPress={save} disabled={!valid} />}
        </Card>

        <SectionTitle>Achat réparti</SectionTitle>
        <Segmented
          value={mode}
          onChange={setMode}
          options={[
            { value: 'target', label: 'Vers mon objectif' },
            { value: 'percent', label: 'Selon mes %' },
          ]}
        />
        <Hint>
          {mode === 'target'
            ? 'Place davantage sur les métaux en retard sur votre répartition, pour vous en rapprocher sans rien vendre.'
            : 'Partage le montant exactement selon vos pourcentages.'}
        </Hint>
        <View style={styles.amountRow}>
          <TextInput
            value={text}
            onChangeText={(t) => {
              setText(t);
              setMessage(null);
            }}
            placeholder="0"
            placeholderTextColor={colors.textMuted}
            keyboardType="decimal-pad"
            style={[ui.input, styles.amount]}
            accessibilityLabel="Montant de l'achat en euros"
          />
          <Text style={styles.unit}>€</Text>
        </View>
        {!valid && <Hint style={{ color: colors.down }}>Votre répartition doit faire 100 % pour acheter.</Hint>}

        {preview && preview.lines.length > 0 && (
          <Card style={{ gap: 8 }}>
            {preview.lines.map((l) => (
              <View key={l.metal} style={styles.rowBetween}>
                <Text style={[styles.metal, { color: metalColor[l.metal] }]}>{METAL_LABEL[l.metal]}</Text>
                <Text style={styles.line}>
                  {formatEur(l.eur)} → {formatWeight(l.grams, unit)}
                </Text>
              </View>
            ))}
            <View style={[styles.rowBetween, styles.sep]}>
              <Label>Total</Label>
              <Text style={styles.line}>
                {formatEur(preview.total)} · dont {formatEur(preview.fees)} de frais
              </Text>
            </View>
          </Card>
        )}

        <Button title="Acheter" onPress={submit} disabled={!preview || preview.lines.length === 0} />
        {message && <Message {...message} />}
        <Hint>Un achat par métal, chacun avec ses frais (or 2,8 %, argent et platine 6,8 %).</Hint>
      </Screen>
    </KeyboardAvoidingView>
  );
}

/** Deux barres : répartition actuelle (pleine) et cible (contour). */
function Bars({ current, target, color }: { current: number; target: number; color: string }) {
  return (
    <View style={{ gap: 3 }}>
      <View style={styles.track}>
        <View style={{ width: `${Math.min(100, current)}%`, backgroundColor: color, borderRadius: 3 }} />
      </View>
      <View style={styles.track}>
        <View
          style={{
            width: `${Math.min(100, target)}%`,
            borderWidth: 1,
            borderColor: color,
            borderRadius: 3,
            opacity: 0.8,
          }}
        />
      </View>
    </View>
  );
}

function Step({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.step} accessibilityRole="button" accessibilityLabel={label}>
      <Text style={styles.stepText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  metal: { fontSize: 15, fontWeight: '700' },
  compare: { color: colors.textMuted, fontSize: 12, fontVariant: ['tabular-nums'] },
  track: { height: 6, borderRadius: 3, backgroundColor: colors.surfaceAlt, flexDirection: 'row', overflow: 'hidden' },
  editor: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pctInput: { flex: 1, minWidth: 0, textAlign: 'center', fontSize: 18, fontWeight: '700', paddingVertical: 8 },
  pctSign: { color: colors.textMuted, fontSize: 16, fontWeight: '700' },
  step: {
    width: 48,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: { color: colors.gold, fontSize: 15, fontWeight: '700' },
  total: { fontSize: 14, fontWeight: '700' },
  presets: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  preset: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  presetText: { color: colors.text, fontSize: 13, fontWeight: '600' },
  amountRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  amount: { flex: 1, minWidth: 0, fontSize: 24, fontWeight: '700' },
  unit: { width: 40, color: colors.textMuted, fontSize: 22, fontWeight: '700', textAlign: 'center' },
  line: { color: colors.text, fontSize: 14, fontWeight: '600', fontVariant: ['tabular-nums'] },
  sep: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8 },
});
