// Tests de la logique du compte. Lancer : npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  accountValue,
  addBeneficiary,
  buy,
  convert,
  createAccount,
  isValidIban,
  LedgerError,
  migrateAccount,
  recordBalance,
  sell,
  transferToIban,
  transferToMember,
  TROY_OUNCE,
  unrealizedGain,
} from '../src/logic/ledger.ts';
import { FEES } from '../src/logic/fees.ts';
import { fetchLivePrices, usdOunceToEurGram } from '../src/logic/prices.ts';

const prices = { gold: 100, silver: 1, platinum: 30 };
const close = (a: number, b: number, eps = 1e-4) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);
const VALID_IBAN = 'FR76 3000 6000 0112 3456 7890 189';

test('achat en euros, en grammes et en onces : frais en part du montant payé', () => {
  let acc = buy(createAccount('Test'), prices, 'gold', { unit: 'eur', value: 1000 });
  close(acc.holdings.gold, (1000 * (1 - FEES.buy.gold)) / 100); // 2,8 % → 9,72 g
  close(acc.transactions[0].eur, 1000, 0.01);
  close(acc.transactions[0].fees ?? 0, 28, 0.01);

  acc = buy(createAccount('Test'), prices, 'silver', { unit: 'g', value: 50 });
  close(acc.holdings.silver, 50);
  close(acc.transactions[0].eur, 50 / (1 - FEES.buy.silver), 0.01); // 6,8 %

  acc = buy(createAccount('Test'), prices, 'platinum', { unit: 'oz', value: 1 });
  close(acc.holdings.platinum, TROY_OUNCE);
});

test('revente : 0,8 % en différé, 0,8 % + 2,8 % en immédiat', () => {
  const start = buy(createAccount('Test'), prices, 'gold', { unit: 'g', value: 10 });
  let acc = sell(start, prices, 'gold', { unit: 'g', value: 1 }, 'deferred');
  close(acc.transactions[0].eur, 100 * (1 - 0.008), 0.01);
  close(acc.transactions[0].fees ?? 0, 0.8, 0.01);
  acc = sell(start, prices, 'gold', { unit: 'g', value: 1 }, 'immediate');
  close(acc.transactions[0].eur, 100 * (1 - 0.008 - 0.028), 0.01);
  // saisie en euros = montant reçu
  acc = sell(start, prices, 'gold', { unit: 'eur', value: 99.2 }, 'deferred');
  close(acc.holdings.gold, 9);
  // tout revendre
  const value = accountValue(start, prices).total;
  acc = sell(start, prices, 'gold', { unit: 'eur', value }, 'deferred');
  close(acc.holdings.gold, 0);
});

test('vente supérieure au solde refusée', () => {
  const acc = buy(createAccount('Test'), prices, 'gold', { unit: 'g', value: 1 });
  assert.throws(() => sell(acc, prices, 'gold', { unit: 'g', value: 2 }), LedgerError);
  assert.throws(() => sell(acc, prices, 'silver', { unit: 'g', value: 1 }), LedgerError);
});

test('montants invalides refusés', () => {
  const acc = createAccount('Test');
  for (const value of [0, -5, Number.NaN]) {
    assert.throws(() => buy(acc, prices, 'gold', { unit: 'eur', value }), LedgerError);
  }
});

test('conversion or → platine : 0,8 % + frais d’achat du métal reçu', () => {
  let acc = buy(createAccount('Test'), prices, 'gold', { unit: 'g', value: 10 });
  acc = convert(acc, prices, 'gold', 'platinum', { unit: 'g', value: 3 });
  close(acc.holdings.gold, 7);
  // 0,8 % de frais de conversion puis 6,8 % de frais d'achat du platine
  close(acc.holdings.platinum, (300 * (1 - 0.008) * (1 - 0.068)) / 30);
  assert.throws(() => convert(acc, prices, 'gold', 'gold', { unit: 'g', value: 1 }), LedgerError);
});

test('virement à un membre : gratuit, en grammes', () => {
  let acc = buy(createAccount('Test'), prices, 'silver', { unit: 'g', value: 100 });
  const { account, beneficiary } = addBeneficiary(acc, 'member', 'Alice', 'alice@example.com');
  acc = transferToMember(account, prices, 'silver', { unit: 'g', value: 40 }, beneficiary);
  close(acc.holdings.silver, 60);
  assert.equal(acc.transactions[0].label, 'Virement à Alice');
  assert.equal(acc.beneficiaries.length, 1);
});

