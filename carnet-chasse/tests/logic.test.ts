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

test('calculateur : stratégie âge + condition', async () => {
  const { advise } = await import('../src/logic/management.ts');
  const v = (o: object) => advise(o as never).verdict;
  // Jeunes : priorité n°1 sous 50 % (40 % en mode prudent)
  assert.equal(v({ sex: 'male', age: 'jeune', conditionPct: 45 }), 'eliminer');
  assert.equal(v({ sex: 'male', age: 'jeune', conditionPct: 45, youngCutoff: 40 }), 'epargner');
  assert.equal(v({ sex: 'male', age: 'jeune', conditionPct: 39, youngCutoff: 40 }), 'eliminer');
  assert.equal(v({ sex: 'male', age: 'jeune', conditionPct: 60 }), 'epargner');
  assert.equal(v({ sex: 'male', age: 'jeune' }), 'libre');
  // Adultes : médians et bons gardés
  assert.equal(v({ sex: 'male', age: 'adulte', conditionPct: 30 }), 'eliminer');
  assert.equal(v({ sex: 'male', age: 'adulte', conditionPct: 40 }), 'epargner');
  assert.equal(v({ sex: 'male', age: 'adulte', conditionPct: 70 }), 'epargner');
  assert.match(advise({ sex: 'male', age: 'adulte', conditionPct: 85 } as never).title, /haut fitness/);
  // Femelles : très faibles (sous 40 %) ou en dernière année
  assert.equal(v({ sex: 'femelle', age: 'adulte', conditionPct: 20 }), 'eliminer');
  assert.equal(v({ sex: 'femelle', age: 'adulte', conditionPct: 45 }), 'epargner');
  // Âgés
  assert.match(advise({ sex: 'male', age: 'mur', conditionPct: 85 } as never).reason, /haut fitness/);
  assert.equal(v({ sex: 'male', age: 'mur', conditionPct: 31.7 }), 'eliminer');
  assert.equal(v({ sex: 'male', age: 'mur', conditionPct: 45 }), 'surveiller');
  assert.equal(v({ sex: 'male', age: 'mur', conditionPct: 45, lifeStage: 'derniere' }), 'eliminer');
  assert.equal(v({ sex: 'male', age: 'mur', conditionPct: 60 }), 'epargner');
  assert.equal(v({ sex: 'male', age: 'mur', conditionPct: 60, lifeStage: 'avant-derniere' }), 'epargner');
  assert.equal(v({ sex: 'male', age: 'mur', conditionPct: 60, lifeStage: 'derniere' }), 'trophee');
  // Femelles : très faibles (sous 40 %) ou en dernière année
  assert.equal(v({ sex: 'femelle', age: 'jeune', conditionPct: 10 }), 'eliminer');
  assert.equal(v({ sex: 'femelle', age: 'jeune' }), 'epargner');
  assert.equal(v({ sex: 'femelle', age: 'mur', lifeStage: 'derniere' }), 'eliminer');
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

test('dégâts aux organes : plusieurs tirs, valeurs 0 à 100 %', async () => {
  const { organShots } = await import('../src/logic/details.ts');
  assert.equal(organShots(hunt({})).length, 1);
  const shots = organShots(hunt({ organs: { chair: 72.6 }, moreShots: [{ coeur: 100 }] }));
  assert.deepEqual(shots, [{ chair: 72.6 }, { coeur: 100 }]);
  const s = parseState({
    hunts: [hunt({ organs: { chair: 72.6, artere: 150 }, moreShots: [{ os: 0.9 }, { chair: 'x' } as never, 'bad' as never] })],
  });
  assert.deepEqual(s!.hunts[0].organs, { chair: 72.6 });
  assert.deepEqual(s!.hunts[0].moreShots, [{ os: 0.9 }]);
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
      A({ id: 'beau', sex: 'male', age: 'mur', stars: 4, conditionPct: 70, lifeStage: 'derniere' }),
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

test('troupeau : tente la plus proche conservée dans la sauvegarde', () => {
  const s = parseState({ herds: [{ id: 'h', name: 'Lac', speciesId: 'cerf-mulet', reserveId: 'new-laurentia', createdAt: '2026-11-01', camp: 'Tente de la crête', animals: [] }] });
  assert.equal(s?.herds[0].camp, 'Tente de la crête');
});

test('carte interactive : liens Shackmaps par réserve', async () => {
  const { mapUrlFor, isMapUrl, isAllowedHost, isHubOnly, DEFAULT_MAP_URLS } = await import('../src/logic/maps.ts');
  assert.equal(mapUrlFor('new-laurentia', {}), 'https://www.shackmaps.com/way-of-the-hunter-2/new-laurentia');
  assert.equal(isHubOnly('kilimaya', {}), true);
  const saved = { kilimaya: 'https://www.shackmaps.com/way-of-the-hunter-2/kilimaya-reserve' };
  assert.equal(mapUrlFor('kilimaya', saved), saved.kilimaya);
  assert.equal(isHubOnly('kilimaya', saved), false);
  assert.equal(isMapUrl('https://www.shackmaps.com/x'), true);
  assert.equal(isMapUrl('http://www.shackmaps.com/x'), false);
  assert.equal(isMapUrl('https://evil.com/shackmaps.com'), false);
  assert.equal(isMapUrl('https://shackmaps.com.evil.com/'), false);
  assert.equal(isAllowedHost('https://www.shacknews.com/article/1'), true);
  assert.equal(isAllowedHost('https://ads.example.com/'), false);
  assert.equal(DEFAULT_MAP_URLS.headquarters.startsWith('https://www.shackmaps.com/'), true);
  const s = parseState({ mapUrls: { kilimaya: saved.kilimaya, headquarters: 'https://evil.com', inconnu: 'https://www.shackmaps.com/a' } });
  assert.deepEqual(s?.mapUrls, { kilimaya: saved.kilimaya });
});

test('fourrures rares et lien condition / qualité des trophées', async () => {
  const { isRareCoat, conditionVsTrophy } = await import('../src/logic/details.ts');
  for (const c of ['Albinos', 'albinisme', 'Leucique', 'Mélanique', 'melanisme', 'Érythrique', 'erythrisme']) assert.equal(isRareCoat(c), true, c);
  for (const c of ['Standard', '', undefined]) assert.equal(isRareCoat(c), false, String(c));
  const bands = conditionVsTrophy([
    hunt({ id: 'a', conditionPct: 31.7, trophyScore: 100, trophyStars: 1 }),
    hunt({ id: 'b', conditionPct: 20, trophyScore: 80, trophyStars: 1 }),
    hunt({ id: 'c', conditionPct: 85, trophyScore: 400, trophyStars: 4 }),
    hunt({ id: 'd', trophyScore: 999 }),
  ]);
  assert.deepEqual(bands.map((b) => b.count), [2, 0, 1]);
  assert.equal(bands[0].avgScore, 90);
  assert.equal(bands[0].avgStars, 1);
  assert.equal(bands[1].avgScore, undefined);
  assert.equal(bands[2].avgScore, 400);
});

test('troupeau : robe de l’animal conservée dans la sauvegarde', () => {
  const s = parseState({ herds: [{ id: 'h', name: 'Lac', speciesId: 'cerf-mulet', reserveId: 'new-laurentia', createdAt: '2026-11-01',
    animals: [{ id: 'a', sex: 'male', age: 'mur', coat: 'Mélanique', lastSeen: '2026-11-11' }] }] });
  assert.equal(s?.herds[0].animals[0].coat, 'Mélanique');
});

test('armurerie : calibres, munitions compatibles, classes', async () => {
  const { caliberKey, sameCaliber, ammoForCaliber, allAmmo, getWeaponSheet, parseClassRange, classFits, formatClassRange } = await import(
    '../src/data/armory.ts'
  );
  assert.equal(caliberKey('.308 Win'), caliberKey('.308 Winchester'));
  assert.equal(sameCaliber('.375 H&H Magnum', '.375 H&H'), true);
  assert.equal(sameCaliber('6,5x55 Swedish', '6.5x55'), true);
  assert.equal(sameCaliber('.30-06 Springfield', '.308 Winchester'), false);
  assert.equal(sameCaliber('.22 LR', '.22 lr'), true);
  assert.deepEqual(ammoForCaliber('.308 Win', {}).map((a) => a.name), [
    'Lewellings Firefly Shock', 'Lewellings Nucleus Break', 'Lewellings Grande Swift',
  ]);
  assert.equal(ammoForCaliber('.243 Win', {}).length, 0);
  const sheets = {
    'lewellings-grande-swift-308': { id: 'lewellings-grande-swift-308', name: 'Lewellings Grande Swift', caliber: '.308 Winchester', precision: 'Standard', photoUri: 'file:///photos/m.jpg' },
    'perso-1': { id: 'perso-1', name: 'Ma balle', caliber: '.243 Win', classRange: [2, 4] as [number, number], custom: true },
  };
  const all = allAmmo(sheets);
  assert.equal(all.length, 4);
  const swift = all.find((a) => a.id === 'lewellings-grande-swift-308')!;
  assert.equal(swift.precision, 'Standard');
  assert.deepEqual(swift.classRange, [3, 5]); // la correction garde les données fournies
  assert.equal(ammoForCaliber('.243 Win', sheets)[0].name, 'Ma balle');
  const mk2 = getWeaponSheet('primacy-classic-hunter-mk2', { 'primacy-classic-hunter-mk2': { photoUri: 'x' } });
  assert.equal(mk2?.magazine, 4);
  assert.equal(mk2?.photoUri, 'x');
  assert.deepEqual(parseClassRange('3-6'), [3, 6]);
  assert.deepEqual(parseClassRange('4'), [4, 4]);
  assert.equal(parseClassRange('6-3'), undefined);
  assert.equal(classFits(6, [3, 6]), true);
  assert.equal(classFits(6, [3, 5]), false);
  assert.equal(classFits(undefined, [3, 5]), undefined);
  assert.equal(formatClassRange([4, 6]), '4-6');
});

test('sauvegarde : fiches d’armes, munitions et stock', () => {
  const s = parseState({
    weaponSheets: { mk2: { magazine: 4, classRange: [3, 6], precision: 'Supérieur(e)', photoUri: 'file:///p.jpg' }, bad: 'x' },
    ammoSheets: { 'perso-1': { name: 'Ma balle', caliber: '.243 Win', classRange: [5, 2], custom: true }, vide: { name: 'Sans calibre' } },
    ownedAmmoIds: ['perso-1', 'perso-1', 7],
  });
  assert.equal(s?.weaponSheets.mk2.magazine, 4);
  assert.deepEqual(s?.weaponSheets.mk2.classRange, [3, 6]);
  assert.equal('bad' in s!.weaponSheets, false);
  assert.equal(s?.ammoSheets['perso-1'].classRange, undefined);
  assert.equal(s?.ammoSheets['perso-1'].custom, true);
  assert.equal('vide' in s!.ammoSheets, false);
  assert.deepEqual(s?.ownedAmmoIds, ['perso-1']);
});

test('munitions à prendre selon la classe de l’animal', async () => {
  const { ammoForAnimalClass } = await import('../src/data/armory.ts');
  const six = ammoForAnimalClass(6, {}, ['lewellings-nucleus-break-308']);
  assert.deepEqual(six.map((a) => a.name), ['Lewellings Nucleus Break', 'Lewellings Firefly Shock']);
  assert.deepEqual(ammoForAnimalClass(3, {}, []).map((a) => a.name), ['Lewellings Grande Swift']);
  assert.deepEqual(ammoForAnimalClass(undefined, {}, []), []);
});

test('classes des espèces de New Laurentia et munitions adaptées', async () => {
  const { speciesClass } = await import('../src/data/speciesInfo.ts');
  const { SPECIES } = await import('../src/data/game.ts');
  const { ammoForAnimalClass } = await import('../src/data/armory.ts');
  const nl = SPECIES.filter((s) => s.reserveId === 'new-laurentia');
  assert.ok(nl.every((s) => typeof s.animalClass === 'number'));
  assert.equal(speciesClass('colvert'), 1);
  assert.equal(speciesClass('cerf-mulet'), 6);
  assert.equal(speciesClass('bison'), 8);
  assert.equal(speciesClass('wapiti', { wapiti: { energy: {}, animalClass: 6 } }), 6); // la fiche recopiée prime
  assert.equal(speciesClass('lion'), undefined);
  // Grande Swift (3-5) convient au glouton, au loup, au sanglier… mais pas au cerf mulet (6).
  const swift = (cls: number) => ammoForAnimalClass(cls, {}, []).some((a) => a.name === 'Lewellings Grande Swift');
  assert.equal(swift(speciesClass('carcajou')!), true);
  assert.equal(swift(speciesClass('sanglier')!), true);
  assert.equal(swift(speciesClass('cerf-mulet')!), false);
});

test('le QG partage 5 espèces avec New Laurentia sans les compter deux fois', async () => {
  const { speciesOfReserve, HUNTING_RESERVES, SPECIES } = await import('../src/data/game.ts');
  assert.deepEqual(speciesOfReserve('headquarters').map((s) => s.id).sort(), ['cerf-mulet', 'colvert', 'lagopede', 'lievre', 'wapiti']);
  assert.equal(speciesOfReserve('new-laurentia').length, 15);
  assert.equal(SPECIES.length, 29);
  assert.deepEqual(HUNTING_RESERVES.map((r) => r.id), ['new-laurentia', 'kilimaya', 'headquarters']);
  const hq = overview([hunt({ id: 'q', reserveId: 'headquarters', speciesId: 'wapiti' })], SPECIES, 'headquarters');
  assert.equal(hq.speciesTotal, 5);
  assert.equal(hq.speciesHunted, 1);
});

test('sauvegarde : valeurs perso des menus', () => {
  const s = parseState({ customChoices: { coat: ['Pie', ' Pie ', '', 4, 'Tachetée'], vide: [], pasliste: 'x' } });
  assert.deepEqual(s?.customChoices, { coat: ['Pie', 'Tachetée'] });
});

test('sauvegarde : ancien « fin de vie » repris comme dernière année', () => {
  const s = parseState({ herds: [{ id: 'h', name: 'Lac', speciesId: 'cerf-mulet', reserveId: 'new-laurentia', createdAt: '2026-11-01',
    animals: [{ id: 'a', sex: 'male', age: 'mur', endOfLife: true, lastSeen: '2026-11-11' }, { id: 'b', sex: 'male', age: 'mur', lifeStage: 'avant-derniere', lastSeen: '2026-11-11' }] }],
    prudent: true });
  assert.equal(s?.herds[0].animals[0].lifeStage, 'derniere');
  assert.equal(s?.herds[0].animals[1].lifeStage, 'avant-derniere');
  assert.equal(s?.prudent, true);
});

test('calculateur : âge en années et espérance de vie', async () => {
  const { advise, lifeFromAge, isMatureByAge } = await import('../src/logic/management.ts');
  assert.deepEqual(lifeFromAge(12, 13), { stage: 'derniere', yearsLeft: 1 });
  assert.deepEqual(lifeFromAge(11, 13), { stage: 'avant-derniere', yearsLeft: 2 });
  assert.deepEqual(lifeFromAge(5, 13), { stage: 'normal', yearsLeft: 8 });
  assert.equal(lifeFromAge(5, undefined), undefined);
  assert.equal(isMatureByAge(8, 7), true);
  assert.equal(isMatureByAge(6, 7), false);
  assert.equal(isMatureByAge(6, undefined), undefined);
  // Âgé en bonne forme : l'âge seul fait passer en dernière année → à prélever pour le trophée.
  const old = advise({ sex: 'male', age: 'mur', conditionPct: 60, ageYears: 12, lifespanYears: 13 });
  assert.equal(old.verdict, 'trophee');
  assert.match(old.reason, /reste environ 1 an à vivre, soit 3 jours en jeu/);
  // L'âge calculé l'emporte sur un moment de vie saisi à la main.
  assert.equal(advise({ sex: 'male', age: 'mur', conditionPct: 60, lifeStage: 'derniere', ageYears: 5, lifespanYears: 13 }).verdict, 'epargner');
  // Femelle : dernière année d'après l'âge.
  assert.equal(advise({ sex: 'femelle', age: 'mur', ageYears: 13, lifespanYears: 13 }).verdict, 'eliminer');
  // Sans espérance de vie, l'âge est seulement rappelé.
  assert.match(advise({ sex: 'male', age: 'jeune', conditionPct: 30, ageYears: 2 }).reason, /2 ans\.$/);
  const s = parseState({ speciesSheets: { 'cerf-mulet': { energy: {}, matureAgeYears: 7, lifespanYears: 'x' } }, herds: [] });
  assert.equal(s!.speciesSheets['cerf-mulet'].matureAgeYears, 7);
  assert.equal(s!.speciesSheets['cerf-mulet'].lifespanYears, undefined);
});
