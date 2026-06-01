// personalBests.js — auto-computed records from the user's logged runs.
// Every stat is derived from run data; cards only appear when the data exists.
import { fmtPace, fmtDate } from './format.js';

function asRuns(runs) {
  return Array.isArray(runs) ? runs.filter((r) => r && typeof r === 'object') : [];
}

function localISO(d) {
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
}

// Longest consecutive-day streak ever (best) + the active streak (current).
export function computeStreaks(runs) {
  const dates = [...new Set(asRuns(runs).map((r) => r.date))].filter(Boolean).sort();
  if (!dates.length) return { current: 0, best: 0 };

  let best = 1;
  let run = 1;
  for (let i = 1; i < dates.length; i++) {
    const prev = new Date(dates[i - 1] + 'T00:00:00');
    const cur = new Date(dates[i] + 'T00:00:00');
    const diff = Math.round((cur - prev) / 86400000);
    if (diff === 1) { run += 1; best = Math.max(best, run); }
    else if (diff !== 0) { run = 1; }
  }

  const set = new Set(dates);
  let current = 0;
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  if (!set.has(localISO(cursor))) cursor.setDate(cursor.getDate() - 1);
  while (set.has(localISO(cursor))) { current += 1; cursor.setDate(cursor.getDate() - 1); }

  return { current, best };
}

const days = (r) => fmtDate(r.date);

// id, icon, label, direction, and how to detect/format each record.
export const PB_DEFS = [
  { id: 'longest', icon: '🏃', label: 'Longest Run', dir: 'max',
    has: (r) => r.distance > 0, pick: (r) => r.distance,
    value: (r) => `${r.distance.toFixed(2)} mi`, sub: days },
  { id: 'fastest', icon: '⚡', label: 'Fastest Pace', dir: 'min',
    has: (r) => r.pace_seconds > 0, pick: (r) => r.pace_seconds,
    value: (r) => `${fmtPace(r.pace_seconds)}/mi`, sub: days },
  { id: 'elevation', icon: '⛰️', label: 'Most Elevation', dir: 'max',
    has: (r) => r.elevation_gain > 0, pick: (r) => r.elevation_gain,
    value: (r) => `${r.elevation_gain} ft`, sub: days },
  { id: 'hottest', icon: '🔥', label: 'Hottest Run', dir: 'max',
    has: (r) => r.temperature > 0, pick: (r) => r.temperature,
    value: (r) => `${r.temperature}°F`, sub: (r) => `${fmtPace(r.pace_seconds)}/mi · ${days(r)}` },
  { id: 'coldest', icon: '🧊', label: 'Coldest Run', dir: 'min',
    has: (r) => r.temperature > 0, pick: (r) => r.temperature,
    value: (r) => `${r.temperature}°F`, sub: (r) => `${fmtPace(r.pace_seconds)}/mi · ${days(r)}` },
  { id: 'hardest', icon: '💪', label: 'Hardest Run', dir: 'max',
    has: (r) => r.difficulty > 0, pick: (r) => r.difficulty,
    value: (r) => `${r.difficulty}/10`, sub: (r) => `${r.distance.toFixed(2)} mi · ${days(r)}` },
  { id: 'peakHr', icon: '❤️', label: 'Peak Heart Rate', dir: 'max',
    has: (r) => r.avg_hr > 0, pick: (r) => r.avg_hr,
    value: (r) => `${r.avg_hr} bpm`, sub: days },
  { id: 'calories', icon: '🔥', label: 'Most Calories', dir: 'max',
    has: (r) => r.calories > 0, pick: (r) => r.calories,
    value: (r) => `${r.calories} cal`, sub: days },
  // streak handled specially below
  { id: 'streak', icon: '🔥', label: 'Best Streak', dir: 'max' },
  { id: 'windiest', icon: '💨', label: 'Windiest Run', dir: 'max',
    has: (r) => r.wind_speed > 0, pick: (r) => r.wind_speed,
    value: (r) => `${r.wind_speed} mph`, sub: days },
  { id: 'humid', icon: '💧', label: 'Most Humid Run', dir: 'max',
    has: (r) => r.humidity > 0, pick: (r) => r.humidity,
    value: (r) => `${r.humidity}%`, sub: (r) => `${r.temperature}°F · ${days(r)}` },
];

function bestRun(runs, def) {
  const pool = runs.filter(def.has);
  if (!pool.length) return null;
  return pool.reduce((best, r) =>
    (def.dir === 'min' ? def.pick(r) < def.pick(best) : def.pick(r) > def.pick(best)) ? r : best);
}

// Returns { cards: [{id,icon,label,value,sub}], values: { id: numericForCompare } }
export function computePersonalBests(runs) {
  runs = asRuns(runs);
  const streaks = computeStreaks(runs);
  const cards = [];
  const values = {};

  for (const def of PB_DEFS) {
    if (def.id === 'streak') {
      if (runs.length) {
        values.streak = streaks.best;
        cards.push({
          id: 'streak',
          icon: def.icon,
          label: def.label,
          value: `${streaks.best} ${streaks.best === 1 ? 'day' : 'days'}`,
          sub: `Current: ${streaks.current} ${streaks.current === 1 ? 'day' : 'days'}`,
        });
      }
      continue;
    }
    const r = bestRun(runs, def);
    if (!r) continue;
    values[def.id] = def.pick(r);
    cards.push({ id: def.id, icon: def.icon, label: def.label, value: def.value(r), sub: def.sub(r) });
  }

  return { cards, values };
}

// Which records improved going from prevValues -> nextValues. A record with no
// previous value isn't counted (nothing to "beat" on the very first data point).
export function diffPersonalBests(prevValues, nextValues) {
  const beaten = [];
  for (const def of PB_DEFS) {
    const next = nextValues[def.id];
    const prev = prevValues[def.id];
    if (next == null || prev == null) continue;
    const improved = def.dir === 'min' ? next < prev : next > prev;
    if (improved) beaten.push({ id: def.id, label: def.label });
  }
  return beaten;
}
