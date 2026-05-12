import assert from 'node:assert/strict';
import test from 'node:test';

import { parseAccountImportJson } from './accountImportFiles';

test('parseAccountImportJson converts an account array to import text content', () => {
  const result = parseAccountImportJson(JSON.stringify([
    {
      email: 'a@example.com',
      password: 'pwd',
      client_id: 'client',
      refresh_token: 'refresh',
    },
  ]));

  assert.deepEqual(result, {
    content: 'a@example.com----pwd----client----refresh',
    separator: '----',
    format: ['email', 'password', 'client_id', 'refresh_token'],
  });
});

test('parseAccountImportJson converts an object with accounts to import text content', () => {
  const result = parseAccountImportJson(JSON.stringify({
    accounts: [
      {
        email: 'b@example.com',
        client_id: 'client-b',
        refresh_token: 'refresh-b',
      },
    ],
  }));

  assert.equal(result.content, 'b@example.com--------client-b----refresh-b');
});

test('parseAccountImportJson rejects malformed account import JSON', () => {
  assert.throws(() => parseAccountImportJson('{'), /不是有效的 JSON/);
  assert.throws(() => parseAccountImportJson(JSON.stringify({ accounts: [] })), /没有可导入的账户/);
  assert.throws(() => parseAccountImportJson(JSON.stringify([{ email: 'missing@example.com' }])), /缺少必要字段/);
});
