import { v4 as uuidv4 } from 'uuid';
import grpc from '@grpc/grpc-js';
import { createLogger } from '@finflow/shared/logger';
import { db } from '../db/connection.js';
import { accountsRepository } from '../db/accounts.repository.js';
import { transactionsRepository } from '../db/transactions.repository.js';
import { publishAccountCreated, publishTransactionCreated } from '../kafka/producer.js';

const logger = createLogger('transaction-service:svc');

class ServiceError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

function validAmount(amount) {
  return typeof amount === 'number' && Number.isFinite(amount) && amount > 0;
}

function generateIban() {
  // FR76 + 18 digits sourced from a UUID (collision-resistant)
  const digits = uuidv4().replace(/\D/g, '').padEnd(18, '0').slice(0, 18);
  return `FR76${digits}`;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

export const transactionService = {
  async createAccount({ userId, currency }) {
    if (!userId) {
      throw new ServiceError(grpc.status.INVALID_ARGUMENT, 'user_id is required');
    }
    const cur = (currency || 'EUR').toUpperCase();
    const id = uuidv4();
    const iban = generateIban();
    const account = accountsRepository.create({
      id,
      userId,
      iban,
      currency: cur,
      balance: 0
    });
    logger.info('Account created', { accountId: id, userId, iban });
    await publishAccountCreated(account);
    return account;
  },

  getAccount(accountId) {
    if (!accountId) {
      throw new ServiceError(grpc.status.INVALID_ARGUMENT, 'account_id is required');
    }
    const a = accountsRepository.findById(accountId);
    if (!a) throw new ServiceError(grpc.status.NOT_FOUND, 'Account not found');
    return a;
  },

  getUserAccounts(userId) {
    if (!userId) {
      throw new ServiceError(grpc.status.INVALID_ARGUMENT, 'user_id is required');
    }
    return { accounts: accountsRepository.findByUserId(userId) };
  },

  async deposit({ accountId, amount, description }) {
    if (!validAmount(amount)) {
      throw new ServiceError(grpc.status.INVALID_ARGUMENT, 'Amount must be a positive finite number');
    }
    const account = accountsRepository.findById(accountId);
    if (!account) throw new ServiceError(grpc.status.NOT_FOUND, 'Account not found');

    const txId = uuidv4();
    const result = db.transaction(() => {
      accountsRepository.updateBalance(accountId, round2(account.balance + amount));
      return transactionsRepository.create({
        id: txId,
        from_account_id: null,
        to_account_id: accountId,
        amount,
        type: 'DEPOSIT',
        status: 'COMPLETED',
        description: description ?? null
      });
    })();

    logger.info('Deposit completed', { accountId, amount, txId });
    await publishTransactionCreated(result);
    return result;
  },

  async withdraw({ accountId, amount, description }) {
    if (!validAmount(amount)) {
      throw new ServiceError(grpc.status.INVALID_ARGUMENT, 'Amount must be a positive finite number');
    }
    const account = accountsRepository.findById(accountId);
    if (!account) throw new ServiceError(grpc.status.NOT_FOUND, 'Account not found');
    if (account.balance < amount) {
      throw new ServiceError(grpc.status.FAILED_PRECONDITION, 'Insufficient funds');
    }

    const txId = uuidv4();
    const result = db.transaction(() => {
      accountsRepository.updateBalance(accountId, round2(account.balance - amount));
      return transactionsRepository.create({
        id: txId,
        from_account_id: accountId,
        to_account_id: null,
        amount,
        type: 'WITHDRAW',
        status: 'COMPLETED',
        description: description ?? null
      });
    })();

    logger.info('Withdraw completed', { accountId, amount, txId });
    await publishTransactionCreated(result);
    return result;
  },

  async transfer({ fromAccountId, toAccountId, amount, description }) {
    if (!validAmount(amount)) {
      throw new ServiceError(grpc.status.INVALID_ARGUMENT, 'Amount must be a positive finite number');
    }
    if (!fromAccountId || !toAccountId) {
      throw new ServiceError(grpc.status.INVALID_ARGUMENT, 'Both account ids required');
    }
    if (fromAccountId === toAccountId) {
      throw new ServiceError(grpc.status.INVALID_ARGUMENT, 'Cannot transfer to the same account');
    }

    const txId = uuidv4();
    const result = db.transaction(() => {
      const from = accountsRepository.findById(fromAccountId);
      if (!from) throw new ServiceError(grpc.status.NOT_FOUND, 'Source account not found');
      const to = accountsRepository.findById(toAccountId);
      if (!to) throw new ServiceError(grpc.status.NOT_FOUND, 'Destination account not found');
      if (from.balance < amount) {
        throw new ServiceError(grpc.status.FAILED_PRECONDITION, 'Insufficient funds');
      }
      accountsRepository.updateBalance(fromAccountId, round2(from.balance - amount));
      accountsRepository.updateBalance(toAccountId, round2(to.balance + amount));
      return transactionsRepository.create({
        id: txId,
        from_account_id: fromAccountId,
        to_account_id: toAccountId,
        amount,
        type: 'TRANSFER',
        status: 'COMPLETED',
        description: description ?? null
      });
    })();

    logger.info('Transfer completed', { fromAccountId, toAccountId, amount, txId });
    await publishTransactionCreated(result);
    return result;
  },

  getHistory({ accountId, limit, offset }) {
    if (!accountId) {
      throw new ServiceError(grpc.status.INVALID_ARGUMENT, 'account_id is required');
    }
    const lim = Number.isInteger(limit) && limit > 0 ? limit : 50;
    const off = Number.isInteger(offset) && offset >= 0 ? offset : 0;
    const transactions = transactionsRepository.findByAccountId(accountId, lim, off);
    return { transactions };
  }
};

export { ServiceError };
