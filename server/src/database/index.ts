import fs from 'fs';
import path from 'path';
import sqlite3 from 'sqlite3';
import { Database, open } from 'sqlite';
import { config } from '../config';

const BUSY_TIMEOUT_MS = 5_000;

let db: Database | null = null;
let dbPromise: Promise<Database> | null = null;
let transactionQueue: Promise<void> = Promise.resolve();

async function configureConnection(database: Database): Promise<Database> {
  await database.exec('PRAGMA journal_mode = WAL;');
  await database.exec('PRAGMA foreign_keys = ON;');
  await database.exec(`PRAGMA busy_timeout = ${BUSY_TIMEOUT_MS};`);
  return database;
}

async function openConnection(): Promise<Database> {
  const dir = path.dirname(config.dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const database = await open({
    filename: config.dbPath,
    driver: sqlite3.Database,
  });

  return configureConnection(database);
}

export async function initDb(): Promise<Database> {
  if (db) {
    return db;
  }

  if (dbPromise) {
    return dbPromise;
  }

  dbPromise = openConnection().then((database) => {
    db = database;
    return database;
  }).catch((error) => {
    dbPromise = null;
    throw error;
  });

  return dbPromise;
}

export function getDb(): Database {
  if (!db) {
    throw new Error('Database has not been initialized. Call initDb() first.');
  }

  return db;
}

export function getDbCompanionPaths(dbPath = config.dbPath): string[] {
  return [`${dbPath}-wal`, `${dbPath}-shm`];
}

export async function createBackupSnapshot(targetPath: string): Promise<void> {
  const database = await initDb();
  fs.rmSync(targetPath, { force: true });
  await database.exec(`VACUUM INTO '${targetPath.replace(/'/g, "''")}'`);
}

export async function closeDb(): Promise<void> {
  const activeDb = db;
  const pendingDbPromise = dbPromise;

  db = null;
  dbPromise = null;

  if (activeDb) {
    await activeDb.close();
    return;
  }

  if (pendingDbPromise) {
    const pendingDb = await pendingDbPromise;
    await pendingDb.close();
  }
}

export async function reopenDb(): Promise<Database> {
  return initDb();
}

export async function runInTransaction<T>(work: (database: Database) => Promise<T>): Promise<T> {
  await initDb();

  const previous = transactionQueue;
  let release: (() => void) | undefined;

  transactionQueue = new Promise<void>((resolve) => {
    release = resolve;
  });

  await previous;

  const transactionDb = await openConnection();
  let started = false;

  try {
    await transactionDb.exec('BEGIN IMMEDIATE');
    started = true;

    const result = await work(transactionDb);

    await transactionDb.exec('COMMIT');
    return result;
  } catch (error) {
    if (started) {
      await transactionDb.exec('ROLLBACK');
    }
    throw error;
  } finally {
    release?.();
    await transactionDb.close();
  }
}

const dbProxy = new Proxy({} as Database, {
  get(_target, prop) {
    const database = getDb() as Database & Record<PropertyKey, unknown>;
    const value = database[prop];
    return typeof value === 'function' ? value.bind(database) : value;
  },
});

export default dbProxy;