test('virement SEPA : vend le métal, IBAN vérifié, frais fixe vers l’étranger', () => {
  assert.ok(isValidIban(VALID_IBAN));
  assert.ok(!isValidIban('FR76 3000 6000 0112 3456 7890 188'));
  for (let i = 0; i < 20; i++) assert.ok(isValidIban(createAccount('X').iban));
  const start = buy(createAccount('Test'), prices, 'gold', { unit: 'g', value: 10 });
  assert.throws(() => addBeneficiary(start, 'iban', 'Bob', 'FR00 1234'), LedgerError);
  const { account, beneficiary } = addBeneficiary(start, 'iban', 'Bob', VALID_IBAN.replace(/ /g, ''));
  assert.equal(beneficiary.identifier, VALID_IBAN);
  // France, différé : Bob reçoit 198,40 € pour 2 g
  let acc = transferToIban(account, prices, 'gold', { unit: 'g', value: 2 }, beneficiary, 'deferred');
  close(acc.transactions[0].eur, 198.4, 0.01);
  // Étranger (Belgique), immédiat : saisie en euros = montant reçu, + 30 € de frais fixe
  const be = addBeneficiary(account, 'iban', 'Zoé', 'BE68539007547034');
  acc = transferToIban(be.account, prices, 'gold', { unit: 'eur', value: 100 }, be.beneficiary, 'immediate');
  close(acc.holdings.gold, 10 - 130 / (100 * (1 - 0.036)));
  close(acc.transactions[0].eur, 100, 0.01);
  // trop faible pour couvrir les 30 €
  assert.throws(
    () => transferToIban(be.account, prices, 'gold', { unit: 'g', value: 0.1 }, be.beneficiary, 'deferred'),
    LedgerError,
  );
});

test('historique du solde : un point par minute au plus', () => {
  let acc = buy(createAccount('Test'), prices, 'gold', { unit: 'g', value: 1 });
  const t0 = new Date('2026-01-01T10:00:00Z');
  acc = recordBalance(acc, prices, t0);
  acc = recordBalance(acc, prices, new Date(t0.getTime() + 10_000));
  assert.equal(acc.balanceHistory.length, 1);
  acc = recordBalance(acc, prices, new Date(t0.getTime() + 120_000));
  assert.equal(acc.balanceHistory.length, 2);
  close(acc.balanceHistory[1].total, 100 * (1 - FEES.sale), 0.01);
});

test('migration d’un compte de la première version', () => {
  const v1 = {
    holder: 'Nico',
    iban: 'FR76 1111',
    goldGrams: 2,
    silverGrams: 50,
    goldAllocation: 70,
    transactions: [{ id: 'a', kind: 'deposit', date: '2026-01-01', goldDelta: 2, silverDelta: 50, eur: 260, label: 'Dépôt' }],
  };
  const acc = migrateAccount(v1);
  assert.ok(acc);
  assert.equal(acc.version, 2);
  assert.deepEqual(acc.holdings, { gold: 2, silver: 50, platinum: 0, ecu: 0 });
  assert.equal(acc.transactions[0].kind, 'buy');
  assert.equal(acc.iban, 'FR76 1111');
  assert.equal(migrateAccount(null), null);
});

test('cours réels : conversion USD/once → EUR/gramme', async () => {
  close(usdOunceToEurGram(TROY_OUNCE, 0.5), 0.5);
  const fakeFetch = (async (url: string) => {
    const body = url.includes('XAU')
      ? { price: 3110.34768 }
      : url.includes('XAG')
        ? { price: 31.1034768 }
        : url.includes('XPT')
          ? { price: 1000 }
          : { rates: { EUR: 0.9 } };
    return { ok: true, status: 200, json: async () => body };
  }) as unknown as typeof fetch;
  const quote = await fetchLivePrices(fakeFetch);
  assert.equal(quote.source, 'live');
  close(quote.prices.gold, 90);
  close(quote.prices.silver, 0.9);
});

test('cours réels : échec réseau signalé', async () => {
  const failing = (async () => ({ ok: false, status: 503, json: async () => ({}) })) as unknown as typeof fetch;
  await assert.rejects(fetchLivePrices(failing));
});

test('plus-value : valeur actuelle moins euros nets placés', () => {
  let acc = buy(createAccount('Test'), prices, 'gold', { unit: 'eur', value: 1000 });
  acc = sell(acc, prices, 'gold', { unit: 'eur', value: 200 });
  const higher = { ...prices, gold: 110 };
  const r = unrealizedGain(acc, higher);
  close(r.invested, 1000 - acc.transactions[0].eur, 0.01);
  close(r.gain, acc.holdings.gold * 110 * (1 - FEES.sale) - (1000 - acc.transactions[0].eur), 0.01);
});

