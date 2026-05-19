import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import grpc from '@grpc/grpc-js';
import protoLoader from '@grpc/proto-loader';

import { createLogger } from '@finflow/shared/logger';
import { initDb } from './db/rxdb.js';
import { startConsumer, stopConsumer } from './kafka/consumer.js';
import { notificationHandler } from './grpc/notification.handler.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const logger = createLogger('notification-service');

const PROTO_PATH = path.resolve(__dirname, '../../../shared/proto/notification.proto');

const packageDef = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true
});
const notifProto = grpc.loadPackageDefinition(packageDef).notification;

async function main() {
  await initDb();

  // Best-effort Kafka connect — don't crash the gRPC server if Kafka is briefly unavailable
  startConsumer().catch((err) => {
    logger.error('Kafka consumer failed to start', { error: err.message, stack: err.stack });
  });

  const server = new grpc.Server();
  server.addService(notifProto.NotificationService.service, notificationHandler);

  const port = process.env.NOTIFICATION_GRPC_PORT || '50053';
  const host = `0.0.0.0:${port}`;

  await new Promise((resolve, reject) => {
    server.bindAsync(host, grpc.ServerCredentials.createInsecure(), (err, boundPort) => {
      if (err) return reject(err);
      logger.info(`notification-service gRPC server listening on 0.0.0.0:${boundPort}`);
      resolve();
    });
  });

  const shutdown = (signal) => {
    logger.info(`Received ${signal}, shutting down notification-service...`);
    server.tryShutdown(async (err) => {
      if (err) {
        logger.error('Error during gRPC shutdown', { error: err.message });
        server.forceShutdown();
      }
      await stopConsumer();
      process.exit(0);
    });
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  logger.error('Fatal startup error', { error: err.message, stack: err.stack });
  process.exit(1);
});
