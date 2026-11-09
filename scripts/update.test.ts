import assert from 'node:assert/strict';
import test from 'node:test';

import { availableUpdate, compareVersions, parseRelease } from '../src/logic/update.ts';

test('mises à jour : versions comparées chiffre par chiffre, lien de l’APK nommé', () => {
  assert.ok(compareVersions('1.1.110', '1.1.109') > 0);
  assert.ok(compareVersions('1.1.9', '1.1.10') < 0);
  assert.equal(compareVersions('v1.1.5', '1.1.5'), 0);
  const latest = parseRelease({ tag_name: 'v1.1.120', published_at: '2026-11-09T10:00:00Z' });
  assert.equal(latest?.apkUrl, 'https://github.com/nicox32/elrond/releases/download/v1.1.120/orvia-1.1.120.apk');
  assert.equal(availableUpdate('1.1.109', latest)?.version, '1.1.120');
  assert.equal(availableUpdate('1.1.120', latest), null);
  assert.equal(availableUpdate(undefined, latest), null);
  assert.equal(parseRelease({ tag_name: 'nightly' }), null);
  assert.equal(parseRelease(null), null);
});
