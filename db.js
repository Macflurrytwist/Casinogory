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
  discord_id TEXT,
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

CREATE TABLE IF NOT EXISTS link_codes (
  code TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS ngram_cache (
  word TEXT PRIMARY KEY,
  historic_rarity INTEGER,
  avg_frequency REAL,
  fetched_at TEXT
);
`);

// --- Migration step for databases created before Discord linking and
// leaderboard support existed ---
// CREATE TABLE IF NOT EXISTS only runs for brand-new tables; it silently
// does nothing to a `users` or `submissions` table that already exists
// from an earlier deploy, so newer columns need to be added explicitly
// here. Safe to run on every boot — each check is a no-op once the
// column already exists.
function columnExists(table, column) {
  return db.prepare(`PRAGMA table_info(${table})`).all().some(c => c.name === column);
}

if (!columnExists("users", "discord_id")) {
  db.exec(`ALTER TABLE users ADD COLUMN discord_id TEXT`);
}
db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_discord_id ON users(discord_id)`);

["daily_points_total", "historic_points_total", "slang_points_total"].forEach(col => {
  if (!columnExists("submissions", col)) {
    db.exec(`ALTER TABLE submissions ADD COLUMN ${col} INTEGER DEFAULT 0`);
  }
});

module.exports = db;
