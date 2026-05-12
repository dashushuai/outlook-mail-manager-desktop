import { ipcMain, Notification } from 'electron';

import { registerFileDialogHandlers } from '../file-dialog';
import { registerNotificationHandler } from '../notification';
import { registerUpdaterIpcHandlers, type DesktopUpdater } from '../updater';

let handlersRegistered = false;

type RegisterIpcHandlersOptions = {
  focusMainWindow?: () => void;
  getSettings?: () => unknown;
  updateSettings?: (payload: unknown) => unknown;
  updater?: Pick<DesktopUpdater, 'getStatus' | 'checkForUpdates' | 'installUpdate'>;
};

export function registerIpcHandlers(options: RegisterIpcHandlersOptions = {}): void {
  if (handlersRegistered) {
    return;
  }

  ipcMain.handle('desktop:ping', () => 'pong');
  ipcMain.handle('desktop:get-settings', () => options.getSettings?.() ?? null);
  ipcMain.handle('desktop:update-settings', (_event, payload: unknown) => options.updateSettings?.(payload) ?? null);
  registerFileDialogHandlers({ ipcMain });
  registerNotificationHandler({
    ipcMain,
    NotificationConstructor: Notification,
    focusMainWindow: options.focusMainWindow ?? (() => {}),
  });

  if (options.updater) {
    registerUpdaterIpcHandlers({
      ipcMain,
      updater: options.updater,
    });
  }

  handlersRegistered = true;
}
