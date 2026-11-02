import { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button, styles as ui } from '../components/ui';
import { PinPad } from '../components/PinPad';
import { useBank } from '../state/BankProvider';
import { colors } from '../theme';

const LOGO = require('../../assets/logo.png');

type Step = 'name' | 'pin' | 'confirm';

/**
 * Ouverture du compte : prénom, puis choix du code d'accès à 4 chiffres (saisi deux fois).
 * Avec `existingHolder`, le compte existe déjà (ancienne version) : on choisit seulement le code.
 */
export function Onboarding({ existingHolder }: { existingHolder?: string }) {
  const { openAccount, createPin } = useBank();
  const [step, setStep] = useState<Step>(existingHolder ? 'pin' : 'name');
  const [name, setName] = useState(existingHolder ?? '');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const valid = name.trim().length > 0;

  if (step === 'pin' || step === 'confirm') {
    return (
      <View style={styles.center}>
        <PinPad
          key={step}
          title={step === 'pin' ? 'Choisis ton code d’accès' : 'Confirme ton code'}
          subtitle={
            step === 'pin'
              ? `${existingHolder ? 'Nouveau : ton compte est protégé par un code. ' : ''}4 chiffres, demandés à chaque ouverture de l’appli et pour chaque virement.`
              : 'Tape le même code une seconde fois.'
          }
          error={error}
          onComplete={async (entered) => {
            if (step === 'pin') {
              setPin(entered);
              setError(null);
              setStep('confirm');
              return true;
            }
            if (entered !== pin) {
              setError('Les deux codes ne correspondent pas. Recommence.');
              setStep('pin');
              return false;
            }
            if (existingHolder) await createPin(entered);
            else await openAccount(name.trim(), entered);
            return true;
          }}
        />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.welcome}>
        <Image source={LOGO} style={styles.logo} accessibilityLabel="Orvia" resizeMode="contain" />
        <Text style={styles.tagline}>Ton argent en or, en argent et en platine physiques, à portée de main.</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Ton prénom"
          placeholderTextColor={colors.textMuted}
          style={ui.input}
          onSubmitEditing={() => valid && setStep('pin')}
          returnKeyType="next"
        />
        <Button title="Ouvrir mon compte" onPress={() => setStep('pin')} disabled={!valid} />
        <Text style={styles.disclaimer}>
          Application de démonstration : les cours sont réels, mais aucun argent ni métal réel n’est échangé.
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  welcome: { flex: 1, justifyContent: 'center', padding: 24, gap: 14 },
  logo: { width: 200, height: 200, alignSelf: 'center' },
  tagline: { color: colors.textMuted, fontSize: 15, textAlign: 'center', marginBottom: 20, lineHeight: 21 },
  disclaimer: { color: colors.textMuted, fontSize: 12, textAlign: 'center', marginTop: 8, lineHeight: 17 },
});
