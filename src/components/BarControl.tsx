import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import {
  type BarState,
  barState,
  barSummary,
  type ControlInput,
  DEFAULT_TOLERANCE,
  duplicateSerials,
  evaluateControl,
  expectedWeight,
  lastCheck,
  recheckWeight,
  recordControl,
  resolveAnomaly,
  searchBars,
  toleranceOf,
} from '../logic/barControl';
import { formatDate, parseAmount } from '../logic/format';
import { LedgerError } from '../logic/ledger';
import { placeLabel, productOf, setBarPlace, specLine } from '../logic/physical';
import type { HomeBar } from '../logic/types';
import { useAccount, useBank } from '../state/BankProvider';
import { colors } from '../theme';
import { BarImage } from './BarImage';
import { PlaceEditor } from './PlaceEditor';
import { Segmented } from './Segmented';
import { Banner, Button, Card, Hint, KeyValue, Label, ListRow, Message, SectionTitle, styles as ui } from './ui';

const STATE_LABEL: Record<BarState, string> = { todo: 'À contrôler', ok: '✓ Conforme', anomaly: '⚠ Anomalie' };
const STATE_STYLE: Record<BarState, object> = {
  todo: { color: colors.warning, backgroundColor: 'rgba(251,191,36,0.15)' },
  ok: { color: colors.up, backgroundColor: 'rgba(52,211,153,0.15)' },
  anomaly: { color: colors.down, backgroundColor: 'rgba(248,113,113,0.15)' },
};
const g = (n: number) => n.toLocaleString('fr-FR', { maximumFractionDigits: 3 });
const label = (b: HomeBar) => productOf(b.product).label;

function Pill({ state }: { state: BarState }) {
  return <Text style={[styles.pill, STATE_STYLE[state]]}>{STATE_LABEL[state]}</Text>;
}

function Check({
  on,
  onChange,
  title,
  sub,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  title: string;
  sub?: string;
}) {
  return (
    <Pressable
      onPress={() => onChange(!on)}
      style={styles.checkRow}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: on }}
    >
      <View style={[styles.box, on && styles.boxOn]}>
        <Text style={[styles.tick, on && { color: colors.up }]}>✓</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.checkTitle}>{title}</Text>
        {sub ? <Text style={ui.hint}>{sub}</Text> : null}
      </View>
    </Pressable>
  );
}

function Field({
  label: l,
  value,
  onChange,
  placeholder,
  numeric,
}: {
  label: string;
  value: string;
  onChange: (t: string) => void;
  placeholder?: string;
  numeric?: boolean;
}) {
  return (
    <View style={{ gap: 5, flex: 1 }}>
      <Label>{l}</Label>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        keyboardType={numeric ? 'decimal-pad' : 'default'}
        autoCapitalize="characters"
        style={ui.input}
        accessibilityLabel={l}
      />
    </View>
  );
}

