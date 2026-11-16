import { router, Stack, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { CustodyNote } from '../../components/Custody';
import { PriceStatus } from '../../components/PriceStatus';
import { StatementCard } from '../../components/Statement';
import { TransactionRow } from '../../components/TransactionRow';
import { Button, Card, Hint, KeyValue, ListRow, Screen, SectionTitle } from '../../components/ui';
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
        options={{
          title: `Coffre ${metal === 'silver' || metal === 'platinum' ? METAL_LABEL[metal].toLowerCase() : METAL_LABEL[metal]}`,
        }}
      />
      <PriceStatus />

      <View style={[styles.hero, { borderColor: metalColor[metal] }]}>
        <Text style={[styles.metal, { color: metalColor[metal] }]}>{METAL_LABEL[metal]}</Text>
        <Text style={styles.weight}>{formatWeight(grams, 'g', metal)}</Text>
        <Text style={styles.oz}>soit {formatWeight(grams, 'oz')}</Text>
        <Text style={styles.value}>{formatEur(value)}</Text>
      </View>

      <Card style={{ gap: 8 }}>
        <Line
          label="Cours"
          value={`${formatUnitPrice(quote.prices[metal], 'g')} · ${formatUnitPrice(quote.prices[metal], 'oz')}`}
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
      <Card style={{ paddingVertical: 4 }}>
        <ListRow
          first
          title="Graphique du cours"
          subtitle="De 5 jours à 20 ans, au cours ou au tarif Orvia"
          onPress={() => router.push({ pathname: '/cours/[metal]', params: { metal } })}
        />
        {metal === 'gold' ? (
          <ListRow
            title="Retrait physique"
            subtitle={
              account.homeVault?.length
                ? `Lingotins ou Napoléons · ${account.homeVault.length} chez vous`
                : 'Lingotins ou Napoléons livrés chez vous'
            }
            onPress={() => router.push('/retrait')}
          />
        ) : (
          <ListRow
            title="Pas de retrait physique"
            subtitle={`20 % de TVA seraient dus à la sortie du port franc : ${metal === 'silver' ? 'l’argent' : 'le platine'} reste au coffre et se revend en ligne.`}
          />
        )}
      </Card>

      <CustodyNote />

      <StatementCard walletName={`Coffre ${METAL_LABEL[metal]}`} scope={{ kind: 'metal', metal }} />

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
  return <KeyValue label={label} value={value} />;
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
