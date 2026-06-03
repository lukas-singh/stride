import { useEffect, useMemo, useState } from 'react';
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, ScatterChart, Scatter,
  ComposedChart, XAxis, YAxis, CartesianGrid, Tooltip, Cell, ZAxis, ReferenceDot, Legend,
} from 'recharts';
import Layout from '../components/Layout.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { CardSkeletonList } from '../components/Skeleton.jsx';
import { api } from '../api.js';
import { fmtPace } from '../lib/format.js';
import * as A from '../lib/analytics.js';

const AXIS = { fontSize: 11, fill: '#6B6B80' };
const GRID = '#1E1E2E';

function paceTickFmt(v) { return fmtPace(v); }

function DarkTooltip({ active, payload, label, valueFmt }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-surface border border-border rounded-lg px-3 py-2 text-xs shadow-lg">
      {label != null && <p className="text-muted mb-1">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} className="font-semibold" style={{ color: p.color || '#F0F0F5' }}>
          {p.name}: {valueFmt ? valueFmt(p.value, p) : p.value}
        </p>
      ))}
    </div>
  );
}

function ChartCard({ title, insight, children, empty }) {
  return (
    <div className="card p-4">
      <h3 className="font-semibold text-txt">{title}</h3>
      {empty ? (
        <p className="text-sm text-muted py-8 text-center">Not enough data yet.</p>
      ) : (
        <>
          <div className="mt-3 -ml-2" style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              {children}
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-secondary mt-2">💡 {insight}</p>
        </>
      )}
    </div>
  );
}

const RANGES = [
  { key: '30', label: '30 Days' },
  { key: '90', label: '90 Days' },
  { key: 'all', label: 'All Time' },
];

