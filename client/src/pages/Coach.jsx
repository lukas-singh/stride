import { useEffect, useState } from 'react';
import Layout from '../components/Layout.jsx';
import EmptyState from '../components/EmptyState.jsx';
import ErrorBoundary from '../components/ErrorBoundary.jsx';
import { CardSkeletonList } from '../components/Skeleton.jsx';
import { useToast } from '../components/Toast.jsx';
import { api } from '../api.js';
import { runCoach } from '../lib/coachEngine.js';
import { fmtDuration, fmtPace } from '../lib/format.js';

const WORKOUT_COLORS = {
  Easy: '#00F5A0',
  Tempo: '#7B61FF',
  'Long Run': '#3FA9FF',
  Interval: '#FF9F40',
  Recovery: '#6B6B80',
  Rest: '#3A3A4A',
};

const CONFIDENCE_COLORS = { Low: '#FF4D6D', Medium: '#FFD23F', High: '#00F5A0' };

export default function Coach() {
  const toast = useToast();
  const [runs, setRuns] = useState(null);
  const [goalText, setGoalText] = useState('');
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [savedGoal, setSavedGoal] = useState(undefined);

  // Load runs + any saved goal together, then rebuild a COMPLETE result from
  // the user's data. (The previous version set a partial result with no
  // `fitness`/`suggestions`, which crashed CoachResult on render.)
  useEffect(() => {
    let mounted = true;
    Promise.all([
      api('/runs').catch(() => []),
      api('/goals').catch(() => null),
    ]).then(([runsData, goal]) => {
      if (!mounted) return;
      const safeRuns = Array.isArray(runsData) ? runsData : [];
      setRuns(safeRuns);
      setSavedGoal(goal || null);
      if (goal && goal.raw_text) {
        setGoalText(goal.raw_text);
        try {
          setResult(runCoach(goal.raw_text, safeRuns));
        } catch (e) {
          console.error('Failed to restore saved coaching plan:', e);
        }
      }
    });
    return () => { mounted = false; };
  }, []);

  async function generate() {
    if (!goalText.trim()) return toast.error('Describe your goal first.');
    if (!runs || runs.length === 0) return toast.error('Log some runs first so the coach has data.');
    setBusy(true);
    try {
      const r = runCoach(goalText, runs);
      setResult(r);
      await api('/goals', {
        method: 'POST',
        body: {
          raw_text: goalText,
          race_distance: r.goal.raceDistance,
          target_pace_seconds: r.goal.targetPaceSeconds,
          target_date: r.goal.targetDate,
          weeks_remaining: r.goal.weeksRemaining,
          plan_json: r.plan,
          prediction_json: r.prediction,
        },
      });
      toast.success('Plan generated & saved 🤖');
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  const loading = runs === null || savedGoal === undefined;

  return (
    <Layout title="Coach 🤖" subtitle="Rule-based, powered by your data">
      {/* Goal input */}
      <div className="card p-4 mt-2">
        <label className="label">What's your goal?</label>
        <textarea
          className="input py-3 min-h-[64px] resize-none"
          placeholder="Half marathon in August at 8:30 pace"
          value={goalText}
          onChange={(e) => setGoalText(e.target.value)}
        />
        <button className="btn-primary mt-3" onClick={generate} disabled={busy}>
          {busy ? 'Analyzing…' : 'Generate Plan'}
        </button>
        {result?.goal && (
          <div className="flex flex-wrap gap-2 mt-3">
            {result.goal.raceDistance && <span className="chip bg-secondary/15 text-secondary">{result.goal.raceDistance}</span>}
            {result.goal.targetPaceSeconds && <span className="chip bg-primary/15 text-primary tnum">{fmtPace(result.goal.targetPaceSeconds)}/mi goal</span>}
            {result.goal.weeksRemaining && <span className="chip bg-border text-muted">{result.goal.weeksRemaining} weeks out</span>}
          </div>
        )}
      </div>

      <ErrorBoundary
        resetKey={result}
        fallback={({ reset }) => (
          <div className="mt-4">
            <EmptyState
              icon="😵‍💫"
              title="Couldn't build your plan"
              message="The coach hit an unexpected error crunching your data. Your runs are safe — try generating again."
              ctaLabel="Try again"
              onCta={reset}
            />
          </div>
        )}
      >
        {loading ? (
          <div className="mt-4"><CardSkeletonList count={3} height="h-28" /></div>
        ) : !result ? (
          <div className="mt-4">
            {runs.length === 0 ? (
              <EmptyState icon="📋" title="No runs to analyze" message="Log a few runs and your coach will build a personalized race plan." ctaLabel="Log a Run →" ctaTo="/log" />
            ) : (
              <EmptyState icon="🎯" title="Set your goal" message="Tell the coach your target race, pace, and month — then hit Generate Plan." />
            )}
          </div>
        ) : (
          <CoachResult result={result} />
        )}
      </ErrorBoundary>
    </Layout>
  );
}

function CoachResult({ result }) {
  // Defensive defaults: even a partial/legacy result renders rather than crashes.
  const {
    prediction = {},
    fitness = { level: 'Base Building', description: '' },
    plan = [],
    suggestions = [],
  } = result || {};

  return (
    <div className="space-y-6 mt-5">
      {/* Predicted race time */}
      <section>
        <div className="card p-5 text-center border-primary/30">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Predicted Finish</p>
          <p className="text-5xl font-extrabold tnum text-primary mt-2 drop-shadow-[0_0_12px_rgba(0,245,160,0.4)]">
            {fmtDuration(prediction.predictedSeconds)}
          </p>
          <div className="flex items-center justify-center gap-3 mt-3">
            <span
              className="chip"
              style={{ color: CONFIDENCE_COLORS[prediction.confidence], backgroundColor: `${CONFIDENCE_COLORS[prediction.confidence]}1A` }}
            >
              {prediction.confidence} confidence
            </span>
            {prediction.deltaSeconds != null && (
              <DeltaBadge delta={prediction.deltaSeconds} />
            )}
          </div>
          <div className="grid grid-cols-3 gap-2 mt-4 text-xs">
            <Mini label="Avg pace" value={`${fmtPace(prediction.avgPace)}/mi`} />
            <Mini label="Race pace" value={`${fmtPace(prediction.racePaceSeconds)}/mi`} />
            <Mini label="Trend" value={prediction.trend} />
          </div>
        </div>
      </section>

      {/* Fitness */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted mb-2">Fitness Level</h2>
        <div className="card p-4">
          <p className="font-display font-bold text-xl text-secondary">{fitness.level}</p>
          <p className="text-sm text-muted mt-2 leading-relaxed">{fitness.description}</p>
        </div>
      </section>

      {/* Weekly training map */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted mb-2">Weekly Training Map</h2>
        <div className="space-y-3">
          {plan.map((week) => <WeekCard key={week.weekNumber} week={week} maxMiles={Math.max(...plan.map((w) => w.totalMiles))} />)}
        </div>
      </section>

      {/* Suggestions */}
      {suggestions && (
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted mb-2">Suggestions</h2>
          <div className="space-y-2">
            {suggestions.map((s, i) => (
              <div key={i} className="card p-3 flex gap-3 items-start">
                <span className="text-xl shrink-0">{s.icon}</span>
                <p className="text-sm text-txt leading-snug">{s.text}</p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Mini({ label, value }) {
  return (
    <div className="bg-bg rounded-lg py-2">
      <p className="text-[10px] text-muted uppercase">{label}</p>
      <p className="font-semibold tnum capitalize">{value}</p>
    </div>
  );
}

function DeltaBadge({ delta }) {
  if (Math.abs(delta) < 5) return <span className="chip bg-primary/15 text-primary">On target 🎯</span>;
  const slower = delta > 0;
  const color = slower ? '#FF4D6D' : '#00F5A0';
  return (
    <span className="chip tnum" style={{ color, backgroundColor: `${color}1A` }}>
      {slower ? '▲' : '▼'} {fmtDuration(Math.abs(delta))} {slower ? 'over' : 'under'} goal
    </span>
  );
}

function WeekCard({ week, maxMiles }) {
  const [open, setOpen] = useState(false);
  const pct = maxMiles > 0 ? (week.totalMiles / maxMiles) * 100 : 0;
  const phaseColor = week.phase === 'Peak' ? '#FF9F40' : week.phase === 'Taper' ? '#3FA9FF' : '#00F5A0';

  return (
    <div className="card overflow-hidden">
      <button onClick={() => setOpen((o) => !o)} className="w-full p-4 flex items-center gap-3 text-left">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold">Week {week.weekNumber}</span>
            <span className="chip text-[10px] py-0.5" style={{ color: phaseColor, backgroundColor: `${phaseColor}1A` }}>{week.phase}</span>
          </div>
          <div className="mt-2 h-1.5 rounded-full bg-bg overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: phaseColor }} />
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="font-bold tnum">{week.totalMiles}<span className="text-xs text-muted"> mi</span></p>
          <span className="text-muted text-xs">{open ? '▲' : '▼'}</span>
        </div>
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-2 route-fade">
          {week.keyWorkouts.map((w, i) => {
            const c = WORKOUT_COLORS[w.type] || '#6B6B80';
            return (
              <div key={i} className="flex items-center gap-3 bg-bg rounded-lg p-2.5">
                <span className="w-9 text-xs font-semibold text-muted">{w.day}</span>
                <span className="chip text-[10px] py-0.5 shrink-0" style={{ color: c, backgroundColor: `${c}1A` }}>{w.type}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm tnum">
                    {w.distance > 0 ? `${w.distance} mi` : 'Rest'}
                    {w.targetPace > 0 && <span className="text-muted"> · {fmtPace(w.targetPace)}/mi</span>}
                  </p>
                  <p className="text-[11px] text-muted truncate">{w.notes}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
