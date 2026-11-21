import { collide, type Car, type Game, type Input } from './sim';
export const WALK_SPEED = 3.2, RUN_SPEED = 6.5, ENTER_RADIUS = 5;
export function enterExit(g: Game) {
  const p = g.player;
  if (g.vehicle) {
    g.vehicle.v = 0; g.vehicle = null; p.x += Math.cos(p.h) * 2.8; p.z -= Math.sin(p.h) * 2.8;
    p.v = 0; p.lat = 0; collide(p, 0.38); return;
  }
  let closest: Car | null = null, distance = ENTER_RADIUS;
  const choose = (c: Car) => {
    const d = Math.hypot(c.x - p.x, c.z - p.z);
    if (d < distance) { closest = c; distance = d; }
  };
  for (const c of g.parked) choose(c);
  for (const c of g.npcs) choose(c);
  for (const c of g.police) choose(c);
  if (closest) { g.vehicle = closest; Object.assign(p, closest); p.v = 0; }
  else { g.msg = 'Nenhum carro próximo'; g.msgT = 2; }
}
export function walk(g: Game, input: Input, dt: number) {
  const p = g.player, length = Math.hypot(input.steer, input.throttle), speed = input.run ? RUN_SPEED : WALK_SPEED;
  if (length < 0.08) { p.v = 0; return; }
  const scale = speed / Math.max(1, length), s = Math.sin(g.cameraYaw), c = Math.cos(g.cameraYaw);
  const dx = (s * input.throttle - c * input.steer) * scale;
  const dz = (c * input.throttle + s * input.steer) * scale;
  p.x += dx * dt; collide(p, 0.38); p.z += dz * dt; collide(p, 0.38);
  p.h = Math.atan2(dx, dz); p.v = speed * Math.min(1, length);
  g.walkPhase += p.v * dt * 2.2;
}
export const SAVE_KEY = 'outlawed-progress-v1';
export function saveProgress(g: Game) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify({ money: g.money, x: g.player.x, z: g.player.z, h: g.player.h, ammo: g.ammo })); } catch { /* storage may be disabled */ }
}
export function restoreProgress(g: Game) {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
    if (!value || typeof value !== 'object') return;
    const v = value as Record<string, unknown>;
    if (typeof v['money'] === 'number' && Number.isFinite(v['money'])) g.money = Math.max(0, Math.floor(v['money']));
    if (typeof v['x'] === 'number' && typeof v['z'] === 'number' && Number.isFinite(v['x']) && Number.isFinite(v['z'])) {
      g.player.x = v['x']; g.player.z = v['z']; collide(g.player, 0.38);
    }
    if (typeof v['h'] === 'number' && Number.isFinite(v['h'])) g.player.h = v['h'];
    if (typeof v['ammo'] === 'number' && Number.isFinite(v['ammo'])) g.ammo = Math.max(0, Math.min(60, Math.floor(v['ammo'])));
  } catch { /* ignore malformed saves */ }
}
