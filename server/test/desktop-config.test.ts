import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';

test('resolveDbPath uses the Electron user data directory in desktop mode even when DB_PATH is present', async () => {
  const configModule = await import('../src/config');

  assert.equal(typeof configModule.resolveDbPath, 'function');

  if (typeof configModule.resolveDbPath !== 'function') {
    return;
  }

  const runtimeDir = 'D:/AI/claude/outlook-mail-manager/.worktrees/sqlite3-migration/server/src/config';
  const dbPath = configModule.resolveDbPath(
    {
      DB_PATH: './custom/data.db',
      ELECTRON_DESKTOP: '1',
      ELECTRON_USER_DATA_PATH: 'C:/Users/test/AppData/Roaming/OutlookMailManager',
    },
    runtimeDir,
  );

  assert.equal(
    dbPath,
    path.resolve('C:/Users/test/AppData/Roaming/OutlookMailManager', 'outlook.db'),
  );
});

test('resolveDbPath uses the Electron user data directory in desktop mode when DB_PATH is absent', async () => {
  const configModule = await import('../src/config');

  assert.equal(typeof configModule.resolveDbPath, 'function');

  if (typeof configModule.resolveDbPath !== 'function') {
    return;
  }

  const dbPath = configModule.resolveDbPath({
    ELECTRON_DESKTOP: '1',
    ELECTRON_USER_DATA_PATH: 'C:/Users/test/AppData/Roaming/OutlookMailManager',
  });

  assert.equal(
    dbPath,
    path.resolve('C:/Users/test/AppData/Roaming/OutlookMailManager', 'outlook.db'),
  );
});

test('resolveDbPath throws when desktop mode is missing the Electron user data directory', async () => {
  const configModule = await import('../src/config');

  assert.equal(typeof configModule.resolveDbPath, 'function');

  if (typeof configModule.resolveDbPath !== 'function') {
    return;
  }

  assert.throws(
    () => configModule.resolveDbPath({
      ELECTRON_DESKTOP: '1',
      DB_PATH: './custom/data.db',
    }),
    /ELECTRON_USER_DATA_PATH/,
  );
});

test('resolveAccessPassword disables the access password in desktop mode', async () => {
  const configModule = await import('../src/config');

  assert.equal(typeof configModule.resolveAccessPassword, 'function');
  assert.equal(typeof configModule.requiresAccessPassword, 'function');

  if (
    typeof configModule.resolveAccessPassword !== 'function'
    || typeof configModule.requiresAccessPassword !== 'function'
  ) {
    return;
  }

  assert.equal(
    configModule.resolveAccessPassword({
      ELECTRON_DESKTOP: '1',
      ACCESS_PASSWORD: 'secret',
    }),
    '',
  );
  assert.equal(
    configModule.requiresAccessPassword({
      ELECTRON_DESKTOP: '1',
      ACCESS_PASSWORD: 'secret',
    }),
    false,
  );
  assert.equal(
    configModule.requiresAccessPassword({
      ACCESS_PASSWORD: 'secret',
    }),
    true,
  );
});
