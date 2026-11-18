// Pure game rules: no React, no three.js.
export const CELL = 40, BLOCK = 28, N = 8, W = N * CELL, HALF = W / 2;

// Driving feel (player + police share the model)
export const ENGINE = 13, BRAKE = 30, MAXV = 34, REV = -9, ROLL = 0.35, AIR = 0.0009;
export const WHEELBASE = 2.6, MAX_STEER = 0.55, STEER_RATE = 7, GRIP = 9, HANDBRAKE_GRIP = 1.2;
export const POLICE_MAXV = 29, CAR_R = 1.4;

export type Car = { x: number; z: number; h: number; v: number; lat: number; steer: number };
export type Npc = Car & { axis: "x" | "z"; sign: number; color: string };
export type Input = { throttle: number; steer: number; handbrake: boolean };
export type Job = { x: number; z: number; time: number; reward: number; label: string };
export type Game = {
  player: Car; npcs: Npc[]; police: Car[];
  money: number; wanted: number; calmT: number; bustT: number; hitCd: number;
  job: Job; msg: string; msgT: number; t: number;
};

let seed = 11;
export const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const car = (x = 0, z = 0, h = 0, v = 0): Car => ({ x, z, h, v, lat: 0, steer: 0 });

// ---------- world layout ----------
export type House = { x: number; y: number; z: number; w: number; d: number; h: number; ry: number; color: string; brick: boolean; tank: boolean };
const PAINT = ["#c9a46b", "#b5654a", "#7d9a7a", "#d8cfbf", "#6f8fa6", "#c98a6a", "#a7a17a", "#e0d6c2", "#9c6b5a", "#8aa3a0"];
export const HOUSES: House[] = [];
const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)]!;
for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
  const cx = (i + 0.5) * CELL - HALF, cz = (j + 0.5) * CELL - HALF;
  const gap = 1.6, s = (BLOCK - gap * 2) / 3;
  for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) {
    if (a === 1 && b === 1 && rnd() < 0.5) continue; // courtyard
    const floors = 1 + Math.floor(rnd() * rnd() * 4.5);
    HOUSES.push({
      x: cx + (a - 1) * (s + gap), z: cz + (b - 1) * (s + gap), y: 0,
      w: s - rnd() * 1.2, d: s - rnd() * 1.2, h: floors * 3 + 0.4, ry: 0,
      color: pick(PAINT), brick: rnd() < 0.4, tank: rnd() < 0.55,
    });
  }
}
// Morros com favela ao fundo
export const HILLS = [
  { x: -40, z: -HALF - 170, r: 230, h: 95 },
  { x: HALF + 170, z: -60, r: 200, h: 75 },
  { x: -HALF - 160, z: 40, r: 190, h: 70 },
];
for (const hill of HILLS) {
  const face = Math.atan2(-hill.x, -hill.z);
  for (let k = 0; k < 360; k++) {
    const a = face + (rnd() - 0.5) * 2.6, r = 35 + rnd() * (hill.r - 50);
    const gy = hill.h * (1 - r / hill.r), h = 3 + Math.floor(rnd() * 3) * 2.8;
    HOUSES.push({
      x: hill.x + Math.sin(a) * r, z: hill.z + Math.cos(a) * r, y: gy - 1.5,
      w: 4 + rnd() * 3, d: 4 + rnd() * 3, h: h + 1.5, ry: a, color: pick(PAINT), brick: rnd() < 0.55, tank: rnd() < 0.4,
    });
  }
}
// Postes nas esquinas das quadras
export const LAMPS: { x: number; z: number; ry: number }[] = [];
for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
  const cx = (i + 0.5) * CELL - HALF, cz = (j + 0.5) * CELL - HALF, o = BLOCK / 2 + 0.3;
  LAMPS.push({ x: cx + o, z: cz, ry: Math.PI / 2 }, { x: cx - o, z: cz, ry: -Math.PI / 2 }, { x: cx, z: cz + o, ry: 0 }, { x: cx, z: cz - o, ry: Math.PI });
}

