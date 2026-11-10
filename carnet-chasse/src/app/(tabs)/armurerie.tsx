import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Button, Card, Chip, ChipRow, Field, Label, Screen, SectionTitle, Title, styles } from '../../components/ui';
import { allWeapons, WEAPON_TYPE_LABELS } from '../../data/game';
import { formatNumber, weaponStats } from '../../logic/stats';
import type { Weapon, WeaponType } from '../../logic/types';
import { useCarnet } from '../../state/CarnetProvider';
import { colors } from '../../theme';

const TYPES = Object.keys(WEAPON_TYPE_LABELS) as WeaponType[];

function WeaponCard({ weapon }: { weapon: Weapon }) {
  const { state, toggleOwned, removeCustomWeapon } = useCarnet();
  const owned = state.ownedWeaponIds.includes(weapon.id);
  const stats = useMemo(() => weaponStats(state.hunts, weapon.id), [state.hunts, weapon.id]);
  const [confirm, setConfirm] = useState(false);

  return (
    <Card style={{ gap: 6, borderColor: owned ? colors.accent : colors.border }}>
      <View style={[styles.row, { justifyContent: 'space-between' }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.strong}>{weapon.name}</Text>
          <Text style={styles.muted}>
            {weapon.caliber}
            {weapon.custom ? ' · ajoutée par vous' : ''}
          </Text>
        </View>
        <Chip label={owned ? '✓ Possédée' : 'Je l’ai'} selected={owned} onPress={() => toggleOwned(weapon.id)} />
      </View>
      {stats.count > 0 ? (
        <Text style={{ color: colors.olive, fontSize: 13 }}>
          {stats.count} prélèvement{stats.count > 1 ? 's' : ''}
          {stats.oneShotRate !== undefined ? ` · ${formatNumber(stats.oneShotRate * 100)} % en un tir` : ''}
          {stats.avgDistanceM !== undefined ? ` · moy. ${formatNumber(stats.avgDistanceM)} m` : ''}
          {stats.maxDistanceM !== undefined ? ` · max ${formatNumber(stats.maxDistanceM)} m` : ''}
        </Text>
      ) : null}
      {weapon.custom ? (
        confirm ? (
          <View style={styles.row}>
            <Text style={[styles.muted, { flex: 1 }]}>Supprimer cette arme ?</Text>
            <Chip label="Annuler" onPress={() => setConfirm(false)} />
            <Chip label="Supprimer" tone="danger" selected onPress={() => removeCustomWeapon(weapon.id)} />
          </View>
        ) : (
          <Pressable onPress={() => setConfirm(true)} hitSlop={6}>
            <Text style={{ color: colors.danger, fontSize: 13 }}>Supprimer</Text>
          </Pressable>
        )
      ) : null}
    </Card>
  );
}

function AddWeapon() {
  const { addCustomWeapon } = useCarnet();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [caliber, setCaliber] = useState('');
  const [type, setType] = useState<WeaponType>('carabine');

  if (!open) return <Button label="+ Ajouter une arme absente de la liste" kind="secondary" onPress={() => setOpen(true)} />;

  return (
    <Card>
      <Field label="Nom de l'arme" value={name} onChangeText={setName} placeholder="ex. Steyr SM12" />
      <Field label="Calibre" value={caliber} onChangeText={setCaliber} placeholder="ex. .300 Win Mag" />
      <Label>Type</Label>
      <ChipRow>
        {TYPES.map((t) => (
          <Chip key={t} label={WEAPON_TYPE_LABELS[t]} selected={type === t} onPress={() => setType(t)} />
        ))}
      </ChipRow>
      <View style={[styles.row, { marginTop: 12 }]}>
        <View style={{ flex: 1 }}>
          <Button label="Annuler" kind="secondary" onPress={() => setOpen(false)} />
        </View>
        <View style={{ flex: 1 }}>
          <Button
            label="Ajouter"
            disabled={!name.trim() || !caliber.trim()}
            onPress={() => {
              addCustomWeapon({ name: name.trim(), caliber: caliber.trim(), type });
              setName('');
              setCaliber('');
              setOpen(false);
            }}
          />
        </View>
      </View>
    </Card>
  );
}

export default function ArmurerieScreen() {
  const { state } = useCarnet();
  const [onlyOwned, setOnlyOwned] = useState(false);
  const weapons = allWeapons(state.customWeapons).filter((w) => !onlyOwned || state.ownedWeaponIds.includes(w.id));

  return (
    <Screen>
      <Title subtitle="Cochez les armes que vous possédez en jeu : elles apparaîtront en premier lors de la saisie.">
        Armurerie
      </Title>
      <ChipRow>
        <Chip label="Toutes" selected={!onlyOwned} onPress={() => setOnlyOwned(false)} />
        <Chip label={`Mes armes (${state.ownedWeaponIds.length})`} selected={onlyOwned} onPress={() => setOnlyOwned(true)} />
      </ChipRow>

      {TYPES.map((t) => {
        const list = weapons.filter((w) => w.type === t);
        if (list.length === 0) return null;
        return (
          <View key={t} style={{ gap: 8 }}>
            <SectionTitle>{WEAPON_TYPE_LABELS[t]}</SectionTitle>
            {list.map((w) => (
              <WeaponCard key={w.id} weapon={w} />
            ))}
          </View>
        );
      })}
      {weapons.length === 0 ? <Text style={[styles.muted, { marginTop: 12 }]}>Aucune arme cochée pour l&apos;instant.</Text> : null}

      <View style={{ marginTop: 16 }}>
        <AddWeapon />
      </View>
      <Text style={[styles.muted, { marginTop: 12 }]}>
        Liste établie d&apos;après les patch notes et les wikis de joueurs (version 1.4). Elle n&apos;est peut-être pas complète.
      </Text>
    </Screen>
  );
}
