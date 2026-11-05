import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { CodeConfirm } from '../components/CodeConfirm';
import { ChildGifts2022 } from '../components/ChildGifts2022';
import { History2019 } from '../components/History2019';
import { History900 } from '../components/History900';
import { PinConfirm } from '../components/PinConfirm';
import { Button, Card, Hint, Message, Screen, SectionTitle, styles as ui } from '../components/ui';
import { resetVaults } from '../logic/ledger';
import { COMPANY, type CompanyPeriod, companyReport } from '../logic/company';
import { formatEur } from '../logic/format';
import { createSecret, isValidPinFormat, verifySecret } from '../security';
import { useAccount, useBank } from '../state/BankProvider';
import { colors } from '../theme';

import { Segmented } from '../components/Segmented';

const pct = (n: number) => `${(n * 100).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} %`;

/** Tableau de bord « Société Orvia », protégé par son propre code. */
export default function DevScreen() {
  const account = useAccount();
  const { updateSettings } = useBank();
  const [unlocked, setUnlocked] = useState(false);
  const [asking, setAsking] = useState(false);
  const [code, setCode] = useState('');
  const [code2, setCode2] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  if (unlocked) return <CompanyDashboard />;

  if (!account.settings.devCodeHash) {
    return (
      <Screen testID="screen-dev">
        <Card style={{ gap: 10 }}>
          <Text style={styles.bold}>Créer le code du tableau de bord</Text>
          <Text style={styles.para}>
            Ce code à 4 chiffres protège le tableau de bord de la société. Choisissez-en un différent de votre code
            d’accès.
          </Text>
          <TextInput
            value={code}
            onChangeText={setCode}
            placeholder="Code (4 chiffres)"
            placeholderTextColor={colors.textMuted}
            keyboardType="number-pad"
            secureTextEntry
            maxLength={4}
            style={ui.input}
          />
          <TextInput
            value={code2}
            onChangeText={setCode2}
            placeholder="Confirmer le code"
            placeholderTextColor={colors.textMuted}
            keyboardType="number-pad"
            secureTextEntry
            maxLength={4}
            style={ui.input}
          />
          <Button
            title="Enregistrer le code"
            onPress={async () => {
              if (!isValidPinFormat(code)) return setMsg({ ok: false, text: 'Le code doit faire 4 chiffres.' });
              if (code !== code2) return setMsg({ ok: false, text: 'Les deux codes sont différents.' });
              updateSettings({ devCodeHash: await createSecret(code) });
              setUnlocked(true);
            }}
          />
          {msg && <Message {...msg} />}
        </Card>
      </Screen>
    );
  }

  return (
    <Screen testID="screen-dev">
      <Card style={{ gap: 10 }}>
        <Text style={styles.bold}>Tableau de bord verrouillé</Text>
        <Text style={styles.para}>Entrez le code pour voir les chiffres de la société Orvia.</Text>
        <Button title="Déverrouiller" onPress={() => setAsking(true)} />
      </Card>
      <CodeConfirm
        visible={asking}
        title="Code du tableau de bord"
        summary="Société Orvia"
        verify={(pin) => verifySecret(pin, account.settings.devCodeHash)}
        onConfirm={() => {
          setAsking(false);
          setUnlocked(true);
        }}
        onCancel={() => setAsking(false)}
      />
    </Screen>
  );
}

