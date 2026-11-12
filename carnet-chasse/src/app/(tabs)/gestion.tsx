import { router } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { Select } from '../../components/Select';
import { Card, Chip, ChipRow, Field, FieldRow, Label, Screen, SectionTitle, Title, styles } from '../../components/ui';
import { SPECIES } from '../../data/game';
import { getSpeciesInfo } from '../../data/speciesInfo';
import { herdMedian } from '../../logic/herds';
import { parseNumber } from '../../logic/stats';
import { useCarnet } from '../../state/CarnetProvider';
import {
  type AgeClass,
  advise,
  DISTANCE_GOLDEN_RULE,
  DISTANCE_RULES,
  explain,
  isMatureByAge,
  lifeFromAge,
  type LifeStage,
  type Sex,
  type Verdict,
  YOUNG_CUTOFF,
  YOUNG_CUTOFF_PRUDENT,
} from '../../logic/management';
import { colors, fonts } from '../../theme';

const VERDICT_STYLE: Record<Verdict, { color: string; bg: string; icon: string }> = {
  eliminer: { color: colors.olive, bg: colors.oliveSoft, icon: '🟢' },
  trophee: { color: colors.accent, bg: colors.accentSoft, icon: '🟡' },
  surveiller: { color: colors.accent, bg: colors.accentSoft, icon: '🟠' },
  possible: { color: colors.olive, bg: colors.oliveSoft, icon: '🟢' },
  epargner: { color: colors.danger, bg: colors.dangerSoft, icon: '🔴' },
  libre: { color: colors.textMuted, bg: colors.surfaceAlt, icon: '⚪' },
};

