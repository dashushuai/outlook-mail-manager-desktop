import assert from 'node:assert/strict';
import test from 'node:test';

test('desktop theme store loads and writes theme through desktop settings bridge', async () => {
  const writes: unknown[] = [];
  const localStorageWrites: Array<[string, string]> = [];
  const toggles: Array<[string, boolean]> = [];

  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: {
      documentElement: {
        classList: {
          toggle: (className: string, enabled: boolean) => {
            toggles.push([className, enabled]);
          },
        },
      },
    },
  });

  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: () => 'dark',
      setItem: (key: string, value: string) => {
        localStorageWrites.push([key, value]);
      },
    },
  });

  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      matchMedia: () => ({ matches: false }),
      desktopShell: {
        getSettings: async () => ({
          theme: 'light',
          openAtLogin: false,
          minimizeToTray: true,
          automaticCheckIntervalMinutes: 5,
          windowBounds: { width: 1280, height: 800 },
        }),
        updateSettings: async (payload: unknown) => {
          writes.push(payload);
          return {
            theme: 'system',
            openAtLogin: false,
            minimizeToTray: true,
            automaticCheckIntervalMinutes: 5,
            windowBounds: { width: 1280, height: 800 },
          };
        },
      },
    },
  });

  const { useThemeStore } = await import('./theme');
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(useThemeStore.getState().theme, 'light');

  useThemeStore.getState().setTheme('system');
  await new Promise((resolve) => setImmediate(resolve));

  assert.deepEqual(writes, [{ theme: 'system' }]);
  assert.deepEqual(localStorageWrites, []);
  assert.ok(toggles.some(([className, enabled]) => className === 'dark' && enabled === false));
});