/** Société Orvia › Contrôle des lingots : base interne, contrôle à la réception, recontrôle par pesée. */
export function BarControl({ onBack }: { onBack: () => void }) {
  const account = useAccount();
  const { updateAccount, updateSettings } = useBank();
  const [selected, setSelected] = useState<string | null>(null);
  const [mode, setMode] = useState<'detail' | 'control' | 'recheck'>('detail');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | BarState>('all');
  const bars = account.homeVault ?? [];
  const bar = bars.find((b) => b.id === selected) ?? null;

  if (bar) {
    const back = () => {
      setSelected(null);
      setMode('detail');
    };
    if (mode === 'control')
      return <ControlForm bar={bar} onDone={() => setMode('detail')} onCancel={() => setMode('detail')} />;
    if (mode === 'recheck')
      return <RecheckForm bar={bar} onDone={() => setMode('detail')} onCancel={() => setMode('detail')} />;
    return (
      <>
        <Button title="← Retour à la liste" variant="ghost" onPress={back} />
        <Detail
          bar={bar}
          onControl={() => setMode('control')}
          onRecheck={() => setMode('recheck')}
          onResolve={(note) => updateAccount((a) => resolveAnomaly(a, bar.id, note))}
          onPlace={(place, note) => updateAccount((a) => setBarPlace(a, bar.id, place, note))}
        />
      </>
    );
  }

  const summary = barSummary(account);
  const dup = duplicateSerials(account);
  const shown = searchBars(account, query).filter((b) => filter === 'all' || barState(b) === filter);

  return (
    <>
      <Button title="← Tableau de bord" variant="ghost" onPress={onBack} />
      <Hint>
        Base interne des lingotins et pièces retirés du coffre : contrôle à la réception, poids de référence, recontrôle
        par pesée. Elle prouve qu’un objet est le même qu’à sa réception ; l’authenticité, elle, se vérifie avec
        VERISCAN de l’affinerie et la carte d’essai.
      </Hint>
      <Banner
        tone={summary.anomalies ? 'danger' : summary.todo ? 'warning' : 'success'}
        icon={summary.anomalies ? '⚠' : summary.todo ? '⏳' : '✓'}
        title={`${summary.total} objet${summary.total > 1 ? 's' : ''} · ${summary.todo} à contrôler · ${summary.anomalies} anomalie${summary.anomalies > 1 ? 's' : ''}`}
        testID="bar-summary"
      >
        {dup.length ? `Numéro de série en double : ${dup.join(', ')}.` : 'Aucun numéro de série en double.'}
      </Banner>

      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="🔍 Rechercher un numéro de série"
        placeholderTextColor={colors.textMuted}
        autoCapitalize="characters"
        style={ui.input}
        accessibilityLabel="Rechercher un numéro de série"
      />
      <Segmented
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'all', label: `Tous ${bars.length}` },
          { value: 'todo', label: `À contrôler ${summary.todo}` },
          { value: 'anomaly', label: `Anomalies ${summary.anomalies}` },
        ]}
      />
      <Card style={{ paddingVertical: 4 }}>
        {shown.length === 0 ? (
          <Text style={[ui.hint, { paddingVertical: 12 }]}>
            {bars.length ? 'Aucun lingot ne correspond.' : 'Aucun lingot : retirez d’abord de l’or en lingotins.'}
          </Text>
        ) : (
          shown.map((b, i) => (
            <ListRow
              key={b.id}
              first={i === 0}
              left={<BarImage product={b.product} size={40} />}
              title={`${label(b)} · ${b.serial ?? 'n° à noter'}`}
              subtitle={`${subtitle(b)} · ${placeLabel(b)}`}
              right={<Pill state={barState(b)} />}
              onPress={() => setSelected(b.id)}
              testID={`bar-row-${b.id}`}
            />
          ))
        )}
      </Card>

      <SectionTitle>Marges de contrôle</SectionTitle>
      <Tolerance current={toleranceOf(account)} onSave={(t) => updateSettings({ barTolerance: t })} />
    </>
  );
}

function subtitle(b: HomeBar): string {
  const last = lastCheck(b);
  if (!last)
    return b.status === 'preparing'
      ? `Commandé le ${formatDate(b.orderedAt)} · en livraison`
      : 'Reçu · pas encore contrôlé';
  const kind = last.kind === 'reception' ? 'Contrôlé' : last.kind === 'recheck' ? 'Recontrôle' : 'Anomalie levée';
  const extra =
    last.kind === 'reception' && b.weightRef ? ` · référence ${g(b.weightRef)} g` : last.note ? ` · ${last.note}` : '';
  return `${kind} le ${new Date(last.date).toLocaleDateString('fr-FR')}${extra}`;
}

