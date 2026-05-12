import app from './app';
import { config } from './config';
import { initDb } from './database';
import { runMigrations } from './database/migrations';
import logger from './utils/logger';

async function startServer() {
  try {
    await initDb();
    await runMigrations();
    logger.info('Database initialization and migrations completed');

    app.listen(config.port, () => {
      logger.info(`Server is running on http://localhost:${config.port}`);
    });
  } catch (error: any) {
    logger.error(`Failed to start server: ${error?.message || error}`);
    process.exit(1);
  }
}

void startServer();
