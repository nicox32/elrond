/** Données fictives du modèle de tableur : node scripts/template-sample.ts exemple.csv */
import { addChild, buy, convert, createAccount, fundChild, sell, applyDormancy } from '../src/logic/ledger.ts';
import { operationsCsv } from '../src/logic/csv.ts';
import { writeFileSync } from 'node:fs';
const P = (g: number, s: number, p: number) => ({ gold: g, silver: s, platinum: p });
let a = createAccount('Exemple', new Date('2022-01-03T10:00:00'));
a = buy(a, P(52, 0.68, 29), 'gold', { unit: 'eur', value: 100 }, new Date('2022-01-05T10:00:00'));
a = buy(a, P(52, 0.68, 29), 'silver', { unit: 'eur', value: 25 }, new Date('2022-01-05T10:01:00'));
a = buy(a, P(57, 0.7, 30), 'gold', { unit: 'eur', value: 100 }, new Date('2023-06-05T10:00:00'));
a = buy(a, P(61, 0.75, 29), 'platinum', { unit: 'eur', value: 50 }, new Date('2024-02-05T10:00:00'));
a = buy(a, P(75, 0.9, 30), 'gold', { unit: 'eur', value: 150 }, new Date('2025-03-05T10:00:00'));
const r = addChild(a, 'Enfant', '2016-03-12', new Date('2025-04-01T10:00:00'));
a = fundChild(
  r.account,
  P(80, 0.95, 31),
  r.child.id,
  'gold',
  { unit: 'g', value: 0.3 },
  new Date('2025-04-05T10:00:00'),
);
a = convert(a, P(95, 1.1, 34), 'silver', 'gold', { unit: 'g', value: 10 }, new Date('2025-10-05T10:00:00'));
a = applyDormancy(a, P(100, 1.3, 38), new Date('2026-01-01T10:00:00'));
a = buy(a, P(100, 1.3, 38), 'gold', { unit: 'eur', value: 100 }, new Date('2026-01-05T10:00:00'));
a = applyDormancy(a, P(105, 1.35, 39), new Date('2026-04-02T10:00:00'));
a = sell(a, P(110, 1.4, 40), 'gold', { unit: 'g', value: 0.5 }, 'deferred', new Date('2026-05-05T10:00:00'));
writeFileSync(process.argv[2], operationsCsv(a));
