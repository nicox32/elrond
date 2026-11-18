import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { AmountInput } from '../../components/AmountInput';
import { MetalPicker } from '../../components/MetalPicker';
import { PinConfirm } from '../../components/PinConfirm';
import { Segmented } from '../../components/Segmented';
import { SpeedPicker } from '../../components/SpeedPicker';
import { FEES, type SaleSpeed } from '../../logic/fees';
import { Button, Card, Hint, Label, Message, Screen, SectionTitle, styles as ui, Title } from '../../components/ui';
import { formatEur, formatQty, formatWeight, parseAmount } from '../../logic/format';
import {
  addBeneficiary,
  LedgerError,
  METAL_OF,
  removeBeneficiary,
  isForeignIban,
  MEMBER_TRANSFER_LIMIT,
  memberTransferRoom,
  quoteSale,
  toGrams,
  transferToIban,
} from '../../logic/ledger';
import type { AmountUnit, Beneficiary, BeneficiaryKind, Metal } from '../../logic/types';
import { useAccount, useBank } from '../../state/BankProvider';
import { describeTax } from '../../logic/tax';
import { colors } from '../../theme';
import { MemberQr } from '../../components/MemberQr';
import { QrCode } from '../../components/QrCode';
import { ScanQr } from '../../components/ScanQr';
import { parseMemberQr } from '../../logic/memberQr';
import { receiveTicket, sendBarToMember, sendMetalToMember } from '../../logic/memberTicket';
import { isLocked, productOf } from '../../logic/physical';

