import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Platform } from 'react-native';

import { CONTACTS, contactById, FEED_AUTHORS, FEED_POOL, FEED_SEED, JOBS, START_BALANCE } from '../data/world';
import { pick, replyFor, typingDelay } from '../logic/chat';
import type { WallpaperId } from '../theme';

export type Message = { id: string; from: 'me' | 'them'; text: string; at: number };
export type Thread = { messages: Message[]; unread: number };
export type Post = { id: string; author: number | 'me'; text: string; at: number; likes: number; liked: boolean };
export type Transaction = { id: string; label: string; amount: number; at: number };
export type ActiveJob = { id: string; startedAt: number };

export type PhoneState = {
  name: string;
  wallpaper: WallpaperId;
  haptics: boolean;
  threads: Record<string, Thread>;
  posts: Post[];
  balance: number;
  transactions: Transaction[];
  activeJob: ActiveJob | null;
  jobsDone: Record<string, number>;
  newsRead: string[];
  calls: { id: string; contactId: string; at: number; seconds: number; missed: boolean }[];
};

export type Banner = { id: string; app: string; icon: string; color: string; title: string; body: string; route: string };

let counter = 0;
export const newId = () => `${Date.now().toString(36)}-${(counter++).toString(36)}`;

function initialState(now = Date.now()): PhoneState {
  const threads: Record<string, Thread> = {};
  CONTACTS.forEach((c, i) => {
    threads[c.id] = { messages: [{ id: newId(), from: 'them', text: c.opening, at: now - (i + 1) * 7 * 60_000 }], unread: 1 };
  });
  return {
    name: 'Alex',
    wallpaper: 'sunset',
    haptics: true,
    threads,
    posts: FEED_SEED.map((p) => ({ id: newId(), author: p.author, text: p.text, at: now - p.minutesAgo * 60_000, likes: p.likes, liked: false })),
    balance: START_BALANCE,
    transactions: [{ id: newId(), label: 'Ouverture du compte', amount: START_BALANCE, at: now - 86_400_000 }],
    activeJob: null,
    jobsDone: {},
    newsRead: [],
    calls: [],
  };
}

type Action =
  | { type: 'load'; state: PhoneState }
  | { type: 'reset' }
  | { type: 'message'; contactId: string; from: 'me' | 'them'; text: string; unread: boolean }
  | { type: 'readThread'; contactId: string }
  | { type: 'post'; post: Post }
  | { type: 'like'; postId: string }
  | { type: 'tickLikes' }
  | { type: 'money'; label: string; amount: number }
  | { type: 'startJob'; id: string }
  | { type: 'finishJob' }
  | { type: 'cancelJob' }
  | { type: 'readNews'; id: string }
  | { type: 'call'; contactId: string; seconds: number; missed: boolean }
  | { type: 'settings'; patch: Partial<Pick<PhoneState, 'name' | 'wallpaper' | 'haptics'>> };

