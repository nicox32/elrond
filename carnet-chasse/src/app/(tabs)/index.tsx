import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { HuntRow } from '../../components/HuntRow';
import {
  Button,
  Chip,
  ChipRow,
  Empty,
  Eyebrow,
  Reticle,
  Screen,
  SectionTitle,
  Stat,
  StatRow,
  TrophyFrame,
  styles,
} from '../../components/ui';
import { findWeapon, getReserve, getSpecies, HUNTING_RESERVES, SPECIES } from '../../data/game';
import { totalEarnings } from '../../logic/details';
import { isVisitDue } from '../../logic/herds';
import { formatNumber, formatScore, overview, sortByDateDesc } from '../../logic/stats';
import type { ReserveId } from '../../logic/types';
import { useCarnet } from '../../state/CarnetProvider';
import { colors, fonts } from '../../theme';


export default function JournalScreen() {
  const { state } = useCarnet();
  const [reserve, setReserve] = useState<ReserveId | undefined>(undefined);

  const stats = useMemo(() => overview(state.hunts, SPECIES, reserve), [state.hunts, reserve]);
  const hunts = useMemo(
    () => sortByDateDesc(reserve ? state.hunts.filter((h) => h.reserveId === reserve) : state.hunts),
    [state.hunts, reserve],
  );
  const best = useMemo(
    () =>
      hunts.reduce<(typeof hunts)[number] | undefined>(
        (b, h) => (h.trophyScore !== undefined && (b?.trophyScore === undefined || h.trophyScore > b.trophyScore) ? h : b),
        undefined,
      ),
    [hunts],
  );
  const bestWeapon = best ? findWeapon(best.weaponId, state.customWeapons) : undefined;

  return (
    <Screen>
      <View style={[styles.row, { justifyContent: 'space-between' }]}>
        <View style={{ gap: 2 }}>
          <Eyebrow>Way of the Hunter 2</Eyebrow>
          <Text style={styles.display}>AFFÛT</Text>
        </View>
        <Reticle size={50} />
      </View>

      {best && best.trophyScore !== undefined ? (
        <TrophyFrame onPress={() => router.push({ pathname: '/chasse/[id]', params: { id: best.id } })}>
          <View style={styles.row}>
            <View style={{ flex: 1, gap: 2 }}>
              <Eyebrow color={colors.gold}>Meilleur trophée</Eyebrow>
              <Text style={{ color: colors.text, fontFamily: fonts.heading, fontSize: 22 }} numberOfLines={1}>
                {getSpecies(best.speciesId)?.name ?? best.speciesId}
              </Text>
              <Text style={styles.muted} numberOfLines={1}>
                {[
                  getReserve(best.reserveId)?.name,
                  bestWeapon ? `${bestWeapon.name} ${bestWeapon.caliber}` : null,
                  best.distanceM !== undefined ? `${formatNumber(best.distanceM)} m` : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
            </View>
            <Text style={{ color: colors.gold, fontFamily: fonts.display, fontSize: 40 }}>{formatScore(best.trophyScore)}</Text>
          </View>
        </TrophyFrame>
      ) : null}

      <StatRow>
        <Stat value={String(stats.total)} label="Prélèv." />
        <Stat value={`${stats.speciesHunted}/${stats.speciesTotal}`} label="Espèces" divider />
        <Stat value={stats.maxDistanceM !== undefined ? `${formatNumber(stats.maxDistanceM)} m` : '—'} label="Dist. max" divider />
      </StatRow>
      {totalEarnings(hunts) > 0 ? (
        <Text style={[styles.muted, { textAlign: 'right' }]}>
          Gains notés : <Text style={{ color: colors.gold, fontFamily: fonts.semibold }}>{formatNumber(totalEarnings(hunts))}</Text>
        </Text>
      ) : null}

      <Button label="+ Nouvelle chasse" onPress={() => router.push('/chasse/edition')} />
      <Button label="🗺  Carte interactive des réserves" kind="secondary" onPress={() => router.push('/carte')} />

      {state.herds.some((h) => isVisitDue(h)) ? (
        <Pressable onPress={() => router.push('/troupeaux')} style={{ borderWidth: 1, borderColor: colors.accent, borderRadius: 14, padding: 12, backgroundColor: colors.accentSoft }}>
          <Text style={{ color: colors.accent, fontFamily: fonts.semibold, fontSize: 15 }}>
            {state.herds.filter((h) => isVisitDue(h)).length} troupeau(x) à revoir (dernière visite il y a plus de 24 h) →
          </Text>
        </Pressable>
      ) : null}

      <SectionTitle
        right={
          stats.toPlace > 0 ? (
            <Pressable onPress={() => router.push('/trophees')} hitSlop={8}>
              <Text style={{ color: colors.olive, fontFamily: fonts.semibold, fontSize: 13 }}>{stats.toPlace} à exposer →</Text>
            </Pressable>
          ) : null
        }
      >
        Mes chasses
      </SectionTitle>
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

      <View style={{ marginTop: 24, gap: 6 }}>
        <Button label="Sauvegarder / restaurer mes données" kind="secondary" onPress={() => router.push('/sauvegarde')} />
      </View>
    </Screen>
  );
}
