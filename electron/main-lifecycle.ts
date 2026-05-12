export function openMainWindow(
  createMainWindow: () => Promise<unknown>,
  onFailure: (error: unknown) => void,
): void {
  void createMainWindow().catch(onFailure);
}

export async function shutdownDesktopApp(
  stopEmbeddedServer: () => Promise<void>,
  quitApp: () => void,
): Promise<void> {
  try {
    await stopEmbeddedServer();
  } catch {
  } finally {
    quitApp();
  }
}

export async function handleDesktopStartupFailure(
  stopEmbeddedServer: () => Promise<void>,
  exitApp: (code: number) => void,
): Promise<void> {
  try {
    await stopEmbeddedServer();
  } catch {
  } finally {
    exitApp(1);
  }
}
