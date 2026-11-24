import { router } from 'expo-router';
import { useState } from 'react';
import { Animated, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PhoneStatusBar, Wallpaper } from '../components/phone';
import { contactById } from '../data/world';
import { clock, longDate } from '../logic/format';
import { useNow, usePhone } from '../state/PhoneProvider';
import { useRadio } from '../state/RadioProvider';
import { colors } from '../theme';

/** Écran de verrouillage : heure, notifications en attente, glisser vers le haut pour ouvrir. */
export default function LockScreen() {
  const { state, unlock, buzz } = usePhone();
  const radio = useRadio();
  const now = useNow(1000);
  const insets = useSafeAreaInsets();
  const [dy] = useState(() => new Animated.Value(0));

  // unlock et buzz sont stables : le geste créé une seule fois peut les appeler.
  const open = () => {
    buzz();
    unlock();
    router.replace('/home');
  };

  const [pan] = useState(() =>
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 8,
      onPanResponderMove: (_, g) => dy.setValue(Math.min(0, g.dy)),
      onPanResponderRelease: (_, g) => {
        if (g.dy < -90 || g.vy < -0.8) {
          Animated.timing(dy, { toValue: -800, duration: 220, useNativeDriver: true }).start(() => {
            dy.setValue(0);
            open();
          });
        } else {
          Animated.spring(dy, { toValue: 0, useNativeDriver: true }).start();
        }
      },
    }),
  );

  const pending = Object.entries(state.threads)
    .filter(([, t]) => t.unread > 0)
    .map(([id, t]) => ({ id, contact: contactById(id), last: t.messages[t.messages.length - 1], unread: t.unread }))
    .filter((p) => p.contact && p.last)
    .sort((a, b) => b.last.at - a.last.at)
    .slice(0, 4);

  return (
    <Wallpaper dim={0.25}>
      <Animated.View style={{ flex: 1, transform: [{ translateY: dy }] }} {...pan.panHandlers}>
        <PhoneStatusBar />
        <View style={styles.top}>
          <Text style={styles.lockIcon}>🔒</Text>
          <Text style={styles.date}>{longDate(now).replace(/^./, (c) => c.toUpperCase())}</Text>
          <Text style={styles.time}>{clock(now)}</Text>
        </View>

        <View style={styles.list}>
          {radio.station && (
            <View style={[styles.notif, { alignItems: 'center' }]}>
              <View style={[styles.notifIcon, { backgroundColor: radio.station.colors[0] }]}>
                <Text>📻</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.notifTitle}>{radio.station.name}</Text>
                <Text style={styles.notifBody}>{radio.playing ? `En direct · ${radio.station.genre}` : 'En pause'}</Text>
              </View>
              <Pressable onPress={radio.toggle} hitSlop={10} accessibilityLabel={radio.playing ? 'Pause' : 'Lecture'}>
                <Text style={{ color: colors.text, fontSize: 20 }}>{radio.playing ? '❚❚' : '▶'}</Text>
              </Pressable>
            </View>
          )}
          {pending.map((p) => (
            <View key={p.id} style={styles.notif}>
              <View style={styles.notifIcon}>
                <Text>💬</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.notifTitle}>
                  {p.contact!.name}
                  {p.unread > 1 ? `  ·  ${p.unread} messages` : ''}
                </Text>
                <Text style={styles.notifBody} numberOfLines={2}>
                  {p.last.text}
                </Text>
              </View>
            </View>
          ))}
        </View>

        <Pressable onPress={open} style={[styles.unlock, { paddingBottom: insets.bottom + 24 }]} accessibilityRole="button" accessibilityLabel="Déverrouiller">
          <Text style={styles.chevron}>︿</Text>
          <Text style={styles.hint}>Glisser vers le haut ou toucher pour déverrouiller</Text>
        </Pressable>
      </Animated.View>
    </Wallpaper>
  );
}

const styles = StyleSheet.create({
  top: { alignItems: 'center', marginTop: 24 },
  lockIcon: { fontSize: 18 },
  date: { color: colors.text, fontSize: 18, fontWeight: '600', marginTop: 8 },
  time: { color: colors.text, fontSize: 88, fontWeight: '200', letterSpacing: -2, marginTop: -6 },
  list: { flex: 1, paddingHorizontal: 14, gap: 8, marginTop: 16 },
  notif: { flexDirection: 'row', gap: 10, padding: 12, borderRadius: 18, backgroundColor: 'rgba(20,12,40,0.6)' },
  notifIcon: { width: 34, height: 34, borderRadius: 9, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center' },
  notifTitle: { color: colors.text, fontWeight: '700', fontSize: 14 },
  notifBody: { color: colors.text, opacity: 0.85, fontSize: 14, marginTop: 1 },
  unlock: { alignItems: 'center', paddingTop: 12 },
  chevron: { color: colors.text, fontSize: 22, opacity: 0.8 },
  hint: { color: colors.text, opacity: 0.8, fontSize: 13 },
});
