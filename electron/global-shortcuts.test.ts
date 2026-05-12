import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CHECK_MAIL_SHORTCUT,
  registerDesktopGlobalShortcuts,
  toggleDesktopWindow,
  TOGGLE_MAIN_WINDOW_SHORTCUT,
} from './global-shortcuts';

test('global shortcut accelerators are Ctrl-specific', () => {
  assert.equal(TOGGLE_MAIN_WINDOW_SHORTCUT, 'Control+Shift+O');
  assert.equal(CHECK_MAIL_SHORTCUT, 'Control+Shift+M');
});

test('registerDesktopGlobalShortcuts registers toggle-window and check-mail shortcuts', () => {
  const events: string[] = [];
  const callbacks = new Map<string, () => void>();
  const globalShortcut = {
    register: (accelerator: string, callback: () => void) => {
      callbacks.set(accelerator, callback);
      return true;
    },
    unregister: (accelerator: string) => {
      events.push(`unregister:${accelerator}`);
    },
  };

  const unregister = registerDesktopGlobalShortcuts({
    globalShortcut,
    toggleMainWindow: () => events.push('toggle'),
    checkMail: () => events.push('check-mail'),
    logError: (message, error) => events.push(`${message}:${String(error)}`),
  });

  assert.equal(callbacks.has(TOGGLE_MAIN_WINDOW_SHORTCUT), true);
  assert.equal(callbacks.has(CHECK_MAIL_SHORTCUT), true);

  callbacks.get(TOGGLE_MAIN_WINDOW_SHORTCUT)?.();
  callbacks.get(CHECK_MAIL_SHORTCUT)?.();
  unregister();

  assert.deepEqual(events, [
    'toggle',
    'check-mail',
    `unregister:${TOGGLE_MAIN_WINDOW_SHORTCUT}`,
    `unregister:${CHECK_MAIL_SHORTCUT}`,
  ]);
});

test('toggleDesktopWindow hides visible windows and shows hidden windows', () => {
  const events: string[] = [];
  const visibleWindow = {
    isDestroyed: () => false,
    isVisible: () => true,
    hide: () => events.push('hide'),
  };
  const hiddenWindow = {
    isDestroyed: () => false,
    isVisible: () => false,
    hide: () => events.push('hidden-hide'),
  };

  toggleDesktopWindow({
    window: visibleWindow,
    showMainWindow: () => events.push('visible-show'),
  });
  toggleDesktopWindow({
    window: hiddenWindow,
    showMainWindow: () => events.push('show'),
  });

  assert.deepEqual(events, ['hide', 'show']);
});

test('toggleDesktopWindow ignores destroyed windows', () => {
  const events: string[] = [];

  toggleDesktopWindow({
    window: {
      isDestroyed: () => true,
      isVisible: () => true,
      hide: () => events.push('hide'),
    },
    showMainWindow: () => events.push('show'),
  });

  assert.deepEqual(events, []);
});

test('registerDesktopGlobalShortcuts reports failed shortcut registration', () => {
  const errors: string[] = [];
  const globalShortcut = {
    register: (accelerator: string) => accelerator !== CHECK_MAIL_SHORTCUT,
    unregister: () => undefined,
  };

  registerDesktopGlobalShortcuts({
    globalShortcut,
    toggleMainWindow: () => undefined,
    checkMail: () => undefined,
    logError: (message, error) => errors.push(`${message}:${String(error)}`),
  });

  assert.deepEqual(errors, [`Failed to register global shortcut:${CHECK_MAIL_SHORTCUT}`]);
});
