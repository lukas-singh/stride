// coachEngine.js — pure rule-based coaching logic. No external API calls.
// All functions operate on the user's stored run data.

export const RACE_DISTANCES = {
  '5K': { miles: 3.107, label: '5K', effort: 0.95 },
  '10K': { miles: 6.214, label: '10K', effort: 1.0 },
  'Half Marathon': { miles: 13.109, label: 'Half Marathon', effort: 1.05 },
  'Marathon': { miles: 26.219, label: 'Marathon', effort: 1.12 },
};

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july',
  'august', 'september', 'october', 'november', 'december'];

// ---------------- GOAL PARSER ----------------
export function parseGoal(text) {
  const raw = (text || '').toLowerCase();

  // distance — fuzzy match
  let raceDistance = null;
  if (/\b(marathon)\b/.test(raw) && !/half/.test(raw)) raceDistance = 'Marathon';
  if (/half|13\.1|21k|21 ?k/.test(raw)) raceDistance = 'Half Marathon';
  if (/\b(10 ?k|10k|6\.2)\b/.test(raw)) raceDistance = '10K';
  if (/\b(5 ?k|5k|3\.1)\b/.test(raw)) raceDistance = '5K';
  if (/full marathon/.test(raw)) raceDistance = 'Marathon';

  // target pace — MM:SS, often near "pace" or "/mi"
  let targetPaceSeconds = null;
  const paceMatch = raw.match(/(\d{1,2}):(\d{2})\s*(?:\/?\s*(?:mi|mile|min))?/g);
  if (paceMatch) {
    // prefer a value that looks like a pace (4:00–15:00)
    for (const m of paceMatch) {
      const [mm, ss] = m.match(/(\d{1,2}):(\d{2})/).slice(1).map(Number);
      const secs = mm * 60 + ss;
      if (secs >= 240 && secs <= 900) { targetPaceSeconds = secs; break; }
    }
  }

  // target date — month name (+ optional year/day)
  let targetDate = null;
  let weeksRemaining = null;
  // Match a month as a standalone word (full name or 3-letter abbr). Word
  // boundaries keep "marathon" from matching "mar"/March.
  let monthIdx = -1;
  for (let i = 0; i < MONTHS.length; i++) {
    const full = MONTHS[i];
    const re = new RegExp(`\\b(${full}|${full.slice(0, 3)})\\b`);
    if (re.test(raw)) { monthIdx = i; break; }
  }
  if (monthIdx >= 0) {
    const now = new Date();
    const yearMatch = raw.match(/\b(20\d{2})\b/);
    let year = yearMatch ? Number(yearMatch[1]) : now.getFullYear();
    // if the month already passed this year and no explicit year, assume next year
    if (!yearMatch && monthIdx < now.getMonth()) year += 1;
    const dayMatch = raw.match(new RegExp(`${MONTHS[monthIdx].slice(0,3)}[a-z]*\\s+(\\d{1,2})`));
    const day = dayMatch ? Number(dayMatch[1]) : 15;
    const d = new Date(year, monthIdx, day);
    targetDate = d.toISOString().slice(0, 10);
    weeksRemaining = Math.max(1, Math.round((d - now) / (7 * 86400000)));
  }

  return { raceDistance, targetPaceSeconds, targetDate, weeksRemaining };
}

// ---------------- STATS HELPERS ----------------
function avg(arr) {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}

// simple linear regression slope over index -> y. Negative slope on pace = improving.
function slope(values) {
  const n = values.length;
  if (n < 2) return 0;
  const xs = values.map((_, i) => i);
  const mx = avg(xs);
  const my = avg(values);
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (values[i] - my);
    den += (xs[i] - mx) ** 2;
  }
  return den === 0 ? 0 : num / den;
}

function weeklyMileage(runs) {
  if (!runs.length) return 0;
  const days = new Set(runs.map((r) => r.date)).size || 1;
  const span = Math.max(1, Math.min(days, daysSpan(runs)));
  const totalMiles = runs.reduce((s, r) => s + r.distance, 0);
  const weeks = Math.max(1, span / 7);
  return totalMiles / weeks;
}

function daysSpan(runs) {
  if (!runs.length) return 1;
  const times = runs.map((r) => new Date(r.date + 'T00:00:00').getTime());
  return Math.max(1, Math.round((Math.max(...times) - Math.min(...times)) / 86400000) + 1);
}

function sortByDateAsc(runs) {
  return [...runs].sort((a, b) => a.date.localeCompare(b.date));
}

