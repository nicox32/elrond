import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Card, Hint, SectionTitle } from '../components/ui';
import { formatDate, formatEur, formatPercent, formatWeight } from '../logic/format';
import { accountValue, METAL_LABEL } from '../logic/ledger';
import { fetchLivePrices } from '../logic/prices';
import { type ChildView, viewMajority } from '../logic/shareView';
import { METALS, type Prices } from '../logic/types';
import { colors, metalColor } from '../theme';

const day = (iso: string) =>
  new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

/** Compte enfant en lecture seule, ouvert depuis un lien partagé : aucune opération possible. */
export function ChildViewScreen({ view }: { view: ChildView }) {
  const [prices, setPrices] = useState<Prices>(view.px);
  const [live, setLive] = useState(false);

  useEffect(() => {
    fetchLivePrices()
      .then((q) => {
        setPrices({ gold: q.prices.gold, silver: q.prices.silver, platinum: q.prices.platinum });
        setLive(true);
      })
      .catch(() => setLive(false));
  }, []);

  const value = accountValue({ holdings: view.h }, prices);
  const paid = METALS.reduce((s, m) => s + (view.c[m] ?? 0), 0);
  const gain = value.total - paid;
  const majority = viewMajority(view);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={styles.page}>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>Lecture seule</Text>
      </View>
      <Text style={styles.title}>Compte de {view.n}</Text>
      <Hint>
        Partagé par {view.p} le {day(view.at)}. Ce lien permet seulement de consulter le compte : aucune opération n’est
        possible.
      </Hint>

      <View style={styles.hero}>
        <Text style={styles.heroLabel}>Valeur du compte</Text>
        <Text style={styles.heroValue} testID="view-total">
          {formatEur(value.total)}
        </Text>
        <Text style={styles.heroSub}>
          {live ? 'aux cours du moment' : `aux cours du ${day(view.at)}`} · versé {formatEur(paid)}
        </Text>
        {paid > 0 && (
          <Text style={[styles.gain, { color: gain >= 0 ? colors.up : colors.down }]}>
            {gain >= 0 ? '+' : '−'}
            {formatEur(Math.abs(gain))} ({formatPercent((gain / paid) * 100)}) de plus-value latente
          </Text>
        )}
      </View>

      <SectionTitle>Coffres</SectionTitle>
      <Card style={{ paddingVertical: 4 }}>
        {METALS.map((m, i) => (
          <View key={m} style={[styles.row, i > 0 && styles.border]}>
            <View style={[styles.dot, { backgroundColor: metalColor[m] }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>{METAL_LABEL[m]}</Text>
              <Text style={styles.rowSub}>{formatWeight(view.h[m] ?? 0, 'g', m)}</Text>
            </View>
            <Text style={styles.rowValue}>{formatEur(value.byMetal[m])}</Text>
          </View>
        ))}
      </Card>

      <SectionTitle>Protection de l’enfant</SectionTitle>
      <Card style={{ gap: 6 }}>
        <Text style={styles.rule}>• L’argent versé appartient à {view.n} : il ne peut pas être repris librement.</Text>
        <Text style={styles.rule}>
          •{' '}
          {view.j
            ? 'Tout retrait doit être validé par les deux parents, et seulement dans l’intérêt de l’enfant.'
            : 'Un retrait n’est possible que dans l’intérêt de l’enfant.'}
        </Text>
        <Text style={styles.rule}>
          •{' '}
          {majority
            ? `Le compte sera transféré à ${view.n} le ${day(majority.toISOString())}, à ses 18 ans.`
            : `Le compte sera transféré à ${view.n} à ses 18 ans.`}
        </Text>
      </Card>

      <SectionTitle>Derniers mouvements</SectionTitle>
      {view.o.length === 0 ? (
        <Hint>Aucun mouvement.</Hint>
      ) : (
        <Card style={{ paddingVertical: 4 }}>
          {view.o.map(([date, label, eur, ...grams], i) => {
            const moved = METALS.map((m, k) => ({ m, g: grams[k] })).filter((x) => x.g !== 0);
            return (
              <View key={i} style={[styles.row, i > 0 && styles.border]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{label || 'Mouvement'}</Text>
                  <Text style={styles.rowSub}>
                    {new Date(`${date}T12:00:00`).toLocaleDateString('fr-FR')}
                    {moved.length
                      ? ` · ${moved.map((x) => `${x.g > 0 ? '+' : '−'}${formatWeight(Math.abs(x.g), 'g', x.m)}`).join(', ')}`
                      : ''}
                  </Text>
                </View>
                {eur > 0 && <Text style={styles.rowValue}>{formatEur(eur)}</Text>}
              </View>
            );
          })}
        </Card>
      )}
      {view.t > view.o.length && (
        <Hint>
          {view.o.length} derniers mouvements sur {view.t}.
        </Hint>
      )}

      <Hint style={{ marginTop: 16 }}>
        Photo du compte au {formatDate(view.at)} : les mouvements faits depuis n’apparaissent pas. Demandez à {view.p}{' '}
        un nouveau lien pour les voir. Les métaux sont gardés par Orvia en coffre-fort, en port franc, et appartiennent
        à {view.n}.
      </Hint>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, gap: 10, maxWidth: 640, width: '100%', alignSelf: 'center', paddingBottom: 40 },
  badge: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: colors.gold,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  badgeText: { color: colors.gold, fontSize: 12, fontWeight: '700' },
  title: { color: colors.text, fontSize: 26, fontWeight: '800' },
  hero: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.gold,
    padding: 18,
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  heroLabel: { color: colors.textMuted, fontSize: 14, fontWeight: '600' },
  heroValue: { color: colors.text, fontSize: 34, fontWeight: '800', fontVariant: ['tabular-nums'] },
  heroSub: { color: colors.textMuted, fontSize: 13, textAlign: 'center' },
  gain: { fontSize: 14, fontWeight: '700', textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  border: { borderTopWidth: 1, borderTopColor: colors.border },
  dot: { width: 12, height: 12, borderRadius: 6 },
  rowTitle: { color: colors.text, fontSize: 15, fontWeight: '600' },
  rowSub: { color: colors.textMuted, fontSize: 13 },
  rowValue: { color: colors.text, fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'] },
  rule: { color: colors.text, fontSize: 14, lineHeight: 20 },
});
