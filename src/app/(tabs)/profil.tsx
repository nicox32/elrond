import { useEffect, useState } from 'react';
import { Alert, Platform, StyleSheet, Switch, Text, View } from 'react-native';

import { Segmented } from '../../components/Segmented';
import { Button, Card, Hint, Label, Screen, SectionTitle, Title } from '../../components/ui';
import { formatDate } from '../../logic/format';
import { useAccount, useBank } from '../../state/BankProvider';
import { authenticateWithBiometrics, biometricsAvailable } from '../../security';
import { colors } from '../../theme';

export default function ProfileScreen() {
  const account = useAccount();
  const { updateSettings, resetAccount } = useBank();
  const [bioAvailable, setBioAvailable] = useState(false);

  useEffect(() => {
    biometricsAvailable().then(setBioAvailable);
  }, []);

  async function toggleBiometrics(on: boolean) {
    // On vérifie l'empreinte avant de l'activer.
    if (on && !(await authenticateWithBiometrics('Activer le déverrouillage par empreinte'))) return;
    updateSettings({ biometrics: on });
  }

  function confirmReset() {
    const run = () => resetAccount();
    if (Platform.OS === 'web') {
      run();
      return;
    }
    Alert.alert('Fermer le compte de démo ?', 'Le solde, l’historique et le code seront effacés.', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Fermer le compte', style: 'destructive', onPress: run },
    ]);
  }

  return (
    <Screen testID="screen-profil">
      <Title>Profil</Title>

      <Card style={{ gap: 10 }}>
        <Row label="Titulaire" value={account.holder} />
        <Row label="Identifiant membre" value={account.memberId} />
        <Row label="IBAN" value={account.iban} />
        <Row label="Compte ouvert le" value={formatDate(account.createdAt)} />
      </Card>

      <SectionTitle>Affichage</SectionTitle>
      <Label>Unité de poids</Label>
      <Segmented
        value={account.settings.unit}
        onChange={(unit) => updateSettings({ unit })}
        options={[
          { value: 'g', label: 'Grammes' },
          { value: 'oz', label: 'Onces troy' },
        ]}
      />

      <SectionTitle>Sécurité</SectionTitle>
      <Card style={styles.switchRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.switchLabel}>Déverrouiller avec l’empreinte</Text>
          <Hint>
            {bioAvailable ? 'Aussi utilisée pour confirmer les virements.' : 'Non disponible sur cet appareil.'}
          </Hint>
        </View>
        <Switch
          value={account.settings.biometrics}
          onValueChange={toggleBiometrics}
          disabled={!bioAvailable}
          trackColor={{ true: colors.gold, false: colors.surfaceAlt }}
        />
      </Card>
      <Hint>Le code à 4 chiffres est demandé à chaque ouverture de l’appli et pour valider chaque virement.</Hint>

      <SectionTitle>Compte de démonstration</SectionTitle>
      <Hint>
        Les cours affichés sont réels (or, argent et platine au comptant, convertis en euros). Les achats, ventes et
        virements sont simulés : aucun argent ni métal réel n’est échangé.
      </Hint>
      <Button title="Fermer le compte de démo" variant="danger" onPress={confirmReset} />
    </Screen>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} selectable>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  rowLabel: { color: colors.textMuted, fontSize: 11 },
  rowValue: { color: colors.text, fontSize: 15, fontWeight: '600' },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  switchLabel: { color: colors.text, fontSize: 15, fontWeight: '600', marginBottom: 2 },
});
