import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme';
import { PinPad } from './PinPad';

interface Props {
  visible: boolean;
  title: string;
  summary: string;
  /** Vérifie le code saisi (ex. code du second parent). */
  verify: (pin: string) => Promise<boolean>;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Demande un code à 4 chiffres avant une opération (ex. validation d'un retrait par le second parent). */
export function CodeConfirm({ visible, ...rest }: Props) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={rest.onCancel}>
      {visible && <Sheet {...rest} />}
    </Modal>
  );
}

function Sheet({ title, summary, verify, onConfirm, onCancel }: Omit<Props, 'visible'>) {
  const [error, setError] = useState<string | null>(null);
  return (
    <View style={styles.backdrop}>
      <View style={styles.sheet}>
        <Text style={styles.summary}>{summary}</Text>
        <PinPad
          title={title}
          error={error}
          onComplete={async (pin) => {
            if (await verify(pin)) {
              onConfirm();
              return true;
            }
            setError('Code incorrect.');
            return false;
          }}
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
