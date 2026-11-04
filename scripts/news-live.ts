// Lit les vrais flux d'actualités et affiche ce que l'appli en tire (diagnostic, lancé par sources-actus.yml).
import { fetchNews, NEWS_SOURCES, sourceName } from '../src/logic/news.ts';

const r = await fetchNews();
console.log(`Sources en panne : ${r.failed.join(', ') || 'aucune'} · ${r.items.length} articles`);
for (const s of NEWS_SOURCES) {
  const items = r.items.filter((n) => n.source === s.id);
  console.log(`\n## ${sourceName(s.id)} : ${items.length} articles`);
  for (const n of items.slice(0, 2)) {
    console.log(`- ${n.date ?? 'sans date'} | ${n.title}\n  ${n.summary}\n  auteur=${n.author ?? '-'} image=${n.image ? 'oui' : 'non'}`);
  }
}
