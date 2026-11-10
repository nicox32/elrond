import { useState } from 'react';
import { Text, View } from 'react-native';

import { Card, Chip, ChipRow, Field, Label, Screen, SectionTitle, Title, styles } from '../../components/ui';
import { parseNumber } from '../../logic/stats';
import { type AgeClass, advise, GOLDEN_RULES, type Sex, type Verdict } from '../../logic/management';
import { colors } from '../../theme';

const VERDICT_STYLE: Record<Verdict, { color: string; bg: string; icon: string }> = {
  eliminer: { color: colors.olive, bg: colors.oliveSoft, icon: '🟢' },
  trophee: { color: colors.accent, bg: colors.accentSoft, icon: '🟡' },
  surveiller: { color: colors.accent, bg: colors.accentSoft, icon: '🟠' },
  epargner: { color: colors.danger, bg: colors.dangerSoft, icon: '🔴' },
  libre: { color: colors.textMuted, bg: colors.surfaceAlt, icon: '⚪' },
};

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
  const [sex, setSex] = useState<Sex>('male');
  const [age, setAge] = useState<AgeClass>('adulte');
  const [stars, setStars] = useState<number | undefined>(1);
  const [condition, setCondition] = useState('');

  const needsStars = sex === 'male' && age !== 'jeune';
  const needsCondition = needsStars && age === 'adulte' && stars === 1;
  const advice = advise({
    sex,
    age,
    stars: needsStars ? stars : undefined,
    conditionPct: needsCondition ? parseNumber(condition) : undefined,
  });
  const v = VERDICT_STYLE[advice.verdict];

  return (
    <Screen>
      <Title subtitle="Votre guide du garde-chasse : quoi prélever, quoi épargner.">Gestion du troupeau</Title>

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
              label="Condition physique (%)"
              value={condition}
              onChangeText={setCondition}
              keyboardType="decimal-pad"
              placeholder="ex. 35"
            />
          </View>
        ) : null}

        <View style={{ marginTop: 14, padding: 12, borderRadius: 12, backgroundColor: v.bg, gap: 4 }}>
          <Text style={{ color: v.color, fontSize: 18, fontWeight: '800' }}>
            {v.icon} {advice.title}
          </Text>
          <Text style={styles.text}>{advice.reason}</Text>
        </View>
      </Card>

      <SectionTitle>Le guide</SectionTitle>
      <GuideBlock
        icon="🟢"
        title="À éliminer (nettoyer le sang du troupeau)"
        color={colors.olive}
        items={[
          'Mâles adultes à 1 étoile avec une très basse condition physique (moins de 30-40 %) : à éliminer dès le stade adulte.',
        ]}
      />
      <GuideBlock
        icon="🟡"
        title="Trophées de luxe (à tuer en fin de vie)"
        color={colors.accent}
        items={[
          "Mâles mûrs à 3, 4 ou 5 étoiles : laissez-les vivre le plus longtemps possible pour qu'ils transmettent leurs gènes, puis prélevez-les juste avant qu'ils meurent de vieillesse pour le score maximal.",
        ]}
      />
      <GuideBlock
        icon="🔴"
        title="Ne jamais toucher (à épargner)"
        color={colors.danger}
        items={[
          'Tous les jeunes : on ne connaît pas encore leur potentiel génétique final.',
          'Les adultes prometteurs (ex. 1 étoile à 50 % ou plus) : ils deviendront de beaux mûrs à 3 ou 4 étoiles.',
          "Les femelles (sauf mission) : pas de gènes visibles, peu d'argent, et les tuer réduit la taille du troupeau.",
        ]}
      />

      <SectionTitle>⏱️ Les règles d&apos;or</SectionTitle>
      {GOLDEN_RULES.map((r, i) => (
        <Card key={r.title} style={{ gap: 4 }}>
          <Text style={styles.strong}>
            {i + 1}. {r.title}
          </Text>
          <Text style={styles.text}>{r.text}</Text>
        </Card>
      ))}
    </Screen>
  );
}
