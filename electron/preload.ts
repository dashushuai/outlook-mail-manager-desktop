import { contextBridge, ipcRenderer } from 'electron';

import { resolveDesktopServerUrl } from './desktop-env';

type ThemePreference = 'system' | 'light' | 'dark';

type WindowBounds = {
  width: number;
  height: number;
  x?: number;
  y?: number;
};

type DesktopSettings = {
  windowBounds: WindowBounds;
  theme: ThemePreference;
  openAtLogin: boolean;
  minimizeToTray: boolean;
  automaticCheckIntervalMinutes: number;
};

type DesktopSettingsPatch = Partial<DesktopSettings>;

type UpdateStatus = {
  available: boolean;
  checking: boolean;
  updateAvailable: boolean;
  downloaded: boolean;
  progress: number | null;
  version: string | null;
  error: string | null;
};

type DesktopFileEncoding = 'utf8' | 'base64';

type DesktopFileFilter = {
  name: string;
  extensions: string[];
};

type OpenDesktopFileOptions = {
  title?: string;
  filters?: DesktopFileFilter[];
  encoding: DesktopFileEncoding;
};

type SaveDesktopFileOptions = OpenDesktopFileOptions & {
  defaultPath?: string;
  content: string;
};

type OpenDesktopFileResult = {
  fileName: string;
  content: string;
};

contextBridge.exposeInMainWorld('desktopShell', {
  ping: () => ipcRenderer.invoke('desktop:ping') as Promise<string>,
  getServerUrl: () => resolveDesktopServerUrl(),
  getSettings: () => ipcRenderer.invoke('desktop:get-settings') as Promise<DesktopSettings>,
  updateSettings: (payload: DesktopSettingsPatch) => ipcRenderer.invoke('desktop:update-settings', payload) as Promise<DesktopSettings>,
  notify: (payload: { title: string; body?: string }) => ipcRenderer.invoke('desktop:notify', payload) as Promise<boolean>,
  openFileDialog: (payload: OpenDesktopFileOptions) => ipcRenderer.invoke('desktop:open-file-dialog', payload) as Promise<OpenDesktopFileResult | null>,
  saveFileDialog: (payload: SaveDesktopFileOptions) => ipcRenderer.invoke('desktop:save-file-dialog', payload) as Promise<boolean>,
  getUpdateStatus: () => ipcRenderer.invoke('desktop:get-update-status') as Promise<UpdateStatus>,
  checkForUpdates: () => ipcRenderer.invoke('desktop:check-for-updates') as Promise<UpdateStatus>,
  installUpdate: () => ipcRenderer.invoke('desktop:install-update') as Promise<void>,
  onUpdateStatusChanged: (callback: (status: UpdateStatus) => void) => {
    const listener = (_event: unknown, status: UpdateStatus) => callback(status);
    ipcRenderer.on('desktop:update-status-changed', listener);
    return () => {
      ipcRenderer.removeListener('desktop:update-status-changed', listener);
    };
  },
});

declare global {
  interface Window {
    desktopShell: {
      ping: () => Promise<string>;
      getServerUrl: () => string | null;
      getSettings: () => Promise<DesktopSettings>;
      updateSettings: (payload: DesktopSettingsPatch) => Promise<DesktopSettings>;
      notify: (payload: { title: string; body?: string }) => Promise<boolean>;
      openFileDialog: (payload: OpenDesktopFileOptions) => Promise<OpenDesktopFileResult | null>;
      saveFileDialog: (payload: SaveDesktopFileOptions) => Promise<boolean>;
      getUpdateStatus: () => Promise<UpdateStatus>;
      checkForUpdates: () => Promise<UpdateStatus>;
      installUpdate: () => Promise<void>;
      onUpdateStatusChanged: (callback: (status: UpdateStatus) => void) => () => void;
    };
  }
}
