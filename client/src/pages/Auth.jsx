import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../components/Toast.jsx';

function RunIcon() {
  return (
    <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#0A0A0F" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="13" cy="4" r="2" fill="#0A0A0F" stroke="none" />
      <path d="M4 17l3-1 2-4 3 2 1 4" />
      <path d="M12 8l3 2 3-1" />
      <path d="M6 21l2-4" />
    </svg>
  );
}

export default function Auth() {
  const { login, signup, user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) {
    navigate('/', { replace: true });
  }

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === 'login') {
        await login(email, password);
        toast.success('Welcome back!');
      } else {
        await signup(email, password, name);
        toast.success('Account created 🎉');
      }
      navigate('/', { replace: true });
    } catch (err) {
      toast.error(err.message);
      setBusy(false);
    }
  }

  function useDemo() {
    setEmail('demo@stride.app');
    setPassword('stride123');
    setMode('login');
  }

  return (
    <div className="min-h-screen mx-auto max-w-[480px] flex flex-col justify-center px-6 py-10">
      <div className="flex flex-col items-center mb-8">
        <div className="w-16 h-16 rounded-2xl bg-primary grid place-items-center shadow-glow mb-3">
          <RunIcon />
        </div>
        <h1 className="font-display font-extrabold text-4xl tracking-tight text-txt">Stride</h1>
        <p className="text-muted text-sm mt-1">Train smarter. Run further.</p>
      </div>

      <div className="card p-6">
        {/* toggle */}
        <div className="flex bg-bg rounded-lg p-1 mb-6 border border-border">
          {['login', 'signup'].map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`flex-1 min-h-[40px] rounded-md text-sm font-semibold transition-all duration-150 ${
                mode === m ? 'bg-primary text-bg shadow-glow-sm' : 'text-muted'
              }`}
            >
              {m === 'login' ? 'Login' : 'Sign Up'}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="space-y-4">
          {mode === 'signup' && (
            <div>
              <label className="label">Display Name</label>
              <input
                className="input"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
              />
            </div>
          )}
          <div>
            <label className="label">Email</label>
            <input
              className="input"
              type="email"
              required
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              inputMode="email"
            />
          </div>
          <div>
            <label className="label">Password</label>
            <input
              className="input"
              type="password"
              required
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
          </div>
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? 'Please wait…' : mode === 'login' ? 'Log In' : 'Create Account'}
          </button>
        </form>

        <button onClick={useDemo} className="w-full text-center text-xs text-muted mt-4 underline underline-offset-2">
          Use demo account
        </button>
      </div>
    </div>
  );
}
