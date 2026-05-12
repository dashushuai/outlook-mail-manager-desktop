import assert from 'node:assert/strict';
import test from 'node:test';

test('createDesktopUpdater stays disabled in development mode', async () => {
  const updaterModule = await import('./updater');

  assert.equal(typeof updaterModule.createDesktopUpdater, 'function');

  if (typeof updaterModule.createDesktopUpdater !== 'function') {
    return;
  }

  const events: string[] = [];
  const updater = updaterModule.createDesktopUpdater({
    isPackaged: false,
    autoUpdater: {
      checkForUpdates: async () => {
        events.push('check');
      },
      quitAndInstall: () => {
        events.push('install');
      },
      on: () => undefined,
    },
    getWindows: () => [],
    logError: () => {
      throw new Error('logError should not run in development mode');
    },
  });

  await updater.initialize();
  await updater.checkForUpdates();
  updater.installUpdate();

  assert.deepEqual(updater.getStatus(), {
    available: false,
    checking: false,
    updateAvailable: false,
    downloaded: false,
    progress: null,
    version: null,
    error: null,
  });
  assert.deepEqual(events, []);
});

test('createDesktopUpdater tracks packaged update lifecycle and broadcasts status', async () => {
  const updaterModule = await import('./updater');

  assert.equal(typeof updaterModule.createDesktopUpdater, 'function');

  if (typeof updaterModule.createDesktopUpdater !== 'function') {
    return;
  }

  const listeners = new Map<string, Array<(...args: unknown[]) => void>>();
  const sent: Array<{ channel: string; payload: unknown }> = [];
  const updater = updaterModule.createDesktopUpdater({
    isPackaged: true,
    autoUpdater: {
      checkForUpdates: async () => undefined,
      quitAndInstall: () => undefined,
      on: (event: string, callback: (...args: unknown[]) => void) => {
        listeners.set(event, [...(listeners.get(event) ?? []), callback]);
      },
    },
    getWindows: () => [{
      webContents: {
        send: (channel: string, payload: unknown) => {
          sent.push({ channel, payload });
        },
      },
    }],
    logError: () => {
      throw new Error('logError should not run for successful update lifecycle');
    },
  });

  await updater.initialize();
  listeners.get('checking-for-update')?.[0]?.();
  listeners.get('update-available')?.[0]?.({ version: '1.0.1' });
  listeners.get('download-progress')?.[0]?.({ percent: 42.4 });
  listeners.get('update-downloaded')?.[0]?.({ version: '1.0.1' });

  assert.deepEqual(updater.getStatus(), {
    available: true,
    checking: false,
    updateAvailable: true,
    downloaded: true,
    progress: 100,
    version: '1.0.1',
    error: null,
  });
  assert.equal(sent.at(-1)?.channel, 'desktop:update-status-changed');
  assert.deepEqual(sent.at(-1)?.payload, updater.getStatus());
});

test('installUpdate runs the install hook before handing off to autoUpdater', async () => {
  const updaterModule = await import('./updater');

  assert.equal(typeof updaterModule.createDesktopUpdater, 'function');

  if (typeof updaterModule.createDesktopUpdater !== 'function') {
    return;
  }

  const listeners = new Map<string, Array<(...args: unknown[]) => void>>();
  const events: string[] = [];
  let releaseCleanup!: () => void;
  const cleanupFinished = new Promise<void>((resolve) => {
    releaseCleanup = resolve;
  });
  const updater = updaterModule.createDesktopUpdater({
    isPackaged: true,
    autoUpdater: {
      checkForUpdates: async () => undefined,
      quitAndInstall: () => {
        events.push('quitAndInstall');
      },
      on: (event: string, callback: (...args: unknown[]) => void) => {
        listeners.set(event, [...(listeners.get(event) ?? []), callback]);
      },
    },
    getWindows: () => [],
    beforeInstallUpdate: async () => {
      events.push('beforeInstall');
      await cleanupFinished;
      events.push('cleanupFinished');
    },
    logError: () => {
      throw new Error('logError should not run for install handoff');
    },
  });

  await updater.initialize();
  listeners.get('update-downloaded')?.[0]?.({ version: '1.0.1' });
  const install = updater.installUpdate();

  assert.deepEqual(events, ['beforeInstall']);
  releaseCleanup();
  await install;

  assert.deepEqual(events, ['beforeInstall', 'cleanupFinished', 'quitAndInstall']);
});

