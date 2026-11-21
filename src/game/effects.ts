import type { Game } from './sim';
export type Particle = { x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number; kind: number };
export const PARTICLE_COUNT = 60;
export function createParticles(): Particle[] {
  return Array.from({ length: PARTICLE_COUNT }, () => ({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, kind: 0 }));
}
export function burst(g: Game, x: number, z: number, kind: number, count: number) {
  for (let i = 0; i < count; i++) {
    const p = g.particles[g.particleCursor];
    g.particleCursor = (g.particleCursor + 1) % PARTICLE_COUNT;
    if (!p) continue;
    p.x = x; p.z = z; p.y = kind === 2 ? 1.3 : 0.2; p.kind = kind;
    p.life = kind === 0 ? 1.1 : 0.35;
    const a = g.t * 11 + i * 2.4;
    p.vx = Math.sin(a) * (kind ? 5 : 1); p.vz = Math.cos(a) * (kind ? 5 : 1); p.vy = kind ? 3 : 0.8;
  }
}
export function stepParticles(g: Game, dt: number) {
  for (const p of g.particles) {
    if (p.life <= 0) continue;
    p.life -= dt; p.x += p.vx * dt; p.z += p.vz * dt; p.y += p.vy * dt;
    if (p.kind) p.vy -= 9 * dt;
  }
}
