import { useState } from 'react';
import { Alert, Platform, StyleSheet, Text, TextInput, View } from 'react-native';

import { formatEur, parseAmount } from '../logic/format';
import { DEFAULT_PLAN_2021, import2021History, preview2021 } from '../logic/history2021';
import { TROY_OUNCE } from '../logic/ledger';
import { useAccount, useBank } from '../state/BankProvider';
import { colors } from '../theme';
import { Segmented } from './Segmented';
import { Button, Card, Hint, Label, styles as ui } from './ui';

const SHARES = ['1', '0.75', '0.5', '0.25', '0'] as const;
type Share = (typeof SHARES)[number];
const SHARE_LABEL: Record<Share, string> = { '1': '100 %', '0.75': '75 %', '0.5': '50 %', '0.25': '25 %', '0': '0 %' };

const oz = (n: number) => `${n.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} oz`;

/** Reprise d'un historique d'achats mensuels en 2021 (le 5 de chaque mois). */
export function History2021() {
  const account = useAccount();
  const { quote, commit } = useBank();
  const [total, setTotal] = useState(String(DEFAULT_PLAN_2021.total));
  const [share, setShare] = useState<Share>('0.75');

  if (account.history2021Imported) {
    return (
      <Card style={{ gap: 4 }}>
        <Text style={styles.title}>Historique 2021 repris</Text>
        <Hint>Votre compte est ouvert depuis le 5 janvier 2021, avec vos achats mensuels de l’année.</Hint>
      </Card>
    );
  }

  const amount = parseAmount(total);
  const plan = { total: Number.isFinite(amount) ? amount : 0, silverShare: Number(share) };
  const p = preview2021(plan);
  const today = p.silverG * quote.prices.silver + p.goldG * quote.prices.gold || 0;
  const valid = plan.total > 0;

  function run() {
    commit((acc) => import2021History(acc, plan));
  }

  function confirm() {
    if (!valid) return;
    if (Platform.OS === 'web') return run();
    Alert.alert('Reprendre l’historique 2021 ?', 'Les 12 achats seront ajoutés à votre compte. Une seule fois.', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Reprendre', onPress: run },
    ]);
  }

  return (
    <Card style={{ gap: 10 }}>
      <Text style={styles.title}>Reprendre mon historique 2021</Text>
      <Hint>
        Compte ouvert en 2021 avec un achat le 5 de chaque mois, de janvier à décembre. Sans frais : Orvia n’existait
        pas encore.
      </Hint>
      <Label>Total investi en 2021</Label>
      <View style={styles.row}>
        <TextInput
          value={total}
          onChangeText={setTotal}
          keyboardType="decimal-pad"
          style={[ui.input, { flex: 1, minWidth: 0 }]}
          accessibilityLabel="Total investi en 2021"
        />
        <Text style={styles.unit}>€</Text>
      </View>
      <Label>Part en argent (le reste en or)</Label>
      <Segmented value={share} onChange={setShare} options={SHARES.map((v) => ({ value: v, label: SHARE_LABEL[v] }))} />
      {valid && (
        <Text style={styles.preview}>
          12 achats de {formatEur(p.monthly)} : {formatEur(p.monthly * plan.silverShare)} d’argent et{' '}
          {formatEur(p.monthly * (1 - plan.silverShare))} d’or. Soit {oz(p.silverOz)} d’argent et {oz(p.goldOz)} d’or,
          qui valent environ {formatEur(today)} aujourd’hui (×
          {(today / plan.total).toLocaleString('fr-FR', { maximumFractionDigits: 1 })}), au cours réel du jour.
        </Text>
      )}
      <Button title="Reprendre l’historique" onPress={confirm} disabled={!valid} />
      <Hint>
        Cours de 2021 approximatifs (moyenne mensuelle autour du 5 : argent ≈ 21 €/oz, or ≈ 1 520 €/oz). Aucun frais
        d’oxydation n’est appliqué pour le passé : les 6 mois commencent à compter le jour de la reprise. 1 oz ={' '}
        {TROY_OUNCE.toLocaleString('fr-FR', { maximumFractionDigits: 4 })} g.
      </Hint>
    </Card>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.text, fontSize: 16, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  unit: { width: 32, color: colors.textMuted, fontSize: 20, fontWeight: '700', textAlign: 'center' },
  preview: {
    color: colors.text,
    backgroundColor: colors.goldSoft,
    padding: 12,
    borderRadius: 12,
    fontSize: 14,
    lineHeight: 20,
  },
});
