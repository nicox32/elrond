import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar, PhoneStatusBar, Wallpaper } from '../../components/phone';
import { contactById } from '../../data/world';
import { duration } from '../../logic/format';
import { usePhone } from '../../state/PhoneProvider';
import { useRadio } from '../../state/RadioProvider';
import { colors } from '../../theme';

type Phase = 'ringing' | 'calling' | 'active' | 'ended';

/** Appel : sonnerie (entrant) ou tonalité (sortant), puis répliques du contact en sous-titres. */
export default function Call() {
  const { id, incoming, number } = useLocalSearchParams<{ id: string; incoming?: string; number?: string }>();
  const contact = contactById(id);
  const { logCall, buzz, setInCall } = usePhone();
  const { duck } = useRadio();
  const insets = useSafeAreaInsets();
  const [phase, setPhase] = useState<Phase>(incoming ? 'ringing' : 'calling');
  const [seconds, setSeconds] = useState(0);
  const [line, setLine] = useState(-1);
  const [muted, setMuted] = useState(false);
  const [speaker, setSpeaker] = useState(false);
  const [pulse] = useState(() => new Animated.Value(0));
  const logged = useRef(false);

  // Pendant l’appel, la radio baisse et aucun autre appel n’arrive.
  useEffect(() => {
    setInCall(true);
    duck(true);
    return () => {
      setInCall(false);
      duck(false);
    };
  }, [setInCall, duck]);

  // Halo animé autour de l’avatar tant que ça sonne.
  useEffect(() => {
    if (phase !== 'ringing' && phase !== 'calling') return;
    const loop = Animated.loop(Animated.timing(pulse, { toValue: 1, duration: 1400, easing: Easing.out(Easing.quad), useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [phase, pulse]);

  // Vibration à chaque sonnerie entrante.
  useEffect(() => {
    if (phase !== 'ringing') return;
    buzz('notify');
    const t = setInterval(() => buzz('notify'), 1800);
    return () => clearInterval(t);
  }, [phase, buzz]);

  // Appel sortant : le contact décroche après quelques sonneries ; un numéro inconnu n’aboutit pas.
  useEffect(() => {
    if (phase !== 'calling') return;
    const t = setTimeout(() => setPhase(contact ? 'active' : 'ended'), contact ? 2600 : 3500);
    return () => clearTimeout(t);
  }, [phase, contact]);

  // Durée de l’appel et répliques du contact.
  useEffect(() => {
    if (phase !== 'active') return;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [phase]);

  useEffect(() => {
    if (phase !== 'active' || !contact) return;
    if (line >= contact.call.length - 1) {
      const t = setTimeout(() => setPhase('ended'), 2500);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setLine((l) => l + 1), line < 0 ? 600 : 2800);
    return () => clearTimeout(t);
  }, [phase, line, contact]);

  useEffect(() => {
    if (phase !== 'ended') return;
    if (contact && !logged.current) {
      logged.current = true;
      logCall(contact.id, seconds, seconds === 0 && !!incoming);
    }
    const t = setTimeout(() => (router.canGoBack() ? router.back() : router.replace('/home')), 1400);
    return () => clearTimeout(t);
  }, [phase, contact, seconds, incoming, logCall]);

  const hangUp = () => {
    buzz();
    setPhase('ended');
  };

  const name = contact?.name ?? number ?? 'Inconnu';
  const statusText =
    phase === 'ringing'
      ? 'Appel entrant…'
      : phase === 'calling'
        ? 'Appel en cours…'
        : phase === 'active'
          ? duration(seconds)
          : contact
            ? 'Appel terminé'
            : 'Le numéro composé n’est pas attribué';

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.9] });
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] });

  return (
    <Wallpaper dim={0.55}>
      <PhoneStatusBar />
      <View style={styles.top}>
        <View style={styles.avatarWrap}>
          {(phase === 'ringing' || phase === 'calling') && (
            <Animated.View style={[styles.halo, { borderColor: contact?.color ?? colors.textMuted, transform: [{ scale }], opacity }]} />
          )}
          <Avatar emoji={contact?.avatar ?? '☎️'} color={contact?.color ?? colors.textMuted} size={110} />
        </View>
        <Text style={styles.name}>{name}</Text>
        <Text style={styles.status}>{statusText}</Text>
      </View>

      <View style={styles.subtitles}>
        {phase === 'active' && contact && line >= 0 && (
          <Text style={styles.subtitle}>
            « {contact.call[line]} »{muted ? '\n(micro coupé)' : ''}
          </Text>
        )}
      </View>

      <View style={[styles.controls, { paddingBottom: insets.bottom + 36 }]}>
        {phase === 'ringing' ? (
          <View style={styles.row}>
            <RoundButton label="Refuser" icon="✕" color={colors.red} onPress={hangUp} />
            <RoundButton
              label="Répondre"
              icon="📞"
              color={colors.green}
              onPress={() => {
                buzz('success');
                setPhase('active');
              }}
            />
          </View>
        ) : (
          <>
            {phase === 'active' && (
              <View style={styles.row}>
                <RoundButton label="Muet" icon="🎙️" color={muted ? colors.text : 'rgba(255,255,255,0.18)'} onPress={() => setMuted((m) => !m)} />
                <RoundButton label="Haut-parleur" icon="🔊" color={speaker ? colors.text : 'rgba(255,255,255,0.18)'} onPress={() => setSpeaker((s) => !s)} />
              </View>
            )}
            {phase !== 'ended' && <RoundButton label="Raccrocher" icon="✕" color={colors.red} onPress={hangUp} />}
          </>
        )}
      </View>
    </Wallpaper>
  );
}

function RoundButton({ label, icon, color, onPress }: { label: string; icon: string; color: string; onPress: () => void }) {
  return (
    <View style={{ alignItems: 'center', gap: 8 }}>
      <Pressable onPress={onPress} style={({ pressed }) => [styles.round, { backgroundColor: color, opacity: pressed ? 0.7 : 1 }]} accessibilityRole="button" accessibilityLabel={label}>
        <Text style={{ fontSize: 28, color: '#fff' }}>{icon}</Text>
      </Pressable>
      <Text style={styles.roundLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  top: { alignItems: 'center', marginTop: 50, gap: 8 },
  avatarWrap: { width: 160, height: 160, alignItems: 'center', justifyContent: 'center' },
  halo: { position: 'absolute', width: 110, height: 110, borderRadius: 55, borderWidth: 3 },
  name: { color: colors.text, fontSize: 32, fontWeight: '300' },
  status: { color: colors.text, opacity: 0.8, fontSize: 16, textAlign: 'center', paddingHorizontal: 30 },
  subtitles: { flex: 1, justifyContent: 'center', paddingHorizontal: 30 },
  subtitle: { color: colors.text, fontSize: 19, textAlign: 'center', lineHeight: 27, fontStyle: 'italic' },
  controls: { alignItems: 'center', gap: 30 },
  row: { flexDirection: 'row', gap: 70 },
  round: { width: 74, height: 74, borderRadius: 37, alignItems: 'center', justifyContent: 'center' },
  roundLabel: { color: colors.text, fontSize: 13 },
});
