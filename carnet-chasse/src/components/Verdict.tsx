import { Text, View } from 'react-native';

import type { Verdict } from '../logic/management';
import { colors, fonts } from '../theme';

export const VERDICT_LOOK: Record<Verdict, { label: string; color: string; bg: string }> = {
  eliminer: { label: 'À prélever', color: colors.olive, bg: colors.oliveSoft },
  trophee: { label: 'Trophée (fin de vie)', color: colors.gold, bg: colors.goldSoft },
  possible: { label: 'Possible', color: colors.olive, bg: colors.oliveSoft },
  surveiller: { label: 'À surveiller', color: colors.accent, bg: colors.accentSoft },
  epargner: { label: 'Épargner', color: colors.danger, bg: colors.dangerSoft },
  libre: { label: 'À compléter', color: colors.textMuted, bg: colors.surfaceAlt },
};

export function VerdictBadge({ verdict }: { verdict: Verdict }) {
  const v = VERDICT_LOOK[verdict];
  return (
    <View style={{ backgroundColor: v.bg, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' }}>
      <Text style={{ color: v.color, fontFamily: fonts.semibold, fontSize: 12 }}>{v.label}</Text>
    </View>
  );
}
