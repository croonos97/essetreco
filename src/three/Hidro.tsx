import { useMemo } from "react";
import * as THREE from "three";
import { C } from "../theme";
import { Box, Bush, Cloud, FlowParticles, Glow, GroundSlab, Pipe, RBox, Tree } from "./basics";
import { Appear } from "./Jato";

type V3 = [number, number, number];
const COPPER = "#C8743A";
const CONCRETE = "#D4CFC4";
const CONCRETE_DARK = "#B9B3A6";
const WATER = "#3F9BE0";
const ENERGY = "#FFD23F";

// ---------------- bancada ----------------

export const Lamp: React.FC<{ position: V3; on: number; scale?: number; light?: boolean }> = ({ position, on, scale = 1, light = true }) => (
  <group position={position} scale={scale}>
    <RBox size={[0.7, 0.14, 0.7]} position={[0, 0.07, 0]} color={C.wood} radius={0.05} />
    <mesh position={[0, 0.3, 0]} castShadow>
      <cylinderGeometry args={[0.13, 0.15, 0.32, 20]} />
      <meshStandardMaterial color="#B9C1C7" metalness={0.5} roughness={0.35} />
    </mesh>
    <mesh position={[0, 0.72, 0]}>
      <sphereGeometry args={[0.34, 28, 20]} />
      <meshStandardMaterial color={on > 0.05 ? "#FFF6D6" : "#EAF2F5"} transparent opacity={0.55 + on * 0.3} roughness={0.1} emissive="#FFE7A0" emissiveIntensity={on * 1.4} />
    </mesh>
    <mesh position={[0, 0.68, 0]} rotation={[0, 0, Math.PI / 2]}>
      <torusGeometry args={[0.08, 0.012, 6, 16]} />
      <meshStandardMaterial color={on > 0.05 ? "#FFE38A" : "#6D6A63"} emissive="#FFB347" emissiveIntensity={on * 3} />
    </mesh>
    <Glow position={[0, 0.72, 0.1]} size={2.6 * on} color="#FFD98A" opacity={0.8 * on} />
    {light ? <pointLight position={[0, 0.8, 0.3]} intensity={on * 6} distance={7} color="#FFD98A" /> : null}
  </group>
);

// Bobina de cobre (eixo y local).
export const Coil: React.FC<{ glow?: number }> = ({ glow = 0 }) => (
  <group>
    <mesh>
      <cylinderGeometry args={[0.13, 0.13, 0.56, 16]} />
      <meshStandardMaterial color="#5A4A3A" />
    </mesh>
    {Array.from({ length: 10 }, (_, i) => (
      <mesh key={i} position={[0, -0.24 + i * 0.053, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.2, 0.034, 8, 22]} />
        <meshStandardMaterial color={COPPER} metalness={0.6} roughness={0.3} emissive={ENERGY} emissiveIntensity={glow * 0.6} />
      </mesh>
    ))}
  </group>
);

// Ímã em barra: metade vermelha (N), metade azul (S). Eixo y local.
export const Magnet: React.FC<{ len?: number }> = ({ len = 1.0 }) => (
  <group>
    <RBox size={[0.26, len / 2, 0.26]} position={[0, len / 4, 0]} color="#E5392F" radius={0.05} />
    <RBox size={[0.26, len / 2, 0.26]} position={[0, -len / 4, 0]} color="#2F6BE5" radius={0.05} />
  </group>
);

export const GEN = { center: [0.6, 1.45, 0] as V3, r: 0.86 };
export const LAMP_POS: V3 = [-0.95, 0.2, 0.35];

