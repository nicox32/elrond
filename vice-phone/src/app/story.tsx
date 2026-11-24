import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Platform, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppScreen, Avatar, Button } from '../components/phone';
import { placeById } from '../data/state';
import { poiById } from '../data/map';
import { CHAPTERS, ENDINGS } from '../data/story';
import { contactById } from '../data/world';
import { duration, money } from '../logic/format';
import { missionChance, objective } from '../logic/story';
import { useNow, usePhone } from '../state/PhoneProvider';
import { colors } from '../theme';

export default function Story() {
  const { state, storyStartMission, storyRestart, buzz } = usePhone();
  const now = useNow(500);
  const st = state.story;
  const mission = st.mission;
  const ending = st.ending ? ENDINGS.find((e) => e.id === st.ending) : null;

  const restart = () => {
    const run = () => {
      buzz('success');
      storyRestart();
    };
    if (Platform.OS === 'web') return run();
    Alert.alert('Recommencer La Cavale ?', 'Vos choix seront oubliés. Les fins déjà vues restent dans votre collection.', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Recommencer', onPress: run },
    ]);
  };

  const place = mission ? (mission.def.map === 'state' ? placeById(mission.def.poi) : poiById(mission.def.poi)) : null;
  const elapsed = mission?.startedAt ? (now - mission.startedAt) / 1000 : 0;
  const progress = mission ? Math.min(1, elapsed / mission.def.durationSec) : 0;
  const chance = mission ? Math.round(missionChance(mission.def, st) * 100) : 0;
  const waitingFrom = st.choice ? contactById(st.choice.from) : null;

  return (
    <AppScreen title="La Cavale" color={colors.pink}>
      <ScrollView contentContainerStyle={{ padding: 14, gap: 14 }}>
        <LinearGradient colors={['#FF3D8B', '#7B2FF7', '#1A0B2E']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
          <Text style={styles.kicker}>{st.chapter ? `CHAPITRE ${st.chapter} / 5` : 'PROLOGUE'}</Text>
          <Text style={styles.chapter}>{ending ? 'Fin' : CHAPTERS[st.chapter] || 'Une nuit à Port Corail'}</Text>
          <Text style={styles.pitch}>
            {st.started ? 'Toi et Mara contre tout l’État de Solenne.' : 'Quelqu’un va bientôt t’écrire. Garde ton téléphone près de toi.'}
          </Text>
          <View style={styles.objective}>
            <Ionicons name="flag" size={16} color="#fff" />
            <Text style={styles.objectiveText}>{objective(st)}</Text>
          </View>
        </LinearGradient>

        <View style={styles.stats}>
          <Stat icon="cash" label="Argent" value={money(state.balance)} color={colors.green} />
          <Stat icon="ribbon" label="Réputation" value={signed(st.rep)} color={colors.sun} />
          <Stat icon="heart" label="Confiance de Mara" value={signed(st.trust)} color={colors.pink} />
        </View>

        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.cardTitle}>Avis de recherche</Text>
            <View style={{ flexDirection: 'row', gap: 3 }}>
              {[1, 2, 3, 4, 5].map((i) => (
                <Ionicons key={i} name={i <= st.wanted ? 'star' : 'star-outline'} size={20} color={i <= st.wanted ? '#FFD166' : colors.border} />
              ))}
            </View>
          </View>
          <Text style={styles.muted}>
            {st.wanted === 0
              ? 'La police ne vous cherche pas. Pour l’instant.'
              : 'Chaque étoile réduit vos chances en mission. Une étoile disparaît toutes les 2 min 30 si vous faites profil bas.'}
          </Text>
        </View>

        {waitingFrom && (
          <Pressable style={[styles.card, styles.callout]} onPress={() => router.push(`/messages/${waitingFrom.id}`)}>
            <Avatar name={waitingFrom.name} color={waitingFrom.color} size={40} />
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{waitingFrom.name} attend ta réponse</Text>
              <Text style={styles.muted}>Ouvrir la conversation pour choisir.</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </Pressable>
        )}

        {st.gate && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Objectif d’argent</Text>
            <Text style={styles.muted}>{st.gate.objective}</Text>
            <View style={styles.bar}>
              <View style={[styles.fill, { width: `${Math.min(100, (state.balance / st.gate.money) * 100)}%`, backgroundColor: colors.green }]} />
            </View>
            <Text style={styles.muted}>
              {money(state.balance)} / {money(st.gate.money)}
            </Text>
            <Button label="Trouver un boulot" color="#11876A" onPress={() => router.push('/jobs')} />
          </View>
        )}

        {mission && (
          <View style={[styles.card, { borderColor: colors.pink, borderWidth: 1.5 }]}>
            <Text style={styles.kickerPink}>MISSION</Text>
            <Text style={styles.missionTitle}>{mission.def.title}</Text>
            <Text style={styles.desc}>{mission.def.description}</Text>
            <View style={styles.missionInfo}>
              <Info icon="location" text={place?.name ?? '—'} />
              <Info icon="time" text={duration(mission.def.durationSec)} />
              <Info icon="dice" text={`${chance} % de réussite`} />
              {mission.def.reward > 0 && <Info icon="cash" text={money(mission.def.reward)} />}
            </View>
            {mission.startedAt ? (
              <>
                <View style={styles.bar}>
                  <View style={[styles.fill, { width: `${progress * 100}%` }]} />
                </View>
                <Text style={styles.timer}>{progress < 1 ? `${duration(mission.def.durationSec - elapsed)} restantes` : 'Dénouement…'}</Text>
              </>
            ) : (
              <Button label="Lancer la mission" onPress={storyStartMission} />
            )}
            <Button
              label="Voir sur la carte"
              color={colors.cyan}
              outline
              onPress={() => router.push(`/map?view=${mission.def.map}&poi=${mission.def.poi}`)}
            />
          </View>
        )}

        {ending && (
          <LinearGradient colors={['#1A0B2E', '#3A0CA3']} style={styles.ending}>
            <Text style={{ fontSize: 56 }}>{ending.emoji}</Text>
            <Text style={styles.kicker}>FIN</Text>
            <Text style={styles.endingTitle}>{ending.title}</Text>
            <Text style={styles.endingText}>{ending.text}</Text>
          </LinearGradient>
        )}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            Fins découvertes · {st.endings.length} / {ENDINGS.length}
          </Text>
          {ENDINGS.map((e) => {
            const seen = st.endings.includes(e.id);
            return (
              <View key={e.id} style={styles.endingRow}>
                <Text style={{ fontSize: 20, opacity: seen ? 1 : 0.3 }}>{seen ? e.emoji : '🔒'}</Text>
                <Text style={[styles.endingName, !seen && { color: colors.textMuted }]}>{seen ? e.title : '???'}</Text>
              </View>
            );
          })}
        </View>

        {st.started && <Button label={ending ? 'Rejouer l’histoire' : 'Recommencer l’histoire'} color={colors.purple} outline={!ending} onPress={restart} />}
        <Text style={styles.footer}>Histoire originale. Personnages, lieux et marques inventés.</Text>
      </ScrollView>
    </AppScreen>
  );
}

