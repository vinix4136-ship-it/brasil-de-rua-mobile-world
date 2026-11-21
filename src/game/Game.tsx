import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { BLOCK, CELL, HALF, HILLS, HOUSES, LAMPS, N, W, createGame, step, type Game, type Input } from "./sim";
import { asphaltTex, brickTex, carGeometry, concreteTex, lampGeometry, plasterTex, roofTex } from "./models";
import { Hud, TouchControls } from "./Hud";
import { Actors, CityExtras, createVisualRefs, updateVisuals, createPost } from './visuals';
import { palette as C } from './palette';
import { restoreProgress, saveProgress } from './player';
import { GameAudio } from './audio';

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
    const pm = painted.current, bm = brick.current, tm = tanks.current, lm = lamps.current, wm = walks.current;
    if (!pm || !bm || !tm || !lm || !wm) return;
    const col = new THREE.Color();
    paintedList.forEach((h, i) => { setInst(pm, i, h.x, h.y + h.h / 2, h.z, h.ry, h.w, h.h, h.d); pm.setColorAt(i, col.set(h.color)); });
    brickList.forEach((h, i) => setInst(bm, i, h.x, h.y + h.h / 2, h.z, h.ry, h.w, h.h, h.d));
    tankList.forEach((h, i) => setInst(tm, i, h.x + h.w * 0.22, h.y + h.h + 0.5, h.z - h.d * 0.2, 0));
    LAMPS.forEach((l, i) => setInst(lm, i, l.x, 0.2, l.z, l.ry));
    let k = 0;
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) setInst(wm, k++, (i + 0.5) * CELL - HALF, 0.11, (j + 0.5) * CELL - HALF, 0);
    for (const m of [pm, bm, tm, lm, wm]) { m.instanceMatrix.needsUpdate = true; m.computeBoundingSphere(); }
  }, [paintedList, brickList, tankList]);

  return (
    <>
      <mesh receiveShadow rotation-x={-Math.PI / 2}><planeGeometry args={[W, W]} /><meshLambertMaterial map={t.asphalt} /></mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.4, 0]}><planeGeometry args={[3000, 3000]} /><meshLambertMaterial color="#4d5a3a" /></mesh>
      <instancedMesh ref={walks} args={[undefined, undefined, N * N]}><boxGeometry args={[BLOCK + 1, 0.22, BLOCK + 1]} /><meshLambertMaterial map={t.concrete} /></instancedMesh>
      <instancedMesh receiveShadow castShadow ref={painted} args={[undefined, mats.painted, paintedList.length]}><boxGeometry /></instancedMesh>
      <instancedMesh receiveShadow castShadow ref={brick} args={[undefined, mats.brick, brickList.length]}><boxGeometry /></instancedMesh>
      <instancedMesh ref={tanks} args={[undefined, undefined, tankList.length]}><cylinderGeometry args={[0.7, 0.6, 1, 8]} /><meshLambertMaterial color="#2f5f8f" /></instancedMesh>
      <instancedMesh ref={lamps} args={[lampGeo, undefined, LAMPS.length]}><meshLambertMaterial vertexColors /></instancedMesh>
      {HILLS.map((h, i) => (
        <mesh key={i} position={[h.x, h.h / 2 - 0.5, h.z]}><coneGeometry args={[h.r, h.h, 10, 1]} /><meshLambertMaterial color="#5a6440" flatShading /></mesh>
      ))}
      {HILLS[0] && <group position={[HILLS[0].x, HILLS[0].h - 1, HILLS[0].z]} scale={3}>
        <mesh position={[0, 3, 0]}><boxGeometry args={[1.4, 6, 1]} /><meshLambertMaterial color="#d9d6cc" /></mesh>
        <mesh position={[0, 5, 0]}><boxGeometry args={[7, 0.8, 0.8]} /><meshLambertMaterial color="#d9d6cc" /></mesh>
        <mesh position={[0, 6.5, 0]}><sphereGeometry args={[0.55, 8, 6]} /><meshLambertMaterial color="#d9d6cc" /></mesh>
      </group>}
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.05, HALF + 18]}><planeGeometry args={[W + 300, 36]} /><meshLambertMaterial color="#cdb98a" /></mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.2, HALF + 336]}><planeGeometry args={[3000, 600]} /><meshPhongMaterial color="#2b6a80" shininess={80} /></mesh>
    </>
  );
});

