import { useMemo } from "react";
import * as THREE from "three";
import { KIT, clamp01, Furry, furTexture, makeFur, mix, perfilGeo, PKey, useEnv, V3 } from "./comum";

// =====================================================================
// CACHORRO caramelo (vira-lata) low-poly peludo. Altura no ombro ≈ 1 un (50 cm).
// Origem = chão entre as patas. Frente = +z.
// =====================================================================
export type CachorroProps = {
  t: number;
  andar?: number; // passo (0..1)
  farejar?: number; // cabeça baixa, focinho mexendo
  morder?: number; // bote: cabeça pra frente, boca aberta
  dor?: number; // ganindo: orelhas pra trás, cabeça baixa, rabo entre as pernas, olho apertado
  cambalear?: number; // corpo balança e trança as patas (sem sangue, sem morte)
  pelo?: number; // nº de cascas
  cor?: [string, string]; // dorso, barriga
  position?: V3;
  rotation?: V3;
  scale?: number;
};

const BODY: PKey[] = [
  [-0.42, 0.1, 0.1, 0.1, 0],
  [-0.32, 0.17, 0.16, 0.15, 0],
  [-0.1, 0.17, 0.16, 0.14, 0.01],
  [0.12, 0.19, 0.18, 0.16, 0.03],
  [0.3, 0.16, 0.17, 0.13, 0.06],
  [0.4, 0.1, 0.11, 0.09, 0.1],
];
const HEAD: PKey[] = [
  [-0.12, 0.1, 0.11, 0.1, 0],
  [-0.04, 0.15, 0.15, 0.12, 0.02],
  [0.06, 0.14, 0.13, 0.1, 0.0],
  [0.12, 0.1, 0.09, 0.08, -0.04],
  [0.2, 0.088, 0.072, 0.064, -0.055],
  [0.245, 0.072, 0.056, 0.05, -0.06],
];
let G: { body: THREE.BufferGeometry; head: THREE.BufferGeometry; cap: THREE.CapsuleGeometry; sph: THREE.SphereGeometry; ear: THREE.ConeGeometry; tail: THREE.BufferGeometry } | null = null;
const geos = () =>
  (G ??= {
    body: perfilGeo(BODY, { seg: 48, rad: 40 }),
    head: perfilGeo(HEAD, { seg: 40, rad: 36 }),
    cap: new THREE.CapsuleGeometry(1, 1, 6, 16),
    sph: new THREE.SphereGeometry(1, 24, 18),
    ear: new THREE.ConeGeometry(1, 1, 4, 1),
    tail: perfilGeo([[0, 0.045, 0.045, 0.045], [0.15, 0.04, 0.04, 0.04], [0.3, 0.025, 0.025, 0.025]], { seg: 20, rad: 16, capBack: 0 }),
  });

