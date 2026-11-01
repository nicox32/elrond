import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { createAccount, recordBalance } from '../logic/ledger';
import { fetchLivePrices, referenceQuote } from '../logic/prices';
import type { Account, PriceQuote, Prices, Settings } from '../logic/types';
import { clearPin, setPin } from '../security';
import { clearAccount, loadAccount, loadCachedQuote, saveAccount, saveQuote } from '../storage';

interface BankContextValue {
  loading: boolean;
  account: Account | null;
  quote: PriceQuote;
  refreshing: boolean;
  /** Dernière erreur de chargement des cours, s'il y en a une. */
  priceError: string | null;
  /** Le compte est verrouillé : le code est demandé. */
  locked: boolean;
  unlock: () => void;
  refreshPrices: () => Promise<void>;
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

export function BankProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [account, setAccount] = useState<Account | null>(null);
  const [quote, setQuote] = useState<PriceQuote>(() => referenceQuote());
  const [refreshing, setRefreshing] = useState(false);
  const [priceError, setPriceError] = useState<string | null>(null);
  const [locked, setLocked] = useState(true);

  // Références pour lire l'état à jour dans les écouteurs (AppState, promesses).
  // Elles sont tenues à jour à chaque modification (persist, chargement des cours).
  const accountRef = useRef(account);
  const quoteRef = useRef(quote);
  const inFlight = useRef<Promise<void> | null>(null);

  const persist = useCallback((next: Account | null) => {
    accountRef.current = next;
    setAccount(next);
    if (next) saveAccount(next);
  }, []);

  /** Ajoute un point au graphique du solde avec les cours actuels. */
  const snapshot = useCallback(() => {
    const acc = accountRef.current;
    if (acc) persist(recordBalance(acc, quoteRef.current.prices));
  }, [persist]);

  const refreshPrices = useCallback(() => {
    if (inFlight.current) return inFlight.current;
    setRefreshing(true);
    const run = (async () => {
      try {
        const live = await fetchLivePrices();
        quoteRef.current = live;
        setQuote(live);
        setPriceError(null);
        saveQuote(live);
        snapshot();
      } catch {
        setPriceError('Impossible de charger les cours réels. Vérifie ta connexion.');
      } finally {
        setRefreshing(false);
        inFlight.current = null;
      }
    })();
    inFlight.current = run;
    return run;
  }, [snapshot]);

  // Ouverture de l'appli : compte, derniers cours connus, puis cours réels.
  useEffect(() => {
    (async () => {
      const [acc, cached] = await Promise.all([loadAccount(), loadCachedQuote()]);
      if (cached) {
        quoteRef.current = cached;
        setQuote(cached);
      }
      accountRef.current = acc;
      setAccount(acc);
      setLoading(false);
      refreshPrices();
    })();
  }, [refreshPrices]);

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
      const prices = quoteRef.current.prices;
      const next = recordBalance(op(acc, prices), prices);
      persist(next);
      return next;
    },
    [persist],
  );

  const openAccount = useCallback(
    async (holder: string, pin: string) => {
      await setPin(pin);
      persist(recordBalance(createAccount(holder), quoteRef.current.prices));
      setLocked(false);
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

  const value = useMemo<BankContextValue>(
    () => ({
      loading,
      account,
      quote,
      refreshing,
      priceError,
      locked,
      unlock: () => setLocked(false),
      refreshPrices,
      commit,
      openAccount,
      updateSettings,
      resetAccount,
    }),
    [
      loading,
      account,
      quote,
      refreshing,
      priceError,
      locked,
      refreshPrices,
      commit,
      openAccount,
      updateSettings,
      resetAccount,
    ],
  );

  return <BankContext.Provider value={value}>{children}</BankContext.Provider>;
}
