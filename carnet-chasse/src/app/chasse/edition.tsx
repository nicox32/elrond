import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Image, Pressable, Text, TextInput, View } from 'react-native';

import { Button, Card, Chip, ChipRow, Field, Fold, Label, Screen, styles } from '../../components/ui';
import { allWeapons, CATEGORY_LABELS, findWeapon, HUNTING_RESERVES, SHOT_ZONE_LABELS, SPECIES, speciesOfReserve, SUGGESTED_CALIBERS, SUGGESTED_DISTANCE, TROPHY_TYPE_LABELS } from '../../data/game';
import {
  ALL_NUM_FIELDS,
  ANIMAL_FIELDS,
  COAT_CHOICES,
  computeNetWeight,
  estimateMeatPrice,
  isRareCoat,
  MEASUREMENT_PRESETS,
  type NumKey,
  ORGAN_LABELS,
  parseDuration,
  PRICE_FIELDS,
  RATING_CHOICES,
  SHOT_FIELDS,
  WEATHER_CHOICES,
} from '../../logic/details';
import { ammoForCaliber, classFits, formatClassRange, getWeaponSheet, parseClassRange } from '../../data/armory';
import { checkEnergy, energyKindFor, formatRange, getSpeciesInfo, speciesClass } from '../../data/speciesInfo';
import { formatTime, parseTime } from '../../logic/schedule';
import { formatDate, formatNumber, formatScore, inReserve, parseNumber } from '../../logic/stats';
import {
  type AnimalSex,
  type HuntMode,
  type HuntNumbers,
  ORGAN_IDS,
  type OrganId,
  type Outcome,
  type ReserveId,
  type ShotZone,
  type TrophyType,
} from '../../logic/types';
import { pickTrophyPhoto } from '../../photos';
import { useCarnet } from '../../state/CarnetProvider';
import { colors, fonts } from '../../theme';


type FoldId = 'animal' | 'tir' | 'organes' | 'prix' | 'trophee';

