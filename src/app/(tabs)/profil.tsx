import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { Alert, Platform, Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { History2021 } from '../../components/History2021';
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

      <Card style={{ paddingVertical: 4 }}>
        <LinkRow
          label="Ma carte Orvia"
          hint={account.card ? `•••• ${account.card.last4}${account.card.frozen ? ' · gelée' : ''}` : 'Gratuite'}
          to="/carte"
        />
        <LinkRow
          label="Répartition"
          hint={(() => {
            const a = account.settings.allocation ?? { gold: 50, silver: 25, platinum: 25 };
            return `Or ${a.gold} % · argent ${a.silver} % · platine ${a.platinum} %`;
          })()}
          to="/repartition"
          border
        />
        <LinkRow label="Parrainage" hint={account.referral.code} to="/parrainage" border />
        <LinkRow
          label="Alertes de prix"
          hint={`${(account.alerts ?? []).filter((x) => x.enabled).length} alerte(s) active(s)`}
          to="/alertes"
          border
        />
        <LinkRow label="Comptes enfants" hint={`${account.children.length} compte(s) · gratuit`} to="/enfants" border />
        <LinkRow label="Tarifs" hint="Frais d’achat, de revente, de virement et d’oxydation" to="/tarifs" border />
      </Card>

      <SectionTitle>Historique</SectionTitle>
      <History2021 />

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

function LinkRow({
  label,
  hint,
  to,
  border,
}: {
  label: string;
  hint: string;
  to: '/enfants' | '/tarifs' | '/carte' | '/parrainage' | '/alertes' | '/repartition';
  border?: boolean;
}) {
  return (
    <Pressable
      onPress={() => router.push(to)}
      style={[styles.link, border && styles.linkBorder]}
      accessibilityRole="link"
    >
      <View style={{ flex: 1 }}>
        <Text style={styles.switchLabel}>{label}</Text>
        <Hint>{hint}</Hint>
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
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
  link: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 10 },
  linkBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  chevron: { color: colors.textMuted, fontSize: 22 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  switchLabel: { color: colors.text, fontSize: 15, fontWeight: '600', marginBottom: 2 },
});
