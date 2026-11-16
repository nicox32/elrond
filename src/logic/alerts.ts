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
  | 'aboveAvg30'
  /** Ratio or/métal (argent ou platine) au-dessus d'une valeur : le métal est bon marché par rapport à l'or. */
  | 'ratioAbove'
  /** Ratio or/métal sous une valeur : le métal est cher par rapport à l'or. */
  | 'ratioBelow';

export const isRatioKind = (k: AlertKind) => k === 'ratioAbove' || k === 'ratioBelow';

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

const HOUR_MS = 3_600_000;

/**
 * Garde un relevé par heure (heure pleine) sur 35 jours : un nouveau cours remplace celui de la même heure,
 * sinon il s'ajoute. (Comparer à « moins d'une heure depuis le dernier relevé » remplaçait sans fin le dernier
 * point quand les cours arrivent toutes les 15 minutes : l'historique ne grandissait plus.)
 */
export function addHourlyPoint(history: PricePoint[], quote: PriceQuote): PricePoint[] {
  if (quote.source !== 'live') return history;
  const time = new Date(quote.fetchedAt).getTime();
  const kept = history.filter((p) => {
    const t = new Date(p.t).getTime();
    return t >= time - HOURLY_HISTORY_MS && t < time;
  });
  const last = kept[kept.length - 1];
  if (last && Math.floor(new Date(last.t).getTime() / HOUR_MS) === Math.floor(time / HOUR_MS)) kept.pop();
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
const ratioFmt = (n: number) => n.toLocaleString('fr-FR', { maximumFractionDigits: 2 });
const ratioName = (m: Metal) => (m === 'platinum' ? 'or/platine' : 'or/argent');

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
    case 'ratioAbove':
      return `Ratio ${ratioName(a.metal)} au-dessus de ${ratioFmt(a.value)}`;
    case 'ratioBelow':
      return `Ratio ${ratioName(a.metal)} sous ${ratioFmt(a.value)}`;
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
  if (isRatioKind(input.kind) && input.metal === 'gold') {
    throw new Error('Un ratio compare l’or à l’argent ou au platine : choisissez l’argent ou le platine.');
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
    case 'ratioAbove':
    case 'ratioBelow': {
      if (a.metal === 'gold' || !(current > 0)) return null;
      const ratio = prices.gold / current;
      const hit = a.kind === 'ratioAbove' ? ratio >= a.value : ratio <= a.value;
      return hit ? ratioMessage(a.kind, a.metal, ratio, prices) : false;
    }
  }
}

