import assert from 'node:assert/strict';
import { test } from 'node:test';

import { RESERVES, SPECIES, WEAPONS } from '../src/data/game.ts';
import { exportBackup, importBackup, parseState } from '../src/logic/backup.ts';
import { overview, parseNumber, sortByDateDesc, summarizeSpecies, weaponStats } from '../src/logic/stats.ts';
import type { Hunt } from '../src/logic/types.ts';

function hunt(over: Partial<Hunt>): Hunt {
  return {
    id: 'h1',
    date: '2026-11-01T10:00:00.000Z',
    reserveId: 'kilimaya',
    speciesId: 'impala',
    weaponId: 'christensen-evoke',
    oneShot: true,
    trophyType: 'normal',
    mode: 'solo',
    toPlace: false,
    ...over,
  };
}

test('données du jeu : 29 espèces, identifiants uniques et réserves connues', () => {
  assert.equal(SPECIES.length, 29);
  assert.equal(SPECIES.filter((s) => s.reserveId === 'new-laurentia').length, 15);
  assert.equal(SPECIES.filter((s) => s.reserveId === 'kilimaya').length, 14);
  assert.equal(new Set(SPECIES.map((s) => s.id)).size, SPECIES.length);
  assert.equal(new Set(WEAPONS.map((w) => w.id)).size, WEAPONS.length);
  const reserveIds = new Set(RESERVES.map((r) => r.id));
  assert.ok(SPECIES.every((s) => reserveIds.has(s.reserveId)));
  assert.equal(WEAPONS.find((w) => w.id === 'christensen-evoke')?.caliber, '.243 Win');
});

test('résumé par espèce : nombre, meilleur score et dernière date', () => {
  const hunts = [
    hunt({ id: 'a', trophyScore: 40, date: '2026-10-01T00:00:00.000Z' }),
    hunt({ id: 'b', trophyScore: 55.5, date: '2026-10-05T00:00:00.000Z' }),
    hunt({ id: 'c', date: '2026-10-09T00:00:00.000Z' }),
    hunt({ id: 'd', speciesId: 'lion', trophyScore: 10 }),
  ];
  const s = summarizeSpecies(hunts).get('impala');
  assert.equal(s?.count, 3);
  assert.equal(s?.bestScore, 55.5);
  assert.equal(s?.bestHuntId, 'b');
  assert.equal(s?.lastDate, '2026-10-09T00:00:00.000Z');
});

test('statistiques par arme', () => {
  const hunts = [
    hunt({ id: 'a', distanceM: 100, oneShot: true }),
    hunt({ id: 'b', distanceM: 300, oneShot: false }),
    hunt({ id: 'c', oneShot: true }),
    hunt({ id: 'd', weaponId: 'autre' }),
  ];
  const w = weaponStats(hunts, 'christensen-evoke');
  assert.equal(w.count, 3);
  assert.equal(w.avgDistanceM, 200);
  assert.equal(w.maxDistanceM, 300);
  assert.ok(Math.abs((w.oneShotRate ?? 0) - 2 / 3) < 1e-9);
  assert.deepEqual(weaponStats(hunts, 'inconnue'), { count: 0 });
});

test('vue d’ensemble filtrée par réserve', () => {
  const hunts = [
    hunt({ id: 'a', toPlace: true, distanceM: 250 }),
    hunt({ id: 'b', reserveId: 'new-laurentia', speciesId: 'bison' }),
  ];
  const all = overview(hunts, SPECIES);
  assert.equal(all.total, 2);
  assert.equal(all.speciesHunted, 2);
  assert.equal(all.speciesTotal, 29);
  assert.equal(all.toPlace, 1);
  const kili = overview(hunts, SPECIES, 'kilimaya');
  assert.equal(kili.total, 1);
  assert.equal(kili.speciesTotal, 14);
  assert.equal(kili.maxDistanceM, 250);
});

test('tri du plus récent au plus ancien', () => {
  const sorted = sortByDateDesc([hunt({ id: 'old', date: '2026-01-01T00:00:00.000Z' }), hunt({ id: 'new' })]);
  assert.deepEqual(sorted.map((h) => h.id), ['new', 'old']);
});

test('lecture des nombres saisis', () => {
  assert.equal(parseNumber('152,4'), 152.4);
  assert.equal(parseNumber(' 180 '), 180);
  assert.equal(parseNumber(''), undefined);
  assert.equal(parseNumber('abc'), undefined);
  assert.equal(parseNumber('-3'), undefined);
});

test('sauvegarde : export puis import redonne les mêmes données', () => {
  const state = {
    hunts: [hunt({ trophyScore: 42, notes: 'vent de face' })],
    ownedWeaponIds: ['christensen-evoke', 'perso-1'],
    customWeapons: [{ id: 'perso-1', name: 'Steyr SM12', caliber: '.300 Win Mag', type: 'carabine' as const, custom: true }],
    lastReserveId: 'kilimaya' as const,
    lastWeaponId: 'christensen-evoke',
  };
  const res = importBackup(exportBackup(state));
  assert.ok(res.ok);
  if (res.ok) assert.deepEqual(res.state, parseState(state));
  if (res.ok) assert.equal(res.state.hunts[0].notes, 'vent de face');
});

test('sauvegarde : textes invalides refusés, entrées abîmées ignorées', () => {
  assert.equal(importBackup('pas du json').ok, false);
  assert.equal(importBackup('{"app":"autre","version":1,"data":{}}').ok, false);
  assert.equal(importBackup(JSON.stringify({ app: 'carnet-chasse-woth2', version: 99, data: {} })).ok, false);
  const s = parseState({ hunts: [hunt({}), { id: 'x' }, null], ownedWeaponIds: ['a', 'a', 3] });
  assert.equal(s?.hunts.length, 1);
  assert.deepEqual(s?.ownedWeaponIds, ['a']);
});

test('affichage des scores', async () => {
  const { formatScore } = await import('../src/logic/stats.ts');
  assert.equal(formatScore(48.6), '48,6');
  assert.equal(formatScore(152.25), '152,25');
  assert.equal(formatScore(40), '40');
  assert.equal(formatScore(10.123), '10,12');
});

test('gestion du troupeau : tirer ou épargner', async () => {
  const { advise } = await import('../src/logic/management.ts');
  assert.equal(advise({ sex: 'femelle', age: 'mur', stars: 5 }).verdict, 'epargner');
  assert.equal(advise({ sex: 'male', age: 'jeune', stars: 1, conditionPct: 10 }).verdict, 'epargner');
  assert.equal(advise({ sex: 'male', age: 'adulte', stars: 1, conditionPct: 25 }).verdict, 'eliminer');
  assert.equal(advise({ sex: 'male', age: 'adulte', stars: 1, conditionPct: 39 }).verdict, 'eliminer');
  assert.equal(advise({ sex: 'male', age: 'adulte', stars: 1, conditionPct: 45 }).verdict, 'surveiller');
  assert.equal(advise({ sex: 'male', age: 'adulte', stars: 1, conditionPct: 50 }).verdict, 'epargner');
  assert.equal(advise({ sex: 'male', age: 'adulte', stars: 1 }).verdict, 'libre');
  assert.equal(advise({ sex: 'male', age: 'adulte', stars: 3 }).verdict, 'epargner');
  assert.equal(advise({ sex: 'male', age: 'mur', stars: 3 }).verdict, 'trophee');
  assert.equal(advise({ sex: 'male', age: 'mur', stars: 5 }).verdict, 'trophee');
  assert.equal(advise({ sex: 'male', age: 'mur', stars: 2 }).verdict, 'libre');
});
