import { useMemo } from "react";
import * as THREE from "three";
import { rnd } from "../World";
import { clamp01, skinTexture, smooth01, useEnv, V3 } from "./comum";

// =====================================================================
// OBJETOS do formato: ovinhos, seringa de morfina, pilha de marmitas.
// =====================================================================
const SPH = new THREE.SphereGeometry(1, 32, 22);

// Ovinhos de casca de couro (≈ 1,7 cm reais → 0,035 un). Use `escala` p/ close.
export const Ovos: React.FC<{ t: number; n?: number; balancar?: number; position?: V3; rotation?: V3; scale?: number }> = ({ t, n = 2, balancar = 0, position, rotation, scale = 1 }) => {
  const env = useEnv();
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ map: skinTexture("#D9C49A", 21, 2200, 0.07), roughness: 0.7, envMap: env, envMapIntensity: 0.3 }), [env]);
  return (
    <group position={position} rotation={rotation} scale={scale}>
      {Array.from({ length: n }).map((_, i) => {
        const wob = Math.sin(t * 5 + i * 2) * 0.12 * balancar;
        return (
          <mesh key={i} geometry={SPH} material={mat} position={[(i - (n - 1) / 2) * 0.042, 0.022, (i % 2) * 0.012]} rotation={[0.2 + wob, i * 1.3, 1.45 + wob * 0.5]} scale={[0.0215, 0.0215, 0.028]} castShadow receiveShadow />
        );
      })}
    </group>
  );
};

// Seringa (morfina). empurrar 0..1 = êmbolo descendo; o líquido diminui.
export const Seringa: React.FC<{ empurrar?: number; position?: V3; rotation?: V3; scale?: number }> = ({ empurrar = 0, position, rotation, scale = 1 }) => {
  const env = useEnv();
  const M = useMemo(
    () => ({
      glass: new THREE.MeshPhysicalMaterial({ color: "#F4FBFF", roughness: 0.05, transparent: true, opacity: 0.35, envMap: env, envMapIntensity: 1.2 }),
      liquid: new THREE.MeshStandardMaterial({ color: "#B9E8FF", emissive: new THREE.Color("#7FD4FF"), emissiveIntensity: 0.3, transparent: true, opacity: 0.8 }),
      plastic: new THREE.MeshStandardMaterial({ color: "#F7F7F2", roughness: 0.4 }),
      rubber: new THREE.MeshStandardMaterial({ color: "#2E2F33", roughness: 0.6 }),
      steel: new THREE.MeshStandardMaterial({ color: "#D9DEE2", metalness: 0.9, roughness: 0.2, envMap: env }),
      ink: new THREE.MeshStandardMaterial({ color: "#3A6FB8" }),
    }),
    [env],
  );
  const p = clamp01(empurrar);
  const L = 0.8;
  const liq = L * (1 - p * 0.85);
  return (
    <group position={position} rotation={rotation} scale={scale}>
      <mesh material={M.glass} position={[0, L / 2, 0]} renderOrder={4}>
        <cylinderGeometry args={[0.07, 0.07, L, 24, 1, true]} />
      </mesh>
      <mesh material={M.liquid} position={[0, 0.02 + liq / 2, 0]} renderOrder={3}>
        <cylinderGeometry args={[0.064, 0.064, liq, 20]} />
      </mesh>
      {Array.from({ length: 8 }).map((_, i) => (
        <mesh key={i} material={M.ink} position={[0, 0.1 + i * 0.085, 0.071]}>
          <boxGeometry args={[i % 2 ? 0.03 : 0.05, 0.006, 0.002]} />
        </mesh>
      ))}
      {/* êmbolo */}
      <group position={[0, 0.02 + liq, 0]}>
        <mesh material={M.rubber} position={[0, 0.02, 0]}>
          <cylinderGeometry args={[0.066, 0.066, 0.04, 20]} />
        </mesh>
        <mesh material={M.plastic} position={[0, 0.5, 0]}>
          <boxGeometry args={[0.03, 0.9, 0.09]} />
        </mesh>
        <mesh material={M.plastic} position={[0, 0.96, 0]}>
          <cylinderGeometry args={[0.11, 0.11, 0.025, 24]} />
        </mesh>
      </group>
      <mesh material={M.plastic} position={[0, L, 0]}>
        <cylinderGeometry args={[0.14, 0.14, 0.03, 24]} />
      </mesh>
      <mesh material={M.plastic} position={[0, -0.02, 0]}>
        <cylinderGeometry args={[0.03, 0.07, 0.06, 16]} />
      </mesh>
      <mesh material={M.steel} position={[0, -0.32, 0]}>
        <cylinderGeometry args={[0.006, 0.006, 0.55, 8]} />
      </mesh>
    </group>
  );
};

