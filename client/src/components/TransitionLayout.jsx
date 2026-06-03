import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

// Module-level so the previous path survives Layout/TransitionLayout remounts
// (each page renders its own Layout, so a component ref would reset each nav).
let lastPath = null;

// Order used to decide slide direction. Lower index = "earlier" tab; navigating
// to a lower index slides back (from the left), otherwise forward (from right).
const ORDER = ['/', '/coach', '/analytics', '/recovery', '/achievements', '/vault', '/profile', '/log', '/runs'];

function rank(pathname) {
  // match the most specific known prefix
  let best = -1, bestLen = -1;
  for (let i = 0; i < ORDER.length; i++) {
    const p = ORDER[i];
    const isMatch = p === '/' ? pathname === '/' : pathname.startsWith(p);
    if (isMatch && p.length > bestLen) { best = i; bestLen = p.length; }
  }
  return best;
}

// Wraps page content and re-runs a directional slide animation whenever the
// route changes. The header and bottom nav live outside this, so they stay put.
export default function TransitionLayout({ children, className = '' }) {
  const location = useLocation();
  const back = lastPath != null && lastPath !== location.pathname && rank(location.pathname) < rank(lastPath);

  useEffect(() => {
    lastPath = location.pathname;
  }, [location.pathname]);

  return (
    <div
      key={location.pathname}
      className={`${back ? 'page-enter-back' : 'page-enter-forward'} ${className}`}
      style={{ overflowX: 'hidden' }}
    >
      {children}
    </div>
  );
}
