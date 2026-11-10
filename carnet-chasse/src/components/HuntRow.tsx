import { router } from 'expo-router';
import { Image, Text, View } from 'react-native';

import { findWeapon, getReserve, getSpecies, TROPHY_TYPE_LABELS } from '../data/game';
import { formatDateTime, formatNumber, formatScore } from '../logic/stats';
import type { Hunt, Weapon } from '../logic/types';
import { colors } from '../theme';
import { Card, styles } from './ui';

export function HuntRow({ hunt, customWeapons }: { hunt: Hunt; customWeapons: Weapon[] }) {
  const species = getSpecies(hunt.speciesId);
  const weapon = findWeapon(hunt.weaponId, customWeapons);
  const details = [
    weapon ? `${weapon.name} (${weapon.caliber})` : 'Arme inconnue',
    hunt.distanceM !== undefined ? `${formatNumber(hunt.distanceM)} m` : null,
  ].filter(Boolean);
  return (
    <Card onPress={() => router.push({ pathname: '/chasse/[id]', params: { id: hunt.id } })}>
      <View style={[styles.row, { alignItems: 'flex-start' }]}>
        {hunt.photoUri ? (
          <Image source={{ uri: hunt.photoUri }} style={{ width: 56, height: 56, borderRadius: 10 }} />
        ) : null}
        <View style={{ flex: 1, gap: 2 }}>
          <View style={[styles.row, { justifyContent: 'space-between' }]}>
            <Text style={[styles.strong, { flexShrink: 1 }]} numberOfLines={1}>
              {species?.name ?? hunt.speciesId}
            </Text>
            {hunt.trophyScore !== undefined ? (
              <Text style={{ color: colors.accent, fontWeight: '800', fontSize: 15 }}>
                {formatScore(hunt.trophyScore)} pts
              </Text>
            ) : null}
          </View>
          <Text style={styles.muted} numberOfLines={1}>
            {details.join(' · ')}
          </Text>
          <Text style={styles.muted}>
            {formatDateTime(hunt.date)} · {getReserve(hunt.reserveId)?.name}
            {hunt.trophyType !== 'normal' ? ` · ${TROPHY_TYPE_LABELS[hunt.trophyType]}` : ''}
            {hunt.oneShot ? ' · 1 tir' : ''}
            {hunt.mode === 'coop' ? ' · coop' : ''}
          </Text>
          {hunt.toPlace ? <Text style={{ color: colors.olive, fontSize: 12, fontWeight: '700' }}>À exposer au pavillon</Text> : null}
        </View>
      </View>
    </Card>
  );
}
