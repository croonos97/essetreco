import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { rnd } from "../World";

// Vegetação australiana low-poly em escala do kit (1 un ≈ 0,5 m), toda instanciada.
// Cada peça recebe uma lista de pontos {x,y,z,s,r} já com a altura do chão.
export type Spot = { x: number; y: number; z: number; s: number; r: number; k: number };

const paint = (g: THREE.BufferGeometry, c: string, jitter = 0, seed = 1) => {
  const n = g.attributes.position.count;
  const col = new Float32Array(n * 3);
  const base = new THREE.Color(c);
  for (let i = 0; i < n; i++) {
    const cc = base.clone();
    if (jitter) cc.offsetHSL(0, 0, (rnd(Math.floor(i / 3), seed) - 0.5) * jitter);
    col.set([cc.r, cc.g, cc.b], i * 3);
  }
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  return g;
};
const flat = (g: THREE.BufferGeometry) => {
  const ng = g.index ? g.toNonIndexed() : g;
  ng.computeVertexNormals();
  return ng;
};
const strip = (g: THREE.BufferGeometry) => {
  // mantém só position/normal/color para poder juntar
  for (const k of Object.keys(g.attributes)) if (!["position", "normal", "color"].includes(k)) g.deleteAttribute(k);
  return g;
};

