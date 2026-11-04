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
