import { v4 as uuidv4 } from 'uuid';
import grpc from '@grpc/grpc-js';
import { createLogger } from '@finflow/shared/logger';
import { getDb } from '../db/rxdb.js';

const logger = createLogger('notification-service:svc');

class ServiceError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

function toPlain(doc) {
  if (!doc) return null;
  const d = doc.toJSON ? doc.toJSON() : doc;
  return {
    id: d.id,
    user_id: d.userId,
    type: d.type,
    title: d.title,
    message: d.message,
    read: !!d.read,
    created_at: d.createdAt
  };
}

export const notificationService = {
  async createNotification({ userId, type, title, message }) {
    if (!userId || !type || !title || !message) {
      throw new ServiceError(grpc.status.INVALID_ARGUMENT, 'userId, type, title, message required');
    }
    const db = getDb();
    const doc = await db.notifications.insert({
      id: uuidv4(),
      userId,
      type,
      title,
      message,
      read: false,
      createdAt: new Date().toISOString()
    });
    logger.info('Notification created', { id: doc.id, userId, type });
    return toPlain(doc);
  },

  async getUserNotifications({ userId, limit = 50, unreadOnly = false }) {
    if (!userId) throw new ServiceError(grpc.status.INVALID_ARGUMENT, 'userId required');
    const db = getDb();
    const selector = unreadOnly ? { userId, read: false } : { userId };
    const docs = await db.notifications.find({
      selector,
      sort: [{ createdAt: 'desc' }],
      limit: Math.max(1, Math.min(limit, 500))
    }).exec();
    return docs.map(toPlain);
  },

  async markAsRead({ notificationId, userId }) {
    if (!notificationId) throw new ServiceError(grpc.status.INVALID_ARGUMENT, 'notificationId required');
    const db = getDb();
    const doc = await db.notifications.findOne({ selector: { id: notificationId } }).exec();
    if (!doc) throw new ServiceError(grpc.status.NOT_FOUND, 'Notification not found');
    if (userId && doc.userId !== userId) {
      throw new ServiceError(grpc.status.PERMISSION_DENIED, 'Not your notification');
    }
    const updated = await doc.patch({ read: true });
    return toPlain(updated);
  },

  async getUnreadCount(userId) {
    if (!userId) throw new ServiceError(grpc.status.INVALID_ARGUMENT, 'userId required');
    const db = getDb();
    const docs = await db.notifications.find({ selector: { userId, read: false } }).exec();
    return docs.length;
  },

  async isProcessed(eventId) {
    if (!eventId) return false;
    const db = getDb();
    const doc = await db.processed_events.findOne({ selector: { eventId } }).exec();
    return !!doc;
  },

  async markProcessed(eventId) {
    if (!eventId) return;
    const db = getDb();
    try {
      await db.processed_events.insert({ eventId, processedAt: new Date().toISOString() });
    } catch (err) {
      // duplicate insert => already processed, ignore
    }
  }
};

export { ServiceError };
