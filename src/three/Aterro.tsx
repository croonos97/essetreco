import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { C } from "../theme";
import { Box, Cloud, FlowParticles, Glow, Pipe, RBox, Tree } from "./basics";
import { Casinha } from "./Bunker";

type V3 = [number, number, number];

// Vala do aterro em corte (z = 0). Trapézio: topo ±4.2, fundo ±2.4, 3.6 de profundidade.
export const H = {
  top: 4.2,
  bot: 2.4,
  depth: -3.6,
  inTop: 3.85,
  inBot: 2.1,
  inDepth: -3.3,
  zBack: -9,
  wellX: -6.4,
};
export const xl = (y: number) => -H.inBot - ((y - H.inDepth) / -H.inDepth) * (H.inTop - H.inBot);
export const xr = (y: number) => -xl(y);
const oxl = (y: number) => -H.bot - ((y - H.depth) / -H.depth) * (H.top - H.bot);

const SOILS = [
  { top: 0, bot: -0.12, color: C.grass },
  { top: -0.12, bot: -1.3, color: "#9C5F38" },
  { top: -1.3, bot: -4.6, color: "#D7AE77" },
  { top: -4.6, bot: -14, color: "#9A948C" },
];

const extrude = (pts: [number, number][], depth: number) => {
  const s = new THREE.Shape();
  pts.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
  s.closePath();
  return new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false });
};

const Slab: React.FC<{ pts: [number, number][]; z0: number; z1: number; color: string; opacity?: number; emissive?: string; ei?: number }> = ({ pts, z0, z1, color, opacity = 1, emissive, ei = 0 }) => {
  const geo = useMemo(() => extrude(pts, z1 - z0), [JSON.stringify(pts), z0, z1]);
  return (
    <mesh geometry={geo} position={[0, 0, z0]} castShadow receiveShadow>
      <meshStandardMaterial color={color} roughness={0.95} transparent={opacity < 1} opacity={opacity} depthWrite={opacity >= 1} emissive={emissive ?? "#000"} emissiveIntensity={ei} />
    </mesh>
  );
};

// Terreno com a vala trapezoidal.
export const Ground: React.FC = () => {
  const W = 22;
  const parts: { pts: [number, number][]; color: string }[] = [];
  for (const L of SOILS) {
    const ya = L.top;
    const yb = L.bot;
    if (yb >= H.depth) {
      parts.push({ pts: [[-W, ya], [oxl(ya), ya], [oxl(yb), yb], [-W, yb]], color: L.color });
      parts.push({ pts: [[-oxl(ya), ya], [W, ya], [W, yb], [-oxl(yb), yb]], color: L.color });
    } else if (ya > H.depth) {
      parts.push({ pts: [[-W, ya], [oxl(ya), ya], [-H.bot, H.depth], [H.bot, H.depth], [-oxl(ya), ya], [W, ya], [W, yb], [-W, yb]], color: L.color });
    } else {
      parts.push({ pts: [[-W, ya], [W, ya], [W, yb], [-W, yb]], color: L.color });
    }
  }
  return (
    <group>
      {parts.map((p, i) => (
        <Slab key={i} pts={p.pts} z0={H.zBack} z1={0} color={p.color} />
      ))}
      {/* fim da vala e campo ao fundo */}
      {/* sem superfícies coincidentes (evita o chão "piscando" ao fundo) */}
      <Box size={[2 * W, 13.88, 30]} position={[0, -7.06, H.zBack - 15]} color="#9C5F38" cast={false} />
      <Box size={[2 * W, 0.12, 30]} position={[0, -0.06, H.zBack - 15]} color={C.grass} cast={false} />
      <mesh position={[0, -0.08, H.zBack - 30 - 50]} receiveShadow>
        <boxGeometry args={[220, 0.1, 100]} />
        <meshStandardMaterial color={C.grass} roughness={1} />
      </mesh>
    </group>
  );
};

// Pedrinhas no corte.
export const Pebbles: React.FC = () => {
  const items = useMemo(() => {
    const r: { p: V3; s: number; c: string }[] = [];
    for (let i = 0; i < 110; i++) {
      const a = Math.sin(i * 91.7) * 4375.1;
      const b = Math.sin(i * 17.3) * 2731.9;
      const x = (a - Math.floor(a)) * 40 - 20;
      const y = -0.3 - (b - Math.floor(b)) * 8.5;
      if (y > H.depth - 0.2 && Math.abs(x) < -oxl(y) + 0.2) continue;
      r.push({ p: [x, y, 0.006], s: 0.04 + ((a * 7) % 1) * 0.06, c: y < -4.6 ? "#76716A" : y < -1.3 ? "#BE9460" : "#7E4A2A" });
    }
    return r;
  }, []);
  return (
    <group>
      {items.map((it, i) => (
        <mesh key={i} position={it.p} rotation={[0, 0, i]}>
          <circleGeometry args={[it.s, 5]} />
          <meshStandardMaterial color={it.c} roughness={1} />
        </mesh>
      ))}
    </group>
  );
};

