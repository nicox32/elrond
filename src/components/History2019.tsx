import { Alert, Platform, StyleSheet, Text } from 'react-native';

import { formatEur } from '../logic/format';
import { import2019History, PLAN_2019, preview2019 } from '../logic/history2019';
import { useAccount, useBank } from '../state/BankProvider';
import { colors } from '../theme';
import { Button, Card, Hint } from './ui';

/** Reprise de l'épargne régulière depuis 2019 (25 € par semaine, 4 achats). */
export function History2019() {
  const account = useAccount();
  const { commit } = useBank();
  const p = preview2019();

  if (account.history2019Imported) {
    return (
      <Card style={{ gap: 4 }}>
        <Text style={styles.title}>Épargne depuis 2019 reprise</Text>
        <Hint>
          Compte ouvert le 4 janvier 2019 : {p.purchases.toLocaleString('fr-FR')} achats de {formatEur(p.each)}, soit{' '}
          {formatEur(p.total)} investis.
        </Hint>
      </Card>
    );
  }

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
        {p.purchases.toLocaleString('fr-FR')} achats, {formatEur(p.total)} investis jusqu’à aujourd’hui. Cours d’achat :
        moyennes annuelles estimées.
      </Text>
      <Button title="Reprendre mon épargne depuis 2019" onPress={confirm} />
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
