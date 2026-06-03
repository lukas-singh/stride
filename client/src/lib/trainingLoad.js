// trainingLoad.js — client-side training-load model (Banister-style EWMA).
// All values derive purely from the user's run array. No backend.

const DAY_MS = 86400000;
const ALPHA_ATL = 1 - Math.exp(-1 / 7);   // acute (fatigue), 7-day time constant
const ALPHA_CTL = 1 - Math.exp(-1 / 42);  // chronic (fitness), 42-day time constant

function asRuns(runs) {
  return (Array.isArray(runs) ? runs : []).filter(
    (r) => r && typeof r === 'object' && typeof r.date === 'string' && !Number.isNaN(new Date(r.date + 'T00:00:00').getTime())
  );
}
function ld(s) { return new Date(s + 'T00:00:00'); }
function localISO(d) {
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
}
function weekKey(dateStr) {
  const d = ld(dateStr);
  const monday = new Date(d);
  monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return localISO(monday);
}

// Training Stress Score for a single run (capped at 200).
export function runTSS(r) {
  const distance = r.distance || 0;
  const difficulty = r.difficulty || 5;
  const hrMult = r.avg_hr > 0 ? r.avg_hr / 150 : 1.0;
  const durMult = (r.duration_seconds || 0) / 3600;
  return Math.min(200, distance * difficulty * hrMult * durMult);
}

// Weekly total TSS, ascending by week start (Monday).
export function computeWeeklyTSS(runs) {
  const map = {};
  for (const r of asRuns(runs)) {
    const k = weekKey(r.date);
    map[k] = (map[k] || 0) + runTSS(r);
  }
  return Object.keys(map).sort().map((weekStart) => ({ weekStart, tss: Math.round(map[weekStart]) }));
}

export const LOAD_ZONES = [
  { max: 20, name: 'Detrained', color: '#6B6B80', desc: 'Not enough training stimulus. Time to build some consistency.' },
  { max: 40, name: 'Base Building', color: '#3FA9FF', desc: 'A light, manageable load — good for building an aerobic base.' },
  { max: 60, name: 'Optimal', color: '#00C97A', desc: 'Right in the ideal training zone. Fitness is building sustainably.' },
  { max: 80, name: 'High Load', color: '#FF6B2B', desc: "You're working hard. Monitor recovery closely and fuel well." },
  { max: 100, name: 'Overreaching', color: '#FF4D6D', desc: 'Very high load — prioritize recovery to avoid burnout or injury.' },
];

export function getLoadZone(score) {
  const s = Math.max(0, Math.min(100, score || 0));
  return LOAD_ZONES.find((z) => s <= z.max) || LOAD_ZONES[LOAD_ZONES.length - 1];
}

export function getReadyToRace(tsb) {
  if (tsb > 15) return { label: 'Peak Form', emoji: '🏆', color: '#00C97A', paragraph: "You're rested and sharp. This is a great time to race or chase a PR." };
  if (tsb >= 5) return { label: 'Race Ready', emoji: '✅', color: '#00C97A', paragraph: 'Freshness is good and fitness is intact — you could race well right now.' };
  if (tsb >= 0) return { label: 'Almost There', emoji: '🔄', color: '#FF9F40', paragraph: 'Nearly fresh. A couple of easy days would tip you into race-ready form.' };
  if (tsb >= -10) return { label: 'Fatigued', emoji: '😓', color: '#FF6B2B', paragraph: "You're carrying fatigue from recent training. Keep building, but watch recovery." };
  return { label: 'Overreached', emoji: '⚠️', color: '#FF4D6D', paragraph: 'Fatigue is high relative to fitness. Back off and let your body absorb the work.' };
}

// Main model. Returns current values, a daily ATL/CTL/TSB series, weekly TSS,
// the normalized 0-100 score, zone, readiness and helpful derived numbers.
export function computeTrainingLoad(runsInput) {
  const runs = asRuns(runsInput);
  if (!runs.length) {
    return { hasData: false, count: 0, series: [], weekly: [], atl: 0, ctl: 0, tsb: 0, score: 0, ratio: 0 };
  }

  // daily TSS map
  const daily = {};
  for (const r of runs) daily[r.date] = (daily[r.date] || 0) + runTSS(r);

  const dates = runs.map((r) => r.date).sort();
  const start = ld(dates[0]);
  const today = new Date(); today.setHours(0, 0, 0, 0);

  const series = [];
  let atl = 0, ctl = 0;
  for (let t = start.getTime(); t <= today.getTime(); t += DAY_MS) {
    const key = localISO(new Date(t));
    const tss = daily[key] || 0;
    atl += (tss - atl) * ALPHA_ATL;
    ctl += (tss - ctl) * ALPHA_CTL;
    series.push({ date: key, atl: +atl.toFixed(1), ctl: +ctl.toFixed(1), tsb: +(ctl - atl).toFixed(1) });
  }

  const last = series[series.length - 1];
  const weekAgo = series.length >= 8 ? series[series.length - 8] : series[0];
  const maxAtl = series.reduce((m, s) => Math.max(m, s.atl), 0) || 1;
  const score = Math.round(Math.max(0, Math.min(100, (last.atl / maxAtl) * 100)));
  const ratio = last.ctl > 0 ? +(last.atl / last.ctl).toFixed(2) : 0;

  const weekly = computeWeeklyTSS(runs);
  const thisWeekKey = weekKey(localISO(today));
  const lastWeekKey = weekKey(localISO(new Date(today.getTime() - 7 * DAY_MS)));
  const thisWeekTSS = weekly.find((w) => w.weekStart === thisWeekKey)?.tss || 0;
  const lastWeekTSS = weekly.find((w) => w.weekStart === lastWeekKey)?.tss || 0;

  // optimal weekly TSS = average of the best 4 weeks
  const bestWeeks = [...weekly].sort((a, b) => b.tss - a.tss).slice(0, 4);
  const optimalWeekly = bestWeeks.length ? Math.round(bestWeeks.reduce((s, w) => s + w.tss, 0) / bestWeeks.length) : 0;

  // estimate rest days needed to reach race-ready form (TSB >= 5)
  const tsbGainPerRestDay = last.atl * ALPHA_ATL - last.ctl * ALPHA_CTL;
  let daysToForm = 0;
  if (last.tsb < 5 && tsbGainPerRestDay > 0.1) {
    daysToForm = Math.ceil((5 - last.tsb) / tsbGainPerRestDay);
  }

  return {
    hasData: true,
    count: runs.length,
    series,
    weekly,
    atl: Math.round(last.atl),
    ctl: Math.round(last.ctl),
    tsb: Math.round(last.tsb),
    atlPrev: Math.round(weekAgo.atl),
    ctlPrev: Math.round(weekAgo.ctl),
    tsbPrev: Math.round(weekAgo.tsb),
    score,
    maxAtl: +maxAtl.toFixed(1),
    ratio,
    thisWeekTSS,
    lastWeekTSS,
    optimalWeekly,
    daysToForm,
    zone: getLoadZone(score),
    readiness: getReadyToRace(Math.round(last.tsb)),
  };
}
