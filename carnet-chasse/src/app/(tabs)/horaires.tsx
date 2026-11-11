import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Button, Card, Chip, ChipRow, Empty, Field, Label, Screen, SectionTitle, Title, styles } from '../../components/ui';
import { getReserve, getSpecies, RESERVES, SPECIES, speciesOfReserve } from '../../data/game';
import { getSpeciesInfo, routineSlots } from '../../data/speciesInfo';
import {
  formatTime,
  minutesUntil,
  NEED_ICONS,
  NEED_LABELS,
  parseTime,
  routineAt,
  sortByNext,
  STANDARD_ROUTINE,
  wakeUpTime,
} from '../../logic/schedule';
import type { NeedType, NeedZone, ReserveId } from '../../logic/types';
import { useCarnet } from '../../state/CarnetProvider';
import { colors, fonts } from '../../theme';

const HUNTING_RESERVES = RESERVES.filter((r) => SPECIES.some((s) => s.reserveId === r.id));
const NEEDS = Object.keys(NEED_LABELS) as NeedType[];
const QUICK_HOURS = [6, 8, 12, 16, 20];

function waitLabel(min: number): string {
  if (min === 0) return 'En cours';
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `Dans ${h ? `${h} h ` : ''}${m ? `${m} min` : ''}`.trim();
}

function ZoneCard({ zone, now }: { zone: NeedZone; now: number }) {
  const { removeZone } = useCarnet();
  const [confirm, setConfirm] = useState(false);
  const wait = minutesUntil(zone, now);
  const species = getSpecies(zone.speciesId);
  return (
    <Card style={{ gap: 4, borderColor: wait === 0 ? colors.olive : colors.border }}>
      <View style={[styles.row, { justifyContent: 'space-between' }]}>
        <Text style={[styles.strong, { flex: 1 }]}>
          {NEED_ICONS[zone.need]} {species?.name ?? zone.speciesId} · {NEED_LABELS[zone.need]}
        </Text>
        <Text style={{ color: wait === 0 ? colors.olive : colors.accent, fontFamily: fonts.semibold }}>{waitLabel(wait)}</Text>
      </View>
      <Text style={styles.text}>
        {formatTime(zone.startMin)} – {formatTime(zone.endMin)} · {getReserve(zone.reserveId)?.name}
      </Text>
      {zone.place ? <Text style={styles.muted}>📍 {zone.place}</Text> : null}
      <Text style={{ color: colors.olive, fontSize: 13 }}>⏰ Réveil conseillé au chalet : {formatTime(wakeUpTime(zone))}</Text>
      {confirm ? (
        <View style={styles.row}>
          <Text style={[styles.muted, { flex: 1 }]}>Supprimer cette zone ?</Text>
          <Chip label="Annuler" onPress={() => setConfirm(false)} />
          <Chip label="Supprimer" tone="danger" selected onPress={() => removeZone(zone.id)} />
        </View>
      ) : (
        <Pressable onPress={() => setConfirm(true)} hitSlop={6}>
          <Text style={{ color: colors.danger, fontSize: 13 }}>Supprimer</Text>
        </Pressable>
      )}
    </Card>
  );
}

function AddZone({ defaultReserve }: { defaultReserve: ReserveId }) {
  const { addZone } = useCarnet();
  const [open, setOpen] = useState(false);
  const [reserveId, setReserveId] = useState<ReserveId>(defaultReserve);
  const [speciesId, setSpeciesId] = useState<string | undefined>();
  const [need, setNeed] = useState<NeedType>('boire');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [place, setPlace] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!open) return <Button label="+ Ajouter une zone de besoin" onPress={() => setOpen(true)} />;

  function save() {
    const s = parseTime(start);
    const e = parseTime(end);
    if (!speciesId) return setError("Choisissez l'espèce.");
    if (s === undefined || e === undefined) return setError('Horaires invalides : utilisez le format 09:00.');
    if (s === e) return setError('Le début et la fin sont identiques.');
    addZone({ reserveId, speciesId, need, startMin: s, endMin: e, place: place.trim() || undefined });
    setSpeciesId(undefined);
    setStart('');
    setEnd('');
    setPlace('');
    setError(null);
    setOpen(false);
  }

  return (
    <Card>
      <Text style={styles.strong}>Nouvelle zone de besoin</Text>
      <Text style={styles.muted}>Recopiez l&apos;horaire affiché sur la carte quand vous examinez la zone.</Text>
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
      <Label>Espèce</Label>
      <ChipRow>
        {speciesOfReserve(reserveId).map((s) => (
          <Chip key={s.id} label={s.name} selected={speciesId === s.id} onPress={() => setSpeciesId(s.id)} />
        ))}
      </ChipRow>
      {speciesId && getSpeciesInfo(speciesId)?.routine ? (
        <Text style={{ color: colors.olive, fontSize: 13, marginTop: 6 }}>
          Routine du jeu :{' '}
          {routineSlots(getSpeciesInfo(speciesId)!)
            .map((r) => `${NEED_LABELS[r.need].toLowerCase()} ${String(r.from).padStart(2, '0')}–${String(r.to).padStart(2, '0')} h`)
            .join(', ')}
        </Text>
      ) : null}
      <Label>Besoin</Label>
      <ChipRow>
        {NEEDS.map((n) => (
          <Chip key={n} label={`${NEED_ICONS[n]} ${NEED_LABELS[n]}`} selected={need === n} onPress={() => setNeed(n)} />
        ))}
      </ChipRow>
      <View style={[styles.row, { flexWrap: 'wrap' }]}>
        <Field label="Début" value={start} onChangeText={setStart} placeholder="09:00" keyboardType="numbers-and-punctuation" />
        <Field label="Fin" value={end} onChangeText={setEnd} placeholder="11:30" keyboardType="numbers-and-punctuation" />
      </View>
      <Field label="Lieu (facultatif)" value={place} onChangeText={setPlace} placeholder="ex. lac au nord du chalet" />
      {error ? <Text style={{ color: colors.danger, fontFamily: fonts.semibold, marginTop: 8 }}>{error}</Text> : null}
      <View style={[styles.row, { marginTop: 12 }]}>
        <View style={{ flex: 1 }}>
          <Button label="Annuler" kind="secondary" onPress={() => setOpen(false)} />
        </View>
        <View style={{ flex: 1 }}>
          <Button label="Ajouter" onPress={save} />
        </View>
      </View>
    </Card>
  );
}

