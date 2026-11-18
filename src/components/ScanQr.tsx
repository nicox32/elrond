import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRef, useState } from 'react';
import { Platform, StyleSheet, Text, TextInput, View } from 'react-native';

import { colors } from '../theme';
import { Button, Card, Hint, styles as ui } from './ui';

/**
 * Scanner de QR code (caméra). Sur le web, qui n'a pas de caméra ici, on colle le texte du QR code.
 * `onScan` reçoit le texte lu ; l'écran appelant décide quoi en faire.
 */
export function ScanQr({
  title,
  hint,
  onScan,
  onClose,
}: {
  title: string;
  hint?: string;
  onScan: (text: string) => void;
  onClose: () => void;
}) {
  const [permission, requestPermission] = useCameraPermissions();
  const [pasted, setPasted] = useState('');
  const done = useRef(false);

  const handle = (text: string) => {
    if (done.current) return;
    done.current = true;
    onScan(text);
  };

  return (
    <Card style={{ gap: 10 }}>
      <Text style={styles.title}>{title}</Text>
      {hint ? <Hint>{hint}</Hint> : null}
      {Platform.OS !== 'web' &&
        (!permission ? (
          <Text style={styles.sub}>Chargement de la caméra…</Text>
        ) : !permission.granted ? (
          <>
            <Hint>Orvia a besoin de l’appareil photo pour lire le QR code. Aucune image n’est enregistrée.</Hint>
            <Button title="Autoriser l’appareil photo" onPress={requestPermission} />
          </>
        ) : (
          <View style={styles.camera}>
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={({ data }) => handle(data)}
            />
          </View>
        ))}
      <Hint>
        {Platform.OS === 'web'
          ? 'Collez le texte du QR code.'
          : 'Ou, si le scan ne marche pas, collez le texte du code.'}
      </Hint>
      <TextInput
        value={pasted}
        onChangeText={setPasted}
        placeholder="Texte du QR code"
        placeholderTextColor={colors.textMuted}
        autoCapitalize="none"
        autoCorrect={false}
        style={ui.input}
        accessibilityLabel="Texte du QR code"
        testID="scan-paste"
      />
      <Button title="Valider" onPress={() => handle(pasted)} disabled={!pasted.trim()} />
      <Button title="Annuler" variant="ghost" onPress={onClose} />
    </Card>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.text, fontSize: 16, fontWeight: '700' },
  sub: { color: colors.textMuted },
  camera: { height: 300, borderRadius: 14, overflow: 'hidden', backgroundColor: '#000' },
});
