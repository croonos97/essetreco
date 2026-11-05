import { useThree } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { C } from "../theme";
import { RBox } from "./basics";
import { brickTexture, Clouds, DistantTown, Flat, Forest, GrassTufts, rnd, scatter, Terrain, tileTexture, woodTexture } from "./World";

// Cenário do vídeo "Como construir um telhado".
// O telhado é UM modelo paramétrico: tudo deriva de rpt() (ponto na superfície da água do telhado).

type V3 = [number, number, number];
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const pop = (p: number) => {
  if (p <= 0) return 0;
  if (p >= 1) return 1;
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2);
};
const mix = (a: string, b: string, p: number) => new THREE.Color(a).lerp(new THREE.Color(b), clamp01(p));

// ---------- geometria-base ----------
export const G = {
  B: 3.5, // meia largura externa da casa (x)
  O: 0.55, // beiral
  H: 2.6, // altura da parede
  A: 0.4538, // 26° de caimento
  Z: 3.45, // meia profundidade do telhado (z)
  WZ: 3.0, // meia profundidade da casa
  doorZ0: 0.35,
  doorZ1: 1.25,
  bedX: -2.3,
  bedZ: -1.0, // centro da cama (cabeceira na parede esquerda)
};
export const LS = (G.B + G.O) / Math.cos(G.A); // comprimento da água (cumeeira → beiral)
export type RoofSt = { p: number; sag: number };
export const roofY0 = (p: number) => G.H + 0.03 + 0.27 * p + G.B * Math.tan(G.A * p);
export const RIDGE = roofY0(1);
// ponto da superfície do telhado: lado s (±1), distância d ao longo da água a partir da cumeeira
export const rpt = (s: number, d: number, st: RoofSt, lift = 0) => {
  const a = G.A * st.p;
  const Y0 = roofY0(st.p);
  const xh = d * Math.cos(a);
  let y = Y0 - d * Math.sin(a);
  let dy = -Math.sin(a);
  const u = xh / G.B;
  if (u < 1 && st.sag > 0) {
    y -= st.sag * (1 - u * u);
    dy += ((st.sag * 2 * u) / G.B) * Math.cos(a);
  }
  const ang = Math.atan2(-dy, Math.cos(a));
  return { x: s * (xh + Math.sin(ang) * lift), y: y + Math.cos(ang) * lift, ang };
};
const place = (o: THREE.Object3D, s: number, d: number, z: number, st: RoofSt, lift: number, extra = 0) => {
  const r = rpt(s, d, st, lift);
  o.position.set(r.x, r.y, z);
  o.rotation.set(0, s > 0 ? 0 : Math.PI, -(r.ang + extra));
};

// ---------- texturas ----------
const useRep = (make: () => THREE.Texture, rx: number, ry: number) =>
  useMemo(() => {
    const t = make().clone();
    t.repeat.set(rx, ry);
    t.needsUpdate = true;
    return t;
  }, [rx, ry]);

const cache = new Map<string, THREE.Texture>();
const canvasTex = (key: string, w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) => {
  if (cache.has(key)) return cache.get(key)!;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d")!);
  const tx = new THREE.CanvasTexture(c);
  tx.wrapS = tx.wrapT = THREE.RepeatWrapping;
  tx.colorSpace = THREE.SRGBColorSpace;
  cache.set(key, tx);
  return tx;
};
// telhado visto de longe (vizinhos): fileiras de telha colonial
const roofTileTex = () =>
  canvasTex("roofTile", 256, 256, (g) => {
    g.fillStyle = "#A84A2A";
    g.fillRect(0, 0, 256, 256);
    for (let r = 0; r < 8; r++)
      for (let k = 0; k < 8; k++) {
        const x = k * 32, y = r * 32;
        const col = new THREE.Color("#D2683C").offsetHSL(0, 0, (rnd(r * 9 + k, 2) - 0.5) * 0.08);
        const grd = g.createLinearGradient(x, 0, x + 32, 0);
        grd.addColorStop(0, `#${col.clone().offsetHSL(0, 0, -0.12).getHexString()}`);
        grd.addColorStop(0.5, `#${col.getHexString()}`);
        grd.addColorStop(1, `#${col.clone().offsetHSL(0, 0, -0.14).getHexString()}`);
        g.fillStyle = grd;
        g.beginPath();
        g.roundRect(x + 1, y + 2, 30, 29, 10);
        g.fill();
        g.fillStyle = "rgba(60,20,10,0.35)";
        g.fillRect(x, y + 28, 32, 4);
      }
  });
// riscas de água escorrendo (para lâminas animadas)
const streakTex = (along: "u" | "v") =>
  canvasTex(`streak${along}`, 256, 256, (g) => {
    g.fillStyle = "#3a4a55";
    g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 70; i++) {
      const a = 40 + rnd(i, 3) * 215;
      g.fillStyle = `rgb(${a},${a},${a})`;
      const p = rnd(i, 4) * 256, q = rnd(i, 5) * 256, w = 2 + rnd(i, 6) * 5, l = 40 + rnd(i, 7) * 150;
      for (const o of [-256, 0, 256]) {
        if (along === "v") g.fillRect(p, q + o, w, l);
        else g.fillRect(q + o, p, l, w);
      }
    }
  });
const foilTex = () =>
  canvasTex("foil", 256, 256, (g) => {
    g.fillStyle = "#E9EEF2";
    g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 26; i++) {
      const a = 200 + rnd(i, 1) * 55;
      g.fillStyle = `rgb(${a},${a + 2},${a + 6})`;
      g.beginPath();
      const x = rnd(i, 2) * 256, y = rnd(i, 3) * 256;
      g.moveTo(x, y);
      g.lineTo(x + 60 + rnd(i, 4) * 80, y + 20);
      g.lineTo(x + 30, y + 50 + rnd(i, 5) * 40);
      g.fill();
    }
    g.fillStyle = "rgba(120,130,140,0.25)";
    for (let k = 0; k < 256; k += 32) g.fillRect(0, k, 256, 2);
  });

// ---------- materiais ----------
const BrickBox: React.FC<{ size: V3; position: V3; color?: string; rotation?: V3 }> = ({ size, position, color = "#C4704A", rotation }) => {
  const tex = useRep(() => brickTexture(color, "#E5D6C3"), Math.max(size[0], size[2]) / 2.4, size[1] / 1.6);
  return (
    <mesh position={position} rotation={rotation} castShadow receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial map={tex} roughness={0.92} />
    </mesh>
  );
};
const Plaster: React.FC<{ size: V3; position: V3; color?: string }> = ({ size, position, color = "#F3EADB" }) => (
  <mesh position={position} receiveShadow>
    <boxGeometry args={size} />
    <meshStandardMaterial color={color} roughness={0.95} />
  </mesh>
);
const Glass: React.FC<{ size: V3; position: V3 }> = ({ size, position }) => (
  <group position={position}>
    <mesh>
      <boxGeometry args={size} />
      <meshStandardMaterial color="#BFE6F7" roughness={0.1} metalness={0.2} transparent opacity={0.55} />
    </mesh>
    <RBox size={[size[0] + 0.1, 0.08, size[2] + 0.06]} position={[0, size[1] / 2, 0]} color="#FAFAF7" radius={0.02} />
    <RBox size={[size[0] + 0.1, 0.08, size[2] + 0.06]} position={[0, -size[1] / 2, 0]} color="#FAFAF7" radius={0.02} />
    <RBox size={[size[0] > size[2] ? 0.06 : size[0] + 0.06, size[1], size[0] > size[2] ? size[2] + 0.06 : 0.06]} color="#FAFAF7" radius={0.01} />
  </group>
);

