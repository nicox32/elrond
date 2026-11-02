import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { formatDate, formatEur } from '../logic/format';
import {
  operationHtml,
  PERIOD_LABEL,
  type StatementPeriod,
  type StatementScope,
  statementHtml,
} from '../logic/statement';
import type { Transaction, Wallet } from '../logic/types';
import { exportPdf } from '../pdf';
import { useAccount, useBank } from '../state/BankProvider';
import { colors } from '../theme';
import { Segmented } from './Segmented';
import { Button, Card, Message } from './ui';

/** Bouton « Relevé PDF » avec choix de la période. */
export function StatementCard({
  wallet,
  walletName,
  scope = { kind: 'all' },
}: {
  wallet?: Wallet & { cashEur?: number };
  walletName: string;
  scope?: StatementScope;
}) {
  const account = useAccount();
  const { quote } = useBank();
  const [period, setPeriod] = useState<StatementPeriod>('month');
  const [error, setError] = useState<string | null>(null);
  return (
    <Card style={{ gap: 10 }}>
      <Text style={styles.title}>Relevé de compte (PDF)</Text>
      <Segmented
        value={period}
        onChange={setPeriod}
        options={(['month', 'lastMonth', 'year', 'all'] as StatementPeriod[]).map((p) => ({
          value: p,
          label: p === 'month' ? 'Ce mois' : p === 'lastMonth' ? 'Mois dernier' : p === 'year' ? '12 mois' : 'Tout',
        }))}
      />
      <Button
        title={`Télécharger · ${PERIOD_LABEL[period].toLowerCase()}`}
        variant="ghost"
        onPress={async () => {
          setError(null);
          try {
            const html = statementHtml({
              account,
              wallet: wallet ?? account,
              walletName,
              scope,
              period,
              prices: quote.prices,
            });
            await exportPdf(html, `Relevé ${walletName}`);
          } catch {
            setError('Le relevé n’a pas pu être créé.');
          }
        }}
      />
      {error && <Message ok={false} text={error} />}
    </Card>
  );
}

/** Détail d'une opération, avec son avis d'opération en PDF. */
export function OperationSheet({
  tx,
  walletName,
  onClose,
}: {
  tx: Transaction | null;
  walletName: string;
  onClose: () => void;
}) {
  const account = useAccount();
  return (
    <Modal visible={!!tx} transparent animationType="slide" onRequestClose={onClose}>
      {tx && (
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <Text style={styles.title}>{tx.label}</Text>
            <Text style={styles.muted}>
              {formatDate(tx.date)} · {walletName}
            </Text>
            <View style={styles.line}>
              <Text style={styles.muted}>Montant</Text>
              <Text style={styles.value}>{formatEur(tx.eur)}</Text>
            </View>
            {tx.fees ? (
              <View style={styles.line}>
                <Text style={styles.muted}>Frais</Text>
                <Text style={styles.value}>{formatEur(tx.fees)}</Text>
              </View>
            ) : null}
            {tx.tax ? (
              <View style={styles.line}>
                <Text style={styles.muted}>Impôt retenu</Text>
                <Text style={styles.value}>{formatEur(tx.tax)}</Text>
              </View>
            ) : null}
            <Text style={styles.muted}>Référence {tx.id}</Text>
            <Button
              title="Télécharger l’avis d’opération (PDF)"
              onPress={() => exportPdf(operationHtml(account, walletName, tx), 'Avis d’opération')}
            />
            <Pressable onPress={onClose} style={styles.close} accessibilityRole="button">
              <Text style={styles.closeText}>Fermer</Text>
            </Pressable>
          </View>
        </View>
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.text, fontSize: 16, fontWeight: '700' },
  muted: { color: colors.textMuted, fontSize: 12 },
  value: { color: colors.text, fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'] },
  line: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 32,
    gap: 12,
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  close: { alignItems: 'center', padding: 10 },
  closeText: { color: colors.textMuted, fontSize: 15, fontWeight: '600' },
});
