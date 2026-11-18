import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatEur } from '../logic/format';
import { fabricationProgress, physicalFeesOf } from '../logic/physical';
import type { HomeBar } from '../logic/types';
import { useAccount } from '../state/BankProvider';
import { colors } from '../theme';
import { AgencyPicker } from './AgencyPicker';
import { BarFabrication } from './BarFabrication';
import { Button, Hint, Message } from './ui';

/**
 * Retirer un lingotin du coffre de Godot & Fils : livraison à domicile ou retrait en agence. Une fois demandé,
 * le suivi s'affiche ; le client confirme quand il l'a en main.
 */
export function VaultExit({
  bar,
  onRequest,
  onConfirm,
}: {
  bar: HomeBar;
  onRequest: (mode: 'home' | 'agency', agency?: string) => void;
  onConfirm: () => void;
}) {
  const account = useAccount();
  const fees = physicalFeesOf(account.settings);
  const [mode, setMode] = useState<'home' | 'agency'>('home');
  const [agency, setAgency] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const fee = mode === 'home' && bar.grams < fees.freeFromGrams - 1e-9 ? fees.delivery : 0;

  if (bar.exitRequest) {
    const ex = bar.exitRequest;
    const ready = fabricationProgress(ex.at, new Date(), ex.mode === 'agency').step >= 3;
    return (
      <View style={styles.box} testID="vault-exit-progress">
        <Text style={styles.title}>
          {ex.mode === 'agency' ? `Retrait en agence (${ex.agency})` : 'Livraison à domicile'} demandé
        </Text>
        <BarFabrication orderedAt={ex.at} pickup={ex.mode === 'agency'} />
        <Button
          title={ex.mode === 'agency' ? 'Retiré à l’agence' : 'Lingotin reçu en main'}
          onPress={onConfirm}
          disabled={!ready}
        />
        <Hint>
          {ready
            ? 'Confirmez quand vous avez le lingotin en main : il quitte alors le coffre de Godot & Fils.'
            : 'Disponible dès que le lingotin est arrivé (suivi estimé ci-dessus).'}
        </Hint>
      </View>
    );
  }

  return (
    <View style={styles.box} testID="vault-exit">
      <Text style={styles.title}>Retirer du coffre</Text>
      <View style={styles.modes}>
        {(
          [
            { id: 'home', label: 'À domicile' },
            { id: 'agency', label: 'En agence' },
          ] as const
        ).map((m) => (
          <Pressable
            key={m.id}
            onPress={() => setMode(m.id)}
            accessibilityRole="button"
            accessibilityState={{ selected: mode === m.id }}
            style={[styles.mode, mode === m.id && { borderColor: colors.gold }]}
          >
            <Text style={[styles.modeText, mode === m.id && { color: colors.gold }]}>{m.label}</Text>
          </Pressable>
        ))}
      </View>
      {mode === 'agency' && <AgencyPicker value={agency} onChange={setAgency} />}
      <Button
        title={`Retirer du coffre · ${fee > 0 ? formatEur(fee) : 'gratuit'}`}
        variant="ghost"
        onPress={() => {
          try {
            onRequest(mode, mode === 'agency' ? agency : undefined);
            setMsg(null);
          } catch (e) {
            setMsg({ ok: false, text: e instanceof Error ? e.message : 'Impossible.' });
          }
        }}
      />
      <Hint>
        {mode === 'home'
          ? `Livraison assurée, ${fees.delivery} € (offerte dès ${fees.freeFromGrams} g), payée depuis le compte d’attente.`
          : 'Retrait gratuit en agence, contre pièce d’identité et bon de remise.'}{' '}
        Délai : 8 jours environ.
      </Hint>
      {msg && <Message {...msg} />}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: 8, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10 },
  title: { color: colors.text, fontSize: 15, fontWeight: '700' },
  modes: { flexDirection: 'row', gap: 8 },
  mode: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  modeText: { color: colors.textMuted, fontSize: 13.5, fontWeight: '600', textAlign: 'center' },
});
