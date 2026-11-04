/**
 * Serveur d'alertes Orvia : vérifie les cours et envoie les alertes par ntfy, même téléphone éteint.
 * Exécuté toutes les 15 minutes par GitHub Actions (.github/workflows/alertes.yml).
 * Réutilise exactement la logique des alertes de l'appli (src/logic/alerts.ts).
 */
import {
  addHourlyPoint,
  type AlertKind,
  type AlertWindow,
  createAlert,
  evaluateAlerts,
  type PriceAlert,
} from '../src/logic/alerts.ts';
import type { PricePoint } from '../src/logic/priceHistory.ts';
import { fetchLivePrices } from '../src/logic/prices.ts';
import type { Metal, WeightUnit } from '../src/logic/types.ts';

/** Une alerte telle qu'écrite dans server/alerts.json. */
export interface AlertConfig {
  metal: Metal;
  kind: AlertKind;
  value: number;
  unit?: WeightUnit;
  window?: AlertWindow;
}

export interface ServerState {
  hourly: PricePoint[];
  /** État de chaque alerte (armée, dernier déclenchement), par clé de configuration. */
  alerts: Record<string, PriceAlert>;
}

export interface Notification {
  title: string;
  body: string;
}

const METALS: Metal[] = ['gold', 'silver', 'platinum'];
const KINDS: AlertKind[] = ['above', 'below', 'drop', 'rise', 'belowAvg30', 'aboveAvg30'];

/** Clé stable d'une alerte : la même configuration garde son état d'une exécution à l'autre. */
export function alertKey(c: AlertConfig): string {
  return [c.metal, c.kind, c.value, c.unit ?? '', c.window ?? ''].join('|');
}

/** Lit et vérifie la configuration ; les entrées invalides sont ignorées avec un message. */
export function parseConfig(raw: unknown, log: (m: string) => void = () => {}): AlertConfig[] {
  const list = (raw as { alerts?: unknown })?.alerts;
  if (!Array.isArray(list)) return [];
  const out: AlertConfig[] = [];
  for (const [i, a] of list.entries()) {
    const ok =
      a &&
      METALS.includes(a.metal) &&
      KINDS.includes(a.kind) &&
      typeof a.value === 'number' &&
      a.value > 0 &&
      (a.unit === undefined || a.unit === 'g' || a.unit === 'oz') &&
      (a.window === undefined || a.window === '24h' || a.window === '7d');
    if (ok) out.push({ metal: a.metal, kind: a.kind, value: a.value, unit: a.unit, window: a.window });
    else log(`Alerte n°${i + 1} ignorée : configuration invalide (${JSON.stringify(a)}).`);
  }
  return out;
}

/** Une exécution : relevé des cours, évaluation des alertes, notifications, nouvel état. */
export async function runOnce(opts: {
  config: AlertConfig[];
  state: ServerState;
  fetchFn?: typeof fetch;
  now?: Date;
}): Promise<{ state: ServerState; notifications: Notification[] }> {
  const now = opts.now ?? new Date();
  const quote = await fetchLivePrices(opts.fetchFn ?? fetch, now);
  const hourly = addHourlyPoint(opts.state.hourly ?? [], quote);
  const keys = opts.config.map(alertKey);
  const alerts = opts.config.map((c, i) => opts.state.alerts?.[keys[i]] ?? createAlert(c, now));
  const r = evaluateAlerts(alerts, quote, hourly, now);
  const next: Record<string, PriceAlert> = {};
  r.alerts.forEach((a, i) => (next[keys[i]] = a));
  return {
    state: { hourly, alerts: next },
    notifications: r.events.map((e) => ({ title: e.title, body: e.body })),
  };
}

/**
 * Envoie une notification sur un canal ntfy, exactement comme l'appli (API JSON, accents compris, sans lien au
 * toucher : la notification ouvre ntfy, où le message reste affiché).
 */
export async function sendNtfy(
  topic: string,
  n: Notification,
  fetchFn: typeof fetch = fetch,
  server = 'https://ntfy.sh',
) {
  const res = await fetchFn(server, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topic, title: n.title, message: n.body, tags: ['bell', 'coin'], priority: 4 }),
  });
  if (!res.ok) throw new Error(`ntfy a répondu ${res.status}`);
}
