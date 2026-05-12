import assert from 'node:assert/strict';
import test from 'node:test';

test('applyEmbeddedServerEnv copies desktop runtime variables into process.env', async () => {
  const serverModule = await import('./server');

  assert.equal(typeof serverModule.applyEmbeddedServerEnv, 'function');

  if (typeof serverModule.applyEmbeddedServerEnv !== 'function') {
    return;
  }

  const originalDesktop = process.env.ELECTRON_DESKTOP;
  const originalUserDataPath = process.env.ELECTRON_USER_DATA_PATH;

  try {
    delete process.env.ELECTRON_DESKTOP;
    delete process.env.ELECTRON_USER_DATA_PATH;

    serverModule.applyEmbeddedServerEnv({
      ELECTRON_DESKTOP: '1',
      ELECTRON_USER_DATA_PATH: 'C:/Users/test/AppData/Roaming/OutlookMailManager',
    });

    assert.equal(process.env.ELECTRON_DESKTOP, '1');
    assert.equal(
      process.env.ELECTRON_USER_DATA_PATH,
      'C:/Users/test/AppData/Roaming/OutlookMailManager',
    );
  } finally {
    if (originalDesktop === undefined) {
      delete process.env.ELECTRON_DESKTOP;
    } else {
      process.env.ELECTRON_DESKTOP = originalDesktop;
    }

    if (originalUserDataPath === undefined) {
      delete process.env.ELECTRON_USER_DATA_PATH;
    } else {
      process.env.ELECTRON_USER_DATA_PATH = originalUserDataPath;
    }
  }
});
