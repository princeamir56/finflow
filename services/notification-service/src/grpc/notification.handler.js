import grpc from '@grpc/grpc-js';
import { createLogger } from '@finflow/shared/logger';
import { notificationService } from '../services/notification.service.js';

const logger = createLogger('notification-service:grpc');

function wrap(handler) {
  return async (call, callback) => {
    try {
      await handler(call, callback);
    } catch (err) {
      logger.error('RPC failed', { method: handler.name, error: err.message });
      const code = typeof err.code === 'number' ? err.code : grpc.status.INTERNAL;
      callback({ code, message: err.message || 'Internal error' });
    }
  };
}

export const notificationHandler = {
  GetUserNotifications: wrap(async function GetUserNotifications(call, callback) {
    const { user_id, limit } = call.request;
    const notifications = await notificationService.getUserNotifications({
      userId: user_id,
      limit: limit && limit > 0 ? limit : 50
    });
    callback(null, { notifications });
  }),

  MarkAsRead: wrap(async function MarkAsRead(call, callback) {
    const { notification_id, user_id } = call.request;
    const notif = await notificationService.markAsRead({
      notificationId: notification_id,
      userId: user_id
    });
    callback(null, notif);
  }),

  GetUnreadCount: wrap(async function GetUnreadCount(call, callback) {
    const { user_id } = call.request;
    const count = await notificationService.getUnreadCount(user_id);
    callback(null, { count });
  })
};
