import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { LONDON, londonStatus, MARKET_HOURS, marketStatus } from '../logic/market';
import { colors } from '../theme';

/** Marché ouvert ou fermé, horaires, et règle des achats quand il est fermé. */
export function MarketHours() {
  const [open, setOpen] = useState(false);
  const s = marketStatus();
  const l = londonStatus();
  return (
    <Pressable onPress={() => setOpen((o) => !o)} style={styles.box} accessibilityRole="button">
      <View style={styles.row}>
        <View style={[styles.dot, { backgroundColor: s.open ? colors.up : colors.warning }]} />
        <Text style={styles.title}>
          {s.open ? 'Marché ouvert' : s.reason === 'pause' ? 'Marché en pause' : 'Marché fermé (week-end)'} ·{' '}
          <Text style={styles.next}>{s.next}</Text>
        </Text>
        <Text style={styles.chevron}>{open ? '▴' : '▾'}</Text>
      </View>
      <View style={styles.row}>
        <View style={[styles.dot, { backgroundColor: l.open ? colors.up : colors.textMuted }]} />
        <Text style={styles.sub}>
          Place de Londres {l.open ? 'ouverte' : 'fermée'} · <Text style={styles.next}>{l.next}</Text>
        </Text>
      </View>
      {!s.open && (
        <Text style={styles.text}>
          Vous pouvez acheter quand même : votre achat se fait au prix affiché au moment où vous le validez.
        </Text>
      )}
      {open && (
        <View style={{ gap: 6, marginTop: 4 }}>
          <Text style={styles.text}>
            <Text style={styles.bold}>Horaires du marché des métaux :</Text> {MARKET_HOURS}
          </Text>
          <Text style={styles.text}>
            <Text style={styles.bold}>Place de Londres (LBMA), le principal marché physique :</Text> séance du lundi au
            vendredi de 9 h à 18 h (heure de Paris). Prix de référence fixés chaque jour :{' '}
            {LONDON.fixings.map((f) => `${f.metal} à ${f.times}`).join(', ')}.
          </Text>
          <Text style={styles.muted}>
            Vos achats Orvia suivent le cours au comptant en continu, pas seulement ces prix de référence : vous achetez
            au cours du moment, à toute heure.
          </Text>
          <Text style={styles.text}>
            <Text style={styles.bold}>Achats le week-end ou la nuit :</Text> quand le marché est fermé, les cours ne
            bougent plus. Vos achats et ventes sont réalisés au dernier cours connu, celui affiché au moment de votre
            opération (le cours de clôture du vendredi soir pour le week-end) : vous payez exactement le prix annoncé.
          </Text>
          <Text style={styles.muted}>
            Horaires calqués sur New York (dimanche 18 h à vendredi 17 h) : ils peuvent se décaler d’une heure quelques
            semaines par an, lors des changements d’heure.
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  title: { color: colors.text, fontSize: 13, fontWeight: '700', flex: 1 },
  sub: { color: colors.text, fontSize: 12, fontWeight: '600', flex: 1 },
  next: { color: colors.textMuted, fontWeight: '500' },
  chevron: { color: colors.textMuted, fontSize: 14 },
  text: { color: colors.text, fontSize: 12, lineHeight: 17 },
  bold: { fontWeight: '700' },
  muted: { color: colors.textMuted, fontSize: 11, lineHeight: 16 },
});