// ---------- physics ----------
export function collide(c: Car, r = CAR_R) {
  let hit = false;
  if (Math.abs(c.x) > HALF - r) { c.x = clamp(c.x, -HALF + r, HALF - r); hit = true; }
  if (Math.abs(c.z) > HALF - r) { c.z = clamp(c.z, -HALF + r, HALF - r); hit = true; }
  const i = Math.floor((c.x + HALF) / CELL), j = Math.floor((c.z + HALF) / CELL);
  if (i < 0 || j < 0 || i >= N || j >= N) return hit;
  const cx = (i + 0.5) * CELL - HALF, cz = (j + 0.5) * CELL - HALF, hb = BLOCK / 2 + 0.5;
  const px = clamp(c.x, cx - hb, cx + hb), pz = clamp(c.z, cz - hb, cz + hb);
  const dx = c.x - px, dz = c.z - pz, d = Math.hypot(dx, dz);
  if (d >= r) return hit;
  if (d < 1e-4) {
    const ox = c.x - cx, oz = c.z - cz;
    if (Math.abs(ox) > Math.abs(oz)) c.x = cx + Math.sign(ox) * (hb + r); else c.z = cz + Math.sign(oz) * (hb + r);
  } else { c.x = px + (dx / d) * r; c.z = pz + (dz / d) * r; }
  return true;
}

/** Bicycle-model car: smoothed steering, speed-sensitive lock, lateral grip (handbrake = drift). */
export function stepCar(c: Car, inp: Input, dt: number, maxv = MAXV) {
  const t = inp.throttle;
  if (t > 0) c.v += (c.v < 0 ? BRAKE : ENGINE * (1 - Math.max(0, c.v) / maxv * 0.6)) * t * dt;
  else if (t < 0) c.v += (c.v > 0.5 ? BRAKE : ENGINE * 0.6) * t * dt;
  c.v -= Math.sign(c.v) * (ROLL + AIR * c.v * c.v) * dt * 10 * (t === 0 ? 1 : 0.3);
  if (inp.handbrake) c.v *= Math.exp(-1.2 * dt);
  if (t === 0 && Math.abs(c.v) < 0.3) c.v = 0;
  c.v = clamp(c.v, REV, maxv);

  const lock = MAX_STEER / (1 + Math.abs(c.v) / 14);
  c.steer += (inp.steer * lock - c.steer) * (1 - Math.exp(-STEER_RATE * dt));
  const yaw = (c.v / WHEELBASE) * Math.tan(c.steer);
  c.h -= yaw * dt;
  // lateral slip: centrifugal push vs tyre grip
  const grip = inp.handbrake ? HANDBRAKE_GRIP : GRIP;
  c.lat += yaw * c.v * dt * (inp.handbrake ? 0.5 : 0.08);
  c.lat *= Math.exp(-grip * dt);
  const s = Math.sin(c.h), co = Math.cos(c.h);
  c.x += (s * c.v - co * c.lat) * dt;
  c.z += (co * c.v + s * c.lat) * dt;
  if (collide(c)) { c.v *= -0.25; c.lat *= 0.3; return true; }
  return false;
}

export function randomRoadPoint() {
  const k = 1 + Math.floor(rnd() * (N - 1));
  const road = k * CELL - HALF, along = -HALF + 8 + rnd() * (W - 16);
  return rnd() < 0.5 ? { x: road, z: along } : { x: along, z: road };
}

const JOBS = ["Entrega", "Corrida", "Encomenda", "Frete"];
function newJob(g: Game): Job {
  let p = randomRoadPoint();
  for (let k = 0; k < 10 && Math.hypot(p.x - g.player.x, p.z - g.player.z) < 90; k++) p = randomRoadPoint();
  const dist = Math.hypot(p.x - g.player.x, p.z - g.player.z);
  return { ...p, time: Math.round(15 + dist / 9), reward: Math.round(150 + dist * 2.5), label: pick(JOBS) };
}

