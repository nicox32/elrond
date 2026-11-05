import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { applyDormancy, createAccount, recordBalance } from '../logic/ledger';
import { addEvents, addHourlyPoint, evaluateAlerts } from '../logic/alerts';
import { addPricePoint, type PricePoint } from '../logic/priceHistory';
import { notify } from '../notifications';
import { marketStatus } from '../logic/market';
import { runGiftPlans } from '../logic/childGiftPlan';
import { runDipBot } from '../logic/dipBot';
import { runDeclarationReminders } from '../logic/giftRecap';
import { isValidTopic, publishNtfy } from '../logic/ntfyClient';
import { amountPerRun, planNotice, runPlan } from '../logic/plan';
import { fetchLivePrices, referenceQuote } from '../logic/prices';
import type { Account, PriceQuote, Prices, Settings } from '../logic/types';
import { clearPin, hasPin, setPin } from '../security';
import {
  clearAccount,
  loadAccount,
  loadCachedQuote,
  loadHourlyHistory,
  loadPriceHistory,
  saveAccount,
  saveHourlyHistory,
  savePriceHistory,
  saveQuote,
} from '../storage';

/** Actualisation automatique des cours tant que l'appli est à l'écran. */
export const LIVE_REFRESH_MS = 30_000;
/** Marché fermé (nuit, week-end) : les cours ne bougent pas, une actualisation toutes les 10 minutes suffit. */
export const CLOSED_REFRESH_MS = 10 * 60_000;

/** Pendant l'actualisation automatique, un point du graphique du solde au plus tous les quarts d'heure. */
const PERIODIC_BALANCE_MS = 15 * 60_000;

interface BankContextValue {
  loading: boolean;
  account: Account | null;
  quote: PriceQuote;
  /** Relevés de cours réels des dernières 24 h. */
  priceHistory: PricePoint[];
  /** Relevés horaires des 35 derniers jours. */
  hourlyHistory: PricePoint[];
  /** Modifie le compte sans opération (alertes, réglages…). */
  updateAccount: (fn: (account: Account) => Account) => void;
  refreshing: boolean;
  /** Dernière erreur de chargement des cours, s'il y en a une. */
  priceError: string | null;
  /** Le compte est verrouillé : le code est demandé. */
  locked: boolean;
  /** Compte repris d'une ancienne version, sans code d'accès : il faut en choisir un. */
  needsPin: boolean;
  unlock: () => void;
  /** Crée le code d'accès d'un compte existant qui n'en a pas encore. */
  createPin: (pin: string) => Promise<void>;
  /** `periodic` : actualisation automatique, discrète (pas d'indicateur de chargement). */
  refreshPrices: (periodic?: boolean) => Promise<void>;
  /** Applique une opération au compte avec les cours actuels. Lève une LedgerError si elle est refusée. */
  commit: (op: (account: Account, prices: Prices) => Account) => Account;
  openAccount: (holder: string, pin: string) => Promise<void>;
  updateSettings: (settings: Partial<Settings>) => void;
  resetAccount: () => Promise<void>;
}

const BankContext = createContext<BankContextValue | null>(null);

export function useBank(): BankContextValue {
  const ctx = useContext(BankContext);
  if (!ctx) throw new Error('useBank doit être utilisé dans <BankProvider>.');
  return ctx;
}

/** Le compte, une fois ouvert (à utiliser dans les écrans protégés par le code). */
export function useAccount(): Account {
  const { account } = useBank();
  if (!account) throw new Error('Aucun compte ouvert.');
  return account;
}

const spotOnly = (p: Prices): Prices => ({ gold: p.gold, silver: p.silver, platinum: p.platinum });

