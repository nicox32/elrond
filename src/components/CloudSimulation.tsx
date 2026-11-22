import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  ageLabel,
  type CloudPopulation,
  type CloudSummary,
  isCloudPopulation,
  isCloudSummary,
  POPULATION_CAPS,
  POPULATION_URL,
  SUMMARY_URL,
} from '../logic/cloudSim';
import { formatEur } from '../logic/format';
import { HISTORY_PRESETS } from '../logic/historyPrices';
import { INCOME_BANDS } from '../logic/population';
import { productOf } from '../logic/physical';
import { colors } from '../theme';
import { Segmented } from './Segmented';
import { Banner, Button, Card, Hint, KeyValue, SectionTitle } from './ui';

const CACHE_KEY = 'elrond.cloudSim.v1';
const eur = (n: number) => formatEur(Math.round(n));

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(`${url}?t=${Date.now()}`);
  if (!res.ok) throw new Error(String(res.status));
  return res.json();
}

/** Espace DEV : la simulation de clients fictifs, calculée toutes les heures par GitHub, en lecture seule. */
export function CloudSimulation({ onBack }: { onBack: () => void }) {
  const [summary, setSummary] = useState<CloudSummary | null>(null);
  const [population, setPopulation] = useState<CloudPopulation | null>(null);
  const [state, setState] = useState<'loading' | 'ok' | 'offline' | 'empty'>('loading');
  const [view, setView] = useState<'live' | 'population'>('live');
  const [preset, setPreset] = useState<string>('recent');
  const [cap, setCap] = useState<string>(String(POPULATION_CAPS[0]));

  const [reload, setReload] = useState(0);

  useEffect(() => {
    let alive = true;
    (async () => {
      let s: CloudSummary | null = null;
      let p: CloudPopulation | null = null;
      try {
        const raw = await AsyncStorage.getItem(CACHE_KEY);
        const saved = raw ? (JSON.parse(raw) as { s: unknown; p: unknown }) : null;
        if (saved && isCloudSummary(saved.s)) s = saved.s;
        if (saved && isCloudPopulation(saved.p)) p = saved.p;
        if ((s || p) && alive) {
          setSummary(s);
          setPopulation(p);
        }
      } catch {
        // Rien de gardé.
      }
      try {
        const [js, jp] = await Promise.all([fetchJson(SUMMARY_URL), fetchJson(POPULATION_URL)]);
        if (isCloudSummary(js)) s = js;
        if (isCloudPopulation(jp)) p = jp;
        if (!alive) return;
        setSummary(s);
        setPopulation(p);
        setState(s || p ? 'ok' : 'empty');
        try {
          await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ s, p }));
        } catch {
          // Pas de copie gardée : sans conséquence.
        }
      } catch {
        if (alive) setState(s || p ? 'offline' : 'empty');
      }
    })();
    return () => {
      alive = false;
    };
  }, [reload]);

  const scenario = population?.presets[preset]?.caps[cap];
  const s = summary;

  return (
    <>
      <Button title="← Espace DEV" variant="ghost" onPress={onBack} />
      <Banner icon="☁️" title="Simulation de clients fictifs, sur GitHub">
        Aucun client réel. GitHub fait avancer la simulation toutes les heures, aux cours réels, et recalcule la
        population de 15 000 clients sur des périodes historiques : l’appli ne fait que lire les résultats. Pour
        repartir de zéro ou changer la base de clients, lancez « Simulation de clients » depuis l’onglet Actions du
        dépôt.
      </Banner>
      <Segmented
        value={view}
        onChange={setView}
        options={[
          { value: 'live', label: '50 clients (en direct)' },
          { value: 'population', label: '15 000 clients' },
        ]}
      />
      <Button
        title={state === 'loading' ? 'Chargement…' : 'Actualiser'}
        variant="ghost"
        disabled={state === 'loading'}
        onPress={() => {
          setState('loading');
          setReload((n) => n + 1);
        }}
      />
      {state === 'offline' ? <Hint>Hors connexion : dernière copie gardée sur le téléphone.</Hint> : null}
      {state === 'empty' ? (
        <Hint>
          Pas encore de résultats : la première exécution de la tâche « Simulation de clients » n’a pas eu lieu.
          Lancez-la à la main depuis l’onglet Actions de GitHub, ou attendez l’heure suivante.
        </Hint>
      ) : null}

      {view === 'live' && s ? (
        <>
          <Hint>
            Mis à jour {ageLabel(s.updatedAt)} · {s.summary.days} jour{s.summary.days > 1 ? 's' : ''} simulés · or{' '}
            {s.prices.gold.toFixed(2).replace('.', ',')} €/g · argent {s.prices.silver.toFixed(2).replace('.', ',')} €/g
          </Hint>
          <SectionTitle>La société</SectionTitle>
          <Card style={{ gap: 6 }}>
            <KeyValue label="Clients · opérations" value={`${s.summary.clients} · ${s.summary.operations}`} />
            <KeyValue label="Revenus (frais prélevés)" value={formatEur(s.summary.revenue.total)} strong />
            <KeyValue label="· achats de métal" value={formatEur(s.summary.revenue.buy)} />
            <KeyValue label="· lingotins et pièces" value={formatEur(s.summary.revenue.physical)} />
            <KeyValue label="· garde" value={formatEur(s.summary.revenue.custody)} />
            <KeyValue label="Coût des lingotins (Godot & Fils)" value={formatEur(s.summary.physicalCost)} />
            <KeyValue label="Résultat estimé" value={formatEur(s.summary.margin)} strong />
            <KeyValue
              label="Résultat ramené à un an"
              value={s.summary.days >= 30 ? formatEur(s.summary.marginPerYear) : 'après 30 jours'}
            />
            <KeyValue label="Or et argent des clients" value={formatEur(s.summary.assets)} />
          </Card>

          <SectionTitle>Par segment de clients</SectionTitle>
          <Card style={{ gap: 8 }}>
            {s.segments.map((g) => (
              <View key={g.segment} style={{ gap: 2 }}>
                <Text style={styles.title}>{g.label}</Text>
                <Text style={styles.line}>
                  {g.clients} clients · {g.operations} opérations · revenus {formatEur(g.revenue)} · résultat{' '}
                  {formatEur(g.margin)}
                </Text>
              </View>
            ))}
          </Card>

          <SectionTitle>Activité</SectionTitle>
          <Card style={{ gap: 6 }}>
            <KeyValue label="Achats · ventes" value={`${s.counters.buys} · ${s.counters.sells}`} />
            <KeyValue label="Retraits de lingotins" value={String(s.counters.withdrawals)} />
            <KeyValue label="Paiements par carte" value={`${s.counters.cards} · ${formatEur(s.counters.cardEur)}`} />
            <KeyValue label="Retraits impossibles (stock épuisé)" value={String(s.counters.stockouts)} />
            <KeyValue label="Opérations refusées" value={String(s.counters.refused)} />
            <KeyValue
              label="Commandes à Godot & Fils"
              value={`${s.counters.restocks} · ${formatEur(s.counters.supplierEur)}`}
            />
          </Card>

          <SectionTitle>Stock et assurance</SectionTitle>
          <Card style={{ gap: 6 }}>
            {s.stock.map((x) => (
              <KeyValue
                key={x.product}
                label={productOf(x.product).label.replace(/ \(.*/, '')}
                value={`${x.qty} en stock${x.inTransit ? ` · ${x.inTransit} en route` : ''}`}
              />
            ))}
            <KeyValue
              label="Valeur assurée"
              value={`${formatEur(s.summary.insured)} sur ${formatEur(s.summary.insuranceCap)}`}
              strong
            />
            <KeyValue label="Pic" value={formatEur(s.summary.peakInsured)} />
          </Card>

          <SectionTitle>Dernières opérations</SectionTitle>
          <Card style={{ gap: 4 }}>
            {s.events.slice(0, 15).map((e, i) => (
              <Text
                key={e.at + i}
                style={[
                  styles.line,
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
            {s.events.length === 0 ? <Text style={styles.line}>Aucune opération pour l’instant.</Text> : null}
          </Card>
          <Hint>
            Estimation : les revenus sont les frais prélevés par les règles de l’appli ; les coûts de garde et
            d’identification sont approximatifs. Clients inventés : ordres de grandeur, pas une prévision.
          </Hint>
        </>
      ) : null}

      {view === 'population' && population ? (
        <>
          <Hint>Calculé {ageLabel(population.updatedAt)}.</Hint>
          <SectionTitle>Période historique</SectionTitle>
          <Segmented
            value={preset}
            onChange={setPreset}
            options={HISTORY_PRESETS.map((p) => ({ value: p.id, label: p.label.split(' : ')[0] }))}
          />
          <Hint>{population.presets[preset]?.label}</Hint>
          <SectionTitle>Plafond d’assurance du stock</SectionTitle>
          <Segmented
            value={cap}
            onChange={setCap}
            options={POPULATION_CAPS.map((c) => ({
              value: String(c),
              label: c >= 1_000_000 ? `${c / 1_000_000} M€` : `${c / 1000} k€`,
            }))}
          />
          {scenario ? (
            <>
              <SectionTitle>Résultat</SectionTitle>
              <Card style={{ gap: 6 }}>
                <KeyValue
                  label="Durée · clients"
                  value={`${scenario.summary.years} ans · ${scenario.summary.clients.toLocaleString('fr-FR')}`}
                />
                <KeyValue label="Clients encore actifs" value={scenario.summary.active.toLocaleString('fr-FR')} />
                <KeyValue
                  label="Cours de l’or"
                  value={`${scenario.summary.goldStart.toFixed(0)} → ${scenario.summary.goldEnd.toFixed(0)} €/g`}
                />
                <KeyValue label="Revenus" value={eur(scenario.summary.revenue.total)} strong />
                <KeyValue label="· frais d’achat" value={eur(scenario.summary.revenue.buy)} />
                <KeyValue label="· lingotins et pièces" value={eur(scenario.summary.revenue.bars)} />
                <KeyValue
                  label="· garde"
                  value={eur(scenario.summary.revenue.custody + scenario.summary.revenue.vault)}
                />
                <KeyValue label="· carte" value={eur(scenario.summary.revenue.card)} />
                <KeyValue
                  label="Coûts variables"
                  value={eur(scenario.summary.costs.total - scenario.summary.costs.fixed)}
                />
                <KeyValue label="Frais fixes (hypothèse de l’appli)" value={eur(scenario.summary.costs.fixed)} />
                <KeyValue label="Résultat avant frais fixes" value={eur(scenario.summary.contribution)} />
                <KeyValue label="Résultat final" value={eur(scenario.summary.result)} strong />
                <KeyValue label="Épargne confiée par les clients" value={eur(scenario.summary.assets)} />
              </Card>

              <SectionTitle>Stock et assurance</SectionTitle>
              <Card style={{ gap: 6 }}>
                <KeyValue
                  label="Pic de stock assuré"
                  value={`${eur(scenario.summary.peakInsured)} sur ${eur(scenario.summary.insuranceCap)}`}
                  strong
                />
                <KeyValue
                  label="Commandes bloquées par l’assurance"
                  value={String(scenario.summary.insuranceBlocked)}
                />
                <KeyValue
                  label="Retraits de lingotins et pièces"
                  value={scenario.summary.withdrawals.toLocaleString('fr-FR')}
                />
                <KeyValue
                  label="Retraits impossibles (stock épuisé)"
                  value={scenario.summary.stockouts.toLocaleString('fr-FR')}
                />
              </Card>

              <SectionTitle>Par tranche de revenu</SectionTitle>
              <Card style={{ gap: 8 }}>
                {scenario.summary.byBand.map((b) => (
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
                {scenario.summary.bySegment.map((g) => (
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
                {scenario.series.map((p) => (
                  <Text key={p.date} style={styles.line}>
                    {p.date} · {p.clients.toLocaleString('fr-FR')} clients · épargne {eur(p.assets)} · stock{' '}
                    {eur(p.insured)} · or {p.gold.toFixed(0)} €/g
                  </Text>
                ))}
              </Card>
              <Hint>
                Hypothèses : tranches de l’Insee (revenu net mensuel des salariés du privé : 10 % sous 1 SMIC, médiane à
                1,5 SMIC, 1 % au-dessus de 7 SMIC), clients arrivant sur 24 mois. La part d’épargne (
                {INCOME_BANDS[0].savingsRate * 100} % à {INCOME_BANDS[6].savingsRate * 100} % selon la tranche), la part
                placée en métaux, le choix des segments et les départs de clients sont des hypothèses du simulateur.
              </Hint>
            </>
          ) : null}
        </>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.text, fontSize: 13.5, fontWeight: '700' },
  line: { color: colors.textMuted, fontSize: 12 },
});
