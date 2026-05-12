import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { before, beforeEach, test } from 'node:test';
import type { Database } from 'sqlite';
import type { AccountModel } from '../src/models/Account';
import type { MailCacheModel } from '../src/models/MailCache';
import type { ProxyModel } from '../src/models/Proxy';
import type { TagModel } from '../src/models/Tag';

const tempDir = path.join(os.tmpdir(), 'outlook-mail-manager-sqlite-tests');
fs.mkdirSync(tempDir, { recursive: true });
process.env.DB_PATH = path.join(tempDir, 'shared.db');

let db: Database;
let accountModel: AccountModel;
let mailCacheModel: MailCacheModel;
let proxyModel: ProxyModel;
let tagModel: TagModel;

function createDeferred() {
  let resolve!: () => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

before(async () => {
  const database = await import('../src/database');
  const migrations = await import('../src/database/migrations');
  const accountModule = await import('../src/models/Account');
  const mailCacheModule = await import('../src/models/MailCache');
  const proxyModule = await import('../src/models/Proxy');
  const tagModule = await import('../src/models/Tag');

  db = await database.initDb();
  await migrations.runMigrations();
  accountModel = new accountModule.AccountModel();
  mailCacheModel = new mailCacheModule.MailCacheModel();
  proxyModel = new proxyModule.ProxyModel();
  tagModel = new tagModule.TagModel();
});

beforeEach(async () => {
  await db.exec(`
    DELETE FROM account_tags;
    DELETE FROM tags;
    DELETE FROM mail_cache;
    DELETE FROM proxies;
    DELETE FROM accounts;
  `);
});

test('TagModel and ProxyModel support async CRUD flows', async () => {
  const account = await accountModel.create({
    email: 'owner@example.com',
    password: 'pw',
    client_id: 'client-owner',
    refresh_token: 'rt-owner',
  });

  const tag = await tagModel.create('Priority', '#ff0000');
  const secondTag = await tagModel.create('Review', '#00ff00');
  const listedTags = await tagModel.list();
  assert.deepEqual(listedTags.map((item) => item.name), ['Priority', 'Review']);

  const updatedTag = await tagModel.update(tag.id, { color: '#0000ff' });
  assert.equal(updatedTag?.color, '#0000ff');

  await tagModel.setAccountTags(account.id, [tag.id, secondTag.id]);
  const accountTags = await tagModel.getTagsByAccountId(account.id);
  assert.deepEqual(accountTags.map((item) => item.name), ['Priority', 'Review']);

  const deletedTag = await tagModel.delete(secondTag.id);
  assert.equal(deletedTag, true);
  assert.equal((await tagModel.getById(secondTag.id)), undefined);

  const createdProxy = await proxyModel.create({
    name: 'Primary Proxy',
    type: 'http',
    host: '127.0.0.1',
    port: 8080,
    username: 'user',
    password: 'pass',
    is_default: true,
  });

  const updatedProxy = await proxyModel.update(createdProxy.id, { host: '10.0.0.5', is_default: false });
  assert.equal(updatedProxy?.host, '10.0.0.5');
  assert.equal(updatedProxy?.is_default, false);

  const fallbackProxy = await proxyModel.create({
    name: 'Backup Proxy',
    type: 'socks5',
    host: '10.0.0.6',
    port: 1080,
  });

  const defaultProxy = await proxyModel.setDefault(fallbackProxy.id);
  assert.equal(defaultProxy?.id, fallbackProxy.id);
  assert.equal(defaultProxy?.is_default, true);
  assert.equal((await proxyModel.getDefault())?.id, fallbackProxy.id);

  await proxyModel.updateTestResult(fallbackProxy.id, '203.0.113.10', 'active');
  const testedProxy = await proxyModel.getById(fallbackProxy.id);
  assert.equal(testedProxy?.status, 'active');
  assert.equal(testedProxy?.last_test_ip, '203.0.113.10');

  const deletedProxy = await proxyModel.delete(createdProxy.id);
  assert.equal(deletedProxy, true);
  assert.equal((await proxyModel.list()).length, 1);
});

test('ProxyModel.setDefault keeps the current default when the target proxy does not exist', async () => {
  const originalDefault = await proxyModel.create({
    name: 'Original Default',
    type: 'http',
    host: '127.0.0.10',
    port: 8081,
    is_default: true,
  });
  await proxyModel.create({
    name: 'Secondary Proxy',
    type: 'socks5',
    host: '127.0.0.11',
    port: 1081,
  });

  const result = await proxyModel.setDefault(999999);

  assert.equal(result, undefined);
  assert.equal((await proxyModel.getDefault())?.id, originalDefault.id);
  assert.equal((await proxyModel.getById(originalDefault.id))?.is_default, true);
});

test('TagModel.setAccountTags rolls back the full write when one insert fails', async () => {
  const account = await accountModel.create({
    email: 'tags@example.com',
    password: 'pw',
    client_id: 'client-tags',
    refresh_token: 'rt-tags',
  });
  const tag = await tagModel.create('Stable', '#123456');

  await tagModel.setAccountTags(account.id, [tag.id]);
  await assert.rejects(() => tagModel.setAccountTags(account.id, [tag.id, 999999]));

  const accountTags = await tagModel.getTagsByAccountId(account.id);
  assert.deepEqual(accountTags.map((item) => item.id), [tag.id]);
});

test('runInTransaction isolates a rollback from concurrent writes on the shared connection', async () => {
  const { getDb, runInTransaction } = await import('../src/database');
  const releaseRollback = createDeferred();
  const transactionStarted = createDeferred();

  const transactionPromise = runInTransaction(async (txDb) => {
    await txDb.run(
      'INSERT INTO accounts (email, password, client_id, refresh_token) VALUES (?, ?, ?, ?)',
      'tx-only@example.com',
      'pw',
      'client-tx',
      'rt-tx',
    );
    transactionStarted.resolve();
    await releaseRollback.promise;
    throw new Error('synthetic rollback');
  });

  await transactionStarted.promise;

  const outsideWritePromise = getDb().run(
    'INSERT INTO accounts (email, password, client_id, refresh_token) VALUES (?, ?, ?, ?)',
    'outside-write@example.com',
    'pw',
    'client-outside',
    'rt-outside',
  );

  releaseRollback.resolve();

  await assert.rejects(() => transactionPromise, /synthetic rollback/);
  await outsideWritePromise;

  const persistedEmails = (await db.all<{ email: string }[]>('SELECT email FROM accounts ORDER BY email'))
    .map((row) => row.email);

  assert.deepEqual(persistedEmails, ['outside-write@example.com']);
});

test('MailCacheModel upserts mails asynchronously by account and mailbox', async () => {
  const account = await accountModel.create({
    email: 'cache@example.com',
    password: 'pw',
    client_id: 'client-cache',
    refresh_token: 'rt-cache',
  });

  await mailCacheModel.upsert(account.id, 'INBOX', [
    {
      mail_id: 'mail-1',
      sender: 'sender-1@example.com',
      sender_name: 'Sender One',
      subject: 'Original subject',
      text_content: 'body-1',
      html_content: '<p>body-1</p>',
      mail_date: '2024-01-01T00:00:00.000Z',
    },
    {
      mail_id: 'mail-2',
      sender: 'sender-2@example.com',
      sender_name: 'Sender Two',
      subject: 'Second subject',
      text_content: 'body-2',
      html_content: '<p>body-2</p>',
      mail_date: '2024-01-02T00:00:00.000Z',
    },
  ]);

  await mailCacheModel.upsert(account.id, 'INBOX', [
    {
      mail_id: 'mail-1',
      sender: 'sender-1@example.com',
      sender_name: 'Sender One',
      subject: 'Updated subject',
      text_content: 'updated body',
      html_content: '<p>updated body</p>',
      mail_date: '2024-01-03T00:00:00.000Z',
    },
  ]);

  await db.run('UPDATE mail_cache SET is_read = 1 WHERE account_id = ? AND mailbox = ? AND mail_id = ?', account.id, 'INBOX', 'mail-1');

  const inbox = await mailCacheModel.getByAccount(account.id, 'INBOX', 1, 10);
  assert.equal(inbox.total, 2);
  assert.equal(inbox.list[0]?.mail_id, 'mail-1');
  assert.equal(inbox.list[0]?.subject, 'Updated subject');
  assert.equal(inbox.list[0]?.is_read, true);
  assert.equal(inbox.list[1]?.is_read, false);
  assert.equal(await mailCacheModel.countByAccount(account.id, 'INBOX'), 2);
  assert.equal(await mailCacheModel.countAll('INBOX'), 2);
});

test('AccountModel importConfirm and export work asynchronously', async () => {
  await accountModel.create({
    email: 'existing@example.com',
    password: 'old-pass',
    client_id: 'old-client',
    refresh_token: 'old-token',
  });

  const skipResult = await accountModel.importConfirm({
    content: [
      'existing@example.com----new-pass----new-client----new-token',
      'new@example.com----fresh-pass----fresh-client----fresh-token',
      'broken@example.com----missing-client',
    ].join('\n'),
    separator: '----',
    format: ['email', 'password', 'client_id', 'refresh_token'],
    mode: 'skip',
  });

  assert.equal(skipResult.imported, 1);
  assert.equal(skipResult.skipped, 1);
  assert.deepEqual(skipResult.errors, ['Line 3: missing required fields']);

  const overwriteResult = await accountModel.importConfirm({
    content: 'existing@example.com----updated-pass----updated-client----updated-token',
    separator: '----',
    format: ['email', 'password', 'client_id', 'refresh_token'],
    mode: 'overwrite',
  });

  assert.equal(overwriteResult.imported, 1);
  assert.equal(overwriteResult.skipped, 0);

  const exported = await accountModel.export(undefined, '----', ['email', 'password', 'client_id', 'refresh_token']);
  assert.match(exported, /existing@example\.com----updated-pass----updated-client----updated-token/);
  assert.match(exported, /new@example\.com----fresh-pass----fresh-client----fresh-token/);
});