const NPC_COLORS = ["#7a1f24", "#2c3e50", "#d9d6cf", "#1f1f1f", "#5c6b73", "#8b7d5b", "#3e4a3d", "#a8a39a"];
export function createGame(): Game {
  const npcs: Npc[] = [];
  for (let n = 0; n < 24; n++) {
    const k = 1 + Math.floor(rnd() * (N - 1)), axis = rnd() < 0.5 ? "x" : "z", sign = rnd() < 0.5 ? 1 : -1;
    const road = k * CELL - HALF + sign * 2.5 * (axis === "z" ? -1 : 1), along = -HALF + rnd() * W;
    const h = axis === "z" ? (sign > 0 ? 0 : Math.PI) : sign > 0 ? Math.PI / 2 : -Math.PI / 2;
    npcs.push({ ...car(axis === "z" ? road : along, axis === "z" ? along : road, h, 7 + rnd() * 6), axis, sign, color: NPC_COLORS[n % NPC_COLORS.length]! });
  }
  const g: Game = {
    player: car(), npcs, police: [], money: 0, wanted: 0, calmT: 0, bustT: 0, hitCd: 0,
    job: null as unknown as Job, msg: "Vila Nova", msgT: 3, t: 0,
  };
  g.job = newJob(g);
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
    const dx = n.x - p.x, dz = n.z - p.z, d2 = dx * dx + dz * dz;
    if (d2 < 9 && d2 > 0) {
      const d = Math.sqrt(d2);
      p.x -= (dx / d) * (3 - d); p.z -= (dz / d) * (3 - d); p.v *= 0.4;
      if (g.hitCd <= 0) { g.hitCd = 1.5; g.wanted = Math.min(5, g.wanted + 1); g.calmT = 0; say(g, "Procurado"); }
    }
  }

  while (g.police.length < g.wanted) {
    const a = rnd() * Math.PI * 2;
    const c = car(clamp(p.x + Math.sin(a) * 75, -HALF + 5, HALF - 5), clamp(p.z + Math.cos(a) * 75, -HALF + 5, HALF - 5));
    c.x = clamp(Math.round((c.x + HALF) / CELL), 1, N - 1) * CELL - HALF;
    g.police.push(c);
  }
  if (g.police.length > g.wanted) g.police.length = g.wanted;
  let near = false;
  for (const c of g.police) {
    const dx = p.x - c.x, dz = p.z - c.z, d = Math.hypot(dx, dz);
    let diff = Math.atan2(dx, dz) - c.h;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    if (stepCar(c, { throttle: d < 6 ? 0.2 : 1, steer: -clamp(diff * 2.5, -1, 1), handbrake: false }, dt, POLICE_MAXV)) c.h += (rnd() - 0.5) * 2;
    if (d < 40) near = true;
    if (d < 3.2) { p.v *= 0.92; if (Math.abs(p.v) < 6) g.bustT += dt; }
  }
  if (g.wanted > 0) {
    g.calmT = near ? 0 : g.calmT + dt;
    if (g.calmT > 10) { g.wanted--; g.calmT = 0; say(g, g.wanted ? "Despistando..." : "Limpo"); }
  }
  if (!g.police.length) g.bustT = 0;
  if (g.bustT > 1.5) {
    g.money = Math.floor(g.money / 2); g.wanted = 0; g.police = []; g.bustT = 0;
    Object.assign(p, car()); say(g, "Enquadrado — perdeu metade");
  }

  const j = g.job;
  j.time -= dt;
  if (Math.hypot(j.x - p.x, j.z - p.z) < 5) { g.money += j.reward; say(g, `+R$ ${j.reward}`); g.job = newJob(g); }
  else if (j.time <= 0) g.job = newJob(g);
}
