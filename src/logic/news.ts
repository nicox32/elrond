/**
 * Actualités des métaux précieux : titres, résumés et liens des flux RSS publics de sites spécialisés.
 * Les articles complets restent sur leurs sites (lien « Lire l'article »).
 */

export type NewsSourceId = 'orfr' | 'goldfr' | 'bullionvault' | 'aucoffre';

export interface NewsSource {
  id: NewsSourceId;
  name: string;
  feed: string;
  site: string;
}

export const NEWS_SOURCES: NewsSource[] = [
  { id: 'orfr', name: 'Or.fr', feed: 'https://www.or.fr/actualites/rss', site: 'https://or.fr/actualites' },
  { id: 'goldfr', name: 'Gold.fr', feed: 'https://www.gold.fr/feed', site: 'https://www.gold.fr/news' },
  {
    id: 'bullionvault',
    name: 'BullionVault',
    feed: 'https://or.bullionvault.fr/actualites-de-l-or/rss.xml',
    site: 'https://or.bullionvault.fr/actualites-de-l-or',
  },
  {
    id: 'aucoffre',
    name: 'AuCOFFRE',
    feed: 'https://www.loretlargent.info/feed/',
    site: 'https://www.loretlargent.info',
  },
];

export interface NewsItem {
  id: string;
  source: NewsSourceId;
  title: string;
  link: string;
  /** Date de publication (ISO), si connue. */
  date?: string;
  summary: string;
  author?: string;
  image?: string;
}

const NAMED: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  rsquo: '’',
  lsquo: '‘',
  rdquo: '”',
  ldquo: '“',
  hellip: '…',
  eacute: 'é',
  egrave: 'è',
  agrave: 'à',
  ccedil: 'ç',
  ndash: '–',
  mdash: '—',
  laquo: '«',
  raquo: '»',
  euro: '€',
};

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return NAMED[e.toLowerCase()] ?? m;
  });
}

const cdata = (s: string) => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');

function tag(block: string, name: string): string | undefined {
  const m = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i'));
  return m ? cdata(m[1]).trim() : undefined;
}

/** HTML → texte simple. */
function toText(html: string): string {
  return decodeEntities(
    html
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<(br|\/p|\/div|\/h\d)\s*\/?>/gi, ' ')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/\s+/g, ' ')
    .trim();
}

function clip(s: string, max = 240): string {
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), max - 30)).replace(/[\s,;:.–-]+$/, '')}…`;
}

function cleanSummary(raw: string, title: string): string {
  // Certains flux mettent le HTML échappé (&lt;p&gt;) : on le décode une fois avant d'enlever les balises.
  let t = toText(/&lt;[a-z]/i.test(raw) ? decodeEntities(raw) : raw);
  t = t
    .replace(/Cet article .{0,300}? est apparu en premier sur .*$/i, '')
    .replace(/Temps de lecture\s*:\s*\d+\s*minutes?/i, '')
    .replace(/\[…\]|\[\.\.\.\]/g, '…');
  if (t.startsWith(title)) t = t.slice(title.length);
  // BullionVault : auteur et date en tête (« Adrian E. Ash mar 03/11/2026 - 16:27 »).
  t = t.replace(/^\s*[A-ZÉ][\p{L}.' -]{2,40}?\s+[a-z]{3}\.? \d{2}\/\d{2}\/\d{4} - \d{2}:\d{2}\s*/u, '');
  return clip(t.replace(/\s+/g, ' ').trim());
}

function toIso(s?: string): string | undefined {
  if (!s) return undefined;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

/** Lit un flux RSS 2.0 (titre, lien, date, résumé, auteur, image). */
export function parseRss(xml: string, source: NewsSourceId, max = 12): NewsItem[] {
  const out: NewsItem[] = [];
  for (const m of xml.matchAll(/<item\b[\s\S]*?<\/item>/gi)) {
    const block = m[0];
    const title = toText(tag(block, 'title') ?? '');
    const link = decodeEntities(tag(block, 'link') ?? '').trim();
    if (!title || !/^https?:\/\//.test(link)) continue;
    const rawDesc = tag(block, 'description') ?? '';
    const date =
      toIso(tag(block, 'pubDate')) ??
      toIso(tag(block, 'dc:date')) ??
      toIso(decodeEntities(rawDesc).match(/datetime="([^"]+)"/)?.[1]);
    const image =
      block.match(/<enclosure[^>]+url="([^"]+)"[^>]*type="image/i)?.[1] ??
      block.match(/<media:(?:content|thumbnail)[^>]+url="([^"]+)"/i)?.[1] ??
      decodeEntities(cdata(block)).match(/<img[^>]+src="(https?:[^"]+)"/i)?.[1];
    const author = toText(tag(block, 'author') ?? tag(block, 'dc:creator') ?? '') || undefined;
    out.push({
      id: `${source}:${link}`,
      source,
      title,
      link,
      ...(date ? { date } : {}),
      summary: cleanSummary(rawDesc, title),
      ...(author ? { author } : {}),
      ...(image ? { image: decodeEntities(image) } : {}),
    });
    if (out.length >= max) break;
  }
  return out;
}

/** Fusionne les articles de toutes les sources : les plus récents d'abord, sans doublons. */
export function mergeNews(lists: NewsItem[][]): NewsItem[] {
  const seen = new Set<string>();
  return lists
    .flat()
    .filter((n) => (seen.has(n.link) ? false : (seen.add(n.link), true)))
    .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
}

type Fetch = typeof fetch;

async function getText(fetchFn: Fetch, url: string, timeoutMs = 12_000): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchFn(url, { signal: controller.signal, headers: { Accept: 'application/rss+xml, text/xml' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

export interface NewsResult {
  items: NewsItem[];
  fetchedAt: string;
  /** Sources qui n'ont pas répondu. */
  failed: NewsSourceId[];
}

/** Charge toutes les sources en parallèle ; une source en panne n'empêche pas les autres. */
export async function fetchNews(fetchFn: Fetch = fetch, now = new Date()): Promise<NewsResult> {
  const results = await Promise.allSettled(
    NEWS_SOURCES.map((s) => getText(fetchFn, s.feed).then((x) => parseRss(x, s.id))),
  );
  const failed: NewsSourceId[] = [];
  const lists: NewsItem[][] = [];
  results.forEach((r, i) => {
    if (r.status === 'fulfilled' && r.value.length) lists.push(r.value);
    else failed.push(NEWS_SOURCES[i].id);
  });
  return { items: mergeNews(lists), fetchedAt: now.toISOString(), failed };
}

export function sourceName(id: NewsSourceId): string {
  return NEWS_SOURCES.find((s) => s.id === id)?.name ?? id;
}
