import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { HISTORY_PRESETS, type HistoryPresetId, historyPreset } from '../logic/historyPrices';
import { formatEur } from '../logic/format';
import {
  createPopulation,
  INCOME_BANDS,
  type Population,
  type PopSummary,
  stepWeek,
  summarizePopulation,
} from '../logic/population';
import { colors } from '../theme';
import { Segmented } from './Segmented';
import { Banner, Button, Card, Hint, KeyValue, SectionTitle } from './ui';

const RAMPS = [
  { value: '0', label: 'Tous dès le départ' },
  { value: '52', label: 'Sur 12 mois' },
  { value: '104', label: 'Sur 24 mois' },
] as const;

const CAPS = [
  { value: '500000', label: '500 k€' },
  { value: '1000000', label: '1 M€' },
  { value: '2000000', label: '2 M€' },
] as const;

const eur = (n: number) => formatEur(Math.round(n));

/** Espace DEV : 15 000 clients fictifs répartis par tranche de revenu (Insee), sur une période historique réelle. */
export function PopulationPanel() {
  const [preset, setPreset] = useState<HistoryPresetId>('recent');
  const [ramp, setRamp] = useState<string>('104');
  const [cap, setCap] = useState<string>('500000');
  const [progress, setProgress] = useState<{ week: number; total: number } | null>(null);
  const [result, setResult] = useState<PopSummary | null>(null);
  const [series, setSeries] = useState<Population['series']>([]);
  const stop = useRef(false);

  useEffect(
    () => () => {
      stop.current = true;
    },
    [],
  );

  function run() {
    stop.current = false;
    const p = historyPreset(preset);
    const weeks = Math.round(p.years * 52);
    const pop = createPopulation({
      start: new Date(`${p.start}T08:00:00`),
      rampWeeks: Number(ramp),
      prices: 'history',
      insuranceCap: Number(cap),
    });
    setResult(null);
    setSeries([]);
    setProgress({ week: 0, total: weeks });
    const chunk = () => {
      if (stop.current) return;
      const upto = Math.min(weeks, pop.week + 8);
      while (pop.week < upto) stepWeek(pop);
      if (pop.week < weeks) {
        setProgress({ week: pop.week, total: weeks });
        setTimeout(chunk, 10);
      } else {
        setResult(summarizePopulation(pop));
        setSeries(pop.series);
        setProgress(null);
      }
    };
    setTimeout(chunk, 20);
  }

  const running = progress !== null;
  const s = result;

  return (
    <>
      <Banner icon="👥" title="Population de 15 000 clients fictifs">
        Les clients sont répartis par tranche de revenu d’après l’Insee (salariés du privé, net mensuel), et la
        simulation rejoue les vrais cours de l’or, de l’argent et du platine d’une période passée. Modèle agrégé : mêmes
        tarifs que l’appli, mais chaque client n’est qu’un budget et des soldes. Ordres de grandeur, pas une prévision.
      </Banner>

      <SectionTitle>Période historique</SectionTitle>
      <Segmented
        value={preset}
        onChange={setPreset}
        options={HISTORY_PRESETS.map((p) => ({ value: p.id, label: p.label.split(' : ')[0] }))}
      />
      <Hint>
        {historyPreset(preset).label} · {historyPreset(preset).years} ans de cours réels
      </Hint>
      <SectionTitle>Arrivée des clients</SectionTitle>
      <Segmented value={ramp} onChange={setRamp} options={RAMPS.map((x) => ({ value: x.value, label: x.label }))} />
      <SectionTitle>Plafond d’assurance du stock</SectionTitle>
      <Segmented value={cap} onChange={setCap} options={CAPS.map((x) => ({ value: x.value, label: x.label }))} />
      <Button
        title={running ? `Semaine ${progress!.week} sur ${progress!.total}…` : 'Lancer la simulation'}
        disabled={running}
        onPress={run}
      />

      {s ? (
        <>
          <SectionTitle>Résultat</SectionTitle>
          <Card style={{ gap: 6 }}>
            <KeyValue label="Durée · clients" value={`${s.years} ans · ${s.clients.toLocaleString('fr-FR')}`} />
            <KeyValue label="Clients encore actifs" value={s.active.toLocaleString('fr-FR')} />
            <KeyValue label="Cours de l’or" value={`${s.goldStart.toFixed(0)} → ${s.goldEnd.toFixed(0)} €/g`} />
            <KeyValue label="Revenus" value={eur(s.revenue.total)} strong />
            <KeyValue label="· frais d’achat" value={eur(s.revenue.buy)} />
            <KeyValue label="· lingotins et pièces" value={eur(s.revenue.bars)} />
            <KeyValue label="· garde" value={eur(s.revenue.custody + s.revenue.vault)} />
            <KeyValue label="· carte" value={eur(s.revenue.card)} />
            <KeyValue label="Coûts variables" value={eur(s.costs.total - s.costs.fixed)} />
            <KeyValue label="Frais fixes (hypothèse de l’appli)" value={eur(s.costs.fixed)} />
            <KeyValue label="Résultat avant frais fixes" value={eur(s.contribution)} />
            <KeyValue label="Résultat final" value={eur(s.result)} strong />
            <KeyValue label="Épargne confiée par les clients" value={eur(s.assets)} />
          </Card>

          <SectionTitle>Stock et assurance</SectionTitle>
          <Card style={{ gap: 6 }}>
            <KeyValue label="Pic de stock assuré" value={`${eur(s.peakInsured)} sur ${eur(s.insuranceCap)}`} strong />
            <KeyValue label="Commandes bloquées par l’assurance" value={String(s.insuranceBlocked)} />
            <KeyValue label="Retraits de lingotins et pièces" value={s.withdrawals.toLocaleString('fr-FR')} />
            <KeyValue label="Retraits impossibles (stock épuisé)" value={s.stockouts.toLocaleString('fr-FR')} />
            <KeyValue label="Pièces commandées à l’unité" value={s.onDemandOrders.toLocaleString('fr-FR')} />
          </Card>

          <SectionTitle>Par tranche de revenu</SectionTitle>
          <Card style={{ gap: 8 }}>
            {s.byBand.map((b) => (
              <View key={b.id} style={{ gap: 2 }}>
                <Text style={styles.title}>{b.label}</Text>
                <Text style={styles.line}>
                  {(b.share * 100).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} % des salariés ·{' '}
                  {b.clients.toLocaleString('fr-FR')} clients · revenus {eur(b.revenue)}
                </Text>
              </View>
            ))}
          </Card>

          <SectionTitle>Par segment</SectionTitle>
          <Card style={{ gap: 8 }}>
            {s.bySegment.map((g) => (
              <View key={g.segment} style={{ gap: 2 }}>
                <Text style={styles.title}>{g.label}</Text>
                <Text style={styles.line}>
                  {g.clients.toLocaleString('fr-FR')} clients · revenus {eur(g.revenue)} · coûts {eur(g.costs)}
                </Text>
              </View>
            ))}
          </Card>

          <SectionTitle>Évolution</SectionTitle>
          <Card style={{ gap: 3 }}>
            {series
              .filter((_, i) => i % 6 === 0)
              .map((p) => (
                <Text key={p.week} style={styles.line}>
                  {p.date} · {p.clients.toLocaleString('fr-FR')} clients · épargne {eur(p.assets)} · stock{' '}
                  {eur(p.insured)} · or {p.gold.toFixed(0)} €/g
                </Text>
              ))}
          </Card>
          <Hint>
            Hypothèses : tranches de l’Insee (revenu net mensuel des salariés du privé : 10 % sous 1 SMIC, médiane à 1,5
            SMIC, 1 % au-dessus de 7 SMIC). La part d’épargne ({INCOME_BANDS[0].savingsRate * 100} % à{' '}
            {INCOME_BANDS[6].savingsRate * 100} % selon la tranche), la part placée en métaux, le choix des segments et
            les départs de clients sont des hypothèses du simulateur. La garde coûte plus cher à Orvia (tarif de Godot &
            Fils) qu’elle ne rapporte : c’est ce que montre la simulation.
          </Hint>
        </>
      ) : (
        <Hint>
          Touchez « Lancer la simulation » : trois ans de cours réels prennent quelques secondes, dix ans environ dix.
        </Hint>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.text, fontSize: 13.5, fontWeight: '700' },
  line: { color: colors.textMuted, fontSize: 12 },
});
