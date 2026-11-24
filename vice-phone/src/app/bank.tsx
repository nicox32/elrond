import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { AppScreen, Avatar, Button } from '../components/phone';
import { ago, money } from '../logic/format';
import { knownContacts, useNow, usePhone } from '../state/PhoneProvider';
import { colors } from '../theme';

export default function Bank() {
  const { state, transfer } = usePhone();
  const now = useNow(30_000);
  const [to, setTo] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [info, setInfo] = useState<string | null>(null);
  const value = Number(amount.replace(',', '.'));
  const valid = to !== null && value > 0 && value <= state.balance;

  const send = () => {
    if (!to || !valid) return;
    if (transfer(to, Math.round(value))) {
      setInfo(`Virement de ${money(Math.round(value))} envoyé.`);
      setAmount('');
      setTo(null);
    }
  };

  return (
    <AppScreen title="Banque Flamant" color="#FF8FB1">
      <FlatList
        data={state.transactions}
        keyExtractor={(t) => t.id}
        contentContainerStyle={{ padding: 14, gap: 4 }}
        ListHeaderComponent={
          <View style={{ gap: 14, marginBottom: 10 }}>
            <LinearGradient colors={['#FF8FB1', '#8A4DFF']} style={styles.card} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
              <Text style={styles.cardBank}>🦩 BANQUE FLAMANT</Text>
              <Text style={styles.cardLabel}>Solde disponible</Text>
              <Text style={styles.cardBalance}>{money(state.balance)}</Text>
              <Text style={styles.cardHolder}>{state.name.toUpperCase()} · •••• 4207</Text>
            </LinearGradient>

            <View style={styles.box}>
              <Text style={styles.boxTitle}>Faire un virement</Text>
              <View style={styles.contacts}>
                {knownContacts(state).map((c) => (
                  <Pressable key={c.id} onPress={() => setTo(c.id)} style={[styles.contact, to === c.id && { borderColor: c.color, backgroundColor: `${c.color}22` }]}>
                    <Avatar name={c.name} color={c.color} size={36} />
                    <Text style={styles.contactName} numberOfLines={1}>
                      {c.name.split(' ')[0]}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <TextInput
                value={amount}
                onChangeText={(t) => {
                  setAmount(t.replace(/[^0-9,.]/g, ''));
                  setInfo(null);
                }}
                placeholder="Montant en $"
                placeholderTextColor={colors.textMuted}
                keyboardType="numeric"
                style={styles.input}
              />
              {value > state.balance && <Text style={styles.error}>Solde insuffisant.</Text>}
              {info && <Text style={styles.ok}>{info}</Text>}
              <Button label="Envoyer" onPress={send} disabled={!valid} color="#C2447A" />
            </View>
            <Text style={styles.boxTitle}>Opérations</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.tx}>
            <View style={{ flex: 1 }}>
              <Text style={styles.txLabel}>{item.label}</Text>
              <Text style={styles.txDate}>{ago(item.at, now)}</Text>
            </View>
            <Text style={[styles.txAmount, { color: item.amount >= 0 ? colors.green : colors.text }]}>{money(item.amount, true)}</Text>
          </View>
        )}
      />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 22, padding: 20, gap: 4 },
  cardBank: { color: '#fff', fontWeight: '800', letterSpacing: 1.5, fontSize: 13 },
  cardLabel: { color: 'rgba(255,255,255,0.8)', marginTop: 18 },
  cardBalance: { color: '#fff', fontSize: 38, fontWeight: '800' },
  cardHolder: { color: 'rgba(255,255,255,0.85)', marginTop: 14, letterSpacing: 1 },
  box: { backgroundColor: colors.surface, borderRadius: 18, padding: 14, gap: 12 },
  boxTitle: { color: colors.text, fontSize: 17, fontWeight: '700' },
  contacts: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  contact: { width: '31%', flexGrow: 1, alignItems: 'center', gap: 4, padding: 8, borderRadius: 14, borderWidth: 1.5, borderColor: 'transparent' },
  contactName: { color: colors.text, fontSize: 12 },
  input: { color: colors.text, backgroundColor: colors.surfaceAlt, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 18 },
  error: { color: colors.red },
  ok: { color: colors.green },
  tx: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  txLabel: { color: colors.text, fontSize: 15 },
  txDate: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  txAmount: { fontSize: 16, fontWeight: '700' },
});
