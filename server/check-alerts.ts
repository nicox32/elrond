/**
 * Point d'entrée du serveur d'alertes. Lancer : node server/check-alerts.ts
 * Variables : NTFY_TOPIC (canal secret, obligatoire pour envoyer), ALERT_STATE (fichier d'état).
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

import { testNotification } from '../src/logic/alerts.ts';
import { parseConfig, runOnce, sendNtfy, type ServerState } from './alertServer.ts';

const CONFIG = new URL('./alerts.json', import.meta.url);
const STATE = process.env.ALERT_STATE || '.alert-state/state.json';
const topic = process.env.NTFY_TOPIC?.trim();
/** Lancement manuel avec « test » : envoie une notification de test avec les cours du moment. */
const testMode = process.env.ALERT_TEST === 'true';
/** Lancement manuel avec « tester chaque alerte » : une notification de test par alerte surveillée. */
const testAll = process.env.ALERT_TEST_ALL === 'true';

const readJson = (path: string | URL, fallback: unknown) => {
  try {
    return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : fallback;
  } catch (e) {
    console.warn(`Lecture impossible de ${path} : ${e}`);
    return fallback;
  }
};

const config = parseConfig(readJson(CONFIG, { alerts: [] }), console.warn);
const state = readJson(STATE, { hourly: [], alerts: {} }) as ServerState;

let result: Awaited<ReturnType<typeof runOnce>>;
try {
  result = await runOnce({ config, state });
} catch (e) {
  // Cours indisponibles un instant : on réessaiera au prochain passage, sans faire échouer la tâche.
  console.warn(`Cours indisponibles, nouvel essai dans 15 minutes : ${e}`);
  process.exit(0);
}
mkdirSync(dirname(STATE), { recursive: true });
writeFileSync(STATE, JSON.stringify(result.state));

console.log(`${config.length} alerte(s) surveillée(s), ${result.state.hourly.length} relevé(s) horaires.`);
// Empreinte du canal (ne révèle pas son nom) : permet de vérifier que les alertes partent vers le bon canal.
if (topic) console.log(`Canal ntfy : empreinte ${createHash('sha256').update(topic).digest('hex').slice(0, 12)}.`);
if (!topic) {
  console.warn('NTFY_TOPIC absent : aucune notification envoyée (ajoutez le secret dans les réglages du dépôt).');
}
const eur = (n: number) => n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
const notifications = [...result.notifications];
const last = result.state.hourly.at(-1);
if (testMode && last) {
  const oz = 31.1035;
  const per = (m: 'gold' | 'silver' | 'platinum') => `${eur(last.prices[m] * oz)}/oz`;
  const count = (m: string) => config.filter((c) => c.metal === m).length;
  notifications.unshift({
    title: 'Test Orvia ✓ : notifications actives',
    body:
      `Gold Spot ${per('gold')} · argent ${per('silver')} · platine ${per('platinum')}. ` +
      `Alertes surveillées toutes les 15 min : Gold Spot ${count('gold')}, argent ${count('silver')}, platine ${count('platinum')}.`,
  });
}
if (testAll && last) {
  config.forEach((c, i) => notifications.push(testNotification(c, last.prices, i, config.length)));
}
for (const n of notifications) {
  console.log(`Alerte : ${n.title} — ${n.body}`);
  if (topic) {
    try {
      await sendNtfy(topic, n);
      if (notifications.length > 3) await new Promise((r) => setTimeout(r, 1500));
    } catch (e) {
      console.warn(`Envoi ntfy impossible : ${e}`);
    }
  }
}
