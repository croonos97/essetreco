import { useMemo } from "react";
import * as THREE from "three";
import { makeGlass } from "./comum";
import { clamp01, V3 } from "./LagartixaComum";

// =====================================================================
// HUMANO AZUL TRANSLÚCIDO "manequim" (vídeo da lagartixa) — FK simples, braço direito destacável.
// Altura ≈ 3,5 un (1,75 m), origem = entre os pés, frente = +z. Lado direito = −x.
// Usado como régua ("se fosse você") e para a vassoura. Ladrão = mesmo modelo, azul mais escuro, de boné.
// =====================================================================
export type Braco = { ombro?: [number, number, number]; cotovelo?: number }; // ombro = [pitch(+ = pra frente), yaw, roll(+ = abre)], cotovelo (rad)
export type HumanoAzulProps = {
  t: number;
  andar?: number; // 0..1 intensidade da caminhada
  fase?: number; // fase da passada (ciclos) — use distância/passo para não patinar
  correr?: number;
  sentar?: number; // 0..1
  bracoD?: Braco;
  bracoE?: Braco;
  semBracoD?: boolean; // o braço direito saiu (fica só o ombro com a junta de manequim)
  semAnteD?: boolean; // só o antebraço direito saiu (desencaixa no cotovelo, junta à mostra)
  cabeca?: [number, number];
  bone?: boolean;
  cabelo?: number; // 0..1 cabelo curto (calota escura) — régua do "3x cabelo"
  cor?: string;
  opac?: number;
  maoD?: React.ReactNode; // preso na mão direita (espaço da mão: y para baixo ao longo do antebraço)
  maoE?: React.ReactNode;
  position?: V3;
  rotation?: V3;
  escala?: number;
};
let G: null | { cap: THREE.CapsuleGeometry; sph: THREE.SphereGeometry; aba: THREE.CylinderGeometry; meia: THREE.SphereGeometry } = null;
const geo = () => (G ??= { cap: new THREE.CapsuleGeometry(1, 1, 8, 20), sph: new THREE.SphereGeometry(1, 28, 20), aba: new THREE.CylinderGeometry(1, 1, 1, 28), meia: new THREE.SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2) });

