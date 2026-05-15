import { HttpError, grpcErrorToHttp } from '../utils/grpc-error.js';
import { createLogger } from '@finflow/shared/logger';

const logger = createLogger('gateway');

// eslint-disable-next-line no-unused-vars
export function errorMiddleware(err, req, res, _next) {
  let httpErr = err;
  if (!(err instanceof HttpError)) {
    if (typeof err?.code === 'number') httpErr = grpcErrorToHttp(err);
    else httpErr = new HttpError(500, err?.message || 'Internal error');
  }
  if (httpErr.status >= 500) {
    logger.error('Request failed', { path: req.path, message: httpErr.message, stack: err?.stack });
  } else {
    logger.warn('Request rejected', { path: req.path, status: httpErr.status, message: httpErr.message });
  }
  res.status(httpErr.status).json({ error: { message: httpErr.message } });
}

export function notFoundMiddleware(_req, res) {
  res.status(404).json({ error: { message: 'Not found' } });
}
