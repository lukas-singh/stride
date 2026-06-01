import { useEffect, useMemo, useState } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import Layout from '../components/Layout.jsx';
import { CardSkeletonList } from '../components/Skeleton.jsx';
import { useToast } from '../components/Toast.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../api.js';
import { todayISO, fmtPace } from '../lib/format.js';

const MOODS = ['😫', '😕', '😐', '🙂', '😄'];

export function recoveryScore({ sleep_hours, resting_hr, soreness, mood, baseline = 60 }) {
  const sleepScore = sleep_hours >= 7 && sleep_hours <= 9 ? 100 : Math.max(0, 100 - Math.abs(8 - sleep_hours) * 18);
  // lower HR relative to personal baseline is better
  const hrScore = Math.max(0, Math.min(100, 100 - (resting_hr - baseline) * 4));
  const soreScore = ((10 - soreness) / 9) * 100;
  const moodScore = ((mood - 1) / 4) * 100;
  return Math.round(sleepScore * 0.4 + hrScore * 0.2 + soreScore * 0.2 + moodScore * 0.2);
}

function scoreColor(s) {
  if (s >= 70) return '#00F5A0';
  if (s >= 40) return '#FFD23F';
  return '#FF4D6D';
}

function Gauge({ score }) {
  const color = scoreColor(score);
  const r = 70;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - score / 100);
  return (
    <div className="relative w-44 h-44 mx-auto">
      <svg viewBox="0 0 160 160" className="w-full h-full -rotate-90">
        <circle cx="80" cy="80" r={r} fill="none" stroke="#1E1E2E" strokeWidth="12" />
        <circle
          cx="80" cy="80" r={r} fill="none" stroke={color} strokeWidth="12" strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.6s ease', filter: `drop-shadow(0 0 6px ${color})` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-extrabold tnum" style={{ color }}>{score}</span>
        <span className="text-xs text-muted">Recovery</span>
      </div>
    </div>
  );
}

function readiness(score) {
  if (score >= 70) return { color: '#00F5A0', label: 'Hard effort OK 💪', sub: "You're well recovered. Green light for quality work." };
  if (score >= 40) return { color: '#FFD23F', label: 'Easy run recommended', sub: 'Keep it conversational and listen to your body.' };
  return { color: '#FF4D6D', label: 'Rest day recommended', sub: 'Your body needs recovery. Prioritize sleep & hydration.' };
}

