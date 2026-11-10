import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';

import { Button, Card, Chip, ChipRow, Field, Label, Screen, styles } from '../../components/ui';
import {
  allWeapons,
  CATEGORY_LABELS,
  findWeapon,
  RESERVES,
  SHOT_ZONE_LABELS,
  SPECIES,
  speciesOfReserve,
  SUGGESTED_CALIBERS,
  TROPHY_TYPE_LABELS,
} from '../../data/game';
import { formatDate, formatNumber, formatScore, parseNumber } from '../../logic/stats';
import type { HuntMode, ReserveId, ShotZone, TrophyType } from '../../logic/types';
import { pickTrophyPhoto } from '../../photos';
import { useCarnet } from '../../state/CarnetProvider';
import { colors } from '../../theme';

const HUNTING_RESERVES = RESERVES.filter((r) => SPECIES.some((s) => s.reserveId === r.id));

/** « 10/11/2026 » → date ISO en gardant l'heure de `base`. */
function parseDate(text: string, base: Date): string | undefined {
  const m = text.trim().match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (!m) return undefined;
  const d = new Date(base);
  d.setFullYear(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  if (d.getDate() !== Number(m[1]) || d.getMonth() !== Number(m[2]) - 1) return undefined;
  return d.toISOString();
}

export default function EditionScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { state, addHunt, updateHunt } = useCarnet();
  const existing = id ? state.hunts.find((h) => h.id === id) : undefined;

  const [baseDate] = useState(() => (existing ? new Date(existing.date) : new Date()));
  const [dateText, setDateText] = useState(() => formatDate(baseDate.toISOString()));
  const [reserveId, setReserveId] = useState<ReserveId>(
    existing?.reserveId ?? state.lastReserveId ?? HUNTING_RESERVES[0].id,
  );
  const [speciesId, setSpeciesId] = useState<string | undefined>(existing?.speciesId);
  const [weaponId, setWeaponId] = useState<string | undefined>(existing?.weaponId ?? state.lastWeaponId);
  const [showAllWeapons, setShowAllWeapons] = useState(state.ownedWeaponIds.length === 0);
  const [ammo, setAmmo] = useState(existing?.ammo ?? '');
  const [distance, setDistance] = useState(existing?.distanceM !== undefined ? formatNumber(existing.distanceM) : '');
  const [shotZone, setShotZone] = useState<ShotZone | undefined>(existing?.shotZone);
  const [oneShot, setOneShot] = useState(existing?.oneShot ?? false);
  const [score, setScore] = useState(
    existing?.trophyScore !== undefined ? formatScore(existing.trophyScore) : '',
  );
  const [trophyType, setTrophyType] = useState<TrophyType>(existing?.trophyType ?? 'normal');
  const [mode, setMode] = useState<HuntMode>(existing?.mode ?? 'solo');
  const [toPlace, setToPlace] = useState(existing?.toPlace ?? false);
  const [photoUri, setPhotoUri] = useState(existing?.photoUri);
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [error, setError] = useState<string | null>(null);

  const speciesList = speciesOfReserve(reserveId);
  const species = SPECIES.find((s) => s.id === speciesId);
  const weapons = useMemo(() => {
    const all = allWeapons(state.customWeapons);
    if (showAllWeapons) return all;
    return all.filter((w) => state.ownedWeaponIds.includes(w.id) || w.id === weaponId);
  }, [state.customWeapons, state.ownedWeaponIds, showAllWeapons, weaponId]);
  const weapon = weaponId ? findWeapon(weaponId, state.customWeapons) : undefined;

  const suggested = species ? SUGGESTED_CALIBERS[species.category] : [];
  const caliberHint =
    species && weapon && weapon.type !== 'arc' && weapon.type !== 'arbalete' && !suggested.includes(weapon.caliber)
      ? `Le ${weapon.caliber} n'est pas dans les calibres conseillés pour ce gibier (${suggested.join(', ')}).`
      : null;

  function changeReserve(r: ReserveId) {
    setReserveId(r);
    if (species && species.reserveId !== r) setSpeciesId(undefined);
  }

  async function choosePhoto() {
    const uri = await pickTrophyPhoto();
    if (uri) setPhotoUri(uri);
  }

  function save() {
    const date = parseDate(dateText, baseDate);
    if (!date) return setError('Date invalide : utilisez le format JJ/MM/AAAA.');
    if (!speciesId) return setError("Choisissez l'espèce.");
    if (!weaponId) return setError("Choisissez l'arme utilisée.");
    if (distance.trim() && parseNumber(distance) === undefined) return setError('Distance invalide.');
    if (score.trim() && parseNumber(score) === undefined) return setError('Score du trophée invalide.');
    const input = {
      date,
      reserveId,
      speciesId,
      weaponId,
      ammo: ammo.trim() || undefined,
      distanceM: parseNumber(distance),
      shotZone,
      oneShot,
      trophyScore: parseNumber(score),
      trophyType,
      mode,
      toPlace,
      photoUri,
      notes: notes.trim() || undefined,
    };
    if (existing) updateHunt(existing.id, input);
    else addHunt(input);
    router.back();
  }

  return (
    <Screen top={false}>
      <Stack.Screen options={{ title: existing ? 'Modifier la chasse' : 'Nouvelle chasse' }} />

      <Label>Réserve</Label>
      <ChipRow>
        {HUNTING_RESERVES.map((r) => (
          <Chip key={r.id} label={r.name} selected={reserveId === r.id} onPress={() => changeReserve(r.id)} />
        ))}
      </ChipRow>

      <Label>Espèce</Label>
      <ChipRow>
        {speciesList.map((s) => (
          <Chip
            key={s.id}
            label={s.dangerous ? `${s.name} ⚠` : s.name}
            selected={speciesId === s.id}
            onPress={() => setSpeciesId(s.id)}
          />
        ))}
      </ChipRow>
      {species ? (
        <Text style={[styles.muted, { marginTop: 6 }]}>
          {CATEGORY_LABELS[species.category]} · calibres indicatifs : {suggested.join(', ')}
          {species.dangerous ? ' · peut charger !' : ''}
        </Text>
      ) : null}

      <View style={[styles.row, { justifyContent: 'space-between' }]}>
        <Label>Arme</Label>
        <Pressable onPress={() => setShowAllWeapons((v) => !v)} hitSlop={8}>
          <Text style={{ color: colors.accent, fontSize: 13, fontWeight: '600', marginTop: 12 }}>
            {showAllWeapons ? 'Mes armes seulement' : 'Toutes les armes'}
          </Text>
        </Pressable>
      </View>
      {weapons.length === 0 ? (
        <Text style={styles.muted}>Aucune arme cochée dans l&apos;Armurerie : touchez « Toutes les armes ».</Text>
      ) : (
        <ChipRow>
          {weapons.map((w) => (
            <Chip
              key={w.id}
              label={`${w.name} · ${w.caliber}`}
              selected={weaponId === w.id}
              onPress={() => setWeaponId(w.id)}
            />
          ))}
        </ChipRow>
      )}
      {caliberHint ? <Text style={{ color: colors.olive, fontSize: 13, marginTop: 6 }}>{caliberHint}</Text> : null}

      <View style={[styles.row, { flexWrap: 'wrap' }]}>
        <Field label="Distance (m)" value={distance} onChangeText={setDistance} keyboardType="decimal-pad" placeholder="ex. 180" />
        <Field label="Score du trophée" value={score} onChangeText={setScore} keyboardType="decimal-pad" placeholder="ex. 152,4" />
      </View>
      <Field label="Munition (facultatif)" value={ammo} onChangeText={setAmmo} placeholder="ex. Nucleus Break" />

      <Label>Zone touchée</Label>
      <ChipRow>
        {(Object.keys(SHOT_ZONE_LABELS) as ShotZone[]).map((z) => (
          <Chip key={z} label={SHOT_ZONE_LABELS[z]} selected={shotZone === z} onPress={() => setShotZone(shotZone === z ? undefined : z)} />
        ))}
      </ChipRow>

      <Label>Détails</Label>
      <ChipRow>
        <Chip label="Tué d'un seul tir" tone="olive" selected={oneShot} onPress={() => setOneShot((v) => !v)} />
        <Chip label="Coop" tone="olive" selected={mode === 'coop'} onPress={() => setMode(mode === 'coop' ? 'solo' : 'coop')} />
        {(Object.keys(TROPHY_TYPE_LABELS) as TrophyType[]).map((t) => (
          <Chip key={t} label={TROPHY_TYPE_LABELS[t]} selected={trophyType === t} onPress={() => setTrophyType(t)} />
        ))}
        <Chip label="À exposer au pavillon" tone="olive" selected={toPlace} onPress={() => setToPlace((v) => !v)} />
      </ChipRow>

      <Field label="Date (JJ/MM/AAAA)" value={dateText} onChangeText={setDateText} placeholder="10/11/2026" />
      <Field label="Notes" value={notes} onChangeText={setNotes} multiline placeholder="Conditions, vent, appel utilisé…" style={{ minHeight: 70, textAlignVertical: 'top' }} />

      <Label>Photo (capture d&apos;écran)</Label>
      {photoUri ? (
        <Card style={{ gap: 8 }}>
          <Image source={{ uri: photoUri }} style={{ width: '100%', aspectRatio: 16 / 9, borderRadius: 10 }} resizeMode="cover" />
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Button label="Changer" kind="secondary" onPress={choosePhoto} />
            </View>
            <View style={{ flex: 1 }}>
              <Button label="Retirer" kind="danger" onPress={() => setPhotoUri(undefined)} />
            </View>
          </View>
        </Card>
      ) : (
        <Button label="Ajouter une photo" kind="secondary" onPress={choosePhoto} />
      )}

      {error ? <Text style={{ color: colors.danger, fontWeight: '700', marginTop: 12 }}>{error}</Text> : null}
      <View style={{ marginTop: 16 }}>
        <Button label={existing ? 'Enregistrer les modifications' : 'Enregistrer la chasse'} onPress={save} />
      </View>
    </Screen>
  );
}
