import { useMemo } from "react";
import * as THREE from "three";
import { C } from "../theme";
import { Box, Cloud, FlowParticles, Glow, GroundSlab, Pipe, RBox, Tree } from "./basics";

type V3 = [number, number, number];

const METAL = "#C3CBD2";
const METAL_DARK = "#8D979F";
const TITANIUM = "#B8A98C";
const HOT_METAL = "#B9785A";
const HOT = "#FF7A1A";

// Peça que "encaixa" caindo de cima com leve exagero. p já vem com pop().
export const Appear: React.FC<{ p: number; children: React.ReactNode; from?: V3 }> = ({ p, children, from = [0, 2.2, 0] }) => {
  if (p <= 0.001) return null;
  const k = 1 - Math.min(p, 1.2);
  return (
    <group position={[from[0] * k, from[1] * k, from[2] * k]} scale={0.55 + 0.45 * Math.min(p, 1.1)}>
      {children}
    </group>
  );
};

// Disco de pás (girando em torno do eixo X).
export const BladeDisc: React.FC<{ rHub: number; rTip: number; n: number; angle: number; color?: string; chord?: number; twist?: number; hubLen?: number }> = ({
  rHub,
  rTip,
  n,
  angle,
  color = METAL,
  chord = 0.12,
  twist = 0.55,
  hubLen = 0.16,
}) => {
  const blades = [];
  const len = rTip - rHub;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    blades.push(
      <group key={i} rotation={[a, 0, 0]}>
        <mesh position={[0, rHub + len / 2, 0]} rotation={[0, twist, 0]} castShadow>
          <boxGeometry args={[chord, len, 0.025]} />
          <meshStandardMaterial color={color} metalness={0.55} roughness={0.32} />
        </mesh>
      </group>,
    );
  }
  return (
    <group rotation={[angle, 0, 0]}>
      <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[rHub, rHub, hubLen, 24]} />
        <meshStandardMaterial color={METAL_DARK} metalness={0.6} roughness={0.3} />
      </mesh>
      {blades}
    </group>
  );
};

