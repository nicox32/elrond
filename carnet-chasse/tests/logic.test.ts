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
    needZones: [
      { id: 'z1', speciesId: 'cerf-mulet', reserveId: 'new-laurentia' as const, need: 'boire' as const, startMin: 540, endMin: 690, place: 'lac' },
    ],
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
  assert.equal(advise({ sex: 'male', age: 'jeune', conditionPct: 10 }).verdict, 'eliminer');
  assert.equal(advise({ sex: 'male', age: 'jeune', conditionPct: 45 }).verdict, 'surveiller');
  assert.equal(advise({ sex: 'male', age: 'jeune', conditionPct: 70 }).verdict, 'epargner');
  assert.equal(advise({ sex: 'male', age: 'jeune' }).verdict, 'libre');
  assert.equal(advise({ sex: 'femelle', age: 'jeune', conditionPct: 20 }).verdict, 'possible');
  assert.equal(advise({ sex: 'femelle', age: 'adulte', conditionPct: 60 }).verdict, 'epargner');
  assert.equal(advise({ sex: 'male', age: 'adulte', stars: 1, conditionPct: 25 }).verdict, 'eliminer');
  assert.equal(advise({ sex: 'male', age: 'adulte', stars: 1, conditionPct: 39 }).verdict, 'eliminer');
  assert.equal(advise({ sex: 'male', age: 'adulte', stars: 1, conditionPct: 45 }).verdict, 'surveiller');
  assert.equal(advise({ sex: 'male', age: 'adulte', stars: 1, conditionPct: 50 }).verdict, 'epargner');
  assert.equal(advise({ sex: 'male', age: 'adulte', stars: 1 }).verdict, 'libre');
  assert.equal(advise({ sex: 'male', age: 'adulte', stars: 3 }).verdict, 'epargner');
  assert.equal(advise({ sex: 'male', age: 'mur', stars: 3 }).verdict, 'trophee');
  assert.equal(advise({ sex: 'male', age: 'mur', stars: 5 }).verdict, 'trophee');
  assert.equal(advise({ sex: 'male', age: 'mur', stars: 2 }).verdict, 'eliminer');
  assert.equal(advise({ sex: 'male', age: 'mur', stars: 1 }).verdict, 'eliminer');
});

test('horaires : lecture, routine, zones en cours et réveil', async () => {
  const { parseTime, formatTime, routineAt, isActive, minutesUntil, wakeUpTime, sortByNext } = await import(
    '../src/logic/schedule.ts'
  );
  assert.equal(parseTime('09:00'), 540);
  assert.equal(parseTime('9h30'), 570);
  assert.equal(parseTime('2345'), 23 * 60 + 45);
  assert.equal(parseTime('7'), 420);
  assert.equal(parseTime('24:00'), undefined);
  assert.equal(parseTime('abc'), undefined);
  assert.equal(formatTime(-15), '23:45');
  assert.equal(routineAt(9 * 60).need, 'boire');
  assert.equal(routineAt(13 * 60).need, 'dormir');
  assert.equal(routineAt(17 * 60).need, 'manger');
  assert.equal(routineAt(2 * 60).need, 'nuit');
  assert.equal(routineAt(21 * 60).need, 'nuit');
  const z = { id: 'a', speciesId: 'cerf-mulet', reserveId: 'new-laurentia' as const, need: 'boire' as const, startMin: 540, endMin: 690 };
  const night = { ...z, id: 'b', need: 'dormir' as const, startMin: 22 * 60, endMin: 5 * 60 };
  assert.equal(isActive(z, 600), true);
  assert.equal(isActive(z, 690), false);
  assert.equal(isActive(night, 60), true);
  assert.equal(isActive(night, 6 * 60), false);
  assert.equal(minutesUntil(z, 480), 60);
  assert.equal(minutesUntil(z, 700), 24 * 60 - 160);
  assert.equal(formatTime(wakeUpTime(z)), '08:45');
  assert.equal(formatTime(wakeUpTime({ ...z, startMin: 5 })), '23:50');
  assert.deepEqual(sortByNext([z, night], 23 * 60).map((x) => x.id), ['b', 'a']);
  assert.deepEqual(sortByNext([z, night], 8 * 60).map((x) => x.id), ['a', 'b']);
});

test('sauvegarde : zones de besoin abîmées ignorées', () => {
  const s = parseState({ needZones: [{ id: 'x', speciesId: 'bison', reserveId: 'new-laurentia', need: 'boire', startMin: 9999, endMin: 10 }] });
  assert.equal(s?.needZones.length, 0);
});

