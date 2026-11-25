import { type Effects, type MissionDef, NODES, STORY_VERSION } from '../data/story.ts';

export type Pace = 'reel' | 'rapide';

export type StoryState = {
  version: number;
  /** « reel » : environ 60 h en temps réel. « rapide » : les attentes et missions sont 60 fois plus courtes. */
  pace: Pace;
  started: boolean;
  node: string;
  i: number;
  /** Moment où le prochain élément de l’histoire peut se déclencher. */
  nextAt: number;
  chapter: number;
  flags: Record<string, true>;
  rep: number;
  trust: number;
  wanted: number;
  /** Dernière baisse (ou hausse) du niveau de recherche. */
  wantedAt: number;
  choice: { from: string; options: { label: string }[] } | null;
  gate: { from: string; money: number; objective: string } | null;
  mission: { def: MissionDef; startedAt: number | null; tries: number } | null;
  call: { from: string; lines: string[] } | null;
  ending: string | null;
  endings: string[];
};

export type Out =
  | { k: 'msg'; from: string; text: string }
  | { k: 'sent'; to: string; text: string }
  | { k: 'call'; from: string }
  | { k: 'money'; amount: number; label: string }
  | { k: 'notify'; title: string; body: string; route: string }
  | { k: 'mission'; win: boolean; def: MissionDef }
  | { k: 'ending'; id: string };

export function newStory(): StoryState {
  return {
    version: STORY_VERSION, pace: 'reel', started: false, node: 'start', i: 0, nextAt: 0, chapter: 0, flags: {}, rep: 0, trust: 0, wanted: 0, wantedAt: 0,
    choice: null, gate: null, mission: null, call: null, ending: null, endings: [],
  };
}

/** Recommence l’histoire en gardant la liste des fins déjà vues. */
export function restartStory(s: StoryState, now: number): StoryState {
  return { ...newStory(), endings: s.endings, pace: s.pace, started: true, nextAt: now + 3000 };
}

/** Une sauvegarde d’un ancien scénario repart du début (en gardant les fins vues et le rythme). */
export function migrateStory(s: StoryState | undefined): StoryState {
  if (!s) return newStory();
  if (s.version === STORY_VERSION && NODES[s.node]) return s;
  return { ...newStory(), endings: s.endings ?? [], pace: s.pace ?? 'reel' };
}

/** Attente réelle, selon le rythme choisi : en rapide, les attentes de plus d’une minute sont divisées par 60. */
export function paced(sec: number, pace: Pace): number {
  return pace === 'rapide' && sec > 60 ? Math.max(20, sec / 60) : sec;
}

export const missionDuration = (def: MissionDef, pace: Pace) => (pace === 'rapide' ? Math.max(20, def.durationSec / 60) : def.durationSec);

/** Une étoile de recherche disparaît après ce délai sans mission : 20 min (2 min 30 en rapide). */
export const wantedDecay = (pace: Pace) => (pace === 'rapide' ? 150 : 1200);

const clampWanted = (w: number) => Math.max(0, Math.min(5, w));

function applyEffects(s: StoryState, e: Effects | undefined, now: number, out: Out[]): StoryState {
  if (!e) return s;
  let next = { ...s };
  if (e.rep) next.rep += e.rep;
  if (e.trust) next.trust += e.trust;
  if (e.wanted) next = { ...next, wanted: clampWanted(next.wanted + e.wanted), wantedAt: now };
  if (e.set) next.flags = { ...next.flags, ...Object.fromEntries(e.set.map((f) => [f, true as const])) };
  if (e.money) out.push({ k: 'money', amount: e.money, label: 'La Cavale' });
  return next;
}

/** Chances de réussir une mission : le risque et les étoiles de recherche pèsent, la réputation aide. */
export function missionChance(def: MissionDef, s: Pick<StoryState, 'wanted' | 'rep'>): number {
  return Math.max(0.15, Math.min(0.97, 1 - def.risk - s.wanted * 0.07 + s.rep * 0.03));
}

const jump = (s: StoryState, node: string, now: number, wait: number): StoryState => ({ ...s, node, i: 0, nextAt: now + paced(wait, s.pace) * 1000 });

/**
 * Fait avancer l’histoire jusqu’à ce qu’elle attende quelque chose (un délai, un choix, une mission,
 * de l’argent ou un appel). Pure : renvoie le nouvel état et ce que le téléphone doit faire.
 */
