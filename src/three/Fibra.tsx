import { useMemo } from "react";
import * as THREE from "three";
import { C } from "../theme";
import { Box, Bush, Cloud, FlowParticles, Glow, GroundSlab, Pipe, RBox, Tree } from "./basics";

type V3 = [number, number, number];
export const LIGHT = "#5FF3FF";
export const LIGHT2 = "#FF5FD2";

// Cabo de fibra em camadas, escalonadas para mostrar o interior (eixo x).
export const FiberCable: React.FC<{ position?: V3; reveal: number; glow: number; scale?: number; cut?: boolean }> = ({ position = [0, 0, 0], reveal, glow, scale = 1, cut = true }) => {
  const layers = [
    { r: 0.5, extra: 0, color: "#22252A", name: "capa" },
    { r: 0.42, extra: 0.7, color: "#F2C230", name: "kevlar" },
    { r: 0.27, extra: 1.3, color: "#F4F4F0", name: "buffer" },
    { r: 0.17, extra: 1.9, color: "#BFEFFF", name: "casca" },
    { r: 0.065, extra: 2.4, color: LIGHT, name: "nucleo" },
  ];
  const base = 4;
  return (
    <group position={position} scale={scale}>
      {layers.map((l, i) => {
        const len = base + l.extra * reveal;
        const isCore = i === 4;
        const isClad = i === 3;
        return (
          <mesh key={l.name} position={[-2 + len / 2, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[l.r, l.r, len, 32]} />
            <meshStandardMaterial
              color={l.color}
              roughness={isCore || isClad ? 0.1 : i === 1 ? 0.95 : 0.5}
              transparent={isClad}
              opacity={isClad ? 0.55 : 1}
              emissive={isCore ? LIGHT : "#000"}
              emissiveIntensity={isCore ? 0.4 + glow * 2.2 : 0}
            />
          </mesh>
        );
      })}
      {cut ? <Glow position={[-2 + base + 2.4 * reveal + 0.05, 0, 0]} size={0.6 + glow * 2.2} color={LIGHT} opacity={glow * 0.9} /> : null}
    </group>
  );
};

// Feixe de luz saindo da ponta cortada (cone aditivo).
export const Beam: React.FC<{ position: V3; length: number; power: number; rotation?: V3 }> = ({ position, length, power, rotation = [0, 0, -Math.PI / 2] }) => {
  if (power <= 0.01) return null;
  return (
    <group position={position} rotation={rotation}>
      <mesh position={[0, length / 2, 0]}>
        <coneGeometry args={[0.55 * power, length, 32, 1, true]} />
        <meshBasicMaterial color={LIGHT} transparent opacity={0.22 * power} blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, length / 2, 0]} rotation={[0, 0, Math.PI]}>
        <coneGeometry args={[0.18 * power, length, 24, 1, true]} />
        <meshBasicMaterial color="#FFFFFF" transparent opacity={0.35 * power} blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      <Glow position={[0, 0, 0]} size={1.6 * power} color={LIGHT} opacity={power} />
    </group>
  );
};

