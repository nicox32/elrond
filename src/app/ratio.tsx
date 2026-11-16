import { StyleSheet, Text, View } from 'react-native';

import { PriceChartCard, useSeries } from '../components/PriceChartCard';
import { PriceStatus } from '../components/PriceStatus';
import { Card, Hint, Screen, SectionTitle } from '../components/ui';
import { ratioZone, seriesStats } from '../logic/priceSeries';
import { colors, metalColor } from '../theme';

const fmt = (v: number) => v.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const fmtBig = (v: number) => v.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const ZONES = [
  { range: '50 et moins', text: 'Argent cher par rapport à l’or (2011 : vers 32)', color: metalColor.gold },
  { range: '60 à 70', text: 'Zone habituelle des 20 dernières années', color: colors.textMuted },
  { range: '80 et plus', text: 'Argent bon marché par rapport à l’or', color: metalColor.silver },
  { range: '100 à 120', text: 'Extrême, rare (mars 2020 : vers 120)', color: colors.down },
];

/** Ratio or/argent : combien d'onces d'argent pour une once d'or, sur 5 jours à 20 ans. */
export default function RatioScreen() {
  const { series } = useSeries('ratio');
  const now = series.length ? series[series.length - 1].v : null;
  const zone = now ? ratioZone(now) : null;
  const all = seriesStats(series);

  return (
    <Screen testID="screen-ratio">
      <PriceStatus />
      <Hint>
        Le ratio or/argent dit combien d’onces (ou de grammes) d’argent il faut pour acheter une once (ou un gramme)
        d’or. Plus il est haut, plus l’argent est bon marché par rapport à l’or.
      </Hint>
      <Card>
        <PriceChartCard
          series={series}
          color={metalColor.gold}
          format={fmt}
          big={fmtBig}
          initialRange="6m"
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
                  zone.tone === 'silver' ? metalColor.silver : zone.tone === 'gold' ? metalColor.gold : colors.text,
              },
            ]}
          >
            {zone.label}
          </Text>
          <Text style={styles.para}>
            Aujourd’hui {fmtBig(now)} : 1 g d’or vaut {fmt(now)} g d’argent. Moyenne sur 20 ans : {fmt(all.avg)} (plus
            haut {fmt(all.max.v)} en {new Date(all.max.t).getFullYear()}, plus bas {fmt(all.min.v)} en{' '}
            {new Date(all.min.t).getFullYear()}).
          </Text>
        </Card>
      )}

      <SectionTitle>Comment le lire</SectionTitle>
      <Card style={{ paddingVertical: 4 }}>
        {ZONES.map((z, i) => (
          <View key={z.range} style={[styles.row, i > 0 && styles.border]}>
            <Text style={[styles.range, { color: z.color }]}>{z.range}</Text>
            <Text style={styles.para}>{z.text}</Text>
          </View>
        ))}
      </Card>
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
