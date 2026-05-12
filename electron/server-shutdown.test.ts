import test from 'node:test';
import assert from 'node:assert/strict';

test('stopServerWithCleanup closes the database when server close fails', async () => {
  const serverModule = await import('./server');

  assert.equal(typeof serverModule.stopServerWithCleanup, 'function');

  if (typeof serverModule.stopServerWithCleanup !== 'function') {
    return;
  }

  let closeDbCalls = 0;

  await assert.rejects(
    serverModule.stopServerWithCleanup(
      {} as never,
      async () => {
        closeDbCalls += 1;
      },
      async () => {
        throw new Error('close failed');
      },
    ),
    /close failed/,
  );

  assert.equal(closeDbCalls, 1);
});
