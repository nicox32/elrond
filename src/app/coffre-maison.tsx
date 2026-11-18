import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { PlaceEditor } from '../components/PlaceEditor';
import { ResellerStorageCard } from '../components/ResellerStorageCard';
import { Button, Card, Hint, Message, Screen, styles as ui } from '../components/ui';
import { formatDate, formatEur, formatWeight } from '../logic/format';
import { LedgerError } from '../logic/ledger';
import { controlledOn } from '../logic/barControl';
import { barQrText, exemptYear, homeVaultHtml } from '../logic/homeVaultDoc';
import {
  type BarPlace,
  fabricationProgress,
  homeVaultTotal,
  isLocked,
  placeLabel,
  productOf,
  receiveBar,
  removeBar,
  setBarPlace,
  specLine,
} from '../logic/physical';
import { exportPdf } from '../pdf';
import { BarFabrication } from '../components/BarFabrication';
import { BarImage } from '../components/BarImage';
import { QrCode } from '../components/QrCode';
import type { HomeBar } from '../logic/types';
import { useAccount, useBank } from '../state/BankProvider';
import { colors, metalColor } from '../theme';

/** Mon coffre maison : les lingotins retirés d'Orvia, avec leur numéro de série. */
export default function HomeVaultScreen() {
  const account = useAccount();
  const { quote, updateAccount } = useBank();
  const bars = account.homeVault ?? [];
  const total = homeVaultTotal(account, quote.prices);

  return (
    <Screen testID="screen-coffre-maison">
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={styles.big}>{formatWeight(total.grams, 'g', 'gold')}</Text>
          <Text style={styles.sub}>
            {total.count} lingotin{total.count > 1 ? 's' : ''} · ≈ {formatEur(total.value)} au cours de l’or (hors frais
            du comptoir à la revente)
          </Text>
        </View>
      </Card>
      <ResellerStorageCard />
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
            goldPrice={quote.prices.gold}
            owner={b.ownerChildId ? account.children.find((c) => c.id === b.ownerChildId)?.name : undefined}
            onReceive={(serial) => updateAccount((a) => receiveBar(a, b.id, serial))}
            onRemove={() => updateAccount((a) => removeBar(a, b.id))}
            onPlace={(place, note) => updateAccount((a) => setBarPlace(a, b.id, place, note))}
          />
        ))
      )}
      {bars.length > 0 && (
        <Button
          title="Inventaire imprimable (PDF, avec QR codes)"
          variant="ghost"
          onPress={() => exportPdf(homeVaultHtml(account, quote.prices), 'Inventaire du coffre maison')}
        />
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

function BarCard({
  bar,
  owner,
  goldPrice,
  onReceive,
  onRemove,
  onPlace,
}: {
  bar: HomeBar;
  owner?: string;
  goldPrice: number;
  onReceive: (s: string) => void;
  onRemove: () => void;
  onPlace: (place: BarPlace, note?: string) => void;
}) {
  const [serial, setSerial] = useState(bar.serial ?? '');
  const [showQr, setShowQr] = useState(false);
  const [pickedUp, setPickedUp] = useState(false);
  const waitingAgency = bar.status === 'preparing' && !!bar.pickupAgency && !pickedUp && !bar.serial;
  const readyAtAgency = fabricationProgress(bar.orderedAt, new Date(), true).step >= 3;
  const arrived = bar.status === 'preparing' && readyAtAgency;
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const p = productOf(bar.product);
  const gain = bar.grams * goldPrice - bar.cost;
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
        <BarImage product={bar.product} size={46} />
        <Text style={[styles.name, { flex: 1, marginLeft: 10 }]}>{p.label}</Text>
        <Text style={[styles.badge, bar.status === 'received' || arrived ? styles.ok : styles.wait]}>
          {bar.status === 'received'
            ? 'Reçu'
            : arrived
              ? bar.pickupAgency
                ? 'Prêt en agence'
                : 'Arrivé'
              : 'En préparation'}
        </Text>
      </View>
      {bar.status === 'preparing' && <BarFabrication orderedAt={bar.orderedAt} pickup={!!bar.pickupAgency} />}
      {isLocked(bar) ? (
        <Text style={styles.controlled} testID={`bar-lock-${bar.id}`}>
          🔒 Sécurité maximale : verrouillé jusqu’au {new Date(bar.lockedUntil!).toLocaleDateString('fr-FR')} ·{' '}
          {placeLabel(bar)}
        </Text>
      ) : bar.status === 'received' ? (
        <PlaceEditor bar={bar} onChange={onPlace} title="Où il est gardé" />
      ) : null}
      {owner || bar.ownerChildId ? (
        <Text style={styles.controlled} testID="bar-owner">
          Appartient à {owner ?? 'un enfant'} (don du {bar.giftedAt ? formatDate(bar.giftedAt) : ''})
        </Text>
      ) : null}
      {specLine(p.spec) ? (
        <Text style={styles.sub}>
          {specLine(p.spec)}
          {p.spec?.veriscan ? ' · vérifiable avec VERISCAN' : ''}
        </Text>
      ) : null}
      <Text style={styles.sub}>
        Commandé le {formatDate(bar.orderedAt)}
        {bar.receivedAt ? ` · reçu le ${formatDate(bar.receivedAt)}` : ''}
      </Text>
      <Text style={styles.sub}>
        Or acheté entre le {new Date(bar.acquiredFrom).toLocaleDateString('fr-FR')} et le{' '}
        {new Date(bar.acquiredTo).toLocaleDateString('fr-FR')} · prix de revient {formatEur(bar.cost)} · exonéré de
        plus-value en {exemptYear(bar)}
      </Text>
      <Text
        style={[styles.sub, { color: gain >= 0 ? colors.up : colors.down, fontWeight: '700' }]}
        testID={`bar-gain-${bar.id}`}
      >
        {gain >= 0 ? 'Plus-value latente' : 'Moins-value latente'} de l’or : {gain >= 0 ? '+' : '−'}
        {formatEur(Math.abs(gain))}{' '}
        <Text style={{ color: colors.textMuted, fontWeight: '400' }}>(sans prime ni frais)</Text>
      </Text>
      {controlledOn(bar) ? (
        <Text style={styles.controlled} testID="controlled">
          ✓ Contrôlé par Orvia le {formatDate(controlledOn(bar)!)}
        </Text>
      ) : null}
      {bar.ref ? (
        <Text style={styles.serial} testID={`bar-ref-${bar.id}`}>
          Réf. interne Orvia : {bar.ref}
        </Text>
      ) : null}
      {bar.serial ? (
        <Text style={styles.serial}>
          {p.coin ? 'Millésime' : 'N° de série'} : {bar.serial}
        </Text>
      ) : waitingAgency ? (
        <View style={{ gap: 6 }}>
          <Button
            title={`Retirer en agence (${bar.pickupAgency})`}
            onPress={() => setPickedUp(true)}
            disabled={!readyAtAgency}
          />
          <Text style={styles.sub} testID={`bar-agency-hint-${bar.id}`}>
            {readyAtAgency
              ? 'Prêt à l’agence : apportez une pièce d’identité et signez le bon de remise, puis appuyez ici pour noter le numéro de série.'
              : 'Disponible dès que le lingotin est prêt à l’agence (suivi estimé ci-dessus).'}
          </Text>
        </View>
      ) : (
        <View style={{ gap: 6 }}>
          <TextInput
            value={serial}
            onChangeText={(t) => {
              setSerial(t);
              setMsg(null);
            }}
            placeholder={p.coin ? 'Millésime de la pièce (ex. 1910)' : 'N° gravé sur le lingotin (ex. C841201)'}
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
      <Pressable onPress={() => setShowQr((v) => !v)} accessibilityRole="button" testID={`qr-toggle-${bar.id}`}>
        <Text style={ui.link}>{showQr ? 'Masquer le QR code' : 'Afficher le QR code de la fiche'}</Text>
      </Pressable>
      {showQr && (
        <View style={styles.qr} testID="bar-qr">
          <QrCode value={barQrText(bar, owner)} size={200} />
          <Text style={styles.sub}>
            Se lit avec n’importe quel téléphone : objet, {p.coin ? 'millésime' : 'numéro de série'}, dates, prix de
            revient. À imprimer et ranger avec le certificat. Fiche d’inventaire, pas un certificat d’authenticité.
          </Text>
        </View>
      )}
      {!bar.ownerChildId && (
        <Pressable onPress={confirmRemove} accessibilityRole="button">
          <Text style={styles.remove}>Revendu ou donné : retirer du registre</Text>
        </Pressable>
      )}
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
  controlled: { color: colors.up, fontSize: 13, fontWeight: '700' },
  qr: { alignItems: 'center', gap: 8, paddingVertical: 6 },
  remove: { color: colors.textMuted, fontSize: 12.5, textDecorationLine: 'underline' },
});
