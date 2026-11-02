import { METAL_LABEL, newId, TROY_OUNCE } from './ledger.ts';
import type { PricePoint } from './priceHistory.ts';
import type { Metal, PriceQuote, Prices, WeightUnit } from './types.ts';

/**
 * Alertes de prix choisies par l'utilisateur. Ce ne sont pas des conseils d'investissement :
 * l'appli prévient quand une condition fixée par l'utilisateur est remplie.
 */
export type AlertKind =
  /** Le cours passe au-dessus d'un prix. */
  | 'above'
  /** Le cours passe sous un prix. */
  | 'below'
  /** Baisse d'au moins X % sur la période. */
  | 'drop'
  /** Hausse d'au moins X % sur la période. */
  | 'rise'
  /** Cours au moins X % sous sa moyenne des 30 derniers jours. */
  | 'belowAvg30'
  /** Cours au moins X % au-dessus de sa moyenne des 30 derniers jours. */
  | 'aboveAvg30';

export type AlertWindow = '24h' | '7d';

export interface PriceAlert {
  id: string;
  metal: Metal;
  kind: AlertKind;
  /** Prix (en €/g ou €/oz selon `unit`) pour above/below ; pourcentage pour les autres. */
  value: number;
  unit?: WeightUnit;
  window?: AlertWindow;
  enabled: boolean;
  /** Prête à se déclencher : redevient vraie quand la condition cesse d'être remplie. */
  armed: boolean;
  createdAt: string;
  lastTriggeredAt?: string;
}

export interface AlertEvent {
  id: string;
  alertId: string;
  metal: Metal;
  kind: AlertKind;
  date: string;
  title: string;
  body: string;
}

/** Après un déclenchement, une alerte attend au moins ce délai avant de pouvoir se redéclencher. */
export const ALERT_COOLDOWN_MS = 6 * 3_600_000;
const MAX_EVENTS = 50;

// ——— Relevés horaires sur 35 jours (variations 7 j, moyenne 30 j) ———————————

export const HOURLY_HISTORY_MS = 35 * 24 * 3_600_000;

/** Garde au plus un relevé par heure sur 35 jours. */
export function addHourlyPoint(history: PricePoint[], quote: PriceQuote): PricePoint[] {
  if (quote.source !== 'live') return history;
  const time = new Date(quote.fetchedAt).getTime();
  const kept = history.filter((p) => {
    const t = new Date(p.t).getTime();
    return t >= time - HOURLY_HISTORY_MS && t < time;
  });
  const last = kept[kept.length - 1];
  if (last && time - new Date(last.t).getTime() < 3_600_000) kept.pop();
  kept.push({ t: quote.fetchedAt, prices: { ...quote.prices } });
  return kept;
}

const WINDOW_MS: Record<AlertWindow, number> = { '24h': 24 * 3_600_000, '7d': 7 * 24 * 3_600_000 };

/** Cours le plus ancien disponible dans la période (au moins 90 % de la période couverte), sinon null. */
function priceAgo(history: PricePoint[], metal: Metal, windowMs: number, now: number): number | null {
  const target = now - windowMs;
  let best: PricePoint | null = null;
  for (const p of history) {
    const t = new Date(p.t).getTime();
    if (t >= target && t <= now) {
      best = p;
      break;
    }
  }
  if (!best || now - new Date(best.t).getTime() < windowMs * 0.9) return null;
  return best.prices[metal];
}

/** Moyenne des relevés des 30 derniers jours (au moins 7 jours de données), sinon null. */
export function average30(history: PricePoint[], metal: Metal, now: number): number | null {
  const from = now - 30 * 24 * 3_600_000;
  const pts = history.filter((p) => new Date(p.t).getTime() >= from);
  if (pts.length < 2 || now - new Date(pts[0].t).getTime() < 7 * 24 * 3_600_000) return null;
  return pts.reduce((s, p) => s + p.prices[metal], 0) / pts.length;
}

const pricePer = (eurPerGram: number, unit: WeightUnit = 'oz') =>
  unit === 'oz' ? eurPerGram * TROY_OUNCE : eurPerGram;

const eur = (n: number) => n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
const pct = (n: number) => `${n.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %`;
const WINDOW_LABEL: Record<AlertWindow, string> = { '24h': '24 h', '7d': '7 jours' };

/** Description lisible d'une alerte. */
export function describeAlert(a: PriceAlert): string {
  const metal = METAL_LABEL[a.metal];
  const u = a.unit ?? 'oz';
  switch (a.kind) {
    case 'above':
      return `${metal} au-dessus de ${eur(a.value)}/${u}`;
    case 'below':
      return `${metal} sous ${eur(a.value)}/${u}`;
    case 'drop':
      return `${metal} en baisse d’au moins ${pct(a.value)} sur ${WINDOW_LABEL[a.window ?? '24h']}`;
    case 'rise':
      return `${metal} en hausse d’au moins ${pct(a.value)} sur ${WINDOW_LABEL[a.window ?? '24h']}`;
    case 'belowAvg30':
      return `${metal} au moins ${pct(a.value)} sous sa moyenne 30 jours`;
    case 'aboveAvg30':
      return `${metal} au moins ${pct(a.value)} au-dessus de sa moyenne 30 jours`;
  }
}