// ---------------- PACE TREND ----------------
export function paceTrend(runs) {
  const sorted = sortByDateAsc(runs).slice(-20);
  if (sorted.length < 3) return { label: 'flat', slope: 0 };
  const s = slope(sorted.map((r) => r.pace_seconds));
  if (s < -0.6) return { label: 'improving', slope: s };
  if (s > 0.6) return { label: 'declining', slope: s };
  return { label: 'flat', slope: s };
}

// ---------------- RACE TIME PREDICTION ----------------
export function predictRaceTime(runs, goal) {
  const dist = RACE_DISTANCES[goal.raceDistance] || RACE_DISTANCES['10K'];
  const sorted = sortByDateAsc(runs);
  const last10 = sorted.slice(-10);
  if (!last10.length) {
    return { predictedSeconds: 0, confidence: 'Low', deltaSeconds: null, avgPace: 0, trend: 'flat' };
  }
  const avgPace = avg(last10.map((r) => r.pace_seconds));
  const trend = paceTrend(runs);

  // effort multiplier per distance
  let racePace = avgPace * dist.effort;

  // trend adjustment: improving shaves a little, declining adds
  if (trend.label === 'improving') racePace *= 0.985;
  else if (trend.label === 'declining') racePace *= 1.015;

  // fatigue correction: if weekly mileage is low relative to race distance, slow down
  const wkMileage = weeklyMileage(runs);
  const mileageRatio = wkMileage / dist.miles; // weekly volume vs single race distance
  let fatigue = 1.0;
  if (mileageRatio < 1.5) fatigue = 1.06;
  else if (mileageRatio < 2.5) fatigue = 1.03;
  else if (mileageRatio < 4) fatigue = 1.01;
  racePace *= fatigue;

  const predictedSeconds = Math.round(racePace * dist.miles);

  // confidence by number of runs
  let confidence = 'Low';
  if (runs.length >= 20) confidence = 'High';
  else if (runs.length >= 8) confidence = 'Medium';

  let deltaSeconds = null;
  if (goal.targetPaceSeconds) {
    const goalSeconds = Math.round(goal.targetPaceSeconds * dist.miles);
    deltaSeconds = predictedSeconds - goalSeconds; // positive = slower than goal
  }

  return {
    predictedSeconds,
    racePaceSeconds: Math.round(racePace),
    avgPace: Math.round(avgPace),
    confidence,
    deltaSeconds,
    trend: trend.label,
    weeklyMileage: +wkMileage.toFixed(1),
  };
}

// ---------------- FITNESS ASSESSMENT ----------------
const FITNESS_DESCRIPTIONS = {
  'Base Building': 'You are laying an aerobic foundation. Mileage is on the lighter side and your body is still adapting. Stay consistent with easy runs and gradually build volume before adding intensity.',
  'Developing': 'Your fitness is trending upward. You have a solid routine and your paces are responding to training. Keep the progression steady and start layering in structured workouts.',
  'Race Ready': 'You are in strong shape with reliable mileage and improving paces. Your body is handling the load well — sharpen with race-specific workouts and trust your training.',
  'Peak Fitness': 'Excellent form. High volume, improving paces, and controlled effort point to peak conditioning. Protect this with smart recovery and avoid the temptation to overreach.',
  'Overtrained': 'Warning signs of overreaching: elevated effort, high difficulty, or an elevated heart rate relative to pace. Prioritize sleep, easy running, and recovery days before pushing again.',
};

export function assessFitness(runs) {
  if (runs.length < 3) {
    return { level: 'Base Building', description: FITNESS_DESCRIPTIONS['Base Building'] };
  }
  const fourWeeksAgo = Date.now() - 28 * 86400000;
  const recent = runs.filter((r) => new Date(r.date + 'T00:00:00').getTime() >= fourWeeksAgo);
  const pool = recent.length >= 3 ? recent : runs;

  const avgDifficulty = avg(pool.map((r) => r.difficulty));
  const avgHR = avg(pool.filter((r) => r.avg_hr > 0).map((r) => r.avg_hr));
  const trend = paceTrend(runs);
  const wkMileage = weeklyMileage(pool);

  // Overtraining check first
  if (avgDifficulty > 7.5 && (avgHR > 168 || trend.label === 'declining')) {
    return { level: 'Overtrained', description: FITNESS_DESCRIPTIONS['Overtrained'] };
  }

  let score = 0;
  if (wkMileage >= 30) score += 2; else if (wkMileage >= 18) score += 1;
  if (trend.label === 'improving') score += 2; else if (trend.label === 'flat') score += 1;
  if (avgDifficulty <= 5.5) score += 1;
  if (avgHR && avgHR < 160) score += 1;

  let level = 'Base Building';
  if (score >= 5) level = 'Peak Fitness';
  else if (score >= 4) level = 'Race Ready';
  else if (score >= 2) level = 'Developing';

  return { level, description: FITNESS_DESCRIPTIONS[level], stats: { avgDifficulty: +avgDifficulty.toFixed(1), avgHR: Math.round(avgHR), weeklyMileage: +wkMileage.toFixed(1), trend: trend.label } };
}

