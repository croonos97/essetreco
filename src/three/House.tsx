import { useMemo } from "react";
import * as THREE from "three";
import { C } from "../theme";
import { Box, Bush, Cloud, FlowParticles, GroundSlab, Pipe, RBox, Tree } from "./basics";
import { Tiao, Mood, Pose } from "./Tiao";
import { tempColor } from "./ShowerMacro";

type V3 = [number, number, number];

// Pontos fixos da casa, usados pela câmera e pelos efeitos.
export const HOUSE = {
  caixa: [2.35, 3.55, -1.6] as V3,
  shower: [1.9, 2.28, -1.85] as V3,
  registro: [2.65, 1.3, -2.45] as V3,
  tiao: [1.85, 0.12, -1.6] as V3,
  pipe: [
    [2.35, 3.2, -1.6],
    [2.35, 2.98, -1.65],
    [2.65, 2.85, -2.4],
    [2.65, 2.2, -2.45],
    [2.65, 1.3, -2.45],
    [2.65, 1.12, -2.45],
    [2.4, 1.05, -2.45],
    [2.2, 1.2, -2.45],
    [2.2, 2.3, -2.45],
    [2.05, 2.42, -2.3],
    [1.9, 2.42, -2.0],
    [1.9, 2.36, -1.88],
  ] as V3[],
};

// Telhado: só a água de trás (corte para ver o sótão) + oitões triangulares.
const RoofBack: React.FC = () => (
  <group>
    <RBox size={[7.3, 0.16, 3.35]} position={[0, 3.82, -1.45]} rotation={[-0.4846, 0, 0]} color={C.roof} radius={0.03} emissive={C.roofDark} emissiveIntensity={0.35} />
    {[-2.4, -1.6, -0.8, 0, 0.8, 1.6, 2.4].map((x) => (
      <RBox key={x} size={[0.06, 0.05, 3.3]} position={[x, 3.91, -1.43]} rotation={[-0.4846, 0, 0]} color={C.roofDark} radius={0.02} />
    ))}
  </group>
);

const Gable: React.FC<{ x: number }> = ({ x }) => {
  const geo = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(2.85, 0);
    s.lineTo(0, 0);
    s.lineTo(0, 1.5);
    s.closePath();
    return new THREE.ExtrudeGeometry(s, { depth: 0.2, bevelEnabled: false });
  }, []);
  return (
    <mesh geometry={geo} position={[x, 3.2, 0]} rotation={[0, Math.PI / 2, 0]} castShadow receiveShadow>
      <meshStandardMaterial color={C.wallShade} roughness={0.9} />
    </mesh>
  );
};

const Tiles: React.FC<{ w: number; h: number; position: V3; rotation?: V3 }> = ({ w, h, position, rotation }) => {
  const lines = [];
  const step = 0.3;
  for (let x = -w / 2 + step; x < w / 2; x += step) lines.push(<Box key={`v${x}`} size={[0.012, h, 0.004]} position={[x, 0, 0.012]} color={C.tileLine} cast={false} />);
  for (let y = -h / 2 + step; y < h / 2; y += step) lines.push(<Box key={`h${y}`} size={[w, 0.012, 0.004]} position={[0, y, 0.012]} color={C.tileLine} cast={false} />);
  return (
    <group position={position} rotation={rotation}>
      <Box size={[w, h, 0.02]} color={C.tile} cast={false} />
      {lines}
    </group>
  );
};

// Chuveiro pequeno da cena da casa.
export const ShowerHead: React.FC<{ position: V3; frost?: number; heat?: number }> = ({ position, frost = 0, heat = 0 }) => (
  <group position={position}>
    <RBox size={[0.36, 0.16, 0.34]} position={[0, 0, 0]} color={C.plastic} radius={0.06} />
    <RBox size={[0.08, 0.08, 0.5]} position={[0, 0.08, -0.32]} color={C.plastic} radius={0.03} />
    <RBox size={[0.3, 0.04, 0.28]} position={[0, -0.09, 0]} color={"#D9DEE2"} radius={0.015} emissive={C.warm} emissiveIntensity={heat * 0.8} />
    <RBox size={[0.08, 0.08, 0.3]} position={[0, 0.05, -0.2]} color={C.plastic} radius={0.03} />
    {frost > 0
      ? [-0.12, -0.04, 0.05, 0.13].map((x, i) => (
          <mesh key={x} position={[x, -0.13 - (0.06 + (i % 2) * 0.05) * frost, 0.05 * (i % 3) - 0.05]} rotation={[Math.PI, 0, 0]}>
            <coneGeometry args={[0.025, (0.12 + (i % 2) * 0.1) * frost, 6]} />
            <meshStandardMaterial color="#D8F2FF" roughness={0.1} transparent opacity={0.85} />
          </mesh>
        ))
      : null}
  </group>
);

