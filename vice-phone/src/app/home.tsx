import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Badge, PhoneStatusBar, Wallpaper } from '../components/phone';
import { ARTICLES, JOBS } from '../data/world';
import { duration, money } from '../logic/format';
import { unreadMessages, useNow, usePhone } from '../state/PhoneProvider';
import { useRadio } from '../state/RadioProvider';
import { colors } from '../theme';

type AppDef = { route: string; label: string; icon: string; colors: readonly [string, string]; badge?: number };

export default function Home() {
  const { state, buzz } = usePhone();
  const radio = useRadio();
  const now = useNow(1000);
  const insets = useSafeAreaInsets();
  const missed = state.calls.filter((c) => c.missed).length;

  const apps: AppDef[] = [
    { route: '/feed', label: 'Palmfeed', icon: '🌴', colors: ['#FF3D8B', '#FF8A3D'] },
    { route: '/news', label: 'Corail Info', icon: '📰', colors: ['#FF5C6C', '#B3123A'], badge: ARTICLES.length - state.newsRead.length },
    { route: '/bank', label: 'Banque', icon: '🦩', colors: ['#FF8FB1', '#C2447A'] },
    { route: '/jobs', label: 'Boulots', icon: '💼', colors: ['#3DDC97', '#11876A'], badge: state.activeJob ? 1 : 0 },
    { route: '/radio', label: 'Radio', icon: '📻', colors: ['#8A4DFF', '#3A0CA3'] },
    { route: '/camera', label: 'Appareil photo', icon: '📷', colors: ['#5B5F73', '#22252E'] },
    { route: '/photos', label: 'Photos', icon: '🖼️', colors: ['#FFD166', '#FF8A3D'] },
    { route: '/map', label: 'Carte', icon: '🗺️', colors: ['#2DE2E6', '#05668D'] },
  ];
  const dock: AppDef[] = [
    { route: '/phone', label: 'Téléphone', icon: '📞', colors: ['#3DDC97', '#1E9E6A'], badge: missed },
    { route: '/messages', label: 'Messages', icon: '💬', colors: ['#2DE2E6', '#1C7FD6'], badge: unreadMessages(state) },
    { route: '/contacts', label: 'Contacts', icon: '👥', colors: ['#FFB347', '#E07A1F'] },
    { route: '/settings', label: 'Réglages', icon: '⚙️', colors: ['#8A80A8', '#4B4366'] },
  ];

  const job = state.activeJob ? JOBS.find((j) => j.id === state.activeJob!.id) : undefined;
  const left = job && state.activeJob ? job.durationSec - (now - state.activeJob.startedAt) / 1000 : 0;

  const open = (route: string) => {
    buzz();
    router.push(route as never);
  };

  return (
    <Wallpaper dim={0.1}>
      <PhoneStatusBar />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.widgets}>
          <View style={styles.widget}>
            <Text style={styles.widgetLabel}>PORT CORAIL</Text>
            <Text style={styles.widgetBig}>33°</Text>
            <Text style={styles.widgetText}>☀️ Ensoleillé</Text>
          </View>
          <Pressable style={styles.widget} onPress={() => open(job ? '/jobs' : '/bank')}>
            <Text style={styles.widgetLabel}>{job ? 'BOULOT EN COURS' : 'BANQUE FLAMANT'}</Text>
            {job ? (
              <>
                <Text style={styles.widgetBig}>{job.emoji}</Text>
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
              <Text style={{ fontSize: 20 }}>{radio.station.emoji}</Text>
            </LinearGradient>
            <View style={{ flex: 1 }}>
              <Text style={styles.widgetLabel}>{radio.playing ? 'EN DIRECT' : 'EN PAUSE'}</Text>
              <Text style={styles.miniName}>
                {radio.station.name} · {radio.station.freq}
              </Text>
            </View>
            <Pressable onPress={radio.toggle} hitSlop={10} style={styles.miniBtn} accessibilityLabel={radio.playing ? 'Pause' : 'Lecture'}>
              <Text style={styles.miniBtnText}>{radio.playing ? '❚❚' : '▶'}</Text>
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
    <Pressable onPress={onPress} style={({ pressed }) => [styles.app, { transform: [{ scale: pressed ? 0.92 : 1 }] }]} accessibilityRole="button" accessibilityLabel={app.label}>
      <LinearGradient colors={app.colors} style={styles.icon} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <Text style={styles.iconGlyph}>{app.icon}</Text>
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

const styles = StyleSheet.create({
  content: { padding: 18, paddingTop: 12 },
  widgets: { flexDirection: 'row', gap: 14 },
  widget: { flex: 1, borderRadius: 22, padding: 14, backgroundColor: 'rgba(15,8,30,0.45)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', minHeight: 130, justifyContent: 'space-between' },
  widgetLabel: { color: colors.text, opacity: 0.75, fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  widgetBig: { color: colors.text, fontSize: 42, fontWeight: '300' },
  widgetText: { color: colors.text, fontSize: 13, fontWeight: '500' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 26, rowGap: 22 },
  app: { width: '25%', alignItems: 'center' },
  icon: { width: 62, height: 62, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  iconGlyph: { fontSize: 30 },
  label: { color: colors.text, fontSize: 12, marginTop: 6, fontWeight: '500', textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 4 },
  badge: { position: 'absolute', top: -6, right: '12%' },
  mini: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 14, padding: 10, borderRadius: 20, backgroundColor: 'rgba(15,8,30,0.45)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  miniIcon: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  miniName: { color: colors.text, fontSize: 15, fontWeight: '700', marginTop: 2 },
  miniBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  miniBtnText: { color: colors.background, fontWeight: '900' },
  dock: { flexDirection: 'row', marginHorizontal: 12, paddingVertical: 14, borderRadius: 30, backgroundColor: 'rgba(255,255,255,0.14)' },
});
