import { Link } from 'react-router-dom';
import { fmtDuration, fmtPace, relativeDay } from '../lib/format.js';
import { weatherIcon } from '../lib/weather.js';
import DifficultyBadge from './DifficultyBadge.jsx';

const TYPE_COLORS = {
  Easy: '#00F5A0',
  Tempo: '#7B61FF',
  'Long Run': '#3FA9FF',
  Interval: '#FF9F40',
  Race: '#FF4D6D',
  Recovery: '#6B6B80',
};

export default function RunCard({ run }) {
  const color = TYPE_COLORS[run.run_type] || '#6B6B80';
  return (
    <Link
      to={`/runs/${run.id}`}
      className="card card-press p-4 flex items-center gap-3 active:bg-border/40"
    >
      <div
        className="w-1 self-stretch rounded-full shrink-0"
        style={{ backgroundColor: color }}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="font-semibold text-txt flex items-center gap-1.5">
            {run.distance.toFixed(2)} mi
            {run.weather_condition && <span className="text-sm" title={run.weather_condition}>{weatherIcon(run.weather_condition)}</span>}
          </span>
          <span className="text-xs text-muted">{relativeDay(run.date)}</span>
        </div>
        <div className="mt-1 flex items-center gap-3 text-sm text-muted tnum">
          <span>{fmtPace(run.pace_seconds)}/mi</span>
          <span>{fmtDuration(run.duration_seconds)}</span>
          <span
            className="chip text-[10px] py-0.5"
            style={{ color, backgroundColor: `${color}1A` }}
          >
            {run.run_type}
          </span>
        </div>
      </div>
      <DifficultyBadge value={run.difficulty} />
    </Link>
  );
}
