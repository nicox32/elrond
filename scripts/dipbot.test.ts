import assert from 'node:assert/strict';
import test from 'node:test';

import { compareDip, dipSignal, newDipBot, refreshFixedPrices, runDipBot } from '../src/logic/dipBot.ts';
import { buy, createAccount, creditCash } from '../src/logic/ledger.ts';
import type { PricePoint } from '../src/logic/priceHistory.ts';

const NOW = new Date('2026-11-04T12:00:00Z');
const AVG = { gold: 116, silver: 1.5, platinum: 42 };

/** 30 jours de relevés (un par jour) au cours moyen donné. */
function history(avg = AVG, days = 30): PricePoint[] {
  return Array.from({ length: days }, (_, i) => ({
    t: new Date(NOW.getTime() - (days - i) * 86_400_000).toISOString(),
    prices: { ...avg },
  }));
}

function account(cash = 1000) {
  let a = createAccount('Nicolas', new Date('2026-10-01'));
  if (cash > 0) a = creditCash(a, cash, 'transfer', new Date('2026-10-02'));
  return { ...a, dipBot: newDipBot(new Date('2026-11-01T00:00:00Z')) };
}

test('bot : seuils du tableau (moyenne 30 j ou prix fixe), baisse forte = achat double', () => {
  const r = newDipBot().rules;
  assert.equal(dipSignal(r.gold, 112, 116).kind, 'none'); // −3,4 % et au-dessus de 108
  assert.equal(dipSignal(r.gold, 110, 116).kind, 'avg'); // −5,2 %
  assert.equal(dipSignal(r.gold, 104, 116).kind, 'strong'); // −10,3 %
  assert.equal(dipSignal(r.gold, 107.9, null).kind, 'fixed'); // pas encore de moyenne : prix fixe seul
  assert.equal(dipSignal(r.silver, 1.37, 1.5).kind, 'avg'); // −8,7 %
  assert.equal(dipSignal(r.silver, 1.34, 1.5).kind, 'avg'); // −10,7 % : pas encore « forte » (−15 %)
  assert.equal(dipSignal(r.silver, 1.27, 1.5).kind, 'strong'); // −15,3 %
  assert.equal(dipSignal(r.platinum, 37.9, 39).kind, 'fixed'); // −2,8 % mais sous 38 €/g
  assert.equal(dipSignal(r.platinum, 39, 42).kind, 'avg'); // −7,1 %
});

test('bot : achète sur le compte d’attente, double en baisse forte, une fois par métal sur 7 jours', () => {
  const prices = { gold: 104, silver: 1.45, platinum: 41 }; // or −10,3 % : fort ; argent −3,3 % ; platine −2,4 %
  const r = runDipBot(account(), prices, history(), NOW);
  const dips = r.account.transactions.filter((t) => t.dip);
  assert.equal(dips.length, 1);
  assert.equal(dips[0].dip, 'strong');
  assert.equal(dips[0].eur, 50);
  assert.equal(dips[0].cash, -50);
  assert.equal(r.account.cashEur, 950);
  assert.match(r.notices[0].title, /Gold Spot \(baisse forte, achat double\)/);
  // 3 jours plus tard : toujours en baisse, mais pas de second achat d'or avant 7 jours.
  const later = runDipBot(r.account, prices, history(), new Date(NOW.getTime() + 3 * 86_400_000));
  assert.equal(later.account.transactions.filter((t) => t.dip).length, 1);
  const week = runDipBot(r.account, prices, history(), new Date(NOW.getTime() + 7 * 86_400_000 + 60_000));
  assert.equal(week.account.transactions.filter((t) => t.dip).length, 2);
});

