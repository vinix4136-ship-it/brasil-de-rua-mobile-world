import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Lightformer } from "@react-three/drei";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { BUILDINGS, CELL, HALF, N, W, createGame, step, type Game, type Input } from "./sim";

function groundTexture() {
  const s = 256, c = document.createElement("canvas"); c.width = c.height = s;
  const x = c.getContext("2d")!, px = s / CELL;
  x.fillStyle = "#3a3a3d"; x.fillRect(0, 0, s, s);
  const r = (CELL - 28) / 2 * px;
  x.fillStyle = "#cfc6b4"; x.fillRect(r - 6, r - 6, s - 2 * r + 12, s - 2 * r + 12);
  x.fillStyle = "#6d9f4e"; x.fillRect(r, r, s - 2 * r, s - 2 * r);
  x.fillStyle = "#f2c94c";
  for (let i = 0; i < s; i += 24) { x.fillRect(i, 0, 12, 2); x.fillRect(0, i, 2, 12); x.fillRect(i, s - 2, 12, 2); x.fillRect(s - 2, i, 2, 12); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(N, N);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
function windowTexture() {
  const c = document.createElement("canvas"); c.width = c.height = 64;
  const x = c.getContext("2d")!; x.fillStyle = "#fff"; x.fillRect(0, 0, 64, 64);
  x.fillStyle = "#5a6d7c";
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) x.fillRect(5 + i * 15, 5 + j * 15, 8, 9);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

function City() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const ground = useMemo(groundTexture, []);
  const win = useMemo(windowTexture, []);
  useLayoutEffect(() => {
    const m = new THREE.Matrix4(), col = new THREE.Color();
    BUILDINGS.forEach((b, i) => {
      m.compose(new THREE.Vector3(b.x, b.h / 2, b.z), new THREE.Quaternion(), new THREE.Vector3(b.w, b.h, b.d));
      ref.current!.setMatrixAt(i, m); ref.current!.setColorAt(i, col.set(b.color));
    });
    ref.current!.instanceMatrix.needsUpdate = true;
  }, []);
  return (
    <>
      <mesh rotation-x={-Math.PI / 2} receiveShadow><planeGeometry args={[W, W]} /><meshStandardMaterial map={ground} roughness={0.9} /></mesh>
      <instancedMesh ref={ref} args={[undefined, undefined, BUILDINGS.length]} castShadow receiveShadow>
        <boxGeometry /><meshStandardMaterial map={win} roughness={0.7} />
      </instancedMesh>
      {/* praia + mar */}
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.05, HALF + 20]}><planeGeometry args={[W + 400, 40]} /><meshStandardMaterial color="#e9d29c" /></mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.3, HALF + 340]}><planeGeometry args={[3000, 600]} /><meshStandardMaterial color="#2a8fb8" roughness={0.2} metalness={0.3} /></mesh>
      {Array.from({ length: 16 }, (_, i) => <Palm key={i} x={-HALF + 10 + i * (W / 15)} z={HALF + 12 + (i % 2) * 10} />)}
      {/* morro do Cristo */}
      <mesh position={[-60, 0, -HALF - 160]}><coneGeometry args={[130, 140, 7]} /><meshStandardMaterial color="#3f7a3a" flatShading /></mesh>
      <group position={[-60, 140, -HALF - 160]} scale={4}>
        <mesh position={[0, 3, 0]}><boxGeometry args={[1.4, 6, 1]} /><meshStandardMaterial color="#e8e6df" /></mesh>
        <mesh position={[0, 5, 0]}><boxGeometry args={[7, 0.9, 0.8]} /><meshStandardMaterial color="#e8e6df" /></mesh>
        <mesh position={[0, 6.6, 0]}><sphereGeometry args={[0.6]} /><meshStandardMaterial color="#e8e6df" /></mesh>
      </group>
    </>
  );
}
function Palm({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 3.5, 0]} rotation-z={0.15}><cylinderGeometry args={[0.25, 0.4, 7, 6]} /><meshStandardMaterial color="#8a6a43" /></mesh>
      {[0, 1, 2, 3, 4].map((k) => (
        <mesh key={k} position={[0.5, 7, 0]} rotation={[0, (k * Math.PI * 2) / 5, -0.5]}><boxGeometry args={[4, 0.1, 0.9]} /><meshStandardMaterial color="#3d9a46" /></mesh>
      ))}
    </group>
  );
}

