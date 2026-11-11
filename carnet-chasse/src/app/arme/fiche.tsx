import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { LevelPicker } from '../../components/armory';
import { Select } from '../../components/Select';
import { Button, Empty, Field, FieldRow, Screen, styles } from '../../components/ui';
import { ACTION_TYPES, formatClassRange, getWeaponSheet, parseClassRange, WEAPON_SHEETS } from '../../data/armory';
import { findWeapon } from '../../data/game';
import { useCarnet } from '../../state/CarnetProvider';
import { colors, fonts } from '../../theme';

export default function ArmeFicheScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state, saveWeaponSheet } = useCarnet();
  const weapon = findWeapon(id, state.customWeapons);
  const sheet = weapon ? getWeaponSheet(weapon.id, state.weaponSheets) : undefined;

  const [action, setAction] = useState(sheet?.action ?? '');
  const [description, setDescription] = useState(sheet?.description ?? '');
  const [level, setLevel] = useState(formatClassRange(sheet?.classRange) ?? '');
  const [magazine, setMagazine] = useState(sheet?.magazine !== undefined ? String(sheet.magazine) : '');
  const [precision, setPrecision] = useState(sheet?.precision ?? '');
  const [recoil, setRecoil] = useState(sheet?.recoil ?? '');
  const [noise, setNoise] = useState(sheet?.noise ?? '');
  const [error, setError] = useState<string | null>(null);

  if (!weapon) {
    return (
      <Screen top={false}>
        <Empty>Arme inconnue.</Empty>
      </Screen>
    );
  }

  function save() {
    const classRange = level.trim() ? parseClassRange(level) : undefined;
    if (level.trim() && !classRange) return setError('Niveau invalide : écrivez par exemple 3-6.');
    const mag = magazine.trim() ? Number(magazine.trim()) : undefined;
    if (mag !== undefined && (!Number.isInteger(mag) || mag < 1 || mag > 99)) return setError('Taille du chargeur invalide.');
    saveWeaponSheet(weapon!.id, {
      action: action.trim() || undefined,
      description: description.trim() || undefined,
      classRange,
      magazine: mag,
      precision: precision || undefined,
      recoil: recoil || undefined,
      noise: noise || undefined,
      photoUri: state.weaponSheets[weapon!.id]?.photoUri,
    });
    router.back();
  }

  return (
    <Screen top={false}>
      <Stack.Screen options={{ title: `Fiche · ${weapon.name}` }} />
      <Text style={styles.muted}>
        En jeu : Armurerie › {weapon.name}. Recopiez les informations affichées sous l&apos;arme ; tout est facultatif.
      </Text>
      <Select label="Type d'arme" value={action} onChange={setAction} options={ACTION_TYPES} customKey="action" placeholder="Carabine à verrou" />
      <FieldRow>
        <Field label="Niveau (classes)" value={level} onChangeText={setLevel} placeholder="3-6" />
        <Field label="Taille du chargeur" value={magazine} onChangeText={setMagazine} keyboardType="number-pad" placeholder="4" />
      </FieldRow>
      <Field
        label="Description"
        value={description}
        onChangeText={setDescription}
        multiline
        placeholder="Carabine de chasse à verrou, idéale pour…"
        style={{ minHeight: 60, textAlignVertical: 'top' }}
      />
      <LevelPicker label="Précision" value={precision} onChange={setPrecision} />
      <LevelPicker label="Recul" value={recoil} onChange={setRecoil} />
      <LevelPicker label="Bruit lors du tir" value={noise} onChange={setNoise} />
      {error ? <Text style={{ color: colors.danger, fontFamily: fonts.semibold, marginTop: 12 }}>{error}</Text> : null}
      <View style={{ marginTop: 16, gap: 8 }}>
        <Button label="Enregistrer la fiche" onPress={save} />
        {state.weaponSheets[weapon.id] && WEAPON_SHEETS[weapon.id] ? (
          <Button
            label="Revenir à la fiche fournie"
            kind="secondary"
            onPress={() => {
              const photoUri = state.weaponSheets[weapon.id]?.photoUri;
              saveWeaponSheet(weapon.id, photoUri ? { photoUri } : null);
              router.back();
            }}
          />
        ) : null}
      </View>
    </Screen>
  );
}
