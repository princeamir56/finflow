import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import grpc from '@grpc/grpc-js';
import { createLogger } from '@finflow/shared/logger';
import { usersRepository } from '../db/users.repository.js';
import { publishUserRegistered } from '../kafka/producer.js';

const logger = createLogger('auth-service:svc');

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';
const BCRYPT_ROUNDS = 10;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}

class ServiceError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

function signToken(user) {
  return jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN
  });
}

function toPublicUser(row) {
  return {
    id: row.id,
    email: row.email,
    full_name: row.full_name,
    created_at: row.created_at
  };
}

export const authService = {
  async register({ email, password, fullName }) {
    if (!email || !EMAIL_REGEX.test(email)) {
      throw new ServiceError(grpc.status.INVALID_ARGUMENT, 'Invalid email');
    }
    if (!password || password.length < 6) {
      throw new ServiceError(grpc.status.INVALID_ARGUMENT, 'Password must be at least 6 characters');
    }
    if (!fullName || !fullName.trim()) {
      throw new ServiceError(grpc.status.INVALID_ARGUMENT, 'Full name is required');
    }

    const existing = usersRepository.findByEmail(email);
    if (existing) {
      throw new ServiceError(grpc.status.ALREADY_EXISTS, 'Email already registered');
    }

    const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const id = uuidv4();
    const user = usersRepository.create({ id, email, password: hash, fullName: fullName.trim() });
    logger.info('User registered', { userId: id, email });

    const token = signToken(user);
    await publishUserRegistered(user);

    return { token, user: toPublicUser(user) };
  },

  async login({ email, password }) {
    if (!email || !password) {
      throw new ServiceError(grpc.status.INVALID_ARGUMENT, 'Email and password required');
    }
    const user = usersRepository.findByEmail(email);
    if (!user) {
      throw new ServiceError(grpc.status.UNAUTHENTICATED, 'Invalid credentials');
    }
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      throw new ServiceError(grpc.status.UNAUTHENTICATED, 'Invalid credentials');
    }
    logger.info('User logged in', { userId: user.id, email });
    return { token: signToken(user), user: toPublicUser(user) };
  },

  validateToken(token) {
    if (!token) return { valid: false, user_id: '', email: '' };
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      return { valid: true, user_id: decoded.userId, email: decoded.email };
    } catch (err) {
      logger.warn('Token validation failed', { error: err.message });
      return { valid: false, user_id: '', email: '' };
    }
  },

  getUser(userId) {
    if (!userId) {
      throw new ServiceError(grpc.status.INVALID_ARGUMENT, 'user_id is required');
    }
    const user = usersRepository.findById(userId);
    if (!user) {
      throw new ServiceError(grpc.status.NOT_FOUND, 'User not found');
    }
    return toPublicUser(user);
  }
};

export { ServiceError };
