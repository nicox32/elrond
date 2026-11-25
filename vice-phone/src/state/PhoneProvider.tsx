import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Platform } from 'react-native';

import { CONTACTS, contactById, FEED_AUTHORS, FEED_POOL, FEED_SEED, JOBS, START_BALANCE } from '../data/world';
import { CHAPTERS, ENDINGS, STORY_NUDGE, STORY_REPLIES } from '../data/story';
import { pick, replyFor, typingDelay } from '../logic/chat';
import { playSound, setSoundEnabled } from '../logic/sfx';
import { scheduleStoryNotification, setupNotifications } from '../logic/notifications';
import { callDone, chooseStory, migrateStory, newStory, nextEvent, type Out, type Pace, restartStory, runStory, startMission, type StoryState } from '../logic/story';
import type { FilterId } from '../components/FilteredPhoto';
import type { WallpaperId } from '../theme';

export type Message = { id: string; from: 'me' | 'them'; text: string; at: number };
export type Thread = { messages: Message[]; unread: number };
export type PhotoRef = { uri: string; filter: FilterId };
export type Photo = PhotoRef & { id: string; at: number };
export type Post = { id: string; author: number | 'me'; text: string; at: number; likes: number; liked: boolean; image?: PhotoRef };
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
  photos: Photo[];
  sound: boolean;
  story: StoryState;
};

export type Banner = { id: string; app: string; icon: string; color: string; title: string; body: string; route: string };

let counter = 0;
export const newId = () => `${Date.now().toString(36)}-${(counter++).toString(36)}`;

