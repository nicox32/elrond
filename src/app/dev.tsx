import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { BarControl } from '../components/BarControl';
import { StockManager } from '../components/StockManager';
import { CodeConfirm } from '../components/CodeConfirm';
import { ChildGifts2022 } from '../components/ChildGifts2022';
import { History2019 } from '../components/History2019';
import { History900 } from '../components/History900';
import { stockSummary } from '../logic/stock';
import { PhysicalFeesEditor } from '../components/PhysicalFeesEditor';
import { CloudSimulation } from '../components/CloudSimulation';
import { InsuranceMeter } from '../components/InsuranceMeter';
import { PinConfirm } from '../components/PinConfirm';
import { Button, Card, Hint, KeyValue, ListRow, Message, Screen, SectionTitle, styles as ui } from '../components/ui';
import { barSummary } from '../logic/barControl';
import { reopenChildParents } from '../logic/childRules';
import { registerTap, type TapState } from '../logic/devTap';
import { resetVaults } from '../logic/ledger';
import { COMPANY, type CompanyPeriod, companyReport, nextTariffReview } from '../logic/company';
import { formatEur } from '../logic/format';
import { createSecret, isValidPinFormat, verifySecret } from '../security';
import { useAccount, useBank } from '../state/BankProvider';
import { colors } from '../theme';

import { Segmented } from '../components/Segmented';

const pct = (n: number) => `${(n * 100).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} %`;

/**
 * « Espace DEV » : réservé à la société. Pour les clients, l'écran affiche seulement « Inopérant pour les clients » ;
 * six appuis rapides (1,5 s au plus entre deux) sur ce texte ouvrent l'accès, protégé par son propre code.
 */
