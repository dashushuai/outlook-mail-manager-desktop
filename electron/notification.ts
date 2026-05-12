type NotificationPayload = {
  title: string;
  body?: string;
};

function resolveNotificationPayload(payload: unknown): NotificationPayload | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const candidate = payload as Partial<NotificationPayload>;

  if (typeof candidate.title !== 'string') {
    return null;
  }

  const title = candidate.title.trim();

  if (!title || title.length > 120) {
    return null;
  }

  if (candidate.body !== undefined && typeof candidate.body !== 'string') {
    return null;
  }

  const body = candidate.body?.trim();

  if (body && body.length > 500) {
    return null;
  }

  return { title, body };
}

type IpcMainLike = {
  handle(channel: string, handler: (event: unknown, payload: NotificationPayload) => Promise<boolean>): void;
};

type NotificationLike = {
  on(event: 'click', callback: () => void): void;
  show(): void;
};

type NotificationConstructor = {
  new(payload: NotificationPayload): NotificationLike;
  isSupported(): boolean;
};

type RegisterNotificationHandlerOptions = {
  ipcMain: IpcMainLike;
  NotificationConstructor: NotificationConstructor;
  focusMainWindow(): void;
};

export function registerNotificationHandler(options: RegisterNotificationHandlerOptions): void {
  options.ipcMain.handle('desktop:notify', async (_event, payload) => {
    const resolvedPayload = resolveNotificationPayload(payload);

    if (!resolvedPayload || !options.NotificationConstructor.isSupported()) {
      return false;
    }

    const notification = new options.NotificationConstructor(resolvedPayload);

    notification.on('click', options.focusMainWindow);
    notification.show();

    return true;
  });
}
