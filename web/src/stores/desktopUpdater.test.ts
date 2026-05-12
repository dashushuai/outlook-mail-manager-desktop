import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createDesktopUpdaterBridge,
  defaultUpdateStatus,
  isDesktopUpdaterAvailable,
} from './desktopUpdater';

test('desktop updater bridge loads status, checks for updates, installs, and subscribes to changes', async () => {
  const events: string[] = [];
  let listener: ((status: typeof defaultUpdateStatus) => void) | null = null;
  const unsubscribe = () => {
    events.push('unsubscribe');
  };

  const bridge = createDesktopUpdaterBridge({
    desktopShell: {
      getUpdateStatus: async () => ({
        ...defaultUpdateStatus,
        available: true,
      }),
      checkForUpdates: async () => ({
        ...defaultUpdateStatus,
        available: true,
        checking: true,
      }),
      installUpdate: async () => {
        events.push('install');
      },
      onUpdateStatusChanged: (callback) => {
        listener = callback;
        return unsubscribe;
      },
    },
  });

  const loaded = await bridge.getStatus();
  const checked = await bridge.checkForUpdates();
  await bridge.installUpdate();
  const stop = bridge.onStatusChanged((status) => {
    events.push(`status:${status.progress}`);
  });

  assert.notEqual(listener, null);
  const emitStatus = listener as unknown as (status: typeof defaultUpdateStatus) => void;
  emitStatus({
    ...defaultUpdateStatus,
    available: true,
    progress: 50,
  });
  stop();

  assert.equal(loaded.available, true);
  assert.equal(checked.checking, true);
  assert.deepEqual(events, ['install', 'status:50', 'unsubscribe']);
});

test('desktop updater bridge is inert when desktop shell update API is unavailable', async () => {
  const bridge = createDesktopUpdaterBridge({});

  assert.equal(isDesktopUpdaterAvailable(undefined), false);
  assert.deepEqual(await bridge.getStatus(), defaultUpdateStatus);
  assert.deepEqual(await bridge.checkForUpdates(), defaultUpdateStatus);
  await assert.doesNotReject(async () => bridge.installUpdate());
});
