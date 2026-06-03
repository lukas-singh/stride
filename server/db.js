import { createClient } from '@libsql/client';

// Turso (libsql) in production; a local SQLite file in development.
// If TURSO_DATABASE_URL is unset we fall back to a local file so the app
// still runs without any Turso credentials.
const url = process.env.TURSO_DATABASE_URL || 'file:./stride.db';
const authToken = process.env.TURSO_AUTH_TOKEN;

console.log('[stride] TURSO_DATABASE_URL:', process.env.TURSO_DATABASE_URL ? 'SET' : 'NOT SET');
console.log('[stride] TURSO_AUTH_TOKEN:', process.env.TURSO_AUTH_TOKEN ? 'SET (length=' + process.env.TURSO_AUTH_TOKEN.length + ')' : 'NOT SET');

const db = createClient(authToken ? { url, authToken } : { url });

// Schema — identical to the previous better-sqlite3 schema.
await db.executeMultiple(`
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
    weather_condition TEXT DEFAULT '',
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

// Lightweight migration for databases created before weather_condition existed.
const runCols = (await db.execute('PRAGMA table_info(runs)')).rows.map((r) => r.name);
if (!runCols.includes('weather_condition')) {
  await db.execute("ALTER TABLE runs ADD COLUMN weather_condition TEXT DEFAULT ''");
}

// --- query helpers ---------------------------------------------------------
// libsql rows support index + name access; build plain objects so JSON
// responses are clean regardless of the driver's Row internals.
function toObjects(result) {
  const cols = result.columns;
  return result.rows.map((r) => {
    const o = {};
    for (let i = 0; i < cols.length; i++) o[cols[i]] = r[i];
    return o;
  });
}

// SELECT -> array of plain objects
export async function all(sql, args = []) {
  const result = await db.execute({ sql, args });
  return toObjects(result);
}

// SELECT -> first plain object (or undefined)
export async function get(sql, args = []) {
  const rows = await all(sql, args);
  return rows[0];
}

// INSERT/UPDATE/DELETE -> { lastInsertRowid:Number, changes:Number }
export async function run(sql, args = []) {
  const result = await db.execute({ sql, args });
  return {
    lastInsertRowid: result.lastInsertRowid != null ? Number(result.lastInsertRowid) : null,
    changes: result.rowsAffected,
  };
}

export default db;