export const BenchGenerator: React.FC<{
  t: number;
  magnetY: number; // deslocamento do ímã solto (cena "mexer")
  shaft: number;
  coils: number[]; // 3 bobinas; a 0 é a de cima
  angle: number;
  crank: number;
  base: number;
  current: number; // corrente nos fios
  magnetP?: number;
}> = ({ t, magnetY, shaft, coils, angle, crank, base, current, magnetP = 1 }) => {
  const [gx, gy, gz] = GEN.center;
  const coilAngles = [Math.PI / 2, Math.PI / 2 + (2 * Math.PI) / 3, Math.PI / 2 + (4 * Math.PI) / 3];
  const wire: V3[] = [
    [gx, gy + GEN.r + 0.3, gz],
    [gx - 0.15, gy + 1.5, gz + 0.1],
    [-0.4, 2.15, 0.3],
    [LAMP_POS[0], 1.75, LAMP_POS[2]],
    [LAMP_POS[0], LAMP_POS[1] + 1.1, LAMP_POS[2]],
  ];
  return (
    <group>
      <Appear p={base}>
        <RBox size={[3.4, 0.2, 1.8]} position={[0.4, 0.1, 0]} color={C.wood} radius={0.05} />
      </Appear>
      {/* bobinas (eixo radial) */}
      {coilAngles.map((a, i) => (
        <group key={i} position={[gx, gy + Math.sin(a) * GEN.r, gz + Math.cos(a) * GEN.r]} rotation={[Math.PI / 2 - a, 0, 0]}>
          <Appear p={coils.at(i) ?? 0} from={[0, 1.2, 0]}>
            <Coil glow={current} />
          </Appear>
        </group>
      ))}
      {/* suportes da bobina de cima e do eixo */}
      <Appear p={coils.at(0) ?? 0}>
        <RBox size={[0.12, gy + GEN.r - 0.2, 0.12]} position={[gx - 0.35, (gy + GEN.r - 0.2) / 2 + 0.2, gz - 0.2]} color="#6E7780" radius={0.03} />
      </Appear>
      <Appear p={shaft}>
        {[-0.35, 1.55].map((x) => (
          <RBox key={x} size={[0.18, gy - 0.2, 0.3]} position={[x, (gy - 0.2) / 2 + 0.2, gz]} color="#6E7780" radius={0.04} />
        ))}
        <mesh position={[0.95, gy, gz]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.05, 0.05, 2.9, 14]} />
          <meshStandardMaterial color="#9AA3AA" metalness={0.6} roughness={0.3} />
        </mesh>
      </Appear>
      {/* ímã: solto (sobe e desce) ou girando no eixo */}
      <group position={[gx, gy + magnetY, gz]} rotation={[angle, 0, 0]}>
        <Appear p={magnetP} from={[0, 0, 1.5]}>
          <Magnet len={1.05} />
        </Appear>
      </group>
      {/* manivela */}
      <group position={[2.4, gy, gz]} rotation={[angle, 0, 0]}>
        <Appear p={crank}>
          <RBox size={[0.1, 0.7, 0.12]} position={[0, 0.3, 0]} color="#C7463A" radius={0.04} />
          <mesh position={[0.18, 0.62, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.07, 0.07, 0.3, 12]} />
            <meshStandardMaterial color="#2E2F33" />
          </mesh>
        </Appear>
      </group>
      {/* fios até a lâmpada */}
      <Appear p={coils.at(0) ?? 0}>
        <Pipe points={wire} radius={0.025} color="#C9472F" />
        <Pipe points={wire.map(([x, y, z]) => [x + 0.08, y, z - 0.08] as V3)} radius={0.025} color="#2E2F33" />
      </Appear>
      <FlowParticles points={wire} t={t} count={16} speed={0.9} size={0.04} color={ENERGY} emissive={1.6} visible={current} />
    </group>
  );
};

// ---------------- vale do rio ----------------

