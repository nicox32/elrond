import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button, Card, Hint, Message, Screen, styles as ui } from '../components/ui';
import { formatDate, formatEur, formatWeight } from '../logic/format';
import { LedgerError } from '../logic/ledger';
import { homeVaultTotal, productOf, receiveBar, removeBar } from '../logic/physical';
import type { HomeBar } from '../logic/types';
import { useAccount, useBank } from '../state/BankProvider';
import { colors, metalColor } from '../theme';

const exemptYear = (b: HomeBar) => new Date(b.acquiredTo).getFullYear() + 22;

/** Mon coffre maison : les lingotins retirés d'Orvia, avec leur numéro de série. */
export default function HomeVaultScreen() {
  const account = useAccount();
  const { quote, updateAccount } = useBank();
  const bars = account.homeVault ?? [];
  const total = homeVaultTotal(account, quote.prices);

  return (
    <Screen testID="screen-coffre-maison">
      <Card style={{ gap: 4 }}>
        <Text style={styles.big}>{formatWeight(total.grams, 'g', 'gold')}</Text>
        <Text style={styles.sub}>
          {total.count} lingotin{total.count > 1 ? 's' : ''} · ≈ {formatEur(total.value)} au cours de l’or (hors frais
          du comptoir à la revente)
        </Text>
      </Card>
      {bars.length === 0 ? (
        <Card style={{ gap: 10 }}>
          <Text style={styles.para}>Aucun lingotin chez vous pour l’instant.</Text>
          <Button title="Retirer de l’or en lingotins" onPress={() => router.push('/retrait')} />
        </Card>
      ) : (
        bars.map((b) => (
          <BarCard
            key={b.id}
            bar={b}
            onReceive={(serial) => updateAccount((a) => receiveBar(a, b.id, serial))}
            onRemove={() => updateAccount((a) => removeBar(a, b.id))}
          />
        ))
      )}
      <Hint>
        Gardez le certificat avec chaque lingotin. Le prix et les dates d’achat d’origine servent à l’impôt si vous le
        revendez chez un comptoir : la durée de détention de l’or continue depuis son achat chez Orvia.
      </Hint>
      {bars.length > 0 && (
        <Pressable onPress={() => router.push('/retrait')} accessibilityRole="link">
          <Text style={ui.link}>Retirer d’autres lingotins ›</Text>
        </Pressable>
      )}
    </Screen>
  );
}

function BarCard({ bar, onReceive, onRemove }: { bar: HomeBar; onReceive: (s: string) => void; onRemove: () => void }) {
  const [serial, setSerial] = useState(bar.serial ?? '');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const p = productOf(bar.product);
  const confirmRemove = () => {
    const text = 'Retirer ce lingotin du registre (revendu ou donné en dehors d’Orvia) ?';
    if (Platform.OS === 'web') {
      if (window.confirm(text)) onRemove();
    } else
      Alert.alert('Retirer du registre', text, [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Retirer', style: 'destructive', onPress: onRemove },
      ]);
  };
  return (
    <Card style={{ gap: 6, borderColor: bar.status === 'received' ? metalColor.gold : colors.border }}>
      <View style={styles.head}>
        <Text style={styles.name}>{p.label}</Text>
        <Text style={[styles.badge, bar.status === 'received' ? styles.ok : styles.wait]}>
          {bar.status === 'received' ? 'Reçu' : 'En préparation'}
        </Text>
      </View>
      <Text style={styles.sub}>
        Commandé le {formatDate(bar.orderedAt)}
        {bar.receivedAt ? ` · reçu le ${formatDate(bar.receivedAt)}` : ''}
      </Text>
      <Text style={styles.sub}>
        Or acheté entre le {new Date(bar.acquiredFrom).toLocaleDateString('fr-FR')} et le{' '}
        {new Date(bar.acquiredTo).toLocaleDateString('fr-FR')} · prix de revient {formatEur(bar.cost)} · exonéré de
        plus-value en {exemptYear(bar)}
      </Text>
      {bar.serial ? (
        <Text style={styles.serial}>
          {p.coin ? 'Millésime' : 'N° de série'} : {bar.serial}
        </Text>
      ) : (
        <View style={{ gap: 6 }}>
          <TextInput
            value={serial}
            onChangeText={(t) => {
              setSerial(t);
              setMsg(null);
            }}
            placeholder={p.coin ? 'Millésime de la pièce (ex. 1910)' : 'Numéro de série gravé sur le lingotin'}
            placeholderTextColor={colors.textMuted}
            autoCapitalize="characters"
            style={ui.input}
            accessibilityLabel="Numéro de série"
          />
          <Button
            title={p.coin ? 'Pièce reçue' : 'Lingotin reçu'}
            onPress={() => {
              try {
                onReceive(serial);
              } catch (e) {
                setMsg({ ok: false, text: e instanceof LedgerError ? e.message : 'Impossible.' });
              }
            }}
          />
        </View>
      )}
      {msg && <Message {...msg} />}
      <Pressable onPress={confirmRemove} accessibilityRole="button">
        <Text style={styles.remove}>Revendu ou donné : retirer du registre</Text>
      </Pressable>
    </Card>
  );
}

const styles = StyleSheet.create({
  big: { color: metalColor.gold, fontSize: 26, fontWeight: '800' },
  sub: { color: colors.textMuted, fontSize: 12.5, lineHeight: 17 },
  para: { color: colors.text, fontSize: 14 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { color: colors.text, fontSize: 15, fontWeight: '800' },
  badge: {
    fontSize: 11.5,
    fontWeight: '800',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    overflow: 'hidden',
  },
  ok: { color: colors.up, backgroundColor: 'rgba(46,204,113,0.15)' },
  wait: { color: colors.warning, backgroundColor: 'rgba(241,196,15,0.15)' },
  serial: { color: colors.text, fontSize: 14, fontWeight: '700', fontVariant: ['tabular-nums'] },
  remove: { color: colors.textMuted, fontSize: 12.5, textDecorationLine: 'underline' },
});
