import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Readable } from 'node:stream';
import { before, beforeEach, mock, test } from 'node:test';
import { open } from 'sqlite';
import sqlite3 from 'sqlite3';
import type { Database } from 'sqlite';
import type { AccountModel } from '../src/models/Account';
import type { MailCacheModel } from '../src/models/MailCache';
import type { ProxyModel } from '../src/models/Proxy';
import type { DashboardService } from '../src/services/DashboardService';
import type { GraphApiService } from '../src/services/GraphApiService';
import type { ImapService } from '../src/services/ImapService';
import type { MailService } from '../src/services/MailService';
import type { OAuthService } from '../src/services/OAuthService';
import type { ProxyService } from '../src/services/ProxyService';
import type { BackupController } from '../src/controllers/BackupController';
import { config } from '../src/config';

const tempDir = path.join(os.tmpdir(), 'outlook-mail-manager-sqlite-tests');
fs.mkdirSync(tempDir, { recursive: true });
process.env.DB_PATH = path.join(tempDir, 'shared.db');

let db: Database;
let accountModel: AccountModel;
let cacheModel: MailCacheModel;
let proxyModel: ProxyModel;
let DashboardServiceClass: typeof DashboardService;
let GraphApiServiceClass: typeof GraphApiService;
let ImapServiceClass: typeof ImapService;
let MailServiceClass: typeof MailService;
let OAuthServiceClass: typeof OAuthService;
let ProxyServiceClass: typeof ProxyService;
let BackupControllerClass: typeof BackupController;

before(async () => {
  const database = await import('../src/database');
  const migrations = await import('../src/database/migrations');
  const accountModule = await import('../src/models/Account');
  const cacheModule = await import('../src/models/MailCache');
  const proxyModule = await import('../src/models/Proxy');
  const dashboardModule = await import('../src/services/DashboardService');
  const graphModule = await import('../src/services/GraphApiService');
  const imapModule = await import('../src/services/ImapService');
  const mailModule = await import('../src/services/MailService');
  const oauthModule = await import('../src/services/OAuthService');
  const proxyServiceModule = await import('../src/services/ProxyService');
  const backupControllerModule = await import('../src/controllers/BackupController');

  db = await database.initDb();
  await migrations.runMigrations();
  accountModel = new accountModule.AccountModel();
  cacheModel = new cacheModule.MailCacheModel();
  proxyModel = new proxyModule.ProxyModel();
  DashboardServiceClass = dashboardModule.DashboardService;
  GraphApiServiceClass = graphModule.GraphApiService;
  ImapServiceClass = imapModule.ImapService;
  MailServiceClass = mailModule.MailService;
  OAuthServiceClass = oauthModule.OAuthService;
  ProxyServiceClass = proxyServiceModule.ProxyService;
  BackupControllerClass = backupControllerModule.BackupController;
});

beforeEach(async () => {
  mock.restoreAll();
  await db.exec(`
    DELETE FROM account_tags;
    DELETE FROM tags;
    DELETE FROM mail_cache;
    DELETE FROM proxies;
    DELETE FROM accounts;
  `);
});

async function streamToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];

  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks);
}