// Pilha de marmitas de alumínio (para "14 kg de comida por dia").
// aparecer 0..1 vai empilhando uma a uma.
export const Marmitas: React.FC<{ n?: number; aparecer?: number; position?: V3; rotation?: V3; scale?: number }> = ({ n = 28, aparecer = 1, position, rotation, scale = 1 }) => {
  const env = useEnv();
  const M = useMemo(
    () => ({
      foil: new THREE.MeshStandardMaterial({ color: "#A9B0B8", metalness: 0.85, roughness: 0.38, envMap: env, envMapIntensity: 0.7, flatShading: true }),
      lid: new THREE.MeshStandardMaterial({ color: "#C3C8CE", metalness: 0.8, roughness: 0.3, envMap: env, envMapIntensity: 0.6 }),
      rice: new THREE.MeshStandardMaterial({ map: skinTexture("#F3EEDF", 71, 2500, 0.08), roughness: 0.85 }),
      beans: new THREE.MeshStandardMaterial({ map: skinTexture("#5A3322", 72, 2500, 0.12), roughness: 0.5 }),
      green: new THREE.MeshStandardMaterial({ color: "#5FA243", roughness: 0.7 }),
    }),
    [env],
  );
  const box = useMemo(() => {
    const g = new THREE.CylinderGeometry(0.5, 0.42, 0.24, 4, 1);
    g.rotateY(Math.PI / 4);
    g.scale(1.25, 1, 0.9);
    return g;
  }, []);
  // pirâmide: base 4×3, depois 3×2...
  const slots: V3[] = [];
  const layers = [[4, 3], [3, 3], [3, 2], [2, 2], [2, 1], [1, 1], [1, 1]];
  let y = 0.12;
  for (const [cx, cz] of layers)
    for (let i = 0; i < cx; i++)
      for (let k = 0; k < cz; k++) {
        if (slots.length >= n) break;
        slots.push([(i - (cx - 1) / 2) * 0.92, y, (k - (cz - 1) / 2) * 0.82]);
      }
  layers.forEach(() => (y += 0.26));
  return (
    <group position={position} rotation={rotation} scale={scale}>
      {slots.map((s, i) => {
        const yy = (i: number) => {
          let acc = 0, layer = 0;
          for (const [cx, cz] of layers) {
            if (i < acc + cx * cz) return layer;
            acc += cx * cz;
            layer++;
          }
          return layer;
        };
        const k = smooth01(clamp01(aparecer * slots.length - i));
        if (k <= 0) return null;
        const drop = (1 - k) * 0.8;
        return (
          <group key={i} position={[s[0], 0.12 + yy(i) * 0.26 + drop, s[2]]} rotation={[0, (rnd(i, 3) - 0.5) * 0.12, 0]} scale={0.6 + 0.4 * k}>
            <mesh geometry={box} material={M.foil} castShadow receiveShadow />
            {/* borda dobrada de alumínio */}
            <mesh material={M.lid} position={[0, 0.12, 0]}>
              <boxGeometry args={[1.1, 0.02, 0.84]} />
            </mesh>
            {/* arroz e feijão */}
            <mesh material={M.rice} position={[-0.2, 0.125, 0]} scale={[0.32, 0.05, 0.33]}>
              <sphereGeometry args={[1, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
            </mesh>
            <mesh material={M.beans} position={[0.24, 0.12, 0]} scale={[0.26, 0.04, 0.32]}>
              <sphereGeometry args={[1, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
            </mesh>
            <mesh material={M.green} position={[0.0, 0.16, 0.18]} scale={[0.05, 0.02, 0.05]}>
              <sphereGeometry args={[1, 8, 6]} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
};

// Respingos d'água (briga, mergulho): gotas em parábola + anel de espuma. forca 0..1.
const DROP_M = new THREE.MeshStandardMaterial({ color: "#E8FAFF", roughness: 0.05, transparent: true, opacity: 0.85, emissive: new THREE.Color("#9FE3F5"), emissiveIntensity: 0.2 });
const FOAM_M = new THREE.MeshBasicMaterial({ color: "#FFFFFF", transparent: true, opacity: 0.5, depthWrite: false });
export const Respingos: React.FC<{ t: number; forca?: number; n?: number; raio?: number; position?: V3 }> = ({ t, forca = 1, n = 26, raio = 0.5, position }) => {
  if (forca <= 0.01) return null;
  return (
    <group position={position}>
      {Array.from({ length: n }).map((_, i) => {
        const per = 0.55 + rnd(i, 11) * 0.35;
        const ph = ((t / per + rnd(i, 12)) % 1 + 1) % 1;
        const a = rnd(i, 13) * Math.PI * 2;
        const v = (0.4 + rnd(i, 14) * 0.8) * raio;
        const up = (0.6 + rnd(i, 15) * 0.9) * raio * forca;
        const x = Math.cos(a) * v * ph, z = Math.sin(a) * v * ph;
        const y = up * 4 * ph * (1 - ph);
        return <mesh key={i} geometry={SPH} material={DROP_M} position={[x, y, z]} scale={(0.012 + rnd(i, 16) * 0.02) * (1 - ph * 0.5) * forca} />;
      })}
      {[0, 1].map((k) => {
        const ph = ((t * 1.3 + k * 0.5) % 1 + 1) % 1;
        return (
          <mesh key={k} material={FOAM_M} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} scale={raio * (0.3 + ph * 0.9)}>
            <ringGeometry args={[0.8, 1, 32]} />
          </mesh>
        );
      })}
    </group>
  );
};