// Tubo de vidro com o pulso de luz "quicando" em zigue-zague.
export const GlassGuide: React.FC<{ t: number; bend: number; leak?: number; colors?: number; pulse?: number }> = ({ t, bend, leak = 0, colors = 1, pulse = 1 }) => {
  // eixo do tubo: reta que curva para baixo conforme "bend"
  const axis = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 40; i++) {
      const u = i / 40;
      const x = -7 + u * 14;
      const k = Math.max(0, u - 0.45) / 0.55;
      const y = -bend * 4.2 * k * k;
      const z = bend * 2.0 * Math.sin(k * Math.PI * 0.5);
      pts.push(new THREE.Vector3(x - bend * 3.2 * k * k, y, z));
    }
    return new THREE.CatmullRomCurve3(pts);
  }, [bend]);
  const tube = useMemo(() => new THREE.TubeGeometry(axis, 160, 0.55, 32, false), [axis]);
  const core = useMemo(() => new THREE.TubeGeometry(axis, 160, 0.3, 24, false), [axis]);
  // caminho em zigue-zague dentro do núcleo
  const zig = useMemo(() => {
    const out: V3[] = [];
    const frames = axis.computeFrenetFrames(120, false);
    for (let i = 0; i <= 120; i++) {
      const u = i / 120;
      const p = axis.getPointAt(u);
      const n = frames.normals.at(i) ?? new THREE.Vector3(0, 1, 0);
      const s = (i % 8) / 8;
      const tri = s < 0.5 ? s * 4 - 1 : 3 - s * 4;
      const q = p.clone().add(n.clone().multiplyScalar(tri * 0.22));
      out.push([q.x, q.y, q.z]);
    }
    return out;
  }, [axis]);
  const zigBack = useMemo(() => {
    const out: V3[] = [];
    const frames = axis.computeFrenetFrames(120, false);
    for (let i = 120; i >= 0; i--) {
      const p = axis.getPointAt(i / 120);
      const b = frames.binormals.at(i) ?? new THREE.Vector3(0, 0, 1);
      const s = ((i + 4) % 8) / 8;
      const tri = s < 0.5 ? s * 4 - 1 : 3 - s * 4;
      const q = p.clone().add(b.clone().multiplyScalar(tri * 0.22));
      out.push([q.x, q.y, q.z]);
    }
    return out;
  }, [axis]);
  // pontos de vazamento na curva
  const bendPt = axis.getPointAt(0.78);
  return (
    <group>
      <mesh geometry={tube}>
        <meshStandardMaterial color="#D6F4FF" transparent opacity={0.22} roughness={0.05} depthWrite={false} />
      </mesh>
      <mesh geometry={core}>
        <meshStandardMaterial color="#A9EBFF" transparent opacity={0.25} roughness={0.05} depthWrite={false} emissive={LIGHT} emissiveIntensity={0.15} />
      </mesh>
      <FlowParticles points={zig} t={t} count={140} speed={0.22} size={0.07} color={LIGHT} emissive={0.9} visible={pulse * (1 - leak * 0.6)} />
      {colors > 0.01 ? <FlowParticles points={zigBack} t={t} count={140} speed={0.22} size={0.07} color={LIGHT2} emissive={0.9} visible={colors} seed={5} /> : null}
      {leak > 0.01
        ? Array.from({ length: 22 }, (_, i) => {
            const r1 = Math.abs(Math.sin(i * 12.9898) * 43758.5453) % 1;
            const u = (r1 + t * 0.8) % 1;
            const dir = new THREE.Vector3(Math.cos(i * 2.4), Math.sin(i * 2.4) * 0.6 + 0.4, Math.sin(i * 1.7));
            const p = bendPt.clone().add(dir.multiplyScalar(u * 2.5));
            return (
              <mesh key={i} position={[p.x, p.y, p.z]} scale={(1 - u) * leak}>
                <sphereGeometry args={[0.08, 8, 6]} />
                <meshStandardMaterial color={LIGHT} emissive={LIGHT} emissiveIntensity={2} />
              </mesh>
            );
          })
        : null}
      {leak > 0.01 ? <Glow position={[bendPt.x, bendPt.y, bendPt.z]} size={3 * leak} color={LIGHT} opacity={0.6 * leak} /> : null}
    </group>
  );
};