function CarModel({ color, police }: { color: string; police?: boolean }) {
  const light = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(({ clock }) => { if (light.current) light.current.emissive.set(Math.sin(clock.elapsedTime * 12) > 0 ? "#1e5bff" : "#ff2020"); });
  return (
    <group>
      <mesh position={[0, 0.75, 0]} castShadow><boxGeometry args={[1.9, 0.8, 4]} /><meshStandardMaterial color={color} metalness={0.3} roughness={0.4} /></mesh>
      <mesh position={[0, 1.45, -0.3]} castShadow><boxGeometry args={[1.6, 0.65, 2]} /><meshStandardMaterial color={police ? "#111" : "#1d2a33"} roughness={0.15} metalness={0.5} /></mesh>
      {police && <mesh position={[0, 1.85, -0.3]}><boxGeometry args={[1.2, 0.2, 0.35]} /><meshStandardMaterial ref={light} emissiveIntensity={3} color="#fff" /></mesh>}
      <mesh position={[0, 0.8, 2.01]}><boxGeometry args={[1.5, 0.25, 0.05]} /><meshStandardMaterial color="#fff6c8" emissive="#fff2a0" emissiveIntensity={0.6} /></mesh>
      {[[-1, 1.3], [1, 1.3], [-1, -1.3], [1, -1.3]].map(([x, z], i) => (
        <mesh key={i} position={[x!, 0.4, z!]} rotation-z={Math.PI / 2}><cylinderGeometry args={[0.4, 0.4, 0.3, 10]} /><meshStandardMaterial color="#151515" /></mesh>
      ))}
    </group>
  );
}

function Scene({ game, input, onReady }: { game: Game; input: React.MutableRefObject<Input>; onReady: () => void }) {
  const player = useRef<THREE.Group>(null);
  const npcs = useRef<(THREE.Group | null)[]>([]);
  const cops = useRef<(THREE.Group | null)[]>([]);
  const coins = useRef<(THREE.Mesh | null)[]>([]);
  const marker = useRef<THREE.Group>(null);
  const { camera } = useThree();
  const camPos = useRef(new THREE.Vector3(0, 8, -14));
  const ready = useRef(false);
  const place = (o: THREE.Object3D | null | undefined, c: { x: number; z: number; h: number }) => { if (o) { o.position.set(c.x, 0, c.z); o.rotation.y = c.h; } };

  useFrame((s, delta) => {
    const dt = Math.min(delta, 0.05);
    step(game, input.current, dt);
    const p = game.player;
    place(player.current, p);
    game.npcs.forEach((n, i) => place(npcs.current[i], n));
    cops.current.forEach((o, i) => { if (!o) return; const c = game.police[i]; o.visible = !!c; if (c) place(o, c); });
    game.coins.forEach((c, i) => { const m = coins.current[i]; if (m) { m.position.set(c.x, 1.2 + Math.sin(s.clock.elapsedTime * 3 + i) * 0.3, c.z); m.rotation.y += dt * 3; } });
    if (marker.current) { marker.current.position.set(game.mission.x, 0, game.mission.z); marker.current.rotation.y += dt; }
    const fx = Math.sin(p.h), fz = Math.cos(p.h), back = 11 + Math.abs(p.v) * 0.12;
    camPos.current.lerp(new THREE.Vector3(p.x - fx * back, 6.5, p.z - fz * back), 1 - Math.exp(-4 * dt));
    camera.position.copy(camPos.current);
    camera.lookAt(p.x + fx * 4, 1.2, p.z + fz * 4);
    if (!ready.current) { ready.current = true; onReady(); }
  });

  return (
    <>
      <City />
      <group ref={player}><CarModel color="#2e9e4f" /></group>
      {game.npcs.map((n, i) => <group key={i} ref={(o) => { npcs.current[i] = o; }}><CarModel color={n.color} /></group>)}
      {Array.from({ length: 5 }, (_, i) => <group key={i} visible={false} ref={(o) => { cops.current[i] = o; }}><CarModel color="#f4f4f4" police /></group>)}
      {game.coins.map((_, i) => (
        <mesh key={i} ref={(o) => { coins.current[i] = o; }} rotation-x={Math.PI / 2}><cylinderGeometry args={[0.7, 0.7, 0.15, 16]} /><meshStandardMaterial color="#ffcc33" metalness={0.8} roughness={0.25} emissive="#7a5200" /></mesh>
      ))}
      <group ref={marker}>
        <mesh position={[0, 6, 0]}><cylinderGeometry args={[3, 3, 12, 24, 1, true]} /><meshBasicMaterial color="#ffd23f" transparent opacity={0.3} side={THREE.DoubleSide} depthWrite={false} /></mesh>
        <mesh position={[0, 4, 0]} rotation-x={Math.PI}><coneGeometry args={[1, 2, 4]} /><meshStandardMaterial color="#ffd23f" emissive="#a07a00" /></mesh>
      </group>
    </>
  );
}

