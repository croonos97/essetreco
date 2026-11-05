import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { C } from "../theme";

// Kit de "mundo" compartilhado (padrão das referências virais):
// céu com horizonte enevoado, colinas facetadas até o horizonte, floresta variada,
// tufos de grama, cidade distante, nuvens e água animada. Tudo determinístico.

type V3 = [number, number, number];

// ---------- ruído determinístico ----------
const hash = (x: number, y: number) => {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
};
const smooth = (t: number) => t * t * (3 - 2 * t);
const noise = (x: number, y: number) => {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  const u = smooth(xf), v = smooth(yf);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
};
export const fbm = (x: number, y: number) => noise(x, y) * 0.55 + noise(x * 2.1, y * 2.1) * 0.28 + noise(x * 4.3, y * 4.3) * 0.17;
export const rnd = (i: number, k = 0) => hash(i * 1.7 + k * 13.3, k * 7.1 + i * 0.37);

// Área plana onde a cena acontece: retângulo [x0,x1]×[z0,z1] (+ margem suave).
export type Flat = { x0: number; x1: number; z0: number; z1: number; margin?: number };
const flatWeight = (x: number, z: number, f: Flat) => {
  const m = f.margin ?? 14;
  const dx = Math.max(f.x0 - x, 0, x - f.x1);
  const dz = Math.max(f.z0 - z, 0, z - f.z1);
  const d = Math.hypot(dx, dz);
  return Math.min(1, d / m);
};
export const terrainHeight = (x: number, z: number, flat: Flat, hills = 9) => {
  const w = smooth(flatWeight(x, z, flat));
  const far = Math.min(1, Math.hypot(x, z) / 160);
  return w * (fbm(x * 0.018 + 3, z * 0.018 + 7) * hills * (0.6 + far) - 0.3);
};

