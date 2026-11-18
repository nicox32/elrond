import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { memberQrText } from '../logic/memberQr';
import { colors } from '../theme';
import { QrCode } from './QrCode';
import { Hint } from './ui';

/** QR code unique d'un numéro de membre, à montrer ou à photographier. */
export function MemberQr({ memberNumber, label }: { memberNumber: string; label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={{ gap: 8 }}>
      <Pressable onPress={() => setOpen((o) => !o)} accessibilityRole="button" testID="member-qr-toggle">
        <Text style={styles.link}>
          {open ? 'Masquer mon QR code' : `Afficher le QR code${label ? ` ${label}` : ''}`}
        </Text>
      </Pressable>
      {open && (
        <View style={styles.box} testID="member-qr">
          <QrCode value={memberQrText(memberNumber)} size={200} />
          <Text style={styles.number} selectable>
            {memberNumber}
          </Text>
          <Hint>
            Ce QR code est propre à ce numéro de membre. Il contient seulement le numéro : il ne donne accès à rien.
          </Hint>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  link: { color: colors.gold, fontSize: 14, fontWeight: '600' },
  box: { alignItems: 'center', gap: 8, paddingVertical: 6 },
  number: { color: colors.text, fontSize: 15, letterSpacing: 1.5, fontWeight: '700' },
});
