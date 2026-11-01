import { useMemo } from "react";
import * as THREE from "three";
import { C } from "../theme";
import { Box, FlowParticles, Glow, Pipe, RBox } from "./basics";
import { Appear } from "./Jato";

type V3 = [number, number, number];
const BODY = "#2F7DD8";
const BODY_DARK = "#2464B0";
const GLASS = "#BFE3F7";
const BAG = "#F4F2EC";

// Laboratório de testes de colisão.
export const CrashLab: React.FC = () => {
  const stripes = [];
  for (let i = 0; i < 16; i++) {
    stripes.push(<Box key={i} size={[0.5, 0.02, 3.2]} position={[2.6 + 0.12, 0.012, -6 + i * 0.8]} rotation={[0, 0.6, 0]} color={i % 2 ? "#F2C230" : C.ink} cast={false} />);
  }
  return (
    <group>
      <Box size={[80, 0.1, 40]} position={[0, -0.05, 0]} color="#8E969D" cast={false} />
      {Array.from({ length: 20 }, (_, i) => (
        <Box key={i} size={[0.04, 0.012, 40]} position={[-38 + i * 4, 0.006, 0]} color="#7C848B" cast={false} />
      ))}
      <Box size={[80, 12, 0.3]} position={[0, 6, -9]} color="#D6DADD" cast={false} />
      {/* faixa de logo do lab (sem marca) */}
      <Box size={[80, 0.6, 0.1]} position={[0, 4.2, -8.8]} color="#F2C230" cast={false} />
      {/* barreira */}
      <group position={[3.4, 0, 0]}>
        <RBox size={[2.2, 3.4, 8]} position={[0, 1.7, 0]} color="#C9CDD1" radius={0.08} />
        {Array.from({ length: 8 }, (_, i) => (
          <RBox key={i} size={[0.06, 0.5, 1.0]} position={[-1.11, 2.6, -3.5 + i * 1.0]} color={i % 2 ? "#F2C230" : C.ink} radius={0.01} />
        ))}
        <RBox size={[0.4, 2.0, 4.0]} position={[-1.25, 1.1, 0]} color="#E8EAEC" radius={0.12} />
      </group>
      {/* trilho */}
      {[-0.6, 0.6].map((z) => (
        <Box key={z} size={[60, 0.06, 0.1]} position={[-28, 0.03, z]} color="#5C646B" cast={false} />
      ))}
      {/* luzes no teto */}
      {[-6, 0, 6].map((x) => (
        <group key={x} position={[x, 9.6, -2]}>
          <RBox size={[3, 0.2, 0.6]} color="#FFFFFF" radius={0.05} emissive="#FFFFFF" emissiveIntensity={0.8} />
        </group>
      ))}
    </group>
  );
};

// Volante com cobertura central (onde o airbag mora).
export const STEER = { center: [0.55, 1.62, -0.38] as V3, tilt: 0.5 };

