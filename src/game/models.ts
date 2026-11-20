import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

function part(g: THREE.BufferGeometry, color: string, x = 0, y = 0, z = 0, rx = 0, rz = 0) {
  g.rotateX(rx); g.rotateZ(rz); g.translate(x, y, z);
  const n = g.index ? g.toNonIndexed() : g;
  const c = new THREE.Color(color), cnt = n.attributes["position"]!.count, arr = new Float32Array(cnt * 3);
  for (let i = 0; i < cnt; i++) arr.set([c.r, c.g, c.b], i * 3);
  n.setAttribute("color", new THREE.BufferAttribute(arr, 3));
  return n;
}

/** One merged, vertex-coloured mesh per car = 1 draw call (or 1 for a whole instanced fleet). */
export function carGeometry({ body = "#ffffff", rims = "#8a8d91", police = false } = {}) {
  const cabin = new THREE.BoxGeometry(1.6, 0.52, 2.1);
  const p = cabin.attributes["position"]!;
  for (let i = 0; i < p.count; i++) if (p.getY(i) > 0) { p.setZ(i, p.getZ(i) * 0.62 - 0.1); p.setX(i, p.getX(i) * 0.9); }
  const parts = [
    part(new THREE.PlaneGeometry(2.1, 4.5), "#2a2a2a", 0, 0.03, 0, -Math.PI / 2),
    part(new THREE.BoxGeometry(1.84, 0.46, 4.3), body, 0, 0.5, 0),
    part(cabin, "#161b20", 0, 0.99, -0.25),
    part(new THREE.BoxGeometry(1.46, 0.07, 1.25), body, 0, 1.27, -0.35),
    part(new THREE.BoxGeometry(1.88, 0.2, 0.2), "#262626", 0, 0.36, 2.17),
    part(new THREE.BoxGeometry(1.88, 0.2, 0.2), "#262626", 0, 0.36, -2.17),
    part(new THREE.BoxGeometry(0.42, 0.14, 0.04), "#fff1c2", 0.6, 0.6, 2.16),
    part(new THREE.BoxGeometry(0.42, 0.14, 0.04), "#fff1c2", -0.6, 0.6, 2.16),
    part(new THREE.BoxGeometry(0.5, 0.13, 0.04), "#8e1418", 0.58, 0.6, -2.16),
    part(new THREE.BoxGeometry(0.5, 0.13, 0.04), "#8e1418", -0.58, 0.6, -2.16),
    part(new THREE.BoxGeometry(0.6, 0.12, 0.04), "#0d0d0d", 0, 0.6, 2.16),
  ];
  if (police) parts.push(part(new THREE.BoxGeometry(1.86, 0.2, 2.0), "#121212", 0, 0.42, -0.1));
  for (const [x, z] of [[0.83, 1.35], [-0.83, 1.35], [0.83, -1.35], [-0.83, -1.35]] as const) {
    parts.push(part(new THREE.CylinderGeometry(0.34, 0.34, 0.24, 12), "#101010", x, 0.34, z, 0, Math.PI / 2));
    parts.push(part(new THREE.CylinderGeometry(0.22, 0.22, 0.25, 8), rims, x, 0.34, z, 0, Math.PI / 2));
  }
  return mergeGeometries(parts)!;
}

export function lampGeometry() {
  return mergeGeometries([
    part(new THREE.CylinderGeometry(0.07, 0.1, 6.4, 6), "#55595c", 0, 3.2, 0),
    part(new THREE.BoxGeometry(0.07, 0.07, 1.7), "#55595c", 0, 6.3, 0.85),
    part(new THREE.BoxGeometry(0.28, 0.12, 0.5), "#fff0c4", 0, 6.22, 1.6),
  ])!;
}

function canvasTex(size: number, draw: (x: CanvasRenderingContext2D, s: number) => void, repeat = 1) {
  const c = document.createElement("canvas"); c.width = c.height = size;
  draw(c.getContext("2d")!, size);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
const noise = (x: CanvasRenderingContext2D, s: number, n: number, a: number) => {
  for (let i = 0; i < n; i++) { const v = Math.random() * 255 | 0; x.fillStyle = `rgba(${v},${v},${v},${a})`; x.fillRect(Math.random() * s, Math.random() * s, 2, 2); }
};

export const asphaltTex = (cell: number, block: number, n: number) => canvasTex(512, (x, s) => {
  x.fillStyle = "#4b4c4e"; x.fillRect(0, 0, s, s); noise(x, s, 14000, 0.06);
  x.strokeStyle = "rgba(20,20,20,0.6)"; x.lineWidth = 1.2;
  for (let i = 0; i < 6; i++) { x.beginPath(); let px = Math.random() * s, py = Math.random() * s; x.moveTo(px, py); for (let k = 0; k < 6; k++) { px += (Math.random() - .5) * 40; py += (Math.random() - .5) * 40; x.lineTo(px, py); } x.stroke(); }
  const r = ((cell - block) / 2 / cell) * s;
  x.fillStyle = "rgba(220,200,120,0.55)";
  for (let i = r + 6; i < s - r - 6; i += 22) { x.fillRect(i, 0, 11, 2); x.fillRect(i, s - 2, 11, 2); x.fillRect(0, i, 2, 11); x.fillRect(s - 2, i, 2, 11); }
  x.fillStyle = "rgba(230,230,225,0.6)";
  for (let k = 0; k < r * 1.6; k += 8) { // faixas de pedestre
    x.fillRect(k - r * 0.8 + r * 0.8, r + 2, 4, 14);
  }
}, n);

export const concreteTex = () => canvasTex(128, (x, s) => {
  x.fillStyle = "#9d9a93"; x.fillRect(0, 0, s, s); noise(x, s, 1500, 0.15);
  x.strokeStyle = "rgba(60,60,60,0.35)"; for (let i = 0; i <= s; i += 32) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, s); x.moveTo(0, i); x.lineTo(s, i); x.stroke(); }
}, 7);

export const plasterTex = () => canvasTex(128, (x, s) => {
  x.fillStyle = "#e9e5dc"; x.fillRect(0, 0, s, s); noise(x, s, 2500, 0.1);
  x.fillStyle = "rgba(90,80,70,0.25)"; x.fillRect(0, s - 14, s, 14); // mancha de umidade
  for (let f = 0; f < 2; f++) for (let w = 0; w < 2; w++) {
    const wx = 18 + w * 62, wy = 14 + f * 58;
    x.fillStyle = "#3a3f44"; x.fillRect(wx, wy, 30, 26);
    x.fillStyle = "#7b7f80"; x.fillRect(wx, wy + 12, 30, 2); x.fillRect(wx + 14, wy, 2, 26);
  }
});

export const brickTex = () => canvasTex(128, (x, s) => {
  x.fillStyle = "#8f8a80"; x.fillRect(0, 0, s, s);
  for (let r = 0; r < 16; r++) for (let c = -1; c < 8; c++) {
    const v = 120 + Math.random() * 40;
    x.fillStyle = `rgb(${v + 40},${v * 0.55},${v * 0.38})`;
    x.fillRect(c * 17 + (r % 2) * 8, r * 8, 15, 6.5);
  }
  x.fillStyle = "#2c2f31"; x.fillRect(20, 24, 24, 20); x.fillRect(80, 24, 24, 20); x.fillRect(48, 86, 26, 42);
});

export const roofTex = () => canvasTex(64, (x, s) => { x.fillStyle = "#77736c"; x.fillRect(0, 0, s, s); noise(x, s, 600, 0.2); });
