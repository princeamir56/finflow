import path from 'node:path';
import { fileURLToPath } from 'node:url';
import grpc from '@grpc/grpc-js';
import protoLoader from '@grpc/proto-loader';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROTO_DIR = path.resolve(__dirname, '../../../shared/proto');

const loaderOptions = {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true
};

function loadProto(file, pkg) {
  const def = protoLoader.loadSync(path.join(PROTO_DIR, file), loaderOptions);
  const loaded = grpc.loadPackageDefinition(def);
  return loaded[pkg];
}

/**
 * Wrap a gRPC client into a fully-promisified object where every RPC returns a Promise.
 */
function promisifyClient(client) {
  const proto = Object.getPrototypeOf(client);
  const wrapped = {};
  for (const method of Object.getOwnPropertyNames(proto)) {
    if (method === 'constructor') continue;
    const fn = client[method];
    if (typeof fn !== 'function') continue;
    wrapped[method] = (request = {}, metadata) =>
      new Promise((resolve, reject) => {
        const cb = (err, response) => (err ? reject(err) : resolve(response));
        if (metadata) client[method](request, metadata, cb);
        else client[method](request, cb);
      });
  }
  return wrapped;
}

function makeClient(ServiceCtor, host, port) {
  const addr = `${host}:${port}`;
  const client = new ServiceCtor(addr, grpc.credentials.createInsecure());
  return promisifyClient(client);
}

const authPkg = loadProto('auth.proto', 'auth');
const txPkg = loadProto('transaction.proto', 'transaction');
const notifPkg = loadProto('notification.proto', 'notification');

export const authClient = makeClient(
  authPkg.AuthService,
  process.env.AUTH_GRPC_HOST || 'localhost',
  process.env.AUTH_GRPC_PORT || 50051
);

export const transactionClient = makeClient(
  txPkg.TransactionService,
  process.env.TRANSACTION_GRPC_HOST || 'localhost',
  process.env.TRANSACTION_GRPC_PORT || 50052
);

export const notificationClient = makeClient(
  notifPkg.NotificationService,
  process.env.NOTIFICATION_GRPC_HOST || 'localhost',
  process.env.NOTIFICATION_GRPC_PORT || 50053
);
