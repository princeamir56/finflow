import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import grpc from '@grpc/grpc-js';
import protoLoader from '@grpc/proto-loader';

import { createLogger } from '@finflow/shared/logger';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const logger = createLogger('auth-service');

const PROTO_PATH = path.resolve(__dirname, '../../../shared/proto/auth.proto');

const packageDef = protoLoader.loadSync(PROTO_PATH, {
  keepCase: false,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true
});
const authProto = grpc.loadPackageDefinition(packageDef).auth;

/**
 * Wrap an RPC handler so any thrown error is mapped to a gRPC status.
 */
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
  Register: unimplemented('Register'),
  Login: unimplemented('Login'),
  ValidateToken: unimplemented('ValidateToken'),
  GetUser: unimplemented('GetUser')
};

function main() {
  const server = new grpc.Server();
  server.addService(authProto.AuthService.service, implementation);

  const port = process.env.AUTH_GRPC_PORT || '50051';
  const host = `0.0.0.0:${port}`;

  server.bindAsync(host, grpc.ServerCredentials.createInsecure(), (err, boundPort) => {
    if (err) {
      logger.error('Failed to bind gRPC server', { error: err.message });
      process.exit(1);
    }
    logger.info(`auth-service gRPC server listening on 0.0.0.0:${boundPort}`);
  });

  const shutdown = (signal) => {
    logger.info(`Received ${signal}, shutting down auth-service...`);
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
