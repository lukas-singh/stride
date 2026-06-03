import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine,
} from 'recharts';
import LoadGauge from './LoadGauge.jsx';
import EmptyState from './EmptyState.jsx';
import { fmtPace, fmtDuration } from '../lib/format.js';
import { computeRaceReadiness } from '../lib/raceReadiness.js';

const CONF_COLORS = { High: '#00C97A', Medium: '#FF9F40', Low: '#6B6B80' };
const AXIS = { fontSize: 11, fill: '#6B6B80' };

function Reveal({ i, children }) {
  return <div className="route-fade" style={{ animationDelay: `${i * 100}ms`, animationFillMode: 'both' }}>{children}</div>;
}

function TrendArrow({ trend }) {
  if (!trend || trend.label === 'flat') return <span className="text-muted text-xs">→ steady</span>;
  const improving = trend.label === 'improving';
  return (
    <span className="text-xs font-semibold" style={{ color: improving ? '#00C97A' : '#FF4D6D' }}>
      {improving ? '↓' : '↑'} {trend.perWeek}s/wk
    </span>
  );
}

function PaceCol({ label, pace, trend }) {
  return (
    <div className="flex-1 text-center">
      <p className="text-[10px] uppercase tracking-wide text-muted">{label}</p>
      <p className="font-display text-lg font-bold tnum mt-0.5">{pace ? `${fmtPace(pace)}` : '—'}</p>
      {pace ? <TrendArrow trend={trend} /> : <span className="text-[10px] text-muted">no data</span>}
    </div>
  );
}

function SWChip({ item, tone }) {
  const [open, setOpen] = useState(false);
  const color = tone === 'good' ? '#00C97A' : '#FF9F40';
  return (
    <button
      onClick={() => setOpen((o) => !o)}
      className="w-full text-left rounded-lg px-2.5 py-2 transition-colors"
      style={{ backgroundColor: `${color}14`, border: `1px solid ${color}33` }}
    >
      <span className="text-xs font-semibold" style={{ color }}>{tone === 'good' ? '✅' : '⚠️'} {item.label}</span>
      {open && (
        <div className="mt-1 route-fade">
          <p className="text-[11px] text-muted leading-snug">{item.explanation}</p>
          <p className="text-[11px] text-txt leading-snug mt-1">→ {item.suggestion}</p>
        </div>
      )}
    </button>
  );
}

