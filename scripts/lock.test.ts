import assert from 'node:assert/strict';
import { test } from 'node:test';

import { DEFAULT_LOCK_DELAY, LOCK_DELAYS, lockDelayOf, shouldLock } from '../src/logic/lock.ts';

test('verrouillage : le code n’est redemandé qu’après le délai passé en arrière-plan', () => {
  const t = 1_000_000;
  assert.equal(lockDelayOf(undefined), DEFAULT_LOCK_DELAY);
  assert.equal(lockDelayOf({ lockDelaySec: 60 }), 60);
  assert.equal(lockDelayOf({ lockDelaySec: 0 }), 0);
  // Retour rapide dans l'appli (copier un numéro chez le revendeur) : pas de code.
  assert.equal(shouldLock(t, t + 90_000, 300), false);
  assert.equal(shouldLock(t, t + 299_000, 300), false);
  assert.equal(shouldLock(t, t + 300_000, 300), true);
  assert.equal(shouldLock(t, t + 3_600_000, 300), true);
  // Tout de suite : toujours verrouillé, comme avant.
  assert.equal(shouldLock(t, t + 1, 0), true);
  // Jamais sorti de l'appli : rien à verrouiller.
  assert.equal(shouldLock(null, t, 300), false);
  assert.deepEqual(
    LOCK_DELAYS.map((d) => d.value),
    [0, 60, 300, 900],
  );
});