// Planalto (cânion onde fica a represa): corpo de terra + topo de grama + árvores.
const Plateau: React.FC<{ x: number; z0: number; z1: number; w: number; seed?: number }> = ({ x, z0, z1, w, seed = 0 }) => {
  const len = z1 - z0;
  const trees = [];
  for (let i = 0; i < 14; i++) {
    const r1 = Math.abs(Math.sin((i + seed) * 12.9898) * 43758.5) % 1;
    const r2 = Math.abs(Math.sin((i + seed) * 78.233) * 12543.1) % 1;
    trees.push(<Tree key={i} position={[(r1 - 0.5) * (w - 4), 15, -len / 2 + 4 + r2 * (len - 8)]} scale={2 + r1} seed={r2 * 3} />);
  }
  return (
    <group position={[x, 0, (z0 + z1) / 2]}>
      <RBox size={[w, 14.6, len]} position={[0, 7.3, 0]} color={C.dirt} radius={1.2} />
      <RBox size={[w - 0.6, 0.8, len - 0.6]} position={[0, 14.7, 0]} color={C.grass} radius={0.35} />
      {trees}
    </group>
  );
};

// Muro da represa (perfil trapezoidal extrudado ao longo de X).
const DamWall: React.FC<{ rise: number }> = ({ rise }) => {
  const geo = useMemo(() => {
    const sh = new THREE.Shape();
    sh.moveTo(-2.4, 0);
    sh.lineTo(2.6, 0);
    sh.lineTo(1.0, 14);
    sh.lineTo(-0.9, 14);
    sh.closePath();
    const g = new THREE.ExtrudeGeometry(sh, { depth: 34, bevelEnabled: false });
    g.translate(0, 0, -17);
    return g;
  }, []);
  if (rise <= 0.001) return null;
  return (
    <group scale={[1, rise, 1]}>
      <mesh geometry={geo} rotation={[0, -Math.PI / 2, 0]} castShadow receiveShadow>
        <meshStandardMaterial color={CONCRETE} roughness={0.9} />
      </mesh>
      {/* juntas verticais */}
      {Array.from({ length: 9 }, (_, i) => (
        <Box key={i} size={[0.12, 13.6, 0.1]} position={[-16 + i * 4, 7, 1.85 - 0 * 0]} rotation={[-0.115, 0, 0]} color={CONCRETE_DARK} cast={false} />
      ))}
      <RBox size={[34, 0.5, 2.4]} position={[0, 14.2, 0.05]} color={CONCRETE_DARK} radius={0.1} />
    </group>
  );
};

export const TOWERS: V3[] = [
  [13, 0, 20],
  [14.5, 0, 34],
  [16, 0, 48],
  [17.5, 0, 62],
  [19, 0, 76],
];

export const VALLEY = {
  penstock: [
    [0, 11.5, -0.9],
    [0, 9.5, 1.05],
    [0, 5.0, 1.9],
    [0, 2.4, 3.6],
    [0, 1.6, 5.2],
  ] as V3[],
  wheel: [4.6, 1.9, 15] as V3,
  powerhouse: [0, 0, 6.8] as V3,
  yard: [11, 0, 8] as V3,
};

export const Waterwheel: React.FC<{ position: V3; angle: number; p: number }> = ({ position, angle, p }) => (
  <group position={position}>
    <Appear p={p} from={[0, 3, 0]}>
      <group rotation={[angle, 0, 0]}>
        {[-0.45, 0.45].map((x) => (
          <mesh key={x} position={[x, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
            <torusGeometry args={[2.0, 0.09, 8, 32]} />
            <meshStandardMaterial color={C.wood} roughness={0.8} />
          </mesh>
        ))}
        {Array.from({ length: 12 }, (_, i) => (
          <group key={i} rotation={[(i / 12) * Math.PI * 2, 0, 0]}>
            <RBox size={[1.0, 0.7, 0.08]} position={[0, 2.0, 0]} color="#B37A48" radius={0.03} />
            <RBox size={[0.08, 2.0, 0.08]} position={[0.42, 1.0, 0]} color={C.wood} radius={0.02} />
            <RBox size={[0.08, 2.0, 0.08]} position={[-0.42, 1.0, 0]} color={C.wood} radius={0.02} />
          </group>
        ))}
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.18, 0.18, 1.3, 14]} />
          <meshStandardMaterial color="#6E7780" />
        </mesh>
      </group>
      {/* eixo até o gerador na margem */}
      <mesh position={[1.6, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.1, 0.1, 2.6, 12]} />
        <meshStandardMaterial color="#9AA3AA" metalness={0.5} />
      </mesh>
      {[1.0, 2.6].map((x) => (
        <RBox key={x} size={[0.3, 1.9, 0.4]} position={[x, -0.95, 0]} color="#7A6A58" radius={0.05} />
      ))}
    </Appear>
  </group>
);

