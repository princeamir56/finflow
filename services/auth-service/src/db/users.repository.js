import { db } from './connection.js';

const insertStmt = () =>
  db.prepare(
    `INSERT INTO users (id, email, password, full_name) VALUES (@id, @email, @password, @fullName)`
  );
const findByEmailStmt = () => db.prepare(`SELECT * FROM users WHERE email = ?`);
const findByIdStmt = () => db.prepare(`SELECT * FROM users WHERE id = ?`);

export const usersRepository = {
  create({ id, email, password, fullName }) {
    insertStmt().run({ id, email, password, fullName });
    return findByIdStmt().get(id);
  },
  findByEmail(email) {
    return findByEmailStmt().get(email);
  },
  findById(id) {
    return findByIdStmt().get(id);
  }
};
