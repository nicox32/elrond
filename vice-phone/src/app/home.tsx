import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Badge, PhoneStatusBar, Wallpaper } from '../components/phone';
import { ARTICLES, JOBS } from '../data/world';
import { duration, money } from '../logic/format';
import { objective } from '../logic/story';
import { chapterName, unreadMessages, useNow, usePhone } from '../state/PhoneProvider';
import { useRadio } from '../state/RadioProvider';
import { colors, skyPhase } from '../theme';

type IconName = keyof typeof Ionicons.glyphMap;
type AppDef = { route: string; label: string; icon: IconName; colors: readonly [string, string]; badge?: number };

const WEATHER: Record<ReturnType<typeof skyPhase>, { icon: IconName; temp: string; text: string }> = {
  aube: { icon: 'partly-sunny', temp: '26°', text: 'Brume matinale' },
  jour: { icon: 'sunny', temp: '33°', text: 'Grand soleil' },
  couchant: { icon: 'sunny', temp: '30°', text: 'Coucher de soleil' },
  nuit: { icon: 'moon', temp: '27°', text: 'Nuit tropicale' },
};

export default function Home() {
  const { state, buzz } = usePhone();
  const radio = useRadio();
  const now = useNow(1000);
  const insets = useSafeAreaInsets();
  const missed = state.calls.filter((c) => c.missed).length;
  const st = state.story;
  const weather = WEATHER[skyPhase(new Date(now).getHours())];
  const storyAlert = st.choice || (st.mission && !st.mission.startedAt) || st.gate ? 1 : 0;

  const apps: AppDef[] = [
    { route: '/story', label: 'La Cavale', icon: 'flame', colors: ['#FF3D8B', '#7B2FF7'], badge: storyAlert },
    { route: '/map', label: 'Carte', icon: 'map', colors: ['#2DE2E6', '#05668D'] },
    { route: '/feed', label: 'Palmfeed', icon: 'sparkles', colors: ['#FF8A3D', '#FF3D8B'] },
    { route: '/news', label: 'Corail Info', icon: 'newspaper', colors: ['#FF5C6C', '#9D0F3A'], badge: ARTICLES.length - state.newsRead.length },
    { route: '/radio', label: 'Radio', icon: 'radio', colors: ['#8A4DFF', '#3A0CA3'] },
    { route: '/camera', label: 'Caméra', icon: 'camera', colors: ['#6B7280', '#1F2430'] },
    { route: '/photos', label: 'Photos', icon: 'images', colors: ['#FFD166', '#FF8A3D'] },
    { route: '/bank', label: 'Banque', icon: 'card', colors: ['#FF8FB1', '#B0246A'] },
    { route: '/jobs', label: 'Boulots', icon: 'briefcase', colors: ['#3DDC97', '#0F7A5C'], badge: state.activeJob ? 1 : 0 },
  ];
  const dock: AppDef[] = [
    { route: '/phone', label: 'Téléphone', icon: 'call', colors: ['#3DDC97', '#14915F'], badge: missed },
    { route: '/messages', label: 'Messages', icon: 'chatbubbles', colors: ['#2DE2E6', '#1C6FD6'], badge: unreadMessages(state) },
    { route: '/contacts', label: 'Contacts', icon: 'people', colors: ['#FFB347', '#D9631E'] },
    { route: '/settings', label: 'Réglages', icon: 'settings-sharp', colors: ['#8A80A8', '#3F3858'] },
  ];

  const job = state.activeJob ? JOBS.find((j) => j.id === state.activeJob!.id) : undefined;
  const left = job && state.activeJob ? job.durationSec - (now - state.activeJob.startedAt) / 1000 : 0;

  const open = (route: string) => {
    buzz();
    router.push(route as never);
  };

  return (
    <Wallpaper skyline>
      <PhoneStatusBar />
      <ScrollView contentContainerStyle={styles.content}>
        {/* Widget de l’histoire */}
        <Pressable onPress={() => open('/story')} style={styles.storyWidget} accessibilityLabel="Ouvrir La Cavale">
          <LinearGradient colors={['rgba(255,61,139,0.85)', 'rgba(123,47,247,0.85)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.storyInner}>
            <View style={styles.rowBetween}>
              <Text style={styles.widgetLabel}>LA CAVALE{st.chapter ? ` · CHAPITRE ${st.chapter}` : ''}</Text>
              {st.wanted > 0 && (
                <View style={{ flexDirection: 'row' }}>
                  {Array.from({ length: st.wanted }, (_, i) => (
                    <Ionicons key={i} name="star" size={13} color="#FFD166" />
                  ))}
                </View>
              )}
            </View>
            <Text style={styles.storyTitle}>{st.ending ? 'Histoire terminée' : chapterName(st.chapter) || 'Une nuit à Port Corail'}</Text>
            <View style={styles.storyObjective}>
              <Ionicons name="flag" size={14} color="#fff" />
              <Text style={styles.storyObjectiveText} numberOfLines={2}>
                {objective(st)}
              </Text>
            </View>
          </LinearGradient>
        </Pressable>

        <View style={styles.widgets}>
          <View style={styles.widget}>
            <Text style={styles.widgetLabel}>PORT CORAIL</Text>
            <View style={styles.rowBetween}>
              <Text style={styles.widgetBig}>{weather.temp}</Text>
              <Ionicons name={weather.icon} size={30} color="#FFD166" />
            </View>
            <Text style={styles.widgetText}>{weather.text}</Text>
          </View>
          <Pressable style={styles.widget} onPress={() => open(job ? '/jobs' : '/bank')}>
            <Text style={styles.widgetLabel}>{job ? 'BOULOT EN COURS' : 'BANQUE FLAMANT'}</Text>
            {job ? (
              <>
                <Ionicons name="briefcase" size={30} color="#3DDC97" />
                <Text style={styles.widgetText} numberOfLines={1}>
                  {left > 0 ? `${duration(left)} restantes` : 'Paiement…'}
                </Text>
              </>
            ) : (
              <>
                <Text style={[styles.widgetBig, { fontSize: 26 }]} numberOfLines={1} adjustsFontSizeToFit>
                  {money(state.balance)}
                </Text>
                <Text style={styles.widgetText}>Solde disponible</Text>
              </>
            )}
          </Pressable>
        </View>

        {radio.station && (
          <Pressable style={styles.mini} onPress={() => open('/radio')} accessibilityLabel="Ouvrir la radio">
            <LinearGradient colors={radio.station.colors} style={styles.miniIcon}>
              <Ionicons name="radio" size={20} color="#fff" />
            </LinearGradient>
            <View style={{ flex: 1 }}>
              <Text style={styles.widgetLabel}>{radio.playing ? 'EN DIRECT' : 'EN PAUSE'}</Text>
              <Text style={styles.miniName}>
                {radio.station.name} · {radio.station.freq}
              </Text>
            </View>
            <Pressable onPress={radio.toggle} hitSlop={10} style={styles.miniBtn} accessibilityLabel={radio.playing ? 'Pause' : 'Lecture'}>
              <Ionicons name={radio.playing ? 'pause' : 'play'} size={18} color={colors.background} />
            </Pressable>
          </Pressable>
        )}

        <View style={styles.grid}>
          {apps.map((a) => (
            <AppIcon key={a.route} app={a} onPress={() => open(a.route)} />
          ))}
        </View>
      </ScrollView>

      <View style={[styles.dock, { marginBottom: insets.bottom + 12 }]}>
        {dock.map((a) => (
          <AppIcon key={a.route} app={a} onPress={() => open(a.route)} hideLabel />
        ))}
      </View>
    </Wallpaper>
  );
}

function AppIcon({ app, onPress, hideLabel }: { app: AppDef; onPress: () => void; hideLabel?: boolean }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.app, { transform: [{ scale: pressed ? 0.9 : 1 }] }]} accessibilityRole="button" accessibilityLabel={app.label}>
      <LinearGradient colors={app.colors} style={styles.icon} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <View style={styles.iconShine} />
        <Ionicons name={app.icon} size={30} color="#fff" />
      </LinearGradient>
      <Badge count={app.badge ?? 0} style={styles.badge} />
      {!hideLabel && (
        <Text style={styles.label} numberOfLines={1}>
          {app.label}
        </Text>
      )}
    </Pressable>
  );
}