function Tolerance({
  current,
  onSave,
}: {
  current: { weightG: number; dimMm: number };
  onSave: (t: { weightG: number; dimMm: number }) => void;
}) {
  const [w, setW] = useState(String(current.weightG).replace('.', ','));
  const [d, setD] = useState(String(current.dimMm).replace('.', ','));
  const [msg, setMsg] = useState<string | null>(null);
  const wn = parseAmount(w);
  const dn = parseAmount(d);
  const valid = wn > 0 && wn <= 1 && dn > 0 && dn <= 2;
  return (
    <Card style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Field label="Pesée ± (g)" value={w} onChange={setW} numeric />
        <Field label="Dimensions ± (mm)" value={d} onChange={setD} numeric />
      </View>
      <Hint>
        Selon votre balance et votre pied à coulisse. Par défaut ±{String(DEFAULT_TOLERANCE.weightG).replace('.', ',')}{' '}
        g et ±{String(DEFAULT_TOLERANCE.dimMm).replace('.', ',')} mm ; pour une pièce, la marge de pesée est au moins de
        0,1 g (usure).
      </Hint>
      <Button
        title="Enregistrer les marges"
        variant="ghost"
        disabled={!valid}
        onPress={() => {
          onSave({ weightG: wn, dimMm: dn });
          setMsg('Marges enregistrées.');
        }}
      />
      {msg ? <Message ok text={msg} /> : null}
    </Card>
  );
}

function Detail({
  bar,
  onControl,
  onRecheck,
  onResolve,
  onPlace,
}: {
  bar: HomeBar;
  onControl: () => void;
  onRecheck: () => void;
  onResolve: (note: string) => void;
  onPlace: (place: import('../logic/physical').BarPlace, note?: string) => void;
}) {
  const p = productOf(bar.product);
  const state = barState(bar);
  const checks = [...(bar.checks ?? [])].reverse();
  return (
    <>
      <Card style={{ gap: 6 }}>
        <View style={styles.head}>
          <BarImage product={bar.product} size={64} />
          <Text style={[styles.name, { flex: 1, marginLeft: 12 }]}>{label(bar)}</Text>
          <Pill state={state} />
        </View>
        {specLine(p.spec) ? <Text style={ui.hint}>{specLine(p.spec)}</Text> : null}
        <KeyValue label={p.coin ? 'Millésime' : 'N° de série'} value={bar.serial ?? 'à noter à réception'} />
        {bar.origin ? (
          <KeyValue
            label="Origine"
            value={
              bar.origin === 'maison'
                ? 'Stock Orvia'
                : bar.origin === 'pro'
                  ? 'Stock Godot & Fils'
                  : 'Commande chez Godot & Fils'
            }
          />
        ) : null}
        {bar.ref ? <KeyValue label="Réf. interne Orvia" value={bar.ref} /> : null}
        {bar.expectedSerial && !bar.serial ? (
          <KeyValue label="N° prévu par le stock" value={bar.expectedSerial} />
        ) : null}
        <PlaceEditor bar={bar} onChange={onPlace} title="Lieu de stockage (chez le client, banque…)" />
        <KeyValue label="Poids attendu" value={`${g(expectedWeight(bar))} g`} />
        <KeyValue label="Poids de référence" value={bar.weightRef ? `${g(bar.weightRef)} g` : '—'} />
        <KeyValue label="Commandé le" value={formatDate(bar.orderedAt)} />
      </Card>
      {state === 'todo' ? (
        <Button title="Contrôler à la réception" onPress={onControl} />
      ) : (
        <>
          <Button title="Recontrôle par pesée" onPress={onRecheck} />
          {state === 'anomaly' ? (
            <Button
              title="Anomalie levée (VERISCAN conforme)"
              variant="ghost"
              onPress={() => onResolve('VERISCAN conforme après vérification')}
            />
          ) : null}
          <Button title="Refaire le contrôle de réception" variant="ghost" onPress={onControl} />
        </>
      )}
      <SectionTitle>Historique des contrôles</SectionTitle>
      {checks.length === 0 ? (
        <Hint>Aucun contrôle pour l’instant.</Hint>
      ) : (
        <Card style={{ paddingVertical: 4 }}>
          {checks.map((c, i) => (
            <ListRow
              key={c.date + i}
              first={i === 0}
              title={`${c.kind === 'reception' ? 'Contrôle de réception' : c.kind === 'recheck' ? 'Recontrôle par pesée' : 'Anomalie levée'} · ${new Date(c.date).toLocaleDateString('fr-FR')}`}
              subtitle={[
                c.weight ? `${g(c.weight)} g` : null,
                c.note,
                c.failed?.length ? `non conforme : ${c.failed.join(', ')}` : null,
              ]
                .filter(Boolean)
                .join(' · ')}
              right={<Text style={[styles.pill, STATE_STYLE[c.ok ? 'ok' : 'anomaly']]}>{c.ok ? '✓' : '⚠'}</Text>}
            />
          ))}
        </Card>
      )}
    </>
  );
}

