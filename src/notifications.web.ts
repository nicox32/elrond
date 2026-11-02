/** Notifications dans le navigateur (version web installée ou ouverte dans Chrome). */

export type NotificationPermission = 'granted' | 'denied' | 'default' | 'unsupported';

const supported = () => typeof window !== 'undefined' && 'Notification' in window;

export async function notificationPermission(): Promise<NotificationPermission> {
  if (!supported()) return 'unsupported';
  return Notification.permission as NotificationPermission;
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!supported()) return 'unsupported';
  try {
    return (await Notification.requestPermission()) as NotificationPermission;
  } catch {
    return 'denied';
  }
}

export async function notify(title: string, body: string): Promise<void> {
  if (!supported() || Notification.permission !== 'granted') return;
  const base = window.location.pathname.startsWith('/elrond') ? '/elrond/' : '/';
  const options = { body, icon: `${base}icons/icon-192.png`, badge: `${base}icons/icon-192.png`, tag: title };
  try {
    // Sur Android, Chrome n'affiche les notifications que via le service worker.
    const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration(base) : undefined;
    if (reg) await reg.showNotification(title, options);
    else new Notification(title, options);
  } catch {
    // L'alerte reste visible dans l'historique de l'appli.
  }
}
