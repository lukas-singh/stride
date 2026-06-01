import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout.jsx';
import DifficultyBadge from '../components/DifficultyBadge.jsx';
import { CardSkeletonList } from '../components/Skeleton.jsx';
import { useToast } from '../components/Toast.jsx';
import { api } from '../api.js';
import { fmtDuration, fmtPace, fmtDate } from '../lib/format.js';
import { weatherIcon } from '../lib/weather.js';

function Stat({ label, value, unit }) {
  return (
    <div className="card p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className="text-lg font-bold tnum mt-1">{value}{unit && <span className="text-xs text-muted ml-0.5">{unit}</span>}</p>
    </div>
  );
}

export default function RunDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [run, setRun] = useState(null);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api(`/runs/${id}`).then(setRun).catch((e) => { toast.error(e.message); navigate('/'); });
  }, [id]);

  async function del() {
    setBusy(true);
    try {
      await api(`/runs/${id}`, { method: 'DELETE' });
      toast.success('Run deleted');
      navigate('/', { replace: true });
    } catch (e) {
      toast.error(e.message);
      setBusy(false);
    }
  }

  if (!run) {
    return <Layout title="Run"><div className="mt-4"><CardSkeletonList count={3} /></div></Layout>;
  }

  return (
    <Layout
      title={fmtDate(run.date, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
      subtitle={run.weather_condition ? `${run.run_type} · ${weatherIcon(run.weather_condition)} ${run.weather_condition}` : run.run_type}
    >
      {/* Hero stats */}
      <div className="card p-5 mt-2 flex items-center justify-around text-center">
        <div>
          <p className="text-3xl font-bold tnum text-primary">{run.distance.toFixed(2)}</p>
          <p className="text-xs text-muted">miles</p>
        </div>
        <div className="w-px self-stretch bg-border" />
        <div>
          <p className="text-3xl font-bold tnum text-secondary">{fmtPace(run.pace_seconds)}</p>
          <p className="text-xs text-muted">/mi pace</p>
        </div>
        <div className="w-px self-stretch bg-border" />
        <div>
          <p className="text-3xl font-bold tnum">{fmtDuration(run.duration_seconds)}</p>
          <p className="text-xs text-muted">time</p>
        </div>
      </div>

      <div className="flex items-center gap-2 mt-4">
        <span className="text-sm text-muted">Difficulty</span>
        <DifficultyBadge value={run.difficulty} />
      </div>

      <div className="grid grid-cols-3 gap-3 mt-4">
        <Stat label="Elevation" value={run.elevation_gain} unit="ft" />
        <Stat label="Calories" value={run.calories} />
        <Stat label="Avg HR" value={run.avg_hr || '—'} unit={run.avg_hr ? 'bpm' : ''} />
        <Stat label="Temp" value={run.temperature} unit="°F" />
        <Stat label="Wind" value={run.wind_speed} unit="mph" />
        <Stat label="Humidity" value={run.humidity} unit="%" />
      </div>

      {run.notes && (
        <div className="card p-4 mt-4">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted mb-1">Notes</p>
          <p className="text-sm text-txt whitespace-pre-wrap">{run.notes}</p>
        </div>
      )}

      <div className="flex gap-3 mt-6">
        <button
          className="btn-ghost flex-1"
          onClick={() => navigate('/log', { state: { run } })}
        >
          Edit
        </button>
        {confirm ? (
          <button className="flex-1 min-h-[44px] rounded-lg bg-danger text-bg font-bold disabled:opacity-50" onClick={del} disabled={busy}>
            {busy ? 'Deleting…' : 'Confirm Delete'}
          </button>
        ) : (
          <button className="btn-ghost flex-1 text-danger border-danger/40" onClick={() => setConfirm(true)}>
            Delete
          </button>
        )}
      </div>
    </Layout>
  );
}
