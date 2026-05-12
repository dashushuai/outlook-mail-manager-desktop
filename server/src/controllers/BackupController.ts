import { Context } from 'koa';
import fs from 'fs';
import { closeDb, createBackupSnapshot, getDbCompanionPaths, reopenDb } from '../database';
import { success, fail } from '../utils/response';
import { config } from '../config';

const DB_PATH = config.dbPath;

function removeFileIfExists(filePath: string) {
  fs.rmSync(filePath, { force: true });
}

export class BackupController {
  async download(ctx: Context) {
    if (!fs.existsSync(DB_PATH)) {
      return fail(ctx, 'Database file not found', 404);
    }

    const fileName = `backup-${new Date().toISOString().replace(/[:.]/g, '-')}.db`;
    const snapshotPath = `${DB_PATH}.snapshot-${Date.now()}`;

    try {
      await createBackupSnapshot(snapshotPath);

      const stream = fs.createReadStream(snapshotPath);
      const cleanup = () => removeFileIfExists(snapshotPath);
      stream.once('close', cleanup);
      stream.once('error', cleanup);

      ctx.set('Content-Type', 'application/octet-stream');
      ctx.set('Content-Disposition', `attachment; filename="${fileName}"`);
      ctx.body = stream;
    } catch (err: any) {
      removeFileIfExists(snapshotPath);
      return fail(ctx, `Backup failed: ${err.message}`, 500);
    }
  }

  async restore(ctx: Context) {
    const body = ctx.request.body as any;

    if (!body.fileContent) {
      return fail(ctx, 'fileContent is required', 400);
    }

    const timestamp = Date.now();
    const backupPath = `${DB_PATH}.backup-${timestamp}`;
    const restorePath = `${DB_PATH}.restore-${timestamp}`;
    let closedConnection = false;

    try {
      const buffer = Buffer.from(body.fileContent, 'base64');
      const magic = buffer.toString('utf8', 0, 15);
      if (!magic.startsWith('SQLite format 3')) {
        return fail(ctx, 'Invalid SQLite database file', 400);
      }

      fs.writeFileSync(restorePath, buffer);

      if (fs.existsSync(DB_PATH)) {
        await createBackupSnapshot(backupPath);
      }

      await closeDb();
      closedConnection = true;

      removeFileIfExists(DB_PATH);
      for (const companionPath of getDbCompanionPaths()) {
        removeFileIfExists(companionPath);
      }

      fs.renameSync(restorePath, DB_PATH);
      await reopenDb();
      closedConnection = false;

      success(ctx, {
        message: 'Database restored successfully',
        backup: fs.existsSync(backupPath) ? backupPath : null,
      });
    } catch (err: any) {
      if (closedConnection) {
        try {
          await reopenDb();
        } catch {
          // Ignore reopen errors here and report the original restore failure.
        }
      }
      return fail(ctx, `Restore failed: ${err.message}`, 500);
    } finally {
      removeFileIfExists(restorePath);
    }
  }
}