// ---------------- WEEKLY TRAINING PLAN ----------------
export function generatePlan(goal, runs) {
  const weeks = Math.max(1, Math.min(goal.weeksRemaining || 8, 24));
  const dist = RACE_DISTANCES[goal.raceDistance] || RACE_DISTANCES['Half Marathon'];
  const goalPace = goal.targetPaceSeconds || (runs.length ? Math.round(avg(sortByDateAsc(runs).slice(-10).map((r) => r.pace_seconds))) : 540);

  const paces = {
    Easy: goalPace + 90,
    Tempo: goalPace - 15,
    'Long Run': goalPace + 60,
    Interval: goalPace - 30,
    Recovery: goalPace + 120,
  };

  // starting weekly mileage: max of current volume and a distance-based floor
  const currentWk = weeklyMileage(runs);
  const floor = dist.miles * 2.2;
  let baseMiles = Math.max(currentWk || 0, floor);

  const buildEnd = Math.max(1, weeks - 2); // weeks 1..N-2 build, then peak, then taper
  // Cap weekly volume so compounding 10% over a long plan stays realistic.
  const ceiling = Math.max(baseMiles * 1.8, baseMiles + dist.miles * 1.5);
  const peakMiles = Math.min(baseMiles * Math.pow(1.1, buildEnd - 1) * 1.05, ceiling);
  const plan = [];

  for (let w = 1; w <= weeks; w++) {
    let phase, totalMiles;
    if (w <= buildEnd - 1) {
      phase = 'Build';
      totalMiles = Math.min(baseMiles * Math.pow(1.1, w - 1), ceiling);
    } else if (w < weeks) {
      phase = 'Peak';
      totalMiles = peakMiles;
    } else {
      phase = 'Taper';
      totalMiles = peakMiles * 0.6; // reduce volume ~40%
    }
    totalMiles = Math.round(totalMiles);

    const longRunMiles = Math.min(dist.miles * (phase === 'Taper' ? 0.55 : 0.85), Math.round(totalMiles * 0.4));
    const keyWorkouts = buildWeekWorkouts({ phase, totalMiles, longRunMiles, paces, includeInterval: phase === 'Build' });

    plan.push({
      weekNumber: w,
      phase,
      totalMiles,
      keyWorkouts,
    });
  }
  return plan;
}

function buildWeekWorkouts({ phase, totalMiles, longRunMiles, paces, includeInterval }) {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const longRun = +longRunMiles.toFixed(1);
  const remaining = Math.max(0, totalMiles - longRun);

  const workouts = [];
  // Saturday long run
  // Wednesday tempo (or interval in build)
  // Tuesday interval (build only)
  // others easy / recovery / rest

  const midweekQuality = remaining * 0.28;
  const intervalMiles = +(remaining * 0.2).toFixed(1);
  const easyEach = +((remaining - midweekQuality - (includeInterval ? intervalMiles : 0)) / 3).toFixed(1);

  for (const day of days) {
    if (day === 'Sat') {
      workouts.push({ day, type: 'Long Run', distance: longRun, targetPace: paces['Long Run'], notes: phase === 'Taper' ? 'Shorter long run — stay relaxed.' : 'Steady aerobic effort, build endurance.' });
    } else if (day === 'Wed') {
      workouts.push({ day, type: 'Tempo', distance: +midweekQuality.toFixed(1), targetPace: paces.Tempo, notes: 'Comfortably hard. Sustain goal-effort pace.' });
    } else if (day === 'Tue' && includeInterval) {
      workouts.push({ day, type: 'Interval', distance: intervalMiles, targetPace: paces.Interval, notes: 'Repeats with recovery jog between (e.g. 6×800m).' });
    } else if (day === 'Sun') {
      workouts.push({ day, type: 'Recovery', distance: Math.max(2, +(easyEach * 0.8).toFixed(1)), targetPace: paces.Recovery, notes: 'Very easy shakeout or cross-train.' });
    } else if (day === 'Mon' || day === 'Fri') {
      workouts.push({ day, type: 'Rest', distance: 0, targetPace: 0, notes: 'Rest or light mobility work.' });
    } else {
      workouts.push({ day, type: 'Easy', distance: Math.max(2, easyEach), targetPace: paces.Easy, notes: 'Conversational pace.' });
    }
  }
  return workouts;
}

