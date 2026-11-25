import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { Platform } from 'react-native';

// Notifications locales de l’histoire, pour être prévenu quand l’appli est fermée (aucun serveur).
const CHANNEL = 'cavale';
let scheduledId: string | null = null;
let scheduledAt = 0;
let ready: Promise<boolean> | null = null;

/** Prépare les notifications (une seule fois) et demande l’autorisation à Android. */
export function setupNotifications(): Promise<boolean> {
  if (Platform.OS === 'web') return Promise.resolve(false);
  ready ??= (async () => {
    try {
      Notifications.setNotificationHandler({
        // Appli ouverte : la bannière du téléphone fictif suffit, pas de notification système en double.
        handleNotification: async () => ({ shouldShowBanner: false, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
      });
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync(CHANNEL, {
          name: 'La Cavale',
          importance: AndroidImportance.HIGH,
          vibrationPattern: [0, 200, 120, 200],
          lightColor: '#FF3D8B',
        });
      }
      const current = await Notifications.getPermissionsAsync();
      if (current.granted) return true;
      if (!current.canAskAgain) return false;
      return (await Notifications.requestPermissionsAsync()).granted;
    } catch {
      return false;
    }
  })();
  return ready;
}

/** Programme (ou remplace) la notification du prochain événement de l’histoire. */
export async function scheduleStoryNotification(at: number | null, title: string, body: string) {
  if (Platform.OS === 'web') return;
  if (at === scheduledAt && scheduledId) return;
  try {
    if (scheduledId) await Notifications.cancelScheduledNotificationAsync(scheduledId);
    scheduledId = null;
    scheduledAt = 0;
    if (!at || at <= Date.now() + 5000 || !(await setupNotifications())) return;
    scheduledId = await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: true },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at, channelId: CHANNEL },
    });
    scheduledAt = at;
  } catch {
    // Notifications indisponibles : l’histoire avance quand même à l’ouverture de l’appli.
  }
}
