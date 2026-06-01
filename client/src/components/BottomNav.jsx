import { NavLink, useNavigate } from 'react-router-dom';

const tabs = [
  { to: '/', icon: '🏠', label: 'Home', end: true },
  { to: '/coach', icon: '🤖', label: 'Coach' },
  { to: '/analytics', icon: '📊', label: 'Stats' },
  { to: '/recovery', icon: '💤', label: 'Recovery' },
];

function Tab({ tab }) {
  return (
    <NavLink
      to={tab.to}
      end={tab.end}
      className="flex-1 flex flex-col items-center justify-center gap-0.5 h-full min-h-[48px] relative"
    >
      {({ isActive }) => (
        <>
          <span
            className={`text-xl transition-transform duration-150 ${isActive ? 'scale-110' : 'opacity-70'}`}
            style={isActive ? { filter: 'drop-shadow(0 0 6px rgba(0,245,160,0.7))' } : undefined}
          >
            {tab.icon}
          </span>
          <span className={`text-[10px] font-semibold ${isActive ? 'text-primary' : 'text-muted'}`}>
            {tab.label}
          </span>
          {/* active dot indicator (with glow) */}
          <span
            className={`mt-0.5 w-1.5 h-1.5 rounded-full transition-all duration-150 ${
              isActive ? 'bg-primary shadow-glow scale-100' : 'bg-transparent scale-0'
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
      <div className="relative h-[68px] bg-surface/70 backdrop-blur-xl border-t border-border flex items-stretch px-2 pb-[env(safe-area-inset-bottom)]">
        <Tab tab={tabs[0]} />
        <Tab tab={tabs[1]} />
        {/* center spacer for FAB */}
        <div className="w-16 shrink-0" />
        <Tab tab={tabs[2]} />
        <Tab tab={tabs[3]} />

        {/* Log Run FAB */}
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
    </nav>
  );
}
