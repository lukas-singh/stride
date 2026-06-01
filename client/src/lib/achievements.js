// Personal records, streaks and milestone badge logic.
import { parseTimeToSeconds } from './format.js';

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
