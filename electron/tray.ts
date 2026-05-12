export type TrayMenuItem = {
  label?: string;
  type?: 'separator';
  click?: () => void;
};

export type DesktopWindow = {
  on(event: 'close', handler: (event: { preventDefault(): void }) => void): void;
  hide(): void;
  show(): void;
  isDestroyed?(): boolean;
  isMinimized?(): boolean;
  restore?(): void;
};

type DesktopTray = {
  setToolTip(tooltip: string): void;
  setContextMenu(menu: unknown): void;
  on(event: 'double-click', handler: () => void): void;
};

type CreateDesktopTrayOptions = {
  iconPath: string;
  tooltip: string;
  createTray(iconPath: string): DesktopTray;
  buildMenu(template: TrayMenuItem[]): unknown;
  showMainWindow(): void;
  checkMail(): void;
  quitApp(): void;
};

type CreateTrayWithIconFallbackOptions<TTray, TIcon> = {
  iconPath: string;
  fallbackIcon: TIcon;
  createTray(icon: string | TIcon): TTray;
};

export function createTrayWithIconFallback<TTray, TIcon>(
  options: CreateTrayWithIconFallbackOptions<TTray, TIcon>,
): TTray {
  try {
    return options.createTray(options.iconPath);
  } catch {
    return options.createTray(options.fallbackIcon);
  }
}

export function showDesktopWindow(window: Pick<DesktopWindow, 'show' | 'isDestroyed' | 'isMinimized' | 'restore'> & { focus?(): void }): void {
  if (window.isDestroyed?.()) {
    return;
  }

  if (window.isMinimized?.()) {
    window.restore?.();
  }

  window.show();
  window.focus?.();
}

type RegisterCloseToTrayOptions = {
  isQuitting(): boolean;
  shouldMinimizeToTray?(): boolean;
  onBeforeClose?(): void;
};

export function registerCloseToTray(
  window: Pick<DesktopWindow, 'on' | 'hide'>,
  options: RegisterCloseToTrayOptions,
): void {
  window.on('close', (event) => {
    options.onBeforeClose?.();

    if (options.isQuitting() || options.shouldMinimizeToTray?.() === false) {
      return;
    }

    event.preventDefault();
    window.hide();
  });
}

export function createDesktopTray(options: CreateDesktopTrayOptions): DesktopTray {
  const tray = options.createTray(options.iconPath);
  const menu = options.buildMenu([
    { label: '显示主窗口', click: options.showMainWindow },
    { label: '检查邮件', click: options.checkMail },
    { type: 'separator' },
    { label: '退出', click: options.quitApp },
  ]);

  tray.setToolTip(options.tooltip);
  tray.setContextMenu(menu);
  tray.on('double-click', options.showMainWindow);

  return tray;
}