function reducer(s: PhoneState, a: Action): PhoneState {
  switch (a.type) {
    case 'load':
      return a.state;
    case 'reset':
      return initialState();
    case 'message': {
      const t = s.threads[a.contactId] ?? { messages: [], unread: 0 };
      const msg: Message = { id: newId(), from: a.from, text: a.text, at: Date.now() };
      return {
        ...s,
        threads: { ...s.threads, [a.contactId]: { messages: [...t.messages, msg].slice(-200), unread: a.unread ? t.unread + 1 : t.unread } },
      };
    }
    case 'readThread': {
      const t = s.threads[a.contactId];
      if (!t || t.unread === 0) return s;
      return { ...s, threads: { ...s.threads, [a.contactId]: { ...t, unread: 0 } } };
    }
    case 'post':
      return { ...s, posts: [a.post, ...s.posts].slice(0, 100) };
    case 'like':
      return {
        ...s,
        posts: s.posts.map((p) => (p.id === a.postId ? { ...p, liked: !p.liked, likes: p.likes + (p.liked ? -1 : 1) } : p)),
      };
    case 'tickLikes': {
      // Les publications récentes du joueur gagnent des likes petit à petit.
      const now = Date.now();
      let changed = false;
      const posts = s.posts.map((p) => {
        if (p.author !== 'me' || now - p.at > 10 * 60_000 || Math.random() > 0.5) return p;
        changed = true;
        return { ...p, likes: p.likes + 1 + Math.floor(Math.random() * 6) };
      });
      return changed ? { ...s, posts } : s;
    }
    case 'money':
      return {
        ...s,
        balance: s.balance + a.amount,
        transactions: [{ id: newId(), label: a.label, amount: a.amount, at: Date.now() }, ...s.transactions].slice(0, 100),
      };
    case 'startJob':
      return s.activeJob ? s : { ...s, activeJob: { id: a.id, startedAt: Date.now() } };
    case 'finishJob': {
      if (!s.activeJob) return s;
      const job = JOBS.find((j) => j.id === s.activeJob!.id);
      if (!job) return { ...s, activeJob: null };
      return {
        ...reducer(s, { type: 'money', label: `Boulot : ${job.title}`, amount: job.reward }),
        activeJob: null,
        jobsDone: { ...s.jobsDone, [job.id]: (s.jobsDone[job.id] ?? 0) + 1 },
      };
    }
    case 'cancelJob':
      return { ...s, activeJob: null };
    case 'readNews':
      return s.newsRead.includes(a.id) ? s : { ...s, newsRead: [...s.newsRead, a.id] };
    case 'call':
      return { ...s, calls: [{ id: newId(), contactId: a.contactId, at: Date.now(), seconds: a.seconds, missed: a.missed }, ...s.calls].slice(0, 50) };
    case 'settings':
      return { ...s, ...a.patch };
  }
}

const STORAGE_KEY = 'neoncell:v1';

type Ctx = {
  state: PhoneState;
  ready: boolean;
  unlocked: boolean;
  unlock: () => void;
  lock: () => void;
  typing: Record<string, boolean>;
  banner: Banner | null;
  dismissBanner: () => void;
  /** Conversation affichée à l’écran : ses messages ne comptent pas comme non lus. */
  setOpenThread: (id: string | null) => void;
  /** Un appel est à l’écran : pas d’appel entrant par-dessus. */
  setInCall: (v: boolean) => void;
  sendMessage: (contactId: string, text: string) => void;
  readThread: (contactId: string) => void;
  publish: (text: string) => void;
  like: (postId: string) => void;
  transfer: (contactId: string, amount: number) => boolean;
  startJob: (id: string) => void;
  cancelJob: () => void;
  readNews: (id: string) => void;
  logCall: (contactId: string, seconds: number, missed?: boolean) => void;
  updateSettings: (patch: Partial<Pick<PhoneState, 'name' | 'wallpaper' | 'haptics'>>) => void;
  reset: () => void;
  buzz: (kind?: 'light' | 'success' | 'notify') => void;
};

const PhoneContext = createContext<Ctx | null>(null);

