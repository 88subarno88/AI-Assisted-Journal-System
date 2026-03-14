const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, 'journal.db');
let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
  }
  return db;
}

function initDb() {
  const database = getDb();
  database.exec(`
    CREATE TABLE IF NOT EXISTS journal_entries (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      userId    TEXT    NOT NULL,
      ambience  TEXT    NOT NULL,
      text      TEXT    NOT NULL,
      emotion   TEXT,
      keywords  TEXT,
      summary   TEXT,
      analyzed  INTEGER DEFAULT 0,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log('[DB] Initialized');
}

module.exports = { getDb, initDb };