function initialState(now = Date.now()): PhoneState {
  const threads: Record<string, Thread> = {};
  CONTACTS.filter((c) => !c.story).forEach((c, i) => {
    threads[c.id] = { messages: [{ id: newId(), from: 'them', text: c.opening, at: now - (i + 1) * 7 * 60_000 }], unread: 1 };
  });
  return {
    name: 'Alex',
    wallpaper: 'auto',
    haptics: true,
    sound: true,
    threads,
    posts: FEED_SEED.map((p) => ({ id: newId(), author: p.author, text: p.text, at: now - p.minutesAgo * 60_000, likes: p.likes, liked: false })),
    balance: START_BALANCE,
    transactions: [{ id: newId(), label: 'Ouverture du compte', amount: START_BALANCE, at: now - 86_400_000 }],
    activeJob: null,
    jobsDone: {},
    newsRead: [],
    calls: [],
    photos: [],
    story: newStory(),
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
  | { type: 'addPhoto'; photo: Photo }
  | { type: 'photoFilter'; id: string; filter: FilterId }
  | { type: 'deletePhoto'; id: string }
  | { type: 'story'; story: StoryState }
  | { type: 'settings'; patch: Partial<Pick<PhoneState, 'name' | 'wallpaper' | 'haptics' | 'sound'>> };

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
    case 'addPhoto':
      return { ...s, photos: [a.photo, ...s.photos].slice(0, 60) };
    case 'photoFilter':
      return { ...s, photos: s.photos.map((p) => (p.id === a.id ? { ...p, filter: a.filter } : p)) };
    case 'deletePhoto':
      return { ...s, photos: s.photos.filter((p) => p.id !== a.id) };
    case 'story':
      return { ...s, story: a.story };
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
  publish: (text: string, image?: PhotoRef) => void;
  addPhoto: (uri: string, filter: FilterId) => string;
  setPhotoFilter: (id: string, filter: FilterId) => void;
  deletePhoto: (id: string) => void;
  like: (postId: string) => void;
  transfer: (contactId: string, amount: number) => boolean;
  startJob: (id: string) => void;
  cancelJob: () => void;
  readNews: (id: string) => void;
  logCall: (contactId: string, seconds: number, missed?: boolean) => void;
  updateSettings: (patch: Partial<Pick<PhoneState, 'name' | 'wallpaper' | 'haptics' | 'sound'>>) => void;
  storyChoose: (index: number) => void;
  storyStartMission: () => void;
  storyCallDone: (answered: boolean) => void;
  storyRestart: () => void;
  storySetPace: (pace: Pace) => void;
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
        if (!raw) return;
        const saved = JSON.parse(raw) as PhoneState;
        // Ancien scénario : l’histoire repart du début, et les conversations des anciens personnages disparaissent.
        const threads = Object.fromEntries(Object.entries(saved.threads ?? {}).filter(([id]) => contactById(id)));
        const story = migrateStory(saved.story);
        if (story !== saved.story) for (const c of CONTACTS) if (c.story) delete threads[c.id];
        dispatch({ type: 'load', state: { ...initialState(), ...saved, threads, story } });
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
      playSound('notif');
      buzz('notify');
    },
    [buzz],
  );

  /** Message reçu d’un contact : non lu et notifié, sauf si la conversation est ouverte. */
  const receive = useCallback(
    (contactId: string, text: string) => {
      const c = contactById(contactId);
      const isOpen = openThread.current === contactId;
      const body = text.replaceAll('{name}', stateRef.current.name);
      dispatch({ type: 'message', contactId, from: 'them', text: body, unread: !isOpen });
      if (!isOpen && c) {
        notify({ app: 'Messages', icon: 'chatbubbles', color: '#2DE2E6', title: c.name, body, route: `/messages/${contactId}` });
      } else if (isOpen) {
        playSound('notif');
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
      playSound('sent');
      buzz();
      // Personnage de l’histoire : réponse dans le ton du chapitre en cours (ou rappel s’il attend un choix).
      const st = stateRef.current.story;
      const pool = c.story ? STORY_REPLIES[c.id]?.[st.ending ? 6 : st.chapter] : undefined;
      const reply = c.story && st.choice?.from === c.id ? STORY_NUDGE[c.id] ?? replyFor(c, text) : pool ? pick(pool) : replyFor(c, text);
      later(500 + Math.random() * 700, () => setTyping((t) => ({ ...t, [contactId]: true })));
      later(1200 + typingDelay(reply), () => {
        setTyping((t) => ({ ...t, [contactId]: false }));
        receive(contactId, reply);
      });
    },
    [buzz, later, receive],
  );

  const publish = useCallback(
    (text: string, image?: PhotoRef) => {
      if (!text.trim() && !image) return;
      dispatch({ type: 'post', post: { id: newId(), author: 'me', text: text.trim(), at: Date.now(), likes: 0, liked: false, image } });
      buzz('success');
      // Un ami réagit à la publication en message privé.
      const friend = pick(['jade', 'rico', 'maman']);
      const comments: Record<string, string[]> = {
        jade: image ? ['Trop belle ta photo 😍', 'Ce filtre ! Tu me l’envoies ?'] : ['Trop bien ta publi 🔥', 'Je like direct !'],
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

  const storyStart = useRef<number | null>(null);

  /** Exécute ce que l’histoire demande au téléphone. */
  const applyOut = useCallback(
    (out: Out[]) => {
      for (const o of out) {
        switch (o.k) {
          case 'msg':
            setTyping((t) => ({ ...t, [o.from]: true }));
            later(1400, () => {
              setTyping((t) => ({ ...t, [o.from]: false }));
              receive(o.from, o.text);
            });
            break;
          case 'sent':
            dispatch({ type: 'message', contactId: o.to, from: 'me', text: o.text, unread: false });
            playSound('sent');
            break;
          case 'money':
            dispatch({ type: 'money', label: o.label, amount: o.amount });
            break;
          case 'call':
            if (!inCall.current) router.push(`/call/${o.from}?incoming=1`);
            else notify({ app: 'Téléphone', icon: 'call', color: '#3DDC97', title: `${contactById(o.from)?.name ?? 'Inconnu'} essaie de vous joindre`, body: 'Rappelez depuis Contacts.', route: '/contacts' });
            break;
          case 'notify':
            notify({ app: 'La Cavale', icon: 'flame', color: '#FF3D8B', title: o.title, body: o.body, route: o.route });
            break;
          case 'mission':
            playSound(o.win ? 'win' : 'fail');
            if (o.def.wanted > 0 || !o.win) later(1500, () => playSound('siren'));
            notify({
              app: 'La Cavale',
              icon: o.win ? 'trophy' : 'alert-circle',
              color: o.win ? '#3DDC97' : '#FF5C6C',
              title: o.win ? `Mission réussie : ${o.def.title}` : `Mission ratée : ${o.def.title}`,
              body: o.win ? (o.def.reward ? `+${o.def.reward} $ sur votre compte.` : 'Bien joué.') : 'La police vous a repérés. Faites profil bas.',
              route: '/story',
            });
            break;
          case 'ending': {
            const e = ENDINGS.find((x) => x.id === o.id);
            playSound('win');
            notify({ app: 'La Cavale', icon: 'film', color: '#FFB347', title: `FIN : ${e?.title ?? ''}`, body: 'Ouvrez l’appli La Cavale.', route: '/story' });
            break;
          }
        }
      }
    },
    [later, receive, notify],
  );

  const storyChoose = useCallback(
    (index: number) => {
      const r = chooseStory(stateRef.current.story, index, Date.now());
      stateRef.current = { ...stateRef.current, story: r.s };
      dispatch({ type: 'story', story: r.s });
      applyOut(r.out);
      buzz();
    },
    [applyOut, buzz],
  );
  const storyStartMission = useCallback(() => {
    const st = startMission(stateRef.current.story, Date.now());
    stateRef.current = { ...stateRef.current, story: st };
    dispatch({ type: 'story', story: st });
    buzz('success');
  }, [buzz]);
  const storyCallDone = useCallback(
    (answered: boolean) => {
      const st = stateRef.current.story;
      if (!st.call) return;
      if (answered) {
        const next = callDone(st, Date.now());
        stateRef.current = { ...stateRef.current, story: next };
        dispatch({ type: 'story', story: next });
      } else {
        later(3000, () => receive(st.call!.from, 'Tu ne réponds pas ? Rappelle-moi.'));
      }
    },
    [later, receive],
  );
  const storyRestart = useCallback(() => {
    const st = restartStory(stateRef.current.story, Date.now());
    stateRef.current = { ...stateRef.current, story: st };
    dispatch({ type: 'story', story: st });
  }, []);

  const storySetPace = useCallback((pace: Pace) => {
    const st = { ...stateRef.current.story, pace };
    stateRef.current = { ...stateRef.current, story: st };
    dispatch({ type: 'story', story: st });
  }, []);

  useEffect(() => {
    setSoundEnabled(state.sound);
  }, [state.sound]);

  // Dès que l’histoire commence, on demande le droit d’envoyer des notifications.
  useEffect(() => {
    if (state.story.started) setupNotifications();
  }, [state.story.started]);

  // Notification système pour le prochain événement de l’histoire, utile quand l’appli est fermée.
  useEffect(() => {
    const ev = nextEvent(state.story);
    if (!ev) {
      scheduleStoryNotification(null, '', '');
      return;
    }
    const who = ev.from ? contactById(ev.from)?.name : undefined;
    const title = ev.kind === 'mission' ? 'Mission terminée' : ev.kind === 'call' ? `${who ?? 'Quelqu’un'} vous appelle` : (who ?? 'Nouveau message');
    const body = ev.kind === 'mission' ? 'Ouvrez NeonCell pour découvrir le résultat.' : ev.kind === 'call' ? 'Ouvrez NeonCell pour répondre.' : 'Vous avez reçu un message.';
    scheduleStoryNotification(ev.at, title, body);
  }, [state.story]);

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
          notify({ app: 'Banque Flamant', icon: 'card', color: '#FF8FB1', title: `+${job.reward} $ reçus`, body: `${job.client} a payé « ${job.title} ».`, route: '/bank' });
        }
      }
      // L’histoire démarre 12 s après le premier déverrouillage, puis avance toute seule.
      if (unlockedRef.current && !s.story.started) {
        storyStart.current ??= now + 12_000;
        if (now >= storyStart.current) dispatch({ type: 'story', story: { ...s.story, started: true, nextAt: now } });
      } else if (s.story.started) {
        const r = runStory(s.story, now, s.balance);
        if (r.s !== s.story) {
          stateRef.current = { ...s, story: r.s };
          dispatch({ type: 'story', story: r.s });
        }
        applyOut(r.out);
      }
      if (Math.random() < 0.3) dispatch({ type: 'tickLikes' });
      if (unlockedRef.current && now >= nextEvent) {
        nextEvent = now + 40_000 + Math.random() * 50_000;
        const roll = Math.random();
        if (roll < 0.12 && !inCall.current) {
          // Appel entrant d’un proche (jamais du numéro masqué… ou presque).
          const c = pick(CONTACTS.filter((x) => x.id !== 'agence' && !x.story));
          router.push(`/call/${c.id}?incoming=1`);
        } else if (roll < 0.65) {
          const c = pick(CONTACTS.filter((x) => !x.story));
          receive(c.id, pick(c.spontaneous));
        } else {
          const p = pick(FEED_POOL);
          const a = FEED_AUTHORS[p.author];
          dispatch({ type: 'post', post: { id: newId(), author: p.author, text: p.text, at: now, likes: Math.floor(Math.random() * 300), liked: false } });
          notify({ app: 'Palmfeed', icon: 'sparkles', color: '#FF3D8B', title: a.name, body: p.text, route: '/feed' });
        }
      }
    }, 1000);
    return () => clearInterval(id);
  }, [ready, notify, receive, applyOut]);

  const addPhoto = useCallback((uri: string, filter: FilterId) => {
    const id = newId();
    dispatch({ type: 'addPhoto', photo: { id, uri, filter, at: Date.now() } });
    return id;
  }, []);
  const setPhotoFilter = useCallback((id: string, filter: FilterId) => dispatch({ type: 'photoFilter', id, filter }), []);
  const deletePhoto = useCallback((id: string) => dispatch({ type: 'deletePhoto', id }), []);
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
      addPhoto,
      setPhotoFilter,
      deletePhoto,
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
      storyChoose,
      storyStartMission,
      storyCallDone,
      storyRestart,
      storySetPace,
      reset: () => {
        timers.current.forEach(clearTimeout);
        timers.current = [];
        setTyping({});
        setBanner(null);
        dispatch({ type: 'reset' });
      },
      buzz,
    }),
    [state, ready, unlocked, typing, banner, sendMessage, publish, transfer, buzz, addPhoto, setPhotoFilter, deletePhoto, unlock, lock, setOpenThread, setInCall, readThread, readNews, logCall, storyChoose, storyStartMission, storyCallDone, storyRestart, storySetPace],
  );

  return <PhoneContext.Provider value={value}>{children}</PhoneContext.Provider>;
}

export function usePhone() {
  const ctx = useContext(PhoneContext);
  if (!ctx) throw new Error('usePhone doit être utilisé dans <PhoneProvider>.');
  return ctx;
}

/** Contacts visibles : les personnages de l’histoire n’apparaissent qu’après leur premier message. */
export function knownContacts(s: PhoneState) {
  return CONTACTS.filter((c) => !c.story || s.threads[c.id]);
}

export const chapterName = (n: number) => CHAPTERS[n] ?? '';

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
