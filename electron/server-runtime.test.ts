import test from 'node:test';
import assert from 'node:assert/strict';

test('resolveEmbeddedServerModulePaths points at compiled server runtime modules', async () => {
  const serverModule = await import('./server');

  assert.equal(typeof serverModule.resolveEmbeddedServerModulePaths, 'function');

  if (typeof serverModule.resolveEmbeddedServerModulePaths !== 'function') {
    return;
  }

  const paths = serverModule.resolveEmbeddedServerModulePaths(
    'D:/AI/claude/outlook-mail-manager/.worktrees/sqlite3-migration/dist-electron',
  );

  assert.deepEqual(paths, {
    appPath: 'D:\\AI\\claude\\outlook-mail-manager\\.worktrees\\sqlite3-migration\\server\\dist\\app.js',
    databasePath: 'D:\\AI\\claude\\outlook-mail-manager\\.worktrees\\sqlite3-migration\\server\\dist\\database\\index.js',
    migrationsPath: 'D:\\AI\\claude\\outlook-mail-manager\\.worktrees\\sqlite3-migration\\server\\dist\\database\\migrations.js',
  });
});
