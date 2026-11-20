import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { BLOCK, CELL, HALF, HILLS, HOUSES, LAMPS, N, W, createGame, step, type Game, type Input } from "./sim";
import { asphaltTex, brickTex, carGeometry, concreteTex, lampGeometry, plasterTex, roofTex } from "./models";
import { Hud, TouchControls } from "./Hud";

const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpS = new THREE.Vector3(1, 1, 1), tmpP = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
function setInst(m: THREE.InstancedMesh, i: number, x: number, y: number, z: number, ry: number, sx = 1, sy = 1, sz = 1) {
  tmpQ.setFromAxisAngle(UP, ry); tmpP.set(x, y, z); tmpS.set(sx, sy, sz);
  m.setMatrixAt(i, tmpM.compose(tmpP, tmpQ, tmpS));
}

/** Static world: ~10 draw calls total, all instanced, built once. */
const World = memo(function World() {
  const painted = useRef<THREE.InstancedMesh>(null), brick = useRef<THREE.InstancedMesh>(null);
  const tanks = useRef<THREE.InstancedMesh>(null), lamps = useRef<THREE.InstancedMesh>(null), walks = useRef<THREE.InstancedMesh>(null);
  const t = useMemo(() => ({ asphalt: asphaltTex(CELL, BLOCK, N), concrete: concreteTex(), plaster: plasterTex(), brick: brickTex(), roof: roofTex() }), []);
  const paintedList = useMemo(() => HOUSES.filter((h) => !h.brick), []);
  const brickList = useMemo(() => HOUSES.filter((h) => h.brick), []);
  const tankList = useMemo(() => HOUSES.filter((h) => h.tank), []);
  const mats = useMemo(() => {
    const side = (map: THREE.Texture) => new THREE.MeshLambertMaterial({ map });
    const roof = new THREE.MeshLambertMaterial({ map: t.roof });
    const p = side(t.plaster), b = side(t.brick);
    return { painted: [p, p, roof, roof, p, p], brick: [b, b, roof, roof, b, b] };
  }, [t]);
  const lampGeo = useMemo(lampGeometry, []);

  useLayoutEffect(() => {
    const col = new THREE.Color();
    paintedList.forEach((h, i) => { setInst(painted.current!, i, h.x, h.y + h.h / 2, h.z, h.ry, h.w, h.h, h.d); painted.current!.setColorAt(i, col.set(h.color)); });
    brickList.forEach((h, i) => setInst(brick.current!, i, h.x, h.y + h.h / 2, h.z, h.ry, h.w, h.h, h.d));
    tankList.forEach((h, i) => setInst(tanks.current!, i, h.x + h.w * 0.22, h.y + h.h + 0.5, h.z - h.d * 0.2, 0));
    LAMPS.forEach((l, i) => setInst(lamps.current!, i, l.x, 0.2, l.z, l.ry));
    let k = 0;
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) setInst(walks.current!, k++, (i + 0.5) * CELL - HALF, 0.11, (j + 0.5) * CELL - HALF, 0);
    for (const m of [painted, brick, tanks, lamps, walks]) { m.current!.instanceMatrix.needsUpdate = true; m.current!.computeBoundingSphere(); }
  }, [paintedList, brickList, tankList]);

  return (
    <>
      <mesh rotation-x={-Math.PI / 2}><planeGeometry args={[W, W]} /><meshLambertMaterial map={t.asphalt} /></mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.4, 0]}><planeGeometry args={[3000, 3000]} /><meshLambertMaterial color="#4d5a3a" /></mesh>
      <instancedMesh ref={walks} args={[undefined, undefined, N * N]}><boxGeometry args={[BLOCK + 1, 0.22, BLOCK + 1]} /><meshLambertMaterial map={t.concrete} /></instancedMesh>
      <instancedMesh ref={painted} args={[undefined, mats.painted, paintedList.length]}><boxGeometry /></instancedMesh>
      <instancedMesh ref={brick} args={[undefined, mats.brick, brickList.length]}><boxGeometry /></instancedMesh>
      <instancedMesh ref={tanks} args={[undefined, undefined, tankList.length]}><cylinderGeometry args={[0.7, 0.6, 1, 8]} /><meshLambertMaterial color="#2f5f8f" /></instancedMesh>
      <instancedMesh ref={lamps} args={[lampGeo, undefined, LAMPS.length]}><meshLambertMaterial vertexColors /></instancedMesh>
      {HILLS.map((h, i) => (
        <mesh key={i} position={[h.x, h.h / 2 - 0.5, h.z]}><coneGeometry args={[h.r, h.h, 10, 1]} /><meshLambertMaterial color="#5a6440" flatShading /></mesh>
      ))}
      <group position={[HILLS[0]!.x, HILLS[0]!.h - 1, HILLS[0]!.z]} scale={3}>
        <mesh position={[0, 3, 0]}><boxGeometry args={[1.4, 6, 1]} /><meshLambertMaterial color="#d9d6cc" /></mesh>
        <mesh position={[0, 5, 0]}><boxGeometry args={[7, 0.8, 0.8]} /><meshLambertMaterial color="#d9d6cc" /></mesh>
        <mesh position={[0, 6.5, 0]}><sphereGeometry args={[0.55, 8, 6]} /><meshLambertMaterial color="#d9d6cc" /></mesh>
      </group>
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.05, HALF + 18]}><planeGeometry args={[W + 300, 36]} /><meshLambertMaterial color="#cdb98a" /></mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.2, HALF + 336]}><planeGeometry args={[3000, 600]} /><meshPhongMaterial color="#2b6a80" shininess={80} /></mesh>
    </>
  );
});

