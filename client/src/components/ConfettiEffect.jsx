import { createContext, useCallback, useContext, useEffect, useRef } from 'react';

const ConfettiContext = createContext(() => {});
export function useConfetti() { return useContext(ConfettiContext); }

const COLORS = ['#FF6B2B', '#7B61FF', '#FFFFFF', '#FFD700'];

function drawStar(ctx, x, y, r, rot) {
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const a = rot + (i * 2 * Math.PI) / 5 - Math.PI / 2;
    ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    const a2 = a + Math.PI / 5;
    ctx.lineTo(x + Math.cos(a2) * r * 0.45, y + Math.sin(a2) * r * 0.45);
  }
  ctx.closePath();
  ctx.fill();
}

// Vanilla canvas confetti burst from screen center. No external library.
export function ConfettiProvider({ children }) {
  const canvasRef = useRef(null);
  const partsRef = useRef([]);
  const rafRef = useRef(0);

  const tick = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) { rafRef.current = 0; return; }
    const ctx = canvas.getContext('2d');
    const now = performance.now();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    partsRef.current = partsRef.current.filter((p) => now - p.born < p.life);
    for (const p of partsRef.current) {
      p.x += p.vx; p.y += p.vy; p.vy += 0.12; p.vx *= 0.99; p.rot += p.vr;
      const alpha = Math.max(0, 1 - (now - p.born) / p.life);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      if (p.star) drawStar(ctx, p.x, p.y, p.size * 1.6, p.rot);
      else { ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill(); }
    }
    ctx.globalAlpha = 1;
    if (partsRef.current.length) rafRef.current = requestAnimationFrame(tick);
    else { rafRef.current = 0; ctx.clearRect(0, 0, canvas.width, canvas.height); }
  }, []);

  const fire = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const W = window.innerWidth, H = window.innerHeight;
    canvas.width = W; canvas.height = H;
    const cx = W / 2, cy = H / 2.5;
    const n = 50;
    const now = performance.now();
    const burst = [];
    for (let i = 0; i < n; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 3 + Math.random() * 6;
      burst.push({
        x: cx, y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2,
        size: 3 + Math.random() * 4,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        star: Math.random() < 0.35,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.3,
        born: now,
        life: 1000 + Math.random() * 300,
      });
    }
    partsRef.current = partsRef.current.concat(burst);
    if (!rafRef.current) rafRef.current = requestAnimationFrame(tick);
  }, [tick]);

  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);

  return (
    <ConfettiContext.Provider value={fire}>
      {children}
      <canvas ref={canvasRef} className="confetti-canvas" aria-hidden />
    </ConfettiContext.Provider>
  );
}
