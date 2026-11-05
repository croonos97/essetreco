import { useMemo } from "react";
import * as THREE from "three";
import { C } from "../theme";
import { Box, Cloud, FlowParticles, Glow, RBox, Tree } from "./basics";
import { Building } from "./Hidro";

type V3 = [number, number, number];

// Rio corre de +x (montante) para -x (jusante). Corte frontal em z = 0.
export const B = {
  zBack: -6.6, // fim do paredão (encosta)
  plateauZ: -8.9,
  plateauH: 4.6,
  up: 0.35, // face de montante do paredão
  crest: 4.2,
  lakeEnd: 13,
  soil: -1.1,
  sand: -3.0,
  rock: -9,
  spillZ0: -8.6,
  spillZ1: -6.8,
  spillLip: 3.3,
  spillEnd: -7.2,
};

const ROCK = "#8E8A86";
const SAND = "#DDB57E";
const SOILC = "#A8673E";
const CONC = "#DCD8D0";

const Prism: React.FC<{ pts: [number, number][]; z0: number; z1: number; color: string; opacity?: number; emissive?: string; emissiveIntensity?: number }> = ({
  pts,
  z0,
  z1,
  color,
  opacity = 1,
  emissive,
  emissiveIntensity = 0,
}) => {
  const geo = useMemo(() => {
    const s = new THREE.Shape();
    pts.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
    s.closePath();
    return new THREE.ExtrudeGeometry(s, { depth: z1 - z0, bevelEnabled: false });
  }, [JSON.stringify(pts), z0, z1]);
  return (
    <mesh geometry={geo} position={[0, 0, z0]} castShadow receiveShadow>
      <meshStandardMaterial color={color} roughness={0.9} transparent={opacity < 1} opacity={opacity} depthWrite={opacity >= 1} emissive={emissive ?? "#000"} emissiveIntensity={emissiveIntensity} />
    </mesh>
  );
};

// Leito do rio em corte: camadas de solo, areia e rocha + encostas ao fundo.
export const Riverbed: React.FC<{ scour?: number; pipe?: number }> = ({ scour = 0, pipe = 0 }) => {
  const W = 44;
  const D = 30;
  const zc = (B.spillZ0 + B.spillZ1) / 2;
  return (
    <group>
      <Box size={[W, -B.soil, D]} position={[0, B.soil / 2, -D / 2]} color={SOILC} cast={false} />
      <Box size={[W, B.soil - B.sand, D]} position={[0, (B.soil + B.sand) / 2, -D / 2]} color={SAND} cast={false} />
      <Box size={[W, B.sand - B.rock, D]} position={[0, (B.sand + B.rock) / 2, -D / 2]} color={ROCK} cast={false} />
      {/* grama a jusante */}
      <Box size={[W / 2 - 0.4, 0.06, -B.plateauZ]} position={[-W / 4 - 0.2, 0.03, B.plateauZ / 2]} color={C.grass} cast={false} />
      {/* rio a jusante */}
      <Box size={[W / 2, 0.08, 2.2]} position={[-W / 4, 0.05, -2.6]} color={C.water} cast={false} />
      <Box size={[W / 2 + B.spillEnd, 0.08, 1.8]} position={[(-W / 2 + B.spillEnd) / 2, 0.05, zc]} color={C.water} cast={false} />
      {/* platô do vale ao fundo */}
      <Box size={[W, B.plateauH, D + B.plateauZ]} position={[0, B.plateauH / 2, (B.plateauZ - D) / 2]} color="#B47A4E" cast={false} />
      <Box size={[W, 0.1, D + B.plateauZ]} position={[0, B.plateauH + 0.05, (B.plateauZ - D) / 2]} color={C.grass} cast={false} />
      <Box size={[W, 0.5, 0.06]} position={[0, B.plateauH - 0.25, B.plateauZ + 0.02]} color="#8F5634" cast={false} />
      {/* morros distantes */}
      <Prism pts={[[-40, 0], [40, 0], [40, 8], [18, 10.5], [0, 8.5], [-16, 11], [-40, 8.5]]} z0={-62} z1={-58} color={C.grassDark} />
      <Pebbles />
      {scour > 0.01 ? (
        <mesh position={[B.spillEnd - 0.7, 0.1, zc]} scale={[1.6 * scour, 1, 1.1 * scour]}>
          <cylinderGeometry args={[1, 0.6, 0.06, 24]} />
          <meshStandardMaterial color="#4A2E1A" roughness={1} />
        </mesh>
      ) : null}
      {pipe > 0.01 ? (
        <mesh position={[B.up - 4.6 * pipe * 0.5 - 0.4, -1.55, 0.012]}>
          <planeGeometry args={[4.6 * pipe + 0.8, 0.32]} />
          <meshBasicMaterial color="#4A2E1A" />
        </mesh>
      ) : null}
    </group>
  );
};

