import assert from 'node:assert/strict';
import { test } from 'node:test';

import { CSV_COLUMNS, operationsCsv } from '../src/logic/csv.ts';
import { applyDormancy, buy, convert, createAccount } from '../src/logic/ledger.ts';

const p = { gold: 100, silver: 1, platinum: 30 };

test('export CSV : en-tête du modèle, « ; », virgule décimale, une ligne par métal', () => {
  let a = createAccount('T', new Date('2026-01-01T10:00:00'));
  a = buy(a, p, 'gold', { unit: 'eur', value: 100 }, new Date('2026-01-05T10:00:00'));
  a = buy(a, p, 'silver', { unit: 'eur', value: 50 }, new Date('2026-01-05T10:01:00'));
  a = applyDormancy(a, p, new Date('2026-01-06T10:00:00'));
  a = applyDormancy(a, p, new Date('2026-02-02T10:00:00')); // garde de janvier : or et argent
  a = convert(a, p, 'silver', 'gold', { unit: 'g', value: 10 }, new Date('2026-02-03T10:00:00'));
  const csv = operationsCsv(a);
  assert.ok(csv.startsWith('﻿'));
  const lines = csv.slice(1).trim().split('\r\n');
  assert.equal(lines[0], CSV_COLUMNS.join(';'));
  assert.equal(
    lines[1],
    '05/01/2026;2026;Compte principal;Achat de Gold Spot;Achat;Gold Spot;0,975000;100,0000;100,00;2,50;;',
  );
  const custody = lines.filter((l) => l.includes(';Frais de garde;'));
  assert.equal(custody.length, 2);
  // Montant = valeur du métal prélevé (0,12 %/12 de 97,5 € d'or), pas de frais en plus.
  assert.match(custody[0], /;Frais de garde;Gold Spot;-0,0000\d\d;;0,01;;;$/);
  const conv = lines.filter((l) => l.includes(';Conversion;'));
  assert.equal(conv.length, 2);
  assert.ok(lines.every((l) => l.split(';').length === CSV_COLUMNS.length));
});
