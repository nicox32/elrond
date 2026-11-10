import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';

import { HuntRow } from '../../components/HuntRow';
import { Card, Chip, ChipRow, Screen, SectionTitle, Title, styles } from '../../components/ui';
import { RESERVES, SPECIES } from '../../data/game';
import { formatDate, formatScore, sortByDateDesc, summarizeSpecies } from '../../logic/stats';
import type { ReserveId } from '../../logic/types';
import { useCarnet } from '../../state/CarnetProvider';
import { colors, fonts } from '../../theme';

const HUNTING_RESERVES = RESERVES.filter((r) => SPECIES.some((s) => s.reserveId === r.id));

export default function TropheesScreen() {
  const { state } = useCarnet();
  const [reserve, setReserve] = useState<ReserveId>(state.lastReserveId ?? HUNTING_RESERVES[0].id);

  const summary = useMemo(() => summarizeSpecies(state.hunts), [state.hunts]);
  const toPlace = useMemo(() => sortByDateDesc(state.hunts.filter((h) => h.toPlace)), [state.hunts]);
  const huntedTotal = SPECIES.filter((s) => summary.has(s.id)).length;
  const list = SPECIES.filter((s) => s.reserveId === reserve);
  const huntedHere = list.filter((s) => summary.has(s.id)).length;

  return (
    <Screen>
      <Title subtitle={`${huntedTotal} espèce${huntedTotal > 1 ? 's' : ''} chassée${huntedTotal > 1 ? 's' : ''} sur ${SPECIES.length}`}>
        Mes trophées
      </Title>

      <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.surfaceAlt, overflow: 'hidden' }}>
        <View style={{ width: `${(huntedTotal / SPECIES.length) * 100}%`, height: '100%', backgroundColor: colors.accent }} />
      </View>

      {toPlace.length > 0 ? (
        <>
          <SectionTitle>À exposer au pavillon ({toPlace.length})</SectionTitle>
          {toPlace.map((h) => (
            <HuntRow key={h.id} hunt={h} customWeapons={state.customWeapons} />
          ))}
        </>
      ) : null}

      <SectionTitle right={<Text style={styles.muted}>{huntedHere}/{list.length}</Text>}>Par espèce</SectionTitle>
      <ChipRow>
        {HUNTING_RESERVES.map((r) => (
          <Chip key={r.id} label={r.name} selected={reserve === r.id} onPress={() => setReserve(r.id)} />
        ))}
      </ChipRow>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
        {list.map((s) => {
          const sum = summary.get(s.id);
          const best = sum?.bestHuntId;
          return (
            <Card
              key={s.id}
              style={{ width: '48.5%', flexGrow: 1, flexBasis: 150, opacity: sum ? 1 : 0.55, gap: 2 }}
              onPress={best ? () => router.push({ pathname: '/chasse/[id]', params: { id: best } }) : undefined}
            >
              <Text style={styles.strong} numberOfLines={2}>
                {s.name}
              </Text>
              {sum ? (
                <>
                  <Text style={{ color: colors.gold, fontSize: 24, fontFamily: fonts.heading }}>
                    {sum.bestScore !== undefined ? `${formatScore(sum.bestScore)} pts` : '—'}
                  </Text>
                  <Text style={styles.muted}>
                    {sum.count} prélèvement{sum.count > 1 ? 's' : ''}
                    {sum.lastDate ? ` · ${formatDate(sum.lastDate)}` : ''}
                  </Text>
                </>
              ) : (
                <Text style={styles.muted}>Pas encore chassé</Text>
              )}
            </Card>
          );
        })}
      </View>
    </Screen>
  );
}