function ControlForm({ bar, onDone, onCancel }: { bar: HomeBar; onDone: () => void; onCancel: () => void }) {
  const account = useAccount();
  const { updateAccount } = useBank();
  const p = productOf(bar.product);
  const spec = p.spec;
  const [sealed, setSealed] = useState(false);
  const [serialBar, setSerialBar] = useState(bar.serial ?? bar.expectedSerial ?? '');
  const [serialCard, setSerialCard] = useState('');
  const [weight, setWeight] = useState('');
  const [length, setLength] = useState('');
  const [width, setWidth] = useState('');
  const [thickness, setThickness] = useState('');
  const [diameter, setDiameter] = useState('');
  const [veriscan, setVeriscan] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const input: ControlInput = {
    sealed,
    serialBar,
    serialCard,
    weight: parseAmount(weight),
    length: parseAmount(length),
    width: parseAmount(width),
    thickness: parseAmount(thickness),
    diameter: parseAmount(diameter),
    veriscan,
  };
  const lines = evaluateControl(bar, input, toleranceOf(account));
  const allOk = lines.every((l) => l.ok);

  function submit() {
    try {
      updateAccount((a) => recordControl(a, bar.id, input));
      onDone();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof LedgerError ? e.message : 'Enregistrement impossible.' });
    }
  }

  return (
    <>
      <Button title="← Annuler" variant="ghost" onPress={onCancel} />
      <Text style={styles.name}>Contrôler : {label(bar)}</Text>
      {specLine(spec) ? <Hint>{specLine(spec)}</Hint> : null}
      <Card style={{ gap: 12 }}>
        <Check on={sealed} onChange={setSealed} title="Emballage et scellé intacts" />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Field label={p.coin ? 'Millésime' : 'N° gravé sur le lingotin'} value={serialBar} onChange={setSerialBar} />
          {!p.coin ? (
            <Field
              label="Certificate Number (carte)"
              value={serialCard}
              onChange={setSerialCard}
              placeholder="ex. C841201"
            />
          ) : null}
        </View>
        <Field
          label={`Poids mesuré (g) · attendu ${g(expectedWeight(bar))} g`}
          value={weight}
          onChange={setWeight}
          numeric
        />
        {spec?.diameterMm ? (
          <Field
            label={`Diamètre (mm) · attendu ${g(spec.diameterMm)}`}
            value={diameter}
            onChange={setDiameter}
            numeric
          />
        ) : (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Field label={`Long. (${g(spec?.lengthMm ?? 0)})`} value={length} onChange={setLength} numeric />
            <Field label={`Larg. (${g(spec?.widthMm ?? 0)})`} value={width} onChange={setWidth} numeric />
            <Field label={`Ép. (${g(spec?.thicknessMm ?? 0)})`} value={thickness} onChange={setThickness} numeric />
          </View>
        )}
        {spec?.veriscan ? (
          <Check on={veriscan} onChange={setVeriscan} title="VERISCAN conforme" sub="Scan fait avec l’appli de PAMP" />
        ) : null}
      </Card>

      <Card style={{ gap: 6 }}>
        {lines.map((l) => (
          <View key={l.key} style={styles.resRow}>
            <Text style={[styles.resIcon, { color: l.ok ? colors.up : colors.down }]}>{l.ok ? '✓' : '✗'}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.checkTitle}>{l.label}</Text>
              <Text style={ui.hint}>{l.detail}</Text>
            </View>
          </View>
        ))}
      </Card>
      {allOk ? (
        <Banner tone="gold" icon="⚖" title={`Poids de référence : ${g(input.weight)} g`}>
          Enregistré à la validation : il servira aux recontrôles.
        </Banner>
      ) : (
        <Banner tone="danger" icon="⚠" title="Contrôle non conforme">
          Vous pouvez l’enregistrer : l’objet sera marqué « anomalie » tant que vous ne l’aurez pas levée.
        </Banner>
      )}
      <Button
        title={allOk ? 'Valider le contrôle' : 'Enregistrer avec anomalie'}
        variant={allOk ? 'primary' : 'danger'}
        onPress={submit}
      />
      {msg ? <Message {...msg} /> : null}
    </>
  );
}