// Água caindo do chuveiro.
export const ShowerStream: React.FC<{ origin: V3; t: number; amount: number; hot: number; height?: number }> = ({ origin, t, amount, hot, height = 2.1 }) => {
  if (amount <= 0.01) return null;
  const drops = [];
  const n = Math.round(46 * amount);
  const col = tempColor(hot);
  for (let i = 0; i < n; i++) {
    const r1 = Math.abs(Math.sin(i * 12.9898) * 43758.5453) % 1;
    const r2 = Math.abs(Math.sin(i * 78.233) * 12543.1) % 1;
    const u = (r1 + t * 1.3) % 1;
    const spread = 0.05 + u * 0.22;
    drops.push(
      <mesh key={i} position={[origin[0] + (r2 - 0.5) * spread * 2, origin[1] - u * height, origin[2] + ((r1 * 7) % 1 - 0.5) * spread * 2]} scale={[1, 2.2, 1]}>
        <sphereGeometry args={[0.022, 8, 6]} />
        <meshStandardMaterial color={col} emissive={col} emissiveIntensity={0.15} roughness={0.2} transparent opacity={0.85} />
      </mesh>,
    );
  }
  return <group>{drops}</group>;
};

// Vapor (esferas brancas subindo).
export const Steam: React.FC<{ origin: V3; t: number; amount: number; spread?: number }> = ({ origin, t, amount, spread = 0.6 }) => {
  if (amount <= 0.01) return null;
  const puffs = [];
  for (let i = 0; i < 14; i++) {
    const r1 = Math.abs(Math.sin(i * 91.7) * 43758.5) % 1;
    const u = (r1 + t * 0.35) % 1;
    puffs.push(
      <mesh key={i} position={[origin[0] + (r1 - 0.5) * spread + Math.sin(t + i) * 0.1, origin[1] + u * 1.3, origin[2] + ((r1 * 5) % 1 - 0.5) * spread]}>
        <icosahedronGeometry args={[0.08 + u * 0.18, 1]} />
        <meshStandardMaterial color="#ffffff" transparent opacity={(1 - u) * 0.5 * amount} roughness={1} depthWrite={false} />
      </mesh>,
    );
  }
  return <group>{puffs}</group>;
};

