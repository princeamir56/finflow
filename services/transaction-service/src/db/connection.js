import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { createLogger } from '@finflow/shared/logger';

const logger = createLogger('transaction-service:db');
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DATA_DIR = path.resolve(__dirname, '../../data');
const DB_PATH = path.join(DATA_DIR, 'banking.db');

fs.mkdirSync(DATA_DIR, { recursive: true });

export const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function migrate() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      iban TEXT NOT NULL UNIQUE,
      currency TEXT NOT NULL DEFAULT 'EUR',
      balance REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_accounts_user ON accounts(user_id);

    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      from_account_id TEXT,
      to_account_id TEXT,
      amount REAL NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('DEPOSIT','WITHDRAW','TRANSFER')),
      status TEXT NOT NULL DEFAULT 'COMPLETED',
      description TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (from_account_id) REFERENCES accounts(id),
      FOREIGN KEY (to_account_id) REFERENCES accounts(id)
    );
    CREATE INDEX IF NOT EXISTS idx_tx_from ON transactions(from_account_id);
    CREATE INDEX IF NOT EXISTS idx_tx_to ON transactions(to_account_id);
  `);
  logger.info('transaction-service migrations applied', { path: DB_PATH });
}
