import assert from 'node:assert/strict';
import test from 'node:test';

import {
  isDesktopFileDialogAvailable,
  openDesktopFile,
  saveDesktopFile,
} from './desktopFiles';

test('desktop file helpers open and save through desktop shell when available', async () => {
  const calls: unknown[] = [];
  const shell = {
    openFileDialog: async (payload: unknown) => {
      calls.push({ open: payload });
      return { fileName: 'accounts.txt', content: 'mail----pwd' };
    },
    saveFileDialog: async (payload: unknown) => {
      calls.push({ save: payload });
      return true;
    },
  };

  const opened = await openDesktopFile({ desktopShell: shell }, {
    title: '选择账户文件',
    filters: [{ name: 'Text', extensions: ['txt'] }],
    encoding: 'utf8',
  });
  const saved = await saveDesktopFile({ desktopShell: shell }, {
    title: '导出账户',
    defaultPath: 'accounts.txt',
    filters: [{ name: 'Text', extensions: ['txt'] }],
    content: 'mail----pwd',
    encoding: 'utf8',
  });

  assert.equal(isDesktopFileDialogAvailable({ desktopShell: shell }), true);
  assert.deepEqual(opened, { fileName: 'accounts.txt', content: 'mail----pwd' });
  assert.equal(saved, true);
  assert.deepEqual(calls, [
    {
      open: {
        title: '选择账户文件',
        filters: [{ name: 'Text', extensions: ['txt'] }],
        encoding: 'utf8',
      },
    },
    {
      save: {
        title: '导出账户',
        defaultPath: 'accounts.txt',
        filters: [{ name: 'Text', extensions: ['txt'] }],
        content: 'mail----pwd',
        encoding: 'utf8',
      },
    },
  ]);
});

test('desktop file helpers are inert without desktop shell file APIs', async () => {
  assert.equal(isDesktopFileDialogAvailable(undefined), false);
  assert.equal(await openDesktopFile({}, { encoding: 'utf8' }), null);
  assert.equal(await saveDesktopFile({}, { content: 'x', encoding: 'utf8' }), false);
});

test('desktop file helpers require callable desktop shell file APIs', async () => {
  const malformedShell = {
    desktopShell: {
      openFileDialog: true,
      saveFileDialog: 'yes',
    },
  } as unknown as Parameters<typeof isDesktopFileDialogAvailable>[0];

  assert.equal(isDesktopFileDialogAvailable(malformedShell), false);
  assert.equal(await openDesktopFile(malformedShell, { encoding: 'utf8' }), null);
  assert.equal(await saveDesktopFile(malformedShell, { content: 'x', encoding: 'utf8' }), false);
});
