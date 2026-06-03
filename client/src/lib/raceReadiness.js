// raceReadiness.js — physiology-aware fitness & race-readiness analysis.
// Core principle: pace only means something relative to RUN TYPE. Fitness is
// judged from HARD efforts (tempo/interval/race); easy/recovery paces are
// expected to be slow and are never penalized.
import { fmtPace, fmtDuration } from './format.js';
import { computeTrainingLoad } from './trainingLoad.js';

const DAY_MS = 86400000;
const HARD_TYPES = new Set(['Tempo', 'Interval', 'Race']);
const EASY_TYPES = new Set(['Easy', 'Recovery']);
const RACES = [
  { key: '5K', mi: 3.107 },
  { key: '10K', mi: 6.214 },
  { key: 'Half Marathon', mi: 13.109 },
  { key: 'Marathon', mi: 26.219 },
];

function ld(s) { return new Date(s + 'T00:00:00'); }
function localISO(d) { const o = d.getTimezoneOffset(); return new Date(d.getTime() - o * 60000).toISOString().slice(0, 10); }
function weekKey(s) { const d = ld(s); const m = new Date(d); m.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return localISO(m); }
function avg(a) { return a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0; }
function median(a) { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }

function asRuns(runs) {
  return (Array.isArray(runs) ? runs : []).filter(
    (r) => r && typeof r === 'object' && typeof r.date === 'string' && !Number.isNaN(ld(r.date).getTime())
  );
}
function sortAsc(runs) { return [...runs].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : (a.id || 0) - (b.id || 0))); }
function withinDays(runs, days) { const cut = Date.now() - days * DAY_MS; return runs.filter((r) => ld(r.date).getTime() >= cut); }

// pace trend (sec/week) via linear regression of pace vs day-offset
function paceTrendPerWeek(runs) {
  const pts = sortAsc(runs).filter((r) => r.pace_seconds > 0);
  if (pts.length < 3) return { slope: 0, label: 'flat', perWeek: 0 };
  const t0 = ld(pts[0].date).getTime();
  const xs = pts.map((r) => (ld(r.date).getTime() - t0) / DAY_MS);
  const ys = pts.map((r) => r.pace_seconds);
  const mx = avg(xs), my = avg(ys);
  let num = 0, den = 0;
  for (let i = 0; i < xs.length; i++) { num += (xs[i] - mx) * (ys[i] - my); den += (xs[i] - mx) ** 2; }
  const perDay = den ? num / den : 0;
  const perWeek = perDay * 7;
  const label = perWeek < -2 ? 'improving' : perWeek > 2 ? 'declining' : 'flat';
  return { slope: perWeek, label, perWeek: Math.round(Math.abs(perWeek)) };
}

function consistencyScore(runs) {
  // % of last 8 calendar weeks with 3+ runs
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const counts = {};
  for (const r of runs) counts[weekKey(r.date)] = (counts[weekKey(r.date)] || 0) + 1;
  let good = 0;
  for (let i = 0; i < 8; i++) {
    const wk = weekKey(localISO(new Date(today.getTime() - i * 7 * DAY_MS)));
    if ((counts[wk] || 0) >= 3) good += 1;
  }
  return Math.round((good / 8) * 100);
}

function weeklyMiles(runs, fromDays, toDays) {
  const now = Date.now();
  const lo = now - fromDays * DAY_MS, hi = now - toDays * DAY_MS;
  const sel = runs.filter((r) => { const t = ld(r.date).getTime(); return t >= lo && t < hi; });
  const miles = sel.reduce((s, r) => s + (r.distance || 0), 0);
  const weeks = (fromDays - toDays) / 7;
  return miles / weeks;
}

