/**
 * Point d'entrée du serveur d'alertes. Lancer : node server/check-alerts.ts
 * Variables : NTFY_TOPIC (canal secret, obligatoire pour envoyer), ALERT_STATE (fichier d'état).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

import { parseConfig, runOnce, sendNtfy, type ServerState } from './alertServer.ts';

const CONFIG = new URL('./alerts.json', import.meta.url);
const STATE = process.env.ALERT_STATE || '.alert-state/state.json';
const topic = process.env.NTFY_TOPIC?.trim();

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
if (!topic) {
  console.warn('NTFY_TOPIC absent : aucune notification envoyée (ajoutez le secret dans les réglages du dépôt).');
}
for (const n of result.notifications) {
  console.log(`Alerte : ${n.title} — ${n.body}`);
  if (topic) {
    try {
      await sendNtfy(topic, n);
    } catch (e) {
      console.warn(`Envoi ntfy impossible : ${e}`);
    }
  }
}
