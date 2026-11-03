import { useState } from 'react';
import { Alert, Platform, StyleSheet, Text } from 'react-native';

import { pickBackup, shareBackup } from '../backup';
import { backupFileName, BackupError, makeBackup, readBackup } from '../logic/backup';
import { formatDate } from '../logic/format';
import type { Account } from '../logic/types';
import { useAccount, useBank } from '../state/BankProvider';
import { colors } from '../theme';
import { PinConfirm } from './PinConfirm';
import { Button, Card, Hint } from './ui';

function notify(title: string, message: string) {
  if (Platform.OS === 'web') window.alert(`${title}\n\n${message}`);
  else Alert.alert(title, message);
}

/** Exporter / restaurer le compte. */
export function BackupCard() {
  const account = useAccount();
  const { updateAccount } = useBank();
  const [pending, setPending] = useState<{ account: Account; exportedAt: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function exportNow() {
    setBusy(true);
    try {
      await shareBackup(makeBackup(account), backupFileName());
    } catch {
      notify('Sauvegarde impossible', 'Le fichier n’a pas pu être créé. Réessayez.');
    } finally {
      setBusy(false);
    }
  }

  async function restore() {
    try {
      const text = await pickBackup();
      if (text === null) return;
      setPending(readBackup(text));
    } catch (e) {
      notify('Restauration impossible', e instanceof BackupError ? e.message : 'Le fichier n’a pas pu être lu.');
    }
  }

  return (
    <Card style={{ gap: 10 }}>
      <Text style={styles.title}>Sauvegarde de vos données</Text>
      <Hint>
        Vos coffres, votre historique, vos alertes et les comptes enfants sont enregistrés sur ce téléphone. Exportez
        régulièrement une sauvegarde (Google Drive, e-mail…) pour les retrouver si vous changez de téléphone. Votre code
        n’y figure pas.
      </Hint>
      <Button title={busy ? 'Préparation…' : 'Exporter une sauvegarde'} onPress={exportNow} disabled={busy} />
      <Button title="Restaurer une sauvegarde" variant="ghost" onPress={restore} />
      <PinConfirm
        visible={!!pending}
        summary={
          pending
            ? `Remplacer le compte actuel par la sauvegarde${
                pending.exportedAt ? ` du ${formatDate(pending.exportedAt)}` : ''
              } (${pending.account.transactions.length} opérations). Votre code actuel est gardé.`
            : ''
        }
        onConfirm={() => {
          const next = pending?.account;
          setPending(null);
          if (next) {
            updateAccount(() => next);
            notify('Sauvegarde restaurée', 'Votre compte a été remis tel qu’il était lors de la sauvegarde.');
          }
        }}
        onCancel={() => setPending(null)}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.text, fontSize: 16, fontWeight: '700' },
});
