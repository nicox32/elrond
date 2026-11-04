import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { Segmented } from '../components/Segmented';
import { Button, Card, Hint, Label, Message, Screen, SectionTitle, styles as ui } from '../components/ui';
import {
  compareDip,
  DIP_LIMITS,
  type DipBot,
  daysUntilAverage,
  dipAverage,
  dipSignal,
  dipSpentThisMonth,
  newDipBot,
} from '../logic/dipBot';
import { formatDate, formatEur, parseAmount } from '../logic/format';
import { METAL_LABEL } from '../logic/ledger';
import { SPOT_METALS, type SpotMetal } from '../logic/types';
import { useAccount, useBank } from '../state/BankProvider';
import { colors, metalColor } from '../theme';

const perG = (n: number, m: SpotMetal) => `${n.toFixed(m === 'silver' ? 3 : 2).replace('.', ',')} €/g`;
const pct = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n).toFixed(1).replace('.', ',')} %`;
const SIGNAL_LABEL = {
  none: 'Pas de baisse',
  fixed: 'Sous le prix fixe : achat',
  avg: 'Baisse : achat',
  strong: 'Baisse forte : achat double',
} as const;

/** Bot d'achat sur baisse : réglages, état de chaque métal, et comparaison avec l'achat régulier. */
export default function DipBotScreen() {
  const account = useAccount();
  const { updateAccount, quote, hourlyHistory } = useBank();
  const saved = account.dipBot;
  const [bot, setBot] = useState<DipBot>(() => saved ?? newDipBot());
  const [amount, setAmount] = useState(String(bot.amount).replace('.', ','));
  const [cap, setCap] = useState(String(bot.monthlyCap).replace('.', ','));
  const [fixed, setFixed] = useState<Record<SpotMetal, string>>(() => ({
    gold: String(bot.rules.gold.fixedPrice).replace('.', ','),
    silver: String(bot.rules.silver.fixedPrice).replace('.', ','),
    platinum: String(bot.rules.platinum.fixedPrice).replace('.', ','),
  }));
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const now = new Date();
  const prices = quote.prices;
  const waitDays = daysUntilAverage(hourlyHistory, now);
  const spent = dipSpentThisMonth(account, now);
  const cash = account.cashEur ?? 0;
  const draftAmount = parseAmount(amount);
  const draftCap = parseAmount(cap);
  const error = !(draftAmount >= 5)
    ? 'Montant minimum : 5 €.'
    : !(draftCap >= draftAmount)
      ? 'Le plafond doit être au moins égal au montant d’un achat.'
      : SPOT_METALS.some((m) => !(parseAmount(fixed[m]) > 0))
        ? 'Indiquez un prix fixe pour chaque métal.'
        : null;

  function save() {
    if (error) return;
    const value: DipBot = {
      ...bot,
      amount: draftAmount,
      monthlyCap: draftCap,
      rules: {
        gold: { ...bot.rules.gold, fixedPrice: parseAmount(fixed.gold) },
        silver: { ...bot.rules.silver, fixedPrice: parseAmount(fixed.silver) },
        platinum: { ...bot.rules.platinum, fixedPrice: parseAmount(fixed.platinum) },
      },
      // Un bot relancé repart de zéro pour la comparaison.
      startedAt: !saved || (!saved.active && bot.active) ? now.toISOString() : saved.startedAt,
    };
    updateAccount((a) => ({ ...a, dipBot: value }));
    setBot(value);
    setMsg({
      ok: true,
      text: value.active ? 'Bot d’achat enregistré : il surveille les cours.' : 'Bot d’achat en pause.',
    });
  }

  const comparison = saved ? compareDip(account, saved.startedAt) : [];
  const testedDays = saved ? Math.floor((now.getTime() - new Date(saved.startedAt).getTime()) / 86_400_000) : 0;
  const nextRefresh = new Date(new Date(bot.fixedUpdatedAt).getTime() + DIP_LIMITS.refreshMs);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen testID="screen-bot">
        <Hint>
          En plus de vos achats programmés, le bot achète un métal quand il passe sous son prix fixe ou tombe sous sa
          moyenne des 30 derniers jours, et achète le double en cas de baisse forte. Au plus un achat de baisse par
          métal sur 7 jours, dans la limite du plafond mensuel.
        </Hint>

        <Card style={styles.switchRow}>
          <Text style={styles.switchLabel}>Bot d’achat sur baisse actif</Text>
          <Switch
            value={bot.active}
            onValueChange={(active) => {
              setBot({ ...bot, active });
              setMsg(null);
            }}
            trackColor={{ true: colors.gold, false: colors.surfaceAlt }}
          />
        </Card>

        <SectionTitle>En ce moment</SectionTitle>
        {waitDays > 0 && (
          <Hint>
            Moyenne 30 jours : encore {waitDays} jour{waitDays > 1 ? 's' : ''} de relevés nécessaire
            {waitDays > 1 ? 's' : ''}. D’ici là, seuls les prix fixes déclenchent un achat.
          </Hint>
        )}
        <Card style={{ paddingVertical: 4 }}>
          {SPOT_METALS.map((m, i) => {
            const rule = bot.rules[m];
            const avg = dipAverage(hourlyHistory, m, now);
            const s = dipSignal(rule, prices[m], avg);
            const last = saved?.lastBuyAt[m];
            const next = last ? new Date(new Date(last).getTime() + DIP_LIMITS.weekMs) : null;
            const waiting = next && next.getTime() > now.getTime();
            return (
              <View key={m} style={[styles.metal, i > 0 && styles.border]}>
                <View style={styles.metalHead}>
                  <View style={[styles.dot, { backgroundColor: metalColor[m] }]} />
                  <Text style={styles.metalName}>{METAL_LABEL[m]}</Text>
                  <Text style={[styles.badge, s.kind !== 'none' && !waiting && styles.badgeOn]}>
                    {waiting ? 'Déjà acheté cette semaine' : SIGNAL_LABEL[s.kind]}
                  </Text>
                </View>
                <Text style={styles.line}>
                  Cours {perG(prices[m], m)}
                  {avg ? ` · moyenne 30 j ${perG(avg, m)} (${pct(-(s.dropPct ?? 0))})` : ''}
                </Text>
                <Text style={styles.rule}>
                  Achat sous {perG(rule.fixedPrice, m)} ou à −{rule.avgDropPct} % · double à −{rule.strongDropPct} %
                </Text>
                {last && (
                  <Text style={styles.rule}>
                    Dernier achat de baisse : {formatDate(last)}
                    {waiting && next ? ` · prochain possible le ${formatDate(next.toISOString())}` : ''}
                  </Text>
                )}
              </View>
            );
          })}
        </Card>
        <Hint>
          Ce mois-ci : {formatEur(spent)} d’achats de baisse sur {formatEur(bot.monthlyCap)} de plafond.
        </Hint>

        <SectionTitle>Réglages</SectionTitle>
        <Card style={{ gap: 10 }}>
          <Label>Montant d’un achat de baisse (le double en baisse forte)</Label>
          <View style={styles.row}>
            <TextInput
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              style={[ui.input, styles.input]}
              accessibilityLabel="Montant d’un achat de baisse"
            />
            <Text style={styles.unit}>€</Text>
          </View>
          <Label>Plafond par mois, tous métaux</Label>
          <View style={styles.row}>
            <TextInput
              value={cap}
              onChangeText={setCap}
              keyboardType="decimal-pad"
              style={[ui.input, styles.input]}
              accessibilityLabel="Plafond mensuel"
            />
            <Text style={styles.unit}>€</Text>
          </View>
          <Label>Paiement</Label>
          <Segmented
            value={bot.source}
            onChange={(source) => setBot({ ...bot, source })}
            options={[
              { value: 'cash', label: 'Compte d’attente' },
              { value: 'card', label: 'Carte bancaire' },
            ]}
          />
          {bot.source === 'cash' && (
            <Hint>
              {formatEur(cash)} disponibles. Si le compte d’attente ne suffit pas, l’achat est sauté et vous êtes
              prévenu.{' '}
              <Text style={ui.link} onPress={() => router.push('/attente')}>
                Créditer ›
              </Text>
            </Hint>
          )}
          <Label>Prix fixes (€/g)</Label>
          {SPOT_METALS.map((m) => (
            <View key={m} style={styles.row}>
              <Text style={styles.fixedLabel}>{METAL_LABEL[m]}</Text>
              <TextInput
                value={fixed[m]}
                onChangeText={(t) => setFixed({ ...fixed, [m]: t })}
                keyboardType="decimal-pad"
                style={[ui.input, styles.input]}
                accessibilityLabel={`Prix fixe ${METAL_LABEL[m]}`}
              />
              <Text style={styles.unit}>€/g</Text>
            </View>
          ))}
          <Hint>
            Mis à jour automatiquement tous les mois : moyenne 30 jours moins {bot.rules.gold.fixedGapPct} % pour le
            Gold Spot, {bot.rules.silver.fixedGapPct} % pour l’argent et le platine. Dernière mise à jour le{' '}
            {formatDate(bot.fixedUpdatedAt)}, prochaine vers le {formatDate(nextRefresh.toISOString())}.
          </Hint>
          {error && <Message ok={false} text={error} />}
          {msg && <Message {...msg} />}
          <Button title="Enregistrer" onPress={save} disabled={!!error} />
        </Card>

        {saved && (
          <>
            <SectionTitle>Test : achat sur baisse vs achat régulier</SectionTitle>
            <Card style={{ gap: 8 }}>
              <Hint>
                Prix moyen payé par gramme, frais compris, depuis le {formatDate(saved.startedAt)} ({testedDays} jour
                {testedDays > 1 ? 's' : ''} sur les 60 à 90 prévus).
              </Hint>
              {comparison.map((c) => (
                <View key={c.metal} style={styles.cmp}>
                  <Text style={styles.metalName}>{METAL_LABEL[c.metal]}</Text>
                  <Text style={styles.line}>
                    Sur baisse :{' '}
                    {c.dip.perGram
                      ? `${perG(c.dip.perGram, c.metal)} (${c.dip.count} achat${c.dip.count > 1 ? 's' : ''})`
                      : 'aucun achat'}
                  </Text>
                  <Text style={styles.line}>
                    Régulier :{' '}
                    {c.regular.perGram
                      ? `${perG(c.regular.perGram, c.metal)} (${c.regular.count} achat${c.regular.count > 1 ? 's' : ''})`
                      : 'aucun achat'}
                  </Text>
                  {c.diffPct !== null && (
                    <Text style={[styles.verdict, { color: c.diffPct < 0 ? colors.up : colors.down }]}>
                      {c.diffPct < 0
                        ? `L’achat sur baisse paie ${pct(c.diffPct).replace('−', '')} moins cher par gramme.`
                        : `L’achat sur baisse paie ${pct(c.diffPct).replace('+', '')} plus cher : il ne fait pas mieux.`}
                    </Text>
                  )}
                </View>
              ))}
              {testedDays >= 60 && comparison.every((c) => c.diffPct === null || c.diffPct >= 0) && (
                <Message
                  ok={false}
                  text="Après 2 mois, l’achat sur baisse ne fait pas mieux : vous pouvez garder l’achat régulier seul (mettez le bot en pause)."
                />
              )}
            </Card>
          </>
        )}
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  switchLabel: { color: colors.text, fontSize: 16, fontWeight: '600', flex: 1 },
  metal: { paddingVertical: 12, gap: 3 },
  border: { borderTopWidth: 1, borderTopColor: colors.border },
  metalHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  metalName: { color: colors.text, fontSize: 15, fontWeight: '700', flex: 1 },
  badge: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  badgeOn: { color: colors.gold },
  line: { color: colors.text, fontSize: 13 },
  rule: { color: colors.textMuted, fontSize: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  input: { flex: 1, minWidth: 0 },
  unit: { color: colors.textMuted, fontSize: 16, fontWeight: '700', minWidth: 30 },
  fixedLabel: { color: colors.text, fontSize: 14, width: 80 },
  cmp: { gap: 2, paddingVertical: 6, borderTopWidth: 1, borderTopColor: colors.border },
  verdict: { fontSize: 13, fontWeight: '700' },
});
