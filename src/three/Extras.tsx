import * as THREE from "three";
import { C } from "../theme";
import { Glow, Pipe, RBox } from "./basics";

type V3 = [number, number, number];

// Relógio de luz com disco girando (velocidade = consumo).
export const Meter: React.FC<{ position?: V3; t: number; speed: number; scale?: number }> = ({ position = [0, 0, 0], t, speed, scale = 1 }) => {
  const angle = t * speed * Math.PI * 2;
  return (
    <group position={position} scale={scale}>
      <RBox size={[1.6, 2.2, 0.6]} position={[0, 0, 0]} color="#D9DDE0" radius={0.12} />
      <RBox size={[1.3, 1.6, 0.05]} position={[0, 0.12, 0.31]} color="#F3F6F8" radius={0.06} />
      {/* contador */}
      <RBox size={[1.0, 0.28, 0.04]} position={[0, 0.62, 0.34]} color={C.ink} radius={0.03} />
      {[-0.36, -0.18, 0, 0.18, 0.36].map((x, i) => (
        <RBox key={x} size={[0.13, 0.2, 0.02]} position={[x, 0.62, 0.37]} color={i === 4 ? "#E8352B" : "#FFFFFF"} radius={0.02} />
      ))}
      {/* disco de alumínio */}
      <group position={[0, 0.0, 0.25]}>
        <mesh rotation={[0, angle, 0]}>
          <cylinderGeometry args={[0.5, 0.5, 0.05, 40]} />
          <meshStandardMaterial color="#B9C2C9" metalness={0.7} roughness={0.25} />
        </mesh>
        <mesh rotation={[0, angle, 0]} position={[0, 0.03, 0]}>
          <boxGeometry args={[0.08, 0.012, 0.5]} />
          <meshStandardMaterial color="#1A1A1A" />
        </mesh>
      </group>
      <RBox size={[1.3, 0.05, 0.05]} position={[0, 0.03, 0.33]} color="#7E878E" radius={0.02} />
      {/* vidro */}
      <RBox size={[1.34, 1.64, 0.04]} position={[0, 0.12, 0.42]} color="#DDF2FF" radius={0.08} opacity={0.18} cast={false} />
      <Pipe points={[[0.3, -1.1, 0], [0.3, -2.2, 0]]} radius={0.06} color={C.ink} />
      <Pipe points={[[-0.3, -1.1, 0], [-0.3, -2.2, 0]]} radius={0.06} color={C.ink} />
    </group>
  );
};

// Quadro de disjuntores com o do chuveiro em destaque e fio terra.
export const BreakerPanel: React.FC<{ position?: V3; t: number; highlight: number; ground: number }> = ({ position = [0, 0, 0], t, highlight, ground }) => {
  const rows = [0.75, 0.0];
  const breakers = [];
  for (const y of rows) {
    for (let i = 0; i < 6; i++) {
      const x = -1.0 + i * 0.4;
      const isShower = y === 0.0 && i === 5;
      breakers.push(
        <group key={`${x}${y}`} position={[x, y, 0.15]}>
          <RBox size={isShower ? [0.5, 0.62, 0.3] : [0.34, 0.52, 0.26]} position={[isShower ? 0.08 : 0, 0, 0]} color={isShower ? "#FFFFFF" : "#F0F0EC"} radius={0.04} emissive={C.accent} emissiveIntensity={isShower ? highlight * 0.5 : 0} />
          <RBox size={[0.1, 0.16, 0.12]} position={[isShower ? 0.08 : 0, 0.06, 0.16]} color={isShower ? C.accent : C.ink} radius={0.03} />
        </group>,
      );
    }
  }
  return (
    <group position={position}>
      <RBox size={[2.9, 2.4, 0.3]} position={[0, 0.3, 0]} color="#B7BEC4" radius={0.08} />
      <RBox size={[2.6, 2.1, 0.06]} position={[0, 0.3, 0.14]} color="#4A5259" radius={0.05} />
      {/* porta aberta */}
      <group position={[-1.45, 0.3, 0.16]} rotation={[0, -1.9, 0]}>
        <RBox size={[2.7, 2.3, 0.06]} position={[1.35, 0, 0]} color="#C3CAD0" radius={0.06} />
      </group>
      {breakers}
      <Glow position={[1.08, 0.0, 0.55]} size={1.4} color={C.accent} opacity={highlight * (0.55 + Math.sin(t * 6) * 0.15)} />
      {/* fio terra verde e amarelo */}
      <group>
        <Pipe points={[[1.1, -0.35, 0.3], [1.15, -0.9, 0.45], [1.25, -1.4, 0.4], [1.35, -2.4, 0.3]]} radius={0.055 + ground * 0.02} color={C.groundWire} emissive={C.groundWire} emissiveIntensity={ground * 0.5} />
        {[0.15, 0.35, 0.55, 0.75].map((u) => {
          const y = -0.35 - u * 2.05;
          return (
            <mesh key={u} position={[1.12 + u * 0.24, y, 0.36 + Math.sin(u * 3) * 0.05]} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.07 + ground * 0.02, 0.025, 6, 16]} />
              <meshStandardMaterial color={C.groundWire2} emissive={C.groundWire2} emissiveIntensity={ground * 0.4} />
            </mesh>
          );
        })}
      </group>
      <Pipe points={[[0.6, -0.35, 0.3], [0.55, -1.2, 0.4], [0.5, -2.4, 0.3]]} radius={0.05} color="#C9472F" />
      <Pipe points={[[0.85, -0.35, 0.3], [0.85, -1.2, 0.42], [0.85, -2.4, 0.3]]} radius={0.05} color="#2F4C8F" />
    </group>
  );
};

// Faíscas: pontinhos amarelos que saltam de um ponto.
export const Sparks: React.FC<{ origin: V3; t: number; amount: number; seed?: number }> = ({ origin, t, amount, seed = 1 }) => {
  if (amount <= 0.01) return null;
  const items = [];
  for (let i = 0; i < 18; i++) {
    const r1 = Math.abs(Math.sin((i + seed) * 12.9898) * 43758.5453) % 1;
    const r2 = Math.abs(Math.sin((i + seed) * 78.233) * 12543.1) % 1;
    const life = (r1 + t * 2.2) % 1;
    const a = r2 * Math.PI * 2;
    const v = 0.6 + r1 * 0.8;
    const p = new THREE.Vector3(Math.cos(a) * v * life, (0.8 * life - 1.6 * life * life) * v, Math.sin(a) * v * life * 0.6 + 0.2);
    items.push(
      <mesh key={i} position={[origin[0] + p.x, origin[1] + p.y, origin[2] + p.z]} scale={(1 - life) * amount}>
        <sphereGeometry args={[0.035, 6, 6]} />
        <meshStandardMaterial color={C.energy} emissive={C.energy} emissiveIntensity={2} />
      </mesh>,
    );
  }
  return <group>{items}</group>;
};
