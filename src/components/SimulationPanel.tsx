import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { formatEur } from '../logic/format';
import { BAR_PRODUCTS, stockedPieces } from '../logic/physical';
import {
  catchUp,
  createSimulation,
  MAX_CATCH_UP_DAYS,
  MIXES,
  type MixId,
  restoreSimulation,
  serializeSimulation,
  type Simulation,
  stepSimulation,
  summarize,
  summarizeBySegment,
} from '../logic/simulation';
import { clearSimulationText, loadSimulationText, saveSimulationText } from '../storage';
import { useBank } from '../state/BankProvider';
import { colors } from '../theme';
import { Segmented } from './Segmented';
import { Banner, Button, Card, Hint, KeyValue, SectionTitle } from './ui';

const SEGMENT_SHORT = {
  debank: 'débancarisés',
  physical: 'métaux physiques',
  small: 'petits budgets',
  daily: 'quotidiens',
} as const;

// La simulation vit hors de l'écran : en le quittant puis en revenant, elle reprend où elle en était.
let current: Simulation | null = null;

const SPEEDS = [
  { value: '1', label: 'Temps réel' },
  { value: '3600', label: '1 h / s' },
  { value: '86400', label: '1 jour / s' },
] as const;

/** Espace DEV : une base de clients fictifs qui achètent, vendent et retirent des lingotins aux cours en direct. */
export function SimulationPanel({ onBack }: { onBack: () => void }) {
  const { quote } = useBank();
  const [, setTick] = useState(0);
  const [running, setRunning] = useState(false);
  const [speed, setSpeed] = useState<string>('3600');
  const [mix, setMix] = useState<MixId>('balanced');
  const [priceMode, setPriceMode] = useState<'sim' | 'live'>('sim');
  const prices = useRef(quote.prices);
  const [note, setNote] = useState<string | null>(null);
  const [tooBig, setTooBig] = useState(false);
  useEffect(() => {
    prices.current = quote.prices;
  }, [quote.prices]);

  // Enregistre la simulation (au plus ~1,8 Mo : au-delà, Android ne sait plus la relire).
  const persist = () => {
    if (!current) return;
    const text = serializeSimulation(current);
    if (text.length > 1_800_000) {
      setTooBig(true);
      return;
    }
    void saveSimulationText(text);
  };

  // À l'ouverture : on reprend la simulation enregistrée et on rattrape le temps passé appli fermée, en temps réel.
  useEffect(() => {
    let alive = true;
    void loadSimulationText().then((text) => {
      if (!alive) return;
      const saved = restoreSimulation(text);
      if (!saved || current) return;
      const elapsed = (Date.now() - saved.savedAt.getTime()) / 1000;
      const done = catchUp(saved.sim, prices.current, elapsed);
      current = saved.sim;
      if (done > 60) {
        const days = done / 86_400;
        setNote(
          `Rattrapage : ${days >= 1 ? `${days.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} jours` : `${Math.round(done / 3600)} h`} simulés pendant que l’appli était fermée${elapsed > MAX_CATCH_UP_DAYS * 86_400 ? ` (limité à ${MAX_CATCH_UP_DAYS} jours)` : ''}.`,
        );
      }
      setTick((t) => t + 1);
      persist();
    });
    return () => {
      alive = false;
      persist();
    };
  }, []);

  const sim = current;

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      if (!current) return;
      stepSimulation(current, prices.current, Number(speed));
      setTick((t) => {
        if ((t + 1) % 5 === 0) persist();
        return t + 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [running, speed]);

  function start() {
    if (!current) current = createSimulation(50, 2026, new Date(), { mix, priceMode });
    setRunning(true);
    setTick((t) => t + 1);
  }

  function reset() {
    setRunning(false);
    current = null;
    setNote(null);
    setTooBig(false);
    void clearSimulationText();
    setTick((t) => t + 1);
  }

  const shown = sim?.prices ?? quote.prices;
  const s = sim ? summarize(sim, shown) : null;
  const segments = sim ? summarizeBySegment(sim, shown) : [];

  return (
    <>
      <Button title="← Espace DEV" variant="ghost" onPress={onBack} />
      <Banner icon="🧪" title="Simulateur de clients (fictifs)">
        50 clients inventés (débancarisés, métaux physiques, petits budgets, quotidiens avec la carte) achètent,
        vendent, paient et retirent des lingotins, avec les vraies règles : frais, garde, prix tout compris, stock,
        blocage des formats à perte, assurance. Rien n’est lié à votre vrai compte, et la simulation est enregistrée et,
        appli fermée, elle continue en temps réel : au retour, le temps écoulé est rattrapé d’un coup (90 jours au
        plus).
      </Banner>
      {!sim ? (
        <>
          <SectionTitle>Base de clients</SectionTitle>
          <Segmented
            value={mix}
            onChange={setMix}
            options={(Object.keys(MIXES) as MixId[]).map((k) => ({ value: k, label: MIXES[k].label }))}
          />
          <Hint>
            {Object.entries(MIXES[mix].mix)
              .map(([k, v]) => `${v} % ${SEGMENT_SHORT[k as keyof typeof SEGMENT_SHORT]}`)
              .join(' · ')}
          </Hint>
        </>
      ) : null}
      <Segmented
        value={priceMode}
        onChange={(m) => {
          setPriceMode(m);
          if (current) current.priceMode = m;
        }}
        options={[
          { value: 'sim', label: 'Cours simulés' },
          { value: 'live', label: 'Cours en direct' },
        ]}
      />
      <Segmented value={speed} onChange={setSpeed} options={SPEEDS.map((x) => ({ value: x.value, label: x.label }))} />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Button
            title={running ? 'Pause' : sim ? 'Reprendre' : 'Démarrer'}
            onPress={() => {
              if (running) {
                setRunning(false);
                persist();
              } else start();
            }}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Button title="Remettre à zéro" variant="ghost" onPress={reset} disabled={!sim} />
        </View>
      </View>

      {note ? <Banner icon="⏩" title={note} /> : null}
      {tooBig ? (
        <Hint>
          Simulation trop longue pour être enregistrée : remettez-la à zéro pour qu’elle survive à la fermeture.
        </Hint>
      ) : null}
      {sim && s ? (
        <>
          <Hint>
            Cours {sim.priceMode === 'sim' ? 'simulés' : 'en direct'} : or {shown.gold.toFixed(2).replace('.', ',')} €/g
            · argent {shown.silver.toFixed(2).replace('.', ',')} €/g · platine{' '}
            {shown.platinum.toFixed(2).replace('.', ',')} €/g
          </Hint>
          <SectionTitle>La société</SectionTitle>
          <Card style={{ gap: 6 }}>
            <KeyValue label="Temps simulé" value={`${s.days} jour${s.days > 1 ? 's' : ''}`} />
            <KeyValue label="Clients · opérations" value={`${s.clients} · ${s.operations}`} />
            <KeyValue label="Revenus (frais prélevés)" value={formatEur(s.revenue.total)} strong />
            <KeyValue label="· achats de métal" value={formatEur(s.revenue.buy)} />
            <KeyValue label="· retraits de lingotins et pièces" value={formatEur(s.revenue.physical)} />
            <KeyValue label="Coût des lingotins (Godot & Fils)" value={formatEur(s.physicalCost)} />
            <KeyValue label="Résultat estimé" value={formatEur(s.margin)} strong />
            <KeyValue label="Or et argent des clients" value={formatEur(s.assets)} />
          </Card>

          <SectionTitle>Par segment de clients</SectionTitle>
          <Card style={{ gap: 8 }}>
            {segments.map((g) => (
              <View key={g.segment} style={{ gap: 2 }}>
                <Text style={styles.segTitle}>{g.label}</Text>
                <Text style={styles.event}>
                  {g.clients} clients · {g.operations} opérations · revenus {formatEur(g.revenue)} · résultat{' '}
                  {formatEur(g.margin)}
                </Text>
              </View>
            ))}
          </Card>

          <SectionTitle>Activité</SectionTitle>
          <Card style={{ gap: 6 }}>
            <KeyValue label="Achats · ventes" value={`${sim.counters.buys} · ${sim.counters.sells}`} />
            <KeyValue label="Retraits de lingotins" value={String(sim.counters.withdrawals)} />
            <KeyValue
              label="Paiements par carte"
              value={`${sim.counters.cards} · ${formatEur(sim.counters.cardEur)}`}
            />
            <KeyValue label="Opérations refusées" value={String(sim.counters.refused)} />
            <KeyValue
              label="Commandes à Godot & Fils"
              value={`${sim.counters.restocks} · ${formatEur(sim.counters.supplierEur)}`}
            />
          </Card>

          <SectionTitle>Stock et assurance</SectionTitle>
          <Card style={{ gap: 6 }}>
            {BAR_PRODUCTS.map((p) => (
              <KeyValue
                key={p.id}
                label={p.label.replace(/ \(.*/, '')}
                value={`${stockedPieces(sim.company, p.id)} en stock`}
              />
            ))}
            <KeyValue
              label="Valeur assurée"
              value={`${formatEur(s.insured)} sur ${formatEur(s.insuranceCap)}`}
              strong
            />
            <KeyValue label="Pic de la simulation" value={formatEur(s.peakInsured)} />
          </Card>

          <SectionTitle>Dernières opérations</SectionTitle>
          <Card style={{ gap: 4 }}>
            {sim.events.slice(0, 15).map((e, i) => (
              <Text
                key={e.at + i}
                style={[
                  styles.event,
                  e.kind === 'refused' && { color: colors.warning },
                  e.kind === 'restock' && { color: colors.gold },
                ]}
              >
                {new Date(e.at).toLocaleString('fr-FR', {
                  day: '2-digit',
                  month: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                })}{' '}
                · {e.text}
              </Text>
            ))}
            {sim.events.length === 0 ? <Text style={styles.event}>Aucune opération pour l’instant.</Text> : null}
          </Card>
          <Hint>
            Estimation : les revenus sont les frais réellement prélevés par les règles de l’appli ; les coûts de garde
            et d’identification sont approximatifs. Ce sont des ordres de grandeur sur des clients inventés, pas une
            prévision.
          </Hint>
        </>
      ) : (
        <Hint>Touchez « Démarrer » : la simulation avance toute seule, chaque seconde.</Hint>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  segTitle: { color: colors.text, fontSize: 13.5, fontWeight: '700' },
  event: { color: colors.textMuted, fontSize: 12 },
});
