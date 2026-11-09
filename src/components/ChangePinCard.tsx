import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { setPin, verifyPin } from '../security';
import { colors } from '../theme';
import { PinPad } from './PinPad';
import { Button, Card, Hint } from './ui';

type Step = 'current' | 'new' | 'confirm';

/** Profil → Sécurité : changer son code (code actuel, puis le nouveau deux fois). */
export function ChangePinCard() {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  return (
    <Card style={{ gap: 8 }}>
      <Button
        title="Changer mon code"
        variant="ghost"
        onPress={() => {
          setDone(false);
          setOpen(true);
        }}
      />
      {done && <Hint>Nouveau code enregistré. Il sera demandé dès la prochaine ouverture.</Hint>}
      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        {open && (
          <Sheet
            onDone={() => {
              setOpen(false);
              setDone(true);
            }}
            onCancel={() => setOpen(false)}
          />
        )}
      </Modal>
    </Card>
  );
}

function Sheet({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const [step, setStep] = useState<Step>('current');
  const [first, setFirst] = useState('');
  const [error, setError] = useState<string | null>(null);
  const title =
    step === 'current'
      ? 'Votre code actuel'
      : step === 'new'
        ? 'Choisissez un nouveau code'
        : 'Confirmez le nouveau code';

  return (
    <View style={styles.backdrop}>
      <View style={styles.sheet}>
        <PinPad
          key={step}
          title={title}
          error={error}
          onComplete={async (pin) => {
            if (step === 'current') {
              if (!(await verifyPin(pin))) {
                setError('Code incorrect.');
                return false;
              }
              setError(null);
              setStep('new');
              return true;
            }
            if (step === 'new') {
              if (/^(\d)\1{3}$/.test(pin) || pin === '1234') {
                setError('Code trop simple : évitez 1234 ou 4 chiffres identiques.');
                return false;
              }
              setFirst(pin);
              setError(null);
              setStep('confirm');
              return true;
            }
            if (pin !== first) {
              setError('Les deux codes sont différents. Recommencez.');
              setFirst('');
              setStep('new');
              return false;
            }
            await setPin(pin);
            onDone();
            return true;
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
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 16,
    paddingBottom: 28,
  },
  cancel: { alignSelf: 'center', padding: 12 },
  cancelText: { color: colors.textMuted, fontSize: 15, fontWeight: '600' },
});
