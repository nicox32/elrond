import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { AmountInput } from '../../components/AmountInput';
import { ChildGiftCard } from '../../components/ChildGiftCard';
import { ChildRules } from '../../components/ChildRules';
import { GiftRecapCard } from '../../components/GiftRecapCard';
import { CodeConfirm } from '../../components/CodeConfirm';
import { DormancyNotice } from '../../components/DormancyNotice';
import { MetalPicker } from '../../components/MetalPicker';
import { ShareViewCard } from '../../components/ShareViewCard';
import { ChildStatementCard, StatementCard } from '../../components/Statement';
import { TransactionRow } from '../../components/TransactionRow';
import { Button, Card, Hint, Label, Message, Screen, SectionTitle, styles as ui } from '../../components/ui';
import {
  approveChildWithdrawal,
  cancelDeposit,
  childStage,
  closeChildWithdrawal,
  PURPOSE_LABEL,
  requestChildWithdrawal,
  setChildParents,
  transferChildAccount,
  undoableDeposits,
} from '../../logic/childRules';
import { formatDate, formatEur, formatPercent, formatQty, formatWeight, parseAmount } from '../../logic/format';
import { estimateTax } from '../../logic/tax';
import {
  accountValue,
  fundChild,
  LedgerError,
  majorityDate,
  METAL_LABEL,
  parseBirthDate,
  removeChild,
  setChildBirthDate,
  toGrams,
} from '../../logic/ledger';
import { type AmountUnit, type ChildWithdrawalPurpose, type Metal, METALS } from '../../logic/types';
import { createSecret, isValidPinFormat, verifySecret } from '../../security';
import { useAccount, useBank } from '../../state/BankProvider';
import { colors, metalColor } from '../../theme';

type Msg = { ok: boolean; text: string } | null;
const PURPOSES = Object.keys(PURPOSE_LABEL) as ChildWithdrawalPurpose[];
const longDate = (d: Date) => d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
const errText = (e: unknown) =>
  e instanceof LedgerError || e instanceof Error ? e.message : 'Une erreur est survenue.';

