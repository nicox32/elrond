import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';

import { addEvents, addHourlyPoint, evaluateAlerts } from './logic/alerts';
import { applyDormancy, recordBalance } from './logic/ledger';
import { marketStatus } from './logic/market';
import { giftDue, runGiftPlans } from './logic/childGiftPlan';
import { runDipBot } from './logic/dipBot';
import { amountPerRun, dueRuns, planNotice, runPlan } from './logic/plan';
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
    const stored = await loadAccount();
    if (!stored) return BackgroundTask.BackgroundTaskResult.Success;
    let account = stored;
    // Achats programmés dus, même appli fermée (au dernier cours réel).
    if (account.plan && dueRuns(account.plan).length) {
      const live = await fetchLivePrices();
      const prices = { gold: live.prices.gold, silver: live.prices.silver, platinum: live.prices.platinum };
      const r = runPlan(applyDormancy(account, prices), prices);
      account = recordBalance(r.account, prices);
      await Promise.all([saveAccount(account), saveQuote(live)]);
      const n = planNotice(r, amountPerRun(stored.plan!));
      if (n) await notify(n.title, n.body);
    }
    // Dons mensuels aux enfants dus : rappel ou don automatique, même appli fermée.
    if (account.children.some((c) => !c.transferredAt && giftDue(c.giftPlan))) {
      const live = await fetchLivePrices();
      const prices = { gold: live.prices.gold, silver: live.prices.silver, platinum: live.prices.platinum };
      const g = runGiftPlans(applyDormancy(account, prices), prices);
      account = recordBalance(g.account, prices);
      await Promise.all([saveAccount(account), saveQuote(live)]);
      for (const n of g.notices) await notify(n.title, n.body);
    }
    const wantsAlerts = !!account.alerts?.some((a) => a.enabled);
    if (!wantsAlerts && !account.dipBot?.active) return BackgroundTask.BackgroundTaskResult.Success;
    // Marché fermé : les cours ne bougent pas, inutile de réveiller le réseau (économie de batterie).
    if (!marketStatus().open) return BackgroundTask.BackgroundTaskResult.Success;
    const [live, hourlyBefore, history] = await Promise.all([
      fetchLivePrices(),
      loadHourlyHistory(),
      loadPriceHistory(),
    ]);
    const hourly = addHourlyPoint(hourlyBefore, live);
    await Promise.all([saveQuote(live), saveHourlyHistory(hourly), savePriceHistory(addPricePoint(history, live))]);
    // Bot d'achat sur baisse, avec la moyenne 30 jours des relevés horaires.
    if (account.dipBot?.active) {
      const prices = { gold: live.prices.gold, silver: live.prices.silver, platinum: live.prices.platinum };
      const d = runDipBot(applyDormancy(account, prices), prices, hourly);
      if (d.account !== account) {
        account = recordBalance(d.account, prices);
        await saveAccount(account);
      }
      for (const n of d.notices) await notify(n.title, n.body);
    }
    if (!wantsAlerts) return BackgroundTask.BackgroundTaskResult.Success;
    const r = evaluateAlerts(account.alerts!, live, hourly);
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
