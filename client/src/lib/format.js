// Time / pace formatting helpers used across the app.

export function pad(n) {
  return String(Math.floor(n)).padStart(2, '0');
}

// seconds -> "MM:SS" or "H:MM:SS"
export function fmtDuration(totalSeconds) {
  if (!totalSeconds || totalSeconds < 0) return '0:00';
  const s = Math.round(totalSeconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${pad(m)}:${pad(sec)}`;
  return `${m}:${pad(sec)}`;
}

// seconds-per-mile -> "MM:SS"
export function fmtPace(paceSeconds) {
  if (!paceSeconds || paceSeconds <= 0) return '--:--';
  const m = Math.floor(paceSeconds / 60);
  const s = Math.round(paceSeconds % 60);
  return `${m}:${pad(s)}`;
}

// "MM:SS" or "H:MM:SS" -> seconds
export function parseTimeToSeconds(str) {
  if (!str) return 0;
  const parts = String(str).trim().split(':').map((p) => parseInt(p, 10) || 0);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] || 0;
}

export function fmtDate(iso, opts) {
  if (!iso) return '';
  const d = new Date(iso + (iso.length === 10 ? 'T00:00:00' : ''));
  return d.toLocaleDateString(undefined, opts || { month: 'short', day: 'numeric' });
}

export function relativeDay(iso) {
  const d = new Date(iso + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((today - d) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff < 7) return `${diff} days ago`;
  return fmtDate(iso);
}

export function todayISO() {
  const d = new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
}

export function difficultyColor(d) {
  if (d <= 4) return '#00F5A0';
  if (d <= 7) return '#FFD23F';
  return '#FF4D6D';
}
