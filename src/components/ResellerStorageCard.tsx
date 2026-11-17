import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { formatEur } from '../logic/format';
import { fetchChfToEur } from '../logic/prices';
import { CHF_EUR_FALLBACK, clientStorage, STORAGE_LIMIT, storageStatus } from '../logic/storageLimit';
import { useAccount, useBank } from '../state/BankProvider';
import { colors } from '../theme';
import { Card, Hint, KeyValue, SectionTitle, styles as ui } from './ui';

/** Stockage gardé chez le revendeur (Gold Avenue) : le seuil gratuit est propre à chaque client, enfants compris. */
export function ResellerStorageCard() {
  const account = useAccount();
  const { quote } = useBank();
  const [chf, setChf] = useState<{ rate: number; live: boolean }>({ rate: CHF_EUR_FALLBACK, live: false });
  useEffect(() => {
    let on = true;
    fetchChfToEur()
      .then((rate) => on && setChf({ rate, live: true }))
      .catch(() => undefined);
    return () => {
      on = false;
    };
  }, []);
  const groups = clientStorage(account, quote.prices.gold);
  if (!groups.length) return null;
  return (
    <>
      <SectionTitle>Stockage chez Gold Avenue</SectionTitle>
      <Card style={{ gap: 10 }}>
        {groups.map((g) => {
          const owner = g.ownerChildId
            ? (account.children.find((c) => c.id === g.ownerChildId)?.name ?? 'Enfant')
            : 'Vous';
          const st = storageStatus(g.valueEur, chf.rate);
          return (
            <View key={g.ownerChildId ?? 'moi'} style={{ gap: 4 }} testID={`reseller-${g.ownerChildId ?? 'moi'}`}>
              <KeyValue
                label={`${owner} · ${g.count} lingotin${g.count > 1 ? 's' : ''} ou pièce${g.count > 1 ? 's' : ''}`}
                value={`${formatEur(st.usedEur)} ≈ ${Math.round(st.usedChf).toLocaleString('fr-FR')} CHF`}
              />
              <View style={styles.meter}>
                <View style={[styles.meterFill, { flex: Math.max(0.0001, st.share) }]} />
                <View style={{ flex: Math.max(0.0001, 1 - st.share) }} />
              </View>
              <Text style={ui.hint}>
                {st.tier === 'free'
                  ? `Stockage gratuit : il reste environ ${formatEur(st.leftEur)} avant le seuil.`
                  : `Au-delà du seuil gratuit : environ ${formatEur(st.yearlyFeeEur)} par an (${st.yearlyFeePct.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} %).`}
              </Text>
            </View>
          );
        })}
        <Hint>
          Chaque client a son propre seuil : gratuit jusqu’à {STORAGE_LIMIT.freeChf.toLocaleString('fr-FR')} CHF (≈{' '}
          {formatEur(STORAGE_LIMIT.freeChf * chf.rate)}), puis {STORAGE_LIMIT.midFeeChfPerMonth} CHF par mois jusqu’à{' '}
          {STORAGE_LIMIT.midChf.toLocaleString('fr-FR')} CHF, puis 0,5 % par an. Assurance comprise. Frais du revendeur,
          à la charge du client. Taux {chf.live ? 'du jour' : 'approximatif'} : 1 CHF ={' '}
          {chf.rate.toFixed(3).replace('.', ',')} €.
        </Hint>
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  meter: { flexDirection: 'row', height: 6, borderRadius: 3, overflow: 'hidden', backgroundColor: colors.surfaceAlt },
  meterFill: { backgroundColor: colors.gold },
});