const TIERS = {
  Elite: { name: 'Elite Amateur', icon: '🥇', gradient: 'linear-gradient(135deg, rgba(255,215,0,0.22), rgba(255,107,43,0.14))', color: '#FFD700',
    description: 'Sub-7:00 fitness pace on high mileage with excellent consistency — you train like a competitive amateur.',
    focus: ['Sharpen with race-pace intervals while holding volume', 'Fine-tune pacing and race-day nutrition', 'Protect recovery to sustain peak fitness'] },
  Advanced: { name: 'Advanced', icon: '🏃', gradient: 'linear-gradient(135deg, rgba(123,97,255,0.25), rgba(255,107,43,0.12))', color: '#7B61FF',
    description: 'Strong, consistent training with quick paces. You have the engine to chase ambitious race goals.',
    focus: ['Add a weekly tempo/threshold session', 'Build one long run toward race distance', 'Dial in race-day fueling and pacing'] },
  Intermediate: { name: 'Intermediate', icon: '💪', gradient: 'linear-gradient(135deg, rgba(63,169,255,0.22), rgba(123,97,255,0.12))', color: '#3FA9FF',
    description: "You've built a real routine and solid fitness. Steady progression will unlock big gains.",
    focus: ['Increase weekly mileage ~10% per week', 'Introduce structured tempo runs', 'Keep easy days truly easy'] },
  Developing: { name: 'Developing', icon: '🌱', gradient: 'linear-gradient(135deg, rgba(0,201,122,0.22), rgba(63,169,255,0.12))', color: '#00C97A',
    description: 'Your fitness is on the rise. Consistency and easy aerobic miles are your biggest levers right now.',
    focus: ['Aim for 3-4 runs every week', 'Gradually extend your long run', 'Build easy aerobic miles before speed'] },
  Base: { name: 'Base Builder', icon: '🚶', gradient: 'linear-gradient(135deg, rgba(107,107,128,0.22), rgba(30,30,46,0.3))', color: '#6B6B80',
    description: "You're laying the foundation. Keep it easy and consistent — the fitness will follow.",
    focus: ['Establish a routine of 3 runs/week', 'Keep every run easy and conversational', 'Build to 8-10 miles/week before intensity'] },
};

function classifyTier(fitnessPace, weekly, consistency, totalRuns) {
  if (totalRuns < 5 || weekly < 8) return TIERS.Base;
  if (fitnessPace > 0 && fitnessPace < 420 && weekly >= 40 && consistency >= 80) return TIERS.Elite;
  if (fitnessPace > 0 && fitnessPace < 480 && weekly >= 25 && weekly <= 40 && consistency >= 70) return TIERS.Advanced;
  if (fitnessPace > 0 && fitnessPace < 570 && weekly >= 15 && weekly <= 25 && consistency >= 60) return TIERS.Intermediate;
  if (fitnessPace > 0 && fitnessPace < 660 && weekly >= 8 && weekly <= 15) return TIERS.Developing;
  // fall-throughs: pick the best-matching tier by mileage so fast-but-low-volume isn't mislabeled
  if (weekly >= 25 && consistency >= 60) return TIERS.Advanced;
  if (weekly >= 15) return TIERS.Intermediate;
  if (weekly >= 8) return TIERS.Developing;
  return TIERS.Base;
}

const READINESS_ZONES = [
  { max: 40, name: 'Not Ready', color: '#FF4D6D' },
  { max: 60, name: 'Getting There', color: '#FF6B2B' },
  { max: 80, name: 'On Track', color: '#7B61FF' },
  { max: 100, name: 'Race Ready', color: '#00C97A' },
];
function readinessZone(score) { const s = Math.max(0, Math.min(100, score)); return READINESS_ZONES.find((z) => s <= z.max) || READINESS_ZONES[3]; }

