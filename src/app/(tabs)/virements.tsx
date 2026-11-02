import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { AmountInput } from '../../components/AmountInput';
import { MetalPicker } from '../../components/MetalPicker';
import { PinConfirm } from '../../components/PinConfirm';
import { Segmented } from '../../components/Segmented';
import { SpeedPicker } from '../../components/SpeedPicker';
import { FEES, type SaleSpeed } from '../../logic/fees';
import { Button, Card, Hint, Label, Message, Screen, SectionTitle, styles as ui, Title } from '../../components/ui';
import { formatEur, formatWeight, parseAmount } from '../../logic/format';
import {
  addBeneficiary,
  LedgerError,
  METAL_OF,
  removeBeneficiary,
  isForeignIban,
  quoteSale,
  toGrams,
  transferToIban,
  transferToMember,
} from '../../logic/ledger';
import type { AmountUnit, Beneficiary, BeneficiaryKind, Metal } from '../../logic/types';
import { useAccount, useBank } from '../../state/BankProvider';
import { colors } from '../../theme';

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
    valid && kind === 'iban' ? quoteSale(quote.prices, metal, { unit: amountUnit, value }, speed, abroad) : null;
  const grams = !valid ? 0 : sale ? sale.grams : toGrams({ unit: amountUnit, value }, quote.prices[metal]);

  const summary =
    !selected || grams <= 0
      ? ''
      : kind === 'member'
        ? `Envoyer ${formatWeight(grams, unit)} ${METAL_OF[metal]} (${formatEur(grams * quote.prices[metal])}) à ${selected.name}, gratuitement.`
        : `Vendre ${formatWeight(grams, unit)} ${METAL_OF[metal]} : ${selected.name} reçoit ${formatEur(sale?.received ?? 0)} (${selected.identifier}), après ${formatEur(sale?.fees ?? 0)} de frais${abroad ? `, dont ${FEES.saleAbroadFixed} € pour un compte à l’étranger` : ''}.`;

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
    if (!selected) return setMessage({ ok: false, text: 'Choisis un bénéficiaire.' });
    if (grams <= 0) return setMessage({ ok: false, text: 'Indique un montant.' });
    if (sale && sale.received <= 0) {
      return setMessage({ ok: false, text: 'Montant trop faible pour couvrir les frais du virement.' });
    }
    if (grams > account.holdings[metal] + 1e-9) {
      return setMessage({ ok: false, text: `Solde ${METAL_OF[metal]} insuffisant.` });
    }
    setConfirming(true);
  }

  function execute() {
    setConfirming(false);
    if (!selected) return;
    const q = { unit: amountUnit, value };
    try {
      commit((acc, p) =>
        kind === 'member'
          ? transferToMember(acc, p, metal, q, selected)
          : transferToIban(acc, p, metal, q, selected, speed),
      );
      setText('');
      setMessage({ ok: true, text: `Virement envoyé à ${selected.name}.` });
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
          <Info label="Mon identifiant membre" value={account.memberId} />
          <Info label="Mon IBAN" value={account.iban} />
        </Card>

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
            ? 'Le métal passe directement de ton coffre à celui du membre : immédiat et sans frais.'
            : `Le métal est vendu au cours du moment, puis les euros partent par virement SEPA. Frais : ${(FEES.sale * 100).toLocaleString('fr-FR')}\u00a0% (+ ${FEES.saleAbroadFixed}\u00a0€ vers un compte hors de France).`}
        </Hint>

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
          <Hint>Disponible : {formatWeight(account.holdings[metal], unit)}</Hint>
        </View>

        {kind === 'iban' && <SpeedPicker value={speed} onChange={setSpeed} />}

        <View style={styles.block}>
          <Label>{kind === 'iban' ? 'Montant (en euros : montant reçu par le bénéficiaire)' : 'Montant'}</Label>
          <AmountInput text={text} onChangeText={setText} unit={amountUnit} onUnitChange={setAmountUnit} />
        </View>

        {summary ? <Text style={styles.preview}>{summary}</Text> : null}
        <Button title="Continuer" onPress={startTransfer} />
        {message && <Message {...message} />}

        <PinConfirm visible={confirming} summary={summary} onConfirm={execute} onCancel={() => setConfirming(false)} />
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