const Seg: React.FC<{ len: number; r: number; m: THREE.Material }> = ({ len, r, m }) => (
  <mesh geometry={geo().cap} material={m} position={[0, -len / 2, 0]} scale={[r, Math.max(0.01, len / 2 - r * 0.2), r]} renderOrder={6} />
);
export const UPPER = 0.62, FORE = 0.58;
// braço FK (pendurado para −y a partir do ombro)
export const BracoAzul: React.FC<{ b?: Braco; m: THREE.Material; lado: 1 | -1; mao?: React.ReactNode; semAnte?: boolean; junta?: THREE.Material }> = ({ b, m, lado, mao, semAnte, junta }) => {
  const [p, y, r] = b?.ombro ?? [0, 0, 0.08];
  return (
    <group rotation={[-p, y * lado, -r * lado, "YXZ"]}>
      <Seg len={UPPER} r={0.11} m={m} />
      <group position={[0, -UPPER, 0]} rotation={[-(b?.cotovelo ?? 0.15), 0, 0]}>
        <mesh geometry={geo().sph} material={semAnte && junta ? junta : m} scale={semAnte ? 0.085 : 0.1} renderOrder={6} />
        {semAnte ? null : (
          <>
            <Seg len={FORE} r={0.095} m={m} />
            <group position={[0, -FORE - 0.08, 0]}>
              <mesh geometry={geo().sph} material={m} scale={[0.08, 0.11, 0.06]} renderOrder={6} />
              {mao}
            </group>
          </>
        )}
      </group>
    </group>
  );
};
export const useVidroAzul = (cor: string, opac = 1) => {
  const m = useMemo(() => makeGlass(cor), [cor]);
  m.uniforms.uOp.value = opac;
  return m;
};
export const HumanoAzul: React.FC<HumanoAzulProps> = (P) => {
  const g = geo();
  const cor = P.cor ?? "#8FD0FF";
  const m = useVidroAzul(cor, P.opac ?? 1);
  const boneM = useVidroAzul("#2C4FC4", P.opac ?? 1); // boné também de vidro azul (humanos só azul translúcido)
  const cabeloM = useVidroAzul("#23379A", P.opac ?? 1);
  const junta = useMemo(() => new THREE.MeshStandardMaterial({ color: "#DDEBFF", roughness: 0.3, metalness: 0.4 }), []);
  const sen = clamp01(P.sentar ?? 0);
  const an = clamp01(P.andar ?? 0), cr = clamp01(P.correr ?? 0);
  const ph = (P.fase ?? P.t * 1.6) * Math.PI * 2;
  const amp = an * (0.45 + 0.35 * cr);
  const coxa = (s: number) => -sen * 1.45 + amp * Math.sin(ph + (s > 0 ? 0 : Math.PI));
  const joelho = (s: number) => sen * 1.5 + Math.max(0, an * (0.25 + 0.6 * cr) * Math.sin(ph + (s > 0 ? 0 : Math.PI) - 1.2) + an * 0.15);
  const quadril = 1.85 - sen * 0.88 + an * 0.04 * Math.abs(Math.cos(ph));
  const braco = (s: number): Braco => ({ ombro: [-amp * 0.7 * Math.sin(ph + (s > 0 ? Math.PI : 0)) + cr * 0.3, 0, 0.08], cotovelo: 0.2 + cr * 1.2 });
  const [hy, hp] = P.cabeca ?? [0, 0];
  const inc = cr * 0.25;
  return (
    <group position={P.position} rotation={P.rotation} scale={P.escala ?? 1}>
      {/* pernas */}
      {[1, -1].map((s) => (
        <group key={s} position={[s * 0.17, quadril, 0]} rotation={[-coxa(s), 0, 0]}>
          <Seg len={0.9} r={0.15} m={m} />
          <group position={[0, -0.9, 0]} rotation={[joelho(s), 0, 0]}>
            <mesh geometry={g.sph} material={m} scale={0.13} renderOrder={6} />
            <Seg len={0.85} r={0.12} m={m} />
            <mesh geometry={g.sph} material={m} position={[0, -0.92, 0.1]} scale={[0.11, 0.07, 0.2]} renderOrder={6} />
          </group>
        </group>
      ))}
      {/* tronco */}
      <group position={[0, quadril, 0]} rotation={[inc, 0, 0]}>
        <mesh geometry={g.sph} material={m} position={[0, 0.08, 0]} scale={[0.33, 0.22, 0.22]} renderOrder={6} />
        <mesh geometry={g.cap} material={m} position={[0, 0.55, 0]} scale={[0.3, 0.3, 0.2]} renderOrder={6} />
        <mesh geometry={g.sph} material={m} position={[0, 0.95, 0.0]} scale={[0.42, 0.25, 0.23]} renderOrder={6} />
        {/* pescoço + cabeça */}
        <mesh geometry={g.cap} material={m} position={[0, 1.2, 0]} scale={[0.08, 0.08, 0.08]} renderOrder={6} />
        <group position={[0, 1.45, 0.02]} rotation={[hp, hy, 0, "YXZ"]}>
          <mesh geometry={g.sph} material={m} scale={[0.21, 0.26, 0.23]} renderOrder={6} />
          {(P.cabelo ?? 0) > 0 ? <mesh geometry={g.meia} material={cabeloM} position={[0, 0.05, -0.02]} scale={[0.225, 0.2 + 0.06 * (P.cabelo ?? 0), 0.245]} renderOrder={7} /> : null}
          {P.bone ? (
            <group position={[0, 0.06, 0]}>
              <mesh geometry={g.meia} material={boneM} scale={[0.23, 0.2, 0.25]} />
              <mesh geometry={g.aba} material={boneM} position={[0, 0.0, 0.22]} scale={[0.17, 0.02, 0.17]} />
            </group>
          ) : null}
        </group>
        {/* ombros e braços */}
        <group position={[-0.42, 1.0, 0]}>
          {P.semBracoD ? (
            <mesh geometry={g.sph} material={junta} scale={[0.09, 0.09, 0.09]} />
          ) : (
            <BracoAzul b={P.bracoD ?? braco(-1)} m={m} lado={-1} mao={P.maoD} semAnte={P.semAnteD} junta={junta} />
          )}
        </group>
        <group position={[0.42, 1.0, 0]}>
          <BracoAzul b={P.bracoE ?? braco(1)} m={m} lado={1} mao={P.maoE} />
        </group>
      </group>
    </group>
  );
};
// braço solto (de manequim), com a junta à mostra no ombro — para a mão do ladrão
export const BracoSolto: React.FC<{ b?: Braco; cor?: string; position?: V3; rotation?: V3 }> = ({ b, cor = "#8FD0FF", position, rotation }) => {
  const m = useVidroAzul(cor);
  const junta = useMemo(() => new THREE.MeshStandardMaterial({ color: "#DDEBFF", roughness: 0.3, metalness: 0.4 }), []);
  return (
    <group position={position} rotation={rotation}>
      <mesh geometry={geo().sph} material={junta} scale={0.09} />
      <BracoAzul b={b} m={m} lado={-1} />
    </group>
  );
};
// ponto do ombro direito no espaço do humano (de pé, sem inclinação)
export const OMBRO_D: V3 = [-0.42, 1.85 + 1.0, 0];

// antebraço solto (desencaixado no cotovelo): origem = cotovelo, aponta para −y; junta de manequim à mostra
export const AntebracoSolto: React.FC<{ cor?: string; position?: V3; rotation?: V3 }> = ({ cor = "#8FD0FF", position, rotation }) => {
  const m = useVidroAzul(cor);
  const junta = useMemo(() => new THREE.MeshStandardMaterial({ color: "#DDEBFF", roughness: 0.3, metalness: 0.4 }), []);
  return (
    <group position={position} rotation={rotation}>
      <mesh geometry={geo().sph} material={junta} scale={0.085} />
      <Seg len={FORE} r={0.095} m={m} />
      <group position={[0, -FORE - 0.08, 0]}>
        <mesh geometry={geo().sph} material={m} scale={[0.08, 0.11, 0.06]} renderOrder={6} />
      </group>
    </group>
  );
};
