import React from 'react';
import assert from 'node:assert/strict';
import test from 'node:test';

import { renderToStaticMarkup } from 'react-dom/server';

test('header shows desktop settings trigger when desktop shell is available', async () => {
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      matchMedia: () => ({ matches: false }),
      desktopShell: {
        getSettings: async () => ({
          theme: 'dark',
          openAtLogin: true,
          minimizeToTray: true,
          automaticCheckIntervalMinutes: 5,
          windowBounds: { width: 1280, height: 800 },
        }),
        updateSettings: async () => ({
          theme: 'dark',
          openAtLogin: true,
          minimizeToTray: true,
          automaticCheckIntervalMinutes: 5,
          windowBounds: { width: 1280, height: 800 },
        }),
        getServerUrl: () => null,
        notify: async () => true,
        ping: async () => 'pong',
        getUpdateStatus: async () => ({
          available: true,
          checking: false,
          updateAvailable: true,
          downloaded: false,
          progress: 42,
          version: '1.0.1',
          error: null,
        }),
        checkForUpdates: async () => ({
          available: true,
          checking: true,
          updateAvailable: false,
          downloaded: false,
          progress: null,
          version: null,
          error: null,
        }),
        installUpdate: async () => undefined,
        onUpdateStatusChanged: () => () => undefined,
      },
    },
  });

  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: {
      documentElement: {
        classList: {
          toggle: () => undefined,
        },
      },
    },
  });

  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: () => 'dark',
      setItem: () => undefined,
    },
  });

  Object.defineProperty(globalThis, 'React', {
    configurable: true,
    value: React,
  });

  const { Header } = await import('./Header');
  const { useDesktopUpdaterStore } = await import('../../stores/desktopUpdater');
  useDesktopUpdaterStore.setState({
    available: true,
    status: {
      available: true,
      checking: false,
      updateAvailable: true,
      downloaded: false,
      progress: 42,
      version: '1.0.1',
      error: null,
    },
  });

  const markup = renderToStaticMarkup(<Header onMenuClick={() => undefined} />);

  assert.match(markup, /桌面设置/);
  assert.match(markup, /开机自启动/);
  assert.match(markup, /最小化到托盘/);
  assert.match(markup, /自动检查间隔/);
  assert.match(markup, /检查更新/);
  assert.match(markup, /value="5"/);
});

test('header stays web-safe and hides desktop settings trigger without desktop shell', async () => {
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      matchMedia: () => ({ matches: false }),
    },
  });

  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: {
      documentElement: {
        classList: {
          toggle: () => undefined,
        },
      },
    },
  });

  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: () => 'dark',
      setItem: () => undefined,
    },
  });

  Object.defineProperty(globalThis, 'React', {
    configurable: true,
    value: React,
  });

  const { Header } = await import('./Header');
  const { defaultDesktopSettings, useDesktopSettingsStore } = await import('../../stores/desktopSettings');
  useDesktopSettingsStore.setState({
    available: false,
    settings: defaultDesktopSettings,
  });

  const markup = renderToStaticMarkup(<Header onMenuClick={() => undefined} />);

  assert.doesNotMatch(markup, /桌面设置/);
});
