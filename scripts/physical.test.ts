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
  assert.equal(def.vendor.g5, 0.0978);
  assert.equal(def.vendorDelivery, 7);
  assert.equal(def.delivery, 12);
  assert.equal(def.freeFromGrams, 20);
  const q5 = quoteWithdrawal(p, { g5: 1 }, def);
  close(q5.premium, 5 * 100 * 0.11, 1e-9);
  close(q5.fees, 55 + 12, 0.01);
  close(q5.cost!, 5 * 100 * 0.0978 + 7, 1e-9); // lingotin payé au vendeur + sa livraison
  // Coût inconnu si un format sans prime vendeur : pas de coût calculé.
  assert.equal(def.vendor.g10, 0.064);
  assert.equal(def.vendor.g20, 0.0653);
  assert.equal(def.vendor.oz1, 0.0519);
  assert.equal(def.vendor.nap20, 0.0653);
  close(quoteWithdrawal(p, { nap20: 1 }, def).cost!, 5.806 * 100 * 0.0653 + 7, 0.01);
  close(quoteWithdrawal(p, { g5: 1, g10: 1 }, def).cost!, 5 * 100 * 0.0978 + 10 * 100 * 0.064 + 7, 1e-9);
  // Réglages de Société Orvia : fabrication, livraison, seuil.
  const custom = physicalFeesOf({
    physicalFees: { premiums: { g5: 0.08 }, vendor: { g10: 0.05 }, delivery: 20, freeFromGrams: 50 },
  });
  assert.equal(custom.premiums.g5, 0.08);
  assert.equal(custom.premiums.g10, 0.075); // inchangé
  assert.equal(custom.vendor.g5, 0.0978); // valeur par défaut gardée
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
  close(a.transactions[0].costEur!, 5 * 100 * 0.0978 + 7, 0.01);
  const r = companyReport(a, p, 'all', new Date('2026-11-17T12:00:00'));
  close(r.costs.physical, 5 * 100 * 0.0978 + 7, 0.01);
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

test('remise du revendeur : prime −0,15 point dès 5 pièces commandées, coût en moins pour Orvia, prix client inchangé', () => {
  const def = physicalFeesOf();
  assert.equal(def.volumeFrom, 5);
  close(def.volumeDiscount, 0.0015, 1e-12);
  // 4 pièces : pas de remise du revendeur.
  const four = quoteWithdrawal(p, { g10: 4 }, def);
  assert.equal(four.volume, false);
  assert.equal(four.vendorDiscount, 0);
  close(four.premium, 4 * 10 * 100 * 0.075, 1e-9); // prix client : 7,5 %
  close(four.cost!, 4 * 10 * 100 * 0.064 + 7, 1e-9);
  // 5 pièces : le client paie toujours 7,5 %, mais la prime du vendeur passe de 6,4 % à 6,25 %.
  const five = quoteWithdrawal(p, { g10: 5 }, def);
  assert.equal(five.volume, true);
  close(five.premium, 5 * 10 * 100 * 0.075, 1e-9);
  close(five.cost!, 5 * 10 * 100 * (0.064 - 0.0015) + 7, 1e-9);
  close(five.vendorDiscount, 5 * 10 * 100 * 0.0015, 0.01);
  close(five.fees, (four.fees / 4) * 5, 0.01); // frais du client proportionnels : pas de remise pour lui
  // Les pièces de formats différents comptent ensemble ; la remise se règle.
  assert.equal(quoteWithdrawal(p, { g5: 2, g10: 2, nap20: 1 }, def).pieces, 5);
  assert.equal(quoteWithdrawal(p, { g10: 5 }, { ...def, volumeDiscount: 0 }).volume, false);
  const custom = physicalFeesOf({ physicalFees: { volumeFrom: 3, volumeDiscount: 0.002 } });
  assert.equal(quoteWithdrawal(p, { g10: 3 }, custom).volume, true);
});
