import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Image, Text, View } from 'react-native';

import { ClassBadge, StatLine, Thumb } from '../../components/armory';
import { Button, Card, Chip, ChipRow, Empty, Screen, SectionTitle, styles } from '../../components/ui';
import { ammoForCaliber, formatClassRange, getWeaponSheet } from '../../data/armory';
import { findWeapon, WEAPON_TYPE_LABELS } from '../../data/game';
import { formatNumber, weaponStats } from '../../logic/stats';
import { pickTrophyPhoto } from '../../photos';
import { useCarnet } from '../../state/CarnetProvider';
import { colors, fonts } from '../../theme';

export default function ArmeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state, toggleOwned, saveWeaponSheet, removeCustomWeapon } = useCarnet();
  const [confirm, setConfirm] = useState(false);
  const weapon = findWeapon(id, state.customWeapons);
  const stats = useMemo(() => weaponStats(state.hunts, id), [state.hunts, id]);

  if (!weapon) {
    return (
      <Screen top={false}>
        <Empty>Cette arme n&apos;existe plus.</Empty>
      </Screen>
    );
  }

  const sheet = getWeaponSheet(weapon.id, state.weaponSheets);
  const mine = state.weaponSheets[weapon.id];
  const owned = state.ownedWeaponIds.includes(weapon.id);
  const ammo = ammoForCaliber(weapon.caliber, state.ammoSheets);

  async function choosePhoto() {
    const uri = await pickTrophyPhoto('arme');
    if (uri) saveWeaponSheet(weapon!.id, { ...(mine ?? {}), photoUri: uri });
  }

  return (
    <Screen top={false}>
      <Stack.Screen options={{ title: weapon.name }} />
      {sheet?.photoUri ? (
        <Image source={{ uri: sheet.photoUri }} style={{ width: '100%', aspectRatio: 16 / 9, borderRadius: 14 }} resizeMode="cover" />
      ) : null}
      <View style={[styles.row, { flexWrap: 'wrap' }]}>
        <View style={{ flex: 1 }}>
          <Button label={sheet?.photoUri ? 'Changer la photo' : 'Ajouter une photo'} kind="secondary" onPress={choosePhoto} />
        </View>
        {sheet?.photoUri ? (
          <View style={{ flex: 1 }}>
            <Button label="Retirer la photo" kind="danger" onPress={() => saveWeaponSheet(weapon.id, { ...(mine ?? {}), photoUri: undefined })} />
          </View>
        ) : null}
      </View>

      <Card style={{ gap: 6 }}>
        <Text style={styles.title}>{weapon.name}</Text>
        <Text style={styles.muted}>
          {sheet?.action ?? WEAPON_TYPE_LABELS[weapon.type]} · {weapon.caliber}
        </Text>
        <ClassBadge range={sheet?.classRange} prefix="Niveau" />
        {sheet?.description ? <Text style={[styles.text, { marginTop: 4 }]}>{sheet.description}</Text> : null}
        <ChipRow>
          <Chip label={owned ? '✓ Possédée' : 'Je l’ai'} selected={owned} onPress={() => toggleOwned(weapon.id)} />
        </ChipRow>
      </Card>

      <SectionTitle>Caractéristiques</SectionTitle>
      <Card>
        <StatLine label="Niveau" value={formatClassRange(sheet?.classRange)} />
        <StatLine label="Calibre" value={weapon.caliber} />
        <StatLine label="Taille du chargeur" value={sheet?.magazine} />
        <StatLine label="Précision" value={sheet?.precision} />
        <StatLine label="Recul" value={sheet?.recoil} />
        <StatLine label="Bruit lors du tir" value={sheet?.noise} />
        {!sheet ? <Text style={styles.muted}>Pas encore de fiche : recopiez-la depuis l&apos;armurerie du jeu.</Text> : null}
      </Card>
      <Button
        label={sheet ? 'Modifier la fiche' : 'Remplir la fiche du jeu'}
        kind={sheet ? 'secondary' : 'primary'}
        onPress={() => router.push({ pathname: '/arme/fiche', params: { id: weapon.id } })}
      />

      <SectionTitle right={<Text style={styles.muted}>{ammo.length}</Text>}>Munitions en {weapon.caliber}</SectionTitle>
      {ammo.map((a) => (
        <Card key={a.id} onPress={() => router.push({ pathname: '/munition/[id]', params: { id: a.id } })}>
          <View style={styles.row}>
            <Thumb uri={a.photoUri} label={a.name.replace(/^Lewellings\s+/i, '')} size={44} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.strong}>{a.name}</Text>
              <Text style={styles.muted}>
                {a.projectile ?? 'Type inconnu'}
                {state.ownedAmmoIds.includes(a.id) ? ' · en stock' : ''}
              </Text>
            </View>
            <ClassBadge range={a.classRange} />
          </View>
        </Card>
      ))}
      <Button
        label={`+ Ajouter une munition ${weapon.caliber}`}
        kind="secondary"
        onPress={() => router.push({ pathname: '/munition/edition', params: { caliber: weapon.caliber } })}
      />

      {stats.count > 0 ? (
        <>
          <SectionTitle>Mes stats</SectionTitle>
          <Card>
            <StatLine label="Prélèvements" value={stats.count} />
            <StatLine label="Tués d'un tir" value={stats.oneShotRate !== undefined ? `${formatNumber(stats.oneShotRate * 100)} %` : undefined} />
            <StatLine label="Distance moyenne" value={stats.avgDistanceM !== undefined ? `${formatNumber(stats.avgDistanceM)} m` : undefined} />
            <StatLine label="Plus long tir" value={stats.maxDistanceM !== undefined ? `${formatNumber(stats.maxDistanceM)} m` : undefined} />
          </Card>
        </>
      ) : null}

      {weapon.custom ? (
        <View style={{ marginTop: 16 }}>
          {confirm ? (
            <Button
              label="Confirmer la suppression"
              kind="danger"
              onPress={() => {
                removeCustomWeapon(weapon.id);
                router.back();
              }}
            />
          ) : (
            <Button label="Supprimer cette arme" kind="danger" onPress={() => setConfirm(true)} />
          )}
          <Text style={[styles.muted, { textAlign: 'center', marginTop: 4, color: colors.textMuted, fontFamily: fonts.body }]}>
            Les chasses faites avec resteront, avec « Arme supprimée ».
          </Text>
        </View>
      ) : null}
    </Screen>
  );
}
