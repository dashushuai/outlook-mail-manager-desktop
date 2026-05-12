import test from 'node:test';
import assert from 'node:assert/strict';

test('resolveDesktopServerUrl returns the trimmed desktop server URL from argv', async () => {
  const desktopEnvModule = await import('./desktop-env');

  assert.equal(typeof desktopEnvModule.resolveDesktopServerUrl, 'function');

  if (typeof desktopEnvModule.resolveDesktopServerUrl !== 'function') {
    return;
  }

  assert.equal(
    desktopEnvModule.resolveDesktopServerUrl([
      'electron',
      '.',
      ' --ignored=1 ',
      ' --desktop-server-url=http://127.0.0.1:3000/ ',
    ]),
    'http://127.0.0.1:3000',
  );
});

test('resolveDesktopServerUrl returns null when the desktop server URL argument is absent', async () => {
  const desktopEnvModule = await import('./desktop-env');

  assert.equal(typeof desktopEnvModule.resolveDesktopServerUrl, 'function');

  if (typeof desktopEnvModule.resolveDesktopServerUrl !== 'function') {
    return;
  }

  assert.equal(desktopEnvModule.resolveDesktopServerUrl(['electron', '.']), null);
});
