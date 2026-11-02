// Tests de l'estimation fiscale à la revente. Lancer : npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { FEES } from '../src/logic/fees.ts';
import { buy, createAccount, sell } from '../src/logic/ledger.ts';
import { estimateTax, fullYears, holdingAllowance, holdingLots, TAX } from '../src/logic/tax.ts';

const close = (a: number, b: number, eps = 0.02) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);

test('abattement : rien les 2 premières années, 5 % par an ensuite, exonération après 22 ans', () => {
  assert.equal(holdingAllowance(0), 0);
  assert.equal(holdingAllowance(2), 0);
  close(holdingAllowance(3), 0.05, 1e-9);
  close(holdingAllowance(5), 0.15, 1e-9);
  close(holdingAllowance(21), 0.95, 1e-9);
  assert.equal(holdingAllowance(22), 1);
  assert.equal(holdingAllowance(30), 1);
  assert.equal(fullYears(new Date('2021-01-05'), new Date('2026-01-04')), 4);
  assert.equal(fullYears(new Date('2021-01-05'), new Date('2026-01-05')), 5);
});

test('lots en premier entré, premier sorti', () => {
  let acc = buy(
    createAccount('T'),
    { gold: 100, silver: 1, platinum: 30 },
    'gold',
    { unit: 'g', value: 10 },
    new Date('2021-01-05'),
  );
  acc = buy(acc, { gold: 200, silver: 1, platinum: 30 }, 'gold', { unit: 'g', value: 10 }, new Date('2025-01-05'));
  acc = sell(
    acc,
    { gold: 200, silver: 1, platinum: 30 },
    'gold',
    { unit: 'g', value: 15 },
    'deferred',
    new Date('2025-06-01'),
  );
  const lots = holdingLots(acc).gold;
  assert.equal(lots.length, 1);
  close(lots[0].grams, 5, 1e-6);
  assert.equal(lots[0].date.slice(0, 10), '2025-01-05');
});

test('impôt : le régime le moins cher est retenu, plus-value en euros et en %', () => {
  const now = new Date('2026-11-02');
  // 1 000 € d'or achetés en 2021 à 100 €/g, revendus à 300 €/g : forte plus-value, 5 ans de détention
  const acc = buy(
    createAccount('T'),
    { gold: 100, silver: 1, platinum: 30 },
    'gold',
    { unit: 'eur', value: 1000 },
    new Date('2021-06-01'),
  );
  const est = estimateTax(acc, { gold: 300, silver: 1, platinum: 30 }, now);
  const g = est.metals[0];
  const value = acc.holdings.gold * 300 * (1 - FEES.sale);
  close(g.value, value);
  close(g.cost, 1000);
  close(g.gain, value - 1000);
  close(g.gainPercent, ((value - 1000) / 1000) * 100);
  close(g.flatTax, value * 0.115);
  close(g.gainTax, (value - 1000) * 0.85 * 0.376); // 15 % d'abattement
  assert.equal(g.best, g.gainTax < g.flatTax ? 'gain' : 'flat');
  close(est.tax, Math.min(g.flatTax, g.gainTax));
  close(est.netGain, value - est.tax - 1000);

  // Moins-value : 0 € au régime des plus-values, qui l'emporte sur la taxe forfaitaire
  const loss = estimateTax(acc, { gold: 80, silver: 1, platinum: 30 }, now);
  assert.equal(loss.metals[0].best, 'gain');
  assert.equal(loss.tax, 0);
  assert.ok(loss.gain < 0);

  // Faible plus-value récente : la plus-value à 37,6 % reste moins chère que 11,5 % du prix de vente
  const recent = buy(
    createAccount('T'),
    { gold: 100, silver: 1, platinum: 30 },
    'gold',
    { unit: 'eur', value: 1000 },
    new Date('2026-01-01'),
  );
  const r = estimateTax(recent, { gold: 110, silver: 1, platinum: 30 }, now).metals[0];
  assert.equal(r.best, 'gain');
  close(TAX.flat + 0, 0.115, 1e-9);
});

test('impôt retenu automatiquement à chaque cession, au régime le moins cher', async () => {
  const { addBeneficiary, cardPay, convert, issueCard, transferToIban } = await import('../src/logic/ledger.ts');
  const start = new Date('2021-06-01');
  const now = new Date('2026-11-02');
  const low = { gold: 100, silver: 1, platinum: 30 };
  const high = { gold: 300, silver: 3, platinum: 30 };
  const acc = buy(createAccount('T'), low, 'gold', { unit: 'eur', value: 1000 }, start);

  // Vente de 1 g : prix de cession 297,60 €, la taxe forfaitaire (34,22 €) est moins chère que la plus-value
  const sold = sell(acc, high, 'gold', { unit: 'g', value: 1 }, 'deferred', now);
  const tx = sold.transactions[0];
  const price = 300 * (1 - FEES.sale);
  const flat = price * 0.115;
  const gainTax = (price - 1000 / acc.holdings.gold) * 0.85 * 0.376;
  close(tx.tax ?? 0, Math.min(flat, gainTax));
  assert.equal(tx.taxRegime, flat < gainTax ? 'flat' : 'gain');
  close(tx.eur, price - (tx.tax ?? 0));

  // Saisie en euros : montant reçu après impôt
  const net = sell(acc, high, 'gold', { unit: 'eur', value: 200 }, 'deferred', now).transactions[0];
  close(net.eur, 200);
  assert.ok((net.tax ?? 0) > 0);

  // Tout vendre en grammes
  const all = sell(acc, high, 'gold', { unit: 'g', value: acc.holdings.gold }, 'deferred', now);
  close(all.holdings.gold, 0, 1e-6);

  // Vente à perte : aucun impôt
  const loss = sell(acc, { ...low, gold: 90 }, 'gold', { unit: 'g', value: 1 }, 'deferred', now).transactions[0];
  assert.ok(!loss.tax);

  // Virement vers un compte bancaire : même règle
  const { account: withIban, beneficiary } = addBeneficiary(acc, 'iban', 'Moi', 'FR76 3000 6000 0112 3456 7890 189');
  const iban = transferToIban(withIban, high, 'gold', { unit: 'eur', value: 50 }, beneficiary, 'deferred', now);
  close(iban.transactions[0].eur, 50);
  assert.ok((iban.transactions[0].tax ?? 0) > 0);

  // Carte : le commerçant reçoit le montant exact, un peu plus de métal est vendu pour l'impôt
  const carded = cardPay(issueCard(acc), high, 'Boulangerie', 20, now);
  const ctx = carded.transactions[0];
  close(ctx.eur, 20);
  close(-ctx.deltas.gold * 300 - (ctx.tax ?? 0), 20);

  // Conversion : cession du métal d'origine, l'impôt réduit le métal reçu
  const conv = convert(acc, high, 'gold', 'silver', { unit: 'g', value: 1 }, now).transactions[0];
  assert.ok((conv.tax ?? 0) > 0);
});