export function PhoneProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, () => initialState());
  const [ready, setReady] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [typing, setTyping] = useState<Record<string, boolean>>({});
  const [banner, setBanner] = useState<Banner | null>(null);
  const openThread = useRef<string | null>(null);
  const inCall = useRef(false);
  const stateRef = useRef(state);
  const unlockedRef = useRef(unlocked);
  useEffect(() => {
    stateRef.current = state;
    unlockedRef.current = unlocked;
  }, [state, unlocked]);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const later = useCallback((ms: number, fn: () => void) => {
    const t = setTimeout(() => {
      timers.current = timers.current.filter((x) => x !== t);
      fn();
    }, ms);
    timers.current.push(t);
  }, []);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  // Chargement puis sauvegarde (regroupée) de l’état du téléphone.
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) dispatch({ type: 'load', state: { ...initialState(), ...(JSON.parse(raw) as PhoneState) } });
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => {
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch(() => {});
    }, 400);
    return () => clearTimeout(t);
  }, [state, ready]);

  const buzz = useCallback((kind: 'light' | 'success' | 'notify' = 'light') => {
    if (!stateRef.current.haptics || Platform.OS === 'web') return;
    const p =
      kind === 'success'
        ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        : kind === 'notify'
          ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
          : Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    p.catch(() => {});
  }, []);

  const notify = useCallback(
    (b: Omit<Banner, 'id'>) => {
      setBanner({ ...b, id: newId() });
      buzz('notify');
    },
    [buzz],
  );

  /** Message reçu d’un contact : non lu et notifié, sauf si la conversation est ouverte. */
  const receive = useCallback(
    (contactId: string, text: string) => {
      const c = contactById(contactId);
      const isOpen = openThread.current === contactId;
      dispatch({ type: 'message', contactId, from: 'them', text, unread: !isOpen });
      if (!isOpen && c) {
        notify({ app: 'Messages', icon: '💬', color: '#3DDC97', title: c.name, body: text, route: `/messages/${contactId}` });
      } else if (isOpen) {
        buzz();
      }
    },
    [notify, buzz],
  );

  const sendMessage = useCallback(
    (contactId: string, text: string) => {
      const c = contactById(contactId);
      if (!c || !text.trim()) return;
      dispatch({ type: 'message', contactId, from: 'me', text: text.trim(), unread: false });
      buzz();
      const reply = replyFor(c, text);
      later(500 + Math.random() * 700, () => setTyping((t) => ({ ...t, [contactId]: true })));
      later(1200 + typingDelay(reply), () => {
        setTyping((t) => ({ ...t, [contactId]: false }));
        receive(contactId, reply);
      });
    },
    [buzz, later, receive],
  );

  const publish = useCallback(
    (text: string) => {
      if (!text.trim()) return;
      dispatch({ type: 'post', post: { id: newId(), author: 'me', text: text.trim(), at: Date.now(), likes: 0, liked: false } });
      buzz('success');
      // Un ami réagit à la publication en message privé.
      const friend = pick(['jade', 'rico', 'maman']);
      const comments: Record<string, string[]> = {
        jade: ['Trop bien ta publi 🔥', 'Je like direct !'],
        rico: ['Haha je valide 🤙', 'Légende.'],
        maman: ['C’est toi qui as écrit ça ? Fais attention à ce que tu publies.', 'J’ai mis un j’aime, c’est bien comme ça ?'],
      };
      later(15_000 + Math.random() * 15_000, () => receive(friend, pick(comments[friend])));
    },
    [buzz, later, receive],
  );

  const transfer = useCallback(
    (contactId: string, amount: number) => {
      const c = contactById(contactId);
      if (!c || !(amount > 0) || amount > stateRef.current.balance) return false;
      dispatch({ type: 'money', label: `Virement à ${c.name}`, amount: -amount });
      buzz('success');
      const thanks: Record<string, string> = {
        maman: 'Pourquoi tu m’envoies de l’argent ? Garde-le pour toi ! Bon… merci ❤️',
        rico: `Reçu ${amount} $, merci frérot ! Je t’offre une vidange.`,
        jade: 'Oh merci !! Je t’offre un verre samedi 🍹',
        vince: 'Ah ! Mon premier investisseur ! Tu ne le regretteras pas. Sans doute.',
        agence: 'Nous avons bien reçu votre paiement. Ce n’était pas nécessaire.',
        inconnu: 'Merci. Maintenant, achète-toi une vraie pizza.',
      };
      later(4000, () => receive(contactId, thanks[contactId] ?? 'Merci !'));
      return true;
    },
    [buzz, later, receive],
  );

  // Horloge de la simulation : fin des boulots, likes, messages et publications spontanés.
  useEffect(() => {
    if (!ready) return;
    let nextEvent = Date.now() + 25_000;
    const id = setInterval(() => {
      const s = stateRef.current;
      const now = Date.now();
      if (s.activeJob) {
        const job = JOBS.find((j) => j.id === s.activeJob!.id);
        if (job && now - s.activeJob.startedAt >= job.durationSec * 1000) {
          dispatch({ type: 'finishJob' });
          notify({ app: 'Banque Flamant', icon: '🦩', color: '#FF8FB1', title: `+${job.reward} $ reçus`, body: `${job.client} a payé « ${job.title} ».`, route: '/bank' });
        }
      }
      if (Math.random() < 0.3) dispatch({ type: 'tickLikes' });
      if (unlockedRef.current && now >= nextEvent) {
        nextEvent = now + 40_000 + Math.random() * 50_000;
        const roll = Math.random();
        if (roll < 0.12 && !inCall.current) {
          // Appel entrant d’un proche (jamais du numéro masqué… ou presque).
          const c = pick(CONTACTS.filter((x) => x.id !== 'agence'));
          router.push(`/call/${c.id}?incoming=1`);
        } else if (roll < 0.65) {
          const c = pick(CONTACTS);
          receive(c.id, pick(c.spontaneous));
        } else {
          const p = pick(FEED_POOL);
          const a = FEED_AUTHORS[p.author];
          dispatch({ type: 'post', post: { id: newId(), author: p.author, text: p.text, at: now, likes: Math.floor(Math.random() * 300), liked: false } });
          notify({ app: 'Palmfeed', icon: '🌴', color: '#FF3D8B', title: a.name, body: p.text, route: '/feed' });
        }
      }
    }, 1000);
    return () => clearInterval(id);
  }, [ready, notify, receive]);

  const unlock = useCallback(() => setUnlocked(true), []);
  const lock = useCallback(() => setUnlocked(false), []);
  const setOpenThread = useCallback((id: string | null) => {
    openThread.current = id;
  }, []);
  const setInCall = useCallback((v: boolean) => {
    inCall.current = v;
  }, []);
  const readThread = useCallback((contactId: string) => dispatch({ type: 'readThread', contactId }), []);
  const readNews = useCallback((id: string) => dispatch({ type: 'readNews', id }), []);
  const logCall = useCallback(
    (contactId: string, seconds: number, missed = false) => dispatch({ type: 'call', contactId, seconds, missed }),
    [],
  );

  const value = useMemo<Ctx>(
    () => ({
      state,
      ready,
      unlocked,
      unlock,
      lock,
      typing,
      banner,
      dismissBanner: () => setBanner(null),
      setOpenThread,
      setInCall,
      sendMessage,
      readThread,
      publish,
      like: (postId) => {
        dispatch({ type: 'like', postId });
        buzz();
      },
      transfer,
      startJob: (id) => {
        dispatch({ type: 'startJob', id });
        buzz('success');
      },
      cancelJob: () => dispatch({ type: 'cancelJob' }),
      readNews,
      logCall,
      updateSettings: (patch) => dispatch({ type: 'settings', patch }),
      reset: () => {
        timers.current.forEach(clearTimeout);
        timers.current = [];
        setTyping({});
        setBanner(null);
        dispatch({ type: 'reset' });
      },
      buzz,
    }),
    [state, ready, unlocked, typing, banner, sendMessage, publish, transfer, buzz, unlock, lock, setOpenThread, setInCall, readThread, readNews, logCall],
  );

  return <PhoneContext.Provider value={value}>{children}</PhoneContext.Provider>;
}

export function usePhone() {
  const ctx = useContext(PhoneContext);
  if (!ctx) throw new Error('usePhone doit être utilisé dans <PhoneProvider>.');
  return ctx;
}

export function unreadMessages(s: PhoneState) {
  return Object.values(s.threads).reduce((n, t) => n + t.unread, 0);
}

/** Heure actuelle, rafraîchie toutes les `ms` millisecondes. */
export function useNow(ms = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}