function RecheckForm({ bar, onDone, onCancel }: { bar: HomeBar; onDone: () => void; onCancel: () => void }) {
  const account = useAccount();
  const { updateAccount } = useBank();
  const [weight, setWeight] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const w = parseAmount(weight);
  const ref = bar.weightRef ?? 0;
  const tol = toleranceOf(account);
  const wTol = productOf(bar.product).coin ? Math.max(tol.weightG, 0.1) : tol.weightG;
  const delta = w - ref;
  const ok = Number.isFinite(w) && Math.abs(delta) <= wTol + 1e-9;
  return (
    <>
      <Button title="← Annuler" variant="ghost" onPress={onCancel} />
      <Text style={styles.name}>Recontrôle : {label(bar)}</Text>
      <Hint>
        N° {bar.serial ?? '—'} · poids de référence {g(ref)} g (marge ±{g(wTol)} g)
      </Hint>
      <Card style={{ gap: 10 }}>
        <Field label="Nouvelle pesée (g)" value={weight} onChange={setWeight} numeric />
      </Card>
      {Number.isFinite(w) ? (
        ok ? (
          <Banner
            tone="success"
            icon="✓"
            title={`Écart de ${delta >= 0 ? '+' : '−'}${g(Math.abs(delta))} g : conforme`}
          >
            Dans la marge de ±{g(wTol)} g.
          </Banner>
        ) : (
          <Banner
            tone="danger"
            icon="⚠"
            title={`Écart de ${delta >= 0 ? '+' : '−'}${g(Math.abs(delta))} g (${((delta / ref) * 100).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} %)`}
          >
            Au-delà de la marge de ±{g(wTol)} g. Lingot limé, abîmé ou échangé ? Repesez, puis refaites le contrôle
            VERISCAN avec l’appli de PAMP.
          </Banner>
        )
      ) : null}
      <Button
        title="Enregistrer le recontrôle"
        disabled={!Number.isFinite(w)}
        onPress={() => {
          try {
            updateAccount((a) => recheckWeight(a, bar.id, w));
            onDone();
          } catch (e) {
            setMsg({ ok: false, text: e instanceof LedgerError ? e.message : 'Enregistrement impossible.' });
          }
        }}
      />
      {msg ? <Message {...msg} /> : null}
    </>
  );
}

const styles = StyleSheet.create({
  pill: {
    fontSize: 11,
    fontWeight: '800',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    overflow: 'hidden',
  },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { color: colors.text, fontSize: 17, fontWeight: '800' },
  checkRow: { flexDirection: 'row', gap: 11, alignItems: 'flex-start' },
  checkTitle: { color: colors.text, fontSize: 14, fontWeight: '600' },
  box: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxOn: { borderColor: colors.up, backgroundColor: 'rgba(52,211,153,0.18)' },
  tick: { color: 'transparent', fontSize: 15, fontWeight: '900' },
  resRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  resIcon: { fontSize: 16, fontWeight: '900', width: 18 },
});
