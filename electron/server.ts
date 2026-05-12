import { createServer, type Server } from 'node:http';
import path from 'node:path';

export const DEFAULT_SERVER_HOST = '127.0.0.1';
export const DEFAULT_SERVER_PORT = 3000;

type DesktopServerEnv = {
  ELECTRON_SERVER_HOST?: string;
  PORT?: string;
  ELECTRON_DESKTOP?: string;
  ELECTRON_USER_DATA_PATH?: string;
};

export type DesktopServerConfig = {
  host: string;
  port: number;
  url: string;
};

type EmbeddedServerModules = {
  app: { callback(): (req: unknown, res: unknown) => void };
  initDb: () => Promise<unknown>;
  closeDb: () => Promise<void>;
  runMigrations: () => Promise<void>;
};

export type EmbeddedServerModulePaths = {
  appPath: string;
  databasePath: string;
  migrationsPath: string;
};

let embeddedServer: Server | null = null;
let embeddedServerStartPromise: Promise<DesktopServerConfig> | null = null;

export function applyEmbeddedServerEnv(env: DesktopServerEnv = process.env): void {
  if (env.ELECTRON_DESKTOP) {
    process.env.ELECTRON_DESKTOP = env.ELECTRON_DESKTOP;
  }

  if (env.ELECTRON_USER_DATA_PATH) {
    process.env.ELECTRON_USER_DATA_PATH = env.ELECTRON_USER_DATA_PATH;
  }
}

function parsePort(rawPort?: string): number {
  if (!rawPort) {
    return DEFAULT_SERVER_PORT;
  }

  const normalizedPort = rawPort.trim();

  if (!/^\d+$/.test(normalizedPort)) {
    return DEFAULT_SERVER_PORT;
  }

  const port = Number(normalizedPort);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return DEFAULT_SERVER_PORT;
  }

  return port;
}

export function resolveEmbeddedServerModulePaths(runtimeDir = __dirname): EmbeddedServerModulePaths {
  return {
    appPath: path.resolve(runtimeDir, '../server/dist/app.js'),
    databasePath: path.resolve(runtimeDir, '../server/dist/database/index.js'),
    migrationsPath: path.resolve(runtimeDir, '../server/dist/database/migrations.js'),
  };
}

function loadEmbeddedServerModules(runtimeDir = __dirname): EmbeddedServerModules {
  const modulePaths = resolveEmbeddedServerModulePaths(runtimeDir);
  const appModule = require(modulePaths.appPath) as {
    default: EmbeddedServerModules['app'];
  };
  const databaseModule = require(modulePaths.databasePath) as {
    initDb: EmbeddedServerModules['initDb'];
    closeDb: EmbeddedServerModules['closeDb'];
  };
  const migrationsModule = require(modulePaths.migrationsPath) as {
    runMigrations: EmbeddedServerModules['runMigrations'];
  };

  return {
    app: appModule.default,
    initDb: databaseModule.initDb,
    closeDb: databaseModule.closeDb,
    runMigrations: migrationsModule.runMigrations,
  };
}

function listen(server: Server, config: DesktopServerConfig): Promise<void> {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(config.port, config.host, () => {
      server.off('error', reject);
      resolve();
    });
  });
}

export async function startServerWithModules(
  config: DesktopServerConfig,
  modules: EmbeddedServerModules,
  createHttpServer: typeof createServer = createServer,
): Promise<Server> {
  const { app, initDb, closeDb, runMigrations } = modules;
  let dbInitialized = false;

  try {
    await initDb();
    dbInitialized = true;
    await runMigrations();

    const server = createHttpServer(app.callback());
    await listen(server, config);
    return server;
  } catch (error) {
    if (dbInitialized) {
      try {
        await closeDb();
      } catch {
      }
    }

    throw error;
  }
}

function closeServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

export async function stopServerWithCleanup(
  server: Server | null,
  closeDb: (() => Promise<void>) | null,
  closeHttpServer: (server: Server) => Promise<void> = closeServer,
): Promise<void> {
  let closeError: unknown;

  try {
    if (server) {
      await closeHttpServer(server);
    }
  } catch (error) {
    closeError = error;
  } finally {
    if (closeDb) {
      await closeDb();
    }
  }

  if (closeError) {
    throw closeError;
  }
}

export async function resolveServerForShutdown(
  server: Server | null,
  pendingStart: Promise<unknown> | null,
  getServer: () => Server | null,
): Promise<Server | null> {
  if (server || !pendingStart) {
    return server;
  }

  try {
    await pendingStart;
  } catch {
  }

  return getServer();
}

export function resolveDesktopServerConfig(env: DesktopServerEnv = process.env): DesktopServerConfig {
  const host = env.ELECTRON_SERVER_HOST?.trim() || DEFAULT_SERVER_HOST;
  const port = parsePort(env.PORT);

  return {
    host,
    port,
    url: `http://${host}:${port}`,
  };
}

export async function startEmbeddedServer(env: DesktopServerEnv = process.env): Promise<DesktopServerConfig> {
  if (embeddedServer?.listening) {
    return resolveDesktopServerConfig(env);
  }

  if (embeddedServerStartPromise) {
    return embeddedServerStartPromise;
  }

  const config = resolveDesktopServerConfig(env);

  embeddedServerStartPromise = (async () => {
    applyEmbeddedServerEnv(env);
    const modules = loadEmbeddedServerModules();
    const server = await startServerWithModules(config, modules);
    embeddedServer = server;
    embeddedServerStartPromise = null;

    return config;
  })().catch((error) => {
    embeddedServer = null;
    embeddedServerStartPromise = null;
    throw error;
  });

  return embeddedServerStartPromise;
}

export async function stopEmbeddedServer(): Promise<void> {
  let closeDb: EmbeddedServerModules['closeDb'] | null = null;

  try {
    ({ closeDb } = loadEmbeddedServerModules());
  } catch {
    closeDb = null;
  }

  const pendingStart = embeddedServerStartPromise;
  const server = await resolveServerForShutdown(embeddedServer, pendingStart, () => embeddedServer);
  embeddedServer = null;
  embeddedServerStartPromise = null;

  await stopServerWithCleanup(server, server ? closeDb : null);
}