test('relevés de cours : 24 h gardées, relevés rapprochés fusionnés, cours non réels ignorés', async () => {
  const { addPricePoint, metalTrend, PRICE_HISTORY_MS } = await import('../src/logic/priceHistory.ts');
  const q = (iso: string, gold: number, source: 'live' | 'cache' = 'live') => ({
    prices: { gold, silver: 1, platinum: 30 },
    fetchedAt: iso,
    source,
  });
  const t0 = Date.parse('2026-11-02T10:00:00Z');
  const at = (ms: number) => new Date(t0 + ms).toISOString();
  let h = addPricePoint([], q(at(0), 100));
  h = addPricePoint(h, q(at(10_000), 101)); // fusionné avec le précédent
  assert.equal(h.length, 1);
  assert.equal(h[0].prices.gold, 101);
  h = addPricePoint(h, q(at(30_000), 102));
  h = addPricePoint(h, q(at(60_000), 999, 'cache')); // ignoré
  assert.equal(h.length, 2);
  h = addPricePoint(h, q(at(PRICE_HISTORY_MS + 20_000), 110)); // le premier relevé sort des 24 h
  assert.deepEqual(h.map((p) => p.prices.gold), [102, 110]);
  const trend = metalTrend(h, 'gold', { gold: 110, silver: 1, platinum: 30 });
  assert.deepEqual(trend.values, [102, 110]);
  close(trend.changePct, (8 / 102) * 100);
});

test('cours réels : taux de change gardé 10 minutes', async () => {
  const { clearFxCache } = await import('../src/logic/prices.ts');
  clearFxCache();
  let fxCalls = 0;
  const fetchFn = (async (url: string) => {
    if (!url.includes('gold-api')) fxCalls++;
    return { ok: true, status: 200, json: async () => (url.includes('gold-api') ? { price: 100 } : { rates: { EUR: 0.9 } }) };
  }) as unknown as typeof fetch;
  const t = Date.parse('2026-11-02T10:00:00Z');
  await fetchLivePrices(fetchFn, new Date(t));
  await fetchLivePrices(fetchFn, new Date(t + 5 * 60_000));
  assert.equal(fxCalls, 1);
  await fetchLivePrices(fetchFn, new Date(t + 11 * 60_000));
  assert.equal(fxCalls, 2);
});

test('comptes enfants : gratuits, alimentés et repris depuis le compte principal', async () => {
  const { addChild, fundChild, withdrawFromChild, removeChild } = await import('../src/logic/ledger.ts');
  let acc = buy(createAccount('Parent'), prices, 'gold', { unit: 'g', value: 10 });
  const r = addChild(acc, 'Léo');
  acc = r.account;
  assert.throws(() => addChild(acc, '  '), LedgerError);
  acc = fundChild(acc, prices, r.child.id, 'gold', { unit: 'g', value: 4 });
  close(acc.holdings.gold, 6);
  close(acc.children[0].holdings.gold, 4);
  assert.equal(acc.children[0].transactions[0].kind, 'family_in');
  assert.equal(acc.children[0].transactions[0].fees, undefined); // gratuit
  assert.throws(() => fundChild(acc, prices, r.child.id, 'gold', { unit: 'g', value: 100 }), LedgerError);
  assert.throws(() => removeChild(acc, r.child.id), LedgerError); // pas vide
  acc = withdrawFromChild(acc, prices, r.child.id, 'gold', { unit: 'g', value: 4 });
  close(acc.holdings.gold, 10);
  acc = removeChild(acc, r.child.id);
  assert.equal(acc.children.length, 0);
});

test('frais d’oxydation : 0,02 %/jour facturés pour chaque période de 6 mois sans opération d’au moins 1 €', async () => {
  const { applyDormancy, dormancyStatus, addChild, fundChild } = await import('../src/logic/ledger.ts');
  const t0 = new Date('2026-01-10T12:00:00Z');
  const day = 86_400_000;
  let acc = buy(createAccount('Test', t0), prices, 'gold', { unit: 'g', value: 100 }, t0);
  // Léa est majeure depuis le 1er janvier 2026 : versement fait avant de renseigner sa date de naissance
  const r = addChild(acc, 'Léa', undefined, t0);
  acc = fundChild(r.account, prices, r.child.id, 'gold', { unit: 'g', value: 50 }, t0);
  const { setChildBirthDate } = await import('../src/logic/ledger.ts');
  acc = setChildBirthDate(acc, r.child.id, '2008-01-01');
  // 5 mois plus tard : rien
  const m5 = new Date('2026-06-10T12:00:00Z');
  assert.equal(applyDormancy(acc, prices, m5), acc);
  assert.ok(!dormancyStatus(acc, m5).inactive);
  // Une opération de moins de 1 € ne compte pas comme un mouvement
  const tiny = buy(acc, prices, 'gold', { unit: 'eur', value: 0.5 }, m5);
  assert.equal(dormancyStatus(tiny, m5).lastMovement.toISOString(), t0.toISOString());
  // 6 mois écoulés (10 janvier → 10 juillet = 181 jours) : facturés d'un coup, sur chaque compte
  const m6 = new Date('2026-07-12T12:00:00Z');
  const charged = applyDormancy(acc, prices, m6);
  const share = 0.0002 * 181;
  close(charged.holdings.gold, 50 * (1 - share));
  close(charged.children[0].holdings.gold, 50 * (1 - share));
  assert.equal(charged.transactions[0].kind, 'fee_dormancy');
  // relancé plus tard dans la même période : pas de double facturation
  assert.equal(applyDormancy(charged, prices, new Date(m6.getTime() + 60 * day)), charged);
  // 6 mois de plus sans opération (10 juillet → 10 janvier = 184 jours) : la période suivante est facturée
  const m12 = new Date('2027-01-11T12:00:00Z');
  const again = applyDormancy(charged, prices, m12);
  close(again.holdings.gold, 50 * (1 - share) * (1 - 0.0002 * 184));
  // une opération d'au moins 1 € remet le compteur à zéro
  const moved = buy(again, prices, 'gold', { unit: 'eur', value: 1 }, m12);
  assert.ok(!dormancyStatus(moved, new Date(m12.getTime() + 30 * day)).inactive);
});

