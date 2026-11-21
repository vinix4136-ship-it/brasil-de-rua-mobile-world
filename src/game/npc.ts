import { BLOCK, CELL, HALF, N, collide, type Game } from './sim';
import { burst } from './effects';
export type Pedestrian = { x: number; z: number; h: number; phase: number; flee: number; down: number; axis: number; origin: number; sign: number };
export function createPedestrians(): Pedestrian[] {
  return Array.from({ length: 30 }, (_, i) => {
    const lane = (i % (N - 1) + 1) * CELL - HALF + (CELL - BLOCK) / 2 - 0.9;
    const along = -HALF + 12 + ((i * 37) % (N * CELL - 24));
    return { x: i % 2 ? lane : along, z: i % 2 ? along : lane, h: i % 2 ? 0 : Math.PI / 2, phase: i, flee: 0, down: 0, axis: i % 2, origin: lane, sign: i % 3 ? 1 : -1 };
  });
}
export function crime(g: Game) { g.wanted = Math.min(5, g.wanted + 1); g.calmT = 0; g.msg = 'Procurado'; g.msgT = 2; }
export function shoot(g: Game) {
  if (g.vehicle || g.ammo <= 0 || g.shotCd > 0) return;
  g.ammo--; g.shotCd = 0.3; g.shots++; crime(g);
  let target: { x: number; z: number } | null = null, nearest = 40;
  for (const n of g.pedestrians) {
    const d = Math.hypot(n.x - g.player.x, n.z - g.player.z);
    if (d < 45) n.flee = 8;
    if (d < nearest && n.down <= 0) { target = n; nearest = d; }
  }
  for (const n of g.police) {
    const d = Math.hypot(n.x - g.player.x, n.z - g.player.z);
    if (d < nearest) { target = n; nearest = d; }
  }
  if (target) {
    // A building interrupts the automatic aim ray.
    const dx = target.x - g.player.x, dz = target.z - g.player.z;
    let blocked = false;
    for (let i = 1; i < 16; i++) {
      const x = g.player.x + dx * i / 16, z = g.player.z + dz * i / 16;
      const cx = (Math.floor((x + HALF) / CELL) + 0.5) * CELL - HALF;
      const cz = (Math.floor((z + HALF) / CELL) + 0.5) * CELL - HALF;
      if (Math.abs(x - cx) < BLOCK / 2 && Math.abs(z - cz) < BLOCK / 2) { blocked = true; break; }
    }
    if (!blocked) {
      g.player.h = Math.atan2(dx, dz); burst(g, target.x, target.z, 1, 8);
      if ('down' in target) (target as Pedestrian).down = 15;
      else { const index = g.police.indexOf(target as typeof g.player); if (index >= 0) g.police.splice(index, 1); }
    }
  }
  burst(g, g.player.x + Math.sin(g.player.h) * 0.8, g.player.z + Math.cos(g.player.h) * 0.8, 2, 4);
}
export function stepPedestrians(g: Game, dt: number) {
  for (const n of g.pedestrians) {
    if (n.down > 0) { n.down -= dt; continue; }
    const distance = Math.hypot(n.x - g.player.x, n.z - g.player.z);
    if (g.vehicle && Math.abs(g.player.v) > 3 && distance < 1.8) {
      n.down = 12; if (g.hitCd <= 0) { crime(g); g.hitCd = 1; } burst(g, n.x, n.z, 1, 6); continue;
    }
    if (distance < 16 && g.crashT > 0) n.flee = 6;
    if (n.flee > 0) {
      n.flee -= dt; n.h = Math.atan2(n.x - g.player.x, n.z - g.player.z);
      n.x += Math.sin(n.h) * 4 * dt; n.z += Math.cos(n.h) * 4 * dt;
      // Reuse one collision proxy rather than allocating one per pedestrian.
      const proxy = g.pedProxy; proxy.x = n.x; proxy.z = n.z; collide(proxy, 0.25); n.x = proxy.x; n.z = proxy.z;
    } else {
      // Recover the sidewalk after fleeing, then pace its length.
      if (n.axis) { n.x += (n.origin - n.x) * Math.min(1, dt * 2); n.z += n.sign * 1.1 * dt; n.h = n.sign > 0 ? 0 : Math.PI; }
      else { n.z += (n.origin - n.z) * Math.min(1, dt * 2); n.x += n.sign * 1.1 * dt; n.h = n.sign > 0 ? Math.PI / 2 : -Math.PI / 2; }
      if (Math.abs(n.axis ? n.z : n.x) > HALF - 10) n.sign *= -1;
    }
    n.phase += dt * (n.flee > 0 ? 9 : 3);
  }
}
