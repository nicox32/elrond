import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { alertConfigForServer, generateNtfyTopic } from '../logic/alerts';
import { useAccount, useBank } from '../state/BankProvider';
import { colors } from '../theme';
import { Button, Card, Hint } from './ui';

const REPO = 'https://github.com/nicox32/elrond';
const LINKS = {
  ntfyApp: 'https://play.google.com/store/apps/details?id=io.heckel.ntfy',
  secret: `${REPO}/settings/secrets/actions/new`,
  editAlerts: `${REPO}/edit/ccr-de251d88-j0qjcp/server/alerts.json`,
  run: `${REPO}/actions/workflows/alertes.yml`,
};

/** Guide pour recevoir les alertes 24 h/24 : serveur GitHub Actions + application ntfy. */
export function ServerAlerts() {
  const account = useAccount();
  const { updateAccount } = useBank();
  const [copied, setCopied] = useState<string | null>(null);
  const topic = account.ntfyTopic;
  const config = JSON.stringify({ alerts: alertConfigForServer(account.alerts ?? []) }, null, 2);

  async function copy(what: string, text: string) {
    await Clipboard.setStringAsync(text);
    setCopied(what);
  }

  if (!topic) {
    return (
      <Card style={{ gap: 8 }}>
        <Text style={styles.title}>Alertes 24 h/24</Text>
        <Text style={styles.para}>
          Reçois tes alertes même quand l’appli et le téléphone sont éteints : un serveur vérifie les cours toutes les
          15 minutes et t’envoie une notification par l’appli gratuite ntfy.
        </Text>
        <Button
          title="Préparer mon canal de notifications"
          variant="ghost"
          onPress={() => updateAccount((acc) => ({ ...acc, ntfyTopic: generateNtfyTopic() }))}
        />
      </Card>
    );
  }

  return (
    <Card style={{ gap: 12 }}>
      <Text style={styles.title}>Alertes 24 h/24 · 4 étapes</Text>

      <Step n={1} title="Installe l’appli ntfy (gratuite)">
        <LinkText url={LINKS.ntfyApp}>Ouvrir ntfy sur le Play Store</LinkText>
      </Step>

      <Step n={2} title="Abonne-toi à ton canal secret">
        <Text style={styles.code} selectable>
          {topic}
        </Text>
        <Text style={styles.para}>Dans ntfy : « + », colle ce nom de canal, puis « S’abonner ».</Text>
        <Button
          title={copied === 'topic' ? 'Canal copié ✓' : 'Copier le canal'}
          variant="ghost"
          onPress={() => copy('topic', topic)}
        />
      </Step>

      <Step n={3} title="Donne ce canal au serveur (une fois)">
        <Text style={styles.para}>
          Sur GitHub, crée le secret <Text style={styles.bold}>NTFY_TOPIC</Text> avec ce même nom de canal comme valeur.
        </Text>
        <LinkText url={LINKS.secret}>Ouvrir la page des secrets du dépôt</LinkText>
      </Step>

      <Step n={4} title="Envoie tes alertes au serveur">
        <Text style={styles.para}>
          Copie tes alertes, puis colle-les à la place du contenu du fichier server/alerts.json et enregistre (« Commit
          changes »). À refaire quand tu modifies tes alertes.
        </Text>
        <Button
          title={copied === 'config' ? 'Alertes copiées ✓' : `Copier mes ${account.alerts?.length ?? 0} alerte(s)`}
          variant="ghost"
          onPress={() => copy('config', config)}
          disabled={!account.alerts?.length}
        />
        <LinkText url={LINKS.editAlerts}>Ouvrir server/alerts.json sur GitHub</LinkText>
      </Step>

      <Hint>
        Pour tester : sur la page de la tâche, « Run workflow » lance une vérification tout de suite.{' '}
        <Text style={styles.link} onPress={() => Linking.openURL(LINKS.run)}>
          Ouvrir la tâche
        </Text>
        . Le canal est secret : ne le partage pas, toute personne qui le connaît peut lire tes alertes.
      </Hint>
    </Card>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <View style={styles.step}>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>{n}</Text>
      </View>
      <View style={{ flex: 1, gap: 6 }}>
        <Text style={styles.stepTitle}>{title}</Text>
        {children}
      </View>
    </View>
  );
}

function LinkText({ url, children }: { url: string; children: string }) {
  return (
    <Pressable onPress={() => Linking.openURL(url)} accessibilityRole="link">
      <Text style={styles.link}>{children} ›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.text, fontSize: 16, fontWeight: '700' },
  para: { color: colors.text, fontSize: 13, lineHeight: 19 },
  bold: { fontWeight: '800' },
  code: {
    color: colors.gold,
    fontSize: 15,
    fontWeight: '700',
    backgroundColor: colors.surfaceAlt,
    padding: 10,
    borderRadius: 10,
    fontVariant: ['tabular-nums'],
  },
  link: { color: colors.gold, fontSize: 13, fontWeight: '700' },
  step: { flexDirection: 'row', gap: 10 },
  badge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  badgeText: { color: colors.background, fontWeight: '800', fontSize: 13 },
  stepTitle: { color: colors.text, fontSize: 14, fontWeight: '700' },
});
