import { useMemo } from "react";
import * as THREE from "three";
import { perfilGeo, PKey, skinTexture, useEnv, V3 } from "./comum";

// =====================================================================
// BACALHAU (bacalhau-do-murray, predador do rio). Comprimento ≈ 2,4 un (1,2 m). Frente = +z.
// `nadar` = ondulação do corpo e do rabo; `boca` abre a bocarra.
// =====================================================================
const FISH: PKey[] = [
  [-1.2, 0.02, 0.02, 0.02, 0],
  [-0.95, 0.09, 0.14, 0.12, 0.0],
  [-0.4, 0.2, 0.3, 0.26, 0.02],
  [0.2, 0.23, 0.32, 0.28, 0.0],
  [0.75, 0.2, 0.25, 0.22, -0.02],
  [1.15, 0.12, 0.13, 0.12, -0.04],
];
let FG: { body: THREE.BufferGeometry; tail: THREE.ShapeGeometry; fin: THREE.ShapeGeometry; sph: THREE.SphereGeometry } | null = null;
const fishGeos = () => {
  if (FG) return FG;
  const tail = new THREE.Shape();
  tail.moveTo(0, 0);
  tail.quadraticCurveTo(-0.25, 0.35, -0.55, 0.42);
  tail.quadraticCurveTo(-0.42, 0, -0.55, -0.42);
  tail.quadraticCurveTo(-0.25, -0.35, 0, 0);
  const tg = new THREE.ShapeGeometry(tail, 10);
  tg.rotateY(Math.PI / 2); // plano yz, aponta para −z
  const fin = new THREE.Shape();
  fin.moveTo(-0.6, 0);
  fin.quadraticCurveTo(-0.3, 0.32, 0.1, 0.36);
  fin.quadraticCurveTo(0.3, 0.2, 0.45, 0);
  const fg = new THREE.ShapeGeometry(fin, 10);
  fg.rotateY(-Math.PI / 2);
  FG = { body: perfilGeo(FISH, { seg: 48, rad: 36 }), tail: tg, fin: fg, sph: new THREE.SphereGeometry(1, 20, 14) };
  return FG;
};
export const Bacalhau: React.FC<{ t: number; boca?: number; position?: V3; rotation?: V3; scale?: number }> = ({ t, boca = 0.3, position, rotation, scale = 1 }) => {
  const env = useEnv();
  const M = useMemo(
    () => ({
      skin: new THREE.MeshStandardMaterial({ map: skinTexture("#46522B", 61, 1400, 0.32), roughness: 0.5, envMap: env, envMapIntensity: 0.4 }),
      fin: new THREE.MeshStandardMaterial({ color: "#323C1E", roughness: 0.6, side: THREE.DoubleSide, transparent: true, opacity: 0.9 }),
      eye: new THREE.MeshStandardMaterial({ color: "#0A0A08", roughness: 0.1, envMap: env }),
      ring: new THREE.MeshStandardMaterial({ color: "#2E3318", roughness: 0.6 }),
      inside: new THREE.MeshStandardMaterial({ color: "#C9B9A0", roughness: 0.7 }),
      mouth: new THREE.MeshStandardMaterial({ color: "#1B120E", roughness: 0.8 }),
    }),
    [env],
  );
  const g = fishGeos();
  const wav = Math.sin(t * 5);
  return (
    <group position={position} rotation={rotation} scale={scale}>
      <group rotation={[0, wav * 0.08, 0]}>
        <mesh geometry={g.body} material={M.skin} castShadow />
        {/* bocarra (abre para baixo) */}
        <mesh geometry={g.sph} material={M.mouth} position={[0, -0.04 - boca * 0.05, 1.08]} scale={[0.14, 0.03 + boca * 0.13, 0.11]} />
        {/* lábio de baixo / mandíbula descendo */}
        <mesh geometry={g.sph} material={M.inside} position={[0, -0.09 - boca * 0.13, 1.02]} scale={[0.13, 0.03, 0.12]} />
        {([1, -1] as const).map((s) => (
          <group key={s} position={[0.155 * s, 0.09, 0.85]}>
            <mesh geometry={g.sph} material={M.ring} scale={0.034} />
            <mesh geometry={g.sph} material={M.eye} position={[0.01 * s, 0, 0.008]} scale={0.024} />
          </group>
        ))}
        <mesh geometry={g.fin} material={M.fin} position={[0, 0.27, -0.2]} />
        {([1, -1] as const).map((s) => (
          <mesh key={s} geometry={g.fin} material={M.fin} position={[0.2 * s, -0.12, 0.45]} rotation={[0, 0, (Math.PI / 2 + 0.6) * s + Math.sin(t * 7 + s) * 0.2]} scale={0.45} />
        ))}
        <group position={[0, 0, -1.15]} rotation={[0, wav * 0.45, 0]}>
          <mesh geometry={g.tail} material={M.fin} />
        </group>
      </group>
    </group>
  );
};

