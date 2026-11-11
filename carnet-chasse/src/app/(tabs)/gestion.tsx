import { router } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { Card, Chip, ChipRow, Field, Label, Screen, SectionTitle, Title, styles } from '../../components/ui';
import { parseNumber } from '../../logic/stats';
import { useCarnet } from '../../state/CarnetProvider';
import {
  type AgeClass,
  advise,
  DISTANCE_GOLDEN_RULE,
  DISTANCE_RULES,
  GAME_RULES,
  GOLDEN_RULES,
  OBJECTIVE,
  POPULATION_PATIENCE,
  POPULATION_STATUSES,
  type Sex,
  type Verdict,
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
  const { state } = useCarnet();
  const [sex, setSex] = useState<Sex>('male');
  const [age, setAge] = useState<AgeClass>('adulte');
  const [stars, setStars] = useState<number | undefined>(1);
  const [condition, setCondition] = useState('');

  const needsStars = sex === 'male' && age !== 'jeune';
  const needsCondition = sex === 'femelle' || age === 'jeune' || (age === 'adulte' && stars === 1);
  const advice = advise({
    sex,
    age,
    stars: needsStars ? stars : undefined,
    conditionPct: needsCondition ? parseNumber(condition) : undefined,
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
        <Label>Sexe</Label>
        <ChipRow>
          <Chip label="Mâle" selected={sex === 'male'} onPress={() => setSex('male')} />
          <Chip label="Femelle" selected={sex === 'femelle'} onPress={() => setSex('femelle')} />
        </ChipRow>
        <Label>Âge</Label>
        <ChipRow>
          <Chip label="Jeune" selected={age === 'jeune'} onPress={() => setAge('jeune')} />
          <Chip label="Adulte" selected={age === 'adulte'} onPress={() => setAge('adulte')} />
          <Chip label="Mûr" selected={age === 'mur'} onPress={() => setAge('mur')} />
        </ChipRow>
        {needsStars ? (
          <>
            <Label>Étoiles</Label>
            <ChipRow>
              {[1, 2, 3, 4, 5].map((n) => (
                <Chip key={n} label={'★'.repeat(n)} selected={stars === n} onPress={() => setStars(n)} />
              ))}
            </ChipRow>
          </>
        ) : null}
        {needsCondition ? (
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
        ) : null}

        <View style={{ marginTop: 14, padding: 12, borderRadius: 12, backgroundColor: v.bg, gap: 4 }}>
          <Text style={{ color: v.color, fontSize: 18, fontFamily: fonts.heading }}>
            {v.icon} {advice.title}
          </Text>
          <Text style={styles.text}>{advice.reason}</Text>
        </View>
      </Card>

      <SectionTitle>📖 Ce que dit le jeu</SectionTitle>
      <Text style={styles.muted}>Encyclopédie du jeu : « Gestion de la faune et abattage ». Prioritaire sur les conseils de joueurs.</Text>
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

      <SectionTitle>🦌 Le guide du garde-chasse</SectionTitle>
      <Card style={{ gap: 4 }}>
        <Text style={styles.strong}>L&apos;objectif</Text>
        <Text style={styles.text}>{OBJECTIVE}</Text>
      </Card>
      <GuideBlock
        icon="🟢"
        title="Les cibles prioritaires (à tuer)"
        color={colors.olive}
        items={[
          "Mâles mûrs (vieux) à 1 ou 2 étoiles : cibles n°1. Mauvaise génétique : tuez-les pour qu'ils ne se reproduisent plus et pour récupérer l'argent avant qu'ils meurent de vieillesse.",
          'Mâles adultes à 1 étoile avec une très basse condition physique (moins de 30-40 %) : éliminez-les pour stopper la transmission de leurs mauvais gènes dès le stade adulte.',
          'Jeunes mâles en condition basse : la cible recommandée par le jeu lui-même.',
          'Femelles en condition basse (surtout jeunes) : possible, mais effet moindre sur la population.',
        ]}
      />
      <GuideBlock
        icon="🟡"
        title="Trophées de luxe (à tuer en fin de vie)"
        color={colors.accent}
        items={[
          "Mâles mûrs à 3, 4 ou 5 étoiles : laissez-les transmettre leurs gènes, puis prélevez-les pendant leur dernière année de vie (les 3 derniers jours en jeu) pour le meilleur trophée.",
        ]}
      />
      <GuideBlock
        icon="🔴"
        title="Ne jamais toucher (à épargner)"
        color={colors.danger}
        items={[
          'Les jeunes et adultes prometteurs (condition 50 % ou plus) : laissez-les grandir, ils deviendront de beaux mûrs.',
          "Les femelles en bonne condition (sauf mission) : peu d'argent, et les tuer réduit la taille du troupeau.",
        ]}
      />

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
