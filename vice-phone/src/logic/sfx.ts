import { type AudioPlayer, createAudioPlayer } from 'expo-audio';

const SOURCES = {
  notif: require('../../assets/sfx/notif.m4a'),
  sent: require('../../assets/sfx/sent.m4a'),
  ring: require('../../assets/sfx/ring.m4a'),
  win: require('../../assets/sfx/win.m4a'),
  fail: require('../../assets/sfx/fail.m4a'),
  siren: require('../../assets/sfx/siren.m4a'),
};

export type Sound = keyof typeof SOURCES;

const players: Partial<Record<Sound, AudioPlayer>> = {};
let enabled = true;

export function setSoundEnabled(v: boolean) {
  enabled = v;
  if (!v) stopSound('ring');
}

function player(name: Sound) {
  if (!players[name]) players[name] = createAudioPlayer(SOURCES[name]);
  return players[name]!;
}

/** Joue un son court du téléphone (sans effet si les sons sont coupés dans les réglages). */
export function playSound(name: Sound, loop = false) {
  if (!enabled) return;
  try {
    const p = player(name);
    p.loop = loop;
    p.volume = name === 'ring' ? 0.8 : 0.6;
    p.seekTo(0).catch(() => {});
    p.play();
  } catch {
    // Pas de son disponible : le téléphone reste muet.
  }
}

export function stopSound(name: Sound) {
  try {
    players[name]?.pause();
  } catch {
    // ignoré
  }
}
