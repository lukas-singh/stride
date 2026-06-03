import { fmtPace } from './format.js';

const DAY = 86400000;

export function filterByRange(runs, range) {
  if (range === 'all') return runs;
  const days = range === '30' ? 30 : 90;
  const cutoff = Date.now() - days * DAY;
  return runs.filter((r) => new Date(r.date + 'T00:00:00').getTime() >= cutoff);
}

function avg(arr) { return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0; }

function weekKey(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDay();
  const monday = new Date(d);
  monday.setDate(d.getDate() - ((day + 6) % 7));
  return monday.toISOString().slice(0, 10);
}

// 1. Miles over time — weekly totals, last 12 weeks
export function milesOverTime(runs) {
  const map = {};
  for (const r of runs) {
    const k = weekKey(r.date);
    map[k] = (map[k] || 0) + r.distance;
  }
  const weeks = Object.keys(map).sort().slice(-12);
  const data = weeks.map((w) => ({
    week: new Date(w + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    miles: +map[w].toFixed(1),
  }));
  const best = data.reduce((m, d) => (d.miles > m ? d.miles : m), 0);
  const insight = data.length ? `Peak week: ${best.toFixed(1)} mi. Averaging ${avg(data.map((d) => d.miles)).toFixed(1)} mi/week.` : 'Log runs to see weekly volume.';
  return { data, insight };
}

// 2. Pace trend — last 30 runs, mark PBs
export function paceTrendData(runs) {
  const sorted = [...runs].sort((a, b) => a.date.localeCompare(b.date)).slice(-30);
  let bestPace = Infinity;
  const data = sorted.map((r, i) => {
    const isPB = r.pace_seconds < bestPace;
    if (isPB) bestPace = r.pace_seconds;
    return {
      idx: i + 1,
      label: r.date.slice(5),
      pace: r.pace_seconds,
      paceLabel: fmtPace(r.pace_seconds),
      pb: isPB ? r.pace_seconds : null,
    };
  });
  let insight = 'Not enough runs yet for a trend.';
  if (data.length >= 2) {
    const first = data[0].pace, last = data[data.length - 1].pace;
    const diff = first - last;
    insight = diff > 3 ? `Your pace improved ~${Math.round(diff)}s/mi over these runs. 📈`
      : diff < -3 ? `Pace has eased ~${Math.round(-diff)}s/mi recently — could be base building.`
      : 'Your pace has been steady across recent runs.';
  }
  return { data, insight };
}

// 3. Difficulty vs pace scatter, colored by type
export function difficultyPaceScatter(runs) {
  const byType = {};
  for (const r of runs) {
    (byType[r.run_type] ||= []).push({ x: r.difficulty, y: r.pace_seconds, paceLabel: fmtPace(r.pace_seconds) });
  }
  const hardest = runs.filter((r) => r.difficulty >= 8);
  const insight = hardest.length
    ? `Your hardest runs (8+) average ${fmtPace(Math.round(avg(hardest.map((r) => r.pace_seconds))))}/mi.`
    : 'Higher difficulty usually tracks with faster paces.';
  return { byType, insight };
}

// 4. HR distribution bins
export function hrDistribution(runs) {
  const bins = [
    { label: '<130', min: 0, max: 129 },
    { label: '130-139', min: 130, max: 139 },
    { label: '140-149', min: 140, max: 149 },
    { label: '150-159', min: 150, max: 159 },
    { label: '160-169', min: 160, max: 169 },
    { label: '170+', min: 170, max: 999 },
  ];
  const withHR = runs.filter((r) => r.avg_hr > 0);
  const data = bins.map((b) => ({ label: b.label, count: withHR.filter((r) => r.avg_hr >= b.min && r.avg_hr <= b.max).length }));
  const top = data.reduce((m, d) => (d.count > m.count ? d : m), { count: -1 });
  const insight = withHR.length ? `Most runs fall in the ${top.label} bpm zone.` : 'Add heart-rate data to see your zones.';
  return { data, insight };
}

// 5. Performance by temperature
export function paceByTemp(runs) {
  const buckets = [
    { label: '<40°', min: -99, max: 39 },
    { label: '40-50', min: 40, max: 49 },
    { label: '50-60', min: 50, max: 59 },
    { label: '60-70', min: 60, max: 69 },
    { label: '70-80', min: 70, max: 79 },
    { label: '80+', min: 80, max: 999 },
  ];
  const data = buckets.map((b) => {
    const inB = runs.filter((r) => r.temperature >= b.min && r.temperature <= b.max);
    return { label: b.label, pace: inB.length ? Math.round(avg(inB.map((r) => r.pace_seconds))) : 0, count: inB.length };
  });
  const valid = data.filter((d) => d.count > 0);
  const fastest = valid.reduce((m, d) => (!m || d.pace < m.pace ? d : m), null);
  const insight = fastest ? `Your fastest runs happen at ${fastest.label}°F (${fmtPace(fastest.pace)}/mi).` : 'Add temperature data to compare.';
  return { data, insight };
}

// 6. Elevation vs pace scatter
export function elevationPaceScatter(runs) {
  const data = runs.map((r) => ({ x: r.elevation_gain, y: r.pace_seconds, paceLabel: fmtPace(r.pace_seconds) }));
  const hilly = runs.filter((r) => r.elevation_gain > 200);
  const flat = runs.filter((r) => r.elevation_gain <= 200);
  let insight = 'Log elevation to see how hills affect your pace.';
  if (hilly.length && flat.length) {
    const dh = Math.round(avg(hilly.map((r) => r.pace_seconds)) - avg(flat.map((r) => r.pace_seconds)));
    insight = dh > 0 ? `Hilly runs (>200ft) are ~${dh}s/mi slower on average.` : `You hold pace well on hills — only ~${Math.abs(dh)}s/mi difference.`;
  }
  return { data, insight };
}

// 7. Weekly mileage + run count combo
export function weeklyMileageCount(runs) {
  const map = {};
  for (const r of runs) {
    const k = weekKey(r.date);
    map[k] ||= { miles: 0, count: 0 };
    map[k].miles += r.distance;
    map[k].count += 1;
  }
  const weeks = Object.keys(map).sort().slice(-12);
  const data = weeks.map((w) => ({
    week: new Date(w + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    miles: +map[w].miles.toFixed(1),
    runs: map[w].count,
  }));
  const insight = data.length ? `You average ${avg(data.map((d) => d.runs)).toFixed(1)} runs/week.` : 'No data yet.';
  return { data, insight };
}

// 8. Performance by run type
export function paceByType(runs) {
  const byType = {};
  for (const r of runs) (byType[r.run_type] ||= []).push(r.pace_seconds);
  const data = Object.entries(byType).map(([type, paces]) => ({ type, pace: Math.round(avg(paces)), count: paces.length }));
  data.sort((a, b) => a.pace - b.pace);
  const fastest = data[0];
  const insight = fastest ? `Your fastest type is ${fastest.type} at ${fmtPace(fastest.pace)}/mi.` : 'No data yet.';
  return { data, insight };
}

export const TYPE_COLORS = {
  Easy: '#00C46A',
  Tempo: '#7B61FF',
  'Long Run': '#3FA9FF',
  Interval: '#FF9F40',
  Race: '#FF4D6D',
  Recovery: '#6B6B80',
};
