import { useMemo } from "react";
import * as THREE from "three";
import { C } from "../theme";
import { Box, Cloud, FlowParticles, Glow, Pipe, RBox, Tree } from "./basics";

type V3 = [number, number, number];

// Geometria do bunker (corte em z = 0; tudo vai de z = -D até 0).
export const G = {
  D: 3.4,
  xo: 2.3, // face externa das paredes
  xi: 2.0, // face interna
  floor: -3.9,
  floorBot: -4.2,
  roofTop: -1.0, // 1 metro de terra por cima
  roofIn: -1.3,
  wallTopArch: -2.0,
  shaftX0: -1.95,
  shaftX1: -0.75,
  shaftZ: -1.35,
  pipeIn: 0.95,
  pipeOut: 1.7,
  pipeZ: -0.28,
  tunX0: 2.3,
  tunX1: 6.4,
  tunY0: -3.9,
  tunY1: -2.75,
  exitX0: 5.3,
  exitX1: 6.4,
  tunZ: -1.1,
};

const CONC = "#DAD6CE";
const CONC_CUT = "#CFC9BE";
const REBAR = "#7B3A26";
const SOIL = [
  { top: 0, bot: -0.12, color: C.grass },
  { top: -0.12, bot: -1.5, color: "#A8673E" },
  { top: -1.5, bot: -4.7, color: "#E0B679" },
  { top: -4.7, bot: -16, color: "#9C968E" },
];
const soilAt = (y: number) => (SOIL.find((s) => y <= s.top && y > s.bot) ?? SOIL[SOIL.length - 1]).color;

export type Hole = { x0: number; x1: number; y0: number; y1: number; d: number };

// Terreno em corte com buracos escavados a partir da face frontal (z=0).
export const Earth: React.FC<{ holes: Hole[]; w?: number; back?: number }> = ({ holes, w = 13, back = 12 }) => {
  const cells = useMemo(() => {
    const xs = Array.from(new Set([-w, w, ...holes.flatMap((h) => [h.x0, h.x1])].map((v) => Math.max(-w, Math.min(w, v))))).sort((a, b) => a - b);
    const ys = Array.from(new Set([0, -16, ...SOIL.map((s) => s.bot), ...holes.flatMap((h) => [h.y0, h.y1])].map((v) => Math.max(-16, Math.min(0, v))))).sort((a, b) => a - b);
    const out: { x: number; y: number; sx: number; sy: number; z0: number; color: string }[] = [];
    for (let i = 0; i < xs.length - 1; i++)
      for (let j = 0; j < ys.length - 1; j++) {
        const cx = (xs[i] + xs[i + 1]) / 2;
        const cy = (ys[j] + ys[j + 1]) / 2;
        let d = 0;
        for (const h of holes) if (cx > h.x0 && cx < h.x1 && cy > h.y0 && cy < h.y1) d = Math.max(d, h.d);
        if (d >= back) continue;
        out.push({ x: cx, y: cy, sx: xs[i + 1] - xs[i], sy: ys[j + 1] - ys[j], z0: d, color: soilAt(cy) });
      }
    return out;
  }, [JSON.stringify(holes), w, back]);
  return (
    <group>
      {cells.map((c, i) => (
        <mesh key={i} position={[c.x, c.y, -(c.z0 + back) / 2]} receiveShadow castShadow={false}>
          <boxGeometry args={[c.sx, c.sy, back - c.z0]} />
          <meshStandardMaterial color={c.color} roughness={1} />
        </mesh>
      ))}
      {/* grama ao fundo e nas laterais */}
      <mesh position={[0, -0.06, -back - 40]} receiveShadow>
        <boxGeometry args={[160, 0.12, 80]} />
        <meshStandardMaterial color={C.grass} roughness={1} />
      </mesh>
    </group>
  );
};

// Pedrinhas no corte de terra (dá textura de diorama).
export const Pebbles: React.FC<{ holes?: Hole[] }> = ({ holes = [] }) => {
  const items = useMemo(() => {
    const r: { p: V3; s: number }[] = [];
    for (let i = 0; i < 70; i++) {
      const a = Math.sin(i * 91.7) * 4375.1;
      const b = Math.sin(i * 17.3) * 2731.9;
      const x = (a - Math.floor(a)) * 24 - 12;
      const y = -1.6 - (b - Math.floor(b)) * 6.2;
      if (holes.some((h) => x > h.x0 - 0.15 && x < h.x1 + 0.15 && y > h.y0 - 0.15 && y < h.y1 + 0.15)) continue;
      r.push({ p: [x, y, 0.005], s: 0.04 + ((a * 7) % 1) * 0.05 });
    }
    return r;
  }, [JSON.stringify(holes)]);
  return (
    <group>
      {items.map((it, i) => (
        <mesh key={i} position={it.p} rotation={[0, 0, i]}>
          <circleGeometry args={[it.s, 5]} />
          <meshStandardMaterial color={it.p[1] < -4.7 ? "#7E786F" : "#C99A5E"} roughness={1} />
        </mesh>
      ))}
    </group>
  );
};

