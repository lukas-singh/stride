import { useEffect, useMemo, useState } from 'react';
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, Cell,
} from 'recharts';
import Layout from '../components/Layout.jsx';
import StatCard from '../components/StatCard.jsx';
import LoadGauge from '../components/LoadGauge.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { CardSkeletonList } from '../components/Skeleton.jsx';
import { api } from '../api.js';
import { fmtDate } from '../lib/format.js';
import { computeTrainingLoad } from '../lib/trainingLoad.js';

const AXIS = { fontSize: 11, fill: '#6B6B80' };
const GRID = '#1E1E2E';
const RANGES = [{ key: '7D', days: 7 }, { key: '4W', days: 28 }, { key: '12W', days: 84 }];

function trendOf(cur, prev, lowerIsBetter = false) {
  if (prev == null || cur === prev) return { dir: 'flat', tone: 'neutral' };
  const up = cur > prev;
  const good = lowerIsBetter ? !up : up;
  return { dir: up ? 'up' : 'down', tone: good ? 'good' : 'bad' };
}

function DarkTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="card px-3 py-2 text-xs shadow-lg">
      {label != null && <p className="text-muted mb-1">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} className="font-semibold tnum" style={{ color: p.color }}>{p.name}: {Math.round(p.value)}</p>
      ))}
    </div>
  );
}

function SectionHeader({ children }) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <span className="w-1 h-4 rounded-full bg-primary shadow-glow-sm" />
      <h2 className="text-xs font-bold uppercase tracking-widest text-muted">{children}</h2>
    </div>
  );
}

