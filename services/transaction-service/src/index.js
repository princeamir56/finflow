import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import grpc from '@grpc/grpc-js';
import protoLoader from '@grpc/proto-loader';

import { createLogger } from '@finflow/shared/logger';
import { migrate } from './db/connection.js';
import { connectProducer, disconnectProducer } from './kafka/producer.js';
import { transactionHandler } from './grpc/transaction.handler.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const logger = createLogger('transaction-service');

const PROTO_PATH = path.resolve(__dirname, '../../../shared/proto/transaction.proto');

const packageDef = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true
});
const txProto = grpc.loadPackageDefinition(packageDef).transaction;

async function main() {
  migrate();
  await connectProducer();

  const server = new grpc.Server();
  server.addService(txProto.TransactionService.service, transactionHandler);

  const port = process.env.TRANSACTION_GRPC_PORT || '50052';
  const host = `0.0.0.0:${port}`;

  await new Promise((resolve, reject) => {
    server.bindAsync(host, grpc.ServerCredentials.createInsecure(), (err, boundPort) => {
      if (err) return reject(err);
      logger.info(`transaction-service gRPC server listening on 0.0.0.0:${boundPort}`);
      resolve();
    });
  });

  const shutdown = (signal) => {
    logger.info(`Received ${signal}, shutting down transaction-service...`);
    server.tryShutdown(async (err) => {
      if (err) {
        logger.error('Error during gRPC shutdown', { error: err.message });
        server.forceShutdown();
      }
      try {
        await disconnectProducer();
      } catch (e) {
        logger.error('Error disconnecting producer', { error: e.message });
      }
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
