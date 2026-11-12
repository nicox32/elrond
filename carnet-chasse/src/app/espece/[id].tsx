import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';

import { HuntRow } from '../../components/HuntRow';
import { Button, Card, Empty, Screen, SectionTitle, styles } from '../../components/ui';
import { CATEGORY_LABELS, getReserve, getSpecies, SUGGESTED_CALIBERS, SUGGESTED_DISTANCE } from '../../data/game';
import { ammoForAnimalClass, formatClassRange } from '../../data/armory';
import { ENERGY_LABELS, formatRange, getSpeciesInfo, routineSlots, speciesClass } from '../../data/speciesInfo';
import { NEED_ICONS, NEED_LABELS } from '../../logic/schedule';
import { formatScore, sortByDateDesc, summarizeSpecies } from '../../logic/stats';
import type { NeedType } from '../../logic/types';
import { useCarnet } from '../../state/CarnetProvider';
import { colors, fonts } from '../../theme';

const NEED_COLORS: Record<NeedType, string> = { boire: '#5AA9E6', manger: colors.olive, dormir: colors.textMuted };

function Line({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <View style={[styles.row, { justifyContent: 'space-between', paddingVertical: 5 }]}>
      <Text style={styles.muted}>{label}</Text>
      <Text style={[styles.text, { flexShrink: 1, textAlign: 'right' }]}>{value}</Text>
    </View>
  );
}

