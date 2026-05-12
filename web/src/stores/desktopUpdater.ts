import { create } from 'zustand';

export type UpdateStatus = {
  available: boolean;
  checking: boolean;
  updateAvailable: boolean;
  downloaded: boolean;
  progress: number | null;
  version: string | null;
  error: string | null;
};

type DesktopShellUpdaterLike = Pick<NonNullable<Window['desktopShell']>, 'getUpdateStatus' | 'checkForUpdates' | 'installUpdate' | 'onUpdateStatusChanged'>;
type DesktopShellContainer = {
  desktopShell?: Partial<NonNullable<Window['desktopShell']>>;
};

type DesktopUpdaterState = {
  available: boolean;
  status: UpdateStatus;
  loadStatus: () => Promise<UpdateStatus>;
  checkForUpdates: () => Promise<UpdateStatus>;
  installUpdate: () => Promise<void>;
  subscribeToUpdates: () => () => void;
};

export const defaultUpdateStatus: UpdateStatus = {
  available: false,
  checking: false,
  updateAvailable: false,
  downloaded: false,
  progress: null,
  version: null,
  error: null,
};

export function isDesktopUpdaterAvailable(value: DesktopShellContainer | undefined): value is { desktopShell: DesktopShellUpdaterLike } {
  return Boolean(
    value?.desktopShell?.getUpdateStatus
      && value.desktopShell.checkForUpdates
      && value.desktopShell.installUpdate
      && value.desktopShell.onUpdateStatusChanged,
  );
}

export function createDesktopUpdaterBridge(value: DesktopShellContainer | undefined) {
  return {
    async getStatus(): Promise<UpdateStatus> {
      if (!isDesktopUpdaterAvailable(value)) {
        return defaultUpdateStatus;
      }

      return value.desktopShell.getUpdateStatus();
    },
    async checkForUpdates(): Promise<UpdateStatus> {
      if (!isDesktopUpdaterAvailable(value)) {
        return defaultUpdateStatus;
      }

      return value.desktopShell.checkForUpdates();
    },
    async installUpdate(): Promise<void> {
      if (!isDesktopUpdaterAvailable(value)) {
        return;
      }

      await value.desktopShell.installUpdate();
    },
    onStatusChanged(callback: (status: UpdateStatus) => void): () => void {
      if (!isDesktopUpdaterAvailable(value)) {
        return () => undefined;
      }

      return value.desktopShell.onUpdateStatusChanged(callback);
    },
  };
}

function getDesktopUpdaterBridge() {
  if (typeof window === 'undefined') {
    return createDesktopUpdaterBridge(undefined);
  }

  return createDesktopUpdaterBridge(window);
}

export const useDesktopUpdaterStore = create<DesktopUpdaterState>((set) => ({
  available: typeof window !== 'undefined' && isDesktopUpdaterAvailable(window),
  status: defaultUpdateStatus,
  loadStatus: async () => {
    const bridge = getDesktopUpdaterBridge();
    const status = await bridge.getStatus();

    set({
      available: typeof window !== 'undefined' && isDesktopUpdaterAvailable(window),
      status,
    });

    return status;
  },
  checkForUpdates: async () => {
    const bridge = getDesktopUpdaterBridge();
    const status = await bridge.checkForUpdates();

    set({
      available: typeof window !== 'undefined' && isDesktopUpdaterAvailable(window),
      status,
    });

    return status;
  },
  installUpdate: async () => {
    await getDesktopUpdaterBridge().installUpdate();
  },
  subscribeToUpdates: () => getDesktopUpdaterBridge().onStatusChanged((status) => {
    set({
      available: typeof window !== 'undefined' && isDesktopUpdaterAvailable(window),
      status,
    });
  }),
}));