export function BankProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [account, setAccount] = useState<Account | null>(null);
  const [quote, setQuote] = useState<PriceQuote>(() => referenceQuote());
  const [priceHistory, setPriceHistory] = useState<PricePoint[]>([]);
  const [hourlyHistory, setHourlyHistory] = useState<PricePoint[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [priceError, setPriceError] = useState<string | null>(null);
  const [locked, setLocked] = useState(true);
  const [needsPin, setNeedsPin] = useState(false);

  // Références pour lire l'état à jour dans les écouteurs (AppState, promesses).
  // Elles sont tenues à jour à chaque modification (persist, chargement des cours).
  const accountRef = useRef(account);
  const quoteRef = useRef(quote);
  const inFlight = useRef<Promise<void> | null>(null);
  const historyRef = useRef<PricePoint[]>([]);
  const hourlyRef = useRef<PricePoint[]>([]);

  /** Cours actuels (les anciens cours enregistrés peuvent contenir le Gold Oria arrêté : on ne garde que les métaux). */
  const pricesNow = useCallback((q: PriceQuote = quoteRef.current) => spotOnly(q.prices), []);

  const persist = useCallback((next: Account | null) => {
    accountRef.current = next;
    setAccount(next);
    if (next) saveAccount(next);
  }, []);

  /** Ajoute un point au graphique du solde avec les cours actuels. */
  const snapshot = useCallback(() => {
    const acc = accountRef.current;
    if (acc) persist(recordBalance(acc, pricesNow()));
  }, [persist, pricesNow]);

  const refreshPrices = useCallback(
    (periodic = false) => {
      if (inFlight.current) return inFlight.current;
      if (!periodic) setRefreshing(true);
      const run = (async () => {
        try {
          const live = await fetchLivePrices();
          quoteRef.current = live;
          setQuote(live);
          setPriceError(null);
          saveQuote(live);
          const history = addPricePoint(historyRef.current, live);
          historyRef.current = history;
          setPriceHistory(history);
          savePriceHistory(history);
          const hourly = addHourlyPoint(hourlyRef.current, live);
          hourlyRef.current = hourly;
          setHourlyHistory(hourly);
          saveHourlyHistory(hourly);
          // Alertes de prix : évaluées à chaque cours réel, notifiées une fois.
          const acc = accountRef.current;
          if (acc?.alerts?.length) {
            const r = evaluateAlerts(acc.alerts, live, hourly);
            if (r.alerts !== acc.alerts || r.events.length) {
              persist({ ...acc, alerts: r.alerts, alertEvents: addEvents(acc.alertEvents ?? [], r.events) });
              r.events.forEach((e) => notify(e.title, e.body));
            }
          }
          // Achats programmés dus : passés au cours réel qui vient d'arriver.
          const before = accountRef.current;
          if (before?.plan?.active) {
            const prices = spotOnly(live.prices);
            const r = runPlan(applyDormancy(before, prices), prices);
            if (r.done || r.skipped) {
              persist(recordBalance(r.account, prices));
              const n = planNotice(r, amountPerRun(before.plan));
              if (n) notify(n.title, n.body);
            }
          }
          // Bot d'achat sur baisse : au cours réel qui vient d'arriver, avec les relevés horaires (moyenne 30 j).
          const forDip = accountRef.current;
          if (forDip?.dipBot?.active) {
            const prices = spotOnly(live.prices);
            const d = runDipBot(applyDormancy(forDip, prices), prices, hourly);
            if (d.account.transactions.length !== forDip.transactions.length || d.notices.length) {
              persist(recordBalance(d.account, prices));
            } else if (d.account.dipBot !== forDip.dipBot) {
              persist(d.account);
            }
            d.notices.forEach((n) => {
              notify(n.title, n.body);
              if (forDip.dipBot?.ntfy !== false && isValidTopic(forDip.ntfyTopic)) {
                publishNtfy(forDip.ntfyTopic, n).catch(() => {});
              }
            });
          }
          // Dons mensuels aux enfants : rappel le jour prévu, ou don automatique.
          const forGifts = accountRef.current;
          if (forGifts?.children.some((c) => c.giftPlan?.active)) {
            const prices = spotOnly(live.prices);
            const g = runGiftPlans(forGifts, prices);
            if (g.account !== forGifts) persist(recordBalance(g.account, prices));
            g.notices.forEach((n) => notify(n.title, n.body));
          }
          // Rappel trimestriel : dons du trimestre précédent à déclarer (formulaire 2735).
          const forDecl = accountRef.current;
          if (forDecl?.children.length) {
            const r = runDeclarationReminders(forDecl);
            if (r.account !== forDecl) persist(r.account);
            r.notices.forEach((n) => notify(n.title, n.body));
          }
          const last = accountRef.current?.balanceHistory.at(-1);
          if (!periodic || !last || Date.now() - new Date(last.date).getTime() >= PERIODIC_BALANCE_MS) snapshot();
        } catch {
          setPriceError('Impossible de charger les cours réels. Vérifiez votre connexion.');
        } finally {
          setRefreshing(false);
          inFlight.current = null;
        }
      })();
      inFlight.current = run;
      return run;
    },
    [snapshot, persist],
  );

  // Ouverture de l'appli : compte, derniers cours connus, puis cours réels.
  useEffect(() => {
    (async () => {
      const [acc, cached, pinSet, history, hourly] = await Promise.all([
        loadAccount(),
        loadCachedQuote(),
        hasPin(),
        loadPriceHistory(),
        loadHourlyHistory(),
      ]);
      historyRef.current = history;
      setPriceHistory(history);
      hourlyRef.current = hourly;
      setHourlyHistory(hourly);
      if (cached) {
        quoteRef.current = cached;
        setQuote(cached);
      }
      // Ouverture : prélève les frais d'oxydation dus depuis la dernière visite.
      const base = (cached ?? quoteRef.current).prices;
      const prices = spotOnly(base);
      const charged = acc ? applyDormancy(acc, prices) : null;
      if (charged && charged !== acc) saveAccount(charged);
      accountRef.current = charged;
      setAccount(charged);
      setNeedsPin(!!acc && !pinSet);
      setLoading(false);
      refreshPrices();
    })();
  }, [refreshPrices]);

  // Cours en direct : actualisation toutes les 30 s tant que l'appli est au premier plan (10 min marché fermé).
  useEffect(() => {
    if (loading) return;
    let timer: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (!timer) {
        let last = 0;
        timer = setInterval(() => {
          const every = marketStatus().open ? LIVE_REFRESH_MS : CLOSED_REFRESH_MS;
          if (Date.now() - last < every - 1000) return;
          last = Date.now();
          refreshPrices(true);
        }, LIVE_REFRESH_MS);
      }
    };
    const stop = () => {
      if (timer) clearInterval(timer);
      timer = null;
    };
    if (AppState.currentState !== 'background') start();
    const sub = AppState.addEventListener('change', (state) => (state === 'active' ? start() : stop()));
    return () => {
      stop();
      sub.remove();
    };
  }, [loading, refreshPrices]);

  // Retour dans l'appli : nouveaux cours et code demandé. Fermeture : on enregistre le solde.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        refreshPrices();
      } else if (state === 'background') {
        setLocked(true);
        snapshot();
        refreshPrices();
      }
    });
    return () => sub.remove();
  }, [refreshPrices, snapshot]);

  const commit = useCallback<BankContextValue['commit']>(
    (op) => {
      const acc = accountRef.current;
      if (!acc) throw new Error('Aucun compte ouvert.');
      const prices = pricesNow();
      // Les frais d'oxydation dus sont prélevés avant l'opération (qui, elle, remet le compteur à zéro).
      const next = recordBalance(op(applyDormancy(acc, prices), prices), prices);
      persist(next);
      return next;
    },
    [persist, pricesNow],
  );

  const openAccount = useCallback(
    async (holder: string, pin: string) => {
      await setPin(pin);
      persist(recordBalance(createAccount(holder), pricesNow()));
      setNeedsPin(false);
      setLocked(false);
    },
    [persist, pricesNow],
  );

  const createPin = useCallback(async (pin: string) => {
    await setPin(pin);
    setNeedsPin(false);
    setLocked(false);
  }, []);

  const updateAccount = useCallback(
    (fn: (account: Account) => Account) => {
      const acc = accountRef.current;
      if (acc) persist(fn(acc));
    },
    [persist],
  );

  const updateSettings = useCallback(
    (settings: Partial<Settings>) => {
      const acc = accountRef.current;
      if (acc) persist({ ...acc, settings: { ...acc.settings, ...settings } });
    },
    [persist],
  );

  const resetAccount = useCallback(async () => {
    await Promise.all([clearAccount(), clearPin()]);
    persist(null);
    setLocked(true);
  }, [persist]);

  const pricedQuote = useMemo(() => ({ ...quote, prices: spotOnly(quote.prices) }), [quote]);

  const value = useMemo<BankContextValue>(
    () => ({
      loading,
      account,
      quote: pricedQuote,
      priceHistory,
      hourlyHistory,
      updateAccount,
      refreshing,
      priceError,
      locked,
      needsPin,
      unlock: () => setLocked(false),
      createPin,
      refreshPrices,
      commit,
      openAccount,
      updateSettings,
      resetAccount,
    }),
    [
      loading,
      account,
      pricedQuote,
      priceHistory,
      hourlyHistory,
      updateAccount,
      refreshing,
      priceError,
      locked,
      needsPin,
      createPin,
      refreshPrices,
      commit,
      openAccount,
      updateSettings,
      resetAccount,
    ],
  );

  return <BankContext.Provider value={value}>{children}</BankContext.Provider>;
}
