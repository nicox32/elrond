import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { useBank } from '../state/BankProvider';
import { authenticateWithBiometrics, biometricsAvailable, verifyPin } from '../security';
import { colors } from '../theme';
import { PinPad } from './PinPad';

interface Props {
  visible: boolean;
  /** Résumé de l'opération à confirmer. */
  summary: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Demande le code (ou l'empreinte) avant de valider une opération sensible, comme un virement. */
export function PinConfirm({ visible, summary, onConfirm, onCancel }: Props) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onCancel}>
      {/* Monté à chaque ouverture : le code et l'erreur repartent de zéro. */}
      {visible && <Sheet summary={summary} onConfirm={onConfirm} onCancel={onCancel} />}
    </Modal>
  );
}

function Sheet({ summary, onConfirm, onCancel }: Omit<Props, 'visible'>) {
  const { account } = useBank();
  const [error, setError] = useState<string | null>(null);
  const [bio, setBio] = useState(false);
  const wantsBio = !!account?.settings.biometrics;

  useEffect(() => {
    if (wantsBio) biometricsAvailable().then(setBio);
  }, [wantsBio]);

  return (
    <View style={styles.backdrop}>
      <View style={styles.sheet}>
        <Text style={styles.summary}>{summary}</Text>
        <PinPad
          title="Confirme avec ton code"
          error={error}
          onComplete={async (pin) => {
            if (await verifyPin(pin)) {
              onConfirm();
              return true;
            }
            setError('Code incorrect.');
            return false;
          }}
          extraKey={
            bio
              ? {
                  label: 'Empreinte',
                  onPress: async () => {
                    if (await authenticateWithBiometrics('Confirmer le virement')) onConfirm();
                  },
                }
              : undefined
          }
        />
        <Pressable onPress={onCancel} style={styles.cancel} accessibilityRole="button">
          <Text style={styles.cancelText}>Annuler</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 32,
    gap: 12,
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  summary: {
    color: colors.text,
    backgroundColor: colors.goldSoft,
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  cancel: { alignItems: 'center', padding: 10 },
  cancelText: { color: colors.textMuted, fontSize: 15, fontWeight: '600' },
});
