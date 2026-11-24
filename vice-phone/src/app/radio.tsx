import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { Animated, Easing, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppScreen } from '../components/phone';
import { STATIONS } from '../data/radio';
import { onAir } from '../logic/radio';
import { useNow, usePhone } from '../state/PhoneProvider';
import { useRadio } from '../state/RadioProvider';
import { colors } from '../theme';

export default function Radio() {
  const { station, playing, tune, toggle, next, stop } = useRadio();
  const { buzz } = usePhone();
  const now = useNow(1000);
  const shown = station ?? STATIONS[0];
  const air = onAir(shown, now);

  return (
    <AppScreen title="Radio" color={colors.purple}>
      <ScrollView contentContainerStyle={{ padding: 14, gap: 16 }}>
        <LinearGradient colors={shown.colors} style={styles.player} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          <View style={styles.playerTop}>
            <Text style={styles.freq}>{shown.freq} FM</Text>
            <Text style={styles.live}>{playing ? '● EN DIRECT' : station ? 'EN PAUSE' : 'ÉTEINTE'}</Text>
          </View>
          <Text style={styles.emoji}>{shown.emoji}</Text>
          <Text style={styles.stationName}>{shown.name}</Text>
          <Text style={styles.genre}>
            {shown.genre} · avec {shown.host}
          </Text>
          <Equalizer playing={playing} />
          <View style={styles.nowPlaying}>
            <Text style={styles.npLabel}>{air.kind === 'dj' ? '🎙️ À L’ANTENNE' : '🎵 EN CE MOMENT'}</Text>
            <Text style={styles.npTitle} numberOfLines={2}>
              {air.kind === 'dj' ? `« ${air.line2} »` : air.line1}
            </Text>
            <Text style={styles.npArtist}>{air.line1 === air.line2 ? '' : air.kind === 'dj' ? air.line1 : air.line2}</Text>
          </View>
          <View style={styles.controls}>
            <Ctrl label="Station précédente" icon="⏮" onPress={() => (buzz(), next(-1))} />
            <Pressable
              onPress={() => {
                buzz();
                if (station) toggle();
                else tune(shown.id);
              }}
              style={styles.play}
              accessibilityLabel={playing ? 'Pause' : 'Lecture'}
            >
              <Text style={styles.playIcon}>{playing ? '❚❚' : '▶'}</Text>
            </Pressable>
            <Ctrl label="Station suivante" icon="⏭" onPress={() => (buzz(), next(1))} />
          </View>
        </LinearGradient>

        <Text style={styles.section}>Stations de Port Corail</Text>
        {STATIONS.map((s) => {
          const active = station?.id === s.id;
          return (
            <Pressable
              key={s.id}
              onPress={() => {
                buzz();
                tune(s.id);
              }}
              style={({ pressed }) => [styles.row, active && { borderColor: s.colors[0] }, pressed && { opacity: 0.8 }]}
              accessibilityLabel={`Écouter ${s.name}`}
            >
              <LinearGradient colors={s.colors} style={styles.rowIcon}>
                <Text style={{ fontSize: 22 }}>{s.emoji}</Text>
              </LinearGradient>
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowName, active && { color: s.colors[0] }]}>{s.name}</Text>
                <Text style={styles.rowGenre}>
                  {s.freq} · {s.genre}
                </Text>
              </View>
              {active && playing && <Text style={{ color: s.colors[0] }}>♪</Text>}
            </Pressable>
          );
        })}
        {station && (
          <Pressable onPress={stop} style={styles.off}>
            <Text style={styles.offText}>Éteindre la radio</Text>
          </Pressable>
        )}
        <Text style={styles.note}>Musique originale composée pour NeonCell. Artistes et titres fictifs.</Text>
      </ScrollView>
    </AppScreen>
  );
}

function Ctrl({ label, icon, onPress }: { label: string; icon: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={10} style={styles.ctrl} accessibilityLabel={label}>
      <Text style={styles.ctrlIcon}>{icon}</Text>
    </Pressable>
  );
}

const BARS = 18;

/** Barres d’égaliseur animées pendant la lecture. */
export function Equalizer({ playing, height = 46 }: { playing: boolean; height?: number }) {
  const [vals] = useState(() => Array.from({ length: BARS }, () => new Animated.Value(0.15)));
  useEffect(() => {
    if (!playing) {
      vals.forEach((v) => Animated.timing(v, { toValue: 0.12, duration: 300, useNativeDriver: true }).start());
      return;
    }
    const loops = vals.map((v, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(v, { toValue: 0.35 + ((i * 37) % 60) / 100, duration: 260 + ((i * 53) % 200), easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          Animated.timing(v, { toValue: 0.15 + ((i * 17) % 25) / 100, duration: 240 + ((i * 29) % 180), easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        ]),
      ),
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [playing, vals]);
  return (
    <View style={[styles.eq, { height }]}>
      {vals.map((v, i) => (
        <Animated.View key={i} style={[styles.eqBar, { height, transform: [{ scaleY: v }] }]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  player: { borderRadius: 26, padding: 18, alignItems: 'center', gap: 4 },
  playerTop: { flexDirection: 'row', justifyContent: 'space-between', alignSelf: 'stretch' },
  freq: { color: '#fff', fontWeight: '800', fontSize: 14 },
  live: { color: '#fff', fontWeight: '800', fontSize: 12, opacity: 0.9 },
  emoji: { fontSize: 54, marginTop: 6 },
  stationName: { color: '#fff', fontSize: 28, fontWeight: '900' },
  genre: { color: 'rgba(255,255,255,0.85)', fontSize: 14 },
  eq: { flexDirection: 'row', alignItems: 'center', gap: 4, marginVertical: 12 },
  eqBar: { width: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.85)' },
  nowPlaying: { alignSelf: 'stretch', backgroundColor: 'rgba(0,0,0,0.25)', borderRadius: 16, padding: 12, minHeight: 92 },
  npLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  npTitle: { color: '#fff', fontSize: 17, fontWeight: '700', marginTop: 4 },
  npArtist: { color: 'rgba(255,255,255,0.8)', fontSize: 14, marginTop: 2 },
  controls: { flexDirection: 'row', alignItems: 'center', gap: 34, marginTop: 14 },
  ctrl: { padding: 6 },
  ctrlIcon: { color: '#fff', fontSize: 26 },
  play: { width: 70, height: 70, borderRadius: 35, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  playIcon: { color: colors.background, fontSize: 24, fontWeight: '900' },
  section: { color: colors.text, fontSize: 17, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: 'transparent' },
  rowIcon: { width: 46, height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  rowName: { color: colors.text, fontSize: 16, fontWeight: '700' },
  rowGenre: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  off: { alignSelf: 'center', padding: 10 },
  offText: { color: colors.red, fontWeight: '700' },
  note: { color: colors.textMuted, fontSize: 12, textAlign: 'center' },
});
