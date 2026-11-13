import { AndroidImportance } from 'expo-notifications';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

/** Rappels locaux « surveiller le troupeau » toutes les 24 h (téléphone). La version web est dans reminders.web.ts. */

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export const REMINDERS_SUPPORTED = true;
export const REMINDER_EVERY_SECONDS = 24 * 60 * 60;

const CHANNEL = 'troupeaux';
let channelReady: Promise<unknown> | null = null;

function ensureChannel() {
  if (Platform.OS !== 'android') return Promise.resolve();
  channelReady ??= Notifications.setNotificationChannelAsync(CHANNEL, {
    name: 'Suivi des troupeaux',
    importance: AndroidImportance.DEFAULT,
  });
  return channelReady;
}

/** Programme le rappel ; renvoie son identifiant, ou undefined si les notifications sont refusées. */
export async function scheduleHerdReminder(herdName: string): Promise<string | undefined> {
  try {
    await ensureChannel();
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') return undefined;
    return await Notifications.scheduleNotificationAsync({
      content: {
        title: 'WotH2 Tracker · troupeau à surveiller',
        body: `${herdName} : repasse voir le troupeau. Rappel : 1 an de vie d'un animal = 3 jours en jeu.`,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: REMINDER_EVERY_SECONDS,
        repeats: true,
        ...(Platform.OS === 'android' ? { channelId: CHANNEL } : {}),
      },
    });
  } catch {
    return undefined;
  }
}

export async function cancelHerdReminder(id: string | undefined): Promise<void> {
  if (!id) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch {
    // Déjà annulé.
  }
}