export default function TransfersScreen() {
  const account = useAccount();
  const { quote, commit } = useBank();
  const unit = account.settings.unit;

  const [kind, setKind] = useState<BeneficiaryKind>('member');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newIdentifier, setNewIdentifier] = useState('');
  const [metal, setMetal] = useState<Metal>('gold');
  const [amountUnit, setAmountUnit] = useState<AmountUnit>('g');
  const [text, setText] = useState('');
  const [speed, setSpeed] = useState<SaleSpeed>('deferred');
  const [confirming, setConfirming] = useState(false);
  // Scanner ouvert (destinataire ou virement reçu) et bon de virement à montrer au destinataire.
  const [scanning, setScanning] = useState<'recipient' | 'ticket' | null>(null);
  const [ticket, setTicket] = useState<{ text: string; label: string } | null>(null);
  const [barToSend, setBarToSend] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const list = account.beneficiaries.filter((b) => b.kind === kind);
  const selected = list.find((b) => b.id === selectedId) ?? null;

  function changeKind(next: BeneficiaryKind) {
    setKind(next);
    setSelectedId(null);
    setAdding(false);
    setMessage(null);
    setAmountUnit(next === 'member' ? 'g' : 'eur');
  }

  const value = parseAmount(text);
  const valid = Number.isFinite(value) && value > 0;
  // Membre : le métal change de main au cours réel, sans frais. IBAN : le métal est vendu (frais de revente).
  const abroad = kind === 'iban' && !!selected && isForeignIban(selected.identifier);
  const sale =
    valid && kind === 'iban'
      ? quoteSale(quote.prices, metal, { unit: amountUnit, value }, speed, abroad, account)
      : null;
  const room = memberTransferRoom(account);
  const sendableBars = (account.homeVault ?? []).filter(
    (b) => b.status === 'received' && !b.vault && !b.ownerChildId && !isLocked(b),
  );
  const grams = !valid ? 0 : sale ? sale.grams : toGrams({ unit: amountUnit, value }, quote.prices[metal]);

  const summary =
    !selected || grams <= 0
      ? ''
      : kind === 'member'
        ? `Envoyer ${formatQty(metal, grams, unit)} (${formatEur(grams * quote.prices[metal])}) à ${selected.name}, gratuitement. Pas une vente : pas d’impôt sur la plus-value (un don suit les règles des donations).`
        : `Vendre ${formatQty(metal, grams, unit)} : ${selected.name} reçoit ${formatEur(sale?.received ?? 0)} (${selected.identifier}), après ${formatEur(sale?.fees ?? 0)} de frais${abroad ? `, dont ${FEES.saleAbroadFixed} € pour un compte à l’étranger` : ''}. ${sale?.tax ? describeTax(sale.tax) : ''}`;

  function saveBeneficiary() {
    try {
      let created: Beneficiary | null = null;
      commit((acc) => {
        const r = addBeneficiary(acc, kind, newName, newIdentifier);
        created = r.beneficiary;
        return r.account;
      });
      if (created) setSelectedId((created as Beneficiary).id);
      setAdding(false);
      setNewName('');
      setNewIdentifier('');
      setMessage(null);
    } catch (e) {
      setMessage({ ok: false, text: e instanceof LedgerError ? e.message : 'Une erreur est survenue.' });
    }
  }

  function startTransfer() {
    setMessage(null);
    if (!selected) return setMessage({ ok: false, text: 'Choisissez un bénéficiaire.' });
    if (grams <= 0) return setMessage({ ok: false, text: 'Indiquez un montant.' });
    if (sale && sale.received <= 0) {
      return setMessage({ ok: false, text: 'Montant trop faible pour couvrir les frais du virement.' });
    }
    if (grams > account.holdings[metal] + 1e-9) {
      return setMessage({ ok: false, text: `Solde ${METAL_OF[metal]} insuffisant.` });
    }
    if (kind === 'member' && grams * quote.prices[metal] > room.left + 0.005) {
      return setMessage({
        ok: false,
        text: `Limite de ${MEMBER_TRANSFER_LIMIT.eur} € de virements à des membres sur ${MEMBER_TRANSFER_LIMIT.days} jours glissants : il vous reste ${formatEur(room.left)}${room.freeAt && room.left < MEMBER_TRANSFER_LIMIT.eur ? `, et de la place se libère le ${room.freeAt.toLocaleDateString('fr-FR')}` : ''}.`,
      });
    }
    setConfirming(true);
  }

  function execute() {
    setConfirming(false);
    if (!selected) return;
    const q = { unit: amountUnit, value };
    try {
      let bon = '';
      commit((acc, p) => {
        if (kind !== 'member') return transferToIban(acc, p, metal, q, selected, speed);
        const r = sendMetalToMember(acc, p, metal, q, selected);
        bon = r.ticket;
        return r.account;
      });
      setText('');
      if (bon) setTicket({ text: bon, label: `${formatQty(metal, grams, unit)} pour ${selected.name}` });
      setMessage({
        ok: true,
        text:
          kind === 'member'
            ? `Débité. Faites scanner le QR code ci-dessous à ${selected.name} pour qu’il reçoive le virement.`
            : `Virement envoyé à ${selected.name}.`,
      });
    } catch (e) {
      setMessage({ ok: false, text: e instanceof LedgerError ? e.message : 'Une erreur est survenue.' });
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen testID="screen-virements">
        <Title>Virements</Title>

        <Card style={{ gap: 6 }}>
          <Label>Pour recevoir du métal ou des euros</Label>
          <Info label="Mon n° de membre" value={account.memberId} />
          <MemberQr memberNumber={account.memberId} />
          <Info label="Mon IBAN" value={account.iban} />
        </Card>

        <Hint>
          Virements à un membre (dons, par exemple) : {MEMBER_TRANSFER_LIMIT.eur} € maximum sur{' '}
          {MEMBER_TRANSFER_LIMIT.days} jours glissants. Il vous reste {formatEur(room.left)}.
        </Hint>
        <Segmented
          value={kind}
          onChange={changeKind}
          options={[
            { value: 'member', label: 'À un membre' },
            { value: 'iban', label: 'Vers un IBAN' },
          ]}
        />
        <Hint>
          {kind === 'member'
            ? 'Échange de métal : il passe directement de votre coffre à celui du membre, immédiat et sans frais.'
            : `Le métal est vendu au cours du moment, puis les euros partent par virement SEPA. Frais : ${(FEES.sale * 100).toLocaleString('fr-FR')}\u00a0% (+ ${FEES.saleAbroadFixed}\u00a0€ vers un compte hors de France).`}
        </Hint>

        {ticket && (
          <Card style={{ gap: 8, alignItems: 'center' }}>
            <Text style={ui.hint}>Virement : {ticket.label}</Text>
            <QrCode value={ticket.text} size={260} />
            <Hint>
              Le destinataire ouvre « Virements » dans son appli, appuie sur « Scanner un virement reçu » et lit ce QR
              code. Il ne peut être encaissé qu’une seule fois.
            </Hint>
            <Button
              title="Copier le texte du bon (si le scan ne marche pas)"
              variant="ghost"
              onPress={() => Clipboard.setStringAsync(ticket.text)}
            />
            <Button title="Terminé" variant="ghost" onPress={() => setTicket(null)} />
          </Card>
        )}
        {kind === 'member' && !scanning && (
          <>
            <Button title="Scanner le QR code d’un membre" variant="ghost" onPress={() => setScanning('recipient')} />
            <Button title="Scanner un virement reçu" variant="ghost" onPress={() => setScanning('ticket')} />
          </>
        )}
        {scanning === 'recipient' && (
          <ScanQr
            title="QR code du membre"
            hint="Demandez au destinataire d’afficher son QR code (Profil, « Afficher le QR code »)."
            onClose={() => setScanning(null)}
            onScan={(text) => {
              setScanning(null);
              const number = parseMemberQr(text);
              if (!number) return setMessage({ ok: false, text: 'Ce QR code n’est pas un numéro de membre Orvia.' });
              try {
                const r = addBeneficiary(account, 'member', `Membre ${number}`, number);
                if (r.account !== account) commit(() => r.account);
                setSelectedId(r.beneficiary.id);
                setMessage({ ok: true, text: `${r.beneficiary.name} est le destinataire. Indiquez le montant.` });
              } catch (e) {
                setMessage({ ok: false, text: e instanceof LedgerError ? e.message : 'Une erreur est survenue.' });
              }
            }}
          />
        )}
        {scanning === 'ticket' && (
          <ScanQr
            title="Virement reçu"
            hint="Scannez le QR code affiché par l’expéditeur après son envoi."
            onClose={() => setScanning(null)}
            onScan={(text) => {
              setScanning(null);
              try {
                let summary = '';
                commit((acc, p) => {
                  const r = receiveTicket(acc, p, text);
                  summary = r.summary;
                  return r.account;
                });
                setMessage({ ok: true, text: `Virement encaissé : ${summary}` });
              } catch (e) {
                setMessage({ ok: false, text: e instanceof LedgerError ? e.message : 'Une erreur est survenue.' });
              }
            }}
          />
        )}

        <SectionTitle
          right={
            !adding ? (
              <Pressable onPress={() => setAdding(true)}>
                <Text style={ui.link}>+ Ajouter</Text>
              </Pressable>
            ) : undefined
          }
        >
          Bénéficiaire
        </SectionTitle>

        {adding && (
          <Card style={{ gap: 10 }}>
            <TextInput
              value={newName}
              onChangeText={setNewName}
              placeholder="Nom"
              placeholderTextColor={colors.textMuted}
              style={ui.input}
            />
            <TextInput
              value={newIdentifier}
              onChangeText={setNewIdentifier}
              placeholder={kind === 'member' ? 'Identifiant, e-mail ou téléphone du membre' : 'IBAN (FR76 …)'}
              placeholderTextColor={colors.textMuted}
              autoCapitalize={kind === 'iban' ? 'characters' : 'none'}
              autoCorrect={false}
              style={ui.input}
            />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Button title="Annuler" variant="ghost" onPress={() => setAdding(false)} />
              </View>
              <View style={{ flex: 1 }}>
                <Button title="Enregistrer" onPress={saveBeneficiary} />
              </View>
            </View>
          </Card>
        )}

        {list.length === 0 && !adding ? (
          <Hint>Aucun bénéficiaire pour l’instant. Ajoutes-en un pour faire un virement.</Hint>
        ) : (
          list.map((b) => {
            const active = b.id === selectedId;
            return (
              <Pressable
                key={b.id}
                onPress={() => setSelectedId(b.id)}
                onLongPress={() =>
                  Alert.alert('Supprimer ce bénéficiaire ?', b.name, [
                    { text: 'Annuler', style: 'cancel' },
                    {
                      text: 'Supprimer',
                      style: 'destructive',
                      onPress: () => {
                        if (selectedId === b.id) setSelectedId(null);
                        commit((acc) => removeBeneficiary(acc, b.id));
                      },
                    },
                  ])
                }
                style={[styles.beneficiary, active && styles.beneficiaryActive]}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityHint="Appui long pour supprimer"
              >
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{b.name.slice(0, 1).toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.bName}>{b.name}</Text>
                  <Text style={styles.bId} numberOfLines={1}>
                    {b.identifier}
                  </Text>
                </View>
                {active && <Text style={styles.check}>✓</Text>}
              </Pressable>
            );
          })
        )}
        {list.length > 0 && <Hint>Appui long sur un bénéficiaire pour le supprimer.</Hint>}

        <View style={styles.block}>
          <Label>Métal débité</Label>
          <MetalPicker value={metal} onChange={setMetal} />
          <Hint>Disponible : {formatWeight(account.holdings[metal], unit, metal)}</Hint>
        </View>

        {kind === 'iban' && <SpeedPicker value={speed} onChange={setSpeed} />}

        <View style={styles.block}>
          <Label>{kind === 'iban' ? 'Montant (en euros : montant reçu par le bénéficiaire)' : 'Montant'}</Label>
          <AmountInput
            text={text}
            onChangeText={setText}
            unit={amountUnit}
            onUnitChange={setAmountUnit}
            metal={metal}
          />
        </View>

        {summary ? <Text style={styles.preview}>{summary}</Text> : null}
        <Button title="Continuer" onPress={startTransfer} />
        {message && <Message {...message} />}

        {kind === 'member' && sendableBars.length > 0 && (
          <>
            <SectionTitle>Envoyer un lingotin ou une pièce</SectionTitle>
            <Card style={{ gap: 8 }}>
              {sendableBars.map((b) => (
                <View key={b.id} style={{ gap: 4 }} testID={`send-bar-${b.id}`}>
                  <Text style={styles.preview}>
                    {productOf(b.product).label}
                    {b.serial ? ` · n° ${b.serial}` : ''} · ≈ {formatEur(b.grams * quote.prices.gold)}
                  </Text>
                  <Button
                    title={selected ? `Envoyer à ${selected.name}` : 'Choisissez d’abord un destinataire'}
                    variant="ghost"
                    disabled={!selected}
                    onPress={() => setBarToSend(b.id)}
                  />
                </View>
              ))}
              <Hint>
                Le lingotin quitte votre coffre maison ; le destinataire le reçoit en scannant le QR code qui
                s’affichera. Même limite de {MEMBER_TRANSFER_LIMIT.eur} € sur {MEMBER_TRANSFER_LIMIT.days} jours.
              </Hint>
            </Card>
          </>
        )}

        <PinConfirm visible={confirming} summary={summary} onConfirm={execute} onCancel={() => setConfirming(false)} />
        <PinConfirm
          visible={!!barToSend}
          summary={
            barToSend && selected
              ? `Envoyer ${productOf(account.homeVault?.find((b) => b.id === barToSend)?.product ?? 'g5').label.toLowerCase()} à ${selected.name}, gratuitement. Il quitte votre coffre maison.`
              : ''
          }
          onConfirm={() => {
            const id = barToSend;
            setBarToSend(null);
            if (!id || !selected) return;
            try {
              let bon = '';
              commit((acc, p) => {
                const r = sendBarToMember(acc, p, id, selected);
                bon = r.ticket;
                return r.account;
              });
              setTicket({ text: bon, label: `lingotin pour ${selected.name}` });
              setMessage({
                ok: true,
                text: `Envoyé. Faites scanner le QR code à ${selected.name} pour qu’il reçoive le lingotin.`,
              });
            } catch (e) {
              setMessage({ ok: false, text: e instanceof LedgerError ? e.message : 'Une erreur est survenue.' });
            }
          }}
          onCancel={() => setBarToSend(null)}
        />
      </Screen>
    </KeyboardAvoidingView>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <View>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} selectable>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: 8 },
  infoLabel: { color: colors.textMuted, fontSize: 11 },
  infoValue: { color: colors.text, fontSize: 15, fontWeight: '600', letterSpacing: 0.3 },
  beneficiary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  beneficiaryActive: { borderColor: colors.gold, backgroundColor: colors.surfaceAlt },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.goldSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.gold, fontWeight: '800', fontSize: 15 },
  bName: { color: colors.text, fontSize: 15, fontWeight: '600' },
  bId: { color: colors.textMuted, fontSize: 12 },
  check: { color: colors.gold, fontSize: 18, fontWeight: '800' },
  preview: {
    color: colors.text,
    backgroundColor: colors.goldSoft,
    padding: 12,
    borderRadius: 12,
    fontSize: 14,
    lineHeight: 20,
  },
});
