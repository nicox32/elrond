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

/** Jour (0 = dimanche) et heure décimale à Paris. */
export function parisTime(now: Date): { day: number; hour: number } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Paris',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'));
  return { day, hour: Number(get('hour')) + Number(get('minute')) / 60 };
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
