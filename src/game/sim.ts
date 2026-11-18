// Pure game rules: no React, no three.js.
export const CELL = 40, BLOCK = 28, N = 8, W = N * CELL, HALF = W / 2;
export const ACCEL = 20, BRAKE = 38, MAXV = 30, REV = -10, DRAG = 0.5, COAST = 0.9, TURN = 2.3;
export const POLICE_MAXV = 27, CAR_R = 1.5;

export type Car = { x: number; z: number; h: number; v: number };
export type Npc = Car & { axis: "x" | "z"; sign: number; color: string };
export type Input = { throttle: number; steer: number };
export type Mission = { x: number; z: number; time: number; reward: number; label: string };
export type Game = {
  player: Car; npcs: Npc[]; police: Car[]; coins: { x: number; z: number; taken: boolean }[];
  money: number; wanted: number; calmT: number; bustT: number; hitCd: number;
  mission: Mission; msg: string; msgT: number; t: number;
};

let seed = 7;
export const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

const COLORS = ["#f2a541", "#e85d3f", "#f5d547", "#4fb286", "#3d8bd6", "#f07ca8", "#9ad14b", "#f4efe1", "#e0b07a", "#5bc0be"];
export const BUILDINGS: { x: number; z: number; w: number; d: number; h: number; color: string }[] = [];
for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
  const cx = (i + 0.5) * CELL - HALF, cz = (j + 0.5) * CELL - HALF;
  for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) {
    const w = 10 + rnd() * 2.5, d = 10 + rnd() * 2.5;
    const favela = rnd() < 0.5;
    BUILDINGS.push({ x: cx + (a - 0.5) * 12.5, z: cz + (b - 0.5) * 12.5, w, d, h: favela ? 4 + rnd() * 6 : 10 + rnd() * 26, color: COLORS[Math.floor(rnd() * COLORS.length)]! });
  }
}

export function collide(c: Car, r = CAR_R) {
  let hit = false;
  if (Math.abs(c.x) > HALF - r) { c.x = clamp(c.x, -HALF + r, HALF - r); hit = true; }
  if (Math.abs(c.z) > HALF - r) { c.z = clamp(c.z, -HALF + r, HALF - r); hit = true; }
  const i = Math.floor((c.x + HALF) / CELL), j = Math.floor((c.z + HALF) / CELL);
  if (i < 0 || j < 0 || i >= N || j >= N) return hit;
  const cx = (i + 0.5) * CELL - HALF, cz = (j + 0.5) * CELL - HALF, hb = BLOCK / 2;
  const px = clamp(c.x, cx - hb, cx + hb), pz = clamp(c.z, cz - hb, cz + hb);
  const dx = c.x - px, dz = c.z - pz, d = Math.hypot(dx, dz);
  if (d >= r) return hit;
  if (d < 1e-4) {
    const ox = c.x - cx, oz = c.z - cz;
    if (Math.abs(ox) > Math.abs(oz)) c.x = cx + Math.sign(ox) * (hb + r); else c.z = cz + Math.sign(oz) * (hb + r);
  } else { c.x = px + (dx / d) * r; c.z = pz + (dz / d) * r; }
  return true;
}

export function stepCar(c: Car, inp: Input, dt: number, maxv = MAXV) {
  const t = inp.throttle;
  if (t !== 0) c.v += t * (t * c.v < 0 ? BRAKE : ACCEL) * dt;
  else c.v *= Math.exp(-COAST * dt);
  c.v *= Math.exp(-DRAG * dt * (Math.abs(c.v) / maxv));
  c.v = clamp(c.v, REV, maxv);
  c.h -= inp.steer * TURN * dt * clamp(c.v / 7, -1, 1);
  c.x += Math.sin(c.h) * c.v * dt; c.z += Math.cos(c.h) * c.v * dt;
  if (collide(c)) { c.v *= -0.3; return true; }
  return false;
}

export function randomRoadPoint() {
  const k = 1 + Math.floor(rnd() * (N - 1));
  const road = k * CELL - HALF, along = -HALF + 8 + rnd() * (W - 16);
  return rnd() < 0.5 ? { x: road, z: along } : { x: along, z: road };
}

const PLACES = ["Entregar açaí", "Levar passageiro", "Entregar pastel", "Buscar encomenda", "Levar turista"];
function newMission(g: Game): Mission {
  let p = randomRoadPoint();
  for (let k = 0; k < 10 && Math.hypot(p.x - g.player.x, p.z - g.player.z) < 80; k++) p = randomRoadPoint();
  const dist = Math.hypot(p.x - g.player.x, p.z - g.player.z);
  return { ...p, time: Math.round(12 + dist / 9), reward: Math.round(200 + dist * 3), label: PLACES[Math.floor(rnd() * PLACES.length)]! };
}

