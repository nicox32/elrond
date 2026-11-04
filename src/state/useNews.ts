import { useCallback, useEffect, useState } from 'react';

import { fetchNews, type NewsResult } from '../logic/news';
import { loadCachedNews, saveNews } from '../storage';

/** Les actualités ne sont rechargées qu'après 30 minutes (sauf actualisation demandée). */
const MAX_AGE_MS = 30 * 60_000;

/** Actualités : celles en cache tout de suite, puis les nouvelles si elles ont plus de 30 minutes. */
export function useNews() {
  const [news, setNews] = useState<NewsResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const refresh = useCallback(
    async (force = false, cached: NewsResult | null = null) => {
      const base = cached ?? news;
      if (!force && base && Date.now() - new Date(base.fetchedAt).getTime() < MAX_AGE_MS) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const fresh = await fetchNews();
        if (fresh.items.length) {
          setNews(fresh);
          saveNews(fresh);
          setError(false);
        } else {
          setError(true);
        }
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    },
    [news],
  );

  useEffect(() => {
    let alive = true;
    loadCachedNews().then((cached) => {
      if (!alive) return;
      if (cached) setNews(cached);
      refresh(false, cached);
    });
    return () => {
      alive = false;
    };
    // Une seule fois à l'ouverture.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { news, loading, error, refresh: () => refresh(true) };
}
