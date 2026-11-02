import { router, Stack, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { PriceStatus } from '../../components/PriceStatus';
import { TransactionRow } from '../../components/TransactionRow';
import { Button, Card, Hint, Screen, SectionTitle } from '../../components/ui';
import { EcuInfo } from '../../components/EcuInfo';
import { ECU } from '../../logic/ecu';
import { formatEur, formatUnitPrice, formatWeight } from '../../logic/format';
import { buyPrice, METAL_LABEL, sellPrice } from '../../logic/ledger';
import { type Metal, METALS } from '../../logic/types';
import { useAccount, useBank } from '../../state/BankProvider';
import { colors, metalColor } from '../../theme';

export default function VaultScreen() {
  const { metal: param } = useLocalSearchParams<{ metal: string }>();
  const metal: Metal = METALS.includes(param as Metal) ? (param as Metal) : 'gold';
  const account = useAccount();
  const { quote } = useBank();
  const grams = account.holdings[metal];
  const value = grams * sellPrice(quote.prices, metal);
  const txs = account.transactions.filter((t) => (t.deltas[metal] ?? 0) !== 0).slice(0, 10);

  return (
    <Screen testID="screen-coffre">
      <Stack.Screen
        options={{ title: metal === 'ecu' ? 'Coffre Écu Orvia' : `Coffre ${METAL_LABEL[metal].toLowerCase()}` }}
      />
      <PriceStatus />

      <View style={[styles.hero, { borderColor: metalColor[metal] }]}>
        <Text style={[styles.metal, { color: metalColor[metal] }]}>{METAL_LABEL[metal]}</Text>
        <Text style={styles.weight}>{formatWeight(grams, 'g', metal)}</Text>
        <Text style={styles.oz}>
          {metal === 'ecu'
            ? `soit ${formatWeight(grams * ECU.goldGrams, 'g')} d’or fin`
            : `soit ${formatWeight(grams, 'oz')}`}
        </Text>
        <Text style={styles.value}>{formatEur(value)}</Text>
      </View>

      <Card style={{ gap: 8 }}>
        <Line
          label="Cours"
          value={
            metal === 'ecu'
              ? formatUnitPrice(quote.prices.ecu, 'g', 'ecu')
              : `${formatUnitPrice(quote.prices[metal], 'g')} · ${formatUnitPrice(quote.prices[metal], 'oz')}`
          }
        />
        <Line
          label="Prix d’achat"
          value={formatUnitPrice(buyPrice(quote.prices, metal), account.settings.unit, metal)}
        />
        <Line
          label="Prix de vente"
          value={formatUnitPrice(sellPrice(quote.prices, metal), account.settings.unit, metal)}
        />
      </Card>

      {metal === 'ecu' && <EcuInfo />}

      <View style={styles.actions}>
        <View style={{ flex: 1 }}>
          <Button
            title="Acheter"
            onPress={() => router.push({ pathname: '/operations', params: { mode: 'buy', metal, t: Date.now() } })}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Button
            title="Vendre"
            variant="ghost"
            onPress={() => router.push({ pathname: '/operations', params: { mode: 'sell', metal, t: Date.now() } })}
          />
        </View>
      </View>

      <SectionTitle>Mouvements</SectionTitle>
      {txs.length === 0 ? (
        <Hint>Aucun mouvement sur ce coffre.</Hint>
      ) : (
        txs.map((tx) => <TransactionRow key={tx.id} tx={tx} unit={account.settings.unit} />)
      )}
    </Screen>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.line}>
      <Text style={styles.lineLabel}>{label}</Text>
      <Text style={styles.lineValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    alignItems: 'center',
    gap: 2,
  },
  metal: { fontSize: 15, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' },
  weight: { color: colors.text, fontSize: 34, fontWeight: '800', fontVariant: ['tabular-nums'] },
  oz: { color: colors.textMuted, fontSize: 13 },
  value: { color: colors.text, fontSize: 18, fontWeight: '600', marginTop: 6 },
  actions: { flexDirection: 'row', gap: 10 },
  line: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  lineLabel: { color: colors.textMuted, fontSize: 13 },
  lineValue: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
    flexShrink: 1,
    textAlign: 'right',
  },
});
