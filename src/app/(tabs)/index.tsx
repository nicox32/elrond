import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BalanceChart } from '../../components/BalanceChart';
import { CustodyNote } from '../../components/Custody';
import { DormancyNotice } from '../../components/DormancyNotice';
import { OrviaCard } from '../../components/OrviaCard';
import { VaultLogo } from '../../components/VaultLogo';
import { LivePrices } from '../../components/LivePrices';
import { PriceStatus } from '../../components/PriceStatus';
import { TransactionRow } from '../../components/TransactionRow';
import { HomeNews } from '../../components/HomeNews';
import { HomeNtfyBanner } from '../../components/HomeNtfyBanner';
import { UpdateBanner } from '../../components/UpdateBanner';
import { Banner, Card, ListRow, Screen, SectionTitle, styles as ui, Title } from '../../components/ui';
import { FEES } from '../../logic/fees';
import { formatEur, formatPercent, formatUnitPrice, formatWeight } from '../../logic/format';
import { accountValue, METAL_LABEL, REFERRAL } from '../../logic/ledger';
import { formatLou, loyalty } from '../../logic/loyalty';
import { homeVaultTotal } from '../../logic/physical';
import { estimateTax } from '../../logic/tax';
import { METALS } from '../../logic/types';
import { useAccount, useBank } from '../../state/BankProvider';
import { colors, metalColor, metalSymbol } from '../../theme';

const QUICK = [
  {
    label: 'Acheter',
    icon: '+',
    go: () => router.push({ pathname: '/operations', params: { mode: 'buy', t: Date.now() } }),
  },
  {
    label: 'Vendre',
    icon: '−',
    go: () => router.push({ pathname: '/operations', params: { mode: 'sell', t: Date.now() } }),
  },
  {
    label: 'Convertir',
    icon: '⇄',
    go: () => router.push({ pathname: '/operations', params: { mode: 'convert', t: Date.now() } }),
  },
  { label: 'Virement', icon: '→', go: () => router.push('/virements') },
];

