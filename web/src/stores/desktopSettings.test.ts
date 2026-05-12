import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createDesktopSettingsBridge,
  defaultDesktopSettings,
  finalizeAutomaticCheckIntervalInput,
  isDesktopShellAvailable,
  parseAutomaticCheckIntervalInput,
} from './desktopSettings';

test('desktop settings bridge loads settings and updates open-at-login through desktop shell', async () => {
  const writes: unknown[] = [];

  const bridge = createDesktopSettingsBridge({
    desktopShell: {
      getSettings: async () => ({
        ...defaultDesktopSettings,
        openAtLogin: true,
        minimizeToTray: false,
        automaticCheckIntervalMinutes: 15,
      }),
      updateSettings: async (payload) => {
        writes.push(payload);

        return {
          ...defaultDesktopSettings,
          openAtLogin: Boolean(payload.openAtLogin),
          minimizeToTray: false,
          automaticCheckIntervalMinutes: 15,
        };
      },
    },
  });

  const loaded = await bridge.load();
  const updated = await bridge.update({ openAtLogin: false });

  assert.equal(loaded.openAtLogin, true);
  assert.equal(loaded.minimizeToTray, false);
  assert.equal(loaded.automaticCheckIntervalMinutes, 15);
  assert.deepEqual(writes, [{ openAtLogin: false }]);
  assert.equal(updated.openAtLogin, false);
});

test('desktop settings bridge is inert when desktop shell is unavailable', async () => {
  const bridge = createDesktopSettingsBridge({});

  const loaded = await bridge.load();
  const updated = await bridge.update({ openAtLogin: true });

  assert.equal(isDesktopShellAvailable(undefined), false);
  assert.deepEqual(loaded, defaultDesktopSettings);
  assert.deepEqual(updated, defaultDesktopSettings);
});

test('automatic check interval parser only accepts positive integers', () => {
  assert.equal(parseAutomaticCheckIntervalInput('15'), 15);
  assert.equal(parseAutomaticCheckIntervalInput(' 05 '), 5);
  assert.equal(parseAutomaticCheckIntervalInput('0'), null);
  assert.equal(parseAutomaticCheckIntervalInput('-2'), null);
  assert.equal(parseAutomaticCheckIntervalInput('1.5'), null);
  assert.equal(parseAutomaticCheckIntervalInput('abc'), null);
  assert.equal(parseAutomaticCheckIntervalInput(''), null);
});

test('automatic check interval blur restores the last valid value when draft is invalid', () => {
  assert.equal(finalizeAutomaticCheckIntervalInput('18', 5), '18');
  assert.equal(finalizeAutomaticCheckIntervalInput('0', 5), '5');
  assert.equal(finalizeAutomaticCheckIntervalInput('', 12), '12');
});