function Scene({ game, input, onReady }: { game: Game; input: React.MutableRefObject<Input>; onReady: () => void }) {
  const player = useRef<THREE.Mesh>(null), npcs = useRef<THREE.InstancedMesh>(null);
  const cops = useRef<THREE.InstancedMesh>(null), bars = useRef<THREE.InstancedMesh>(null), marker = useRef<THREE.Mesh>(null);
  const geos = useMemo(() => ({ player: carGeometry({ body: "#7a2d33", rims: "#d4d7db" }), npc: carGeometry(), cop: carGeometry({ body: "#e8e8e4", police: true }) }), []);
  const barMat = useMemo(() => new THREE.MeshBasicMaterial({ color: "#ff2020" }), []);
  const { camera } = useThree();
  const cam = useRef({ pos: new THREE.Vector3(0, 3, -8), look: new THREE.Vector3(), fov: 62 });
  const ready = useRef(false);

  useLayoutEffect(() => {
    const col = new THREE.Color();
    game.npcs.forEach((n, i) => npcs.current!.setColorAt(i, col.set(n.color)));
    npcs.current!.instanceColor!.needsUpdate = true;
  }, [game]);

  useFrame((s, delta) => {
    const dt = Math.min(delta, 0.05);
    step(game, input.current, dt);
    const p = game.player;
    const pm = player.current!;
    pm.position.set(p.x, 0, p.z); pm.rotation.set(0, p.h, -p.steer * Math.min(Math.abs(p.v) / 30, 1) * 0.06);
    game.npcs.forEach((n, i) => setInst(npcs.current!, i, n.x, 0, n.z, n.h));
    npcs.current!.instanceMatrix.needsUpdate = true;
    const nc = game.police.length;
    cops.current!.count = nc; bars.current!.count = nc;
    game.police.forEach((c, i) => { setInst(cops.current!, i, c.x, 0, c.z, c.h); setInst(bars.current!, i, c.x, 1.38, c.z, c.h); });
    if (nc) { cops.current!.instanceMatrix.needsUpdate = true; bars.current!.instanceMatrix.needsUpdate = true; barMat.color.set(Math.sin(s.clock.elapsedTime * 14) > 0 ? "#ff2a2a" : "#2a5bff"); }
    marker.current!.position.set(game.job.x, 2.5, game.job.z);

    // Câmera 3ª pessoa: atrás do carro, suavizada, afasta e abre FOV com a velocidade.
    const c = cam.current, sp = Math.abs(p.v), fx = Math.sin(p.h), fz = Math.cos(p.h);
    const back = 6.8 + sp * 0.09, up = 2.5 + sp * 0.025;
    tmpP.set(p.x - fx * back, up, p.z - fz * back);
    c.pos.lerp(tmpP, 1 - Math.exp(-5 * dt));
    tmpP.set(p.x + fx * (3 + sp * 0.15), 1.1, p.z + fz * (3 + sp * 0.15));
    c.look.lerp(tmpP, 1 - Math.exp(-9 * dt));
    camera.position.copy(c.pos); camera.lookAt(c.look);
    const fov = 60 + sp * 0.35;
    if (Math.abs(fov - c.fov) > 0.05) { c.fov += (fov - c.fov) * (1 - Math.exp(-3 * dt)); (camera as THREE.PerspectiveCamera).fov = c.fov; camera.updateProjectionMatrix(); }
    if (!ready.current) { ready.current = true; onReady(); }
  });

  return (
    <>
      <World />
      <mesh ref={player} geometry={geos.player}><meshStandardMaterial vertexColors metalness={0.15} roughness={0.5} /></mesh>
      <instancedMesh ref={npcs} args={[geos.npc, undefined, game.npcs.length]} frustumCulled={false}><meshLambertMaterial vertexColors /></instancedMesh>
      <instancedMesh ref={cops} args={[geos.cop, undefined, 5]} frustumCulled={false}><meshLambertMaterial vertexColors /></instancedMesh>
      <instancedMesh ref={bars} args={[undefined, barMat, 5]} frustumCulled={false}><boxGeometry args={[1.1, 0.16, 0.3]} /></instancedMesh>
      <mesh ref={marker}><cylinderGeometry args={[2.6, 2.6, 5, 20, 1, true]} /><meshBasicMaterial color="#e8c547" transparent opacity={0.22} side={THREE.DoubleSide} depthWrite={false} /></mesh>
    </>
  );
}