export default function HorairesScreen() {
  const { state } = useCarnet();
  const [now, setNow] = useState(8 * 60);
  const period = routineAt(now);
  const zones = useMemo(() => sortByNext(state.needZones, now), [state.needZones, now]);
  const shift = (d: number) => setNow((m) => (m + d + 24 * 60) % (24 * 60));

  return (
    <Screen>
      <Title subtitle="Boire, manger, dormir : planifiez vos chasses sur la routine des troupeaux.">Horaires</Title>

      <Card style={{ gap: 8 }}>
        <Text style={styles.muted}>Heure en jeu</Text>
        <View style={[styles.row, { justifyContent: 'space-between' }]}>
          <Chip label="− 1 h" onPress={() => shift(-60)} />
          <Text style={{ color: colors.text, fontSize: 34, fontFamily: fonts.heading }}>{formatTime(now)}</Text>
          <Chip label="+ 1 h" onPress={() => shift(60)} />
        </View>
        <ChipRow>
          {QUICK_HOURS.map((h) => (
            <Chip key={h} label={`${h} h`} selected={now === h * 60} onPress={() => setNow(h * 60)} />
          ))}
        </ChipRow>
        <View style={{ padding: 12, borderRadius: 12, backgroundColor: colors.accentSoft, gap: 4 }}>
          <Text style={{ color: colors.accent, fontSize: 17, fontFamily: fonts.heading }}>
            {period.icon} {period.label} : {period.title}
          </Text>
          <Text style={styles.text}>{period.text}</Text>
        </View>
      </Card>

      <SectionTitle right={<Text style={styles.muted}>{zones.length}</Text>}>Mes zones de besoin</SectionTitle>
      {zones.length === 0 ? (
        <Empty>
          Aucune zone enregistrée.{'\n'}Quand vous examinez une zone de besoin en jeu, notez ici son horaire : l&apos;appli
          vous dira quand vous réveiller au chalet.
        </Empty>
      ) : (
        zones.map((z) => <ZoneCard key={z.id} zone={z} now={now} />)
      )}
      <AddZone defaultReserve={state.lastReserveId ?? HUNTING_RESERVES[0].id} />

      <SectionTitle>Routine standard</SectionTitle>
      {STANDARD_ROUTINE.map((p) => (
        <Card key={p.label} style={{ gap: 4, borderColor: p === period ? colors.accent : colors.border }}>
          <Text style={styles.strong}>
            {p.icon} {p.label} ({String(p.from).padStart(2, '0')} h – {String(p.to).padStart(2, '0')} h) : {p.title}
          </Text>
          <Text style={styles.text}>{p.text}</Text>
        </Card>
      ))}
      <Text style={styles.muted}>
        Chaque espèce a sa propre routine (le cerf mulet, par exemple, boit à 00 h et 12 h, dort à 02 h et 16 h, mange à 07 h
        et 20 h) : voyez sa fiche dans l&apos;onglet Espèces. L&apos;horaire exact d&apos;un troupeau est celui affiché sur la carte.
      </Text>

      <SectionTitle>💡 L&apos;astuce du garde-chasse</SectionTitle>
      <Card style={{ gap: 6 }}>
        {[
          'Repérez une zone de besoin (ex. abreuvement cerf mulet 09:00 – 11:30) et notez-la ci-dessus.',
          'Allez dans un chalet ou un camping.',
          "Dormez jusqu'un peu avant l'horaire (ex. réveil à 08:45).",
          'Rendez-vous sur place en avance, installez-vous à 150 m sous le vent et attendez le troupeau.',
        ].map((t, i) => (
          <Text key={t} style={styles.text}>
            {i + 1}. {t}
          </Text>
        ))}
      </Card>
      <Text style={[styles.muted, { marginTop: 8 }]}>Conseils de joueurs, non vérifiés dans les notes officielles du jeu.</Text>
    </Screen>
  );
}
