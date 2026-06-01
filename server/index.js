// ---------------------------------------------------------------------------
// Startup crash logging. These MUST be registered before anything heavy is
// loaded. Note: a try/catch in this file's body would NOT catch errors thrown
// while ./db.js (which loads the native better-sqlite3 binding) is imported,
// because static ESM imports are evaluated before the module body runs. So we
// (a) register process-level handlers here, and (b) load everything via
// dynamic import() inside a guarded start() below.
// ---------------------------------------------------------------------------
process.on('uncaughtException', (err) => {
  console.error('[stride] FATAL uncaughtException:', err);
  process.exit(1);
});
process.on('unhandledRejection', (err) => {
  console.error('[stride] FATAL unhandledRejection:', err);
  process.exit(1);
});

// ---------- helpers (no external deps, safe at module scope) ----------
function publicUser(u) {
  return { id: u.id, email: u.email, display_name: u.display_name, resting_hr_baseline: u.resting_hr_baseline };
}

const RUN_FIELDS = ['date', 'distance', 'duration_seconds', 'pace_seconds', 'elevation_gain',
  'calories', 'avg_hr', 'temperature', 'wind_speed', 'humidity', 'difficulty', 'run_type', 'notes'];

async function start() {
  try {
    const { default: express } = await import('express');
    const { default: cors } = await import('cors');
    const { default: bcrypt } = await import('bcryptjs');
    const { default: db } = await import('./db.js');
    const { signToken, authMiddleware } = await import('./auth.js');
    const { seedDemo } = await import('./seed.js');

    try {
      seedDemo();
    } catch (err) {
      // Seeding must never take down the server; log and continue.
      console.error('[stride] Demo seed failed (continuing without it):', err);
    }

    const app = express();
    app.use(cors());
    app.use(express.json({ limit: '2mb' }));

    app.get('/health', (req, res) => res.json({ ok: true }));

    // ---------- AUTH ----------
    app.post('/auth/signup', (req, res) => {
      const { email, password, display_name } = req.body || {};
      if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
      if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
      const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
      if (existing) return res.status(409).json({ error: 'An account with that email already exists' });
      const hash = bcrypt.hashSync(password, 10);
      const name = (display_name && display_name.trim()) || email.split('@')[0];
      const info = db.prepare('INSERT INTO users (email, password_hash, display_name) VALUES (?, ?, ?)')
        .run(email.toLowerCase(), hash, name);
      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
      res.json({ token: signToken(user), user: publicUser(user) });
    });

    app.post('/auth/login', (req, res) => {
      const { email, password } = req.body || {};
      if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
      const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());
      if (!user || !bcrypt.compareSync(password, user.password_hash)) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }
      res.json({ token: signToken(user), user: publicUser(user) });
    });

    // everything below requires auth
    app.use(authMiddleware);

    app.get('/me', (req, res) => {
      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
      if (!user) return res.status(404).json({ error: 'User not found' });
      res.json({ user: publicUser(user) });
    });

    app.put('/me', (req, res) => {
      const { display_name, resting_hr_baseline } = req.body || {};
      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
      if (!user) return res.status(404).json({ error: 'User not found' });
      db.prepare('UPDATE users SET display_name = ?, resting_hr_baseline = ? WHERE id = ?').run(
        display_name?.trim() || user.display_name,
        Number.isFinite(+resting_hr_baseline) ? +resting_hr_baseline : user.resting_hr_baseline,
        req.user.id
      );
      const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
      res.json({ user: publicUser(updated) });
    });

    // ---------- RUNS ----------
    app.get('/runs', (req, res) => {
      const runs = db.prepare('SELECT * FROM runs WHERE user_id = ? ORDER BY date DESC, id DESC').all(req.user.id);
      res.json(runs);
    });

    app.get('/runs/:id', (req, res) => {
      const run = db.prepare('SELECT * FROM runs WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
      if (!run) return res.status(404).json({ error: 'Run not found' });
      res.json(run);
    });

    app.post('/runs', (req, res) => {
      const b = req.body || {};
      if (!b.date || !(b.distance > 0)) return res.status(400).json({ error: 'Date and distance are required' });
      const info = db.prepare(`INSERT INTO runs
        (user_id, date, distance, duration_seconds, pace_seconds, elevation_gain, calories, avg_hr, temperature, wind_speed, humidity, difficulty, run_type, notes)
        VALUES (@user_id, @date, @distance, @duration_seconds, @pace_seconds, @elevation_gain, @calories, @avg_hr, @temperature, @wind_speed, @humidity, @difficulty, @run_type, @notes)`)
        .run({
          user_id: req.user.id,
          date: b.date,
          distance: +b.distance || 0,
          duration_seconds: +b.duration_seconds || 0,
          pace_seconds: +b.pace_seconds || 0,
          elevation_gain: +b.elevation_gain || 0,
          calories: +b.calories || 0,
          avg_hr: +b.avg_hr || 0,
          temperature: +b.temperature || 0,
          wind_speed: +b.wind_speed || 0,
          humidity: +b.humidity || 0,
          difficulty: +b.difficulty || 5,
          run_type: b.run_type || 'Easy',
          notes: b.notes || ''
        });
      res.json(db.prepare('SELECT * FROM runs WHERE id = ?').get(info.lastInsertRowid));
    });

    app.put('/runs/:id', (req, res) => {
      const run = db.prepare('SELECT * FROM runs WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
      if (!run) return res.status(404).json({ error: 'Run not found' });
      const b = req.body || {};
      const merged = {};
      for (const f of RUN_FIELDS) merged[f] = b[f] !== undefined ? b[f] : run[f];
      db.prepare(`UPDATE runs SET
        date=@date, distance=@distance, duration_seconds=@duration_seconds, pace_seconds=@pace_seconds,
        elevation_gain=@elevation_gain, calories=@calories, avg_hr=@avg_hr, temperature=@temperature,
        wind_speed=@wind_speed, humidity=@humidity, difficulty=@difficulty, run_type=@run_type, notes=@notes
        WHERE id=@id AND user_id=@user_id`)
        .run({ ...merged, id: run.id, user_id: req.user.id });
      res.json(db.prepare('SELECT * FROM runs WHERE id = ?').get(run.id));
    });

    app.delete('/runs/:id', (req, res) => {
      const info = db.prepare('DELETE FROM runs WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
      if (!info.changes) return res.status(404).json({ error: 'Run not found' });
      res.json({ ok: true });
    });

    // ---------- RACES ----------
    app.get('/races', (req, res) => {
      res.json(db.prepare('SELECT * FROM races WHERE user_id = ? ORDER BY date DESC, id DESC').all(req.user.id));
    });

    app.post('/races', (req, res) => {
      const b = req.body || {};
      if (!b.name || !b.date || !b.distance) return res.status(400).json({ error: 'Name, date and distance are required' });
      const info = db.prepare(`INSERT INTO races
        (user_id, name, date, distance, official_time, time_seconds, placement, notes, photo_url)
        VALUES (@user_id, @name, @date, @distance, @official_time, @time_seconds, @placement, @notes, @photo_url)`)
        .run({
          user_id: req.user.id,
          name: b.name,
          date: b.date,
          distance: b.distance,
          official_time: b.official_time || '',
          time_seconds: +b.time_seconds || 0,
          placement: b.placement || '',
          notes: b.notes || '',
          photo_url: b.photo_url || ''
        });
      res.json(db.prepare('SELECT * FROM races WHERE id = ?').get(info.lastInsertRowid));
    });

    app.delete('/races/:id', (req, res) => {
      const info = db.prepare('DELETE FROM races WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
      if (!info.changes) return res.status(404).json({ error: 'Race not found' });
      res.json({ ok: true });
    });

    // ---------- RECOVERY ----------
    app.get('/recovery', (req, res) => {
      res.json(db.prepare('SELECT * FROM recovery WHERE user_id = ? ORDER BY date DESC, id DESC').all(req.user.id));
    });

    app.post('/recovery', (req, res) => {
      const b = req.body || {};
      if (!b.date) return res.status(400).json({ error: 'Date is required' });
      const info = db.prepare(`INSERT INTO recovery
        (user_id, date, sleep_hours, resting_hr, soreness, mood, hydration, score)
        VALUES (@user_id, @date, @sleep_hours, @resting_hr, @soreness, @mood, @hydration, @score)`)
        .run({
          user_id: req.user.id,
          date: b.date,
          sleep_hours: +b.sleep_hours || 0,
          resting_hr: +b.resting_hr || 0,
          soreness: +b.soreness || 5,
          mood: +b.mood || 3,
          hydration: +b.hydration || 0,
          score: +b.score || 0
        });
      res.json(db.prepare('SELECT * FROM recovery WHERE id = ?').get(info.lastInsertRowid));
    });

    // ---------- GOALS ----------
    app.get('/goals', (req, res) => {
      const goal = db.prepare('SELECT * FROM goals WHERE user_id = ? AND active = 1 ORDER BY id DESC LIMIT 1').get(req.user.id);
      res.json(goal || null);
    });

    app.post('/goals', (req, res) => {
      const b = req.body || {};
      if (!b.raw_text) return res.status(400).json({ error: 'Goal text is required' });
      // deactivate previous goals
      db.prepare('UPDATE goals SET active = 0 WHERE user_id = ?').run(req.user.id);
      const info = db.prepare(`INSERT INTO goals
        (user_id, raw_text, race_distance, target_pace_seconds, target_date, weeks_remaining, plan_json, prediction_json, active)
        VALUES (@user_id, @raw_text, @race_distance, @target_pace_seconds, @target_date, @weeks_remaining, @plan_json, @prediction_json, 1)`)
        .run({
          user_id: req.user.id,
          raw_text: b.raw_text,
          race_distance: b.race_distance || null,
          target_pace_seconds: b.target_pace_seconds || null,
          target_date: b.target_date || null,
          weeks_remaining: b.weeks_remaining || null,
          plan_json: b.plan_json ? JSON.stringify(b.plan_json) : null,
          prediction_json: b.prediction_json ? JSON.stringify(b.prediction_json) : null
        });
      res.json(db.prepare('SELECT * FROM goals WHERE id = ?').get(info.lastInsertRowid));
    });

    // ---------- ANALYTICS ----------
    app.get('/analytics/summary', (req, res) => {
      const runs = db.prepare('SELECT * FROM runs WHERE user_id = ?').all(req.user.id);
      const totalRuns = runs.length;
      const totalMiles = runs.reduce((s, r) => s + r.distance, 0);
      const totalSeconds = runs.reduce((s, r) => s + r.duration_seconds, 0);
      const avgPace = totalMiles > 0 ? Math.round(totalSeconds / totalMiles) : 0;
      res.json({ totalRuns, totalMiles: +totalMiles.toFixed(2), totalSeconds, avgPace });
    });

    // Express error handler — logs any thrown error in a route.
    app.use((err, req, res, next) => {
      console.error('[stride] Request error:', err);
      if (res.headersSent) return next(err);
      res.status(500).json({ error: 'Internal server error' });
    });

    // Railway (and most PaaS) inject PORT. Must bind to it, on all interfaces.
    const PORT = process.env.PORT || 4000;
    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`[stride] API listening on 0.0.0.0:${PORT}`);
    });
    server.on('error', (err) => {
      console.error('[stride] HTTP server error:', err);
      process.exit(1);
    });
  } catch (err) {
    console.error('[stride] FATAL startup error:', err);
    process.exit(1);
  }
}

start();
