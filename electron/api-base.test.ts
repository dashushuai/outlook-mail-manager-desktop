import test from 'node:test';
import assert from 'node:assert/strict';

test('resolveApiBase keeps the relative /api base for http renderer targets', async () => {
  const apiModule = await import('../web/src/lib/api');

  assert.equal(typeof apiModule.resolveApiBase, 'function');

  if (typeof apiModule.resolveApiBase !== 'function') {
    return;
  }

  assert.equal(
    apiModule.resolveApiBase({
      location: { protocol: 'http:' },
      desktopShell: { getServerUrl: () => 'http://127.0.0.1:3000' },
    } as Window),
    '/api',
  );
});

test('resolveApiBase uses the embedded server URL for file renderer targets', async () => {
  const apiModule = await import('../web/src/lib/api');

  assert.equal(typeof apiModule.resolveApiBase, 'function');

  if (typeof apiModule.resolveApiBase !== 'function') {
    return;
  }

  assert.equal(
    apiModule.resolveApiBase({
      location: { protocol: 'file:' },
      desktopShell: { getServerUrl: () => 'http://127.0.0.1:3000/' },
    } as Window),
    'http://127.0.0.1:3000/api',
  );
});