// Manta: argila grossa + lona preta acompanhando a vala.
export const Liner: React.FC<{ p: number }> = ({ p }) => {
  const k = Math.max(0, Math.min(1, p));
  const ringPts = (outerL: (y: number) => number, innerL: (y: number) => number, yOut: number, yIn: number, top: number): [number, number][] => [
    [outerL(top), top],
    [outerL(yOut), yOut],
    [-outerL(yOut), yOut],
    [-outerL(top), top],
    [-innerL(top), top],
    [-innerL(yIn), yIn],
    [innerL(yIn), yIn],
    [innerL(top), top],
  ];
  const membraneL = (y: number) => xl(y) - 0.07;
  const soil = <Slab pts={ringPts(oxl, xl, H.depth, H.inDepth, 0)} z0={H.zBack} z1={0} color="#C99D66" />;
  if (k <= 0) return soil;
  return (
    <group>
      {k < 1 ? soil : null}
      <group position={[0, H.depth * (1 - k), 0]} scale={[1, k, 1]}>
        <Slab pts={ringPts(oxl, membraneL, H.depth, H.inDepth - 0.07, 0)} z0={H.zBack} z1={0.004} color="#C8794A" />
        <Slab pts={ringPts(membraneL, xl, H.inDepth - 0.07, H.inDepth, 0)} z0={H.zBack} z1={0.008} color="#3A3F47" />
      </group>
    </group>
  );
};

// Camadas dentro da vala.
export type Layer = { kind: "trash" | "soil" | "gravel"; y0: number; y1: number };
const trap = (y0: number, y1: number): [number, number][] => [
  [xl(y0), y0],
  [xr(y0), y0],
  [xr(y1), y1],
  [xl(y1), y1],
];

const BAG_COLORS = ["#2E3A55", "#3E4D6E", "#F2F2EE", "#DCD4C4", "#8AA36A", "#C47A45", "#1F2328", "#6B7FA8", "#E0B54A", "#B9C6D6"];

// Sacos de lixo vistos no corte (instanciados).
const Bags: React.FC<{ y0: number; y1: number; seed: number; squash: number }> = ({ y0, y1, seed, squash }) => {
  const ref = useRef<THREE.InstancedMesh>(null);
  const items = useMemo(() => {
    const r: { x: number; y: number; w: number; h: number; c: string }[] = [];
    const rowH = 0.2 * squash + 0.02;
    let row = 0;
    for (let y = y0 + rowH / 2 + 0.02; y < y1 - rowH / 2; y += rowH, row++) {
      const a = xl(y) + 0.1;
      const b = xr(y) - 0.1;
      let x = a + ((row * 0.13 + seed * 0.07) % 0.3);
      let i = 0;
      while (x < b - 0.1) {
        const h1 = Math.sin((row + 1) * 12.9898 + i * 78.233 + seed * 3.1) * 43758.5453;
        const f = h1 - Math.floor(h1);
        const w = 0.24 + f * 0.26;
        r.push({ x: x + w / 2, y, w: Math.min(w, b - x), h: rowH * (0.75 + f * 0.2), c: BAG_COLORS[Math.floor(f * 997) % BAG_COLORS.length] });
        x += w + 0.04;
        i++;
      }
    }
    return r;
  }, [y0, y1, seed, squash]);
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    const o = new THREE.Object3D();
    const col = new THREE.Color();
    items.forEach((it, i) => {
      o.position.set(it.x, it.y, 0.012);
      o.scale.set(it.w, it.h, 1);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
      m.setColorAt(i, col.set(it.c));
    });
    m.count = items.length;
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [items]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, 600]} key={items.length}>
      <planeGeometry args={[1, 1]} />
      <meshStandardMaterial roughness={0.6} />
    </instancedMesh>
  );
};

