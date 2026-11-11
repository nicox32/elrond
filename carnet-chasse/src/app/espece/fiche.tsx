import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { Button, Card, Chip, ChipRow, Empty, Field, Label, Screen, SectionTitle, styles } from '../../components/ui';
import { getSpecies } from '../../data/game';
import { ENERGY_LABELS, getSpeciesInfo, SPECIES_INFO } from '../../data/speciesInfo';
import { NEED_ICONS, NEED_LABELS } from '../../logic/schedule';
import { parseNumber } from '../../logic/stats';
import type { EnergyRange, NeedType, SpeciesSheet } from '../../logic/types';
import { useCarnet } from '../../state/CarnetProvider';
import { colors, fonts } from '../../theme';

type EnergyKey = keyof SpeciesSheet['energy'];
type EnergyDraft = { min: string; max: string; inadapte: boolean };

const TROPHY_TYPES = ['Bois', 'Cornes', 'Défenses', 'Crâne'];
const ACTIVITIES = ['Diurne', 'Nocturne', 'Crépusculaire'];
const SENSE_LEVELS = ['Faible', 'Moyen(ne)', 'Bon(ne)', 'Excellent(e)'];
const NEEDS: NeedType[] = ['boire', 'manger', 'dormir'];

const txt = (n: number | undefined) => (n === undefined ? '' : String(n).replace('.', ','));

function SenseRow({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <>
      <Label>{label}</Label>
      <ChipRow>
        {SENSE_LEVELS.map((l) => (
          <Chip key={l} label={l} selected={value === l} onPress={() => onChange(value === l ? '' : l)} />
        ))}
      </ChipRow>
    </>
  );
}