export const House: React.FC<{
  t: number;
  water?: number; // 0..1 água correndo no cano
  waterSpeed?: number;
  stream?: number; // água saindo do chuveiro
  hot?: number;
  frost?: number;
  heat?: number;
  mood?: Mood;
  pose?: Pose;
  cold?: number;
  tiaoRot?: number;
  dark?: number;
  steam?: number;
  pipeGlass?: boolean;
  registroAngle?: number;
}> = ({ t, water = 0, waterSpeed = 0.35, stream = 0, hot = 0, frost = 0, heat = 0, mood = "neutral", pose = "down", cold = 0, tiaoRot = 0.25, steam = 0, pipeGlass = true, registroAngle = 0 }) => (
  <group>
    <GroundSlab w={60} d={60} />
    {/* rua e calçada */}
    <Box size={[60, 0.04, 2.4]} position={[0, 0.02, 5.6]} color={C.street} cast={false} />
    {[-20, -14, -8, -2, 4, 10, 16, 22].map((x) => (
      <Box key={x} size={[2, 0.045, 0.16]} position={[x, 0.03, 5.6]} color={"#F2D45C"} cast={false} />
    ))}
    <Box size={[60, 0.08, 1.3]} position={[0, 0.04, 3.75]} color={C.sidewalk} cast={false} />

    {/* piso da casa */}
    <RBox size={[6.9, 0.24, 5.7]} position={[0, 0.0, 0]} color={C.wallCut} radius={0.03} />
    <Box size={[3.2, 0.02, 5.2]} position={[1.6, 0.13, -0.1]} color={C.floor} cast={false} />
    <Box size={[3.4, 0.02, 5.2]} position={[-1.65, 0.13, -0.1]} color={C.wood} cast={false} />

    {/* paredes: fundo, esquerda, divisória */}
    <RBox size={[6.9, 3.0, 0.2]} position={[0, 1.6, -2.75]} color={C.wall} radius={0.02} />
    <RBox size={[0.2, 3.0, 5.7]} position={[-3.35, 1.6, 0]} color={C.wallShade} radius={0.02} />
    <RBox size={[0.16, 3.0, 5.4]} position={[0.02, 1.6, -0.05]} color={C.wall} radius={0.02} />
    {/* parede direita baixa em corte (mostra espessura) */}
    <RBox size={[0.2, 3.0, 5.7]} position={[3.35, 1.6, 0]} color={C.wallShade} radius={0.02} />

    {/* azulejos do banheiro */}
    <Tiles w={3.1} h={2.6} position={[1.68, 1.42, -2.64]} />
    <Tiles w={5.2} h={2.6} position={[3.24, 1.42, -0.05]} rotation={[0, -Math.PI / 2, 0]} />

    {/* laje e sótão */}
    <RBox size={[6.9, 0.14, 5.7]} position={[0, 3.12, 0]} color={"#E6DBC7"} radius={0.02} />
    <RoofBack />
    <Gable x={-3.45} />
    <Gable x={3.25} />

    {/* caixa d'água no sótão */}
    <group position={HOUSE.caixa}>
      <mesh castShadow position={[0, -0.05, 0]}>
        <cylinderGeometry args={[0.62, 0.5, 0.75, 28]} />
        <meshStandardMaterial color="#2F7FD0" roughness={0.5} />
      </mesh>
      <mesh castShadow position={[0, 0.36, 0]}>
        <cylinderGeometry args={[0.66, 0.66, 0.08, 28]} />
        <meshStandardMaterial color="#2A6FB5" roughness={0.5} />
      </mesh>
      <mesh castShadow position={[0, 0.46, 0]}>
        <cylinderGeometry args={[0.45, 0.62, 0.14, 28]} />
        <meshStandardMaterial color="#3389DA" roughness={0.5} />
      </mesh>
      <mesh castShadow position={[0, 0.56, 0]}>
        <cylinderGeometry args={[0.12, 0.12, 0.08, 16]} />
        <meshStandardMaterial color="#2A6FB5" roughness={0.5} />
      </mesh>
    </group>

    {/* cano (translúcido para ver a água) */}
    <Pipe points={HOUSE.pipe} radius={0.055} color={pipeGlass ? "#E9F4FA" : C.white} opacity={pipeGlass ? 0.45 : 1} />
    <FlowParticles points={HOUSE.pipe} t={t} count={26} speed={waterSpeed} size={0.04} color={C.water} visible={water} emissive={0.2} />

    {/* registro */}
    <group position={HOUSE.registro}>
      <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.07, 0.07, 0.08, 16]} />
        <meshStandardMaterial color={C.chrome} metalness={0.6} roughness={0.25} />
      </mesh>
      <RBox size={[0.24, 0.05, 0.05]} position={[0, 0, 0.07]} rotation={[0, 0, registroAngle]} color={C.chrome} metalness={0.6} roughness={0.25} radius={0.02} />
    </group>

    <ShowerHead position={HOUSE.shower} frost={frost} heat={heat} />
    <ShowerStream origin={[HOUSE.shower[0], HOUSE.shower[1] - 0.12, HOUSE.shower[2] + 0.02]} t={t} amount={stream} hot={hot} />
    <Steam origin={[HOUSE.shower[0], 1.6, HOUSE.shower[2] + 0.3]} t={t} amount={steam} />

    {/* box de vidro */}
    <Box size={[0.04, 2.0, 1.6]} position={[1.0, 1.15, -1.9]} color="#CFE8F5" opacity={0.25} cast={false} />
    <Box size={[0.06, 0.06, 1.6]} position={[1.0, 2.15, -1.9]} color={C.chrome} />

    {/* pia e espelho */}
    <RBox size={[0.7, 0.18, 0.5]} position={[2.95, 1.0, 1.1]} color={C.white} radius={0.05} />
    <RBox size={[0.08, 0.9, 0.08]} position={[2.95, 0.5, 1.1]} color={C.white} radius={0.03} />
    <RBox size={[0.04, 0.7, 0.5]} position={[3.22, 1.75, 1.1]} color="#BFE3F7" radius={0.02} />

    {/* quarto: cama, criado-mudo, janela, quadro */}
    <RBox size={[1.7, 0.45, 2.2]} position={[-2.35, 0.36, -1.5]} color={C.wood} radius={0.05} />
    <RBox size={[1.6, 0.18, 2.1]} position={[-2.35, 0.65, -1.5]} color={C.white} radius={0.08} />
    <RBox size={[1.62, 0.12, 1.3]} position={[-2.35, 0.76, -1.05]} color="#4C7BD9" radius={0.06} />
    <RBox size={[0.7, 0.18, 0.45]} position={[-2.35, 0.84, -2.35]} color={C.white} radius={0.08} />
    <RBox size={[0.5, 0.5, 0.5]} position={[-0.9, 0.38, -2.3]} color={C.wood} radius={0.04} />
    <mesh position={[-0.9, 0.95, -2.3]} castShadow>
      <cylinderGeometry args={[0.04, 0.06, 0.4, 10]} />
      <meshStandardMaterial color={C.ink} />
    </mesh>
    <mesh position={[-0.9, 1.22, -2.3]} castShadow>
      <cylinderGeometry args={[0.12, 0.2, 0.22, 16]} />
      <meshStandardMaterial color="#F6E7B8" emissive="#F6D98A" emissiveIntensity={0.3} />
    </mesh>
    <RBox size={[1.2, 0.9, 0.06]} position={[-1.9, 1.9, -2.63]} color="#BFE3F7" radius={0.02} />
    <RBox size={[1.3, 0.08, 0.1]} position={[-1.9, 1.42, -2.6]} color={C.white} radius={0.02} />
    <RBox size={[0.9, 0.6, 0.04]} position={[-3.23, 1.9, 0.6]} rotation={[0, Math.PI / 2, 0]} color="#E8B04A" radius={0.02} />

    <Tiao position={HOUSE.tiao} rotation={tiaoRot} mood={mood} pose={pose} outfit="towel" cold={cold} t={t} wet={false} />

    {/* entorno */}
    {(
      [
        [-6, 0, -4, 1.3, 0.3],
        [-8.5, 0, 1, 1.1, 1.7],
        [6.5, 0, -3.5, 1.4, 2.6],
        [8.5, 0, 1.5, 1.0, 0.9],
        [-5, 0, -9, 1.6, 2.2],
        [4.5, 0, -9.5, 1.5, 1.2],
        [-12, 0, -6, 1.8, 0.5],
        [12, 0, -7, 1.7, 2.9],
      ] as number[][]
    ).map(([x, y, z, s, r]) => (
      <Tree key={`${x}${z}`} position={[x, y, z]} scale={s} seed={r} />
    ))}
    {(
      [
        [-4.2, 0, 3.0],
        [4.3, 0, 2.6],
        [-2.2, 0, 3.1],
        [5.4, 0, 0.5],
      ] as V3[]
    ).map((p) => (
      <Bush key={p.join()} position={p} />
    ))}
    {/* casas ao fundo */}
    {(
      [
        [-11, -12, "#EBD9C2"],
        [11, -13, "#E2E6D3"],
        [0, -16, "#F0DCCB"],
      ] as [number, number, string][]
    ).map(([x, z, col]) => (
      <group key={x} position={[x, 0, z]}>
        <RBox size={[4, 2.6, 3.5]} position={[0, 1.3, 0]} color={col} radius={0.05} />
        <mesh position={[0, 3.0, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
          <coneGeometry args={[3.0, 1.2, 4]} />
          <meshStandardMaterial color={C.roofDark} flatShading />
        </mesh>
      </group>
    ))}
    <Cloud position={[-6 + ((t * 0.15) % 12), 9, -14]} scale={1.8} />
    <Cloud position={[5 + ((t * 0.1) % 8), 10.5, -18]} scale={2.2} />
    <Cloud position={[0 + ((t * 0.12) % 8), 8, -22]} scale={1.5} />
  </group>
);
