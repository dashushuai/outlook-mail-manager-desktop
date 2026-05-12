import test from 'node:test';
import assert from 'node:assert/strict';

test('handleDesktopStartupFailure exits the app after stopping the embedded server', async () => {
  const lifecycleModule = await import('./main-lifecycle');

  assert.equal(typeof lifecycleModule.handleDesktopStartupFailure, 'function');

  if (typeof lifecycleModule.handleDesktopStartupFailure !== 'function') {
    return;
  }

  const events: string[] = [];

  await lifecycleModule.handleDesktopStartupFailure(
    async () => {
      events.push('stop');
    },
    (code) => {
      events.push(`exit:${code}`);
    },
  );

  assert.deepEqual(events, ['stop', 'exit:1']);
});

test('handleDesktopStartupFailure still exits when stopping the embedded server fails', async () => {
  const lifecycleModule = await import('./main-lifecycle');

  assert.equal(typeof lifecycleModule.handleDesktopStartupFailure, 'function');

  if (typeof lifecycleModule.handleDesktopStartupFailure !== 'function') {
    return;
  }

  const events: string[] = [];

  await lifecycleModule.handleDesktopStartupFailure(
    async () => {
      events.push('stop');
      throw new Error('close failed');
    },
    (code) => {
      events.push(`exit:${code}`);
    },
  );

  assert.deepEqual(events, ['stop', 'exit:1']);
});

test('openMainWindow reports activation failures through the provided handler', async () => {
  const lifecycleModule = await import('./main-lifecycle');

  assert.equal(typeof lifecycleModule.openMainWindow, 'function');

  if (typeof lifecycleModule.openMainWindow !== 'function') {
    return;
  }

  const errors: string[] = [];

  lifecycleModule.openMainWindow(
    async () => {
      throw new Error('window failed');
    },
    (error) => {
      errors.push((error as Error).message);
    },
  );

  await new Promise((resolve) => setImmediate(resolve));

  assert.deepEqual(errors, ['window failed']);
});

test('shutdownDesktopApp still quits when embedded-server shutdown rejects', async () => {
  const lifecycleModule = await import('./main-lifecycle');

  assert.equal(typeof lifecycleModule.shutdownDesktopApp, 'function');

  if (typeof lifecycleModule.shutdownDesktopApp !== 'function') {
    return;
  }

  const events: string[] = [];

  await lifecycleModule.shutdownDesktopApp(
    async () => {
      events.push('stop');
      throw new Error('stop failed');
    },
    () => {
      events.push('quit');
    },
  );

  assert.deepEqual(events, ['stop', 'quit']);
});
