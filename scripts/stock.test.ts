import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buy, createAccount, creditCash } from '../src/logic/ledger.ts';
import { receiveBar, withdrawPhysical } from '../src/logic/physical.ts';
import { addStock, adjustStock, parseSerials, stockCount, stockSummary } from '../src/logic/stock.ts';

const p = { gold: 100, silver: 1, platinum: 30 };
const close = (a: number, b: number, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} ≉ ${b}`);
const base = () => creditCash(buy(createAccount('T'), p, 'gold', { unit: 'g', value: 100 }), 500);

test('stock : lots par quantité, au coffre de la société ou en coffre professionnel', () => {
  let a = base();
  a = addStock(a, { product: 'g10', qty: 100, source: 'maison', unitCost: 1199.83 });
  a = addStock(a, { product: 'g10', qty: 10, source: 'pro', vault: 'Godot & Fils' });
  a = addStock(a, { product: 'nap20', qty: 50, source: 'maison' });
  assert.deepEqual(stockCount(a, 'g10'), { maison: 100, pro: 10 });
  assert.equal(stockSummary(a).length, 2);
  assert.equal(a.stockLog!.length, 3);
  assert.equal(a.stock![1].vault, 'Godot & Fils');
  assert.throws(() => addStock(a, { product: 'g10', qty: 0, source: 'maison' }));
  assert.throws(() => addStock(a, { product: 'g10', qty: 1.5, source: 'maison' }));
  assert.throws(() => addStock(a, { product: 'g10', qty: 20000, source: 'maison' }));
});

test('stock : numéros de série connus, format PAMP, doublons refusés', () => {
  assert.deepEqual(parseSerials('C841201\nC386511, C558479;  \n'), ['C841201', 'C386511', 'C558479']);
  let a = base();
  a = addStock(a, { product: 'g10', qty: 3, source: 'maison', serials: ['c841201', 'C 386511'] });
  assert.deepEqual(a.stock![0].serials, ['C841201', 'C386511']); // le troisième sera noté à l'expédition
  assert.throws(() => addStock(a, { product: 'g10', qty: 2, source: 'maison', serials: ['C841201'] }), /déjà/);
  assert.throws(
    () => addStock(a, { product: 'g10', qty: 2, source: 'maison', serials: ['C1', 'C2'] }),
    /format|PAMP|C/,
  );
  assert.throws(
    () => addStock(a, { product: 'g10', qty: 1, source: 'maison', serials: ['C479203', 'C615837'] }),
    /trop/,
  );
  assert.throws(
    () => addStock(a, { product: 'g10', qty: 2, source: 'maison', serials: ['C702914', 'C702914'] }),
    /déjà/,
  );
  // Les millésimes d'une pièce se répètent : pas de contrôle de doublon.
  addStock(a, { product: 'nap20', qty: 2, source: 'maison', serials: ['1910', '1910'] });
});

test('stock : un retrait prend dans le stock de la société, puis le coffre professionnel, sinon commande', () => {
  let a = base();
  a = addStock(a, { product: 'g10', qty: 2, source: 'maison', serials: ['C204518', 'C319760'] });
  a = addStock(a, { product: 'g10', qty: 1, source: 'pro', vault: 'Godot & Fils' });
  a = withdrawPhysical(a, p, { g10: 4 }, new Date('2026-11-16T12:00:00'));
  const origins = a.homeVault!.map((b) => b.origin);
  assert.deepEqual(origins, ['maison', 'maison', 'pro', 'commande']);
  assert.equal(a.homeVault![0].expectedSerial, 'C204518');
  assert.equal(a.homeVault![1].expectedSerial, 'C319760');
  assert.equal(a.homeVault![2].expectedSerial, undefined);
  assert.deepEqual(stockCount(a, 'g10'), { maison: 0, pro: 0 });
  assert.ok(a.stockLog![0].kind === 'out' && a.stockLog![0].qty < 0);
  // Le numéro prévu est confirmé à la réception.
  a = receiveBar(a, a.homeVault![0].id, 'C204518');
  assert.equal(a.homeVault![0].serial, 'C204518');
});

test('stock : sans stock, le retrait marche comme avant', () => {
  let a = base();
  a = withdrawPhysical(a, p, { g5: 1 });
  assert.equal(a.homeVault![0].origin, 'commande');
  assert.equal(a.stock, undefined);
});

test('stock : inventaire, l’écart est noté au journal', () => {
  let a = addStock(base(), { product: 'g20', qty: 10, source: 'maison', serials: ['C410862', 'C526094', 'C638271'] });
  const id = a.stock![0].id;
  a = adjustStock(a, id, 8);
  assert.equal(a.stock![0].qty, 8);
  assert.equal(a.stockLog![0].kind, 'adjust');
  assert.equal(a.stockLog![0].qty, -2);
  a = adjustStock(a, id, 2); // moins d'exemplaires que de numéros connus : les derniers numéros sortent
  assert.equal(a.stock![0].serials!.length, 2);
  assert.throws(() => adjustStock(a, id, -1));
  assert.equal(adjustStock(a, id, 2), a);
});

test('numéros de série : jamais un numéro d’essai (123456, 111111, 121212…)', async () => {
  const { looksFake, serialFormatError } = await import('../src/logic/physical.ts');
  for (const d of ['123456', '654321', '111111', '000000', '234567', '987654', '121212', '012345'])
    assert.ok(looksFake(d), d);
  for (const d of ['841201', '386511', '558479', '313395', '123457', '135791']) assert.ok(!looksFake(d), d);
  assert.match(serialFormatError('g10', 'C123456')!, /essai/);
  assert.match(serialFormatError('g10', 'C111111')!, /essai/);
  assert.equal(serialFormatError('g10', 'C841201'), null);
  const a = base();
  assert.throws(() => addStock(a, { product: 'g10', qty: 1, source: 'maison', serials: ['C123456'] }), /essai/);
  assert.equal(serialFormatError('nap20', '1910'), null); // un millésime n'est pas concerné
});

test('références internes Orvia : une par exemplaire, toujours aléatoires et uniques', () => {
  let a = addStock(base(), { product: 'g10', qty: 100, source: 'maison' });
  const refs = a.stock![0].refs!;
  assert.equal(refs.length, 100);
  assert.equal(new Set(refs).size, 100);
  for (const r of refs) assert.match(r, /^OV-[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}$/);
  // Deux tirages différents ne donnent pas les mêmes références.
  const b = addStock(base(), { product: 'g10', qty: 100, source: 'maison' });
  assert.notDeepEqual(b.stock![0].refs, refs);
  // Le retrait prend la référence du stock ; une commande reçoit la sienne.
  a = withdrawPhysical(a, p, { g10: 1 });
  assert.equal(a.homeVault![0].ref, refs[0]);
  assert.equal(a.stock![0].refs!.length, 99);
  const c = withdrawPhysical(base(), p, { g5: 1 });
  assert.match(c.homeVault![0].ref!, /^OV-/);
});

test('don d’un lingotin à un enfant : il reste chez le parent, seule la propriété change', async () => {
  const { giveBarToChild, barsOfChild, homeVaultTotal, removeBar } = await import('../src/logic/physical.ts');
  const { addChild } = await import('../src/logic/ledger.ts');
  const { childGifts, allowanceUsed } = await import('../src/logic/giftRecap.ts');
  let a = withdrawPhysical(base(), p, { g10: 1, g5: 1 }, new Date('2026-11-16T12:00:00'));
  const added = addChild(a, 'Théo', '2015-06-01');
  a = added.account;
  const childId = added.child.id;
  const b10 = a.homeVault!.find((b) => b.product === 'g10')!;
  const b5 = a.homeVault!.find((b) => b.product === 'g5')!;
  // Un lingotin pas encore reçu (sans numéro) ne peut pas être donné : c'est le numéro qui est cédé.
  assert.throws(() => giveBarToChild(a, p, b10.id, childId), /reçu/);
  a = receiveBar(a, b10.id, 'C841201');
  a = receiveBar(a, b5.id, 'C386511');
  const before = homeVaultTotal(a, p);
  const g = giveBarToChild(a, p, b10.id, childId, new Date('2026-11-17T10:00:00'));
  // L'objet reste dans le coffre maison du parent, au nom de l'enfant.
  assert.equal(g.homeVault!.length, 2);
  assert.equal(barsOfChild(g, childId).length, 1);
  assert.equal(barsOfChild(g, childId)[0].serial, 'C841201');
  assert.equal(barsOfChild(g, childId)[0].giftValue, 1000);
  // Il sort des totaux du parent.
  assert.equal(homeVaultTotal(g, p).count, before.count - 1);
  // Le don est inscrit à la valeur de l'or du jour dans les dons de l'enfant, sans déplacer de métal.
  const child = g.children[0];
  const gifts = childGifts(child);
  assert.equal(gifts.length, 1);
  assert.equal(gifts[0].value, 1000);
  assert.equal(child.holdings.gold, 0);
  assert.equal(allowanceUsed(child, new Date('2026-11-17')).used, 1000);
  // Pas deux fois, et pas de retrait du registre d'un lingotin qui appartient à l'enfant.
  assert.throws(() => giveBarToChild(g, p, b10.id, childId), /déjà/);
  assert.throws(() => removeBar(g, b10.id), /enfant/);
  // L'enfant garde les dates d'achat d'origine (22 ans).
  assert.equal(barsOfChild(g, childId)[0].acquiredFrom, b10.acquiredFrom);
});

test('lieu de garde d’un lingotin : chez vous, coffre en banque, ailleurs', async () => {
  const { giveBarToChild, setBarPlace, placeLabel, PLACE_LABEL } = await import('../src/logic/physical.ts');
  const { addChild } = await import('../src/logic/ledger.ts');
  const { barQrText } = await import('../src/logic/homeVaultDoc.ts');
  let a = withdrawPhysical(base(), p, { g10: 1 }, new Date('2026-11-16T12:00:00'));
  const id = a.homeVault![0].id;
  a = receiveBar(a, id, 'C841201');
  assert.equal(placeLabel(a.homeVault![0]), 'Chez vous');
  assert.deepEqual(Object.values(PLACE_LABEL), ['Chez vous', 'Coffre en banque', 'Autre lieu']);
  a = setBarPlace(a, id, 'banque', 'Banque Dupont, agence centre');
  assert.equal(placeLabel(a.homeVault![0]), 'Coffre en banque · Banque Dupont, agence centre');
  assert.match(barQrText(a.homeVault![0]), /Lieu de garde : Coffre en banque/);
  a = setBarPlace(a, id, 'autre', 'chez ma mère');
  assert.equal(placeLabel(a.homeVault![0]), 'chez ma mère');
  assert.throws(() => setBarPlace(a, 'x', 'maison'));
  // Au moment du don, on choisit où il est gardé.
  const added = addChild(a, 'Théo', '2015-06-01');
  const g = giveBarToChild(added.account, p, id, added.child.id, new Date('2026-11-17T10:00:00'), {
    place: 'banque',
    note: 'Banque Dupont',
  });
  assert.equal(placeLabel(g.homeVault![0]), 'Coffre en banque · Banque Dupont');
  assert.match(g.children[0].transactions[0].label, /coffre en banque/);
  assert.equal(g.homeVault![0].ownerChildId, added.child.id);
});

test('contrôle des lingots : on retrouve un lingotin par son lieu de garde', async () => {
  const { setBarPlace } = await import('../src/logic/physical.ts');
  const { searchBars } = await import('../src/logic/barControl.ts');
  let a = withdrawPhysical(base(), p, { g5: 1, g10: 1 }, new Date('2026-11-16T12:00:00'));
  a = setBarPlace(a, a.homeVault![0].id, 'banque', 'Banque Dupont');
  assert.equal(searchBars(a, 'dupont').length, 1);
  assert.equal(searchBars(a, 'banque').length, 1);
  assert.equal(searchBars(a, 'chez vous').length, 1);
});

test('lot déjà créé : on y colle la liste de numéros du revendeur, ils sortent avec les exemplaires', async () => {
  const { addSerialsToLot } = await import('../src/logic/stock.ts');
  let a = addStock(base(), { product: 'g5', qty: 3, source: 'pro', vault: 'Godot & Fils' });
  const id = a.stock![0].id;
  a = addSerialsToLot(a, id, parseSerials('C841201\nC386511'));
  assert.deepEqual(a.stock![0].serials, ['C841201', 'C386511']);
  a = addSerialsToLot(a, id, ['C558479']);
  assert.equal(a.stock![0].serials!.length, 3);
  assert.throws(() => addSerialsToLot(a, id, ['C313395']), /plus que/); // lot complet
  assert.throws(
    () => addSerialsToLot(addStock(a, { product: 'g5', qty: 2, source: 'pro' }), a.stock![0].id, ['C123456']),
    /essai|plus que/,
  );
  const b = addStock(base(), { product: 'g5', qty: 5, source: 'pro' });
  assert.throws(() => addSerialsToLot(b, b.stock![0].id, ['C123456']), /essai/);
  assert.throws(() => addSerialsToLot(b, b.stock![0].id, ['C841201', 'C841201']), /déjà/);
  assert.throws(() => addSerialsToLot(b, b.stock![0].id, []), /au moins un/);
  // Le retrait emporte le premier numéro du lot.
  const w = withdrawPhysical(a, p, { g5: 1 });
  assert.equal(w.homeVault![0].expectedSerial, 'C841201');
});

test('stock : supprimer un lot (trace au journal) ou effacer tout le stock', async () => {
  const { removeLot, clearStock } = await import('../src/logic/stock.ts');
  let a = addStock(base(), { product: 'g5', qty: 10, source: 'pro', vault: 'Godot & Fils' });
  a = addStock(a, { product: 'g10', qty: 10, source: 'maison' });
  const [l5, l10] = a.stock!;
  const r = removeLot(a, l5.id);
  assert.equal(r.stock!.length, 1);
  assert.equal(r.stock![0].id, l10.id);
  assert.equal(r.stockLog![0].note, 'Lot supprimé');
  assert.equal(r.stockLog![0].qty, -10);
  assert.equal(removeLot(a, 'inconnu'), a);
  const c = clearStock(a);
  assert.equal(c.stock, undefined);
  assert.equal(c.stockLog, undefined);
  assert.equal(stockSummary(c).length, 0);
  // Le compte et ses lingotins ne sont pas touchés.
  assert.equal(c.holdings.gold, a.holdings.gold);
});

test('stockage chez le revendeur : grille en francs suisses depuis le 1er novembre 2026', async () => {
  const { proStockValue, storageStatus, STORAGE_LIMIT } = await import('../src/logic/storageLimit.ts');
  let a = addStock(base(), { product: 'g10', qty: 3, source: 'pro', vault: 'Godot & Fils' });
  a = addStock(a, { product: 'g5', qty: 2, source: 'pro' });
  a = addStock(a, { product: 'g20', qty: 5, source: 'maison' }); // chez soi : pas compté
  close(proStockValue(a, 100), (3 * 10 + 2 * 5) * 100, 1e-6);
  assert.equal(STORAGE_LIMIT.freeChf, 10_000);
  const rate = 1.075;
  const free = storageStatus(4000, rate);
  assert.equal(free.tier, 'free');
  close(free.limitEur, 10750, 1e-6);
  close(free.leftEur, 6750, 1e-6);
  assert.equal(free.yearlyFeeEur, 0);
  // 10 000 CHF pile : encore gratuit ; juste au-dessus : 15 CHF par mois, soit 180 CHF par an.
  assert.equal(storageStatus(10_000 * rate, rate).tier, 'free');
  const mid = storageStatus(12_000 * rate, rate);
  assert.equal(mid.tier, 'mid');
  close(mid.yearlyFeeEur, 180 * rate, 1e-6);
  close(mid.yearlyFeePct, (180 / 12_000) * 100, 1e-6);
  // Au-delà de 40 000 CHF : 0,5 % par an de la valeur.
  const top = storageStatus(60_000 * rate, rate);
  assert.equal(top.tier, 'top');
  close(top.yearlyFeeEur, 60_000 * 0.005 * rate, 1e-6);
  assert.equal(storageStatus(40_000 * rate, rate).tier, 'mid');
});

test('compte enfant : or converti en lingotin gardé chez le revendeur, fabrication payée par le parent', async () => {
  const { convertChildToBars, barsOfChild, isLocked, setBarPlace, removeBar, CHILD_STORAGE_NOTE } =
    await import('../src/logic/physical.ts');
  const { addChild, fundChild, getChild } = await import('../src/logic/ledger.ts');
  const t0 = new Date('2026-11-17T10:00:00');
  let a = creditCash(buy(createAccount('T', new Date('2020-01-01')), p, 'gold', { unit: 'g', value: 50 }), 300);
  const added = addChild(a, 'Théo', '2015-06-01', t0);
  a = fundChild(added.account, p, added.child.id, 'gold', { unit: 'g', value: 20 }, t0);
  const id = added.child.id;
  const cash = a.cashEur ?? 0;
  // Standard : gardé chez Godot & Fils, jamais livré.
  const s = convertChildToBars(a, p, id, { g5: 1 }, false, t0);
  const bar = barsOfChild(s, id)[0];
  assert.equal(bar.ownerChildId, id);
  assert.equal(bar.placeNote, CHILD_STORAGE_NOTE);
  assert.equal(bar.vault, true); // gardé en coffre chez Godot & Fils : mêmes étapes et même coût de garde
  assert.equal(bar.lockedUntil, undefined);
  close(getChild(s, id).holdings.gold, 15, 1e-9); // 5 g retirés de l'or de l'enfant
  assert.equal(s.holdings.gold, a.holdings.gold); // pas de l'or du parent
  // Fabrication seule (pas de livraison), payée depuis le compte d'attente du parent : 11 % de 500 €.
  close(cash - (s.cashEur ?? 0), 55, 0.01);
  assert.ok(!/livraison/i.test(s.transactions[0].label));
  // Sécurité maximale : verrouillé jusqu'à la majorité (1er juin 2033).
  const l = convertChildToBars(a, p, id, { g5: 1 }, true, t0);
  const locked = barsOfChild(l, id)[0];
  assert.equal(locked.lockedUntil!.slice(0, 4), '2033');
  assert.equal(isLocked(locked, t0), true);
  assert.equal(isLocked(locked, new Date('2033-07-01')), false);
  assert.throws(() => setBarPlace(l, locked.id, 'maison', undefined, t0), /Sécurité maximale/);
  assert.throws(() => removeBar(l, locked.id), /enfant/);
  // Refus : pas assez d'or chez l'enfant, compte d'attente vide, pas de date de naissance pour le verrou.
  assert.throws(() => convertChildToBars(a, p, id, { oz1: 1 }, false, t0), /Or insuffisant/);
  assert.throws(() => convertChildToBars({ ...a, cashEur: 1 }, p, id, { g5: 1 }, false, t0), /compte d’attente/);
  const noBirth = addChild(a, 'Léa', undefined, t0);
  const f = fundChild(noBirth.account, p, noBirth.child.id, 'gold', { unit: 'g', value: 10 }, t0);
  assert.throws(() => convertChildToBars(f, p, noBirth.child.id, { g5: 1 }, true, t0), /date de naissance/);
});

test('stockage chez le revendeur : le seuil gratuit est propre à chaque client, enfants compris', async () => {
  const { clientStorage, isAtReseller } = await import('../src/logic/storageLimit.ts');
  const { convertChildToBars } = await import('../src/logic/physical.ts');
  const { addChild, fundChild } = await import('../src/logic/ledger.ts');
  const t0 = new Date('2026-11-17T10:00:00');
  let a = creditCash(buy(createAccount('T', new Date('2020-01-01')), p, 'gold', { unit: 'g', value: 80 }), 400);
  const added = addChild(a, 'Théo', '2015-06-01', t0);
  a = fundChild(added.account, p, added.child.id, 'gold', { unit: 'g', value: 20 }, t0);
  // Un lingotin de l'enfant, gardé chez Godot & Fils ; un lingotin du titulaire, chez lui.
  a = convertChildToBars(a, p, added.child.id, { g10: 1 }, false, t0);
  a = withdrawPhysical(a, p, { g5: 1 }, t0);
  const mine = a.homeVault!.find((b) => !b.ownerChildId)!;
  assert.equal(isAtReseller(mine), false); // chez soi, pas chez le revendeur
  const g = clientStorage(a, 100);
  assert.equal(g.length, 1);
  assert.equal(g[0].ownerChildId, added.child.id);
  close(g[0].valueEur, 1000, 1e-6);
  // Le même titulaire, avec un lingotin gardé chez Godot & Fils, a son propre seuil.
  const stored = a.homeVault!.map((b) => (b.id === mine.id ? { ...b, placeNote: 'Godot & Fils (stockage)' } : b));
  const two = clientStorage({ homeVault: stored }, 100);
  assert.equal(two.length, 2);
  close(two.find((x) => x.ownerChildId === null)!.valueEur, 500, 1e-6);
});

test('garde des lingotins d’un enfant : offerte jusqu’à 18 ans, puis payée par lui en or', async () => {
  const { convertChildToBars } = await import('../src/logic/physical.ts');
  const { addChild, fundChild, getChild, applyDormancy, custodyOffered, childBarGrams } =
    await import('../src/logic/ledger.ts');
  const { FEES } = await import('../src/logic/fees.ts');
  const t0 = new Date('2026-11-17T10:00:00');
  let a = creditCash(buy(createAccount('T', new Date('2020-01-01')), p, 'gold', { unit: 'g', value: 50 }), 300);
  const added = addChild(a, 'Théo', '2008-12-01', t0); // majeur le 1er décembre 2026
  a = fundChild(added.account, p, added.child.id, 'gold', { unit: 'g', value: 20 }, t0);
  const id = added.child.id;
  a = convertChildToBars(a, p, id, { g5: 1 }, false, t0); // 5 g en lingotin, 15 g en grammes
  assert.equal(childBarGrams(a, id), 5);
  // Mineur : garde offerte, valeur chiffrée (grammes et lingotin), rien prélevé.
  const off = custodyOffered(a, getChild(a, id), p, t0);
  assert.equal(off.minor, true);
  close(off.yearly, (15 + 5) * p.gold * FEES.custodyYearly.gold, 1e-6);
  const mid = applyDormancy(
    { ...a, children: a.children.map((c) => ({ ...c, custodyChargedThrough: '2026-11-01T00:00:00.000Z' })) },
    p,
    new Date('2026-12-02T10:00:00'),
  );
  // Après la majorité (décembre 2026), il paie sur ses grammes ET son lingotin, en or, sans dépasser ses grammes.
  const g0 = getChild(mid, id).holdings.gold;
  assert.ok(g0 < 15 - 1e-9, 'la garde de décembre est prélevée sur ses grammes');
  close(15 - g0, (15 + 5) * (FEES.custodyYearly.gold / 12) * 1, 1e-6); // un mois, lingotin compris
  assert.equal(custodyOffered(mid, getChild(mid, id), p, new Date('2026-12-02T10:00:00')).yearly, 0);
});
