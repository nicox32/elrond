/**
 * Accès caché à l'Espace DEV : six appuis, chacun dans la seconde et demie qui suit le précédent.
 * Un appui trop tardif repart de un.
 */
export const DEV_TAPS = 6;
export const DEV_TAP_GAP_MS = 1500;

export interface TapState {
  count: number;
  last: number;
}

export function registerTap(state: TapState, now: number): { state: TapState; opened: boolean } {
  const count = state.count > 0 && now - state.last <= DEV_TAP_GAP_MS ? state.count + 1 : 1;
  if (count >= DEV_TAPS) return { state: { count: 0, last: now }, opened: true };
  return { state: { count, last: now }, opened: false };
}