/** Texte d'une alerte de ratio : la valeur, les deux cours et ce que ça veut dire pour un achat manuel. */
function ratioMessage(kind: AlertKind, metal: Metal, ratio: number, prices: Prices): string {
  const of = metal === 'platinum' ? 'de platine' : 'd’argent';
  const subject = metal === 'platinum' ? 'Le platine' : 'L’argent';
  const advice =
    kind === 'ratioAbove'
      ? `${subject} est bon marché par rapport à l’or : moment favorable pour un achat manuel ${of}.`
      : `${subject} est cher par rapport à l’or : privilégiez l’or pour vos prochains achats.`;
  return `Ratio ${ratioName(metal)} : ${ratioFmt(ratio)} (1 g d’or = ${ratioFmt(ratio)} g ${of}). ${METAL_LABEL[metal]} ${eur(prices[metal])}/g · Gold Spot ${eur(prices.gold)}/g. ${advice}`;
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

/**
 * Alertes recommandées, réglées selon la volatilité de chaque métal (variation quotidienne habituelle : or ≈ 1 %,
 * argent ≈ 2 %, platine ≈ 2 % avec des à-coups plus brusques). L'or sert à épargner : on surveille surtout les
 * baisses pour renforcer. L'argent et le platine servent à diversifier : on surveille baisses et hausses, avec des
 * seuils plus serrés et plus tôt pour le platine. Mêmes réglages que server/alerts.json.
 */
export const RECOMMENDED_ALERTS: (Pick<PriceAlert, 'metal' | 'kind' | 'value'> & { window?: AlertWindow })[] = [
  // Gold Spot (épargne)
  { metal: 'gold', kind: 'drop', value: 3, window: '24h' },
  { metal: 'gold', kind: 'drop', value: 6, window: '7d' },
  { metal: 'gold', kind: 'belowAvg30', value: 3 },
  { metal: 'gold', kind: 'rise', value: 7, window: '7d' },
  // Argent (diversification, volatil)
  { metal: 'silver', kind: 'drop', value: 4, window: '24h' },
  { metal: 'silver', kind: 'rise', value: 5, window: '24h' },
  { metal: 'silver', kind: 'drop', value: 8, window: '7d' },
  { metal: 'silver', kind: 'rise', value: 10, window: '7d' },
  { metal: 'silver', kind: 'belowAvg30', value: 5 },
  { metal: 'silver', kind: 'aboveAvg30', value: 10 },
  // Platine (diversification, très volatil : surveillé de plus près)
  { metal: 'platinum', kind: 'drop', value: 3, window: '24h' },
  { metal: 'platinum', kind: 'rise', value: 3, window: '24h' },
  { metal: 'platinum', kind: 'drop', value: 6, window: '7d' },
  { metal: 'platinum', kind: 'rise', value: 8, window: '7d' },
  { metal: 'platinum', kind: 'belowAvg30', value: 4 },
  { metal: 'platinum', kind: 'aboveAvg30', value: 8 },
];

/**
 * Alertes pour les achats manuels d'argent et de platine : ratios or/métal, à côté des paliers de prix.
 * Or/argent : moyenne sur 20 ans ≈ 72, zone habituelle 60–70, bon marché au-delà de 80. Or/platine : moyenne sur
 * 20 ans ≈ 1,7, autour de 2,4–2,7 sur la dernière année (plus haut 3,6 en avril 2025).
 */
export const MANUAL_BUY_ALERTS: (Pick<PriceAlert, 'metal' | 'kind' | 'value'> & { window?: AlertWindow })[] = [
  { metal: 'silver', kind: 'ratioAbove', value: 85 },
  { metal: 'silver', kind: 'ratioAbove', value: 90 },
  { metal: 'silver', kind: 'ratioBelow', value: 65 },
  { metal: 'platinum', kind: 'ratioAbove', value: 2.9 },
  { metal: 'platinum', kind: 'ratioBelow', value: 2 },
];

/** Notification de test d'une alerte : le message reçu quand sa condition sera remplie. */
export function testNotification(
  a: Pick<PriceAlert, 'metal' | 'kind' | 'value'> & Partial<Pick<PriceAlert, 'unit' | 'window'>>,
  prices: Pick<Prices, 'gold' | 'silver' | 'platinum'>,
  index?: number,
  total?: number,
): { title: string; body: string } {
  const label = a.metal === 'gold' ? METAL_LABEL.gold : METAL_LABEL[a.metal].toLowerCase();
  const desc = describeAlert({ id: '', enabled: true, armed: true, createdAt: '', ...a } as PriceAlert);
  const n = index !== undefined && total ? ` (${index + 1}/${total})` : '';
  return {
    title: `Test${n} · Alerte ${label} · ${desc}`,
    body: isRatioKind(a.kind)
      ? `Notification de test : c’est ce message que vous recevrez quand la condition sera remplie. Ratio ${ratioName(a.metal)} actuel : ${ratioFmt(prices.gold / prices[a.metal as 'silver'])}.`
      : `Notification de test : c’est ce message que vous recevrez quand la condition sera remplie. Cours actuel : ${eur((prices[a.metal as 'gold'] ?? 0) * TROY_OUNCE)}/oz.`,
  };
}

/** Nom de canal ntfy difficile à deviner. */
export function generateNtfyTopic(): string {
  const alphabet = 'abcdefghijkmnpqrstuvwxyz23456789';
  let s = '';
  for (let i = 0; i < 20; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
  return `orvia-${s}`;
}

// ——— Alertes déclenchées par le serveur (lues sur le canal ntfy) ————————————————

/** Métal d'une notification du serveur, d'après son titre (« Alerte platine · … »). */
export function metalOfServerTitle(title: string): Metal | null {
  if (/^Alerte Gold Spot/i.test(title)) return 'gold';
  if (/^Alerte argent/i.test(title)) return 'silver';
  if (/^Alerte platine/i.test(title)) return 'platinum';
  return null;
}

/** Notifications d'alerte réelles reçues du serveur (les tests et les messages du bot sont écartés). */
export function serverAlertMessages<T extends { title: string }>(messages: T[]): T[] {
  return messages.filter((m) => metalOfServerTitle(m.title) !== null);
}

/** Dernier déclenchement côté serveur de chaque alerte (même description dans le titre). */
export function serverTriggers(
  alerts: PriceAlert[],
  messages: { title: string; date: string }[],
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const a of alerts) {
    const desc = describeAlert(a);
    const hit = serverAlertMessages(messages).find((m) => m.title.endsWith(` · ${desc}`));
    if (hit) out[a.id] = hit.date;
  }
  return out;
}
