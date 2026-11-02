import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button, Card, Hint, Message, Screen, SectionTitle, styles as ui } from '../../components/ui';
import { formatEur } from '../../logic/format';
import { accountValue, addChild, LedgerError } from '../../logic/ledger';
import { useAccount, useBank } from '../../state/BankProvider';
import { colors } from '../../theme';

export default function ChildrenScreen() {
  const account = useAccount();
  const { quote, commit } = useBank();
  const [name, setName] = useState('');
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  function create() {
    try {
      let id = '';
      commit((acc) => {
        const r = addChild(acc, name);
        id = r.child.id;
        return r.account;
      });
      setName('');
      setMessage(null);
      router.push({ pathname: '/enfants/[id]', params: { id } });
    } catch (e) {
      setMessage({ ok: false, text: e instanceof LedgerError ? e.message : 'Une erreur est survenue.' });
    }
  }

  return (
    <Screen testID="screen-enfants">
      <Hint>
        Ouvre gratuitement un compte pour chacun de tes enfants. Tu y verses de l’or, de l’argent ou du platine depuis
        ton compte, sans frais, et tu peux le reprendre à tout moment.
      </Hint>

      {account.children.length > 0 && <SectionTitle>Comptes enfants</SectionTitle>}
      {account.children.map((child) => (
        <Pressable
          key={child.id}
          onPress={() => router.push({ pathname: '/enfants/[id]', params: { id: child.id } })}
          style={styles.child}
          accessibilityRole="button"
        >
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{child.name.slice(0, 1).toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{child.name}</Text>
            <Text style={styles.since}>
              Ouvert le {new Date(child.createdAt).toLocaleDateString('fr-FR')} · {child.transactions.length} opération
              {child.transactions.length > 1 ? 's' : ''}
            </Text>
          </View>
          <Text style={styles.value}>{formatEur(accountValue(child, quote.prices).total)}</Text>
          <Text style={styles.chevron}>›</Text>
        </Pressable>
      ))}

      <SectionTitle>Ouvrir un compte enfant</SectionTitle>
      <Card style={{ gap: 10 }}>
        <TextInput
          value={name}
          onChangeText={(t) => {
            setName(t);
            setMessage(null);
          }}
          placeholder="Prénom de l’enfant"
          placeholderTextColor={colors.textMuted}
          style={ui.input}
          onSubmitEditing={create}
        />
        <Button title="Ouvrir le compte (gratuit)" onPress={create} disabled={!name.trim()} />
      </Card>
      {message && <Message {...message} />}
    </Screen>
  );
}

const styles = StyleSheet.create({
  child: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.goldSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.gold, fontWeight: '800', fontSize: 16 },
  name: { color: colors.text, fontSize: 16, fontWeight: '700' },
  since: { color: colors.textMuted, fontSize: 12 },
  value: { color: colors.text, fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'] },
  chevron: { color: colors.textMuted, fontSize: 22 },
});
