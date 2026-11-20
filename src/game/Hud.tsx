import { useEffect, useRef } from "react";
import { CELL, HALF, N, type Game, type Input } from "./sim";

/** HUD writes straight to DOM at 10 Hz: zero React re-renders while playing. */
export function Hud({ game }: { game: Game }) {
  const map = useRef<HTMLCanvasElement>(null), money = useRef<HTMLDivElement>(null), stars = useRef<HTMLDivElement>(null);
  const speed = useRef<HTMLSpanElement>(null), job = useRef<HTMLDivElement>(null), msg = useRef<HTMLDivElement>(null), bust = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const ctx = map.current!.getContext("2d")!, S = 128, SC = 0.42;
    const iv = setInterval(() => {
      const p = game.player, c = Math.cos(p.h), s = Math.sin(p.h);
      const tf = (x: number, z: number): [number, number] => { const dx = x - p.x, dz = z - p.z; return [S / 2 + (-dx * c + dz * s) * SC, S / 2 - (dx * s + dz * c) * SC]; };
      ctx.fillStyle = "#2b3a2e"; ctx.fillRect(0, 0, S, S);
      ctx.strokeStyle = "#7a7d80"; ctx.lineWidth = 10 * SC; ctx.beginPath();
      for (let k = 0; k <= N; k++) {
        const r = k * CELL - HALF;
        let a = tf(r, -HALF), b = tf(r, HALF); ctx.moveTo(...a); ctx.lineTo(...b);
        a = tf(-HALF, r); b = tf(HALF, r); ctx.moveTo(...a); ctx.lineTo(...b);
      }
      ctx.stroke();
      const dot = (x: number, z: number, col: string, r: number, clampEdge = false) => {
        let [mx, my] = tf(x, z);
        if (clampEdge) { const dx = mx - S / 2, dy = my - S / 2, d = Math.hypot(dx, dy), m = S / 2 - 8; if (d > m) { mx = S / 2 + dx / d * m; my = S / 2 + dy / d * m; } }
        ctx.fillStyle = col; ctx.beginPath(); ctx.arc(mx, my, r, 0, 7); ctx.fill();
      };
      dot(game.job.x, game.job.z, "#e8c547", 4.5, true);
      const flash = Math.sin(game.t * 10) > 0 ? "#e33" : "#36f";
      for (const cop of game.police) dot(cop.x, cop.z, flash, 3.5, true);
      ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.moveTo(S / 2, S / 2 - 6); ctx.lineTo(S / 2 + 4.5, S / 2 + 5); ctx.lineTo(S / 2 - 4.5, S / 2 + 5); ctx.fill();

      money.current!.textContent = `R$ ${game.money.toLocaleString("pt-BR")}`;
      stars.current!.innerHTML = Array.from({ length: 5 }, (_, i) => `<span class="${i < game.wanted ? "hud-star-on" : "hud-star-off"}">★</span>`).join("");
      speed.current!.textContent = String(Math.round(Math.abs(p.v) * 3.6));
      const d = Math.round(Math.hypot(game.job.x - p.x, game.job.z - p.z));
      job.current!.textContent = `${game.job.label} · ${d} m · ${Math.max(0, Math.ceil(game.job.time))}s`;
      msg.current!.textContent = game.msg; msg.current!.style.opacity = game.msgT > 0 ? "1" : "0";
      bust.current!.style.opacity = game.bustT > 0 ? "1" : "0";
    }, 100);
    return () => clearInterval(iv);
  }, [game]);

  return (
    <div className="pointer-events-none absolute inset-0 font-sans">
      <div className="absolute left-3 top-3 flex flex-col items-start gap-1.5" style={{ top: "max(0.75rem, env(safe-area-inset-top))" }}>
        <canvas ref={map} width={128} height={128} className="hud-map h-24 w-24 rounded-full" />
        <div ref={job} className="hud-chip max-w-40 rounded px-1.5 py-0.5 text-[10px]" />
      </div>
      <div className="absolute right-3 top-3 text-right" style={{ top: "max(0.75rem, env(safe-area-inset-top))" }}>
        <div ref={money} className="hud-money font-display text-xl" />
        <div ref={stars} className="text-base tracking-wider" />
      </div>
      <div ref={msg} className="hud-msg absolute left-1/2 top-[22%] -translate-x-1/2 whitespace-nowrap font-display text-lg transition-opacity duration-500" />
      <div ref={bust} className="hud-bust absolute left-1/2 top-[32%] -translate-x-1/2 font-display text-2xl opacity-0">PARE O CARRO</div>
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-center" style={{ bottom: "max(1rem, env(safe-area-inset-bottom))" }}>
        <span ref={speed} className="hud-money font-display text-2xl">0</span><span className="ml-1 text-[10px] text-foreground/70">km/h</span>
      </div>
    </div>
  );
}

/** Floating joystick (left half) + translucent edge buttons; writes input ref only. */
export function TouchControls({ input }: { input: React.MutableRefObject<Input> }) {
  const base = useRef<HTMLDivElement>(null), knob = useRef<HTMLDivElement>(null);
  const st = useRef<{ id: number; x: number; y: number } | null>(null);
  const R = 55;
  const end = () => { st.current = null; base.current!.style.opacity = "0"; input.current.steer = 0; input.current.throttle = 0; };
  const hb = (v: boolean) => () => { input.current.handbrake = v; };
  return (
    <>
      <div className="absolute bottom-0 left-0 top-28 w-[60%] touch-none"
        onPointerDown={(e) => {
          st.current = { id: e.pointerId, x: e.clientX, y: e.clientY }; e.currentTarget.setPointerCapture(e.pointerId);
          const b = base.current!; b.style.left = `${e.clientX}px`; b.style.top = `${e.clientY}px`; b.style.opacity = "1"; knob.current!.style.transform = "translate(-50%,-50%)";
        }}
        onPointerMove={(e) => {
          const s = st.current; if (!s || s.id !== e.pointerId) return;
          let dx = e.clientX - s.x, dy = e.clientY - s.y; const d = Math.hypot(dx, dy);
          if (d > R) { dx = dx / d * R; dy = dy / d * R; }
          knob.current!.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
          input.current.steer = Math.abs(dx) < 6 ? 0 : dx / R;
          input.current.throttle = Math.abs(dy) < 8 ? 0 : -dy / R;
        }}
        onPointerUp={end} onPointerCancel={end} />
      <div ref={base} className="hud-joy pointer-events-none fixed h-28 w-28 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-0">
        <div ref={knob} className="hud-joy-knob absolute left-1/2 top-1/2 h-11 w-11 rounded-full" />
      </div>
      <div className="absolute right-4 flex flex-col gap-3" style={{ bottom: "max(1.5rem, env(safe-area-inset-bottom))" }}>
        <button aria-label="Freio de mão" className="hud-btn h-16 w-16 touch-none rounded-full text-[10px] font-semibold"
          onPointerDown={hb(true)} onPointerUp={hb(false)} onPointerLeave={hb(false)} onPointerCancel={hb(false)} onContextMenu={(e) => e.preventDefault()}>
          FREIO<br />DE MÃO
        </button>
      </div>
    </>
  );
}