// =====================================================================
// SALA ESCURA com LUZ NEGRA: chão e paredes quase pretos; o tubo de luz UV na parede acende (luz 0..1)
// com um tom roxo. O bicho fica em (0,0,0). Câmera em z > 0.
// =====================================================================
export const SalaUV: React.FC<{ t: number; luz: number; pulso?: number }> = ({ t, luz, pulso = 0 }) => {
  const M = useMemo(
    () => ({
      floor: new THREE.MeshStandardMaterial({ color: "#14121A", roughness: 0.9 }),
      wall: new THREE.MeshStandardMaterial({ color: "#100E16", roughness: 1 }),
      tube: new THREE.MeshStandardMaterial({ color: "#2A1E40", emissive: new THREE.Color("#9B4DFF"), emissiveIntensity: 0, roughness: 0.3 }),
      cap: new THREE.MeshStandardMaterial({ color: "#2B2B30", roughness: 0.5, metalness: 0.6 }),
    }),
    [],
  );
  const k = luz * (1 + pulso * 0.25 * Math.sin(t * 9));
  M.tube.emissiveIntensity = 3.2 * k;
  return (
    <group>
      <color attach="background" args={["#05040A"]} />
      {/* sala fechada (sem céu vazando por trás) */}
      <mesh position={[0, 4, 0]}>
        <boxGeometry args={[24, 8.2, 24]} />
        <meshStandardMaterial color="#0C0A12" roughness={1} side={THREE.BackSide} />
      </mesh>
      <mesh material={M.floor} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[30, 30]} />
      </mesh>
      <mesh material={M.wall} position={[0, 3, -2.2]}>
        <planeGeometry args={[30, 8]} />
      </mesh>
      {/* tubo de luz negra na parede */}
      <group position={[0, 1.55, -2.1]} rotation={[0, 0, Math.PI / 2]}>
        <mesh material={M.tube}>
          <cylinderGeometry args={[0.05, 0.05, 2.4, 16]} />
        </mesh>
        {[1, -1].map((s) => (
          <mesh key={s} material={M.cap} position={[0, 1.22 * s, 0]}>
            <cylinderGeometry args={[0.065, 0.065, 0.08, 16]} />
          </mesh>
        ))}
      </group>
      <pointLight position={[0, 1.4, -1.6]} color="#8A46FF" intensity={5 * k} distance={9} decay={1.3} />
      <pointLight position={[1.5, 1.6, 2.2]} color="#6B3BFF" intensity={1.6 * k} distance={7} decay={1.4} />
      {/* brilho do tubo no chão/parede */}
      <mesh position={[0, 0.002, -1.4]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[4.5, 1.6]} />
        <meshBasicMaterial color="#7A3CFF" transparent opacity={0.12 * k} depthWrite={false} />
      </mesh>
    </group>
  );
};
