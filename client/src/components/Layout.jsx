import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import BottomNav from './BottomNav.jsx';

function initials(name = '') {
  return name.trim().slice(0, 1).toUpperCase() || 'U';
}

export default function Layout({ children, title, subtitle }) {
  const { user } = useAuth();
  const location = useLocation();

  return (
    <div className="min-h-screen mx-auto max-w-[480px] bg-bg relative">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-bg/90 backdrop-blur px-4 pt-4 pb-3 flex items-start justify-between">
        <div className="min-w-0">
          {title ? (
            <h1 className="font-display font-bold text-2xl tracking-tight text-txt truncate">{title}</h1>
          ) : (
            <Link to="/" className="font-display font-bold text-xl tracking-tight text-primary">
              Stride
            </Link>
          )}
          {subtitle && <p className="text-sm text-muted mt-0.5">{subtitle}</p>}
        </div>
        <Link
          to="/profile"
          aria-label="Profile"
          className={`shrink-0 ml-3 w-10 h-10 rounded-full grid place-items-center font-bold text-bg
            bg-gradient-to-br from-primary to-secondary transition-shadow duration-150
            ${location.pathname === '/profile' ? 'shadow-glow' : ''}`}
        >
          {initials(user?.display_name)}
        </Link>
      </header>

      {/* Page content */}
      <main key={location.pathname} className="px-4 pb-32 route-fade">{children}</main>

      <BottomNav />
    </div>
  );
}
