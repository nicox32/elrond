import { Image, Text, View } from 'react-native';

import { formatClassRange, STAT_LEVELS } from '../data/armory';
import { colors, fonts } from '../theme';
import { Select } from './Select';

/** Photo de l'arme ou de la munition, ou une vignette avec les initiales. */
export function Thumb({ uri, label, size = 56 }: { uri?: string; label: string; size?: number }) {
  if (uri) return <Image source={{ uri }} style={{ width: size, height: size, borderRadius: 12 }} resizeMode="cover" />;
  const initials = label
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');
  return (
    <View
      style={{ width: size, height: size, borderRadius: 12, backgroundColor: '#24301F', alignItems: 'center', justifyContent: 'center' }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Text style={{ color: colors.olive, fontFamily: fonts.heading, fontSize: size / 3 }}>{initials}</Text>
    </View>
  );
}

/** Classes d'animaux visées, comme le badge du jeu (« 3-6 »). */
export function ClassBadge({ range, prefix = 'Classe' }: { range?: [number, number]; prefix?: string }) {
  const r = formatClassRange(range);
  if (!r) return null;
  return (
    <View style={{ borderWidth: 1, borderColor: colors.gold, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 1, alignSelf: 'flex-start' }}>
      <Text style={{ color: colors.gold, fontFamily: fonts.heading, fontSize: 14 }}>
        {prefix} {r}
      </Text>
    </View>
  );
}

/** Ligne « Précision · Supérieur(e) » d'une fiche. */
export function StatLine({ label, value }: { label: string; value?: string | number }) {
  if (value === undefined || value === '') return null;
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5, gap: 8 }}>
      <Text style={{ color: colors.textMuted, fontFamily: fonts.semibold, fontSize: 12, letterSpacing: 1.2, textTransform: 'uppercase' }}>
        {label}
      </Text>
      <Text style={{ color: colors.text, fontFamily: fonts.semibold, fontSize: 14, flexShrink: 1, textAlign: 'right' }}>{value}</Text>
    </View>
  );
}

/** Menu des niveaux affichés sous les jauges du jeu (« Supérieur(e) »…), valeurs perso possibles. */
export function LevelPicker({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return <Select label={label} value={value} onChange={onChange} options={STAT_LEVELS} customKey="level" placeholder="Choisir…" />;
}
