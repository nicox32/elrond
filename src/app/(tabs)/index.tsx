import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BalanceChart } from '../../components/BalanceChart';
import { DormancyNotice } from '../../components/DormancyNotice';
import { OrviaCard } from '../../components/OrviaCard';
import { formatLouis, toLouis } from '../../logic/currency';
import { LivePrices } from '../../components/LivePrices';
import { PriceStatus } from '../../components/PriceStatus';
import { TransactionRow } from '../../components/TransactionRow';
import { Card, Screen, SectionTitle, styles as ui } from '../../components/ui';
import { formatEur, formatPercent, formatUnitPrice, formatWeight } from '../../logic/format';
import { accountValue, METAL_LABEL, REFERRAL, unrealizedGain } from '../../logic/ledger';
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
  const { quote } = useBank();
  const unit = account.settings.unit;
  const value = accountValue(account, quote.prices);
  const perf = unrealizedGain(account, quote.prices);

  return (
    <Screen testID="screen-compte">
      <Text style={styles.hello}>Bonjour {account.holder}</Text>
      <PriceStatus />
      <DormancyNotice wallet={account} />

      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>Solde total</Text>
        <Text style={styles.balance}>{formatEur(value.total)}</Text>
        <Text style={styles.louis}>soit {formatLouis(toLouis(value.total, quote.prices))}</Text>
        <Text style={styles.sub}>Valeur de revente au cours actuel · 1 LOU = 1 €</Text>
        {perf.invested > 0 && (
          <Text style={[styles.gain, { color: perf.gain >= 0 ? colors.up : colors.down }]}>
            {perf.gain >= 0 ? 'Plus-value' : 'Moins-value'} : {perf.gain >= 0 ? '+' : '−'}
            {formatEur(Math.abs(perf.gain))} ({formatPercent(perf.percent)})
          </Text>
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
      {account.alertEvents?.[0] && (
        <Pressable onPress={() => router.push('/alertes')} style={styles.alertBanner} accessibilityRole="button">
          <Text style={styles.alertBannerTitle}>{account.alertEvents[0].title}</Text>
          <Text style={styles.alertBannerBody}>{account.alertEvents[0].body}</Text>
        </Pressable>
      )}
      <LivePrices unit={unit} />

      <SectionTitle>Évolution du solde</SectionTitle>
      <Card>
        <BalanceChart points={account.balanceHistory} />
      </Card>

      <SectionTitle>Ma carte</SectionTitle>
      {account.card ? (
        <Pressable
          onPress={() => router.push('/carte')}
          accessibilityRole="button"
          accessibilityLabel="Ouvrir ma carte"
        >
          <OrviaCard card={account.card} />
        </Pressable>
      ) : (
        <Pressable onPress={() => router.push('/carte')} style={styles.kids} accessibilityRole="button">
          <Text style={styles.kidsText}>
            Paie et retire avec ton or, ton argent ou ton platine : commande ta carte Orvia, gratuite.
          </Text>
          <Text style={styles.chevron}>›</Text>
        </Pressable>
      )}

      <Pressable onPress={() => router.push('/parrainage')} style={styles.referral} accessibilityRole="button">
        <Text style={styles.referralText}>
          ★ Parraine tes proches : ils reçoivent {REFERRAL.bonusLou} LOU en or à leur premier achat.
        </Text>
        <Text style={styles.chevron}>›</Text>
      </Pressable>

      <SectionTitle
        right={
          <Pressable onPress={() => router.push('/enfants')}>
            <Text style={ui.link}>{account.children.length ? 'Gérer' : 'Ouvrir'}</Text>
          </Pressable>
        }
      >
        Comptes enfants
      </SectionTitle>
      <Pressable onPress={() => router.push('/enfants')} style={styles.kids} accessibilityRole="button">
        <Text style={styles.kidsText}>
          {account.children.length === 0
            ? 'Ouvre gratuitement un compte en or, argent ou platine pour chacun de tes enfants.'
            : account.children.map((c) => `${c.name} · ${formatEur(accountValue(c, quote.prices).total)}`).join('\n')}
        </Text>
        <Text style={styles.chevron}>›</Text>
      </Pressable>

      <SectionTitle>Mes coffres</SectionTitle>
      <Card style={{ paddingVertical: 4 }}>
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
              <Text style={styles.vaultPrice}>{formatUnitPrice(quote.prices[m], unit)}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.vaultWeight}>{formatWeight(account.holdings[m], unit)}</Text>
              <Text style={styles.vaultValue}>{formatEur(value.byMetal[m])}</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        ))}
      </Card>

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
        account.transactions.slice(0, 3).map((tx) => <TransactionRow key={tx.id} tx={tx} unit={unit} />)
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hello: { color: colors.textMuted, fontSize: 15 },
  balanceCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.gold,
    gap: 4,
  },
  balanceLabel: { color: colors.textMuted, fontSize: 13 },
  balance: { color: colors.text, fontSize: 34, fontWeight: '800', fontVariant: ['tabular-nums'] },
  sub: { color: colors.textMuted, fontSize: 11 },
  louis: { color: colors.gold, fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'] },
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
  kids: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  kidsText: { color: colors.text, fontSize: 14, lineHeight: 21, flex: 1 },
  alertBanner: {
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.gold,
    backgroundColor: colors.goldSoft,
    gap: 2,
  },
  alertBannerTitle: { color: colors.gold, fontSize: 13, fontWeight: '700' },
  alertBannerBody: { color: colors.text, fontSize: 13, lineHeight: 18 },
  referral: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.goldSoft,
    borderRadius: 16,
    padding: 14,
  },
  referralText: { color: colors.text, fontSize: 14, lineHeight: 20, flex: 1, fontWeight: '600' },
  empty: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
});
