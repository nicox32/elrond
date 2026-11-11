import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { LevelPicker } from '../../components/armory';
import { Select } from '../../components/Select';
import { Button, Field, FieldRow, Screen, styles } from '../../components/ui';
import { AMMO, allAmmo, formatClassRange, parseClassRange, PROJECTILE_TYPES } from '../../data/armory';
import { allWeapons } from '../../data/game';
import { newId } from '../../logic/stats';
import { useCarnet } from '../../state/CarnetProvider';
import { colors, fonts } from '../../theme';

export default function MunitionEditionScreen() {
  const params = useLocalSearchParams<{ id?: string; caliber?: string }>();
  const { state, saveAmmo, toggleOwnedAmmo } = useCarnet();
  const existing = params.id ? allAmmo(state.ammoSheets).find((a) => a.id === params.id) : undefined;
  const builtIn = !!existing && AMMO.some((a) => a.id === existing.id);
  const calibers = [...new Set(allWeapons(state.customWeapons).map((w) => w.caliber))];

  const [name, setName] = useState(existing?.name ?? '');
  const [brand, setBrand] = useState(existing?.brand ?? '');
  const [caliber, setCaliber] = useState(existing?.caliber ?? params.caliber ?? '');
  const [level, setLevel] = useState(formatClassRange(existing?.classRange) ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [projectile, setProjectile] = useState(existing?.projectile ?? '');
  const [penetration, setPenetration] = useState(existing?.penetration ?? '');
  const [recoilReduced, setRecoilReduced] = useState(existing?.recoilReduced ?? '');
  const [precision, setPrecision] = useState(existing?.precision ?? '');
  const [cavity, setCavity] = useState(existing?.cavity ?? '');
  const [error, setError] = useState<string | null>(null);

  function save() {
    if (!name.trim()) return setError('Indiquez le nom de la munition.');
    if (!caliber.trim()) return setError('Indiquez le calibre.');
    const classRange = level.trim() ? parseClassRange(level) : undefined;
    if (level.trim() && !classRange) return setError('Classe invalide : écrivez par exemple 4-6.');
    const id = existing?.id ?? `perso-${newId()}`;
    saveAmmo({
      id,
      name: name.trim(),
      brand: brand.trim() || undefined,
      caliber: caliber.trim(),
      classRange,
      description: description.trim() || undefined,
      projectile: projectile.trim() || undefined,
      penetration: penetration || undefined,
      recoilReduced: recoilReduced || undefined,
      precision: precision || undefined,
      cavity: cavity || undefined,
      photoUri: existing?.photoUri,
      custom: !builtIn,
    });
    if (!existing) toggleOwnedAmmo(id);
    router.back();
  }

  return (
    <Screen top={false}>
      <Stack.Screen options={{ title: existing ? `Fiche · ${existing.name}` : 'Nouvelle munition' }} />
      <Text style={styles.muted}>En jeu : Armurerie › Munitions. Recopiez la fiche affichée ; tout sauf le nom et le calibre est facultatif.</Text>
      <Field label="Nom" value={name} onChangeText={setName} placeholder="Lewellings Nucleus Break" />
      <FieldRow>
        <Field label="Marque" value={brand} onChangeText={setBrand} placeholder="Lewellings" />
        <Field label="Classe" value={level} onChangeText={setLevel} placeholder="4-6" />
      </FieldRow>
      <Select label="Calibre" value={caliber} onChange={setCaliber} options={calibers} customKey="caliber" placeholder=".308 Winchester" allowClear={false} searchable />
      <Field
        label="Description"
        value={description}
        onChangeText={setDescription}
        multiline
        placeholder="Cartouche de haute puissance, idéale pour…"
        style={{ minHeight: 60, textAlignVertical: 'top' }}
      />
      <Select label="Type de projectile" value={projectile} onChange={setProjectile} options={PROJECTILE_TYPES} customKey="ammoType" placeholder="Têtes creuses" />
      <LevelPicker label="Pénétration" value={penetration} onChange={setPenetration} />
      <LevelPicker label="Recul réduit" value={recoilReduced} onChange={setRecoilReduced} />
      <LevelPicker label="Précision" value={precision} onChange={setPrecision} />
      <LevelPicker label="Taille de cavité" value={cavity} onChange={setCavity} />
      {error ? <Text style={{ color: colors.danger, fontFamily: fonts.semibold, marginTop: 12 }}>{error}</Text> : null}
      <View style={{ marginTop: 16 }}>
        <Button label={existing ? 'Enregistrer la fiche' : 'Ajouter la munition'} onPress={save} />
      </View>
    </Screen>
  );
}