// ---------- folha de samambaia (fronde) ----------
const frondGeo = (len: number, wid: number, droop: number, seed: number, c: string) => {
  const v: number[] = [];
  const N = 14;
  const P = (u: number) => {
    const z = u * len;
    const y = -droop * u * u * len;
    return [0, y, z];
  };
  for (let i = 0; i < N; i++) {
    const u0 = i / N, u1 = (i + 1) / N;
    const [, y0, z0] = P(u0), [, y1, z1] = P(u1);
    const w0 = wid * Math.sin(Math.PI * Math.min(1, u0 * 1.1)) * (0.6 + 0.4 * rnd(i, seed));
    // folíolos serrilhados: triângulos alternados
    for (const s of [1, -1]) {
      v.push(0, y0, z0, s * w0, y0 - 0.03 * len, (z0 + z1) / 2 + 0.02 * len, 0, y1, z1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(v, 3));
  g.computeVertexNormals();
  return paint(g, c, 0.18, seed);
};

let FERN: THREE.BufferGeometry | null = null;
// Samambaia-arborescente: tronco fibroso + coroa de frondes caídas (altura ~ 5 un).
export const treeFernGeo = () => {
  if (FERN) return FERN;
  const parts: THREE.BufferGeometry[] = [];
  const trunk = flat(new THREE.CylinderGeometry(0.16, 0.24, 4.2, 7, 4));
  trunk.translate(0, 2.1, 0);
  parts.push(strip(paint(trunk, "#5A4030", 0.25, 3)));
  for (let i = 0; i < 13; i++) {
    const f = frondGeo(2.6 + rnd(i, 4) * 0.9, 0.55, 0.55 + rnd(i, 5) * 0.3, i, i % 2 ? "#4F8F3A" : "#5FA243");
    f.rotateX(-0.5 - rnd(i, 6) * 0.35);
    f.rotateY((i / 13) * Math.PI * 2 + rnd(i, 7) * 0.3);
    f.translate(0, 4.15, 0);
    parts.push(strip(f));
  }
  const crown = flat(new THREE.IcosahedronGeometry(0.3, 0));
  crown.translate(0, 4.2, 0);
  parts.push(strip(paint(crown, "#3F6E2C")));
  FERN = mergeGeometries(parts.map((p) => (p.index ? p.toNonIndexed() : p)))!;
  return FERN;
};

let BUSH: THREE.BufferGeometry | null = null;
// Samambaia baixa / touceira (altura ~ 1 un).
export const groundFernGeo = () => {
  if (BUSH) return BUSH;
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 11; i++) {
    const f = frondGeo(1.0 + rnd(i, 14) * 0.5, 0.26, 0.35, i + 20, i % 3 ? "#5C9E3F" : "#74B04C");
    f.rotateX(-0.75 - rnd(i, 15) * 0.4);
    f.rotateY((i / 11) * Math.PI * 2 + rnd(i, 16));
    parts.push(strip(f));
  }
  BUSH = mergeGeometries(parts)!;
  return BUSH;
};

let EUC: { trunk: THREE.BufferGeometry; crown: THREE.BufferGeometry } | null = null;
// Eucalipto: tronco claro alto e torto, copa em tufos verde-acinzentados (altura ~ 36 un).
export const eucalyptusGeo = () => {
  if (EUC) return EUC;
  const pts = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.6, 9, 0.2), new THREE.Vector3(-0.4, 18, -0.3), new THREE.Vector3(0.5, 27, 0.4), new THREE.Vector3(0.1, 32, 0)];
  const curve = new THREE.CatmullRomCurve3(pts);
  const tube = new THREE.TubeGeometry(curve, 16, 1, 7, false);
  // afunila
  const p = tube.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const seg = Math.floor(i / 8) / 16;
    const c = curve.getPoint(Math.min(1, seg));
    const r = 0.85 * (1 - seg * 0.7);
    p.setXYZ(i, c.x + (p.getX(i) - c.x) * r, p.getY(i), c.z + (p.getZ(i) - c.z) * r);
  }
  const trunk = flat(tube);
  // casca: faixas claras/acinzentadas/rosadas
  const n = trunk.attributes.position.count;
  const col = new Float32Array(n * 3);
  const tones = ["#E2DCCF", "#CFC6B6", "#D9C2AE", "#BDB5A6", "#EDE8DD"];
  for (let i = 0; i < n; i += 3) {
    const y = trunk.attributes.position.getY(i);
    const c = new THREE.Color(tones[Math.floor(rnd(Math.floor(y * 1.3), 9) * 5)]);
    c.offsetHSL(0, 0, (rnd(i, 10) - 0.5) * 0.06);
    for (let k = 0; k < 3; k++) col.set([c.r, c.g, c.b], (i + k) * 3);
  }
  trunk.setAttribute("color", new THREE.BufferAttribute(col, 3));
  // galhos + tufos de copa
  const crowns: THREE.BufferGeometry[] = [];
  const branchParts: THREE.BufferGeometry[] = [strip(trunk)];
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + rnd(i, 11);
    const h = 20 + rnd(i, 12) * 12;
    const L = 5 + rnd(i, 13) * 4;
    const b = flat(new THREE.CylinderGeometry(0.12, 0.28, L, 5));
    b.translate(0, L / 2, 0);
    b.rotateZ(-0.9 - rnd(i, 14) * 0.3);
    b.rotateY(a);
    b.translate(curve.getPoint(h / 32).x, h, curve.getPoint(h / 32).z);
    branchParts.push(strip(paint(b, "#D2C9B8", 0.1, i)));
    const tip = new THREE.Vector3(Math.cos(a) * L * 0.8, h + L * 0.5, -Math.sin(a) * L * 0.8);
    for (let k = 0; k < 3; k++) {
      const c = flat(new THREE.IcosahedronGeometry(2.2 + rnd(i * 3 + k, 15) * 1.6, 0));
      c.scale(1.3, 0.75, 1.3);
      c.translate(tip.x + (rnd(i * 3 + k, 16) - 0.5) * 3, tip.y + (rnd(i * 3 + k, 17) - 0.3) * 2, tip.z + (rnd(i * 3 + k, 18) - 0.5) * 3);
      crowns.push(strip(paint(c, ["#7C9A68", "#6C8C5C", "#88A673", "#5F7F55"][(i + k) % 4], 0.12, i * 7 + k)));
    }
  }
  EUC = { trunk: mergeGeometries(branchParts)!, crown: mergeGeometries(crowns)! };
  return EUC;
};

let REED: THREE.BufferGeometry | null = null;
// Junco/capim da beira d'água (altura ~ 1,4 un), tufo de lâminas.
export const reedGeo = () => {
  if (REED) return REED;
  const v: number[] = [];
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + rnd(i, 21);
    const h = 0.9 + rnd(i, 22) * 0.8;
    const lean = 0.15 + rnd(i, 23) * 0.35;
    const w = 0.035;
    const ca = Math.cos(a), sa = Math.sin(a);
    const tx = ca * lean * h, tz = sa * lean * h;
    v.push(-w * sa, 0, w * ca, w * sa, 0, -w * ca, tx, h, tz);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(v, 3));
  g.computeVertexNormals();
  REED = paint(g, "#7FA548", 0.3, 5);
  return REED;
};

