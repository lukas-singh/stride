export default function StatCard({ label, value, unit, accent }) {
  return (
    <div className="card p-4 flex flex-col justify-between">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</span>
      <div className="mt-2 flex items-baseline gap-1">
        <span className="text-2xl font-bold tnum" style={accent ? { color: accent } : undefined}>
          {value}
        </span>
        {unit && <span className="text-xs text-muted font-medium">{unit}</span>}
      </div>
    </div>
  );
}