test('installUpdate still hands off to autoUpdater when the install hook fails', async () => {
  const updaterModule = await import('./updater');

  assert.equal(typeof updaterModule.createDesktopUpdater, 'function');

  if (typeof updaterModule.createDesktopUpdater !== 'function') {
    return;
  }

  const listeners = new Map<string, Array<(...args: unknown[]) => void>>();
  const events: string[] = [];
  const errors: string[] = [];
  const updater = updaterModule.createDesktopUpdater({
    isPackaged: true,
    autoUpdater: {
      checkForUpdates: async () => undefined,
      quitAndInstall: () => {
        events.push('quitAndInstall');
      },
      on: (event: string, callback: (...args: unknown[]) => void) => {
        listeners.set(event, [...(listeners.get(event) ?? []), callback]);
      },
    },
    getWindows: () => [],
    beforeInstallUpdate: async () => {
      throw new Error('cleanup failed');
    },
    logError: (message: string, error: unknown) => {
      errors.push(`${message}:${error instanceof Error ? error.message : String(error)}`);
    },
  });

  await updater.initialize();
  listeners.get('update-downloaded')?.[0]?.({ version: '1.0.1' });
  await updater.installUpdate();

  assert.deepEqual(events, ['quitAndInstall']);
  assert.deepEqual(errors, ['Failed to prepare update installation:cleanup failed']);
});

test('checkForUpdates reuses an active update check and clears stale download state on errors', async () => {
  const updaterModule = await import('./updater');

  assert.equal(typeof updaterModule.createDesktopUpdater, 'function');

  if (typeof updaterModule.createDesktopUpdater !== 'function') {
    return;
  }

  let activeCheckGate: Promise<void> | null = null;
  let releaseCheck: (() => void) | null = null;
  const blockNextChecks = () => {
    activeCheckGate = new Promise<void>((resolve) => {
      releaseCheck = resolve;
    });
  };
  const errors: string[] = [];
  const listeners = new Map<string, Array<(...args: unknown[]) => void>>();
  let checkCalls = 0;
  const updater = updaterModule.createDesktopUpdater({
    isPackaged: true,
    autoUpdater: {
      checkForUpdates: async () => {
        checkCalls += 1;
        await activeCheckGate;
      },
      quitAndInstall: () => undefined,
      on: (event: string, callback: (...args: unknown[]) => void) => {
        listeners.set(event, [...(listeners.get(event) ?? []), callback]);
      },
    },
    getWindows: () => [],
    logError: (message: string, error: unknown) => {
      errors.push(`${message}:${error instanceof Error ? error.message : String(error)}`);
    },
  });

  await updater.initialize();
  blockNextChecks();
  const firstCheck = updater.checkForUpdates();
  const secondCheck = updater.checkForUpdates();
  releaseCheck?.();
  await Promise.all([firstCheck, secondCheck]);
  listeners.get('update-available')?.[0]?.({ version: '1.0.1' });
  listeners.get('download-progress')?.[0]?.({ percent: 25 });
  await updater.checkForUpdates();
  listeners.get('update-downloaded')?.[0]?.({ version: '1.0.1' });
  listeners.get('error')?.[0]?.(new Error('network failed'));

  assert.equal(checkCalls, 2);
  assert.equal(updater.getStatus().downloaded, false);
  assert.equal(updater.getStatus().progress, null);
  assert.equal(updater.getStatus().updateAvailable, false);
  assert.equal(updater.getStatus().error, 'network failed');
  assert.deepEqual(errors, ['Auto update failed:network failed']);
});

test('registerUpdaterIpcHandlers wires status, check, and install channels', async () => {
  const updaterModule = await import('./updater');

  assert.equal(typeof updaterModule.registerUpdaterIpcHandlers, 'function');

  if (typeof updaterModule.registerUpdaterIpcHandlers !== 'function') {
    return;
  }

  const handlers = new Map<string, (...args: unknown[]) => unknown>();
  const calls: string[] = [];
  const ipcMain = {
    handle: (channel: string, handler: (...args: unknown[]) => unknown) => {
      handlers.set(channel, handler);
    },
  };

  updaterModule.registerUpdaterIpcHandlers({
    ipcMain,
    updater: {
      getStatus: () => ({ available: true }),
      checkForUpdates: async () => {
        calls.push('check');
        return { available: true };
      },
      installUpdate: () => {
        calls.push('install');
      },
    },
  });

  assert.deepEqual(handlers.get('desktop:get-update-status')?.({}), { available: true });
  assert.deepEqual(await handlers.get('desktop:check-for-updates')?.({}), { available: true });
  handlers.get('desktop:install-update')?.({});
  assert.deepEqual(calls, ['check', 'install']);
});