// Casa de força em corte com turbina (eixo vertical) e gerador.
export const Powerhouse: React.FC<{ p: number; turbAngle: number; genGlow: number; t: number; flow: number }> = ({ p, turbAngle, genGlow, t, flow }) => {
  const [px, , pz] = VALLEY.powerhouse;
  return (
    <group position={[px, 0, pz]}>
      <Appear p={p} from={[0, 4, 0]}>
        {/* paredes: fundo e laterais (frente aberta) */}
        <RBox size={[12, 9, 0.5]} position={[0, 4.5, -2.4]} color="#E7E1D5" radius={0.08} />
        <RBox size={[0.5, 9, 5]} position={[-6, 4.5, 0]} color="#DCD5C7" radius={0.08} />
        <RBox size={[0.5, 9, 5]} position={[6, 4.5, 0]} color="#DCD5C7" radius={0.08} />
        <RBox size={[12.5, 0.5, 5.2]} position={[0, 9.2, 0]} color="#C9C2B4" radius={0.08} />
        <RBox size={[12, 0.3, 5]} position={[0, 3.6, 0]} color="#BDB6A8" radius={0.05} />
        {/* caixa espiral */}
        <mesh position={[0, 1.6, -0.2]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[1.5, 0.45, 12, 32]} />
          <meshStandardMaterial color="#5E7FA8" metalness={0.4} roughness={0.4} transparent opacity={0.55} depthWrite={false} />
        </mesh>
        {/* rotor da turbina */}
        <group position={[0, 1.6, -0.2]} rotation={[0, turbAngle, 0]}>
          <mesh>
            <cylinderGeometry args={[0.35, 0.6, 0.7, 20]} />
            <meshStandardMaterial color="#8D979F" metalness={0.6} roughness={0.3} />
          </mesh>
          {Array.from({ length: 13 }, (_, i) => (
            <group key={i} rotation={[0, (i / 13) * Math.PI * 2, 0]}>
              <mesh position={[0.85, 0, 0]} rotation={[0.6, 0, 0.2]} castShadow>
                <boxGeometry args={[0.7, 0.55, 0.05]} />
                <meshStandardMaterial color="#B8C1C8" metalness={0.6} roughness={0.3} />
              </mesh>
            </group>
          ))}
        </group>
        {/* eixo e gerador */}
        <mesh position={[0, 3.3, -0.2]}>
          <cylinderGeometry args={[0.18, 0.18, 2.6, 14]} />
          <meshStandardMaterial color="#9AA3AA" metalness={0.6} roughness={0.3} />
        </mesh>
        <group position={[0, 5.4, -0.2]}>
          <mesh castShadow>
            <cylinderGeometry args={[2.0, 2.0, 2.2, 32]} />
            <meshStandardMaterial color="#C7463A" roughness={0.5} emissive={ENERGY} emissiveIntensity={genGlow * 0.25} />
          </mesh>
          <group rotation={[0, turbAngle, 0]}>
            {Array.from({ length: 8 }, (_, i) => (
              <group key={i} rotation={[0, (i / 8) * Math.PI * 2, 0]}>
                <RBox size={[0.3, 0.3, 0.3]} position={[1.95, 1.15, 0]} color="#F2C230" radius={0.05} />
              </group>
            ))}
          </group>
          <Glow position={[0, 0, 2.2]} size={4 * genGlow} color={ENERGY} opacity={0.45 * genGlow} />
        </group>
        {/* saída de água (canal de fuga) */}
        <FlowParticles
          points={[
            [0, 1.0, 0.5],
            [0, 0.5, 3],
            [0, 0.3, 8],
            [0, 0.25, 16],
          ]}
          t={t}
          count={40}
          speed={0.6}
          size={0.16}
          color={WATER}
          emissive={0.2}
          visible={flow}
          jitter={1.6}
        />
      </Appear>
    </group>
  );
};