test('compte enfant : aucun frais d’oxydation avant 18 ans, compteur lancé à la majorité', async () => {
  const { addChild, applyDormancy, dormancyStatus, fundChild, parseBirthDate, setChildBirthDate } = await import(
    '../src/logic/ledger.ts'
  );
  const now = new Date('2026-11-02T12:00:00Z');
  assert.equal(parseBirthDate('05/03/2015', now), '2015-03-05');
  assert.throws(() => parseBirthDate('31/02/2015', now), LedgerError); // n'existe pas
  assert.throws(() => parseBirthDate('01/01/2030', now), LedgerError); // futur
  assert.throws(() => parseBirthDate('01/01/2000', now), LedgerError); // déjà majeur
  assert.throws(() => parseBirthDate('2015-03-05', now), LedgerError); // mauvais format

  const t0 = new Date('2026-01-10T12:00:00Z');
  let acc = buy(createAccount('Parent', t0), prices, 'gold', { unit: 'g', value: 100 }, t0);
  // Enfant né le 1er juin 2010 : majeur le 1er juin 2028
  const r = addChild(acc, 'Tom', '2010-06-01', t0);
  acc = fundChild(r.account, prices, r.child.id, 'gold', { unit: 'g', value: 10 }, t0);
  // 2 ans sans opération, toujours mineur : rien sur son compte (le parent, lui, paie)
  const y2 = new Date('2028-01-10T12:00:00Z');
  const charged = applyDormancy(acc, prices, y2);
  close(charged.children[0].holdings.gold, 10);
  assert.ok(charged.holdings.gold < 90);
  assert.ok(dormancyStatus(charged.children[0], y2).exempt);
  // Majeur le 1er juin 2028 : les 6 mois courent à partir de là → rien avant le 1er décembre 2028
  assert.equal(applyDormancy(charged, prices, new Date('2028-11-30T12:00:00Z')).children[0], charged.children[0]);
  const after = applyDormancy(charged, prices, new Date('2028-12-02T12:00:00Z'));
  close(after.children[0].holdings.gold, 10 * (1 - 0.0002 * 183));
  // Sans date de naissance connue : exonéré
  const noDate = addChild(acc, 'Ana', undefined, t0);
  const later = applyDormancy(fundChild(noDate.account, prices, noDate.child.id, 'gold', { unit: 'g', value: 5 }, t0), prices, y2);
  close(later.children.find((c) => c.name === 'Ana')!.holdings.gold, 5);
  // Date ajoutée ensuite
  const dated = setChildBirthDate(later, noDate.child.id, '2012-01-01');
  assert.equal(dated.children.find((c) => c.name === 'Ana')!.birthDate, '2012-01-01');
});

test('opérations qui évitent les frais : achat et échanges de louis, pas les ventes ni les virements IBAN', async () => {
  const { dormancyStatus } = await import('../src/logic/ledger.ts');
  const { toLouis } = await import('../src/logic/currency.ts');
  const t0 = new Date('2026-01-10T12:00:00Z');
  const acc = buy(createAccount('Test', t0), prices, 'gold', { unit: 'g', value: 10 }, t0);
  const later = new Date('2026-05-01T12:00:00Z');
  const sold = sell(acc, prices, 'gold', { unit: 'g', value: 1 }, 'deferred', later);
  assert.equal(dormancyStatus(sold, later).lastMovement.toISOString(), t0.toISOString()); // la vente ne compte pas
  const converted = convert(acc, prices, 'gold', 'silver', { unit: 'g', value: 1 }, later);
  assert.equal(dormancyStatus(converted, later).lastMovement.toISOString(), later.toISOString()); // échange : compte
  // 1 louis = 1 euro
  close(toLouis(250, prices), 250);
});

