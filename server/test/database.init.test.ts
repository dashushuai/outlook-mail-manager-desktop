import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test, { mock } from 'node:test';

const tempDir = path.join(os.tmpdir(), 'outlook-mail-manager-sqlite-tests');
fs.mkdirSync(tempDir, { recursive: true });
process.env.DB_PATH = path.join(tempDir, 'shared.db');

test('initDb reuses concurrent initialization and preserves sqlite pragmas', async () => {
  const { initDb, getDb } = await import('../src/database');

  assert.equal(typeof initDb, 'function');
  assert.equal(typeof getDb, 'function');

  const [firstDb, secondDb, thirdDb] = await Promise.all([initDb(), initDb(), initDb()]);
  const fourthDb = await initDb();

  assert.equal(firstDb, secondDb);
  assert.equal(secondDb, thirdDb);
  assert.equal(thirdDb, fourthDb);
  assert.equal(getDb(), firstDb);

  const foreignKeys = await firstDb.get<{ foreign_keys: number }>('PRAGMA foreign_keys;');
  assert.equal(foreignKeys?.foreign_keys, 1);
});

test('runMigrations rethrows non-duplicate ALTER TABLE failures', async () => {
  const database = await import('../src/database');
  const migrations = await import('../src/database/migrations');
  const db = await database.initDb();
  const originalExec = db.exec.bind(db);

  mock.method(db, 'exec', async (sql: string) => {
    if (sql.includes('ALTER TABLE accounts ADD COLUMN token_refreshed_at')) {
      throw new Error('synthetic migration failure');
    }

    return originalExec(sql);
  });

  try {
    await assert.rejects(
      () => migrations.runMigrations(),
      /synthetic migration failure/,
    );
  } finally {
    mock.restoreAll();
  }
});
