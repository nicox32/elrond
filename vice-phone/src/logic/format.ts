const DAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

const pad = (n: number) => String(n).padStart(2, '0');

export function clock(t: number): string {
  const d = new Date(t);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function longDate(t: number): string {
  const d = new Date(t);
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** « à l’instant », « il y a 5 min », « il y a 2 h », sinon la date courte. */
export function ago(t: number, now: number): string {
  const s = Math.max(0, Math.floor((now - t) / 1000));
  if (s < 60) return 'à l’instant';
  const m = Math.floor(s / 60);
  if (m < 60) return `il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `il y a ${h} h`;
  const d = new Date(t);
  return `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 4)}.`;
}

/** 12500 → « 12 500 $ », -80 → « −80 $ ». Espaces fines insécables, sans dépendre d’Intl. */
export function money(n: number, signed = false): string {
  const abs = Math.round(Math.abs(n));
  const digits = String(abs).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const sign = n < 0 ? '−' : signed && n > 0 ? '+' : '';
  return `${sign}${digits} $`;
}

export function duration(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  return `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;
}

/** 1234 → « 1,2 k » pour les compteurs de likes. */
export function compact(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(1).replace('.0', '').replace('.', ',')} k`;
  return `${(n / 1_000_000).toFixed(1).replace('.0', '').replace('.', ',')} M`;
}
