import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { TransactionRow } from '../components/TransactionRow';
import type { Account } from '../logic/types';
import { colors } from '../theme';

interface Props {
  account: Account;
  onReset: () => void;
}

export function HistoryScreen({ account, onReset }: Props) {
  function confirmReset() {
    Alert.alert('Réinitialiser le compte ?', 'Le solde et l’historique seront effacés.', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Réinitialiser', style: 'destructive', onPress: onReset },
    ]);
  }

  return (
    <FlatList
      data={account.transactions}
      keyExtractor={(tx) => tx.id}
      contentContainerStyle={styles.content}
      ListHeaderComponent={<Text style={styles.title}>Historique</Text>}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      renderItem={({ item }) => <TransactionRow tx={item} />}
      ListEmptyComponent={<Text style={styles.empty}>Aucune opération pour l’instant.</Text>}
      ListFooterComponent={
        <Pressable onPress={confirmReset} style={styles.reset}>
          <Text style={styles.resetText}>Réinitialiser le compte de démo</Text>
        </Pressable>
      }
    />
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 40 },
  title: { color: colors.text, fontSize: 26, fontWeight: '800', marginBottom: 8 },
  separator: { height: 1, backgroundColor: colors.border },
  empty: { color: colors.textMuted, fontSize: 14, marginTop: 8 },
  reset: { marginTop: 32, alignItems: 'center', padding: 12 },
  resetText: { color: colors.down, fontSize: 14, fontWeight: '600' },
});
