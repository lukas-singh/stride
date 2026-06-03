// ---------------------------------------------------------------------------
// Startup crash logging. These MUST be registered before anything heavy is
// loaded. Note: a try/catch in this file's body would NOT catch errors thrown
// while ./db.js is imported (it connects to libsql and runs schema setup with
// top-level await), because static ESM imports are evaluated before the module
// body runs. So we (a) register process-level handlers here, and (b) load
// everything via dynamic import() inside a guarded start() below.
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

// Wrap async route handlers so a rejected promise (e.g. a DB error) is routed
// to the Express error handler instead of becoming an unhandledRejection.
const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const RUN_FIELDS = ['date', 'distance', 'duration_seconds', 'pace_seconds', 'elevation_gain',
  'calories', 'avg_hr', 'temperature', 'wind_speed', 'humidity', 'difficulty', 'run_type',
  'weather_condition', 'notes'];

async function start() {
  try {
    const { default: express } = await import('express');
    const { default: cors } = await import('cors');
    const { default: bcrypt } = await import('bcryptjs');
    // libsql query helpers (async): get -> one row, all -> rows, run -> write
    const { get, all, run } = await import('./db.js');
    const { signToken, authMiddleware, JWT_SECRET_FP, JWT_SECRET_SOURCE } = await import('./auth.js');
    const { seedDemo } = await import('./seed.js');

    try {
      await seedDemo();
    } catch (err) {
      // Seeding must never take down the server; log and continue.
      console.error('[stride] Demo seed failed (continuing without it):', err);
    }

    const app = express();
    app.use(cors());
    app.use(express.json({ limit: '2mb' }));

    // The client prefixes every request with "/api". In dev the Vite proxy
    // strips that prefix; in production there is no proxy, so we normalize it
    // here. Without this, "/api/auth/login" never matches the "/auth/login"
    // route and instead falls through to the catch-all authMiddleware below,
    // which 401s the (token-less) login request — surfacing on the client as
    // "Session expired. Please log in again." for every login and signup.
    app.use((req, res, next) => {
      if (req.url === '/api') req.url = '/';
      else if (req.url.startsWith('/api/')) req.url = req.url.slice(4);
      next();
    });

    app.get('/health', (req, res) => res.json({ ok: true }));

    // ---------- AUTH ----------
    app.post('/auth/signup', ah(async (req, res) => {
      const { email, password, display_name } = req.body || {};
      if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
      if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
      const existing = await get('SELECT id FROM users WHERE email = ?', [email.toLowerCase()]);
      if (existing) return res.status(409).json({ error: 'An account with that email already exists' });
      const hash = bcrypt.hashSync(password, 10);
      const name = (display_name && display_name.trim()) || email.split('@')[0];
      const info = await run('INSERT INTO users (email, password_hash, display_name) VALUES (?, ?, ?)',
        [email.toLowerCase(), hash, name]);
      const user = await get('SELECT * FROM users WHERE id = ?', [info.lastInsertRowid]);
      console.log(`[stride] /auth/signup signing token (secret source=${JWT_SECRET_SOURCE} fingerprint=${JWT_SECRET_FP})`);
      res.json({ token: signToken(user), user: publicUser(user) });
    }));

    app.post('/auth/login', ah(async (req, res) => {
      const { email, password } = req.body || {};
      if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
      const user = await get('SELECT * FROM users WHERE email = ?', [email.toLowerCase()]);
      if (!user || !bcrypt.compareSync(password, user.password_hash)) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }
      console.log(`[stride] /auth/login signing token (secret source=${JWT_SECRET_SOURCE} fingerprint=${JWT_SECRET_FP})`);
      res.json({ token: signToken(user), user: publicUser(user) });
    }));

    // everything below requires auth
    app.use(authMiddleware);

    app.get('/me', ah(async (req, res) => {
      const user = await get('SELECT * FROM users WHERE id = ?', [req.user.id]);
      if (!user) return res.status(404).json({ error: 'User not found' });
      res.json({ user: publicUser(user) });
    }));

    app.put('/me', ah(async (req, res) => {
      const { display_name, resting_hr_baseline } = req.body || {};
      const user = await get('SELECT * FROM users WHERE id = ?', [req.user.id]);
      if (!user) return res.status(404).json({ error: 'User not found' });
      await run('UPDATE users SET display_name = ?, resting_hr_baseline = ? WHERE id = ?', [
        display_name?.trim() || user.display_name,
        Number.isFinite(+resting_hr_baseline) ? +resting_hr_baseline : user.resting_hr_baseline,
        req.user.id,
      ]);
      const updated = await get('SELECT * FROM users WHERE id = ?', [req.user.id]);
      res.json({ user: publicUser(updated) });
    }));

    // ---------- RUNS ----------
    app.get('/runs', ah(async (req, res) => {
      const runs = await all('SELECT * FROM runs WHERE user_id = ? ORDER BY date DESC, id DESC', [req.user.id]);
      res.json(runs);
    }));

    app.get('/runs/:id', ah(async (req, res) => {
      const runRow = await get('SELECT * FROM runs WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
      if (!runRow) return res.status(404).json({ error: 'Run not found' });
      res.json(runRow);
    }));

    app.post('/runs', ah(async (req, res) => {
      const b = req.body || {};
      if (!b.date || !(b.distance > 0)) return res.status(400).json({ error: 'Date and distance are required' });
      const info = await run(`INSERT INTO runs
        (user_id, date, distance, duration_seconds, pace_seconds, elevation_gain, calories, avg_hr, temperature, wind_speed, humidity, difficulty, run_type, weather_condition, notes)
        VALUES (@user_id, @date, @distance, @duration_seconds, @pace_seconds, @elevation_gain, @calories, @avg_hr, @temperature, @wind_speed, @humidity, @difficulty, @run_type, @weather_condition, @notes)`,
        {
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
          weather_condition: b.weather_condition || '',
          notes: b.notes || '',
        });
      res.json(await get('SELECT * FROM runs WHERE id = ?', [info.lastInsertRowid]));
    }));

    app.put('/runs/:id', ah(async (req, res) => {
      const runRow = await get('SELECT * FROM runs WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
      if (!runRow) return res.status(404).json({ error: 'Run not found' });
      const b = req.body || {};
      const merged = {};
      for (const f of RUN_FIELDS) merged[f] = b[f] !== undefined ? b[f] : runRow[f];
      await run(`UPDATE runs SET
        date=@date, distance=@distance, duration_seconds=@duration_seconds, pace_seconds=@pace_seconds,
        elevation_gain=@elevation_gain, calories=@calories, avg_hr=@avg_hr, temperature=@temperature,
        wind_speed=@wind_speed, humidity=@humidity, difficulty=@difficulty, run_type=@run_type,
        weather_condition=@weather_condition, notes=@notes
        WHERE id=@id AND user_id=@user_id`,
        { ...merged, id: runRow.id, user_id: req.user.id });
      res.json(await get('SELECT * FROM runs WHERE id = ?', [runRow.id]));
    }));

    app.delete('/runs/:id', ah(async (req, res) => {
      const info = await run('DELETE FROM runs WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
      if (!info.changes) return res.status(404).json({ error: 'Run not found' });
      res.json({ ok: true });
    }));

    // ---------- RACES ----------
    app.get('/races', ah(async (req, res) => {
      res.json(await all('SELECT * FROM races WHERE user_id = ? ORDER BY date DESC, id DESC', [req.user.id]));
    }));

    app.post('/races', ah(async (req, res) => {
      const b = req.body || {};
      if (!b.name || !b.date || !b.distance) return res.status(400).json({ error: 'Name, date and distance are required' });
      const info = await run(`INSERT INTO races
        (user_id, name, date, distance, official_time, time_seconds, placement, notes, photo_url)
        VALUES (@user_id, @name, @date, @distance, @official_time, @time_seconds, @placement, @notes, @photo_url)`,
        {
          user_id: req.user.id,
          name: b.name,
          date: b.date,
          distance: b.distance,
          official_time: b.official_time || '',
          time_seconds: +b.time_seconds || 0,
          placement: b.placement || '',
          notes: b.notes || '',
          photo_url: b.photo_url || '',
        });
      res.json(await get('SELECT * FROM races WHERE id = ?', [info.lastInsertRowid]));
    }));

    app.delete('/races/:id', ah(async (req, res) => {
      const info = await run('DELETE FROM races WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
      if (!info.changes) return res.status(404).json({ error: 'Race not found' });
      res.json({ ok: true });
    }));

    // ---------- RECOVERY ----------
    app.get('/recovery', ah(async (req, res) => {
      res.json(await all('SELECT * FROM recovery WHERE user_id = ? ORDER BY date DESC, id DESC', [req.user.id]));
    }));

    app.post('/recovery', ah(async (req, res) => {
      const b = req.body || {};
      if (!b.date) return res.status(400).json({ error: 'Date is required' });
      const info = await run(`INSERT INTO recovery
        (user_id, date, sleep_hours, resting_hr, soreness, mood, hydration, score)
        VALUES (@user_id, @date, @sleep_hours, @resting_hr, @soreness, @mood, @hydration, @score)`,
        {
          user_id: req.user.id,
          date: b.date,
          sleep_hours: +b.sleep_hours || 0,
          resting_hr: +b.resting_hr || 0,
          soreness: +b.soreness || 5,
          mood: +b.mood || 3,
          hydration: +b.hydration || 0,
          score: +b.score || 0,
        });
      res.json(await get('SELECT * FROM recovery WHERE id = ?', [info.lastInsertRowid]));
    }));

    // ---------- GOALS ----------
    app.get('/goals', ah(async (req, res) => {
      const goal = await get('SELECT * FROM goals WHERE user_id = ? AND active = 1 ORDER BY id DESC LIMIT 1', [req.user.id]);
      res.json(goal || null);
    }));

    app.post('/goals', ah(async (req, res) => {
      const b = req.body || {};
      if (!b.raw_text) return res.status(400).json({ error: 'Goal text is required' });
      // deactivate previous goals
      await run('UPDATE goals SET active = 0 WHERE user_id = ?', [req.user.id]);
      const info = await run(`INSERT INTO goals
        (user_id, raw_text, race_distance, target_pace_seconds, target_date, weeks_remaining, plan_json, prediction_json, active)
        VALUES (@user_id, @raw_text, @race_distance, @target_pace_seconds, @target_date, @weeks_remaining, @plan_json, @prediction_json, 1)`,
        {
          user_id: req.user.id,
          raw_text: b.raw_text,
          race_distance: b.race_distance || null,
          target_pace_seconds: b.target_pace_seconds || null,
          target_date: b.target_date || null,
          weeks_remaining: b.weeks_remaining || null,
          plan_json: b.plan_json ? JSON.stringify(b.plan_json) : null,
          prediction_json: b.prediction_json ? JSON.stringify(b.prediction_json) : null,
        });
      res.json(await get('SELECT * FROM goals WHERE id = ?', [info.lastInsertRowid]));
    }));

    // ---------- ANALYTICS ----------
    app.get('/analytics/summary', ah(async (req, res) => {
      const runs = await all('SELECT * FROM runs WHERE user_id = ?', [req.user.id]);
      const totalRuns = runs.length;
      const totalMiles = runs.reduce((s, r) => s + r.distance, 0);
      const totalSeconds = runs.reduce((s, r) => s + r.duration_seconds, 0);
      const avgPace = totalMiles > 0 ? Math.round(totalSeconds / totalMiles) : 0;
      res.json({ totalRuns, totalMiles: +totalMiles.toFixed(2), totalSeconds, avgPace });
    }));

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