test('carte Orvia : paiements et retraits gratuits, plafonds, gel, comptent comme mouvements', async () => {
  const { issueCard, cardPay, cardWithdraw, setCardFrozen, setCardMetal, dormancyStatus, CARD } = await import(
    '../src/logic/ledger.ts'
  );
  const t0 = new Date('2026-03-01T12:00:00Z');
  let acc = buy(createAccount('Nico', t0), prices, 'gold', { unit: 'g', value: 50 }, t0); // 5 000 € d'or
  assert.throws(() => cardPay(acc, prices, 'Boulangerie', 5, t0), LedgerError); // pas encore de carte
  acc = issueCard(acc, t0);
  assert.match(acc.card!.last4, /^\d{4}$/);
  assert.equal(acc.card!.expiry, '03/30');
  const t1 = new Date('2026-05-01T12:00:00Z');
  acc = cardPay(acc, prices, 'Boulangerie', 25, t1);
  close(acc.holdings.gold, 50 - 0.25); // 25 € à 100 €/g, sans frais
  assert.equal(acc.transactions[0].fees, undefined);
  assert.equal(dormancyStatus(acc, t1).lastMovement.toISOString(), t1.toISOString()); // évite l'oxydation
  acc = cardWithdraw(acc, prices, 100, t1);
  close(acc.holdings.gold, 50 - 1.25);
  // plafonds
  assert.throws(() => cardWithdraw(acc, prices, CARD.withdrawalLimit7d, t1), LedgerError);
  acc = cardWithdraw(acc, prices, 100, new Date('2026-05-09T12:00:00Z')); // 8 jours plus tard : nouveau plafond
  assert.throws(() => cardPay(acc, prices, 'Voyage', 3000, t1), LedgerError);
  // métal débité au choix
  acc = buy(acc, prices, 'silver', { unit: 'g', value: 1000 }, t1);
  acc = setCardMetal(acc, 'silver');
  acc = cardPay(acc, prices, 'Café', 2, t1);
  close(acc.holdings.silver, 1000 - 2);
  // gel
  acc = setCardFrozen(acc, true);
  assert.throws(() => cardPay(acc, prices, 'Café', 2, t1), LedgerError);
  assert.doesNotThrow(() => cardPay(setCardFrozen(acc, false), prices, 'Café', 2, t1));
});

test('parrainage : code saisi une fois, bonus de 10 LOU en or au premier achat d’au moins 50 €', async () => {
  const { enterSponsorCode, REFERRAL, dormancyStatus } = await import('../src/logic/ledger.ts');
  let acc = createAccount('Filleul');
  assert.match(acc.referral.code, /^ORVIA-[A-Z2-9]{6}$/);
  assert.throws(() => enterSponsorCode(acc, 'abc'), LedgerError);
  assert.throws(() => enterSponsorCode(acc, acc.referral.code), LedgerError);
  acc = enterSponsorCode(acc, ' orvia-abc234 ');
  assert.equal(acc.referral.sponsorCode, 'ORVIA-ABC234');
  assert.throws(() => enterSponsorCode(acc, 'ORVIA-XYZ234'), LedgerError);
  // achat de 20 € : pas de bonus
  acc = buy(acc, prices, 'gold', { unit: 'eur', value: 20 });
  assert.ok(!acc.referral.bonusPaid);
  // achat de 50 € : bonus versé en or, une seule fois
  acc = buy(acc, prices, 'gold', { unit: 'eur', value: 50 });
  assert.ok(acc.referral.bonusPaid);
  assert.equal(acc.transactions[0].kind, 'referral_bonus');
  close(acc.transactions[0].deltas.gold, REFERRAL.bonusLou / prices.gold);
  acc = buy(acc, prices, 'gold', { unit: 'eur', value: 100 });
  assert.equal(acc.transactions.filter((t) => t.kind === 'referral_bonus').length, 1);
  // le bonus est un gain (pas un apport) et compte comme une opération contre l'oxydation
  close(unrealizedGain(acc, prices).invested, 170, 0.01);
  assert.ok(dormancyStatus(acc).lastMovement.getTime() > 0);
  // migration : un compte sans code de parrainage en reçoit un
  const legacy = migrateAccount({ ...createAccount('Old'), referral: undefined });
  assert.match(legacy!.referral.code, /^ORVIA-/);
});

test('historique 2021 : 12 achats le 5 du mois, 3/4 argent 1/4 or, sans frais ni oxydation rétroactive', async () => {
  const { import2021History, preview2021, DEFAULT_PLAN_2021 } = await import('../src/logic/history2021.ts');
  const { applyDormancy, dormancyStatus } = await import('../src/logic/ledger.ts');
  const now = new Date('2026-11-02T12:00:00Z');
  const p = preview2021(DEFAULT_PLAN_2021);
  close(p.monthly, 3845 / 12, 0.01);
  assert.ok(p.silverOz > 130 && p.silverOz < 142, `${p.silverOz} oz d'argent`); // ~136 oz
  assert.ok(p.goldOz > 0.6 && p.goldOz < 0.66, `${p.goldOz} oz d'or`); // ~0,63 oz
  const acc = import2021History(createAccount('Nico', now), DEFAULT_PLAN_2021, now);
  assert.equal(acc.createdAt, '2021-01-05T10:00:00.000Z');
  assert.equal(acc.transactions.length, 24);
  assert.ok(acc.transactions.every((t) => t.kind === 'buy' && t.date.slice(8, 10) === '05' && !t.fees));
  close(unrealizedGain(acc, prices).invested, 3845, 0.05);
  // valeur aux cours de l'estimation (argent 51 €/oz, or 3 700 €/oz) : ~9 300 €
  const est = (acc.holdings.silver * 51 + acc.holdings.gold * 3700) / TROY_OUNCE;
  assert.ok(est > 9000 && est < 9500, `${est} €`);
  // pas d'oxydation pour 2022-2026, le compteur part de la reprise
  assert.equal(applyDormancy(acc, prices, now), acc);
  assert.ok(!dormancyStatus(acc, now).inactive);
  assert.equal(dormancyStatus(acc, now).nextChargeAt.toISOString().slice(0, 10), '2027-05-02');
  // une seule reprise
  assert.equal(import2021History(acc, DEFAULT_PLAN_2021, now), acc);
});