export default function ChildScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const account = useAccount();
  const { quote, commit, updateAccount } = useBank();
  const unit = account.settings.unit;
  const child = account.children.find((c) => c.id === id);

  // Versement
  const [metal, setMetal] = useState<Metal>('gold');
  const [amountUnit, setAmountUnit] = useState<AmountUnit>('g');
  const [text, setText] = useState('');
  const [fundMsg, setFundMsg] = useState<Msg>(null);
  // Retrait encadré
  const [wMetal, setWMetal] = useState<Metal>('gold');
  const [wUnit, setWUnit] = useState<AmountUnit>('eur');
  const [wText, setWText] = useState('');
  const [purpose, setPurpose] = useState<ChildWithdrawalPurpose | undefined>(undefined);
  const [note, setNote] = useState('');
  const [wMsg, setWMsg] = useState<Msg>(null);
  const [approving, setApproving] = useState<string | null>(null);
  // Parents
  const [coName, setCoName] = useState('');
  const [coPin, setCoPin] = useState('');
  const [coPin2, setCoPin2] = useState('');
  const [parentMsg, setParentMsg] = useState<Msg>(null);
  const [editParents, setEditParents] = useState(false);
  // Date de naissance
  const [birth, setBirth] = useState('');
  const [birthError, setBirthError] = useState<string | null>(null);
  const [message, setMessage] = useState<Msg>(null);

  if (!child) {
    return (
      <Screen>
        <Hint>Ce compte enfant n’existe plus.</Hint>
      </Screen>
    );
  }

  const name = child.name;
  const stage = childStage(child);
  const value = accountValue(child, quote.prices);
  const tax = estimateTax(child, quote.prices);
  const amount = parseAmount(text);
  const grams =
    Number.isFinite(amount) && amount > 0 ? toGrams({ unit: amountUnit, value: amount }, quote.prices[metal]) : 0;
  const wAmount = parseAmount(wText);
  const wGrams =
    Number.isFinite(wAmount) && wAmount > 0 ? toGrams({ unit: wUnit, value: wAmount }, quote.prices[wMetal]) : 0;
  const pending = (child.withdrawalRequests ?? []).filter((r) => r.status === 'pending');
  const past = (child.withdrawalRequests ?? []).filter((r) => r.status !== 'pending').slice(0, 5);
  const undoable = undoableDeposits(child);
  const approvingReq = pending.find((r) => r.id === approving);
  const empty = METALS.every((m) => child.holdings[m] <= 1e-5);

  function fund() {
    try {
      commit((acc, p) => fundChild(acc, p, child!.id, metal, { unit: amountUnit, value: amount }));
      setText('');
      setFundMsg({ ok: true, text: `Versé sur le compte de ${name}. Ce métal lui appartient désormais.` });
    } catch (e) {
      setFundMsg({ ok: false, text: errText(e) });
    }
  }

  function undo(txId: string) {
    try {
      commit((acc, p) => cancelDeposit(acc, p, child!.id, txId));
      setFundMsg({ ok: true, text: 'Versement annulé : le métal est revenu sur votre compte.' });
    } catch (e) {
      setFundMsg({ ok: false, text: errText(e) });
    }
  }

  function requestWithdrawal() {
    try {
      let executed = false;
      commit((acc, p) => {
        const r = requestChildWithdrawal(acc, p, child!.id, wMetal, { unit: wUnit, value: wAmount }, purpose, note);
        executed = r.executed;
        return r.account;
      });
      setWText('');
      setNote('');
      setPurpose(undefined);
      setWMsg({
        ok: true,
        text: executed
          ? `Retrait effectué pour une dépense de ${name}.`
          : `Demande envoyée : ${child!.coParent?.name ?? 'le second parent'} doit la valider avec son code.`,
      });
    } catch (e) {
      setWMsg({ ok: false, text: errText(e) });
    }
  }

  function approve() {
    const reqId = approving;
    setApproving(null);
    if (!reqId) return;
    try {
      commit((acc, p) => approveChildWithdrawal(acc, p, child!.id, reqId));
      setWMsg({ ok: true, text: `Retrait validé par ${child!.coParent?.name}.` });
    } catch (e) {
      setWMsg({ ok: false, text: errText(e) });
    }
  }

  function closeRequest(reqId: string, status: 'refused' | 'cancelled') {
    try {
      updateAccount((acc) => closeChildWithdrawal(acc, child!.id, reqId, status));
      setWMsg({ ok: true, text: status === 'refused' ? 'Demande refusée.' : 'Demande annulée.' });
    } catch (e) {
      setWMsg({ ok: false, text: errText(e) });
    }
  }

  async function saveParents(authority: 'joint' | 'sole') {
    setParentMsg(null);
    try {
      if (authority === 'sole') {
        updateAccount((acc) => setChildParents(acc, child!.id, 'sole'));
        setEditParents(false);
        return;
      }
      if (!coName.trim()) throw new Error('Indiquez le prénom du second parent.');
      if (!isValidPinFormat(coPin)) throw new Error('Le code du second parent doit faire 4 chiffres.');
      if (coPin !== coPin2) throw new Error('Les deux codes ne correspondent pas.');
      const secret = await createSecret(coPin);
      updateAccount((acc) => setChildParents(acc, child!.id, 'joint', { name: coName, secret }));
      setCoName('');
      setCoPin('');
      setCoPin2('');
      setEditParents(false);
      setParentMsg({ ok: true, text: 'Second parent enregistré.' });
    } catch (e) {
      setParentMsg({ ok: false, text: errText(e) });
    }
  }

  function transfer() {
    const run = () => {
      try {
        updateAccount((acc) => transferChildAccount(acc, child!.id));
      } catch (e) {
        setMessage({ ok: false, text: errText(e) });
      }
    };
    if (Platform.OS === 'web') return run();
    Alert.alert(`Transférer le compte à ${name} ?`, 'Vous ne pourrez plus le gérer. Cette action est définitive.', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Transférer', onPress: run },
    ]);
  }

  function close() {
    const run = () => {
      try {
        commit((acc) => removeChild(acc, child!.id));
        router.back();
      } catch (e) {
        setMessage({ ok: false, text: errText(e) });
      }
    };
    if (Platform.OS === 'web') return run();
    Alert.alert(`Fermer le compte de ${name} ?`, 'Le compte doit être vide.', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Fermer', style: 'destructive', onPress: run },
    ]);
  }

  const needsParents = !child.authority || editParents;

  return (
    <Screen testID="screen-enfant">
      <Stack.Screen options={{ title: `Compte de ${name}` }} />

      <View style={styles.hero}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{name.slice(0, 1).toUpperCase()}</Text>
        </View>
        <Text style={styles.heroName}>{name}</Text>
        <Text style={styles.heroValue}>{formatEur(value.total)}</Text>
        {tax.cost > 0 && (
          <Pressable
            onPress={() => router.push('/fiscalite')}
            accessibilityRole="button"
            style={{ alignItems: 'center' }}
          >
            <Text style={[styles.heroGain, { color: tax.gain >= 0 ? colors.up : colors.down }]}>
              {tax.gain >= 0 ? 'Plus-value latente' : 'Moins-value latente'} : {tax.gain >= 0 ? '+' : '−'}
              {formatEur(Math.abs(tax.gain))} ({formatPercent(tax.gainPercent)})
            </Text>
            <Text style={styles.heroTax}>
              Après impôt : {tax.netGain >= 0 ? '+' : '−'}
              {formatEur(Math.abs(tax.netGain))} ({formatPercent(tax.netGainPercent)}){' '}
              <Text style={ui.link}>Détail ›</Text>
            </Text>
          </Pressable>
        )}
        <View style={styles.metals}>
          {METALS.map((m) => (
            <View key={m} style={{ alignItems: 'center', flex: 1 }}>
              <Text style={[styles.metalName, { color: metalColor[m] }]}>{METAL_LABEL[m]}</Text>
              <Text style={styles.metalWeight}>{formatWeight(child.holdings[m], unit, m)}</Text>
            </View>
          ))}
        </View>
      </View>

      {stage === 'minor' && child.birthDate && (
        <View style={[styles.banner, { borderColor: colors.up }]}>
          <Text style={styles.bannerText}>
            Aucun frais jusqu’aux 18 ans de {name}, le {longDate(majorityDate(child.birthDate))}. À cette date, son
            compte lui sera transféré.
          </Text>
        </View>
      )}
      {stage === 'adult' && (
        <View style={[styles.banner, { borderColor: colors.gold }]}>
          <Text style={styles.bannerTitle}>{name} est majeur</Text>
          <Text style={styles.bannerText}>
            Depuis ses 18 ans, ce compte lui appartient : vous ne pouvez plus y verser ni en retirer. Transférez-le pour
            que {name} y accède avec son propre compte Orvia (et sa propre pièce d’identité).
          </Text>
          <Button title={`Transférer le compte à ${name}`} onPress={transfer} />
        </View>
      )}
      {stage === 'transferred' && (
        <View style={[styles.banner, { borderColor: colors.border }]}>
          <Text style={styles.bannerTitle}>Compte transféré à {name}</Text>
          <Text style={styles.bannerText}>
            Le {longDate(new Date(child.transferredAt!))}. Code à donner à {name} pour rattacher le compte à son accès :
          </Text>
          <Text style={styles.code} selectable>
            {child.transferCode}
          </Text>
          <Hint>{name} saisit ce code dans son propre accès Orvia, après la vérification de son identité.</Hint>
        </View>
      )}

      {!child.birthDate && stage === 'minor' && (
        <Card style={{ gap: 8 }}>
          <Text style={styles.para}>
            Ajoutez la date de naissance de {name} : le compte reste sans frais jusqu’à ses 18 ans, puis lui est
            transféré.
          </Text>
          <TextInput
            value={birth}
            onChangeText={(t) => {
              setBirth(t);
              setBirthError(null);
            }}
            placeholder="JJ/MM/AAAA"
            placeholderTextColor={colors.textMuted}
            keyboardType="numbers-and-punctuation"
            style={ui.input}
          />
          <Button
            title="Enregistrer la date"
            variant="ghost"
            disabled={!birth.trim()}
            onPress={() => {
              try {
                const iso = parseBirthDate(birth);
                commit((acc) => setChildBirthDate(acc, child.id, iso));
              } catch (e) {
                setBirthError(errText(e));
              }
            }}
          />
          {birthError && <Message ok={false} text={birthError} />}
        </Card>
      )}

      <ChildRules name={name} />
      <DormancyNotice wallet={child} name={name} />

      {stage === 'minor' && (
        <>
          <SectionTitle>Parents</SectionTitle>
          {needsParents ? (
            <Card style={{ gap: 10 }}>
              <Text style={styles.para}>Comment exercez-vous l’autorité parentale sur {name} ?</Text>
              <Text style={styles.label}>Autorité partagée (le cas le plus courant)</Text>
              <Hint>Les retraits devront être validés par le second parent, avec son propre code.</Hint>
              <TextInput
                value={coName}
                onChangeText={setCoName}
                placeholder="Prénom du second parent"
                placeholderTextColor={colors.textMuted}
                style={ui.input}
              />
              <View style={styles.row2}>
                <TextInput
                  value={coPin}
                  onChangeText={setCoPin}
                  placeholder="Son code (4 chiffres)"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="number-pad"
                  secureTextEntry
                  maxLength={4}
                  style={[ui.input, { flex: 1 }]}
                  accessibilityLabel="Code du second parent"
                />
                <TextInput
                  value={coPin2}
                  onChangeText={setCoPin2}
                  placeholder="Confirmer"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="number-pad"
                  secureTextEntry
                  maxLength={4}
                  style={[ui.input, { flex: 1 }]}
                  accessibilityLabel="Confirmer le code du second parent"
                />
              </View>
              <Hint>
                Le second parent choisit lui-même ce code : il le tape sur votre téléphone pour valider un retrait.
              </Hint>
              <Button title="Enregistrer le second parent" onPress={() => saveParents('joint')} />
              <View style={styles.sep} />
              <Text style={styles.label}>J’exerce seul l’autorité parentale</Text>
              <Hint>Vous validez seul les retraits, toujours pour une dépense faite pour {name}.</Hint>
              <Button title="Je suis seul titulaire" variant="ghost" onPress={() => saveParents('sole')} />
              {parentMsg && <Message {...parentMsg} />}
            </Card>
          ) : (
            <Card style={styles.parentRow}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.label}>
                  {child.authority === 'joint'
                    ? `Autorité partagée avec ${child.coParent?.name}`
                    : 'Autorité parentale exercée seul'}
                </Text>
                <Hint>
                  {child.authority === 'joint'
                    ? `${child.coParent?.name} valide chaque retrait avec son code.`
                    : 'Vous validez seul les retraits, avec un motif.'}
                </Hint>
              </View>
              <Pressable onPress={() => setEditParents(true)} accessibilityRole="button">
                <Text style={ui.link}>Modifier</Text>
              </Pressable>
            </Card>
          )}

          <SectionTitle>Verser à {name}</SectionTitle>
          <MetalPicker value={metal} onChange={setMetal} />
          <Hint>Disponible sur votre compte : {formatWeight(account.holdings[metal], unit, metal)}</Hint>
          <AmountInput
            text={text}
            onChangeText={(t) => {
              setText(t);
              setFundMsg(null);
            }}
            unit={amountUnit}
            metal={metal}
            onUnitChange={setAmountUnit}
          />
          {grams > 0 && (
            <Text style={styles.preview}>
              {formatQty(metal, grams, unit)} ({formatEur(grams * quote.prices[metal])}) passent sur le compte de {name}
              , sans frais. C’est un don : ce métal lui appartiendra.
            </Text>
          )}
          <Button title={`Verser à ${name}`} onPress={fund} />
          {undoable.map((t) => (
            <Card key={t.id} style={styles.parentRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.para}>Versement de {formatEur(t.eur)}</Text>
                <Hint>{formatDate(t.date)} · annulable seul pendant 24 h en cas d’erreur</Hint>
              </View>
              <Pressable onPress={() => undo(t.id)} accessibilityRole="button">
                <Text style={[ui.link, { color: colors.down }]}>Annuler</Text>
              </Pressable>
            </Card>
          ))}
          {fundMsg && <Message {...fundMsg} />}

          <SectionTitle>Dépense pour {name}</SectionTitle>
          <Hint>
            Pour payer une dépense faite pour {name}, le métal est retiré de son compte vers le vôtre.
            {child.authority === 'joint' ? ` ${child.coParent?.name} doit valider.` : ''}
          </Hint>
          {!child.authority ? (
            <Hint style={{ color: colors.warning }}>Indiquez d’abord comment vous exercez l’autorité parentale.</Hint>
          ) : (
            <>
              <Label>Dépense</Label>
              <View style={styles.chips}>
                {PURPOSES.map((p) => (
                  <Pressable
                    key={p}
                    onPress={() => {
                      setPurpose(p);
                      setWMsg(null);
                    }}
                    accessibilityRole="button"
                    accessibilityState={{ selected: purpose === p }}
                    style={[styles.chip, purpose === p && styles.chipOn]}
                  >
                    <Text style={[styles.chipText, purpose === p && styles.chipTextOn]}>{PURPOSE_LABEL[p]}</Text>
                  </Pressable>
                ))}
              </View>
              <TextInput
                value={note}
                onChangeText={setNote}
                placeholder={purpose === 'other' ? 'Précisez la dépense (obligatoire)' : 'Précision (facultatif)'}
                placeholderTextColor={colors.textMuted}
                style={ui.input}
              />
              <MetalPicker value={wMetal} onChange={setWMetal} />
              <Hint>
                Sur le compte de {name} : {formatWeight(child.holdings[wMetal], unit, wMetal)}
              </Hint>
              <AmountInput
                text={wText}
                onChangeText={(t) => {
                  setWText(t);
                  setWMsg(null);
                }}
                unit={wUnit}
                metal={wMetal}
                onUnitChange={setWUnit}
              />
              {wGrams > 0 && (
                <Text style={styles.preview}>
                  {formatQty(wMetal, wGrams, unit)} ({formatEur(wGrams * quote.prices[wMetal])}) pour :{' '}
                  {purpose ? PURPOSE_LABEL[purpose] : 'choisissez la dépense'}.
                </Text>
              )}
              <Button
                title={child.authority === 'joint' ? 'Demander le retrait' : 'Retirer pour cette dépense'}
                onPress={requestWithdrawal}
              />
            </>
          )}
          {pending.map((r) => (
            <Card key={r.id} style={{ gap: 8, borderColor: colors.gold }}>
              <Text style={styles.label}>En attente de {child.coParent?.name ?? 'validation'}</Text>
              <Text style={styles.para}>
                {formatQty(r.metal, r.grams, unit)} (≈ {formatEur(r.eur)}) · {PURPOSE_LABEL[r.purpose]}
                {r.note ? ` (${r.note})` : ''}
              </Text>
              <View style={styles.row2}>
                <View style={{ flex: 1 }}>
                  <Button title={`Valider (${child.coParent?.name})`} onPress={() => setApproving(r.id)} />
                </View>
                <View style={{ flex: 1 }}>
                  <Button title="Refuser" variant="ghost" onPress={() => closeRequest(r.id, 'refused')} />
                </View>
              </View>
              <Pressable onPress={() => closeRequest(r.id, 'cancelled')} accessibilityRole="button">
                <Text style={[ui.link, { textAlign: 'center', color: colors.textMuted }]}>Annuler ma demande</Text>
              </Pressable>
            </Card>
          ))}
          {past.length > 0 && (
            <Hint>
              Demandes récentes :{' '}
              {past
                .map(
                  (r) =>
                    `${PURPOSE_LABEL[r.purpose]} ${formatEur(r.eur)} (${r.status === 'approved' ? 'validée' : r.status === 'refused' ? 'refusée' : 'annulée'})`,
                )
                .join(' · ')}
            </Hint>
          )}
          {wMsg && <Message {...wMsg} />}
        </>
      )}

      {stage === 'minor' && (
        <>
          <SectionTitle>Don mensuel</SectionTitle>
          <ChildGiftCard child={child} />
        </>
      )}

      <SectionTitle>Mouvements</SectionTitle>
      {child.transactions.length === 0 ? (
        <Hint>Aucun mouvement pour l’instant.</Hint>
      ) : (
        <Card style={{ paddingVertical: 0 }}>
          {child.transactions.slice(0, 20).map((tx) => (
            <TransactionRow key={tx.id} tx={tx} unit={unit} walletName={`Compte de ${name}`} />
          ))}
        </Card>
      )}
      <ChildStatementCard child={child} />
      <GiftRecapCard child={child} />
      <StatementCard wallet={child} walletName={`Compte de ${name}`} />
      {stage !== 'transferred' && <ShareViewCard child={child} parent={account.holder} prices={quote.prices} />}

      {stage === 'minor' && empty && <Button title={`Fermer le compte de ${name}`} variant="danger" onPress={close} />}
      {message && <Message {...message} />}

      <CodeConfirm
        visible={!!approvingReq}
        title={`Code de ${child.coParent?.name ?? 'second parent'}`}
        summary={
          approvingReq
            ? `${child.coParent?.name} valide le retrait de ${formatQty(approvingReq.metal, approvingReq.grams, unit)} pour : ${PURPOSE_LABEL[approvingReq.purpose]}.`
            : ''
        }
        verify={(pin) => verifySecret(pin, child.coParent?.secret)}
        onConfirm={approve}
        onCancel={() => setApproving(null)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.gold,
    padding: 18,
    alignItems: 'center',
    gap: 4,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.goldSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  avatarText: { color: colors.gold, fontSize: 24, fontWeight: '800' },
  heroName: { color: colors.text, fontSize: 24, fontWeight: '800' },
  heroGain: { fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] },
  heroTax: { color: colors.textMuted, fontSize: 12, fontWeight: '600', marginTop: 2 },
  heroValue: { color: colors.text, fontSize: 30, fontWeight: '800', fontVariant: ['tabular-nums'] },
  metals: { flexDirection: 'row', marginTop: 10, alignSelf: 'stretch' },
  metalName: { fontSize: 12, fontWeight: '700' },
  metalWeight: { color: colors.text, fontSize: 14, fontWeight: '600', fontVariant: ['tabular-nums'] },
  banner: { borderWidth: 1, borderRadius: 14, padding: 12, gap: 8, backgroundColor: colors.surface },
  bannerTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
  bannerText: { color: colors.text, fontSize: 13, lineHeight: 19 },
  code: { color: colors.gold, fontSize: 18, fontWeight: '800', letterSpacing: 1, textAlign: 'center' },
  para: { color: colors.text, fontSize: 14, lineHeight: 20 },
  label: { color: colors.text, fontSize: 14, fontWeight: '700' },
  row2: { flexDirection: 'row', gap: 10 },
  sep: { height: 1, backgroundColor: colors.border, marginVertical: 4 },
  parentRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipOn: { borderColor: colors.gold, backgroundColor: colors.goldSoft },
  chipText: { color: colors.textMuted, fontSize: 13 },
  chipTextOn: { color: colors.gold, fontWeight: '700' },
  preview: {
    color: colors.text,
    backgroundColor: colors.goldSoft,
    padding: 12,
    borderRadius: 12,
    fontSize: 14,
    lineHeight: 20,
  },
});
