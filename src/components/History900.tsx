import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { formatEur } from '../logic/format';
import { preview900, replaceWith900History } from '../logic/history900';
import { LedgerError } from '../logic/ledger';
import { useAccount, useBank } from '../state/BankProvider';
import { colors } from '../theme';
import { PinConfirm } from './PinConfirm';
import { Button, Card, Hint, Message } from './ui';

/** Compte d'essai : 900 € versés depuis 2019, avec de longues pauses et des frais d'oxydation. */
export function History900() {
  const account = useAccount();
  const { updateAccount } = useBank();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const p = preview900();
  const kids = account.children.map((c) => c.name).join(', ');

  if (account.history900Imported) {
    const dorm = account.transactions.filter((t) => t.kind === 'fee_dormancy');
    return (
      <Card style={{ gap: 4 }}>
        <Text style={styles.title}>Compte d’essai chargé</Text>
        <Hint>
          {p.payments} versements de 25 €, soit {formatEur(p.total)} depuis le 4 janvier 2019, avec {dorm.length} frais
          d’oxydation ({formatEur(dorm.reduce((s, t) => s + t.eur, 0))}) pendant les pauses.
        </Hint>
      </Card>
    );
  }

  const run = () => {
    try {
      updateAccount((a) => replaceWith900History(a));
      setMsg({ ok: true, text: 'Compte d’essai chargé : voyez l’Historique et vos relevés.' });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof LedgerError ? e.message : 'Chargement impossible.' });
    }
  };

  return (
    <Card style={{ gap: 10 }}>
      <Text style={styles.title}>Compte d’essai : 900 € avec des pauses</Text>
      <Hint>
        {p.payments} versements de 25 € le 5 du mois depuis le 4 janvier 2019, avec de longues pauses (9 à 15 mois).
        Chaque pause de plus de 6 mois entraîne des frais d’oxydation, comme pour un vrai compte. Achats selon votre
        répartition, au cours moyen réel de chaque mois, frais compris. Le versement de ce mois n’est pas ajouté.
      </Hint>
      <Hint>
        Il remplace l’historique et les coffres de votre compte principal
        {kids ? ` ; le compte de ${kids} reste inchangé` : ''}. Exportez d’abord une sauvegarde pour pouvoir revenir en
        arrière.
      </Hint>
      {msg && <Message {...msg} />}
      <Button title="Charger le compte d’essai" variant="ghost" onPress={() => setConfirming(true)} />
      <PinConfirm
        visible={confirming}
        summary={`Remplacer votre compte principal par le compte d’essai (${formatEur(p.total)} depuis 2019).${kids ? ` Le compte de ${kids} ne change pas.` : ''}`}
        onConfirm={() => {
          setConfirming(false);
          run();
        }}
        onCancel={() => setConfirming(false)}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.text, fontSize: 16, fontWeight: '700' },
});
