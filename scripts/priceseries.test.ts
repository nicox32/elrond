import assert from 'node:assert/strict';
import { test } from 'node:test';

import { COURS_SNAPSHOT } from '../src/logic/coursData.ts';
import {
  applyMode,
  fullSeries,
  isCoursData,
  nearestIndex,
  rangeSeries,
  ratioZone,
  seriesStats,
} from '../src/logic/priceSeries.ts';

test('historique des cours : 20 ans livrés avec l’appli, relevés de l’appli à la suite', () => {
  assert.ok(isCoursData(COURS_SNAPSHOT));
  const lastDay = COURS_SNAPSHOT.d[COURS_SNAPSHOT.d.length - 1] * 86_400_000;
  const live = [
    { t: new Date(lastDay + 2 * 86_400_000).toISOString(), prices: { gold: 110, silver: 1.4, platinum: 40 } },
    {
      t: new Date(lastDay + 2 * 86_400_000 + 3_600_000).toISOString(),
      prices: { gold: 111, silver: 1.38, platinum: 40 },
    },
  ];
  const now = { t: lastDay + 3 * 86_400_000, prices: { gold: 112, silver: 1.4, platinum: 41 } };
  const s = fullSeries(COURS_SNAPSHOT, 'gold', live, now);
  assert.equal(s[s.length - 1].v, 112);
  assert.equal(s[s.length - 2].v, 111);
  assert.ok(
    s.every((p, i) => i === 0 || p.t > s[i - 1].t),
    'série triée sans doublon',
  );
  assert.ok(new Date(s[0].t).getFullYear() <= new Date(lastDay).getFullYear() - 19);
  const r = fullSeries(COURS_SNAPSHOT, 'ratio', live, now);
  assert.equal(r[r.length - 1].v, 80);
  // Période : 1 an ≈ 260 jours cotés ; 20 ans tout l'historique.
  const y = rangeSeries(s, '1y');
  assert.ok(y.length > 200 && y.length < 300, `1 an : ${y.length}`);
  assert.ok(rangeSeries(s, '20y').length > 1400);
  const st = seriesStats(y);
  assert.ok(st && st.max.v >= st.min.v);
  assert.equal(nearestIndex(s, s[10].t + 1), 10);
});

test('tarif Orvia : achat frais compris, revente sans commission ; zones du ratio', () => {
  assert.equal(Math.round(applyMode(100, 'gold', 'buy') * 100) / 100, 102.88);
  assert.equal(applyMode(100, 'gold', 'sell'), 100);
  assert.equal(applyMode(100, 'gold', 'spot'), 100);
  assert.equal(ratioZone(82).tone, 'silver');
  assert.equal(ratioZone(65).tone, 'neutral');
  assert.equal(ratioZone(40).tone, 'gold');
});