export const Transformer: React.FC<{ position: V3; p: number; glow: number; scale?: number }> = ({ position, p, glow, scale = 1 }) => (
  <group position={position} scale={scale}>
    <Appear p={p} from={[0, 3, 0]}>
      <RBox size={[2.4, 2.4, 1.8]} position={[0, 1.2, 0]} color="#7D8A94" radius={0.1} />
      {Array.from({ length: 7 }, (_, i) => (
        <RBox key={i} size={[0.08, 1.9, 0.6]} position={[-1.0 + i * 0.33, 1.2, 1.15]} color="#6B7780" radius={0.02} />
      ))}
      {[-0.7, 0, 0.7].map((x) => (
        <group key={x} position={[x, 2.4, 0]}>
          {Array.from({ length: 5 }, (_, k) => (
            <mesh key={k} position={[0, 0.15 + k * 0.17, 0]}>
              <cylinderGeometry args={[0.16, 0.16, 0.08, 14]} />
              <meshStandardMaterial color="#8C5A3C" roughness={0.4} />
            </mesh>
          ))}
          <Glow position={[0, 1.1, 0]} size={1.2 * glow} color={ENERGY} opacity={glow * 0.7} />
        </group>
      ))}
    </Appear>
  </group>
);

// Torre de transmissão treliçada (altura ~12).
export const Tower: React.FC<{ position: V3; p: number; rotY?: number }> = ({ position, p, rotY = 0 }) => {
  const leg = (sx: number, sz: number, k: number) => {
    const a: V3 = [sx * 1.6, 0, sz * 1.6];
    const b: V3 = [sx * 0.35, 11.5, sz * 0.35];
    const mid: V3 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const dir = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]).normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    const e = new THREE.Euler().setFromQuaternion(q);
    return (
      <mesh key={k} position={mid} rotation={[e.x, e.y, e.z]} castShadow>
        <boxGeometry args={[0.16, len, 0.16]} />
        <meshStandardMaterial color="#9AA3AA" metalness={0.4} roughness={0.5} />
      </mesh>
    );
  };
  return (
    <group position={position} rotation={[0, rotY, 0]}>
      <Appear p={p} from={[0, 8, 0]}>
        {leg(1, 1, 0)}
        {leg(-1, 1, 1)}
        {leg(1, -1, 2)}
        {leg(-1, -1, 3)}
        {[2.5, 5, 7.5, 10].map((y) => {
          const w = 1.6 - (y / 11.5) * 1.25;
          return (
            <group key={y}>
              <RBox size={[w * 2, 0.1, 0.1]} position={[0, y, w]} color="#9AA3AA" radius={0.02} />
              <RBox size={[w * 2, 0.1, 0.1]} position={[0, y, -w]} color="#9AA3AA" radius={0.02} />
              <RBox size={[0.1, 0.1, w * 2]} position={[w, y, 0]} color="#9AA3AA" radius={0.02} />
              <RBox size={[0.1, 0.1, w * 2]} position={[-w, y, 0]} color="#9AA3AA" radius={0.02} />
            </group>
          );
        })}
        {/* braços */}
        <RBox size={[0.3, 0.3, 7.2]} position={[0, 9.4, 0]} color="#9AA3AA" radius={0.04} />
        <RBox size={[0.3, 0.3, 4.4]} position={[0, 11.6, 0]} color="#9AA3AA" radius={0.04} />
        {([-3.4, 0, 3.4] as number[]).map((z, i) => (
          <mesh key={z} position={[0, i === 1 ? 11.0 : 8.8, i === 1 ? 0 : z]}>
            <cylinderGeometry args={[0.12, 0.12, 1.1, 10]} />
            <meshStandardMaterial color="#5C88B0" roughness={0.3} />
          </mesh>
        ))}
      </Appear>
    </group>
  );
};

