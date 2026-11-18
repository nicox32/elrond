import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buy, createAccount, creditCash, LedgerError, minOrderError, quoteBuy, sell } from '../src/logic/ledger.ts';
import { FEES } from '../src/logic/fees.ts';
import { isWeekendClosed } from '../src/logic/market.ts';
import { cancelOrder, placeOrder, runPendingOrders } from '../src/logic/orders.ts';
import {
  homeVaultTotal,
  physicalFeesOf,
  quoteWithdrawal,
  receiveBar,
  vendorPremiumFrom,
  vendorTierOff,
  fabricationProgress,
  normalizeDeliveryTiers,
  lotUnitCost,
  QTY_RANGES,
  BAR_PRODUCTS,
  vendorDeliveryCost,
  requestVaultExit,
  confirmVaultExit,
  GODOT_AGENCIES,
  agencyLabel,
  productOf,
  withdrawPhysical,
} from '../src/logic/physical.ts';
import { holdingLots } from '../src/logic/tax.ts';
import { companyReport } from '../src/logic/company.ts';

const p = { gold: 100, silver: 1, platinum: 30 };
const close = (a: number, b: number, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} ≉ ${b}`);

test('retrait physique : lingotins d’or, frais depuis le compte d’attente, registre du coffre maison', () => {
  let a = createAccount('T', new Date('2020-01-01'));
  a = buy(a, p, 'gold', { unit: 'g', value: 12 }, new Date('2020-03-01T12:00:00'));
  a = buy(a, p, 'gold', { unit: 'g', value: 20 }, new Date('2024-06-01T12:00:00'));
  const q = quoteWithdrawal(p, { g10: 2, g5: 1 });
  assert.equal(q.grams, 25);
  close(q.premium, 10 * 100 * 0.075 * 2 + 5 * 100 * 0.11);
  close(q.fees, 150 + 55, 0.01); // 25 g : livraison offerte (dès 20 g)
  close(quoteWithdrawal(p, { g10: 1 }).fees, 75 + 12, 0.01); // 10 g seul : livraison 12 €
  // Frais à payer depuis le compte d'attente : vide → refusé (payer en or serait une vente imposée).
  assert.throws(() => withdrawPhysical(a, p, { g10: 2, g5: 1 }), LedgerError);
  a = creditCash(a, 250);
  // Plus d'or que disponible : refusé.
  assert.throws(() => withdrawPhysical(a, p, { oz1: 2 }), /Or insuffisant/);
  const now = new Date('2026-11-16T12:00:00');
  const w = withdrawPhysical(a, p, { g10: 2, g5: 1 }, now);
  close(w.holdings.gold, 7);
  close(w.cashEur!, 250 - q.fees, 0.01);
  assert.equal(w.transactions[0].kind, 'withdraw_physical');
  assert.equal(w.transactions[0].tax, undefined); // pas une vente
  assert.equal(w.homeVault!.length, 3);
  // Premier entré, premier sorti : 5 g puis 7 g de l'or de 2020, le reste de 2024.
  const bars = w.homeVault!;
  assert.equal(bars[0].grams, 5);
  assert.equal(bars[0].acquiredTo.slice(0, 4), '2020');
  close(bars[0].cost, (5 * 100) / (1 - FEES.buy.gold), 0.01); // prix de revient d'origine, frais compris
  assert.equal(bars[1].acquiredFrom.slice(0, 4), '2020');
  assert.equal(bars[1].acquiredTo.slice(0, 4), '2024');
  assert.equal(bars[2].acquiredFrom.slice(0, 4), '2024');
  // Le coffre ne contient plus que l'or de 2024 restant.
  close(
    holdingLots(w).gold.reduce((s, l) => s + l.grams, 0),
    7,
  );
  const r = receiveBar(w, bars[0].id, ' c 841-201 ');
  assert.equal(r.homeVault![0].serial, 'C841201');
  assert.equal(r.homeVault![0].status, 'received');
  assert.throws(() => receiveBar(w, bars[0].id, ' '), LedgerError);
  assert.deepEqual(homeVaultTotal(r, p).grams, 25);
  const rep = companyReport(r, p, 'all', now);
  close(rep.revenue.physical, q.fees, 0.01);
});

test('minimum d’achat 10 € sur le total, supplément du week-end, ordres passés lundi', () => {
  assert.match(minOrderError(9.99) ?? '', /10 €/);
  assert.equal(minOrderError(10), null);
  // Supplément immédiat du week-end : 0,5 % de plus sur les frais.
  const normal = quoteBuy(p, 'gold', { unit: 'eur', value: 100 });
  const weekend = quoteBuy(p, 'gold', { unit: 'eur', value: 100 }, 0.005);
  close(weekend.fees - normal.fees, 0.5, 0.01);
  // Samedi : fermé ; lundi 10 h : ouvert.
  assert.equal(isWeekendClosed(new Date('2026-11-14T12:00:00')), true);
  assert.equal(isWeekendClosed(new Date('2026-11-16T10:00:00')), false);
  let a = buy(createAccount('T', new Date('2026-11-01')), p, 'gold', { unit: 'g', value: 10 });
  assert.throws(() => placeOrder(a, { kind: 'buy', metal: 'gold', q: { unit: 'eur', value: 5 } }), /minimum/);
  a = placeOrder(a, { kind: 'buy', metal: 'silver', q: { unit: 'eur', value: 20 } });
  a = placeOrder(a, { kind: 'split', amounts: { gold: 15, silver: 5 } }); // 5 € d'argent : permis dans un achat de 20 €
  a = placeOrder(a, { kind: 'sell', metal: 'gold', q: { unit: 'g', value: 100 } }); // trop : refusé lundi
  const cancel = placeOrder(a, { kind: 'buy', metal: 'gold', q: { unit: 'eur', value: 30 } });
  assert.equal(cancelOrder(cancel, cancel.pendingOrders!.at(-1)!.id).pendingOrders!.length, 3);
  const monday = { gold: 101, silver: 1.02, platinum: 30 };
  const r = runPendingOrders(a, monday, new Date('2026-11-16T10:00:00'));
  assert.equal(r.account.pendingOrders!.length, 0);
  const labels = r.account.transactions.filter((t) => t.label.includes('ordre du week-end')).map((t) => t.label);
  assert.equal(labels.length, 3); // argent + or et argent répartis
  assert.equal(r.notices.length, 2);
  assert.match(r.notices[1].body, /Vente/);
  // L'ordre passe au cours de lundi.
  const silverBuy = r.account.transactions.find((t) => t.label.startsWith('Achat d’argent') && t.eur === 20)!;
  close(silverBuy.deltas.silver, (20 * (1 - FEES.buy.silver)) / 1.02, 1e-5);
  // Une vente immédiate du week-end porte le supplément dans son libellé.
  const s = sell(a, p, 'gold', { unit: 'g', value: 1 }, 'deferred', new Date(), 0.005);
  assert.match(s.transactions[0].label, /week-end immédiat/);
});

test('Napoléon 20 F : 5,806 g d’or fin, prime indicative, millésime au coffre maison', async () => {
  const { napoleonPrice } = await import('../src/logic/physical.ts');
  const n = napoleonPrice(100);
  close(n.metal, 580.6);
  close(n.withPremium, 580.6 * 1.075);
  // 4 Napoléons = 23,2 g d'or : livraison offerte (dès 20 g).
  const q = quoteWithdrawal(p, { nap20: 4 });
  close(q.grams, 23.224);
  assert.equal(q.delivery, 0);
  let a = creditCash(buy(createAccount('T'), p, 'gold', { unit: 'g', value: 10 }), 100);
  a = withdrawPhysical(a, p, { nap20: 1 });
  a = receiveBar(a, a.homeVault![0].id, '1910');
  assert.equal(a.homeVault![0].serial, '1910');
  close(a.holdings.gold, 10 - 5.806);
});

test('coffre maison : fiche QR de chaque objet et inventaire imprimable', async () => {
  const { barQrText, homeVaultHtml } = await import('../src/logic/homeVaultDoc.ts');
  const { qrMatrix } = await import('../src/logic/qr.ts');
  let a = creditCash(
    buy(
      createAccount('T', new Date('2019-03-01')),
      p,
      'gold',
      { unit: 'g', value: 30 },
      new Date('2019-03-04T12:00:00'),
    ),
    300,
  );
  a = withdrawPhysical(a, p, { g10: 1, nap20: 1 }, new Date('2026-11-16T12:00:00'));
  a = receiveBar(a, a.homeVault![0].id, 'c 841-201', new Date('2026-11-20T12:00:00'));
  const text = barQrText(a.homeVault![0]);
  assert.match(text, /Lingotin 10 g/);
  assert.match(text, /N° de série : C841201/);
  assert.match(text, /Exonéré de plus-value en 2041/);
  assert.match(text, /pas un certificat d’authenticité/);
  assert.match(barQrText(a.homeVault![1]), /Millésime : à noter|N° de série : à noter/);
  assert.ok(qrMatrix(text).length >= 21);
  const html = homeVaultHtml(a, p, new Date('2026-11-20T12:00:00'));
  assert.equal((html.match(/<svg /g) ?? []).length, 2);
  assert.match(html, /Inventaire du coffre maison/);
  assert.match(html, /2 objets/);
});

test('fiche technique : lingotin 5 g PAMP Suisse et Napoléon, dans la fiche QR', async () => {
  const { productOf, specLine } = await import('../src/logic/physical.ts');
  const { barQrText } = await import('../src/logic/homeVaultDoc.ts');
  assert.equal(specLine(productOf('g5').spec), 'PAMP Suisse · or 999,9 · 23,3 × 14 × 0,79 mm');
  assert.equal(specLine(productOf('nap20').spec), 'Monnaie de Paris · or 900 ‰ · Ø 21 mm');
  assert.equal(specLine(productOf('g10').spec), 'PAMP Suisse · or 999,9 · 26,5 × 15,8 × 1,25 mm');
  assert.equal(specLine(productOf('g20').spec), 'PAMP Suisse · or 999,9 · 32 × 18 × 1,88 mm');
  assert.equal(specLine(productOf('oz1').spec), 'PAMP Suisse · or 999,9 · 41 × 24 × 1,66 mm');
  const a = withdrawPhysical(creditCash(buy(createAccount('T'), p, 'gold', { unit: 'g', value: 10 }), 100), p, {
    g5: 1,
  });
  assert.match(barQrText(a.homeVault![0]), /PAMP Suisse · or 999,9 · 23,3 × 14 × 0,79 mm/);
  assert.match(barQrText(a.homeVault![0]), /à vérifier avec PAMP VERISCAN/);
  assert.equal(productOf('nap20').spec?.veriscan, undefined);
});

test('frais du retrait réglables : fabrication par format, livraison, coût vendeur et marge', async () => {
  const { physicalFeesOf, physicalFeeRows, productPrice, productOf } = await import('../src/logic/physical.ts');
  const { companyReport } = await import('../src/logic/company.ts');
  // Valeurs par défaut : 5 g à 11 % (prime vendeur 9,78 % relevée le 18/11/2026), livraison 12 € (7 € payés au vendeur).
  const def = physicalFeesOf();
  assert.equal(def.premiums.g5, 0.11);
  assert.equal(def.vendor.g5, 0.0901);
  assert.equal(def.vendorDelivery, 7);
  assert.equal(def.delivery, 12);
  assert.equal(def.freeFromGrams, 20);
  const q5 = quoteWithdrawal(p, { g5: 1 }, def);
  close(q5.premium, 5 * 100 * 0.11, 1e-9);
  close(q5.fees, 55 + 12, 0.01);
  close(q5.cost!, 5 * 100 * 0.0901 + 7, 1e-9); // lingotin payé au vendeur + sa livraison
  // Coût inconnu si un format sans prime vendeur : pas de coût calculé.
  assert.equal(def.vendor.g10, 0.0652);
  assert.equal(def.vendor.g20, 0.05);
  assert.equal(def.vendor.oz1, 0.0401);
  assert.equal(def.vendor.nap20, 0.0485);
  close(quoteWithdrawal(p, { nap20: 1 }, def).cost!, 5.806 * 100 * 0.0485 + 7, 0.01);
  close(quoteWithdrawal(p, { g5: 1, g10: 1 }, def).cost!, 5 * 100 * 0.0901 + 10 * 100 * 0.0652 + 7, 1e-9);
  // Réglages de Société Orvia : fabrication, livraison, seuil.
  const custom = physicalFeesOf({
    physicalFees: { premiums: { g5: 0.08 }, vendor: { g10: 0.05 }, delivery: 20, freeFromGrams: 50 },
  });
  assert.equal(custom.premiums.g5, 0.08);
  assert.equal(custom.premiums.g10, 0.075); // inchangé
  assert.equal(custom.vendor.g5, 0.0901); // valeur par défaut gardée
  assert.equal(custom.vendor.g10, 0.05);
  const q = quoteWithdrawal(p, { g10: 2 }, custom); // 20 g : livraison offerte seulement dès 50 g
  assert.equal(q.delivery, 20);
  close(q.cost!, 2 * 10 * 100 * 0.05 + 7, 1e-9);
  close(productPrice(productOf('g5'), 100, 0.08).withPremium, 540);
  // Retrait enregistré avec ses frais réglés et son coût pour Orvia.
  let a = creditCash(
    buy(
      createAccount('T', new Date('2020-01-01')),
      p,
      'gold',
      { unit: 'g', value: 20 },
      new Date('2020-02-01T12:00:00'),
    ),
    100,
  );
  a = { ...a, settings: { ...a.settings, physicalFees: { premiums: { g5: 0.1 } } } };
  a = withdrawPhysical(a, p, { g5: 1 }, new Date('2026-11-16T12:00:00'));
  close(a.transactions[0].fees!, 50 + 12, 0.01);
  close(a.transactions[0].costEur!, 5 * 100 * 0.0901 + 7, 0.01);
  const r = companyReport(a, p, 'all', new Date('2026-11-17T12:00:00'));
  close(r.costs.physical, 5 * 100 * 0.0901 + 7, 0.01);
  close(r.revenue.physical, 62, 0.01);
  // Grille des Tarifs avec les frais en vigueur.
  const rows = physicalFeeRows(physicalFeesOf(a.settings));
  assert.equal(rows[0].orvia, 'Fabrication 10 %');
  assert.match(rows[5].orvia, /12 € par envoi, offerte dès 20 g/);
});

test('prime vendeur d\u2019après la page du revendeur', () => {
  close(vendorPremiumFrom(698.91, 42.83, 0)!, 0.0653, 1e-4); // avec les frais en euros
  close(vendorPremiumFrom(698.91, null, 656.08)!, 0.0653, 1e-4); // sans les frais : prix ÷ valeur de l'or − 1
  assert.equal(vendorPremiumFrom(0, null, 100), null);
  assert.equal(vendorPremiumFrom(100, 150, 100), null); // frais supérieurs au prix
  assert.equal(vendorPremiumFrom(100, null, 0), null);
  assert.equal(vendorPremiumFrom(300, null, 100), null); // écart absurde
});

test('inventaire imprimable : chaque objet porte la photo de son format', async () => {
  const { homeVaultHtml } = await import('../src/logic/homeVaultDoc.ts');
  const { BAR_PHOTOS } = await import('../src/logic/barPhotos.ts');
  let a = creditCash(buy(createAccount('T'), p, 'gold', { unit: 'g', value: 60 }), 900);
  a = withdrawPhysical(a, p, { g5: 1, g20: 1, oz1: 1 });
  const html = homeVaultHtml(a, p);
  for (const id of ['g5', 'g20', 'oz1']) assert.ok(html.includes(BAR_PHOTOS[id]), `photo ${id}`);
  assert.ok(!html.includes(BAR_PHOTOS.g10));
  assert.equal(new Set(Object.values(BAR_PHOTOS)).size, 5); // cinq photos différentes
});

test('solde : retirer un lingotin ne fait pas baisser le total (le physique est compté)', async () => {
  const { accountValue, physicalValue, recordBalance } = await import('../src/logic/ledger.ts');
  const { giveBarToChild } = await import('../src/logic/physical.ts');
  const { addChild } = await import('../src/logic/ledger.ts');
  const t0 = new Date('2026-11-16T10:00:00');
  let a = creditCash(buy(createAccount('T'), p, 'gold', { unit: 'g', value: 20 }, t0), 500);
  a = recordBalance(a, p, t0);
  const before = a.balanceHistory[a.balanceHistory.length - 1].total;
  a = withdrawPhysical(a, p, { g5: 1 }, new Date('2026-11-16T12:00:00'));
  const after = recordBalance(a, p, new Date('2026-11-17T12:00:00')).balanceHistory.at(-1)!.total;
  // 5 g d'or sont sortis du coffre mais comptés au physique : le total est inchangé au cours près (revente 0,8 %).
  const numeric = accountValue(a, p).total;
  close(physicalValue(a, p), 5 * 100);
  close(after, numeric + 500, 1e-6);
  assert.ok(Math.abs(after - before) < 5 * 100 * 0.01 + 1, `${after} vs ${before}`);
  // Un lingotin donné à un enfant n'est plus compté chez le parent.
  const withChild = addChild(a, 'Théo', '2015-06-01');
  let b = receiveBar(withChild.account, withChild.account.homeVault![0].id, 'C204518');
  b = giveBarToChild(b, p, b.homeVault![0].id, withChild.child.id, new Date('2026-11-17T13:00:00'));
  assert.equal(physicalValue(b, p), 0);
});

test('commande par lots : prix du lot selon sa tranche, prix client indépendant de la quantité retirée', () => {
  const def = physicalFeesOf();
  const g10 = productOf('g10');
  // Les remises du revendeur dépendent de la taille du lot commandé : 9 pièces, pas de palier.
  assert.equal(vendorTierOff(g10, 9), 0);
  close(vendorTierOff(g10, 10), 0.0054, 1e-12);
  close(vendorTierOff(g10, 49), 0.008, 1e-12);
  close(vendorTierOff(g10, 50), 0.0161, 1e-12);
  // Prix attendu d'un lot de 10 g : or du jour + prime de base moins la remise de la tranche.
  close(lotUnitCost('g10', 9, p.gold, def), 10 * p.gold * (1 + 0.0652), 1e-9);
  close(lotUnitCost('g10', 20, p.gold, def), 10 * p.gold * (1 + 0.0652 - 0.008), 1e-9);
  close(lotUnitCost('g10', 50, p.gold, def), 10 * p.gold * (1 + 0.0652 - 0.0161), 1e-9);
  // Le client paie la même fabrication quel que soit le nombre de pièces retirées : plus de remise de quantité.
  const one = quoteWithdrawal(p, { g10: 1 }, def);
  const fifty = quoteWithdrawal(p, { g10: 50 }, def);
  close(one.premium / 1, 10 * p.gold * 0.075, 1e-9);
  close(fifty.premium / 50, 10 * p.gold * 0.075, 1e-9);
  assert.equal(fifty.volume, false);
  assert.equal(fifty.clientDiscount, 0);
  assert.equal(fifty.vendorDiscount, 0);
  // Sans stock, chaque pièce est commandée à l'unité : coût de la prime de base, + livraison.
  close(fifty.cost!, 50 * 10 * p.gold * 0.0652 + def.vendorDelivery, 1e-6);
  // Napoléon : mêmes tranches que les autres formats (1-9, 10-19, 20-49, 50 et plus).
  const nap = productOf('nap20');
  assert.equal(vendorTierOff(nap, 9), 0);
  assert.equal(vendorTierOff(nap, 10), 0.0015);
  assert.equal(vendorTierOff(nap, 49), 0.0015);
  assert.equal(vendorTierOff(nap, 50), 0.0023);
  assert.equal(vendorTierOff(nap, 500), 0.0023);
  // Les mêmes quatre tranches pour tous les lingotins et pièces.
  assert.deepEqual(
    QTY_RANGES.map((r) => r.label),
    ['1 à 9', '10 à 19', '20 à 49', '50 et plus'],
  );
  for (const x of BAR_PRODUCTS)
    assert.deepEqual(
      x.vendorTiers!.map((t) => t.from),
      [10, 20, 50],
    );
  // Réglage de la société : la remise d'une tranche se change pour un produit.
  const fees = physicalFeesOf({ physicalFees: { vendorTiers: { g10: [{ from: 10, off: 0.01 }] } } });
  close(lotUnitCost('g10', 10, p.gold, fees), 10 * p.gold * (1 + 0.0652 - 0.01), 1e-9);
  assert.equal(fees.vendorTiers.g5.length, 3); // les autres produits gardent leurs valeurs
});

test('retrait en agence : pas de livraison, ni facturée au client ni payée au revendeur, agence notée sur les lingotins', () => {
  const def = physicalFeesOf();
  const home = quoteWithdrawal(p, { g5: 1 }, def);
  const agency = quoteWithdrawal(p, { g5: 1 }, def, true);
  assert.equal(home.delivery, def.delivery);
  assert.equal(agency.delivery, 0);
  assert.equal(agency.pickup, true);
  close(home.fees - agency.fees, def.delivery, 1e-9);
  close(home.cost! - agency.cost!, def.vendorDelivery, 1e-9);
  let acc = createAccount('T', new Date('2020-01-01'));
  acc = buy(acc, p, 'gold', { unit: 'g', value: 12 }, new Date('2020-03-01T12:00:00'));
  acc = creditCash(acc, 500);
  const out = withdrawPhysical(acc, p, { g5: 2 }, new Date('2026-11-18T10:00:00'), ' Lyon ');
  assert.ok(out.homeVault!.every((b) => b.pickupAgency === 'Lyon'));
  assert.match(out.transactions[0].label, /en agence \(Lyon\)/);
  close(out.cashEur!, 500 - quoteWithdrawal(p, { g5: 2 }, def, true).fees, 0.01);
  assert.throws(() => withdrawPhysical(acc, p, { g5: 1 }, new Date(), ' '), /agence/i);
  // Sans agence : livraison à domicile, aucune agence notée.
  const home2 = withdrawPhysical(acc, p, { g5: 1 }, new Date('2026-11-18T10:00:00'));
  assert.equal(home2.homeVault![0].pickupAgency, undefined);
});

test('lingotin en fabrication : étapes estimées selon les jours réels, arrivé au bout de 8 jours', () => {
  const ordered = '2026-11-16T10:00:00';
  assert.equal(fabricationProgress(ordered, new Date('2026-11-16T18:00:00')).step, 0);
  assert.equal(fabricationProgress(ordered, new Date('2026-11-17T09:00:00')).step, 1);
  assert.equal(fabricationProgress(ordered, new Date('2026-11-20T09:00:00')).step, 2); // 4 jours
  const day7 = fabricationProgress(ordered, new Date('2026-11-23T09:00:00'));
  assert.equal(day7.days, 7);
  assert.equal(day7.step, 2);
  const day8 = fabricationProgress(ordered, new Date('2026-11-24T09:00:00'));
  assert.equal(day8.days, 8);
  assert.equal(day8.step, 3);
  assert.equal(day8.ratio, 1);
  assert.equal(fabricationProgress(ordered, new Date('2026-12-01T09:00:00'), true).label, 'Prêt en agence');
});

test('agences Godot & Fils : libellés uniques, adresse notée quand elle est connue', () => {
  const labels = GODOT_AGENCIES.map(agencyLabel);
  assert.equal(new Set(labels).size, labels.length);
  assert.equal(
    agencyLabel({ name: 'Nantes', address: '22 rue des Halles, 44000' }),
    'Nantes · 22 rue des Halles, 44000',
  );
  assert.equal(agencyLabel({ name: 'Hyères' }), 'Hyères');
  assert.ok(GODOT_AGENCIES.some((a) => a.name === 'Paris 2 (siège)'));
});

test('garde en coffre chez Godot & Fils : ni livraison ni agence, lingotin marqué en coffre, coût de garde pour Orvia', async () => {
  const { CHILD_STORAGE_NOTE } = await import('../src/logic/physical.ts');
  const { companyReport } = await import('../src/logic/company.ts');
  let acc = createAccount('T', new Date('2020-01-01'));
  acc = buy(acc, p, 'gold', { unit: 'g', value: 12 }, new Date('2020-03-01T12:00:00'));
  acc = creditCash(acc, 500);
  const now = new Date('2026-11-18T10:00:00');
  const out = withdrawPhysical(acc, p, { g5: 1 }, now, undefined, true);
  const bar = out.homeVault![0];
  assert.equal(bar.vault, true);
  assert.equal(bar.pickupAgency, undefined);
  assert.equal(bar.placeNote, CHILD_STORAGE_NOTE);
  assert.match(out.transactions[0].label, /gardé en coffre chez Godot/);
  // Pas de livraison facturée au client.
  close(500 - out.cashEur!, quoteWithdrawal(p, { g5: 1 }, physicalFeesOf(), true).fees, 0.01);
  assert.equal(quoteWithdrawal(p, { g5: 1 }, physicalFeesOf(), true).delivery, 0);
  // Étapes propres au coffre.
  assert.equal(
    fabricationProgress(bar.orderedAt, new Date('2026-12-01T10:00:00'), true, true).label,
    'Entré au coffre',
  );
  // Garde de ce lingotin : coût pour Orvia, au gramme.
  const r = companyReport(out, p, 'year', new Date('2027-11-18T10:00:00'));
  assert.ok(r.costs.custody >= 5 * 0.48 - 1e-6);
});

test('ancien revendeur : les comptes enregistrés citant Gold Avenue passent à Godot & Fils', async () => {
  const { migrateAccount } = await import('../src/logic/ledger.ts');
  let acc = createAccount('T', new Date('2020-01-01'));
  acc = {
    ...acc,
    homeVault: [
      {
        id: 'b1',
        product: 'g5',
        grams: 5,
        orderedAt: '2026-11-01T10:00:00.000Z',
        status: 'received',
        cost: 500,
        acquiredFrom: '2025-01-01T00:00:00.000Z',
        acquiredTo: '2025-01-01T00:00:00.000Z',
        txId: 't',
        placeNote: 'Gold Avenue (stockage sécurisé)',
      },
    ],
    stock: [
      {
        id: 'l1',
        product: 'g10',
        qty: 2,
        source: 'pro',
        vault: 'Gold Avenue',
        addedAt: '2026-11-01T10:00:00.000Z',
      } as any,
    ],
  };
  const m = migrateAccount(JSON.parse(JSON.stringify(acc)))!;
  assert.equal(m.homeVault![0].placeNote, 'Godot & Fils, stockage sécurisé');
  assert.equal(m.stock![0].vault, 'Godot & Fils');
  assert.ok(!JSON.stringify(m).match(/gold ?avenue/i));
});

test('retrait d’un lingotin gardé en coffre : à domicile (12 €) ou en agence (gratuit), puis remise en main', () => {
  let acc = createAccount('T', new Date('2020-01-01'));
  acc = buy(acc, p, 'gold', { unit: 'g', value: 30 }, new Date('2020-03-01T12:00:00'));
  acc = creditCash(acc, 500);
  const t0 = new Date('2026-11-01T10:00:00');
  acc = withdrawPhysical(acc, p, { g5: 1, g20: 1 }, t0, undefined, true);
  const [b5, b20] = acc.homeVault!.map((b) => b.id);
  // Pas encore entré au coffre : impossible.
  assert.throws(() => requestVaultExit(acc, b5, 'home', undefined, t0), /pas encore entré/);
  acc = receiveBar(acc, b5, 'C841201', t0);
  acc = receiveBar(acc, b20, 'C841202', t0);
  const cash0 = acc.cashEur!;
  // Agence : gratuit, agence obligatoire.
  assert.throws(() => requestVaultExit(acc, b5, 'agency', ' ', t0), /agence/i);
  const ag = requestVaultExit(acc, b5, 'agency', 'Nantes', t0);
  assert.equal(ag.cashEur, cash0);
  assert.equal(ag.homeVault!.find((b) => b.id === b5)!.exitRequest!.agency, 'Nantes');
  // Un seul retrait à la fois par lingotin.
  assert.throws(() => requestVaultExit(ag, b5, 'agency', 'Nantes', t0), /déjà demandé/);
  // Domicile : 12 € pour un 5 g, offerte pour un 20 g.
  const home5 = requestVaultExit(acc, b5, 'home', undefined, t0);
  close(cash0 - home5.cashEur!, 12, 0.01);
  const home20 = requestVaultExit(acc, b20, 'home', undefined, t0);
  assert.equal(home20.cashEur, cash0);
  // Compte d'attente vide : refusé pour une livraison payante.
  assert.throws(() => requestVaultExit({ ...acc, cashEur: 5 }, b5, 'home', undefined, t0), /créditez/);
  // Remise en main : le lingotin quitte le coffre et passe chez le client.
  const out = confirmVaultExit(home5, b5, new Date('2026-11-10T10:00:00'));
  const bar = out.homeVault!.find((b) => b.id === b5)!;
  assert.equal(bar.vault, undefined);
  assert.equal(bar.exitRequest, undefined);
  assert.equal(bar.place, 'maison');
  assert.ok(bar.exitedAt);
  // Un lingotin d'enfant n'est jamais livré.
  const child = { ...acc, homeVault: acc.homeVault!.map((b) => (b.id === b5 ? { ...b, ownerChildId: 'c1' } : b)) };
  assert.throws(() => requestVaultExit(child, b5, 'home', undefined, t0), /enfant/);
});

test('livraison payée au vendeur : selon la valeur de la commande, par paliers réglables', () => {
  // Par défaut : 7 € pour toute commande.
  const def = physicalFeesOf();
  assert.deepEqual(def.vendorDeliveryTiers, [{ fromEur: 0, cost: 7 }]);
  assert.equal(vendorDeliveryCost(50_000, def), 7);
  // Paliers : 7 € jusqu'à 1 000 €, 12 € dès 1 000 €, 20 € dès 5 000 €.
  const custom = physicalFeesOf({
    physicalFees: {
      vendorDeliveryTiers: [
        { fromEur: 5000, cost: 20 },
        { fromEur: 0, cost: 7 },
        { fromEur: 1000, cost: 12 },
      ],
    },
  });
  assert.deepEqual(
    custom.vendorDeliveryTiers.map((t) => t.fromEur),
    [0, 1000, 5000],
  ); // triés
  assert.equal(vendorDeliveryCost(999.99, custom), 7);
  assert.equal(vendorDeliveryCost(1000, custom), 12);
  assert.equal(vendorDeliveryCost(4999, custom), 12);
  assert.equal(vendorDeliveryCost(5000, custom), 20);
  // Un premier palier qui ne commence pas à 0 : il couvre aussi les petites commandes.
  assert.equal(normalizeDeliveryTiers([{ fromEur: 500, cost: 9 }], 7)[0].fromEur, 0);
  assert.equal(normalizeDeliveryTiers([], 7)[0].cost, 7);
  assert.equal(
    normalizeDeliveryTiers(
      [
        { fromEur: -1, cost: 3 },
        { fromEur: 10, cost: Number.NaN },
      ],
      7,
    )[0].cost,
    7,
  );
  // Dans la commande : un 5 g (≈ 545 € chez le revendeur) coûte 7 €, quatre 10 g (> 1 000 €) coûtent 12 €.
  const small = quoteWithdrawal(p, { g5: 1 }, custom);
  const big = quoteWithdrawal(p, { g10: 4 }, custom);
  const goods = (q: ReturnType<typeof quoteWithdrawal>) =>
    q.lines.reduce((t, l) => t + l.value + (l.vendorCost ?? 0), 0);
  assert.ok(goods(small) < 1000 && goods(big) >= 1000);
  close(small.cost! - small.lines[0].vendorCost!, 7, 1e-9);
  close(big.cost! - big.lines.reduce((t, l) => t + (l.vendorCost ?? 0), 0), 12, 1e-9);
  // Retrait en agence : aucune livraison.
  close(
    quoteWithdrawal(p, { g10: 4 }, custom, true).cost! - big.lines.reduce((t, l) => t + (l.vendorCost ?? 0), 0),
    0,
    1e-9,
  );
});

test('retrait servi du stock : le lot le plus ancien part en premier, coût de la prime pris sur le lot', async () => {
  const { addStock } = await import('../src/logic/stock.ts');
  let acc = createAccount('T', new Date('2020-01-01'));
  acc = buy(acc, p, 'gold', { unit: 'g', value: 30 }, new Date('2020-03-01T12:00:00'));
  acc = creditCash(acc, 1000);
  // Lot récent saisi en premier, lot ancien ensuite : le plus ancien (par date d'entrée) doit sortir d'abord.
  acc = addStock(
    acc,
    { product: 'g5', qty: 1, source: 'maison', unitCost: 5 * 90 * 1.05, goldPrice: 90 },
    new Date('2026-11-10T10:00:00'),
  );
  acc = addStock(
    acc,
    { product: 'g5', qty: 1, source: 'maison', unitCost: 5 * 100 * 1.08, goldPrice: 100 },
    new Date('2026-11-01T10:00:00'),
  );
  const [recent, old] = acc.stock!.map((l) => l.id);
  const out = withdrawPhysical(acc, p, { g5: 1 }, new Date('2026-11-18T10:00:00'));
  assert.equal(out.homeVault![0].lotId, old);
  assert.equal(out.stock!.find((l) => l.id === old)!.qty, 0);
  assert.equal(out.stock!.find((l) => l.id === recent)!.qty, 1);
  // Coût de la prime = prix du lot ancien moins le métal à la date d'achat : 5 × 100 × 1,08 − 5 × 100 = 40 €.
  close(out.transactions[0].costEur!, 40, 0.01);
  // Le lot suivant sert le retrait d'après, à son propre prix : 5 × 90 × 1,05 − 5 × 90 = 22,5 €.
  const out2 = withdrawPhysical(out, p, { g5: 1 }, new Date('2026-11-19T10:00:00'));
  assert.equal(out2.homeVault![1].lotId, recent);
  close(out2.transactions[0].costEur!, 22.5, 0.01);
  // Sans stock : commande à l'unité au prix de base, avec la livraison du vendeur.
  const out3 = withdrawPhysical(out2, p, { g5: 1 }, new Date('2026-11-20T10:00:00'));
  assert.equal(out3.homeVault![2].origin, 'commande');
  close(out3.transactions[0].costEur!, 5 * p.gold * 0.0901 + 7, 0.01);
});