test('alertes : seuils, variation 24 h, moyenne 30 j, sans répétition', async () => {
  const { addHourlyPoint, createAlert, evaluateAlerts, describeAlert } = await import('../src/logic/alerts.ts');
  const day = 86_400_000;
  const t0 = Date.parse('2026-10-01T12:00:00Z');
  const q = (t: number, goldOz: number, silverOz = 50) => ({
    prices: { gold: goldOz / TROY_OUNCE, silver: silverOz / TROY_OUNCE, platinum: 40 },
    fetchedAt: new Date(t).toISOString(),
    source: 'live' as const,
  });
  // 32 jours de relevés horaires : or stable à 3 700 €/oz
  let hist: { t: string; prices: { gold: number; silver: number; platinum: number } }[] = [];
  for (let h = 0; h <= 32 * 24; h++) hist = addHourlyPoint(hist, q(t0 + h * 3_600_000, 3700));
  assert.ok(hist.length <= 35 * 24 + 1);
  const now = t0 + 32 * day;

  const below = createAlert({ metal: 'gold', kind: 'below', value: 3500, unit: 'oz' });
  const drop = createAlert({ metal: 'gold', kind: 'drop', value: 5, window: '24h' });
  const avg = createAlert({ metal: 'gold', kind: 'belowAvg30', value: 5 });
  assert.equal(describeAlert(below).replace(/\s/g, ' '), 'Or sous 3 500,00 €/oz');
  let alerts = [below, drop, avg];

  // or à 3 600 : rien
  let r = evaluateAlerts(alerts, q(now, 3600), hist, new Date(now));
  assert.equal(r.events.length, 0);
  // or à 3 450 : sous le seuil, -6,8 % sur 24 h, -6,8 % sous la moyenne → 3 alertes
  r = evaluateAlerts(r.alerts, q(now + 60_000, 3450), hist, new Date(now + 60_000));
  assert.equal(r.events.length, 3);
  alerts = r.alerts;
  assert.ok(alerts.every((a) => !a.armed));
  // toujours sous le seuil une minute plus tard : pas de répétition
  r = evaluateAlerts(alerts, q(now + 120_000, 3440), hist, new Date(now + 120_000));
  assert.equal(r.events.length, 0);
  // remonte (réarmée), puis rechute avant 6 h : toujours rien ; après 6 h : nouvelle alerte de seuil
  r = evaluateAlerts(r.alerts, q(now + 180_000, 3600), hist, new Date(now + 180_000));
  assert.ok(r.alerts.find((a) => a.id === below.id)!.armed);
  r = evaluateAlerts(r.alerts, q(now + 240_000, 3450), hist, new Date(now + 240_000));
  assert.equal(r.events.filter((e) => e.alertId === below.id).length, 0);
  r = evaluateAlerts(r.alerts, q(now + 7 * 3_600_000, 3450), hist, new Date(now + 7 * 3_600_000));
  assert.equal(r.events.filter((e) => e.alertId === below.id).length, 1);
  // pas assez de recul : la moyenne 30 j attend (au moins 7 jours de relevés)
  const fresh = addHourlyPoint([], q(now, 3700));
  r = evaluateAlerts([createAlert({ metal: 'gold', kind: 'belowAvg30', value: 1 })], q(now, 3000), fresh, new Date(now));
  assert.equal(r.events.length, 0);
  // cours non réels : jamais d'alerte
  r = evaluateAlerts([below], { ...q(now, 3000), source: 'cache' }, hist, new Date(now));
  assert.equal(r.events.length, 0);
  assert.throws(() => createAlert({ metal: 'gold', kind: 'drop', value: 0 }));
});

