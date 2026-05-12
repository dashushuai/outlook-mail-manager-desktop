import path from 'node:path';
import { dialog } from 'electron';
import { readFile, writeFile } from 'node:fs/promises';

type FileEncoding = 'utf8' | 'base64';

type FileFilter = {
  name: string;
  extensions: string[];
};

type OpenFileDialogPayload = {
  title?: string;
  filters?: FileFilter[];
  encoding?: FileEncoding;
};

type SaveFileDialogPayload = OpenFileDialogPayload & {
  defaultPath?: string;
  content: string;
};

type OpenFileDialogResult = {
  filePath: string;
  fileName: string;
  content: string;
};

type IpcMainLike = {
  handle(channel: string, handler: (...args: unknown[]) => unknown): void;
};

type DialogLike = {
  showOpenDialog(options: unknown): Promise<{ canceled: boolean; filePaths: string[] }>;
  showSaveDialog(options: unknown): Promise<{ canceled: boolean; filePath?: string }>;
};

type RegisterFileDialogHandlersOptions = {
  ipcMain: IpcMainLike;
  dialog?: DialogLike;
  readFile?: (filePath: string, encoding: BufferEncoding) => Promise<string>;
  writeFile?: (filePath: string, content: string, encoding: BufferEncoding) => Promise<void>;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isValidEncoding(value: unknown): value is FileEncoding {
  return value === undefined || value === 'utf8' || value === 'base64';
}

function parseFilters(value: unknown): FileFilter[] | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!Array.isArray(value)) {
    return undefined;
  }

  const filters: FileFilter[] = [];

  for (const item of value) {
    if (!isPlainObject(item) || typeof item.name !== 'string' || !Array.isArray(item.extensions)) {
      return undefined;
    }

    const extensions = item.extensions.filter((extension): extension is string => typeof extension === 'string' && extension.length > 0);

    if (!item.name || extensions.length === 0) {
      return undefined;
    }

    filters.push({ name: item.name, extensions });
  }

  return filters;
}

function parseOpenPayload(value: unknown): OpenFileDialogPayload {
  if (!isPlainObject(value) || !isValidEncoding(value.encoding)) {
    throw new Error('Invalid file open payload');
  }

  const filters = parseFilters(value.filters);

  if ('filters' in value && filters === undefined) {
    throw new Error('Invalid file open payload');
  }

  return {
    title: typeof value.title === 'string' ? value.title : undefined,
    filters,
    encoding: value.encoding ?? 'utf8',
  };
}

function parseSavePayload(value: unknown): SaveFileDialogPayload {
  if (!isPlainObject(value) || typeof value.content !== 'string' || !isValidEncoding(value.encoding)) {
    throw new Error('Invalid file save payload');
  }

  const filters = parseFilters(value.filters);

  if ('filters' in value && filters === undefined) {
    throw new Error('Invalid file save payload');
  }

  return {
    title: typeof value.title === 'string' ? value.title : undefined,
    defaultPath: typeof value.defaultPath === 'string' ? value.defaultPath : undefined,
    filters,
    encoding: value.encoding ?? 'utf8',
    content: value.content,
  };
}

export function registerFileDialogHandlers(options: RegisterFileDialogHandlersOptions): void {
  const dialogImpl = options.dialog ?? dialog;
  const readFileImpl = options.readFile ?? readFile;
  const writeFileImpl = options.writeFile ?? writeFile;

  options.ipcMain.handle('desktop:open-file-dialog', async (_event, payload: unknown): Promise<OpenFileDialogResult | null> => {
    const request = parseOpenPayload(payload);
    const result = await dialogImpl.showOpenDialog({
      title: request.title,
      properties: ['openFile'],
      filters: request.filters,
    });

    if (result.canceled || !result.filePaths[0]) {
      return null;
    }

    const filePath = result.filePaths[0];
    const content = await readFileImpl(filePath, request.encoding ?? 'utf8');

    return {
      filePath,
      fileName: path.basename(filePath),
      content,
    };
  });

  options.ipcMain.handle('desktop:save-file-dialog', async (_event, payload: unknown): Promise<boolean> => {
    const request = parseSavePayload(payload);
    const result = await dialogImpl.showSaveDialog({
      title: request.title,
      defaultPath: request.defaultPath,
      filters: request.filters,
    });

    if (result.canceled || !result.filePath) {
      return false;
    }

    await writeFileImpl(result.filePath, request.content, request.encoding ?? 'utf8');
    return true;
  });
}
