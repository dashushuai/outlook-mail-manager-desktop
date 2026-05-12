import Store from 'electron-store';

export const DESKTOP_SETTINGS_KEY = 'desktopSettings';
export const DEFAULT_WINDOW_BOUNDS = {
  width: 1280,
  height: 800,
} as const;
export const DEFAULT_AUTOMATIC_CHECK_INTERVAL_MINUTES = 5;

export type ThemePreference = 'system' | 'light' | 'dark';

export type WindowBounds = {
  width: number;
  height: number;
  x?: number;
  y?: number;
};

export type DesktopSettings = {
  windowBounds: WindowBounds;
  theme: ThemePreference;
  openAtLogin: boolean;
  minimizeToTray: boolean;
  automaticCheckIntervalMinutes: number;
};

export type DesktopSettingsPatch = Partial<{
  windowBounds: WindowBounds;
  theme: ThemePreference;
  openAtLogin: boolean;
  minimizeToTray: boolean;
  automaticCheckIntervalMinutes: number;
}>;

type StoreBackend = {
  get(key: string): unknown;
  set(key: string, value: unknown): void;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value);
}

function isPositiveFiniteInteger(value: unknown): value is number {
  return isFiniteInteger(value) && value > 0;
}

function normalizeThemePreference(value: unknown): ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system'
    ? value
    : 'system';
}

function normalizeWindowBounds(value: unknown): WindowBounds {
  if (!isPlainObject(value)) {
    return { ...DEFAULT_WINDOW_BOUNDS };
  }

  const width = isPositiveFiniteInteger(value.width) ? value.width : DEFAULT_WINDOW_BOUNDS.width;
  const height = isPositiveFiniteInteger(value.height) ? value.height : DEFAULT_WINDOW_BOUNDS.height;
  const bounds: WindowBounds = { width, height };

  if (isFiniteInteger(value.x)) {
    bounds.x = value.x;
  }

  if (isFiniteInteger(value.y)) {
    bounds.y = value.y;
  }

  return bounds;
}

function normalizeAutomaticCheckIntervalMinutes(value: unknown): number {
  return isPositiveFiniteInteger(value) ? value : DEFAULT_AUTOMATIC_CHECK_INTERVAL_MINUTES;
}

export function normalizeDesktopSettings(value: unknown): DesktopSettings {
  const source = isPlainObject(value) ? value : {};

  return {
    windowBounds: normalizeWindowBounds(source.windowBounds),
    theme: normalizeThemePreference(source.theme),
    openAtLogin: typeof source.openAtLogin === 'boolean' ? source.openAtLogin : false,
    minimizeToTray: typeof source.minimizeToTray === 'boolean' ? source.minimizeToTray : true,
    automaticCheckIntervalMinutes: normalizeAutomaticCheckIntervalMinutes(source.automaticCheckIntervalMinutes),
  };
}

export function parseDesktopSettingsPatch(value: unknown): DesktopSettingsPatch | null {
  if (!isPlainObject(value)) {
    return null;
  }

  const patch: DesktopSettingsPatch = {};

  if ('theme' in value) {
    if (value.theme !== 'system' && value.theme !== 'light' && value.theme !== 'dark') {
      return null;
    }

    patch.theme = value.theme;
  }

  if ('openAtLogin' in value) {
    if (typeof value.openAtLogin !== 'boolean') {
      return null;
    }

    patch.openAtLogin = value.openAtLogin;
  }

  if ('minimizeToTray' in value) {
    if (typeof value.minimizeToTray !== 'boolean') {
      return null;
    }

    patch.minimizeToTray = value.minimizeToTray;
  }

  if ('automaticCheckIntervalMinutes' in value) {
    if (!isPositiveFiniteInteger(value.automaticCheckIntervalMinutes)) {
      return null;
    }

    patch.automaticCheckIntervalMinutes = value.automaticCheckIntervalMinutes;
  }

  if ('windowBounds' in value) {
    if (!isPlainObject(value.windowBounds)) {
      return null;
    }

    if (!isPositiveFiniteInteger(value.windowBounds.width) || !isPositiveFiniteInteger(value.windowBounds.height)) {
      return null;
    }

    if ('x' in value.windowBounds && !isFiniteInteger(value.windowBounds.x)) {
      return null;
    }

    if ('y' in value.windowBounds && !isFiniteInteger(value.windowBounds.y)) {
      return null;
    }

    patch.windowBounds = {
      width: value.windowBounds.width,
      height: value.windowBounds.height,
    };

    if (isFiniteInteger(value.windowBounds.x)) {
      patch.windowBounds.x = value.windowBounds.x;
    }

    if (isFiniteInteger(value.windowBounds.y)) {
      patch.windowBounds.y = value.windowBounds.y;
    }
  }

  return patch;
}