// Casinha do quintal.
export const Casinha: React.FC<{ position?: V3; rotation?: number }> = ({ position = [0, 0, 0], rotation = 0 }) => {
  const roof = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(-2.15, 0);
    s.lineTo(0, 1.35);
    s.lineTo(2.15, 0);
    s.closePath();
    return new THREE.ExtrudeGeometry(s, { depth: 3.4, bevelEnabled: false });
  }, []);
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <RBox size={[3.8, 2.4, 3.0]} position={[0, 1.2, 0]} color="#C9654A" radius={0.03} />
      <mesh geometry={roof} position={[0, 2.4, -1.7]} castShadow>
        <meshStandardMaterial color="#F4F1EA" roughness={0.8} />
      </mesh>
      <mesh position={[0, 2.38, -1.72]} rotation={[0, 0, 0]}>
        <boxGeometry args={[4.5, 0.08, 0.04]} />
        <meshStandardMaterial color="#3F4A5A" />
      </mesh>
      {/* telhado escuro */}
      {[-1, 1].map((k) => (
        <mesh key={k} position={[k * 1.08, 3.08, 0]} rotation={[0, 0, -k * 0.56]} castShadow>
          <boxGeometry args={[2.62, 0.1, 3.5]} />
          <meshStandardMaterial color="#3E4A5C" roughness={0.7} />
        </mesh>
      ))}
      <Box size={[0.75, 1.5, 0.06]} position={[0.9, 0.75, 1.52]} color="#8A5A34" />
      <Box size={[0.9, 0.75, 0.06]} position={[-0.8, 1.4, 1.52]} color="#BFE3F2" />
      <Box size={[1.0, 0.08, 0.1]} position={[-0.8, 1.0, 1.55]} color="#F4F1EA" />
      {/* faixas de tijolo */}
      {[0.3, 0.6, 0.9, 1.2, 1.5, 1.8, 2.1].map((y) => (
        <Box key={y} size={[3.82, 0.015, 3.02]} position={[0, y, 0]} color="#B4573E" cast={false} />
      ))}
    </group>
  );
};

export const Yard: React.FC<{ t: number }> = ({ t }) => (
  <group>
    <Casinha position={[-1.2, 0, -8.5]} rotation={0.18} />
    <Tree position={[-6.5, 0, -6]} scale={1.5} seed={1} />
    <Tree position={[5.8, 0, -9]} scale={1.8} seed={2} />
    <Tree position={[8.5, 0, -5.5]} scale={1.3} seed={1.5} />
    <Tree position={[-9.5, 0, -12]} scale={1.9} seed={2.4} />
    {/* cerca */}
    {Array.from({ length: 22 }).map((_, i) => (
      <Box key={i} size={[0.1, 0.8, 0.06]} position={[-11 + i * 1.05, 0.4, -12]} color="#E9E2D3" />
    ))}
    <Box size={[23, 0.07, 0.05]} position={[0, 0.62, -11.97]} color="#E9E2D3" />
    <Cloud position={[-4 + Math.sin(t * 0.05) * 1.5, 9, -24]} scale={2.2} />
    <Cloud position={[6 + Math.sin(t * 0.04) * 1.5, 11, -30]} scale={2.8} />
    <Cloud position={[0.5, 13, -38]} scale={2.4} />
  </group>
);

// Chuva: riscos caindo num volume.
export const Rain: React.FC<{ t: number; amount: number; x0?: number; x1?: number; z0?: number; z1?: number; top?: number; floor?: number }> = ({
  t,
  amount,
  x0 = -7,
  x1 = 7,
  z0 = -6,
  z1 = 1.5,
  top = 7,
  floor = 0,
}) => {
  if (amount <= 0.01) return null;
  const n = Math.round(160 * amount);
  const drops = [];
  for (let i = 0; i < n; i++) {
    const a = Math.sin(i * 12.9898) * 43758.5453;
    const b = Math.sin(i * 78.233) * 12543.1;
    const c = Math.sin(i * 39.425) * 9123.7;
    const fx = a - Math.floor(a);
    const fz = b - Math.floor(b);
    const ph = c - Math.floor(c);
    const y = floor + (top - floor) * (1 - ((t * 1.6 + ph) % 1));
    drops.push(
      <mesh key={i} position={[x0 + (x1 - x0) * fx, y, z0 + (z1 - z0) * fz]}>
        <boxGeometry args={[0.018, 0.42, 0.018]} />
        <meshBasicMaterial color="#DCEBFA" transparent opacity={0.75} />
      </mesh>,
    );
  }
  return <group>{drops}</group>;
};