const Pebbles: React.FC = () => {
  const items = useMemo(() => {
    const r: { p: V3; s: number; c: string }[] = [];
    for (let i = 0; i < 90; i++) {
      const a = Math.sin(i * 91.7) * 4375.1;
      const b = Math.sin(i * 17.3) * 2731.9;
      const x = (a - Math.floor(a)) * 30 - 15;
      const y = -0.2 - (b - Math.floor(b)) * 8.5;
      r.push({ p: [x, y, 0.005], s: 0.05 + ((a * 7) % 1) * 0.07, c: y < B.sand ? "#6F6B66" : y < B.soil ? "#C1955D" : "#8A5232" });
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

// Lago: do paredão até o fim da cena, com nível variável.
export const Lake: React.FC<{ level: number; x0: number; t: number }> = ({ level, x0, t }) => {
  if (level <= 0.02) return null;
  const len = B.lakeEnd - x0;
  const wob = Math.sin(t * 2) * 0.02;
  return (
    <group>
      <mesh position={[x0 + len / 2, (level + wob) / 2, B.plateauZ / 2]}>
        <boxGeometry args={[len, level + wob, -B.plateauZ]} />
        <meshStandardMaterial color={C.water} transparent opacity={0.72} roughness={0.15} depthWrite={false} />
      </mesh>
      <mesh position={[x0 + len / 2, level + wob + 0.002, B.plateauZ / 2]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[len, -B.plateauZ]} />
        <meshStandardMaterial color="#7FC9F5" transparent opacity={0.55} roughness={0.05} metalness={0.1} depthWrite={false} />
      </mesh>
    </group>
  );
};

// Monte de terra (barragem improvisada).
export const Mound: React.FC<{ h: number; wash: number }> = ({ h, wash }) => {
  if (h <= 0.01) return null;
  const hh = h * (1 - wash * 0.85);
  const top = 0.6 + wash * 0.8;
  const pts: [number, number][] = [
    [-1.8 - wash * 2.5, 0],
    [1.4, 0],
    [top / 2, hh],
    [-top / 2 - wash * 1.2, hh * (1 - wash * 0.3)],
  ];
  return <Prism pts={pts} z0={B.zBack} z1={0} color={SOILC} />;
};

// Paredão de concreto: perfil interpola entre retângulo fino e triângulo.
export const Dam: React.FC<{ rise: number; wide: number; tilt?: number; crack?: number; cutoff?: number; z1?: number }> = ({ rise, wide, tilt = 0, crack = 0, cutoff = 0, z1 = 0 }) => {
  if (rise <= 0.01) return null;
  const h = (B.crest + 0.4) * rise;
  const topW = 0.6;
  const baseW = 0.6 + wide * 3.6;
  const y0 = -0.4;
  const pts: [number, number][] = [
    [B.up, y0],
    [B.up, y0 + h],
    [B.up - topW, y0 + h],
    [B.up - baseW, y0],
  ];
  const cut = cutoff * (B.sand - 0.4 - y0);
  return (
    <group rotation={[0, 0, tilt]} position={[B.up - baseW, y0, 0]}>
      <group position={[-(B.up - baseW), -y0, 0]}>
        <Prism pts={pts} z0={B.zBack} z1={z1 + 0.012} color={CONC} />
        {/* juntas de concretagem */}
        {[1, 2, 3].map((k) => {
          const y = y0 + (h * k) / 4;
          const xl = B.up - topW - (baseW - topW) * (1 - k / 4);
          return <Box key={k} size={[B.up - xl, 0.025, 0.01]} position={[(B.up + xl) / 2, y, z1 + 0.006]} color="#BDB7AC" cast={false} />;
        })}
        {/* guarda-corpo */}
        {rise > 0.95 ? <Box size={[0.05, 0.22, -B.zBack]} position={[B.up - 0.05, y0 + h + 0.11, B.zBack / 2]} color="#E8352B" /> : null}
        {/* cortina de vedação até a rocha */}
        {cutoff > 0.01 ? <Box size={[0.32, -cut, -B.zBack + 0.03]} position={[B.up - 0.25, y0 + cut / 2, B.zBack / 2 + 0.015]} color={CONC} /> : null}
        {/* rachadura no pé */}
        {crack > 0.01 ? <CrackLine p={crack} x={B.up - 0.05} y={y0 + 0.05} /> : null}
      </group>
    </group>
  );
};

const CrackLine: React.FC<{ p: number; x: number; y: number }> = ({ p, x, y }) => {
  const pts: [number, number][] = [
    [x, y + 0.1],
    [x - 0.12, y + 0.35],
    [x - 0.04, y + 0.6],
    [x - 0.18, y + 0.85],
    [x - 0.1, y + 1.1],
  ];
  const n = Math.max(2, Math.ceil(pts.length * p));
  const use = pts.slice(0, n);
  return (
    <group>
      {use.slice(0, -1).map((a, i) => {
        const b = use[i + 1];
        const dx = b[0] - a[0];
        const dy = b[1] - a[1];
        return (
          <mesh key={i} position={[(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 0.015]} rotation={[0, 0, Math.atan2(dy, dx)]}>
            <boxGeometry args={[Math.hypot(dx, dy), 0.06, 0.01]} />
            <meshBasicMaterial color="#D2402E" />
          </mesh>
        );
      })}
    </group>
  );
};

// Setas de pressão da água: maiores quanto mais fundo.
export const PressureArrows: React.FC<{ p: number; level: number; t: number }> = ({ p, level, t }) => {
  if (p <= 0.01) return null;
  const rows = 6;
  const items = [];
  for (let i = 0; i < rows; i++) {
    const y = level - ((i + 0.6) / rows) * (level + 0.35);
    const depth = level - y;
    const len = 0.35 + depth * 0.42;
    const k = Math.max(0, Math.min(1, p * rows - i * 0.6));
    const bob = Math.sin(t * 6 + i) * 0.04;
    items.push(
      <group key={i} position={[B.up + 0.15 + len / 2 + bob, y, 0.08]} scale={[k, k, 1]}>
        <mesh>
          <boxGeometry args={[len, 0.11, 0.02]} />
          <meshBasicMaterial color="#FFFFFF" />
        </mesh>
        <mesh position={[-len / 2 - 0.12, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <coneGeometry args={[0.17, 0.26, 3]} />
          <meshBasicMaterial color="#FFFFFF" />
        </mesh>
      </group>,
    );
  }
  return <group>{items}</group>;
};

// Vertedouro na encosta: rampa lisa ou em degraus.
export const Spillway: React.FC<{ p: number; steps: number; t: number; flow: number }> = ({ p, steps, t, flow }) => {
  if (p <= 0.01) return null;
  const x0 = B.up + 0.4;
  const x1 = B.spillEnd;
  const y0 = B.spillLip;
  const zc = (B.spillZ0 + B.spillZ1) / 2;
  const wz = B.spillZ1 - B.spillZ0;
  const len = (x0 - x1) * p;
  const n = 9;
  const pathSmooth: V3[] = [
    [x0 + 1.2, y0 + 0.15, zc],
    [x0, y0 + 0.1, zc],
    [x0 - 1.0, y0 - 0.4, zc],
    [x1 + 1.2, 0.35, zc],
    [x1 - 0.4, 0.2, zc],
  ];
  const pathSteps: V3[] = [[x0 + 1.2, y0 + 0.15, zc]];
  for (let i = 0; i <= n; i++) {
    const x = x0 - ((x0 - x1) * i) / n;
    const y = y0 - (y0 * i) / n;
    pathSteps.push([x, y + 0.18, zc]);
    pathSteps.push([x - ((x0 - x1) / n) * 0.75, y + 0.1, zc]);
  }
  return (
    <group>
      {/* paredes do canal */}
      {[B.spillZ0 - 0.12, B.spillZ1 + 0.12].map((z) => (
        <Prism key={z} pts={[[x0 + 1.4, -0.2], [x0 + 1.4, y0 + 0.6], [x0, y0 + 0.6], [x1, 0.6], [x1, -0.2]]} z0={z - 0.12} z1={z + 0.12} color={CONC} />
      ))}
      {/* fundo: liso ou em degraus */}
      {steps < 0.5 ? (
        <group scale={[1, 1, 1]}>
          <Prism pts={[[x0 + 1.4, -0.2], [x0 + 1.4, y0], [x0, y0], [x0 - len, y0 - (y0 * len) / (x0 - x1)], [x0 - len, -0.2]]} z0={B.spillZ0} z1={B.spillZ1} color="#CFCAC0" />
        </group>
      ) : (
        <group>
          <Prism pts={[[x0 + 1.4, -0.2], [x0 + 1.4, y0], [x0, y0], [x0, -0.2]]} z0={B.spillZ0} z1={B.spillZ1} color="#CFCAC0" />
          {Array.from({ length: n }).map((_, i) => {
            const xa = x0 - ((x0 - x1) * i) / n;
            const xb = x0 - ((x0 - x1) * (i + 1)) / n;
            const y = y0 - (y0 * (i + 1)) / n;
            const k = Math.max(0, Math.min(1, steps * n * 1.2 - i));
            return k > 0 ? <Box key={i} size={[xa - xb, Math.max(0.05, y + 0.2) * k, wz]} position={[(xa + xb) / 2, -0.2 + (Math.max(0.05, y + 0.2) * k) / 2, zc]} color={i % 2 ? "#D5D0C6" : "#CBC5BA"} /> : null;
          })}
        </group>
      )}
      {flow > 0.01 ? (
        <>
          <FlowParticles points={steps < 0.5 ? pathSmooth : pathSteps} t={t} count={70} speed={steps < 0.5 ? 0.55 : 0.32} size={0.11} color={(u) => (u > 0.85 && steps < 0.5 ? "#FFFFFF" : C.water)} jitter={0.6} visible={flow} />
          <FlowParticles points={steps < 0.5 ? pathSmooth : pathSteps} t={t + 0.5} count={40} speed={steps < 0.5 ? 0.6 : 0.3} size={0.08} color="#BFE6FF" jitter={0.8} visible={flow} seed={4} />
        </>
      ) : null}
    </group>
  );
};

// Respingos/erosão no fim do canal.
export const Splash: React.FC<{ t: number; amount: number }> = ({ t, amount }) => {
  if (amount <= 0.01) return null;
  const items = [];
  for (let i = 0; i < 26; i++) {
    const ph = ((t * 1.7 + i * 0.137) % 1 + 1) % 1;
    const ang = i * 2.39;
    const r = ph * 1.4;
    items.push(
      <mesh key={i} position={[B.spillEnd - 0.6 + Math.cos(ang) * r, 0.2 + Math.sin(ph * Math.PI) * 1.4, (B.spillZ0 + B.spillZ1) / 2 + Math.sin(ang) * r * 0.6]}>
        <sphereGeometry args={[0.07 + (i % 3) * 0.03, 8, 6]} />
        <meshStandardMaterial color={i % 2 ? "#FFFFFF" : "#A5DAF8"} transparent opacity={(1 - ph) * amount} />
      </mesh>,
    );
  }
  for (let i = 0; i < 10; i++) {
    const ph = ((t * 1.1 + i * 0.21) % 1 + 1) % 1;
    items.push(
      <mesh key={`r${i}`} position={[B.spillEnd - 0.6 + (i - 5) * 0.25, 0.1 + Math.sin(ph * Math.PI) * 0.9, (B.spillZ0 + B.spillZ1) / 2]} rotation={[i, i, i]}>
        <dodecahedronGeometry args={[0.1, 0]} />
        <meshStandardMaterial color="#6B4A2E" flatShading />
      </mesh>,
    );
  }
  return <group>{items}</group>;
};

// Água infiltrando por baixo do paredão.
export const Seepage: React.FC<{ t: number; amount: number; blocked: number }> = ({ t, amount, blocked }) => {
  if (amount <= 0.01) return null;
  const free: V3[] = [
    [4.5, -0.2, 0.03],
    [2.0, -1.3, 0.03],
    [B.up - 1.5, -1.6, 0.03],
    [B.up - 4.4, -1.2, 0.03],
    [B.up - 5.5, 0.05, 0.03],
  ];
  const stop: V3[] = [
    [4.5, -0.2, 0.03],
    [2.0, -1.3, 0.03],
    [B.up + 0.25, -1.9, 0.03],
    [B.up + 0.2, -2.6, 0.03],
  ];
  return (
    <group>
      {blocked < 0.5 ? (
        <FlowParticles points={free} t={t} count={26} speed={0.28} size={0.07} color={C.water} visible={amount} jitter={0.15} />
      ) : (
        <FlowParticles points={stop} t={t} count={12} speed={0.12} size={0.07} color={C.water} visible={amount * 0.7} jitter={0.12} />
      )}
    </group>
  );
};

// Água passando por cima (galgamento).
export const Overtop: React.FC<{ t: number; amount: number; top: number; x: number }> = ({ t, amount, top, x }) => {
  if (amount <= 0.01) return null;
  return (
    <group>
      <FlowParticles points={[[x + 1.5, top + 0.2, -1.5], [x, top + 0.15, -1.5], [x - 1.6, top * 0.4, -1.5], [x - 6, 0.15, -1.8], [x - 12, 0.1, -2.2]]} t={t} count={90} speed={0.4} size={0.12} color={C.water} jitter={1.6} visible={amount} />
      <FlowParticles points={[[x + 1.5, top + 0.2, -3.5], [x, top + 0.15, -3.5], [x - 1.6, top * 0.4, -3.5], [x - 6, 0.15, -3.0], [x - 12, 0.1, -2.6]]} t={t + 0.3} count={60} speed={0.4} size={0.1} color="#9AD6F7" jitter={1.4} visible={amount} seed={7} />
    </group>
  );
};

// Usina ao pé da barragem + cidade acendendo.
export const PowerPlant: React.FC<{ p: number; t: number; lit: number }> = ({ p, t, lit }) => {
  if (p <= 0.01) return null;
  const x = B.up - 5.0;
  return (
    <group>
      <group position={[x, 0, -2.6]} scale={[p, p, p]}>
        <RBox size={[1.8, 1.4, 2.0]} position={[0, 0.7, 0]} color="#EDE7DA" radius={0.05} />
        <RBox size={[1.9, 0.14, 2.1]} position={[0, 1.46, 0]} color="#5B6470" radius={0.03} />
        {[-0.5, 0, 0.5].map((dz) => (
          <Box key={dz} size={[0.04, 0.3, 0.3]} position={[-0.92, 0.9, dz]} color="#FFD23F" emissive="#FFD23F" emissiveIntensity={lit} />
        ))}
        <Glow position={[-1.0, 0.9, 0]} size={1.8 * lit} color="#FFD23F" opacity={0.5 * lit} />
      </group>
      {/* tubulação forçada atravessando o paredão */}
      <mesh position={[B.up - 2.4, 0.85, -2.6]} rotation={[0, 0, Math.PI / 2 - 0.42]} scale={[p, p, p]}>
        <cylinderGeometry args={[0.22, 0.22, 4.4, 16]} />
        <meshStandardMaterial color="#5C6670" metalness={0.4} roughness={0.5} />
      </mesh>
      {lit > 0.01 ? <FlowParticles points={[[B.up + 0.6, 1.8, -2.6], [B.up - 2.4, 0.85, -2.6], [x + 0.8, 0.5, -2.6]]} t={t} count={18} speed={0.6} size={0.08} color="#BFE6FF" emissive={0.4} visible={lit} /> : null}
      {/* fios até a cidade */}
      {lit > 0.01 ? <FlowParticles points={[[x - 0.9, 1.4, -2.6], [x - 3, 4.0, -6], [x - 5, 6.0, -10], [x - 6, 5.4, -13]]} t={t} count={16} speed={0.5} size={0.08} color="#FFD23F" emissive={1.2} visible={lit} /> : null}
      <group position={[x - 6.5, B.plateauH + 0.1, -14]}>
        {[
          [0, 0, 1.2, 3.2, 1.2, "#E8D9C0"],
          [1.6, 0.4, 1.4, 4.4, 1.2, "#CFE0EC"],
          [3.2, -0.3, 1.1, 2.6, 1.1, "#F1E2C8"],
          [-1.6, 0.2, 1.3, 3.8, 1.2, "#D6E6D1"],
          [4.8, 0.3, 1.2, 3.4, 1.0, "#E9D3C6"],
          [-3.1, -0.2, 1.1, 2.8, 1.1, "#E4DCCB"],
        ].map(([bx, bz, w, h, d, col], i) => (
          <Building key={i} position={[bx as number, 0, bz as number]} size={[w as number, h as number, d as number]} color={col as string} lit={lit} seed={i} />
        ))}
      </group>
    </group>
  );
};

export const Scenery: React.FC<{ t: number }> = ({ t }) => (
  <group>
    <Tree position={[-8.5, 0, -0.8]} scale={1.3} seed={1} />
    <Tree position={[-14, 0, -4.2]} scale={1.6} seed={2} />
    <Tree position={[-11.5, 0, -1.6]} scale={1.2} seed={1.4} />
    <Tree position={[7, B.plateauH, -10.5]} scale={1.6} seed={2.2} />
    <Tree position={[11, B.plateauH, -11]} scale={1.9} seed={1.1} />
    <Tree position={[2, B.plateauH, -10.2]} scale={1.5} seed={0.6} />
    <Tree position={[-2, B.plateauH, -11.5]} scale={1.3} seed={1.6} />
    <Cloud position={[-5 + Math.sin(t * 0.05) * 1.5, 12, -26]} scale={2.4} />
    <Cloud position={[6 + Math.sin(t * 0.04) * 1.5, 14, -32]} scale={3} />
  </group>
);

// Montinhos de terra caindo (construção do monte).
export const DirtDrops: React.FC<{ p: number }> = ({ p }) => {
  if (p <= 0 || p >= 1) return null;
  const items = [];
  for (let i = 0; i < 10; i++) {
    const ph = Math.max(0, Math.min(1, p * 10 - i));
    if (ph <= 0 || ph >= 1) continue;
    items.push(
      <mesh key={i} position={[-0.2 + ((i * 0.37) % 1) - 0.5, 4 * (1 - ph * ph), -0.6 - ((i * 1.3) % 4)]} rotation={[i, i, i]}>
        <dodecahedronGeometry args={[0.35, 0]} />
        <meshStandardMaterial color={SOILC} flatShading />
      </mesh>,
    );
  }
  return <group>{items}</group>;
};