export default function Analytics() {
  const [allRuns, setAllRuns] = useState(null);
  const [range, setRange] = useState('90');

  useEffect(() => {
    api('/runs').then(setAllRuns).catch(() => setAllRuns([]));
  }, []);

  const runs = useMemo(() => (allRuns ? A.filterByRange(allRuns, range) : []), [allRuns, range]);

  const c = useMemo(() => {
    if (!runs.length) return null;
    return {
      miles: A.milesOverTime(runs),
      pace: A.paceTrendData(runs),
      diffPace: A.difficultyPaceScatter(runs),
      hr: A.hrDistribution(runs),
      temp: A.paceByTemp(runs),
      elev: A.elevationPaceScatter(runs),
      weekly: A.weeklyMileageCount(runs),
      type: A.paceByType(runs),
    };
  }, [runs]);

  if (allRuns === null) {
    return <Layout title="Analytics 📊"><div className="mt-4"><CardSkeletonList count={4} height="h-48" /></div></Layout>;
  }

  return (
    <Layout title="Analytics 📊">
      {/* Range filter */}
      <div className="flex bg-surface border border-border rounded-lg p-1 mt-2 sticky top-[68px] z-20">
        {RANGES.map((r) => (
          <button
            key={r.key}
            onClick={() => setRange(r.key)}
            className={`flex-1 min-h-[40px] rounded-md text-sm font-semibold transition-all duration-150 ${
              range === r.key ? 'bg-primary text-bg shadow-glow-sm' : 'text-muted'
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {!c ? (
        <div className="mt-4">
          <EmptyState icon="📊" title="No data in this range" message="Log runs or widen the date range to unlock your analytics." ctaLabel="Log a Run →" ctaTo="/log" />
        </div>
      ) : (
        <div className="space-y-4 mt-4">
          {/* 1. Miles over time */}
          <ChartCard title="Miles Over Time" insight={c.miles.insight} empty={!c.miles.data.length}>
            <LineChart data={c.miles.data}>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis dataKey="week" tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} />
              <YAxis tick={AXIS} tickLine={false} axisLine={false} width={28} />
              <Tooltip content={<DarkTooltip valueFmt={(v) => `${v} mi`} />} />
              <Line type="monotone" dataKey="miles" name="Miles" stroke="#FF6B2B" strokeWidth={2.5} dot={{ r: 3, fill: '#FF6B2B' }} activeDot={{ r: 5 }} />
            </LineChart>
          </ChartCard>

          {/* 2. Pace trend */}
          <ChartCard title="Pace Trend (last 30)" insight={c.pace.insight} empty={c.pace.data.length < 2}>
            <LineChart data={c.pace.data}>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis dataKey="idx" tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} />
              <YAxis tickFormatter={paceTickFmt} reversed domain={['dataMin - 15', 'dataMax + 15']} tick={AXIS} tickLine={false} axisLine={false} width={42} />
              <Tooltip content={<DarkTooltip valueFmt={(v) => `${fmtPace(v)}/mi`} />} />
              <Line type="monotone" dataKey="pace" name="Pace" stroke="#7B61FF" strokeWidth={2.5} dot={false} />
              <Line dataKey="pb" name="PB" stroke="#FF6B2B" strokeWidth={0} dot={{ r: 4, fill: '#FF6B2B', stroke: '#0A0A0F', strokeWidth: 1 }} legendType="none" />
            </LineChart>
          </ChartCard>

          {/* 3. Difficulty vs pace scatter */}
          <ChartCard title="Difficulty vs. Pace" insight={c.diffPace.insight} empty={!runs.length}>
            <ScatterChart margin={{ left: 8, right: 8 }}>
              <CartesianGrid stroke={GRID} />
              <XAxis type="number" dataKey="x" name="Difficulty" domain={[1, 10]} tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} />
              <YAxis type="number" dataKey="y" name="Pace" tickFormatter={paceTickFmt} reversed tick={AXIS} tickLine={false} axisLine={false} width={42} />
              <ZAxis range={[40, 40]} />
              <Tooltip content={<DarkTooltip valueFmt={(v, p) => (p.dataKey === 'y' ? `${fmtPace(v)}/mi` : v)} />} cursor={{ strokeDasharray: '3 3', stroke: GRID }} />
              {Object.entries(c.diffPace.byType).map(([type, pts]) => (
                <Scatter key={type} name={type} data={pts} fill={A.TYPE_COLORS[type] || '#6B6B80'} />
              ))}
            </ScatterChart>
          </ChartCard>

          {/* 4. HR distribution */}
          <ChartCard title="Heart Rate Distribution" insight={c.hr.insight} empty={!c.hr.data.some((d) => d.count)}>
            <BarChart data={c.hr.data}>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} />
              <YAxis allowDecimals={false} tick={AXIS} tickLine={false} axisLine={false} width={24} />
              <Tooltip content={<DarkTooltip valueFmt={(v) => `${v} runs`} />} cursor={{ fill: '#1E1E2E55' }} />
              <Bar dataKey="count" name="Runs" radius={[4, 4, 0, 0]} fill="#FF4D6D" />
            </BarChart>
          </ChartCard>

          {/* 5. Performance by temperature */}
          <ChartCard title="Performance by Temperature" insight={c.temp.insight} empty={!c.temp.data.some((d) => d.count)}>
            <BarChart data={c.temp.data.filter((d) => d.count)}>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} />
              <YAxis tickFormatter={paceTickFmt} reversed domain={['dataMin - 20', 'dataMax + 20']} tick={AXIS} tickLine={false} axisLine={false} width={42} />
              <Tooltip content={<DarkTooltip valueFmt={(v) => `${fmtPace(v)}/mi`} />} cursor={{ fill: '#1E1E2E55' }} />
              <Bar dataKey="pace" name="Avg pace" radius={[4, 4, 0, 0]} fill="#3FA9FF" />
            </BarChart>
          </ChartCard>

          {/* 6. Elevation vs pace */}
          <ChartCard title="Elevation vs. Pace" insight={c.elev.insight} empty={!runs.length}>
            <ScatterChart margin={{ left: 8, right: 8 }}>
              <CartesianGrid stroke={GRID} />
              <XAxis type="number" dataKey="x" name="Elevation" unit="ft" tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} />
              <YAxis type="number" dataKey="y" name="Pace" tickFormatter={paceTickFmt} reversed tick={AXIS} tickLine={false} axisLine={false} width={42} />
              <ZAxis range={[40, 40]} />
              <Tooltip content={<DarkTooltip valueFmt={(v, p) => (p.dataKey === 'y' ? `${fmtPace(v)}/mi` : `${v} ft`)} />} cursor={{ strokeDasharray: '3 3', stroke: GRID }} />
              <Scatter name="Runs" data={c.elev.data} fill="#7B61FF" />
            </ScatterChart>
          </ChartCard>

          {/* 7. Weekly mileage + run count */}
          <ChartCard title="Weekly Mileage + Run Count" insight={c.weekly.insight} empty={!c.weekly.data.length}>
            <ComposedChart data={c.weekly.data}>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis dataKey="week" tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} />
              <YAxis yAxisId="l" tick={AXIS} tickLine={false} axisLine={false} width={28} />
              <YAxis yAxisId="r" orientation="right" allowDecimals={false} tick={AXIS} tickLine={false} axisLine={false} width={24} />
              <Tooltip content={<DarkTooltip />} cursor={{ fill: '#1E1E2E55' }} />
              <Bar yAxisId="l" dataKey="miles" name="Miles" radius={[4, 4, 0, 0]} fill="#FF6B2B" />
              <Line yAxisId="r" type="monotone" dataKey="runs" name="Runs" stroke="#FF9F40" strokeWidth={2.5} dot={{ r: 3, fill: '#FF9F40' }} />
            </ComposedChart>
          </ChartCard>

          {/* 8. Performance by run type */}
          <ChartCard title="Performance by Run Type" insight={c.type.insight} empty={!c.type.data.length}>
            <BarChart data={c.type.data} layout="vertical" margin={{ left: 12 }}>
              <CartesianGrid stroke={GRID} horizontal={false} />
              <XAxis type="number" tickFormatter={paceTickFmt} reversed tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} />
              <YAxis type="category" dataKey="type" tick={AXIS} tickLine={false} axisLine={false} width={64} />
              <Tooltip content={<DarkTooltip valueFmt={(v) => `${fmtPace(v)}/mi`} />} cursor={{ fill: '#1E1E2E55' }} />
              <Bar dataKey="pace" name="Avg pace" radius={[0, 4, 4, 0]}>
                {c.type.data.map((d, i) => <Cell key={i} fill={A.TYPE_COLORS[d.type] || '#6B6B80'} />)}
              </Bar>
            </BarChart>
          </ChartCard>
        </div>
      )}
    </Layout>
  );
}
