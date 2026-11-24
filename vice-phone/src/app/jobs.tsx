import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppScreen, Button } from '../components/phone';
import { JOBS } from '../data/world';
import { duration, money } from '../logic/format';
import { useNow, usePhone } from '../state/PhoneProvider';
import { colors } from '../theme';

/** Petits boulots de l’Agence Soleil : on en accepte un, il se termine tout seul, la paie arrive à la banque. */
export default function Jobs() {
  const { state, startJob, cancelJob } = usePhone();
  const now = useNow(500);
  const active = state.activeJob;
  const total = Object.values(state.jobsDone).reduce((n, x) => n + x, 0);

  return (
    <AppScreen title="Boulots" color={colors.green}>
      <ScrollView contentContainerStyle={{ padding: 14, gap: 12 }}>
        <Text style={styles.intro}>Agence Soleil · {total} boulot{total > 1 ? 's' : ''} terminé{total > 1 ? 's' : ''}. Un seul boulot à la fois ; la paie arrive sur votre compte Banque Flamant.</Text>
        {JOBS.map((j) => {
          const isActive = active?.id === j.id;
          const elapsed = isActive ? (now - active.startedAt) / 1000 : 0;
          const progress = isActive ? Math.min(1, elapsed / j.durationSec) : 0;
          const done = state.jobsDone[j.id] ?? 0;
          return (
            <View key={j.id} style={[styles.card, isActive && { borderColor: colors.green }]}>
              <View style={styles.head}>
                <Text style={styles.emoji}>{j.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.title}>{j.title}</Text>
                  <Text style={styles.client}>
                    {j.client}
                    {done > 0 ? ` · fait ${done} fois` : ''}
                  </Text>
                </View>
                <Text style={styles.reward}>{money(j.reward)}</Text>
              </View>
              <Text style={styles.desc}>{j.description}</Text>
              {isActive ? (
                <>
                  <View style={styles.bar}>
                    <View style={[styles.fill, { width: `${progress * 100}%` }]} />
                  </View>
                  <Text style={styles.time}>{progress < 1 ? `${duration(j.durationSec - elapsed)} restantes` : 'Paiement en cours…'}</Text>
                  <Button label="Abandonner" onPress={cancelJob} color={colors.red} outline />
                </>
              ) : (
                <Button label={`Accepter · ${duration(j.durationSec)}`} onPress={() => startJob(j.id)} color="#11876A" disabled={!!active} />
              )}
            </View>
          );
        })}
      </ScrollView>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  intro: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
  card: { backgroundColor: colors.surface, borderRadius: 18, padding: 14, gap: 10, borderWidth: 1.5, borderColor: 'transparent' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  emoji: { fontSize: 34 },
  title: { color: colors.text, fontSize: 16, fontWeight: '700' },
  client: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  reward: { color: colors.green, fontSize: 17, fontWeight: '800' },
  desc: { color: colors.text, opacity: 0.85, fontSize: 14, lineHeight: 20 },
  bar: { height: 8, borderRadius: 4, backgroundColor: colors.surfaceAlt, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: colors.green },
  time: { color: colors.green, fontSize: 13, fontWeight: '600' },
});
