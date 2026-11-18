import assert from 'node:assert/strict';
import test from 'node:test';

import { DEV_TAP_GAP_MS, registerTap, type TapState } from '../src/logic/devTap.ts';

const run = (times: number[]) => {
  let s: TapState = { count: 0, last: 0 };
  let opened = false;
  for (const t of times) {
    const r = registerTap(s, t);
    s = r.state;
    opened = opened || r.opened;
  }
  return opened;
};

test('espace DEV : six appuis, chacun dans le délai du précédent, ouvrent l’accès', () => {
  // Six appuis espacés d'une demi-seconde : trois secondes en tout, c'est accepté.
  assert.equal(run([0, 500, 1000, 1500, 2000, 2500]), true);
  // Six appuis espacés d'une seconde : six secondes en tout, c'est accepté aussi.
  assert.equal(run([0, 1000, 2000, 3000, 4000, 5000]), true);
  // Cinq appuis seulement : rien.
  assert.equal(run([0, 300, 600, 900, 1200]), false);
  // Une pause trop longue au milieu repart de un.
  assert.equal(run([0, 300, 600, 600 + DEV_TAP_GAP_MS + 1, 3000, 3300]), false);
  // Après une pause, six nouveaux appuis rapides ouvrent.
  assert.equal(run([0, 300, 5000, 5300, 5600, 5900, 6200, 6500]), true);
});