// Lixo solto na superfície da camada de cima.
const SurfaceTrash: React.FC<{ y: number; seed: number; flat: number }> = ({ y, seed, flat }) => {
  const ref = useRef<THREE.InstancedMesh>(null);
  const items = useMemo(() => {
    const r: { p: V3; s: number; c: string }[] = [];
    for (let i = 0; i < 140; i++) {
      const a = Math.sin(i * 12.9898 + seed) * 43758.5453;
      const b = Math.sin(i * 78.233 + seed) * 12543.1;
      const fa = a - Math.floor(a);
      const fb = b - Math.floor(b);
      const x = xl(y) + 0.2 + fa * (xr(y) - xl(y) - 0.4);
      const z = -0.25 - fb * (-H.zBack - 0.6);
      r.push({ p: [x, y, z], s: 0.14 + ((a * 3) % 1) * 0.12, c: BAG_COLORS[Math.floor(fb * 991) % BAG_COLORS.length] });
    }
    return r;
  }, [y, seed]);
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    const o = new THREE.Object3D();
    const col = new THREE.Color();
    items.forEach((it, i) => {
      o.position.set(it.p[0], it.p[1] + it.s * 0.4 * flat, it.p[2]);
      o.scale.set(it.s * 1.3, it.s * flat, it.s);
      o.rotation.set(i, i * 2, 0);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
      m.setColorAt(i, col.set(it.c));
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [items, flat]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, items.length]} castShadow>
      <dodecahedronGeometry args={[1, 0]} />
      <meshStandardMaterial roughness={0.6} flatShading />
    </instancedMesh>
  );
};

export const Fill: React.FC<{ layers: Layer[]; squash: number; topTrash: boolean }> = ({ layers, squash, topTrash }) => {
  const top = layers.length ? layers[layers.length - 1] : null;
  return (
    <group>
      {layers.map((L, i) =>
        L.y1 - L.y0 > 0.01 ? (
          <group key={i}>
            <Slab pts={trap(L.y0, L.y1)} z0={H.zBack} z1={L.kind === "trash" ? 0 : 0.014} color={L.kind === "trash" ? "#2B2F38" : L.kind === "soil" ? "#8B5632" : "#9EA3A6"} />
            {L.kind === "trash" ? <Bags y0={L.y0} y1={L.y1} seed={i * 7 + 1} squash={squash} /> : null}
            {L.kind === "gravel" ? <Gravel y0={L.y0} y1={L.y1} /> : null}
          </group>
        ) : null,
      )}
      {top && topTrash && top.kind === "trash" ? <SurfaceTrash y={top.y1} seed={layers.length} flat={squash} /> : null}
    </group>
  );
};

const Gravel: React.FC<{ y0: number; y1: number }> = ({ y0, y1 }) => {
  const items = useMemo(() => {
    const r: { p: V3; s: number }[] = [];
    for (let i = 0; i < 70; i++) {
      const a = Math.sin(i * 33.1) * 999.1;
      const b = Math.sin(i * 7.7) * 777.7;
      const y = y0 + 0.05 + (b - Math.floor(b)) * (y1 - y0 - 0.1);
      const x = xl(y) + 0.1 + (a - Math.floor(a)) * (xr(y) - xl(y) - 0.2);
      r.push({ p: [x, y, 0.02], s: 0.04 + ((a * 5) % 1) * 0.04 });
    }
    return r;
  }, [y0, y1]);
  return (
    <group>
      {items.map((it, i) => (
        <mesh key={i} position={it.p}>
          <circleGeometry args={[it.s, 6]} />
          <meshStandardMaterial color={i % 2 ? "#6E7377" : "#C9CDD0"} />
        </mesh>
      ))}
    </group>
  );
};

// Chorume acumulado (nível dentro da vala).
export const Pool: React.FC<{ level: number; base: number }> = ({ level, base }) => {
  if (level - base <= 0.02) return null;
  return <Slab pts={trap(base, level)} z0={H.zBack + 0.05} z1={0.03} color="#3B2414" opacity={0.78} />;
};

