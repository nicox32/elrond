import { router } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { Button, Card, Chip, ChipRow, Empty, Field, Label, Screen, SectionTitle, styles } from '../components/ui';
import { getReserve, getSpecies, HUNTING_RESERVES, speciesOfReserve } from '../data/game';
import { AGING_NOTE, daysSince, isVisitDue, POPULATION_LABELS, summarizeHerd } from '../logic/herds';
import type { ReserveId } from '../logic/types';
import { useCarnet } from '../state/CarnetProvider';
import { colors, fonts } from '../theme';
import { Select } from '../components/Select';


function AddHerd() {
  const { state, addHerd } = useCarnet();
  const [open, setOpen] = useState(state.herds.length === 0);
  const [reserveId, setReserveId] = useState<ReserveId>(state.lastReserveId ?? HUNTING_RESERVES[0].id);
  const [speciesId, setSpeciesId] = useState<string | undefined>();
  const [name, setName] = useState('');
  const [place, setPlace] = useState('');
  const [camp, setCamp] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!open) return <Button label="+ Suivre un nouveau troupeau" onPress={() => setOpen(true)} />;

  function save() {
    if (!speciesId) return setError("Choisissez l'espèce.");
    const species = getSpecies(speciesId);
    const id = addHerd({
      name: name.trim() || `${species?.name ?? 'Troupeau'}${place.trim() ? ` · ${place.trim()}` : ''}`,
      speciesId,
      reserveId,
      place: place.trim() || undefined,
      camp: camp.trim() || undefined,
    });
    setOpen(false);
    router.push({ pathname: '/troupeau/[id]', params: { id } });
  }

  return (
    <Card>
      <Text style={styles.strong}>Nouveau troupeau</Text>
      <Label>Réserve</Label>
      <ChipRow>
        {HUNTING_RESERVES.map((r) => (
          <Chip
            key={r.id}
            label={r.name}
            selected={reserveId === r.id}
            onPress={() => {
              setReserveId(r.id);
              setSpeciesId(undefined);
            }}
          />
        ))}
      </ChipRow>
      <Select
        label="Espèce"
        value={speciesId}
        onChange={(v) => setSpeciesId(v || undefined)}
        placeholder="Choisir l'espèce…"
        allowCustom={false}
        searchable
        options={speciesOfReserve(reserveId).map((s) => ({ value: s.id, label: s.name }))}
      />
      <Field label="Lieu (facultatif)" value={place} onChangeText={setPlace} placeholder="ex. clairière au nord du lac" />
      <Field label="Tente la plus proche (facultatif)" value={camp} onChangeText={setCamp} placeholder="ex. tente de la crête, 400 m au sud" />
      <Field label="Nom (facultatif)" value={name} onChangeText={setName} placeholder="ex. Les cerfs du lac" />
      {error ? <Text style={{ color: colors.danger, fontFamily: fonts.semibold, marginTop: 8 }}>{error}</Text> : null}
      <View style={[styles.row, { marginTop: 12 }]}>
        {state.herds.length > 0 ? (
          <View style={{ flex: 1 }}>
            <Button label="Annuler" kind="secondary" onPress={() => setOpen(false)} />
          </View>
        ) : null}
        <View style={{ flex: 1 }}>
          <Button label="Créer" onPress={save} />
        </View>
      </View>
    </Card>
  );
}

export default function TroupeauxScreen() {
  const { state } = useCarnet();

  return (
    <Screen top={false}>
      <Text style={styles.muted}>
        Notez les animaux d&apos;un troupeau à chaque passage : l&apos;appli applique votre guide pour dire lesquels prélever et
        lesquels épargner.
      </Text>
      <Text style={[styles.muted, { color: colors.olive }]}>Revenez voir chaque troupeau toutes les 24 h. {AGING_NOTE}</Text>
      <AddHerd />

      <SectionTitle right={<Text style={styles.muted}>{state.herds.length}</Text>}>Mes troupeaux</SectionTitle>
      {state.herds.length === 0 ? (
        <Empty>Aucun troupeau suivi pour l&apos;instant.</Empty>
      ) : (
        state.herds.map((h) => {
          const s = summarizeHerd(h, state.prudent ? 40 : 50);
          const days = daysSince(h.lastVisit);
          return (
            <Card key={h.id} onPress={() => router.push({ pathname: '/troupeau/[id]', params: { id: h.id } })} style={{ gap: 4 }}>
              <View style={[styles.row, { justifyContent: 'space-between' }]}>
                <Text style={[styles.strong, { flex: 1 }]} numberOfLines={1}>
                  {h.name}
                </Text>
                {h.population ? <Text style={[styles.muted, { color: colors.gold }]}>{POPULATION_LABELS[h.population]}</Text> : null}
              </View>
              <Text style={styles.muted} numberOfLines={1}>
                {getSpecies(h.speciesId)?.name} · {getReserve(h.reserveId)?.name}
                {h.place ? ` · ${h.place}` : ''}
                {h.camp ? ` · ⛺ ${h.camp}` : ''}
              </Text>
              <Text style={styles.text}>
                {s.alive} vivant{s.alive > 1 ? 's' : ''} ({s.males} ♂, {s.females} ♀) ·{' '}
                <Text style={{ color: colors.olive, fontFamily: fonts.semibold }}>{s.byVerdict.eliminer} à prélever</Text>
                {s.byVerdict.trophee ? <Text style={{ color: colors.gold }}> · {s.byVerdict.trophee} trophée(s)</Text> : null}
              </Text>
              <Text style={[styles.muted, { fontSize: 12 }]}>
                Dernière visite : {days === 0 ? "aujourd'hui" : `il y a ${days} jour${days > 1 ? 's' : ''}`}
                {isVisitDue(h) ? <Text style={{ color: colors.accent, fontFamily: fonts.semibold }}> · à revoir</Text> : null}
                {h.reminderId ? ' · rappel 24 h' : ''}
              </Text>
            </Card>
          );
        })
      )}
    </Screen>
  );
}
