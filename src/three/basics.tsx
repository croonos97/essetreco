import { RoundedBox } from "@react-three/drei";
import { useMemo } from "react";
import * as THREE from "three";
import { C } from "../theme";

type V3 = [number, number, number];

// Caixa arredondada com material fosco padrão.
export const RBox: React.FC<{
  size: V3;
  position?: V3;
  rotation?: V3;
  color: string;
  radius?: number;
  emissive?: string;
  emissiveIntensity?: number;
  opacity?: number;
  roughness?: number;
  metalness?: number;
  cast?: boolean;
}> = ({ size, position, rotation, color, radius = 0.04, emissive, emissiveIntensity = 0, opacity = 1, roughness = 0.75, metalness = 0, cast = true }) => (
  <RoundedBox args={size} radius={Math.min(radius, Math.min(...size) / 2.05)} smoothness={3} position={position} rotation={rotation} castShadow={cast} receiveShadow>
    <meshStandardMaterial
      color={color}
      roughness={roughness}
      metalness={metalness}
      emissive={emissive ?? "#000"}
      emissiveIntensity={emissiveIntensity}
      transparent={opacity < 1}
      opacity={opacity}
    />
  </RoundedBox>
);

export const Box: React.FC<{ size: V3; position?: V3; rotation?: V3; color: string; opacity?: number; emissive?: string; emissiveIntensity?: number; cast?: boolean }> = ({
  size,
  position,
  rotation,
  color,
  opacity = 1,
  emissive,
  emissiveIntensity = 0,
  cast = true,
}) => (
  <mesh position={position} rotation={rotation} castShadow={cast} receiveShadow>
    <boxGeometry args={size} />
    <meshStandardMaterial color={color} roughness={0.8} transparent={opacity < 1} opacity={opacity} emissive={emissive ?? "#000"} emissiveIntensity={emissiveIntensity} />
  </mesh>
);

// Árvore low-poly (copa em icosaedro facetado).
export const Tree: React.FC<{ position: V3; scale?: number; seed?: number }> = ({ position, scale = 1, seed = 0 }) => {
  const s = scale;
  return (
    <group position={position} scale={s} rotation={[0, seed, 0]}>
      <mesh position={[0, 0.6, 0]} castShadow>
        <cylinderGeometry args={[0.09, 0.13, 1.2, 6]} />
        <meshStandardMaterial color={C.trunk} roughness={0.9} flatShading />
      </mesh>
      <mesh position={[0, 1.55, 0]} castShadow>
        <icosahedronGeometry args={[0.75, 0]} />
        <meshStandardMaterial color={seed % 2 > 1 ? C.leafDark : C.leaf} roughness={0.85} flatShading />
      </mesh>
      <mesh position={[0.35, 1.25, 0.15]} castShadow>
        <icosahedronGeometry args={[0.45, 0]} />
        <meshStandardMaterial color={C.leafDark} roughness={0.85} flatShading />
      </mesh>
    </group>
  );
};

export const Bush: React.FC<{ position: V3; scale?: number }> = ({ position, scale = 1 }) => (
  <group position={position} scale={scale}>
    {[
      [0, 0.22, 0, 0.3],
      [0.3, 0.18, 0.05, 0.24],
      [-0.28, 0.17, -0.04, 0.22],
    ].map(([x, y, z, r], i) => (
      <mesh key={i} position={[x, y, z]} castShadow>
        <icosahedronGeometry args={[r, 0]} />
        <meshStandardMaterial color={i === 0 ? C.leaf : C.leafDark} flatShading roughness={0.9} />
      </mesh>
    ))}
  </group>
);

// Nuvem de esferas, desliza devagar.
export const Cloud: React.FC<{ position: V3; scale?: number }> = ({ position, scale = 1 }) => (
  <group position={position} scale={scale}>
    {[
      [0, 0, 0, 0.7],
      [0.75, -0.1, 0, 0.55],
      [-0.7, -0.12, 0.05, 0.5],
      [0.3, 0.35, 0, 0.5],
    ].map(([x, y, z, r], i) => (
      <mesh key={i} position={[x, y, z]}>
        <icosahedronGeometry args={[r, 1]} />
        <meshStandardMaterial color={C.cloud} roughness={1} flatShading />
      </mesh>
    ))}
  </group>
);