// Drenos no fundo + bomba.
export const Drains: React.FC<{ p: number; t: number; flow: number; base: number }> = ({ p, t, flow, base }) => {
  if (p <= 0.01) return null;
  const y = base + 0.15;
  const pump: V3 = [5.3, 0.45, -1.4];
  return (
    <group>
      {[-1.2, 0, 1.2].map((x, i) => (
        <group key={i}>
          <mesh position={[x, y, H.zBack / 2]} rotation={[Math.PI / 2, 0, 0]} scale={[1, p, 1]}>
            <cylinderGeometry args={[0.1, 0.1, -H.zBack, 14]} />
            <meshStandardMaterial color="#F1F1EC" />
          </mesh>
          {/* furos no tubo (corte) */}
          <mesh position={[x, y, 0.02]}>
            <ringGeometry args={[0.06, 0.1, 16]} />
            <meshBasicMaterial color="#F1F1EC" />
          </mesh>
          <mesh position={[x, y, 0.021]}>
            <circleGeometry args={[0.06, 16]} />
            <meshBasicMaterial color="#3B2414" />
          </mesh>
        </group>
      ))}
      {/* tubo subindo pelo talude até a bomba */}
      <Pipe points={[[1.2, y, -1.4], [xr(y) - 0.15, y + 0.05, -1.4], [xr(-0.3) - 0.1, -0.1, -1.4], [pump[0] - 0.4, 0.3, -1.4]]} radius={0.09} color="#F1F1EC" />
      <group position={pump} scale={p}>
        <RBox size={[0.9, 0.8, 0.8]} color="#3DBE5A" radius={0.06} />
        <mesh position={[0, 0.5, 0]}>
          <cylinderGeometry args={[0.22, 0.22, 0.25, 16]} />
          <meshStandardMaterial color="#2E3138" />
        </mesh>
      </group>
      {/* tanque de tratamento */}
      <group position={[7.2, 0, -2.2]} scale={p}>
        <mesh position={[0, 0.5, 0]}>
          <cylinderGeometry args={[1.0, 1.0, 1.0, 28]} />
          <meshStandardMaterial color="#DAD6CE" />
        </mesh>
        <mesh position={[0, 0.98, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.9, 28]} />
          <meshStandardMaterial color="#6B4A2E" />
        </mesh>
      </group>
      {flow > 0.01 ? (
        <>
          <FlowParticles points={[[-1.2, y, -0.6], [1.2, y, -0.9], [xr(y) - 0.15, y + 0.05, -1.4], [xr(-0.3) - 0.1, -0.1, -1.4], [pump[0] - 0.4, 0.3, -1.4]]} t={t} count={22} speed={0.35} size={0.06} color="#5A3720" visible={flow} />
          <FlowParticles points={[[pump[0] + 0.4, 0.5, -1.4], [6.4, 0.9, -1.8], [7.2, 1.1, -2.2]]} t={t} count={8} speed={0.5} size={0.06} color="#5A3720" visible={flow} />
        </>
      ) : null}
    </group>
  );
};

// Poços de gás: tubos furados verticais + coletor + flare.
export const GasWells: React.FC<{ p: number; t: number; flare: number; toEngine: number; top: number }> = ({ p, t, flare, toEngine, top }) => {
  if (p <= 0.01) return null;
  const xs = [-1.9, 0, 1.9];
  const head = top + 1.0;
  const flareP: V3 = [5.6, 0, -3.4];
  const len = (head - (H.inDepth + 0.4)) * Math.min(1, p * 1.3);
  return (
    <group>
      {xs.map((x, i) => (
        <group key={i}>
          <mesh position={[x, head - len / 2, -0.3]}>
            <cylinderGeometry args={[0.11, 0.11, len, 14]} />
            <meshStandardMaterial color="#F2F2EE" />
          </mesh>
          {/* furinhos */}
          {Array.from({ length: 8 }).map((_, k) => {
            const y = H.inDepth + 0.6 + k * 0.38;
            return y < top && y > head - len ? (
              <mesh key={k} position={[x, y, -0.18]}>
                <circleGeometry args={[0.035, 8]} />
                <meshBasicMaterial color="#2B2F38" />
              </mesh>
            ) : null;
          })}
          {p > 0.8 ? <Box size={[0.3, 0.12, 0.3]} position={[x, head, -0.3]} color="#E8352B" /> : null}
        </group>
      ))}
      {p > 0.8 ? <Pipe points={[[-1.9, head, -0.3], [1.9, head, -0.3], [3.8, head - 0.2, -1.8], [flareP[0], 0.6, flareP[2]]]} radius={0.08} color="#E8352B" /> : null}
      {/* flare */}
      <group position={flareP}>
        <mesh position={[0, 2.0, 0]}>
          <cylinderGeometry args={[0.13, 0.18, 4.0, 14]} />
          <meshStandardMaterial color="#6E7781" metalness={0.4} roughness={0.5} />
        </mesh>
        {flare > 0.01 ? (
          <group position={[0, 4.15 + 0.1 * Math.sin(t * 12), 0]} scale={flare * (1 + 0.1 * Math.sin(t * 17))}>
            <mesh scale={[0.3, 0.75, 0.3]}>
              <sphereGeometry args={[1, 14, 12]} />
              <meshBasicMaterial color="#FF9A3C" />
            </mesh>
            <mesh position={[0, -0.1, 0]} scale={[0.17, 0.42, 0.17]}>
              <sphereGeometry args={[1, 12, 10]} />
              <meshBasicMaterial color="#FFE08A" />
            </mesh>
            <Glow position={[0, 0.2, 0]} size={3.0} color="#FF8A1E" opacity={0.6} />
          </group>
        ) : null}
      </group>
      {/* motores */}
      {toEngine > 0.01 ? (
        <group position={[8.0, 0, -4.6]} scale={Math.min(1, toEngine * 1.5)}>
          <RBox size={[2.0, 1.5, 1.6]} position={[0, 0.75, 0]} color="#E9E3D6" radius={0.06} />
          <RBox size={[2.1, 0.14, 1.7]} position={[0, 1.55, 0]} color="#3E4A5C" radius={0.03} />
          <mesh position={[0.6, 2.0, 0.2]}>
            <cylinderGeometry args={[0.1, 0.1, 0.9, 10]} />
            <meshStandardMaterial color="#6E7781" />
          </mesh>
          <Box size={[0.04, 0.5, 0.5]} position={[-1.02, 0.9, 0]} color="#FFD23F" emissive="#FFD23F" emissiveIntensity={toEngine} />
          <Glow position={[-1.1, 0.9, 0]} size={1.6 * toEngine} color="#FFD23F" opacity={0.5 * toEngine} />
        </group>
      ) : null}
      {toEngine > 0.3 ? (
        <FlowParticles points={[[7.0, 1.6, -4.6], [3.0, 4.2, -5.5], [-4.0, 4.4, -5.0], [-9.0, 2.0, -3.0], [-9.6, 1.2, -2.6]]} t={t} count={26} speed={0.35} size={0.09} color="#FFD23F" emissive={1.2} visible={toEngine} />
      ) : null}
    </group>
  );
};