test('serveur d’alertes : configuration, état conservé, une notification ntfy par franchissement', async () => {
  const { parseConfig, runOnce, sendNtfy, alertKey } = await import('../server/alertServer.ts');
  const { clearFxCache } = await import('../src/logic/prices.ts');
  clearFxCache();
  const logs: string[] = [];
  const config = parseConfig(
    { alerts: [{ metal: 'gold', kind: 'below', value: 3500, unit: 'oz' }, { metal: 'gold', kind: 'nope', value: 1 }] },
    (m) => logs.push(m),
  );
  assert.equal(config.length, 1);
  assert.equal(logs.length, 1);
  let goldOz = 3600;
  const fakeFetch = (async (url: string) => ({
    ok: true,
    status: 200,
    json: async () => (url.includes('gold-api') ? { price: url.includes('XAU') ? goldOz : 40 } : { rates: { EUR: 1 } }),
  })) as unknown as typeof fetch;
  const t = Date.parse('2026-11-02T12:00:00Z');
  let r = await runOnce({ config, state: { hourly: [], alerts: {} }, fetchFn: fakeFetch, now: new Date(t) });
  assert.equal(r.notifications.length, 0);
  goldOz = 3450;
  r = await runOnce({ config, state: r.state, fetchFn: fakeFetch, now: new Date(t + 15 * 60_000) });
  assert.equal(r.notifications.length, 1);
  assert.match(r.notifications[0].body, /3\s450,00/);
  // 15 minutes plus tard, toujours sous le seuil : pas de répétition (état conservé)
  r = await runOnce({ config, state: JSON.parse(JSON.stringify(r.state)), fetchFn: fakeFetch, now: new Date(t + 30 * 60_000) });
  assert.equal(r.notifications.length, 0);
  assert.ok(r.state.alerts[alertKey(config[0])]);
  // envoi ntfy
  const calls: { url: string; init: RequestInit }[] = [];
  const ntfy = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return { ok: true, status: 200 };
  }) as unknown as typeof fetch;
  await sendNtfy('orvia-test', { title: 'Alerte or · Or sous 3 500 €/oz', body: 'Cours actuel : 3 450 €/oz.' }, ntfy);
  assert.equal(calls[0].url, 'https://ntfy.sh/orvia-test');
  assert.equal(calls[0].init.method, 'POST');
  assert.match(String((calls[0].init.headers as Record<string, string>).Title), /^=\?UTF-8\?B\?/);
});

test('export des alertes vers le serveur : actives seulement, lisibles par le serveur', async () => {
  const { alertConfigForServer, createAlert, generateNtfyTopic } = await import('../src/logic/alerts.ts');
  const { parseConfig } = await import('../server/alertServer.ts');
  const a = createAlert({ metal: 'silver', kind: 'drop', value: 5, window: '7d' });
  const b = { ...createAlert({ metal: 'gold', kind: 'above', value: 4000, unit: 'oz' }), enabled: false };
  const out = alertConfigForServer([a, b]);
  assert.deepEqual(out, [{ metal: 'silver', kind: 'drop', value: 5, window: '7d' }]);
  assert.equal(parseConfig({ alerts: out }).length, 1);
  assert.match(generateNtfyTopic(), /^orvia-[a-z2-9]{20}$/);
});

test('répartition : partage au centime près, vers l’objectif, achat groupé', async () => {
  const { splitAmount, normalizeAllocation, isValidAllocation, currentAllocation, buySplit, quoteSplitBuy } =
    await import('../src/logic/allocation.ts');
  const target = { gold: 50, silver: 25, platinum: 25 };
  // selon les % : 100 € → 50 / 25 / 25
  assert.deepEqual(splitAmount(100, target, 'percent'), { gold: 50, silver: 25, platinum: 25 });
  // au centime près, sans perte
  const odd = splitAmount(100, { gold: 34, silver: 33, platinum: 33 }, 'percent');
  close(odd.gold + odd.silver + odd.platinum, 100, 1e-9);
  // vers l'objectif : compte 100 % argent → tout va à l'or et au platine
  let acc = buy(createAccount('Test'), prices, 'silver', { unit: 'g', value: 300 }); // ≈ 297,6 € d'argent
  const toward = splitAmount(100, target, 'target', acc, prices);
  assert.equal(toward.silver, 0);
  // l'or (cible 50 %) est plus en retard que le platine (25 %) : il reçoit deux fois plus
  close(toward.gold, 66.67, 0.01);
  close(toward.platinum, 33.33, 0.01);
  close(toward.gold + toward.silver + toward.platinum, 100, 1e-9);
  // achat groupé : un achat par métal, chacun avec ses frais
  const preview = quoteSplitBuy(prices, toward);
  acc = buySplit(acc, prices, toward);
  assert.equal(acc.transactions.filter((t) => t.kind === 'buy').length, 3);
  close(acc.holdings.gold, preview.lines.find((l) => l.metal === 'gold')!.grams);
  const now = currentAllocation(acc, prices);
  close(now.gold + now.silver + now.platinum, 100, 1e-6);
  // normalisation
  assert.deepEqual(normalizeAllocation({ gold: 2, silver: 1, platinum: 1 }), { gold: 50, silver: 25, platinum: 25 });
  assert.ok(isValidAllocation(target));
  assert.ok(!isValidAllocation({ gold: 50, silver: 30, platinum: 30 }));
});