// ---------------- SUGGESTIONS ----------------
export function generateSuggestions(runs, goal) {
  const out = [];
  const sorted = sortByDateAsc(runs);
  const withHR = runs.filter((r) => r.avg_hr > 0);
  const avgHR = avg(withHR.map((r) => r.avg_hr));
  const wkMileage = weeklyMileage(runs);
  const avgDifficulty = avg(runs.map((r) => r.difficulty));
  const trend = paceTrend(runs);
  const isHalfPlus = goal?.raceDistance === 'Half Marathon' || goal?.raceDistance === 'Marathon';

  const lastRunDate = sorted.length ? new Date(sorted[sorted.length - 1].date + 'T00:00:00') : null;
  const daysSinceLast = lastRunDate ? Math.round((Date.now() - lastRunDate.getTime()) / 86400000) : Infinity;

  if (avgHR > 170) {
    out.push({ icon: '❤️', text: `Your average heart rate (${Math.round(avgHR)} bpm) is high. Add more easy, conversational-pace runs to build aerobic efficiency.` });
  }
  if (wkMileage < 15 && isHalfPlus) {
    out.push({ icon: '🧱', text: `You're averaging ${wkMileage.toFixed(0)} mi/week. For a ${goal.raceDistance}, build your base toward 25–35 mi/week before adding intensity.` });
  }
  if (avgDifficulty > 7) {
    out.push({ icon: '🛌', text: `Your runs average ${avgDifficulty.toFixed(1)}/10 difficulty. Insert dedicated recovery runs to absorb the training and avoid burnout.` });
  }
  if (daysSinceLast > 7) {
    out.push({ icon: '📅', text: `It's been ${daysSinceLast === Infinity ? 'a while' : daysSinceLast + ' days'} since your last run. Ease back in with a short, relaxed effort to rebuild rhythm.` });
  }
  if (trend.label === 'improving') {
    out.push({ icon: '📈', text: 'Your pace is trending faster — great work. You can handle a slightly longer tempo this week to capitalize on your fitness.' });
  }
  if (runs.length && runs.every((r) => (r.elevation_gain || 0) === 0)) {
    out.push({ icon: '⛰️', text: 'All your runs are flat. Add a weekly hill session or rolling route to build strength and resilience.' });
  }
  const distances = runs.map((r) => Math.round(r.distance));
  if (runs.length >= 4 && new Set(distances).size <= 2) {
    out.push({ icon: '🔀', text: 'Your run distances rarely change. Mix in longer and shorter efforts to develop different energy systems.' });
  }

  // Always-included tips
  out.push({ icon: '🏁', text: 'Race week: trust the taper, sleep well, and run the first mile slower than goal pace to bank energy for a strong finish.' });
  out.push({ icon: '💧', text: 'Hydrate consistently through the week and practice your race-day fueling on long runs — never try something new on race day.' });

  // Ensure 6–8 suggestions
  const filler = [
    { icon: '🦵', text: 'Add 2× weekly strength work (squats, lunges, core) to improve running economy and reduce injury risk.' },
    { icon: '😴', text: 'Aim for 7–9 hours of sleep — recovery is when adaptation actually happens.' },
    { icon: '🧘', text: 'Spend 10 minutes on dynamic warm-ups before quality sessions to run faster and safer.' },
    { icon: '📓', text: 'Keep logging every run — consistent data sharpens these predictions and your plan.' },
    { icon: '🩹', text: 'Address niggles early. A day or two of easy running beats weeks sidelined by injury.' },
    { icon: '🥗', text: 'Fuel within 30 minutes post-run with carbs + protein to speed recovery between sessions.' },
  ];
  let i = 0;
  while (out.length < 6 && i < filler.length) out.push(filler[i++]);

  return out.slice(0, 8);
}

// ---------------- TOP-LEVEL ----------------
export function runCoach(text, runs) {
  const goal = parseGoal(text);
  const prediction = predictRaceTime(runs, goal);
  const fitness = assessFitness(runs);
  const plan = generatePlan(goal, runs);
  const suggestions = generateSuggestions(runs, goal);
  return { goal, prediction, fitness, plan, suggestions };
}
