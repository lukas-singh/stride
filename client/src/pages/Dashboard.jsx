import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout.jsx';
import StatCard from '../components/StatCard.jsx';
import RunCard from '../components/RunCard.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { StatSkeletonGrid, CardSkeletonList } from '../components/Skeleton.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../api.js';
import { fmtDuration, fmtPace, fmtDate, relativeDay } from '../lib/format.js';
import { weatherIcon } from '../lib/weather.js';

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

// Stats for runs in a rolling window [fromDaysAgo, toDaysAgo) days back.
function windowStats(runs, fromDaysAgo, toDaysAgo) {
  const now = Date.now();
  const lo = now - fromDaysAgo * 86400000;
  const hi = now - toDaysAgo * 86400000;
  const w = runs.filter((r) => {
    const t = new Date(r.date + 'T00:00:00').getTime();
    return t >= lo && t < hi;
  });
  const miles = w.reduce((s, r) => s + r.distance, 0);
  const seconds = w.reduce((s, r) => s + r.duration_seconds, 0);
  const avgPace = miles > 0 ? Math.round(seconds / miles) : 0;
  return { miles, runs: w.length, seconds, avgPace };
}

// Compare current vs previous; lowerIsBetter flips which direction is "good".
function trendOf(cur, prev, lowerIsBetter = false) {
  if (!prev || cur === prev) return { dir: 'flat', tone: 'neutral' };
  const up = cur > prev;
  const good = lowerIsBetter ? !up : up;
  return { dir: up ? 'up' : 'down', tone: good ? 'good' : 'bad' };
}

export default function Dashboard() {
  const { user } = useAuth();
  const [runs, setRuns] = useState(null);
  const [goal, setGoal] = useState(undefined);

  useEffect(() => {
    api('/runs').then(setRuns).catch(() => setRuns([]));
    api('/goals').then(setGoal).catch(() => setGoal(null));
  }, []);

  const firstName = (user?.display_name || '').split(' ')[0];
  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

  const loading = runs === null;
  const stats = loading ? null : windowStats(runs, 7, 0);
  const prev = loading ? null : windowStats(runs, 14, 7);
  const recent = loading ? [] : runs.slice(0, 5);
  const lastRun = loading || !runs.length ? null : runs[0];

  const trends = stats && prev ? {
    miles: trendOf(stats.miles, prev.miles),
    runs: trendOf(stats.runs, prev.runs),
    pace: trendOf(stats.avgPace, prev.avgPace, true),
    time: trendOf(stats.seconds, prev.seconds),
  } : {};

  return (
    <Layout title={`${greeting()}, ${firstName} 👋`} subtitle={today}>
      {/* Weekly summary */}
      <section className="mt-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted mb-2">This Week</h2>
        {loading ? (
          <StatSkeletonGrid />
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Total Miles" value={stats.miles.toFixed(1)} unit="mi" accent="#00F5A0" trend={trends.miles?.dir} trendTone={trends.miles?.tone} />
            <StatCard label="Total Runs" value={stats.runs} unit="runs" trend={trends.runs?.dir} trendTone={trends.runs?.tone} />
            <StatCard label="Avg Pace" value={fmtPace(stats.avgPace)} unit="/mi" accent="#7B61FF" trend={trends.pace?.dir} trendTone={trends.pace?.tone} />
            <StatCard label="Total Time" value={fmtDuration(stats.seconds)} trend={trends.time?.dir} trendTone={trends.time?.tone} />
          </div>
        )}
      </section>

      {/* Last run banner */}
      {!loading && lastRun && (
        <Link to={`/runs/${lastRun.id}`} className="card card-press mt-3 px-4 py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted shrink-0">Last Run</span>
            {lastRun.weather_condition && <span title={lastRun.weather_condition}>{weatherIcon(lastRun.weather_condition)}</span>}
          </div>
          <div className="flex items-center gap-3 text-sm tnum shrink-0">
            <span className="font-bold text-txt">{lastRun.distance.toFixed(2)} mi</span>
            <span className="text-secondary font-semibold">{fmtPace(lastRun.pace_seconds)}/mi</span>
            <span className="text-muted">{relativeDay(lastRun.date)}</span>
          </div>
        </Link>
      )}

      {/* Goal progress */}
      {!loading && <GoalBanner goal={goal} runs={runs} />}

      {/* Recent runs */}
      <section className="mt-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Recent Runs</h2>
          {!loading && runs.length > 0 && (
            <Link to="/analytics" className="text-xs text-primary font-semibold">View stats →</Link>
          )}
        </div>
        {loading ? (
          <CardSkeletonList count={4} />
        ) : recent.length === 0 ? (
          <EmptyState
            icon="👟"
            title="No runs yet"
            message="Log your first run to bring your dashboard to life."
            ctaLabel="Log Today's Run →"
            ctaTo="/log"
          />
        ) : (
          <div className="space-y-3">
            {recent.map((r) => (
              <RunCard key={r.id} run={r} />
            ))}
          </div>
        )}
      </section>

      {/* Quick log FAB-style button */}
      {!loading && recent.length > 0 && (
        <Link
          to="/log"
          className="btn-primary mt-6 flex items-center justify-center text-base"
        >
          Log Today's Run →
        </Link>
      )}
    </Layout>
  );
}

function GoalBanner({ goal, runs }) {
  if (!goal || !goal.target_date) return null;

  const target = new Date(goal.target_date + 'T00:00:00');
  const daysRemaining = Math.max(0, Math.round((target - Date.now()) / 86400000));
  const totalWeeks = goal.weeks_remaining || 1;
  const weeksLeft = Math.max(0, Math.round(daysRemaining / 7));
  const progress = Math.min(100, Math.max(0, Math.round(((totalWeeks - weeksLeft) / totalWeeks) * 100)));

  return (
    <Link to="/coach" className="block mt-4 card card-press p-4 border-secondary/40">
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-secondary">Active Goal</p>
          <p className="font-semibold text-txt mt-0.5 truncate">
            {goal.race_distance || 'Race'} · {fmtDate(goal.target_date, { month: 'short', day: 'numeric' })}
          </p>
        </div>
        <span className="text-2xl font-bold tnum text-secondary">{progress}%</span>
      </div>
      <div className="mt-3 h-2 rounded-full bg-bg overflow-hidden">
        <div className="h-full rounded-full bg-secondary" style={{ width: `${progress}%` }} />
      </div>
      <p className="text-xs text-muted mt-2">{daysRemaining} days remaining</p>
    </Link>
  );
}