export default function GestionScreen() {
  const { state, setPrudent } = useCarnet();
  const [sex, setSex] = useState<Sex>('male');
  const [age, setAge] = useState<AgeClass>('adulte');
  const [condition, setCondition] = useState('');
  const [stage, setStage] = useState<LifeStage>('normal');
  const [speciesId, setSpeciesId] = useState<string | undefined>();
  const [herdId, setHerdId] = useState<string | undefined>();
  const herd = state.herds.find((h) => h.id === herdId);
  const herdMedianPct = herd ? herdMedian(herd, sex) : undefined;
  const [ageYears, setAgeYears] = useState('');
  const [lifespan, setLifespan] = useState('');

  const info = getSpeciesInfo(speciesId, state.speciesSheets);
  const years = parseNumber(ageYears);
  const lifespanYears = parseNumber(lifespan) ?? info?.lifespanYears;
  const life = lifeFromAge(years, lifespanYears);

  const onAgeYears = (t: string) => {
    setAgeYears(t);
    const mature = isMatureByAge(parseNumber(t), info?.matureAgeYears);
    if (mature === true) setAge('mur');
    else if (mature === false && age === 'mur') setAge('adulte');
  };

  const showStage = !life && (sex === 'femelle' || age === 'mur');
  const cutoff = state.prudent ? YOUNG_CUTOFF_PRUDENT : YOUNG_CUTOFF;
  const advice = advise({
    sex,
    age,
    conditionPct: parseNumber(condition),
    lifeStage: showStage ? stage : 'normal',
    youngCutoff: cutoff,
    ageYears: years,
    lifespanYears,
  });
  const v = VERDICT_STYLE[advice.verdict];
  const details = explain(
    { sex, age, conditionPct: parseNumber(condition), ageYears: years, lifespanYears, herdMedianPct },
    advice.verdict,
  );

  return (
    <Screen>
      <Title subtitle="Votre guide du garde-chasse : quoi prélever, quoi épargner, à quelle distance.">Gestion du troupeau</Title>

      <Card onPress={() => router.push('/troupeaux')} style={{ borderColor: colors.accent, gap: 2 }}>
        <View style={[styles.row, { justifyContent: 'space-between' }]}>
          <Text style={[styles.section, { fontSize: 20 }]}>Mes troupeaux</Text>
          <Text style={{ color: colors.accent, fontFamily: fonts.heading, fontSize: 20 }}>{state.herds.length} →</Text>
        </View>
        <Text style={styles.muted}>Suivez chaque animal observé : l&apos;appli dit qui prélever et qui épargner.</Text>
      </Card>

      <SectionTitle>Tirer ou épargner ?</SectionTitle>
      <Card>
        {state.herds.length ? (
          <Select
            label="Comparer à un troupeau (facultatif)"
            value={herdId}
            onChange={(v) => {
              setHerdId(v || undefined);
              const h = state.herds.find((x) => x.id === v);
              if (h) {
                setSpeciesId(h.speciesId);
                setLifespan('');
              }
            }}
            placeholder="Aucun"
            allowCustom={false}
            allowClear
            options={state.herds.map((h) => ({ value: h.id, label: h.name }))}
          />
        ) : null}
        <Select
          label="Espèce (facultatif)"
          value={speciesId}
          onChange={(v) => {
            setSpeciesId(v || undefined);
            setLifespan('');
          }}
          placeholder="Toutes espèces"
          allowCustom={false}
          allowClear
          searchable
          options={SPECIES.map((sp) => ({ value: sp.id, label: sp.name }))}
        />
        <Label>Sexe</Label>
        <ChipRow>
          <Chip label="Mâle" selected={sex === 'male'} onPress={() => setSex('male')} />
          <Chip label="Femelle" selected={sex === 'femelle'} onPress={() => setSex('femelle')} />
        </ChipRow>
        <Label>Classe d&apos;âge</Label>
        <ChipRow>
          <Chip label="Jeune" selected={age === 'jeune'} onPress={() => setAge('jeune')} />
          <Chip label="Adulte" selected={age === 'adulte'} onPress={() => setAge('adulte')} />
          <Chip label="Âgé (mûr)" selected={age === 'mur'} onPress={() => setAge('mur')} />
        </ChipRow>
        <FieldRow>
          <Field label="Âge" unit="ans" value={ageYears} onChangeText={onAgeYears} keyboardType="decimal-pad" placeholder="ex. 12" />
          <Field
            label="Espérance de vie"
            unit="ans"
            value={lifespan}
            onChangeText={setLifespan}
            keyboardType="decimal-pad"
            placeholder={info?.lifespanYears !== undefined ? String(info.lifespanYears) : 'ex. 14'}
          />
        </FieldRow>
        {life ? (
          <Text style={[styles.muted, { color: colors.olive }]}>
            Moment de vie calculé :{' '}
            {life.stage === 'derniere' ? 'dernière année' : life.stage === 'avant-derniere' ? 'avant-dernière année' : 'normal'} · reste{' '}
            {life.yearsLeft} an{life.yearsLeft > 1 ? 's' : ''} ({life.yearsLeft * 3} jours en jeu).
          </Text>
        ) : (
          <Text style={styles.muted}>
            Avec l&apos;âge et l&apos;espérance de vie (fiche de l&apos;espèce ou saisie ici), l&apos;appli trouve seule l&apos;avant-dernière et la
            dernière année.
          </Text>
        )}
        {showStage ? (
          <>
            <Label>Moment de vie</Label>
            <ChipRow>
              <Chip label="Normal" selected={stage === 'normal'} onPress={() => setStage('normal')} />
              {sex === 'male' ? (
                <Chip label="Avant-dernière année" selected={stage === 'avant-derniere'} onPress={() => setStage('avant-derniere')} />
              ) : null}
              <Chip label="Dernière année (fin de vie)" tone="olive" selected={stage === 'derniere'} onPress={() => setStage('derniere')} />
            </ChipRow>
          </>
        ) : null}
        <View style={{ maxWidth: 220 }}>
          <Field
            label="Condition physique"
            unit="%"
            value={condition}
            onChangeText={setCondition}
            keyboardType="decimal-pad"
            placeholder="ex. 35"
          />
        </View>
        {sex === 'male' && age === 'jeune' ? (
          <ChipRow>
            <Chip
              label={state.prudent ? '✓ Mode prudent (seuil 40 %)' : 'Mode prudent (seuil 40 %)'}
              tone="olive"
              selected={state.prudent}
              onPress={() => setPrudent(!state.prudent)}
            />
          </ChipRow>
        ) : null}

        <View style={{ marginTop: 14, padding: 12, borderRadius: 12, backgroundColor: v.bg, gap: 4 }}>
          <Text style={{ color: v.color, fontSize: 18, fontFamily: fonts.heading }}>
            {v.icon} {advice.title}
          </Text>
          <Text style={styles.text}>{advice.reason}</Text>
        </View>
        {details.length ? (
          <View style={{ marginTop: 10, gap: 6 }}>
            {details.map((t) => (
              <Text key={t} style={styles.text}>
                {t}
              </Text>
            ))}
          </View>
        ) : null}
      </Card>

      <SectionTitle>🎯 Distances de tir</SectionTitle>
      {DISTANCE_RULES.map((r) => (
        <Card key={r.title} style={{ gap: 4 }}>
          <Text style={styles.strong}>
            {r.icon} {r.title}
          </Text>
          <Text style={{ color: colors.accent, fontSize: 18, fontFamily: fonts.heading }}>{r.range}</Text>
          <Text style={styles.text}>{r.why}</Text>
          <Text style={styles.muted}>{r.weapons}</Text>
        </Card>
      ))}
      <Card style={{ borderColor: colors.accent }}>
        <Text style={styles.text}>🚀 {DISTANCE_GOLDEN_RULE}</Text>
      </Card>
      <Text style={[styles.muted, { marginTop: 8 }]}>
        Conseils de joueurs, non vérifiés dans les notes officielles du jeu.
      </Text>
    </Screen>
  );
}
