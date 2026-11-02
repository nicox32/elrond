import { StyleSheet, Text, View } from 'react-native';

import { FEES } from '../logic/fees';
import { dormancyStatus } from '../logic/ledger';
import type { Wallet } from '../logic/types';
import { colors } from '../theme';

const fmt = (d: Date) => d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

/** Prévient quand une période de 6 mois sans opération d'au moins 1 € arrive à son terme (ou est dépassée). */
export function DormancyNotice({ wallet, name }: { wallet: Wallet; name?: string }) {
  const status = dormancyStatus(wallet);
  // Visible tant que le compte est inactif, ou dans le mois qui précède un prélèvement.
  if (!status.inactive && status.daysLeft > 30) return null;
  const who = name ? `Le compte de ${name}` : 'Votre compte';
  const rate = `${(FEES.dormancyDaily * 100).toLocaleString('fr-FR')} %`;
  const months = FEES.dormancyAfterMonths;
  const total = `${(Math.round(FEES.dormancyDaily * 182 * 1000) / 10).toLocaleString('fr-FR')} %`;
  return (
    <View style={[styles.box, status.inactive && styles.boxInactive]}>
      <Text style={styles.title}>{status.inactive ? `${who} est inactif` : `${who} sera bientôt inactif`}</Text>
      <Text style={styles.text}>
        {status.inactive
          ? `Aucune opération éligible d’au moins 1 € depuis le ${fmt(status.lastMovement)} : des frais d’oxydation ont été prélevés pour ces ${months} mois. Sans opération d’ici le ${fmt(status.nextChargeAt)}, les ${months} mois suivants seront facturés à leur tour (${rate} du solde par jour).`
          : `Sans opération éligible d’au moins 1 € d’ici le ${fmt(status.nextChargeAt)}, des frais d’oxydation de ${rate} du solde par jour seront prélevés pour ces ${months} mois (environ ${total} du solde). Un paiement par carte, un échange de métal, un achat ou un parrainage suffit à remettre le compteur à zéro.`}
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
