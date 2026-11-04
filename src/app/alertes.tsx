import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { MetalPicker } from '../components/MetalPicker';
import { SPOT_METALS } from '../logic/types';
import { Segmented } from '../components/Segmented';
import { ServerAlerts } from '../components/ServerAlerts';
import { Button, Card, Hint, Label, Message, Screen, SectionTitle, styles as ui } from '../components/ui';
import {
  type AlertKind,
  type AlertWindow,
  createAlert,
  describeAlert,
  metalOfServerTitle,
  RECOMMENDED_ALERTS,
  serverAlertMessages,
  serverTriggers,
  testNotification,
} from '../logic/alerts';
import { fetchNtfyMessages, isValidTopic, type NtfyMessage } from '../logic/ntfyClient';
import { formatDate, parseAmount } from '../logic/format';
import { METAL_LABEL, TROY_OUNCE } from '../logic/ledger';
import type { Metal } from '../logic/types';
import { registerBackgroundChecks } from '../background';
import {
  type NotificationPermission,
  notificationPermission,
  notify,
  requestNotificationPermission,
} from '../notifications';
import { useAccount, useBank } from '../state/BankProvider';
import { colors } from '../theme';

type Family = 'price' | 'change' | 'average';
type Direction = 'down' | 'up';

const KIND: Record<Family, Record<Direction, AlertKind>> = {
  price: { down: 'below', up: 'above' },
  change: { down: 'drop', up: 'rise' },
  average: { down: 'belowAvg30', up: 'aboveAvg30' },
};

