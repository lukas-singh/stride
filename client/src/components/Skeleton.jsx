export function Skeleton({ className = '' }) {
  return <div className={`skeleton rounded-lg ${className}`} />;
}

export function StatSkeletonGrid() {
  return (
    <div className="grid grid-cols-2 gap-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-24" />
      ))}
    </div>
  );
}

export function CardSkeletonList({ count = 4, height = 'h-20' }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className={height} />
      ))}
    </div>
  );
}
