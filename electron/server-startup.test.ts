import test from 'node:test';
import assert from 'node:assert/strict';

test('startServerWithModules closes the database when listen fails', async () => {
  const serverModule = await import('./server');

  assert.equal(typeof serverModule.startServerWithModules, 'function');

  if (typeof serverModule.startServerWithModules !== 'function') {
    return;
  }

  let closeDbCalls = 0;
  let errorHandler: ((error: Error) => void) | null = null;

  const fakeServer = {
    once(event: string, handler: (error: Error) => void) {
      if (event === 'error') {
        errorHandler = handler;
      }
    },
    off(event: string, handler: (error: Error) => void) {
      if (event === 'error' && errorHandler === handler) {
        errorHandler = null;
      }
    },
    listen() {
      errorHandler?.(new Error('EADDRINUSE'));
    },
  };

  await assert.rejects(
    serverModule.startServerWithModules(
      { host: '127.0.0.1', port: 3000, url: 'http://127.0.0.1:3000' },
      {
        app: { callback: () => (() => undefined) as (req: unknown, res: unknown) => void },
        initDb: async () => undefined,
        closeDb: async () => {
          closeDbCalls += 1;
        },
        runMigrations: async () => undefined,
      },
      () => fakeServer as never,
    ),
    /EADDRINUSE/,
  );

  assert.equal(closeDbCalls, 1);
});

test('startServerWithModules closes the database when migrations fail', async () => {
  const serverModule = await import('./server');

  assert.equal(typeof serverModule.startServerWithModules, 'function');

  if (typeof serverModule.startServerWithModules !== 'function') {
    return;
  }

  let closeDbCalls = 0;

  await assert.rejects(
    serverModule.startServerWithModules(
      { host: '127.0.0.1', port: 3000, url: 'http://127.0.0.1:3000' },
      {
        app: { callback: () => (() => undefined) as (req: unknown, res: unknown) => void },
        initDb: async () => undefined,
        closeDb: async () => {
          closeDbCalls += 1;
        },
        runMigrations: async () => {
          throw new Error('migration failed');
        },
      },
      () => {
        throw new Error('server should not be created when migrations fail');
      },
    ),
    /migration failed/,
  );

  assert.equal(closeDbCalls, 1);
});