// Sala de equipamentos do provedor: racks com OLT.
export const OltRoom: React.FC<{ t: number; laser: number }> = ({ t, laser }) => {
  const racks = [-3.2, -1.6, 0, 1.6, 3.2];
  const bits = [1, 0, 1, 1, 0, 1, 0, 0, 1, 1, 1, 0];
  const bit = bits.at(Math.floor(t * 8) % bits.length) ?? 1;
  return (
    <group>
      <Box size={[16, 0.1, 12]} position={[0, -0.05, 0]} color="#5D6670" cast={false} />
      {Array.from({ length: 8 }, (_, i) => (
        <Box key={i} size={[16, 0.012, 0.03]} position={[0, 0.01, -5 + i * 1.4]} color="#4A525B" cast={false} />
      ))}
      <Box size={[16, 7, 0.2]} position={[0, 3.5, -3.2]} color="#D7DDE2" cast={false} />
      {racks.map((x, ri) => (
        <group key={x} position={[x, 0, -2.2]}>
          <RBox size={[1.4, 4.2, 1.6]} position={[0, 2.1, 0]} color="#1E2226" radius={0.05} />
          {Array.from({ length: 7 }, (_, j) => {
            const y = 0.7 + j * 0.5;
            const isOlt = ri === 2 && j === 3;
            return (
              <group key={j} position={[0, y, 0.81]}>
                <RBox size={[1.24, 0.38, 0.06]} color={isOlt ? "#3A4A5C" : "#2C3136"} radius={0.02} emissive={isOlt ? "#4FA0FF" : "#000"} emissiveIntensity={isOlt ? 0.15 : 0} />
                {Array.from({ length: 8 }, (_, k) => {
                  const on = Math.sin(t * (3 + ((k + j + ri) % 5)) + k * 1.7 + j) > 0.2;
                  return (
                    <mesh key={k} position={[-0.5 + k * 0.14, 0.08, 0.04]}>
                      <boxGeometry args={[0.04, 0.04, 0.02]} />
                      <meshStandardMaterial color={on ? "#4CFF7A" : "#1D3B25"} emissive={on ? "#4CFF7A" : "#000"} emissiveIntensity={on ? 1.6 : 0} />
                    </mesh>
                  );
                })}
                {Array.from({ length: 8 }, (_, k) => (
                  <mesh key={`p${k}`} position={[-0.5 + k * 0.14, -0.07, 0.04]}>
                    <boxGeometry args={[0.09, 0.08, 0.02]} />
                    <meshStandardMaterial color="#0E1013" />
                  </mesh>
                ))}
              </group>
            );
          })}
          {/* cordões de fibra amarelos */}
          <Pipe points={[[-0.4, 2.14, 0.86], [-0.5, 1.6, 1.1], [-0.6, 0.4, 1.0], [-0.65, 0.05, 0.6]]} radius={0.025} color="#F2C230" />
          <Pipe points={[[0.2, 2.14, 0.86], [0.3, 1.4, 1.15], [0.45, 0.4, 1.0], [0.6, 0.05, 0.5]]} radius={0.025} color="#F2C230" />
        </group>
      ))}
      {/* laser piscando na porta da OLT */}
      <Glow position={[-0.5, 2.15, -1.3]} size={1.4} color={LIGHT} opacity={laser * (bit ? 1 : 0.08)} />
      <FlowParticles points={[[-0.5, 2.13, -1.3], [-0.6, 1.9, -0.9], [-0.9, 1.2, -0.6], [-1.4, 0.3, -0.4]]} t={t} count={22} speed={0.45} size={0.035} color={LIGHT} emissive={1} visible={laser} />
    </group>
  );
};

// Rua com postes, cabos e caixa de atendimento (CTO).
export const STREET = {
  cto: [0.55, 4.7, 1.2] as V3,
  houses: [-6, 0, 6] as number[],
};

const Pole: React.FC<{ x: number }> = ({ x }) => (
  <group position={[x, 0, 1.2]}>
    <mesh position={[0, 3, 0]} castShadow>
      <cylinderGeometry args={[0.1, 0.14, 6, 10]} />
      <meshStandardMaterial color="#9AA0A6" roughness={0.8} />
    </mesh>
    <RBox size={[1.4, 0.12, 0.12]} position={[0, 5.6, 0]} color="#7C8389" radius={0.03} />
  </group>
);