/** « 10/11/2026 » → date ISO en gardant l'heure de `base`. */
function parseDate(text: string, base: Date): string | undefined {
  const m = text.trim().match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (!m) return undefined;
  const d = new Date(base);
  d.setFullYear(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  if (d.getDate() !== Number(m[1]) || d.getMonth() !== Number(m[2]) - 1) return undefined;
  return d.toISOString();
}

const fmt = (n: number | undefined) => (n === undefined ? '' : String(Math.round(n * 100) / 100).replace('.', ','));
const filled = (...xs: (string | undefined | boolean)[]) => xs.filter((x) => x !== undefined && x !== '' && x !== false).length;

/** Champ numérique compact pour les grilles du rapport. */
function SmallNum({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (t: string) => void; placeholder?: string }) {
  return (
    <View style={{ flexBasis: '47%', flexGrow: 1 }}>
      <Field label={label} value={value} onChangeText={onChange} keyboardType="decimal-pad" placeholder={placeholder} />
    </View>
  );
}

export default function EditionScreen() {
  const params = useLocalSearchParams<{
    id?: string;
    speciesId?: string;
    reserveId?: string;
    sex?: string;
    conditionPct?: string;
    stars?: string;
  }>();
  const id = params.id;
  const { state, addHunt, updateHunt } = useCarnet();
  const existing = id ? state.hunts.find((h) => h.id === id) : undefined;

  const [baseDate] = useState(() => (existing ? new Date(existing.date) : new Date()));
  const [dateText, setDateText] = useState(() => formatDate(baseDate.toISOString()));
  const [reserveId, setReserveId] = useState<ReserveId>(
    existing?.reserveId ??
      HUNTING_RESERVES.find((r) => r.id === params.reserveId)?.id ??
      state.lastReserveId ??
      HUNTING_RESERVES[0].id,
  );
  const [speciesId, setSpeciesId] = useState<string | undefined>(
    existing?.speciesId ?? SPECIES.find((x) => x.id === params.speciesId)?.id,
  );
  const [weaponId, setWeaponId] = useState<string | undefined>(existing?.weaponId ?? state.lastWeaponId);
  const [showAllWeapons, setShowAllWeapons] = useState(state.ownedWeaponIds.length === 0);
  const [ammo, setAmmo] = useState(existing?.ammo ?? '');
  const [distance, setDistance] = useState(existing?.distanceM !== undefined ? formatNumber(existing.distanceM) : '');
  const [shotZone, setShotZone] = useState<ShotZone | undefined>(existing?.shotZone);
  const [oneShot, setOneShot] = useState(existing?.oneShot ?? false);
  const [score, setScore] = useState(existing?.trophyScore !== undefined ? formatScore(existing.trophyScore) : '');
  const [trophyType, setTrophyType] = useState<TrophyType>(existing?.trophyType ?? 'normal');
  const [mode, setMode] = useState<HuntMode>(existing?.mode ?? 'solo');
  const [toPlace, setToPlace] = useState(existing?.toPlace ?? false);
  const [photoUri, setPhotoUri] = useState(existing?.photoUri);
  const [notes, setNotes] = useState(existing?.notes ?? '');

  // Rapport de chasse du jeu
  const [nums, setNums] = useState<Record<NumKey, string>>(
    () =>
      Object.fromEntries(
        ALL_NUM_FIELDS.map((f) => [
          f.key,
          f.key === 'conditionPct' && !existing && params.conditionPct ? params.conditionPct.replace('.', ',') : fmt(existing?.[f.key]),
        ]),
      ) as Record<NumKey, string>,
  );
  const setNum = (k: NumKey) => (t: string) => setNums((n) => ({ ...n, [k]: t }));
  const [sex, setSex] = useState<AnimalSex | undefined>(
    existing?.sex ?? (params.sex === 'male' || params.sex === 'femelle' ? params.sex : undefined),
  );
  const [coat, setCoat] = useState(existing?.coat ?? '');
  const [rarity, setRarity] = useState(existing?.rarity ?? '');
  const [ammoType, setAmmoType] = useState(existing?.ammoType ?? '');
  const [ammoClass, setAmmoClass] = useState(existing?.ammoClass ?? '');
  const [killTime, setKillTime] = useState(existing?.killTimeMin !== undefined ? formatTime(existing.killTimeMin) : '');
  const [trackingTime, setTrackingTime] = useState(
    existing?.trackingTimeSec !== undefined ? `${Math.floor(existing.trackingTimeSec / 60)}m${existing.trackingTimeSec % 60}s` : '',
  );
  const [hunterDetected, setHunterDetected] = useState(existing?.hunterDetected);
  const [dogUsed, setDogUsed] = useState(existing?.dogUsed);
  const [weather, setWeather] = useState(existing?.weather ?? '');
  const [organs, setOrgans] = useState<Record<OrganId, string>>(
    () => Object.fromEntries(ORGAN_IDS.map((o) => [o, fmt(existing?.organs?.[o])])) as Record<OrganId, string>,
  );
  const [measurements, setMeasurements] = useState<{ label: string; value: string }[]>(
    () => existing?.measurements?.map((m) => ({ label: m.label, value: fmt(m.value) })) ?? [],
  );
  const [huntRating, setHuntRating] = useState(existing?.huntRating ?? '');
  const [trophyStars, setTrophyStars] = useState<number | undefined>(
    existing?.trophyStars ?? (params.stars ? Number(params.stars) || undefined : undefined),
  );
  const [outcome, setOutcome] = useState<Outcome | undefined>(existing?.outcome);

  const [open, setOpen] = useState<Record<FoldId, boolean>>({ animal: false, tir: false, organes: false, prix: false, trophee: false });
  const toggle = (f: FoldId) => () => setOpen((o) => ({ ...o, [f]: !o[f] }));
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

  const parsedNums = useMemo(() => {
    const out: HuntNumbers = {};
    for (const f of ALL_NUM_FIELDS) {
      const n = parseNumber(nums[f.key]);
      if (n !== undefined) out[f.key] = n;
    }
    return out;
  }, [nums]);
  const netHint = parsedNums.netWeightKg === undefined ? computeNetWeight(parsedNums) : undefined;
  const priceHint = parsedNums.salePrice === undefined ? estimateMeatPrice(parsedNums) : undefined;
  const info = getSpeciesInfo(speciesId, state.speciesSheets);
  const energyKind = energyKindFor(weapon?.type);
  const energyRange = info && energyKind ? info.energy[energyKind] : undefined;
  const energyStatus = checkEnergy(info, energyKind, parsedNums.impactEnergyJ);

  // Armurerie : munitions du calibre de l'arme (en stock d'abord) et contrôle des classes affichées en jeu.
  const caliberAmmo = weapon
    ? [...ammoForCaliber(weapon.caliber, state.ammoSheets)].sort(
        (a, b) => Number(state.ownedAmmoIds.includes(b.id)) - Number(state.ownedAmmoIds.includes(a.id)),
      )
    : [];
  const animalCls = parsedNums.animalClass ?? speciesClass(speciesId, state.speciesSheets);
  const weaponRange = weapon ? getWeaponSheet(weapon.id, state.weaponSheets)?.classRange : undefined;
  const ammoRange = parseClassRange(ammoClass);
  // C'est surtout le niveau de l'arme qui compte ; la classe de la munition est donnée pour info.
  const weaponFit = classFits(animalCls, weaponRange);
  const ammoFit = classFits(animalCls, ammoRange);
  const betterAmmo = caliberAmmo.filter((m) => classFits(animalCls, m.classRange));

  function changeReserve(r: ReserveId) {
    setReserveId(r);
    if (species && !inReserve(species, r)) setSpeciesId(undefined);
  }

  async function choosePhoto() {
    const uri = await pickTrophyPhoto();
    if (uri) setPhotoUri(uri);
  }

  function chooseOutcome(o: Outcome) {
    const next = outcome === o ? undefined : o;
    setOutcome(next);
    if (next === 'empaille' && !existing) setToPlace(true);
  }

  function save() {
    const date = parseDate(dateText, baseDate);
    if (!date) return setError('Date invalide : utilisez le format JJ/MM/AAAA.');
    if (!speciesId) return setError("Choisissez l'espèce.");
    if (!weaponId) return setError("Choisissez l'arme utilisée.");
    if (distance.trim() && parseNumber(distance) === undefined) return setError('Distance invalide.');
    if (score.trim() && parseNumber(score) === undefined) return setError('Score du trophée invalide.');
    const badNum = ALL_NUM_FIELDS.find((f) => nums[f.key].trim() && parseNumber(nums[f.key]) === undefined);
    if (badNum) return setError(`Valeur invalide : ${badNum.label}.`);
    const killTimeMin = killTime.trim() ? parseTime(killTime) : undefined;
    if (killTime.trim() && killTimeMin === undefined) return setError("Heure de la mort invalide (ex. 13:59).");
    const trackingTimeSec = trackingTime.trim() ? parseDuration(trackingTime) : undefined;
    if (trackingTime.trim() && trackingTimeSec === undefined) return setError('Temps de traque invalide (ex. 9m49s).');
    const badOrgan = ORGAN_IDS.find((o) => organs[o].trim() && parseNumber(organs[o]) === undefined);
    if (badOrgan) return setError(`Dégât invalide : ${ORGAN_LABELS[badOrgan]}.`);
    const organValues: Partial<Record<OrganId, number>> = {};
    for (const o of ORGAN_IDS) {
      const n = parseNumber(organs[o]);
      if (n !== undefined) organValues[o] = n;
    }
    const measured = measurements
      .map((m) => ({ label: m.label.trim(), value: parseNumber(m.value) }))
      .filter((m): m is { label: string; value: number } => !!m.label && m.value !== undefined);

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
      ...parsedNums,
      sex,
      coat: coat.trim() || undefined,
      rarity: rarity.trim() || undefined,
      ammoType: ammoType.trim() || undefined,
      ammoClass: ammoClass.trim() || undefined,
      killTimeMin,
      trackingTimeSec,
      hunterDetected,
      dogUsed,
      weather: weather.trim() || undefined,
      organs: Object.keys(organValues).length ? organValues : undefined,
      measurements: measured.length ? measured : undefined,
      huntRating: huntRating.trim() || undefined,
      trophyStars,
      outcome,
    };
    if (existing) updateHunt(existing.id, input);
    else addHunt(input);
    router.back();
  }

  const yesNo = (value: boolean | undefined, set: (v: boolean | undefined) => void) => (
    <>
      <Chip label="Oui" selected={value === true} onPress={() => set(value === true ? undefined : true)} />
      <Chip label="Non" selected={value === false} onPress={() => set(value === false ? undefined : false)} />
    </>
  );

  const organCount = ORGAN_IDS.filter((o) => organs[o].trim()).length;

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
          <Chip key={s.id} label={s.dangerous ? `${s.name} ⚠` : s.name} selected={speciesId === s.id} onPress={() => setSpeciesId(s.id)} />
        ))}
      </ChipRow>
      {species ? (
        <Text style={[styles.muted, { marginTop: 6 }]}>
          {CATEGORY_LABELS[species.category]} · calibres indicatifs : {suggested.join(', ')}
          {` · distance conseillée : ${SUGGESTED_DISTANCE[species.category]}`}
          {species.dangerous ? ' · peut charger !' : ''}
        </Text>
      ) : null}

      <View style={[styles.row, { justifyContent: 'space-between' }]}>
        <Label>Arme</Label>
        <Pressable onPress={() => setShowAllWeapons((v) => !v)} hitSlop={8}>
          <Text style={{ color: colors.accent, fontSize: 13, fontFamily: fonts.semibold, marginTop: 12 }}>
            {showAllWeapons ? 'Mes armes seulement' : 'Toutes les armes'}
          </Text>
        </Pressable>
      </View>
      {weapons.length === 0 ? (
        <Text style={styles.muted}>Aucune arme cochée dans l&apos;Armurerie : touchez « Toutes les armes ».</Text>
      ) : (
        <ChipRow>
          {weapons.map((w) => (
            <Chip key={w.id} label={`${w.name} · ${w.caliber}`} selected={weaponId === w.id} onPress={() => setWeaponId(w.id)} />
          ))}
        </ChipRow>
      )}
      {caliberHint ? <Text style={{ color: colors.olive, fontSize: 13, marginTop: 6 }}>{caliberHint}</Text> : null}

      <View style={[styles.row, { flexWrap: 'wrap' }]}>
        <Field label="Distance de tir (m)" value={distance} onChangeText={setDistance} keyboardType="decimal-pad" placeholder="100" />
        <Field label="Score du trophée" value={score} onChangeText={setScore} keyboardType="decimal-pad" placeholder="152,4" />
      </View>

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
        <Chip label="À exposer au pavillon" tone="olive" selected={toPlace} onPress={() => setToPlace((v) => !v)} />
      </ChipRow>

      <Text style={[styles.muted, { marginTop: 16 }]}>
        Rapport de chasse du jeu : recopiez ce qui vous intéresse, tout est facultatif.
      </Text>

      <Fold
        title="Animal"
        summary={`${filled(sex, nums.ageYears, nums.animalClass, nums.conditionPct, nums.weightKg, coat, rarity)} / 7 rempli(s)`}
        open={open.animal}
        onToggle={toggle('animal')}
      >
        <Label>Sexe</Label>
        <ChipRow>
          <Chip label="Mâle" selected={sex === 'male'} onPress={() => setSex(sex === 'male' ? undefined : 'male')} />
          <Chip label="Femelle" selected={sex === 'femelle'} onPress={() => setSex(sex === 'femelle' ? undefined : 'femelle')} />
        </ChipRow>
        <View style={[styles.row, { flexWrap: 'wrap' }]}>
          {ANIMAL_FIELDS.map((f) => (
            <SmallNum key={f.key} label={f.label} value={nums[f.key]} onChange={setNum(f.key)} placeholder={f.placeholder} />
          ))}
        </View>
        <Label>Robe</Label>
        <ChipRow>
          {COAT_CHOICES.map((c) => (
            <Chip key={c.label} label={c.rare ? `✦ ${c.label}` : c.label} selected={coat === c.label} onPress={() => setCoat(coat === c.label ? '' : c.label)} />
          ))}
        </ChipRow>
        {isRareCoat(coat) ? (
          <Text style={{ color: colors.gold, fontSize: 13, marginTop: 6, fontFamily: fonts.semibold }}>
            ✦ Fourrure rare : trophée « Ultime » potentiel. Le jeu conseille de l&apos;empailler.
          </Text>
        ) : null}
        <View style={[styles.row, { flexWrap: 'wrap' }]}>
          <Field label="Robe (autre)" value={coat} onChangeText={setCoat} placeholder="Standard" />
          <Field label="Rareté" value={rarity} onChangeText={setRarity} placeholder="Ordinaire" />
        </View>
      </Fold>

      <Fold
        title="Tir"
        summary={`${filled(ammoType, ammo, ammoClass, killTime, trackingTime, nums.trackingDistanceM, nums.impactEnergyJ, nums.windMs, weather, hunterDetected !== undefined, dogUsed !== undefined)} / 11 rempli(s)`}
        open={open.tir}
        onToggle={toggle('tir')}
      >
        {weapon && caliberAmmo.length ? (
          <>
            <Label>Munitions {weapon.caliber}</Label>
            <ChipRow>
              {caliberAmmo.map((m) => (
                <Chip
                  key={m.id}
                  label={`${m.name.replace(/^Lewellings\s+/i, '')}${m.classRange ? ` · ${formatClassRange(m.classRange)}` : ''}`}
                  selected={ammo.trim().toLowerCase() === m.name.toLowerCase()}
                  onPress={() => {
                    setAmmo(m.name);
                    if (m.projectile) setAmmoType(m.projectile);
                    setAmmoClass(formatClassRange(m.classRange) ?? '');
                  }}
                />
              ))}
            </ChipRow>
          </>
        ) : null}
        {weaponFit !== undefined ? (
          <Text style={{ fontSize: 13, marginTop: 6, fontFamily: fonts.semibold, color: weaponFit ? colors.olive : colors.accent }}>
            Classe de l&apos;animal {animalCls} · niveau de l&apos;arme {formatClassRange(weaponRange)}{' '}
            {weaponFit ? '✓ adaptée' : '✗ hors niveau : choisissez une arme plus adaptée'}
          </Text>
        ) : null}
        {ammoFit === false ? (
          <Text style={{ color: colors.accent, fontSize: 13, marginTop: 2, fontFamily: fonts.semibold }}>
            Munition classe {formatClassRange(ammoRange)} : pas faite pour un animal de classe {animalCls}.
            {betterAmmo.length
              ? ` À prendre : ${betterAmmo
                  .slice(0, 3)
                  .map((m) => `${m.name.replace(/^Lewellings\s+/i, '')} (${formatClassRange(m.classRange)}${state.ownedAmmoIds.includes(m.id) ? ', en stock' : ''})`)
                  .join(', ')}.`
              : ''}
          </Text>
        ) : null}
        <Field label="Type de munitions" value={ammoType} onChangeText={setAmmoType} placeholder="Têtes creuses à pointe polymère" />
        <View style={[styles.row, { flexWrap: 'wrap' }]}>
          <Field label="Munition" value={ammo} onChangeText={setAmmo} placeholder="Lewellings Grande Swift" />
          <View style={{ width: 110 }}>
            <Field label="Classe" value={ammoClass} onChangeText={setAmmoClass} placeholder="3-5" />
          </View>
        </View>
        <View style={[styles.row, { flexWrap: 'wrap' }]}>
          <SmallNum label="Heure de la mort" value={killTime} onChange={setKillTime} placeholder="13:59" />
          <SmallNum label="Temps de traque" value={trackingTime} onChange={setTrackingTime} placeholder="9m49s" />
          {SHOT_FIELDS.map((f) => (
            <SmallNum key={f.key} label={f.label} value={nums[f.key]} onChange={setNum(f.key)} placeholder={f.placeholder} />
          ))}
        </View>
        {energyRange !== undefined && energyKind ? (
          <Text
            style={{
              fontSize: 13,
              marginTop: 6,
              fontFamily: fonts.semibold,
              color: energyStatus === 'ok' ? colors.olive : energyStatus ? colors.danger : colors.textMuted,
            }}
          >
            Énergie recommandée par le jeu ({energyKind === 'balle' ? 'balle' : energyKind === 'slug' ? 'slug' : 'flèche'}) :{' '}
            {formatRange(energyRange, 'J')}
            {energyStatus === 'ok' ? ' · impact optimal ✓' : ''}
            {energyStatus === 'faible' ? ' · trop faible : risque de blesser' : ''}
            {energyStatus === 'forte' ? ' · trop forte : viande abîmée' : ''}
            {energyStatus === 'inadapte' ? ' · munition inadaptée' : ''}
          </Text>
        ) : null}
        <Label>Météo</Label>
        <ChipRow>
          {WEATHER_CHOICES.map((w) => (
            <Chip key={w} label={w} selected={weather === w} onPress={() => setWeather(weather === w ? '' : w)} />
          ))}
        </ChipRow>
        <Label>Chasseur détecté</Label>
        <ChipRow>{yesNo(hunterDetected, setHunterDetected)}</ChipRow>
        <Label>Chien utilisé</Label>
        <ChipRow>{yesNo(dogUsed, setDogUsed)}</ChipRow>
      </Fold>

      <Fold title="Dégâts aux organes (%)" summary={`${organCount} organe(s) noté(s)`} open={open.organes} onToggle={toggle('organes')}>
        <View style={[styles.row, { flexWrap: 'wrap' }]}>
          {ORGAN_IDS.map((o) => (
            <SmallNum key={o} label={ORGAN_LABELS[o]} value={organs[o]} onChange={(t) => setOrgans((s) => ({ ...s, [o]: t }))} placeholder="0" />
          ))}
        </View>
      </Fold>

      <Fold
        title="Poids et prix"
        summary={`${filled(...PRICE_FIELDS.map((f) => nums[f.key]))} / ${PRICE_FIELDS.length} rempli(s)`}
        open={open.prix}
        onToggle={toggle('prix')}
      >
        <Text style={styles.muted}>Le poids brut est celui de la section Animal.</Text>
        <View style={[styles.row, { flexWrap: 'wrap' }]}>
          {PRICE_FIELDS.map((f) => (
            <SmallNum
              key={f.key}
              label={f.label}
              value={nums[f.key]}
              onChange={setNum(f.key)}
              placeholder={
                f.key === 'netWeightKg' && netHint !== undefined
                  ? `≈ ${fmt(netHint)}`
                  : f.key === 'salePrice' && priceHint !== undefined
                    ? `≈ ${priceHint}`
                    : f.placeholder
              }
            />
          ))}
        </View>
        {netHint !== undefined || priceHint !== undefined ? (
          <Text style={{ color: colors.olive, fontSize: 13, marginTop: 6 }}>
            Calculé :{netHint !== undefined ? ` poids après découpe ≈ ${fmt(netHint)} kg` : ''}
            {priceHint !== undefined ? ` · prix de la viande ≈ ${priceHint}` : ''}
          </Text>
        ) : null}
      </Fold>

      <Fold
        title="Trophée et classements"
        summary={`${filled(score, huntRating, trophyStars !== undefined, outcome)} / 4 · ${measurements.length} mesure(s)`}
        open={open.trophee}
        onToggle={toggle('trophee')}
      >
        <Label>Classement de chasse</Label>
        <ChipRow>
          {RATING_CHOICES.map((r) => (
            <Chip key={r} label={r} selected={huntRating === r} onPress={() => setHuntRating(huntRating === r ? '' : r)} />
          ))}
        </ChipRow>
        <Label>Classement de trophée (étoiles)</Label>
        <ChipRow>
          {[1, 2, 3, 4, 5].map((n) => (
            <Chip key={n} label={'★'.repeat(n)} selected={trophyStars === n} onPress={() => setTrophyStars(trophyStars === n ? undefined : n)} />
          ))}
        </ChipRow>
        <Label>Type de trophée</Label>
        <ChipRow>
          {(Object.keys(TROPHY_TYPE_LABELS) as TrophyType[]).map((t) => (
            <Chip key={t} label={TROPHY_TYPE_LABELS[t]} selected={trophyType === t} onPress={() => setTrophyType(t)} />
          ))}
        </ChipRow>
        <Label>Décision</Label>
        <ChipRow>
          <Chip label="Vendu" selected={outcome === 'vendu'} onPress={() => chooseOutcome('vendu')} />
          <Chip label="Empaillé" selected={outcome === 'empaille'} onPress={() => chooseOutcome('empaille')} />
        </ChipRow>

        <Label>Mesures (cm)</Label>
        {measurements.map((m, i) => (
          <View key={i} style={[styles.row, { marginBottom: 6 }]}>
            <TextInput
              value={m.label}
              onChangeText={(t) => setMeasurements((ms) => ms.map((x, j) => (j === i ? { ...x, label: t } : x)))}
              placeholder="Mesure"
              placeholderTextColor={colors.textMuted}
              style={[styles.input, { flex: 1 }]}
            />
            <TextInput
              value={m.value}
              onChangeText={(t) => setMeasurements((ms) => ms.map((x, j) => (j === i ? { ...x, value: t } : x)))}
              placeholder="cm"
              placeholderTextColor={colors.textMuted}
              keyboardType="decimal-pad"
              style={[styles.input, { width: 80 }]}
            />
            <Pressable
              onPress={() => setMeasurements((ms) => ms.filter((_, j) => j !== i))}
              accessibilityRole="button"
              accessibilityLabel={`Retirer ${m.label || 'la mesure'}`}
              hitSlop={8}
              style={{ width: 36, height: 44, alignItems: 'center', justifyContent: 'center' }}
            >
              <Text style={{ color: colors.danger, fontFamily: fonts.heading, fontSize: 22 }}>×</Text>
            </Pressable>
          </View>
        ))}
        <ChipRow>
          {MEASUREMENT_PRESETS.filter((p) => !measurements.some((m) => m.label === p)).map((p) => (
            <Chip key={p} label={`+ ${p}`} onPress={() => setMeasurements((ms) => [...ms, { label: p, value: '' }])} />
          ))}
          <Chip label="+ Autre mesure" onPress={() => setMeasurements((ms) => [...ms, { label: '', value: '' }])} />
        </ChipRow>
      </Fold>

      <Field label="Date (JJ/MM/AAAA)" value={dateText} onChangeText={setDateText} placeholder="10/11/2026" />
      <Field
        label="Notes"
        value={notes}
        onChangeText={setNotes}
        multiline
        placeholder="Conditions, appel utilisé…"
        style={{ minHeight: 70, textAlignVertical: 'top' }}
      />

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

      {error ? <Text style={{ color: colors.danger, fontFamily: fonts.semibold, marginTop: 12 }}>{error}</Text> : null}
      <View style={{ marginTop: 16 }}>
        <Button label={existing ? 'Enregistrer les modifications' : 'Enregistrer la chasse'} onPress={save} />
      </View>
    </Screen>
  );
}
