import { db } from './connection.js';

const insert = () =>
  db.prepare(
    `INSERT INTO accounts (id, user_id, iban, currency, balance) VALUES (@id, @userId, @iban, @currency, @balance)`
  );
const byId = () => db.prepare(`SELECT * FROM accounts WHERE id = ?`);
const byUser = () =>
  db.prepare(`SELECT * FROM accounts WHERE user_id = ? ORDER BY created_at ASC`);
const updateBal = () => db.prepare(`UPDATE accounts SET balance = ? WHERE id = ?`);

export const accountsRepository = {
  create({ id, userId, iban, currency, balance = 0 }) {
    insert().run({ id, userId, iban, currency, balance });
    return byId().get(id);
  },
  findById(id) {
    return byId().get(id);
  },
  findByUserId(userId) {
    return byUser().all(userId);
  },
  updateBalance(id, newBalance) {
    updateBal().run(newBalance, id);
    return byId().get(id);
  }
};
