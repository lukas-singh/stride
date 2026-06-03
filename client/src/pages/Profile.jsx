import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout.jsx';
import StatCard from '../components/StatCard.jsx';
import { StatSkeletonGrid } from '../components/Skeleton.jsx';
import { useToast } from '../components/Toast.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../api.js';
import { fmtDuration, fmtPace, fmtDate } from '../lib/format.js';

export default function Profile() {
  const { user, setUser, logout } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [summary, setSummary] = useState(null);
  const [goal, setGoal] = useState(null);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user?.display_name || '');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api('/analytics/summary').then(setSummary).catch(() => setSummary({ totalRuns: 0, totalMiles: 0, totalSeconds: 0, avgPace: 0 }));
    api('/goals').then(setGoal).catch(() => setGoal(null));
  }, []);

  async function saveName() {
    if (!name.trim()) return toast.error('Name cannot be empty.');
    setBusy(true);
    try {
      const { user: updated } = await api('/me', { method: 'PUT', body: { display_name: name.trim() } });
      setUser(updated);
      setEditing(false);
      toast.success('Profile updated');
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  function doLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <Layout title="Profile">
      <div className="card p-5 mt-2 flex items-center gap-4">
        <div className="w-16 h-16 rounded-full grid place-items-center text-2xl font-bold text-bg bg-gradient-to-br from-primary to-secondary shadow-glow">
          {(user?.display_name || 'U').slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0">
          {editing ? (
            <div className="flex gap-2">
              <input className="input min-h-[40px]" value={name} onChange={(e) => setName(e.target.value)} />
              <button className="btn-ghost min-h-[40px] px-3 text-primary border-primary/40" onClick={saveName} disabled={busy}>Save</button>
            </div>
          ) : (
            <>
              <p className="font-bold text-xl truncate">{user?.display_name}</p>
              <p className="text-sm text-muted truncate">{user?.email}</p>
            </>
          )}
        </div>
        {!editing && (
          <button onClick={() => { setName(user.display_name); setEditing(true); }} className="ml-auto text-xs text-primary font-semibold shrink-0">Edit</button>
        )}
      </div>

      {/* All-time stats */}
      <section className="mt-6">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted mb-2">All-Time Stats</h2>
        {!summary ? (
          <StatSkeletonGrid />
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Total Runs" value={summary.totalRuns} />
            <StatCard label="Total Miles" value={summary.totalMiles.toFixed(1)} unit="mi" accent="#FF6B2B" />
            <StatCard label="Total Time" value={fmtDuration(summary.totalSeconds)} />
            <StatCard label="Avg Pace" value={fmtPace(summary.avgPace)} unit="/mi" accent="#7B61FF" />
          </div>
        )}
      </section>

      {/* Active goal */}
      {goal && (
        <section className="mt-6">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted mb-2">Active Goal</h2>
          <Link to="/coach" className="card card-press p-4 block">
            <p className="font-semibold">{goal.race_distance || 'Race'}{goal.target_date ? ` · ${fmtDate(goal.target_date, { month: 'short', day: 'numeric' })}` : ''}</p>
            <p className="text-sm text-muted mt-1">{goal.raw_text}</p>
          </Link>
        </section>
      )}

      {/* Links */}
      <div className="mt-6 space-y-3">
        <Link to="/vault" className="card card-press p-4 flex items-center justify-between active:bg-border/40">
          <span className="font-semibold">🏆 Race Vault</span>
          <span className="text-muted">→</span>
        </Link>
        <button onClick={doLogout} className="w-full card card-press p-4 flex items-center justify-between active:bg-border/40 text-danger font-semibold">
          <span>Log Out</span>
          <span>→</span>
        </button>
      </div>

      <p className="text-center text-xs text-muted mt-8">Stride · v1.0</p>
    </Layout>
  );
}