// Pontos das três fases nos braços de uma torre (para os cabos).
export const towerPhases = (pos: V3, rotY = 0): V3[] => {
  const pts: V3[] = [
    [0, 8.25, -3.4],
    [0, 10.45, 0],
    [0, 8.25, 3.4],
  ];
  return pts.map(([x, y, z]) => [pos[0] + x * Math.cos(rotY) + z * Math.sin(rotY), pos[1] + y, pos[2] - x * Math.sin(rotY) + z * Math.cos(rotY)] as V3);
};

// Cabo com barriga entre dois pontos.
export const sag = (a: V3, b: V3, depth: number, n = 10): V3[] =>
  Array.from({ length: n + 1 }, (_, i) => {
    const u = i / n;
    return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u - Math.sin(u * Math.PI) * depth, a[2] + (b[2] - a[2]) * u] as V3;
  });

export const Building: React.FC<{ position: V3; size: V3; color: string; lit: number; seed: number }> = ({ position, size, color, lit, seed }) => {
  const [w, h, d] = size;
  const wins = [];
  const cols = Math.max(2, Math.floor(w / 1.1));
  const rows = Math.max(1, Math.floor(h / 1.4));
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const on = Math.abs(Math.sin((r + 1) * 12.9 + (c + 1) * 7.3 + seed)) > 0.35;
      wins.push(
        <mesh key={`${r}_${c}`} position={[-w / 2 + (c + 0.5) * (w / cols), 0.9 + r * 1.4, d / 2 + 0.02]}>
          <boxGeometry args={[0.55, 0.7, 0.04]} />
          <meshStandardMaterial color={on && lit > 0.5 ? "#FFE3A0" : "#3E5874"} emissive={on ? "#FFC860" : "#000"} emissiveIntensity={on ? lit * 1.6 : 0} />
        </mesh>,
      );
    }
  }
  return (
    <group position={position}>
      <RBox size={[w, h, d]} position={[0, h / 2, 0]} color={color} radius={0.08} />
      {wins}
    </group>
  );
};

export const CITY = {
  sub: [20, 0, 88] as V3,
  house: [12, 0, 100] as V3,
  buildings: [
    [26, 96, 5, 9, 5, "#E7DCCB"],
    [33, 94, 6, 13, 6, "#D9DFE6"],
    [40, 98, 5, 8, 5, "#EED6C4"],
    [28, 104, 4, 6, 4, "#E2E6D3"],
    [36, 106, 6, 11, 5, "#E7D7EE"],
    [44, 104, 5, 15, 5, "#D3DAE2"],
    [47, 94, 6, 10, 6, "#EAD9C0"],
    [22, 112, 5, 7, 5, "#DDE7D8"],
    [31, 114, 6, 12, 6, "#E4DDF0"],
    [40, 116, 5, 7, 5, "#F0DCCB"],
    [50, 112, 6, 9, 6, "#E7DCCB"],
    [18, 104, 4, 5, 4, "#EED6C4"],
  ] as [number, number, number, number, number, string][],
};

export const City: React.FC<{ lit: number }> = ({ lit }) => (
  <group>
    {CITY.buildings.map(([x, z, w, h, d, col], i) => (
      <Building key={i} position={[x, 0, z]} size={[w, h, d]} color={col} lit={lit} seed={i} />
    ))}
    <Box size={[50, 0.04, 2.6]} position={[33, 0.03, 101]} color={C.street} cast={false} />
    <Box size={[2.6, 0.04, 34]} position={[24, 0.03, 104]} color={C.street} cast={false} />
  </group>
);

