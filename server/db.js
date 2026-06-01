import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const db = new Database(path.join(__dirname, 'stride.db'));

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    display_name TEXT NOT NULL,
    resting_hr_baseline INTEGER DEFAULT 60,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    distance REAL NOT NULL,
    duration_seconds INTEGER NOT NULL,
    pace_seconds INTEGER NOT NULL,
    elevation_gain INTEGER DEFAULT 0,
    calories INTEGER DEFAULT 0,
    avg_hr INTEGER DEFAULT 0,
    temperature INTEGER DEFAULT 0,
    wind_speed INTEGER DEFAULT 0,
    humidity INTEGER DEFAULT 0,
    difficulty REAL DEFAULT 5,
    run_type TEXT DEFAULT 'Easy',
    notes TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS races (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    date TEXT NOT NULL,
    distance TEXT NOT NULL,
    official_time TEXT NOT NULL,
    time_seconds INTEGER NOT NULL,
    placement TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    photo_url TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS recovery (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    sleep_hours REAL DEFAULT 8,
    resting_hr INTEGER DEFAULT 60,
    soreness INTEGER DEFAULT 5,
    mood INTEGER DEFAULT 3,
    hydration INTEGER DEFAULT 6,
    score INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS goals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    raw_text TEXT NOT NULL,
    race_distance TEXT,
    target_pace_seconds INTEGER,
    target_date TEXT,
    weeks_remaining INTEGER,
    plan_json TEXT,
    prediction_json TEXT,
    active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`);

export default db;