// ---------- céu ----------
export const SkyDome: React.FC<{ top?: string; horizon?: string; bottom?: string; radius?: number }> = ({
  top = "#4FA9E6",
  horizon = "#D8EEF8",
  bottom = "#CFE6EF",
  radius = 380,
}) => {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: { top: { value: new THREE.Color(top) }, hor: { value: new THREE.Color(horizon) }, bot: { value: new THREE.Color(bottom) } },
        vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0);} `,
        fragmentShader: `uniform vec3 top; uniform vec3 hor; uniform vec3 bot; varying vec3 vP;
          void main(){ float h = vP.y; vec3 c = h>0.0 ? mix(hor, top, pow(clamp(h*1.6,0.0,1.0),0.7)) : mix(hor, bot, clamp(-h*4.0,0.0,1.0)); gl_FragColor = vec4(c,1.0); }`,
      }),
    [top, horizon, bottom],
  );
  return (
    <mesh material={mat} renderOrder={-10} frustumCulled={false}>
      <sphereGeometry args={[radius, 32, 16]} />
    </mesh>
  );
};

// ---------- terreno ----------
export const Terrain: React.FC<{ flat: Flat; size?: number; seg?: number; hills?: number; colors?: [string, string, string]; y?: number }> = ({
  flat,
  size = 700,
  seg = 150,
  hills = 9,
  colors = ["#74B552", "#62A445", "#86C25E"],
  y = 0,
}) => {
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(size, size, seg, seg);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      pos.setY(i, terrainHeight(x, z, flat, hills));
    }
    const ng = g.toNonIndexed();
    ng.computeVertexNormals();
    const cols = new Float32Array(ng.attributes.position.count * 3);
    const cc = colors.map((c) => new THREE.Color(c));
    for (let f = 0; f < ng.attributes.position.count / 3; f++) {
      const r = rnd(f, 3);
      const c = r < 0.45 ? cc[0] : r < 0.8 ? cc[1] : cc[2];
      for (let k = 0; k < 3; k++) cols.set([c.r, c.g, c.b], (f * 3 + k) * 3);
    }
    ng.setAttribute("color", new THREE.BufferAttribute(cols, 3));
    return ng;
  }, [JSON.stringify(flat), size, seg, hills, colors.join()]);
  return (
    <mesh geometry={geo} position={[0, y, 0]} receiveShadow>
      <meshStandardMaterial vertexColors roughness={0.95} flatShading />
    </mesh>
  );
};

// ---------- floresta instanciada ----------
type TreeSpot = { x: number; z: number; s: number; k: number; r: number };
export const scatter = (n: number, seed: number, r0: number, r1: number, avoid: Flat, cx = 0, cz = 0, flat?: Flat) => {
  const out: TreeSpot[] = [];
  let i = 0;
  while (out.length < n && i < n * 20) {
    i++;
    const a = rnd(i, seed) * Math.PI * 2;
    const d = r0 + Math.sqrt(rnd(i, seed + 1)) * (r1 - r0);
    const x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
    if (x > avoid.x0 && x < avoid.x1 && z > avoid.z0 && z < avoid.z1) continue;
    if (flat && fbm(x * 0.05, z * 0.05) < 0.3) continue; // clareiras
    out.push({ x, z, s: 0.75 + rnd(i, seed + 2) * 0.7, k: rnd(i, seed + 3), r: rnd(i, seed + 4) * 6.28 });
  }
  return out;
};

const useInstances = (ref: React.RefObject<THREE.InstancedMesh | null>, spots: TreeSpot[], f: (s: TreeSpot, m: THREE.Object3D) => void, colors?: (s: TreeSpot) => string) => {
  useLayoutEffect(() => {
    const im = ref.current;
    if (!im) return;
    const o = new THREE.Object3D();
    spots.forEach((s, i) => {
      o.position.set(0, 0, 0);
      o.rotation.set(0, 0, 0);
      o.scale.set(1, 1, 1);
      f(s, o);
      o.updateMatrix();
      im.setMatrixAt(i, o.matrix);
      if (colors) im.setColorAt(i, new THREE.Color(colors(s)));
    });
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
  }, [spots]);
};

export const Forest: React.FC<{ spots: TreeSpot[]; flat: Flat; hills?: number; scale?: number }> = ({ spots, flat, hills = 9, scale = 1 }) => {
  const round = spots.filter((s) => s.k < 0.62);
  const pines = spots.filter((s) => s.k >= 0.62);
  const trunkR = useRef<THREE.InstancedMesh>(null);
  const crownA = useRef<THREE.InstancedMesh>(null);
  const crownB = useRef<THREE.InstancedMesh>(null);
  const trunkP = useRef<THREE.InstancedMesh>(null);
  const pineA = useRef<THREE.InstancedMesh>(null);
  const pineB = useRef<THREE.InstancedMesh>(null);
  const y = (s: TreeSpot) => terrainHeight(s.x, s.z, flat, hills);
  const leafs = ["#5DAA48", "#4E9A3E", "#6FBA52", "#7CC35A"];
  useInstances(trunkR, round, (s, o) => { o.position.set(s.x, y(s) + 1.1 * s.s * scale, s.z); o.scale.setScalar(s.s * scale); });
  useInstances(crownA, round, (s, o) => { o.position.set(s.x, y(s) + 3.0 * s.s * scale, s.z); o.rotation.set(s.r, s.r * 2, 0); o.scale.setScalar(s.s * scale * (0.9 + s.k * 0.3)); }, (s) => leafs[Math.floor(s.r * 10) % 4]);
  useInstances(crownB, round, (s, o) => { o.position.set(s.x + 0.7 * s.s * scale, y(s) + 2.4 * s.s * scale, s.z + 0.3); o.rotation.set(0, s.r, s.r); o.scale.setScalar(s.s * scale * 0.7); }, (s) => leafs[(Math.floor(s.r * 10) + 1) % 4]);
  useInstances(trunkP, pines, (s, o) => { o.position.set(s.x, y(s) + 0.8 * s.s * scale, s.z); o.scale.setScalar(s.s * scale); });
  useInstances(pineA, pines, (s, o) => { o.position.set(s.x, y(s) + 2.6 * s.s * scale, s.z); o.rotation.y = s.r; o.scale.setScalar(s.s * scale); }, (s) => (s.r > 3 ? "#3F8A45" : "#4A9A4E"));
  useInstances(pineB, pines, (s, o) => { o.position.set(s.x, y(s) + 3.8 * s.s * scale, s.z); o.rotation.y = s.r + 1; o.scale.setScalar(s.s * scale * 0.72); }, () => "#52A452");
  return (
    <group>
      <instancedMesh ref={trunkR} args={[undefined, undefined, round.length]} castShadow>
        <cylinderGeometry args={[0.16, 0.26, 2.2, 6]} />
        <meshStandardMaterial color={C.trunk} roughness={0.9} flatShading />
      </instancedMesh>
      <instancedMesh ref={crownA} args={[undefined, undefined, round.length]} castShadow>
        <icosahedronGeometry args={[1.5, 0]} />
        <meshStandardMaterial roughness={0.85} flatShading />
      </instancedMesh>
      <instancedMesh ref={crownB} args={[undefined, undefined, round.length]} castShadow>
        <icosahedronGeometry args={[1.2, 0]} />
        <meshStandardMaterial roughness={0.85} flatShading />
      </instancedMesh>
      <instancedMesh ref={trunkP} args={[undefined, undefined, pines.length]} castShadow>
        <cylinderGeometry args={[0.12, 0.18, 1.6, 6]} />
        <meshStandardMaterial color={C.trunk} roughness={0.9} flatShading />
      </instancedMesh>
      <instancedMesh ref={pineA} args={[undefined, undefined, pines.length]} castShadow>
        <coneGeometry args={[1.25, 2.6, 7]} />
        <meshStandardMaterial roughness={0.85} flatShading />
      </instancedMesh>
      <instancedMesh ref={pineB} args={[undefined, undefined, pines.length]} castShadow>
        <coneGeometry args={[1.0, 2.0, 7]} />
        <meshStandardMaterial roughness={0.85} flatShading />
      </instancedMesh>
    </group>
  );
};

// ---------- tufos de grama ----------
export const GrassTufts: React.FC<{ area: Flat; n?: number; seed?: number; avoid?: Flat[]; flat: Flat; hills?: number; y?: number }> = ({ area, n = 1800, seed = 5, avoid = [], flat, hills = 9, y = 0 }) => {
  const ref = useRef<THREE.InstancedMesh>(null);
  const geo = useMemo(() => {
    // três lâminas em leque
    const g = new THREE.BufferGeometry();
    const v: number[] = [];
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI + 0.3;
      const ca = Math.cos(a) * 0.06, sa = Math.sin(a) * 0.06;
      const lean = (k - 1) * 0.08;
      v.push(-ca, 0, -sa, ca, 0, sa, lean, 0.32 + k * 0.05, 0);
    }
    g.setAttribute("position", new THREE.Float32BufferAttribute(v, 3));
    g.computeVertexNormals();
    return g;
  }, []);
  const spots = useMemo(() => {
    const out: TreeSpot[] = [];
    let i = 0;
    while (out.length < n && i < n * 6) {
      i++;
      const x = area.x0 + rnd(i, seed) * (area.x1 - area.x0);
      const z = area.z0 + rnd(i, seed + 1) * (area.z1 - area.z0);
      if (avoid.some((a) => x > a.x0 && x < a.x1 && z > a.z0 && z < a.z1)) continue;
      out.push({ x, z, s: 0.7 + rnd(i, seed + 2) * 0.9, k: rnd(i, seed + 3), r: rnd(i, seed + 4) * 6.28 });
    }
    return out;
  }, [JSON.stringify(area), JSON.stringify(avoid), n, seed]);
  useInstances(ref, spots, (s, o) => { o.position.set(s.x, y + terrainHeight(s.x, s.z, flat, hills) - 0.01, s.z); o.rotation.y = s.r; o.scale.setScalar(s.s); }, (s) => (s.k < 0.5 ? "#5FA845" : s.k < 0.85 ? "#79BE57" : "#4C9338"));
  return (
    <instancedMesh ref={ref} args={[geo, undefined, spots.length]}>
      <meshStandardMaterial side={THREE.DoubleSide} roughness={0.9} />
    </instancedMesh>
  );
};

// ---------- casinhas distantes (bairro / cidade no horizonte) ----------
export const DistantTown: React.FC<{ center: [number, number]; n?: number; spread?: number; seed?: number; flat: Flat; hills?: number; tall?: number }> = ({ center, n = 40, spread = 40, seed = 9, flat, hills = 9, tall = 0 }) => {
  const items = useMemo(() => {
    const out: { x: number; z: number; w: number; d: number; h: number; c: string; r: number; roof: string }[] = [];
    const walls = ["#F2E8D8", "#E8D2B8", "#F6F1E7", "#D9C8B4", "#EFD9C4"];
    const roofs = ["#C9643A", "#B9573A", "#8E4A3A", "#6E6E78"];
    for (let i = 0; i < n; i++) {
      const x = center[0] + (rnd(i, seed) - 0.5) * spread * 2;
      const z = center[1] + (rnd(i, seed + 1) - 0.5) * spread;
      const isTall = rnd(i, seed + 5) < tall;
      out.push({ x, z, w: 3 + rnd(i, seed + 2) * 3, d: 3 + rnd(i, seed + 3) * 3, h: isTall ? 10 + rnd(i, seed + 6) * 26 : 2.6 + rnd(i, seed + 4) * 1.5, c: walls[i % 5], r: rnd(i, 2) * 0.6, roof: isTall ? "" : roofs[i % 4] });
    }
    return out;
  }, [center.join(), n, spread, seed, tall]);
  return (
    <group>
      {items.map((b, i) => {
        const y = terrainHeight(b.x, b.z, flat, hills);
        return (
          <group key={i} position={[b.x, y, b.z]} rotation={[0, b.r, 0]}>
            <mesh position={[0, b.h / 2, 0]}>
              <boxGeometry args={[b.w, b.h, b.d]} />
              <meshStandardMaterial color={b.c} roughness={0.9} />
            </mesh>
            {b.roof ? (
              <mesh position={[0, b.h + 0.9, 0]} rotation={[0, Math.PI / 4, 0]}>
                <coneGeometry args={[Math.max(b.w, b.d) * 0.78, 1.8, 4]} />
                <meshStandardMaterial color={b.roof} roughness={0.85} flatShading />
              </mesh>
            ) : null}
          </group>
        );
      })}
    </group>
  );
};

// ---------- nuvens fofas ----------
export const Clouds: React.FC<{ t: number; n?: number; seed?: number; height?: number; spread?: number; center?: [number, number] }> = ({ t, n = 18, seed = 11, height = 48, spread = 220, center = [0, -140] }) => (
  <group>
    {Array.from({ length: n }).map((_, i) => {
      const x = center[0] + (rnd(i, seed) - 0.5) * spread * 2 + t * 0.8;
      const z = center[1] + (rnd(i, seed + 1) - 0.5) * spread;
      const y = height + rnd(i, seed + 2) * 30;
      const s = 6 + rnd(i, seed + 3) * 8;
      return (
        <group key={i} position={[x, y, z]} scale={s}>
          {[
            [0, 0, 0, 1],
            [1.1, -0.15, 0.1, 0.78],
            [-1.05, -0.2, 0, 0.72],
            [0.45, 0.5, 0, 0.7],
            [-0.4, 0.35, 0.2, 0.6],
          ].map(([cx, cy, cz, r], k) => (
            <mesh key={k} position={[cx, cy, cz]}>
              <icosahedronGeometry args={[r, 1]} />
              <meshStandardMaterial color="#FFFFFF" emissive="#FFFFFF" emissiveIntensity={0.25} roughness={1} flatShading />
            </mesh>
          ))}
        </group>
      );
    })}
  </group>
);

// ---------- água animada (ondinhas + brilho) ----------
export const WaterSurface: React.FC<{ size: [number, number]; position: V3; t: number; color?: string; deep?: string; opacity?: number; amp?: number; seg?: number; rotation?: V3 }> = ({
  size,
  position,
  t,
  color = "#4FC0F2",
  deep = "#1E8ED6",
  opacity = 0.86,
  amp = 0.03,
  seg = 48,
  rotation = [-Math.PI / 2, 0, 0],
}) => {
  const ref = useRef<THREE.Mesh>(null);
  const geo = useMemo(() => new THREE.PlaneGeometry(size[0], size[1], seg, Math.max(2, Math.round((seg * size[1]) / size[0]))), [size.join(), seg]);
  const base = useMemo(() => Float32Array.from(geo.attributes.position.array as Float32Array), [geo]);
  useLayoutEffect(() => {
    const p = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const x = base[i * 3], y = base[i * 3 + 1];
      p.setZ(i, amp * (Math.sin(x * 2.2 + t * 2.4) + Math.sin(y * 2.9 - t * 1.9) * 0.7 + Math.sin((x + y) * 5.1 + t * 3.3) * 0.25));
    }
    p.needsUpdate = true;
    geo.computeVertexNormals();
  }, [t, geo]);
  const mat = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({ color, roughness: 0.08, metalness: 0.15, transparent: true, opacity, emissive: new THREE.Color(deep), emissiveIntensity: 0.25 });
    return m;
  }, [color, deep, opacity]);
  return <mesh ref={ref} geometry={geo} material={mat} position={position} rotation={rotation} receiveShadow />;
};

// ---------- chuva em traços ----------
export const RainStreaks: React.FC<{ t: number; amount: number; box: [number, number, number, number]; top?: number; floor?: number; n?: number }> = ({ t, amount, box, top = 14, floor = 0, n = 700 }) => {
  const ref = useRef<THREE.InstancedMesh>(null);
  const count = Math.round(n * Math.max(0, Math.min(1, amount)));
  useLayoutEffect(() => {
    const im = ref.current;
    if (!im) return;
    const o = new THREE.Object3D();
    for (let i = 0; i < count; i++) {
      const x = box[0] + rnd(i, 21) * (box[1] - box[0]);
      const z = box[2] + rnd(i, 22) * (box[3] - box[2]);
      const ph = (rnd(i, 23) + t * 1.6) % 1;
      o.position.set(x + ph * 0.6, top - ph * (top - floor), z);
      o.rotation.set(0, 0, 0.12);
      o.updateMatrix();
      im.setMatrixAt(i, o.matrix);
    }
    im.count = count;
    im.instanceMatrix.needsUpdate = true;
  }, [t, count]);
  if (count <= 0) return null;
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, n]} frustumCulled={false}>
      <boxGeometry args={[0.025, 0.55, 0.025]} />
      <meshBasicMaterial color="#DDEFFF" transparent opacity={0.55} depthWrite={false} />
    </instancedMesh>
  );
};

// ---------- texturas procedurais ----------
const texCache = new Map<string, THREE.Texture>();
export const brickTexture = (base = "#C4704A", mortar = "#E9DCCB", rows = 16, cols = 8) => {
  const key = `b${base}${mortar}${rows}${cols}`;
  if (texCache.has(key)) return texCache.get(key)!;
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 512;
  const g = c.getContext("2d")!;
  g.fillStyle = mortar;
  g.fillRect(0, 0, 512, 512);
  const bh = 512 / rows, bw = 512 / cols;
  for (let r = 0; r < rows; r++) {
    for (let k = -1; k < cols + 1; k++) {
      const x = k * bw + (r % 2 ? bw / 2 : 0);
      const v = (rnd(r * 31 + k, 4) - 0.5) * 22;
      const col = new THREE.Color(base);
      col.offsetHSL(0, 0, v / 255);
      g.fillStyle = `#${col.getHexString()}`;
      g.fillRect(x + 3, r * bh + 3, bw - 6, bh - 6);
    }
  }
  const tx = new THREE.CanvasTexture(c);
  tx.wrapS = tx.wrapT = THREE.RepeatWrapping;
  tx.colorSpace = THREE.SRGBColorSpace;
  texCache.set(key, tx);
  return tx;
};
export const tileTexture = (base = "#EAF6FA", line = "#BFD8E2", n = 8) => {
  const key = `t${base}${line}${n}`;
  if (texCache.has(key)) return texCache.get(key)!;
  const c = document.createElement("canvas");
  c.width = c.height = 512;
  const g = c.getContext("2d")!;
  g.fillStyle = line;
  g.fillRect(0, 0, 512, 512);
  const s = 512 / n;
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      const col = new THREE.Color(base);
      col.offsetHSL(0, 0, (rnd(i * 17 + j, 8) - 0.5) * 0.04);
      g.fillStyle = `#${col.getHexString()}`;
      g.fillRect(i * s + 2, j * s + 2, s - 4, s - 4);
    }
  const tx = new THREE.CanvasTexture(c);
  tx.wrapS = tx.wrapT = THREE.RepeatWrapping;
  tx.colorSpace = THREE.SRGBColorSpace;
  texCache.set(key, tx);
  return tx;
};
export const woodTexture = (base = "#B57A48") => {
  const key = `w${base}`;
  if (texCache.has(key)) return texCache.get(key)!;
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const g = c.getContext("2d")!;
  g.fillStyle = base;
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 40; i++) {
    const y = rnd(i, 3) * 256;
    const col = new THREE.Color(base);
    col.offsetHSL(0, 0, -0.06 - rnd(i, 5) * 0.06);
    g.strokeStyle = `#${col.getHexString()}`;
    g.lineWidth = 1 + rnd(i, 6) * 2;
    g.beginPath();
    for (let x = 0; x <= 256; x += 16) g.lineTo(x, y + Math.sin(x * 0.04 + i) * 3);
    g.stroke();
  }
  const tx = new THREE.CanvasTexture(c);
  tx.wrapS = tx.wrapT = THREE.RepeatWrapping;
  tx.colorSpace = THREE.SRGBColorSpace;
  texCache.set(key, tx);
  return tx;
};

