export type UpdateStatus = {
  available: boolean;
  checking: boolean;
  updateAvailable: boolean;
  downloaded: boolean;
  progress: number | null;
  version: string | null;
  error: string | null;
};

type UpdateInfoLike = {
  version?: unknown;
};

type ProgressInfoLike = {
  percent?: unknown;
};

type AutoUpdaterLike = {
  autoDownload?: boolean;
  checkForUpdates(): Promise<unknown>;
  quitAndInstall(): void;
  on(event: string, callback: (...args: unknown[]) => void): void;
};

type UpdaterWindow = {
  webContents: {
    send(channel: string, payload: unknown): void;
  };
};

type CreateDesktopUpdaterOptions = {
  isPackaged: boolean;
  autoUpdater: AutoUpdaterLike;
  getWindows: () => UpdaterWindow[];
  beforeInstallUpdate?: () => void | Promise<void>;
  logError: (message: string, error: unknown) => void;
};

type IpcMainLike = {
  handle(channel: string, handler: (...args: unknown[]) => unknown): void;
};

export type DesktopUpdater = {
  initialize(): Promise<void>;
  getStatus(): UpdateStatus;
  checkForUpdates(): Promise<UpdateStatus>;
  installUpdate(): Promise<void>;
};

const initialDisabledStatus: UpdateStatus = {
  available: false,
  checking: false,
  updateAvailable: false,
  downloaded: false,
  progress: null,
  version: null,
  error: null,
};

function readVersion(value: unknown): string | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const version = (value as UpdateInfoLike).version;
  return typeof version === 'string' && version ? version : null;
}

function readProgress(value: unknown): number | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const percent = (value as ProgressInfoLike).percent;

  if (typeof percent !== 'number' || !Number.isFinite(percent)) {
    return null;
  }

  return Math.max(0, Math.min(100, Math.round(percent)));
}

function readErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function createDesktopUpdater(options: CreateDesktopUpdaterOptions): DesktopUpdater {
  let status: UpdateStatus = options.isPackaged
    ? {
      ...initialDisabledStatus,
      available: true,
    }
    : { ...initialDisabledStatus };
  let initialized = false;
  let activeCheck: Promise<UpdateStatus> | null = null;

  const broadcast = () => {
    for (const window of options.getWindows()) {
      try {
        window.webContents.send('desktop:update-status-changed', status);
      } catch (error) {
        options.logError('Failed to broadcast update status', error);
      }
    }
  };

  const updateStatus = (patch: Partial<UpdateStatus>) => {
    status = {
      ...status,
      ...patch,
    };
    broadcast();
  };

  const checkForUpdates = async (): Promise<UpdateStatus> => {
    if (!options.isPackaged) {
      return status;
    }

    if (activeCheck) {
      return activeCheck;
    }

    if (status.updateAvailable && !status.downloaded) {
      return status;
    }

    activeCheck = (async () => {
      try {
        updateStatus({ checking: true, error: null });
        await options.autoUpdater.checkForUpdates();
      } catch (error) {
        options.logError('Failed to check for updates', error);
        updateStatus({ checking: false, updateAvailable: false, downloaded: false, progress: null, error: readErrorMessage(error) });
      }

      return status;
    })().finally(() => {
      activeCheck = null;
    });

    return activeCheck;
  };

  return {
    async initialize() {
      if (initialized || !options.isPackaged) {
        return;
      }

      initialized = true;
      options.autoUpdater.autoDownload = true;
      options.autoUpdater.on('checking-for-update', () => {
        updateStatus({ checking: true, error: null });
      });
      options.autoUpdater.on('update-available', (info) => {
        updateStatus({ checking: false, updateAvailable: true, downloaded: false, progress: null, version: readVersion(info), error: null });
      });
      options.autoUpdater.on('update-not-available', () => {
        updateStatus({ checking: false, updateAvailable: false, downloaded: false, progress: null, version: null });
      });
      options.autoUpdater.on('download-progress', (progress) => {
        updateStatus({ downloaded: false, progress: readProgress(progress) });
      });
      options.autoUpdater.on('update-downloaded', (info) => {
        updateStatus({ checking: false, updateAvailable: true, downloaded: true, progress: 100, version: readVersion(info) ?? status.version });
      });
      options.autoUpdater.on('error', (error) => {
        options.logError('Auto update failed', error);
        updateStatus({ checking: false, updateAvailable: false, downloaded: false, progress: null, error: readErrorMessage(error) });
      });

      await checkForUpdates();
    },
    getStatus() {
      return status;
    },
    checkForUpdates,
    async installUpdate() {
      if (!options.isPackaged || !status.downloaded) {
        return;
      }

      try {
        await options.beforeInstallUpdate?.();
      } catch (error) {
        options.logError('Failed to prepare update installation', error);
      }

      options.autoUpdater.quitAndInstall();
    },
  };
}

export function registerUpdaterIpcHandlers(options: { ipcMain: IpcMainLike; updater: Pick<DesktopUpdater, 'getStatus' | 'checkForUpdates' | 'installUpdate'> }): void {
  options.ipcMain.handle('desktop:get-update-status', () => options.updater.getStatus());
  options.ipcMain.handle('desktop:check-for-updates', () => options.updater.checkForUpdates());
  options.ipcMain.handle('desktop:install-update', () => {
    options.updater.installUpdate();
  });
}