const COLEIRA = new THREE.TorusGeometry(1, 0.2, 10, 32);
export const Cachorro: React.FC<CachorroProps> = (P) => {
  const { t } = P;
  const env = useEnv();
  const [c1, c2] = P.cor ?? ["#33261F", "#F2ECE2"]; // vira-lata preto e branco (não lembra raposa)
  const M = useMemo(() => {
    const fur = makeFur({ map: furTexture(c1, c2, 8), len: 0.03, dens: 120, rootDark: 0.32, tip: 0.2, clump: 0.47, flow: [0, -0.4, -0.5] });
    return {
      fur,
      nose: new THREE.MeshStandardMaterial({ color: "#151314", roughness: 0.25, envMap: env, envMapIntensity: 0.9 }),
      eye: new THREE.MeshStandardMaterial({ color: "#1E120B", roughness: 0.06, envMap: env, envMapIntensity: 0.7 }),
      spark: new THREE.MeshBasicMaterial({ color: "#FFFFFF" }),
      mouth: new THREE.MeshStandardMaterial({ color: "#5B2A2A", roughness: 0.6 }),
      tongue: new THREE.MeshStandardMaterial({ color: "#E9828E", roughness: 0.4 }),
      paw: new THREE.MeshStandardMaterial({ color: "#3A2A22", roughness: 0.8 }),
      collar: new THREE.MeshStandardMaterial({ color: "#D8242B", roughness: 0.45 }),
      tag: new THREE.MeshStandardMaterial({ color: "#E8C048", roughness: 0.25, metalness: 0.8, envMap: env }),
    };
  }, [c1, c2, env]);
  const g = geos();
  const shells = Math.round((P.pelo ?? 12) * KIT.peloMult);
  M.fur.u.uN.value = shells;
  M.fur.u.uScl.value = P.scale ?? 1;
  const w = P.andar ?? 0, sn = P.farejar ?? 0, bite = P.morder ?? 0, hurt = P.dor ?? 0, wob = P.cambalear ?? 0;
  const ph = t * Math.PI * 2 * (1.6 + wob * 0.6);
  const roll = Math.sin(t * 5.5) * 0.12 * wob;
  const yaw = Math.sin(t * 3.1) * 0.15 * wob;
  const headPitch = mix(-0.1, 0.55, sn) + 0.35 * hurt - 0.25 * bite + Math.sin(t * 9) * 0.04 * sn;
  const headZ = bite * 0.12;
  const jaw = Math.max(bite * 0.6, hurt * 0.35 * (0.5 + 0.5 * Math.sin(t * 12)));
  const earBack = clamp01(hurt + bite * 0.3);
  const tailUp = mix(0.9, -0.9, clamp01(hurt + wob * 0.5));
  const tailWag = Math.sin(t * 14) * 0.5 * (1 - clamp01(hurt + wob));
  const legs: [number, number, number][] = [
    [0.12, 0.27, 0],
    [-0.12, 0.27, Math.PI],
    [0.12, -0.3, Math.PI],
    [-0.12, -0.3, 0],
  ];
  const H = 0.62; // altura do corpo
  return (
    <group position={P.position} rotation={P.rotation} scale={P.scale ?? 1}>
      <group position={[0, H + Math.abs(Math.sin(ph)) * 0.02 * w, 0]} rotation={[0, yaw, roll]}>
        <Furry geo={g.body} fur={M.fur} shells={shells} />
        {/* pescoço + cabeça */}
        <group position={[0, 0.16, 0.36 + headZ]} rotation={[headPitch, Math.sin(t * 2) * 0.1 * sn, 0]}>
          <Furry geo={g.cap} fur={M.fur} shells={shells} position={[0, -0.02, -0.08]} rotation={[0.9, 0, 0]} scale={[0.1, 0.1, 0.1]} />
          {/* coleira vermelha com plaquinha */}
          <group position={[0, -0.03, -0.07]} rotation={[0.9 + Math.PI / 2, 0, 0]}>
            <mesh geometry={COLEIRA} material={M.collar} scale={0.128} />
            <mesh geometry={g.sph} material={M.tag} position={[0, -0.135, 0.0]} scale={[0.022, 0.006, 0.022]} />
          </group>
          <group position={[0, 0.1, 0.02]}>
            <Furry geo={g.head} fur={M.fur} shells={shells} />
            <mesh geometry={g.sph} material={M.nose} position={[0, -0.02, 0.252 + Math.sin(t * 20) * 0.003 * sn]} scale={[0.045, 0.034, 0.03]} />
            {([1, -1] as const).map((s) => (
              <group key={s}>
                <group position={[0.075 * s, 0.05, 0.1]}>
                  <mesh geometry={g.sph} material={M.eye} scale={[0.026, 0.026 * (1 - 0.6 * hurt), 0.022]} />
                  <mesh geometry={g.sph} material={M.spark} position={[0.006, 0.01, 0.018]} scale={0.006 * (1 - hurt)} />
                </group>
                {/* orelha caída de vira-lata */}
                <group position={[0.12 * s, 0.12, -0.03]} rotation={[mix(0.1, -0.6, earBack), 0, mix(-2.35, -2.0, earBack) * s]}>
                  <Furry geo={g.sph} fur={M.fur} shells={Math.round(shells * 0.5)} position={[0, 0.08, 0]} scale={[0.065, 0.1, 0.022]} />
                </group>
              </group>
            ))}
            {/* mandíbula */}
            <group position={[0, -0.06, 0.05]} rotation={[jaw * 0.6, 0, 0]}>
              <mesh geometry={g.sph} material={M.mouth} position={[0, 0.01, 0.11]} scale={[0.058, 0.015, 0.1]} />
              <mesh geometry={g.sph} material={M.tongue} position={[0, 0.02, 0.13]} scale={[0.04, 0.01, 0.075]} />
              <Furry geo={g.sph} fur={M.fur} shells={Math.round(shells * 0.6)} position={[0, -0.01, 0.1]} scale={[0.066, 0.032, 0.125]} />
            </group>
          </group>
        </group>
        {/* patas */}
        {legs.map(([x, z, off], i) => {
          const sw = Math.sin(ph + off) * 0.5 * w + Math.sin(t * 6 + i * 1.7) * 0.35 * wob;
          const knee = Math.max(0, Math.cos(ph + off)) * 0.6 * w;
          return (
            <group key={i} position={[x, -0.05, z]} rotation={[sw, 0, (x > 0 ? 1 : -1) * 0.12 * wob]}>
              <Furry geo={g.cap} fur={M.fur} shells={Math.round(shells * 0.5)} position={[0, -0.16, 0]} scale={[0.06, 0.14, 0.065]} />
              <group position={[0, -0.3, 0]} rotation={[z < 0 ? -knee : knee, 0, 0]}>
                <Furry geo={g.cap} fur={M.fur} shells={Math.round(shells * 0.4)} position={[0, -0.12, 0]} scale={[0.045, 0.12, 0.045]} />
                <mesh geometry={g.sph} material={M.paw} position={[0, -0.255, 0.025]} scale={[0.05, 0.025, 0.065]} castShadow />
              </group>
            </group>
          );
        })}
        {/* rabo */}
        <group position={[0, 0.08, -0.4]} rotation={[-tailUp, tailWag, 0]}>
          <Furry geo={g.tail} fur={M.fur} shells={shells} rotation={[0, Math.PI, 0]} />
        </group>
      </group>
    </group>
  );
};