export default function Recovery() {
  const toast = useToast();
  const { user } = useAuth();
  const baseline = user?.resting_hr_baseline || 60;

  const [entries, setEntries] = useState(null);
  const [runs, setRuns] = useState([]);
  const [sleep, setSleep] = useState(7.5);
  const [rhr, setRhr] = useState(baseline);
  const [soreness, setSoreness] = useState(4);
  const [mood, setMood] = useState(4);
  const [hydration, setHydration] = useState(6);
  const [busy, setBusy] = useState(false);

  function reload() {
    api('/recovery').then(setEntries).catch(() => setEntries([]));
  }
  useEffect(() => {
    reload();
    api('/runs').then(setRuns).catch(() => setRuns([]));
  }, []);

  const liveScore = recoveryScore({ sleep_hours: sleep, resting_hr: rhr, soreness, mood, baseline });
  const ready = readiness(liveScore);

  // latest saved entry for headline gauge
  const latest = entries && entries.length ? entries[0] : null;
  const displayScore = latest ? latest.score : liveScore;

  // correlation: sleep hours vs next-day pace
  const corr = useMemo(() => {
    if (!entries) return [];
    const runByDate = {};
    for (const r of runs) (runByDate[r.date] ||= []).push(r);
    const rows = [];
    for (const e of entries) {
      const next = new Date(e.date + 'T00:00:00');
      next.setDate(next.getDate() + 1);
      const key = next.toISOString().slice(0, 10);
      const dayRuns = runByDate[key];
      if (dayRuns?.length) {
        const pace = Math.round(dayRuns.reduce((s, r) => s + r.pace_seconds, 0) / dayRuns.length);
        rows.push({ sleep: e.sleep_hours, pace, label: e.date.slice(5) });
      }
    }
    return rows.sort((a, b) => a.sleep - b.sleep).slice(-30);
  }, [entries, runs]);

  const weekly = useMemo(() => {
    if (!entries) return null;
    const weekAgo = Date.now() - 7 * 86400000;
    const week = entries.filter((e) => new Date(e.date + 'T00:00:00').getTime() >= weekAgo);
    if (!week.length) return null;
    const a = (k) => week.reduce((s, e) => s + e[k], 0) / week.length;
    return {
      count: week.length,
      score: Math.round(a('score')),
      sleep: a('sleep_hours').toFixed(1),
      rhr: Math.round(a('resting_hr')),
    };
  }, [entries]);

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await api('/recovery', {
        method: 'POST',
        body: {
          date: todayISO(),
          sleep_hours: sleep,
          resting_hr: rhr,
          soreness,
          mood,
          hydration,
          score: liveScore,
        },
      });
      toast.success('Recovery logged 🧘');
      reload();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (entries === null) {
    return <Layout title="Body & Recovery"><div className="mt-4"><CardSkeletonList count={3} height="h-40" /></div></Layout>;
  }

  return (
    <Layout title="Body & Recovery 🧘" subtitle="Recovery drives performance">
      {/* Gauge + readiness */}
      <div className="card p-5 mt-2">
        <Gauge score={displayScore} />
        <div className="mt-4 rounded-lg p-3 text-center" style={{ backgroundColor: `${ready.color}1A`, border: `1px solid ${ready.color}40` }}>
          <p className="font-bold" style={{ color: ready.color }}>{ready.label}</p>
          <p className="text-xs text-muted mt-0.5">{ready.sub}</p>
        </div>
      </div>

      {/* Log form */}
      <div className="card p-4 mt-4">
        <h2 className="font-semibold mb-1">Log Today</h2>
        <p className="text-xs text-muted mb-4">Live score: <span style={{ color: ready.color }} className="font-bold tnum">{liveScore}</span></p>
        <form onSubmit={save} className="space-y-5">
          <SliderRow label="Sleep" value={sleep} min={0} max={12} step={0.5} unit="hrs" onChange={setSleep} />
          <div>
            <label className="label">Resting HR (bpm) · baseline {baseline}</label>
            <input className="input tnum" type="number" inputMode="numeric" value={rhr} onChange={(e) => setRhr(parseInt(e.target.value, 10) || 0)} />
            <p className="text-[11px] text-muted mt-1">Best measured first thing in the morning before getting out of bed</p>
          </div>
          <SliderRow label="Soreness" value={soreness} min={1} max={10} step={1} unit="/10" onChange={setSoreness} />
          {/* Mood emoji */}
          <div>
            <label className="label">Mood</label>
            <div className="flex justify-between">
              {MOODS.map((m, i) => (
                <button
                  type="button"
                  key={i}
                  onClick={() => setMood(i + 1)}
                  className={`w-12 h-12 rounded-full text-2xl transition-all duration-150 ${mood === i + 1 ? 'bg-primary/20 scale-110 shadow-glow-sm' : 'opacity-50'}`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
          <SliderRow label="Hydration" value={hydration} min={0} max={12} step={1} unit="glasses" onChange={setHydration} />
          <button className="btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save Entry'}</button>
        </form>
      </div>

      {/* Weekly summary */}
      {weekly && (
        <div className="card p-4 mt-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted mb-3">This Week</h2>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div><p className="text-2xl font-bold tnum" style={{ color: scoreColor(weekly.score) }}>{weekly.score}</p><p className="text-xs text-muted">avg score</p></div>
            <div><p className="text-2xl font-bold tnum">{weekly.sleep}</p><p className="text-xs text-muted">avg sleep</p></div>
            <div><p className="text-2xl font-bold tnum">{weekly.rhr}</p><p className="text-xs text-muted">avg RHR</p></div>
          </div>
        </div>
      )}

      {/* Correlation chart */}
      <div className="card p-4 mt-4">
        <h3 className="font-semibold">Sleep vs. Next-Day Pace</h3>
        {corr.length < 2 ? (
          <p className="text-sm text-muted py-8 text-center">Log recovery + runs on back-to-back days to reveal the link.</p>
        ) : (
          <>
            <div className="mt-3 -ml-2" style={{ height: 200 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={corr}>
                  <CartesianGrid stroke="#1E1E2E" vertical={false} />
                  <XAxis dataKey="sleep" tick={{ fontSize: 11, fill: '#6B6B80' }} tickLine={false} axisLine={{ stroke: '#1E1E2E' }} unit="h" />
                  <YAxis tickFormatter={fmtPace} reversed domain={['dataMin - 15', 'dataMax + 15']} tick={{ fontSize: 11, fill: '#6B6B80' }} tickLine={false} axisLine={false} width={42} />
                  <Tooltip
                    contentStyle={{ background: '#13131A', border: '1px solid #1E1E2E', borderRadius: 8, fontSize: 12 }}
                    formatter={(v) => [`${fmtPace(v)}/mi`, 'Pace']}
                    labelFormatter={(l) => `${l} hrs sleep`}
                  />
                  <Line type="monotone" dataKey="pace" stroke="#7B61FF" strokeWidth={2.5} dot={{ r: 3, fill: '#7B61FF' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <p className="text-xs text-secondary mt-2">💡 More sleep generally precedes faster, fresher running.</p>
          </>
        )}
      </div>
    </Layout>
  );
}

function SliderRow({ label, value, min, max, step, unit, onChange }) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="label mb-0">{label}</label>
        <span className="text-sm font-bold tnum text-primary">{value} {unit}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full"
        style={{ background: `linear-gradient(to right, #00F5A0 0%, #00F5A0 ${pct}%, #1E1E2E ${pct}%, #1E1E2E 100%)` }}
      />
    </div>
  );
}
