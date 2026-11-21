import { randomRoadPoint, type Game, type Job } from './sim';
export type Pickup = { x: number; z: number; active: boolean; cooldown: number };
export function createPickups(): Pickup[] {
  return Array.from({ length: 20 }, () => ({ ...randomRoadPoint(), active: true, cooldown: 0 }));
}
export function mission(g: Game, kind = g.missionIndex % 3): Job {
  const p = randomRoadPoint();
  return { ...p, time: 180, reward: kind === 0 ? 400 : kind === 1 ? 250 : 600, label: kind === 0 ? 'Leve o carro até o destino' : kind === 1 ? 'Pegue a encomenda' : 'Fuja da polícia' };
}
export function stepMissions(g: Game, dt: number) {
  for (const n of g.pickups) {
    if (!n.active) { n.cooldown -= dt; if (n.cooldown <= 0) n.active = true; }
    else if (Math.hypot(n.x - g.player.x, n.z - g.player.z) < 1.8) {
      n.active = false; n.cooldown = 90; g.money += 50; g.ammo = Math.min(60, g.ammo + 6); g.msg = '+R$ 50'; g.msgT = 2;
    }
  }
  const j = g.job, kind = g.missionIndex % 3;
  if (kind === 2 && !g.escapeStarted) { g.escapeStarted = true; g.wanted = Math.max(2, g.wanted); g.calmT = 0; }
  j.time -= dt;
  const arrived = Math.hypot(j.x - g.player.x, j.z - g.player.z) < 5;
  const complete = kind === 2 ? g.escapeStarted && g.wanted === 0 : arrived && (kind !== 0 || !!g.vehicle);
  if (complete) {
    g.money += j.reward; g.msg = `Missão concluída · +R$ ${j.reward}`; g.msgT = 3;
    g.missionIndex++; g.escapeStarted = false; g.job = mission(g);
  } else if (j.time <= 0) { g.msg = 'Tempo esgotado'; g.msgT = 3; g.job = mission(g); }
}
