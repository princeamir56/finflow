import { db } from './connection.js';

const insert = () =>
  db.prepare(
    `INSERT INTO transactions (id, from_account_id, to_account_id, amount, type, status, description)
     VALUES (@id, @from_account_id, @to_account_id, @amount, @type, @status, @description)`
  );
const byId = () => db.prepare(`SELECT * FROM transactions WHERE id = ?`);
const byAccount = () =>
  db.prepare(
    `SELECT * FROM transactions
     WHERE from_account_id = ? OR to_account_id = ?
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`
  );

export const transactionsRepository = {
  create(tx) {
    insert().run({
      id: tx.id,
      from_account_id: tx.from_account_id ?? null,
      to_account_id: tx.to_account_id ?? null,
      amount: tx.amount,
      type: tx.type,
      status: tx.status ?? 'COMPLETED',
      description: tx.description ?? null
    });
    return byId().get(tx.id);
  },
  findByAccountId(accountId, limit = 50, offset = 0) {
    return byAccount().all(accountId, accountId, limit, offset);
  }
};
