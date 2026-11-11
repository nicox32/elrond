/** Sur le web, pas de notification programmée : seule la marque « à revoir » dans l'appli reste. */
export const REMINDERS_SUPPORTED = false;
export const REMINDER_EVERY_SECONDS = 24 * 60 * 60;

export async function scheduleHerdReminder(_herdName: string): Promise<string | undefined> {
  return undefined;
}

export async function cancelHerdReminder(_id: string | undefined): Promise<void> {}
