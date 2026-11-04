import { useMemo, useState } from 'react';
import { Alert, Platform, StyleSheet, Text } from 'react-native';

import { formatEur, formatWeight } from '../logic/format';
import {
  import2019History,
  needsMonthlyReprice,
  PLAN_2019,
  preview2019,
  reprice2019History,
} from '../logic/history2019';
import { LedgerError } from '../logic/ledger';
import { METALS } from '../logic/types';
import { useAccount, useBank } from '../state/BankProvider';
import { colors } from '../theme';
import { Button, Card, Hint, Message } from './ui';

/** Reprise de l'épargne régulière depuis 2019 (25 € par semaine, 4 achats). */
export function History2019() {
  const account = useAccount();
  const { commit } = useBank();
  const p = preview2019();

  if (account.history2019Imported) return <Imported />;

  const run = () => commit((acc) => import2019History(acc));
  const confirm = () => {
    if (Platform.OS === 'web') return run();
    Alert.alert(
      'Reprendre l’épargne depuis 2019 ?',
      `${p.purchases.toLocaleString('fr-FR')} achats seront ajoutés à votre compte. Une seule fois.`,
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Reprendre', onPress: run },
      ],
    );
  };

  return (
    <Card style={{ gap: 10 }}>
      <Text style={styles.title}>Reprendre mon épargne depuis 2019</Text>
      <Hint>
        Compte ouvert le 4 janvier 2019 : {formatEur(PLAN_2019.weekly)} par semaine, en 4 achats de {formatEur(p.each)}{' '}
        le lundi, le mercredi, le vendredi et le dimanche. Répartition 50 % Gold Spot, 25 % argent, 25 % platine, frais
        d’achat Orvia compris.
      </Hint>
      <Text style={styles.preview}>
        {p.purchases.toLocaleString('fr-FR')} achats, {formatEur(p.total)} investis jusqu’à aujourd’hui, chacun au cours
        moyen réel de son mois.
      </Text>
      <Button title="Reprendre mon épargne depuis 2019" onPress={confirm} />
    </Card>
  );
}

/** Reprise faite : propose le recalcul aux cours mensuels si elle date d'une version précédente. */
function Imported() {
  const account = useAccount();
  const { commit } = useBank();
  const p = preview2019();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const reprice = needsMonthlyReprice(account);
  // Aperçu du recalcul (refait seulement si le compte change).
  const preview = useMemo(() => {
    if (!reprice) return null;
    try {
      return reprice2019History(account);
    } catch {
      return null;
    }
  }, [account, reprice]);

  const run = () => {
    try {
      commit((acc) => reprice2019History(acc));
      setMsg({ ok: true, text: 'Reprise recalculée aux cours de chaque mois.' });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof LedgerError ? e.message : 'Recalcul impossible.' });
    }
  };

  return (
    <Card style={{ gap: 8 }}>
      <Text style={styles.title}>Épargne depuis 2019 reprise</Text>
      <Hint>
        Compte ouvert le 4 janvier 2019 : {p.purchases.toLocaleString('fr-FR')} achats de {formatEur(p.each)}, soit{' '}
        {formatEur(p.total)} investis
        {reprice ? ', aux anciennes moyennes annuelles estimées.' : ', chacun au cours moyen réel de son mois.'}
      </Hint>
      {reprice && preview && (
        <>
          <Text style={styles.preview}>
            Aux cours réels mois par mois :{' '}
            {METALS.map((m) => {
              const d = preview!.holdings[m] - account.holdings[m];
              return `${m === 'gold' ? 'Gold Spot' : m === 'silver' ? 'argent' : 'platine'} ${d >= 0 ? '+' : '−'}${formatWeight(Math.abs(d), 'g', m)}`;
            }).join(', ')}
            . Mêmes montants investis, mêmes frais ; vos opérations faites dans l’appli ne changent pas.
          </Text>
          <Button title="Recalculer avec les cours mois par mois" onPress={run} />
        </>
      )}
      {msg && <Message {...msg} />}
    </Card>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.text, fontSize: 16, fontWeight: '700' },
  preview: {
    color: colors.text,
    backgroundColor: colors.goldSoft,
    borderRadius: 12,
    padding: 12,
    fontSize: 13,
    lineHeight: 19,
  },
});
