import { type AudioPlayer, setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { STATIONS, type Station } from '../data/radio';

type RadioCtx = {
  station: Station | null;
  playing: boolean;
  tune: (id: string) => void;
  toggle: () => void;
  stop: () => void;
  next: (dir: 1 | -1) => void;
  /** Baisse le son pendant un appel, puis le remet. */
  duck: (on: boolean) => void;
};

const Ctx = createContext<RadioCtx | null>(null);

// Le lecteur est un objet natif : on le règle hors du rendu, par ces petites fonctions.
function start(player: AudioPlayer, source: number) {
  player.replace(source);
  player.loop = true;
  player.volume = 1;
  player.play();
}
function setVolume(player: AudioPlayer, v: number) {
  player.volume = v;
}

/** Un seul lecteur pour tout le téléphone : la radio continue quand on change d’appli. */
export function RadioProvider({ children }: { children: ReactNode }) {
  const player = useAudioPlayer(null);
  const status = useAudioPlayerStatus(player);
  const [stationId, setStationId] = useState<string | null>(null);
  const station = STATIONS.find((s) => s.id === stationId) ?? null;

  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: false, interruptionMode: 'duckOthers' }).catch(() => {});
  }, []);

  const tune = useCallback(
    (id: string) => {
      const s = STATIONS.find((x) => x.id === id);
      if (!s) return;
      setStationId(id);
      start(player, s.source);
    },
    [player],
  );

  const toggle = useCallback(() => {
    if (!stationId) {
      tune(STATIONS[0].id);
    } else if (player.playing) {
      player.pause();
    } else {
      player.play();
    }
  }, [player, stationId, tune]);

  const stop = useCallback(() => {
    player.pause();
    setStationId(null);
  }, [player]);

  const next = useCallback(
    (dir: 1 | -1) => {
      const i = Math.max(0, STATIONS.findIndex((s) => s.id === stationId));
      tune(STATIONS[(i + dir + STATIONS.length) % STATIONS.length].id);
    },
    [stationId, tune],
  );

  const duck = useCallback(
    (on: boolean) => {
      setVolume(player, on ? 0.12 : 1);
    },
    [player],
  );

  const value = useMemo(
    () => ({ station, playing: !!station && status.playing, tune, toggle, stop, next, duck }),
    [station, status.playing, tune, toggle, stop, next, duck],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useRadio() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useRadio doit être utilisé dans <RadioProvider>.');
  return c;
}