test('bot : plafond mensuel, compte d’attente vide signalé une fois par jour', () => {
  const all = { gold: 100, silver: 1.2, platinum: 35 }; // les trois en baisse forte : 3 × 50 €
  const capped = { ...account(), dipBot: { ...newDipBot(new Date('2026-11-01')), monthlyCap: 120 } };
  const r = runDipBot(capped, all, history(), NOW);
  // Or 50 €, argent 50 €, puis platine limité aux 20 € restants du plafond de 120 €.
  const byMetal = (m: 'gold' | 'silver' | 'platinum') =>
    r.account.transactions.filter((t) => t.dip && t.deltas[m] > 0).reduce((s, t) => s + t.eur, 0);
  assert.deepEqual([byMetal('gold'), byMetal('silver'), byMetal('platinum')], [50, 50, 20]);
  assert.equal(
    runDipBot(r.account, all, history(), new Date(NOW.getTime() + 8 * 86_400_000)).account.transactions.filter(
      (t) => t.dip,
    ).length,
    3,
  ); // plafond du mois atteint
  assert.ok(r.account.transactions.filter((t) => t.dip).reduce((s, t) => s + t.eur, 0) <= 120 + 1e-9);

  const empty = runDipBot(account(0), all, history(), NOW);
  assert.equal(empty.account.transactions.filter((t) => t.dip).length, 0);
  assert.equal(empty.notices.length, 3);
  assert.match(empty.notices[0].body, /insuffisant/);
  assert.equal(runDipBot(empty.account, all, history(), new Date(NOW.getTime() + 3_600_000)).notices.length, 0);
});

test('bot : prix fixes remis à jour chaque mois d’après la moyenne 30 jours (en €/g)', () => {
  const bot = newDipBot(new Date('2026-10-01T00:00:00Z'));
  const fresh = refreshFixedPrices(bot, history({ gold: 120, silver: 1.6, platinum: 44 }), NOW);
  assert.equal(fresh.rules.gold.fixedPrice, 111.6); // 120 − 7 %
  assert.equal(fresh.rules.silver.fixedPrice, 1.44); // 1,60 − 10 %
  assert.equal(fresh.rules.platinum.fixedPrice, 39.6); // 44 − 10 %
  // Moins de 30 jours depuis la dernière mise à jour : rien ne change.
  assert.equal(refreshFixedPrices(fresh, history(), new Date(NOW.getTime() + 86_400_000)), fresh);
  // Pas assez d'historique (10 jours) : on garde les anciens prix.
  assert.equal(refreshFixedPrices(bot, history(AVG, 10), NOW), bot);
});

test('bot : comparaison du prix moyen payé par gramme, achat sur baisse vs achat régulier', () => {
  let a = account();
  a = buy(a, { gold: 116, silver: 1.5, platinum: 42 }, 'gold', { unit: 'eur', value: 25 }, NOW, 'cash');
  const r = runDipBot(a, { gold: 104, silver: 1.5, platinum: 42 }, history(), NOW);
  const gold = compareDip(r.account, '2026-11-01T00:00:00Z').find((c) => c.metal === 'gold')!;
  assert.equal(gold.dip.count, 1);
  assert.equal(gold.regular.count, 1);
  assert.ok(gold.diffPct! < -10); // payé ~10 % moins cher par gramme
});

test('bot : notifications ntfy (canal valide, envoi JSON avec accents)', async () => {
  const { isValidTopic, publishNtfy } = await import('../src/logic/ntfyClient.ts');
  assert.equal(isValidTopic('orvia-abc123_x'), true);
  assert.equal(isValidTopic('orvia-abc qq'), false);
  assert.equal(isValidTopic(''), false);
  let sent: { url: string; body: Record<string, unknown> } | null = null;
  const fake = (async (url: string, init: { body: string }) => {
    sent = { url, body: JSON.parse(init.body) };
    return { ok: true, status: 200 };
  }) as unknown as typeof fetch;
  await publishNtfy(
    'orvia-abc',
    { title: 'Achat sur baisse : Gold Spot', body: '25,00 € achetés à 104,00 €/g.' },
    fake,
  );
  assert.equal(sent!.url, 'https://ntfy.sh');
  assert.equal(sent!.body.topic, 'orvia-abc');
  assert.equal(sent!.body.title, 'Achat sur baisse : Gold Spot');
  await assert.rejects(publishNtfy('mauvais canal', { title: 'x', body: 'y' }, fake));
});
