import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { MetalPicker } from '../components/MetalPicker';
import { Segmented } from '../components/Segmented';
import { Button, Card, Hint, Label, Message, Screen, SectionTitle, styles as ui } from '../components/ui';
import { type AlertKind, type AlertWindow, createAlert, describeAlert } from '../logic/alerts';
import { formatDate, parseAmount } from '../logic/format';
import { TROY_OUNCE } from '../logic/ledger';
import type { Metal } from '../logic/types';
import { type NotificationPermission, notificationPermission, requestNotificationPermission } from '../notifications';
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

  useEffect(() => {
    notificationPermission().then(setPermission);
  }, []);

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
        Choisis tes conditions : l’appli te prévient quand elles sont remplies. Ce ne sont pas des conseils
        d’investissement, la décision d’acheter ou de vendre reste la tienne.
      </Hint>

      {permission !== 'granted' && (
        <Card style={{ gap: 8 }}>
          <Text style={styles.title}>Notifications</Text>
          <Text style={styles.para}>
            {permission === 'denied'
              ? 'Les notifications sont bloquées. Autorise-les dans les réglages du téléphone (ou de Chrome) pour ce site.'
              : permission === 'unsupported'
                ? 'Ce navigateur ne gère pas les notifications. Les alertes restent visibles dans l’historique ci-dessous.'
                : 'Autorise les notifications pour être prévenu même quand tu n’es pas sur l’écran.'}
          </Text>
          {permission === 'default' && (
            <Button
              title="Activer les notifications"
              onPress={() => requestNotificationPermission().then(setPermission)}
            />
          )}
        </Card>
      )}

      <SectionTitle>Nouvelle alerte</SectionTitle>
      <MetalPicker value={metal} onChange={setMetal} />
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
                  {a.lastTriggeredAt ? `Dernière alerte le ${formatDate(a.lastTriggeredAt)}` : 'Pas encore déclenchée'}
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

      <SectionTitle>Alertes déclenchées</SectionTitle>
      {events.length === 0 ? (
        <Hint>Rien pour l’instant. Les cours sont vérifiés toutes les 30 secondes quand l’appli est ouverte.</Hint>
      ) : (
        events.slice(0, 20).map((e) => (
          <Card key={e.id} style={{ gap: 8 }}>
            <Text style={styles.eventTitle}>{e.title}</Text>
            <Text style={styles.para}>{e.body}</Text>
            <Text style={styles.alertMeta}>{formatDate(e.date)}</Text>
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

      <Hint>
        Version web : les alertes ne sont vérifiées que lorsque l’appli est ouverte (ou encore active en arrière-plan).
        Des alertes 24 h/24 demanderont un serveur, prévu dans une prochaine version.
      </Hint>
    </Screen>
  );
}

const styles = StyleSheet.create({
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
