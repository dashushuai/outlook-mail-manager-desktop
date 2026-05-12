import test from 'node:test';
import assert from 'node:assert/strict';

test('resolveDesktopServerConfig falls back to localhost defaults', async () => {
  const serverModule = await import('./server');

  assert.equal(typeof serverModule.resolveDesktopServerConfig, 'function');

  if (typeof serverModule.resolveDesktopServerConfig !== 'function') {
    return;
  }

  const config = serverModule.resolveDesktopServerConfig({});

  assert.deepEqual(config, {
    host: '127.0.0.1',
    port: 3000,
    url: 'http://127.0.0.1:3000',
  });
});

test('resolveDesktopServerConfig trims host and accepts a custom port', async () => {
  const serverModule = await import('./server');

  assert.equal(typeof serverModule.resolveDesktopServerConfig, 'function');

  if (typeof serverModule.resolveDesktopServerConfig !== 'function') {
    return;
  }

  const config = serverModule.resolveDesktopServerConfig({
    ELECTRON_SERVER_HOST: ' localhost ',
    PORT: '4123',
  });

  assert.deepEqual(config, {
    host: 'localhost',
    port: 4123,
    url: 'http://localhost:4123',
  });
});

test('resolveDesktopServerConfig accepts TCP port upper bound', async () => {
  const serverModule = await import('./server');

  assert.equal(typeof serverModule.resolveDesktopServerConfig, 'function');

  if (typeof serverModule.resolveDesktopServerConfig !== 'function') {
    return;
  }

  const config = serverModule.resolveDesktopServerConfig({ PORT: '65535' });

  assert.equal(config.port, 65535);
  assert.equal(config.url, 'http://127.0.0.1:65535');
});

test('resolveDesktopServerConfig ignores ports outside the TCP range', async () => {
  const serverModule = await import('./server');

  assert.equal(typeof serverModule.resolveDesktopServerConfig, 'function');

  if (typeof serverModule.resolveDesktopServerConfig !== 'function') {
    return;
  }

  const config = serverModule.resolveDesktopServerConfig({ PORT: '65536' });

  assert.equal(config.port, 3000);
  assert.equal(config.url, 'http://127.0.0.1:3000');
});

test('resolveDesktopServerConfig ignores non-integer ports', async () => {
  const serverModule = await import('./server');

  assert.equal(typeof serverModule.resolveDesktopServerConfig, 'function');

  if (typeof serverModule.resolveDesktopServerConfig !== 'function') {
    return;
  }

  const config = serverModule.resolveDesktopServerConfig({ PORT: '1.5' });

  assert.equal(config.port, 3000);
  assert.equal(config.url, 'http://127.0.0.1:3000');
});