// ---------- céu dinâmico ----------
export type Weather = { top: string; hor: string };
export const DynSky: React.FC<{ top: string; hor: string }> = ({ top, hor }) => {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: { top: { value: new THREE.Color() }, hor: { value: new THREE.Color() } },
        vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0);} `,
        fragmentShader: `uniform vec3 top; uniform vec3 hor; varying vec3 vP;
          void main(){ float h = vP.y; vec3 c = h>0.0 ? mix(hor, top, pow(clamp(h*1.6,0.0,1.0),0.7)) : hor; gl_FragColor = vec4(c,1.0); }`,
      }),
    [],
  );
  mat.uniforms.top.value.set(top);
  mat.uniforms.hor.value.set(hor);
  return (
    <mesh material={mat} renderOrder={-10} frustumCulled={false}>
      <sphereGeometry args={[380, 32, 16]} />
    </mesh>
  );
};

// ---------- bairro ----------
export const FLAT: Flat = { x0: -26, x1: 26, z0: -28, z1: 30, margin: 22 };
const NeighborHouse: React.FC<{ position: V3; rot?: number; w?: number; d?: number; wall?: string; h?: number }> = ({ position, rot = 0, w = 6.4, d = 6, wall = "#F2E3C9", h = 2.6 }) => {
  const tex = useRep(roofTileTex, 3, 2.2);
  const a = 0.46, half = w / 2 + 0.5, slope = half / Math.cos(a);
  const gable = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(-w / 2, 0);
    s.lineTo(w / 2, 0);
    s.lineTo(0, (w / 2) * Math.tan(a));
    s.closePath();
    return new THREE.ExtrudeGeometry(s, { depth: d - 0.02, bevelEnabled: false });
  }, [w, d]);
  return (
    <group position={position} rotation={[0, rot, 0]}>
      <mesh position={[0, h / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color={wall} roughness={0.9} />
      </mesh>
      <mesh geometry={gable} position={[0, h, -d / 2 + 0.01]}>
        <meshStandardMaterial color={wall} roughness={0.9} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[(s * half) / 2 - s * 0.03, h + (half / 2) * Math.tan(a) - 0.18, 0]} rotation={[0, 0, -s * a]} castShadow>
          <boxGeometry args={[slope, 0.12, d + 0.8]} />
          <meshStandardMaterial map={tex} roughness={0.8} />
        </mesh>
      ))}
      <mesh position={[0, h + (w / 2) * Math.tan(a) + 0.02, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.16, 0.16, d + 0.8, 8, 1, false, Math.PI / 2, Math.PI]} />
        <meshStandardMaterial color="#B2522E" roughness={0.8} side={THREE.DoubleSide} />
      </mesh>
      <RBox size={[0.9, 1.9, 0.08]} position={[w * 0.22, 0.95, d / 2 + 0.02]} color="#7A4A2A" radius={0.02} />
      <Glass size={[1.2, 0.9, 0.04]} position={[-w * 0.2, 1.45, d / 2 + 0.03]} />
    </group>
  );
};

const Pole: React.FC<{ x: number; z: number }> = ({ x, z }) => (
  <group position={[x, 0, z]}>
    <mesh position={[0, 3.6, 0]} castShadow>
      <cylinderGeometry args={[0.1, 0.14, 7.2, 8]} />
      <meshStandardMaterial color="#B9B5AC" roughness={0.9} />
    </mesh>
    <RBox size={[1.4, 0.1, 0.1]} position={[0, 6.6, 0]} color="#8E8A82" radius={0.02} />
  </group>
);
const Car: React.FC<{ position: V3; color?: string; rot?: number }> = ({ position, color = "#D9493A", rot = 0 }) => (
  <group position={position} rotation={[0, rot, 0]}>
    <RBox size={[3.6, 0.7, 1.6]} position={[0, 0.6, 0]} color={color} radius={0.18} />
    <RBox size={[2.0, 0.6, 1.45]} position={[-0.2, 1.15, 0]} color="#CFE6F2" radius={0.15} />
    {[-1.15, 1.15].map((x) =>
      [-0.78, 0.78].map((z) => (
        <mesh key={`${x}${z}`} position={[x, 0.32, z]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.32, 0.32, 0.22, 14]} />
          <meshStandardMaterial color={C.rubber} />
        </mesh>
      )),
    )}
  </group>
);
const BigTree: React.FC<{ position: V3; scale?: number }> = ({ position, scale = 1 }) => (
  <group position={position} scale={scale}>
    <mesh position={[0, 1.1, 0]} castShadow>
      <cylinderGeometry args={[0.16, 0.26, 2.2, 7]} />
      <meshStandardMaterial color={C.trunk} roughness={0.9} flatShading />
    </mesh>
    {[
      [0, 2.7, 0, 1.25, "#5DAA48"],
      [0.75, 2.3, 0.3, 0.9, "#6FBA52"],
      [-0.7, 2.4, -0.2, 0.95, "#4E9A3E"],
      [0.1, 3.4, -0.2, 0.85, "#7CC35A"],
      [-0.2, 2.2, 0.7, 0.8, "#5DAA48"],
    ].map(([x, y, z, r, c], i) => (
      <mesh key={i} position={[x as number, y as number, z as number]} castShadow>
        <icosahedronGeometry args={[r as number, 0]} />
        <meshStandardMaterial color={c as string} roughness={0.85} flatShading />
      </mesh>
    ))}
  </group>
);

export const Neighborhood: React.FC<{ t: number; sky: Weather; fog: string }> = ({ t, sky, fog }) => {
  const spots = useMemo(() => scatter(380, 7, 34, 230, { x0: FLAT.x0 - 6, x1: FLAT.x1 + 6, z0: FLAT.z0 - 6, z1: FLAT.z1 + 6 }, 0, 0, FLAT), []);
  const asphalt = useRep(() => tileTexture("#5E6168", "#55585E", 2), 10, 1);
  const walk = useRep(() => tileTexture("#D2CCC0", "#B9B2A5", 4), 12, 0.5);
  return (
    <group>
      <fog attach="fog" args={[fog, 60, 380]} />
      <DynSky top={sky.top} hor={sky.hor} />
      <Terrain flat={FLAT} hills={10} />
      <Forest spots={spots} flat={FLAT} hills={10} />
      <GrassTufts
        area={{ x0: -11, x1: 11, z0: -9.5, z1: 8.4 }}
        n={2200}
        avoid={[{ x0: -3.9, x1: 4.6, z0: -3.5, z1: 3.6 }, { x0: 0.0, x1: 1.6, z0: 3.6, z1: 8.5 }, { x0: 3.6, x1: 10.2, z0: 3.4, z1: 8.6 }]}
        flat={FLAT}
        hills={10}
      />
      <DistantTown center={[0, -110]} n={70} spread={110} flat={FLAT} hills={10} />
      <DistantTown center={[-110, 30]} n={30} spread={50} seed={4} flat={FLAT} hills={10} />
      <DistantTown center={[110, 60]} n={26} spread={50} seed={6} flat={FLAT} hills={10} />
      <Clouds t={t} n={16} height={52} />
      {/* rua, calçada, fiação */}
      <mesh position={[0, 0.02, 13]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[80, 6]} />
        <meshStandardMaterial map={asphalt} roughness={0.95} />
      </mesh>
      {[-30, -18, -6, 6, 18, 30].map((x) => (
        <mesh key={x} position={[x, 0.03, 13]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[3, 0.18]} />
          <meshStandardMaterial color="#F2E6A6" />
        </mesh>
      ))}
      {[9.4, 16.6].map((z) => (
        <mesh key={z} position={[0, 0.06, z]} receiveShadow>
          <boxGeometry args={[80, 0.12, 1.4]} />
          <meshStandardMaterial map={walk} roughness={0.95} />
        </mesh>
      ))}
      {[-16, 13].map((x) => (
        <Pole key={x} x={x} z={9.2} />
      ))}
      <Car position={[-20, 0, 12]} />
      <Car position={[13, 0, 14.2]} color="#3E6FB0" rot={Math.PI} />
      {/* vizinhos (telhados laranja = spoiler) */}
      <NeighborHouse position={[-13, 0, 23]} rot={Math.PI} wall="#F4E7CF" />
      <NeighborHouse position={[-3, 0, 23.5]} rot={Math.PI} wall="#E9D3B6" w={7} />
      <NeighborHouse position={[7, 0, 23]} rot={Math.PI} wall="#F6F0E4" />
      <NeighborHouse position={[17, 0, 23.5]} rot={Math.PI} wall="#EBD9C2" w={6.8} />
      <NeighborHouse position={[-19.5, 0, -1]} rot={Math.PI / 2} wall="#EFE1CB" />
      <NeighborHouse position={[19.5, 0, 0]} rot={-Math.PI / 2} wall="#F2E8D8" w={7} />
      <NeighborHouse position={[-9, 0, -20]} wall="#E8D2B8" />
      <NeighborHouse position={[7, 0, -20]} wall="#F6F1E7" w={7.2} />
      {/* muro do lote */}
      <BrickBox size={[22.4, 1.6, 0.24]} position={[0, 0.8, -9.7]} />
      <BrickBox size={[0.24, 1.6, 18.4]} position={[-11.1, 0.8, -0.5]} />
      <BrickBox size={[0.24, 1.6, 18.4]} position={[11.1, 0.8, -0.5]} />
      <BrickBox size={[10.4, 1.0, 0.24]} position={[-5.9, 0.5, 8.6]} />
      <BrickBox size={[9.2, 1.0, 0.24]} position={[6.5, 0.5, 8.6]} />
      {/* caminho */}
      {Array.from({ length: 7 }).map((_, i) => (
        <RBox key={i} size={[1.0, 0.06, 0.6]} position={[0.8 + (i > 4 ? (i - 4) * 1.1 : 0), 0.04, 8.0 - Math.min(i, 4) * 1.1 - (i > 4 ? 4.4 : 0)]} color="#CFC8BB" radius={0.02} cast={false} />
      ))}
      <BigTree position={[-7.6, 0, -5.2]} scale={1.7} />
      <BigTree position={[8.6, 0, -6.8]} scale={1.3} />
      {[
        [-10, 7.4], [-8.6, 7.6], [9.6, 7.5], [10.2, 4], [-10.2, -8.6], [-4, -8.8], [3, -8.8],
      ].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.35, z]} castShadow>
          <icosahedronGeometry args={[0.6 + rnd(i, 3) * 0.3, 0]} />
          <meshStandardMaterial color={i % 2 ? "#4E9A3E" : "#62AC4A"} flatShading roughness={0.85} />
        </mesh>
      ))}
    </group>
  );
};

// ---------- casa (paredes em corte + interior) ----------
const Bed: React.FC<{ wet: number }> = ({ wet }) => {
  const cx = G.bedX, z = G.bedZ;
  return (
    <group>
      <RBox size={[2.15, 0.32, 1.5]} position={[cx, 0.32, z]} color="#9A6238" radius={0.04} />
      <RBox size={[2.05, 0.22, 1.42]} position={[cx, 0.58, z]} color="#F7F5EE" radius={0.08} />
      <RBox size={[1.35, 0.08, 1.46]} position={[cx + 0.35, 0.7, z]} color="#5B8FD6" radius={0.04} />
      <RBox size={[0.42, 0.16, 1.0]} position={[cx - 0.81, 0.77, z]} color="#FFFFFF" radius={0.07} />
      <RBox size={[0.12, 0.95, 1.56]} position={[cx - 1.13, 0.6, z]} color="#8A5530" radius={0.04} />
      <RBox size={[0.45, 0.55, 0.5]} position={[cx - 0.9, 0.4, z - 1.05]} color="#B98252" radius={0.04} />
      <mesh position={[cx - 0.9, 0.82, z - 1.05]}>
        <cylinderGeometry args={[0.1, 0.14, 0.3, 10]} />
        <meshStandardMaterial color="#F2D9A0" emissive="#FFD58A" emissiveIntensity={0.3} />
      </mesh>
      {wet > 0.01 ? (
        <mesh position={[cx + 0.05, 0.745, z + 0.42]} rotation={[-Math.PI / 2, 0, 0]} scale={wet}>
          <circleGeometry args={[0.32, 20]} />
          <meshStandardMaterial color="#2C5FA8" roughness={0.3} transparent opacity={0.8} />
        </mesh>
      ) : null}
    </group>
  );
};
const Living: React.FC = () => (
  <group>
    {/* sofá */}
    <group position={[1.5, 0, -2.25]}>
      <RBox size={[2.2, 0.42, 0.9]} position={[0, 0.32, 0]} color="#5E7F86" radius={0.1} />
      <RBox size={[2.2, 0.6, 0.25]} position={[0, 0.7, -0.33]} color="#577980" radius={0.1} />
      <RBox size={[0.25, 0.55, 0.9]} position={[-1.12, 0.45, 0]} color="#577980" radius={0.1} />
      <RBox size={[0.25, 0.55, 0.9]} position={[1.12, 0.45, 0]} color="#577980" radius={0.1} />
      <RBox size={[0.42, 0.36, 0.14]} position={[-0.6, 0.72, -0.15]} color="#F2C230" radius={0.06} />
    </group>
    {/* tapete, mesinha, TV, planta */}
    <mesh position={[1.4, 0.135, -0.6]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[2.4, 1.6]} />
      <meshStandardMaterial color="#D98C5F" roughness={1} />
    </mesh>
    <RBox size={[1.0, 0.32, 0.55]} position={[1.4, 0.3, -0.75]} color="#B98252" radius={0.03} />
    <RBox size={[1.7, 0.45, 0.4]} position={[1.6, 0.35, 1.95]} color="#8A5530" radius={0.03} />
    <RBox size={[1.3, 0.75, 0.07]} position={[1.6, 1.0, 2.05]} color="#1E2126" radius={0.03} emissive="#2B5C8A" emissiveIntensity={0.25} />
    <mesh position={[2.95, 0.35, -2.4]}>
      <cylinderGeometry args={[0.2, 0.15, 0.45, 10]} />
      <meshStandardMaterial color="#E0D6C8" />
    </mesh>
    <mesh position={[2.95, 0.85, -2.4]} castShadow>
      <icosahedronGeometry args={[0.38, 0]} />
      <meshStandardMaterial color="#4E9A3E" flatShading />
    </mesh>
  </group>
);

export const House: React.FC<{ wetBed: number; front: number; gableBack: number; gableFront: number; puddles: number }> = ({ wetBed, front, gableBack, gableFront, puddles }) => {
  const B = G.B, H = G.H, Wz = G.WZ, T = 0.2;
  const floorTex = useRep(() => tileTexture("#E9DCC6", "#CDBEA4", 8), 3, 3);
  const gable = useMemo(() => {
    const s = new THREE.Shape();
    const top = rpt(1, 0, { p: 1, sag: 0 }, -0.3).y - H;
    s.moveTo(-B, 0);
    s.lineTo(B, 0);
    s.lineTo(0, top);
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: T, bevelEnabled: false });
    return g;
  }, []);
  const gTex = useRep(() => brickTexture("#C4704A", "#E5D6C3"), 1 / 2.4, 1 / 1.6);
  return (
    <group>
      {/* piso */}
      <mesh position={[0, 0.06, 0]} receiveShadow castShadow>
        <boxGeometry args={[2 * B + 0.1, 0.12, 2 * Wz + 0.1]} />
        <meshStandardMaterial color="#BDB6AA" />
      </mesh>
      <mesh position={[0, 0.125, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[2 * B - 0.3, 2 * Wz - 0.3]} />
        <meshStandardMaterial map={floorTex} roughness={0.6} />
      </mesh>
      {/* parede do fundo com janela */}
      <BrickBox size={[2 * B, H, T]} position={[0, H / 2, -Wz + T / 2]} />
      <Plaster size={[3.2, H - 0.05, 0.02]} position={[-2.0, H / 2, -Wz + T + 0.01]} color="#D6E6EF" />
      <Plaster size={[4.0, H - 0.05, 0.02]} position={[1.4, H / 2, -Wz + T + 0.01]} />
      {/* esquerda (quarto) com janela */}
      <BrickBox size={[T, H, 2 * Wz]} position={[-B + T / 2, H / 2, 0]} />
      <Plaster size={[0.02, H - 0.05, 2 * Wz - 0.4]} position={[-B + T + 0.01, H / 2, 0]} color="#D6E6EF" />
      <Glass size={[0.06, 0.9, 1.1]} position={[-B + T + 0.03, 1.55, -0.3]} />
      {/* direita (sala) com porta */}
      <BrickBox size={[T, H, Wz + G.doorZ0]} position={[B - T / 2, H / 2, (-Wz + G.doorZ0) / 2]} />
      <BrickBox size={[T, H, Wz - G.doorZ1]} position={[B - T / 2, H / 2, (Wz + G.doorZ1) / 2]} />
      <BrickBox size={[T, H - 2.1, G.doorZ1 - G.doorZ0]} position={[B - T / 2, 2.1 + (H - 2.1) / 2, (G.doorZ0 + G.doorZ1) / 2]} />
      <Plaster size={[0.02, H - 0.05, Wz + G.doorZ0 - 0.2]} position={[B - T - 0.01, H / 2, (-Wz + G.doorZ0) / 2 + 0.1]} />
      <RBox size={[0.08, 2.1, 0.06]} position={[B - 0.1, 1.05, G.doorZ0 - 0.03]} color="#FAFAF7" radius={0.01} />
      <RBox size={[0.08, 2.1, 0.06]} position={[B - 0.1, 1.05, G.doorZ1 + 0.03]} color="#FAFAF7" radius={0.01} />
      <RBox size={[0.06, 2.05, 0.88]} position={[B - 0.15, 1.05, G.doorZ0 - 0.4]} rotation={[0, -1.2, 0]} color="#8A5530" radius={0.02} />
      {/* divisória */}
      <Plaster size={[0.12, H, 2 * Wz - 0.4 - 1.0]} position={[-0.6, H / 2, -0.7]} color="#EFE6D6" />
      <Plaster size={[0.12, H - 2.1, 1.0]} position={[-0.6, 2.1 + (H - 2.1) / 2, Wz - 0.7]} color="#EFE6D6" />
      {/* cortes: topo das paredes em tijolo à mostra */}
      <Bed wet={wetBed} />
      <Living />
      {/* poças no chão (frestas) */}
      {puddles > 0.01
        ? [
            [1.0, 0.4, 0.5],
            [2.2, -0.4, 0.35],
            [0.3, -1.3, 0.3],
          ].map(([x, z, r], i) => (
            <mesh key={i} position={[x, 0.135, z]} rotation={[-Math.PI / 2, 0, 0]} scale={clamp01(puddles * 1.5 - i * 0.25)}>
              <circleGeometry args={[r, 20]} />
              <meshStandardMaterial color="#4FA8E8" roughness={0.1} transparent opacity={0.75} />
            </mesh>
          ))
        : null}
      {/* parede da frente (só no final) */}
      {front > 0.001 ? (
        <group position={[0, 0, Wz - T / 2]} scale={[1, front, 1]}>
          <BrickBox size={[2.6, H, T]} position={[-B + 1.3, H / 2, 0]} />
          <BrickBox size={[2.5, H, T]} position={[B - 1.25, H / 2, 0]} />
          <BrickBox size={[2.4, 0.9, T]} position={[0, 0.45, 0]} />
          <BrickBox size={[2.4, 0.5, T]} position={[0, H - 0.25, 0]} />
          <Glass size={[2.3, 1.2, 0.06]} position={[0, 1.5, 0.06]} />
        </group>
      ) : null}
      {gableBack > 0.001 ? (
        <mesh geometry={gable} position={[0, H, -Wz]} scale={[1, gableBack, 1]} castShadow>
          <meshStandardMaterial map={gTex} roughness={0.92} />
        </mesh>
      ) : null}
      {gableFront > 0.001 ? (
        <mesh geometry={gable} position={[0, H, Wz - T]} scale={[1, gableFront, 1]} castShadow>
          <meshStandardMaterial map={gTex} roughness={0.92} />
        </mesh>
      ) : null}
    </group>
  );
};

// ---------- tábuas (instanciadas, segmentadas para poder envergar) ----------
const NB = 23; // tábuas ao longo de z
const SEG = 6;
export const boardZ = (i: number) => -G.Z + 0.15 + i * 0.3;
export const Boards: React.FC<{ t: number; st: RoofSt; drop: (i: number) => number; gone: (i: number) => number; glow: number; wet: number }> = ({ t, st, drop, gone, glow, wet }) => {
  const ref = useRef<THREE.InstancedMesh>(null);
  const tex = useRep(() => woodTexture("#B98048"), 2, 0.5);
  const geo = useMemo(() => new THREE.BoxGeometry(LS / SEG + 0.004, 0.05, 0.245), []);
  useLayoutEffect(() => {
    const im = ref.current!;
    const o = new THREE.Object3D();
    let n = 0;
    for (let i = 0; i < NB; i++) {
      const q = drop(i);
      const g = gone(i);
      for (const s of [1, -1])
        for (let k = 0; k < SEG; k++) {
          if (q <= 0 || g >= 1) {
            o.scale.setScalar(0);
          } else {
            const d = (k + 0.5) * (LS / SEG);
            place(o, s, d, boardZ(i), st, -0.025);
            const fall = (1 - q * q) * 1.4;
            o.position.y += fall + g * 2.2;
            o.position.x += s * g * 1.5;
            o.rotation.z += (1 - q) * 0.25 * s + g * s * 0.8;
            o.scale.setScalar(1 - g);
          }
          o.updateMatrix();
          im.setMatrixAt(n++, o.matrix);
        }
    }
    im.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={ref} args={[geo, undefined, NB * 2 * SEG]} castShadow receiveShadow frustumCulled={false}>
      <meshStandardMaterial map={tex} roughness={0.8 - wet * 0.5} color={wet > 0 ? "#D9C2A8" : "#FFFFFF"} emissive="#FFB347" emissiveIntensity={glow * 0.7} />
    </instancedMesh>
  );
};

// ---------- telhas coloniais (capa + canal) ----------
const NR = 12;
const NC = 26;
const LT = 0.46;
const EXP = 0.36;
export const tileD = (r: number) => LS + 0.06 - LT / 2 - r * EXP;
type TileInfo = { s: number; r: number; c: number; kind: 0 | 1; z: number; k: number; slide: boolean };
const TILES: TileInfo[] = (() => {
  const out: TileInfo[] = [];
  for (const s of [1, -1])
    for (let r = 0; r < NR; r++) {
      for (let c = 0; c < NC; c++) out.push({ s, r, c, kind: 0, z: -3.375 + c * 0.27, k: rnd(out.length, 41), slide: false });
      for (let c = 0; c < NC - 1; c++) out.push({ s, r, c, kind: 1, z: -3.375 + c * 0.27 + 0.135, k: rnd(out.length, 41), slide: false });
    }
  out.forEach((ti, i) => (ti.slide = ti.s > 0 && ti.r < 10 && rnd(i, 77) < 0.5 && ti.c > 2));
  return out;
})();
export type TileAnim = {
  layStart: number;
  layDur: number;
  slideStart: number;
  slideSpread: number;
  backStart: number; // telhas caídas voltam
  liftUp: [number, number]; // sobem (troca)
  liftDown: [number, number]; // descem e encaixam
  heat: number;
  glow: number;
};
const tileGeo = (kind: 0 | 1) => {
  const g = new THREE.CylinderGeometry(kind ? 0.12 : 0.13, kind ? 0.1 : 0.115, LT, 9, 1, true, kind ? Math.PI : 0, Math.PI);
  g.rotateZ(-Math.PI / 2);
  return g;
};
const slidePose = (ti: TileInfo, d: number, t: number, a: TileAnim, st: RoofSt, lift: number, o: THREE.Object3D, idx: number) => {
  // devolve true se a telha está fora da posição (deslizando/caída/voltando)
  const ts = a.slideStart + rnd(idx, 13) * a.slideSpread;
  if (!ti.slide || t < ts) return false;
  const acc = 1.5;
  const edge = LS + 0.2;
  const groundPose = (tt: number) => {
    const tau = tt - ts;
    const dd = d + acc * tau * tau;
    if (dd < edge) {
      place(o, 1, dd, ti.z, st, lift, 0.05 + Math.sin(tau * 9) * 0.02);
      return;
    }
    const te = Math.sqrt((edge - d) / acc);
    const v = 2 * acc * te;
    const tf = tau - te;
    const P = rpt(1, edge, st, lift);
    const ca = Math.cos(P.ang), sa = Math.sin(P.ang);
    const y0 = P.y;
    const tl = (-v * sa + Math.sqrt(v * v * sa * sa + 4 * 4.9 * (y0 - 0.1))) / (2 * 4.9);
    const tt2 = Math.min(tf, tl);
    o.position.set(P.x + v * ca * tt2, y0 - v * sa * tt2 - 4.9 * tt2 * tt2, ti.z + (rnd(idx, 5) - 0.5) * tt2 * 0.8);
    o.rotation.set(rnd(idx, 6) * tt2 * 3, 0, -(P.ang + tt2 * (3 + rnd(idx, 7) * 4)));
    if (tf >= tl) o.rotation.set(Math.PI * Math.round(rnd(idx, 8)), rnd(idx, 9) * 3, 0);
  };
  const tb = a.backStart + rnd(idx, 14) * 0.6;
  if (t < tb) {
    groundPose(t);
    return true;
  }
  const back = clamp01((t - tb) / 0.55);
  groundPose(tb);
  const p0 = o.position.clone();
  const r0 = o.rotation.clone();
  place(o, 1, d, ti.z, st, lift);
  const e = back * back * (3 - 2 * back);
  o.position.set(p0.x + (o.position.x - p0.x) * e, p0.y + (o.position.y - p0.y) * e + Math.sin(Math.PI * e) * 1.4, p0.z + (o.position.z - p0.z) * e);
  o.rotation.set(r0.x * (1 - e), r0.y * (1 - e), r0.z + (o.rotation.z - r0.z) * e);
  return true;
};
export const Tiles: React.FC<{ t: number; st: RoofSt; a: TileAnim }> = ({ t, st, a }) => {
  const refs = [useRef<THREE.InstancedMesh>(null), useRef<THREE.InstancedMesh>(null)];
  const lugRef = useRef<THREE.InstancedMesh>(null);
  const geos = useMemo(() => [tileGeo(0), tileGeo(1)], []);
  const lists = useMemo(() => [TILES.filter((x) => x.kind === 0), TILES.filter((x) => x.kind === 1)], []);
  const lugs = useMemo(() => TILES.filter((x) => x.kind === 0 && x.c === NC - 1), []);
  const mats = useMemo(
    () =>
      [0, 1].map(
        () => new THREE.MeshStandardMaterial({ roughness: 0.62, side: THREE.DoubleSide, emissive: new THREE.Color("#FF3A0A"), emissiveIntensity: 0 }),
      ),
    [],
  );
  const liftOf = (ti: TileInfo) => {
    const up = clamp01((t - a.liftUp[0]) / (a.liftUp[1] - a.liftUp[0]));
    const dn0 = a.liftDown[0] + (ti.r / NR) * 0.25 + (ti.s < 0 ? 0.1 : 0);
    const dn = clamp01((t - dn0) / (a.liftDown[1] - a.liftDown[0]));
    return 0.75 * (up * up * (3 - 2 * up)) * (1 - dn * dn);
  };
  useLayoutEffect(() => {
    const o = new THREE.Object3D();
    const col = new THREE.Color();
    [0, 1].forEach((kind) => {
      const im = refs[kind].current!;
      lists[kind].forEach((ti, i) => {
        const idx = kind * 1000 + i;
        const T0 = a.layStart + (ti.r / (NR - 1)) * a.layDur * 0.72 + (ti.c / NC) * a.layDur * 0.18 + (ti.s < 0 ? 0.12 : 0) + kind * 0.06;
        const q = clamp01((t - T0) / 0.32);
        o.scale.setScalar(1);
        const d = tileD(ti.r);
        const lift = (kind ? 0.135 : 0.135) + liftOf(ti);
        if (q <= 0) o.scale.setScalar(0);
        else if (!slidePose(ti, d, t, a, st, lift, o, idx)) {
          place(o, ti.s, d, ti.z, st, lift + (1 - Math.min(1, pop(q))) * 1.3, 0.055);
        }
        o.updateMatrix();
        im.setMatrixAt(i, o.matrix);
        const base = kind ? "#D46C3C" : "#BF5A33";
        col.set(base).offsetHSL((ti.k - 0.5) * 0.02, 0, (ti.k - 0.5) * 0.12);
        if (a.heat > 0) col.lerp(new THREE.Color(kind ? "#FF4A1A" : "#F2300E"), a.heat * (0.8 + ti.k * 0.2));
        im.setColorAt(i, col);
      });
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
      mats[kind].emissiveIntensity = a.heat * 0.75 + a.glow * 0.5;
      mats[kind].emissive.set(a.glow > a.heat ? "#FFB347" : "#FF3A0A");
    });
    const lm = lugRef.current!;
    lugs.forEach((ti, i) => {
      const d = tileD(ti.r) - LT / 2 + 0.055;
      const T0 = a.layStart + (ti.r / (NR - 1)) * a.layDur * 0.72 + (ti.c / NC) * a.layDur * 0.18 + (ti.s < 0 ? 0.12 : 0);
      const q = clamp01((t - T0) / 0.32);
      if (q <= 0) o.scale.setScalar(0);
      else {
        o.scale.setScalar(1);
        place(o, ti.s, d, ti.z, st, -0.012 + liftOf(ti) + (1 - Math.min(1, pop(q))) * 1.3, 0.055);
      }
      o.updateMatrix();
      lm.setMatrixAt(i, o.matrix);
    });
    lm.instanceMatrix.needsUpdate = true;
  });
  return (
    <group>
      {[0, 1].map((k) => (
        <instancedMesh key={k} ref={refs[k]} args={[geos[k], mats[k], lists[k].length]} castShadow receiveShadow frustumCulled={false} />
      ))}
      <instancedMesh ref={lugRef} args={[undefined, undefined, lugs.length]} frustumCulled={false}>
        <boxGeometry args={[0.05, 0.075, 0.12]} />
        <meshStandardMaterial color="#A84A2A" roughness={0.7} />
      </instancedMesh>
    </group>
  );
};

// ---------- ripas ----------
export const Battens: React.FC<{ st: RoofSt; appear: (r: number, s: number) => number; glow: number }> = ({ st, appear, glow }) => {
  const ref = useRef<THREE.InstancedMesh>(null);
  const tex = useRep(() => woodTexture("#C7915A"), 0.3, 4);
  useLayoutEffect(() => {
    const o = new THREE.Object3D();
    let n = 0;
    for (const s of [1, -1])
      for (let r = 0; r < NR; r++) {
        const q = appear(r, s);
        if (q <= 0) o.scale.setScalar(0);
        else {
          o.scale.setScalar(1);
          place(o, s, tileD(r) - LT / 2 + 0.115, 0, st, -0.025 + (1 - Math.min(1, pop(q))) * 1.2);
        }
        o.updateMatrix();
        ref.current!.setMatrixAt(n++, o.matrix);
      }
    ref.current!.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, NR * 2]} castShadow frustumCulled={false}>
      <boxGeometry args={[0.07, 0.05, 2 * G.Z + 0.1]} />
      <meshStandardMaterial map={tex} roughness={0.8} emissive="#FFB347" emissiveIntensity={glow * 0.9} />
    </instancedMesh>
  );
};

// ---------- tesouras ----------
export const TRUSS_Z = [-2.85, -1.71, -0.57, 0.57, 1.71, 2.85];
const Beam: React.FC<{ a: [number, number]; b: [number, number]; z: number; q: number; glow: number; tex: THREE.Texture; w?: number; h?: number }> = ({ a, b, z, q, glow, tex, w = 0.08, h = 0.15 }) => {
  if (q <= 0) return null;
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
  const drop = (1 - Math.min(1, pop(q))) * 1.6;
  return (
    <mesh position={[(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - drop, z + drop * 0.6]} rotation={[0, 0, ang]} castShadow receiveShadow>
      <boxGeometry args={[len, h, w]} />
      <meshStandardMaterial map={tex} roughness={0.8} emissive="#FFB347" emissiveIntensity={glow * 0.8 + (q < 1 ? (1 - q) * 0.6 : 0)} />
    </mesh>
  );
};
export const Trusses: React.FC<{ piece: (k: number, j: number) => number; glow: number }> = ({ piece, glow }) => {
  const tex = useRep(() => woodTexture("#C38A52"), 2, 0.3);
  const st = { p: 1, sag: 0 };
  const eaveL = rpt(-1, LS, st, -0.13), eaveR = rpt(1, LS, st, -0.13), ridge = rpt(1, 0.02, st, -0.13);
  const yb = G.H + 0.08;
  const midR = rpt(1, LS * 0.45, st, -0.2), midL = rpt(-1, LS * 0.45, st, -0.2);
  return (
    <group>
      {TRUSS_Z.map((z, k) => (
        <group key={k}>
          <Beam a={[-G.B - 0.05, yb]} b={[G.B + 0.05, yb]} z={z} q={piece(k, 0)} glow={glow} tex={tex} />
          <Beam a={[eaveL.x, eaveL.y]} b={[0, ridge.y]} z={z} q={piece(k, 1)} glow={glow} tex={tex} />
          <Beam a={[0, ridge.y]} b={[eaveR.x, eaveR.y]} z={z} q={piece(k, 2)} glow={glow} tex={tex} />
          <Beam a={[0, yb]} b={[0, ridge.y]} z={z} q={piece(k, 3)} glow={glow} tex={tex} w={0.09} h={0.14} />
          <Beam a={[0, yb + 0.1]} b={[midL.x, midL.y]} z={z} q={piece(k, 4)} glow={glow} tex={tex} w={0.07} h={0.11} />
          <Beam a={[0, yb + 0.1]} b={[midR.x, midR.y]} z={z} q={piece(k, 5)} glow={glow} tex={tex} w={0.07} h={0.11} />
        </group>
      ))}
      {/* terça de cumeeira */}
      {piece(5, 5) > 0 ? (
        <mesh position={[0, ridge.y - 0.02, 0]} castShadow>
          <boxGeometry args={[0.1, 0.12, 2 * G.Z]} />
          <meshStandardMaterial map={tex} roughness={0.8} />
        </mesh>
      ) : null}
    </group>
  );
};

// ---------- cumeeira ----------
export const RidgeCap: React.FC<{ q: (i: number) => number; glow: number; heat: number }> = ({ q, glow, heat }) => {
  const n = 19;
  const geo = useMemo(() => {
    const g = new THREE.CylinderGeometry(0.21, 0.19, 0.44, 12, 1, true, Math.PI / 2, Math.PI);
    g.rotateX(Math.PI / 2);
    return g;
  }, []);
  const y = RIDGE + 0.12;
  return (
    <group>
      {Array.from({ length: n }).map((_, i) => {
        const p = q(i);
        if (p <= 0) return null;
        const drop = (1 - Math.min(1, pop(p))) * 2.2;
        return (
          <mesh key={i} geometry={geo} position={[0, y + drop, -G.Z + 0.2 + i * 0.37]} rotation={[0.04, 0, 0]} castShadow>
            <meshStandardMaterial
              color={mix("#C9643A", "#FF5522", heat)}
              roughness={0.6}
              side={THREE.DoubleSide}
              emissive={glow > heat ? "#FFB347" : "#FF3A0A"}
              emissiveIntensity={Math.max(glow * 0.9, heat * 0.5)}
            />
          </mesh>
        );
      })}
    </group>
  );
};

// ---------- água animada (lâmina com riscas) ----------
export const FlowSheet: React.FC<{ size: [number, number]; position: V3; rotation?: V3; t: number; speed: number; along: "u" | "v"; opacity: number; color?: string; rep?: [number, number] }> = ({
  size,
  position,
  rotation,
  t,
  speed,
  along,
  opacity,
  color = "#8FD3FF",
  rep = [2, 2],
}) => {
  const tex = useMemo(() => {
    const x = streakTex(along).clone();
    x.repeat.set(rep[0], rep[1]);
    x.needsUpdate = true;
    return x;
  }, [along, rep.join()]);
  if (opacity <= 0.01) return null;
  if (along === "v") tex.offset.set(0, t * speed);
  else tex.offset.set(-t * speed, 0);
  return (
    <mesh position={position} rotation={rotation}>
      <planeGeometry args={size} />
      <meshStandardMaterial color={color} alphaMap={tex} transparent opacity={opacity} depthWrite={false} roughness={0.1} side={THREE.DoubleSide} emissive="#5FB8F0" emissiveIntensity={0.35} />
    </mesh>
  );
};
// água escorrendo pelas duas águas do telhado
export const RoofFlow: React.FC<{ t: number; st: RoofSt; amount: number; lift?: number }> = ({ t, st, amount, lift = 0.03 }) => {
  if (amount <= 0.01) return null;
  return (
    <group>
      {[1, -1].map((s) => {
        const r = rpt(s, LS / 2, st, lift);
        return (
          <group key={s} position={[r.x, r.y, 0]} rotation={[0, s > 0 ? 0 : Math.PI, -r.ang]}>
            <FlowSheet size={[LS, 2 * G.Z]} position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]} t={t} speed={0.9} along="u" opacity={0.75 * amount} rep={[1.2, 3]} />
          </group>
        );
      })}
    </group>
  );
};
// fio d'água caindo do beiral (direita e esquerda)
export const EaveFall: React.FC<{ t: number; amount: number; sides?: number[]; height?: number; st: RoofSt; heavy?: number }> = ({ t, amount, sides = [1, -1], st, heavy = 0 }) => {
  if (amount <= 0.01) return null;
  const e = rpt(1, LS + 0.05, st, 0.05);
  const h = e.y;
  return (
    <group>
      {sides.map((s) => (
        <group key={s}>
          <FlowSheet size={[2 * G.Z, h]} position={[s * (e.x + 0.05), h / 2, 0]} rotation={[0, Math.PI / 2, 0]} t={t} speed={2.4} along="v" opacity={amount * (0.55 + heavy * 0.35)} rep={[3 + heavy * 3, 1]} color="#A8DDFF" />
          <FlowSheet size={[2 * G.Z, h]} position={[s * (e.x + 0.12), h / 2, 0]} rotation={[0, Math.PI / 2, 0]} t={t + 0.37} speed={2.9} along="v" opacity={amount * (0.35 + heavy * 0.4)} rep={[2 + heavy * 2, 0.8]} color="#CFEBFF" />
        </group>
      ))}
    </group>
  );
};

// ---------- poça no teto plano ----------
export const RoofPuddle: React.FC<{ t: number; amount: number; y: number }> = ({ t, amount, y }) => {
  const geo = useMemo(() => {
    const n = 64;
    const g = new THREE.BufferGeometry();
    const v: number[] = [0, 0, 0];
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2;
      const r = 1 + 0.18 * Math.sin(a * 3 + 1) + 0.1 * Math.sin(a * 5 + 2) + 0.06 * Math.sin(a * 9);
      v.push(Math.cos(a) * r * 2.6, 0, Math.sin(a) * r * 2.0);
    }
    const idx: number[] = [];
    for (let i = 1; i <= n; i++) idx.push(0, i + 1, i);
    g.setAttribute("position", new THREE.Float32BufferAttribute(v, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }, []);
  if (amount <= 0.01) return null;
  return (
    <group position={[-0.6, y, -0.4]} scale={[amount, 1, amount]}>
      <mesh geometry={geo} receiveShadow>
        <meshStandardMaterial color="#56B8F0" roughness={0.05} metalness={0.2} transparent opacity={0.82} emissive="#1E7FD0" emissiveIntensity={0.25} />
      </mesh>
      {Array.from({ length: 14 }).map((_, i) => {
        const ph = (t * 1.3 + rnd(i, 2)) % 1;
        const x = (rnd(i, 3) - 0.5) * 3.8, z = (rnd(i, 4) - 0.5) * 2.8;
        return (
          <mesh key={i} position={[x, 0.012, z]} rotation={[-Math.PI / 2, 0, 0]} scale={0.05 + ph * 0.35}>
            <ringGeometry args={[0.8, 1, 24]} />
            <meshBasicMaterial color="#FFFFFF" transparent opacity={(1 - ph) * 0.7} depthWrite={false} />
          </mesh>
        );
      })}
    </group>
  );
};

// ---------- gotas (pingos em sequência) ----------
export const Drips: React.FC<{ t: number; from: V3; to: number; amount: number; rate?: number; seed?: number; size?: number }> = ({ t, from, to, amount, rate = 1.6, seed = 1, size = 1 }) => {
  if (amount <= 0.01) return null;
  const n = 4;
  const fall = from[1] - to;
  return (
    <group>
      {Array.from({ length: n }).map((_, i) => {
        const ph = (t * rate + i / n + rnd(seed, 3)) % 1;
        const y = from[1] - ph * ph * fall;
        return (
          <mesh key={i} position={[from[0], y, from[2]]} scale={[0.035 * size, (0.06 + ph * 0.07) * size, 0.035 * size]}>
            <sphereGeometry args={[1, 10, 8]} />
            <meshStandardMaterial color="#6CC4FF" emissive="#3FA0F0" emissiveIntensity={0.4} transparent opacity={0.9 * amount} />
          </mesh>
        );
      })}
      {/* respingo */}
      {Array.from({ length: 5 }).map((_, i) => {
        const ph = (t * rate + rnd(seed, 3) + 0.98) % 1;
        const a = (i / 5) * Math.PI * 2;
        const r = ph * 0.25 * size;
        return (
          <mesh key={`s${i}`} position={[from[0] + Math.cos(a) * r, to + Math.sin(ph * Math.PI) * 0.1, from[2] + Math.sin(a) * r]} scale={0.018 * size * (1 - ph)}>
            <sphereGeometry args={[1, 6, 5]} />
            <meshStandardMaterial color="#9BD8FF" transparent opacity={amount} />
          </mesh>
        );
      })}
    </group>
  );
};
// fio contínuo de água (fresta)
export const Stream: React.FC<{ t: number; from: V3; to: number; amount: number; seed?: number }> = ({ t, from, to, amount, seed = 0 }) => {
  if (amount <= 0.01) return null;
  const h = from[1] - to;
  return (
    <group>
      <FlowSheet size={[0.045, h]} position={[from[0], to + h / 2, from[2]]} t={t + seed} speed={3} along="v" opacity={amount * 0.9} rep={[0.3, 1.5]} color="#7CC8FF" />
      <FlowSheet size={[0.045, h]} position={[from[0], to + h / 2, from[2]]} rotation={[0, Math.PI / 2, 0]} t={t + seed + 0.3} speed={3} along="v" opacity={amount * 0.9} rep={[0.3, 1.5]} color="#7CC8FF" />
      <Drips t={t} from={[from[0], to + 0.6, from[2]]} to={to} amount={amount} rate={2.2} seed={seed * 10 + 3} size={0.8} />
    </group>
  );
};

// ---------- calha + condutor ----------
export const Gutter: React.FC<{ t: number; slide: number; pipe: number; water: number; glow: number }> = ({ t, slide, pipe, water, glow }) => {
  const e = rpt(1, LS, { p: 1, sag: 0 }, 0.02);
  const geo = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(-0.13, 0.1);
    s.lineTo(-0.1, -0.1);
    s.lineTo(0.12, -0.1);
    s.lineTo(0.16, 0.12);
    s.lineTo(0.13, 0.12);
    s.lineTo(0.1, -0.07);
    s.lineTo(-0.08, -0.07);
    s.lineTo(-0.1, 0.1);
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: 2 * G.Z + 0.1, bevelEnabled: false });
    g.translate(0, 0, -G.Z - 0.05);
    return g;
  }, []);
  if (slide <= 0) return null;
  const gx = e.x + 0.06, gy = e.y - 0.12;
  const off = (1 - Math.min(1, pop(slide))) * 2.0;
  const pz = -G.Z + 0.25;
  const pipeLen = (gy - 0.25) * pipe;
  const metal = { color: "#C4CCD3", metalness: 0.55, roughness: 0.35, emissive: "#FFB347", emissiveIntensity: glow * 0.7 };
  return (
    <group>
      <group position={[gx + off, gy - off * 0.5, 0]}>
        <mesh geometry={geo} castShadow>
          <meshStandardMaterial {...metal} side={THREE.DoubleSide} />
        </mesh>
        {water > 0.01 ? (
          <FlowSheet size={[2 * G.Z, 0.17]} position={[0.02, -0.04, 0]} rotation={[-Math.PI / 2, 0, -Math.PI / 2]} t={t} speed={1.6} along="u" opacity={water * 0.95} rep={[3, 0.4]} color="#5FBDF7" />
        ) : null}
      </group>
      {pipe > 0.01 ? (
        <group>
          <mesh position={[gx + 0.02, gy - 0.1 - pipeLen / 2, pz]} castShadow>
            <cylinderGeometry args={[0.07, 0.07, pipeLen, 12]} />
            <meshStandardMaterial {...metal} />
          </mesh>
          {pipe >= 1 ? (
            <group>
              <mesh position={[gx + 0.17, 0.2, pz]} rotation={[0, 0, Math.PI / 2]}>
                <cylinderGeometry args={[0.07, 0.07, 0.32, 12]} />
                <meshStandardMaterial {...metal} />
              </mesh>
              {[0.6, 1.4].map((y) => (
                <RBox key={y} size={[0.18, 0.04, 0.18]} position={[gx - 0.04, y, pz]} color="#9AA3AA" radius={0.01} />
              ))}
            </group>
          ) : null}
        </group>
      ) : null}
      {pipe >= 1 && water > 0.01 ? (
        <group>
          <FlowSheet size={[0.12, 0.5]} position={[gx + 0.45, 0.05, pz]} rotation={[-Math.PI / 2 + 0.3, 0, -Math.PI / 2]} t={t} speed={2} along="v" opacity={water} rep={[0.4, 1]} color="#6CC4FF" />
          <mesh position={[gx + 0.9, 0.035, pz]} rotation={[-Math.PI / 2, 0, 0]} scale={water}>
            <circleGeometry args={[0.45, 20]} />
            <meshStandardMaterial color="#5FB8F0" transparent opacity={0.7} roughness={0.05} />
          </mesh>
        </group>
      ) : null}
    </group>
  );
};

// ---------- manta térmica ----------
export const Foil: React.FC<{ q: number; glow: number }> = ({ q, glow }) => {
  const { gl } = useThree();
  const env = useMemo(() => {
    const pm = new THREE.PMREMGenerator(gl);
    const tx = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    pm.dispose();
    return tx;
  }, [gl]);
  const tex = useRep(foilTex, 2, 3);
  if (q <= 0) return null;
  const st = { p: 1, sag: 0 };
  return (
    <group>
      {[1, -1].map((s) => {
        const top = rpt(s, 0.08, st, -0.06);
        const len = (LS - 0.08) * q;
        return (
          <group key={s} position={[top.x, top.y, 0]} rotation={[0, s > 0 ? 0 : Math.PI, -top.ang]}>
            <mesh position={[len / 2, 0, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
              <boxGeometry args={[len, 2 * G.Z + 0.3, 0.025]} />
              <meshStandardMaterial map={tex} color="#C7D2DC" envMap={env} envMapIntensity={1.0} metalness={0.92} roughness={0.2} side={THREE.DoubleSide} emissive="#FFE08A" emissiveIntensity={glow * 0.6} />
            </mesh>
            {q < 1 ? (
              <mesh position={[len, -0.06, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
                <cylinderGeometry args={[0.09 + (1 - q) * 0.08, 0.09 + (1 - q) * 0.08, 2 * G.Z + 0.1, 16]} />
                <meshStandardMaterial envMap={env} color="#DDE5EC" metalness={0.85} roughness={0.25} />
              </mesh>
            ) : null}
          </group>
        );
      })}
    </group>
  );
};

// ---------- calor ----------
export const Arrow: React.FC<{ position: V3; rot: number; color: string; scale?: number; opacity?: number }> = ({ position, rot, color, scale = 1, opacity = 1 }) => (
  <group position={position} rotation={[0, 0, rot]} scale={scale}>
    <mesh position={[0, 0.3, 0]}>
      <cylinderGeometry args={[0.07, 0.07, 0.6, 10]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.6} transparent={opacity < 1} opacity={opacity} />
    </mesh>
    <mesh position={[0, 0.72, 0]}>
      <coneGeometry args={[0.17, 0.3, 12]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.6} transparent={opacity < 1} opacity={opacity} />
    </mesh>
  </group>
);
// setas de calor: "through" atravessam o telhado; "bounce" batem na manta e voltam
export const HeatArrows: React.FC<{ t: number; amount: number; mode: "through" | "bounce"; z?: number }> = ({ t, amount, mode, z = G.Z + 0.25 }) => {
  if (amount <= 0.01) return null;
  const xs = [-2.6, -1.3, 0.0, 1.3, 2.6];
  const st = { p: 1, sag: 0 };
  return (
    <group>
      {xs.map((x, i) => {
        const ph = (t * 0.55 + i * 0.37) % 1;
        const s = x >= 0 ? 1 : -1;
        const surf = rpt(s, Math.abs(x) / Math.cos(G.A), st, -0.06).y;
        const yTop = RIDGE + 2.2;
        if (mode === "through") {
          const y = yTop - ph * (yTop - 1.0);
          return <Arrow key={i} position={[x, y + 0.9, z]} rot={Math.PI} color="#FF3B1F" opacity={amount * Math.min(1, (1 - ph) * 4)} scale={0.9} />;
        }
        const hit = 0.5;
        const down = ph < hit;
        const u = down ? ph / hit : (ph - hit) / (1 - hit);
        const y = down ? yTop - u * (yTop - surf) : surf + u * (yTop + 0.5 - surf);
        const xx = down ? x : x + s * u * 0.9;
        return (
          <Arrow
            key={i}
            position={[xx, down ? y + 0.9 : y, z]}
            rot={down ? Math.PI : -s * 0.35}
            color={down ? "#FF3B1F" : "#FFB020"}
            opacity={amount * Math.min(1, (down ? 1 : 1 - u) * 3)}
            scale={0.9}
          />
        );
      })}
    </group>
  );
};
// ondas de calor subindo (fitas onduladas aditivas)
export const HeatWaves: React.FC<{ t: number; amount: number; area: [number, number, number, number]; y0: number; h?: number; n?: number; color?: string }> = ({ t, amount, area, y0, h = 1.6, n = 14, color = "#FF7A2A" }) => {
  const segs = 14;
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * (segs + 1) * 2 * 3), 3));
    g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(n * (segs + 1) * 2 * 3), 3));
    const idx: number[] = [];
    for (let i = 0; i < n; i++)
      for (let k = 0; k < segs; k++) {
        const a = (i * (segs + 1) + k) * 2;
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    g.setIndex(idx);
    return g;
  }, [n]);
  useLayoutEffect(() => {
    const p = geo.attributes.position as THREE.BufferAttribute;
    const c = geo.attributes.color as THREE.BufferAttribute;
    const col = new THREE.Color(color);
    for (let i = 0; i < n; i++) {
      const bx = area[0] + rnd(i, 61) * (area[1] - area[0]);
      const bz = area[2] + rnd(i, 62) * (area[3] - area[2]);
      const ph = (t * 0.45 + rnd(i, 63)) % 1;
      for (let k = 0; k <= segs; k++) {
        const v = k / segs;
        const y = y0 + ph * 0.8 + v * h;
        const x = bx + Math.sin(v * 7 - t * 5 + i) * 0.12;
        const a = (i * (segs + 1) + k) * 2;
        p.setXYZ(a, x - 0.05, y, bz);
        p.setXYZ(a + 1, x + 0.05, y, bz);
        const f = amount * Math.sin(Math.PI * v) * Math.sin(Math.PI * ph) * 0.9;
        c.setXYZ(a, col.r * f, col.g * f, col.b * f);
        c.setXYZ(a + 1, col.r * f, col.g * f, col.b * f);
      }
    }
    p.needsUpdate = true;
    c.needsUpdate = true;
  });
  if (amount <= 0.01) return null;
  return (
    <mesh geometry={geo} frustumCulled={false}>
      <meshBasicMaterial vertexColors transparent blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} />
    </mesh>
  );
};
export const Thermometer: React.FC<{ position: V3; level: number; show: number; scale?: number }> = ({ position, level, show, scale = 1 }) => {
  if (show <= 0) return null;
  const s = Math.min(1, pop(show)) * scale;
  const h = 2.4;
  return (
    <group position={position} scale={s}>
      <RBox size={[0.55, h + 0.3, 0.2]} position={[0, h / 2, -0.06]} color="#FFFFFF" radius={0.12} />
      <mesh position={[0, 0.05, 0.02]}>
        <sphereGeometry args={[0.24, 20, 14]} />
        <meshStandardMaterial color="#E8352B" emissive="#FF3B1F" emissiveIntensity={0.5} />
      </mesh>
      <mesh position={[0, h / 2, 0.02]}>
        <cylinderGeometry args={[0.1, 0.1, h - 0.2, 12]} />
        <meshStandardMaterial color="#E9EEF1" transparent opacity={0.6} />
      </mesh>
      <mesh position={[0, 0.1 + ((h - 0.3) * level) / 2, 0.03]}>
        <cylinderGeometry args={[0.075, 0.075, Math.max(0.01, (h - 0.3) * level), 12]} />
        <meshStandardMaterial color="#E8352B" emissive="#FF3B1F" emissiveIntensity={0.6} />
      </mesh>
      {Array.from({ length: 8 }).map((_, i) => (
        <mesh key={i} position={[0.17, 0.35 + i * 0.27, 0.05]}>
          <boxGeometry args={[0.1, 0.025, 0.01]} />
          <meshBasicMaterial color={C.ink} />
        </mesh>
      ))}
    </group>
  );
};

// ---------- demonstração: quadrado tomba, triângulo não ----------
const Bar: React.FC<{ a: [number, number]; b: [number, number]; tex: THREE.Texture }> = ({ a, b, tex }) => {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  return (
    <mesh position={[(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 0]} rotation={[0, 0, Math.atan2(b[1] - a[1], b[0] - a[0])]} castShadow>
      <boxGeometry args={[len + 0.1, 0.12, 0.1]} />
      <meshStandardMaterial map={tex} roughness={0.8} />
    </mesh>
  );
};
const Bolt: React.FC<{ p: [number, number] }> = ({ p }) => (
  <mesh position={[p[0], p[1], 0.07]} rotation={[Math.PI / 2, 0, 0]}>
    <cylinderGeometry args={[0.05, 0.05, 0.04, 10]} />
    <meshStandardMaterial color="#8E959C" metalness={0.6} roughness={0.3} />
  </mesh>
);
export const DemoFrames: React.FC<{ position: V3; show: number; rack: number; fallOver: number; nudge: number; glowTri: number }> = ({ position, show, rack, fallOver, nudge, glowTri }) => {
  const tex = useRep(() => woodTexture("#C38A52"), 1, 0.3);
  if (show <= 0) return null;
  const S = 1.3;
  const phi = rack * 0.9; // inclinação das verticais
  const dx = Math.sin(phi) * S, dy = Math.cos(phi) * S;
  const sq: [number, number][] = [[0, 0], [S, 0], [S + dx, dy], [dx, dy]];
  const tri: [number, number][] = [[0, 0], [1.5, 0], [0.75, 1.3]];
  const wob = Math.sin(nudge * Math.PI) * 0.02;
  return (
    <group position={position} scale={Math.min(1, pop(show))}>
      <group position={[0, 0.06, 0]} rotation={[-fallOver * 1.45, 0, 0]}>
        {[0, 1, 2, 3].map((i) => (
          <Bar key={i} a={sq[i]} b={sq[(i + 1) % 4]} tex={tex} />
        ))}
        {sq.map((p, i) => (
          <Bolt key={i} p={p} />
        ))}
      </group>
      <group position={[2.6, 0.06, 0]} rotation={[0, 0, -wob]}>
        {[0, 1, 2].map((i) => (
          <Bar key={i} a={tri[i]} b={tri[(i + 1) % 3]} tex={tex} />
        ))}
        {tri.map((p, i) => (
          <Bolt key={i} p={p} />
        ))}
        {glowTri > 0.01 ? (
          <mesh position={[0.75, 0.5, -0.02]}>
            <circleGeometry args={[0.01, 3]} />
            <meshBasicMaterial color="#fff" />
          </mesh>
        ) : null}
      </group>
    </group>
  );
};

// poeirinha quando a tábua bate na parede (prego)
export const Puffs: React.FC<{ t: number; land: (i: number) => number }> = ({ t, land }) => (
  <group>
    {Array.from({ length: NB }).map((_, i) => {
      const u = (t - land(i)) / 0.45;
      if (u < 0 || u > 1) return null;
      return [1, -1].map((s) =>
        Array.from({ length: 6 }).map((__, k) => {
          const a = (k / 6) * Math.PI * 2 + i;
          const r = 0.08 + u * 0.45;
          return (
            <mesh key={`${i}${s}${k}`} position={[s * (G.B - 0.1) + Math.cos(a) * r * 0.6, G.H + 0.05 + u * 0.25 + Math.sin(a) * 0.05, boardZ(i) + Math.sin(a) * r]} scale={0.07 * (1 - u) + 0.02}>
              <icosahedronGeometry args={[1, 0]} />
              <meshStandardMaterial color="#E8DCC6" transparent opacity={0.8 * (1 - u)} depthWrite={false} />
            </mesh>
          );
        }),
      );
    })}
  </group>
);
// serragem caindo das tábuas envergando
export const Sawdust: React.FC<{ t: number; amount: number; st: RoofSt }> = ({ t, amount, st }) => {
  if (amount <= 0.01) return null;
  return (
    <group>
      {Array.from({ length: 40 }).map((_, i) => {
        const s = i % 2 ? 1 : -1;
        const d = 0.3 + rnd(i, 81) * 2.6;
        const z = -2.8 + rnd(i, 82) * 5.8;
        const top = rpt(s, d, st, -0.06).y;
        const ph = (t * 0.9 + rnd(i, 83)) % 1;
        return (
          <mesh key={i} position={[s * d * Math.cos(G.A * st.p) + Math.sin(ph * 6 + i) * 0.05, top - ph * (top - 0.2), z]} rotation={[ph * 5, i, ph * 3]} scale={0.025 * amount}>
            <boxGeometry args={[1, 0.5, 1]} />
            <meshStandardMaterial color="#D9B98A" />
          </mesh>
        );
      })}
    </group>
  );
};
// setas de carga apertando o telhado
export const LoadArrows: React.FC<{ t: number; amount: number; st: RoofSt }> = ({ t, amount, st }) => {
  if (amount <= 0.01) return null;
  return (
    <group>
      {[-2.4, -1.2, 1.2, 2.4].flatMap((x, i) =>
        [-1.8, 1.4].map((z, j) => {
          const s = x > 0 ? 1 : -1;
          const y = rpt(s, Math.abs(x) / Math.cos(G.A), st, 0.3).y;
          const bob = (Math.sin(t * 6 + i + j) * 0.5 + 0.5) * 0.25;
          return <Arrow key={`${i}${j}`} position={[x, y + 1.25 + bob, z]} rot={Math.PI} color="#E8352B" scale={1.1 * Math.min(1, amount * 1.5)} />;
        }),
      )}
    </group>
  );
};