test('DashboardService aggregates async model results', async () => {
  const firstAccount = await accountModel.create({
    email: 'active@example.com',
    password: 'pw',
    client_id: 'client-active',
    refresh_token: 'rt-active',
  });
  const secondAccount = await accountModel.create({
    email: 'error@example.com',
    password: 'pw',
    client_id: 'client-error',
    refresh_token: 'rt-error',
  });

  await accountModel.update(firstAccount.id, { token_refreshed_at: '2024-01-01T00:00:00.000Z', status: 'active' });
  await accountModel.update(secondAccount.id, { status: 'error' });

  await proxyModel.create({ name: 'http-default', type: 'http', host: '127.0.0.1', port: 8080, is_default: true });
  await proxyModel.create({ name: 'socks-backup', type: 'socks5', host: '127.0.0.2', port: 1080 });
  const activeProxy = (await proxyModel.list())[0];
  await proxyModel.updateTestResult(activeProxy.id, '198.51.100.10', 'active');

  await cacheModel.upsert(firstAccount.id, 'INBOX', [{ mail_id: 'mail-inbox', subject: 'Inbox mail', mail_date: '2024-02-01T00:00:00.000Z' }]);
  await cacheModel.upsert(firstAccount.id, 'Junk', [{ mail_id: 'mail-junk', subject: 'Junk mail', mail_date: '2024-02-02T00:00:00.000Z' }]);

  const service = new DashboardServiceClass();
  const stats = await service.getStats();

  assert.equal(stats.totalAccounts, 2);
  assert.equal(stats.activeAccounts, 1);
  assert.equal(stats.errorAccounts, 1);
  assert.equal(stats.unusedAccounts, 1);
  assert.equal(stats.totalInboxMails, 1);
  assert.equal(stats.totalJunkMails, 1);
  assert.equal(stats.totalProxies, 2);
  assert.equal(stats.activeProxies, 1);
  assert.equal(stats.accountStats.find((item) => item.account_id === firstAccount.id)?.inbox_count, 1);
});

test('ProxyService resolves explicit and default proxies asynchronously', async () => {
  const defaultProxy = await proxyModel.create({
    name: 'default-http',
    type: 'http',
    host: '127.0.0.1',
    port: 8080,
    is_default: true,
  });
  const socksProxy = await proxyModel.create({
    name: 'socks-proxy',
    type: 'socks5',
    host: '127.0.0.2',
    port: 1080,
  });

  const service = new ProxyServiceClass();
  const defaultAgent = await service.getAgent();
  const explicitAgent = await service.getAgent(socksProxy.id);

  assert.equal(defaultAgent.type, 'http');
  assert.ok(defaultAgent.dispatcher);
  assert.equal((await proxyModel.getDefault())?.id, defaultProxy.id);
  assert.equal(explicitAgent.type, 'socks5');
  assert.ok(explicitAgent.agent);
});

test('MailService fetchMails awaits async model updates on Graph success', async () => {
  const account = await accountModel.create({
    email: 'graph@example.com',
    password: 'pw',
    client_id: 'graph-client',
    refresh_token: 'graph-rt',
  });

  mock.method(OAuthServiceClass.prototype, 'refreshGraphToken', async () => ({
    access_token: 'access-token',
    refresh_token: 'rotated-rt',
    has_mail_scope: true,
    expires_in: 3600,
  }));
  mock.method(GraphApiServiceClass.prototype, 'fetchMails', async () => ([
    {
      mail_id: 'graph-mail-1',
      sender: 'sender@example.com',
      sender_name: 'Sender',
      subject: 'Graph mail',
      text_content: 'body',
      html_content: '<p>body</p>',
      mail_date: '2024-03-01T00:00:00.000Z',
    },
  ]));
  mock.method(ImapServiceClass.prototype, 'fetchMails', async () => {
    throw new Error('IMAP should not be used on Graph success');
  });

  const service = new MailServiceClass();
  const result = await service.fetchMails(account.id, 'INBOX');

  assert.equal(result.protocol, 'graph');
  assert.equal(result.cached, false);
  assert.equal(result.total, 1);
  assert.equal(result.mails[0]?.mail_id, 'graph-mail-1');

  const stored = await cacheModel.getByAccount(account.id, 'INBOX', 1, 10);
  assert.equal(stored.total, 1);
  assert.equal(stored.list[0]?.subject, 'Graph mail');

  const updatedAccount = await accountModel.getById(account.id);
  assert.equal(updatedAccount?.refresh_token, 'rotated-rt');
  assert.ok(updatedAccount?.last_synced_at);
});