test('rapport de chasse : durées, poids après découpe, prix et organes', async () => {
  const { parseDuration, formatDuration, computeNetWeight, estimateMeatPrice, totalEarnings, damagedOrgans } = await import(
    '../src/logic/details.ts'
  );
  assert.equal(parseDuration('9m49s'), 589);
  assert.equal(parseDuration('9 min 49 s'), 589);
  assert.equal(parseDuration('9:49'), 589);
  assert.equal(parseDuration('49s'), 49);
  assert.equal(parseDuration('12m'), 720);
  assert.equal(parseDuration('9:75'), undefined);
  assert.equal(parseDuration('abc'), undefined);
  assert.equal(formatDuration(589), '9 min 49 s');
  // Valeurs de l'écran « Poids et prix » du cerf mulet : 99,78 − 0 − 3,35 − 39,91 = 56,52 kg ; × 2,6 = 146
  const deer = { weightKg: 99.78, timeDegradationKg: 0, shotDegradationKg: 3.35, butcherWasteKg: 39.91, pricePerKg: 2.6 };
  assert.equal(computeNetWeight(deer), 56.52);
  assert.equal(estimateMeatPrice(deer), 146);
  assert.equal(computeNetWeight({ weightKg: 50 }), undefined);
  assert.equal(totalEarnings([hunt({ salePrice: 146 }), hunt({ id: 'x' }), hunt({ id: 'y', salePrice: 54 })]), 200);
  const organs = damagedOrgans(hunt({ organs: { chair: 67.2, 'poumon-droit': 100, 'poumon-gauche': 7.9, os: 1.4, coeur: 0 } }));
  assert.deepEqual(organs.map((o) => o.id), ['poumon-droit', 'chair', 'poumon-gauche', 'os']);
});

test('sauvegarde : champs du rapport conservés, valeurs abîmées ignorées', () => {
  const s = parseState({
    hunts: [
      hunt({
        sex: 'male', conditionPct: 31.7, ageYears: 12, weightKg: 99.78, killTimeMin: 839, trackingTimeSec: 589,
        hunterDetected: false, dogUsed: false, weather: 'Partiellement nuageux', huntRating: 'S++', trophyStars: 1,
        salePrice: 146, outcome: 'vendu', organs: { 'poumon-droit': 100, chair: 67.2 },
        measurements: [{ label: 'Longueur du merrain', value: 134 }],
      }),
      hunt({ id: 'bad', sex: 'x' as never, trophyStars: 9, killTimeMin: 5000, weightKg: -3, organs: { chair: 'a' } as never }),
    ],
  });
  const [a, b] = s!.hunts;
  assert.equal(a.sex, 'male');
  assert.equal(a.conditionPct, 31.7);
  assert.equal(a.killTimeMin, 839);
  assert.equal(a.hunterDetected, false);
  assert.equal(a.huntRating, 'S++');
  assert.equal(a.organs?.['poumon-droit'], 100);
  assert.deepEqual(a.measurements, [{ label: 'Longueur du merrain', value: 134 }]);
  assert.equal(b.sex, undefined);
  assert.equal(b.trophyStars, undefined);
  assert.equal(b.killTimeMin, undefined);
  assert.equal(b.weightKg, undefined);
  assert.equal(b.organs, undefined);
});

test('fiche du cerf mulet : routine, énergie recommandée', async () => {
  const { getSpeciesInfo, routineSlots, checkEnergy, energyKindFor, formatRange } = await import('../src/data/speciesInfo.ts');
  const info = getSpeciesInfo('cerf-mulet');
  assert.ok(info);
  assert.deepEqual(routineSlots(info!).map((r) => `${r.need} ${r.from}-${r.to}`), [
    'boire 0-2', 'dormir 2-7', 'manger 7-12', 'boire 12-16', 'dormir 16-20', 'manger 20-0',
  ]);
  assert.equal(energyKindFor('carabine'), 'balle');
  assert.equal(checkEnergy(info, 'balle', 2138), 'ok');
  assert.equal(checkEnergy(info, 'balle', 1200), 'faible');
  assert.equal(checkEnergy(info, 'balle', 4500), 'forte');
  assert.equal(checkEnergy(info, 'fleche', 150), 'ok');
  assert.equal(checkEnergy(undefined, 'balle', 2000), undefined);
  assert.equal(formatRange(info!.energy.grenaille, 'J'), 'Inadapté');
  assert.equal(getSpeciesInfo('lion'), undefined);
});

test('troupeau : verdicts, résumé, un seul mâle par session', async () => {
  const { summarizeHerd, malesTakenToday, sortAnimals, adviceFor, daysSince } = await import('../src/logic/herds.ts');
  const now = new Date('2026-11-11T20:00:00');
  const A = (o: object) => ({ id: Math.random().toString(36), label: '', status: 'vivant', lastSeen: now.toISOString(), ...o });
  const herd = {
    id: 'h', name: 'Lac', speciesId: 'cerf-mulet', reserveId: 'new-laurentia' as const, createdAt: '2026-11-01T00:00:00Z', lastVisit: '2026-11-09T12:00:00',
    animals: [
      A({ id: 'vieux', sex: 'male', age: 'mur', stars: 1, conditionPct: 31.7 }),
      A({ id: 'beau', sex: 'male', age: 'mur', stars: 4 }),
      A({ id: 'jeune', sex: 'male', age: 'jeune', conditionPct: 70 }),
      A({ id: 'biche', sex: 'femelle', age: 'adulte', conditionPct: 60 }),
      A({ id: 'pris', sex: 'male', age: 'adulte', stars: 1, conditionPct: 20, status: 'preleve', takenAt: '2026-11-11T09:00:00' }),
    ],
  };
  const s = summarizeHerd(herd as never);
  assert.equal(s.alive, 4);
  assert.equal(s.males, 3);
  assert.equal(s.females, 1);
  assert.equal(s.taken, 1);
  assert.equal(s.byVerdict.eliminer, 1);
  assert.equal(s.byVerdict.trophee, 1);
  assert.equal(s.byVerdict.epargner, 2);
  assert.equal(adviceFor(herd.animals[0] as never).verdict, 'eliminer');
  assert.equal(malesTakenToday(herd as never, now), 1);
  assert.equal(malesTakenToday(herd as never, new Date('2026-11-12T08:00:00')), 0);
  const order = sortAnimals(herd.animals as never).map((a: { id: string }) => a.id);
  assert.deepEqual(order.slice(0, 2), ['vieux', 'beau']);
  assert.equal(order[4], 'pris');
  assert.equal(daysSince(herd.lastVisit, now), 2);
});

