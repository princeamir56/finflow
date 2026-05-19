import { createRxDatabase, addRxPlugin } from 'rxdb';
import { getRxStorageMemory } from 'rxdb/plugins/storage-memory';
import { createLogger } from '@finflow/shared/logger';
import { notificationSchema, processedEventSchema } from './notifications.schema.js';

const logger = createLogger('notification-service:db');

let dbInstance = null;

export async function initDb() {
  if (dbInstance) return dbInstance;

  if (process.env.NODE_ENV !== 'production') {
    try {
      const { RxDBDevModePlugin } = await import('rxdb/plugins/dev-mode');
      addRxPlugin(RxDBDevModePlugin);
    } catch (err) {
      logger.warn('Dev-mode plugin not loaded', { error: err.message });
    }
  }

  const dbName = process.env.NOTIFICATION_DB_NAME || 'finflow_notifications';
  const db = await createRxDatabase({
    name: dbName,
    storage: getRxStorageMemory(),
    ignoreDuplicate: true
  });

  await db.addCollections({
    notifications:    { schema: notificationSchema },
    processed_events: { schema: processedEventSchema }
  });

  logger.info('RxDB initialized', { dbName, storage: 'memory' });
  dbInstance = db;
  return db;
}

export function getDb() {
  if (!dbInstance) throw new Error('RxDB not initialized — call initDb() first');
  return dbInstance;
}
