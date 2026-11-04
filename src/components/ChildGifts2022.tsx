import { useState } from 'react';
import { Alert, Platform, StyleSheet, Text } from 'react-native';

import { GIFTS_2022, importGifts2022, previewGifts2022 } from '../logic/childGifts';
import { formatEur } from '../logic/format';
import { LedgerError } from '../logic/ledger';
import { useAccount, useBank } from '../state/BankProvider';
import { colors } from '../theme';
import { Segmented } from './Segmented';
import { Button, Card, Hint, Message } from './ui';

/** Reprise des dons mensuels à un enfant depuis 2022 (sous la reprise de l'épargne 2019). */
export function ChildGifts2022() {
  const account = useAccount();
  const { commit } = useBank();
  const children = account.children.filter((c) => !c.transferredAt);
  const [childId, setChildId] = useState(children[0]?.id ?? '');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const p = previewGifts2022();
  const child = children.find((c) => c.id === childId) ?? children[0];

  if (!child) {
    return (
      <Card style={{ gap: 4 }}>
        <Text style={styles.title}>Dons à votre enfant depuis 2022</Text>
        <Hint>Créez d’abord le compte de votre enfant (Profil → Comptes enfants) pour reprendre ses dons.</Hint>
      </Card>
    );
  }

  const run = () => {
    try {
      commit((acc) => importGifts2022(acc, child.id));
      setMsg({ ok: true, text: `Dons repris sur le compte de ${child.name}.` });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof LedgerError ? e.message : 'Reprise impossible.' });
    }
  };
  const confirm = () => {
    if (Platform.OS === 'web') return run();
    Alert.alert(
      `Reprendre les dons à ${child.name} ?`,
      `${p.gifts} dons de ${formatEur(GIFTS_2022.monthly)} seront ajoutés à son compte. Une seule fois.`,
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Reprendre', onPress: run },
      ],
    );
  };

  return (
    <Card style={{ gap: 10 }}>
      <Text style={styles.title}>
        {child.gifts2022Imported
          ? `Dons à ${child.name} depuis 2022 repris`
          : `Reprendre les dons à ${child.name} depuis 2022`}
      </Text>
      {children.length > 1 && (
        <Segmented
          value={child.id}
          onChange={setChildId}
          options={children.map((c) => ({ value: c.id, label: c.name }))}
        />
      )}
      <Hint>
        Un don de {formatEur(GIFTS_2022.monthly)} le {GIFTS_2022.dayOfMonth} de chaque mois depuis le 5 janvier 2022,
        investi 50 % en Gold Spot et 50 % en argent, au cours moyen réel de chaque mois, frais d’achat Orvia compris.
        Votre compte principal ne change pas.
      </Hint>
      {child.gifts2022Imported ? (
        <Hint>
          {p.gifts} dons, soit {formatEur(p.total)} versés à {child.name}.
        </Hint>
      ) : (
        <>
          <Text style={styles.preview}>
            {p.gifts} dons, {formatEur(p.total)} versés jusqu’à aujourd’hui.
          </Text>
          <Button title={`Reprendre les dons à ${child.name}`} onPress={confirm} />
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
