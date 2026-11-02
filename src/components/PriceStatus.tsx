import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { formatDate, formatTime } from '../logic/format';
import { useBank } from '../state/BankProvider';
import { colors } from '../theme';

/** Indique d'où viennent les cours affichés, et permet de les actualiser. */
export function PriceStatus() {
  const { quote, refreshing, priceError, refreshPrices } = useBank();

  let dot = colors.up;
  let text = `Cours réels · mis à jour à ${formatTime(quote.fetchedAt)}`;
  if (quote.source === 'cache') {
    dot = colors.warning;
    text = `Hors ligne · derniers cours du ${formatDate(quote.fetchedAt)}`;
  } else if (quote.source === 'reference') {
    dot = colors.down;
    text = 'Cours indicatifs · cours réels indisponibles';
  }

  return (
    <Pressable
      onPress={() => refreshPrices()}
      style={styles.wrap}
      accessibilityRole="button"
      accessibilityHint="Actualiser les cours"
    >
      <View style={[styles.dot, { backgroundColor: dot }]} />
      <View style={{ flex: 1 }}>
        <Text style={styles.text}>{text}</Text>
        {priceError && quote.source !== 'live' ? <Text style={styles.error}>{priceError}</Text> : null}
      </View>
      {refreshing ? <ActivityIndicator size="small" color={colors.gold} /> : <Text style={styles.refresh}>↻</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  text: { color: colors.textMuted, fontSize: 12 },
  error: { color: colors.down, fontSize: 11, marginTop: 2 },
  refresh: { color: colors.gold, fontSize: 18, fontWeight: '700' },
});
