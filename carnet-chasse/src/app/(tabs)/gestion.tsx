import { router } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { Select } from '../../components/Select';
import { Card, Chip, ChipRow, Field, FieldRow, Label, Screen, SectionTitle, Title, styles } from '../../components/ui';
import { SPECIES } from '../../data/game';
import { getSpeciesInfo } from '../../data/speciesInfo';
import { parseNumber } from '../../logic/stats';
import { useCarnet } from '../../state/CarnetProvider';
import {
  type AgeClass,
  advise,
  DISTANCE_GOLDEN_RULE,
  DISTANCE_RULES,
  FITNESS_RULES,
  isMatureByAge,
  lifeFromAge,
  GAME_RULES,
  GOLDEN_RULES,
  type LifeStage,
  OBJECTIVE,
  POPULATION_PATIENCE,
  POPULATION_STATUSES,
  type Sex,
  STRATEGY,
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

const STATUS_COLORS = [colors.danger, colors.accent, colors.olive, colors.olive];

function GuideBlock({ icon, title, color, items }: { icon: string; title: string; color: string; items: string[] }) {
  return (
    <Card style={{ gap: 6, borderColor: color }}>
      <Text style={[styles.strong, { color }]}>
        {icon} {title}
      </Text>
      {items.map((t) => (
        <Text key={t} style={styles.text}>
          • {t}
        </Text>
      ))}
    </Card>
  );
}

export default function GestionScreen() {
  const { state, setPrudent } = useCarnet();
  const [sex, setSex] = useState<Sex>('male');
  const [age, setAge] = useState<AgeClass>('adulte');
  const [condition, setCondition] = useState('');
  const [stage, setStage] = useState<LifeStage>('normal');
  const [speciesId, setSpeciesId] = useState<string | undefined>();
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
      </Card>

      <SectionTitle>🧬 Comprendre le fitness</SectionTitle>
      <Text style={styles.muted}>Le fitness est la « condition physique » en % lue aux jumelles.</Text>
      {FITNESS_RULES.map((r) => (
        <Card key={r.title} style={{ gap: 4 }}>
          <Text style={styles.strong}>{r.title}</Text>
          <Text style={styles.text}>{r.text}</Text>
        </Card>
      ))}

      <SectionTitle>📖 Ce que dit le jeu</SectionTitle>
      <Text style={styles.muted}>Encyclopédie du jeu : « Gestion de la faune et abattage ».</Text>
      <Card style={{ gap: 6, borderColor: colors.accent }}>
        {GAME_RULES.map((t) => (
          <Text key={t} style={styles.text}>
            • {t}
          </Text>
        ))}
      </Card>
      <Card style={{ gap: 6 }}>
        <Text style={styles.strong}>Statut des populations</Text>
        {POPULATION_STATUSES.map((p, i) => (
          <View key={p.name} style={[styles.row, { alignItems: 'flex-start' }]}>
            <Text style={{ color: STATUS_COLORS[i], fontFamily: fonts.heading, width: 92 }}>{p.name}</Text>
            <Text style={[styles.text, { flex: 1 }]}>{p.text}</Text>
          </View>
        ))}
        <Text style={styles.muted}>{POPULATION_PATIENCE}</Text>
      </Card>

      <SectionTitle>🦌 La stratégie du garde-chasse</SectionTitle>
      <Card style={{ gap: 4 }}>
        <Text style={styles.strong}>L&apos;objectif</Text>
        <Text style={styles.text}>{OBJECTIVE}</Text>
        <Text style={[styles.muted, { marginTop: 4 }]}>{STRATEGY.intro}</Text>
      </Card>
      <GuideBlock icon="🟢" title="À prélever" color={colors.olive} items={STRATEGY.remove} />
      <GuideBlock icon="🔴" title="À garder" color={colors.danger} items={STRATEGY.keep} />
      <Text style={styles.muted}>Stratégie issue de nombreuses heures de jeu et de retours de la communauté.</Text>

      <SectionTitle>🤷 Rien à tirer dans ce troupeau ?</SectionTitle>
      <Card style={{ gap: 6 }}>
        <Text style={styles.text}>
          • Changez de troupeau : une même espèce forme plusieurs groupes distincts sur la carte. Suivez les lisières de
          forêts ou les clairières pour en trouver un autre qui aura, lui, des mâles mûrs à faible potentiel (1 ou 2
          étoiles) à prélever.
        </Text>
        <Text style={styles.text}>
          • Faites passer le temps : pour gérer ce troupeau précis, dormez quelques jours au chalet, ou sous une tente près du troupeau pour revenir plus vite. Les jeunes grandissent,
          de nouveaux individus apparaissent, et vous pourrez revenir voir si des mâles mûrs intéressants se sont installés.
        </Text>
        <Text style={[styles.strong, { color: colors.olive }]}>
          Un bon garde-chasse sait rentrer bredouille d&apos;une zone pour préserver l&apos;avenir de son territoire.
        </Text>
      </Card>

      <SectionTitle>⏱️ Les règles d&apos;or</SectionTitle>
      {GOLDEN_RULES.map((r, i) => (
        <Card key={r.title} style={{ gap: 4 }}>
          <Text style={styles.strong}>
            {i + 1}. {r.title}
          </Text>
          <Text style={styles.text}>{r.text}</Text>
        </Card>
      ))}

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
