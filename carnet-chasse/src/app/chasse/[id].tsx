import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Image, Text, View } from 'react-native';

import { Button, Card, Empty, Screen, styles } from '../../components/ui';
import { findWeapon, getReserve, getSpecies, SHOT_ZONE_LABELS, TROPHY_TYPE_LABELS } from '../../data/game';
import { formatDateTime, formatNumber, formatScore } from '../../logic/stats';
import { useCarnet } from '../../state/CarnetProvider';
import { colors } from '../../theme';

function Line({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <View style={[styles.row, { justifyContent: 'space-between', paddingVertical: 6 }]}>
      <Text style={styles.muted}>{label}</Text>
      <Text style={[styles.text, { flexShrink: 1, textAlign: 'right' }]}>{value}</Text>
    </View>
  );
}

export default function HuntScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state, deleteHunt, setPlaced } = useCarnet();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const hunt = state.hunts.find((h) => h.id === id);

  if (!hunt) {
    return (
      <Screen top={false}>
        <Empty>Cette chasse n&apos;existe plus.</Empty>
      </Screen>
    );
  }

  const species = getSpecies(hunt.speciesId);
  const weapon = findWeapon(hunt.weaponId, state.customWeapons);

  return (
    <Screen top={false}>
      <Stack.Screen options={{ title: species?.name ?? 'Chasse' }} />
      {hunt.photoUri ? (
        <Image source={{ uri: hunt.photoUri }} style={{ width: '100%', aspectRatio: 16 / 9, borderRadius: 14 }} resizeMode="cover" />
      ) : null}

      <Card>
        <Text style={styles.title}>{species?.name ?? hunt.speciesId}</Text>
        {species ? <Text style={styles.muted}>{species.gameName}</Text> : null}
        {hunt.trophyScore !== undefined ? (
          <Text style={{ color: colors.accent, fontSize: 30, fontWeight: '800', marginTop: 8 }}>
            {formatScore(hunt.trophyScore)} pts
          </Text>
        ) : null}
      </Card>

      <Card>
        <Line label="Date" value={formatDateTime(hunt.date)} />
        <Line label="Réserve" value={getReserve(hunt.reserveId)?.name} />
        <Line label="Arme" value={weapon ? `${weapon.name} (${weapon.caliber})` : 'Arme supprimée'} />
        <Line label="Munition" value={hunt.ammo} />
        <Line label="Distance" value={hunt.distanceM !== undefined ? `${formatNumber(hunt.distanceM)} m` : undefined} />
        <Line label="Zone touchée" value={hunt.shotZone ? SHOT_ZONE_LABELS[hunt.shotZone] : undefined} />
        <Line label="Tué d'un seul tir" value={hunt.oneShot ? 'Oui' : 'Non'} />
        <Line label="Trophée" value={TROPHY_TYPE_LABELS[hunt.trophyType]} />
        <Line label="Mode" value={hunt.mode === 'coop' ? 'Coop' : 'Solo'} />
        <Line label="Pavillon" value={hunt.toPlace ? 'À exposer' : 'Exposé ou non concerné'} />
      </Card>

      {hunt.notes ? (
        <Card>
          <Text style={styles.muted}>Notes</Text>
          <Text style={[styles.text, { marginTop: 4 }]}>{hunt.notes}</Text>
        </Card>
      ) : null}

      <View style={{ gap: 8, marginTop: 8 }}>
        {hunt.toPlace ? <Button label="Marquer comme exposé" kind="secondary" onPress={() => setPlaced(hunt.id)} /> : null}
        <Button label="Modifier" onPress={() => router.push({ pathname: '/chasse/edition', params: { id: hunt.id } })} />
        {confirmDelete ? (
          <Card style={{ gap: 8, borderColor: colors.danger }}>
            <Text style={styles.text}>Supprimer définitivement cette chasse ?</Text>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Button label="Annuler" kind="secondary" onPress={() => setConfirmDelete(false)} />
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  label="Supprimer"
                  kind="danger"
                  onPress={() => {
                    deleteHunt(hunt.id);
                    router.back();
                  }}
                />
              </View>
            </View>
          </Card>
        ) : (
          <Button label="Supprimer" kind="danger" onPress={() => setConfirmDelete(true)} />
        )}
      </View>
    </Screen>
  );
}