const House2: React.FC<{ x: number; color: string; roof: string }> = ({ x, color, roof }) => (
  <group position={[x, 0, -2.2]}>
    <RBox size={[3.6, 2.6, 3.2]} position={[0, 1.3, 0]} color={color} radius={0.05} />
    <mesh position={[0, 3.15, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
      <coneGeometry args={[2.75, 1.2, 4]} />
      <meshStandardMaterial color={roof} flatShading />
    </mesh>
    <RBox size={[0.8, 1.6, 0.08]} position={[-0.8, 0.8, 1.61]} color={C.wood} radius={0.03} />
    <RBox size={[1.0, 0.8, 0.08]} position={[0.8, 1.5, 1.61]} color="#BFE3F7" radius={0.03} />
  </group>
);

export const Street: React.FC<{ t: number; light: number; toHouse?: number; allHouses?: number }> = ({ t, light, toHouse = 0, allHouses = 0 }) => {
  const poles = [-9, -3, 3, 9];
  const cable: V3[] = [];
  for (let i = 0; i <= 30; i++) {
    const x = -12 + i * 0.8;
    const local = ((x + 9) % 6 + 6) % 6;
    cable.push([x, 5.45 - Math.sin((local / 6) * Math.PI) * 0.35, 1.2]);
  }
  const drops = STREET.houses.map((hx) => [
    [STREET.cto[0], STREET.cto[1] - 0.3, 1.25],
    [(STREET.cto[0] + hx) / 2, 3.6, -0.2],
    [hx + 0.6, 2.7, -0.6],
  ] as V3[]);
  return (
    <group>
      <GroundSlab w={60} d={50} />
      <Box size={[60, 0.04, 2.6]} position={[0, 0.02, 3.4]} color={C.street} cast={false} />
      {[-20, -14, -8, -2, 4, 10, 16].map((x) => (
        <Box key={x} size={[2, 0.045, 0.16]} position={[x, 0.03, 3.4]} color="#F2D45C" cast={false} />
      ))}
      <Box size={[60, 0.08, 1.4]} position={[0, 0.04, 1.4]} color={C.sidewalk} cast={false} />
      {poles.map((x) => (
        <Pole key={x} x={x} />
      ))}
      <Pipe points={cable} radius={0.035} color="#1F2226" segments={120} />
      <FlowParticles points={cable} t={t} count={40} speed={0.16} size={0.07} color={LIGHT} emissive={1.0} visible={light} />
      {/* CTO */}
      <group position={STREET.cto}>
        <RBox size={[0.7, 0.9, 0.35]} color="#3A3F45" radius={0.06} />
        <RBox size={[0.6, 0.12, 0.05]} position={[0, 0.25, 0.18]} color="#F2C230" radius={0.02} />
      </group>
      {drops.map((d, i) => (
        <group key={i}>
          <Pipe points={d} radius={0.02} color="#2B2F33" />
          <FlowParticles points={d} t={t} count={10} speed={0.4} size={0.05} color={LIGHT} emissive={1.0} visible={i === 1 ? Math.max(toHouse, allHouses) : allHouses} seed={i + 3} />
        </group>
      ))}
      <House2 x={-6} color="#F0DCCB" roof={C.roof} />
      <House2 x={0} color="#E8EDD6" roof={C.roofDark} />
      <House2 x={6} color="#E7D7EE" roof={C.roof} />
      {(
        [
          [-10.5, 0, -4, 1.4, 0.3],
          [10.8, 0, -3.5, 1.5, 2.6],
          [-3, 0, -6, 1.2, 1.1],
          [3.2, 0, -6.4, 1.3, 2.2],
          [-13, 0, -8, 1.8, 0.5],
          [13, 0, -8, 1.7, 2.9],
        ] as number[][]
      ).map(([x, y, z, s, r]) => (
        <Tree key={`${x}${z}`} position={[x, y, z]} scale={s} seed={r} />
      ))}
      {([[-7.8, 0, -0.3], [-2.2, 0, -0.4], [4.2, 0, -0.3], [7.9, 0, -0.4]] as V3[]).map((p) => (
        <Bush key={p.join()} position={p} />
      ))}
      <Cloud position={[-6 + ((t * 0.15) % 12), 10, -14]} scale={1.8} />
      <Cloud position={[5 + ((t * 0.1) % 8), 11.5, -18]} scale={2.2} />
    </group>
  );
};

// Caixa de atendimento aberta com o splitter dividindo a luz.
export const SplitterBox: React.FC<{ t: number; input: number; split: number }> = ({ t, input, split }) => {
  const outs = 8;
  const paths: V3[][] = Array.from({ length: outs }, (_, i) => {
    const y = 0.9 - i * 0.26;
    return [
      [0.55, 0, 0],
      [1.3, y * 0.4, 0],
      [2.6, y, 0.05],
      [4.2, y * 1.05, 0.1],
    ];
  });
  return (
    <group>
      {/* caixa */}
      <RBox size={[6.4, 3.4, 0.25]} position={[0.7, 0, -0.55]} color="#2F3439" radius={0.08} />
      <RBox size={[6.6, 0.25, 1.0]} position={[0.7, 1.78, -0.1]} color="#3A3F45" radius={0.06} />
      <RBox size={[6.6, 0.25, 1.0]} position={[0.7, -1.78, -0.1]} color="#3A3F45" radius={0.06} />
      {/* fibra de entrada */}
      <Pipe points={[[-3.2, 0, 0], [-1.5, 0, 0], [-0.55, 0, 0]]} radius={0.06} color="#1F2226" />
      <FlowParticles points={[[-3.2, 0, 0], [-0.55, 0, 0]]} t={t} count={18} speed={0.5} size={0.08} color={LIGHT} emissive={1.0} visible={input} />
      {/* splitter (chip) */}
      <RBox size={[1.1, 0.7, 0.4]} position={[0, 0, 0]} color="#E9ECEF" radius={0.08} />
      <RBox size={[0.8, 0.12, 0.42]} position={[0, 0.18, 0]} color="#4FA0FF" radius={0.03} />
      <Glow position={[0, 0, 0.3]} size={1.6} color={LIGHT} opacity={input * 0.7} />
      {paths.map((p, i) => (
        <group key={i}>
          <Pipe points={p} radius={0.04} color="#F2C230" />
          <FlowParticles points={p} t={t} count={9} speed={0.5} size={0.06} color={LIGHT} emissive={1.0} visible={split} seed={i + 1} />
        </group>
      ))}
    </group>
  );
};

// Sala com ONU, roteador e Wi-Fi.
export const LivingRoom: React.FC<{ t: number; fiber: number; onu: number; wifi: number }> = ({ t, fiber, onu, wifi }) => {
  const arcs = [];
  for (let i = 0; i < 4; i++) {
    const u = (t * 0.6 + i / 4) % 1;
    arcs.push(
      <mesh key={i} position={[1.2, 1.55, -1.7]} rotation={[0, 0, Math.PI / 4]} scale={0.2 + u * 2.4}>
        <torusGeometry args={[1, 0.035, 8, 40, Math.PI / 2]} />
        <meshStandardMaterial color={LIGHT} emissive={LIGHT} emissiveIntensity={1.5} transparent opacity={(1 - u) * wifi} />
      </mesh>,
    );
  }
  return (
    <group>
      <Box size={[10, 0.1, 8]} position={[0, -0.05, 0]} color={C.wood} cast={false} />
      <Box size={[10, 4, 0.2]} position={[0, 2, -2.6]} color="#EADBC4" cast={false} />
      <Box size={[0.2, 4, 8]} position={[-3.5, 2, 0]} color="#E2D0B4" cast={false} />
      {/* fibra entrando pela parede */}
      <Pipe points={[[-3.4, 2.9, -2.4], [-1.5, 2.9, -2.45], [0.4, 2.0, -2.45], [0.55, 1.35, -2.0]]} radius={0.03} color="#F4F4F0" />
      <FlowParticles points={[[-3.4, 2.9, -2.4], [-1.5, 2.9, -2.45], [0.4, 2.0, -2.45], [0.55, 1.35, -2.0]]} t={t} count={14} speed={0.45} size={0.05} color={LIGHT} emissive={1.0} visible={fiber} />
      {/* prateleira */}
      <RBox size={[2.4, 0.08, 0.7]} position={[0.9, 1.08, -2.1]} color={C.wood} radius={0.02} />
      {/* ONU */}
      <group position={[0.55, 1.3, -2.0]}>
        <RBox size={[0.6, 0.36, 0.42]} color="#F6F6F2" radius={0.06} />
        {[0, 1, 2, 3].map((k) => (
          <mesh key={k} position={[-0.18 + k * 0.12, 0.05, 0.215]}>
            <boxGeometry args={[0.05, 0.05, 0.01]} />
            <meshStandardMaterial color={onu > 0.5 ? "#4CFF7A" : "#2A3B2E"} emissive={onu > 0.5 ? "#4CFF7A" : "#000"} emissiveIntensity={1.5 * onu} />
          </mesh>
        ))}
        <Glow position={[0, 0, 0.3]} size={0.6} color="#4CFF7A" opacity={onu * 0.18} />
      </group>
      {/* roteador */}
      <group position={[1.35, 1.24, -2.0]}>
        <RBox size={[0.7, 0.16, 0.45]} color="#1F2226" radius={0.05} />
        {[-0.25, 0.25].map((x) => (
          <RBox key={x} size={[0.05, 0.5, 0.05]} position={[x, 0.3, -0.15]} rotation={[0, 0, x * 0.6]} color="#1F2226" radius={0.02} />
        ))}
        <mesh position={[0, 0.0, 0.23]}>
          <boxGeometry args={[0.3, 0.03, 0.01]} />
          <meshStandardMaterial color={LIGHT} emissive={LIGHT} emissiveIntensity={2 * wifi} />
        </mesh>
      </group>
      {arcs}
      {/* sofá */}
      <RBox size={[2.6, 0.5, 1.0]} position={[-1.2, 0.35, 0.3]} color="#4C7BD9" radius={0.12} />
      <RBox size={[2.6, 0.8, 0.3]} position={[-1.2, 0.85, -0.05]} color="#4268BF" radius={0.12} />
      <RBox size={[0.3, 0.7, 1.0]} position={[-2.5, 0.55, 0.3]} color="#4268BF" radius={0.1} />
      <RBox size={[0.3, 0.7, 1.0]} position={[0.1, 0.55, 0.3]} color="#4268BF" radius={0.1} />
      <RBox size={[2.2, 0.06, 1.6]} position={[-1.2, 0.01, 1.6]} color="#E58C5A" radius={0.03} />
      <mesh position={[2.9, 0.6, -1.8]} castShadow>
        <cylinderGeometry args={[0.25, 0.2, 0.6, 16]} />
        <meshStandardMaterial color="#C7663E" />
      </mesh>
      <mesh position={[2.9, 1.2, -1.8]} castShadow>
        <icosahedronGeometry args={[0.5, 0]} />
        <meshStandardMaterial color={C.leaf} flatShading />
      </mesh>
    </group>
  );
};

// Tesoura/alicate simples para o gancho.
export const Pliers: React.FC<{ position: V3; close: number }> = ({ position, close }) => (
  <group position={position} scale={0.55}>
    <group rotation={[0, 0, 0.35 - close * 0.35]}>
      <RBox size={[0.12, 1.1, 0.08]} position={[0, -0.55, 0]} color="#D8463A" radius={0.04} />
      <RBox size={[0.08, 0.5, 0.06]} position={[0, 0.25, 0]} color="#A7B0B7" radius={0.02} metalness={0.6} />
    </group>
    <group rotation={[0, 0, -0.35 + close * 0.35]}>
      <RBox size={[0.12, 1.1, 0.08]} position={[0, -0.55, 0.1]} color="#D8463A" radius={0.04} />
      <RBox size={[0.08, 0.5, 0.06]} position={[0, 0.25, 0.1]} color="#A7B0B7" radius={0.02} metalness={0.6} />
    </group>
  </group>
);
