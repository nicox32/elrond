import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { VerdictBadge } from '../../components/Verdict';
import { Button, Card, Chip, ChipRow, Empty, Field, Label, Screen, SectionTitle, styles } from '../../components/ui';
import { getReserve, getSpecies } from '../../data/game';
import { getSpeciesInfo, routineSlots } from '../../data/speciesInfo';
import {
  adviceFor,
  AGE_LABELS,
  AGING_NOTE,
  daysSince,
  isVisitDue,
  malesTakenToday,
  POPULATION_LABELS,
  sortAnimals,
  summarizeHerd,
} from '../../logic/herds';
import { NEED_ICONS, NEED_LABELS } from '../../logic/schedule';
import { COAT_CHOICES, isRareCoat } from '../../logic/details';
import { formatDate, parseNumber } from '../../logic/stats';
import type { AgeStage, AnimalSex, HerdAnimal, PopulationStatus } from '../../logic/types';
import { cancelHerdReminder, REMINDERS_SUPPORTED, scheduleHerdReminder } from '../../reminders';
import { useCarnet } from '../../state/CarnetProvider';
import { colors, fonts } from '../../theme';

type AnimalDraft = Pick<HerdAnimal, 'label' | 'sex' | 'age' | 'stars' | 'conditionPct' | 'coat' | 'notes'>;

