import { Kafka } from 'kafkajs';
import { createLogger } from '@finflow/shared/logger';
import { notificationService } from '../services/notification.service.js';

const logger = createLogger('notification-service:kafka');

const brokers = (process.env.KAFKA_BROKERS || 'localhost:9092')
  .split(',')
  .map((b) => b.trim())
  .filter(Boolean);

const kafka = new Kafka({
  clientId: process.env.KAFKA_CLIENT_ID || 'notification-service',
  brokers
});

const consumer = kafka.consumer({
  groupId: process.env.KAFKA_GROUP_ID || 'notification-service-group'
});

const TOPICS = ['user.registered', 'account.created', 'transaction.created'];

async function handleEvent(eventType, data) {
  switch (eventType) {
    case 'user.registered':
      await notificationService.createNotification({
        userId: data.userId,
        type: 'WELCOME',
        title: 'Welcome to FinFlow!',
        message: `Hi ${data.fullName || data.email || 'there'}, your account is ready.`
      });
      break;

    case 'account.created':
      await notificationService.createNotification({
        userId: data.userId,
        type: 'ACCOUNT_CREATED',
        title: 'New account created',
        message: `Your ${data.currency} account ${data.iban} is now active.`
      });
      break;

    case 'transaction.created': {
      const amount = data.amount;
      const cur = data.currency || '';
      if (data.type === 'DEPOSIT' && data.toUserId) {
        await notificationService.createNotification({
          userId: data.toUserId,
          type: 'DEPOSIT',
          title: 'Deposit received',
          message: `You received a deposit of ${amount} ${cur}.`
        });
      } else if (data.type === 'WITHDRAW' && data.fromUserId) {
        await notificationService.createNotification({
          userId: data.fromUserId,
          type: 'WITHDRAW',
          title: 'Withdrawal completed',
          message: `You withdrew ${amount} ${cur}.`
        });
      } else if (data.type === 'TRANSFER') {
        if (data.fromUserId) {
          await notificationService.createNotification({
            userId: data.fromUserId,
            type: 'TRANSFER_DEBIT',
            title: 'Transfer sent',
            message: `You sent ${amount} ${cur} to ${data.toIban || 'another account'}.`
          });
        }
        if (data.toUserId && data.toUserId !== data.fromUserId) {
          await notificationService.createNotification({
            userId: data.toUserId,
            type: 'TRANSFER_CREDIT',
            title: 'Transfer received',
            message: `You received ${amount} ${cur} from ${data.fromIban || 'another account'}.`
          });
        }
      }
      break;
    }

    default:
      logger.warn('Unknown eventType', { eventType });
  }
}

export async function startConsumer() {
  await consumer.connect();
  for (const topic of TOPICS) {
    await consumer.subscribe({ topic, fromBeginning: false });
  }
  logger.info('Kafka consumer subscribed', { topics: TOPICS, brokers });

  await consumer.run({
    eachMessage: async ({ topic, message }) => {
      const raw = message.value?.toString();
      if (!raw) return;
      let envelope;
      try {
        envelope = JSON.parse(raw);
      } catch (err) {
        logger.error('Invalid JSON message', { topic, error: err.message });
        return;
      }
      const { eventId, eventType, data } = envelope;
      try {
        if (eventId && (await notificationService.isProcessed(eventId))) {
          logger.debug('Skipping duplicate event', { eventId });
          return;
        }
        await handleEvent(eventType || topic, data || {});
        if (eventId) await notificationService.markProcessed(eventId);
      } catch (err) {
        logger.error('Failed to handle event', {
          topic, eventType, eventId, error: err.message, stack: err.stack
        });
      }
    }
  });
}

export async function stopConsumer() {
  try {
    await consumer.disconnect();
    logger.info('Kafka consumer disconnected');
  } catch (err) {
    logger.error('Error disconnecting consumer', { error: err.message });
  }
}
