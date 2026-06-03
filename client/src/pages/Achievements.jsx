import { useEffect, useMemo, useState } from 'react';
import Layout from '../components/Layout.jsx';
import { CardSkeletonList } from '../components/Skeleton.jsx';
import { api } from '../api.js';
import { fmtDate } from '../lib/format.js';
import { computeAchievements, ACHIEVEMENT_CATEGORIES } from '../lib/achievements.js';

const RARITY_COLORS = {
  Common: '#6B6B80',
  Rare: '#3FA9FF',
  Epic: '#7B61FF',
  Legendary: '#FF6B2B',
};

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
  const [flipped, setFlipped] = useState(false);
  const pct = Math.round(fraction(a) * 100);
  const rarityColor = RARITY_COLORS[a.rarity] || '#6B6B80';
  const lockedLabel = a.detail
    ? a.detail
    : a.target > 1
      ? `${fmtNum(a.current)} / ${fmtNum(a.target)} ${a.unit}`.trim()
      : a.desc;

  return (
    <div className={`flip-card card-press h-44 ${flipped ? 'flipped' : ''}`} onClick={() => setFlipped((f) => !f)}>
      <div className="flip-card-inner">
        {/* FRONT */}
        <div
          className={`flip-face card p-3 items-center justify-center text-center ${a.unlocked ? 'border-primary/50 shadow-glow-sm' : 'opacity-70'}`}
        >
          <div className={`text-5xl ${a.unlocked ? '' : 'grayscale blur-[1.5px] opacity-70'}`}>{a.icon}</div>
          <p className={`font-display font-bold text-sm mt-2 leading-tight ${a.unlocked ? 'text-txt' : 'text-muted'}`}>{a.name}</p>
          <span
            className="chip text-[9px] py-0 mt-2"
            style={{ color: rarityColor, backgroundColor: `${rarityColor}1A`, border: `1px solid ${rarityColor}40` }}
          >
            {a.rarity}
          </span>
          <p className={`text-[9px] mt-1 font-semibold ${a.unlocked ? 'text-primary' : 'text-muted'}`}>
            {a.unlocked ? 'UNLOCKED' : 'LOCKED'}
          </p>
        </div>

        {/* BACK */}
        <div
          className={`flip-face flip-back card p-3 justify-between text-center ${a.unlocked ? '' : ''}`}
          style={a.unlocked ? { background: 'linear-gradient(140deg, rgba(123,97,255,0.18), rgba(255,107,43,0.10))', borderColor: 'rgba(123,97,255,0.4)' } : undefined}
        >
          <div>
            <p className="font-display font-bold text-xs text-txt leading-tight">{a.name}</p>
            <p className="text-[10px] text-muted mt-1 leading-snug">{a.desc}</p>
          </div>
          {a.unlocked ? (
            <div>
              {a.detail && <p className="text-[11px] text-primary font-semibold">{a.detail}</p>}
              {a.dateUnlocked && <p className="text-[9px] text-muted mt-0.5">{fmtDate(a.dateUnlocked, { month: 'short', day: 'numeric', year: 'numeric' })}</p>}
            </div>
          ) : (
            <div>
              <p className="text-[10px] text-muted mb-1">{lockedLabel}</p>
              <div className="h-1.5 rounded-full bg-bg overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: rarityColor }} />
              </div>
            </div>
          )}
          <span className="text-[8px] uppercase tracking-widest text-muted">{a.category}</span>
        </div>
      </div>
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
