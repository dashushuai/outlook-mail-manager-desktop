import assert from 'node:assert/strict';
import test from 'node:test';

test('registerNotificationHandler creates a native notification and focuses the window on click', async () => {
  const notificationModule = await import('./notification');

  assert.equal(typeof notificationModule.registerNotificationHandler, 'function');

  if (typeof notificationModule.registerNotificationHandler !== 'function') {
    return;
  }

  let handler: ((event: unknown, payload: { title: string; body?: string }) => Promise<boolean>) | null = null;
  let clickHandler: (() => void) | null = null;
  const events: string[] = [];
  const ipcMain = {
    handle: (channel: string, registeredHandler: typeof handler) => {
      events.push(`handle:${channel}`);
      handler = registeredHandler;
    },
  };
  class TestNotification {
    static isSupported() {
      return true;
    }

    constructor(payload: { title: string; body?: string }) {
      events.push(`notification:${payload.title}:${payload.body}`);
    }

    on(event: string, callback: () => void) {
      if (event === 'click') {
        clickHandler = callback;
      }
    }

    show() {
      events.push('show');
    }
  }

  notificationModule.registerNotificationHandler({
    ipcMain,
    NotificationConstructor: TestNotification,
    focusMainWindow: () => events.push('focus'),
  });

  assert.notEqual(handler, null);
  const result = await handler?.({}, { title: 'New mail', body: 'Inbox updated' });
  clickHandler?.();

  assert.equal(result, true);
  assert.deepEqual(events, [
    'handle:desktop:notify',
    'notification:New mail:Inbox updated',
    'show',
    'focus',
  ]);
});

test('registerNotificationHandler rejects invalid notification payloads', async () => {
  const notificationModule = await import('./notification');

  assert.equal(typeof notificationModule.registerNotificationHandler, 'function');

  if (typeof notificationModule.registerNotificationHandler !== 'function') {
    return;
  }

  let handler: ((event: unknown, payload: unknown) => Promise<boolean>) | null = null;
  const events: string[] = [];
  const ipcMain = {
    handle: (_channel: string, registeredHandler: typeof handler) => {
      handler = registeredHandler;
    },
  };
  class TestNotification {
    static isSupported() {
      return true;
    }

    constructor() {
      events.push('notification');
    }

    on() {
      events.push('on');
    }

    show() {
      events.push('show');
    }
  }

  notificationModule.registerNotificationHandler({
    ipcMain,
    NotificationConstructor: TestNotification,
    focusMainWindow: () => events.push('focus'),
  });

  assert.equal(await handler?.({}, { title: '' }), false);
  assert.equal(await handler?.({}, { title: 123 }), false);
  assert.equal(await handler?.({}, { title: 'x'.repeat(121) }), false);
  assert.equal(await handler?.({}, { title: 'New mail', body: 'x'.repeat(501) }), false);
  assert.equal(await handler?.({}, null), false);
  assert.deepEqual(events, []);
});

test('registerNotificationHandler returns false when native notifications are unsupported', async () => {
  const notificationModule = await import('./notification');

  assert.equal(typeof notificationModule.registerNotificationHandler, 'function');

  if (typeof notificationModule.registerNotificationHandler !== 'function') {
    return;
  }

  let handler: ((event: unknown, payload: { title: string }) => Promise<boolean>) | null = null;
  const events: string[] = [];
  const ipcMain = {
    handle: (_channel: string, registeredHandler: typeof handler) => {
      handler = registeredHandler;
    },
  };
  class TestNotification {
    static isSupported() {
      return false;
    }

    constructor() {
      events.push('notification');
    }

    on() {
      events.push('on');
    }

    show() {
      events.push('show');
    }
  }

  notificationModule.registerNotificationHandler({
    ipcMain,
    NotificationConstructor: TestNotification,
    focusMainWindow: () => events.push('focus'),
  });

  const result = await handler?.({}, { title: 'New mail' });

  assert.equal(result, false);
  assert.deepEqual(events, []);
});