// Casa do Tião com lâmpada na varanda.
export const PorchHouse: React.FC<{ position: V3; on: number }> = ({ position, on }) => (
  <group position={position}>
    <RBox size={[5, 3.2, 4]} position={[0, 1.6, 0]} color="#F0DCCB" radius={0.06} />
    <mesh position={[0, 3.9, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
      <coneGeometry args={[3.7, 1.6, 4]} />
      <meshStandardMaterial color={C.roof} flatShading />
    </mesh>
    <RBox size={[1.0, 2.0, 0.1]} position={[-1.1, 1.0, 2.02]} color={C.wood} radius={0.03} />
    <RBox size={[1.3, 1.0, 0.1]} position={[1.0, 1.8, 2.02]} color={on > 0.5 ? "#FFE3A0" : "#BFE3F7"} radius={0.03} emissive="#FFC860" emissiveIntensity={on * 1.4} />
    <Lamp position={[0.1, 2.25, 2.25]} on={on} scale={0.55} />
  </group>
);

export const Valley: React.FC<{
  t: number;
  river: number; // força da correnteza 0..1
  dam: number; // 0..1 subindo
  reservoir: number; // 0..1 nível
  wheelP: number;
  wheelAngle: number;
}> = ({ t, river, dam, reservoir, wheelP, wheelAngle }) => {
  const level = 0.08 + reservoir * 12.8;
  const down = Math.max(0.15, 1 - reservoir * 0.85);
  return (
    <group>
      <GroundSlab w={400} d={400} />
      {/* rio a jusante */}
      <Box size={[10, 0.06, 400]} position={[0, 0.06, 200]} color={WATER} cast={false} opacity={0.4 + 0.5 * down} />
      {/* rio/represa a montante */}
      <mesh position={[0, level / 2, -75]} receiveShadow>
        <boxGeometry args={[34.2, level, 152]} />
        <meshStandardMaterial color={WATER} roughness={0.15} transparent opacity={0.88} />
      </mesh>
      <Plateau x={-37} z0={-160} z1={1.6} w={40} seed={1} />
      <Plateau x={37} z0={-160} z1={1.6} w={40} seed={5} />
      <Plateau x={0} z0={-200} z1={-150} w={114} seed={9} />
      <DamWall rise={dam} />
      {/* correnteza */}
      {[-3, -1, 1, 3].map((x, i) => (
        <FlowParticles key={i} points={[[x, 0.18, -30], [x, 0.18, 10], [x, 0.18, 60]]} t={t} count={36} speed={0.05 + 0.1 * river} size={0.13} color="#CFEFFF" emissive={0.2} visible={river * (1 - dam)} seed={i} jitter={0.3} />
      ))}
      <Waterwheel position={VALLEY.wheel} angle={wheelAngle} p={wheelP} />
      {/* entorno a jusante */}
      {(
        [
          [-12, 22, 2.2, 0.3],
          [-16, 34, 2.6, 1.4],
          [14, 26, 2.1, 2.2],
          [-20, 12, 2.4, 0.8],
          [18, 40, 2.4, 1.8],
          [-10, 46, 2.0, 2.6],
        ] as number[][]
      ).map(([x, z, s, r]) => (
        <Tree key={`${x}${z}`} position={[x, 0, z]} scale={s} seed={r} />
      ))}
      {([[-7, 0, 18], [8, 0, 21], [-8, 0, 30]] as V3[]).map((p) => (
        <Bush key={p.join()} position={p} scale={2} />
      ))}
      <Cloud position={[-20 + ((t * 0.4) % 30), 32, -80]} scale={6} />
      <Cloud position={[30 + ((t * 0.3) % 30), 36, -90]} scale={7} />
      <Cloud position={[60 + ((t * 0.3) % 20), 30, -40]} scale={5} />
    </group>
  );
};