// Chão de grama com camada de terra em corte (estilo diorama).
export const GroundSlab: React.FC<{ w?: number; d?: number; position?: V3 }> = ({ w = 40, d = 40, position = [0, 0, 0] }) => (
  <group position={position}>
    <mesh position={[0, -0.05, 0]} receiveShadow>
      <boxGeometry args={[w, 0.1, d]} />
      <meshStandardMaterial color={C.grass} roughness={0.95} />
    </mesh>
    <mesh position={[0, -0.9, 0]} receiveShadow>
      <boxGeometry args={[w, 1.6, d]} />
      <meshStandardMaterial color={C.dirt} roughness={1} />
    </mesh>
  </group>
);

// Tubo seguindo pontos (cano, fio).
export const Pipe: React.FC<{ points: V3[]; radius?: number; color?: string; opacity?: number; emissive?: string; emissiveIntensity?: number; segments?: number }> = ({
  points,
  radius = 0.06,
  color = C.white,
  opacity = 1,
  emissive,
  emissiveIntensity = 0,
  segments = 64,
}) => {
  const geo = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)), false, "catmullrom", 0.05);
    return new THREE.TubeGeometry(curve, segments, radius, 12, false);
  }, [JSON.stringify(points), radius, segments]);
  return (
    <mesh geometry={geo} castShadow receiveShadow>
      <meshStandardMaterial color={color} roughness={0.5} transparent={opacity < 1} opacity={opacity} emissive={emissive ?? "#000"} emissiveIntensity={emissiveIntensity} depthWrite={opacity >= 1} />
    </mesh>
  );
};

// Partículas que correm por um caminho (água, energia). t = segundos.
export const FlowParticles: React.FC<{
  points: V3[];
  t: number;
  count?: number;
  speed?: number;
  size?: number;
  color: string | ((u: number, i: number) => string);
  emissive?: number;
  visible?: number; // 0..1 densidade visível
  jitter?: number;
  closed?: boolean;
  seed?: number;
}> = ({ points, t, count = 24, speed = 0.25, size = 0.05, color, emissive = 0, visible = 1, jitter = 0, closed = false, seed = 1 }) => {
  const curve = useMemo(() => new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)), closed, "catmullrom", 0.05), [JSON.stringify(points), closed]);
  const items = [];
  const n = Math.round(count * visible);
  for (let i = 0; i < n; i++) {
    const u = (((i / count + t * speed) % 1) + 1) % 1;
    const p = curve.getPointAt(u);
    const r1 = Math.sin(i * 12.9898 + seed) * 43758.5453;
    const r2 = Math.sin(i * 78.233 + seed) * 12543.1;
    const j = jitter;
    const col = typeof color === "function" ? color(u, i) : color;
    items.push(
      <mesh key={i} position={[p.x + (r1 - Math.floor(r1) - 0.5) * j, p.y + (r2 - Math.floor(r2) - 0.5) * j, p.z + ((r1 * 3) % 1 - 0.5) * j]}>
        <sphereGeometry args={[size, 10, 8]} />
        <meshStandardMaterial color={col} emissive={col} emissiveIntensity={emissive} roughness={0.3} />
      </mesh>,
    );
  }
  return <group>{items}</group>;
};

// Brilho aditivo (halo) para dar sensação de calor/luz.
export const Glow: React.FC<{ position: V3; size: number; color: string; opacity?: number }> = ({ position, size, color, opacity = 0.6 }) => {
  const tex = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const g = c.getContext("2d");
    if (g) {
      const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      grd.addColorStop(0, "rgba(255,255,255,1)");
      grd.addColorStop(0.35, "rgba(255,255,255,0.45)");
      grd.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = grd;
      g.fillRect(0, 0, 128, 128);
    }
    const tx = new THREE.CanvasTexture(c);
    return tx;
  }, []);
  if (opacity <= 0.001) return null;
  return (
    <sprite position={position} scale={[size, size, 1]}>
      <spriteMaterial map={tex} color={color} transparent opacity={opacity} blending={THREE.AdditiveBlending} depthWrite={false} />
    </sprite>
  );
};