export default function EspeceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state } = useCarnet();
  const species = getSpecies(id);
  if (!species) {
    return (
      <Screen top={false}>
        <Empty>Espèce inconnue.</Empty>
      </Screen>
    );
  }
  const info = getSpeciesInfo(species.id, state.speciesSheets);
  const summary = summarizeSpecies(state.hunts).get(species.id);
  const hunts = sortByDateDesc(state.hunts.filter((h) => h.speciesId === species.id)).slice(0, 5);
  const herds = state.herds.filter((h) => h.speciesId === species.id);
  const cls = speciesClass(species.id, state.speciesSheets);
  const goodAmmo = ammoForAnimalClass(cls, state.ammoSheets, state.ownedAmmoIds);

  return (
    <Screen top={false}>
      <Stack.Screen options={{ title: species.name }} />
      <Card style={{ gap: 4 }}>
        <Text style={styles.title}>{species.name}</Text>
        <Text style={styles.muted}>
          {species.gameName} · {[species.reserveId, ...(species.alsoIn ?? [])].map((r) => getReserve(r)?.name).join(', ')}
        </Text>
        <View style={[styles.row, { marginTop: 6, flexWrap: 'wrap' }]}>
          {cls ? (
            <View style={{ borderWidth: 1, borderColor: colors.gold, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 }}>
              <Text style={{ color: colors.gold, fontFamily: fonts.heading, fontSize: 16 }}>Classe {cls}</Text>
            </View>
          ) : null}
          <Text style={styles.muted}>{CATEGORY_LABELS[species.category]}</Text>
          {species.dangerous ? <Text style={{ color: colors.danger, fontFamily: fonts.semibold }}>⚠ Peut charger</Text> : null}
        </View>
        {species.blurb ? <Text style={[styles.text, { marginTop: 6 }]}>{species.blurb}</Text> : null}
        {summary ? (
          <Text style={[styles.text, { marginTop: 6 }]}>
            {summary.count} prélèvement{summary.count > 1 ? 's' : ''}
            {summary.bestScore !== undefined ? ` · record ${formatScore(summary.bestScore)} pts` : ''}
          </Text>
        ) : null}
      </Card>

      {info ? (
        <>
          <SectionTitle>Fiche du jeu</SectionTitle>
          {info.description ? (
            <Card>
              <Text style={styles.text}>{info.description}</Text>
            </Card>
          ) : null}

          {info.matureAgeYears !== undefined || info.lifespanYears !== undefined ? (
            <Card style={{ gap: 2 }}>
              <Text style={styles.strong}>Âges</Text>
              {info.matureAgeYears !== undefined ? <Text style={styles.text}>Mûr à partir de {info.matureAgeYears} ans</Text> : null}
              {info.lifespanYears !== undefined ? (
                <Text style={styles.text}>
                  Espérance de vie : {info.lifespanYears} ans (dernière année à partir de {Math.max(0, info.lifespanYears - 1)} ans)
                </Text>
              ) : null}
            </Card>
          ) : null}

          {info.activity || info.routine ? (
          <Card style={{ gap: 8 }}>
            <Text style={styles.strong}>
              Routine{info.activity ? ` : ${info.activity}` : ''}
              {info.activityNote ? <Text style={styles.muted}> · {info.activityNote}</Text> : null}
            </Text>
            {info.routine ? (
              <>
                <View style={{ flexDirection: 'row', height: 14, borderRadius: 7, overflow: 'hidden' }}>
                  {routineSlots(info).map((r) => {
                    const len = (r.to - r.from + 24) % 24 || 24;
                    return <View key={r.from} style={{ flex: len, backgroundColor: NEED_COLORS[r.need], borderRightWidth: 1, borderRightColor: colors.background }} />;
                  })}
                </View>
                {routineSlots(info).map((r) => (
                  <Text key={r.from} style={styles.text}>
                    <Text style={{ color: NEED_COLORS[r.need], fontFamily: fonts.semibold }}>
                      {NEED_ICONS[r.need]} {NEED_LABELS[r.need]}
                    </Text>{' '}
                    {String(r.from).padStart(2, '0')} h – {String(r.to).padStart(2, '0')} h
                  </Text>
                ))}
              </>
            ) : null}
          </Card>
          ) : null}

          {ENERGY_LABELS.some((e) => info.energy[e.key] !== undefined) ? (
            <Card>
              <Text style={[styles.strong, { marginBottom: 4 }]}>Énergie cinétique recommandée</Text>
              {ENERGY_LABELS.map((e) => (
                <Line key={e.key} label={e.label} value={formatRange(info.energy[e.key], e.unit)} />
              ))}
            </Card>
          ) : null}

          <Card>
            <Line label="Type de trophée" value={info.trophyType} />
            <Line label="Rangs de trophée estimés" value={info.trophyRange ? `${info.trophyRange[0]} – ${info.trophyRange[1]}` : undefined} />
            <Line label="Vue" value={info.senses?.vue} />
            <Line label="Odorat" value={info.senses?.odorat} />
            <Line label="Ouïe" value={info.senses?.ouie} />
            {info.biomes ? <Text style={[styles.muted, { marginTop: 6 }]}>Biomes : {info.biomes}</Text> : null}
          </Card>
          {info.anecdote ? <Text style={[styles.muted, { fontStyle: 'italic' }]}>Anecdote : {info.anecdote}</Text> : null}
          <Button
            label="Modifier la fiche"
            kind="secondary"
            onPress={() => router.push({ pathname: '/espece/fiche', params: { id: species.id } })}
          />
        </>
      ) : (
        <>
          <SectionTitle>Repères</SectionTitle>
          <Card>
            <Line label="Calibres indicatifs" value={SUGGESTED_CALIBERS[species.category].join(', ')} />
            <Line label="Distance conseillée" value={SUGGESTED_DISTANCE[species.category]} />
            <Text style={[styles.muted, { marginTop: 6 }]}>
              {summary
                ? 'Vous avez prélevé cette espèce : sa fiche est débloquée dans l’encyclopédie du jeu (Animaux). Recopiez-la ici.'
                : 'La fiche du jeu se débloque après le premier prélèvement de l’espèce.'}
            </Text>
          </Card>
          <Button
            label="Remplir la fiche du jeu"
            kind={summary ? 'primary' : 'secondary'}
            onPress={() => router.push({ pathname: '/espece/fiche', params: { id: species.id } })}
          />
        </>
      )}

      {cls ? (
        <>
          <SectionTitle right={<Text style={styles.muted}>classe {cls}</Text>}>Munitions à prendre</SectionTitle>
          {goodAmmo.length === 0 ? (
            <Text style={styles.muted}>Aucune munition connue de classe {cls} : ajoutez-en dans l&apos;Armurerie.</Text>
          ) : (
            goodAmmo.map((a) => {
              const owned = state.ownedAmmoIds.includes(a.id);
              return (
                <Card key={a.id} onPress={() => router.push({ pathname: '/munition/[id]', params: { id: a.id } })}>
                  <View style={styles.row}>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={styles.strong}>{a.name}</Text>
                      <Text style={styles.muted}>
                        {a.caliber} · classe {formatClassRange(a.classRange)}
                        {a.projectile ? ` · ${a.projectile}` : ''}
                      </Text>
                    </View>
                    <Text style={{ color: owned ? colors.olive : colors.accent, fontFamily: fonts.semibold, fontSize: 13 }}>
                      {owned ? '✓ en stock' : 'à acheter'}
                    </Text>
                  </View>
                </Card>
              );
            })
          )}
        </>
      ) : null}

      <SectionTitle right={<Text style={styles.muted}>{herds.length}</Text>}>Troupeaux suivis</SectionTitle>
      {herds.map((h) => (
        <Card key={h.id} onPress={() => router.push({ pathname: '/troupeau/[id]', params: { id: h.id } })}>
          <Text style={styles.strong}>{h.name}</Text>
          <Text style={styles.muted}>{h.animals.filter((a) => a.status === 'vivant').length} animaux vivants</Text>
        </Card>
      ))}
      <Button label="+ Suivre un troupeau" kind="secondary" onPress={() => router.push('/troupeaux')} />

      {hunts.length ? (
        <>
          <SectionTitle>Dernières chasses</SectionTitle>
          {hunts.map((h) => (
            <HuntRow key={h.id} hunt={h} customWeapons={state.customWeapons} />
          ))}
        </>
      ) : null}
    </Screen>
  );
}