export const SteeringWheel: React.FC<{ bag: number; bagHard: number; deflate: number; vents: number; vent: number; t: number; pillow: number; hubOpen: number; pumpBag: number }> = ({
  bag,
  bagHard,
  deflate,
  vents,
  vent,
  t,
  pillow,
  hubOpen,
  pumpBag,
}) => {
  const size = Math.max(bag, pumpBag) * (1 - deflate * 0.55);
  const wob = bag > 0.95 ? Math.sin(t * 25) * 0.02 * (1 - bagHard) : 0;
  return (
    <group position={STEER.center} rotation={[0, 0, STEER.tilt]}>
      {/* coluna */}
      <mesh position={[0.35, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.06, 0.08, 0.7, 12]} />
        <meshStandardMaterial color="#3A3F45" />
      </mesh>
      {/* aro */}
      <mesh rotation={[0, Math.PI / 2, 0]}>
        <torusGeometry args={[0.36, 0.05, 10, 32]} />
        <meshStandardMaterial color="#2B2E33" roughness={0.6} />
      </mesh>
      {[0, 2.1, 4.2].map((a) => (
        <group key={a} rotation={[a, 0, 0]}>
          <RBox size={[0.05, 0.32, 0.07]} position={[0, 0.18, 0]} color="#2B2E33" radius={0.02} />
        </group>
      ))}
      {/* cobertura central (abre quando o airbag sai) */}
      <group position={[-0.04, 0, 0]}>
        <mesh rotation={[0, 0, Math.PI / 2]} position={[0, 0, 0]}>
          <cylinderGeometry args={[0.15, 0.15, 0.08, 20]} />
          <meshStandardMaterial color="#3A3F45" />
        </mesh>
        <group position={[-0.05, 0.15, 0]} rotation={[0, 0, hubOpen * 1.6]}>
          <mesh position={[0, -0.15, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.15, 0.15, 0.03, 20, 1, false, 0, Math.PI]} />
            <meshStandardMaterial color="#44494F" />
          </mesh>
        </group>
      </group>
      {/* travesseiro */}
      <Appear p={pillow} from={[-1, 0.5, 0]}>
        <RBox size={[0.28, 0.62, 0.7]} position={[-0.22, 0.02, 0]} color="#FFFFFF" radius={0.13} />
        <RBox size={[0.02, 0.5, 0.58]} position={[-0.36, 0.02, 0]} color="#BFD9F2" radius={0.01} />
      </Appear>
      {/* bolsa de ar */}
      {size > 0.01 ? (
        <group position={[-0.08 - 0.32 * size, 0, 0]} rotation={[0, 0, -STEER.tilt * 0.6]}>
          <mesh scale={[0.5 * size * (1 + wob), 0.62 * size * (1 + (1 - deflate) * 0.05), 0.62 * size]} castShadow>
            <sphereGeometry args={[1, 32, 24]} />
            <meshStandardMaterial color={BAG} roughness={0.75} emissive={bagHard > 0.5 ? "#FF8A8A" : "#000"} emissiveIntensity={bagHard * 0.15} />
          </mesh>
          {/* costuras */}
          <mesh scale={[0.505 * size, 0.625 * size, 0.625 * size]} rotation={[0, Math.PI / 2, 0]}>
            <torusGeometry args={[1, 0.008, 4, 40]} />
            <meshStandardMaterial color="#D9D4C7" />
          </mesh>
          {/* furos de escape (nas laterais/trás) */}
          {vents > 0.01
            ? [-1, 1].map((k) => (
                <group key={k} position={[0.1 * size, 0.18 * size, k * 0.6 * size]}>
                  <mesh rotation={[0, 0, 0]} scale={vents}>
                    <sphereGeometry args={[0.07, 12, 10]} />
                    <meshStandardMaterial color={C.ink} />
                  </mesh>
                  {vent > 0.01
                    ? Array.from({ length: 10 }, (_, i) => {
                        const u = ((i / 10 + t * 1.4) % 1 + 1) % 1;
                        return (
                          <mesh key={i} position={[0.1 * u, 0.15 * u, k * u * 0.9]} scale={(0.04 + u * 0.12) * vent}>
                            <icosahedronGeometry args={[1, 1]} />
                            <meshStandardMaterial color="#FFFFFF" transparent opacity={(1 - u) * 0.7} depthWrite={false} />
                          </mesh>
                        );
                      })
                    : null}
                </group>
              ))
            : null}
        </group>
      ) : null}
    </group>
  );
};

