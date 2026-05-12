import assert from 'node:assert/strict';
import test from 'node:test';

async function withDesktopAuthEnv<T>(run: () => Promise<T>): Promise<T> {
  const originalDesktop = process.env.ELECTRON_DESKTOP;
  const originalAccessPassword = process.env.ACCESS_PASSWORD;
  const originalUserDataPath = process.env.ELECTRON_USER_DATA_PATH;

  process.env.ELECTRON_DESKTOP = '1';
  process.env.ACCESS_PASSWORD = 'secret';
  process.env.ELECTRON_USER_DATA_PATH = 'C:/Users/test/AppData/Roaming/OutlookMailManager';

  try {
    return await run();
  } finally {
    if (originalDesktop === undefined) {
      delete process.env.ELECTRON_DESKTOP;
    } else {
      process.env.ELECTRON_DESKTOP = originalDesktop;
    }

    if (originalAccessPassword === undefined) {
      delete process.env.ACCESS_PASSWORD;
    } else {
      process.env.ACCESS_PASSWORD = originalAccessPassword;
    }

    if (originalUserDataPath === undefined) {
      delete process.env.ELECTRON_USER_DATA_PATH;
    } else {
      process.env.ELECTRON_USER_DATA_PATH = originalUserDataPath;
    }
  }
}

test('authMiddleware allows desktop API requests without a bearer token', async () => {
  await withDesktopAuthEnv(async () => {
    const { authMiddleware } = await import('../src/middlewares/auth');

    let nextCalled = false;
    const ctx = {
      path: '/api/accounts',
      get: () => '',
      status: 200,
      body: null,
    };

    await authMiddleware(ctx as never, async () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, true);
    assert.equal(ctx.status, 200);
    assert.equal(ctx.body, null);
  });
});

test('AuthController reports desktop mode as not requiring a password', async () => {
  await withDesktopAuthEnv(async () => {
    const { AuthController } = await import('../src/controllers/AuthController');

    const controller = new AuthController();
    const ctx = {
      request: { body: {} },
      body: null,
    };

    await controller.check(ctx as never);

    assert.deepEqual(ctx.body, {
      code: 200,
      data: { required: false },
      message: 'ok',
    });
  });
});
