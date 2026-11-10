import { router } from 'expo-router';
import { Image, Text, View } from 'react-native';

import { findWeapon, getSpecies, TROPHY_TYPE_LABELS } from '../data/game';
import { formatDateTime, formatNumber, formatScore } from '../logic/stats';
import type { Hunt, ReserveId, Weapon } from '../logic/types';
import { colors, fonts } from '../theme';
import { Card, styles } from './ui';

const RESERVE_BADGE: Record<ReserveId, string> = { 'new-laurentia': 'NL', kilimaya: 'KIL', headquarters: 'HQ' };

export function HuntRow({ hunt, customWeapons }: { hunt: Hunt; customWeapons: Weapon[] }) {
  const species = getSpecies(hunt.speciesId);
  const weapon = findWeapon(hunt.weaponId, customWeapons);
  const details = [
    weapon ? `${weapon.name} · ${weapon.caliber}` : 'Arme inconnue',
    hunt.distanceM !== undefined ? `${formatNumber(hunt.distanceM)} m` : null,
    hunt.oneShot ? '1 tir' : null,
  ].filter(Boolean);
  const extra = [
    formatDateTime(hunt.date),
    hunt.trophyType !== 'normal' ? TROPHY_TYPE_LABELS[hunt.trophyType] : null,
    hunt.mode === 'coop' ? 'coop' : null,
  ].filter(Boolean);
  const dangerous = species?.dangerous;

  return (
    <Card onPress={() => router.push({ pathname: '/chasse/[id]', params: { id: hunt.id } })}>
      <View style={styles.row}>
        {hunt.photoUri ? (
          <Image source={{ uri: hunt.photoUri }} style={{ width: 44, height: 44, borderRadius: 12 }} />
        ) : (
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              backgroundColor: dangerous ? '#3A1F1A' : '#24301F',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ fontFamily: fonts.heading, fontSize: dangerous ? 22 : 15, color: dangerous ? '#F08A7C' : colors.olive }}>
              {dangerous ? '!' : RESERVE_BADGE[hunt.reserveId]}
            </Text>
          </View>
        )}
        <View style={{ flex: 1, gap: 1, minWidth: 0 }}>
          <Text style={styles.strong} numberOfLines={1}>
            {species?.name ?? hunt.speciesId}
          </Text>
          <Text style={styles.muted} numberOfLines={1}>
            {details.join(' · ')}
          </Text>
          <Text style={[styles.muted, { fontSize: 12 }]} numberOfLines={1}>
            {extra.join(' · ')}
          </Text>
          {hunt.toPlace ? (
            <Text style={{ color: colors.olive, fontSize: 12, fontFamily: fonts.semibold }}>À exposer au pavillon</Text>
          ) : null}
        </View>
        {hunt.trophyScore !== undefined ? <Text style={styles.score}>{formatScore(hunt.trophyScore)}</Text> : null}
      </View>
    </Card>
  );
}
