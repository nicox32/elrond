import { useState } from 'react';
import { Platform, Share, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button, Card, Hint, Message, Screen, SectionTitle, styles as ui } from '../components/ui';
import { enterSponsorCode, LedgerError, REFERRAL } from '../logic/ledger';
import { useAccount, useBank } from '../state/BankProvider';
import { colors } from '../theme';

export default function ReferralScreen() {
  const account = useAccount();
  const { commit } = useBank();
  const { code, sponsorCode, bonusPaid } = account.referral;
  const [input, setInput] = useState('');
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const invite = `Rejoignez-moi sur Orvia, le compte en or, argent et platine. Avec mon code ${code}, vous recevez ${REFERRAL.bonusLou} € en or dès votre premier achat de ${REFERRAL.minFirstPurchase} €.`;

  async function share() {
    try {
      if (Platform.OS === 'web') {
        const nav = navigator as Navigator & { share?: (d: { text: string }) => Promise<void> };
        if (nav.share) await nav.share({ text: invite });
        else {
          await navigator.clipboard?.writeText(invite);
          setMessage({ ok: true, text: 'Invitation copiée : collez-la dans un message.' });
        }
      } else {
        await Share.share({ message: invite });
      }
    } catch {
      // partage annulé
    }
  }

  function submit() {
    try {
      commit((acc) => enterSponsorCode(acc, input));
      setInput('');
      setMessage({
        ok: true,
        text: `Code enregistré : ${REFERRAL.bonusLou} € en or vous seront versés à votre premier achat d’au moins ${REFERRAL.minFirstPurchase} €.`,
      });
    } catch (e) {
      setMessage({ ok: false, text: e instanceof LedgerError ? e.message : 'Une erreur est survenue.' });
    }
  }

  return (
    <Screen testID="screen-parrainage">
      <Text style={styles.title}>Parrainez vos proches</Text>
      <Text style={styles.para}>
        Partagez votre code. Votre filleul reçoit {REFERRAL.bonusLou} € en or dès son premier achat d’au moins{' '}
        {REFERRAL.minFirstPurchase} €.
      </Text>

      <Card style={styles.codeCard}>
        <Text style={styles.codeLabel}>Votre code de parrainage</Text>
        <Text style={styles.code} selectable>
          {code}
        </Text>
        <Button title="Partager mon code" onPress={share} />
      </Card>

      <SectionTitle>Vous avez été parrainé ?</SectionTitle>
      {sponsorCode ? (
        <Card style={{ gap: 4 }}>
          <Text style={styles.para}>
            Code de votre parrain : <Text style={{ fontWeight: '800' }}>{sponsorCode}</Text>
          </Text>
          <Text style={[styles.para, { color: bonusPaid ? colors.up : colors.textMuted }]}>
            {bonusPaid
              ? `Bonus de ${REFERRAL.bonusLou} € en or versé sur votre compte.`
              : `Votre bonus de ${REFERRAL.bonusLou} € en or arrivera à votre premier achat d’au moins ${REFERRAL.minFirstPurchase} €.`}
          </Text>
        </Card>
      ) : (
        <Card style={{ gap: 10 }}>
          <TextInput
            value={input}
            onChangeText={(t) => {
              setInput(t);
              setMessage(null);
            }}
            placeholder="ORVIA-XXXXXX"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="characters"
            autoCorrect={false}
            style={ui.input}
            onSubmitEditing={submit}
          />
          <Button title="Valider le code" variant="ghost" onPress={submit} disabled={!input.trim()} />
        </Card>
      )}
      {message && <Message {...message} />}

      <View style={{ gap: 6 }}>
        <Hint>
          Le bonus compte comme une opération : il évite les frais d’oxydation. Un seul code de parrain par compte.
        </Hint>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.text, fontSize: 24, fontWeight: '800' },
  para: { color: colors.text, fontSize: 15, lineHeight: 22 },
  codeCard: { gap: 10, alignItems: 'stretch', borderColor: colors.gold },
  codeLabel: { color: colors.textMuted, fontSize: 13, textAlign: 'center' },
  code: { color: colors.gold, fontSize: 28, fontWeight: '800', letterSpacing: 2, textAlign: 'center' },
});
