import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

import { COURS_SNAPSHOT } from '../logic/coursData';
import { COURS_URL, type CoursData, isCoursData } from '../logic/priceSeries';

const KEY = 'elrond.cours.v1';
/** On recharge l'historique au plus toutes les 6 h. */
const MAX_AGE_MS = 6 * 3_600_000;

let memory: { data: CoursData; checkedAt: number } | null = null;

/** Historique des cours sur 20 ans : copie livrée, puis version gardée sur le téléphone, puis celle du jour. */
export function useCours(): CoursData {
  const [data, setData] = useState<CoursData>(memory?.data ?? COURS_SNAPSHOT);

  useEffect(() => {
    let alive = true;
    const newer = (a: CoursData, b: CoursData) => a.updated > b.updated;
    (async () => {
      let best = memory?.data ?? COURS_SNAPSHOT;
      let checkedAt = memory?.checkedAt ?? 0;
      if (!memory) {
        try {
          const raw = await AsyncStorage.getItem(KEY);
          const saved = raw ? (JSON.parse(raw) as { data: unknown; checkedAt: number }) : null;
          if (saved && isCoursData(saved.data) && newer(saved.data, best)) best = saved.data;
          if (saved) checkedAt = saved.checkedAt ?? 0;
        } catch {
          // Rien de gardé : la copie livrée suffit.
        }
      }
      if (alive) setData(best);
      memory = { data: best, checkedAt };
      if (Date.now() - checkedAt < MAX_AGE_MS) return;
      try {
        const res = await fetch(COURS_URL);
        const json: unknown = res.ok ? await res.json() : null;
        checkedAt = Date.now();
        if (isCoursData(json) && newer(json, best)) best = json;
        memory = { data: best, checkedAt };
        await AsyncStorage.setItem(KEY, JSON.stringify(memory));
        if (alive) setData(best);
      } catch {
        // Hors connexion : on garde ce qu'on a.
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  return data;
}
