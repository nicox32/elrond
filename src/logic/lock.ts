// Verrouillage de l'appli : le code est redemandé après un délai passé en arrière-plan (pas à chaque changement
// d'appli, ce qui gênerait quand on copie un numéro depuis le site d'un revendeur).
import type { Settings } from './types.ts';

export const LOCK_DELAYS: { value: number; label: string }[] = [
  { value: 0, label: 'Direct' },
  { value: 60, label: '1 min' },
  { value: 300, label: '5 min' },
  { value: 900, label: '15 min' },
];

/** Délai par défaut avant de redemander le code (secondes). */
export const DEFAULT_LOCK_DELAY = 300;

export function lockDelayOf(settings?: Pick<Settings, 'lockDelaySec'>): number {
  const v = settings?.lockDelaySec;
  return typeof v === 'number' && v >= 0 ? v : DEFAULT_LOCK_DELAY;
}

/** Faut-il redemander le code au retour dans l'appli ? `leftAt` : instant (ms) où l'appli est passée en arrière-plan. */
export function shouldLock(leftAt: number | null, now: number, delaySec: number): boolean {
  if (leftAt === null) return false;
  if (delaySec <= 0) return true;
  return now - leftAt >= delaySec * 1000;
}
