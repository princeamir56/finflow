import { Kafka } from 'kafkajs';
import { v4 as uuidv4 } from 'uuid';
import { createLogger } from '@finflow/shared/logger';

const logger = createLogger('auth-service:kafka');

const brokers = (process.env.KAFKA_BROKERS || 'localhost:9092')
  .split(',')
  .map((b) => b.trim())
  .filter(Boolean);

const kafka = new Kafka({
  clientId: process.env.KAFKA_CLIENT_ID || 'auth-service',
  brokers
});

const producer = kafka.producer({ allowAutoTopicCreation: true });
let connected = false;

export async function connectProducer() {
  if (connected) return;
  await producer.connect();
  connected = true;
  logger.info('Kafka producer connected', { brokers });
}

export async function disconnectProducer() {
  if (!connected) return;
  await producer.disconnect();
  connected = false;
  logger.info('Kafka producer disconnected');
}

function envelope(eventType, data) {
  return {
    eventId: uuidv4(),
    eventType,
    timestamp: new Date().toISOString(),
    version: '1.0',
    data
  };
}

export async function publishUserRegistered(user) {
  const payload = envelope('user.registered', {
    userId: user.id,
    email: user.email,
    fullName: user.full_name
  });
  try {
    await producer.send({
      topic: 'user.registered',
      messages: [{ key: user.id, value: JSON.stringify(payload) }]
    });
    logger.info('Published user.registered', { userId: user.id, eventId: payload.eventId });
  } catch (err) {
    logger.error('Failed to publish user.registered', { error: err.message, stack: err.stack });
  }
}
