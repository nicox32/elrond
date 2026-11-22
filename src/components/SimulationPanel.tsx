import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { formatEur } from '../logic/format';
import { BAR_PRODUCTS, stockedPieces } from '../logic/physical';
import { createSimulation, type Simulation, stepSimulation, summarize } from '../logic/simulation';
import { useBank } from '../state/BankProvider';
import { colors } from '../theme';
import { Segmented } from './Segmented';
import { Banner, Button, Card, Hint, KeyValue, SectionTitle } from './ui';

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
  const prices = useRef(quote.prices);
  useEffect(() => {
    prices.current = quote.prices;
  }, [quote.prices]);

  const sim = current;

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      if (!current) return;
      stepSimulation(current, prices.current, Number(speed));
      setTick((t) => t + 1);
    }, 1000);
    return () => clearInterval(id);
  }, [running, speed]);

  function start() {
    if (!current) current = createSimulation(50, 2026, new Date());
    setRunning(true);
    setTick((t) => t + 1);
  }

  function reset() {
    setRunning(false);
    current = null;
    setTick((t) => t + 1);
  }

  const s = sim ? summarize(sim, quote.prices) : null;

  return (
    <>
      <Button title="← Espace DEV" variant="ghost" onPress={onBack} />
      <Banner icon="🧪" title="Simulateur de clients (fictifs)">
        50 clients inventés achètent, vendent et retirent des lingotins aux cours en direct, avec les vraies règles :
        frais, prix tout compris, stock, blocage des formats à perte, assurance. Rien n’est lié à votre vrai compte, et
        la simulation s’arrête quand l’appli est fermée.
      </Banner>
      <Segmented value={speed} onChange={setSpeed} options={SPEEDS.map((x) => ({ value: x.value, label: x.label }))} />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Button
            title={running ? 'Pause' : sim ? 'Reprendre' : 'Démarrer'}
            onPress={() => (running ? setRunning(false) : start())}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Button title="Remettre à zéro" variant="ghost" onPress={reset} disabled={!sim} />
        </View>
      </View>

      {sim && s ? (
        <>
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

          <SectionTitle>Activité</SectionTitle>
          <Card style={{ gap: 6 }}>
            <KeyValue label="Achats · ventes" value={`${sim.counters.buys} · ${sim.counters.sells}`} />
            <KeyValue label="Retraits de lingotins" value={String(sim.counters.withdrawals)} />
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
  event: { color: colors.textMuted, fontSize: 12 },
});
