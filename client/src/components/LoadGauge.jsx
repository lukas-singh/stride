import useCountUp from '../hooks/useCountUp.js';

// Circular load gauge. Animates the ring + number from 0 on mount and pulses a
// zone-colored glow. When `disabled`, shows a grayed ring with a message.
export default function LoadGauge({ size = 180, score = 0, color = '#6B6B80', label = '', disabled = false, message }) {
  const stroke = Math.round(size * 0.08);
  const r = size / 2 - stroke;
  const circ = 2 * Math.PI * r;
  const animated = useCountUp(disabled ? 0 : score, 600);
  const pct = Math.max(0, Math.min(100, animated)) / 100;
  const offset = circ * (1 - pct);
  const ringColor = disabled ? '#2A2A38' : color;

  return (
    <div className="relative mx-auto" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#1E1E2E" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={ringColor}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          className={disabled ? '' : 'gauge-glow'}
          style={disabled ? undefined : { '--glow': color }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4">
        {disabled ? (
          <p className="text-xs text-muted leading-snug">{message}</p>
        ) : (
          <>
            <span className="font-display font-extrabold tnum leading-none" style={{ fontSize: size * 0.28, color }}>
              {Math.round(animated)}
            </span>
            {label && <span className="text-[11px] font-semibold uppercase tracking-wide text-muted mt-1">{label}</span>}
          </>
        )}
      </div>
    </div>
  );
}
