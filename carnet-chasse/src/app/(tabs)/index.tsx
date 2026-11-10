import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { HuntRow } from '../../components/HuntRow';
import { Button, Card, Chip, ChipRow, Empty, Screen, SectionTitle, Stat, Title, styles } from '../../components/ui';
import { GAME_VERSION, RESERVES, SPECIES } from '../../data/game';
import { formatNumber, overview, sortByDateDesc } from '../../logic/stats';
import type { ReserveId } from '../../logic/types';
import { useCarnet } from '../../state/CarnetProvider';
import { colors } from '../../theme';

const HUNTING_RESERVES = RESERVES.filter((r) => SPECIES.some((s) => s.reserveId === r.id));

export default function JournalScreen() {
  const { state } = useCarnet();
  const [reserve, setReserve] = useState<ReserveId | undefined>(undefined);

  const stats = useMemo(() => overview(state.hunts, SPECIES, reserve), [state.hunts, reserve]);
  const hunts = useMemo(
    () => sortByDateDesc(reserve ? state.hunts.filter((h) => h.reserveId === reserve) : state.hunts),
    [state.hunts, reserve],
  );

  return (
    <Screen>
      <Title subtitle={`Way of the Hunter 2 · données du jeu v${GAME_VERSION}`}>Carnet de chasse</Title>

      <Button label="+  Nouvelle chasse" onPress={() => router.push('/chasse/edition')} />

      <Card style={{ marginTop: 8 }}>
        <View style={styles.row}>
          <Stat value={String(stats.total)} label="prélèvements" />
          <Stat value={`${stats.speciesHunted}/${stats.speciesTotal}`} label="espèces" />
          <Stat value={stats.maxDistanceM !== undefined ? `${formatNumber(stats.maxDistanceM)} m` : '—'} label="plus long tir" />
        </View>
      </Card>

      {stats.toPlace > 0 ? (
        <Pressable onPress={() => router.push('/trophees')}>
          <Text style={{ color: colors.olive, fontWeight: '700', marginTop: 4 }}>
            {stats.toPlace} trophée{stats.toPlace > 1 ? 's' : ''} à exposer au pavillon →
          </Text>
        </Pressable>
      ) : null}

      <SectionTitle>Mes chasses</SectionTitle>
      <ChipRow>
        <Chip label="Toutes" selected={!reserve} onPress={() => setReserve(undefined)} />
        {HUNTING_RESERVES.map((r) => (
          <Chip key={r.id} label={r.name} selected={reserve === r.id} onPress={() => setReserve(r.id)} />
        ))}
      </ChipRow>

      {hunts.length === 0 ? (
        <Empty>
          Aucune chasse enregistrée{reserve ? ' dans cette réserve' : ''}.{'\n'}Touchez « Nouvelle chasse » après un
          prélèvement en jeu.
        </Empty>
      ) : (
        hunts.map((h) => <HuntRow key={h.id} hunt={h} customWeapons={state.customWeapons} />)
      )}

      <View style={{ marginTop: 24 }}>
        <Button label="Sauvegarder / restaurer mes données" kind="secondary" onPress={() => router.push('/sauvegarde')} />
      </View>
    </Screen>
  );
}