function AnimalForm({ initial, submitLabel, onSubmit, onCancel }: {
  initial?: AnimalDraft;
  submitLabel: string;
  onSubmit: (a: AnimalDraft) => void;
  onCancel: () => void;
}) {
  const [label, setLabel] = useState(initial?.label ?? '');
  const [sex, setSex] = useState<AnimalSex>(initial?.sex ?? 'male');
  const [age, setAge] = useState<AgeStage>(initial?.age ?? 'adulte');
  const [stars, setStars] = useState<number | undefined>(initial?.stars);
  const [condition, setCondition] = useState(initial?.conditionPct !== undefined ? String(initial.conditionPct).replace('.', ',') : '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [coat, setCoat] = useState(initial?.coat ?? '');
  const [error, setError] = useState<string | null>(null);
  const needsStars = sex === 'male' && age !== 'jeune';

  function submit() {
    const c = condition.trim() ? parseNumber(condition) : undefined;
    if (condition.trim() && (c === undefined || c > 100)) return setError('Condition invalide (0 à 100 %).');
    onSubmit({
      label: label.trim(),
      sex,
      age,
      stars: needsStars ? stars : undefined,
      conditionPct: c,
      coat: coat || undefined,
      notes: notes.trim() || undefined,
    });
  }

  return (
    <Card style={{ borderColor: colors.accent }}>
      <Field label="Repère (facultatif)" value={label} onChangeText={setLabel} placeholder="ex. Grand mâle, bois cassé" />
      <Label>Sexe</Label>
      <ChipRow>
        <Chip label="Mâle" selected={sex === 'male'} onPress={() => setSex('male')} />
        <Chip label="Femelle" selected={sex === 'femelle'} onPress={() => setSex('femelle')} />
      </ChipRow>
      <Label>Âge</Label>
      <ChipRow>
        {(Object.keys(AGE_LABELS) as AgeStage[]).map((a) => (
          <Chip key={a} label={AGE_LABELS[a]} selected={age === a} onPress={() => setAge(a)} />
        ))}
      </ChipRow>
      {needsStars ? (
        <>
          <Label>Étoiles</Label>
          <ChipRow>
            {[1, 2, 3, 4, 5].map((n) => (
              <Chip key={n} label={'★'.repeat(n)} selected={stars === n} onPress={() => setStars(stars === n ? undefined : n)} />
            ))}
          </ChipRow>
        </>
      ) : null}
      <View style={{ maxWidth: 220 }}>
        <Field label="Condition physique (%)" value={condition} onChangeText={setCondition} keyboardType="decimal-pad" placeholder="ex. 31,7" />
      </View>
      <Label>Robe</Label>
      <ChipRow>
        {COAT_CHOICES.map((c) => (
          <Chip key={c.label} label={c.rare ? `✦ ${c.label}` : c.label} selected={coat === c.label} onPress={() => setCoat(coat === c.label ? '' : c.label)} />
        ))}
      </ChipRow>
      <Field label="Notes" value={notes} onChangeText={setNotes} placeholder="ex. boite de la patte avant" />
      {error ? <Text style={{ color: colors.danger, fontFamily: fonts.semibold, marginTop: 8 }}>{error}</Text> : null}
      <View style={[styles.row, { marginTop: 12 }]}>
        <View style={{ flex: 1 }}>
          <Button label="Annuler" kind="secondary" onPress={onCancel} />
        </View>
        <View style={{ flex: 1 }}>
          <Button label={submitLabel} onPress={submit} />
        </View>
      </View>
    </Card>
  );
}

function AnimalCard({ herdId, animal, speciesId, reserveId, index }: {
  herdId: string;
  animal: HerdAnimal;
  speciesId: string;
  reserveId: string;
  index: number;
}) {
  const { updateAnimal, removeAnimal } = useCarnet();
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const advice = adviceFor(animal);
  const alive = animal.status === 'vivant';
  const title =
    animal.label || `${animal.sex === 'male' ? 'Mâle' : 'Femelle'} ${AGE_LABELS[animal.age].toLowerCase()} n°${index + 1}`;

  if (editing) {
    return (
      <AnimalForm
        initial={animal}
        submitLabel="Enregistrer"
        onCancel={() => setEditing(false)}
        onSubmit={(a) => {
          updateAnimal(herdId, animal.id, { ...a, lastSeen: new Date().toISOString() });
          setEditing(false);
        }}
      />
    );
  }

  const facts = [
    animal.sex === 'male' ? '♂ Mâle' : '♀ Femelle',
    AGE_LABELS[animal.age],
    animal.stars ? '★'.repeat(animal.stars) : null,
    animal.conditionPct !== undefined ? `${String(animal.conditionPct).replace('.', ',')} %` : null,
  ].filter(Boolean);

  return (
    <Card style={{ gap: 6, opacity: alive ? 1 : 0.6 }}>
      <View style={[styles.row, { justifyContent: 'space-between', alignItems: 'flex-start' }]}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.strong}>{title}</Text>
          <Text style={styles.muted}>{facts.join(' · ')}</Text>
        </View>
        {alive ? (
          <VerdictBadge verdict={advice.verdict} />
        ) : (
          <Text style={[styles.muted, { fontFamily: fonts.semibold }]}>
            {animal.status === 'preleve' ? `Prélevé${animal.takenAt ? ` le ${formatDate(animal.takenAt)}` : ''}` : 'Disparu'}
          </Text>
        )}
      </View>
      {alive ? <Text style={[styles.muted, { color: colors.text }]}>{advice.reason}</Text> : null}
      {isRareCoat(animal.coat) ? (
        <Text style={{ color: colors.gold, fontFamily: fonts.semibold, fontSize: 13 }}>
          ✦ Fourrure {animal.coat?.toLowerCase()} : trophée Ultime potentiel, à empailler.
        </Text>
      ) : null}
      {animal.notes ? <Text style={styles.muted}>📝 {animal.notes}</Text> : null}
      <Text style={[styles.muted, { fontSize: 12 }]}>Vu le {formatDate(animal.lastSeen)}</Text>
      {alive ? (
        <ChipRow>
          <Chip label="Revu" onPress={() => updateAnimal(herdId, animal.id, { lastSeen: new Date().toISOString() })} />
          <Chip label="Modifier" onPress={() => setEditing(true)} />
          <Chip
            label="Prélevé → saisir"
            tone="olive"
            selected
            onPress={() => {
              updateAnimal(herdId, animal.id, { status: 'preleve', takenAt: new Date().toISOString() });
              router.push({
                pathname: '/chasse/edition',
                params: {
                  speciesId,
                  reserveId,
                  sex: animal.sex,
                  ...(animal.conditionPct !== undefined ? { conditionPct: String(animal.conditionPct) } : {}),
                  ...(animal.stars ? { stars: String(animal.stars) } : {}),
                },
              });
            }}
          />
          <Chip label="Disparu" onPress={() => updateAnimal(herdId, animal.id, { status: 'disparu' })} />
        </ChipRow>
      ) : (
        <ChipRow>
          <Chip label="Remettre vivant" onPress={() => updateAnimal(herdId, animal.id, { status: 'vivant', takenAt: undefined })} />
          {confirm ? (
            <Chip label="Confirmer la suppression" tone="danger" selected onPress={() => removeAnimal(herdId, animal.id)} />
          ) : (
            <Chip label="Supprimer" tone="danger" onPress={() => setConfirm(true)} />
          )}
        </ChipRow>
      )}
    </Card>
  );
}

