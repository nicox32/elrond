/** Navigateur : pas de tâche en arrière-plan (les alertes passent par le serveur ntfy). */
export const PRICE_TASK = 'orvia-verification-cours';

export async function registerBackgroundChecks(): Promise<boolean> {
  return false;
}

export async function backgroundChecksActive(): Promise<boolean> {
  return false;
}