// Gaiola de ferragem (aparece de baixo para cima).
export const Rebar: React.FC<{ p: number; top?: number }> = ({ p, top = G.roofIn }) => {
  if (p <= 0) return null;
  const h = (top - G.floorBot) * p;
  const rods = [];
  const zs = [-3.15, -2.55, -1.95, -1.35, -0.75, -0.2];
  for (const x of [-G.xi - 0.15, G.xi + 0.15]) for (const z of zs) rods.push(<Box key={`v${x}${z}`} size={[0.035, h, 0.035]} position={[x, G.floorBot + h / 2, z]} color={REBAR} cast={false} />);
  const rings = [];
  for (let y = G.floorBot + 0.15; y < G.floorBot + h; y += 0.45) {
    for (const x of [-G.xi - 0.15, G.xi + 0.15]) rings.push(<Box key={`h${x}${y}`} size={[0.03, 0.03, G.D - 0.2]} position={[x, y, -G.D / 2]} color={REBAR} cast={false} />);
  }
  // malha do piso
  const mesh = [];
  for (let x = -2.1; x <= 2.11; x += 0.42) mesh.push(<Box key={`fx${x}`} size={[0.03, 0.03, G.D - 0.2]} position={[x, G.floorBot + 0.12, -G.D / 2]} color={REBAR} cast={false} />);
  for (const z of zs) mesh.push(<Box key={`fz${z}`} size={[4.3, 0.03, 0.03]} position={[0, G.floorBot + 0.12, z]} color={REBAR} cast={false} />);
  return (
    <group>
      {rods}
      {rings}
      {mesh}
    </group>
  );
};

// Pontinhos de ferro no corte do concreto.
const RebarDots: React.FC<{ x0: number; x1: number; y0: number; y1: number; horizontal?: boolean }> = ({ x0, x1, y0, y1, horizontal }) => {
  const dots = [];
  if (horizontal) {
    for (let x = x0 + 0.15; x < x1 - 0.05; x += 0.35) dots.push(<Box key={x} size={[0.06, 0.06, 0.01]} position={[x, (y0 + y1) / 2, 0.006]} color={REBAR} cast={false} />);
  } else {
    for (let y = y0 + 0.15; y < y1 - 0.05; y += 0.35) dots.push(<Box key={y} size={[0.06, 0.06, 0.01]} position={[(x0 + x1) / 2, y, 0.006]} color={REBAR} cast={false} />);
  }
  return <group>{dots}</group>;
};

// Abóbada: arco externo passa por (±xo, wallTopArch) e (0, roofTop); interno por (±xi, wallTopArch) e (0, roofIn).
const arcY = (x: number, half: number, base: number, top: number) => {
  const rise = top - base;
  const R = (half * half + rise * rise) / (2 * rise);
  const cy = top - R;
  return cy + Math.sqrt(Math.max(0, R * R - x * x));
};
export const archOuter = (x: number) => arcY(x, G.xo, G.wallTopArch, G.roofTop);
export const archInner = (x: number) => (Math.abs(x) >= G.xi ? G.wallTopArch : arcY(x, G.xi, G.wallTopArch, G.roofIn));

const ringShape = (xa: number, xb: number, outer: (x: number) => number, inner: (x: number) => number, n = 40) => {
  const s = new THREE.Shape();
  for (let i = 0; i <= n; i++) {
    const x = xa + ((xb - xa) * i) / n;
    if (i === 0) s.moveTo(x, outer(x));
    else s.lineTo(x, outer(x));
  }
  for (let i = n; i >= 0; i--) {
    const x = xa + ((xb - xa) * i) / n;
    s.lineTo(x, inner(x));
  }
  s.closePath();
  return s;
};

const Extruded: React.FC<{ shape: THREE.Shape; z0: number; z1: number; color: string; opacity?: number }> = ({ shape, z0, z1, color, opacity = 1 }) => {
  const geo = useMemo(() => new THREE.ExtrudeGeometry(shape, { depth: z1 - z0, bevelEnabled: false, curveSegments: 24 }), [shape, z0, z1]);
  return (
    <mesh geometry={geo} position={[0, 0, z0]} castShadow receiveShadow>
      <meshStandardMaterial color={color} roughness={0.85} transparent={opacity < 1} opacity={opacity} />
    </mesh>
  );
};

// Terra que preenche os cantos acima da abóbada até o nível do teto plano.
export const ArchFill: React.FC = () => {
  const [a, b] = useMemo(
    () => [ringShape(-G.xo - 0.1, G.shaftX0, () => G.roofTop, archOuter), ringShape(G.shaftX1, G.xo + 0.1, () => G.roofTop, archOuter)],
    [],
  );
  const c = useMemo(() => ringShape(G.shaftX0, G.shaftX1, () => G.roofTop, archOuter), []);
  return (
    <group>
      <Extruded shape={a} z0={-G.D - 0.1} z1={0} color={soilAt(-1.6)} />
      <Extruded shape={b} z0={-G.D - 0.1} z1={0} color={soilAt(-1.6)} />
      <Extruded shape={c} z0={-G.D - 0.1} z1={G.shaftZ} color={soilAt(-1.6)} />
    </group>
  );
};

