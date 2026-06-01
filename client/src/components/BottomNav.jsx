import { NavLink, useNavigate } from 'react-router-dom';

const tabs = [
  { to: '/', icon: '🏠', label: 'Home', end: true },
  { to: '/coach', icon: '🤖', label: 'Coach' },
  { to: '/analytics', icon: '📊', label: 'Stats' },
  { to: '/vault', icon: '🏆', label: 'Vault' },
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
          <span className={`text-xl transition-transform duration-150 ${isActive ? 'scale-110' : 'opacity-70'}`}>
            {tab.icon}
          </span>
          <span className={`text-[10px] font-semibold ${isActive ? 'text-primary' : 'text-muted'}`}>
            {tab.label}
          </span>
          {isActive && (
            <span className="absolute -bottom-0 h-[3px] w-7 rounded-full bg-primary shadow-glow" />
          )}
        </>
      )}
    </NavLink>
  );
}

export default function BottomNav() {
  const navigate = useNavigate();
  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] z-40">
      <div className="relative h-[68px] bg-surface/95 backdrop-blur border-t border-border flex items-stretch px-2 pb-[env(safe-area-inset-bottom)]">
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
