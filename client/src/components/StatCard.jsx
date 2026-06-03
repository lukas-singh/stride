const TREND_GLYPH = { up: '↑', down: '↓', flat: '→' };

function TrendArrow({ trend, tone = 'neutral' }) {
  if (!trend) return null;
  const color = tone === 'good' ? '#00C46A' : tone === 'bad' ? '#FF4D6D' : '#6B6B80';
  return (
    <span className="text-sm font-bold leading-none tnum" style={{ color }} aria-hidden>
      {TREND_GLYPH[trend] || ''}
    </span>
  );
}

export default function StatCard({ label, value, unit, accent, trend, trendTone }) {
  return (
    <div className="card p-4 border-l-[3px] border-l-primary flex flex-col justify-between">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</span>
        <TrendArrow trend={trend} tone={trendTone} />
      </div>
      <div className="mt-2 flex items-baseline gap-1">
        <span className="font-display text-2xl font-bold tnum tracking-tight" style={accent ? { color: accent } : undefined}>
          {value}
        </span>
        {unit && <span className="text-xs text-muted font-medium">{unit}</span>}
      </div>
    </div>
  );
}
