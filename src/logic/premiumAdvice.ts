/**
 * Conseil de l'Espace Dev : faut-il monter, baisser ou garder l'ajustement Orvia de la prime du Gold Oria ?
 *
 * Repères tirés du marché réel : quand l'or chute, les achats affluent et les primes montent (2008, mars 2020) ;
 * quand il est au plus haut, les clients vendent et la prime doit baisser. On avance par paliers de 0,5 point au plus,
 * une fois par semaine, sauf en crise où l'on rejoint tout de suite le niveau visé.
 */
import { average30 } from './alerts.ts';
import { adjustmentAt, AUTO_PREMIUM, PREMIUM_SCENARIOS } from './ecu.ts';
import type { PricePoint } from './priceHistory.ts';
import type { Account } from './types.ts';

export const ADVICE = {
  /** Paliers maximum par ajustement (hors crise), en points. */
  step: 0.005,
  /** Délai minimum entre deux ajustements (hors crise). */
  minDaysBetween: 7,
  crisis: { drop24h: -0.04, drop7d: -0.08 },
  demand: { belowAvg: 0.04, drop7d: -0.04 },
  calm: { aboveAvg: 0.06, rise7d: 0.03 },
} as const;

export interface PremiumAdvice {
  action: 'raise' | 'lower' | 'hold' | 'wait-data';
  /** Ajustement conseillé (en points, 0,01 = 1 point). */
  toOffset: number;
  current: number;
  /** Scénario de marché reconnu. */
  scenario: (typeof PREMIUM_SCENARIOS)[number];
  title: string;
  reasons: string[];
  /** Identifiant stable du conseil, pour ne notifier qu'une fois. */
  key: string;
}

const DAY = 86_400_000;
const p1 = (n: number) =>
  `${n >= 0 ? '+' : '−'}${Math.abs(n * 100).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %`;
const pt = (n: number) => `${Math.abs(n * 100).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} pt`;

/** Cours de l'or le plus proche avant `t` (au moins 80 % de la durée couverte), sinon null. */
function goldAgo(history: PricePoint[], now: number, ms: number): number | null {
  const target = now - ms;
  let best: PricePoint | null = null;
  for (const p of history) {
    const t = new Date(p.t).getTime();
    if (t <= target + ms * 0.2) best = p;
    else break;
  }
  if (!best || now - new Date(best.t).getTime() < ms * 0.8) return null;
  return best.prices.gold;
}

export function premiumAdvice(
  account: Pick<Account, 'settings'>,
  gold: number,
  hourly: PricePoint[],
  now = new Date(),
): PremiumAdvice {
  const t = now.getTime();
  const current = adjustmentAt(account, now);
  const avg = average30(hourly, 'gold', t);
  const g24 = goldAgo(hourly, t, DAY);
  const g7 = goldAgo(hourly, t, 7 * DAY);
  const byId = (id: string) => PREMIUM_SCENARIOS.find((s) => s.id === id)!;

  if (avg === null || g7 === null) {
    return {
      action: 'wait-data',
      toOffset: current,
      current,
      scenario: byId('normal'),
      title: 'Pas encore assez de cours pour conseiller',
      reasons: [
        'Il faut au moins 7 jours de relevés horaires (l’appli en enregistre un par heure quand elle est ouverte).',
      ],
      key: 'wait-data',
    };
  }

  const vsAvg = (gold - avg) / avg;
  const ch7 = (gold - g7) / g7;
  const ch24 = g24 ? (gold - g24) / g24 : 0;
  const reasons = [
    `Or ${p1(vsAvg)} par rapport à sa moyenne 30 jours.`,
    `Variation : ${p1(ch7)} sur 7 jours${g24 ? `, ${p1(ch24)} sur 24 h` : ''}.`,
  ];

  let scenario = byId('normal');
  if (ch24 <= ADVICE.crisis.drop24h || ch7 <= ADVICE.crisis.drop7d) scenario = byId('crisis');
  else if (-vsAvg >= ADVICE.demand.belowAvg || ch7 <= ADVICE.demand.drop7d) scenario = byId('demand');
  else if (vsAvg >= ADVICE.calm.aboveAvg && ch7 >= ADVICE.calm.rise7d) scenario = byId('calm');
  reasons.push(
    `Situation reconnue : ${scenario.label.toLowerCase()} (${scenario.when.charAt(0).toLowerCase()}${scenario.when.slice(1).replace(/\.$/, '')}).`,
  );

  const diff = scenario.offset - current;
  const crisis = scenario.id === 'crisis';
  const lastAt = (account.settings.ecuPremiumAdjustments ?? []).filter((a) => new Date(a.at).getTime() <= t).at(-1)?.at;
  const daysSince = lastAt ? (t - new Date(lastAt).getTime()) / DAY : Infinity;

  if (Math.abs(diff) < 1e-6) {
    return {
      action: 'hold',
      toOffset: current,
      current,
      scenario,
      title: 'Gardez la prime telle quelle',
      reasons: [...reasons, 'L’ajustement actuel correspond déjà à la situation du marché.'],
      key: `hold:${scenario.id}`,
    };
  }
  if (!crisis && daysSince < ADVICE.minDaysBetween) {
    const left = Math.ceil(ADVICE.minDaysBetween - daysSince);
    return {
      action: 'hold',
      toOffset: current,
      current,
      scenario,
      title: `Attendez encore ${left} jour${left > 1 ? 's' : ''}`,
      reasons: [
        ...reasons,
        `Dernier ajustement il y a ${Math.floor(daysSince)} jour(s) : en temps normal, on ne bouge la prime qu’une fois par semaine.`,
      ],
      key: `wait:${scenario.id}`,
    };
  }
  const move = crisis ? diff : Math.sign(diff) * Math.min(Math.abs(diff), ADVICE.step);
  const toOffset =
    Math.round(Math.min(AUTO_PREMIUM.adjustMax, Math.max(AUTO_PREMIUM.adjustMin, current + move)) * 10000) / 10000;
  const raise = toOffset > current;
  return {
    action: raise ? 'raise' : 'lower',
    toOffset,
    current,
    scenario,
    title: `${raise ? 'Montez' : 'Baissez'} la prime de ${pt(toOffset - current)}`,
    reasons: [
      ...reasons,
      crisis
        ? 'En crise, la demande explose : rejoignez tout de suite le niveau de crise.'
        : `Avancez par palier vers le niveau visé (${pt(scenario.offset)} ${scenario.offset >= 0 ? 'au-dessus' : 'en dessous'} de la normale).`,
    ],
    key: `${raise ? 'raise' : 'lower'}:${scenario.id}:${toOffset}`,
  };
}
