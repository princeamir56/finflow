import { authClient } from '../config/grpc-clients.js';
import { HttpError } from '../utils/grpc-error.js';

export async function authMiddleware(req, _res, next) {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      throw new HttpError(401, 'Missing or malformed Authorization header');
    }
    const token = header.slice(7);
    const result = await authClient.ValidateToken({ token });
    if (!result?.valid) throw new HttpError(401, 'Invalid token');
    req.user = { id: result.user_id, email: result.email };
    next();
  } catch (err) {
    next(err);
  }
}

/** Resolve user from token without forcing auth (used by GraphQL context). */
export async function resolveUser(token) {
  if (!token) return null;
  try {
    const result = await authClient.ValidateToken({ token });
    if (!result?.valid) return null;
    return { id: result.user_id, email: result.email };
  } catch {
    return null;
  }
}
