/**
 * Horaires du marché des métaux précieux (cotation continue de l'or, de l'argent et du platine), en heure de Paris :
 * du lundi 0 h au vendredi 23 h, avec une pause chaque soir de 23 h à minuit. Fermé le samedi et le dimanche.
 * (Ce sont les horaires de New York, de dimanche 18 h à vendredi 17 h ; ils peuvent se décaler d'une heure pendant
 * les quelques semaines où la France et les États-Unis ne changent pas d'heure le même jour.)
 *
 * Quand le marché est fermé, les cours ne bougent plus : un achat ou une vente se fait au dernier cours connu,
 * celui affiché au moment de l'opération.
 */

const DAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

/** Dernier dimanche d'un mois (UTC), à 1 h UTC : moment des changements d'heure en Europe. */
function lastSundayUtc(year: number, month: number): number {
  const d = new Date(Date.UTC(year, month + 1, 0, 1)); // dernier jour du mois, 1 h UTC
  d.setUTCDate(d.getUTCDate() - d.getUTCDay());
  return d.getTime();
}

/**
 * Jour (0 = dimanche) et heure décimale à Paris, calculés sans Intl (indisponible ou incomplet sur certains
 * téléphones) : UTC+1, ou UTC+2 du dernier dimanche de mars au dernier dimanche d'octobre (1 h UTC).
 */
export function parisTime(now: Date): { day: number; hour: number } {
  const t = now.getTime();
  const y = now.getUTCFullYear();
  const summer = t >= lastSundayUtc(y, 2) && t < lastSundayUtc(y, 9);
  const local = new Date(t + (summer ? 2 : 1) * 3_600_000);
  return { day: local.getUTCDay(), hour: local.getUTCHours() + local.getUTCMinutes() / 60 };
}

export interface MarketStatus {
  open: boolean;
  /** Pause du soir (23 h – minuit) en semaine, ou week-end. */
  reason?: 'pause' | 'weekend';
  /** « ferme vendredi à 23 h », « rouvre lundi à 0 h »… */
  next: string;
}

export function marketStatus(now = new Date()): MarketStatus {
  const { day, hour } = parisTime(now);
  const weekday = day >= 1 && day <= 5;
  if (weekday && hour < 23) {
    return { open: true, next: day === 5 ? 'ferme ce soir à 23 h, jusqu’à lundi' : 'pause ce soir de 23 h à minuit' };
  }
  if (weekday && day !== 5) return { open: false, reason: 'pause', next: `rouvre à minuit (${DAYS[day + 1]})` };
  return { open: false, reason: 'weekend', next: 'rouvre lundi à 0 h' };
}

export const MARKET_HOURS =
  'Du lundi 0 h au vendredi 23 h (heure de Paris), avec une pause chaque soir de 23 h à minuit. Fermé le week-end.';

/**
 * Place de Londres (LBMA), principal marché physique de l'or, de l'argent et du platine : séance de 8 h à 17 h,
 * heure de Londres, soit de 9 h à 18 h à Paris (les deux pays changent d'heure les mêmes jours). Prix de référence
 * fixés aux enchères chaque jour ouvré (heure de Paris) : or à 11 h 30 et 16 h, argent à 13 h, platine à 10 h 45
 * et 15 h.
 */
export const LONDON = {
  open: 9,
  close: 18,
  fixings: [
    { metal: 'or', times: '11 h 30 et 16 h' },
    { metal: 'argent', times: '13 h' },
    { metal: 'platine', times: '10 h 45 et 15 h' },
  ],
} as const;

export function londonStatus(now = new Date()): { open: boolean; next: string } {
  const { day, hour } = parisTime(now);
  const weekday = day >= 1 && day <= 5;
  if (weekday && hour >= LONDON.open && hour < LONDON.close) return { open: true, next: 'ferme à 18 h' };
  if (weekday && hour < LONDON.open) return { open: false, next: 'ouvre à 9 h' };
  if (day >= 1 && day <= 4) return { open: false, next: 'ouvre demain à 9 h' };
  return { open: false, next: 'ouvre lundi à 9 h' };
}