let TUFT: THREE.BufferGeometry | null = null;
// Tufo de grama na escala do bicho (altura ~ 0,25 un).
export const tuftGeo = () => {
  if (TUFT) return TUFT;
  const v: number[] = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI + rnd(i, 31);
    const h = 0.16 + rnd(i, 32) * 0.16;
    const ca = Math.cos(a) * 0.025, sa = Math.sin(a) * 0.025;
    const l = (rnd(i, 33) - 0.5) * 0.12;
    v.push(-ca, 0, -sa, ca, 0, sa, l, h, l * 0.6);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(v, 3));
  g.computeVertexNormals();
  TUFT = g;
  return TUFT;
};

let ROCK: THREE.BufferGeometry | null = null;
export const rockGeo = () => {
  if (ROCK) return ROCK;
  const g = new THREE.DodecahedronGeometry(1, 1);
  const p = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const k = 0.82 + 0.3 * rnd(Math.round(x * 50) * 7 + Math.round(y * 50) * 3 + Math.round(z * 50), 41);
    p.setXYZ(i, x * k, y * k * 0.62, z * k);
  }
  ROCK = flat(g);
  return ROCK;
};

// Instanciador genérico: geometria + material + pontos (com cor por instância opcional)
export const Inst: React.FC<{
  geo: THREE.BufferGeometry;
  spots: Spot[];
  material: THREE.Material;
  color?: (s: Spot, i: number) => string | null;
  scale?: [number, number, number];
  tilt?: number;
  castShadow?: boolean;
  receiveShadow?: boolean;
  sway?: { t: number; amp: number };
}> = ({ geo, spots, material, color, scale = [1, 1, 1], tilt = 0, castShadow = true, receiveShadow = false, sway }) => {
  const ref = useRef<THREE.InstancedMesh>(null);
  const tq = sway ? Math.round(sway.t * 30) : 0;
  useLayoutEffect(() => {
    const im = ref.current;
    if (!im) return;
    const o = new THREE.Object3D();
    spots.forEach((s, i) => {
      o.position.set(s.x, s.y, s.z);
      const sw = sway ? Math.sin(sway.t * 1.7 + s.r * 3) * sway.amp : 0;
      o.rotation.set((rnd(i, 51) - 0.5) * tilt + sw, s.r, (rnd(i, 52) - 0.5) * tilt + sw * 0.6);
      o.scale.set(s.s * scale[0], s.s * scale[1], s.s * scale[2]);
      o.updateMatrix();
      im.setMatrixAt(i, o.matrix);
      const c = color?.(s, i);
      if (c) im.setColorAt(i, new THREE.Color(c));
    });
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
  }, [spots, tq]);
  if (!spots.length) return null;
  return <instancedMesh ref={ref} args={[geo, material, spots.length]} castShadow={castShadow} receiveShadow={receiveShadow} frustumCulled={false} />;
};

// materiais compartilhados
const MAT = new Map<string, THREE.Material>();
export const vcMat = (key = "vc", opts: THREE.MeshStandardMaterialParameters = {}) => {
  if (!MAT.has(key)) MAT.set(key, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: true, side: THREE.DoubleSide, ...opts }));
  return MAT.get(key)!;
};
export const plainMat = (color: string, opts: THREE.MeshStandardMaterialParameters = {}) => {
  const key = `p${color}${JSON.stringify(opts)}`;
  if (!MAT.has(key)) MAT.set(key, new THREE.MeshStandardMaterial({ color, roughness: 0.9, ...opts }));
  return MAT.get(key)!;
};

// distribui pontos num retângulo/anel com função de altura e filtro
export const spread = (n: number, seed: number, area: { x0: number; x1: number; z0: number; z1: number }, h: (x: number, z: number) => number, ok: (x: number, z: number) => boolean, s0 = 0.7, s1 = 1.3) => {
  const out: Spot[] = [];
  let i = 0;
  while (out.length < n && i < n * 30) {
    i++;
    const x = area.x0 + rnd(i, seed) * (area.x1 - area.x0);
    const z = area.z0 + rnd(i, seed + 1) * (area.z1 - area.z0);
    if (!ok(x, z)) continue;
    out.push({ x, y: h(x, z), z, s: s0 + rnd(i, seed + 2) * (s1 - s0), r: rnd(i, seed + 3) * Math.PI * 2, k: rnd(i, seed + 4) });
  }
  return out;
};
export const useSpread = (...a: Parameters<typeof spread>) => useMemo(() => spread(...a), [a[0], a[1], JSON.stringify(a[2])]); // eslint-disable-line
