// Personal records, streaks and milestone badge logic.
import { parseTimeToSeconds, fmtPace, fmtDuration } from './format.js';

const DIST_ORDER = ['5K', '10K', 'Half Marathon', 'Marathon'];

export function computePRs(races) {
  const prs = {};
  for (const d of DIST_ORDER) {
    const inDist = races.filter((r) => r.distance === d && r.time_seconds > 0);
    if (inDist.length) {
      prs[d] = inDist.reduce((best, r) => (r.time_seconds < best.time_seconds ? r : best));
    }
  }
  return prs;
}

// Mark each race as PR if it's the fastest at its distance.
export function markPRs(races) {
  const prIds = new Set(Object.values(computePRs(races)).map((r) => r.id));
  return races.map((r) => ({ ...r, isPR: prIds.has(r.id) }));
}

// Consecutive-day running streak ending today or yesterday.
export function computeStreak(runs) {
  if (!runs.length) return { days: 0 };
  const dates = new Set(runs.map((r) => r.date));
  let streak = 0;
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  // allow streak to count if ran today OR yesterday (today not over yet)
  const todayStr = iso(cursor);
  if (!dates.has(todayStr)) cursor.setDate(cursor.getDate() - 1);
  while (dates.has(iso(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return { days: streak };
}

function iso(d) {
  return d.toISOString().slice(0, 10);
}

function runsInBestWeek(runs) {
  // max runs within any rolling 7-day window
  const times = runs.map((r) => new Date(r.date + 'T00:00:00').getTime()).sort((a, b) => a - b);
  let best = 0;
  for (let i = 0; i < times.length; i++) {
    let count = 0;
    for (let j = i; j < times.length; j++) {
      if (times[j] - times[i] < 7 * 86400000) count++;
    }
    best = Math.max(best, count);
  }
  return best;
}

export function computeBadges({ runs, races, hasGoal }) {
  const totalMiles = runs.reduce((s, r) => s + r.distance, 0);
  const avgPace = totalMiles > 0 ? runs.reduce((s, r) => s + r.duration_seconds, 0) / totalMiles : Infinity;
  const maxElev = runs.reduce((m, r) => Math.max(m, r.elevation_gain || 0), 0);
  const streak = computeStreak(runs).days;
  const bestWeek = runsInBestWeek(runs);

  return [
    { icon: '🏃', title: 'First Run', desc: 'Logged your first run', unlocked: runs.length >= 1 },
    { icon: '📅', title: '7-Day Streak', desc: 'Ran 7 days in a row', unlocked: streak >= 7 },
    { icon: '💯', title: '10 Runs', desc: 'Logged 10 runs', unlocked: runs.length >= 10 },
    { icon: '🗺️', title: '50 Miles', desc: '50 total miles', unlocked: totalMiles >= 50 },
    { icon: '🚀', title: '100 Miles', desc: '100 total miles', unlocked: totalMiles >= 100 },
    { icon: '⚡', title: 'Sub-9 Pace', desc: 'Avg pace under 9:00/mi', unlocked: avgPace < 540 && runs.length > 0 },
    { icon: '⛰️', title: '1000ft Climb', desc: '1000ft elevation in one run', unlocked: maxElev >= 1000 },
    { icon: '🏅', title: 'First Race', desc: 'Logged a race', unlocked: races.length >= 1 },
    { icon: '🔥', title: '5 in a Week', desc: '5 runs within 7 days', unlocked: bestWeek >= 5 },
    { icon: '🧠', title: 'First Plan', desc: 'Generated a training plan', unlocked: !!hasGoal },
  ];
}

export const RACE_MEDALS = {
  '5K': '🥉',
  '10K': '🥈',
  'Half Marathon': '🥇',
  'Marathon': '🏆',
  'Other': '⭐',
};

export { DIST_ORDER };

// ===========================================================================
// ACHIEVEMENTS — everything below auto-computes from the user's run array.
// computeAchievements(runs) returns a flat list of result objects:
//   { id, category, icon, name, desc, unlocked, current, target, unit,
//     dateUnlocked, detail, progress }
// `progress` (0..1) is optional and overrides current/target for the bar.
// ===========================================================================

export const ACHIEVEMENT_CATEGORIES = [
  'Mileage Clubs', 'Effort Badges', 'Speed Milestones', 'Distance Milestones',
  'Elevation Badges', 'Consistency Awards', 'Condition Warrior', 'Calendar',
  'Personal Extremes', 'Creative & Fun',
];

const DAY_MS = 86400000;
const RACE_MI = { '5K': 3.107, '10K': 6.214, 'Half': 13.109, 'Full': 26.219 };

function ld(s) { return new Date(s + 'T00:00:00'); }
function localISO(d) {
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
}
function slug(name) { return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
function clamp01(x) { return Math.max(0, Math.min(1, x)); }

function streakStats(runs) {
  const dates = [...new Set(runs.map((r) => r.date))].filter(Boolean).sort();
  let best = 0, len = 0, prev = null;
  const reachDate = {};
  for (const d of dates) {
    if (prev && (ld(d) - ld(prev)) === DAY_MS) len += 1; else len = 1;
    if (len > best) best = len;
    if (!reachDate[len]) reachDate[len] = d;
    prev = d;
  }
  const set = new Set(dates);
  let current = 0;
  const c = new Date(); c.setHours(0, 0, 0, 0);
  if (!set.has(localISO(c))) c.setDate(c.getDate() - 1);
  while (set.has(localISO(c))) { current += 1; c.setDate(c.getDate() - 1); }
  return { best, current, reachDate };
}

function weekKey(dateStr) {
  const d = ld(dateStr);
  const monday = new Date(d);
  monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return localISO(monday);
}

function maxRunsInWeek(runs) {
  const counts = {};
  for (const r of runs) counts[weekKey(r.date)] = (counts[weekKey(r.date)] || 0) + 1;
  return Object.values(counts).reduce((m, n) => Math.max(m, n), 0);
}

function maxConsecutiveWeeks(runs) {
  const weeks = [...new Set(runs.map((r) => weekKey(r.date)))].sort();
  let best = 0, len = 0, prev = null;
  for (const w of weeks) {
    if (prev && (ld(w) - ld(prev)) === 7 * DAY_MS) len += 1; else len = 1;
    best = Math.max(best, len);
    prev = w;
  }
  return best;
}

function isHoliday(dateStr) {
  const d = ld(dateStr);
  const m = d.getMonth() + 1, day = d.getDate(), wd = d.getDay();
  if (m === 1 && day === 1) return true;            // New Year's Day
  if (m === 7 && day === 4) return true;            // Independence Day
  if (m === 12 && day === 25) return true;          // Christmas
  if (m === 11 && day >= 22 && day <= 28 && wd === 4) return true; // Thanksgiving
  return false;
}

export function computeAchievements(runsInput) {
  const runs = (Array.isArray(runsInput) ? runsInput : []).filter(
    (r) => r && typeof r === 'object' && typeof r.date === 'string' && !Number.isNaN(new Date(r.date + 'T00:00:00').getTime())
  );
  const asc = [...runs].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : (a.id || 0) - (b.id || 0)));

  // --- aggregates ---
  const totalMiles = runs.reduce((s, r) => s + (r.distance || 0), 0);
  const totalElev = runs.reduce((s, r) => s + (r.elevation_gain || 0), 0);
  const maxDistance = runs.reduce((m, r) => Math.max(m, r.distance || 0), 0);
  const maxElev = runs.reduce((m, r) => Math.max(m, r.elevation_gain || 0), 0);
  const paced = runs.filter((r) => r.pace_seconds > 0);
  const bestPace = paced.length ? Math.min(...paced.map((r) => r.pace_seconds)) : 0;
  const streak = streakStats(runs);
  const weekMax = maxRunsInWeek(runs);
  const consecWeeks = maxConsecutiveWeeks(runs);

  const dateWhere = (pred) => { const r = asc.find(pred); return r ? r.date : null; };
  const countWhere = (pred) => runs.filter(pred).length;
  const any = (pred) => runs.some(pred);
  const milesCrossDate = (t) => { let s = 0; for (const r of asc) { s += r.distance || 0; if (s >= t) return r.date; } return null; };
  const runsCrossDate = (t) => (asc.length >= t ? asc[t - 1].date : null);
  const elevCrossDate = (t) => { let s = 0; for (const r of asc) { s += r.elevation_gain || 0; if (s >= t) return r.date; } return null; };

  // double tap: any calendar day with 2+ runs
  const perDay = {};
  for (const r of runs) perDay[r.date] = (perDay[r.date] || 0) + 1;
  const doubleTapDate = Object.keys(perDay).sort().find((d) => perDay[d] >= 2) || null;

  // comeback: a run 14+ days after the previous run
  let comebackDate = null;
  const uniqDates = [...new Set(runs.map((r) => r.date))].sort();
  for (let i = 1; i < uniqDates.length; i++) {
    if ((ld(uniqDates[i]) - ld(uniqDates[i - 1])) / DAY_MS >= 14) { comebackDate = uniqDates[i]; break; }
  }

  // improvement arc: 5 consecutive runs each faster than the last
  let arcDate = null, arcLen = 1;
  for (let i = 1; i < asc.length; i++) {
    if (asc[i].pace_seconds > 0 && asc[i - 1].pace_seconds > 0 && asc[i].pace_seconds < asc[i - 1].pace_seconds) {
      arcLen += 1;
      if (arcLen >= 5 && !arcDate) arcDate = asc[i].date;
    } else arcLen = 1;
  }

  // weekend warrior: a Saturday + the following Sunday both have runs
  const dateSet = new Set(uniqDates);
  let weekendDate = null;
  for (const d of uniqDates) {
    if (ld(d).getDay() === 6) {
      const sun = localISO(new Date(ld(d).getTime() + DAY_MS));
      if (dateSet.has(sun)) { weekendDate = sun; break; }
    }
  }

  const distinctMiles = new Set(runs.map((r) => Math.round(r.distance || 0)).filter((x) => x > 0)).size;
  const notesCount = countWhere((r) => (r.notes || '').trim().length > 0);

  const perfect = (r) => r.weather_condition === 'Sunny' && r.temperature >= 55 && r.temperature <= 65 && r.humidity > 0 && r.humidity < 50 && r.wind_speed < 10;

  // best estimated race time for a distance, from any run long enough
  function fastest(mi) {
    const q = runs.filter((r) => r.distance >= mi && r.pace_seconds > 0);
    if (!q.length) return null;
    const best = Math.min(...q.map((r) => r.pace_seconds));
    return Math.round(best * mi);
  }

  const out = [];
  const add = (category, icon, name, desc, unlocked, opts = {}) => out.push({
    id: slug(name), category, icon, name, desc,
    unlocked: !!unlocked,
    current: opts.current != null ? opts.current : (unlocked ? 1 : 0),
    target: opts.target != null ? opts.target : 1,
    unit: opts.unit || '',
    dateUnlocked: unlocked ? (opts.dateUnlocked || null) : null,
    detail: opts.detail || null,
    progress: opts.progress != null ? opts.progress : null,
  });

  // ---- MILEAGE CLUBS ----
  add('Mileage Clubs', '🥾', 'First Mile', 'Log your first run', runs.length >= 1, { current: runs.length, target: 1, unit: 'run', dateUnlocked: asc[0]?.date });
  for (const t of [10, 50, 100, 500, 1000]) {
    const name = t === 100 ? 'Century Runner' : t === 1000 ? '1000 Mile Legend' : `${t} Mile Club`;
    add('Mileage Clubs', '🗺️', name, `${t} total miles logged`, totalMiles >= t, { current: Math.round(totalMiles), target: t, unit: 'mi', dateUnlocked: milesCrossDate(t) });
  }

  // ---- EFFORT BADGES ----
  add('Effort Badges', '👟', 'First Step', 'Log your very first run', runs.length >= 1, { current: runs.length, target: 1, unit: 'run', dateUnlocked: asc[0]?.date });
  for (const t of [10, 25, 50, 100]) {
    const name = t === 25 ? '25 Run Club' : t === 50 ? 'Half Century' : t === 100 ? '100 Run Legend' : '10 Run Club';
    add('Effort Badges', '💪', name, `Log ${t} runs`, runs.length >= t, { current: runs.length, target: t, unit: 'runs', dateUnlocked: runsCrossDate(t) });
  }

  // ---- SPEED MILESTONES ----
  const paceAch = (icon, name, secs) => {
    const unlocked = bestPace > 0 && bestPace < secs;
    add('Speed Milestones', icon, name, `Run any distance at sub-${fmtPace(secs)}/mi pace`, unlocked, {
      progress: unlocked ? 1 : (bestPace > 0 ? clamp01(secs / bestPace) : 0),
      detail: bestPace > 0 ? `Best ${fmtPace(bestPace)}/mi` : 'No runs yet',
      dateUnlocked: dateWhere((r) => r.pace_seconds > 0 && r.pace_seconds < secs),
    });
  };
  paceAch('⚡', 'Speed Demon', 420);
  paceAch('💨', 'Sub-8 Runner', 480);
  paceAch('🏃', 'Sub-9 Runner', 540);
  const fastestAch = (name, key, mi) => {
    const est = fastest(mi);
    const unlocked = est != null;
    add('Speed Milestones', '⏱️', name, `Best estimated ${key} time`, unlocked, {
      current: Math.round(maxDistance * 100) / 100, target: mi, unit: 'mi',
      detail: unlocked ? fmtDuration(est) : `Need a ${mi}+ mi run`,
      dateUnlocked: dateWhere((r) => r.distance >= mi),
    });
  };
  fastestAch('Fastest 5K', '5K', RACE_MI['5K']);
  fastestAch('Fastest 10K', '10K', RACE_MI['10K']);
  fastestAch('Fastest Half', 'half marathon', RACE_MI.Half);
  fastestAch('Fastest Full', 'marathon', RACE_MI.Full);

  // ---- DISTANCE MILESTONES ----
  const distAch = (icon, name, desc, mi) => add('Distance Milestones', icon, name, desc, maxDistance >= mi, {
    current: Math.round(maxDistance * 100) / 100, target: mi, unit: 'mi', dateUnlocked: dateWhere((r) => r.distance >= mi),
  });
  distAch('🏃', 'Long Run Rookie', 'A single run of 5+ miles', 5);
  distAch('🔟', 'Double Digits', 'A single run of 10+ miles', 10);
  distAch('🎽', 'Half Marathon Distance', 'A single run of 13.1+ miles', 13.1);
  distAch('🏅', 'Marathon Distance', 'A single run of 26.2+ miles', 26.2);
  distAch('🦬', 'Ultra Warrior', 'A single run of 31+ miles', 31);

  // ---- ELEVATION BADGES ----
  add('Elevation Badges', '⛰️', 'Hill Climber', '500 ft gain in a single run', maxElev >= 500, { current: maxElev, target: 500, unit: 'ft', dateUnlocked: dateWhere((r) => (r.elevation_gain || 0) >= 500) });
  add('Elevation Badges', '🐐', 'Mountain Goat', '1000 ft gain in a single run', maxElev >= 1000, { current: maxElev, target: 1000, unit: 'ft', dateUnlocked: dateWhere((r) => (r.elevation_gain || 0) >= 1000) });
  add('Elevation Badges', '🏔️', 'Summit Seeker', '5000 ft total elevation gained', totalElev >= 5000, { current: Math.round(totalElev), target: 5000, unit: 'ft', dateUnlocked: elevCrossDate(5000) });
  add('Elevation Badges', '🗻', 'Everest Mode', '29,032 ft total elevation gained', totalElev >= 29032, { current: Math.round(totalElev), target: 29032, unit: 'ft', dateUnlocked: elevCrossDate(29032) });

  // ---- CONSISTENCY AWARDS ----
  const streakAch = (icon, name, n) => add('Consistency Awards', icon, name, `Run ${n} days in a row`, streak.best >= n, { current: streak.best, target: n, unit: 'days', dateUnlocked: streak.reachDate[n] });
  streakAch('📅', '3-Day Streak', 3);
  streakAch('🗓️', 'Week Warrior', 7);
  streakAch('📆', 'Two Week Grind', 14);
  streakAch('🔥', '30 Day Beast', 30);
  add('Consistency Awards', '5️⃣', '5 Runs in a Week', 'Log 5 runs in one calendar week', weekMax >= 5, { current: weekMax, target: 5, unit: 'runs' });
  add('Consistency Awards', '🎯', 'Monthly Miler', 'A run every week for a full month', consecWeeks >= 4, { current: consecWeeks, target: 4, unit: 'weeks' });

  // ---- CONDITION WARRIOR ----
  const condAch = (icon, name, desc, pred) => add('Condition Warrior', icon, name, desc, any(pred), { current: countWhere(pred), target: 1, dateUnlocked: dateWhere(pred) });
  condAch('🌧️', 'Rain Runner', 'Run in the rain', (r) => r.weather_condition === 'Rainy');
  condAch('⛈️', 'Storm Chaser', 'Run during a storm', (r) => r.weather_condition === 'Stormy');
  condAch('❄️', 'Snow Warrior', 'Run in the snow', (r) => r.weather_condition === 'Snowy');
  condAch('🔥', 'Heat Seeker', 'Run in 85°F or above', (r) => r.temperature >= 85);
  condAch('🧊', 'Cold Crusher', 'Run in 32°F or below', (r) => r.temperature > 0 && r.temperature <= 32);
  condAch('💧', 'Humidity Hero', 'Run in 85%+ humidity', (r) => r.humidity >= 85);
  condAch('🌬️', 'Wind Fighter', 'Run in 20+ mph wind', (r) => r.wind_speed >= 20);
  condAch('🌤️', 'Perfect Conditions', 'Sunny, 55-65°F, dry & calm', perfect);

  // ---- CALENDAR ----
  add('Calendar', '🏖️', 'Weekend Warrior', 'Run both Saturday and Sunday', !!weekendDate, { dateUnlocked: weekendDate });
  add('Calendar', '💼', 'Monday Motivator', 'Log a run on a Monday', any((r) => ld(r.date).getDay() === 1), { dateUnlocked: dateWhere((r) => ld(r.date).getDay() === 1) });
  add('Calendar', '🎉', 'Holiday Runner', 'Run on a major holiday', any((r) => isHoliday(r.date)), { dateUnlocked: dateWhere((r) => isHoliday(r.date)) });

  // ---- PERSONAL EXTREMES ----
  add('Personal Extremes', '🥵', 'Hottest Run', 'Run in 90°F+ heat', any((r) => r.temperature >= 90), { dateUnlocked: dateWhere((r) => r.temperature >= 90) });
  add('Personal Extremes', '🥶', 'Coldest Run', 'Run in 20°F or below', any((r) => r.temperature > 0 && r.temperature <= 20), { dateUnlocked: dateWhere((r) => r.temperature > 0 && r.temperature <= 20) });
  add('Personal Extremes', '❤️‍🔥', 'Heart Rate Hero', 'Avg HR over 180 bpm', any((r) => r.avg_hr > 180), { dateUnlocked: dateWhere((r) => r.avg_hr > 180) });
  add('Personal Extremes', '🛡️', 'Iron Will', 'Difficulty 9.5 or 10', any((r) => r.difficulty >= 9.5), { dateUnlocked: dateWhere((r) => r.difficulty >= 9.5) });
  add('Personal Extremes', '🔥', 'Calorie Crusher', '1000+ calories in one run', any((r) => r.calories >= 1000), { current: runs.reduce((m, r) => Math.max(m, r.calories || 0), 0), target: 1000, unit: 'cal', dateUnlocked: dateWhere((r) => r.calories >= 1000) });
  add('Personal Extremes', '🏎️', 'Everest Pacer', 'Sub-8 pace for 20+ miles', any((r) => r.distance >= 20 && r.pace_seconds > 0 && r.pace_seconds < 480), { dateUnlocked: dateWhere((r) => r.distance >= 20 && r.pace_seconds > 0 && r.pace_seconds < 480) });

  // ---- CREATIVE & FUN ----
  add('Creative & Fun', '✌️', 'Double Tap', 'Log 2 runs in one day', !!doubleTapDate, { dateUnlocked: doubleTapDate });
  add('Creative & Fun', '🔄', 'Comeback Kid', 'Run after a 14+ day gap', !!comebackDate, { dateUnlocked: comebackDate });
  add('Creative & Fun', '📈', 'Improvement Arc', '5 runs in a row, each faster', !!arcDate, { current: Math.min(arcLen, 5), target: 5, unit: 'runs', dateUnlocked: arcDate });
  const allWeather = any((r) => r.weather_condition === 'Rainy') && any((r) => r.weather_condition === 'Snowy') && any((r) => r.temperature >= 85);
  add('Creative & Fun', '🌈', 'All Weather Champion', 'Rain, Snow & Heat runs', allWeather);
  add('Creative & Fun', '🎚️', 'Distance Collector', 'Runs at 5 different distances', distinctMiles >= 5, { current: distinctMiles, target: 5, unit: 'distances' });
  add('Creative & Fun', '📝', 'Note Taker', 'Add notes to 10 runs', notesCount >= 10, { current: notesCount, target: 10, unit: 'runs' });

  return out;
}
