import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { PriceChartCard, useSeries } from '../../components/PriceChartCard';
import { PriceStatus } from '../../components/PriceStatus';
import { Segmented } from '../../components/Segmented';
import { Card, Hint, Screen, SectionTitle } from '../../components/ui';
import { FEES } from '../../logic/fees';
import { formatUnitPrice } from '../../logic/format';
import { METAL_LABEL } from '../../logic/ledger';
import type { PriceMode } from '../../logic/priceSeries';
import { type Metal, METALS, type WeightUnit } from '../../logic/types';
import { useAccount } from '../../state/BankProvider';
import { colors, metalColor } from '../../theme';

const pct = (n: number) => `${(n * 100).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} %`;

/** Cours d'un métal sur 5 jours à 20 ans, au tarif Orvia, avec lecture au doigt. */
export default function MetalPriceScreen() {
  const { metal: param } = useLocalSearchParams<{ metal: string }>();
  const metal: Metal = METALS.includes(param as Metal) ? (param as Metal) : 'gold';
  const account = useAccount();
  const [mode, setMode] = useState<PriceMode>('spot');
  const [unit, setUnit] = useState<WeightUnit>(account.settings.unit);
  const { series, updated } = useSeries(metal);
  const format = (v: number) => formatUnitPrice(v, unit, metal);

  return (
    <Screen testID="screen-cours">
      <Stack.Screen
        options={{
          title: `Cours ${metal === 'gold' ? 'du Gold Spot' : metal === 'silver' ? 'de l’argent' : 'du platine'}`,
        }}
      />
      <PriceStatus />
      <Segmented
        value={mode}
        onChange={setMode}
        options={[
          { value: 'spot', label: 'Cours' },
          { value: 'buy', label: 'Achat Orvia' },
          { value: 'sell', label: 'Revente Orvia' },
        ]}
      />
      <Card>
        <PriceChartCard
          key={`${metal}-${mode}-${unit}`}
          series={series}
          color={metalColor[metal]}
          format={format}
          mode={mode}
          metal={metal}
          testID="metal-chart"
        />
      </Card>
      <Segmented
        value={unit}
        onChange={setUnit}
        options={[
          { value: 'g', label: 'Par gramme' },
          { value: 'oz', label: 'Par once' },
        ]}
      />
      <Hint>
        {mode === 'spot'
          ? `Cours au comptant de ${METAL_LABEL[metal] === 'Gold Spot' ? 'l’or' : METAL_LABEL[metal].toLowerCase()}, converti en euros.`
          : mode === 'buy'
            ? `Prix payé pour 1 ${unit === 'g' ? 'gramme' : 'once'} chez Orvia, frais d’achat de ${pct(FEES.buy[metal])} compris.`
            : `Prix reçu pour 1 ${unit === 'g' ? 'gramme' : 'once'} revendu par virement différé, frais de ${pct(FEES.sale)} déduits (avant impôt).`}{' '}
        Historique quotidien sur 20 ans (une valeur par semaine avant les 2 dernières années), puis les relevés de
        l’appli. Mis à jour le {new Date(updated).toLocaleDateString('fr-FR')}.
      </Hint>

      <SectionTitle>Autres cours</SectionTitle>
      <Card style={{ paddingVertical: 4 }}>
        {[
          ...METALS.filter((m) => m !== metal).map((m) => ({
            key: m,
            label: `Cours ${METAL_LABEL[m] === 'Gold Spot' ? 'du Gold Spot' : METAL_LABEL[m] === 'Argent' ? 'de l’argent' : 'du platine'}`,
            go: () => router.replace({ pathname: '/cours/[metal]', params: { metal: m } }),
          })),
          { key: 'ratio', label: 'Ratio or/argent', go: () => router.push('/ratio') },
        ].map((l, i) => (
          <Pressable key={l.key} onPress={l.go} style={[styles.link, i > 0 && styles.border]} accessibilityRole="link">
            <Text style={styles.linkText}>{l.label}</Text>
            <Text style={styles.chev}>›</Text>
          </Pressable>
        ))}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  link: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13 },
  border: { borderTopWidth: 1, borderTopColor: colors.border },
  linkText: { color: colors.text, fontSize: 15, fontWeight: '600', flex: 1 },
  chev: { color: colors.textMuted, fontSize: 20 },
});