test('sauvegarde : troupeaux conservés, animaux abîmés ignorés', () => {
  const s = parseState({
    herds: [
      { id: 'h', name: 'Lac', speciesId: 'cerf-mulet', reserveId: 'new-laurentia', createdAt: '2026-11-01', population: 'stable',
        animals: [
          { id: 'a', sex: 'male', age: 'mur', stars: 1, conditionPct: 31.7, status: 'vivant', lastSeen: '2026-11-11' },
          { id: 'b', sex: 'x', age: 'mur', lastSeen: '2026-11-11' },
          { id: 'c', sex: 'femelle', age: 'jeune', stars: 9, conditionPct: 150, lastSeen: '2026-11-11' },
        ] },
      { id: 'sans-nom', speciesId: 'cerf-mulet', reserveId: 'new-laurentia', createdAt: '2026-11-01' },
    ],
  });
  assert.equal(s?.herds.length, 1);
  const h = s!.herds[0];
  assert.equal(h.population, 'stable');
  assert.equal(h.lastVisit, '2026-11-01');
  assert.deepEqual(h.animals.map((a) => a.id), ['a', 'c']);
  assert.equal(h.animals[1].stars, undefined);
  assert.equal(h.animals[1].conditionPct, undefined);
  assert.equal(h.animals[1].status, 'vivant');
});

test('fiches perso : lecture de la sauvegarde et fusion avec les fiches fournies', async () => {
  const { getSpeciesInfo, checkEnergy, routineSlots } = await import('../src/data/speciesInfo.ts');
  const s = parseState({
    speciesSheets: {
      wapiti: {
        animalClass: 7, trophyType: 'Bois', trophyRange: [200, 100],
        energy: { balle: [2000, 5000], grenaille: null, slug: [3, 'x'] },
        routine: [{ hour: 12, need: 'dormir' }, { hour: 5, need: 'boire' }, { hour: 30, need: 'manger' }],
        senses: { vue: 'Bon(ne)' },
      },
      'cerf-mulet': { energy: { balle: [1400, 3900] }, animalClass: undefined },
      cassée: 'pas un objet',
    },
  });
  const w = s!.speciesSheets.wapiti;
  assert.equal(w.animalClass, 7);
  assert.equal(w.trophyRange, undefined); // min > max refusé
  assert.deepEqual(w.energy, { balle: [2000, 5000], grenaille: null });
  assert.deepEqual(w.routine, [{ hour: 5, need: 'boire' }, { hour: 12, need: 'dormir' }]);
  assert.deepEqual(w.senses, { vue: 'Bon(ne)', odorat: '', ouie: '' });
  assert.equal('cassée' in s!.speciesSheets, false);

  const wapiti = getSpeciesInfo('wapiti', s!.speciesSheets);
  assert.equal(checkEnergy(wapiti, 'balle', 2500), 'ok');
  assert.deepEqual(routineSlots(wapiti!).map((r) => `${r.from}-${r.to}`), ['5-12', '12-5']);
  // La fiche perso du cerf mulet corrige la balle, garde le reste de la fiche fournie.
  const mulet = getSpeciesInfo('cerf-mulet', s!.speciesSheets);
  assert.deepEqual(mulet!.energy.balle, [1400, 3900]);
  assert.deepEqual(mulet!.energy.slug, [700, 3000]);
  assert.equal(mulet!.animalClass, 6);
  assert.equal(getSpeciesInfo('lion', s!.speciesSheets), undefined);
});

test('troupeau à revoir toutes les 24 h', async () => {
  const { isVisitDue } = await import('../src/logic/herds.ts');
  const herd = (lastVisit: string) => ({ lastVisit }) as never;
  const now = new Date('2026-11-12T10:00:00Z');
  assert.equal(isVisitDue(herd('2026-11-11T10:00:01Z'), now), false);
  assert.equal(isVisitDue(herd('2026-11-11T10:00:00Z'), now), true);
  assert.equal(isVisitDue(herd('2026-11-09T08:00:00Z'), now), true);
});