export default function HerdScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state, updateHerd, deleteHerd, addAnimal } = useCarnet();
  const [reminderMsg, setReminderMsg] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const herd = state.herds.find((h) => h.id === id);

  if (!herd) {
    return (
      <Screen top={false}>
        <Empty>Ce troupeau n&apos;existe plus.</Empty>
      </Screen>
    );
  }

  const species = getSpecies(herd.speciesId);
  const info = getSpeciesInfo(herd.speciesId, state.speciesSheets);
  const s = summarizeHerd(herd);
  const takenToday = malesTakenToday(herd);
  const days = daysSince(herd.lastVisit);
  const animals = sortAnimals(herd.animals);
  const due = isVisitDue(herd);
  const h = herd;

  /** Visite notée : le compte à rebours de 24 h du rappel repart de maintenant. */
  async function visitToday() {
    const patch: { lastVisit: string; reminderId?: string } = { lastVisit: new Date().toISOString() };
    if (h.reminderId) {
      await cancelHerdReminder(h.reminderId);
      patch.reminderId = await scheduleHerdReminder(h.name);
    }
    updateHerd(h.id, patch);
  }

  async function toggleReminder() {
    if (h.reminderId) {
      await cancelHerdReminder(h.reminderId);
      updateHerd(h.id, { reminderId: undefined });
      setReminderMsg('Rappel arrêté.');
      return;
    }
    const rid = await scheduleHerdReminder(h.name);
    if (rid) {
      updateHerd(h.id, { reminderId: rid });
      setReminderMsg('Rappel programmé : une notification toutes les 24 h.');
    } else {
      setReminderMsg('Notifications refusées : autorisez-les pour Affût dans les réglages du téléphone.');
    }
  }

  return (
    <Screen top={false}>
      <Stack.Screen options={{ title: herd.name }} />
      <Card style={{ gap: 4 }}>
        <Text style={styles.title}>{species?.name}</Text>
        <Text style={styles.muted}>
          {getReserve(herd.reserveId)?.name}
          {herd.place ? ` · ${herd.place}` : ''} · suivi depuis le {formatDate(herd.createdAt)}
        </Text>
        <Text style={styles.text}>
          Dernière visite : {days === 0 ? "aujourd'hui" : `il y a ${days} jour${days > 1 ? 's' : ''}`}
        </Text>
        <Field
          label="⛺ Tente la plus proche"
          value={herd.camp ?? ''}
          onChangeText={(t) => updateHerd(herd.id, { camp: t || undefined })}
          placeholder="ex. tente de la crête, 400 m au sud"
        />
        <View style={{ marginTop: 6 }}>
          <Button label="Visite aujourd'hui" kind="secondary" onPress={visitToday} />
        </View>
      </Card>

      <Card style={{ gap: 6, borderColor: due ? colors.accent : colors.border }}>
        <View style={[styles.row, { justifyContent: 'space-between' }]}>
          <Text style={styles.strong}>Surveillance toutes les 24 h</Text>
          {due ? <Text style={{ color: colors.accent, fontFamily: fonts.semibold }}>À revoir</Text> : null}
        </View>
        <Text style={styles.muted}>{AGING_NOTE}</Text>
        {REMINDERS_SUPPORTED ? (
          <Button
            label={herd.reminderId ? 'Arrêter le rappel' : 'Me rappeler toutes les 24 h'}
            kind={herd.reminderId ? 'secondary' : 'primary'}
            onPress={toggleReminder}
          />
        ) : (
          <Text style={styles.muted}>Les notifications de rappel fonctionnent dans l&apos;appli Android.</Text>
        )}
        {herd.reminderId ? <Text style={{ color: colors.olive, fontSize: 13 }}>Rappel actif sur ce téléphone.</Text> : null}
        {reminderMsg ? <Text style={styles.muted}>{reminderMsg}</Text> : null}
      </Card>

      {takenToday >= 1 ? (
        <Card style={{ borderColor: colors.danger, backgroundColor: colors.dangerSoft }}>
          <Text style={[styles.strong, { color: colors.danger }]}>Un mâle déjà prélevé aujourd&apos;hui</Text>
          <Text style={styles.text}>
            Règle d&apos;or : un seul mâle par troupeau et par session, sinon la pression de chasse fait fuir les animaux.
          </Text>
        </Card>
      ) : null}

      <Card style={{ gap: 6 }}>
        <View style={[styles.row, { justifyContent: 'space-between' }]}>
          <Text style={styles.text}>
            {s.alive} vivant{s.alive > 1 ? 's' : ''} · {s.males} ♂ · {s.females} ♀ · {s.young} jeune{s.young > 1 ? 's' : ''}
          </Text>
          <Text style={styles.muted}>{s.taken} prélevé{s.taken > 1 ? 's' : ''}</Text>
        </View>
        <ChipRow>
          {s.byVerdict.eliminer ? <VerdictBadge verdict="eliminer" /> : null}
          {s.byVerdict.trophee ? <VerdictBadge verdict="trophee" /> : null}
          {s.byVerdict.surveiller ? <VerdictBadge verdict="surveiller" /> : null}
          {s.byVerdict.epargner ? <VerdictBadge verdict="epargner" /> : null}
        </ChipRow>
        <Text style={styles.muted}>
          {s.byVerdict.eliminer} à prélever · {s.byVerdict.trophee} trophée(s) à attendre · {s.byVerdict.surveiller} à surveiller ·{' '}
          {s.byVerdict.epargner} à épargner
        </Text>
        <Label>Statut de la population (vu en jeu)</Label>
        <ChipRow>
          {(Object.keys(POPULATION_LABELS) as PopulationStatus[]).map((p) => (
            <Chip
              key={p}
              label={POPULATION_LABELS[p]}
              selected={herd.population === p}
              onPress={() => updateHerd(herd.id, { population: herd.population === p ? undefined : p })}
            />
          ))}
        </ChipRow>
      </Card>

      {info?.routine ? (
        <Card style={{ gap: 4 }}>
          <Text style={styles.strong}>Routine selon le jeu</Text>
          <Text style={styles.text}>
            {routineSlots(info)
              .map((r) => `${NEED_ICONS[r.need]} ${NEED_LABELS[r.need]} ${String(r.from).padStart(2, '0')}–${String(r.to).padStart(2, '0')} h`)
              .join('   ')}
          </Text>
          <Text style={styles.muted}>Les horaires exacts du troupeau sont ceux de ses zones de besoin sur la carte.</Text>
        </Card>
      ) : null}

      <SectionTitle right={<Text style={styles.muted}>{herd.animals.length}</Text>}>Animaux</SectionTitle>
      {adding ? (
        <AnimalForm
          submitLabel="Ajouter"
          onCancel={() => setAdding(false)}
          onSubmit={(a) => {
            addAnimal(herd.id, a);
            setAdding(false);
          }}
        />
      ) : (
        <Button label="+ Ajouter un animal observé" onPress={() => setAdding(true)} />
      )}
      {animals.length === 0 && !adding ? <Empty>Analysez les animaux aux jumelles et ajoutez-les ici.</Empty> : null}
      {animals.map((a, i) => (
        <AnimalCard key={a.id} herdId={herd.id} animal={a} speciesId={herd.speciesId} reserveId={herd.reserveId} index={i} />
      ))}

      <View style={{ marginTop: 24 }}>
        {confirmDelete ? (
          <Card style={{ gap: 8, borderColor: colors.danger }}>
            <Text style={styles.text}>Supprimer ce troupeau et ses {herd.animals.length} animaux ?</Text>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Button label="Annuler" kind="secondary" onPress={() => setConfirmDelete(false)} />
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  label="Supprimer"
                  kind="danger"
                  onPress={() => {
                    cancelHerdReminder(herd.reminderId);
                    deleteHerd(herd.id);
                    router.back();
                  }}
                />
              </View>
            </View>
          </Card>
        ) : (
          <Pressable onPress={() => setConfirmDelete(true)} hitSlop={8} style={{ alignSelf: 'center', padding: 8 }}>
            <Text style={{ color: colors.danger, fontFamily: fonts.semibold }}>Supprimer le troupeau</Text>
          </Pressable>
        )}
      </View>
    </Screen>
  );
}