const signed = (n: number) => (n > 0 ? `+${n}` : String(n));

function Stat({ icon, label, value, color }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string; color: string }) {
  return (
    <View style={styles.stat}>
      <Ionicons name={icon} size={18} color={color} />
      <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={styles.statLabel} numberOfLines={2}>
        {label}
      </Text>
    </View>
  );
}

function Info({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View style={styles.info}>
      <Ionicons name={icon} size={14} color={colors.textMuted} />
      <Text style={styles.infoText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: 24, padding: 18, gap: 6 },
  kicker: { color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: '800', letterSpacing: 1.5 },
  kickerPink: { color: colors.pink, fontSize: 12, fontWeight: '800', letterSpacing: 1.5 },
  chapter: { color: '#fff', fontSize: 30, fontWeight: '900' },
  pitch: { color: 'rgba(255,255,255,0.9)', fontSize: 15 },
  objective: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, padding: 10, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.3)' },
  objectiveText: { color: '#fff', fontWeight: '700', flex: 1 },
  stats: { flexDirection: 'row', gap: 10 },
  stat: { flex: 1, backgroundColor: colors.surface, borderRadius: 16, padding: 12, gap: 4 },
  statValue: { color: colors.text, fontSize: 18, fontWeight: '800' },
  statLabel: { color: colors.textMuted, fontSize: 12 },
  card: { backgroundColor: colors.surface, borderRadius: 18, padding: 14, gap: 10 },
  callout: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1.5, borderColor: colors.pink },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { color: colors.text, fontSize: 16, fontWeight: '800' },
  muted: { color: colors.textMuted, fontSize: 13, lineHeight: 19 },
  missionTitle: { color: colors.text, fontSize: 22, fontWeight: '900' },
  desc: { color: colors.text, opacity: 0.9, fontSize: 15, lineHeight: 21 },
  missionInfo: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  info: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.surfaceAlt, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  infoText: { color: colors.text, fontSize: 13 },
  bar: { height: 8, borderRadius: 4, backgroundColor: colors.surfaceAlt, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: colors.pink },
  timer: { color: colors.pink, fontWeight: '700' },
  ending: { borderRadius: 24, padding: 20, alignItems: 'center', gap: 6 },
  endingTitle: { color: '#fff', fontSize: 26, fontWeight: '900', textAlign: 'center' },
  endingText: { color: 'rgba(255,255,255,0.9)', fontSize: 16, lineHeight: 24, textAlign: 'center' },
  endingRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  endingName: { color: colors.text, fontSize: 15, fontWeight: '600' },
  footer: { color: colors.textMuted, fontSize: 12, textAlign: 'center' },
});
