export {};

declare global {
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

  interface Window {
    desktopShell?: {
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
