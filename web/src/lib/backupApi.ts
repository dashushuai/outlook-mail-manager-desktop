import { resolveApiBase } from './api';

type BackupApiWindow = Parameters<typeof resolveApiBase>[0];

export function resolveBackupApiUrl(path: `/backup/${string}`, currentWindow: BackupApiWindow = typeof window === 'undefined' ? undefined : window): string {
  return `${resolveApiBase(currentWindow)}${path}`;
}
