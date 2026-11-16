import { FEES } from '../logic/fees';
import { dormancyStatus } from '../logic/ledger';
import type { Wallet } from '../logic/types';
import { Banner } from './ui';

const fmt = (d: Date) => d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

/** Prévient quand une période de 6 mois sans opération d'au moins 1 € arrive à son terme (ou est dépassée). */
export function DormancyNotice({ wallet, name }: { wallet: Wallet; name?: string }) {
  const status = dormancyStatus(wallet);
  // Visible tant que le compte est inactif, ou dans le mois qui précède un prélèvement.
  if (!status.inactive && status.daysLeft > 30) return null;
  const who = name ? `Le compte de ${name}` : 'Votre compte';
  const rate = `${(FEES.dormancyDaily * 100).toLocaleString('fr-FR')} %`;
  const months = FEES.dormancyAfterMonths;
  const total = `${(Math.round(FEES.dormancyDaily * 182 * 1000) / 10).toLocaleString('fr-FR')} %`;
  return (
    <Banner
      tone={status.inactive ? 'danger' : 'warning'}
      icon="⏳"
      title={status.inactive ? `${who} est inactif` : `${who} sera bientôt inactif`}
    >
      {status.inactive
        ? `Aucune opération éligible d’au moins 1 € depuis le ${fmt(status.lastMovement)} : des frais d’oxydation ont été prélevés pour ces ${months} mois. Sans opération d’ici le ${fmt(status.nextChargeAt)}, les ${months} mois suivants seront facturés à leur tour (${rate} du solde par jour).`
        : `Sans opération éligible d’au moins 1 € d’ici le ${fmt(status.nextChargeAt)}, des frais d’oxydation de ${rate} du solde par jour seront prélevés pour ces ${months} mois (environ ${total} du solde). Un achat, un crédit du compte d’attente, un échange de métal ou un parrainage suffit à remettre le compteur à zéro.`}
    </Banner>
  );
}