type DisplayWorkArea = {
  x: number;
  y: number;
  width: number;
  height: number;
};

function hasUsableVisibleArea(bounds: Required<WindowBounds>, display: DisplayWorkArea): boolean {
  const minimumVisibleWidth = Math.min(bounds.width, 100);
  const minimumVisibleHeight = Math.min(bounds.height, 100);

  return bounds.x >= display.x
    && bounds.y >= display.y
    && bounds.x + minimumVisibleWidth <= display.x + display.width
    && bounds.y + minimumVisibleHeight <= display.y + display.height;
}

function isVisibleOnAnyDisplay(bounds: WindowBounds, displayWorkAreas: DisplayWorkArea[]): boolean {
  if (typeof bounds.x !== 'number' || typeof bounds.y !== 'number' || displayWorkAreas.length === 0) {
    return true;
  }

  return displayWorkAreas.some((display) => hasUsableVisibleArea(bounds as Required<WindowBounds>, display));
}

export function toBrowserWindowOptions(bounds: WindowBounds, displayWorkAreas: DisplayWorkArea[] = []): WindowBounds {
  const options: WindowBounds = {
    width: bounds.width,
    height: bounds.height,
  };

  if (!isVisibleOnAnyDisplay(bounds, displayWorkAreas)) {
    return options;
  }

  if (typeof bounds.x === 'number') {
    options.x = bounds.x;
  }

  if (typeof bounds.y === 'number') {
    options.y = bounds.y;
  }

  return options;
}

type MovableWindow = {
  getBounds(): WindowBounds;
  setBounds(bounds: WindowBounds): void;
  center(): void;
};

export function ensureWindowVisible(window: MovableWindow, displayWorkAreas: DisplayWorkArea[]): void {
  const bounds = window.getBounds();
  const visibleBounds = toBrowserWindowOptions(bounds, displayWorkAreas);

  if (typeof bounds.x === 'number' && typeof bounds.y === 'number' && (visibleBounds.x === undefined || visibleBounds.y === undefined)) {
    window.setBounds(visibleBounds);
    window.center();
  }
}

export class DesktopSettingsManager {
  constructor(private readonly store: StoreBackend) {}

  getSettings(): DesktopSettings {
    return normalizeDesktopSettings(this.store.get(DESKTOP_SETTINGS_KEY));
  }

  updateSettings(value: unknown): DesktopSettings {
    const patch = parseDesktopSettingsPatch(value);

    if (!patch) {
      throw new Error('Invalid desktop settings update');
    }

    const nextSettings: DesktopSettings = {
      ...this.getSettings(),
      ...patch,
      windowBounds: patch.windowBounds ?? this.getSettings().windowBounds,
    };

    this.store.set(DESKTOP_SETTINGS_KEY, nextSettings);
    return nextSettings;
  }

  saveWindowBounds(value: unknown): WindowBounds {
    const nextWindowBounds = normalizeWindowBounds(value);
    const nextSettings: DesktopSettings = {
      ...this.getSettings(),
      windowBounds: nextWindowBounds,
    };

    this.store.set(DESKTOP_SETTINGS_KEY, nextSettings);
    return nextWindowBounds;
  }
}

export function createDesktopSettingsManager(): DesktopSettingsManager {
  return new DesktopSettingsManager(new Store({ name: 'desktop-settings' }));
}
