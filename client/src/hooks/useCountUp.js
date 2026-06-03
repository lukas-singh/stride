import { useEffect, useRef, useState } from 'react';

// Animates a number from 0 up to `target` over `duration` ms (ease-out).
// Returns the current animated value. Re-animates if the target changes.
export default function useCountUp(target, duration = 600) {
  const [value, setValue] = useState(0);
  const rafRef = useRef(0);

  useEffect(() => {
    const end = Number(target) || 0;
    if (end === 0) { setValue(0); return undefined; }
    let start = null;
    const step = (ts) => {
      if (start === null) start = ts;
      const t = Math.min(1, (ts - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      setValue(end * eased);
      if (t < 1) rafRef.current = requestAnimationFrame(step);
      else setValue(end);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration]);

  return value;
}
