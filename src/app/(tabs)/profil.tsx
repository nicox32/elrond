import { useEffect, useState } from 'react';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { Alert, Platform, Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { BackupCard } from '../../components/BackupCard';
import { History2019 } from '../../components/History2019';
import { PinConfirm } from '../../components/PinConfirm';
import { Segmented } from '../../components/Segmented';
import { Button, Card, Hint, Label, Screen, SectionTitle, Title } from '../../components/ui';
import { formatDate, formatEur as formatEurShort } from '../../logic/format';
import { resetVaults } from '../../logic/ledger';
import { loyalty } from '../../logic/loyalty';
import { useAccount, useBank } from '../../state/BankProvider';
import { authenticateWithBiometrics, biometricsAvailable } from '../../security';
import { colors } from '../../theme';

export default function ProfileScreen() {
  const account = useAccount();
  const { updateSettings, resetAccount, updateAccount } = useBank();
  const [vaultConfirm, setVaultConfirm] = useState(false);
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
    Alert.alert('Fermer le compte ?', 'Le solde, l’historique et le code seront effacés.', [
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
        <LinkRow
          label="Plus-value et impôts"
          hint="Gain latent avant et après impôt, règles françaises"
          to="/fiscalite"
          border
        />
        <LinkRow
          label="L’or fractionné"
          hint="Port franc, propriété de votre métal, assurance et audit"
          to="/or-fractionne"
          border
        />
        <LinkRow
          label="Achats programmés"
          hint={
            account.plan?.active
              ? `${formatEurShort(account.plan.amount)} ${account.plan.frequency === 'weekly' ? 'par semaine' : 'par mois'}`
              : 'Investir automatiquement chaque semaine ou chaque mois'
          }
          to="/programme"
          border
        />
        <LinkRow
          label="Compte d’attente"
          hint={`${(account.cashEur ?? 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })} à investir`}
          to="/attente"
          border
        />
        <LinkRow
          label="Fidélité"
          hint={`${loyalty(account).balance} LOU · épargne régulière récompensée`}
          to="/fidelite"
          border
        />
        <LinkRow
          label="Société Orvia"
          hint="Tableau de bord (code) : revenus et coûts de la société"
          to="/dev"
          border
        />
        <LinkRow label="Tarifs" hint="Frais d’achat, de revente, de virement et d’oxydation" to="/tarifs" border />
      </Card>

      <SectionTitle>Historique</SectionTitle>
      <History2019 />

      <SectionTitle>Sauvegarde</SectionTitle>
      <BackupCard />

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

      <SectionTitle>Compte</SectionTitle>
      <Hint>Cours réels de l’or, de l’argent et du platine au comptant, convertis en euros.</Hint>
      <Button title="Vider mes coffres" variant="ghost" onPress={() => setVaultConfirm(true)} />
      <Hint>
        Remet à zéro vos métaux et votre historique d’opérations. Votre compte, votre code, vos alertes et les comptes
        enfants sont gardés.
      </Hint>
      <Button title="Fermer le compte" variant="danger" onPress={confirmReset} />
      <PinConfirm
        visible={vaultConfirm}
        summary="Vider tous vos coffres : Gold Spot, argent et platine, et effacer l’historique des opérations."
        onConfirm={() => {
          setVaultConfirm(false);
          updateAccount((acc) => resetVaults(acc));
        }}
        onCancel={() => setVaultConfirm(false)}
      />
      <Text style={styles.version} testID="app-version">
        Orvia · version {Constants.expoConfig?.version ?? '—'}
      </Text>
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
  to:
    | '/enfants'
    | '/tarifs'
    | '/carte'
    | '/parrainage'
    | '/alertes'
    | '/repartition'
    | '/fiscalite'
    | '/or-fractionne'
    | '/dev'
    | '/attente'
    | '/programme'
    | '/fidelite';
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
  version: { color: colors.textMuted, fontSize: 12, textAlign: 'center', marginTop: 16 },
  rowLabel: { color: colors.textMuted, fontSize: 11 },
  rowValue: { color: colors.text, fontSize: 15, fontWeight: '600' },
  link: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 10 },
  linkBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  chevron: { color: colors.textMuted, fontSize: 22 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  switchLabel: { color: colors.text, fontSize: 15, fontWeight: '600', marginBottom: 2 },
});