test('compte enfant : retraits motivés et validés par le second parent, annulation sous 24 h, majorité', async () => {
  const { addChild, fundChild } = await import('../src/logic/ledger.ts');
  const r = await import('../src/logic/childRules.ts');
  const t0 = new Date('2026-11-02T12:00:00Z');
  const h = 3_600_000;
  let acc = buy(createAccount('Nico', t0), prices, 'gold', { unit: 'g', value: 20 }, t0);
  const c = addChild(acc, 'Léo', '2015-03-05', t0);
  acc = fundChild(c.account, prices, c.child.id, 'gold', { unit: 'g', value: 10 }, t0);
  const id = c.child.id;
  const child = () => acc.children.find((x) => x.id === id)!;

  // Pas de retrait tant que l'autorité parentale n'est pas déclarée, ni sans motif
  assert.throws(() => r.requestChildWithdrawal(acc, prices, id, 'gold', { unit: 'g', value: 1 }, 'education'), LedgerError);
  assert.throws(() => r.setChildParents(acc, id, 'joint'), LedgerError); // second parent obligatoire
  acc = r.setChildParents(acc, id, 'joint', { name: 'Marie', secret: 'sel:empreinte' });
  assert.throws(() => r.requestChildWithdrawal(acc, prices, id, 'gold', { unit: 'g', value: 1 }, undefined), LedgerError);
  assert.throws(() => r.requestChildWithdrawal(acc, prices, id, 'gold', { unit: 'g', value: 1 }, 'other', '  '), LedgerError);

  // Autorité partagée : la demande attend Marie, le métal reste chez Léo
  let res = r.requestChildWithdrawal(acc, prices, id, 'gold', { unit: 'g', value: 3 }, 'education', 'Ordinateur', new Date(t0.getTime() + 30 * h));
  assert.equal(res.executed, false);
  acc = res.account;
  close(child().holdings.gold, 10);
  // la réserve des demandes en attente est respectée
  assert.throws(() => r.requestChildWithdrawal(acc, prices, id, 'gold', { unit: 'g', value: 8 }, 'health'), LedgerError);
  acc = r.approveChildWithdrawal(acc, prices, id, res.request.id, new Date(t0.getTime() + 31 * h));
  close(child().holdings.gold, 7);
  assert.match(child().transactions[0].label, /Dépense pour Léo · Études, école \(Ordinateur\)/);
  assert.throws(() => r.approveChildWithdrawal(acc, prices, id, res.request.id), LedgerError); // déjà traitée
  // refus
  res = r.requestChildWithdrawal(acc, prices, id, 'gold', { unit: 'g', value: 1 }, 'activities');
  acc = r.closeChildWithdrawal(res.account, id, res.request.id, 'refused');
  close(child().holdings.gold, 7);

  // Autorité exercée seul : exécuté tout de suite, motif toujours obligatoire
  acc = r.setChildParents(acc, id, 'sole');
  assert.equal(child().coParent, undefined);
  res = r.requestChildWithdrawal(acc, prices, id, 'gold', { unit: 'g', value: 1 }, 'health');
  assert.equal(res.executed, true);
  acc = res.account;
  close(child().holdings.gold, 6);

  // Annulation d'un versement par erreur : seulement dans les 24 h, une seule fois
  const t1 = new Date('2026-11-10T09:00:00Z');
  acc = fundChild(acc, prices, id, 'gold', { unit: 'g', value: 2 }, t1);
  const dep = child().transactions[0];
  assert.throws(() => r.cancelDeposit(acc, prices, id, dep.id, new Date(t1.getTime() + 25 * h)), LedgerError);
  acc = r.cancelDeposit(acc, prices, id, dep.id, new Date(t1.getTime() + 2 * h));
  close(child().holdings.gold, 6);
  assert.throws(() => r.cancelDeposit(acc, prices, id, dep.id, new Date(t1.getTime() + 3 * h)), LedgerError);

  // Majorité (5 mars 2033) : plus de versement ni de retrait par le parent, transfert du compte
  const adult = new Date('2033-03-06T12:00:00Z');
  assert.equal(r.childStage(child(), adult), 'adult');
  assert.throws(() => fundChild(acc, prices, id, 'gold', { unit: 'g', value: 1 }, adult), LedgerError);
  assert.throws(() => r.requestChildWithdrawal(acc, prices, id, 'gold', { unit: 'g', value: 1 }, 'health', '', adult), LedgerError);
  assert.throws(() => r.transferChildAccount(acc, id, t1), LedgerError); // pas avant 18 ans
  acc = r.transferChildAccount(acc, id, adult);
  assert.equal(r.childStage(child(), adult), 'transferred');
  assert.match(child().transferCode!, /^ORVIA-T-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
});