export default function GameView() {
  const game = useMemo(createGame, []);
  const input = useRef<Input>({ throttle: 0, steer: 0, handbrake: false });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const keys = new Set<string>();
    const upd = () => {
      input.current.throttle = (keys.has("w") || keys.has("arrowup") ? 1 : 0) - (keys.has("s") || keys.has("arrowdown") ? 1 : 0);
      input.current.steer = (keys.has("d") || keys.has("arrowright") ? 1 : 0) - (keys.has("a") || keys.has("arrowleft") ? 1 : 0);
      input.current.handbrake = keys.has(" ");
    };
    const dn = (e: KeyboardEvent) => { keys.add(e.key.toLowerCase()); upd(); };
    const up = (e: KeyboardEvent) => { keys.delete(e.key.toLowerCase()); upd(); };
    window.addEventListener("keydown", dn); window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", dn); window.removeEventListener("keyup", up); };
  }, []);

  return (
    <div className="fixed inset-0 select-none overflow-hidden bg-background" data-scene-ready={ready ? "" : undefined}>
      <Canvas dpr={[1, 1.5]} gl={{ antialias: true, powerPreference: "high-performance", stencil: false }} camera={{ fov: 62, near: 0.5, far: 900 }}>
        <color attach="background" args={["#c9b79a"]} />
        <fog attach="fog" args={["#c9b79a", 90, 620]} />
        <hemisphereLight args={["#f6e4c6", "#5d6150", 1.7]} />
        <directionalLight position={[-120, 90, 60]} intensity={2.8} color="#ffd29c" />
        <Scene game={game} input={input} onReady={() => setReady(true)} />
      </Canvas>
      <Hud game={game} />
      <TouchControls input={input} />
      {!ready && <div className="absolute inset-0 grid place-items-center bg-background font-display text-xl text-accent">Carregando...</div>}
    </div>
  );
}