test('perspective : l’impôt baisse avec les années, exonération 22 ans après le dernier achat', async () => {
  const { taxOutlook } = await import('../src/logic/tax.ts');
  const acc = buy(
    createAccount('T'),
    { gold: 100, silver: 1, platinum: 30 },
    'gold',
    { unit: 'eur', value: 1000 },
    new Date('2021-06-01'),
  );
  const o = taxOutlook(acc, { gold: 300, silver: 1, platinum: 30 }, 'gold', new Date('2026-11-02'))!;
  assert.equal(o.today.regime, 'flat');
  assert.equal(o.exemptAt!.slice(0, 10), '2043-06-01');
  assert.ok(o.gainRegimeFrom && o.gainRegimeFrom > '2026-11-02' && o.gainRegimeFrom < o.exemptAt!);
  const last = o.points[o.points.length - 1];
  assert.equal(last.tax, 0);
  for (let i = 1; i < o.points.length; i++) assert.ok(o.points[i].tax <= o.points[i - 1].tax);
  assert.ok(o.points[0].tax <= o.today.tax);
});

test('compte enfant : le don compte à sa valeur et à sa date de versement', async () => {
  const { addChild, fundChild } = await import('../src/logic/ledger.ts');
  const parent = buy(
    createAccount('P'),
    { gold: 100, silver: 1, platinum: 30 },
    'gold',
    { unit: 'eur', value: 1000 },
    new Date('2021-06-01'),
  );
  const { account: withKid, child } = addChild(parent, 'Léo', '2018-03-06', new Date('2024-01-01'));
  const funded = fundChild(
    withKid,
    { gold: 200, silver: 1, platinum: 30 },
    child.id,
    'gold',
    { unit: 'g', value: 2 },
    new Date('2024-01-01'),
  );
  const kid = funded.children[0];
  const lots = holdingLots(kid).gold;
  assert.equal(lots.length, 1);
  assert.equal(lots[0].date.slice(0, 10), '2024-01-01');
  // Valeur du don = 2 g au cours du jour (200 €/g), pas le prix payé par le parent en 2021
  assert.ok(lots[0].cost > 300 && lots[0].cost <= 400, String(lots[0].cost));
  const est = estimateTax(kid, { gold: 300, silver: 1, platinum: 30 }, new Date('2026-11-02'));
  assert.equal(est.metals[0].avgYears, 2); // détention depuis le don
  assert.ok(est.gain > 0 && est.tax > 0);
  // Le parent ne garde que le reste de ses lots
  close(
    holdingLots(funded).gold.reduce((s, l) => s + l.grams, 0),
    funded.holdings.gold,
    1e-6,
  );
});

test('Écu Orvia : prix = 1 g d’or × (1 + prime), achat, vente avec impôt, ancien compte migré', async () => {
  const { ECU, ecuPrice, withEcu } = await import('../src/logic/ecu.ts');
  const { migrateAccount } = await import('../src/logic/ledger.ts');
  close(ecuPrice(100), 100 * (1 + ECU.defaultPremium), 1e-9);
  close(ecuPrice(100, 0.1), 110, 1e-9);
  close(ecuPrice(100, 0.5), 100 * (1 + ECU.maxPremium), 1e-9); // prime plafonnée
  const p2021 = withEcu({ gold: 100, silver: 1, platinum: 30 });
  let acc = buy(createAccount('T'), p2021, 'ecu', { unit: 'g', value: 3 }, new Date('2021-06-01'));
  assert.equal(acc.holdings.ecu, 3);
  close(acc.transactions[0].eur, (3 * 104) / (1 - FEES.buy.ecu));
  // L'or monte : l'écu suit, l'impôt s'applique comme pour l'or
  const p2026 = withEcu({ gold: 150, silver: 1, platinum: 30 });
  acc = sell(acc, p2026, 'ecu', { unit: 'g', value: 1 }, 'deferred', new Date('2026-11-02'));
  assert.ok((acc.transactions[0].tax ?? 0) > 0);
  close(acc.holdings.ecu, 2, 1e-9);
  // Compte enregistré avant l'écu : solde à zéro ajouté
  const old = migrateAccount({ ...createAccount('V'), holdings: { gold: 1, silver: 0, platinum: 0 } });
  assert.equal(old!.holdings.ecu, 0);
});