export default function TrainingLoad() {
  const [runs, setRuns] = useState(null);
  const [range, setRange] = useState('4W');

  useEffect(() => {
    api('/runs').then(setRuns).catch(() => setRuns([]));
  }, []);

  const tl = useMemo(() => (runs ? computeTrainingLoad(runs) : null), [runs]);

  if (runs === null) {
    return <Layout title="Training Load 🔥"><div className="mt-4"><CardSkeletonList count={4} height="h-32" /></div></Layout>;
  }

  if (!tl.hasData || tl.count < 7) {
    return (
      <Layout title="Training Load 🔥">
        <div className="mt-4">
          <EmptyState
            icon="🔥"
            title="Not enough data yet"
            message="Log at least 7 runs to unlock Training Load insights — fitness, fatigue, form and race readiness."
            ctaLabel="Log a Run →"
            ctaTo="/log"
          />
        </div>
      </Layout>
    );
  }

  const days = RANGES.find((r) => r.key === range).days;
  const curve = tl.series.slice(-days).map((s) => ({
    date: fmtDate(s.date, { month: 'numeric', day: 'numeric' }),
    ATL: s.atl, CTL: s.ctl, TSB: s.tsb,
  }));

  const weekly8 = tl.weekly.slice(-8).map((w) => ({
    week: fmtDate(w.weekStart, { month: 'short', day: 'numeric' }),
    tss: w.tss,
  }));

  const ctlTrend = trendOf(tl.ctl, tl.ctlPrev);
  const atlTrend = trendOf(tl.atl, tl.atlPrev);
  const tssTrend = trendOf(tl.thisWeekTSS, tl.lastWeekTSS);

  // ATL:CTL ratio marker (scale 0–2)
  const ratioPct = Math.max(0, Math.min(100, (tl.ratio / 2) * 100));
  const ratioInfo = tl.ratio < 0.8
    ? { label: 'Undertraining', color: '#6B6B80' }
    : tl.ratio <= 1.3
      ? { label: 'Sweet spot', color: '#00C97A' }
      : { label: 'Overreaching', color: '#FF4D6D' };

  return (
    <Layout title="Training Load 🔥">
      {/* range toggle */}
      <div className="flex bg-surface border border-border rounded-lg p-1 mt-2">
        {RANGES.map((r) => (
          <button
            key={r.key}
            onClick={() => setRange(r.key)}
            className={`flex-1 min-h-[40px] rounded-md text-sm font-semibold transition-all duration-150 ${
              range === r.key ? 'bg-primary text-bg shadow-glow-sm' : 'text-muted'
            }`}
          >
            {r.key}
          </button>
        ))}
      </div>

      {/* Section 1 — status cards */}
      <section className="mt-5">
        <SectionHeader>Current Status</SectionHeader>
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="Fitness (CTL)" value={tl.ctl} trend={ctlTrend.dir} trendTone={ctlTrend.tone} accent="#7B61FF" />
          <StatCard label="Fatigue (ATL)" value={tl.atl} trend={atlTrend.dir} trendTone={atlTrend.tone} accent="#FF6B2B" />
          <StatCard label="Form (TSB)" value={tl.tsb} accent={tl.tsb >= 0 ? '#00C97A' : '#FF4D6D'} />
          <StatCard label="Weekly TSS" value={tl.thisWeekTSS} trend={tssTrend.dir} trendTone={tssTrend.tone} />
        </div>
      </section>

      {/* Section 2 — gauge */}
      <section className="mt-6">
        <SectionHeader>Load Score</SectionHeader>
        <div className="card p-5">
          <LoadGauge size={140} score={tl.score} color={tl.zone.color} label={tl.zone.name} />
          <p className="text-center font-display font-bold mt-3" style={{ color: tl.zone.color }}>{tl.zone.name}</p>
          <p className="text-center text-sm text-muted mt-1">{tl.zone.desc}</p>
          <div
            className="mt-4 rounded-lg p-3 text-center"
            style={{ backgroundColor: `${tl.readiness.color}1A`, border: `1px solid ${tl.readiness.color}40` }}
          >
            <p className="font-bold" style={{ color: tl.readiness.color }}>{tl.readiness.emoji} {tl.readiness.label}</p>
          </div>
        </div>
      </section>

      {/* Section 3 — fatigue curve */}
      <section className="mt-6">
        <SectionHeader>Fitness vs Fatigue</SectionHeader>
        <div className="card p-4">
          <div className="-ml-2" style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={curve}>
                <CartesianGrid stroke={GRID} vertical={false} />
                <XAxis dataKey="date" tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} minTickGap={24} />
                <YAxis tick={AXIS} tickLine={false} axisLine={false} width={28} />
                <Tooltip content={<DarkTooltip />} />
                <ReferenceLine y={0} stroke={GRID} />
                <Line type="monotone" dataKey="CTL" name="Fitness" stroke="#7B61FF" strokeWidth={2.5} dot={false} />
                <Line type="monotone" dataKey="ATL" name="Fatigue" stroke="#FF6B2B" strokeWidth={2.5} dot={false} />
                <Line type="monotone" dataKey="TSB" name="Form" stroke="#6B6B80" strokeWidth={2} dot={<TsbDot />} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-4 mt-2 text-[11px]">
            <Legend color="#7B61FF" label="Fitness" />
            <Legend color="#FF6B2B" label="Fatigue" />
            <Legend color="#00C97A" label="Form" />
          </div>
        </div>
      </section>

      {/* Section 4 — ATL:CTL ratio */}
      <section className="mt-6">
        <SectionHeader>Acute : Chronic Ratio</SectionHeader>
        <div className="card p-4">
          <div className="flex items-baseline justify-between">
            <span className="font-display text-3xl font-bold tnum" style={{ color: ratioInfo.color }}>{tl.ratio.toFixed(2)}</span>
            <span className="chip" style={{ color: ratioInfo.color, backgroundColor: `${ratioInfo.color}1A` }}>{ratioInfo.label}</span>
          </div>
          <div className="relative mt-4 h-2.5 rounded-full overflow-hidden flex">
            <div className="h-full" style={{ width: '40%', background: 'rgba(107,107,128,0.4)' }} />
            <div className="h-full" style={{ width: '25%', background: 'rgba(0,201,122,0.5)' }} />
            <div className="h-full" style={{ width: '35%', background: 'rgba(255,77,109,0.4)' }} />
            <span
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-txt shadow-glow"
              style={{ left: `${ratioPct}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-muted mt-1"><span>0.8</span><span>1.3</span></div>
          <p className="text-xs text-muted mt-3">This ratio shows if your recent training matches your fitness base. The sweet spot (0.8–1.3) builds fitness while keeping injury risk low.</p>
        </div>
      </section>

      {/* Section 5 — weekly volume */}
      <section className="mt-6">
        <SectionHeader>Weekly Training Volume</SectionHeader>
        <div className="card p-4">
          <div className="-ml-2" style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weekly8}>
                <CartesianGrid stroke={GRID} vertical={false} />
                <XAxis dataKey="week" tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} />
                <YAxis tick={AXIS} tickLine={false} axisLine={false} width={32} />
                <Tooltip content={<DarkTooltip />} cursor={{ fill: '#1E1E2E55' }} />
                {tl.optimalWeekly > 0 && (
                  <ReferenceLine y={tl.optimalWeekly} stroke="#7B61FF" strokeDasharray="4 4" label={{ value: 'target', fill: '#7B61FF', fontSize: 10, position: 'right' }} />
                )}
                <Bar dataKey="tss" name="Weekly TSS" radius={[4, 4, 0, 0]}>
                  {weekly8.map((w, i) => (
                    <Cell key={i} fill={w.tss >= tl.optimalWeekly ? '#00C97A' : '#FF6B2B'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-secondary mt-2">💡 Target ({tl.optimalWeekly} TSS) is the average of your best 4 weeks.</p>
        </div>
      </section>

      {/* Section 6 — ready to race */}
      <section className="mt-6">
        <div className="card card-accent p-5 text-center">
          <div className="text-5xl">{tl.readiness.emoji}</div>
          <p className="font-display font-bold text-xl mt-2" style={{ color: tl.readiness.color }}>{tl.readiness.label}</p>
          <p className="text-sm text-muted mt-2 leading-relaxed">{tl.readiness.paragraph}</p>
          {tl.tsb < 5 && tl.daysToForm > 0 ? (
            <p className="text-sm mt-3"><span className="font-bold text-primary tnum">~{tl.daysToForm}</span> easy/rest day{tl.daysToForm === 1 ? '' : 's'} until optimal form</p>
          ) : tl.tsb >= 5 ? (
            <p className="text-sm mt-3 text-primary font-semibold">You're in peak form! Great time to race or PR.</p>
          ) : null}
        </div>
      </section>
    </Layout>
  );
}

function Legend({ color, label }) {
  return (
    <span className="flex items-center gap-1.5 text-muted">
      <span className="w-3 h-0.5 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}

function TsbDot({ cx, cy, value }) {
  if (cx == null || cy == null) return null;
  return <circle cx={cx} cy={cy} r={2.5} fill={value >= 0 ? '#00C97A' : '#FF4D6D'} />;
}