// Carro em corte (lado +z aberto). Frente em +x.
export const CrashCar: React.FC<{ x: number; crumple: number; children?: React.ReactNode; sensor?: number; sensorFlash?: number; signal?: number; t: number; brake?: number }> = ({
  x,
  crumple,
  children,
  sensor = 0,
  sensorFlash = 0,
  signal = 0,
  t,
  brake = 0,
}) => {
  const hoodLen = 1.35 * (1 - crumple * 0.45);
  const wheels: V3[] = [
    [1.35, 0.42, -0.95],
    [1.35, 0.42, 0.95],
    [-1.55, 0.42, -0.95],
    [-1.55, 0.42, 0.95],
  ];
  const sideGeo = useMemo(() => {
    // painel lateral do fundo (z<0) com recorte de janela
    const s = new THREE.Shape();
    s.moveTo(-2.4, 0.3);
    s.lineTo(2.2, 0.3);
    s.lineTo(2.2, 1.15);
    s.lineTo(1.0, 1.3);
    s.lineTo(0.55, 2.45);
    s.lineTo(-1.5, 2.45);
    s.lineTo(-2.2, 1.35);
    s.lineTo(-2.4, 1.3);
    s.closePath();
    const hole = new THREE.Path();
    hole.moveTo(0.85, 1.4);
    hole.lineTo(0.48, 2.32);
    hole.lineTo(-1.42, 2.32);
    hole.lineTo(-1.95, 1.4);
    hole.closePath();
    s.holes.push(hole);
    return new THREE.ExtrudeGeometry(s, { depth: 0.08, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 2 });
  }, []);
  const edgeGeo = useMemo(() => {
    // contorno do lado aberto (só a moldura, para ler a forma do carro)
    const pts = [
      [2.2, 1.15],
      [1.0, 1.3],
      [0.55, 2.45],
      [-1.5, 2.45],
      [-2.2, 1.35],
      [-2.4, 1.3],
    ].map(([a, b]) => new THREE.Vector3(a, b, 0));
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, "catmullrom", 0.01), 64, 0.05, 8, false);
  }, []);
  return (
    <group position={[x, 0, 0]}>
      {/* assoalho */}
      <RBox size={[4.6, 0.18, 2.0]} position={[-0.1, 0.38, 0]} color="#3A3F45" radius={0.05} />
      {/* lateral de trás */}
      <mesh geometry={sideGeo} position={[0, 0, -1.0]} castShadow receiveShadow>
        <meshStandardMaterial color={BODY} roughness={0.45} />
      </mesh>
      {/* teto */}
      <RBox size={[2.1, 0.1, 2.05]} position={[-0.48, 2.45, 0]} color={BODY} radius={0.04} />
      {/* capô (amassa) */}
      <group position={[2.2 - hoodLen / 2, 1.18, 0]} rotation={[0, 0, crumple * 0.12]}>
        <RBox size={[hoodLen, 0.14, 2.05]} color={BODY} radius={0.05} />
      </group>
      <RBox size={[0.18, 0.75, 2.0]} position={[2.2 - (1.35 - hoodLen), 0.75, 0]} color={BODY_DARK} radius={0.05} />
      {/* porta-malas */}
      <RBox size={[0.9, 0.12, 2.05]} position={[-1.95, 1.32, 0]} color={BODY} radius={0.05} />
      <RBox size={[0.15, 1.0, 2.0]} position={[-2.38, 0.85, 0]} color={BODY_DARK} radius={0.05} />
      {/* para-brisa */}
      <mesh position={[0.78, 1.88, 0]} rotation={[0, 0, 0.92]}>
        <boxGeometry args={[1.25, 0.03, 1.95]} />
        <meshStandardMaterial color={GLASS} transparent opacity={0.3} roughness={0.05} depthWrite={false} />
      </mesh>
      {/* painel */}
      <RBox size={[0.55, 0.45, 1.95]} position={[0.95, 1.12, 0]} color="#2B2E33" radius={0.08} />
      {/* banco */}
      <RBox size={[0.75, 0.2, 0.75]} position={[-0.38, 0.72, -0.38]} color="#4A4F57" radius={0.08} />
      <group position={[-0.78, 0.8, -0.38]} rotation={[0, 0, 0.18]}>
        <RBox size={[0.18, 1.2, 0.72]} position={[0, 0.6, 0]} color="#4A4F57" radius={0.08} />
        <RBox size={[0.18, 0.3, 0.45]} position={[0.02, 1.32, 0]} color="#4A4F57" radius={0.08} />
      </group>
      {/* rodas */}
      {wheels.map((w, i) => (
        <group key={i} position={w}>
          <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[0.42, 0.42, 0.3, 24]} />
            <meshStandardMaterial color={C.ink} />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, w[2] > 0 ? 0.16 : -0.16]}>
            <cylinderGeometry args={[0.2, 0.2, 0.02, 16]} />
            <meshStandardMaterial color="#B9C1C7" metalness={0.5} />
          </mesh>
        </group>
      ))}
      {/* luz de freio */}
      <RBox size={[0.06, 0.18, 0.4]} position={[-2.45, 1.1, -0.7]} color="#E8352B" radius={0.02} emissive="#FF2A1A" emissiveIntensity={brake * 2} />
      {/* sensor na frente + fio até o volante */}
      <group position={[1.62, 0.92, 1.02]}>
        <Appear p={sensor} from={[0, 1.2, 0.8]}>
          <RBox size={[0.34, 0.22, 0.34]} color="#3A3F45" radius={0.04} />
          <RBox size={[0.2, 0.04, 0.2]} position={[0, 0.12, 0]} color="#2BA84A" radius={0.01} />
          <mesh position={[0.1, 0.15, 0.1]}>
            <sphereGeometry args={[0.04, 10, 8]} />
            <meshStandardMaterial color={sensorFlash > 0.5 ? "#FF3B2F" : "#5A1A16"} emissive="#FF3B2F" emissiveIntensity={sensorFlash * 3} />
          </mesh>
          <Glow position={[0.1, 0.2, 0.2]} size={0.8 * sensorFlash} color="#FF3B2F" opacity={sensorFlash} />
          <Pipe
            points={[
              [-0.18, 0, -0.1],
              [-0.4, 0.1, -0.6],
              [-0.7, 0.4, -1.1],
              [-0.97, 0.7, -1.4],
            ]}
            radius={0.025}
            color="#C9472F"
          />
        </Appear>
      </group>
      <FlowParticles
        points={[
          [1.44, 0.92, 0.92],
          [1.22, 1.02, 0.42],
          [0.92, 1.32, -0.08],
          [0.65, 1.62, -0.38],
        ]}
        t={t}
        count={10}
        speed={1.6}
        size={0.05}
        color="#FFD23F"
        emissive={2}
        visible={signal}
      />
      {children}
    </group>
  );
};

