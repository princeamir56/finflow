import grpc from '@grpc/grpc-js';
import { createLogger } from '@finflow/shared/logger';
import { transactionService } from '../services/transaction.service.js';

const logger = createLogger('transaction-service:grpc');

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

function normalizeTx(t) {
  return {
    id: t.id,
    from_account_id: t.from_account_id ?? '',
    to_account_id: t.to_account_id ?? '',
    amount: t.amount,
    type: t.type,
    status: t.status,
    description: t.description ?? '',
    created_at: t.created_at
  };
}

export const transactionHandler = {
  CreateAccount: wrap('CreateAccount', async (call) => {
    const { user_id, currency } = call.request;
    return transactionService.createAccount({ userId: user_id, currency });
  }),

  GetAccount: wrap('GetAccount', async (call) => {
    return transactionService.getAccount(call.request.account_id);
  }),

  GetUserAccounts: wrap('GetUserAccounts', async (call) => {
    return transactionService.getUserAccounts(call.request.user_id);
  }),

  Deposit: wrap('Deposit', async (call) => {
    const { account_id, amount, description } = call.request;
    const t = await transactionService.deposit({ accountId: account_id, amount, description });
    return normalizeTx(t);
  }),

  Withdraw: wrap('Withdraw', async (call) => {
    const { account_id, amount, description } = call.request;
    const t = await transactionService.withdraw({ accountId: account_id, amount, description });
    return normalizeTx(t);
  }),

  Transfer: wrap('Transfer', async (call) => {
    const { from_account_id, to_account_id, amount, description } = call.request;
    const t = await transactionService.transfer({
      fromAccountId: from_account_id,
      toAccountId: to_account_id,
      amount,
      description
    });
    return normalizeTx(t);
  }),

  GetHistory: wrap('GetHistory', async (call) => {
    const { account_id, limit, offset } = call.request;
    const { transactions } = transactionService.getHistory({ accountId: account_id, limit, offset });
    return { transactions: transactions.map(normalizeTx) };
  })
};