export function createAlert(
  input: Pick<PriceAlert, 'metal' | 'kind' | 'value'> & Partial<Pick<PriceAlert, 'unit' | 'window'>>,
  now = new Date(),
): PriceAlert {
  if (!Number.isFinite(input.value) || input.value <= 0) throw new Error('Indiquez une valeur positive.');
  if ((input.kind === 'drop' || input.kind === 'rise' || input.kind.endsWith('Avg30')) && input.value >= 100) {
    throw new Error('Le pourcentage doit être inférieur à 100 %.');
  }
  return {
    id: newId(),
    enabled: true,
    armed: true,
    createdAt: now.toISOString(),
    ...input,
  };
}

/**
 * La condition est-elle remplie ? Renvoie le texte du constat, `false` si non,
 * ou `null` s'il n'y a pas encore assez de relevés pour en juger.
 */
export function checkAlert(a: PriceAlert, prices: Prices, history: PricePoint[], now: number): string | false | null {
  const current = prices[a.metal];
  const u = a.unit ?? 'oz';
  switch (a.kind) {
    case 'above':
    case 'below': {
      const p = pricePer(current, u);
      const hit = a.kind === 'above' ? p >= a.value : p <= a.value;
      return hit ? `Cours actuel : ${eur(p)}/${u}.` : false;
    }
    case 'drop':
    case 'rise': {
      const before = priceAgo(history, a.metal, WINDOW_MS[a.window ?? '24h'], now);
      if (before == null) return null;
      const change = ((current - before) / before) * 100;
      const hit = a.kind === 'drop' ? change <= -a.value : change >= a.value;
      return hit
        ? `${change > 0 ? '+' : ''}${pct(change)} sur ${WINDOW_LABEL[a.window ?? '24h']} · ${eur(pricePer(current))}/oz.`
        : false;
    }
    case 'belowAvg30':
    case 'aboveAvg30': {
      const avg = average30(history, a.metal, now);
      if (avg == null) return null;
      const gap = ((current - avg) / avg) * 100;
      const hit = a.kind === 'belowAvg30' ? gap <= -a.value : gap >= a.value;
      return hit
        ? `${gap > 0 ? '+' : ''}${pct(gap)} par rapport à la moyenne 30 jours (${eur(pricePer(avg))}/oz).`
        : false;
    }
  }
}

/**
 * Évalue les alertes avec un nouveau cours réel. Une alerte se déclenche quand sa condition devient vraie,
 * puis attend qu'elle redevienne fausse (et au moins 6 h) avant de pouvoir se redéclencher.
 */
export function evaluateAlerts(
  alerts: PriceAlert[],
  quote: PriceQuote,
  history: PricePoint[],
  now = new Date(),
): { alerts: PriceAlert[]; events: AlertEvent[] } {
  if (quote.source !== 'live') return { alerts, events: [] };
  const t = now.getTime();
  const events: AlertEvent[] = [];
  let changed = false;
  const next = alerts.map((a) => {
    if (!a.enabled) return a;
    const result = checkAlert(a, quote.prices, history, t);
    if (result === null) return a;
    if (result === false) {
      if (!a.armed) {
        changed = true;
        return { ...a, armed: true };
      }
      return a;
    }
    const cooling = a.lastTriggeredAt && t - new Date(a.lastTriggeredAt).getTime() < ALERT_COOLDOWN_MS;
    if (!a.armed || cooling) return a;
    changed = true;
    events.push({
      id: newId(),
      alertId: a.id,
      metal: a.metal,
      kind: a.kind,
      date: now.toISOString(),
      title: `Alerte ${a.metal === 'gold' ? METAL_LABEL[a.metal] : METAL_LABEL[a.metal].toLowerCase()} · ${describeAlert(a)}`,
      body: result,
    });
    return { ...a, armed: false, lastTriggeredAt: now.toISOString() };
  });
  return { alerts: changed ? next : alerts, events };
}

export function addEvents(existing: AlertEvent[], events: AlertEvent[]): AlertEvent[] {
  return events.length ? [...events, ...existing].slice(0, MAX_EVENTS) : existing;
}

// ——— Serveur d'alertes (GitHub Actions + ntfy) ——————————————————————

/** Configuration à copier dans server/alerts.json : seulement les alertes actives, sans leur état. */
export function alertConfigForServer(alerts: PriceAlert[]) {
  return alerts
    .filter((a) => a.enabled)
    .map((a) => ({
      metal: a.metal,
      kind: a.kind,
      value: a.value,
      ...(a.unit ? { unit: a.unit } : {}),
      ...(a.window ? { window: a.window } : {}),
    }));
}

/** Nom de canal ntfy difficile à deviner. */
export function generateNtfyTopic(): string {
  const alphabet = 'abcdefghijkmnpqrstuvwxyz23456789';
  let s = '';
  for (let i = 0; i < 20; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
  return `orvia-${s}`;
}
