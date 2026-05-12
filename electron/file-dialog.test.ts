import assert from 'node:assert/strict';
import test from 'node:test';

test('registerFileDialogHandlers opens a native file dialog and returns text content', async () => {
  const fileDialogModule = await import('./file-dialog');

  assert.equal(typeof fileDialogModule.registerFileDialogHandlers, 'function');

  if (typeof fileDialogModule.registerFileDialogHandlers !== 'function') {
    return;
  }

  const handlers = new Map<string, (...args: unknown[]) => unknown>();
  const ipcMain = {
    handle: (channel: string, handler: (...args: unknown[]) => unknown) => {
      handlers.set(channel, handler);
    },
  };

  fileDialogModule.registerFileDialogHandlers({
    ipcMain,
    dialog: {
      showOpenDialog: async (options: unknown) => {
        assert.deepEqual(options, {
          title: '选择账户文件',
          properties: ['openFile'],
          filters: [{ name: 'Text', extensions: ['txt', 'csv'] }],
        });
        return { canceled: false, filePaths: ['C:\\tmp\\accounts.txt'] };
      },
      showSaveDialog: async () => ({ canceled: true }),
    },
    readFile: async (filePath: string, encoding: BufferEncoding) => {
      assert.equal(filePath, 'C:\\tmp\\accounts.txt');
      assert.equal(encoding, 'utf8');
      return 'a@example.com----pwd';
    },
    writeFile: async () => {
      throw new Error('writeFile should not run for open dialog');
    },
  });

  const result = await handlers.get('desktop:open-file-dialog')?.({}, {
    title: '选择账户文件',
    filters: [{ name: 'Text', extensions: ['txt', 'csv'] }],
    encoding: 'utf8',
  });

  assert.deepEqual(result, {
    filePath: 'C:\\tmp\\accounts.txt',
    fileName: 'accounts.txt',
    content: 'a@example.com----pwd',
  });
});

test('registerFileDialogHandlers saves text content with a native save dialog', async () => {
  const fileDialogModule = await import('./file-dialog');

  assert.equal(typeof fileDialogModule.registerFileDialogHandlers, 'function');

  if (typeof fileDialogModule.registerFileDialogHandlers !== 'function') {
    return;
  }

  const handlers = new Map<string, (...args: unknown[]) => unknown>();
  const writes: Array<{ filePath: string; content: string; encoding: BufferEncoding }> = [];
  const ipcMain = {
    handle: (channel: string, handler: (...args: unknown[]) => unknown) => {
      handlers.set(channel, handler);
    },
  };

  fileDialogModule.registerFileDialogHandlers({
    ipcMain,
    dialog: {
      showOpenDialog: async () => ({ canceled: true, filePaths: [] }),
      showSaveDialog: async (options: unknown) => {
        assert.deepEqual(options, {
          title: '导出账户',
          defaultPath: 'accounts.txt',
          filters: [{ name: 'Text', extensions: ['txt'] }],
        });
        return { canceled: false, filePath: 'C:\\tmp\\accounts.txt' };
      },
    },
    readFile: async () => {
      throw new Error('readFile should not run for save dialog');
    },
    writeFile: async (filePath: string, content: string, encoding: BufferEncoding) => {
      writes.push({ filePath, content, encoding });
    },
  });

  const result = await handlers.get('desktop:save-file-dialog')?.({}, {
    title: '导出账户',
    defaultPath: 'accounts.txt',
    filters: [{ name: 'Text', extensions: ['txt'] }],
    content: 'a@example.com----pwd',
    encoding: 'utf8',
  });

  assert.equal(result, true);
  assert.deepEqual(writes, [{
    filePath: 'C:\\tmp\\accounts.txt',
    content: 'a@example.com----pwd',
    encoding: 'utf8',
  }]);
});

test('registerFileDialogHandlers rejects invalid payloads and returns null or false on cancel', async () => {
  const fileDialogModule = await import('./file-dialog');

  assert.equal(typeof fileDialogModule.registerFileDialogHandlers, 'function');

  if (typeof fileDialogModule.registerFileDialogHandlers !== 'function') {
    return;
  }

  const handlers = new Map<string, (...args: unknown[]) => unknown>();
  const ipcMain = {
    handle: (channel: string, handler: (...args: unknown[]) => unknown) => {
      handlers.set(channel, handler);
    },
  };

  fileDialogModule.registerFileDialogHandlers({
    ipcMain,
    dialog: {
      showOpenDialog: async () => ({ canceled: true, filePaths: [] }),
      showSaveDialog: async () => ({ canceled: true }),
    },
    readFile: async () => {
      throw new Error('readFile should not run when canceled');
    },
    writeFile: async () => {
      throw new Error('writeFile should not run when canceled or invalid');
    },
  });

  assert.equal(await handlers.get('desktop:open-file-dialog')?.({}, { encoding: 'utf8' }), null);
  assert.equal(await handlers.get('desktop:save-file-dialog')?.({}, { content: 'ok', encoding: 'utf8' }), false);
  await assert.rejects(
    async () => handlers.get('desktop:save-file-dialog')?.({}, { content: 123, encoding: 'utf8' }),
    /Invalid file save payload/,
  );
  await assert.rejects(
    async () => handlers.get('desktop:open-file-dialog')?.({}, { encoding: 'utf16' }),
    /Invalid file open payload/,
  );
});