// Tampa final: lona + terra + grama em cúpula.
export const Cap: React.FC<{ p: number }> = ({ p }) => {
  if (p <= 0.01) return null;
  const dome = (x: number, h: number) => h * Math.cos((x / (H.top + 0.4)) * (Math.PI / 2));
  const mk = (h0: number, h1: number): [number, number][] => {
    const pts: [number, number][] = [];
    const n = 24;
    for (let i = 0; i <= n; i++) {
      const x = -H.top - 0.3 + ((2 * H.top + 0.6) * i) / n;
      pts.push([x, dome(x, h1)]);
    }
    for (let i = n; i >= 0; i--) {
      const x = -H.top - 0.3 + ((2 * H.top + 0.6) * i) / n;
      pts.push([x, dome(x, h0)]);
    }
    return pts;
  };
  const a = Math.min(1, p * 3);
  const b = Math.max(0, Math.min(1, p * 3 - 1));
  const c = Math.max(0, Math.min(1, p * 3 - 2));
  return (
    <group>
      <Slab pts={mk(-0.02, 0.12 * a)} z0={H.zBack} z1={0.02} color="#1E2126" />
      {b > 0 ? <Slab pts={mk(0.1, 0.12 + 0.7 * b)} z0={H.zBack} z1={0.02} color="#8B5632" /> : null}
      {c > 0 ? <Slab pts={mk(0.8, 0.82 + 0.14 * c)} z0={H.zBack} z1={0.022} color={C.grass} /> : null}
    </group>
  );
};

// Ratos e moscas.
export const Critters: React.FC<{ t: number; p: number; y: number; flee: number }> = ({ t, p, y, flee }) => {
  if (p <= 0.01) return null;
  const rats = [0, 1, 2, 3, 4].map((i) => {
    const ph = (t * 0.22 + i * 0.21) % 1;
    const x = xl(y) + 0.4 + ph * (xr(y) - xl(y) - 0.8) - flee * 7;
    const z = -0.8 - i * 1.3;
    const dir = Math.sin(t * 2 + i) > -2 ? 1 : -1;
    return (
      <group key={i} position={[x, y + 0.16, z]} scale={p * 1.4} rotation={[0, dir > 0 ? 0 : Math.PI, 0]}>
        <mesh scale={[0.28, 0.13, 0.14]}>
          <sphereGeometry args={[1, 12, 10]} />
          <meshStandardMaterial color="#6B6E74" />
        </mesh>
        <mesh position={[0.26, 0.03, 0]} scale={[0.1, 0.08, 0.08]}>
          <sphereGeometry args={[1, 10, 8]} />
          <meshStandardMaterial color="#7D8086" />
        </mesh>
        <mesh position={[-0.42, 0, 0]} rotation={[0, 0, Math.PI / 2 + 0.2]}>
          <cylinderGeometry args={[0.012, 0.02, 0.32, 6]} />
          <meshStandardMaterial color="#D9A0A0" />
        </mesh>
      </group>
    );
  });
  const flies = Array.from({ length: 22 }).map((_, i) => {
    const a = t * (2.5 + (i % 5) * 0.4) + i;
    const r = 0.4 + (i % 4) * 0.3;
    const cx = -2.5 + (i % 6) * 1.0;
    const cz = -0.8 - (i % 3) * 1.5;
    return (
      <mesh key={`f${i}`} position={[cx + Math.cos(a) * r, y + 0.8 + Math.sin(a * 1.7) * 0.3 + (i % 3) * 0.25, cz + Math.sin(a) * r * 0.5]} scale={p * (1 - flee)}>
        <sphereGeometry args={[0.06, 6, 6]} />
        <meshBasicMaterial color="#111" />
      </mesh>
    );
  });
  return (
    <group>
      {rats}
      {flies}
    </group>
  );
};

