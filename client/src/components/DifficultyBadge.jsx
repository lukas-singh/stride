import { difficultyColor } from '../lib/format.js';

export default function DifficultyBadge({ value }) {
  const color = difficultyColor(value);
  return (
    <span
      className="chip tnum"
      style={{ color, backgroundColor: `${color}1A`, border: `1px solid ${color}40` }}
    >
      {value}/10
    </span>
  );
}
