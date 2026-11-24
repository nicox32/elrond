import assert from 'node:assert/strict';
import { test } from 'node:test';

import { normalize, pick, replyFor, typingDelay } from '../src/logic/chat.ts';
import { ago, compact, duration, money } from '../src/logic/format.ts';
import { CONTACTS, contactById } from '../src/data/world.ts';

test('normalize retire accents et apostrophes', () => {
  assert.equal(normalize('  Génial, D’accord !'), 'genial, daccord !');
});

test('pick reste dans la liste', () => {
  assert.equal(pick(['a', 'b', 'c'], 0), 'a');
  assert.equal(pick(['a', 'b', 'c'], 0.999), 'c');
  assert.equal(pick(['a', 'b', 'c'], 1), 'c');
});

test('replyFor reconnaît un mot clé entier', () => {
  const rico = contactById('rico')!;
  assert.ok(rico.triggers[0].replies.includes(replyFor(rico, 'Ma VOITURE fait un bruit', 0)));
  // Mot entier seulement : « auto » n’est pas reconnu dans « autobus ».
  assert.ok(rico.generic.includes(replyFor(rico, 'je prends l’autobus', 0)));
});

test('replyFor reconnaît une expression et un symbole', () => {
  const vince = contactById('vince')!;
  assert.ok(vince.triggers[1].replies.includes(replyFor(vince, 'Quelle bonne idée !', 0)));
  const maman = contactById('maman')!;
  assert.ok(maman.triggers[1].replies.includes(replyFor(maman, 'tu peux me prêter 20 $ ?', 0)));
});

test('chaque contact a des réponses et des répliques d’appel', () => {
  for (const c of CONTACTS) {
    assert.ok(c.generic.length > 0 && c.spontaneous.length > 0 && c.call.length > 0, c.id);
  }
  assert.equal(new Set(CONTACTS.map((c) => c.number)).size, CONTACTS.length);
});

test('typingDelay est borné', () => {
  assert.ok(typingDelay('ok', 0) >= 900);
  assert.equal(typingDelay('x'.repeat(1000), 1), 4500);
});

test('formats', () => {
  assert.equal(money(12500), '12 500 $');
  assert.equal(money(-80), '−80 $');
  assert.equal(money(80, true), '+80 $');
  assert.equal(duration(75), '01:15');
  assert.equal(compact(5120), '5,1 k');
  assert.equal(compact(1000), '1 k');
  assert.equal(ago(0, 30_000), 'à l’instant');
  assert.equal(ago(0, 5 * 60_000), 'il y a 5 min');
});

test('onAir alterne titres et animateur', async () => {
  const { onAir } = await import('../src/logic/radio.ts');
  const s = { host: 'DJ', dj: ['salut'], tracks: [['A', 'B']] as [string, string][] };
  assert.equal(onAir(s, 0).kind, 'track');
  assert.equal(onAir(s, 2 * 28_000 + 1000).kind, 'dj');
  assert.equal(onAir(s, 2 * 28_000 + 9000).kind, 'track');
});

test('GPS : le chemin suit les routes et passe par le pont pour l’île', async () => {
  const { shortestPath, route, nearestNode, formatDistance } = await import('../src/logic/map.ts');
  const { poiById, ROADS } = await import('../src/data/map.ts');
  assert.deepEqual(shortestPath('A', 'A'), ['A']);
  const p = shortestPath('A', 'Q');
  assert.equal(p[0], 'A');
  assert.equal(p[p.length - 1], 'Q');
  // Chaque étape est une vraie route.
  for (let i = 1; i < p.length; i++) {
    assert.ok(ROADS.some((r) => (r.a === p[i - 1] && r.b === p[i]) || (r.b === p[i - 1] && r.a === p[i])), `${p[i - 1]}-${p[i]}`);
  }
  assert.ok(p.includes('L') && p.includes('P'), 'passe par le pont L-P');
  const r = route(poiById('maison')!.at, poiById('flamingo')!.at);
  assert.ok(r.meters > 1500 && r.meters < 6000, String(r.meters));
  assert.ok(r.minutes >= 1);
  assert.equal(nearestNode([0, 0]), 'A');
  assert.equal(formatDistance(1234), '1,2 km');
  assert.equal(formatDistance(234), '230 m');
});
