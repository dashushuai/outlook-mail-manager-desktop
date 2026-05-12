import assert from 'node:assert/strict';
import test from 'node:test';

test('registerCloseToTray hides the window instead of closing while the app is not quitting', async () => {
  const trayModule = await import('./tray');

  assert.equal(typeof trayModule.registerCloseToTray, 'function');

  if (typeof trayModule.registerCloseToTray !== 'function') {
    return;
  }

  let closeHandler: ((event: { preventDefault(): void }) => void) | null = null;
  let prevented = false;
  let hidden = false;
  let saved = false;
  const window = {
    on: (event: string, handler: (event: { preventDefault(): void }) => void) => {
      if (event === 'close') {
        closeHandler = handler;
      }
    },
    hide: () => {
      hidden = true;
    },
  };

  trayModule.registerCloseToTray(window, {
    isQuitting: () => false,
    shouldMinimizeToTray: () => true,
    onBeforeClose: () => {
      saved = true;
    },
  });
  assert.notEqual(closeHandler, null);

  closeHandler?.({
    preventDefault: () => {
      prevented = true;
    },
  });

  assert.equal(saved, true);
  assert.equal(prevented, true);
  assert.equal(hidden, true);
});

test('registerCloseToTray allows the window to close while the app is quitting', async () => {
  const trayModule = await import('./tray');

  assert.equal(typeof trayModule.registerCloseToTray, 'function');

  if (typeof trayModule.registerCloseToTray !== 'function') {
    return;
  }

  let closeHandler: ((event: { preventDefault(): void }) => void) | null = null;
  let prevented = false;
  let hidden = false;
  const window = {
    on: (event: string, handler: (event: { preventDefault(): void }) => void) => {
      if (event === 'close') {
        closeHandler = handler;
      }
    },
    hide: () => {
      hidden = true;
    },
  };

  trayModule.registerCloseToTray(window, {
    isQuitting: () => true,
    shouldMinimizeToTray: () => true,
  });
  assert.notEqual(closeHandler, null);

  closeHandler?.({
    preventDefault: () => {
      prevented = true;
    },
  });

  assert.equal(prevented, false);
  assert.equal(hidden, false);
});

test('registerCloseToTray allows the window to close when minimize-to-tray is disabled', async () => {
  const trayModule = await import('./tray');

  assert.equal(typeof trayModule.registerCloseToTray, 'function');

  if (typeof trayModule.registerCloseToTray !== 'function') {
    return;
  }

  let closeHandler: ((event: { preventDefault(): void }) => void) | null = null;
  let prevented = false;
  let hidden = false;
  const window = {
    on: (event: string, handler: (event: { preventDefault(): void }) => void) => {
      if (event === 'close') {
        closeHandler = handler;
      }
    },
    hide: () => {
      hidden = true;
    },
  };

  trayModule.registerCloseToTray(window, {
    isQuitting: () => false,
    shouldMinimizeToTray: () => false,
  });
  assert.notEqual(closeHandler, null);

  closeHandler?.({
    preventDefault: () => {
      prevented = true;
    },
  });

  assert.equal(prevented, false);
  assert.equal(hidden, false);
});

test('createDesktopTray wires the tray menu and double-click to desktop actions', async () => {
  const trayModule = await import('./tray');

  assert.equal(typeof trayModule.createDesktopTray, 'function');

  if (typeof trayModule.createDesktopTray !== 'function') {
    return;
  }

  const events: string[] = [];
  let doubleClickHandler: (() => void) | null = null;
  let menuTemplate: Array<{ label?: string; click?: () => void; type?: string }> = [];

  const tray = trayModule.createDesktopTray({
    iconPath: 'icon.ico',
    tooltip: 'Outlook Mail Manager',
    createTray: (iconPath: string) => {
      events.push(`tray:${iconPath}`);
      return {
        setToolTip: (tooltip: string) => events.push(`tooltip:${tooltip}`),
        setContextMenu: () => events.push('context-menu'),
        on: (event: string, handler: () => void) => {
          if (event === 'double-click') {
            doubleClickHandler = handler;
          }
        },
      };
    },
    buildMenu: (template: Array<{ label?: string; click?: () => void; type?: string }>) => {
      menuTemplate = template;
      return { template };
    },
    showMainWindow: () => events.push('show'),
    checkMail: () => events.push('check-mail'),
    quitApp: () => events.push('quit'),
  });

  assert.equal(Boolean(tray), true);
  assert.deepEqual(events, ['tray:icon.ico', 'tooltip:Outlook Mail Manager', 'context-menu']);
  assert.deepEqual(
    menuTemplate.map((item) => item.label ?? item.type),
    ['显示主窗口', '检查邮件', 'separator', '退出'],
  );

  doubleClickHandler?.();
  menuTemplate[0].click?.();
  menuTemplate[1].click?.();
  menuTemplate[3].click?.();

  assert.deepEqual(events.slice(3), ['show', 'show', 'check-mail', 'quit']);
});

test('createTrayWithIconFallback uses an empty fallback icon when the configured icon cannot load', async () => {
  const trayModule = await import('./tray');

  assert.equal(typeof trayModule.createTrayWithIconFallback, 'function');

  if (typeof trayModule.createTrayWithIconFallback !== 'function') {
    return;
  }

  const events: string[] = [];
  const tray = trayModule.createTrayWithIconFallback({
    iconPath: 'missing.svg',
    fallbackIcon: 'empty-icon',
    createTray: (icon: string) => {
      events.push(`create:${icon}`);

      if (icon === 'missing.svg') {
        throw new Error('failed to load image');
      }

      return { icon };
    },
  });

  assert.deepEqual(tray, { icon: 'empty-icon' });
  assert.deepEqual(events, ['create:missing.svg', 'create:empty-icon']);
});

test('showDesktopWindow restores minimized windows before showing them', async () => {
  const trayModule = await import('./tray');

  assert.equal(typeof trayModule.showDesktopWindow, 'function');

  if (typeof trayModule.showDesktopWindow !== 'function') {
    return;
  }

  const events: string[] = [];
  const window = {
    isDestroyed: () => false,
    isMinimized: () => true,
    restore: () => events.push('restore'),
    show: () => events.push('show'),
    focus: () => events.push('focus'),
  };

  trayModule.showDesktopWindow(window);

  assert.deepEqual(events, ['restore', 'show', 'focus']);
});