export default function FicheScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state, saveSheet } = useCarnet();
  const species = getSpecies(id);
  const info = getSpeciesInfo(id, state.speciesSheets);
  const hasMine = !!state.speciesSheets[id];

  const [animalClass, setAnimalClass] = useState(txt(info?.animalClass));
  const [trophyType, setTrophyType] = useState(info?.trophyType ?? '');
  const [trophyMin, setTrophyMin] = useState(txt(info?.trophyRange?.[0]));
  const [trophyMax, setTrophyMax] = useState(txt(info?.trophyRange?.[1]));
  const [activity, setActivity] = useState(info?.activity ?? '');
  const [activityNote, setActivityNote] = useState(info?.activityNote ?? '');
  const [routine, setRoutine] = useState<{ hour: string; need: NeedType }[]>(
    () => info?.routine?.map((p) => ({ hour: String(p.hour), need: p.need })) ?? [],
  );
  const [vue, setVue] = useState(info?.senses?.vue ?? '');
  const [odorat, setOdorat] = useState(info?.senses?.odorat ?? '');
  const [ouie, setOuie] = useState(info?.senses?.ouie ?? '');
  const [energy, setEnergy] = useState<Record<EnergyKey, EnergyDraft>>(() => {
    const out = {} as Record<EnergyKey, EnergyDraft>;
    for (const e of ENERGY_LABELS) {
      const r = info?.energy[e.key];
      out[e.key] = { min: r ? String(r[0]) : '', max: r ? String(r[1]) : '', inadapte: r === null };
    }
    return out;
  });
  const [biomes, setBiomes] = useState(info?.biomes ?? '');
  const [description, setDescription] = useState(info?.description ?? '');
  const [anecdote, setAnecdote] = useState(info?.anecdote ?? '');
  const [error, setError] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  if (!species) {
    return (
      <Screen top={false}>
        <Empty>Espèce inconnue.</Empty>
      </Screen>
    );
  }

  const setE = (k: EnergyKey, patch: Partial<EnergyDraft>) => setEnergy((e) => ({ ...e, [k]: { ...e[k], ...patch } }));

  function save() {
    const cls = animalClass.trim() ? parseNumber(animalClass) : undefined;
    if (animalClass.trim() && (cls === undefined || !Number.isInteger(cls) || cls < 1 || cls > 10)) {
      return setError('Classe invalide (nombre entier de 1 à 10).');
    }
    const tMin = parseNumber(trophyMin);
    const tMax = parseNumber(trophyMax);
    if ((trophyMin.trim() || trophyMax.trim()) && (tMin === undefined || tMax === undefined || tMax < tMin)) {
      return setError('Rangs de trophée : indiquez un minimum et un maximum (ex. 115 et 610).');
    }
    const energyOut: SpeciesSheet['energy'] = {};
    for (const e of ENERGY_LABELS) {
      const d = energy[e.key];
      if (d.inadapte) {
        energyOut[e.key] = null;
        continue;
      }
      if (!d.min.trim() && !d.max.trim()) continue;
      const a = parseNumber(d.min);
      const b = parseNumber(d.max);
      if (a === undefined || b === undefined || b < a) return setError(`${e.label} : indiquez un minimum et un maximum.`);
      energyOut[e.key] = [a, b] as EnergyRange;
    }
    const phases: { hour: number; need: NeedType }[] = [];
    for (const p of routine) {
      const h = Number(p.hour.trim());
      if (!p.hour.trim() || !Number.isInteger(h) || h < 0 || h > 23) return setError('Routine : heures de 0 à 23.');
      if (phases.some((x) => x.hour === h)) return setError(`Routine : l'heure ${h} h apparaît deux fois.`);
      phases.push({ hour: h, need: p.need });
    }
    phases.sort((a, b) => a.hour - b.hour);

    saveSheet(species!.id, {
      animalClass: cls,
      trophyType: trophyType.trim() || undefined,
      trophyRange: tMin !== undefined && tMax !== undefined ? [tMin, tMax] : undefined,
      energy: energyOut,
      activity: activity.trim() || undefined,
      activityNote: activityNote.trim() || undefined,
      routine: phases.length ? phases : undefined,
      senses: vue || odorat || ouie ? { vue, odorat, ouie } : undefined,
      biomes: biomes.trim() || undefined,
      description: description.trim() || undefined,
      anecdote: anecdote.trim() || undefined,
    });
    router.back();
  }

  return (
    <Screen top={false}>
      <Stack.Screen options={{ title: `Fiche · ${species.name}` }} />
      <Card style={{ gap: 4 }}>
        <Text style={styles.strong}>Recopiez la fiche de l&apos;encyclopédie</Text>
        <Text style={styles.muted}>
          En jeu : Encyclopédie › Animaux › {species.name} (débloquée après le premier prélèvement). Tout est facultatif :
          remplissez ce qui vous sert.
        </Text>
      </Card>

      <SectionTitle>Identité</SectionTitle>
      <View style={[styles.row, { flexWrap: 'wrap' }]}>
        <View style={{ width: 120 }}>
          <Field label="Classe" value={animalClass} onChangeText={setAnimalClass} keyboardType="number-pad" placeholder="6" />
        </View>
        <Field label="Rang min" value={trophyMin} onChangeText={setTrophyMin} keyboardType="decimal-pad" placeholder="115" />
        <Field label="Rang max" value={trophyMax} onChangeText={setTrophyMax} keyboardType="decimal-pad" placeholder="610" />
      </View>
      <Label>Type de trophée</Label>
      <ChipRow>
        {TROPHY_TYPES.map((t) => (
          <Chip key={t} label={t} selected={trophyType === t} onPress={() => setTrophyType(trophyType === t ? '' : t)} />
        ))}
      </ChipRow>

      <SectionTitle>Routine quotidienne</SectionTitle>
      <ChipRow>
        {ACTIVITIES.map((a) => (
          <Chip key={a} label={a} selected={activity === a} onPress={() => setActivity(activity === a ? '' : a)} />
        ))}
      </ChipRow>
      <Field label="Précision" value={activityNote} onChangeText={setActivityNote} placeholder="Actif le soir et le matin" />
      <Text style={[styles.muted, { marginTop: 10 }]}>
        Recopiez la frise : chaque icône marque le début d&apos;une phase (ex. 💧 à 00 h, 💤 à 02 h, 🌿 à 07 h…).
      </Text>
      {routine.map((p, i) => (
        <View key={i} style={[styles.row, { marginTop: 8 }]}>
          <TextInput
            value={p.hour}
            onChangeText={(t) => setRoutine((r) => r.map((x, j) => (j === i ? { ...x, hour: t } : x)))}
            keyboardType="number-pad"
            placeholder="h"
            placeholderTextColor={colors.textMuted}
            style={[styles.input, { width: 60, textAlign: 'center' }]}
            accessibilityLabel="Heure de début"
          />
          <Text style={styles.muted}>h</Text>
          <View style={[styles.row, { flex: 1, flexWrap: 'wrap', gap: 6 }]}>
            {NEEDS.map((n) => (
              <Chip
                key={n}
                label={`${NEED_ICONS[n]} ${NEED_LABELS[n]}`}
                selected={p.need === n}
                onPress={() => setRoutine((r) => r.map((x, j) => (j === i ? { ...x, need: n } : x)))}
              />
            ))}
          </View>
          <Pressable
            onPress={() => setRoutine((r) => r.filter((_, j) => j !== i))}
            accessibilityRole="button"
            accessibilityLabel="Retirer cette phase"
            hitSlop={8}
            style={{ width: 32, height: 44, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text style={{ color: colors.danger, fontFamily: fonts.heading, fontSize: 22 }}>×</Text>
          </Pressable>
        </View>
      ))}
      <View style={{ marginTop: 8 }}>
        <Button
          label="+ Ajouter une phase"
          kind="secondary"
          onPress={() =>
            setRoutine((r) => [...r, { hour: '', need: NEEDS[(r.length ? NEEDS.indexOf(r[r.length - 1].need) + 1 : 0) % 3] }])
          }
        />
      </View>

      <SectionTitle>Énergie cinétique recommandée</SectionTitle>
      {ENERGY_LABELS.map((e) => (
        <View key={e.key} style={{ marginBottom: 6 }}>
          <View style={[styles.row, { justifyContent: 'space-between' }]}>
            <Label>
              {e.label} ({e.unit})
            </Label>
            <Chip label="Inadapté" tone="danger" selected={energy[e.key].inadapte} onPress={() => setE(e.key, { inadapte: !energy[e.key].inadapte })} />
          </View>
          {!energy[e.key].inadapte ? (
            <View style={styles.row}>
              <TextInput
                value={energy[e.key].min}
                onChangeText={(t) => setE(e.key, { min: t })}
                keyboardType="decimal-pad"
                placeholder="min"
                placeholderTextColor={colors.textMuted}
                style={[styles.input, { flex: 1 }]}
                accessibilityLabel={`${e.label} minimum`}
              />
              <Text style={styles.muted}>à</Text>
              <TextInput
                value={energy[e.key].max}
                onChangeText={(t) => setE(e.key, { max: t })}
                keyboardType="decimal-pad"
                placeholder="max"
                placeholderTextColor={colors.textMuted}
                style={[styles.input, { flex: 1 }]}
                accessibilityLabel={`${e.label} maximum`}
              />
            </View>
          ) : null}
        </View>
      ))}

      <SectionTitle>Sens</SectionTitle>
      <SenseRow label="Vue" value={vue} onChange={setVue} />
      <SenseRow label="Odorat" value={odorat} onChange={setOdorat} />
      <SenseRow label="Ouïe" value={ouie} onChange={setOuie} />

      <SectionTitle>Textes</SectionTitle>
      <Field label="Biomes préférés" value={biomes} onChangeText={setBiomes} multiline placeholder="Forêts, prairies…" style={{ minHeight: 60, textAlignVertical: 'top' }} />
      <Field label="Description" value={description} onChangeText={setDescription} multiline style={{ minHeight: 70, textAlignVertical: 'top' }} />
      <Field label="Anecdote" value={anecdote} onChangeText={setAnecdote} multiline style={{ minHeight: 50, textAlignVertical: 'top' }} />

      {error ? <Text style={{ color: colors.danger, fontFamily: fonts.semibold, marginTop: 12 }}>{error}</Text> : null}
      <View style={{ marginTop: 16, gap: 8 }}>
        <Button label="Enregistrer la fiche" onPress={save} />
        {hasMine ? (
          confirmClear ? (
            <Button
              label={SPECIES_INFO[species.id] ? 'Confirmer : revenir à la fiche fournie' : 'Confirmer : effacer ma fiche'}
              kind="danger"
              onPress={() => {
                saveSheet(species.id, null);
                router.back();
              }}
            />
          ) : (
            <Button label="Effacer ma fiche" kind="danger" onPress={() => setConfirmClear(true)} />
          )
        ) : null}
      </View>
    </Screen>
  );
}
