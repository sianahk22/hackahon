// Jumeau numérique du quartier : reprise de la scène Three.js de l'application de base
// (mêmes bâtiments, mêmes positions, mêmes règles d'éclairage), portée en React Three Fiber.
import { useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { SCENARIOS, kw, type ScenarioId } from '../../engine';
import type { QuartierResult } from '../../engine/quartier';

export interface SceneProps { q: QuartierResult; slot: number; scenario: ScenarioId; cloud: boolean }

const MAX_PARTICLES = 120; // limité pour la performance (220 dans l'application de base)

function rng(a: number) {
  return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

function buildCity() {
  const group = new THREE.Group();
  const std = (color: number, extra: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color, roughness: .85, metalness: 0, ...extra });
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; group.add(m); return m;
  };
  const box = (w: number, h: number, d: number, mat: THREE.Material, x: number, z: number, y = 0) => add(new THREE.BoxGeometry(w, h, d), mat, x, y + h / 2, z);

  // Sol, rues, places
  const ground = add(new THREE.PlaneGeometry(130, 130), std(0x7fa77d), 0, 0, 0); ground.rotation.x = -Math.PI / 2; ground.castShadow = false;
  const road = std(0x4b545c), walk = std(0xc9cfc8), mark = std(0xe8e2c8);
  box(130, .06, 6, road, 0, 0); box(6, .06, 130, road, 0, 0);
  box(130, .08, 1.2, walk, 0, 3.6); box(130, .08, 1.2, walk, 0, -3.6); box(1.2, .08, 130, walk, 3.6, 0); box(1.2, .08, 130, walk, -3.6, 0);
  for (let i = -60; i < 60; i += 5) { box(2.4, .07, .25, mark, i, 0); box(.25, .07, 2.4, mark, 0, i); }

  // Fenêtres, pilotées par la consommation
  const winMat = { res: std(0x1b2430, { emissive: 0xffc46b }), ecole: std(0x1b2430, { emissive: 0xffd88a }), boul: std(0x1b2430, { emissive: 0xffb04a }), gym: std(0x1b2430, { emissive: 0xbfe8ff }) };
  const winGeo = new THREE.BoxGeometry(.9, .7, .08);
  function windows(cx: number, cz: number, w: number, h: number, d: number, rows: number, cols: number, mat: THREE.Material, y0 = 1) {
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const yy = y0 + r * ((h - y0 - .8) / Math.max(1, rows - 1 || 1));
      const xx = cx - w / 2 + (c + .5) * (w / cols);
      const m1 = new THREE.Mesh(winGeo, mat); m1.position.set(xx, yy, cz + d / 2 + .05); group.add(m1);
      const m2 = new THREE.Mesh(winGeo, mat); m2.position.set(xx, yy, cz - d / 2 - .05); group.add(m2);
    }
  }

  // Gymnase et ses panneaux solaires
  const GYM = { x: -15, z: -15 };
  box(16, 5, 11, std(0xd9d2c4), GYM.x, GYM.z);
  windows(GYM.x, GYM.z, 16, 5, 11, 1, 7, winMat.gym, 2);
  const panelMat = new THREE.MeshStandardMaterial({ color: 0x1c2e52, roughness: .35, metalness: .4, emissive: 0xffb300, emissiveIntensity: 0 });
  const panelGeo = new THREE.BoxGeometry(2.2, .12, 2.6);
  for (let r = 0; r < 3; r++) for (let c = 0; c < 6; c++) add(panelGeo, panelMat, GYM.x - 6.2 + c * 2.5, 5.6, GYM.z - 3 + r * 3).rotation.x = -.35;
  // École
  box(13, 6, 8, std(0xe7c9a0), 15, -14); box(5, 6, 5, std(0xe7c9a0), 19.5, -8);
  windows(15, -14, 13, 6, 8, 2, 6, winMat.ecole, 1.6);
  box(9, .1, 4, std(0xb7a07c), 12, -7.5);
  // Boulangerie
  box(6, 4, 5, std(0xf0e3cf), 14, 11);
  add(new THREE.BoxGeometry(6.4, .2, 1.6), std(0xb5502f), 14, 2.9, 14.1).rotation.x = .3;
  windows(14, 11, 6, 4, 5, 1, 3, winMat.boul, 1.6);
  // Logements sociaux
  box(7, 15, 7, std(0xc7ccd3), -16, 15); box(7, 11, 7, std(0xb9c0c9), -8.5, 21);
  windows(-16, 15, 7, 15, 7, 6, 3, winMat.res, 1.4); windows(-8.5, 21, 7, 11, 7, 4, 3, winMat.res, 1.4);
  // Maisons
  const roofMat = std(0x9a4b3c), houseCols = [0xf2ead8, 0xe6dccb, 0xf5efe3, 0xdfe5e4];
  const houses: THREE.Vector3[] = [];
  [[9, 22], [15, 22], [21, 22], [27, 22], [9, 29], [15, 29], [21, 29], [27, 29], [-26, -5], [-28, -27]].forEach(([x, z], k) => {
    box(4, 3, 4, std(houseCols[k % 4]), x, z);
    add(new THREE.ConeGeometry(3.2, 2, 4), roofMat, x, 4, z).rotation.y = Math.PI / 4;
    const w = new THREE.Mesh(new THREE.BoxGeometry(1, .8, .08), winMat.res); w.position.set(x, 1.6, z + 2.05); group.add(w);
    houses.push(new THREE.Vector3(x, 2, z));
  });
  // Poste électrique et pylône
  const POSTE = new THREE.Vector3(30, 9, -28);
  box(4, 2.5, 3, std(0x8d969c), 30, -24);
  const pyl = std(0x6f777d, { metalness: .5, roughness: .5 });
  add(new THREE.CylinderGeometry(.25, .7, 12, 4), pyl, 30, 6, -28);
  add(new THREE.BoxGeometry(6, .25, .25), pyl, 30, 11, -28); add(new THREE.BoxGeometry(4.5, .25, .25), pyl, 30, 9, -28);
  // Bornes et voitures
  const borneMat = std(0x0e3b40, { emissive: 0x46c5d0, emissiveIntensity: .8 });
  [[-6, -27], [-2, -27], [2, -27]].forEach(([x, z], k) => {
    box(.6, 1.6, .6, borneMat, x, z);
    if (k !== 1) {
      box(2.2, 1.1, 4, std([0x2f6fb0, 0xd6d9dc][k ? 1 : 0], { metalness: .3, roughness: .4 }), x, z + 3.2);
      box(1.9, .8, 2.2, std(0x22303a, { metalness: .3, roughness: .3 }), x, z + 3.2, 1.1);
    }
  });
  // Arbres (hors emprise des bâtiments)
  const FOOT = [[-23, -7, -20.5, -9.5], [8.5, 21.5, -18, -10], [17, 22, -10.5, -5.5], [11, 17, 8.5, 14.5], [-19.5, -12.5, 11.5, 18.5], [-12, -5, 17.5, 24.5], [28, 32, -25.5, -22.5], [-8, 4, -28, -21],
    ...houses.map(h => [h.x - 2.5, h.x + 2.5, h.z - 2.5, h.z + 2.5])];
  const leaf = std(0x3f7f4a), trunk = std(0x6b4a33), rr = rng(7);
  for (let k = 0; k < 34; k++) {
    const side = rr() < .5 ? 1 : -1, along = (rr() - .5) * 110, alongX = rr() < .5;
    const x = alongX ? along : side * (5.4 + rr() * .6), z = alongX ? side * (5.4 + rr() * .6) : along;
    if (Math.abs(x) < 7 && Math.abs(z) < 7) continue;
    if (FOOT.some(([x1, x2, z1, z2]) => x > x1 - 1.6 && x < x2 + 1.6 && z > z1 - 1.6 && z < z2 + 1.6)) continue;
    add(new THREE.CylinderGeometry(.15, .2, 1.2, 6), trunk, x, .6, z);
    add(new THREE.SphereGeometry(.9 + rr() * .5, 10, 8), leaf, x, 1.9, z);
  }

  // Particules d'énergie : jaunes = soleil du gymnase, cyan = réseau
  const GYM_TOP = new THREE.Vector3(GYM.x, 7, GYM.z);
  const consumers = [...houses, new THREE.Vector3(-16, 8, 15), new THREE.Vector3(-8.5, 6, 21), new THREE.Vector3(15, 5, -14), new THREE.Vector3(14, 3, 11), new THREE.Vector3(-2, 2, -27)];
  const pGeo = new THREE.SphereGeometry(.32, 8, 8);
  const pSun = new THREE.MeshBasicMaterial({ color: 0xffc53d }), pGrid = new THREE.MeshBasicMaterial({ color: 0x5ad1e6 });
  const pool = Array.from({ length: MAX_PARTICLES }, () => {
    const m = new THREE.Mesh<THREE.BufferGeometry, THREE.Material>(pGeo, pSun); m.visible = false; group.add(m);
    return { m, t: 0, a: GYM_TOP, b: GYM_TOP, c: GYM_TOP.clone() };
  });
  function spawn(from: THREE.Vector3, mat: THREE.Material) {
    const p = pool.find(o => !o.m.visible); if (!p) return;
    const b = consumers[Math.floor(Math.random() * consumers.length)];
    p.a = from; p.b = b; p.c = from.clone().lerp(b, .5).add(new THREE.Vector3(0, 9, 0)); p.t = 0; p.m.material = mat; p.m.visible = true;
  }

  return { group, winMat, panelMat, pool, spawn, GYM, GYM_TOP, POSTE, pSun, pGrid };
}

