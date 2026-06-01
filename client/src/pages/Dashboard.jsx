import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout.jsx';
import StatCard from '../components/StatCard.jsx';
import RunCard from '../components/RunCard.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { StatSkeletonGrid, CardSkeletonList } from '../components/Skeleton.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../api.js';
import { fmtDuration, fmtPace, fmtDate } from '../lib/format.js';

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function weeklyStats(runs) {
  const weekAgo = Date.now() - 7 * 86400000;
  const week = runs.filter((r) => new Date(r.date + 'T00:00:00').getTime() >= weekAgo);
  const miles = week.reduce((s, r) => s + r.distance, 0);
  const seconds = week.reduce((s, r) => s + r.duration_seconds, 0);
  const avgPace = miles > 0 ? Math.round(seconds / miles) : 0;
  return { miles, runs: week.length, seconds, avgPace };
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
  const stats = loading ? null : weeklyStats(runs);
  const recent = loading ? [] : runs.slice(0, 5);

  return (
    <Layout title={`${greeting()}, ${firstName} 👋`} subtitle={today}>
      {/* Weekly summary */}
      <section className="mt-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted mb-2">This Week</h2>
        {loading ? (
          <StatSkeletonGrid />
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Total Miles" value={stats.miles.toFixed(1)} unit="mi" accent="#00F5A0" />
            <StatCard label="Total Runs" value={stats.runs} unit="runs" />
            <StatCard label="Avg Pace" value={fmtPace(stats.avgPace)} unit="/mi" accent="#7B61FF" />
            <StatCard label="Total Time" value={fmtDuration(stats.seconds)} />
          </div>
        )}
      </section>

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
    <Link to="/coach" className="block mt-4 card p-4 border-secondary/40 shadow-glow-purple/0">
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
