import assert from 'node:assert/strict';
import test from 'node:test';

import { fetchNews, mergeNews, parseRss } from '../src/logic/news.ts';

// Extraits au format réel de chaque flux (contenus fictifs).
const ORFR = `<?xml version="1.0" encoding="utf-8"?><rss version="2.0"><channel><title>Or.fr - Actualités</title>
<item>
  <title><![CDATA[L’or teste un support décisif]]></title>
  <link>https://or.fr/actualites/or-support</link>
  <pubDate>Tue, 03 Nov 2026 06:20:00 GMT</pubDate>
  <description><![CDATA[L’or teste un niveau technique majeur de long terme.]]></description>
  <author>Auteur Un</author>
  <enclosure url="https://or.fr/_api/media/file/a.jpg?prefix=production" length="0" type="image/jpg"/>
</item></channel></rss>`;

const GOLDFR = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/"><channel>
<item>
  <title>Or vs argent : quelles perspectives ?</title>
  <link>https://www.gold.fr/news/2026/10/21/or-vs-argent/</link>
  <dc:creator><![CDATA[Auteur Deux]]></dc:creator>
  <pubDate>Wed, 21 Oct 2026 10:09:12 +0000</pubDate>
  <description><![CDATA[<p><img width="327" height="170" src="https://www.gold.fr/news/wp-content/uploads/x.png" />Or vs argent : quelles perspectives ? Après deux années folles, l’or [&#8230;]</p>
<p>Cet article <a href="https://www.gold.fr/news/x/">Or vs argent</a> est apparu en premier sur <a href="https://www.gold.fr/news">Gold.fr</a>.</p>]]></description>
</item></channel></rss>`;

const BULLION = `<?xml version="1.0" encoding="utf-8"?><rss version="2.0"><channel>
<item>
  <title>L'or et l'argent tentent un rebond</title>
  <link>https://or.bullionvault.fr/actualites-de-l-or/gold_price_news/rebond-1</link>
  <description>
&lt;span&gt;L'or et l'argent tentent un rebond&lt;/span&gt;
&lt;span&gt;&lt;a href="https://or.bullionvault.fr/users/x" class="username"&gt;Adrian E. Ash&lt;/a&gt;&lt;/span&gt;
&lt;span&gt;&lt;time datetime="2026-11-03T16:27:21+01:00"&gt;mar 03/11/2026 - 16:27&lt;/time&gt;&lt;/span&gt;
&lt;div&gt;&lt;p&gt;&lt;em&gt;L'OR a de nouveau rebondi mardi, à 3 969 dollars l'once.&amp;nbsp;&lt;/em&gt;&lt;/p&gt;&lt;/div&gt;
  </description>
</item></channel></rss>`;

const AUCOFFRE = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/"><channel>
<item>
  <title>L’or est trop cher pour les bijoux</title>
  <link>https://www.loretlargent.info/or/or-cher-bijoux/34736/</link>
  <dc:creator><![CDATA[Auteur Trois]]></dc:creator>
  <pubDate>Fri, 03 Jul 2026 15:02:38 +0000</pubDate>
  <description><![CDATA[<p><span class="rt-reading-time"><span class="rt-label rt-prefix">Temps de lecture : </span> <span class="rt-time"> 3</span> <span class="rt-label rt-postfix">minutes</span></span>Les particuliers changent leur façon d’acheter de l’or.</p>
<p>Cet article <a href="https://www.loretlargent.info/x/">L’or est trop cher</a> est apparu en premier sur <a href="https://www.loretlargent.info">L&#039;Or et l&#039;Argent</a>.</p>]]></description>
</item></channel></rss>`;

test('actualités : lecture des 4 formats de flux', () => {
  const [o] = parseRss(ORFR, 'orfr');
  assert.equal(o.title, 'L’or teste un support décisif');
  assert.equal(o.date, '2026-11-03T06:20:00.000Z');
  assert.equal(o.author, 'Auteur Un');
  assert.match(o.image!, /a\.jpg/);

  const [g] = parseRss(GOLDFR, 'goldfr');
  assert.equal(g.summary, 'Après deux années folles, l’or …');
  assert.equal(g.author, 'Auteur Deux');
  assert.match(g.image!, /x\.png$/);

  const [b] = parseRss(BULLION, 'bullionvault');
  assert.equal(b.date, '2026-11-03T15:27:21.000Z');
  assert.equal(b.summary, "L'OR a de nouveau rebondi mardi, à 3 969 dollars l'once.");

  const [a] = parseRss(AUCOFFRE, 'aucoffre');
  assert.equal(a.summary, 'Les particuliers changent leur façon d’acheter de l’or.');
});

test('actualités : plus récentes d’abord, une source en panne n’empêche pas les autres', async () => {
  const merged = mergeNews([parseRss(AUCOFFRE, 'aucoffre'), parseRss(ORFR, 'orfr'), parseRss(ORFR, 'orfr')]);
  assert.deepEqual(
    merged.map((n) => n.source),
    ['orfr', 'aucoffre'],
  );
  const fake = (async (url: string) =>
    url.includes('gold.fr')
      ? { ok: false, status: 500, text: async () => '' }
      : {
          ok: true,
          status: 200,
          text: async () => (url.includes('or.fr') ? ORFR : url.includes('bullionvault') ? BULLION : AUCOFFRE),
        }) as unknown as typeof fetch;
  const r = await fetchNews(fake);
  assert.deepEqual(r.failed, ['goldfr']);
  assert.equal(r.items.length, 3);
  assert.equal(r.items[0].source, 'bullionvault');
});
