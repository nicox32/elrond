import { useState } from 'react';
import { Linking, StyleSheet, Text } from 'react-native';

import { shareTextFile } from '../backup';
import { csvFileName, operationsCsv } from '../logic/csv';
import { useAccount } from '../state/BankProvider';
import { colors } from '../theme';
import { Button, Card, Hint, Message } from './ui';

export const TEMPLATE_URL = 'https://github.com/nicox32/elrond/releases/latest/download/modele-orvia.xlsx';

/** Profil → Relevés : toutes les opérations en CSV, et le modèle de tableur qui les analyse. */
export function CsvExportCard() {
  const account = useAccount();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const count = account.transactions.length + account.children.reduce((s, c) => s + c.transactions.length, 0);
  return (
    <Card style={{ gap: 8 }}>
      <Text style={styles.title}>Export tableur (CSV)</Text>
      <Hint>
        Toutes vos opérations ({count}), compte principal et comptes enfants : date, métal, grammes, prix au gramme,
        montant, frais, impôt. S’ouvre dans Excel, Google Sheets ou LibreOffice.
      </Hint>
      <Button
        title={busy ? 'Préparation…' : 'Exporter en CSV'}
        disabled={busy}
        onPress={async () => {
          setBusy(true);
          setError(null);
          try {
            await shareTextFile(operationsCsv(account), csvFileName(), 'text/csv', 'Exporter les opérations Orvia');
          } catch {
            setError('Le fichier n’a pas pu être créé. Réessayez.');
          } finally {
            setBusy(false);
          }
        }}
      />
      <Button title="Télécharger le modèle de tableur" variant="ghost" onPress={() => Linking.openURL(TEMPLATE_URL)} />
      <Hint>
        Modèle : collez le CSV dans l’onglet « Opérations » (Google Sheets : Fichier › Importer › Remplacer la feuille
        actuelle, séparateur point-virgule) ; l’onglet « Synthèse » calcule tout seul vos grammes, prix moyen, frais,
        impôts et plus-value par métal et par année.
      </Hint>
      {error && <Message ok={false} text={error} />}
    </Card>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.text, fontSize: 16, fontWeight: '700' },
});
