import { AndroidImportance } from 'expo-notifications';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

/** Notifications locales sur téléphone (Android / iOS). La version web est dans notifications.web.ts. */

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const CHANNEL = 'alertes-prix';
let channelReady: Promise<unknown> | null = null;

function ensureChannel() {
  if (Platform.OS !== 'android') return Promise.resolve();
  channelReady ??= Notifications.setNotificationChannelAsync(CHANNEL, {
    name: 'Alertes de prix',
    importance: AndroidImportance.HIGH,
  });
  return channelReady;
}

export type NotificationPermission = 'granted' | 'denied' | 'default' | 'unsupported';

export async function notificationPermission(): Promise<NotificationPermission> {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    return status === 'granted' ? 'granted' : status === 'denied' ? 'denied' : 'default';
  } catch {
    return 'unsupported';
  }
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  try {
    await ensureChannel();
    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted' ? 'granted' : 'denied';
  } catch {
    return 'unsupported';
  }
}

export async function notify(title: string, body: string): Promise<void> {
  try {
    if ((await notificationPermission()) !== 'granted') return;
    await ensureChannel();
    await Notifications.scheduleNotificationAsync({
      content: { title, body, ...(Platform.OS === 'android' ? { channelId: CHANNEL } : {}) },
      trigger: null,
    });
  } catch {
    // Une notification manquée ne doit pas casser l'appli : l'alerte reste visible dans l'historique.
  }
}
