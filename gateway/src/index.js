import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import http from 'node:http';

import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import swaggerUi from 'swagger-ui-express';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@as-integrations/express4';

import { createLogger } from '@finflow/shared/logger';
import { typeDefs } from './graphql/schema.js';
import { resolvers } from './graphql/resolvers.js';
import { resolveUser } from './middleware/auth.middleware.js';
import { errorMiddleware, notFoundMiddleware } from './middleware/error.middleware.js';

import authRoutes from './rest/auth.routes.js';
import accountsRoutes from './rest/accounts.routes.js';
import transactionsRoutes from './rest/transactions.routes.js';
import notificationsRoutes from './rest/notifications.routes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const logger = createLogger('gateway');

async function bootstrap() {
  const app = express();
  const httpServer = http.createServer(app);

  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));
  app.use(morgan('combined', {
    stream: { write: (msg) => logger.info(msg.trim()) }
  }));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'gateway', timestamp: new Date().toISOString() });
  });

  // Swagger
  const openapi = JSON.parse(readFileSync(path.join(__dirname, 'swagger/openapi.json'), 'utf8'));
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openapi));

  // REST
  app.use('/api/auth', authRoutes);
  app.use('/api/accounts', accountsRoutes);
  app.use('/api/transactions', transactionsRoutes);
  app.use('/api/notifications', notificationsRoutes);

  // GraphQL
  const apollo = new ApolloServer({ typeDefs, resolvers });
  await apollo.start();
  app.use(
    '/graphql',
    express.json(),
    expressMiddleware(apollo, {
      context: async ({ req }) => {
        const header = req.headers.authorization || '';
        const token = header.startsWith('Bearer ') ? header.slice(7) : null;
        const user = await resolveUser(token);
        return { user, token };
      }
    })
  );

  app.use(notFoundMiddleware);
  app.use(errorMiddleware);

  const port = parseInt(process.env.GATEWAY_PORT, 10) || 3000;
  httpServer.listen(port, () => {
    logger.info(`Gateway listening on http://localhost:${port}`);
    logger.info(`  REST       → http://localhost:${port}/api`);
    logger.info(`  GraphQL    → http://localhost:${port}/graphql`);
    logger.info(`  Swagger UI → http://localhost:${port}/api-docs`);
  });

  const shutdown = async (signal) => {
    logger.info(`Received ${signal}, shutting down gateway...`);
    httpServer.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

bootstrap().catch((err) => {
  logger.error('Failed to start gateway', { error: err.message, stack: err.stack });
  process.exit(1);
});