const glass = { backgroundColor: 'rgba(12,6,28,0.42)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' } as const;

const styles = StyleSheet.create({
  content: { padding: 16, paddingTop: 10, paddingBottom: 30 },
  storyWidget: { borderRadius: 24, overflow: 'hidden' },
  storyInner: { padding: 14, gap: 4 },
  storyTitle: { color: '#fff', fontSize: 22, fontWeight: '900' },
  storyObjective: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  storyObjectiveText: { color: '#fff', fontSize: 13, fontWeight: '600', flex: 1 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  widgets: { flexDirection: 'row', gap: 12, marginTop: 12 },
  widget: { flex: 1, borderRadius: 22, padding: 14, minHeight: 118, justifyContent: 'space-between', ...glass },
  widgetLabel: { color: colors.text, opacity: 0.8, fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  widgetBig: { color: colors.text, fontSize: 38, fontWeight: '300' },
  widgetText: { color: colors.text, fontSize: 13, fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 22, rowGap: 20 },
  app: { width: '25%', alignItems: 'center' },
  icon: { width: 62, height: 62, borderRadius: 18, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  iconShine: { position: 'absolute', top: 0, left: 0, right: 0, height: '45%', backgroundColor: 'rgba(255,255,255,0.14)' },
  label: { color: colors.text, fontSize: 12, marginTop: 6, fontWeight: '600', textShadowColor: 'rgba(0,0,0,0.7)', textShadowRadius: 4 },
  badge: { position: 'absolute', top: -6, right: '12%' },
  mini: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12, padding: 10, borderRadius: 20, ...glass },
  miniIcon: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  miniName: { color: colors.text, fontSize: 15, fontWeight: '700', marginTop: 2 },
  miniBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  dock: { flexDirection: 'row', marginHorizontal: 12, paddingVertical: 14, borderRadius: 30, backgroundColor: 'rgba(255,255,255,0.16)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
});