// Bomba de encher pneu (tentativa lenta).
export const Pump: React.FC<{ position: V3; p: number; t: number; pumping: number }> = ({ position, p, t, pumping }) => {
  const h = pumping > 0 ? (Math.sin(t * 5) * 0.5 + 0.5) * 0.35 * pumping : 0;
  return (
    <group position={position}>
      <Appear p={p} from={[0, 2, 0]}>
        <RBox size={[0.6, 0.06, 0.25]} position={[0, 0.03, 0]} color="#3A3F45" radius={0.02} />
        <mesh position={[0, 0.5, 0]}>
          <cylinderGeometry args={[0.07, 0.07, 0.9, 14]} />
          <meshStandardMaterial color="#E8352B" />
        </mesh>
        <group position={[0, 0.95 + h, 0]}>
          <mesh>
            <cylinderGeometry args={[0.02, 0.02, 0.4, 8]} />
            <meshStandardMaterial color="#B9C1C7" />
          </mesh>
          <RBox size={[0.5, 0.07, 0.08]} position={[0, 0.2, 0]} color="#2B2E33" radius={0.03} />
        </group>
        <Pipe
          points={[
            [0, 0.1, 0.05],
            [0.4, 0.2, 0.2],
            [0.7, 0.9, 0.0],
            [0.75, 1.35, -0.25],
          ]}
          radius={0.025}
          color="#2B2E33"
        />
      </Appear>
    </group>
  );
};

// Gerador de gás em corte (close de bancada).
export const Inflator: React.FC<{ t: number; spark: number; burn: number; gas: number; bag: number; p: number }> = ({ t, spark, burn, gas, bag, p }) => {
  const pellets = [];
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    pellets.push(
      <mesh key={i} position={[Math.cos(a) * 0.45, 0.25, Math.sin(a) * 0.45]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.14, 0.14, 0.08, 16]} />
        <meshStandardMaterial color={burn > 0.2 ? "#FF7A1A" : "#E9E1C8"} emissive="#FF7A1A" emissiveIntensity={burn * 1.5} />
      </mesh>,
    );
  }
  return (
    <group>
      <Appear p={p} from={[0, 2.5, 0]}>
        {/* lata metálica em corte */}
        <mesh position={[0, 0.3, 0]}>
          <cylinderGeometry args={[0.85, 0.85, 0.6, 40, 1, true, Math.PI / 2, Math.PI]} />
          <meshStandardMaterial color="#B9C1C7" metalness={0.6} roughness={0.3} side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[0, 0.0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.85, 40]} />
          <meshStandardMaterial color="#9AA3AA" metalness={0.5} side={THREE.DoubleSide} />
        </mesh>
        {pellets}
        {/* ignitor */}
        <mesh position={[0, 0.25, 0]}>
          <cylinderGeometry args={[0.12, 0.12, 0.4, 14]} />
          <meshStandardMaterial color="#5A646C" />
        </mesh>
        <Pipe points={[[0, 0.05, 0], [0, -0.4, 0.3], [-0.8, -0.5, 0.8], [-2.0, -0.5, 0.8]]} radius={0.03} color="#C9472F" />
        <Glow position={[0, 0.45, 0.3]} size={1.4 * spark} color="#FFE38A" opacity={spark} />
        {/* gás saindo */}
        {gas > 0.01
          ? Array.from({ length: 40 }, (_, i) => {
              const a = (i / 40) * Math.PI * 2 + i;
              const u = ((i * 0.37 + t * 1.6) % 1 + 1) % 1;
              const r = 0.3 + u * 1.6;
              return (
                <mesh key={i} position={[Math.cos(a) * r * 0.8, 0.6 + u * 1.6, Math.sin(a) * r * 0.5 + 0.2]} scale={(0.06 + u * 0.16) * gas}>
                  <icosahedronGeometry args={[1, 1]} />
                  <meshStandardMaterial color="#FFFFFF" transparent opacity={(1 - u) * 0.8} depthWrite={false} />
                </mesh>
              );
            })
          : null}
        {/* bolsa dobrada → cheia */}
        <group position={[0, 0.65, 0]}>
          {bag < 0.1
            ? Array.from({ length: 4 }, (_, i) => <RBox key={i} size={[1.3, 0.06, 1.3]} position={[0, i * 0.07, 0]} rotation={[0, i * 0.2, 0]} color={BAG} radius={0.03} />)
            : null}
          {bag >= 0.1 ? (
            <mesh position={[0, 1.4 * bag, 0]} scale={[1.6 * bag, 1.4 * bag, 1.6 * bag]} castShadow>
              <sphereGeometry args={[1, 32, 24]} />
              <meshStandardMaterial color={BAG} roughness={0.75} />
            </mesh>
          ) : null}
        </group>
      </Appear>
    </group>
  );
};
