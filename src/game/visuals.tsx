import { useLayoutEffect, useMemo, useRef } from 'react';
import { Environment, Lightformer } from '@react-three/drei';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { HALF, LAMPS, type Game } from './sim';
import { palette as C } from './palette';

function texture(width: number, height: number, draw: (ctx: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d'); if (ctx) draw(ctx);
  const t = new THREE.CanvasTexture(canvas); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const matrix = new THREE.Matrix4(), position = new THREE.Vector3(), rotation = new THREE.Quaternion(), scale = new THREE.Vector3(), axis = new THREE.Vector3(0, 1, 0);
export function instance(mesh: THREE.InstancedMesh, i: number, x: number, y: number, z: number, yaw: number, sx = 1, sy = 1, sz = 1) {
  position.set(x, y, z); rotation.setFromAxisAngle(axis, yaw); scale.set(sx, sy, sz);
  mesh.setMatrixAt(i, matrix.compose(position, rotation, scale));
}
function palmGeometry() {
  const parts: THREE.BufferGeometry[] = [];
  for (let j = 0; j < 7; j++) {
    const g = new THREE.ConeGeometry(0.55, 5, 3, 1); g.rotateZ(1.4); g.translate(2, 0, 0); g.rotateY(j * Math.PI * 2 / 7); g.translate(0, 8, 0); parts.push(g);
  }
  return mergeGeometries(parts) ?? new THREE.BoxGeometry();
}
function peopleGeometry() {
  const parts = [new THREE.BoxGeometry(0.48, 0.64, 0.3).translate(0, 1.12, 0), new THREE.SphereGeometry(0.19, 6, 4).translate(0, 1.68, 0)];
  for (const g of parts) {
    const p = g.getAttribute('position'), colors = new Float32Array(p.count * 3), color = new THREE.Color(g === parts[0] ? C.shirt : C.skin);
    for (let i = 0; i < p.count; i++) { colors[i * 3] = color.r; colors[i * 3 + 1] = color.g; colors[i * 3 + 2] = color.b; }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  }
  return mergeGeometries(parts) ?? new THREE.BoxGeometry();
}
export type VisualRefs = {
  human: THREE.Group | null; limbs: (THREE.Group | null)[];
  pedestrians: THREE.InstancedMesh | null; legs: THREE.InstancedMesh | null; arms: THREE.InstancedMesh | null;
  particles: THREE.InstancedMesh | null; pickups: THREE.InstancedMesh | null;
  lamps: THREE.InstancedMesh | null; lights: THREE.InstancedMesh | null;
  sun: THREE.DirectionalLight | null; ambient: THREE.HemisphereLight | null; sky: THREE.Mesh | null;
};
export function createVisualRefs(): VisualRefs { return { human: null, limbs: [null, null, null, null], pedestrians: null, legs: null, arms: null, particles: null, pickups: null, lamps: null, lights: null, sun: null, ambient: null, sky: null }; }
export function CityExtras({ refs, quality }: { refs: VisualRefs; quality: boolean }) {
  const towers = useRef<THREE.InstancedMesh>(null), trunks = useRef<THREE.InstancedMesh>(null), palms = useRef<THREE.InstancedMesh>(null), trees = useRef<THREE.InstancedMesh>(null), grass = useRef<THREE.InstancedMesh>(null);
  const assets = useMemo(() => {
    const windows = texture(128, 256, (ctx) => {
      ctx.fillStyle = C.glass; ctx.fillRect(0, 0, 128, 256);
      for (let x = 6; x < 128; x += 16) for (let y = 6; y < 256; y += 13) {
        ctx.fillStyle = ((x * y + x) % 7 < 4) ? C.lamp : C.glass; ctx.fillRect(x, y, 7, 6);
      }
    });
    const sky = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, uniforms: { horizon: { value: new THREE.Color(C.horizon) }, top: { value: new THREE.Color(C.zenith) } }, vertexShader: 'varying vec3 v; void main(){v=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}', fragmentShader: 'varying vec3 v; uniform vec3 horizon; uniform vec3 top; void main(){float h=clamp(normalize(v).y,0.,1.);gl_FragColor=vec4(mix(horizon,top,smoothstep(0.,.8,h)),1.); #include <tonemapping_fragment>\n#include <colorspace_fragment>\n}' });
    const blade = new THREE.BufferGeometry(); blade.setAttribute('position', new THREE.Float32BufferAttribute([-0.09, 0, 0, 0.09, 0, 0, 0.03, 1, 0], 3)); blade.computeVertexNormals();
    return { windows, sky, palm: palmGeometry(), blade };
  }, []);
  useLayoutEffect(() => {
    const a = towers.current, b = trunks.current, c = palms.current, d = trees.current, e = grass.current;
    if (!a || !b || !c || !d || !e) return;
    for (let i = 0; i < 24; i++) {
      const h = 30 + (i * 13 % 45), angle = i * Math.PI * 2 / 24;
      instance(a, i, Math.sin(angle) * 235, h / 2, Math.cos(angle) * 235, angle, 12 + i % 4 * 3, h, 12);
    }
    for (let i = 0; i < 64; i++) {
      const x = (i % 8 + 0.5) * 40 - HALF + 14.8, z = (Math.floor(i / 8) + 0.5) * 40 - HALF + 14.8;
      instance(b, i, x, 4, z, 0); instance(c, i, x, 0, z, i);
      instance(d, i, x - 2, 3, z, i, 1.8, 2.5, 1.8);
    }
    for (let i = 0; i < 900; i++) {
      const block = i % 64, x = (block % 8 + 0.5) * 40 - HALF, z = (Math.floor(block / 8) + 0.5) * 40 - HALF;
      instance(e, i, x + ((i * 19 % 29) - 14), 0.23, z + 14.4, i * 1.9, 1, 0.5 + i % 5 * 0.15, 1);
    }
    if (refs.lamps) LAMPS.forEach((l, i) => instance(refs.lamps as THREE.InstancedMesh, i, l.x + Math.sin(l.ry) * 1.6, 6.2, l.z + Math.cos(l.ry) * 1.6, l.ry));
    for (const m of [a, b, c, d, e, refs.lamps]) if (m) { m.instanceMatrix.needsUpdate = true; m.computeBoundingSphere(); }
  }, [refs]);
  return <>
    <mesh ref={(m) => { refs.sky = m; }} material={assets.sky} frustumCulled={false}><sphereGeometry args={[800, 16, 12]} /></mesh>
    <hemisphereLight ref={(l) => { refs.ambient = l; }} args={[C.ambient, C.earth, 1.8]} />
    <directionalLight ref={(l) => { refs.sun = l; }} position={[-30, 15, 20]} intensity={2.5} color={C.sun} castShadow={quality} shadow-mapSize={[1024, 1024]} shadow-camera-left={-22} shadow-camera-right={22} shadow-camera-top={22} shadow-camera-bottom={-22} shadow-camera-near={0.5} shadow-camera-far={90} shadow-normalBias={0.08} shadow-bias={-0.0005} />
    <Environment resolution={32}><Lightformer intensity={1.5} position={[0, 8, 0]} scale={[20, 20, 1]} /><Lightformer intensity={1} color={C.sun} position={[-10, 3, 0]} rotation-y={Math.PI / 2} scale={[20, 10, 1]} /></Environment>
    <instancedMesh ref={towers} args={[undefined, undefined, 24]}><boxGeometry /><meshStandardMaterial map={assets.windows} emissiveMap={assets.windows} emissive={C.lamp} emissiveIntensity={0.5} roughness={0.9} /></instancedMesh>
    <instancedMesh ref={trunks} args={[undefined, undefined, 64]}><cylinderGeometry args={[0.15, 0.25, 8, 5]} /><meshLambertMaterial color={C.earth} /></instancedMesh>
    <instancedMesh ref={palms} args={[assets.palm, undefined, 64]}><meshLambertMaterial color={C.foliage} side={THREE.DoubleSide} /></instancedMesh>
    <instancedMesh ref={trees} args={[undefined, undefined, 64]}><icosahedronGeometry args={[1, 0]} /><meshLambertMaterial color={C.foliage} /></instancedMesh>
    <instancedMesh ref={grass} args={[assets.blade, undefined, 900]}><meshLambertMaterial color={C.grass} side={THREE.DoubleSide} /></instancedMesh>
    <instancedMesh ref={(m) => { refs.lamps = m; }} args={[undefined, undefined, LAMPS.length]}><boxGeometry args={[0.26, 0.08, 0.46]} /><meshStandardMaterial color={C.lamp} emissive={C.lamp} emissiveIntensity={1.5} /></instancedMesh>
  </>;
}
export function Actors({ refs, game }: { refs: VisualRefs; game: Game }) {
  const body = useMemo(peopleGeometry, []);
  return <>
    <group ref={(g) => { refs.human = g; }}>
      <mesh position={[0, 1.12, 0]} castShadow><boxGeometry args={[0.5, 0.64, 0.32]} /><meshStandardMaterial color={C.shirt} roughness={0.9} /></mesh>
      <mesh position={[0, 1.7, 0]} castShadow><sphereGeometry args={[0.19, 8, 6]} /><meshStandardMaterial color={C.skin} /></mesh>
      <mesh position={[0, 1.83, -0.025]}><boxGeometry args={[0.32, 0.12, 0.29]} /><meshLambertMaterial color={C.hair} /></mesh>
      {[-1, 1].map((sign, i) => <group key={`leg${i}`} ref={(g) => { refs.limbs[i] = g; }} position={[sign * 0.14, 0.84, 0]}>
        <mesh position={[0, -0.34, 0]} castShadow><boxGeometry args={[0.22, 0.7, 0.25]} /><meshStandardMaterial color={C.denim} /></mesh>
        <mesh position={[0, -0.74, 0.055]}><boxGeometry args={[0.23, 0.15, 0.36]} /><meshLambertMaterial color={C.shoe} /></mesh>
      </group>)}
      {[-1, 1].map((sign, i) => <group key={`arm${i}`} ref={(g) => { refs.limbs[i + 2] = g; }} position={[sign * 0.35, 1.38, 0]}>
        <mesh position={[0, -0.29, 0]} castShadow><boxGeometry args={[0.17, 0.58, 0.19]} /><meshStandardMaterial color={C.skin} /></mesh>
        {i === 1 && <mesh position={[0, -0.61, 0.12]}><boxGeometry args={[0.09, 0.15, 0.25]} /><meshStandardMaterial color={C.glass} metalness={0.5} roughness={0.4} /></mesh>}
      </group>)}
    </group>
    <instancedMesh ref={(m) => { refs.pedestrians = m; }} args={[body, undefined, 30]} frustumCulled={false}><meshLambertMaterial vertexColors /></instancedMesh>
    <instancedMesh ref={(m) => { refs.legs = m; }} args={[undefined, undefined, 60]} frustumCulled={false}><boxGeometry args={[0.18, 0.7, 0.2]} /><meshLambertMaterial color={C.denim} /></instancedMesh>
    <instancedMesh ref={(m) => { refs.arms = m; }} args={[undefined, undefined, 60]} frustumCulled={false}><boxGeometry args={[0.14, 0.55, 0.16]} /><meshLambertMaterial color={C.skin} /></instancedMesh>
    <instancedMesh ref={(m) => { refs.particles = m; }} args={[undefined, undefined, 60]} frustumCulled={false}><icosahedronGeometry args={[1, 0]} /><meshBasicMaterial transparent opacity={0.5} depthWrite={false} /></instancedMesh>
    <instancedMesh ref={(m) => { refs.pickups = m; }} args={[undefined, undefined, game.pickups.length]} frustumCulled={false}><boxGeometry args={[0.45, 0.02, 0.22]} /><meshStandardMaterial color={C.pickup} emissive={C.pickup} emissiveIntensity={0.6} /></instancedMesh>
    <instancedMesh ref={(m) => { refs.lights = m; }} args={[undefined, undefined, 58]} frustumCulled={false}><boxGeometry args={[0.42, 0.14, 0.05]} /><meshStandardMaterial color={C.lamp} emissive={C.lamp} emissiveIntensity={1.3} /></instancedMesh>
  </>;
}
const night = new THREE.Color(C.night), nightTop = new THREE.Color(C.nightTop), horizon = new THREE.Color(C.horizon), zenith = new THREE.Color(C.zenith), particleColor = new THREE.Color();
export function updateVisuals(refs: VisualRefs, g: Game, camera: THREE.Camera, scene: THREE.Scene, dt: number) {
  const p = g.player;
  if (refs.human) { refs.human.visible = !g.vehicle; refs.human.position.set(p.x, 0, p.z); refs.human.rotation.y = p.h; }
  for (let i = 0; i < 4; i++) { const limb = refs.limbs[i]; if (limb) limb.rotation.x = !g.vehicle && p.v > 0 ? Math.sin(g.walkPhase + i % 2 * Math.PI) * (i < 2 ? 0.65 : -0.5) : 0; }
  const gun = refs.limbs[3]; if (gun && g.shotCd > 0) gun.rotation.x = -Math.PI / 2;
  const bodies = refs.pedestrians, legs = refs.legs, arms = refs.arms;
  if (bodies && legs && arms) {
    for (let i = 0; i < g.pedestrians.length; i++) {
      const n = g.pedestrians[i]; if (!n) continue; const visible = n.down > 0 ? 0 : 1;
      instance(bodies, i, n.x, 0, n.z, n.h, visible, visible, visible);
      for (let j = 0; j < 2; j++) {
        const stride = Math.sin(n.phase + j * Math.PI) * 0.2, side = j ? 1 : -1, s = Math.sin(n.h), c = Math.cos(n.h);
        instance(legs, i * 2 + j, n.x + c * side * 0.14 + s * stride, 0.48, n.z - s * side * 0.14 + c * stride, n.h, visible, visible, visible);
        instance(arms, i * 2 + j, n.x + c * side * 0.32 - s * stride, 1.04, n.z - s * side * 0.32 - c * stride, n.h, visible, visible, visible);
      }
    }
    bodies.instanceMatrix.needsUpdate = legs.instanceMatrix.needsUpdate = arms.instanceMatrix.needsUpdate = true;
  }
  if (refs.particles) {
    for (let i = 0; i < g.particles.length; i++) {
      const n = g.particles[i]; if (!n) continue;
      const size = n.life > 0 ? (n.kind ? 0.045 : (1.1 - n.life) * 0.4 + 0.1) : 0;
      instance(refs.particles, i, n.x, n.y, n.z, 0, size, size, size);
      refs.particles.setColorAt(i, particleColor.set(n.kind ? C.spark : C.dust));
    }
    refs.particles.instanceMatrix.needsUpdate = true; if (refs.particles.instanceColor) refs.particles.instanceColor.needsUpdate = true;
  }
  if (refs.pickups) { g.pickups.forEach((n, i) => instance(refs.pickups as THREE.InstancedMesh, i, n.x, 0.5 + Math.sin(g.t * 2 + i) * 0.15, n.z, g.t, n.active ? 1 : 0, 1, 1)); refs.pickups.instanceMatrix.needsUpdate = true; }
  const darkness = Math.max(0, Math.sin(g.day * Math.PI * 2));
  if (refs.sky) {
    refs.sky.position.copy(camera.position);
    const m = refs.sky.material as THREE.ShaderMaterial;
    (m.uniforms['horizon']?.value as THREE.Color)?.copy(horizon).lerp(night, darkness);
    (m.uniforms['top']?.value as THREE.Color)?.copy(zenith).lerp(nightTop, darkness);
  }
  if (scene.fog instanceof THREE.Fog) { scene.fog.color.copy(horizon).lerp(night, darkness); scene.fog.near = 35; scene.fog.far = 260; }
  if (refs.sun) { refs.sun.position.set(p.x - 30, 15, p.z + 20); refs.sun.target.position.set(p.x, 0, p.z); refs.sun.target.updateMatrixWorld(); refs.sun.intensity = 2.5 - darkness * 2.2; }
  if (refs.ambient) refs.ambient.intensity = 1.8 - darkness * 0.9;
  if (refs.lamps) (refs.lamps.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.7 + darkness * 2;
  if (refs.lights) {
    let i = 0;
    const lights = (car: typeof p) => {
      const s = Math.sin(car.h), c = Math.cos(car.h);
      for (let j = 0; j < 2; j++) { const side = j ? 0.6 : -0.6; instance(refs.lights as THREE.InstancedMesh, i++, car.x + s * 2.19 + c * side, 0.6, car.z + c * 2.19 - s * side, car.h); }
    };
    for (const car of g.parked) lights(car); for (const car of g.npcs) lights(car); for (const car of g.police) lights(car);
    refs.lights.count = i; refs.lights.instanceMatrix.needsUpdate = true;
  }
}
/** One half-resolution warm grade + thresholded glow pass, no mip-chain bloom. */
export function createPost(gl: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) {
  const composer = new EffectComposer(gl); composer.setPixelRatio(0.75);
  composer.addPass(new RenderPass(scene, camera));
  const grade = new ShaderPass({ uniforms: { tDiffuse: { value: null }, pixel: { value: new THREE.Vector2(1 / 800, 1 / 600) } }, vertexShader: 'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}', fragmentShader: `uniform sampler2D tDiffuse; uniform vec2 pixel; varying vec2 vUv;
    vec3 bright(vec2 p){vec3 c=texture2D(tDiffuse,p).rgb;return c*max(0.,max(c.r,max(c.g,c.b))-1.);}
    void main(){vec3 c=texture2D(tDiffuse,vUv).rgb;vec3 b=bright(vUv+pixel*3.)+bright(vUv-pixel*3.)+bright(vUv+vec2(pixel.x,-pixel.y)*3.)+bright(vUv+vec2(-pixel.x,pixel.y)*3.);c=c*vec3(1.035,1.,.96)+b*.045;gl_FragColor=vec4(c,1.);}` });
  composer.addPass(grade); composer.addPass(new OutputPass());
  return { composer, resize: (w: number, h: number) => { composer.setSize(w, h); (grade.uniforms['pixel']?.value as THREE.Vector2)?.set(1 / w, 1 / h); }, dispose: () => { for (const pass of composer.passes) pass.dispose(); composer.dispose(); } };
}
