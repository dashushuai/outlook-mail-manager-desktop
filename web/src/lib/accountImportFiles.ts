import type { ImportRequest } from '../types';

type JsonAccount = {
  email?: unknown;
  password?: unknown;
  client_id?: unknown;
  refresh_token?: unknown;
};

const IMPORT_FORMAT = ['email', 'password', 'client_id', 'refresh_token'];
const IMPORT_SEPARATOR = '----';

function readString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function readAccounts(value: unknown): JsonAccount[] {
  if (Array.isArray(value)) {
    return value as JsonAccount[];
  }

  if (typeof value === 'object' && value !== null && Array.isArray((value as { accounts?: unknown }).accounts)) {
    return (value as { accounts: JsonAccount[] }).accounts;
  }

  return [];
}

export function parseAccountImportJson(content: string): ImportRequest {
  let payload: unknown;

  try {
    payload = JSON.parse(content);
  } catch {
    throw new Error('不是有效的 JSON 文件');
  }

  const accounts = readAccounts(payload);

  if (accounts.length === 0) {
    throw new Error('JSON 文件中没有可导入的账户');
  }

  const lines = accounts.map((account, index) => {
    const email = readString(account.email);
    const password = readString(account.password);
    const clientId = readString(account.client_id);
    const refreshToken = readString(account.refresh_token);

    if (!email || !clientId || !refreshToken) {
      throw new Error(`第 ${index + 1} 个账户缺少必要字段`);
    }

    return [email, password, clientId, refreshToken].join(IMPORT_SEPARATOR);
  });

  return {
    content: lines.join('\n'),
    separator: IMPORT_SEPARATOR,
    format: IMPORT_FORMAT,
  };
}

export function isJsonAccountImportFile(file: Pick<File, 'name' | 'type'>): boolean {
  return file.name.toLowerCase().endsWith('.json') || file.type === 'application/json';
}
