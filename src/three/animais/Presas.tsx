import { useThree } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { clamp01, useEnv, V3 } from "./comum";

// =====================================================================
// PRESAS do fundo do rio + ondinhas elétricas (o "sinal" que o bico sente).
// Tamanho real: camarão ~5 cm (0,1 un). Use `scale` para close.
// =====================================================================
const SPH = new THREE.SphereGeometry(1, 20, 14);
const CYL = new THREE.CylinderGeometry(1, 1, 1, 6);

type PresaProps = { t: number; position?: V3; rotation?: V3; scale?: number; nadar?: number };

// Camarão de água doce: corpo segmentado curvo translúcido, antenas longas, leque no rabo.
export const Camarao: React.FC<PresaProps> = ({ t, position, rotation, scale = 1, nadar = 0.5 }) => {
  const env = useEnv();
  const M = useMemo(
    () => ({
      shell: new THREE.MeshStandardMaterial({ color: "#F07A4A", roughness: 0.25, transparent: true, opacity: 0.92, emissive: new THREE.Color("#D9542A"), emissiveIntensity: 0.3, envMap: env, envMapIntensity: 0.7 }),
      dark: new THREE.MeshStandardMaterial({ color: "#1A1414", roughness: 0.2 }),
      leg: new THREE.MeshStandardMaterial({ color: "#E9A687", roughness: 0.5 }),
    }),
    [env],
  );
  const flick = Math.sin(t * 9) * 0.15 * nadar;
  const segs = 6;
  return (
    <group position={position} rotation={rotation} scale={scale}>
      {/* cefalotórax */}
      <mesh geometry={SPH} material={M.shell} position={[0, 0, 0.025]} scale={[0.014, 0.013, 0.028]} />
      {/* rostro */}
      <mesh geometry={CYL} material={M.shell} position={[0, 0.006, 0.058]} rotation={[Math.PI / 2 + 0.2, 0, 0]} scale={[0.002, 0.02, 0.002]} />
      {([1, -1] as const).map((s) => (
        <group key={s}>
          <mesh geometry={SPH} material={M.dark} position={[0.009 * s, 0.006, 0.048]} scale={0.0035} />
          {/* antenas */}
          <mesh geometry={CYL} material={M.leg} position={[0.012 * s, 0.01, 0.1]} rotation={[Math.PI / 2 - 0.25 + Math.sin(t * 3 + s) * 0.08, 0, -0.35 * s]} scale={[0.0008, 0.1, 0.0008]} />
          {/* patinhas */}
          {Array.from({ length: 5 }).map((_, i) => (
            <mesh key={i} geometry={CYL} material={M.leg} position={[0.012 * s, -0.012, 0.035 - i * 0.012]} rotation={[0.3 + Math.sin(t * 14 + i) * 0.3 * nadar, 0, 0.6 * s]} scale={[0.0012, 0.018, 0.0012]} />
          ))}
        </group>
      ))}
      {/* abdômen curvo */}
      <group>
        {Array.from({ length: segs }).map((_, i) => {
          const a = (i + 1) * (0.28 + flick);
          return (
            <group key={i} position={[0, -Math.sin(a) * 0.012 * (i + 1) * 0.6, -Math.cos(a * 0.4) * 0.012 * (i + 1)]} rotation={[a * 0.6, 0, 0]}>
              <mesh geometry={SPH} material={M.shell} scale={[0.012 - i * 0.0012, 0.011 - i * 0.001, 0.009]} />
            </group>
          );
        })}
        <mesh geometry={SPH} material={M.shell} position={[0, -0.05, -0.05]} rotation={[1.2 + flick, 0, 0]} scale={[0.016, 0.003, 0.012]} />
      </group>
    </group>
  );
};