// Rachaduras (linhas vermelhas no corte).
export const Crack: React.FC<{ points: [number, number][]; p: number; z?: number; color?: string }> = ({ points, p, z = 0.012, color = "#D2402E" }) => {
  if (p <= 0) return null;
  const n = Math.max(2, Math.ceil(points.length * p));
  const pts = points.slice(0, n);
  return (
    <group>
      {pts.slice(0, -1).map((a, i) => {
        const b = pts[i + 1];
        const dx = b[0] - a[0];
        const dy = b[1] - a[1];
        const len = Math.hypot(dx, dy);
        return (
          <mesh key={i} position={[(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, z]} rotation={[0, 0, Math.atan2(dy, dx)]}>
            <boxGeometry args={[len, 0.05, 0.01]} />
            <meshBasicMaterial color={color} />
          </mesh>
        );
      })}
    </group>
  );
};

export type ShellProps = {
  build: number; // 0..1 concretagem subindo
  arch: boolean;
  sag?: number; // afundamento do teto reto
  crack?: number;
  manta?: number;
  roofOn?: number;
};

// Caixa de concreto armado em corte.
export const Shell: React.FC<ShellProps> = ({ build, arch, sag = 0, crack = 0, manta = 0, roofOn = 1 }) => {
  const wallTop = arch ? G.wallTopArch : G.roofIn;
  const wallH = (wallTop - G.floor) * Math.min(1, build * 1.25);
  const ringA = useMemo(() => ringShape(-G.xo, G.shaftX0, archOuter, archInner), []);
  const ringB = useMemo(() => ringShape(G.shaftX1, G.xo, archOuter, archInner), []);
  const ringC = useMemo(() => ringShape(G.shaftX0, G.shaftX1, archOuter, archInner), []);
  const roofP = Math.max(0, Math.min(1, (build - 0.8) / 0.2)) * roofOn;
  const mantaT = 0.07;
  if (build <= 0) return null;
  return (
    <group>
      {/* piso */}
      <Box size={[2 * G.xo, G.floor - G.floorBot, G.D]} position={[0, (G.floor + G.floorBot) / 2, -G.D / 2]} color={CONC} />
      <Box size={[2 * G.xi, 0.01, G.D - 0.3]} position={[0, G.floor + 0.006, -G.D / 2 - 0.15]} color="#BFC7CC" cast={false} />
      {/* paredes */}
      {[-1, 1].map((k) => (
        <Box key={k} size={[G.xo - G.xi, wallH, G.D]} position={[k * (G.xo + G.xi) / 2, G.floor + wallH / 2, -G.D / 2]} color={CONC} />
      ))}
      <Box size={[2 * G.xi, wallH, 0.3]} position={[0, G.floor + wallH / 2, -G.D + 0.15]} color="#E6E2DA" />
      <RebarDots x0={-G.xo} x1={-G.xi} y0={G.floor} y1={G.floor + wallH} />
      <RebarDots x0={G.xi} x1={G.xo} y0={G.floor} y1={G.floor + wallH} />
      <RebarDots x0={-G.xo} x1={G.xo} y0={G.floorBot} y1={G.floor} horizontal />
      {/* teto */}
      {roofP > 0 && !arch ? (
        <group scale={[1, roofP, 1]} position={[0, G.roofIn * (1 - roofP), 0]}>
          {/* duas metades que podem ceder no meio */}
          {[-1, 1].map((k) => {
            const xs = k < 0 ? [-G.xo, 0] : [0, G.xo];
            return (
              <group key={k} position={[k * G.xo, G.roofIn, 0]} rotation={[0, 0, k * sag]}>
                {/* trecho com abertura da escada só na metade esquerda */}
                {k < 0 ? (
                  <>
                    <Box size={[G.shaftX0 + G.xo, 0.3, G.D]} position={[(-G.xo + G.shaftX0) / 2 + G.xo, 0.15, -G.D / 2]} color={CONC} />
                    <Box size={[G.shaftX1 - G.shaftX0, 0.3, G.D + G.shaftZ]} position={[(G.shaftX0 + G.shaftX1) / 2 + G.xo, 0.15, (-G.D + G.shaftZ) / 2]} color={CONC} />
                    <Box size={[-G.shaftX1, 0.3, G.D]} position={[G.shaftX1 / 2 + G.xo, 0.15, -G.D / 2]} color={CONC} />
                  </>
                ) : (
                  <Box size={[xs[1] - xs[0], 0.3, G.D]} position={[-G.xo / 2, 0.15, -G.D / 2]} color={CONC} />
                )}
              </group>
            );
          })}
        </group>
      ) : null}
      {roofP > 0 && arch ? (
        <group scale={[1, 1, 1]}>
          <Extruded shape={ringA} z0={-G.D} z1={0} color={CONC} opacity={1} />
          <Extruded shape={ringB} z0={-G.D} z1={0} color={CONC} />
          <Extruded shape={ringC} z0={-G.D} z1={G.shaftZ} color={CONC} />
          {/* ferragem acompanhando o arco */}
          {Array.from({ length: 11 }).map((_, i) => {
            const x = -2.05 + i * 0.41;
            const y = (archOuter(x) + archInner(x)) / 2;
            return <Box key={i} size={[0.06, 0.06, 0.01]} position={[x, y, 0.006]} color={REBAR} cast={false} />;
          })}
        </group>
      ) : null}
      {/* rachaduras do teto reto */}
      {!arch ? (
        <>
          <Crack p={crack} points={[[-0.1, G.roofIn - 0.02 - sag * 2.2], [0.06, G.roofIn + 0.1 - sag * 2.2], [-0.08, G.roofIn + 0.2 - sag * 2.2], [0.07, G.roofIn + 0.32 - sag * 2.2]]} />
          <Crack p={crack} points={[[0.9, G.roofIn - sag * 1.2], [1.02, G.roofIn + 0.12 - sag * 1.2], [0.86, G.roofIn + 0.24 - sag * 1.2], [0.98, G.roofIn + 0.32 - sag * 1.2]]} />
          <Crack p={crack} points={[[-0.75, G.roofIn - sag * 1.4], [-0.66, G.roofIn + 0.14 - sag * 1.4], [-0.8, G.roofIn + 0.28 - sag * 1.4]]} />
        </>
      ) : null}
      {/* manta impermeável envolvendo a caixa */}
      {manta > 0 ? (
        <group>
          {[-1, 1].map((k) => {
            const top = arch ? G.wallTopArch : G.roofTop;
            const h = (top - G.floorBot + mantaT) * Math.min(1, manta * 1.6);
            return <Box key={k} size={[mantaT, h, G.D + mantaT]} position={[k * (G.xo + mantaT / 2), G.floorBot - mantaT + h / 2, -G.D / 2]} color="#2C2F36" />;
          })}
          <Box size={[2 * G.xo + 2 * mantaT, mantaT, G.D + mantaT]} position={[0, G.floorBot - mantaT / 2, -G.D / 2]} color="#2C2F36" />
          <Box size={[2 * G.xo, (G.roofTop - G.floorBot) * Math.min(1, manta * 1.6), mantaT]} position={[0, G.floorBot + ((G.roofTop - G.floorBot) * Math.min(1, manta * 1.6)) / 2, -G.D - mantaT / 2]} color="#2C2F36" />
          {manta > 0.6 && arch ? <MantaArch p={(manta - 0.6) / 0.4} /> : null}
        </group>
      ) : null}
    </group>
  );
};

const MantaArch: React.FC<{ p: number }> = ({ p }) => {
  const xa = -G.xo - 0.07;
  const xb = -G.xo - 0.07 + (2 * G.xo + 0.14) * Math.min(1, p);
  const outer = (x: number) => archOuter(Math.max(-G.xo, Math.min(G.xo, x))) + 0.07;
  const inner = (x: number) => archOuter(Math.max(-G.xo, Math.min(G.xo, x)));
  const parts = [
    [xa, Math.min(xb, G.shaftX0), -G.D - 0.07, 0],
    [G.shaftX0, Math.min(xb, G.shaftX1), -G.D - 0.07, G.shaftZ],
    [G.shaftX1, xb, -G.D - 0.07, 0],
  ].filter(([a, b]) => b > a + 0.01);
  return (
    <group>
      {parts.map(([a, b, z0, z1], i) => (
        <MantaPiece key={`${i}-${b.toFixed(2)}`} a={a} b={b} z0={z0} z1={z1} outer={outer} inner={inner} />
      ))}
    </group>
  );
};
const MantaPiece: React.FC<{ a: number; b: number; z0: number; z1: number; outer: (x: number) => number; inner: (x: number) => number }> = ({ a, b, z0, z1, outer, inner }) => {
  const shape = useMemo(() => ringShape(a, b, outer, inner, 24), [a, b]);
  return <Extruded shape={shape} z0={z0} z1={z1} color="#2C2F36" />;
};

// Poço da entrada (sobe do teto até o chão; pode ganhar gola acima do chão).
export const Shaft: React.FC<{ arch: boolean; collar?: number; p?: number }> = ({ arch, collar = 0, p = 1 }) => {
  if (p <= 0) return null;
  const mid = (G.shaftX0 + G.shaftX1) / 2;
  const yb = arch ? archInner(G.shaftX0 + 0.15) : G.roofIn;
  const top = collar;
  const h = top - yb;
  const t = 0.15;
  return (
    <group>
      {[G.shaftX0 + t / 2, G.shaftX1 - t / 2].map((x) => (
        <Box key={x} size={[t, h, -G.shaftZ]} position={[x, yb + h / 2, G.shaftZ / 2]} color={CONC} />
      ))}
      <Box size={[G.shaftX1 - G.shaftX0, h, t]} position={[mid, yb + h / 2, G.shaftZ + t / 2]} color={CONC} />
      <RebarDots x0={G.shaftX0} x1={G.shaftX0 + t} y0={yb} y1={top} />
      <RebarDots x0={G.shaftX1 - t} x1={G.shaftX1} y0={yb} y1={top} />
    </group>
  );
};

// Escada de marinheiro.
export const Ladder: React.FC<{ top?: number }> = ({ top = 0 }) => {
  const x = (G.shaftX0 + G.shaftX1) / 2;
  const h = top - G.floor;
  const rungs = [];
  for (let y = G.floor + 0.3; y < top - 0.05; y += 0.3) rungs.push(<Box key={y} size={[0.5, 0.035, 0.035]} position={[x, y, -0.95]} color="#2E3138" />);
  return (
    <group>
      {[-0.25, 0.25].map((d) => (
        <Box key={d} size={[0.05, h, 0.05]} position={[x + d, G.floor + h / 2, -0.95]} color="#2E3138" />
      ))}
      {rungs}
    </group>
  );
};

// Tampa de aço com dobradiça no fundo.
export const Hatch: React.FC<{ collar: number; open: number; shake?: number; t: number }> = ({ collar, open, shake = 0, t }) => {
  const mid = (G.shaftX0 + G.shaftX1) / 2;
  const jig = shake ? Math.sin(t * 40) * 0.025 * shake : 0;
  return (
    <group position={[mid, collar + 0.05 + Math.abs(jig), G.shaftZ]} rotation={[-open * 1.9, 0, 0]}>
      <RBox size={[1.3, 0.1, 1.42]} position={[0, 0, 0.68]} color="#6E7781" metalness={0.5} roughness={0.4} radius={0.02} />
      <Box size={[1.24, 0.03, 1.36]} position={[0, -0.06, 0.68]} color="#1C1E22" cast={false} />
      <Box size={[0.35, 0.06, 0.06]} position={[0, 0.08, 1.2]} color="#3C434B" />
    </group>
  );
};

// Móveis e itens dentro do bunker.
export const Interior: React.FC<{ t: number; flame: number; haze: number; arch: boolean }> = ({ t, flame, haze, arch }) => {
  const fy = G.floor;
  const flick = 1 + Math.sin(t * 23) * 0.08 + Math.sin(t * 37) * 0.05;
  return (
    <group>
      {/* mesa */}
      <Box size={[1.1, 0.06, 0.7]} position={[0.1, fy + 0.78, -1.9]} color={C.wood} />
      {[
        [-0.4, -2.15],
        [0.6, -2.15],
        [-0.4, -1.65],
        [0.6, -1.65],
      ].map(([x, z], i) => (
        <Box key={i} size={[0.06, 0.76, 0.06]} position={[x, fy + 0.38, z]} color={C.wood} />
      ))}
      {/* vela */}
      <mesh position={[0.25, fy + 0.9, -1.85]} castShadow>
        <cylinderGeometry args={[0.05, 0.05, 0.2, 12]} />
        <meshStandardMaterial color="#F5EFE2" />
      </mesh>
      {flame > 0.02 ? (
        <>
          <mesh position={[0.25, fy + 1.06 + 0.03 * flame, -1.85]} scale={[0.045 * flame, 0.11 * flame * flick, 0.045 * flame]}>
            <sphereGeometry args={[1, 12, 10]} />
            <meshBasicMaterial color="#FFB43A" />
          </mesh>
          <Glow position={[0.25, fy + 1.08, -1.8]} size={1.4 * flame} color="#FFB43A" opacity={0.55 * flame} />
          <pointLight position={[0.25, fy + 1.2, -1.6]} intensity={3 * flame} distance={4} color="#FFB060" />
        </>
      ) : null}
      {/* cama */}
      <Box size={[1.0, 0.4, 2.0]} position={[1.45, fy + 0.2, -2.25]} color="#5D7A55" />
      <Box size={[0.95, 0.14, 1.95]} position={[1.45, fy + 0.47, -2.25]} color="#E8E4DA" />
      {/* prateleira com mantimentos */}
      <Box size={[1.6, 0.05, 0.35]} position={[-0.4, fy + 1.5, -3.05]} color={C.wood} />
      <Box size={[1.6, 0.05, 0.35]} position={[-0.4, fy + 1.0, -3.05]} color={C.wood} />
      {[-1.0, -0.7, -0.4, -0.1, 0.2].map((x, i) => (
        <mesh key={i} position={[x, fy + 1.66, -3.05]}>
          <cylinderGeometry args={[0.08, 0.08, 0.28, 12]} />
          <meshStandardMaterial color={i % 2 ? "#2F7FD1" : "#3FA8F0"} roughness={0.3} />
        </mesh>
      ))}
      {[-0.95, -0.6, -0.25, 0.1].map((x, i) => (
        <Box key={i} size={[0.22, 0.26, 0.2]} position={[x, fy + 1.16, -3.05]} color={i % 2 ? "#D8693B" : "#F2C230"} />
      ))}
      {/* ar viciado */}
      {haze > 0.01 ? (
        <mesh position={[0, (G.floor + (arch ? G.roofIn : G.roofIn)) / 2, -G.D / 2]}>
          <boxGeometry args={[2 * G.xi - 0.02, G.roofIn - G.floor - 0.02, G.D - 0.02]} />
          <meshStandardMaterial color="#8E8A84" transparent opacity={0.45 * haze} depthWrite={false} roughness={1} />
        </mesh>
      ) : null}
    </group>
  );
};

// Respiros: canos em J saindo na superfície.
export const Vents: React.FC<{ t: number; p: number; flow: number; arch: boolean }> = ({ t, p, flow }) => {
  if (p <= 0) return null;
  const z = G.pipeZ;
  const up = 0.2 + 0.9 * Math.min(1, p);
  const inP: V3[] = [
    [G.pipeIn, G.floor + 0.55, z],
    [G.pipeIn, G.roofIn, z],
    [G.pipeIn, up, z],
    [G.pipeIn - 0.22, up + 0.24, z],
    [G.pipeIn - 0.44, up, z],
  ];
  const outP: V3[] = [
    [G.pipeOut, G.roofIn - 0.15, z],
    [G.pipeOut, up + 0.35, z],
    [G.pipeOut + 0.22, up + 0.59, z],
    [G.pipeOut + 0.44, up + 0.35, z],
  ];
  return (
    <group>
      <Pipe points={inP} radius={0.075} color="#EEF1F2" segments={80} />
      <Pipe points={outP} radius={0.075} color="#EEF1F2" segments={80} />
      {/* filtro */}
      <mesh position={[G.pipeIn, G.floor + 0.42, z]} castShadow>
        <cylinderGeometry args={[0.19, 0.19, 0.42, 20]} />
        <meshStandardMaterial color="#6C7276" roughness={0.6} />
      </mesh>
      <Box size={[0.4, 0.05, 0.4]} position={[G.pipeIn, G.floor + 0.6, z]} color="#4A4F53" />
      {flow > 0 ? (
        <>
          <FlowParticles points={[...inP].reverse()} t={t} count={18} speed={0.32} size={0.05} color="#9FE0FF" emissive={0.5} visible={flow} />
          <FlowParticles points={outP} t={t} count={16} speed={0.3} size={0.06} color="#8D8780" visible={flow} />
        </>
      ) : null}
    </group>
  );
};

// Túnel de fuga até o outro lado do quintal.
export const Tunnel: React.FC<{ p: number }> = ({ p }) => {
  if (p <= 0) return null;
  const len = (G.tunX1 - G.tunX0) * Math.min(1, p * 1.4);
  const up = Math.max(0, (p - 0.7) / 0.3);
  const z = G.tunZ;
  const tt = 0.13;
  const h = -G.tunY1 + 0.05;
  return (
    <group>
      <Box size={[len, tt, -z]} position={[G.tunX0 + len / 2, G.tunY0 - tt / 2, z / 2]} color={CONC} />
      <Box size={[Math.max(0, len - (G.exitX1 - G.exitX0) * (len > G.exitX0 - G.tunX0 ? 1 : 0)), tt, -z]} position={[G.tunX0 + Math.max(0, len - (len > G.exitX0 - G.tunX0 ? G.exitX1 - G.exitX0 : 0)) / 2, G.tunY1 + tt / 2, z / 2]} color={CONC} />
      <Box size={[len, G.tunY1 - G.tunY0, tt]} position={[G.tunX0 + len / 2, (G.tunY0 + G.tunY1) / 2, z + tt / 2]} color="#E6E2DA" />
      {up > 0 ? (
        <group>
          {[G.exitX0 + tt / 2, G.exitX1 - tt / 2].map((x, i) => (
            <Box key={x} size={[tt, (h + (i === 0 ? 0 : G.tunY1 - G.tunY0)) * up, -z]} position={[x, (i === 0 ? G.tunY1 : G.tunY0) + ((h + (i === 0 ? 0 : G.tunY1 - G.tunY0)) * up) / 2, z / 2]} color={CONC} />
          ))}
          <Box size={[G.exitX1 - G.exitX0, (0.05 - G.tunY0) * up, tt]} position={[(G.exitX0 + G.exitX1) / 2, G.tunY0 + ((0.05 - G.tunY0) * up) / 2, z + tt / 2]} color="#E6E2DA" />
          {up > 0.95 ? <RBox size={[1.15, 0.08, 1.15]} position={[(G.exitX0 + G.exitX1) / 2, 0.1, z / 2 - 0.05]} color="#6E7781" metalness={0.5} roughness={0.4} radius={0.02} /> : null}
        </group>
      ) : null}
    </group>
  );
};

// Árvore que tomba (pivô na base).
export const FallingTree: React.FC<{ fall: number; position: V3 }> = ({ fall, position }) => (
  <group position={position} rotation={[0, 0, -fall * 1.43]}>
    <Tree position={[0, 0, 0]} scale={1.75} seed={2} />
  </group>
);

// Água: gotas descendo pela terra e pingando dentro.
export const Seep: React.FC<{ t: number; amount: number; arch: boolean }> = ({ t, amount }) => {
  if (amount <= 0.01) return null;
  const cols = [-1.4, -0.6, 0.1, 0.7, 1.4];
  return (
    <group>
      {cols.map((x, i) => (
        <FlowParticles key={i} points={[[x, 0, 0.03], [x + 0.08, -0.5, 0.03], [x - 0.05, archOuter(x) + 0.02, 0.03]]} t={t + i * 0.37} count={7} speed={0.5} size={0.05} color={C.water} visible={amount} />
      ))}
      {[-0.55, 0.4, 1.15].map((x, i) => (
        <FlowParticles key={`d${i}`} points={[[x, archInner(x) - 0.02, -1.2 - i * 0.4], [x, G.floor + 0.05, -1.2 - i * 0.4]]} t={t + i * 0.21} count={4} speed={0.9} size={0.045} color={C.water} visible={amount} />
      ))}
    </group>
  );
};

// Enxurrada: água correndo pelo chão e descendo pelo poço.
export const Flood: React.FC<{ t: number; amount: number; level: number }> = ({ t, amount, level }) => {
  const mid = (G.shaftX0 + G.shaftX1) / 2;
  return (
    <group>
      {amount > 0.01 ? (
        <>
          <FlowParticles points={[[-6, 0.06, -0.5], [-3.5, 0.06, -0.6], [mid - 0.3, 0.04, -0.7], [mid, -0.2, -0.7], [mid, G.floor + 0.1, -0.6]]} t={t} count={60} speed={0.45} size={0.07} color={C.water} jitter={0.25} visible={amount} />
          <FlowParticles points={[[5, 0.06, -0.4], [2, 0.06, -0.5], [mid + 0.3, 0.04, -0.7], [mid, -0.2, -0.7], [mid, G.floor + 0.1, -0.5]]} t={t + 0.3} count={50} speed={0.4} size={0.07} color={C.water} jitter={0.25} visible={amount} seed={3} />
        </>
      ) : null}
      {level > 0.005 ? (
        <mesh position={[0, G.floor + level / 2, -G.D / 2]}>
          <boxGeometry args={[2 * G.xi - 0.02, level, G.D - 0.32]} />
          <meshStandardMaterial color={C.water} transparent opacity={0.6} roughness={0.2} depthWrite={false} />
        </mesh>
      ) : null}
    </group>
  );
};

// Setas do peso da terra / caminho da força no arco.
export const LoadArrows: React.FC<{ p: number; t: number }> = ({ p, t }) => {
  if (p <= 0.01) return null;
  const bob = (Math.sin(t * 5) + 1) * 0.06;
  return (
    <group>
      <mesh position={[0, (G.roofTop + 0) / 2, 0.02]}>
        <planeGeometry args={[4.6, -G.roofTop]} />
        <meshBasicMaterial color="#FFD23F" transparent opacity={0.45 * p} depthWrite={false} />
      </mesh>
      {[-1.4, 0, 1.4].map((x) => (
        <group key={x} position={[x, -0.35 - bob, 0.06]} scale={p}>
          <mesh position={[0, 0.12, 0]}>
            <boxGeometry args={[0.12, 0.3, 0.02]} />
            <meshBasicMaterial color="#E8352B" />
          </mesh>
          <mesh position={[0, -0.12, 0]} rotation={[0, 0, Math.PI]}>
            <coneGeometry args={[0.18, 0.24, 3]} />
            <meshBasicMaterial color="#E8352B" />
          </mesh>
        </group>
      ))}
    </group>
  );
};

export const ArchFlow: React.FC<{ t: number; p: number }> = ({ t, p }) => {
  if (p <= 0.01) return null;
  const mk = (s: number): V3[] => {
    const pts: V3[] = [];
    for (let i = 0; i <= 10; i++) {
      const x = s * (0.05 + (i / 10) * 2.1);
      pts.push([x, (archOuter(x) + archInner(x)) / 2, 0.04]);
    }
    pts.push([s * 2.15, G.wallTopArch - 0.6, 0.04]);
    pts.push([s * 2.15, G.floor - 0.1, 0.04]);
    return pts;
  };
  return (
    <group>
      <FlowParticles points={mk(-1)} t={t} count={16} speed={0.35} size={0.07} color="#FF8A1E" emissive={0.6} visible={p} />
      <FlowParticles points={mk(1)} t={t + 0.5} count={16} speed={0.35} size={0.07} color="#FF8A1E" emissive={0.6} visible={p} />
    </group>
  );
};

// Pedaços de terra desabando para dentro do buraco.
export const Collapse: React.FC<{ p: number }> = ({ p }) => {
  if (p <= 0) return null;
  const chunks = [];
  for (let i = 0; i < 18; i++) {
    const side = i % 2 ? 1 : -1;
    const a = Math.sin(i * 51.7) * 3711.3;
    const f = a - Math.floor(a);
    const start: V3 = [side * (1.8 + f * 0.25), -0.3 - f * 1.6, -0.3 - ((i * 0.37) % 2.1)];
    const end: V3 = [side * (0.2 + f * 1.2), -2.0 + (i % 5) * 0.12, start[2]];
    const q = Math.max(0, Math.min(1, p * 1.6 - (i % 6) * 0.1));
    const e = q * q;
    chunks.push(
      <mesh key={i} position={[start[0] + (end[0] - start[0]) * e, start[1] + (end[1] - start[1]) * e, start[2]]} rotation={[i, i * 2, q * 3]} castShadow>
        <dodecahedronGeometry args={[0.22 + f * 0.18, 0]} />
        <meshStandardMaterial color={i % 3 ? "#A8673E" : "#8F5634"} flatShading roughness={1} />
      </mesh>,
    );
  }
  return <group>{chunks}</group>;
};

// Pá enterrada ao lado do buraco.
export const Shovel: React.FC<{ position: V3 }> = ({ position }) => (
  <group position={position} rotation={[0.2, 0, -0.35]}>
    <Box size={[0.06, 1.3, 0.06]} position={[0, 0.65, 0]} color={C.wood} />
    <Box size={[0.32, 0.4, 0.04]} position={[0, -0.1, 0]} color="#8B949C" />
  </group>
);