export default function DevScreen() {
  const account = useAccount();
  const { updateSettings } = useBank();
  const [unlocked, setUnlocked] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const taps = useRef<TapState>({ count: 0, last: 0 });
  const [asking, setAsking] = useState(false);
  const [code, setCode] = useState('');
  const [code2, setCode2] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  if (unlocked) return <CompanyDashboard />;

  // Les clients ne voient que cette phrase. Six appuis, chacun dans la seconde et demie qui suit le précédent, ouvrent l'accès.
  if (!revealed) {
    const tap = () => {
      const r = registerTap(taps.current, Date.now());
      taps.current = r.state;
      if (r.opened) setRevealed(true);
    };
    return (
      <Screen testID="screen-dev">
        <Pressable
          onPress={tap}
          accessibilityRole="button"
          accessibilityLabel="Inopérant pour les clients"
          testID="dev-inoperative"
          style={styles.inoperative}
        >
          <Text style={styles.inoperativeText}>Inopérant pour les clients</Text>
        </Pressable>
      </Screen>
    );
  }

  if (!account.settings.devCodeHash) {
    return (
      <Screen testID="screen-dev">
        <Card style={{ gap: 10 }}>
          <Text style={styles.bold}>Créer le code de l’Espace DEV</Text>
          <Text style={styles.para}>
            Ce code à 4 chiffres protège l’Espace DEV. Choisissez-en un différent de votre code d’accès.
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
        <Text style={styles.bold}>Espace DEV verrouillé</Text>
        <Text style={styles.para}>Entrez votre code.</Text>
        <Button title="Déverrouiller" onPress={() => setAsking(true)} />
      </Card>
      <CodeConfirm
        visible={asking}
        title="Code de l’Espace DEV"
        summary="Espace DEV"
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
  const { quote, updateAccount, updateSettings } = useBank();
  const [vaultConfirm, setVaultConfirm] = useState(false);
  const [period, setPeriod] = useState<CompanyPeriod>('year');
  const [view, setView] = useState<'dashboard' | 'bars' | 'stock' | 'godot' | 'sim'>('dashboard');
  const r = companyReport(account, quote.prices, period);
  const years = r.years.toLocaleString('fr-FR', { maximumFractionDigits: 1 });

  if (view === 'stock') {
    return (
      <Screen testID="screen-stock">
        <StockManager onBack={() => setView('dashboard')} />
      </Screen>
    );
  }

  if (view === 'sim') {
    return (
      <Screen testID="screen-dev-sim">
        <CloudSimulation onBack={() => setView('dashboard')} />
      </Screen>
    );
  }

  if (view === 'godot') {
    return (
      <Screen testID="screen-dev-godot">
        <Button title="← Espace DEV" variant="ghost" onPress={() => setView('dashboard')} />
        <PhysicalFeesEditor part="vendor" />
      </Screen>
    );
  }

  if (view === 'bars') {
    return (
      <Screen testID="screen-controle-lingots">
        <BarControl onBack={() => setView('dashboard')} />
      </Screen>
    );
  }

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

      <Card style={{ gap: 6 }}>
        <InsuranceMeter compact />
      </Card>

      <Card style={{ gap: 8, borderColor: r.margin >= 0 ? colors.up : colors.down }}>
        <Row label={`Marge sur la période (${years} an${r.years >= 2 ? 's' : ''})`} value={signed(r.margin)} strong />
        <Row label="Marge par an pour ce client" value={signed(r.marginPerYear)} strong />
        <Text style={styles.muted}>
          {r.breakEvenClients
            ? `Avec ${formatEur(COMPANY.fixedYearly)} de frais fixes par an (équipe, conformité, audit, appli), il faudrait environ ${r.breakEvenClients.toLocaleString('fr-FR')} clients comme celui-ci pour être rentable.`
            : 'Ce client ne couvre pas encore ses propres coûts : la société perd de l’argent avec lui sur la période.'}
        </Text>
      </Card>

      <Card style={{ gap: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Text style={[styles.bold, { flex: 1 }]}>Frais de garde en coffre</Text>
          <Switch
            testID="custody-switch"
            value={account.settings.custodyFees !== false}
            onValueChange={(custodyFees) => updateSettings({ custodyFees })}
            trackColor={{ true: colors.gold, false: colors.surfaceAlt }}
          />
        </View>
        <Text style={styles.muted}>
          0,15 % par an pour l’or, 0,4 % pour l’argent, 0,2 % pour le platine, prélevés en métal au début de chaque mois
          (comptes enfants exonérés jusqu’à 18 ans). Désactivés, rien n’est prélevé et rien n’est rattrapé ensuite.
        </Text>
      </Card>

      <SectionTitle>Revenus</SectionTitle>
      <Card style={{ gap: 6 }}>
        <Row label="Frais d’achat" value={formatEur(r.revenue.buy)} />
        <Row label="Frais de revente et virements" value={formatEur(r.revenue.sale)} />
        <Row label="Frais de conversion" value={formatEur(r.revenue.conversion)} />
        <Row label="Frais d’oxydation (comptes inactifs)" value={formatEur(r.revenue.dormancy)} />
        <Row label="Frais de garde en coffre" value={formatEur(r.revenue.custody)} />
        <Row label="Retraits physiques (fabrication et livraison)" value={formatEur(r.revenue.physical)} />
        <Row
          label={`Commission sur les paiements par carte (${pct(COMPANY.interchange)})`}
          value={formatEur(r.revenue.card)}
        />
        <View style={styles.sep} />
        <Row label="Total des revenus" value={formatEur(r.revenue.total)} strong />
      </Card>

      <SectionTitle>Coûts</SectionTitle>
      <Hint>
        Tarifs Godot & Fils révisés le {COMPANY.tariffsReviewedOn.split('-').reverse().join('/')}. Prochaine révision de
        l’appli et des tarifs : {nextTariffReview().split('-').reverse().join('/')} (tous les{' '}
        {COMPANY.tariffsReviewEveryMonths} mois, au besoin).
      </Hint>
      <Card style={{ gap: 6 }}>
        <Row
          label={`Garde chez Godot & Fils (${pct(COMPANY.custodyCostYearly)} de la valeur par an, sur ${formatEur(r.assets)})`}
          value={formatEur(r.costs.custody)}
        />
        <Row
          label={`Vérification d’identité (${formatEur(COMPANY.kycPerAccount)} par compte)`}
          value={formatEur(r.costs.kyc)}
        />
        <Row label="Louis de fidélité gagnés" value={formatEur(r.costs.loyalty)} />
        <Row label="Bonus de parrainage" value={formatEur(r.costs.referral)} />
        <Row label="Lingotins et livraison (achat estimé)" value={formatEur(r.costs.physical)} />
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

      <SectionTitle>Réglages verrouillés</SectionTitle>
      <Hint>
        Une fois choisis, l’adresse des relevés et les parents d’un enfant ne se modifient plus depuis le compte.
        Rouvrez ici le réglage que vous voulez laisser corriger.
      </Hint>
      <Card style={{ gap: 8 }}>
        {account.settings.address && !account.settings.addressUnlocked ? (
          <Button
            title="Rouvrir l’adresse des relevés (adulte et enfants)"
            variant="ghost"
            onPress={() => updateSettings({ addressUnlocked: true })}
          />
        ) : (
          <Hint>
            Adresse des relevés : {account.settings.address ? 'ouverte à la modification.' : 'pas encore saisie.'}
          </Hint>
        )}
        {account.children.map((c) =>
          c.authority && !c.parentsUnlocked ? (
            <Button
              key={c.id}
              title={`Rouvrir le choix des parents de ${c.name}`}
              variant="ghost"
              onPress={() => updateAccount((acc) => reopenChildParents(acc, c.id))}
            />
          ) : (
            <Hint key={c.id}>
              Parents de {c.name} : {c.authority ? 'ouvert à la modification.' : 'pas encore choisis.'}
            </Hint>
          ),
        )}
      </Card>

      <SectionTitle>Outils du compte</SectionTitle>
      <Hint>Réservés à la société : reprises d’historique et remise à zéro des coffres du compte principal.</Hint>
      <Card style={{ paddingVertical: 4 }}>
        <ListRow
          first
          title="Contrôle des lingots"
          subtitle={(() => {
            const sm = barSummary(account);
            return `${sm.total} objet${sm.total > 1 ? 's' : ''} · ${sm.todo} à contrôler · ${sm.anomalies} anomalie${sm.anomalies > 1 ? 's' : ''}`;
          })()}
          onPress={() => setView('bars')}
          testID="open-bar-control"
        />
        <ListRow
          title="Stock de lingots et pièces"
          subtitle={(() => {
            const rows = stockSummary(account);
            const total = rows.reduce((t, r) => t + r.total, 0);
            return total ? `${total} exemplaire${total > 1 ? 's' : ''} en stock` : 'Aucun lot · retraits commandés';
          })()}
          onPress={() => setView('stock')}
          testID="open-stock"
        />
        <ListRow
          title="Commande Godot & Fils"
          subtitle="Calcul de prime par lot (remise de 3 à 5 %), prix du jour, enregistrement des lots"
          onPress={() => setView('godot')}
          testID="open-godot"
        />
        <ListRow
          title="Simulation de clients (GitHub)"
          subtitle="50 clients en temps réel et 15 000 sur l’histoire, calculés dans le cloud"
          onPress={() => setView('sim')}
          testID="open-sim"
        />
      </Card>
      <PhysicalFeesEditor part="client" />
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
  return <KeyValue label={label} value={value} strong={strong} />;
}

const styles = StyleSheet.create({
  inoperative: { minHeight: 320, alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  inoperativeText: { color: colors.textMuted, fontSize: 16 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  label: { color: colors.textMuted, fontSize: 13, flexShrink: 1 },
  value: { color: colors.text, fontSize: 14, fontVariant: ['tabular-nums'] },
  bold: { color: colors.text, fontWeight: '700', fontSize: 14 },
  para: { color: colors.text, fontSize: 13, lineHeight: 19 },
  muted: { color: colors.textMuted, fontSize: 12, lineHeight: 17, flexShrink: 1 },
  sep: { height: 1, backgroundColor: colors.border },
});