export function computeRaceReadiness(runsInput, opts = {}) {
  const runs = asRuns(runsInput);
  if (runs.length < 5) return { hasData: false, count: runs.length };

  const goal = opts.goal || null;
  const recovery = Array.isArray(opts.recovery) ? opts.recovery : [];
  const last30 = sortAsc(runs).slice(-30);
  const recent60 = withinDays(runs, 60);
  const last4w = withinDays(runs, 28);

  // ---- 1. fitness fingerprint ----
  const easy4w = last4w.filter((r) => EASY_TYPES.has(r.run_type) && r.pace_seconds > 0);
  const hardRuns = last30.filter((r) => HARD_TYPES.has(r.run_type) && r.pace_seconds > 0);
  const tempoRuns = last30.filter((r) => r.run_type === 'Tempo' && r.pace_seconds > 0);
  const longRuns = runs.filter((r) => r.distance >= 8 && r.pace_seconds > 0);

  const basePace = easy4w.length ? Math.round(median(easy4w.map((r) => r.pace_seconds))) : 0;
  const tempoPace = tempoRuns.length
    ? Math.round(median(tempoRuns.map((r) => r.pace_seconds)))
    : basePace ? basePace - 45 : 0;
  const longPace = longRuns.length ? Math.round(median(longRuns.map((r) => r.pace_seconds))) : 0;
  // fitness pace = hard efforts only (never easy paces)
  const fitnessPace = hardRuns.length ? Math.round(median(hardRuns.map((r) => r.pace_seconds))) : tempoPace;

  const hardTrend = paceTrendPerWeek(last30.filter((r) => HARD_TYPES.has(r.run_type)));
  const easyTrend = paceTrendPerWeek(last30.filter((r) => EASY_TYPES.has(r.run_type)));
  const overallTrend = paceTrendPerWeek(sortAsc(runs).slice(-20));

  const consistency = consistencyScore(runs);
  const wkRecent = weeklyMiles(runs, 28, 0);
  const wkPrior = weeklyMiles(runs, 56, 28);
  const mileageTrendPct = wkPrior > 0 ? Math.round(((wkRecent - wkPrior) / wkPrior) * 100) : 0;

  // ---- 2. race predictions (Riegel) ----
  const longestRecent = recent60.reduce((m, r) => Math.max(m, r.distance || 0), 0);
  const hardPool = recent60.filter((r) => HARD_TYPES.has(r.run_type) && r.pace_seconds > 0 && r.distance >= 1);
  const pool = (hardPool.length ? hardPool : recent60.filter((r) => r.pace_seconds > 0 && r.distance >= 1));
  let base = null;
  for (const r of pool) {
    const equiv5k = (r.duration_seconds || r.pace_seconds * r.distance) * Math.pow(3.107 / r.distance, 1.06);
    if (!base || equiv5k < base.equiv) base = { run: r, equiv: equiv5k, dist: r.distance, time: r.duration_seconds || r.pace_seconds * r.distance };
  }
  const predictions = RACES.map(({ key, mi }) => {
    if (!base || longestRecent < mi * 0.3) {
      const need = Math.max(1, Math.ceil(mi * 0.3 - longestRecent));
      return { dist: key, miles: mi, locked: true, needMiles: need };
    }
    const time = Math.round(base.time * Math.pow(mi / base.dist, 1.06));
    const conf = longestRecent >= mi * 0.8 ? 'High' : longestRecent >= mi * 0.5 ? 'Medium' : 'Low';
    return { dist: key, miles: mi, locked: false, time, confidence: conf };
  });

  // ---- 3. tier ----
  const tier = classifyTier(fitnessPace, wkRecent, consistency, runs.length);

  // ---- training load (for recovery/overtraining signals) ----
  const tl = computeTrainingLoad(runs);
  const recoveryScore = recovery.length ? Math.round(avg(recovery.slice(0, 14).map((r) => r.score || 0))) : null;
  const avgElev = avg(runs.map((r) => r.elevation_gain || 0));
  const noSpeedWork = !last4w.some((r) => r.run_type === 'Tempo' || r.run_type === 'Interval');
  const isHalfPlus = goal?.raceDistance === 'Half Marathon' || goal?.raceDistance === 'Marathon';
  const easyHardGap = basePace && tempoPace ? basePace - tempoPace : null; // positive = easy slower than tempo (good)

  // ---- 4. strengths & weaknesses ----
  const strengths = [];
  const weaknesses = [];
  if (wkRecent > 25) strengths.push({ label: 'Strong aerobic base', explanation: `You're averaging ${wkRecent.toFixed(0)} mi/week.`, suggestion: 'Keep this volume steady and add quality on top.' });
  if (consistency > 75) strengths.push({ label: 'Consistent trainer', explanation: `${consistency}% of recent weeks had 3+ runs.`, suggestion: 'Consistency is your superpower — protect the routine.' });
  if (hardTrend.label === 'improving' && hardTrend.perWeek > 5) strengths.push({ label: 'Improving pace', explanation: `Hard-effort pace is dropping ~${hardTrend.perWeek} sec/week.`, suggestion: "You're peaking — keep the momentum into race week." });
  if (recoveryScore != null && recoveryScore > 70) strengths.push({ label: 'Good recovery', explanation: `Avg recovery score ${recoveryScore}/100.`, suggestion: 'Well-recovered athletes absorb training best.' });
  if (avgElev > 200) strengths.push({ label: 'Handles elevation well', explanation: `Averaging ${Math.round(avgElev)} ft gain per run.`, suggestion: 'Hill strength translates to flat-course speed.' });
  if (easyHardGap != null && easyHardGap >= 60) strengths.push({ label: 'Smart easy/hard separation', explanation: `Easy runs are ~${easyHardGap}s/mi slower than tempo.`, suggestion: 'This polarized approach maximizes adaptation.' });

  if (wkRecent < 15 && isHalfPlus) weaknesses.push({ label: 'Low weekly mileage', explanation: `${wkRecent.toFixed(0)} mi/week is light for a ${goal.raceDistance}.`, suggestion: 'Build toward 25-35 mi/week before race day.' });
  if (consistency < 50) weaknesses.push({ label: 'Inconsistent training', explanation: `Only ${consistency}% of recent weeks had 3+ runs.`, suggestion: 'Aim for 3 runs every week, even short ones.' });
  if (overallTrend.label === 'declining') weaknesses.push({ label: 'Pace declining', explanation: `Pace is slowing ~${overallTrend.perWeek} sec/week.`, suggestion: 'Take an easy week — this is often fatigue.' });
  if (longestRecent < 8) weaknesses.push({ label: 'Low long run distance', explanation: `Longest recent run is ${longestRecent.toFixed(1)} mi.`, suggestion: 'Extend your weekend run gradually.' });
  if (noSpeedWork) weaknesses.push({ label: 'No speed work', explanation: 'No tempo or interval runs in the last 4 weeks.', suggestion: 'Add one tempo session weekly to build threshold.' });
  if (tl.atl > 80) weaknesses.push({ label: 'Overtraining risk', explanation: `Acute load (ATL) is high at ${tl.atl}.`, suggestion: 'Prioritize recovery before adding more stress.' });
  if (easyHardGap != null && easyHardGap < 30 && basePace > 0) weaknesses.push({ label: 'Easy days too hard', explanation: `Easy pace is only ${Math.max(0, easyHardGap)}s/mi off tempo.`, suggestion: 'Slow easy days 60-90s/mi to recover and avoid injury.' });

  // ---- 5. readiness score ----
  const goalMi = goal?.raceDistance ? (RACES.find((r) => r.key === goal.raceDistance)?.mi || 13.109) : 13.109;
  const targetWeekly = { 3.107: 15, 6.214: 20, 13.109: 30, 26.219: 40 }[goalMi] || 25;
  const mileageAdq = Math.max(0, Math.min(1, wkRecent / targetWeekly)) * 100;
  const goalPace = goal?.targetPaceSeconds || null;
  const paceAdq = goalPace && fitnessPace ? Math.max(0, Math.min(100, (goalPace / fitnessPace) * 100)) : 65;
  const recoveryAdq = Math.max(0, Math.min(100, ((tl.tsb + 20) / 35) * 100));
  const longAdq = Math.max(0, Math.min(100, (longestRecent / (goalMi * 0.75)) * 100));
  const readinessScore = Math.round(
    mileageAdq * 0.30 + paceAdq * 0.25 + consistency * 0.25 + recoveryAdq * 0.10 + longAdq * 0.10
  );
  const zone = readinessZone(readinessScore);

  // ---- pace trend chart data (last 20 runs, hard vs easy series) ----
  const chart = sortAsc(runs).slice(-20).map((r, i) => ({
    idx: i + 1,
    label: r.date.slice(5),
    hard: HARD_TYPES.has(r.run_type) ? r.pace_seconds : null,
    easy: EASY_TYPES.has(r.run_type) ? r.pace_seconds : null,
    pace: r.pace_seconds,
  }));

  // ---- natural-language summaries ----
  const summaries = {};
  summaries.fitness = hardTrend.label === 'improving'
    ? `Your hard-effort pace has improved by ${hardTrend.perWeek} sec/mile per week — you're sharpening up at the right time.`
    : hardTrend.label === 'declining'
      ? `Warning: your recent hard runs show a pace decline of ${hardTrend.perWeek} sec/week. Consider an easy week to recover.`
      : `Your hard-effort pace is holding steady around ${fmtPace(fitnessPace)}/mi — a stable base to build from.`;
  summaries.mileage = isHalfPlus
    ? `At ${wkRecent.toFixed(0)} mi/week you're ${wkRecent >= targetWeekly ? 'right where you need to be' : `building toward the ${targetWeekly}+ mi/week ideal`} for your ${goal.raceDistance}.`
    : `You're averaging ${wkRecent.toFixed(0)} mi/week${mileageTrendPct ? `, ${mileageTrendPct > 0 ? 'up' : 'down'} ${Math.abs(mileageTrendPct)}% vs the prior month` : ''}.`;
  summaries.consistency = consistency >= 75
    ? `Your consistency score of ${consistency}% is excellent — athletes who train this regularly see the biggest race-day gains.`
    : consistency >= 50
      ? `A ${consistency}% consistency score is a solid base; nudging it higher will accelerate your progress.`
      : `Your ${consistency}% consistency is the biggest opportunity — aim for 3 runs every week.`;
  summaries.readiness = `You're scoring ${readinessScore}/100 — ${zone.name.toLowerCase()}. ${zone.name === 'Race Ready' ? 'Fitness, freshness and consistency are all aligned.' : 'Focus on your weaknesses below to climb higher.'}`;

  return {
    hasData: true,
    count: runs.length,
    fingerprint: { basePace, tempoPace, longPace, fitnessPace, hardTrend, easyTrend, overallTrend, consistency, mileageTrendPct, weeklyMiles: +wkRecent.toFixed(1) },
    predictions,
    tier,
    strengths: strengths.slice(0, 3),
    weaknesses: weaknesses.slice(0, 3),
    readiness: { score: readinessScore, zone },
    chart,
    goalPace,
    recoveryScore,
    summaries,
  };
}

export { fmtPace, fmtDuration };
