export const TOGGLE_MAIN_WINDOW_SHORTCUT = 'Control+Shift+O';
export const CHECK_MAIL_SHORTCUT = 'Control+Shift+M';

const DESKTOP_SHORTCUTS = [
  TOGGLE_MAIN_WINDOW_SHORTCUT,
  CHECK_MAIL_SHORTCUT,
] as const;

type GlobalShortcutLike = {
  register(accelerator: string, callback: () => void): boolean;
  unregister(accelerator: string): void;
};

type ToggleDesktopWindowOptions = {
  window: {
    isDestroyed?(): boolean;
    isVisible(): boolean;
    hide(): void;
  };
  showMainWindow(): void;
};

type RegisterDesktopGlobalShortcutsOptions = {
  globalShortcut: GlobalShortcutLike;
  toggleMainWindow(): void;
  checkMail(): void;
  logError(message: string, error: unknown): void;
};

export function toggleDesktopWindow(options: ToggleDesktopWindowOptions): void {
  if (options.window.isDestroyed?.()) {
    return;
  }

  if (options.window.isVisible()) {
    options.window.hide();
    return;
  }

  options.showMainWindow();
}

export function registerDesktopGlobalShortcuts(options: RegisterDesktopGlobalShortcutsOptions): () => void {
  const shortcuts = [
    [TOGGLE_MAIN_WINDOW_SHORTCUT, options.toggleMainWindow],
    [CHECK_MAIL_SHORTCUT, options.checkMail],
  ] as const;

  for (const [accelerator, callback] of shortcuts) {
    const registered = options.globalShortcut.register(accelerator, callback);

    if (!registered) {
      options.logError('Failed to register global shortcut', accelerator);
    }
  }

  return () => {
    for (const accelerator of DESKTOP_SHORTCUTS) {
      options.globalShortcut.unregister(accelerator);
    }
  };
}
