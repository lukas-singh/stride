import { useEffect, useMemo, useState } from 'react';
import Layout from '../components/Layout.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { CardSkeletonList } from '../components/Skeleton.jsx';
import { useToast } from '../components/Toast.jsx';
import { api } from '../api.js';
import { fmtDate, parseTimeToSeconds, todayISO } from '../lib/format.js';
import { computePRs, markPRs, computeStreak, computeBadges, RACE_MEDALS, DIST_ORDER } from '../lib/achievements.js';

const RACE_DISTANCE_OPTS = ['5K', '10K', 'Half Marathon', 'Marathon', 'Other'];

export default function RaceVault() {
  const toast = useToast();
  const [races, setRaces] = useState(null);
  const [runs, setRuns] = useState([]);
  const [hasGoal, setHasGoal] = useState(false);
  const [showModal, setShowModal] = useState(false);

  function reload() {
    api('/races').then(setRaces).catch(() => setRaces([]));
  }
  useEffect(() => {
    reload();
    api('/runs').then(setRuns).catch(() => setRuns([]));
    api('/goals').then((g) => setHasGoal(!!g)).catch(() => setHasGoal(false));
  }, []);

  const loading = races === null;
  const prs = useMemo(() => (races ? computePRs(races) : {}), [races]);
  const marked = useMemo(() => (races ? markPRs(races) : []), [races]);
  const streak = useMemo(() => computeStreak(runs), [runs]);
  const badges = useMemo(() => computeBadges({ runs, races: races || [], hasGoal }), [runs, races, hasGoal]);

  async function deleteRace(id) {
    try {
      await api(`/races/${id}`, { method: 'DELETE' });
      toast.success('Race removed');
      reload();
    } catch (e) {
      toast.error(e.message);
    }
  }

  return (
    <Layout title="Race Vault 🏆">
      {/* Streak */}
      <div className="card p-4 mt-2 flex items-center justify-between border-danger/30">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Current Streak</p>
          <p className="text-3xl font-extrabold tnum mt-1 text-danger">{streak.days} <span className="text-base text-muted font-medium">days</span></p>
        </div>
        <span className="text-4xl">🔥</span>
      </div>

      {/* PR Board */}
      <section className="mt-5">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted mb-2">PR Board</h2>
        <div className="grid grid-cols-2 gap-3">
          {DIST_ORDER.map((d) => (
            <div key={d} className="card p-3">
              <div className="flex items-center gap-1.5">
                <span>{RACE_MEDALS[d]}</span>
                <span className="text-xs font-semibold text-muted">{d}</span>
              </div>
              <p className="text-xl font-bold tnum mt-1 text-primary">{prs[d] ? prs[d].official_time : '—'}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Races */}
      <section className="mt-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Race History</h2>
          <button onClick={() => setShowModal(true)} className="text-xs text-primary font-semibold">+ Add Race</button>
        </div>
        {loading ? (
          <CardSkeletonList count={2} />
        ) : marked.length === 0 ? (
          <EmptyState icon="🏁" title="No races yet" message="Add your race results to build your trophy case." ctaLabel="Add a Race" onCta={() => setShowModal(true)} />
        ) : (
          <div className="space-y-3">
            {marked.map((r) => <RaceCard key={r.id} race={r} onDelete={deleteRace} />)}
          </div>
        )}
      </section>

      {/* Badges */}
      <section className="mt-6">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted mb-2">Milestone Badges</h2>
        <div className="grid grid-cols-3 gap-3">
          {badges.map((b) => (
            <div
              key={b.title}
              className={`card p-3 text-center transition-all duration-200 ${
                b.unlocked ? 'border-primary/50 shadow-glow-sm' : 'opacity-40 grayscale'
              }`}
            >
              <div className="text-3xl">{b.icon}</div>
              <p className="text-[11px] font-semibold mt-1 leading-tight">{b.title}</p>
              <p className="text-[9px] text-muted mt-0.5 leading-tight">{b.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {showModal && <AddRaceModal onClose={() => setShowModal(false)} onSaved={() => { setShowModal(false); reload(); }} />}
    </Layout>
  );
}

function RaceCard({ race, onDelete }) {
  const [confirm, setConfirm] = useState(false);
  const medal = RACE_MEDALS[race.distance] || '⭐';
  return (
    <div className="card p-4">
      <div className="flex items-start gap-3">
        <span className="text-3xl">{medal}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold truncate">{race.name}</span>
            {race.isPR && <span className="chip bg-primary/15 text-primary text-[10px] py-0.5">PR</span>}
          </div>
          <p className="text-xs text-muted mt-0.5">{race.distance} · {fmtDate(race.date, { month: 'short', day: 'numeric', year: 'numeric' })}</p>
          <p className="text-2xl font-bold tnum mt-1 text-primary">{race.official_time}</p>
          {race.placement && <p className="text-xs text-muted mt-0.5">Place: {race.placement}</p>}
          {race.notes && <p className="text-xs text-txt mt-1">{race.notes}</p>}
        </div>
        {confirm ? (
          <button onClick={() => onDelete(race.id)} className="text-danger text-xs font-semibold">Confirm</button>
        ) : (
          <button onClick={() => setConfirm(true)} className="text-muted text-xs">✕</button>
        )}
      </div>
      {race.photo_url && (
        <img src={race.photo_url} alt={race.name} className="mt-3 rounded-lg w-full max-h-48 object-cover" onError={(e) => (e.target.style.display = 'none')} />
      )}
    </div>
  );
}

function AddRaceModal({ onClose, onSaved }) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [date, setDate] = useState(todayISO());
  const [distance, setDistance] = useState('5K');
  const [time, setTime] = useState('');
  const [placement, setPlacement] = useState('');
  const [notes, setNotes] = useState('');
  const [photo, setPhoto] = useState('');
  const [busy, setBusy] = useState(false);

  async function save(e) {
    e.preventDefault();
    if (!name.trim()) return toast.error('Race name required.');
    if (!time.trim()) return toast.error('Official time required (e.g. 52:14).');
    setBusy(true);
    try {
      await api('/races', {
        method: 'POST',
        body: {
          name, date, distance,
          official_time: time,
          time_seconds: parseTimeToSeconds(time),
          placement, notes, photo_url: photo,
        },
      });
      toast.success('Race added 🏅');
      onSaved();
    } catch (err) {
      toast.error(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="w-full max-w-[480px] card rounded-b-none sm:rounded-card p-5 route-fade max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-bold text-xl">Add Race</h2>
          <button onClick={onClose} className="text-muted text-xl">✕</button>
        </div>
        <form onSubmit={save} className="space-y-4">
          <div><label className="label">Race Name</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="City Half Marathon" /></div>
          <div><label className="label">Date</label><input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <div>
            <label className="label">Distance</label>
            <select className="input appearance-none" value={distance} onChange={(e) => setDistance(e.target.value)}>
              {RACE_DISTANCE_OPTS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div><label className="label">Official Time (H:MM:SS or MM:SS)</label><input className="input tnum" value={time} onChange={(e) => setTime(e.target.value)} placeholder="1:52:14" /></div>
          <div><label className="label">Placement (optional)</label><input className="input" value={placement} onChange={(e) => setPlacement(e.target.value)} placeholder="42 / 410" /></div>
          <div><label className="label">Photo / Bib URL (optional)</label><input className="input" value={photo} onChange={(e) => setPhoto(e.target.value)} placeholder="https://…" /></div>
          <div><label className="label">Notes (optional)</label><textarea className="input py-3 min-h-[64px] resize-none" value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
          <button className="btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save Race'}</button>
        </form>
      </div>
    </div>
  );
}
