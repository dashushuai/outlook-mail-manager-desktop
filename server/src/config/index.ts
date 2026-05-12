import dotenv from 'dotenv';
import path from 'path';

export type ConfigEnv = {
  PORT?: string;
  LOG_LEVEL?: string;
  DB_PATH?: string;
  ACCESS_PASSWORD?: string;
  ELECTRON_DESKTOP?: string;
  ELECTRON_USER_DATA_PATH?: string;
};

// 尝试加载根目录和 server 目录的 .env
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export function isDesktopRuntime(env: ConfigEnv = process.env): boolean {
  const desktopFlag = env.ELECTRON_DESKTOP?.trim().toLowerCase();
  return desktopFlag === '1' || desktopFlag === 'true';
}

export function resolveDbPath(
  env: ConfigEnv = process.env,
  runtimeDir = __dirname,
): string {
  if (isDesktopRuntime(env)) {
    const userDataPath = env.ELECTRON_USER_DATA_PATH?.trim();

    if (!userDataPath) {
      throw new Error('ELECTRON_USER_DATA_PATH is required in desktop mode');
    }

    return path.resolve(userDataPath, 'outlook.db');
  }

  const configuredDbPath = env.DB_PATH?.trim();

  if (configuredDbPath) {
    return path.resolve(runtimeDir, '../..', configuredDbPath);
  }

  return path.resolve(runtimeDir, '../..', './data/outlook.db');
}

export function resolveAccessPassword(env: ConfigEnv = process.env): string {
  if (isDesktopRuntime(env)) {
    return '';
  }

  return env.ACCESS_PASSWORD?.trim() || '';
}

export function requiresAccessPassword(env: ConfigEnv = process.env): boolean {
  return resolveAccessPassword(env).length > 0;
}

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  logLevel: process.env.LOG_LEVEL || 'info',
  dbPath: resolveDbPath(),
  accessPassword: resolveAccessPassword(),
  isDesktop: isDesktopRuntime(),
};