function Scene({ game, input, keyboard, quality, onReady }: { game: Game; input: React.MutableRefObject<Input>; keyboard: React.MutableRefObject<Input>; quality: boolean; onReady: () => void }) {
  const player = useRef<THREE.Mesh>(null), npcs = useRef<THREE.InstancedMesh>(null);
  const cops = useRef<THREE.InstancedMesh>(null), bars = useRef<THREE.InstancedMesh>(null), marker = useRef<THREE.Mesh>(null), parked = useRef<THREE.InstancedMesh>(null);
  const geos = useMemo(() => ({ player: carGeometry({ body: C.car, rims: C.metal }), npc: carGeometry(), cop: carGeometry({ body: C.shirt, police: true }) }), []);
  const barMat = useMemo(() => new THREE.MeshBasicMaterial({ color: C.red }), []);
  const visual = useMemo(createVisualRefs, []);
  const merged = useRef<Input>({ throttle: 0, steer: 0, handbrake: false, run: false, interact: false, fire: false });
  const { camera, gl, scene, size } = useThree();
  const cam = useRef({ pos: new THREE.Vector3(0, 3.2, -6), look: new THREE.Vector3(0, 1, 0), fov: 62 });
  const ready = useRef(false), perf = useRef({ time: 0, frames: 0, enabled: quality, downgraded: false });
  const post = useMemo(() => quality ? createPost(gl, scene, camera) : null, [gl, scene, camera, quality]);
  useEffect(() => { post?.resize(size.width, size.height); }, [post, size.width, size.height]);
  useEffect(() => () => { post?.dispose(); Object.values(geos).forEach((g) => g.dispose()); barMat.dispose(); }, [post, geos, barMat]);
  useLayoutEffect(() => {
    const mesh = npcs.current; if (!mesh) return;
    const col = new THREE.Color(); game.npcs.forEach((n, i) => mesh.setColorAt(i, col.set(n.color)));
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [game]);

  useFrame((s, delta) => {
    const pm = player.current, nm = npcs.current, cm = cops.current, bm = bars.current, mk = marker.current, park = parked.current;
    if (!pm || !nm || !cm || !bm || !mk || !park) { gl.render(scene, camera); return; }
    const dt = Math.min(delta, 0.05), touch = input.current, keys = keyboard.current, controls = merged.current;
    controls.throttle = keys.throttle || touch.throttle; controls.steer = keys.steer || touch.steer;
    controls.handbrake = keys.handbrake || touch.handbrake; controls.run = !!(keys.run || touch.run);
    controls.interact = !!(keys.interact || touch.interact); controls.fire = !!(keys.fire || touch.fire);
    keys.interact = false; touch.interact = false;
    step(game, controls, dt);
    const p = game.player;
    pm.visible = !!game.vehicle; pm.position.set(p.x, 0, p.z); pm.rotation.set(0, p.h, game.vehicle ? -p.steer * Math.min(Math.abs(p.v) / 30, 1) * 0.06 : 0);
    for (let i = 0; i < game.npcs.length; i++) { const n = game.npcs[i]; if (n) setInst(nm, i, n.x, 0, n.z, n.h, n === game.vehicle ? 0 : 1); }
    nm.instanceMatrix.needsUpdate = true;
    for (let i = 0; i < game.parked.length; i++) { const n = game.parked[i]; if (n) setInst(park, i, n.x, 0, n.z, n.h, n === game.vehicle ? 0 : 1); }
    park.instanceMatrix.needsUpdate = true;
    const nc = game.police.length; cm.count = nc; bm.count = nc;
    for (let i = 0; i < nc; i++) { const c = game.police[i]; if (c) { setInst(cm, i, c.x, 0, c.z, c.h, c === game.vehicle ? 0 : 1); setInst(bm, i, c.x, 1.38, c.z, c.h); } }
    if (nc) { cm.instanceMatrix.needsUpdate = true; bm.instanceMatrix.needsUpdate = true; barMat.color.set(Math.sin(game.t * 14) > 0 ? C.red : C.blue); }
    mk.position.set(game.job.x, 2.5, game.job.z); mk.scale.setScalar(1 + Math.sin(game.t * 3) * 0.035); mk.visible = game.missionIndex % 3 !== 2;
    const c = cam.current, sp = game.vehicle ? Math.abs(p.v) : 0;
    if (game.vehicle) game.cameraYaw = p.h;
    const heading = game.vehicle ? p.h : game.cameraYaw, fx = Math.sin(heading), fz = Math.cos(heading);
    const back = game.vehicle ? 6.8 + sp * 0.09 : 5, up = game.vehicle ? 2.5 + sp * 0.025 : 2.8;
    tmpP.set(p.x - fx * back, up, p.z - fz * back); c.pos.lerp(tmpP, 1 - Math.exp(-5 * dt));
    tmpP.set(p.x + fx * (game.vehicle ? 3 + sp * 0.15 : 0.7), game.vehicle ? 1.1 : 1.2, p.z + fz * (game.vehicle ? 3 + sp * 0.15 : 0.7));
    c.look.lerp(tmpP, 1 - Math.exp(-9 * dt)); camera.position.copy(c.pos); camera.lookAt(c.look);
    const fov = 60 + sp * 0.35;
    if (Math.abs(fov - c.fov) > 0.05) { c.fov += (fov - c.fov) * (1 - Math.exp(-3 * dt)); (camera as THREE.PerspectiveCamera).fov = c.fov; camera.updateProjectionMatrix(); }
    updateVisuals(visual, game, camera, scene, dt);
    const metrics = perf.current;
    if (!document.hidden && ready.current) { metrics.time += delta; metrics.frames++; }
    if (!metrics.downgraded && metrics.time > 6 && metrics.frames / metrics.time < 40) {
      metrics.downgraded = true; metrics.enabled = false; gl.shadowMap.enabled = false; gl.setPixelRatio(1); post?.resize(size.width, size.height);
    }
    if (post && metrics.enabled) post.composer.render(dt); else gl.render(scene, camera);
    if (!ready.current) { ready.current = true; onReady(); }
  }, 1);

  return <>
    <World />
    <CityExtras refs={visual} quality={quality} />
    <Actors refs={visual} game={game} />
    <mesh ref={player} castShadow geometry={geos.player}><meshStandardMaterial vertexColors metalness={0.25} roughness={0.4} /></mesh>
    <instancedMesh ref={parked} args={[geos.player, undefined, game.parked.length]}><meshStandardMaterial vertexColors metalness={0.25} roughness={0.4} /></instancedMesh>
    <instancedMesh ref={npcs} args={[geos.npc, undefined, game.npcs.length]} frustumCulled={false}><meshLambertMaterial vertexColors /></instancedMesh>
    <instancedMesh ref={cops} args={[geos.cop, undefined, 5]} frustumCulled={false}><meshLambertMaterial vertexColors /></instancedMesh>
    <instancedMesh ref={bars} args={[undefined, barMat, 5]} frustumCulled={false}><boxGeometry args={[1.1, 0.16, 0.3]} /></instancedMesh>
    <mesh ref={marker}><cylinderGeometry args={[2.6, 2.6, 5, 16, 1, true]} /><meshBasicMaterial color={C.mission} transparent opacity={0.35} side={THREE.DoubleSide} depthWrite={false} /></mesh>
  </>;
}

export default function GameView() {
  const game = useMemo(createGame, []);
  const input = useRef<Input>({ throttle: 0, steer: 0, handbrake: false });
  const keyboard = useRef<Input>({ throttle: 0, steer: 0, handbrake: false });
  const [ready, setReady] = useState(false), [quality, setQuality] = useState<boolean | null>(null);
  useEffect(() => {
    const nav = navigator as Navigator & { deviceMemory?: number };
    setQuality((nav.deviceMemory ?? 4) >= 4 && navigator.hardwareConcurrency >= 4);
    restoreProgress(game);
    const audio = new GameAudio(game), keys = new Set<string>();
    const upd = () => {
      const k = keyboard.current;
      k.throttle = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0);
      k.steer = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
      k.handbrake = keys.has('Space'); k.run = keys.has('ShiftLeft') || keys.has('ShiftRight'); k.fire = keys.has('KeyF');
    };
    const dn = (e: KeyboardEvent) => {
      if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
      audio.unlock(); keys.add(e.code); upd();
      if (!e.repeat && e.code === 'KeyE') keyboard.current.interact = true;
      if (!e.repeat && e.code === 'KeyR') game.radio = (game.radio + 1) % 4;
      if (!e.repeat && e.code === 'KeyH') game.horn = true;
    };
    const up = (e: KeyboardEvent) => { keys.delete(e.code); upd(); };
    const clear = () => { keys.clear(); upd(); input.current.throttle = 0; input.current.steer = 0; input.current.handbrake = false; input.current.run = false; input.current.fire = false; saveProgress(game); };
    const save = () => saveProgress(game);
    const iv = setInterval(save, 5000);
    window.addEventListener('keydown', dn); window.addEventListener('keyup', up); window.addEventListener('pointerdown', audio.unlock);
    window.addEventListener('blur', clear); window.addEventListener('pagehide', save);
    if (import.meta.env.DEV) {
      const debug = { state: game, input: input.current, actions: { interact: () => { input.current.interact = true; }, shoot: () => { input.current.fire = true; }, save }, sim: (seconds: number) => { const control: Input = { throttle: 0, steer: 0, handbrake: false }; for (let i = 0; i < Math.min(seconds, 600) * 60; i++) step(game, control, 1 / 60); } };
      (window as unknown as { __game: typeof debug }).__game = debug;
    }
    return () => { save(); clearInterval(iv); audio.dispose(); window.removeEventListener('keydown', dn); window.removeEventListener('keyup', up); window.removeEventListener('pointerdown', audio.unlock); window.removeEventListener('blur', clear); window.removeEventListener('pagehide', save); };
  }, [game]);
  return <div className="fixed inset-0 select-none overflow-hidden bg-background" data-scene-ready={ready ? '' : undefined}>
    {quality !== null && <Canvas shadows={quality ? 'soft' : false} dpr={[1, 1.5]} gl={{ antialias: false, powerPreference: 'high-performance', stencil: false }} camera={{ fov: 62, near: 0.3, far: 1000 }}>
      <color attach="background" args={[C.horizon]} /><fog attach="fog" args={[C.horizon, 35, 260]} />
      <Scene game={game} input={input} keyboard={keyboard} quality={quality} onReady={() => setReady(true)} />
    </Canvas>}
    <Hud game={game} /><TouchControls input={input} />
    {!ready && <div className="absolute inset-0 grid place-items-center bg-background font-display text-xl text-accent">OUTLAWED</div>}
  </div>;
}
