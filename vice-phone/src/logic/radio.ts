import type { Station } from '../data/radio.ts';

/** Ce qui passe à l’antenne à l’instant t : un titre (20 s) puis, une fois sur trois, l’animateur (8 s). */
export function onAir(station: Pick<Station, 'host' | 'dj' | 'tracks'>, t: number): { kind: 'track' | 'dj'; line1: string; line2: string } {
  const slot = 28_000;
  const i = Math.floor(t / slot);
  const inSlot = t % slot;
  if (i % 3 === 2 && inSlot < 8000) {
    return { kind: 'dj', line1: station.host, line2: station.dj[i % station.dj.length] };
  }
  const [artist, title] = station.tracks[i % station.tracks.length];
  return { kind: 'track', line1: title, line2: artist };
}