export default function AccountScreen() {
  const account = useAccount();
  const { quote, updateSettings } = useBank();
  const unit = account.settings.unit;
  // Alerte de l'accueil : masquable d'un geste (✕) ou pour de bon dans l'écran Alertes.
  const seenAt = account.settings.homeAlertSeenAt;
  const showAlerts = account.settings.homeAlerts === true;
  const last = account.alertEvents?.[0];
  const ev = last && (!seenAt || last.date > seenAt) ? last : undefined;
  const hideAlerts = () => updateSettings({ homeAlertSeenAt: new Date().toISOString() });
  const discreet = !!account.settings.discreet;
  /** Montant affiché, ou masqué en mode discret. */
  const eur = (n: number) => (discreet ? '•••• €' : formatEur(n));
  const value = accountValue(account, quote.prices);
  const total = value.total;
  const tax = estimateTax(account, quote.prices);
  const home = {
    ...homeVaultTotal(account, quote.prices),
    preparing: (account.homeVault ?? []).filter((b) => b.status === 'preparing').length,
  };
  // Plus-value latente : métal numérique et lingotins gardés chez soi (leur or, au prix d'achat d'origine).
  const gainAll = tax.gain + (home.value - home.cost);
  const gainAllPct = tax.cost + home.cost > 0 ? (gainAll / (tax.cost + home.cost)) * 100 : 0;

  return (
    <Screen testID="screen-compte">
      <Title>Bonjour {account.holder}</Title>
      <Text style={styles.tagline} testID="tagline">
        Or, argent et platine dès {FEES.minOrder} €, à toute heure et tous les jours de l’année : en une fois ou chaque
        semaine, puis en lingotins quand vous le voulez. Les ordres du week-end sont exécutés à la réouverture du
        marché.
      </Text>
      <UpdateBanner />
      <PriceStatus />
      <DormancyNotice wallet={account} />

      <View style={styles.balanceCard}>
        <View style={styles.balanceHead}>
          <Text style={styles.balanceLabel}>Solde total</Text>
          <Pressable
            testID="discreet-toggle"
            onPress={() => updateSettings({ discreet: !discreet })}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={discreet ? 'Afficher les montants' : 'Masquer les montants'}
          >
            <Text style={styles.eye}>{discreet ? '◡ Afficher' : '◉ Masquer'}</Text>
          </Pressable>
        </View>
        <Text style={styles.balance}>{eur(total + home.value)}</Text>
        <Text style={styles.sub}>
          {home.count > 0 ? 'Numérique + physique, au cours actuel' : 'Valeur de revente au cours actuel'}
        </Text>
        {home.count > 0 && (
          <View style={styles.tiles} testID="balance-tiles">
            <Pressable style={styles.tile} onPress={() => router.push('/repartition')} accessibilityRole="button">
              <Text style={styles.tileLabel}>
                <Text style={{ color: colors.gold }}>● </Text>Numérique
              </Text>
              <Text style={styles.tileValue}>{eur(total)}</Text>
              <Text style={styles.tileSub}>au coffre Orvia</Text>
            </Pressable>
            <Pressable style={styles.tile} onPress={() => router.push('/coffre-maison')} accessibilityRole="button">
              <Text style={styles.tileLabel}>
                <Text style={{ color: colors.text }}>● </Text>Physique
              </Text>
              <Text style={styles.tileValue}>{eur(home.value)}</Text>
              <Text style={styles.tileSub}>
                {home.count} lingotin{home.count > 1 ? 's' : ''} ou pièce{home.count > 1 ? 's' : ''}
              </Text>
            </Pressable>
          </View>
        )}
        <Pressable onPress={() => router.push('/fidelite')} accessibilityRole="link">
          <Text style={styles.loyalty}>★ {formatLou(loyalty(account).balance)} de fidélité ›</Text>
        </Pressable>
        {tax.cost + home.cost > 0 && (
          <Text style={[styles.gain, { color: gainAll >= 0 ? colors.up : colors.down }]}>
            {gainAll >= 0 ? 'Plus-value latente' : 'Moins-value latente'} : {gainAll >= 0 ? '+' : '−'}
            {eur(Math.abs(gainAll))} ({formatPercent(gainAllPct)})
          </Text>
        )}
        {tax.cost > 0 && (
          <Pressable onPress={() => router.push('/fiscalite')} accessibilityRole="button" style={styles.taxRow}>
            <Text style={styles.taxText}>
              Après impôt{home.count > 0 ? ' (num.)' : ''} : {tax.netGain >= 0 ? '+' : '−'}
              {eur(Math.abs(tax.netGain))} ({formatPercent(tax.netGainPercent)})
            </Text>
            <Text style={styles.taxLink}>Détail ›</Text>
          </Pressable>
        )}
        <View style={styles.split}>
          {METALS.map((m) =>
            value.byMetal[m] > 0 ? (
              <View key={m} style={{ flex: value.byMetal[m], backgroundColor: metalColor[m] }} />
            ) : null,
          )}
        </View>
      </View>

      <View style={styles.quickRow}>
        {QUICK.map((q) => (
          <Pressable key={q.label} style={styles.quick} onPress={q.go} accessibilityRole="button">
            <View style={styles.quickIcon}>
              <Text style={styles.quickIconText}>{q.icon}</Text>
            </View>
            <Text style={styles.quickLabel}>{q.label}</Text>
          </Pressable>
        ))}
      </View>

      <SectionTitle
        right={
          <Pressable onPress={() => router.push('/alertes')}>
            <Text style={ui.link}>
              🔔 Alertes{account.alerts?.length ? ` (${account.alerts.filter((a) => a.enabled).length})` : ''}
            </Text>
          </Pressable>
        }
      >
        Cours en direct
      </SectionTitle>
      {showAlerts && ev && (
        <View>
          <Banner
            tone="gold"
            icon="🔔"
            title={ev.title}
            onPress={() => {
              hideAlerts();
              router.push('/alertes');
            }}
            testID="home-alert"
          >
            {ev.body}
          </Banner>
          <Pressable
            onPress={hideAlerts}
            hitSlop={10}
            style={styles.alertClose}
            accessibilityRole="button"
            accessibilityLabel="Masquer cette alerte"
            testID="home-alert-close"
          >
            <Text style={styles.alertCloseText}>✕</Text>
          </Pressable>
        </View>
      )}
      {showAlerts && (
        <HomeNtfyBanner topic={account.ntfyTopic} after={[ev?.date, seenAt].filter(Boolean).sort().pop()} />
      )}
      <LivePrices unit={unit} />

      <SectionTitle>Évolution du solde</SectionTitle>
      <Card>
        {discreet ? (
          <Text style={styles.empty}>Masqué en mode discret.</Text>
        ) : (
          <BalanceChart points={account.balanceHistory} />
        )}
      </Card>

      <HomeNews />

      {account.settings.homeCard !== false && (
        <>
          <SectionTitle
            right={
              <Pressable
                onPress={() => updateSettings({ homeCard: false })}
                accessibilityRole="button"
                accessibilityLabel="Masquer la carte de l’accueil"
                testID="hide-home-card"
              >
                <Text style={ui.link}>Masquer</Text>
              </Pressable>
            }
          >
            Ma carte
          </SectionTitle>
          {account.card ? (
            <Pressable
              onPress={() => router.push('/carte')}
              accessibilityRole="button"
              accessibilityLabel="Ouvrir ma carte"
            >
              <OrviaCard card={account.card} />
            </Pressable>
          ) : (
            <Banner icon="▭" title="Votre carte Orvia" onPress={() => router.push('/carte')} testID="card-banner">
              Payez et retirez avec votre or, votre argent ou votre platine : commandez votre carte Orvia, gratuite.
            </Banner>
          )}
        </>
      )}

      <Banner tone="gold" icon="★" title="Parrainez vos proches" onPress={() => router.push('/parrainage')}>
        {`Ils reçoivent ${REFERRAL.bonusLou} € en or à leur premier achat.`}
      </Banner>

      <SectionTitle
        right={
          <Pressable onPress={() => router.push('/enfants')}>
            <Text style={ui.link}>{account.children.length ? 'Gérer' : 'Ouvrir'}</Text>
          </Pressable>
        }
      >
        Comptes enfants
      </SectionTitle>
      <Card style={{ paddingVertical: 4 }}>
        {account.children.length === 0 ? (
          <ListRow
            first
            title="Ouvrir un compte enfant"
            subtitle="Gratuit, en or, argent ou platine, pour chacun de vos enfants."
            onPress={() => router.push('/enfants')}
          />
        ) : (
          account.children.map((c, i) => (
            <ListRow
              key={c.id}
              first={i === 0}
              title={c.name}
              subtitle={c.transferredAt ? 'Compte transféré' : 'Compte enfant · gratuit'}
              right={c.transferredAt ? undefined : eur(accountValue(c, quote.prices).total)}
              onPress={() => router.push({ pathname: '/enfants/[id]', params: { id: c.id } })}
            />
          ))
        )}
      </Card>

      <SectionTitle
        right={
          <Pressable onPress={() => router.push('/repartition')}>
            <Text style={ui.link}>Répartition</Text>
          </Pressable>
        }
      >
        Mes coffres
      </SectionTitle>
      <Card style={{ paddingVertical: 4 }}>
        <Pressable
          onPress={() => router.push('/coffre-maison')}
          style={styles.vaultHead}
          accessibilityRole="button"
          accessibilityLabel="Ouvrir mon coffre maison"
          testID="vaults-summary"
        >
          <VaultLogo size={60} />
          <View style={{ flex: 1 }}>
            <Text style={styles.vaultName}>Total des coffres</Text>
            <Text style={styles.vaultHeadValue}>{eur(total + home.value)}</Text>
            <Text style={styles.vaultPrice}>
              dont lingots et pièces : {eur(home.value)} ({home.count})
            </Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </Pressable>
        <View style={styles.vaultBorder} />
        {METALS.map((m, i) => (
          <Pressable
            key={m}
            onPress={() => router.push({ pathname: '/coffre/[metal]', params: { metal: m } })}
            style={[styles.vault, i > 0 && styles.vaultBorder]}
            accessibilityRole="button"
          >
            <View style={[styles.symbol, { borderColor: metalColor[m] }]}>
              <Text style={[styles.symbolText, { color: metalColor[m] }]}>{metalSymbol[m]}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.vaultName}>{METAL_LABEL[m]}</Text>
              <Text style={styles.vaultPrice}>{formatUnitPrice(quote.prices[m], unit, m)}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.vaultWeight}>{discreet ? '•••' : formatWeight(account.holdings[m], unit, m)}</Text>
              <Text style={styles.vaultValue}>{eur(value.byMetal[m])}</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        ))}
        {home.count > 0 && (
          // Lingotins retirés et gardés chez soi : visibles ici dès le premier retrait.
          <Pressable
            onPress={() => router.push('/coffre-maison')}
            style={[styles.vault, styles.vaultBorder]}
            accessibilityRole="button"
            testID="home-vault-row"
          >
            <View style={[styles.symbol, { borderColor: metalColor.gold, borderStyle: 'dashed' }]}>
              <Text style={[styles.symbolText, { color: metalColor.gold }]}>⌂</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.vaultName}>Coffre maison</Text>
              <Text style={styles.vaultPrice}>
                {home.count} lingotin{home.count > 1 ? 's' : ''} d’or chez vous
                {home.preparing ? ` · ${home.preparing} en livraison` : ''}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.vaultWeight}>{discreet ? '•••' : formatWeight(home.grams, unit, 'gold')}</Text>
              <Text style={styles.vaultValue}>{eur(home.value)}</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        )}
      </Card>
      <CustodyNote logo={false} />

      <SectionTitle
        right={
          account.transactions.length > 0 ? (
            <Pressable onPress={() => router.push('/historique')}>
              <Text style={ui.link}>Tout voir</Text>
            </Pressable>
          ) : undefined
        }
      >
        Dernières opérations
      </SectionTitle>
      {account.transactions.length === 0 ? (
        <Text style={styles.empty}>Aucune opération. Commence par acheter un peu d’or, d’argent ou de platine.</Text>
      ) : (
        account.transactions
          .slice(0, 3)
          .map((tx) => <TransactionRow key={tx.id} tx={tx} unit={unit} discreet={discreet} />)
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  vaultHead: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12 },
  vaultHeadValue: { color: colors.gold, fontSize: 22, fontWeight: '800' },
  loyalty: { color: colors.gold, fontSize: 13, fontWeight: '700', marginTop: 4 },
  taxRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  taxText: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  taxLink: { color: colors.gold, fontSize: 13, fontWeight: '700' },
  balanceCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.gold,
    gap: 4,
  },
  balanceLabel: { color: colors.textMuted, fontSize: 13 },
  balanceHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  eye: { color: colors.gold, fontSize: 12.5, fontWeight: '700' },
  balance: { color: colors.text, fontSize: 34, fontWeight: '800', fontVariant: ['tabular-nums'] },
  sub: { color: colors.textMuted, fontSize: 11 },
  alertClose: { position: 'absolute', top: 8, right: 10, padding: 4 },
  alertCloseText: { color: colors.textMuted, fontSize: 16, fontWeight: '700' },
  tagline: { color: colors.textMuted, fontSize: 12.5, lineHeight: 17, marginTop: -6 },
  tiles: { flexDirection: 'row', gap: 10, marginTop: 12 },
  tile: { flex: 1, backgroundColor: colors.surfaceAlt, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 12 },
  tileLabel: { color: colors.textMuted, fontSize: 11.5 },
  tileValue: { color: colors.text, fontSize: 16.5, fontWeight: '800', marginTop: 2, fontVariant: ['tabular-nums'] },
  tileSub: { color: colors.textMuted, fontSize: 11 },
  gain: { fontSize: 13, fontWeight: '700', marginTop: 6, fontVariant: ['tabular-nums'] },
  split: {
    flexDirection: 'row',
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: 12,
    backgroundColor: colors.surfaceAlt,
  },
  quickRow: { flexDirection: 'row', justifyContent: 'space-between' },
  quick: { alignItems: 'center', gap: 6, flex: 1 },
  quickIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.goldSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickIconText: { color: colors.gold, fontSize: 22, fontWeight: '700' },
  quickLabel: { color: colors.text, fontSize: 12 },
  vault: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  vaultBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  symbol: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  symbolText: { fontSize: 14, fontWeight: '800' },
  vaultName: { color: colors.text, fontSize: 15, fontWeight: '700' },
  vaultPrice: { color: colors.textMuted, fontSize: 12, fontVariant: ['tabular-nums'] },
  vaultWeight: { color: colors.text, fontSize: 15, fontWeight: '600', fontVariant: ['tabular-nums'] },
  vaultValue: { color: colors.textMuted, fontSize: 12, fontVariant: ['tabular-nums'] },
  chevron: { color: colors.textMuted, fontSize: 22, marginLeft: 2 },
  empty: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
});
