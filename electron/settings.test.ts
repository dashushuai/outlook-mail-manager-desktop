import assert from 'node:assert/strict';
import test from 'node:test';

test('normalizeDesktopSettings merges persisted values with defaults and drops invalid entries', async () => {
  const settingsModule = await import('./settings');

  assert.equal(typeof settingsModule.normalizeDesktopSettings, 'function');

  if (typeof settingsModule.normalizeDesktopSettings !== 'function') {
    return;
  }

  const settings = settingsModule.normalizeDesktopSettings({
    theme: 'dark',
    openAtLogin: true,
    minimizeToTray: 'yes',
    automaticCheckIntervalMinutes: 0,
    windowBounds: {
      width: 1440,
      height: 900,
      x: 120,
      y: Number.NaN,
    },
  });

  assert.deepEqual(settings, {
    theme: 'dark',
    openAtLogin: true,
    minimizeToTray: true,
    automaticCheckIntervalMinutes: 5,
    windowBounds: {
      width: 1440,
      height: 900,
      x: 120,
    },
  });
});

test('parseDesktopSettingsPatch accepts valid partial updates and rejects invalid payloads', async () => {
  const settingsModule = await import('./settings');

  assert.equal(typeof settingsModule.parseDesktopSettingsPatch, 'function');

  if (typeof settingsModule.parseDesktopSettingsPatch !== 'function') {
    return;
  }

  assert.deepEqual(settingsModule.parseDesktopSettingsPatch({
    theme: 'light',
    minimizeToTray: false,
    automaticCheckIntervalMinutes: 15,
    windowBounds: {
      x: 40,
      y: 50,
      width: 1600,
      height: 900,
    },
  }), {
    theme: 'light',
    minimizeToTray: false,
    automaticCheckIntervalMinutes: 15,
    windowBounds: {
      x: 40,
      y: 50,
      width: 1600,
      height: 900,
    },
  });

  assert.equal(settingsModule.parseDesktopSettingsPatch(null), null);
  assert.equal(settingsModule.parseDesktopSettingsPatch({ automaticCheckIntervalMinutes: -1 }), null);
  assert.equal(settingsModule.parseDesktopSettingsPatch({ theme: 'blue' }), null);
  assert.equal(settingsModule.parseDesktopSettingsPatch({ windowBounds: { width: 100 } }), null);
  assert.equal(settingsModule.parseDesktopSettingsPatch({ windowBounds: { x: Number.POSITIVE_INFINITY } }), null);
});

test('DesktopSettingsManager persists updated settings and window bounds through the backing store', async () => {
  const settingsModule = await import('./settings');

  assert.equal(typeof settingsModule.DesktopSettingsManager, 'function');

  if (typeof settingsModule.DesktopSettingsManager !== 'function') {
    return;
  }

  const persisted: Record<string, unknown> = {
    desktopSettings: {
      openAtLogin: true,
      windowBounds: {
        width: 1400,
        height: 860,
        x: 80,
        y: 100,
      },
    },
  };
  const writes: Array<{ key: string; value: unknown }> = [];
  const manager = new settingsModule.DesktopSettingsManager({
    get: (key: string) => persisted[key],
    set: (key: string, value: unknown) => {
      persisted[key] = value;
      writes.push({ key, value });
    },
  });

  assert.deepEqual(manager.getSettings(), {
    theme: 'system',
    openAtLogin: true,
    minimizeToTray: true,
    automaticCheckIntervalMinutes: 5,
    windowBounds: {
      width: 1400,
      height: 860,
      x: 80,
      y: 100,
    },
  });

  const updatedSettings = manager.updateSettings({
    minimizeToTray: false,
    automaticCheckIntervalMinutes: 10,
  });

  assert.deepEqual(updatedSettings, {
    theme: 'system',
    openAtLogin: true,
    minimizeToTray: false,
    automaticCheckIntervalMinutes: 10,
    windowBounds: {
      width: 1400,
      height: 860,
      x: 80,
      y: 100,
    },
  });

  const nextWindowBounds = manager.saveWindowBounds({
    width: 1500,
    height: 920,
    x: 25,
    y: 35,
  });

  assert.deepEqual(nextWindowBounds, {
    width: 1500,
    height: 920,
    x: 25,
    y: 35,
  });
  assert.deepEqual(writes, [
    {
      key: 'desktopSettings',
      value: updatedSettings,
    },
    {
      key: 'desktopSettings',
      value: {
        ...updatedSettings,
        windowBounds: nextWindowBounds,
      },
    },
  ]);
});

test('DesktopSettingsManager rejects invalid settings updates', async () => {
  const settingsModule = await import('./settings');

  assert.equal(typeof settingsModule.DesktopSettingsManager, 'function');

  if (typeof settingsModule.DesktopSettingsManager !== 'function') {
    return;
  }

  const manager = new settingsModule.DesktopSettingsManager({
    get: () => undefined,
    set: () => {
      throw new Error('set should not be called');
    },
  });

  assert.throws(() => {
    manager.updateSettings({ automaticCheckIntervalMinutes: 0 });
  }, /Invalid desktop settings update/);
});

test('toBrowserWindowOptions restores persisted window coordinates when they are visible', async () => {
  const settingsModule = await import('./settings');

  assert.equal(typeof settingsModule.toBrowserWindowOptions, 'function');

  if (typeof settingsModule.toBrowserWindowOptions !== 'function') {
    return;
  }

  const displayWorkAreas = [{ x: 0, y: 0, width: 1920, height: 1080 }];

  assert.deepEqual(settingsModule.toBrowserWindowOptions({ width: 1280, height: 800 }, displayWorkAreas), {
    width: 1280,
    height: 800,
  });
  assert.deepEqual(settingsModule.toBrowserWindowOptions({ width: 1440, height: 900, x: 60, y: 70 }, displayWorkAreas), {
    width: 1440,
    height: 900,
    x: 60,
    y: 70,
  });
});

test('toBrowserWindowOptions drops unusable coordinates when displays change', async () => {
  const settingsModule = await import('./settings');

  assert.equal(typeof settingsModule.toBrowserWindowOptions, 'function');

  if (typeof settingsModule.toBrowserWindowOptions !== 'function') {
    return;
  }

  const displayWorkAreas = [{ x: 0, y: 0, width: 1920, height: 1080 }];

  assert.deepEqual(
    settingsModule.toBrowserWindowOptions({ width: 1440, height: 900, x: 5000, y: 5000 }, displayWorkAreas),
    {
      width: 1440,
      height: 900,
    },
  );
  assert.deepEqual(
    settingsModule.toBrowserWindowOptions({ width: 1440, height: 900, x: 1919, y: 20 }, displayWorkAreas),
    {
      width: 1440,
      height: 900,
    },
  );
});

test('ensureWindowVisible recenters a hidden window whose saved bounds are no longer usable', async () => {
  const settingsModule = await import('./settings');

  assert.equal(typeof settingsModule.ensureWindowVisible, 'function');

  if (typeof settingsModule.ensureWindowVisible !== 'function') {
    return;
  }

  const events: string[] = [];
  const window = {
    getBounds: () => ({ width: 1440, height: 900, x: 1919, y: 20 }),
    setBounds: (bounds: unknown) => events.push(`setBounds:${JSON.stringify(bounds)}`),
    center: () => events.push('center'),
  };

  settingsModule.ensureWindowVisible(window, [{ x: 0, y: 0, width: 1920, height: 1080 }]);

  assert.deepEqual(events, [
    'setBounds:{"width":1440,"height":900}',
    'center',
  ]);
});