function CompanyDashboard() {
  const account = useAccount();
  const { quote, updateAccount } = useBank();
  const [vaultConfirm, setVaultConfirm] = useState(false);
  const [period, setPeriod] = useState<CompanyPeriod>('year');
  const r = companyReport(account, quote.prices, period);
  const years = r.years.toLocaleString('fr-FR', { maximumFractionDigits: 1 });

  return (
    <Screen testID="screen-dev">
      <Hint>
        Ce que la société Orvia aurait gagné et dépensé avec les opérations de ce compte (et des comptes enfants). Les
        revenus sont les frais réellement prélevés ; les coûts sont des estimations.
      </Hint>
      <Segmented
        value={period}
        onChange={setPeriod}
        options={[
          { value: 'year', label: '12 derniers mois' },
          { value: 'all', label: 'Depuis l’ouverture' },
        ]}
      />

      <Card style={{ gap: 8, borderColor: r.margin >= 0 ? colors.up : colors.down }}>
        <Row label={`Marge sur la période (${years} an${r.years >= 2 ? 's' : ''})`} value={signed(r.margin)} strong />
        <Row label="Marge par an pour ce client" value={signed(r.marginPerYear)} strong />
        <Text style={styles.muted}>
          {r.breakEvenClients
            ? `Avec ${formatEur(COMPANY.fixedYearly)} de frais fixes par an (équipe, conformité, audit, appli), il faudrait environ ${r.breakEvenClients.toLocaleString('fr-FR')} clients comme celui-ci pour être rentable.`
            : 'Ce client ne couvre pas encore ses propres coûts : la société perd de l’argent avec lui sur la période.'}
        </Text>
      </Card>

      <SectionTitle>Revenus</SectionTitle>
      <Card style={{ gap: 6 }}>
        <Row label="Frais d’achat" value={formatEur(r.revenue.buy)} />
        <Row label="Frais de revente et virements" value={formatEur(r.revenue.sale)} />
        <Row label="Frais de conversion" value={formatEur(r.revenue.conversion)} />
        <Row label="Frais d’oxydation (comptes inactifs)" value={formatEur(r.revenue.dormancy)} />
        <Row
          label={`Commission sur les paiements par carte (${pct(COMPANY.interchange)})`}
          value={formatEur(r.revenue.card)}
        />
        <View style={styles.sep} />
        <Row label="Total des revenus" value={formatEur(r.revenue.total)} strong />
      </Card>

      <SectionTitle>Coûts</SectionTitle>
      <Card style={{ gap: 6 }}>
        <Row
          label={`Garde en port franc et assurance (${pct(COMPANY.custodyYearly)} par an de ${formatEur(r.assets)})`}
          value={formatEur(r.costs.custody)}
        />
        <Row
          label={`Vérification d’identité (${formatEur(COMPANY.kycPerAccount)} par compte)`}
          value={formatEur(r.costs.kyc)}
        />
        <Row label="Louis de fidélité gagnés" value={formatEur(r.costs.loyalty)} />
        <Row label="Bonus de parrainage" value={formatEur(r.costs.referral)} />
        <View style={styles.sep} />
        <Row label="Total des coûts" value={formatEur(r.costs.total)} strong />
      </Card>

      <Card style={{ gap: 6 }}>
        <Row label="Impôt retenu pour l’État (pas un revenu)" value={formatEur(r.taxCollected)} />
        <Row label="Opérations sur la période" value={String(r.operations)} />
        <Text style={styles.muted}>
          Non comptés : intérêts sur les euros du compte d’attente, coût des paiements par carte bancaire, transports de
          métal, et la part de chaque client dans les frais fixes (voir le seuil de rentabilité ci-dessus).
        </Text>
      </Card>

      <SectionTitle>Outils du compte</SectionTitle>
      <Hint>Réservés à la société : reprises d’historique et remise à zéro des coffres du compte principal.</Hint>
      <History2019 />
      <ChildGifts2022 />
      <History900 />
      <Button title="Vider les coffres du compte principal" variant="ghost" onPress={() => setVaultConfirm(true)} />
      <Hint>
        Remet à zéro les métaux et l’historique du compte principal. Le compte, le code, les alertes et les comptes
        enfants sont gardés.
      </Hint>
      <PinConfirm
        visible={vaultConfirm}
        summary="Vider tous les coffres du compte principal (Gold Spot, argent, platine) et effacer son historique d’opérations."
        onConfirm={() => {
          setVaultConfirm(false);
          updateAccount((acc) => resetVaults(acc));
        }}
        onCancel={() => setVaultConfirm(false)}
      />
    </Screen>
  );
}

const signed = (n: number) => `${n >= 0 ? '+' : '−'}${formatEur(Math.abs(n))}`;

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={[styles.label, strong && styles.bold]}>{label}</Text>
      <Text style={[styles.value, strong && styles.bold]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  label: { color: colors.textMuted, fontSize: 13, flexShrink: 1 },
  value: { color: colors.text, fontSize: 14, fontVariant: ['tabular-nums'] },
  bold: { color: colors.text, fontWeight: '700', fontSize: 14 },
  para: { color: colors.text, fontSize: 13, lineHeight: 19 },
  muted: { color: colors.textMuted, fontSize: 12, lineHeight: 17, flexShrink: 1 },
  sep: { height: 1, backgroundColor: colors.border },
});
