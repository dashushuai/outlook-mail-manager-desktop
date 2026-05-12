import { initDb } from './index';

function isDuplicateColumnError(error: unknown): boolean {
  return error instanceof Error && /duplicate column name/i.test(error.message);
}

async function addColumnIfMissing(sql: string, db: Awaited<ReturnType<typeof initDb>>): Promise<void> {
  try {
    await db.exec(sql);
  } catch (error) {
    if (!isDuplicateColumnError(error)) {
      throw error;
    }
  }
}

export async function runMigrations(): Promise<void> {
  const db = await initDb();

  await db.exec(`
    CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL,
      password TEXT DEFAULT '',
      client_id TEXT NOT NULL,
      refresh_token TEXT NOT NULL,
      status TEXT DEFAULT 'active' CHECK(status IN ('active','inactive','error')),
      last_synced_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_accounts_email ON accounts(email);

    CREATE TABLE IF NOT EXISTS proxies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL DEFAULT '',
      type TEXT NOT NULL CHECK(type IN ('socks5','http')),
      host TEXT NOT NULL,
      port INTEGER NOT NULL,
      username TEXT DEFAULT '',
      password TEXT DEFAULT '',
      is_default INTEGER DEFAULT 0,
      last_tested_at DATETIME,
      last_test_ip TEXT DEFAULT '',
      status TEXT DEFAULT 'untested' CHECK(status IN ('untested','active','failed')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS mail_cache (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL,
      mailbox TEXT NOT NULL DEFAULT 'INBOX' CHECK(mailbox IN ('INBOX','Junk')),
      mail_id TEXT DEFAULT '',
      sender TEXT DEFAULT '',
      sender_name TEXT DEFAULT '',
      subject TEXT DEFAULT '',
      text_content TEXT DEFAULT '',
      html_content TEXT DEFAULT '',
      mail_date DATETIME,
      is_read INTEGER DEFAULT 0,
      cached_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_mail_cache_account ON mail_cache(account_id, mailbox);
    CREATE INDEX IF NOT EXISTS idx_mail_cache_date ON mail_cache(mail_date DESC);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_mail_cache_unique_mail
      ON mail_cache(account_id, mailbox, mail_id)
      WHERE mail_id <> '';
  `);

  await addColumnIfMissing(`ALTER TABLE accounts ADD COLUMN token_refreshed_at DATETIME`, db);

  await addColumnIfMissing(`ALTER TABLE accounts ADD COLUMN remark TEXT DEFAULT ''`, db);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      color TEXT NOT NULL DEFAULT '#3B82F6',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS account_tags (
      account_id INTEGER NOT NULL,
      tag_id INTEGER NOT NULL,
      PRIMARY KEY (account_id, tag_id),
      FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
      FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
    )
  `);
}
