import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button, Card, Hint, Message, Screen, SectionTitle, styles as ui } from '../../components/ui';
import { formatEur } from '../../logic/format';
import { ChildRules } from '../../components/ChildRules';
import { childStage, type ChildStage } from '../../logic/childRules';
import { accountValue, addChild, LedgerError, parseBirthDate } from '../../logic/ledger';
import { useAccount, useBank } from '../../state/BankProvider';
import { colors } from '../../theme';

const STAGE_LABEL: Record<ChildStage, string> = {
  minor: 'Mineur · sans frais',
  adult: 'Majeur · compte à lui transférer',
  transferred: 'Compte transféré',
};

export default function ChildrenScreen() {
  const account = useAccount();
  const { quote, commit } = useBank();
  const [name, setName] = useState('');
  const [birth, setBirth] = useState('');
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  function create() {
    try {
      let id = '';
      commit((acc) => {
        const r = addChild(acc, name, parseBirthDate(birth));
        id = r.child.id;
        return r.account;
      });
      setName('');
      setBirth('');
      setMessage(null);
      router.push({ pathname: '/enfants/[id]', params: { id } });
    } catch (e) {
      setMessage({ ok: false, text: e instanceof LedgerError ? e.message : 'Une erreur est survenue.' });
    }
  }

  return (
    <Screen testID="screen-enfants">
      <Hint>
        Ouvre gratuitement un compte pour chacun de tes enfants et verse-lui de l’or, de l’argent ou du platine depuis
        ton compte, sans frais. Ce que tu verses lui appartient : c’est une épargne pour lui.
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
              {STAGE_LABEL[childStage(child)]} · ouvert le {new Date(child.createdAt).toLocaleDateString('fr-FR')}
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
        />
        <TextInput
          value={birth}
          onChangeText={(t) => {
            setBirth(t);
            setMessage(null);
          }}
          placeholder="Date de naissance (JJ/MM/AAAA)"
          placeholderTextColor={colors.textMuted}
          keyboardType="numbers-and-punctuation"
          style={ui.input}
          onSubmitEditing={create}
        />
        <ChildRules name="l’enfant" compact />
        <Button title="Ouvrir le compte (gratuit)" onPress={create} disabled={!name.trim() || !birth.trim()} />
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