export default function AlertsScreen() {
  const account = useAccount();
  const { quote, updateAccount } = useBank();
  const unit = account.settings.unit;
  const alerts = account.alerts ?? [];
  const events = account.alertEvents ?? [];

  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [metal, setMetal] = useState<Metal>('gold');
  const [family, setFamily] = useState<Family>('price');
  const [direction, setDirection] = useState<Direction>('down');
  const [win, setWin] = useState<AlertWindow>('24h');
  const [text, setText] = useState('');
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const [background, setBackground] = useState<boolean | null>(null);
  useEffect(() => {
    notificationPermission().then(setPermission);
    registerBackgroundChecks().then(setBackground);
  }, []);

  // Alertes envoyées par le serveur (canal ntfy) ces 7 derniers jours : affichées comme celles de l'appli.
  const [serverMsgs, setServerMsgs] = useState<NtfyMessage[]>([]);
  const topic = account.ntfyTopic;
  useEffect(() => {
    if (!isValidTopic(topic)) return;
    let alive = true;
    fetchNtfyMessages(topic, '7d')
      .then((m) => alive && setServerMsgs(serverAlertMessages(m)))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [topic]);
  const serverHits = serverTriggers(alerts, serverMsgs);
  const feed = [
    ...events.map((e) => ({ id: e.id, title: e.title, body: e.body, date: e.date, metal: e.metal, server: false })),
    ...serverMsgs.map((m) => ({ ...m, metal: metalOfServerTitle(m.title) ?? 'gold', server: true })),
  ]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 20);

  const current = unit === 'oz' ? quote.prices[metal] * TROY_OUNCE : quote.prices[metal];

  function add() {
    try {
      const alert = createAlert({
        metal,
        kind: KIND[family][direction],
        value: parseAmount(text),
        unit: family === 'price' ? unit : undefined,
        window: family === 'change' ? win : undefined,
      });
      updateAccount((acc) => ({ ...acc, alerts: [...(acc.alerts ?? []), alert] }));
      setText('');
      setMessage({ ok: true, text: `Alerte créée : ${describeAlert(alert)}.` });
    } catch (e) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : 'Une erreur est survenue.' });
    }
  }

  const key = (a: { metal: string; kind: string; value: number; window?: string }) =>
    `${a.metal}|${a.kind}|${a.value}|${a.window ?? ''}`;
  const existing = new Set((account.alerts ?? []).map(key));
  const missing = RECOMMENDED_ALERTS.filter((a) => !existing.has(key(a)));

  function applyRecommended() {
    const added = missing.map((a) => createAlert(a));
    updateAccount((acc) => ({ ...acc, alerts: [...(acc.alerts ?? []), ...added] }));
    setMessage({ ok: true, text: `${added.length} alerte(s) recommandée(s) ajoutée(s).` });
  }

  async function testAll() {
    const list = (account.alerts ?? []).filter((a) => a.enabled);
    if (!list.length) return setMessage({ ok: false, text: 'Aucune alerte active à tester.' });
    if (permission !== 'granted') {
      const p = await requestNotificationPermission();
      setPermission(p);
      if (p !== 'granted') return setMessage({ ok: false, text: 'Autorisez les notifications pour faire le test.' });
    }
    setMessage({ ok: true, text: `Envoi de ${list.length} notifications de test…` });
    for (const [i, a] of list.entries()) {
      const n = testNotification(a, quote.prices, i, list.length);
      await notify(n.title, n.body);
      await new Promise((r) => setTimeout(r, 1200));
    }
    setMessage({
      ok: true,
      text: `${list.length} notifications de test envoyées : vérifiez le volet de notifications.`,
    });
  }

  function remove(id: string) {
    const run = () => updateAccount((acc) => ({ ...acc, alerts: (acc.alerts ?? []).filter((a) => a.id !== id) }));
    if (Platform.OS === 'web') return run();
    Alert.alert('Supprimer cette alerte ?', undefined, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: run },
    ]);
  }

  const toggle = (id: string, enabled: boolean) =>
    updateAccount((acc) => ({
      ...acc,
      alerts: (acc.alerts ?? []).map((a) => (a.id === id ? { ...a, enabled, armed: true } : a)),
    }));

  return (
    <Screen testID="screen-alertes">
      <Hint>
        Choisissez vos conditions : l’appli vous prévient quand elles sont remplies. Ce ne sont pas des conseils
        d’investissement, la décision d’acheter ou de vendre vous appartient.
      </Hint>

      {permission !== 'granted' && (
        <Card style={{ gap: 8 }}>
          <Text style={styles.title}>Notifications</Text>
          <Text style={styles.para}>
            {permission === 'denied'
              ? 'Les notifications sont bloquées. Autorisez-les dans les réglages du téléphone (ou de Chrome) pour ce site.'
              : permission === 'unsupported'
                ? 'Ce navigateur ne gère pas les notifications. Les alertes restent visibles dans l’historique ci-dessous.'
                : 'Autorisez les notifications pour être prévenu même quand vous n’êtes pas sur l’écran.'}
          </Text>
          {permission === 'default' && (
            <Button
              title="Activer les notifications"
              onPress={() => requestNotificationPermission().then(setPermission)}
            />
          )}
        </Card>
      )}

      <SectionTitle>Alertes recommandées</SectionTitle>
      <Card style={{ gap: 8 }}>
        <Text style={styles.para}>
          Réglées selon la volatilité de chaque métal : le Gold Spot (épargne) surtout sur les baisses, l’argent et
          surtout le platine, plus volatils, sur les baisses et les hausses avec des seuils plus serrés.
        </Text>
        {(['gold', 'silver', 'platinum'] as const).map((m) => (
          <Text key={m} style={styles.muted}>
            • {METAL_LABEL[m]} :{' '}
            {RECOMMENDED_ALERTS.filter((a) => a.metal === m)
              .map((a) => describeAlert({ ...createAlert(a) }).replace(`${METAL_LABEL[m]} `, ''))
              .join(' ; ')}
          </Text>
        ))}
        <Button
          title={
            missing.length ? `Ajouter les ${missing.length} alertes recommandées` : 'Alertes recommandées en place ✓'
          }
          onPress={applyRecommended}
          disabled={!missing.length}
        />
      </Card>

      <SectionTitle>Nouvelle alerte</SectionTitle>
      <MetalPicker value={metal} onChange={setMetal} metals={SPOT_METALS} />
      <Segmented
        value={family}
        onChange={(f) => {
          setFamily(f);
          setMessage(null);
        }}
        options={[
          { value: 'price', label: 'Prix' },
          { value: 'change', label: 'Variation' },
          { value: 'average', label: 'Moyenne 30 j' },
        ]}
      />
      <Segmented
        value={direction}
        onChange={setDirection}
        options={
          family === 'price'
            ? [
                { value: 'down', label: 'Passe sous' },
                { value: 'up', label: 'Passe au-dessus' },
              ]
            : family === 'change'
              ? [
                  { value: 'down', label: 'Baisse de' },
                  { value: 'up', label: 'Hausse de' },
                ]
              : [
                  { value: 'down', label: 'Sous la moyenne de' },
                  { value: 'up', label: 'Au-dessus de' },
                ]
        }
      />
      {family === 'change' && (
        <Segmented
          value={win}
          onChange={setWin}
          options={[
            { value: '24h', label: 'Sur 24 h' },
            { value: '7d', label: 'Sur 7 jours' },
          ]}
        />
      )}
      <View style={{ gap: 6 }}>
        <Label>{family === 'price' ? `Prix (€/${unit})` : 'Pourcentage'}</Label>
        <View style={styles.row}>
          <TextInput
            value={text}
            onChangeText={(t) => {
              setText(t);
              setMessage(null);
            }}
            placeholder={family === 'price' ? current.toFixed(0) : '5'}
            placeholderTextColor={colors.textMuted}
            keyboardType="decimal-pad"
            style={[ui.input, { flex: 1, minWidth: 0 }]}
            accessibilityLabel={family === 'price' ? 'Prix' : 'Pourcentage'}
          />
          <Text style={styles.unit}>{family === 'price' ? `€/${unit}` : '%'}</Text>
        </View>
        {family === 'price' && (
          <Hint>
            Cours actuel : {current.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}/{unit}
          </Hint>
        )}
        {family !== 'price' && (
          <Hint>
            {family === 'change' && win === '7d'
              ? 'Il faut 7 jours de relevés : l’alerte commence à surveiller une fois ce recul atteint.'
              : family === 'average'
                ? 'La moyenne se calcule sur les relevés de l’appli (au moins 7 jours avant la première alerte).'
                : 'Comparé au cours d’il y a 24 h, relevé par l’appli.'}
          </Hint>
        )}
      </View>
      <Button title="Créer l’alerte" onPress={add} disabled={!text.trim()} />
      {message && <Message {...message} />}

      <SectionTitle>Mes alertes</SectionTitle>
      {alerts.length === 0 ? (
        <Hint>Aucune alerte pour l’instant.</Hint>
      ) : (
        <Card style={{ paddingVertical: 4 }}>
          {alerts.map((a, i) => (
            <View key={a.id} style={[styles.alertRow, i > 0 && styles.border]}>
              <Pressable
                style={{ flex: 1 }}
                onLongPress={() => remove(a.id)}
                accessibilityHint="Appui long pour supprimer"
              >
                <Text style={styles.alertText}>{describeAlert(a)}</Text>
                <Text style={styles.alertMeta}>
                  {(() => {
                    const local = a.lastTriggeredAt;
                    const server = serverHits[a.id];
                    if (server && (!local || server > local))
                      return `Dernière alerte le ${formatDate(server)} (serveur)`;
                    return local ? `Dernière alerte le ${formatDate(local)}` : 'Pas encore déclenchée';
                  })()}
                </Text>
              </Pressable>
              <Switch
                value={a.enabled}
                onValueChange={(v) => toggle(a.id, v)}
                trackColor={{ true: colors.gold, false: colors.surfaceAlt }}
                accessibilityLabel={`Activer : ${describeAlert(a)}`}
              />
            </View>
          ))}
        </Card>
      )}
      {alerts.length > 0 && <Hint>Appui long sur une alerte pour la supprimer.</Hint>}

      {(account.alerts ?? []).some((a) => a.enabled) && (
        <Button
          title={`Tester mes ${(account.alerts ?? []).filter((a) => a.enabled).length} alertes sur ce téléphone`}
          variant="ghost"
          onPress={testAll}
        />
      )}

      <SectionTitle>Alertes déclenchées</SectionTitle>
      {feed.length === 0 ? (
        <Hint>Rien pour l’instant. Les cours sont vérifiés toutes les 30 secondes quand l’appli est ouverte.</Hint>
      ) : (
        feed.map((e) => (
          <Card key={e.id} style={{ gap: 8 }}>
            <Text style={styles.eventTitle}>{e.title}</Text>
            <Text style={styles.para}>{e.body}</Text>
            <Text style={styles.alertMeta}>
              {formatDate(e.date)}
              {e.server ? ' · envoyée par le serveur (ntfy)' : ''}
            </Text>
            <View style={styles.actions}>
              <View style={{ flex: 1 }}>
                <Button
                  title="Acheter"
                  variant="ghost"
                  onPress={() =>
                    router.push({ pathname: '/operations', params: { mode: 'buy', metal: e.metal, t: Date.now() } })
                  }
                />
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  title="Vendre"
                  variant="ghost"
                  onPress={() =>
                    router.push({ pathname: '/operations', params: { mode: 'sell', metal: e.metal, t: Date.now() } })
                  }
                />
              </View>
            </View>
          </Card>
        ))
      )}

      {Platform.OS !== 'web' && (
        <>
          <SectionTitle>Appli fermée : vérification sur ce téléphone</SectionTitle>
          <Card style={{ gap: 6 }}>
            <Text style={styles.para}>
              {background
                ? '✓ Active : Android réveille Orvia environ toutes les 15 minutes (parfois plus, pour économiser la batterie). L’appli relève les cours et vous notifie elle-même, même fermée.'
                : background === false
                  ? 'Indisponible : la vérification en arrière-plan est bloquée par le téléphone.'
                  : 'Vérification…'}
            </Text>
            <Text style={styles.muted}>
              Sur Xiaomi, pour qu’elle ne soit pas coupée : appui long sur l’icône Orvia → Infos sur l’appli →
              Économiseur de batterie → Pas de restrictions, et activez Démarrage automatique.
            </Text>
          </Card>
        </>
      )}

      <SectionTitle>Même appli fermée</SectionTitle>
      <ServerAlerts />
      <Hint>
        Sans le serveur, les alertes ne sont vérifiées que lorsque l’appli est ouverte (ou encore active en
        arrière-plan).
      </Hint>
    </Screen>
  );
}

const styles = StyleSheet.create({
  muted: { color: colors.textMuted, fontSize: 12, lineHeight: 17 },
  title: { color: colors.text, fontSize: 16, fontWeight: '700' },
  para: { color: colors.text, fontSize: 14, lineHeight: 20 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  unit: { minWidth: 44, color: colors.textMuted, fontSize: 16, fontWeight: '700', textAlign: 'center' },
  alertRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  border: { borderTopWidth: 1, borderTopColor: colors.border },
  alertText: { color: colors.text, fontSize: 14, fontWeight: '600', lineHeight: 19 },
  alertMeta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  eventTitle: { color: colors.gold, fontSize: 14, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: 10 },
});