function Joystick({ input }: { input: React.MutableRefObject<Input> }) {
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const origin = useRef<{ x: number; y: number; id: number } | null>(null);
  const R = 50;
  return (
    <div
      className="hud-pad absolute bottom-8 left-6 h-32 w-32 touch-none rounded-full"
      onPointerDown={(e) => { const r = e.currentTarget.getBoundingClientRect(); origin.current = { x: r.left + r.width / 2, y: r.top + r.height / 2, id: e.pointerId }; e.currentTarget.setPointerCapture(e.pointerId); }}
      onPointerMove={(e) => {
        if (!origin.current || origin.current.id !== e.pointerId) return;
        let dx = e.clientX - origin.current.x; const d = Math.hypot(dx, 0);
        if (d > R) dx = (dx / d) * R;
        setKnob({ x: dx, y: 0 }); input.current.steer = dx / R;
      }}
      onPointerUp={() => { origin.current = null; setKnob({ x: 0, y: 0 }); input.current.steer = 0; }}
      onPointerCancel={() => { origin.current = null; setKnob({ x: 0, y: 0 }); input.current.steer = 0; }}
    >
      <div className="hud-knob absolute left-1/2 top-1/2 h-14 w-14 rounded-full" style={{ transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))` }} />
      <span className="pointer-events-none absolute inset-x-0 bottom-2 text-center text-xs text-foreground/70">◀ volante ▶</span>
    </div>
  );
}

function Pedal({ label, value, input, variant }: { label: string; value: number; input: React.MutableRefObject<Input>; variant: string }) {
  const set = (v: number) => () => { input.current.throttle = v; };
  return (
    <button className={`${variant} touch-none select-none rounded-2xl font-display`} onPointerDown={set(value)} onPointerUp={set(0)} onPointerLeave={set(0)} onPointerCancel={set(0)} onContextMenu={(e) => e.preventDefault()}>
      {label}
    </button>
  );
}

export default function GameView() {
  const game = useMemo(createGame, []);
  const input = useRef<Input>({ throttle: 0, steer: 0 });
  const [hud, setHud] = useState({ money: 0, wanted: 0, speed: 0, msg: "", time: 0, label: "", dist: 0, arrow: 0, bust: 0 });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const keys = new Set<string>();
    const upd = () => {
      input.current.throttle = (keys.has("w") || keys.has("arrowup") ? 1 : 0) - (keys.has("s") || keys.has("arrowdown") || keys.has(" ") ? 1 : 0);
      input.current.steer = (keys.has("d") || keys.has("arrowright") ? 1 : 0) - (keys.has("a") || keys.has("arrowleft") ? 1 : 0);
    };
    const dn = (e: KeyboardEvent) => { keys.add(e.key.toLowerCase()); upd(); };
    const up = (e: KeyboardEvent) => { keys.delete(e.key.toLowerCase()); upd(); };
    window.addEventListener("keydown", dn); window.addEventListener("keyup", up);
    const iv = setInterval(() => {
      const p = game.player, m = game.mission;
      const ang = Math.atan2(m.x - p.x, m.z - p.z) - p.h;
      setHud({ money: game.money, wanted: game.wanted, speed: Math.round(Math.abs(p.v) * 3.6), msg: game.msgT > 0 ? game.msg : "", time: Math.max(0, Math.ceil(m.time)), label: m.label, dist: Math.round(Math.hypot(m.x - p.x, m.z - p.z)), arrow: -ang, bust: game.bustT });
    }, 120);
    return () => { window.removeEventListener("keydown", dn); window.removeEventListener("keyup", up); clearInterval(iv); };
  }, [game]);

  return (
    <div className="fixed inset-0 select-none overflow-hidden bg-sky" data-scene-ready={ready ? "" : undefined}>
      <Canvas shadows dpr={[1, 1.75]} camera={{ fov: 62, near: 0.5, far: 1500 }}>
        <color attach="background" args={["#8fd0f0"]} />
        <fog attach="fog" args={["#bfe3f2", 120, 520]} />
        <hemisphereLight args={["#fff4dc", "#6a8f5a", 0.7]} />
        <directionalLight position={[80, 120, 40]} intensity={2.2} color="#fff1d0" castShadow shadow-mapSize={[1024, 1024]} shadow-camera-left={-200} shadow-camera-right={200} shadow-camera-top={200} shadow-camera-bottom={-200} />
        <Environment resolution={64}>
          <Lightformer intensity={2} position={[0, 5, 0]} scale={[10, 10, 1]} />
          <Lightformer intensity={1} color="#ffd9a0" position={[-5, 1, -1]} rotation-y={Math.PI / 2} scale={[20, 1, 1]} />
        </Environment>
        <Scene game={game} input={input} onReady={() => setReady(true)} />
      </Canvas>

      {/* HUD */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-4" style={{ paddingTop: "max(1rem, env(safe-area-inset-top))" }}>
        <div className="hud-panel rounded-xl px-3 py-2">
          <div className="font-display text-xl text-accent">R$ {hud.money.toLocaleString("pt-BR")}</div>
          <div className="text-lg tracking-widest">{Array.from({ length: 5 }, (_, i) => <span key={i} className={i < hud.wanted ? "text-accent" : "text-foreground/25"}>★</span>)}</div>
        </div>
        <div className="hud-panel flex items-center gap-3 rounded-xl px-3 py-2 text-right">
          <div className="text-2xl text-accent" style={{ transform: `rotate(${hud.arrow}rad)` }}>⬆</div>
          <div>
            <div className="font-display text-sm">{hud.label}</div>
            <div className="text-xs text-foreground/80">{hud.dist} m · <span className={hud.time < 10 ? "text-destructive" : ""}>{hud.time}s</span></div>
          </div>
        </div>
      </div>
      {hud.msg && <div className="hud-panel pointer-events-none absolute left-1/2 top-28 -translate-x-1/2 whitespace-nowrap rounded-full px-4 py-2 font-display text-sm">{hud.msg}</div>}
      {hud.bust > 0 && <div className="pointer-events-none absolute left-1/2 top-1/3 -translate-x-1/2 font-display text-3xl text-destructive">PARE O CARRO!</div>}
      <div className="hud-panel pointer-events-none absolute bottom-44 left-6 rounded-lg px-3 py-1 font-display text-lg">{hud.speed} <span className="text-xs">km/h</span></div>

      <Joystick input={input} />
      <div className="absolute bottom-8 right-6 flex items-end gap-3">
        <Pedal label="RÉ" value={-1} input={input} variant="pedal-brake h-20 w-20 text-lg" />
        <Pedal label="ACELERA" value={1} input={input} variant="pedal-gas h-28 w-24 text-base" />
      </div>
      {!ready && <div className="absolute inset-0 grid place-items-center bg-background font-display text-2xl text-accent">Carregando a quebrada...</div>}
    </div>
  );
}
