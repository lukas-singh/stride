import { useEffect, useMemo, useState } from 'react';
import Layout from '../components/Layout.jsx';
import { CardSkeletonList } from '../components/Skeleton.jsx';
import { api } from '../api.js';
import { fmtDate } from '../lib/format.js';
import { computeAchievements, ACHIEVEMENT_CATEGORIES } from '../lib/achievements.js';

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'unlocked', label: 'Unlocked' },
  { key: 'locked', label: 'Locked' },
];

function fmtNum(n) {
  return Math.round(n).toLocaleString();
}

function fraction(a) {
  if (a.unlocked) return 1;
  if (a.progress != null) return Math.max(0, Math.min(1, a.progress));
  if (a.target > 0) return Math.max(0, Math.min(1, a.current / a.target));
  return 0;
}

function AchievementCard({ a }) {
  const pct = Math.round(fraction(a) * 100);
  const lockedLabel = a.detail
    ? a.detail
    : a.target > 1
      ? `${fmtNum(a.current)} / ${fmtNum(a.target)} ${a.unit}`.trim()
      : a.desc;

  return (
    <div
      className={`card card-press p-4 flex flex-col h-full ${
        a.unlocked ? 'border-primary/50 shadow-glow-sm' : 'opacity-60'
      }`}
    >
      <div className="text-center">
        <div className={`text-4xl ${a.unlocked ? '' : 'grayscale blur-[1px] opacity-70'}`}>{a.icon}</div>
        <p className={`font-display font-bold text-sm mt-2 leading-tight ${a.unlocked ? 'text-txt' : 'text-muted'}`}>
          {a.name}
        </p>
      </div>

      {a.unlocked ? (
        <div className="mt-2 text-center flex-1 flex flex-col justify-end">
          <p className="text-xs text-primary font-semibold">{a.detail || a.desc}</p>
          {a.dateUnlocked && (
            <p className="text-[10px] text-muted mt-1">Unlocked {fmtDate(a.dateUnlocked, { month: 'short', day: 'numeric', year: 'numeric' })}</p>
          )}
        </div>
      ) : (
        <div className="mt-2 flex-1 flex flex-col justify-end">
          <p className="text-[11px] text-muted text-center mb-1.5 leading-tight">{lockedLabel}</p>
          <div className="h-1.5 rounded-full bg-bg overflow-hidden">
            <div className="h-full rounded-full bg-muted" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}
    </div>
  );
}

export default function Achievements() {
  const [runs, setRuns] = useState(null);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    api('/runs').then(setRuns).catch(() => setRuns([]));
  }, []);

  const achievements = useMemo(() => (runs ? computeAchievements(runs) : []), [runs]);
  const unlockedCount = achievements.filter((a) => a.unlocked).length;
  const total = achievements.length;
  const overallPct = total ? Math.round((unlockedCount / total) * 100) : 0;

  const visible = useMemo(
    () => achievements.filter((a) => (filter === 'all' ? true : filter === 'unlocked' ? a.unlocked : !a.unlocked)),
    [achievements, filter]
  );

  if (runs === null) {
    return <Layout title="Achievements 🏆"><div className="mt-4"><CardSkeletonList count={4} height="h-40" /></div></Layout>;
  }

  return (
    <Layout title="Achievements 🏆">
      {/* Overall progress */}
      <div className="card p-4 mt-2 border-l-[3px] border-l-primary">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted">Unlocked</span>
          <span className="text-lg font-bold tnum text-primary">{unlockedCount} / {total}</span>
        </div>
        <div className="mt-3 h-2.5 rounded-full bg-bg overflow-hidden">
          <div className="h-full rounded-full bg-primary shadow-glow-sm transition-all duration-500" style={{ width: `${overallPct}%` }} />
        </div>
        <p className="text-[11px] text-muted mt-1.5 tnum">{overallPct}% complete</p>
      </div>

      {/* Filter tabs */}
      <div className="flex bg-surface border border-border rounded-lg p-1 mt-4 sticky top-[68px] z-20">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`flex-1 min-h-[40px] rounded-md text-sm font-semibold transition-all duration-150 ${
              filter === f.key ? 'bg-primary text-bg shadow-glow-sm' : 'text-muted'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Grouped grid */}
      <div className="mt-4 space-y-6">
        {ACHIEVEMENT_CATEGORIES.map((cat) => {
          const items = visible.filter((a) => a.category === cat);
          if (!items.length) return null;
          const catUnlocked = achievements.filter((a) => a.category === cat && a.unlocked).length;
          const catTotal = achievements.filter((a) => a.category === cat).length;
          return (
            <section key={cat}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="w-1 h-4 rounded-full bg-primary shadow-glow-sm" />
                  <h2 className="text-xs font-bold uppercase tracking-widest text-muted">{cat}</h2>
                </div>
                <span className="text-[11px] text-muted tnum">{catUnlocked}/{catTotal}</span>
              </div>
              <div className="grid grid-cols-2 gap-3 items-stretch">
                {items.map((a) => <AchievementCard key={a.id} a={a} />)}
              </div>
            </section>
          );
        })}
        {visible.length === 0 && (
          <p className="text-center text-sm text-muted py-10">
            {filter === 'unlocked' ? 'No achievements unlocked yet — get out for a run! 🏃' : 'Nothing here.'}
          </p>
        )}
      </div>
    </Layout>
  );
}
