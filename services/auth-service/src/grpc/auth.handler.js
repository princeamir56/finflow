import grpc from '@grpc/grpc-js';
import { createLogger } from '@finflow/shared/logger';
import { authService } from '../services/auth.service.js';

const logger = createLogger('auth-service:grpc');

function wrap(name, fn) {
  return async (call, callback) => {
    try {
      const result = await fn(call);
      callback(null, result);
    } catch (err) {
      logger.error(`RPC ${name} failed`, { error: err.message, stack: err.stack });
      const code = typeof err.code === 'number' ? err.code : grpc.status.INTERNAL;
      callback({ code, message: err.message || 'Internal error' });
    }
  };
}

export const authHandler = {
  Register: wrap('Register', async (call) => {
    const { email, password, full_name } = call.request;
    return authService.register({ email, password, fullName: full_name });
  }),

  Login: wrap('Login', async (call) => {
    const { email, password } = call.request;
    return authService.login({ email, password });
  }),

  ValidateToken: wrap('ValidateToken', async (call) => {
    return authService.validateToken(call.request.token);
  }),

  GetUser: wrap('GetUser', async (call) => {
    return authService.getUser(call.request.user_id);
  })
};