// Fedor: nuvens verdes indo até as casas.
export const Stink: React.FC<{ t: number; amount: number }> = ({ t, amount }) => {
  if (amount <= 0.01) return null;
  const puffs = [];
  for (let i = 0; i < 26; i++) {
    const ph = ((t * 0.18 + i / 26) % 1 + 1) % 1;
    const x = 1.5 - ph * 13;
    const y = 0.5 + Math.sin(ph * 9 + i) * 0.35 + ph * 1.2;
    const z = -1 - (i % 4) * 1.2;
    puffs.push(
      <mesh key={i} position={[x, y, z]} scale={0.25 + ph * 0.35}>
        <icosahedronGeometry args={[1, 1]} />
        <meshStandardMaterial color="#9BCB4F" transparent opacity={0.4 * amount * (1 - ph * 0.6)} depthWrite={false} roughness={1} />
      </mesh>,
    );
  }
  return <group>{puffs}</group>;
};

// Poço do vizinho em corte.
export const Well: React.FC<{ dirty: number }> = ({ dirty }) => {
  const x = H.wellX;
  const water = new THREE.Color(C.water).lerp(new THREE.Color("#4A2E1A"), dirty).getStyle();
  return (
    <group>
      <mesh position={[x, -2.6, 0.012]}>
        <planeGeometry args={[0.8, 5.2]} />
        <meshBasicMaterial color="#3A2A20" />
      </mesh>
      <mesh position={[x, -4.6, 0.016]}>
        <planeGeometry args={[0.8, 1.2]} />
        <meshBasicMaterial color={water} />
      </mesh>
      {[-0.45, 0.45].map((d) => (
        <mesh key={d} position={[x + d, -2.6, 0.014]}>
          <planeGeometry args={[0.1, 5.2]} />
          <meshBasicMaterial color="#B4573E" />
        </mesh>
      ))}
      {/* boca do poço */}
      <mesh position={[x, 0.3, -0.45]}>
        <cylinderGeometry args={[0.55, 0.55, 0.6, 20, 1, true]} />
        <meshStandardMaterial color="#B4573E" side={THREE.DoubleSide} />
      </mesh>
      <Box size={[0.08, 1.4, 0.08]} position={[x - 0.5, 0.7, -0.45]} color={C.wood} />
      <Box size={[0.08, 1.4, 0.08]} position={[x + 0.5, 0.7, -0.45]} color={C.wood} />
      <Box size={[1.4, 0.1, 1.2]} position={[x, 1.45, -0.45]} rotation={[0, 0, 0]} color="#7A4E2D" />
    </group>
  );
};

// Vazamento de chorume pelo fundo até o poço.
export const Leak: React.FC<{ t: number; amount: number }> = ({ t, amount }) => {
  if (amount <= 0.01) return null;
  return (
    <group>
      <FlowParticles points={[[-1.0, H.inDepth - 0.1, 0.03], [-2.4, -3.9, 0.03], [-4.5, -4.3, 0.03], [H.wellX + 0.3, -4.4, 0.03]]} t={t} count={18} speed={0.25} size={0.07} color="#4A2E1A" visible={amount} jitter={0.15} />
      <FlowParticles points={[[1.0, H.inDepth - 0.1, 0.03], [0.4, -4.4, 0.03], [-1.5, -4.7, 0.03], [-4.2, -4.6, 0.03], [H.wellX + 0.3, -4.5, 0.03]]} t={t + 0.4} count={14} speed={0.22} size={0.06} color="#5A3720" visible={amount} jitter={0.15} />
    </group>
  );
};

// Gás: bolhas no lixo e migração até a casa.
export const Gas: React.FC<{ t: number; bubbles: number; migrate: number; top: number }> = ({ t, bubbles, migrate, top }) => {
  const items = [];
  if (bubbles > 0.01) {
    for (let i = 0; i < 30; i++) {
      const ph = ((t * 0.35 + i * 0.137) % 1 + 1) % 1;
      const y = H.inDepth + 0.3 + ph * (top - H.inDepth - 0.3);
      const x = xl(y) + 0.3 + ((i * 0.618) % 1) * (xr(y) - xl(y) - 0.6);
      items.push(
        <mesh key={i} position={[x, y, 0.04]} scale={bubbles * (0.06 + ph * 0.06)}>
          <sphereGeometry args={[1, 10, 8]} />
          <meshStandardMaterial color="#C8E05A" emissive="#C8E05A" emissiveIntensity={0.4} transparent opacity={0.85} />
        </mesh>,
      );
    }
  }
  return (
    <group>
      {items}
      {migrate > 0.01 ? (
        <FlowParticles points={[[-2.4, -1.4, 0.04], [-4.0, -1.3, 0.04], [-7.0, -0.9, 0.04], [-8.6, -0.4, 0.04], [-8.8, 0.3, -1.2]]} t={t} count={22} speed={0.3} size={0.08} color="#C8E05A" emissive={0.5} visible={migrate} />
      ) : null}
    </group>
  );
};