test('MailService falls back to cached mails and marks the account error when remote refreshes fail', async () => {
  const account = await accountModel.create({
    email: 'fallback@example.com',
    password: 'pw',
    client_id: 'fallback-client',
    refresh_token: 'fallback-rt',
  });

  await cacheModel.upsert(account.id, 'INBOX', [
    {
      mail_id: 'cached-mail-1',
      sender: 'cache@example.com',
      sender_name: 'Cache Sender',
      subject: 'Cached subject',
      text_content: 'cached body',
      html_content: '<p>cached body</p>',
      mail_date: '2024-04-01T00:00:00.000Z',
    },
  ]);

  mock.method(OAuthServiceClass.prototype, 'refreshGraphToken', async () => {
    throw new Error('Graph token refresh failed');
  });
  mock.method(OAuthServiceClass.prototype, 'refreshImapToken', async () => {
    throw new Error('IMAP token refresh failed');
  });

  const service = new MailServiceClass();
  const result = await service.fetchMails(account.id, 'INBOX');

  assert.equal(result.cached, true);
  assert.equal(result.total, 1);
  assert.equal(result.mails[0]?.mail_id, 'cached-mail-1');

  const erroredAccount = await accountModel.getById(account.id);
  assert.equal(erroredAccount?.status, 'error');
});

test('BackupController download exports a consistent snapshot under WAL', async () => {
  const account = await accountModel.create({
    email: `wal-backup-${Date.now()}@example.com`,
    password: 'pw',
    client_id: 'backup-client',
    refresh_token: 'backup-rt',
  });

  const controller = new BackupControllerClass();
  const ctx = {
    set: mock.fn(),
    body: undefined,
  } as any;

  await controller.download(ctx);

  const snapshotPath = path.join(tempDir, `download-snapshot-${Date.now()}.db`);
  const snapshotBuffer = await streamToBuffer(ctx.body as Readable);
  fs.writeFileSync(snapshotPath, snapshotBuffer);

  const snapshotDb = await open({
    filename: snapshotPath,
    driver: sqlite3.Database,
  });

  try {
    const row = await snapshotDb.get<{ c: number }>('SELECT COUNT(*) as c FROM accounts WHERE id = ?', account.id);

    assert.equal(row?.c, 1);
    assert.equal(ctx.set.mock.calls.length >= 2, true);
  } finally {
    await snapshotDb.close();
    fs.rmSync(snapshotPath, { force: true });
  }
});

test('BackupController restore reopens the shared connection with restored data', async () => {
  const sourceAccount = await accountModel.create({
    email: `restore-source-${Date.now()}@example.com`,
    password: 'pw',
    client_id: 'restore-source-client',
    refresh_token: 'restore-source-rt',
  });

  const restoreSnapshotPath = path.join(tempDir, `restore-snapshot-${Date.now()}.db`);
  fs.rmSync(restoreSnapshotPath, { force: true });
  await db.exec(`VACUUM INTO '${restoreSnapshotPath.replace(/'/g, "''")}'`);

  await db.exec('DELETE FROM accounts');
  const liveAccount = await accountModel.create({
    email: `restore-live-${Date.now()}@example.com`,
    password: 'pw',
    client_id: 'restore-live-client',
    refresh_token: 'restore-live-rt',
  });

  const controller = new BackupControllerClass();
  const ctx = {
    request: {
      body: {
        fileContent: fs.readFileSync(restoreSnapshotPath).toString('base64'),
      },
    },
    body: undefined,
  } as any;

  try {
    await controller.restore(ctx);

    const restoredAccounts = await accountModel.list();
    assert.equal(restoredAccounts.list.some((account) => account.id === sourceAccount.id), true);
    assert.equal(restoredAccounts.list.some((account) => account.id === liveAccount.id), false);

    const postRestoreAccount = await accountModel.create({
      email: `restore-post-${Date.now()}@example.com`,
      password: 'pw',
      client_id: 'restore-post-client',
      refresh_token: 'restore-post-rt',
    });

    assert.ok(postRestoreAccount.id > 0);
    assert.equal(ctx.body?.code, 200);
  } finally {
    fs.rmSync(restoreSnapshotPath, { force: true });
  }
});
