import { StyleSheet, Text, View } from 'react-native';

import { formatEur } from '../logic/format';
import { insuranceStatus } from '../logic/stock';
import { colors } from '../theme';
import { useAccount, useBank } from '../state/BankProvider';

/**
 * Indicateur du plafond de l'assurance du stock : jauge qui passe à l'orange dès 80 % et au rouge au-delà de 100 %.
 * Avec `extraEur`, il montre l'effet d'un lot que l'on s'apprête à entrer (« avec ce lot : … »).
 */
export function InsuranceMeter({ extraEur = 0, compact = false }: { extraEur?: number; compact?: boolean }) {
  const account = useAccount();
  const { quote } = useBank();
  const st = insuranceStatus(account, quote.prices.gold);
  const after = st.value + Math.max(0, extraEur);
  const share = st.cap > 0 ? after / st.cap : 1;
  const color = share > 1 ? colors.down : share >= 0.8 ? colors.warning : colors.gold;
  const text =
    extraEur > 0
      ? share > 1
        ? `Avec ce lot : ${formatEur(after)} sur ${formatEur(st.cap)} : plafond dépassé de ${formatEur(after - st.cap)}.`
        : `Avec ce lot : ${formatEur(after)} sur ${formatEur(st.cap)} (${Math.round(share * 100)} %).`
      : share >= 1
        ? 'Plafond atteint : un nouveau lot est refusé tant que le stock n’a pas baissé.'
        : `Il reste ${formatEur(st.left)} de place (${Math.round(share * 100)} % utilisés).${share >= 0.8 ? ' Attention : le plafond est proche.' : ''}`;
  return (
    <View style={{ gap: 4 }} testID="insurance-meter">
      {compact ? (
        <Text style={[styles.title, { color }]}>
          Assurance du stock : {Math.round(share * 100)} % · {formatEur(after)} sur {formatEur(st.cap)}
        </Text>
      ) : null}
      <View style={styles.track}>
        <View style={{ flex: Math.max(0.0001, Math.min(1, share)), backgroundColor: color }} />
        <View style={{ flex: Math.max(0.0001, 1 - Math.min(1, share)) }} />
      </View>
      <Text style={[styles.text, share >= 0.8 && { color }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 14, fontWeight: '700' },
  track: { flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden', backgroundColor: colors.surfaceAlt },
  text: { color: colors.textMuted, fontSize: 12.5 },
});