// Larva (de inseto aquático): segmentos marrons com 6 patinhas, ondulando.
export const Larva: React.FC<PresaProps> = ({ t, position, rotation, scale = 1, nadar = 0.5 }) => {
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#7C5A3A", roughness: 0.55 }), []);
  const light = useMemo(() => new THREE.MeshStandardMaterial({ color: "#A88259", roughness: 0.6 }), []);
  const n = 9;
  return (
    <group position={position} rotation={rotation} scale={scale}>
      {Array.from({ length: n }).map((_, i) => {
        const x = Math.sin(t * 4 - i * 0.7) * 0.004 * nadar * i;
        const r = i === 0 ? 0.008 : 0.0095 - Math.abs(i - 3) * 0.0008;
        return <mesh key={i} geometry={SPH} material={i % 2 ? light : mat} position={[x, 0, -i * 0.011]} scale={[r, r * 0.8, r * 0.9]} />;
      })}
      {[0, 1, 2].map((i) =>
        ([1, -1] as const).map((s) => (
          <mesh key={`${i}${s}`} geometry={CYL} material={mat} position={[0.01 * s, -0.004, -0.012 - i * 0.008]} rotation={[Math.sin(t * 10 + i) * 0.4 * nadar, 0, 1.1 * s]} scale={[0.001, 0.012, 0.001]} />
        )),
      )}
    </group>
  );
};

// Minhoca rosa ondulando.
export const Minhoca: React.FC<PresaProps> = ({ t, position, rotation, scale = 1, nadar = 0.6 }) => {
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#D98585", roughness: 0.35, emissive: new THREE.Color("#B35B5B"), emissiveIntensity: 0.1 }), []);
  const band = useMemo(() => new THREE.MeshStandardMaterial({ color: "#C46A6E", roughness: 0.4 }), []);
  const n = 22;
  return (
    <group position={position} rotation={rotation} scale={scale}>
      {Array.from({ length: n }).map((_, i) => (
        <mesh key={i} geometry={SPH} material={i === 6 || i === 7 ? band : mat} position={[Math.sin(t * 3.5 - i * 0.45) * 0.012 * nadar, Math.abs(Math.sin(t * 2 - i * 0.3)) * 0.004, -i * 0.007]} scale={0.0055 * (1 - Math.pow(Math.abs(i - 9) / 14, 2) * 0.5)} />
      ))}
    </group>
  );
};

// Ondinhas elétricas: anéis que se espalham a partir da presa (sempre de frente para a câmera).
export const Ondinhas: React.FC<{ t: number; position?: V3; cor?: string; periodo?: number; alcance?: number; aneis?: number; intensidade?: number }> = ({
  t,
  position,
  cor = "#FFD23F",
  periodo = 1.1,
  alcance = 0.35,
  aneis = 3,
  intensidade = 1,
}) => {
  const cam = useThree((s) => s.camera);
  const ref = useRef<THREE.Group>(null);
  const geo = useMemo(() => new THREE.RingGeometry(0.86, 1, 48), []);
  // de frente para a câmera (roda depois do CameraRig, que vem antes na árvore)
  useLayoutEffect(() => {
    const g = ref.current;
    if (!g || !g.parent) return;
    g.parent.updateWorldMatrix(true, false);
    const q = new THREE.Quaternion();
    g.parent.getWorldQuaternion(q);
    g.quaternion.copy(q.invert().multiply(cam.quaternion));
  });
  const mats = useMemo(() => Array.from({ length: aneis }).map(() => new THREE.MeshBasicMaterial({ color: cor, transparent: true, depthWrite: false, side: THREE.DoubleSide })), [aneis, cor]);
  if (intensidade <= 0) return null;
  return (
    <group ref={ref} position={position}>
      {mats.map((m, i) => {
        const p = ((t / periodo + i / aneis) % 1 + 1) % 1;
        m.opacity = clamp01(intensidade) * (1 - p) * 0.9;
        return <mesh key={i} geometry={geo} material={m} scale={0.02 + p * alcance} renderOrder={8} />;
      })}
    </group>
  );
};
