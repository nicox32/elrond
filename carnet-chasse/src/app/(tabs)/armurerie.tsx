import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';

import { ClassBadge, Thumb } from '../../components/armory';
import { Button, Card, Chip, ChipRow, Field, Label, Screen, SectionTitle, Title, styles } from '../../components/ui';
import { allAmmo, caliberKey, getWeaponSheet } from '../../data/armory';
import { allWeapons, WEAPON_TYPE_LABELS } from '../../data/game';
import { formatNumber, weaponStats } from '../../logic/stats';
import type { Ammo, Weapon, WeaponType } from '../../logic/types';
import { useCarnet } from '../../state/CarnetProvider';
import { colors, fonts } from '../../theme';

const TYPES = Object.keys(WEAPON_TYPE_LABELS) as WeaponType[];

function WeaponCard({ weapon }: { weapon: Weapon }) {
  const { state, toggleOwned } = useCarnet();
  const owned = state.ownedWeaponIds.includes(weapon.id);
  const sheet = getWeaponSheet(weapon.id, state.weaponSheets);
  const stats = useMemo(() => weaponStats(state.hunts, weapon.id), [state.hunts, weapon.id]);

  return (
    <Card
      onPress={() => router.push({ pathname: '/arme/[id]', params: { id: weapon.id } })}
      style={{ gap: 6, borderColor: owned ? colors.accent : colors.border }}
    >
      <View style={styles.row}>
        <Thumb uri={sheet?.photoUri} label={weapon.name} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.strong}>{weapon.name}</Text>
          <Text style={styles.muted}>
            {weapon.caliber}
            {sheet?.action ? ` · ${sheet.action}` : ''}
            {weapon.custom ? ' · ajoutée par vous' : ''}
          </Text>
          <ClassBadge range={sheet?.classRange} />
        </View>
        <Chip label={owned ? '✓ Possédée' : 'Je l’ai'} selected={owned} onPress={() => toggleOwned(weapon.id)} />
      </View>
      {stats.count > 0 ? (
        <Text style={{ color: colors.olive, fontSize: 13, fontFamily: fonts.body }}>
          {stats.count} prélèvement{stats.count > 1 ? 's' : ''}
          {stats.oneShotRate !== undefined ? ` · ${formatNumber(stats.oneShotRate * 100)} % en un tir` : ''}
          {stats.avgDistanceM !== undefined ? ` · moy. ${formatNumber(stats.avgDistanceM)} m` : ''}
        </Text>
      ) : null}
    </Card>
  );
}

function AmmoCard({ ammo }: { ammo: Ammo }) {
  const { state, toggleOwnedAmmo } = useCarnet();
  const owned = state.ownedAmmoIds.includes(ammo.id);
  const uses = state.hunts.filter((h) => h.ammo && h.ammo.toLowerCase() === ammo.name.toLowerCase()).length;
  return (
    <Card
      onPress={() => router.push({ pathname: '/munition/[id]', params: { id: ammo.id } })}
      style={{ gap: 4, borderColor: owned ? colors.accent : colors.border }}
    >
      <View style={styles.row}>
        <Thumb uri={ammo.photoUri} label={ammo.name.replace(/^Lewellings\s+/i, '')} size={48} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.strong}>{ammo.name}</Text>
          <Text style={styles.muted}>
            {ammo.projectile ?? 'Type inconnu'}
            {ammo.custom ? ' · ajoutée par vous' : ''}
          </Text>
          <ClassBadge range={ammo.classRange} />
        </View>
        <Chip label={owned ? '✓ En stock' : 'Je l’ai'} selected={owned} onPress={() => toggleOwnedAmmo(ammo.id)} />
      </View>
      {ammo.penetration || ammo.cavity ? (
        <Text style={styles.muted}>
          {[ammo.penetration && `Pénétration ${ammo.penetration.toLowerCase()}`, ammo.cavity && `cavité ${ammo.cavity.toLowerCase()}`]
            .filter(Boolean)
            .join(' · ')}
        </Text>
      ) : null}
      {uses ? <Text style={{ color: colors.olive, fontSize: 13 }}>Utilisée sur {uses} chasse{uses > 1 ? 's' : ''}</Text> : null}
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
  const [tab, setTab] = useState<'armes' | 'munitions'>('armes');
  const [onlyOwned, setOnlyOwned] = useState(false);

  const weapons = allWeapons(state.customWeapons).filter((w) => !onlyOwned || state.ownedWeaponIds.includes(w.id));
  const ammo = allAmmo(state.ammoSheets).filter((a) => !onlyOwned || state.ownedAmmoIds.includes(a.id));
  const calibers = useMemo(() => {
    const groups = new Map<string, { label: string; items: Ammo[] }>();
    for (const a of ammo) {
      const k = caliberKey(a.caliber);
      const g = groups.get(k) ?? { label: a.caliber, items: [] };
      g.items.push(a);
      groups.set(k, g);
    }
    return [...groups.values()];
  }, [ammo]);

  return (
    <Screen>
      <Title subtitle="Vos armes et munitions, avec les fiches du jeu et vos photos.">Armurerie</Title>
      <View style={[styles.row, { backgroundColor: colors.hud, borderRadius: 14, padding: 4, borderWidth: 1, borderColor: colors.border }]}>
        {(['armes', 'munitions'] as const).map((t) => (
          <View key={t} style={{ flex: 1 }}>
            <Chip label={t === 'armes' ? `Armes (${state.ownedWeaponIds.length})` : `Munitions (${state.ownedAmmoIds.length})`} selected={tab === t} onPress={() => setTab(t)} />
          </View>
        ))}
      </View>
      <ChipRow>
        <Chip label="Tout" selected={!onlyOwned} onPress={() => setOnlyOwned(false)} />
        <Chip label={tab === 'armes' ? 'Mes armes' : 'Mon stock'} selected={onlyOwned} onPress={() => setOnlyOwned(true)} />
      </ChipRow>

      {tab === 'armes' ? (
        <>
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
        </>
      ) : (
        <>
          {calibers.map((g) => (
            <View key={g.label} style={{ gap: 8 }}>
              <SectionTitle>{g.label}</SectionTitle>
              {g.items.map((a) => (
                <AmmoCard key={a.id} ammo={a} />
              ))}
            </View>
          ))}
          {calibers.length === 0 ? <Text style={[styles.muted, { marginTop: 12 }]}>Aucune munition en stock pour l&apos;instant.</Text> : null}
          <View style={{ marginTop: 16 }}>
            <Button label="+ Ajouter une munition" kind="secondary" onPress={() => router.push('/munition/edition')} />
          </View>
        </>
      )}
      <Text style={[styles.muted, { marginTop: 12 }]}>
        Fiches recopiées depuis le jeu ; touchez une arme ou une munition pour voir sa fiche, la compléter et ajouter votre photo.
      </Text>
    </Screen>
  );
}
