import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';

import { Card, Chip, ChipRow, Screen, SectionTitle, Title, styles } from '../../components/ui';
import { allWeapons, CATEGORY_LABELS, RESERVES, SPECIES, speciesOfReserve, SUGGESTED_CALIBERS } from '../../data/game';
import { getSpeciesInfo, speciesClass } from '../../data/speciesInfo';
import { summarizeSpecies } from '../../logic/stats';
import type { ReserveId, SpeciesCategory } from '../../logic/types';
import { useCarnet } from '../../state/CarnetProvider';
import { colors, fonts } from '../../theme';

const CATEGORIES = Object.keys(CATEGORY_LABELS) as SpeciesCategory[];

export default function EspecesScreen() {
  const { state } = useCarnet();
  const [reserve, setReserve] = useState<ReserveId>('new-laurentia');
  const summary = useMemo(() => summarizeSpecies(state.hunts), [state.hunts]);
  const owned = allWeapons(state.customWeapons).filter((w) => state.ownedWeaponIds.includes(w.id));
  const current = RESERVES.find((r) => r.id === reserve);
  const list = speciesOfReserve(reserve);

  return (
    <Screen>
      <Title subtitle={`${SPECIES.length} espèces chassables`}>Espèces et réserves</Title>
      <ChipRow>
        {RESERVES.map((r) => (
          <Chip key={r.id} label={r.name} selected={reserve === r.id} onPress={() => setReserve(r.id)} />
        ))}
      </ChipRow>

      {current ? (
        <Card style={{ marginTop: 4 }}>
          <Text style={styles.strong}>{current.name}</Text>
          <Text style={styles.muted}>
            {current.region} · {current.areaKm2} km²
            {list.length ? ` · ${list.length} espèces` : ''}
          </Text>
          <Text style={[styles.text, { marginTop: 6 }]}>{current.description}</Text>
          <Text style={[styles.muted, { marginTop: 2 }]}>{current.story ? 'Mode histoire : oui' : 'Pas de scénario dédié'}</Text>
          {list.length === 0 ? (
            <Text style={[styles.muted, { marginTop: 6 }]}>
              Zone centrale (hub) : le studio n&apos;a pas publié de liste d&apos;animaux pour cette carte.
            </Text>
          ) : null}
        </Card>
      ) : null}

      {CATEGORIES.map((c) => {
        const group = list.filter((s) => s.category === c);
        if (group.length === 0) return null;
        const calibers = SUGGESTED_CALIBERS[c];
        const myWeapons = owned.filter((w) => calibers.includes(w.caliber));
        return (
          <View key={c} style={{ gap: 8 }}>
            <SectionTitle>{CATEGORY_LABELS[c]}</SectionTitle>
            <Text style={styles.muted}>Calibres indicatifs : {calibers.join(', ')}</Text>
            {owned.length > 0 ? (
              <Text style={{ color: myWeapons.length ? colors.olive : colors.danger, fontSize: 13 }}>
                {myWeapons.length
                  ? `Vos armes adaptées : ${myWeapons.map((w) => w.name).join(', ')}`
                  : 'Aucune de vos armes ne tire ces calibres.'}
              </Text>
            ) : null}
            {group.map((s) => {
              const count = summary.get(s.id)?.count ?? 0;
              return (
                <Card
                  key={s.id}
                  onPress={() => router.push({ pathname: '/espece/[id]', params: { id: s.id } })}
                  style={{ gap: 2, borderColor: s.dangerous ? colors.danger : colors.border }}
                >
                  <View style={[styles.row, { justifyContent: 'space-between' }]}>
                    <Text style={[styles.strong, { flex: 1 }]}>{s.name}</Text>
                    {count > 0 ? <Text style={{ color: colors.accent, fontFamily: fonts.semibold }}>×{count}</Text> : null}
                  </View>
                  <Text style={styles.muted}>
                    {s.gameName}
                    {speciesClass(s.id, state.speciesSheets) ? ` · classe ${speciesClass(s.id, state.speciesSheets)}` : ''}
                    {getSpeciesInfo(s.id, state.speciesSheets)
                      ? ' · fiche du jeu'
                      : count > 0
                        ? ' · fiche à recopier'
                        : ''}
                  </Text>
                  {s.blurb ? <Text style={[styles.text, { fontSize: 14 }]}>{s.blurb}</Text> : null}
                  {s.dangerous ? (
                    <Text style={{ color: colors.danger, fontSize: 13, fontFamily: fonts.semibold }}>⚠ Peut charger le chasseur</Text>
                  ) : null}
                </Card>
              );
            })}
          </View>
        );
      })}

      <Text style={[styles.muted, { marginTop: 16 }]}>
        Calibres conseillés à titre indicatif : vérifiez en jeu.
      </Text>
    </Screen>
  );
}