export default function RaceReadinessReport({ runs, recovery, goal }) {
  const r = useMemo(() => computeRaceReadiness(runs, { recovery, goal }), [runs, recovery, goal]);

  if (!r.hasData) {
    return (
      <div className="mt-4">
        <EmptyState icon="📋" title="Race Readiness Report" message="Log 5 runs to unlock your personalized readiness analysis." ctaLabel="Log a Run →" ctaTo="/log" />
      </div>
    );
  }

  const { fingerprint: fp, predictions, tier, strengths, weaknesses, readiness, chart, goalPace, recoveryScore, summaries } = r;

  return (
    <div className="space-y-4 mt-5">
      {/* Header + gauge */}
      <Reveal i={0}>
        <div className="card card-accent p-4 flex items-center gap-4">
          <div className="flex-1 min-w-0">
            <h2 className="font-display font-bold text-lg page-title text-txt leading-tight">Race Readiness Report</h2>
            <p className="text-xs text-muted mt-1">Updated from your last {Math.min(r.count, 30)} runs</p>
            <p className="text-xs text-secondary mt-2 leading-snug">{summaries.readiness}</p>
          </div>
          <div className="shrink-0">
            <LoadGauge size={120} score={readiness.score} color={readiness.zone.color} label={readiness.zone.name} />
          </div>
        </div>
      </Reveal>

      {/* Tier banner */}
      <Reveal i={1}>
        <div className="card p-4" style={{ background: tier.gradient, borderColor: `${tier.color}40` }}>
          <div className="flex items-center gap-3">
            <span className="text-3xl">{tier.icon}</span>
            <div>
              <p className="font-display font-bold text-lg" style={{ color: tier.color }}>{tier.name}</p>
              <p className="text-xs text-muted leading-snug mt-0.5">{tier.description}</p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {tier.focus.map((f, i) => (
              <span key={i} className="chip text-[10px] py-0.5 bg-bg/40 text-txt">{f}</span>
            ))}
          </div>
        </div>
      </Reveal>

      {/* Predictions grid */}
      <Reveal i={2}>
        <h3 className="text-xs font-bold uppercase tracking-widest text-muted mb-2 flex items-center gap-2">
          <span className="w-1 h-4 rounded-full bg-primary shadow-glow-sm" />Race Predictions
        </h3>
        <div className="grid grid-cols-2 gap-3">
          {predictions.map((p) => (
            <div key={p.dist} className={`card p-3 ${p.locked ? 'opacity-60' : ''}`}>
              <p className="text-xs font-semibold text-muted">{p.dist}</p>
              {p.locked ? (
                <p className="text-[11px] text-muted mt-2 leading-snug">Need ~{p.needMiles} more mi of long-run data</p>
              ) : (
                <>
                  <p className="font-display text-2xl font-bold tnum mt-1 text-primary">{fmtDuration(p.time)}</p>
                  <span className="chip text-[10px] py-0 mt-1" style={{ color: CONF_COLORS[p.confidence], backgroundColor: `${CONF_COLORS[p.confidence]}1A` }}>
                    {p.confidence} confidence
                  </span>
                </>
              )}
            </div>
          ))}
        </div>
      </Reveal>

      {/* Pace analysis strip */}
      <Reveal i={3}>
        <div className="card p-4">
          <p className="text-[11px] text-muted mb-2">{summaries.fitness}</p>
          <div className="flex divide-x divide-border">
            <PaceCol label="Easy" pace={fp.basePace} trend={fp.easyTrend} />
            <PaceCol label="Tempo" pace={fp.tempoPace} trend={fp.hardTrend} />
            <PaceCol label="Long Run" pace={fp.longPace} trend={fp.overallTrend} />
          </div>
        </div>
      </Reveal>

      {/* Strengths & weaknesses */}
      <Reveal i={4}>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-wide text-muted">Strengths</p>
            {strengths.length ? strengths.map((s, i) => <SWChip key={i} item={s} tone="good" />) : <p className="text-[11px] text-muted">Keep training to build strengths.</p>}
          </div>
          <div className="space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-wide text-muted">Focus Areas</p>
            {weaknesses.length ? weaknesses.map((w, i) => <SWChip key={i} item={w} tone="warn" />) : <p className="text-[11px] text-muted">No major weaknesses — nice work!</p>}
          </div>
        </div>
      </Reveal>

      {/* Pace trend chart */}
      <Reveal i={5}>
        <div className="card p-4">
          <h3 className="font-semibold text-sm">Pace Trend — Hard vs Easy</h3>
          <div className="mt-2 -ml-2" style={{ height: 190 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chart}>
                <CartesianGrid stroke="#1E1E2E" vertical={false} />
                <XAxis dataKey="idx" tick={AXIS} tickLine={false} axisLine={{ stroke: '#1E1E2E' }} />
                <YAxis tickFormatter={fmtPace} reversed domain={['dataMin - 15', 'dataMax + 15']} tick={AXIS} tickLine={false} axisLine={false} width={42} />
                <Tooltip
                  contentStyle={{ background: '#13131A', border: '1px solid #1E1E2E', borderRadius: 10, fontSize: 12 }}
                  formatter={(v, n) => [`${fmtPace(v)}/mi`, n]}
                  labelFormatter={() => ''}
                />
                {goalPace && <ReferenceLine y={goalPace} stroke="#FFD23F" strokeDasharray="4 4" label={{ value: 'goal', fill: '#FFD23F', fontSize: 10, position: 'insideTopRight' }} />}
                <Line type="monotone" dataKey="hard" name="Hard" stroke="#FF6B2B" strokeWidth={2.5} connectNulls dot={{ r: 2.5, fill: '#FF6B2B' }} />
                <Line type="monotone" dataKey="easy" name="Easy" stroke="#00C46A" strokeWidth={2.5} connectNulls dot={{ r: 2.5, fill: '#00C46A' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-4 mt-1 text-[11px] text-muted">
            <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 rounded-full" style={{ backgroundColor: '#FF6B2B' }} />Hard effort</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 rounded-full" style={{ backgroundColor: '#00C46A' }} />Easy effort</span>
          </div>
        </div>
      </Reveal>

      {/* Key metrics row */}
      <Reveal i={6}>
        <div className="grid grid-cols-4 gap-2">
          <Metric label="Consistency" value={`${fp.consistency}%`} />
          <Metric label="Mileage" value={`${fp.mileageTrendPct >= 0 ? '+' : ''}${fp.mileageTrendPct}%`} color={fp.mileageTrendPct >= 0 ? '#00C97A' : '#FF4D6D'} />
          <Metric label="Pace" value={fp.hardTrend.label === 'flat' ? 'Steady' : `${fp.hardTrend.perWeek}s/wk`} color={fp.hardTrend.label === 'improving' ? '#00C97A' : fp.hardTrend.label === 'declining' ? '#FF4D6D' : undefined} />
          <Metric label="Recovery" value={recoveryScore != null ? `${recoveryScore}` : '—'} />
        </div>
      </Reveal>
    </div>
  );
}

function Metric({ label, value, color }) {
  return (
    <div className="card p-2 text-center">
      <p className="text-[9px] uppercase tracking-wide text-muted">{label}</p>
      <p className="font-display text-sm font-bold tnum mt-0.5" style={color ? { color } : undefined}>{value}</p>
    </div>
  );
}