export function runStory(input: StoryState, now: number, balance: number, rand: () => number = Math.random): { s: StoryState; out: Out[] } {
  let s = input;
  const out: Out[] = [];
  if (!s.started || s.ending) return { s, out };

  // Le niveau de recherche baisse d’une étoile à intervalle régulier, hors mission en cours.
  if (s.wanted > 0 && !s.mission?.startedAt && now - s.wantedAt > wantedDecay(s.pace) * 1000) {
    s = { ...s, wanted: s.wanted - 1, wantedAt: now };
  }

  // Mission en cours : résultat à la fin du chrono.
  if (s.mission?.startedAt) {
    const def = s.mission.def;
    if (now - s.mission.startedAt < missionDuration(def, s.pace) * 1000) return { s, out };
    const win = rand() < missionChance(def, s);
    out.push({ k: 'mission', win, def });
    if (win && def.reward) out.push({ k: 'money', amount: def.reward, label: `Mission : ${def.title}` });
    s = { ...s, mission: null, wanted: clampWanted(s.wanted + def.wanted + (win ? 0 : 1)), wantedAt: now };
    s = jump(s, win ? def.win : def.fail, now, 4);
  }

  // Objectif d’argent : on attend que le solde suffise (le paiement se fait plus bas).
  if (s.gate) {
    if (balance < s.gate.money) return { s, out };
    s = { ...s, gate: null };
  }

  if (s.choice || s.mission || s.call) return { s, out };

  for (let guard = 0; guard < 50; guard++) {
    if (now < s.nextAt) break;
    const beat = NODES[s.node]?.[s.i];
    if (!beat) break;
    switch (beat.t) {
      case 'msg':
        out.push({ k: 'msg', from: beat.from, text: beat.text });
        s = { ...s, i: s.i + 1, nextAt: now + paced(waitBefore(s.node, s.i + 1), s.pace) * 1000 };
        break;
      case 'chapter':
        s = { ...s, chapter: beat.n, i: s.i + 1 };
        break;
      case 'effects':
        s = applyEffects({ ...s, i: s.i + 1 }, beat.effects, now, out);
        break;
      case 'goto':
        s = jump(s, beat.go, now, beat.wait ?? waitBefore(beat.go, 0));
        break;
      case 'if': {
        const go = beat.test(s) ? beat.then : beat.else;
        s = jump(s, go, now, waitBefore(go, 0));
        break;
      }
      case 'choice':
        return { s: { ...s, choice: { from: beat.from, options: beat.options.map((o) => ({ label: o.label })) } }, out };
      case 'mission':
        out.push({ k: 'notify', title: `Nouvelle mission : ${beat.mission.title}`, body: beat.mission.description, route: '/story' });
        return { s: { ...s, mission: { def: beat.mission, startedAt: null, tries: 0 } }, out };
      case 'gate':
        if (balance >= beat.money) {
          out.push({ k: 'money', amount: -beat.money, label: beat.label });
          balance -= beat.money;
          s = { ...s, i: s.i + 1, nextAt: now + 3000 };
          break;
        }
        out.push({ k: 'notify', title: 'Objectif', body: beat.objective, route: '/story' });
        return { s: { ...s, gate: { from: beat.from, money: beat.money, objective: beat.objective } }, out };
      case 'call':
        out.push({ k: 'call', from: beat.from });
        return { s: { ...s, call: { from: beat.from, lines: beat.lines } }, out };
      case 'end': {
        const endings = s.endings.includes(beat.ending) ? s.endings : [...s.endings, beat.ending];
        out.push({ k: 'ending', id: beat.ending });
        return { s: { ...s, ending: beat.ending, endings, i: s.i + 1 }, out };
      }
    }
  }
  return { s, out };
}

/** Délai (en secondes) avant l’élément i d’un passage : celui qu’il indique, sinon 4 s pour un message. */
function waitBefore(node: string, i: number): number {
  const b = NODES[node]?.[i];
  if (!b) return 0;
  if ('wait' in b && b.wait !== undefined) return b.wait;
  return b.t === 'msg' || b.t === 'call' ? 4 : 0;
}

/** Le joueur choisit une réponse : elle part comme un message, puis l’histoire continue. */
export function chooseStory(s: StoryState, index: number, now: number): { s: StoryState; out: Out[] } {
  const beat = NODES[s.node]?.[s.i];
  if (!s.choice || !beat || beat.t !== 'choice') return { s, out: [] };
  const opt = beat.options[index];
  if (!opt) return { s, out: [] };
  const out: Out[] = [{ k: 'sent', to: beat.from, text: opt.label }];
  let next: StoryState = { ...s, choice: null };
  next = applyEffects(next, opt.effects, now, out);
  return { s: jump(next, opt.go, now, Math.max(3, waitBefore(opt.go, 0))), out };
}

export function startMission(s: StoryState, now: number): StoryState {
  if (!s.mission || s.mission.startedAt) return s;
  return { ...s, mission: { ...s.mission, startedAt: now, tries: s.mission.tries + 1 } };
}

/** Appel de l’histoire terminé (décroché) : on passe à la suite. */
export function callDone(s: StoryState, now: number): StoryState {
  if (!s.call) return s;
  return { ...s, call: null, i: s.i + 1, nextAt: now + 3000 };
}

/**
 * Prochain événement de l’histoire qui mérite une notification quand l’appli est fermée :
 * fin d’une mission, ou prochain message / appel. `null` si l’histoire attend le joueur.
 */
export function nextEvent(s: StoryState): { at: number; kind: 'mission' | 'msg' | 'call'; from?: string } | null {
  if (!s.started || s.ending || s.choice || s.call || s.gate) return null;
  if (s.mission) return s.mission.startedAt ? { at: s.mission.startedAt + missionDuration(s.mission.def, s.pace) * 1000, kind: 'mission' } : null;
  // On cherche le prochain message ou appel, en suivant les sauts simples.
  let node = s.node;
  let i = s.i;
  for (let guard = 0; guard < 20; guard++) {
    const b = NODES[node]?.[i];
    if (!b) return null;
    if (b.t === 'msg' || b.t === 'call') return { at: s.nextAt, kind: b.t, from: b.from };
    if (b.t === 'goto') {
      node = b.go;
      i = 0;
    } else if (b.t === 'chapter' || b.t === 'effects') {
      i++;
    } else {
      return null;
    }
  }
  return null;
}

/** Objectif affiché dans l’appli Histoire. */
export function objective(s: StoryState): string {
  if (!s.started) return 'Attendre des nouvelles de Mara…';
  if (s.ending) return 'Histoire terminée.';
  if (s.choice) return 'Répondre au message (appli Messages).';
  if (s.gate) return s.gate.objective;
  if (s.call) return 'Prendre l’appel (ou rappeler depuis Contacts).';
  if (s.mission) return s.mission.startedAt ? `En cours : ${s.mission.def.title}` : `Lancer la mission : ${s.mission.def.title}`;
  return 'Attendre la suite…';
}
