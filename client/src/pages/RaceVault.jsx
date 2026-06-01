import { useEffect, useMemo, useState } from 'react';
import Layout from '../components/Layout.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { CardSkeletonList } from '../components/Skeleton.jsx';
import { useToast } from '../components/Toast.jsx';
import { api } from '../api.js';
import { fmtDate, parseTimeToSeconds, todayISO } from '../lib/format.js';
import { computePRs, markPRs, computeBadges, RACE_MEDALS, DIST_ORDER } from '../lib/achievements.js';
import { computePersonalBests } from '../lib/personalBests.js';

const RACE_DISTANCE_OPTS = ['5K', '10K', 'Half Marathon', 'Marathon', 'Other'];

function SectionHeader({ children }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-1 h-4 rounded-full bg-primary shadow-glow-sm" />
      <h2 className="text-xs font-bold uppercase tracking-widest text-muted">{children}</h2>
    </div>
  );
}

export default function RaceVault() {
  const toast = useToast();
  const [races, setRaces] = useState(null);
  const [runs, setRuns] = useState([]);
  const [hasGoal, setHasGoal] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [newPbIds, setNewPbIds] = useState([]);

  function reload() {
    api('/races').then(setRaces).catch(() => setRaces([]));
  }
  useEffect(() => {
    reload();
    api('/runs').then(setRuns).catch(() => setRuns([]));
    api('/goals').then((g) => setHasGoal(!!g)).catch(() => setHasGoal(false));
  }, []);

  // Pick up any personal bests broken on the Log Run page and pulse them.
  useEffect(() => {
    try {
      const raw = localStorage.getItem('stride_new_pbs');
      if (!raw) return;
      localStorage.removeItem('stride_new_pbs');
      const { ids, ts } = JSON.parse(raw);
      if (Array.isArray(ids) && ids.length && Date.now() - ts < 5 * 60 * 1000) {
        setNewPbIds(ids);
        const t = setTimeout(() => setNewPbIds([]), 3500);
        return () => clearTimeout(t);
      }
    } catch { /* ignore */ }
  }, []);

  const loading = races === null;
  const prs = useMemo(() => (races ? computePRs(races) : {}), [races]);
  const marked = useMemo(() => (races ? markPRs(races) : []), [races]);
  const pb = useMemo(() => computePersonalBests(runs), [runs]);
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
      {/* Add Race — full-width button at top */}
      <button onClick={() => setShowModal(true)} className="btn-primary mt-2">+ Add Race</button>

      {/* Personal Bests — auto-computed from logged runs; hidden when no runs */}
      {pb.cards.length > 0 && (
        <section className="mt-6">
          <SectionHeader>Personal Bests</SectionHeader>
          <div className="grid grid-cols-2 gap-3 mt-2">
            {pb.cards.map((c) => (
              <div
                key={c.id}
                className={`card p-3 border-l-[3px] border-l-primary ${newPbIds.includes(c.id) ? 'pb-pulse' : ''}`}
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-lg shrink-0">{c.icon}</span>
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-muted truncate">{c.label}</span>
                </div>
                <p className="text-xl font-bold tnum mt-1 text-txt">{c.value}</p>
                {c.sub && <p className="text-[11px] text-muted mt-0.5 truncate">{c.sub}</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Race PRs (from logged races) */}
      <section className="mt-6">
        <SectionHeader>Race PRs</SectionHeader>
        <div className="grid grid-cols-2 gap-3 mt-2">
          {DIST_ORDER.map((d) => (
            <div key={d} className="card p-3 border-l-[3px] border-l-primary">
              <div className="flex items-center gap-1.5">
                <span>{RACE_MEDALS[d]}</span>
                <span className="text-xs font-semibold text-muted">{d}</span>
              </div>
              <p className="text-xl font-bold tnum mt-1 text-primary">{prs[d] ? prs[d].official_time : '—'}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Your Races — horizontal scrollable strip */}
      <section className="mt-6">
        <SectionHeader>Your Races</SectionHeader>
        {loading ? (
          <div className="mt-2"><CardSkeletonList count={1} height="h-[120px]" /></div>
        ) : marked.length === 0 ? (
          <div className="mt-2">
            <EmptyState icon="🏁" title="No races yet" message="Add your race results to build your trophy case." ctaLabel="Add a Race" onCta={() => setShowModal(true)} />
          </div>
        ) : (
          <div className="fade-right mt-2">
            <div className="hscroll">
              {marked.map((r) => <RaceStripCard key={r.id} race={r} onDelete={deleteRace} />)}
            </div>
          </div>
        )}
      </section>

      {/* Milestone Badges */}
      <section className="mt-6">
        <SectionHeader>Milestone Badges</SectionHeader>
        <div className="grid grid-cols-3 gap-3 mt-2">
          {badges.map((b) => (
            <div
              key={b.title}
              className={`card p-3 text-center transition-all duration-200 ${
                b.unlocked ? 'border-primary/50 shadow-glow-sm badge-shimmer' : 'opacity-40 grayscale'
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

function RaceStripCard({ race, onDelete }) {
  const [confirm, setConfirm] = useState(false);
  const medal = RACE_MEDALS[race.distance] || '⭐';
  return (
    <div className="card card-press p-3 w-[160px] h-[120px] flex flex-col justify-between relative">
      <button
        onClick={() => (confirm ? onDelete(race.id) : setConfirm(true))}
        className={`absolute top-1.5 right-1.5 text-[10px] font-semibold z-10 ${confirm ? 'text-danger' : 'text-muted'}`}
      >
        {confirm ? 'Delete?' : '✕'}
      </button>
      <div className="flex items-center gap-2">
        <span className="text-2xl">{medal}</span>
        {race.isPR && <span className="chip bg-primary/15 text-primary text-[9px] py-0">PR</span>}
      </div>
      <div className="min-w-0">
        <p className="font-semibold text-sm truncate">{race.name}</p>
        <p className="text-[10px] text-muted">{race.distance} · {fmtDate(race.date, { month: 'short', day: 'numeric' })}</p>
        <p className="text-lg font-bold tnum text-primary leading-tight">{race.official_time}</p>
      </div>
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
