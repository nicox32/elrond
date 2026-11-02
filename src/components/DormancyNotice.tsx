import { StyleSheet, Text, View } from 'react-native';

import { FEES } from '../logic/fees';
import { dormancyStatus } from '../logic/ledger';
import type { Wallet } from '../logic/types';
import { colors } from '../theme';

/** Préviens quand un compte approche (ou a dépassé) les 6 mois sans mouvement. */
export function DormancyNotice({ wallet, name }: { wallet: Wallet; name?: string }) {
  const status = dormancyStatus(wallet);
  if (!status.inactive && status.daysLeft > 30) return null;
  const who = name ? `Le compte de ${name}` : 'Ton compte';
  const date = status.inactiveFrom.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  const rate = `${(FEES.dormancyDaily * 100).toLocaleString('fr-FR')} %`;
  return (
    <View style={[styles.box, status.inactive && styles.boxInactive]}>
      <Text style={styles.title}>{status.inactive ? `${who} est inactif` : `${who} sera bientôt inactif`}</Text>
      <Text style={styles.text}>
        {status.inactive
          ? `Aucun mouvement depuis plus de ${FEES.dormancyAfterMonths} mois : des frais d’oxydation de ${rate} du solde par jour s’appliquent depuis le ${date}. Une opération suffit à les arrêter.`
          : `Sans mouvement d’ici le ${date}, des frais d’oxydation de ${rate} du solde par jour s’appliqueront. Une opération suffit à remettre le compteur à zéro.`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.warning,
    backgroundColor: 'rgba(251, 191, 36, 0.1)',
    gap: 4,
  },
  boxInactive: { borderColor: colors.down, backgroundColor: 'rgba(248, 113, 113, 0.1)' },
  title: { color: colors.text, fontSize: 14, fontWeight: '700' },
  text: { color: colors.text, fontSize: 13, lineHeight: 18 },
});
