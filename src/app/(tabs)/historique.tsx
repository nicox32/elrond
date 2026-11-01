import { useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import { Segmented } from '../../components/Segmented';
import { TransactionRow } from '../../components/TransactionRow';
import { Title } from '../../components/ui';
import type { TransactionKind } from '../../logic/types';
import { useAccount } from '../../state/BankProvider';
import { colors } from '../../theme';

type Filter = 'all' | 'trade' | 'transfer';

const MATCH: Record<Filter, (k: TransactionKind) => boolean> = {
  all: () => true,
  trade: (k) => k === 'buy' || k === 'sell' || k === 'convert',
  transfer: (k) => k === 'transfer_member' || k === 'transfer_iban',
};

export default function HistoryScreen() {
  const account = useAccount();
  const [filter, setFilter] = useState<Filter>('all');
  const data = account.transactions.filter((tx) => MATCH[filter](tx.kind));

  return (
    <FlatList
      testID="screen-historique"
      style={{ backgroundColor: colors.background }}
      data={data}
      keyExtractor={(tx) => tx.id}
      contentContainerStyle={styles.content}
      ListHeaderComponent={
        <View style={styles.header}>
          <Title>Historique</Title>
          <Segmented
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'all', label: 'Tout' },
              { value: 'trade', label: 'Achats / ventes' },
              { value: 'transfer', label: 'Virements' },
            ]}
          />
        </View>
      }
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      renderItem={({ item }) => <TransactionRow tx={item} unit={account.settings.unit} />}
      ListEmptyComponent={<Text style={styles.empty}>Aucune opération.</Text>}
    />
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 40 },
  header: { gap: 14, marginBottom: 6 },
  separator: { height: 1, backgroundColor: colors.border },
  empty: { color: colors.textMuted, fontSize: 14, marginTop: 8 },
});
