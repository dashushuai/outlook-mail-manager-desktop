type DesktopFileEncoding = 'utf8' | 'base64';

type DesktopFileFilter = {
  name: string;
  extensions: string[];
};

export type OpenDesktopFileOptions = {
  title?: string;
  filters?: DesktopFileFilter[];
  encoding: DesktopFileEncoding;
};

export type SaveDesktopFileOptions = OpenDesktopFileOptions & {
  defaultPath?: string;
  content: string;
};

export type OpenDesktopFileResult = {
  fileName: string;
  content: string;
};

type DesktopFileShell = Pick<NonNullable<Window['desktopShell']>, 'openFileDialog' | 'saveFileDialog'>;

type DesktopFileShellContainer = {
  desktopShell?: Partial<NonNullable<Window['desktopShell']>>;
};

export function isDesktopFileDialogAvailable(value: DesktopFileShellContainer | undefined): value is { desktopShell: DesktopFileShell } {
  return typeof value?.desktopShell?.openFileDialog === 'function' && typeof value.desktopShell.saveFileDialog === 'function';
}

export async function openDesktopFile(value: DesktopFileShellContainer | undefined, options: OpenDesktopFileOptions): Promise<OpenDesktopFileResult | null> {
  if (!isDesktopFileDialogAvailable(value)) {
    return null;
  }

  const result = await value.desktopShell.openFileDialog(options);

  if (!result) {
    return null;
  }

  return {
    fileName: result.fileName,
    content: result.content,
  };
}

export async function saveDesktopFile(value: DesktopFileShellContainer | undefined, options: SaveDesktopFileOptions): Promise<boolean> {
  if (!isDesktopFileDialogAvailable(value)) {
    return false;
  }

  return value.desktopShell.saveFileDialog(options);
}

export function getDesktopFileShellContainer(): DesktopFileShellContainer | undefined {
  return typeof window === 'undefined' ? undefined : window;
}
