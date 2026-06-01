import { useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Layout from '../components/Layout.jsx';
import { useToast } from '../components/Toast.jsx';
import { api } from '../api.js';
import { todayISO, fmtPace, difficultyColor } from '../lib/format.js';

const RUN_TYPES = ['Easy', 'Tempo', 'Long Run', 'Interval', 'Race', 'Recovery'];

function NumField({ label, value, onChange, step = '1', placeholder, unit, min }) {
  return (
    <div>
      <label className="label">{label}{unit ? ` (${unit})` : ''}</label>
      <input
        className="input tnum"
        type="number"
        inputMode="decimal"
        step={step}
        min={min}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

export default function LogRun() {
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const editRun = location.state?.run;
  const isEdit = !!editRun;

  const [date, setDate] = useState(editRun?.date || todayISO());
  const [distance, setDistance] = useState(editRun ? String(editRun.distance) : '');
  const [mins, setMins] = useState(editRun ? String(Math.floor(editRun.duration_seconds / 60)) : '');
  const [secs, setSecs] = useState(editRun ? String(editRun.duration_seconds % 60) : '');
  const [manualPace, setManualPace] = useState(editRun ? editRun.pace_seconds : null);
  const [elevation, setElevation] = useState(editRun ? String(editRun.elevation_gain) : '');
  const [calories, setCalories] = useState(editRun ? String(editRun.calories) : '');
  const [hr, setHr] = useState(editRun ? String(editRun.avg_hr) : '');
  const [temp, setTemp] = useState(editRun ? String(editRun.temperature) : '');
  const [wind, setWind] = useState(editRun ? String(editRun.wind_speed) : '');
  const [humidity, setHumidity] = useState(editRun ? String(editRun.humidity) : '');
  const [difficulty, setDifficulty] = useState(editRun?.difficulty ?? 5);
  const [runType, setRunType] = useState(editRun?.run_type || 'Easy');
  const [notes, setNotes] = useState(editRun?.notes || '');
  const [busy, setBusy] = useState(false);

  const durationSeconds = (parseInt(mins, 10) || 0) * 60 + (parseInt(secs, 10) || 0);
  const dist = parseFloat(distance) || 0;

  // auto pace from distance + time, unless user overrode it
  const autoPace = dist > 0 && durationSeconds > 0 ? Math.round(durationSeconds / dist) : 0;
  const pace = manualPace ?? autoPace;

  const diffColor = difficultyColor(difficulty);
  const fillPct = ((difficulty - 1) / 9) * 100;

  const paceDisplay = useMemo(() => fmtPace(pace), [pace]);

  async function save(e) {
    e.preventDefault();
    if (!(dist > 0)) return toast.error('Enter a distance greater than 0.');
    if (durationSeconds <= 0) return toast.error('Enter the run time.');
    setBusy(true);
    const payload = {
      date,
      distance: dist,
      duration_seconds: durationSeconds,
      pace_seconds: pace,
      elevation_gain: parseInt(elevation, 10) || 0,
      calories: parseInt(calories, 10) || 0,
      avg_hr: parseInt(hr, 10) || 0,
      temperature: parseInt(temp, 10) || 0,
      wind_speed: parseInt(wind, 10) || 0,
      humidity: parseInt(humidity, 10) || 0,
      difficulty: Number(difficulty),
      run_type: runType,
      notes,
    };
    try {
      if (isEdit) {
        await api(`/runs/${editRun.id}`, { method: 'PUT', body: payload });
        toast.success('Run updated');
      } else {
        await api('/runs', { method: 'POST', body: payload });
        toast.success('Run saved 🏃');
      }
      navigate('/', { replace: true });
    } catch (err) {
      toast.error(err.message);
      setBusy(false);
    }
  }

  return (
    <Layout title={isEdit ? 'Edit Run' : 'Log Run'}>
      <form onSubmit={save} className="mt-2 space-y-5">
        <div>
          <label className="label">Date</label>
          <input className="input" type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} />
        </div>

        <NumField label="Distance" unit="mi" step="0.01" min="0" placeholder="3.10" value={distance} onChange={setDistance} />

        <div>
          <label className="label">Total Time</label>
          <div className="flex items-center gap-2">
            <input className="input tnum text-center" type="number" inputMode="numeric" min="0" placeholder="Min" value={mins} onChange={(e) => { setMins(e.target.value); setManualPace(null); }} />
            <span className="text-muted font-bold">:</span>
            <input className="input tnum text-center" type="number" inputMode="numeric" min="0" max="59" placeholder="Sec" value={secs} onChange={(e) => { setSecs(e.target.value); setManualPace(null); }} />
          </div>
        </div>

        {/* Live pace */}
        <div className="card p-4 flex items-center justify-between border-primary/30">
          <div>
            <p className="label mb-0">Pace</p>
            <p className="text-xs text-muted">auto-calculated · editable below</p>
          </div>
          <span className="text-3xl font-bold tnum text-primary">{paceDisplay}<span className="text-sm text-muted">/mi</span></span>
        </div>
        <div>
          <label className="label">Override Pace (min : sec / mi)</label>
          <div className="flex items-center gap-2">
            <input
              className="input tnum text-center"
              type="number"
              inputMode="numeric"
              min="0"
              placeholder="Min"
              value={pace ? Math.floor(pace / 60) : ''}
              onChange={(e) => setManualPace((parseInt(e.target.value, 10) || 0) * 60 + (pace % 60))}
            />
            <span className="text-muted font-bold">:</span>
            <input
              className="input tnum text-center"
              type="number"
              inputMode="numeric"
              min="0"
              max="59"
              placeholder="Sec"
              value={pace ? pace % 60 : ''}
              onChange={(e) => setManualPace(Math.floor(pace / 60) * 60 + (parseInt(e.target.value, 10) || 0))}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <NumField label="Elevation" unit="ft" step="1" min="0" placeholder="0" value={elevation} onChange={setElevation} />
          <NumField label="Calories" step="1" min="0" placeholder="0" value={calories} onChange={setCalories} />
          <NumField label="Avg Heart Rate" unit="bpm" step="1" min="0" placeholder="0" value={hr} onChange={setHr} />
          <NumField label="Temperature" unit="°F" step="1" placeholder="0" value={temp} onChange={setTemp} />
          <NumField label="Wind Speed" unit="mph" step="1" min="0" placeholder="0" value={wind} onChange={setWind} />
          <NumField label="Humidity" unit="%" step="1" min="0" placeholder="0" value={humidity} onChange={setHumidity} />
        </div>

        {/* Difficulty slider */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="label mb-0">Difficulty</label>
            <span className="text-lg font-bold tnum" style={{ color: diffColor }}>{Number(difficulty).toFixed(1)}/10</span>
          </div>
          <input
            type="range"
            min="1"
            max="10"
            step="0.5"
            value={difficulty}
            onChange={(e) => setDifficulty(parseFloat(e.target.value))}
            className="w-full"
            style={{
              background: `linear-gradient(to right, ${diffColor} 0%, ${diffColor} ${fillPct}%, #1E1E2E ${fillPct}%, #1E1E2E 100%)`,
            }}
          />
          <div className="flex justify-between text-[10px] text-muted mt-1">
            <span>Easy</span><span>Moderate</span><span>Max</span>
          </div>
        </div>

        <div>
          <label className="label">Run Type</label>
          <select className="input appearance-none" value={runType} onChange={(e) => setRunType(e.target.value)}>
            {RUN_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        <div>
          <label className="label">Notes</label>
          <textarea
            className="input py-3 min-h-[88px] resize-none"
            placeholder="How did it feel?"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        <button type="submit" className="btn-primary text-base" disabled={busy}>
          {busy ? 'Saving…' : isEdit ? 'Update Run' : 'Save Run'}
        </button>
      </form>
    </Layout>
  );
}
