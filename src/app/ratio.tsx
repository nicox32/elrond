import { Stack } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { PriceChartCard, useSeries } from '../components/PriceChartCard';
import { PriceStatus } from '../components/PriceStatus';
import { Segmented } from '../components/Segmented';
import { Card, Hint, Screen, SectionTitle } from '../components/ui';
import { ratioZone, seriesStats } from '../logic/priceSeries';
import { colors, metalColor } from '../theme';

const fmt1 = (v: number) => v.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const fmt2 = (v: number) => v.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const ZONES = [
  { range: '50 et moins', text: 'Argent cher par rapport à l’or (2011 : vers 32)', color: metalColor.gold },
  { range: '60 à 70', text: 'Zone habituelle des 20 dernières années', color: colors.textMuted },
  { range: '80 et plus', text: 'Argent bon marché par rapport à l’or', color: metalColor.silver },
  { range: '100 à 120', text: 'Extrême, rare (mars 2020 : vers 120)', color: colors.down },
];

type Kind = 'ratio' | 'ratioPt';

/** Ratios or/argent et or/platine : combien de grammes du second métal pour un gramme d'or, sur 5 jours à 20 ans. */
export default function RatioScreen() {
  const [kind, setKind] = useState<Kind>('ratio');
  const { series } = useSeries(kind);
  const silver = kind === 'ratio';
  const other = silver ? 'd’argent' : 'de platine';
  const now = series.length ? series[series.length - 1].v : null;
  const all = seriesStats(series);
  // Or/argent : seuils connus. Or/platine : position par rapport à la moyenne sur 20 ans.
  const zone =
    now && all
      ? silver
        ? ratioZone(now)
        : now >= all.avg * 1.25
          ? { label: 'Platine bon marché par rapport à l’or', tone: 'silver' as const }
          : now <= all.avg * 0.75
            ? { label: 'Platine cher par rapport à l’or', tone: 'gold' as const }
            : { label: 'Proche de sa moyenne sur 20 ans', tone: 'neutral' as const }
      : null;
  const fmt = silver ? fmt1 : fmt2;

  return (
    <Screen testID="screen-ratio">
      <Stack.Screen options={{ title: silver ? 'Ratio or/argent' : 'Ratio or/platine' }} />
      <PriceStatus />
      <Segmented
        value={kind}
        onChange={setKind}
        options={[
          { value: 'ratio', label: 'Or / argent' },
          { value: 'ratioPt', label: 'Or / platine' },
        ]}
      />
      <Hint>
        Combien de grammes {other} il faut pour acheter un gramme d’or. Plus le ratio est haut, plus{' '}
        {silver ? 'l’argent' : 'le platine'} est bon marché par rapport à l’or.
      </Hint>
      <Card>
        <PriceChartCard
          key={kind}
          series={series}
          color={silver ? metalColor.silver : metalColor.platinum}
          format={fmt}
          big={fmt2}
          initialRange={silver ? '6m' : '1y'}
          testID="ratio-chart"
        />
      </Card>
      {zone && now && all && (
        <Card style={{ gap: 6 }}>
          <Text
            style={[
              styles.zone,
              {
                color:
                  zone.tone === 'silver'
                    ? silver
                      ? metalColor.silver
                      : metalColor.platinum
                    : zone.tone === 'gold'
                      ? metalColor.gold
                      : colors.text,
              },
            ]}
          >
            {zone.label}
          </Text>
          <Text style={styles.para}>
            Aujourd’hui {fmt2(now)} : 1 g d’or vaut {fmt(now)} g {other}. Moyenne sur 20 ans : {fmt(all.avg)} (plus haut{' '}
            {fmt(all.max.v)} en {new Date(all.max.t).getFullYear()}, plus bas {fmt(all.min.v)} en{' '}
            {new Date(all.min.t).getFullYear()}).
          </Text>
        </Card>
      )}

      {silver ? (
        <>
          <SectionTitle>Comment le lire</SectionTitle>
          <Card style={{ paddingVertical: 4 }}>
            {ZONES.map((z, i) => (
              <View key={z.range} style={[styles.row, i > 0 && styles.border]}>
                <Text style={[styles.range, { color: z.color }]}>{z.range}</Text>
                <Text style={styles.para}>{z.text}</Text>
              </View>
            ))}
          </Card>
        </>
      ) : (
        <Hint>
          Jusqu’au début de 2015, le platine valait souvent plus cher que l’or (ratio sous 1). Depuis, l’or vaut nettement plus : le
          platine dépend surtout de l’industrie automobile, l’or de la demande d’épargne.
        </Hint>
      )}
      <Hint>
        Le ratio sert à choisir quel métal acheter avec vos nouveaux euros, pas à échanger ce que vous avez : une
        conversion est une vente imposée, et le métal reçu repart à zéro pour l’exonération des 22 ans.
      </Hint>
    </Screen>
  );
}

const styles = StyleSheet.create({
  zone: { fontSize: 16, fontWeight: '800' },
  para: { color: colors.text, fontSize: 13.5, lineHeight: 19, flex: 1 },
  row: { flexDirection: 'row', gap: 12, paddingVertical: 11, alignItems: 'center' },
  border: { borderTopWidth: 1, borderTopColor: colors.border },
  range: { width: 86, fontSize: 13.5, fontWeight: '800' },
});
