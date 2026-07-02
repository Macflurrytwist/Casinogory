// db.js
// Uses better-sqlite3 (synchronous, file-based). Run `npm install` before
// starting the server — see README.md.
const Database = require("better-sqlite3");
const path = require("path");

// Override with DB_PATH when deploying somewhere with a persistent disk
// mounted at a specific path (e.g. Render's disk feature) — otherwise
// the SQLite file lives next to this script and will be wiped on any
// redeploy that doesn't preserve the filesystem.
const dbPath = process.env.DB_PATH || path.join(__dirname, "rarity_ledger.db");
const db = new Database(dbPath);
db.pragma("journal_mode = WAL");

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  last_login_date TEXT,
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  unlocked_perks TEXT DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  date TEXT NOT NULL,
  word_length INTEGER NOT NULL,
  word TEXT NOT NULL,
  word_rarity_daily INTEGER,
  word_rarity_historic INTEGER,
  categories_json TEXT,
  answers_json TEXT,
  score_breakdown_json TEXT,
  daily_points_total INTEGER DEFAULT 0,
  historic_points_total INTEGER DEFAULT 0,
  slang_points_total INTEGER DEFAULT 0,
  total_score INTEGER,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, date, word_length),
  FOREIGN KEY(user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_submissions_date_length ON submissions(date, word_length);
CREATE INDEX IF NOT EXISTS idx_submissions_user ON submissions(user_id);

CREATE TABLE IF NOT EXISTS ngram_cache (
  word TEXT PRIMARY KEY,
  historic_rarity INTEGER,
  avg_frequency REAL,
  fetched_at TEXT
);
`);

module.exports = db;
