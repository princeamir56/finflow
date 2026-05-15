import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import grpc from '@grpc/grpc-js';
import protoLoader from '@grpc/proto-loader';

import { createLogger } from '@finflow/shared/logger';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const logger = createLogger('transaction-service');

const PROTO_PATH = path.resolve(__dirname, '../../../shared/proto/transaction.proto');

const packageDef = protoLoader.loadSync(PROTO_PATH, {
  keepCase: false,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true
});
const txProto = grpc.loadPackageDefinition(packageDef).transaction;

function wrap(handler) {
  return async (call, callback) => {
    try {
      await handler(call, callback);
    } catch (err) {
      logger.error('RPC failed', { method: handler.name, error: err.message, stack: err.stack });
      const code = typeof err.code === 'number' ? err.code : grpc.status.INTERNAL;
      callback({ code, message: err.message || 'Internal error' });
    }
  };
}

const unimplemented = (name) =>
  wrap(async function unimplemented(_call, callback) {
    callback({
      code: grpc.status.UNIMPLEMENTED,
      message: `${name} — Not yet implemented; will be done on Day 2`
    });
  });

const implementation = {
  CreateAccount: unimplemented('CreateAccount'),
  GetAccount: unimplemented('GetAccount'),
  GetUserAccounts: unimplemented('GetUserAccounts'),
  Deposit: unimplemented('Deposit'),
  Withdraw: unimplemented('Withdraw'),
  Transfer: unimplemented('Transfer'),
  GetHistory: unimplemented('GetHistory')
};

function main() {
  const server = new grpc.Server();
  server.addService(txProto.TransactionService.service, implementation);

  const port = process.env.TRANSACTION_GRPC_PORT || '50052';
  const host = `0.0.0.0:${port}`;

  server.bindAsync(host, grpc.ServerCredentials.createInsecure(), (err, boundPort) => {
    if (err) {
      logger.error('Failed to bind gRPC server', { error: err.message });
      process.exit(1);
    }
    logger.info(`transaction-service gRPC server listening on 0.0.0.0:${boundPort}`);
  });

  const shutdown = (signal) => {
    logger.info(`Received ${signal}, shutting down transaction-service...`);
    server.tryShutdown((err) => {
      if (err) {
        logger.error('Error during shutdown', { error: err.message });
        server.forceShutdown();
      }
      process.exit(0);
    });
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main();
