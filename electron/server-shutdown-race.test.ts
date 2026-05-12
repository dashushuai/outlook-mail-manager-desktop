import test from 'node:test';
import assert from 'node:assert/strict';

test('resolveServerForShutdown waits for an in-flight start and returns the late server', async () => {
  const serverModule = await import('./server');

  assert.equal(typeof serverModule.resolveServerForShutdown, 'function');

  if (typeof serverModule.resolveServerForShutdown !== 'function') {
    return;
  }

  let server: { id: string } | null = null;
  let resolveStart: (() => void) | null = null;

  const pendingStart = new Promise<void>((resolve) => {
    resolveStart = () => {
      server = { id: 'late-server' };
      resolve();
    };
  });

  const waitForServer = serverModule.resolveServerForShutdown(
    null,
    pendingStart,
    () => server as never,
  );

  resolveStart?.();

  const resolvedServer = await waitForServer;
  assert.deepEqual(resolvedServer, { id: 'late-server' });
});
