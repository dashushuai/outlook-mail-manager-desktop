import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveBackupApiUrl } from './backupApi';

test('backup API uses desktop server URL for packaged file renderer', () => {
  const url = resolveBackupApiUrl('/backup/restore', {
    location: { protocol: 'file:' },
    desktopShell: { getServerUrl: () => 'http://127.0.0.1:49152/' },
  } as Window);

  assert.equal(url, 'http://127.0.0.1:49152/api/backup/restore');
});

test('backup API keeps relative URLs for web renderer', () => {
  const url = resolveBackupApiUrl('/backup/download', {
    location: { protocol: 'http:' },
    desktopShell: { getServerUrl: () => 'http://127.0.0.1:49152/' },
  } as Window);

  assert.equal(url, '/api/backup/download');
});
