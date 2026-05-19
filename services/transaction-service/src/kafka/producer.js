import { Kafka } from 'kafkajs';
import { v4 as uuidv4 } from 'uuid';
import { createLogger } from '@finflow/shared/logger';
import { accountsRepository } from '../db/accounts.repository.js';

const logger = createLogger('transaction-service:kafka');

const brokers = (process.env.KAFKA_BROKERS || 'localhost:9092')
  .split(',')
  .map((b) => b.trim())
  .filter(Boolean);

const kafka = new Kafka({
  clientId: process.env.KAFKA_CLIENT_ID || 'transaction-service',
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

async function publish(topic, key, eventType, data) {
  const payload = envelope(eventType, data);
  try {
    await producer.send({
      topic,
      messages: [{ key, value: JSON.stringify(payload) }]
    });
    logger.info(`Published ${eventType}`, { key, eventId: payload.eventId });
  } catch (err) {
    logger.error(`Failed to publish ${eventType}`, { error: err.message, stack: err.stack });
  }
}

export async function publishAccountCreated(account) {
  await publish('account.created', account.id, 'account.created', {
    accountId: account.id,
    userId: account.user_id,
    iban: account.iban,
    currency: account.currency,
    balance: account.balance
  });
}

export async function publishTransactionCreated(tx) {
  const fromAcc = tx.from_account_id ? accountsRepository.findById(tx.from_account_id) : null;
  const toAcc = tx.to_account_id ? accountsRepository.findById(tx.to_account_id) : null;
  await publish('transaction.created', tx.id, 'transaction.created', {
    transactionId: tx.id,
    fromAccountId: tx.from_account_id,
    toAccountId: tx.to_account_id,
    fromUserId: fromAcc ? fromAcc.user_id : null,
    toUserId: toAcc ? toAcc.user_id : null,
    fromIban: fromAcc ? fromAcc.iban : null,
    toIban: toAcc ? toAcc.iban : null,
    currency: (fromAcc || toAcc) ? (fromAcc?.currency || toAcc?.currency) : null,
    amount: tx.amount,
    type: tx.type,
    status: tx.status,
    description: tx.description
  });
}