// Casca cilíndrica em corte (só a metade de trás, eixo X).
const Shell: React.FC<{ x0: number; x1: number; r0: number; r1?: number; color?: string; opacity?: number; cut?: boolean }> = ({ x0, x1, r0, r1, color = METAL, opacity = 1, cut = true }) => {
  const len = x1 - x0;
  const rb = r1 ?? r0;
  return (
    <group position={[(x0 + x1) / 2, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
      <mesh castShadow receiveShadow>
        <cylinderGeometry args={[rb, r0, len, 56, 1, true, cut ? Math.PI / 2 : 0, cut ? Math.PI : Math.PI * 2]} />
        <meshStandardMaterial color={color} metalness={0.2} roughness={0.5} side={THREE.DoubleSide} transparent={opacity < 1} opacity={opacity} depthWrite={opacity >= 1} />
      </mesh>
    </group>
  );
};

// Pontos ao longo do motor (x, raio). k = lado (+1 em cima, -1 embaixo).
const corePath = (k: number, z = -0.02): V3[] =>
  [
    [-4.6, 0.62],
    [-2.6, 0.58],
    [-1.9, 0.5],
    [-0.5, 0.33],
    [-0.15, 0.36],
    [0.5, 0.4],
    [1.0, 0.38],
    [1.6, 0.36],
    [2.55, 0.3],
  ].map(([x, r]) => [x, r * k, z] as V3);

export type JetState = {
  stands?: number;
  core?: number; // casca do núcleo
  comp?: number[]; // 6 estágios do compressor (0..1 cada)
  chamber?: number;
  nozzle?: number;
  turbine?: number[]; // 3 estágios (2 últimos = cata-ventos do fan)
  shaft?: number;
  fan?: number;
  nacelle?: number;
  compAngle?: number;
  turbAngle?: number;
  fanAngle?: number;
  airIn?: number;
  fuel?: number;
  flame?: number;
  hotGas?: number;
  jet?: number;
  bypass?: number;
  shaftGlow?: number;
  noise?: number;
  cut?: boolean;
};

export const JetEngine: React.FC<{ t: number; s: JetState; position?: V3; scale?: number; rotation?: V3 }> = ({ t, s, position = [0, 0, 0], scale = 1, rotation }) => {
  const comp = s.comp ?? [];
  const turb = s.turbine ?? [];
  const cut = s.cut ?? true;
  const ca = s.compAngle ?? 0;
  const fa = s.fanAngle ?? 0;
  const flame = s.flame ?? 0;
  const compStages = [
    [-1.75, 0.58],
    [-1.5, 0.54],
    [-1.25, 0.5],
    [-1.0, 0.46],
    [-0.75, 0.42],
    [-0.5, 0.39],
  ];
  const turbStages = [
    [1.0, 0.44, HOT_METAL],
    [1.28, 0.5, TITANIUM],
    [1.52, 0.56, TITANIUM],
  ] as [number, number, string][];

  const coreColor = (u: number) => {
    const c = new THREE.Color("#FFFFFF");
    if (u < 0.45) return "#" + c.lerp(new THREE.Color("#FFE7A8"), u / 0.45).getHexString();
    const h = new THREE.Color("#FFB347").lerp(new THREE.Color(HOT), Math.min(1, (u - 0.45) / 0.3));
    return "#" + h.getHexString();
  };

  return (
    <group position={position} scale={scale} rotation={rotation}>
      {/* suportes */}
      <Appear p={s.stands ?? 0}>
        {[-1.6, 1.4].map((x) => (
          <group key={x}>
            <RBox size={[0.22, 1.3, 0.22]} position={[x, -1.05, -0.2]} color="#3E4650" radius={0.05} />
            <RBox size={[1.0, 0.12, 0.9]} position={[x, -1.66, -0.2]} color="#3E4650" radius={0.04} />
          </group>
        ))}
      </Appear>

      {/* casca do núcleo */}
      <Appear p={s.core ?? 0} from={[0, 0, -2]}>
        <Shell x0={-2.05} x1={-0.25} r0={0.64} r1={0.48} cut={cut} />
        <Shell x0={-0.25} x1={0.85} r0={0.55} cut={cut} color="#B9C0C6" />
        <Shell x0={0.85} x1={1.75} r0={0.6} cut={cut} color={HOT_METAL} />
      </Appear>

      {/* compressor: 6 estágios, um menor que o outro */}
      {compStages.map(([x, r], i) => (
        <group key={i} position={[x, 0, 0]}>
          <Appear p={comp.at(i) ?? 0}>
            <BladeDisc rHub={0.16} rTip={r - 0.04} n={22 - i} angle={ca * (1 + i * 0.05)} color={i % 2 ? "#D5DCE1" : METAL} chord={0.1} />
          </Appear>
        </group>
      ))}

      {/* câmara de combustão */}
      <group position={[0.3, 0, 0]}>
        <Appear p={s.chamber ?? 0}>
          <mesh rotation={[0, Math.PI / 2, 0]}>
            <torusGeometry args={[0.36, 0.11, 14, 40]} />
            <meshStandardMaterial color="#D8DDE1" metalness={0.4} roughness={0.35} transparent opacity={0.55} depthWrite={false} />
          </mesh>
          {/* bicos de combustível */}
          {Array.from({ length: 8 }, (_, i) => {
            const a = (i / 8) * Math.PI * 2;
            return (
              <group key={i} position={[-0.35, Math.cos(a) * 0.36, Math.sin(a) * 0.36]}>
                <mesh rotation={[0, 0, Math.PI / 2]}>
                  <cylinderGeometry args={[0.03, 0.04, 0.16, 8]} />
                  <meshStandardMaterial color="#7C858D" metalness={0.6} roughness={0.3} />
                </mesh>
              </group>
            );
          })}
          {/* gotas de combustível */}
          {(s.fuel ?? 0) > 0.01
            ? Array.from({ length: 24 }, (_, i) => {
                const a = (i % 8) / 8 * Math.PI * 2;
                const u = ((i / 24 + t * 2.2) % 1 + 1) % 1;
                return (
                  <mesh key={i} position={[-0.27 + u * 0.4, Math.cos(a) * (0.36 + u * 0.04), Math.sin(a) * (0.36 + u * 0.04)]} scale={(1 - u) * 0.035 * (s.fuel ?? 0)}>
                    <sphereGeometry args={[1, 8, 6]} />
                    <meshStandardMaterial color="#F6D44A" emissive="#F6D44A" emissiveIntensity={0.4} />
                  </mesh>
                );
              })
            : null}
          {/* chamas */}
          {flame > 0.01
            ? Array.from({ length: 36 }, (_, i) => {
                const a = (i / 36) * Math.PI * 2 + Math.sin(t * 3 + i) * 0.1;
                const u = ((i * 0.37 + t * 3.1) % 1 + 1) % 1;
                const r = 0.3 + Math.sin(i * 7.1) * 0.08;
                return (
                  <mesh key={`f${i}`} position={[-0.15 + u * 0.55, Math.cos(a) * r, Math.sin(a) * r]} scale={(0.025 + (1 - u) * 0.035) * flame}>
                    <icosahedronGeometry args={[1, 0]} />
                    <meshStandardMaterial color={u < 0.4 ? "#FFE38A" : HOT} emissive={u < 0.4 ? "#FFD050" : HOT} emissiveIntensity={1.6} />
                  </mesh>
                );
              })
            : null}
          <Glow position={[0.1, 0, 0.2]} size={1.3 * flame} color={HOT} opacity={0.4 * flame} />
        </Appear>
      </group>

      {/* turbina: 1º estágio gira o compressor; os outros, o fan */}
      {turbStages.map(([x, r, col], i) => (
        <group key={i} position={[x, 0, 0]}>
          <Appear p={turb.at(i) ?? 0}>
            <BladeDisc rHub={0.18} rTip={r - 0.05} n={26} angle={i === 0 ? s.turbAngle ?? ca : fa * 1.2} color={col} chord={0.09} twist={-0.6} />
          </Appear>
        </group>
      ))}

      {/* eixo */}
      <Appear p={s.shaft ?? 0} from={[0, 0, 1.5]}>
        <mesh position={[-0.35, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.06, 0.06, 4.6, 16]} />
          <meshStandardMaterial color="#9AA3AA" metalness={0.7} roughness={0.25} emissive={C.energy} emissiveIntensity={(s.shaftGlow ?? 0) * 1.2} />
        </mesh>
      </Appear>
      <FlowParticles
        points={[
          [1.05, 0.09, 0.05],
          [-2.4, 0.09, 0.05],
        ]}
        t={t}
        count={18}
        speed={0.7}
        size={0.045}
        color={C.energy}
        emissive={1.4}
        visible={s.shaftGlow ?? 0}
      />

      {/* bocal */}
      <Appear p={s.nozzle ?? 0} from={[2, 0, 0]}>
        <Shell x0={1.75} x1={2.6} r0={0.6} r1={0.38} cut={cut} color={HOT_METAL} />
        <group position={[2.25, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
          <mesh castShadow>
            <coneGeometry args={[0.22, 0.9, 24]} />
            <meshStandardMaterial color={METAL_DARK} metalness={0.5} roughness={0.35} />
          </mesh>
        </group>
      </Appear>

      {/* fan gigante + nacele */}
      <group position={[-2.55, 0, 0]}>
        <Appear p={s.fan ?? 0} from={[-2.5, 0, 0]}>
          <BladeDisc rHub={0.3} rTip={1.22} n={24} angle={fa} color="#E8ECEF" chord={0.36} twist={0.85} hubLen={0.3} />
          <group position={[-0.3, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <mesh castShadow>
              <coneGeometry args={[0.32, 0.5, 28]} />
              <meshStandardMaterial color="#E8ECEF" metalness={0.4} roughness={0.35} />
            </mesh>
            <mesh position={[0, 0.05, 0.31]} rotation={[0, 0, 0]}>
              <torusGeometry args={[0.12, 0.02, 6, 20]} />
              <meshStandardMaterial color={C.ink} />
            </mesh>
          </group>
        </Appear>
      </group>
      <Appear p={s.nacelle ?? 0} from={[0, 0, -2.5]}>
        <Shell x0={-3.05} x1={0.55} r0={1.32} r1={1.15} cut={cut} color="#F1F3F5" />
        <Shell x0={-3.05} x1={-2.9} r0={1.42} cut={cut} color="#2B5FD9" />
      </Appear>

      {/* fluxos */}
      {[1, 0.55, -0.55, -1].map((k, i) => (
        <FlowParticles key={`in${i}`} points={corePath(k).slice(0, 5)} t={t} count={22} speed={0.45} size={0.04} color={(u) => coreColor(u * 0.45)} emissive={0.35} visible={s.airIn ?? 0} seed={i + 1} />
      ))}
      {[1, 0.55, -0.55, -1].map((k, i) => (
        <FlowParticles key={`hot${i}`} points={corePath(k).slice(4)} t={t} count={14} speed={0.9} size={0.035} color={(u) => coreColor(0.45 + u * 0.55)} emissive={1.3} visible={s.hotGas ?? 0} seed={i + 9} />
      ))}
      {[0.3, 0.15, 0, -0.15, -0.3].map((y, i) => (
        <FlowParticles
          key={`jet${i}`}
          points={[
            [2.5, y, -0.02],
            [4.5, y * 1.5, -0.02],
            [7.0, y * 2.2, -0.02],
          ]}
          t={t}
          count={22}
          speed={1.4}
          size={0.06}
          color={(u) => "#" + new THREE.Color(HOT).lerp(new THREE.Color("#FFD9A0"), u).getHexString()}
          emissive={1.4}
          visible={s.jet ?? 0}
          seed={i + 20}
          jitter={0.06}
        />
      ))}
      <Glow position={[3.0, 0, 0]} size={1.8 * (s.jet ?? 0)} color={HOT} opacity={0.4 * (s.jet ?? 0)} />
      {[1, -1].map((k, i) => (
        <FlowParticles
          key={`by${i}`}
          points={[
            [-4.6, 1.0 * k, -0.02],
            [-2.6, 0.95 * k, -0.02],
            [-1.2, 0.9 * k, -0.02],
            [0.55, 0.88 * k, -0.02],
            [3.0, 0.95 * k, -0.02],
            [5.5, 1.1 * k, -0.02],
          ]}
          t={t}
          count={40}
          speed={0.5}
          size={0.05}
          color="#7FD3FF"
          emissive={0.6}
          visible={s.bypass ?? 0}
          seed={i + 40}
        />
      ))}
      {/* ondas de barulho */}
      {(s.noise ?? 0) > 0.01
        ? [0, 1, 2].map((i) => {
            const u = ((t * 0.9 + i / 3) % 1 + 1) % 1;
            return (
              <mesh key={i} position={[3 + u * 1.5, 0, 0]} rotation={[0, Math.PI / 2, 0]} scale={0.4 + u * 2.2}>
                <torusGeometry args={[1, 0.03, 6, 40]} />
                <meshStandardMaterial color={C.bad} emissive={C.bad} emissiveIntensity={0.8} transparent opacity={(1 - u) * (s.noise ?? 0)} depthWrite={false} />
              </mesh>
            );
          })
        : null}
    </group>
  );
};

// Avião de passageiros low-poly (eixo X, nariz em -X).
export const Airliner: React.FC<{ t: number; engines: number; fanAngle?: number; jet?: number; position?: V3; rotation?: V3; scale?: number; gear?: boolean }> = ({
  t,
  engines,
  fanAngle = 0,
  jet = 0,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1,
  gear = true,
}) => {
  const wingGeo = useMemo(() => {
    const sh = new THREE.Shape();
    sh.moveTo(0, 0);
    sh.lineTo(1.8, 0);
    sh.lineTo(3.4, 6.5);
    sh.lineTo(2.7, 6.5);
    sh.closePath();
    return new THREE.ExtrudeGeometry(sh, { depth: 0.14, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 2 });
  }, []);
  const tailGeo = useMemo(() => {
    const sh = new THREE.Shape();
    sh.moveTo(0, 0);
    sh.lineTo(1.8, 0);
    sh.lineTo(2.3, 2.4);
    sh.lineTo(1.5, 2.4);
    sh.closePath();
    return new THREE.ExtrudeGeometry(sh, { depth: 0.12, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 2 });
  }, []);
  const stabGeo = useMemo(() => {
    const sh = new THREE.Shape();
    sh.moveTo(0, 0);
    sh.lineTo(1.1, 0);
    sh.lineTo(1.7, 2.2);
    sh.lineTo(1.2, 2.2);
    sh.closePath();
    return new THREE.ExtrudeGeometry(sh, { depth: 0.08, bevelEnabled: false });
  }, []);
  const windows = [];
  for (let i = 0; i < 22; i++) {
    for (const side of [1, -1]) {
      windows.push(
        <mesh key={`${i}${side}`} position={[-4.2 + i * 0.4, 0.28, side * 0.985]} rotation={[0, side > 0 ? 0 : Math.PI, 0]}>
          <boxGeometry args={[0.16, 0.22, 0.02]} />
          <meshStandardMaterial color="#2C3E57" roughness={0.2} />
        </mesh>,
      );
    }
  }
  const pods: V3[] = [
    [-0.6, -1.15, 3.0],
    [-0.6, -1.15, -3.0],
  ];
  return (
    <group position={position} rotation={rotation} scale={scale}>
      {/* fuselagem */}
      <mesh rotation={[0, 0, Math.PI / 2]} castShadow receiveShadow>
        <cylinderGeometry args={[1, 1, 11, 32]} />
        <meshStandardMaterial color="#F7F8FA" roughness={0.45} />
      </mesh>
      <mesh position={[-5.5, 0, 0]} scale={[1.9, 1, 1]} castShadow>
        <sphereGeometry args={[1, 32, 20, 0, Math.PI * 2, 0, Math.PI]} />
        <meshStandardMaterial color="#F7F8FA" roughness={0.45} />
      </mesh>
      <mesh position={[7.1, 0.35, 0]} rotation={[0, 0, Math.PI / 2 + 0.12]} castShadow>
        <coneGeometry args={[1, 3.4, 32]} />
        <meshStandardMaterial color="#F7F8FA" roughness={0.45} />
      </mesh>
      {/* faixa e janelas */}
      <mesh rotation={[0, 0, Math.PI / 2]} position={[0, -0.05, 0]}>
        <cylinderGeometry args={[1.005, 1.005, 11, 32, 1, true, 0, Math.PI * 2]} />
        <meshStandardMaterial color="#F7F8FA" transparent opacity={0} />
      </mesh>
      {[1, -1].map((side) => (
        <mesh key={side} position={[0.5, -0.25, side * 0.99]} rotation={[0, side > 0 ? 0 : Math.PI, 0]}>
          <boxGeometry args={[12, 0.16, 0.02]} />
          <meshStandardMaterial color="#2B5FD9" />
        </mesh>
      ))}
      {windows}
      {/* cabine */}
      {[0.32, -0.32].map((z) => (
        <mesh key={z} position={[-6.55, 0.4, z]} rotation={[0, z > 0 ? -0.5 : 0.5, 0]}>
          <boxGeometry args={[0.04, 0.22, 0.38]} />
          <meshStandardMaterial color="#2C3E57" roughness={0.2} />
        </mesh>
      ))}
      {/* asas */}
      <mesh geometry={wingGeo} position={[-1.6, -0.55, 0.6]} rotation={[Math.PI / 2, 0, 0]} scale={[1, 1, 1]} castShadow>
        <meshStandardMaterial color="#D9DEE3" roughness={0.5} />
      </mesh>
      <mesh geometry={wingGeo} position={[-1.6, -0.41, -0.6]} rotation={[-Math.PI / 2, 0, 0]} castShadow>
        <meshStandardMaterial color="#D9DEE3" roughness={0.5} />
      </mesh>
      {/* deriva e estabilizadores */}
      <mesh geometry={tailGeo} position={[6.2, 0.75, -0.06]} castShadow>
        <meshStandardMaterial color="#2B5FD9" roughness={0.45} />
      </mesh>
      <mesh geometry={stabGeo} position={[6.6, 0.6, 0.3]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <meshStandardMaterial color="#D9DEE3" />
      </mesh>
      <mesh geometry={stabGeo} position={[6.6, 0.68, -0.3]} rotation={[-Math.PI / 2, 0, 0]} castShadow>
        <meshStandardMaterial color="#D9DEE3" />
      </mesh>
      {/* motores sob as asas */}
      {pods.map((p, i) => (
        <group key={i}>
          <RBox size={[0.9, 0.5, 0.18]} position={[p[0] + 0.5, -0.78, p[2]]} color="#D9DEE3" radius={0.06} />
          <Appear p={engines} from={[0, -1.5, 0]}>
            <JetEngine t={t} position={p} scale={0.42} s={{ fan: 1, nacelle: 1, nozzle: 1, core: 1, cut: false, fanAngle, jet, comp: [], turbine: [] }} />
          </Appear>
        </group>
      ))}
      {/* trem de pouso */}
      {gear
        ? (
            [
              [-4.6, 0],
              [0.4, 1.3],
              [0.4, -1.3],
            ] as [number, number][]
          ).map(([x, z]) => (
            <group key={`${x}${z}`} position={[x, -1, z]}>
              <RBox size={[0.12, 0.9, 0.12]} position={[0, -0.45, 0]} color="#8D979F" radius={0.04} />
              <mesh position={[0, -0.95, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
                <cylinderGeometry args={[0.32, 0.32, 0.28, 20]} />
                <meshStandardMaterial color={C.ink} />
              </mesh>
            </group>
          ))
        : null}
    </group>
  );
};

// Pista de aeroporto com entorno.
export const Runway: React.FC<{ t: number }> = ({ t }) => (
  <group>
    <GroundSlab w={260} d={140} />
    <Box size={[260, 0.05, 14]} position={[0, 0.03, 0]} color="#5B5F66" cast={false} />
    {Array.from({ length: 30 }, (_, i) => (
      <Box key={i} size={[3, 0.06, 0.3]} position={[-120 + i * 8.5, 0.05, 0]} color="#F4F4F0" cast={false} />
    ))}
    <Box size={[260, 0.06, 0.25]} position={[0, 0.05, 6.4]} color="#F2D45C" cast={false} />
    <Box size={[260, 0.06, 0.25]} position={[0, 0.05, -6.4]} color="#F2D45C" cast={false} />
    {(
      [
        [-30, -30, 2.2, 0.4],
        [-14, -34, 2.6, 1.6],
        [6, -32, 2.0, 2.4],
        [22, -36, 2.8, 0.9],
        [40, -30, 2.3, 2.2],
        [-48, -28, 2.5, 1.1],
        [58, -34, 2.6, 2.9],
      ] as number[][]
    ).map(([x, z, s, r]) => (
      <Tree key={`${x}${z}`} position={[x, 0, z]} scale={s} seed={r} />
    ))}
    {/* torre de controle */}
    <group position={[-38, 0, -22]}>
      <RBox size={[2.2, 12, 2.2]} position={[0, 6, 0]} color="#E6E2D8" radius={0.1} />
      <RBox size={[4.2, 2.2, 4.2]} position={[0, 13, 0]} color="#5DA7D9" radius={0.2} opacity={0.85} />
      <RBox size={[4.6, 0.4, 4.6]} position={[0, 14.3, 0]} color="#E6E2D8" radius={0.1} />
    </group>
    <Cloud position={[-20 + ((t * 0.5) % 30), 22, -60]} scale={5} />
    <Cloud position={[25 + ((t * 0.4) % 30), 26, -70]} scale={6} />
    <Cloud position={[0 + ((t * 0.3) % 30), 18, -80]} scale={4} />
  </group>
);

// Ventilador de mesa preso num carrinho de brinquedo.
export const FanCart: React.FC<{ t: number; x: number; fanAngle: number; air: number }> = ({ t, x, fanAngle, air }) => (
  <group position={[x, 0, 0.6]}>
    <RBox size={[2.2, 0.4, 0.9]} position={[0, 0.45, 0]} color="#E8463A" radius={0.15} />
    <RBox size={[0.7, 0.3, 0.7]} position={[-0.75, 0.75, 0]} color="#BFE3F7" radius={0.1} />
    {[-0.7, 0.7].map((wx) =>
      [-0.45, 0.45].map((wz) => (
        <mesh key={`${wx}${wz}`} position={[wx, 0.2, wz]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.2, 0.2, 0.12, 18]} />
          <meshStandardMaterial color={C.ink} />
        </mesh>
      )),
    )}
    {/* ventilador */}
    <group position={[0.55, 1.35, 0]}>
      <RBox size={[0.12, 0.7, 0.12]} position={[0, -0.45, 0]} color="#3E4650" radius={0.04} />
      <mesh rotation={[0, Math.PI / 2, 0]}>
        <torusGeometry args={[0.55, 0.035, 8, 32]} />
        <meshStandardMaterial color="#3E4650" />
      </mesh>
      <BladeDisc rHub={0.1} rTip={0.5} n={3} angle={fanAngle} color="#5AA8FF" chord={0.3} twist={0.8} hubLen={0.15} />
      <FlowParticles
        points={[
          [0.2, 0, 0],
          [1.5, 0, 0],
          [3.2, 0, 0],
        ]}
        t={t}
        count={18}
        speed={0.8}
        size={0.05}
        color="#DDF4FF"
        emissive={0.3}
        visible={air}
        jitter={0.5}
      />
    </group>
    <Pipe points={[[-1.1, 0.45, 0], [-1.35, 0.45, 0]]} radius={0.05} color="#3E4650" />
  </group>
);
