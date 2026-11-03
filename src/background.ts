import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';

import { addEvents, addHourlyPoint, evaluateAlerts } from './logic/alerts';
import { addPricePoint } from './logic/priceHistory';
import { fetchLivePrices } from './logic/prices';
import { notify } from './notifications';
import {
  loadAccount,
  loadHourlyHistory,
  loadPriceHistory,
  saveAccount,
  saveHourlyHistory,
  savePriceHistory,
  saveQuote,
} from './storage';

/**
 * Vérification des cours en arrière-plan, appli fermée : Android réveille l'appli environ toutes les 15 minutes
 * (parfois plus, selon la batterie), elle relève les cours, évalue vos alertes et vous notifie elle-même.
 */
export const PRICE_TASK = 'orvia-verification-cours';

TaskManager.defineTask(PRICE_TASK, async () => {
  try {
    const account = await loadAccount();
    if (!account?.alerts?.some((a) => a.enabled)) return BackgroundTask.BackgroundTaskResult.Success;
    const [live, hourlyBefore, history] = await Promise.all([
      fetchLivePrices(),
      loadHourlyHistory(),
      loadPriceHistory(),
    ]);
    const hourly = addHourlyPoint(hourlyBefore, live);
    await Promise.all([saveQuote(live), saveHourlyHistory(hourly), savePriceHistory(addPricePoint(history, live))]);
    const r = evaluateAlerts(account.alerts, live, hourly);
    if (r.alerts !== account.alerts || r.events.length) {
      await saveAccount({ ...account, alerts: r.alerts, alertEvents: addEvents(account.alertEvents ?? [], r.events) });
      for (const e of r.events) await notify(e.title, e.body);
    }
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

/** Inscrit la vérification périodique (une seule fois suffit, Android la garde). */
export async function registerBackgroundChecks(): Promise<boolean> {
  try {
    if ((await BackgroundTask.getStatusAsync()) !== BackgroundTask.BackgroundTaskStatus.Available) return false;
    if (!(await TaskManager.isTaskRegisteredAsync(PRICE_TASK))) {
      await BackgroundTask.registerTaskAsync(PRICE_TASK, { minimumInterval: 15 });
    }
    return true;
  } catch {
    return false;
  }
}

export async function backgroundChecksActive(): Promise<boolean> {
  try {
    return (
      (await BackgroundTask.getStatusAsync()) === BackgroundTask.BackgroundTaskStatus.Available &&
      (await TaskManager.isTaskRegisteredAsync(PRICE_TASK))
    );
  } catch {
    return false;
  }
}
