/** Vérification des mises à jour : dernière version publiée sur GitHub comparée à celle installée. */

export const RELEASES_API = 'https://api.github.com/repos/nicox32/elrond/releases/latest';

export interface UpdateInfo {
  version: string;
  tag: string;
  /** Lien direct de l'APK nommé avec sa version. */
  apkUrl: string;
  publishedAt?: string;
}

/** Compare deux versions « 1.1.109 » : négatif si a < b, 0 si égales, positif si a > b. */
export function compareVersions(a: string, b: string): number {
  const pa = a
    .replace(/^v/, '')
    .split('.')
    .map((n) => parseInt(n, 10) || 0);
  const pb = b
    .replace(/^v/, '')
    .split('.')
    .map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d) return d;
  }
  return 0;
}

/** Lit la réponse de l'API GitHub « latest release ». */
export function parseRelease(json: unknown): UpdateInfo | null {
  const r = json as { tag_name?: unknown; published_at?: unknown } | null;
  if (!r || typeof r.tag_name !== 'string' || !/^v?\d+(\.\d+)*$/.test(r.tag_name)) return null;
  const version = r.tag_name.replace(/^v/, '');
  return {
    version,
    tag: r.tag_name,
    apkUrl: `https://github.com/nicox32/elrond/releases/download/${r.tag_name}/orvia-${version}.apk`,
    publishedAt: typeof r.published_at === 'string' ? r.published_at : undefined,
  };
}

/** La mise à jour à proposer, ou null si la version installée est à jour (ou inconnue). */
export function availableUpdate(installed: string | undefined, latest: UpdateInfo | null): UpdateInfo | null {
  if (!installed || !latest) return null;
  return compareVersions(latest.version, installed) > 0 ? latest : null;
}

export async function fetchLatestRelease(signal?: AbortSignal): Promise<UpdateInfo | null> {
  const res = await fetch(RELEASES_API, { headers: { Accept: 'application/vnd.github+json' }, signal });
  if (!res.ok) return null;
  return parseRelease(await res.json());
}
