import { NavLink, useNavigate } from 'react-router-dom';

// Six tabs split 3 / 3 around the center Log Run FAB. Icon-only on mobile so
// it stays uncrowded at 375px.
const tabs = [
  { to: '/', icon: '🏠', label: 'Home', end: true, anim: 'anim-bounce' },
  { to: '/coach', icon: '🤖', label: 'Coach', anim: 'anim-spin' },
  { to: '/analytics', icon: '📊', label: 'Stats', anim: 'anim-flip' },
  { to: '/recovery', icon: '💤', label: 'Recovery', anim: 'anim-pulse' },
  { to: '/training-load', icon: '🔥', label: 'Load', anim: 'anim-shake' },
  { to: '/achievements', icon: '🏆', label: 'Achievements', anim: 'anim-bounce' },
];

function Tab({ tab }) {
  return (
    <NavLink
      to={tab.to}
      end={tab.end}
      aria-label={tab.label}
      title={tab.label}
      className="flex-1 flex flex-col items-center justify-center gap-1 h-full min-h-[48px] relative"
    >
      {({ isActive }) => (
        <>
          <span
            className={`text-2xl transition-transform duration-150 ${isActive ? `scale-110 ${tab.anim}` : 'opacity-60'}`}
            style={isActive ? { filter: 'drop-shadow(0 0 6px rgba(255,107,43,0.75))' } : undefined}
          >
            {tab.icon}
          </span>
          {/* active dot indicator (with glow + bounce) */}
          <span
            className={`w-1.5 h-1.5 rounded-full transition-all duration-150 ${
              isActive ? 'bg-primary shadow-glow scale-100 dot-bounce' : 'bg-transparent scale-0'
            }`}
          />
        </>
      )}
    </NavLink>
  );
}

export default function BottomNav() {
  const navigate = useNavigate();
  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] z-40">
      <div className="relative h-[68px] bg-surface/70 backdrop-blur-xl border-t border-border flex items-stretch px-1 pb-[env(safe-area-inset-bottom)]">
        {/* equal-width side groups keep the center spacer (and FAB) exactly centered */}
        <div className="flex-1 flex items-stretch">
          <Tab tab={tabs[0]} />
          <Tab tab={tabs[1]} />
          <Tab tab={tabs[2]} />
        </div>

        {/* centered spacer hosting the raised Log Run FAB */}
        <div className="w-16 shrink-0 relative">
          <button
            onClick={() => navigate('/log')}
            aria-label="Log a run"
            className="absolute left-1/2 -translate-x-1/2 -top-5 w-16 h-16 rounded-full bg-primary
                       text-bg shadow-glow flex items-center justify-center text-3xl font-light
                       border-4 border-bg active:scale-95 transition-transform duration-150"
          >
            +
          </button>
        </div>

        <div className="flex-1 flex items-stretch">
          <Tab tab={tabs[3]} />
          <Tab tab={tabs[4]} />
          <Tab tab={tabs[5]} />
        </div>
      </div>
    </nav>
  );
}