export const Boom: React.FC<{ p: number; position: V3 }> = ({ p, position }) => {
  if (p <= 0.01 || p >= 1) return null;
  const s = 0.5 + p * 4;
  const o = 1 - p;
  const debris = [];
  for (let i = 0; i < 14; i++) {
    const a = i * 2.39;
    debris.push(
      <mesh key={i} position={[position[0] + Math.cos(a) * p * 3, position[1] + 0.5 + Math.sin(p * Math.PI) * 2.5 * ((i % 3) + 1) * 0.5, position[2] + Math.sin(a) * p * 1.5]} rotation={[i * p * 5, i, 0]}>
        <boxGeometry args={[0.18, 0.12, 0.1]} />
        <meshStandardMaterial color={i % 2 ? "#C9654A" : "#3E4A5C"} />
      </mesh>,
    );
  }
  return (
    <group>
      <mesh position={[position[0], position[1] + 1, position[2]]} scale={s}>
        <icosahedronGeometry args={[1, 1]} />
        <meshBasicMaterial color={p < 0.3 ? "#FFE08A" : "#FF8A1E"} transparent opacity={o * 0.85} />
      </mesh>
      <Glow position={[position[0], position[1] + 1, position[2] + 0.5]} size={s * 2.4} color="#FF8A1E" opacity={o} />
      {debris}
    </group>
  );
};

// Compactador: rolos de aço cheios de dentes.
export const Compactor: React.FC<{ x: number; y: number; z: number; t: number; dir: number }> = ({ x, y, z, t, dir }) => {
  const roll = -t * 4 * dir;
  const Wheel: React.FC<{ dx: number }> = ({ dx }) => (
    <group position={[dx, 0.42, 0]} rotation={[0, 0, roll]}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.38, 0.38, 1.1, 18]} />
        <meshStandardMaterial color="#8E959C" metalness={0.5} roughness={0.4} />
      </mesh>
      {Array.from({ length: 30 }).map((_, i) => {
        const a = (i % 10) * ((Math.PI * 2) / 10);
        const zz = -0.4 + Math.floor(i / 10) * 0.4;
        return (
          <mesh key={i} position={[Math.cos(a) * 0.43, Math.sin(a) * 0.43, zz]} rotation={[0, 0, a - Math.PI / 2]}>
            <coneGeometry args={[0.07, 0.16, 4]} />
            <meshStandardMaterial color="#5E656C" />
          </mesh>
        );
      })}
    </group>
  );
  return (
    <group position={[x, y, z]} rotation={[0, dir > 0 ? 0 : Math.PI, 0]}>
      <Wheel dx={-0.85} />
      <Wheel dx={0.85} />
      <RBox size={[1.9, 0.5, 1.0]} position={[0, 0.95, 0]} color="#F2C230" radius={0.06} />
      <RBox size={[0.8, 0.7, 0.9]} position={[-0.3, 1.55, 0]} color="#F2C230" radius={0.06} />
      <Box size={[0.6, 0.45, 0.92]} position={[-0.3, 1.6, 0]} color="#BFE3F2" />
      <RBox size={[0.2, 0.6, 1.3]} position={[1.25, 0.6, 0]} color="#3E4A5C" radius={0.03} />
      <mesh position={[0.5, 1.6, 0.3]}>
        <cylinderGeometry args={[0.06, 0.06, 0.6, 8]} />
        <meshStandardMaterial color="#2E3138" />
      </mesh>
    </group>
  );
};

// Caminhão basculante despejando lixo.
export const Truck: React.FC<{ x: number; tilt: number; t: number; dump: number }> = ({ x, tilt, t, dump }) => (
  <group position={[x, 0, -2.2]}>
    <RBox size={[1.2, 1.2, 1.5]} position={[1.6, 0.95, 0]} color="#3DBE5A" radius={0.08} />
    <Box size={[0.08, 0.5, 1.2]} position={[2.22, 1.15, 0]} color="#BFE3F2" />
    <group position={[0.9, 0.55, 0]} rotation={[0, 0, tilt]}>
      <RBox size={[2.4, 1.1, 1.6]} position={[-1.2, 0.6, 0]} color="#E9E3D6" radius={0.05} />
    </group>
    {[-0.9, 1.6].map((dx) => (
      <mesh key={dx} position={[dx, 0.32, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.32, 0.32, 1.65, 16]} />
        <meshStandardMaterial color="#22252A" />
      </mesh>
    ))}
    {dump > 0.01 ? (
      <FlowParticles points={[[-1.4, 0.9, 0], [-2.4, 0.4, 0], [-3.4, -1.2, -0.2], [-4.2, -2.6, -0.4]]} t={t} count={18} speed={0.6} size={0.14} color={(u, i) => BAG_COLORS[i % BAG_COLORS.length]} visible={dump} jitter={0.4} />
    ) : null}
  </group>
);

