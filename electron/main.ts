import { app, BrowserWindow, globalShortcut, Menu, nativeImage, Notification, screen, Tray } from 'electron';
import { autoUpdater } from 'electron-updater';
import path from 'node:path';

import { registerDesktopGlobalShortcuts, toggleDesktopWindow } from './global-shortcuts';
import { registerIpcHandlers } from './ipc';
import { handleDesktopStartupFailure, openMainWindow, shutdownDesktopApp } from './main-lifecycle';
import { createMailPoller } from './mail-poller';
import { createDesktopUpdater } from './updater';
import { resolveRendererTarget } from './renderer';
import { startEmbeddedServer, stopEmbeddedServer } from './server';
import { createDesktopTray, createTrayWithIconFallback, registerCloseToTray, showDesktopWindow } from './tray';
import { createDesktopSettingsManager, ensureWindowVisible, toBrowserWindowOptions } from './settings';

async function loadRenderer(window: BrowserWindow): Promise<void> {
  const target = resolveRendererTarget();

  if (target.kind === 'url') {
    await window.loadURL(target.value);
    return;
  }

  await window.loadFile(target.value);
}

function resolveTrayIconPath(): string {
  return path.resolve(__dirname, '../web/dist/favicon.svg');
}

const desktopSettings = createDesktopSettingsManager();

let mainWindow: BrowserWindow | null = null;
let desktopTray: unknown = null;
let desktopServerUrl = 'http://127.0.0.1:3000';
let backgroundMailPoller: ReturnType<typeof createMailPoller> | null = null;
let unregisterGlobalShortcuts: (() => void) | null = null;
let isQuitting = false;
let isInstallingUpdate = false;

const desktopUpdater = createDesktopUpdater({
  isPackaged: app.isPackaged,
  autoUpdater,
  getWindows: () => BrowserWindow.getAllWindows(),
  beforeInstallUpdate: async () => {
    isInstallingUpdate = true;
    isQuitting = true;
    backgroundMailPoller?.stop();
    await stopEmbeddedServer();
  },
  logError: (message, error) => {
    console.error(message, error);
  },
});

function getDisplayWorkAreas() {
  return screen.getAllDisplays().map((display) => display.workArea);
}

function showMainWindow(): void {
  if (!mainWindow) {
    return;
  }

  ensureWindowVisible(mainWindow, getDisplayWorkAreas());
  showDesktopWindow(mainWindow);
}

function toggleMainWindow(): void {
  if (!mainWindow) {
    return;
  }

  toggleDesktopWindow({
    window: mainWindow,
    showMainWindow,
  });
}

function notifyAboutNewMail(newMailCount: number): void {
  if (newMailCount <= 0 || !Notification.isSupported()) {
    return;
  }

  const notification = new Notification({
    title: 'Outlook Mail Manager',
    body: newMailCount === 1 ? '发现 1 封新邮件。' : `发现 ${newMailCount} 封新邮件。`,
  });

  notification.on('click', showMainWindow);
  notification.show();
}

function ensureDesktopTray(): void {
  if (desktopTray) {
    return;
  }

  desktopTray = createDesktopTray({
    iconPath: resolveTrayIconPath(),
    tooltip: 'Outlook Mail Manager',
    createTray: (iconPath) => createTrayWithIconFallback({
      iconPath,
      fallbackIcon: nativeImage.createEmpty(),
      createTray: (icon) => new Tray(icon),
    }),
    buildMenu: (template) => Menu.buildFromTemplate(template),
    showMainWindow,
    checkMail: () => {
      void backgroundMailPoller?.pollNow();
    },
    quitApp: () => {
      app.quit();
    },
  });
}

async function createMainWindow(): Promise<BrowserWindow> {
  const serverConfig = await startEmbeddedServer({
    ...process.env,
    ELECTRON_DESKTOP: '1',
    ELECTRON_USER_DATA_PATH: app.getPath('userData'),
  });
  const settings = desktopSettings.getSettings();
  desktopServerUrl = serverConfig.url;
  const window = new BrowserWindow({
    ...toBrowserWindowOptions(settings.windowBounds, getDisplayWorkAreas()),
    minWidth: 1024,
    minHeight: 720,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      additionalArguments: [`--desktop-server-url=${serverConfig.url}`],
    },
  });

  registerCloseToTray(window, {
    isQuitting: () => isQuitting,
    shouldMinimizeToTray: () => desktopSettings.getSettings().minimizeToTray,
    onBeforeClose: () => {
      desktopSettings.saveWindowBounds(window.getBounds());
    },
  });

  window.once('ready-to-show', () => {
    window.show();
  });

  await loadRenderer(window);
  return window;
}

app.whenReady().then(async () => {
  const applyOpenAtLoginSetting = () => {
    app.setLoginItemSettings({
      openAtLogin: desktopSettings.getSettings().openAtLogin,
    });
  };

  applyOpenAtLoginSetting();
  registerIpcHandlers({
    focusMainWindow: () => {
      if (mainWindow) {
        showMainWindow();
      }
    },
    getSettings: () => desktopSettings.getSettings(),
    updateSettings: (payload) => {
      const settings = desktopSettings.updateSettings(payload);
      applyOpenAtLoginSetting();
      backgroundMailPoller?.updateIntervalMinutes(settings.automaticCheckIntervalMinutes);
      return settings;
    },
    updater: desktopUpdater,
  });
  mainWindow = await createMainWindow();
  backgroundMailPoller = createMailPoller({
    serverUrl: desktopServerUrl,
    fetch,
    setInterval,
    clearInterval,
    notifyNewMail: notifyAboutNewMail,
    logError: (message, error) => {
      console.error(message, error);
    },
  });
  ensureDesktopTray();
  unregisterGlobalShortcuts = registerDesktopGlobalShortcuts({
    globalShortcut,
    toggleMainWindow,
    checkMail: () => {
      void backgroundMailPoller?.pollNow();
    },
    logError: (message, error) => {
      console.error(message, error);
    },
  });
  await backgroundMailPoller.start(desktopSettings.getSettings().automaticCheckIntervalMinutes);
  await desktopUpdater.initialize();

  app.on('activate', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      showMainWindow();
      return;
    }

    if (BrowserWindow.getAllWindows().length === 0) {
      openMainWindow(async () => {
        mainWindow = await createMainWindow();
        return mainWindow;
      }, (error) => {
        console.error('Failed to create main window', error);
        void handleDesktopStartupFailure(stopEmbeddedServer, (code) => {
          app.exit(code);
        });
      });
    }
  });
}).catch((error) => {
  console.error('Failed to start desktop app', error);
  void handleDesktopStartupFailure(stopEmbeddedServer, (code) => {
    app.exit(code);
  });
});

app.on('before-quit', (event) => {
  if (isInstallingUpdate || isQuitting) {
    return;
  }

  event.preventDefault();
  isQuitting = true;
  backgroundMailPoller?.stop();
  void shutdownDesktopApp(stopEmbeddedServer, () => {
    app.quit();
  });
});

app.on('will-quit', () => {
  unregisterGlobalShortcuts?.();
  unregisterGlobalShortcuts = null;
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
