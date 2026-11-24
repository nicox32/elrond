import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppScreen, Avatar } from '../components/phone';
import { contactById } from '../data/world';
import { ago, duration } from '../logic/format';
import { knownContacts, useNow, usePhone } from '../state/PhoneProvider';
import { colors } from '../theme';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'];

/** Met en forme 5550142 → 555-0142. */
const formatNumber = (d: string) => (d.length > 3 ? `${d.slice(0, 3)}-${d.slice(3)}` : d);

export default function Phone() {
  const [tab, setTab] = useState<'keypad' | 'recents'>('keypad');
  return (
    <AppScreen title="Téléphone" color={colors.green}>
      <View style={styles.tabs}>
        {(['keypad', 'recents'] as const).map((t) => (
          <Pressable key={t} onPress={() => setTab(t)} style={[styles.tab, tab === t && styles.tabOn]}>
            <Text style={[styles.tabText, tab === t && { color: colors.background }]}>{t === 'keypad' ? 'Clavier' : 'Récents'}</Text>
          </Pressable>
        ))}
      </View>
      {tab === 'keypad' ? <Keypad /> : <Recents />}
    </AppScreen>
  );
}

function Keypad() {
  const { buzz, state } = usePhone();
  const [digits, setDigits] = useState('');
  const shown = formatNumber(digits);
  const match = knownContacts(state).find((c) => c.number === shown);

  const call = () => {
    if (!digits) return;
    buzz();
    router.push(match ? `/call/${match.id}` : `/call/unknown?number=${encodeURIComponent(shown)}`);
    setDigits('');
  };

  return (
    <View style={styles.keypad}>
      <View style={styles.display}>
        <Text style={styles.number} numberOfLines={1} adjustsFontSizeToFit>
          {shown || ' '}
        </Text>
        <Text style={styles.match}>{match ? match.name : digits ? ' ' : 'Astuce : les numéros commencent par 555'}</Text>
      </View>
      <View style={styles.keys}>
        {KEYS.map((k) => (
          <Pressable
            key={k}
            onPress={() => {
              buzz();
              setDigits((d) => (d.length < 10 ? d + k : d));
            }}
            style={({ pressed }) => [styles.key, pressed && { backgroundColor: colors.surfaceAlt }]}
          >
            <Text style={styles.keyText}>{k}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.actions}>
        <View style={{ width: 70 }} />
        <Pressable onPress={call} style={[styles.callBtn, { opacity: digits ? 1 : 0.5 }]} accessibilityLabel="Appeler">
          <Text style={{ fontSize: 30 }}>📞</Text>
        </Pressable>
        <Pressable onPress={() => setDigits((d) => d.slice(0, -1))} onLongPress={() => setDigits('')} style={{ width: 70, alignItems: 'center' }} accessibilityLabel="Effacer">
          <Text style={styles.erase}>{digits ? '⌫' : ''}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function Recents() {
  const { state } = usePhone();
  const now = useNow(30_000);
  if (state.calls.length === 0) return <Text style={styles.empty}>Aucun appel pour l’instant.</Text>;
  return (
    <FlatList
      data={state.calls}
      keyExtractor={(c) => c.id}
      renderItem={({ item }) => {
        const c = contactById(item.contactId);
        if (!c) return null;
        return (
          <Pressable style={styles.recent} onPress={() => router.push(`/call/${c.id}`)}>
            <Avatar name={c.name} color={c.color} size={42} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.recentName, item.missed && { color: colors.red }]}>{c.name}</Text>
              <Text style={styles.recentInfo}>{item.missed ? 'Appel manqué' : `Durée ${duration(item.seconds)}`}</Text>
            </View>
            <Text style={styles.recentInfo}>{ago(item.at, now)}</Text>
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', margin: 12, padding: 3, borderRadius: 12, backgroundColor: colors.surface },
  tab: { flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center' },
  tabOn: { backgroundColor: colors.green },
  tabText: { color: colors.text, fontWeight: '700' },
  keypad: { flex: 1, justifyContent: 'space-evenly', paddingBottom: 8 },
  display: { alignItems: 'center', paddingHorizontal: 20 },
  number: { color: colors.text, fontSize: 40, fontWeight: '300', letterSpacing: 2 },
  match: { color: colors.green, fontSize: 15, marginTop: 4 },
  keys: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', paddingHorizontal: 40, rowGap: 14, columnGap: 26 },
  key: { width: 74, height: 74, borderRadius: 37, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  keyText: { color: colors.text, fontSize: 30, fontWeight: '400' },
  actions: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 26 },
  callBtn: { width: 74, height: 74, borderRadius: 37, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center' },
  erase: { color: colors.textMuted, fontSize: 28 },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: 40 },
  recent: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10 },
  recentName: { color: colors.text, fontSize: 16, fontWeight: '600' },
  recentInfo: { color: colors.textMuted, fontSize: 13 },
});