// Lixo voando pela estrada.
export const Litter: React.FC<{ t: number; amount: number }> = ({ t, amount }) => {
  if (amount <= 0.01) return null;
  const items = [];
  for (let i = 0; i < 30; i++) {
    const ph = ((t * 0.25 + i / 30) % 1 + 1) % 1;
    items.push(
      <mesh key={i} position={[-1 - ph * 12, 0.3 + Math.abs(Math.sin(ph * 12 + i)) * 1.4, -1 - (i % 5) * 1.3]} rotation={[t * 3 + i, t * 2, i]}>
        <planeGeometry args={[0.55, 0.42]} />
        <meshStandardMaterial color={BAG_COLORS[i % BAG_COLORS.length]} side={THREE.DoubleSide} />
      </mesh>,
    );
  }
  return <group>{items}</group>;
};

// Vila vizinha à esquerda.
export const Town: React.FC<{ t: number; lit: number; boom: number }> = ({ t, lit, boom }) => (
  <group>
    <group position={[-9.6, 0, -2.6]} scale={0.62} rotation={[0, 0.3, 0]}>
      <group position={[0, Math.sin(Math.min(1, boom) * Math.PI) * 0.8, 0]}>
        <Casinha />
      </group>
    </group>
    <group position={[-13.5, 0, -4.5]} scale={0.62} rotation={[0, 0.2, 0]}>
      <Casinha />
    </group>
    <group position={[-11.5, 0, -8.5]} scale={0.62}>
      <Casinha />
    </group>
    {lit > 0.01
      ? [
          [-10.0, 0.9, -1.6],
          [-13.9, 0.9, -3.5],
          [-12.0, 0.9, -7.5],
        ].map((p, i) => <Glow key={i} position={p as V3} size={1.4 * lit} color="#FFD23F" opacity={0.8 * lit} />)
      : null}
    {/* estrada */}
    <Box size={[30, 0.04, 1.6]} position={[-7, 0.03, -11]} color={C.street} cast={false} />
    <Tree position={[-16, 0, -3]} scale={1.4} seed={1} />
    <Tree position={[10.5, 0, -3]} scale={1.5} seed={2} />
    <Tree position={[12.5, 0, -7]} scale={1.8} seed={1.3} />
    <Cloud position={[-6 + Math.sin(t * 0.05) * 1.5, 11, -26]} scale={2.4} />
    <Cloud position={[7 + Math.sin(t * 0.04) * 1.5, 13, -32]} scale={3} />
  </group>
);

// Achado curioso: jornal legível + pote.
export const Finds: React.FC<{ p: number; y: number }> = ({ p, y }) => {
  if (p <= 0.01) return null;
  return (
    <group position={[-0.6, y, 0.05]} scale={p}>
      <mesh>
        <planeGeometry args={[0.95, 0.7]} />
        <meshStandardMaterial color="#F3EFE4" />
      </mesh>
      <mesh position={[0, 0.25, 0.002]}>
        <planeGeometry args={[0.8, 0.1]} />
        <meshBasicMaterial color="#2B2F38" />
      </mesh>
      {[0.08, -0.02, -0.12, -0.22].map((dy) => (
        <mesh key={dy} position={[-0.18, dy, 0.002]}>
          <planeGeometry args={[0.42, 0.04]} />
          <meshBasicMaterial color="#9BA0A6" />
        </mesh>
      ))}
      <mesh position={[0.24, -0.08, 0.002]}>
        <planeGeometry args={[0.3, 0.3]} />
        <meshBasicMaterial color="#B9C6D6" />
      </mesh>
      {/* pote fechado */}
      <group position={[1.15, -0.05, 0]}>
        <mesh>
          <planeGeometry args={[0.42, 0.55]} />
          <meshStandardMaterial color="#CFE7F2" transparent opacity={0.85} />
        </mesh>
        <mesh position={[0, 0.31, 0.002]}>
          <planeGeometry args={[0.46, 0.09]} />
          <meshBasicMaterial color="#D2402E" />
        </mesh>
        <mesh position={[0, -0.08, 0.003]}>
          <circleGeometry args={[0.13, 14]} />
          <meshBasicMaterial color="#7FB04A" />
        </mesh>
      </group>
    </group>
  );
};
