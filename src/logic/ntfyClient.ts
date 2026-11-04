/** Envoi d'une notification sur un canal ntfy depuis l'appli (API JSON de ntfy.sh, accents compris). */
type Fetch = typeof fetch;

export const NTFY_SERVER = 'https://ntfy.sh';

/** Un nom de canal valide : lettres, chiffres, tiret et tiret bas, 1 à 64 caractères, sans espace. */
export function isValidTopic(topic: string | undefined): topic is string {
  return !!topic && /^[A-Za-z0-9_-]{1,64}$/.test(topic);
}

export async function publishNtfy(
  topic: string,
  n: { title: string; body: string },
  fetchFn: Fetch = fetch,
  tags = ['moneybag', 'chart_with_downwards_trend'],
): Promise<void> {
  if (!isValidTopic(topic)) throw new Error('Canal ntfy invalide');
  const res = await fetchFn(NTFY_SERVER, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topic, title: n.title, message: n.body, tags, priority: 4 }),
  });
  if (!res.ok) throw new Error(`ntfy : HTTP ${res.status}`);
}

export interface NtfyMessage {
  id: string;
  /** Date d'arrivée (ISO). */
  date: string;
  title: string;
  body: string;
}

/** Messages reçus par un canal ntfy sur une période (ex. « 7d »), du plus récent au plus ancien. */
export async function fetchNtfyMessages(topic: string, since = '7d', fetchFn: Fetch = fetch): Promise<NtfyMessage[]> {
  if (!isValidTopic(topic)) return [];
  const res = await fetchFn(`${NTFY_SERVER}/${topic}/json?poll=1&since=${since}`);
  if (!res.ok) throw new Error(`ntfy : HTTP ${res.status}`);
  const out: NtfyMessage[] = [];
  for (const line of (await res.text()).split('\n')) {
    if (!line.trim()) continue;
    try {
      const m = JSON.parse(line) as { id?: string; event?: string; time?: number; title?: string; message?: string };
      if (m.event === 'message' && m.id && typeof m.time === 'number') {
        out.push({
          id: m.id,
          date: new Date(m.time * 1000).toISOString(),
          title: m.title ?? '',
          body: m.message ?? '',
        });
      }
    } catch {
      // ligne illisible : ignorée
    }
  }
  return out.sort((a, b) => b.date.localeCompare(a.date));
}
