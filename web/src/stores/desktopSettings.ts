import { create } from 'zustand';

type DesktopShellLike = Pick<NonNullable<Window['desktopShell']>, 'getSettings' | 'updateSettings'>;
type DesktopShellContainer = {
  desktopShell?: Partial<NonNullable<Window['desktopShell']>>;
};

type DesktopSettingsState = {
  available: boolean;
  settings: DesktopSettings;
  loadSettings: () => Promise<DesktopSettings>;
  updateSettings: (payload: DesktopSettingsPatch) => Promise<DesktopSettings>;
};

export const defaultDesktopSettings: DesktopSettings = {
  theme: 'dark',
  openAtLogin: false,
  minimizeToTray: true,
  automaticCheckIntervalMinutes: 5,
  windowBounds: {
    width: 1280,
    height: 800,
  },
};

export function isDesktopShellAvailable(value: DesktopShellContainer | undefined): value is { desktopShell: DesktopShellLike } {
  return Boolean(value?.desktopShell?.getSettings && value.desktopShell?.updateSettings);
}

export function parseAutomaticCheckIntervalInput(value: string): number | null {
  const normalized = value.trim();

  if (!/^\d+$/.test(normalized)) {
    return null;
  }

  const parsed = Number.parseInt(normalized, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export function finalizeAutomaticCheckIntervalInput(value: string, lastValidValue: number): string {
  const parsed = parseAutomaticCheckIntervalInput(value);
  return parsed === null ? String(lastValidValue) : String(parsed);
}

export function createDesktopSettingsBridge(value: DesktopShellContainer | undefined) {
  return {
    async load(): Promise<DesktopSettings> {
      if (!isDesktopShellAvailable(value)) {
        return defaultDesktopSettings;
      }

      return value.desktopShell.getSettings();
    },
    async update(payload: DesktopSettingsPatch): Promise<DesktopSettings> {
      if (!isDesktopShellAvailable(value)) {
        return defaultDesktopSettings;
      }

      return value.desktopShell.updateSettings(payload);
    },
  };
}

function getDesktopSettingsBridge() {
  if (typeof window === 'undefined') {
    return createDesktopSettingsBridge(undefined);
  }

  return createDesktopSettingsBridge(window);
}

export const useDesktopSettingsStore = create<DesktopSettingsState>((set) => ({
  available: typeof window !== 'undefined' && isDesktopShellAvailable(window),
  settings: defaultDesktopSettings,
  loadSettings: async () => {
    const bridge = getDesktopSettingsBridge();
    const settings = await bridge.load();

    set({
      available: typeof window !== 'undefined' && isDesktopShellAvailable(window),
      settings,
    });

    return settings;
  },
  updateSettings: async (payload) => {
    const bridge = getDesktopSettingsBridge();
    const settings = await bridge.update(payload);

    set({
      available: typeof window !== 'undefined' && isDesktopShellAvailable(window),
      settings,
    });

    return settings;
  },
}));
