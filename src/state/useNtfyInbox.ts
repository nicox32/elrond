import { useCallback, useEffect, useRef, useState } from 'react';

import { fetchNtfyMessages, isValidTopic, mergeInbox, type NtfyMessage } from '../logic/ntfyClient';
import { loadNtfyInbox, saveNtfyInbox } from '../storage';

const POLL_MS = 30_000;

/** Messages du canal ntfy : ceux gardés sur le téléphone, complétés toutes les 30 s tant que l'écran est ouvert. */
export function useNtfyInbox(topic: string | undefined) {
  const [messages, setMessages] = useState<NtfyMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [checkedAt, setCheckedAt] = useState<string | null>(null);
  const kept = useRef<NtfyMessage[]>([]);

  const refresh = useCallback(async () => {
    if (!isValidTopic(topic)) {
      setLoading(false);
      return;
    }
    try {
      const fresh = await fetchNtfyMessages(topic, 'all');
      const merged = mergeInbox(kept.current, fresh);
      kept.current = merged;
      setMessages(merged);
      saveNtfyInbox(merged);
      setError(false);
      setCheckedAt(new Date().toISOString());
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [topic]);

  useEffect(() => {
    let alive = true;
    loadNtfyInbox().then((m) => {
      if (!alive) return;
      kept.current = m;
      setMessages(m);
      refresh();
    });
    const timer = setInterval(refresh, POLL_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [refresh]);

  return { messages, loading, error, checkedAt, refresh };
}