// ---------- mundo completo pronto ----------
// Usa dentro de um Shot. `flat` = área plana da cena (quintal, obra).
export const World: React.FC<{
  t: number;
  flat: Flat;
  hills?: number;
  trees?: number;
  grass?: Flat;
  grassAvoid?: Flat[];
  town?: { center: [number, number]; n?: number; spread?: number; tall?: number };
  fog?: [string, number, number];
  sky?: { top?: string; horizon?: string };
  clouds?: boolean;
  ground?: boolean;
}> = ({ t, flat, hills = 9, trees = 420, grass, grassAvoid = [], town, fog = ["#D8EEF8", 70, 420], sky, clouds = true, ground = true }) => {
  const spots = useMemo(() => scatter(trees, 7, 20, 230, { x0: flat.x0 - 10, x1: flat.x1 + 10, z0: flat.z0 - 10, z1: flat.z1 + 10 }, 0, 0, flat), [trees, JSON.stringify(flat)]);
  return (
    <group>
      <fog attach="fog" args={fog} />
      <SkyDome top={sky?.top} horizon={sky?.horizon ?? fog[0]} bottom={fog[0]} />
      {ground ? <Terrain flat={flat} hills={hills} /> : null}
      <Forest spots={spots} flat={flat} hills={hills} />
      {grass ? <GrassTufts area={grass} avoid={grassAvoid} flat={flat} hills={hills} /> : null}
      {town ? <DistantTown center={town.center} n={town.n} spread={town.spread} tall={town.tall} flat={flat} hills={hills} /> : null}
      {clouds ? <Clouds t={t} /> : null}
    </group>
  );
};
