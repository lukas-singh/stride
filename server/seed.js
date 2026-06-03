import bcrypt from 'bcryptjs';
import { get, run } from './db.js';

// Idempotent demo seeding — runs on server boot. Creates demo@stride.app
// with ~30 days of realistic run data so the app looks alive immediately.

const DEMO_EMAIL = 'demo@stride.app';
const DEMO_PASSWORD = 'stride123';

function pad(n) { return String(n).padStart(2, '0'); }
function isoDate(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function rand(min, max) { return Math.random() * (max - min) + min; }
function randInt(min, max) { return Math.floor(rand(min, max + 1)); }

const WEATHERS = ['Sunny', 'Sunny', 'Partly Cloudy', 'Cloudy', 'Rainy', 'Stormy', 'Snowy'];

const RUN_SQL = `INSERT INTO runs
  (user_id, date, distance, duration_seconds, pace_seconds, elevation_gain, calories, avg_hr, temperature, wind_speed, humidity, difficulty, run_type, weather_condition, notes)
  VALUES (@user_id, @date, @distance, @duration_seconds, @pace_seconds, @elevation_gain, @calories, @avg_hr, @temperature, @wind_speed, @humidity, @difficulty, @run_type, @weather_condition, @notes)`;

const RACE_SQL = `INSERT INTO races
  (user_id, name, date, distance, official_time, time_seconds, placement, notes, photo_url)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;

const REC_SQL = `INSERT INTO recovery
  (user_id, date, sleep_hours, resting_hr, soreness, mood, hydration, score)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;

export async function seedDemo() {
  const existing = await get('SELECT * FROM users WHERE email = ?', [DEMO_EMAIL]);
  if (existing) return; // already seeded

  const hash = bcrypt.hashSync(DEMO_PASSWORD, 10);
  const info = await run('INSERT INTO users (email, password_hash, display_name, resting_hr_baseline) VALUES (?, ?, ?, ?)',
    [DEMO_EMAIL, hash, 'Alex', 52]);
  const userId = info.lastInsertRowid;

  const today = new Date();
  // Generate ~22 runs over the last 30 days (rest days mixed in). Slight pace
  // improvement trend over time to make the Coach engine interesting.
  for (let dayOffset = 30; dayOffset >= 0; dayOffset--) {
    // ~70% chance of a run on any given day
    if (Math.random() > 0.72) continue;
    const d = new Date(today);
    d.setDate(today.getDate() - dayOffset);
    const dow = d.getDay();

    let type = 'Easy';
    let distance, basePace;
    if (dow === 0 || dow === 6) { type = 'Long Run'; distance = rand(7, 11); }
    else if (dow === 3) { type = 'Tempo'; distance = rand(4, 6); }
    else if (dow === 2) { type = 'Interval'; distance = rand(3, 5); }
    else { type = Math.random() > 0.7 ? 'Recovery' : 'Easy'; distance = rand(3, 5.5); }

    distance = +distance.toFixed(2);

    // base pace ~ 8:40/mi improving to ~8:10/mi over the month
    const improvement = (30 - dayOffset) * 1.0; // seconds faster per day
    basePace = 520 - improvement; // seconds per mile baseline
    if (type === 'Tempo') basePace -= 35;
    else if (type === 'Interval') basePace -= 50;
    else if (type === 'Long Run') basePace += 25;
    else if (type === 'Recovery') basePace += 45;
    basePace += rand(-12, 12);
    const paceSeconds = Math.round(basePace);
    const durationSeconds = Math.round(paceSeconds * distance);

    const difficulty = type === 'Interval' ? rand(7, 9)
      : type === 'Tempo' ? rand(6, 8)
      : type === 'Long Run' ? rand(5, 7.5)
      : rand(2.5, 5);

    const temperature = randInt(42, 78);
    const humidity = randInt(35, 85);
    // weather loosely correlated with the conditions for realism
    let weather;
    if (temperature < 45) weather = Math.random() > 0.5 ? 'Snowy' : 'Cloudy';
    else if (humidity > 75) weather = Math.random() > 0.5 ? 'Rainy' : 'Stormy';
    else weather = WEATHERS[randInt(0, WEATHERS.length - 1)];

    await run(RUN_SQL, {
      user_id: userId,
      date: isoDate(d),
      distance,
      duration_seconds: durationSeconds,
      pace_seconds: paceSeconds,
      elevation_gain: type === 'Long Run' ? randInt(150, 600) : randInt(0, 250),
      calories: Math.round(distance * randInt(95, 120)),
      avg_hr: type === 'Interval' ? randInt(165, 182) : type === 'Recovery' ? randInt(125, 145) : randInt(145, 168),
      temperature,
      wind_speed: randInt(0, 18),
      humidity,
      difficulty: +(Math.round(difficulty * 2) / 2).toFixed(1),
      run_type: type,
      weather_condition: weather,
      notes: '',
    });
  }

  // A couple of races
  const r1 = new Date(today); r1.setDate(today.getDate() - 21);
  const r2 = new Date(today); r2.setDate(today.getDate() - 75);
  await run(RACE_SQL, [userId, 'Riverside Spring 10K', isoDate(r1), '10K', '52:14', 3134, '42 / 410', 'Negative split, felt strong.', '']);
  await run(RACE_SQL, [userId, 'Harbor 5K Dash', isoDate(r2), '5K', '24:48', 1488, '12 / 230', 'New 5K PR!', '']);

  // A few recovery entries
  for (let i = 12; i >= 0; i--) {
    const d = new Date(today); d.setDate(today.getDate() - i);
    const sleep = +rand(5.5, 8.5).toFixed(1);
    const rhr = randInt(48, 60);
    const soreness = randInt(2, 7);
    const mood = randInt(2, 5);
    const sleepScore = sleep >= 7 && sleep <= 9 ? 100 : Math.max(0, 100 - Math.abs(8 - sleep) * 18);
    const hrScore = Math.max(0, Math.min(100, 100 - (rhr - 52) * 4));
    const soreScore = (10 - soreness) / 9 * 100;
    const moodScore = (mood - 1) / 4 * 100;
    const score = Math.round(sleepScore * 0.4 + hrScore * 0.2 + soreScore * 0.2 + moodScore * 0.2);
    await run(REC_SQL, [userId, isoDate(d), sleep, rhr, soreness, mood, randInt(4, 10), score]);
  }

  console.log(`Seeded demo account: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
}

// Allow `npm run seed` to invoke directly.
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('seed.js')) {
  await seedDemo();
}