const NPC_COLORS = ["#d94a38", "#2f6fb5", "#f1f1ec", "#2b2b2b", "#e8c547", "#3aa35b"];
export function createGame(): Game {
  const npcs: Npc[] = [];
  for (let n = 0; n < 22; n++) {
    const k = 1 + Math.floor(rnd() * (N - 1)), axis = rnd() < 0.5 ? "x" : "z", sign = rnd() < 0.5 ? 1 : -1;
    const road = k * CELL - HALF + sign * 2.5 * (axis === "z" ? -1 : 1), along = -HALF + rnd() * W;
    const h = axis === "z" ? (sign > 0 ? 0 : Math.PI) : sign > 0 ? Math.PI / 2 : -Math.PI / 2;
    npcs.push({ axis, sign, x: axis === "z" ? road : along, z: axis === "z" ? along : road, h, v: 8 + rnd() * 6, color: NPC_COLORS[n % NPC_COLORS.length]! });
  }
  const coins = Array.from({ length: 30 }, () => ({ ...randomRoadPoint(), taken: false }));
  const g: Game = {
    player: { x: 0, z: 0, h: 0, v: 0 }, npcs, police: [], coins, money: 0, wanted: 0, calmT: 0, bustT: 0, hitCd: 0,
    mission: null as unknown as Mission, msg: "Bem-vindo à Vila Nova! Siga a seta 🧭", msgT: 4, t: 0,
  };
  g.mission = newMission(g);
  return g;
}

function say(g: Game, m: string) { g.msg = m; g.msgT = 3; }

export function step(g: Game, inp: Input, dt: number) {
  const p = g.player;
  g.t += dt; g.msgT -= dt; g.hitCd -= dt;
  stepCar(p, inp, dt);

  for (const n of g.npcs) {
    if (n.axis === "z") { n.z += n.sign * n.v * dt; if (Math.abs(n.z) > HALF) n.z = -n.sign * HALF; }
    else { n.x += n.sign * n.v * dt; if (Math.abs(n.x) > HALF) n.x = -n.sign * HALF; }
    const dx = n.x - p.x, dz = n.z - p.z, d = Math.hypot(dx, dz);
    if (d < 3 && d > 0) {
      p.x -= (dx / d) * (3 - d); p.z -= (dz / d) * (3 - d); p.v *= 0.4;
      if (g.hitCd <= 0) { g.hitCd = 1.5; g.wanted = Math.min(5, g.wanted + 1); g.calmT = 0; say(g, "Batida! A polícia está de olho 🚨"); }
    }
  }

  // police
  while (g.police.length < g.wanted) {
    const a = rnd() * Math.PI * 2;
    const c = { x: clamp(p.x + Math.sin(a) * 70, -HALF + 5, HALF - 5), z: clamp(p.z + Math.cos(a) * 70, -HALF + 5, HALF - 5), h: 0, v: 0 };
    const k = Math.round((c.x + HALF) / CELL); c.x = clamp(k, 1, N - 1) * CELL - HALF;
    g.police.push(c);
  }
  if (g.police.length > g.wanted) g.police.length = g.wanted;
  let near = false;
  for (const c of g.police) {
    const dx = p.x - c.x, dz = p.z - c.z, d = Math.hypot(dx, dz);
    let diff = Math.atan2(dx, dz) - c.h;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    if (stepCar(c, { throttle: d < 6 ? 0.3 : 1, steer: -clamp(diff * 2, -1, 1) }, dt, POLICE_MAXV)) c.h += (rnd() - 0.5) * 2;
    if (d < 35) near = true;
    if (d < 3.2) { p.v *= 0.92; if (Math.abs(p.v) < 6) g.bustT += dt; }
  }
  if (g.wanted > 0) {
    g.calmT = near ? 0 : g.calmT + dt;
    if (g.calmT > 10) { g.wanted--; g.calmT = 0; say(g, g.wanted ? "Despistando a polícia..." : "Você escapou! 😎"); }
  }
  if (!g.police.length) g.bustT = 0;
  if (g.bustT > 1.5) {
    g.money = Math.floor(g.money / 2); g.wanted = 0; g.police = []; g.bustT = 0;
    Object.assign(p, { x: 0, z: 0, h: 0, v: 0 }); say(g, "PRESO! Perdeu metade da grana 🚔");
  }

  for (const c of g.coins) if (!c.taken && Math.hypot(c.x - p.x, c.z - p.z) < 3) {
    c.taken = true; g.money += 50; Object.assign(c, randomRoadPoint()); c.taken = false;
  }

  const m = g.mission;
  m.time -= dt;
  if (Math.hypot(m.x - p.x, m.z - p.z) < 5) { g.money += m.reward; say(g, `Missão cumprida! +R$ ${m.reward}`); g.mission = newMission(g); }
  else if (m.time <= 0) { say(g, "Tempo esgotado! Nova corrida..."); g.mission = newMission(g); }
}
