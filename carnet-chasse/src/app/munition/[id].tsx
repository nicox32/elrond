import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Image, Text, View } from 'react-native';

import { ClassBadge, StatLine, Thumb } from '../../components/armory';
import { HuntRow } from '../../components/HuntRow';
import { Button, Card, Chip, ChipRow, Empty, Screen, SectionTitle, styles } from '../../components/ui';
import { AMMO, allAmmo, formatClassRange, sameCaliber } from '../../data/armory';
import { allWeapons } from '../../data/game';
import { sortByDateDesc } from '../../logic/stats';
import { pickTrophyPhoto } from '../../photos';
import { useCarnet } from '../../state/CarnetProvider';

export default function MunitionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state, saveAmmo, removeAmmoSheet, toggleOwnedAmmo } = useCarnet();
  const [confirm, setConfirm] = useState(false);
  const ammo = allAmmo(state.ammoSheets).find((a) => a.id === id);

  if (!ammo) {
    return (
      <Screen top={false}>
        <Empty>Cette munition n&apos;existe plus.</Empty>
      </Screen>
    );
  }

  const builtIn = AMMO.some((a) => a.id === ammo.id);
  const owned = state.ownedAmmoIds.includes(ammo.id);
  const weapons = allWeapons(state.customWeapons).filter((w) => sameCaliber(w.caliber, ammo.caliber));
  const hunts = sortByDateDesc(state.hunts.filter((h) => h.ammo && h.ammo.toLowerCase() === ammo.name.toLowerCase())).slice(0, 5);

  async function choosePhoto() {
    const uri = await pickTrophyPhoto('munition');
    if (uri) saveAmmo({ ...ammo!, photoUri: uri, custom: !builtIn });
  }

  return (
    <Screen top={false}>
      <Stack.Screen options={{ title: ammo.name }} />
      {ammo.photoUri ? (
        <Image source={{ uri: ammo.photoUri }} style={{ width: '100%', aspectRatio: 16 / 9, borderRadius: 14 }} resizeMode="cover" />
      ) : null}
      <View style={[styles.row, { flexWrap: 'wrap' }]}>
        <View style={{ flex: 1 }}>
          <Button label={ammo.photoUri ? 'Changer la photo' : 'Ajouter une photo'} kind="secondary" onPress={choosePhoto} />
        </View>
        {ammo.photoUri ? (
          <View style={{ flex: 1 }}>
            <Button label="Retirer la photo" kind="danger" onPress={() => saveAmmo({ ...ammo, photoUri: undefined, custom: !builtIn })} />
          </View>
        ) : null}
      </View>

      <Card style={{ gap: 6 }}>
        <Text style={styles.title}>{ammo.name}</Text>
        <Text style={styles.muted}>
          {ammo.caliber}
          {ammo.brand ? ` · ${ammo.brand}` : ''}
        </Text>
        <ClassBadge range={ammo.classRange} />
        {ammo.description ? <Text style={[styles.text, { marginTop: 4 }]}>{ammo.description}</Text> : null}
        <ChipRow>
          <Chip label={owned ? '✓ En stock' : 'Je l’ai'} selected={owned} onPress={() => toggleOwnedAmmo(ammo.id)} />
        </ChipRow>
      </Card>

      <SectionTitle>Caractéristiques</SectionTitle>
      <Card>
        <StatLine label="Classe" value={formatClassRange(ammo.classRange)} />
        <StatLine label="Type de projectile" value={ammo.projectile} />
        <StatLine label="Pénétration" value={ammo.penetration} />
        <StatLine label="Recul réduit" value={ammo.recoilReduced} />
        <StatLine label="Précision" value={ammo.precision} />
        <StatLine label="Taille de cavité" value={ammo.cavity} />
      </Card>
      <Button label="Modifier la fiche" kind="secondary" onPress={() => router.push({ pathname: '/munition/edition', params: { id: ammo.id } })} />

      <SectionTitle right={<Text style={styles.muted}>{weapons.length}</Text>}>Armes compatibles</SectionTitle>
      {weapons.length === 0 ? <Text style={styles.muted}>Aucune arme de ce calibre dans la liste.</Text> : null}
      {weapons.map((w) => (
        <Card key={w.id} onPress={() => router.push({ pathname: '/arme/[id]', params: { id: w.id } })}>
          <View style={styles.row}>
            <Thumb uri={state.weaponSheets[w.id]?.photoUri} label={w.name} size={40} />
            <Text style={[styles.strong, { flex: 1 }]}>{w.name}</Text>
            {state.ownedWeaponIds.includes(w.id) ? <Text style={styles.muted}>possédée</Text> : null}
          </View>
        </Card>
      ))}

      {hunts.length ? (
        <>
          <SectionTitle>Chasses avec cette munition</SectionTitle>
          {hunts.map((h) => (
            <HuntRow key={h.id} hunt={h} customWeapons={state.customWeapons} />
          ))}
        </>
      ) : null}

      {state.ammoSheets[ammo.id] ? (
        <View style={{ marginTop: 16 }}>
          {confirm ? (
            <Button
              label={builtIn ? 'Confirmer : revenir à la fiche fournie' : 'Confirmer la suppression'}
              kind="danger"
              onPress={() => {
                removeAmmoSheet(ammo.id);
                if (!builtIn) router.back();
                setConfirm(false);
              }}
            />
          ) : (
            <Button label={builtIn ? 'Revenir à la fiche fournie' : 'Supprimer cette munition'} kind="danger" onPress={() => setConfirm(true)} />
          )}
        </View>
      ) : null}
    </Screen>
  );
}
