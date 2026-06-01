import { Link } from 'react-router-dom';

export default function EmptyState({ icon = '🌱', title, message, ctaLabel, ctaTo, onCta }) {
  return (
    <div className="card p-8 text-center flex flex-col items-center route-fade">
      <div className="text-5xl mb-3">{icon}</div>
      <h3 className="font-display font-bold text-lg text-txt">{title}</h3>
      <p className="text-sm text-muted mt-1 max-w-[260px]">{message}</p>
      {ctaLabel && ctaTo && (
        <Link to={ctaTo} className="btn-primary mt-5 max-w-[220px] flex items-center justify-center">
          {ctaLabel}
        </Link>
      )}
      {ctaLabel && onCta && (
        <button onClick={onCta} className="btn-primary mt-5 max-w-[220px]">
          {ctaLabel}
        </button>
      )}
    </div>
  );
}