function City({ q, slot, scenario, cloud }: SceneProps) {
  const city = useMemo(buildCity, []);
  const sunRef = useRef<THREE.DirectionalLight>(null);
  const hemiRef = useRef<THREE.HemisphereLight>(null);
  const { gl, scene } = useThree();
  const acc = useRef({ sun: 0, grid: 0 });
  const tmp = useMemo(() => new THREE.Color(), []);
  const colors = useMemo(() => ({ night: new THREE.Color(0x0a1626), day: new THREE.Color(0x9fd2ec), winter: new THREE.Color(0xb7c6d0) }), []);
  if (!scene.fog) scene.fog = new THREE.Fog(0x9fc8de, 70, 150);

  useFrame((_, delta) => {
    const dt = Math.min(.05, delta);
    const prod = q.prod[slot], cons = q.cons[slot], h = q.ctx[slot].h, sc = SCENARIOS[scenario];
    // Ciel, soleil, éclairage : mêmes règles que l'application de base
    const day = Math.max(0, Math.sin(Math.PI * (h - sc.sun.rise) / (sc.sun.set - sc.sun.rise)));
    const isDay = h >= sc.sun.rise && h <= sc.sun.set;
    const dayAmt = isDay ? Math.min(1, .25 + day) : 0;
    tmp.copy(colors.night).lerp(scenario === 'ete' ? colors.day : colors.winter, dayAmt * (cloud && h >= 11.5 && h < 15.5 ? .7 : 1));
    gl.setClearColor(tmp); (scene.fog as THREE.Fog).color.copy(tmp);
    const az = Math.PI * Math.min(1, Math.max(0, (h - sc.sun.rise) / (sc.sun.set - sc.sun.rise)));
    if (sunRef.current) {
      sunRef.current.position.set(Math.cos(az) * -60, 10 + Math.sin(az) * 50, -25);
      sunRef.current.intensity = (isDay ? .35 + 1.1 * day * (scenario === 'ete' ? 1 : .6) : .08) * Math.PI;
    }
    if (hemiRef.current) hemiRef.current.intensity = (.18 + .5 * dayAmt) * Math.PI;
    const maxProd = Math.max(1, ...q.prod);
    city.panelMat.emissiveIntensity = 1.4 * prod / maxProd;
    const p = q.parts[slot], resMax = Math.max(...q.parts.map((pp, k) => pp.res + q.flex[k]));
    const night = 1 - dayAmt;
    city.winMat.res.emissiveIntensity = .05 + (1.2 + night) * (p.res + q.flex[slot]) / resMax;
    city.winMat.ecole.emissiveIntensity = p.ecole ? .4 + night : .02;
    city.winMat.boul.emissiveIntensity = p.boul > 2 ? .5 + night : .05;
    city.winMat.gym.emissiveIntensity = .05 + .3 * night;

    // Particules : le débit suit l'énergie locale et l'énergie du réseau
    const loc = Math.min(prod, cons);
    acc.current.sun += loc * dt * .45; acc.current.grid += (cons - loc) * dt * .45;
    while (acc.current.sun >= 1) { city.spawn(city.GYM_TOP, city.pSun); acc.current.sun--; }
    while (acc.current.grid >= 1) { city.spawn(city.POSTE, city.pGrid); acc.current.grid--; }
    for (const pt of city.pool) if (pt.m.visible) {
      pt.t += dt * .55; if (pt.t >= 1) { pt.m.visible = false; continue; }
      const t = pt.t, u = 1 - t;
      pt.m.position.set(u * u * pt.a.x + 2 * u * t * pt.c.x + t * t * pt.b.x, u * u * pt.a.y + 2 * u * t * pt.c.y + t * t * pt.b.y, u * u * pt.a.z + 2 * u * t * pt.c.z + t * t * pt.b.z);
    }
  });

  const prod = q.prod[slot], cons = q.cons[slot];
  return (
    <>
      <hemisphereLight ref={hemiRef} args={[0xdcefff, 0x2f3d33, .55 * Math.PI]} />
      <directionalLight ref={sunRef} color={0xfff0d0} castShadow shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-45} shadow-camera-right={45} shadow-camera-top={45} shadow-camera-bottom={-45} shadow-camera-far={160} />
      <primitive object={city.group} />
      <Label pos={[city.GYM.x, 10, city.GYM.z]}>Gymnase solaire<i className="sun">{kw(prod)}</i></Label>
      <Label pos={[15, 9, -14]}>École</Label>
      <Label pos={[14, 7, 11]}>Boulangerie</Label>
      <Label pos={[-16, 18, 15]}>Logements</Label>
      <Label pos={[30, 14, -28]}>Poste électrique<i className="grid">{kw(Math.max(0, cons - Math.min(prod, cons)))}</i></Label>
    </>
  );
}

function Label({ pos, children }: { pos: [number, number, number]; children: React.ReactNode }) {
  return <Html position={pos} center zIndexRange={[10, 0]}><div className="lbl">{children}</div></Html>;
}

export default function CityScene(props: SceneProps) {
  const reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  return (
    <Canvas shadows dpr={[1, 2]} camera={{ position: [44, 34, 48], fov: 38, near: .1, far: 400 }}
      gl={{ antialias: true }} aria-label="Vue 3D du quartier : bâtiments, panneaux solaires et flux d'énergie">
      <City {...props} />
      <OrbitControls enableDamping enablePan={false} target={[0, 2, 0]} maxPolarAngle={Math.PI * .44}
        minDistance={30} maxDistance={100} autoRotate={!reduced} autoRotateSpeed={.35} />
    </Canvas>
  );
}
