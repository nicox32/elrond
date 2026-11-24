import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { AppScreen, Avatar } from '../../components/phone';
import { contactById } from '../../data/world';
import { clock } from '../../logic/format';
import { usePhone } from '../../state/PhoneProvider';
import { colors } from '../../theme';

const QUICK = ['Salut ! 👋', 'Oui', 'Non', 'Merci !', 'T’es où ?', '😂'];

export default function Conversation() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const contact = contactById(id);
  const { state, typing, sendMessage, readThread, setOpenThread } = usePhone();
  const [text, setText] = useState('');
  const list = useRef<FlatList>(null);
  const messages = state.threads[id]?.messages ?? [];
  const unread = state.threads[id]?.unread ?? 0;

  useFocusEffect(
    useCallback(() => {
      setOpenThread(id);
      return () => setOpenThread(null);
    }, [id, setOpenThread]),
  );

  useEffect(() => {
    if (unread > 0) readThread(id);
  }, [unread, id, readThread]);

  if (!contact) {
    return (
      <AppScreen title="Messages" color={colors.cyan} back="pop">
        <Text style={styles.empty}>Conversation introuvable.</Text>
      </AppScreen>
    );
  }

  const send = (t: string) => {
    if (!t.trim()) return;
    sendMessage(contact.id, t);
    setText('');
  };

  return (
    <AppScreen
      title={contact.name}
      color={colors.cyan}
      back="pop"
      right={
        <Pressable onPress={() => router.push(`/call/${contact.id}`)} hitSlop={10} accessibilityLabel={`Appeler ${contact.name}`}>
          <Text style={{ fontSize: 22 }}>📞</Text>
        </Pressable>
      }
    >
      <View style={{ flex: 1 }}>
        <FlatList
          ref={list}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.list}
          onContentSizeChange={() => list.current?.scrollToEnd({ animated: true })}
          ListHeaderComponent={
            <View style={styles.head}>
              <Avatar emoji={contact.avatar} color={contact.color} size={64} />
              <Text style={styles.headName}>{contact.name}</Text>
              <Text style={styles.headNum}>{contact.number}</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={[styles.bubble, item.from === 'me' ? styles.me : styles.them]}>
              <Text style={styles.bubbleText}>{item.text}</Text>
              <Text style={styles.bubbleTime}>{clock(item.at)}</Text>
            </View>
          )}
          ListFooterComponent={typing[contact.id] ? <TypingDots /> : undefined}
        />
        <View style={styles.quick}>
          {QUICK.map((q) => (
            <Pressable key={q} style={styles.chip} onPress={() => send(q)}>
              <Text style={styles.chipText}>{q}</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.inputRow}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Message"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            onSubmitEditing={() => send(text)}
            returnKeyType="send"
            maxLength={300}
          />
          <Pressable onPress={() => send(text)} disabled={!text.trim()} style={[styles.send, { opacity: text.trim() ? 1 : 0.4 }]} accessibilityLabel="Envoyer">
            <Text style={styles.sendText}>↑</Text>
          </Pressable>
        </View>
      </View>
    </AppScreen>
  );
}

function TypingDots() {
  const [n, setN] = useState(1);
  useEffect(() => {
    const t = setInterval(() => setN((x) => (x % 3) + 1), 350);
    return () => clearInterval(t);
  }, []);
  return (
    <View style={[styles.bubble, styles.them, { paddingVertical: 12 }]}>
      <Text style={[styles.bubbleText, { letterSpacing: 3 }]}>{'•'.repeat(n).padEnd(3, ' ')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: 40 },
  list: { padding: 12, gap: 6 },
  head: { alignItems: 'center', paddingVertical: 16, gap: 4 },
  headName: { color: colors.text, fontWeight: '700', fontSize: 17, marginTop: 6 },
  headNum: { color: colors.textMuted, fontSize: 13 },
  bubble: { maxWidth: '80%', paddingHorizontal: 13, paddingVertical: 8, borderRadius: 18 },
  me: { alignSelf: 'flex-end', backgroundColor: colors.bubbleMe, borderBottomRightRadius: 5 },
  them: { alignSelf: 'flex-start', backgroundColor: colors.bubbleThem, borderBottomLeftRadius: 5 },
  bubbleText: { color: '#fff', fontSize: 15, lineHeight: 20 },
  bubbleTime: { color: 'rgba(255,255,255,0.6)', fontSize: 10, alignSelf: 'flex-end', marginTop: 2 },
  quick: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 10, paddingTop: 6 },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  chipText: { color: colors.text, fontSize: 13 },
  inputRow: { flexDirection: 'row', gap: 8, padding: 10, alignItems: 'center' },
  input: { flex: 1, color: colors.text, backgroundColor: colors.surface, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 15, borderWidth: 1, borderColor: colors.border },
  send: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.pink, alignItems: 'center', justifyContent: 'center' },
  sendText: { color: '#fff', fontSize: 20, fontWeight: '800' },
});
