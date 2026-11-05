import { useMemo } from "react";
import * as THREE from "three";
import { clamp01, makeFill, makeGlass, mix, V3 } from "./comum";

// =====================================================================
// HUMANO TRANSLÚCIDO (comparação "um humano tem…"), feito de cápsulas de vidro como na referência.
// Altura ≈ 3,5 un (1,75 m). Origem = entre os pés. Frente = +z.
// =====================================================================
export type HumanoProps = {
  t: number;
  vermelho?: number; // corpo todo azul → vermelho (0..1)
  maoDor?: number; // mão direita vermelha pulsando (0..1)
  segurarMao?: number; // pose: mão esquerda segurando a direita na frente do peito
  estomago?: number; // mostra o estômago (0..1)
  encher?: number; // nível amarelo dentro do estômago (0..1)
  andar?: number; // ciclo de caminhada (0..1 intensidade)
  olhar?: [number, number]; // yaw, pitch da cabeça
  boca?: number; // boca aberta de espanto (0..1)
  erguer?: number; // braços acima da cabeça segurando algo (0..1); as mãos ficam em (±0,46, ≈4,0, 0)
  ceder?: number; // cotovelos dobram e o peso desce (0..1)
  tremer?: number; // braços tremendo de esforço (0..1)
  opacidade?: number;
  cor?: string;
  position?: V3;
  rotation?: V3;
  scale?: number;
};

const MOUTH = new THREE.MeshBasicMaterial({ color: "#1A2340" });
const blue = new THREE.Color("#8FD0FF"), red = new THREE.Color("#FF6B6B");
let GEO: { cap: THREE.CapsuleGeometry; sph: THREE.SphereGeometry } | null = null;
const geo = () => (GEO ??= { cap: new THREE.CapsuleGeometry(1, 1, 8, 20), sph: new THREE.SphereGeometry(1, 28, 20) });

// segmento cápsula do ponto a ao ponto b (no plano do grupo pai), raio r
const Seg: React.FC<{ len: number; r: number; m: THREE.Material }> = ({ len, r, m }) => (
  <mesh geometry={geo().cap} material={m} position={[0, -len / 2, 0]} scale={[r, len / 2 - r * 0.2, r]} renderOrder={6} />
);
const Ball: React.FC<{ r: number | V3; m: THREE.Material; p?: V3 }> = ({ r, m, p }) => (
  <mesh geometry={geo().sph} material={m} position={p} scale={r as never} renderOrder={6} />
);

export const HumanoTranslucido: React.FC<HumanoProps> = (P) => {
  const { t } = P;
  const glass = useMemo(() => makeGlass(P.cor ?? "#8FD0FF"), [P.cor]);
  const hand = useMemo(() => makeGlass("#8FD0FF"), []);
  const stom = useMemo(() => new THREE.MeshStandardMaterial({ color: "#8FE3A6", emissive: new THREE.Color("#5ED38A"), emissiveIntensity: 0.4, roughness: 0.3, transparent: true, opacity: 0.85 }), []);
  const fill = useMemo(() => makeFill("#FFD23F"), []);
  const pain = useMemo(() => new THREE.MeshBasicMaterial({ color: "#FF2A2A", transparent: true, opacity: 0, depthWrite: false }), []);
  const op = P.opacidade ?? 1;
  const vr = clamp01(P.vermelho ?? 0);
  const base = (P.cor ? new THREE.Color(P.cor) : blue).clone().lerp(red, vr);
  glass.uniforms.uColor.value.copy(base);
  glass.uniforms.uOp.value = op;
  const pulse = clamp01(P.maoDor ?? 0) * (0.65 + 0.35 * Math.sin(t * Math.PI * 2 * 1.6));
  hand.uniforms.uColor.value.copy(base.clone().lerp(new THREE.Color("#FF2E2E"), pulse));
  hand.uniforms.uOp.value = op * (1 + pulse * 0.6);
  pain.opacity = 0.75 * pulse * op;
  stom.opacity = 0.85 * clamp01(P.estomago ?? 0) * op;
  fill.uniforms.uLevel.value = clamp01(P.encher ?? 0);
  fill.uniforms.uY0.value = -1;
  fill.uniforms.uY1.value = 1;
  fill.uniforms.uT.value = t;

  const w = P.andar ?? 0;
  const ph = t * Math.PI * 2 * 0.9;
  const sg = clamp01(P.segurarMao ?? 0);
  // ângulos dos braços: (x = pra frente, z = abrir)
  // segurarMao: antebraços na frente do peito, mão esquerda sobre o punho direito
  const armR0 = { sx: mix(Math.sin(ph) * 0.45 * w, -0.55, sg), sz: mix(0.12, 0.08, sg), ex: mix(-0.15 - 0.2 * w, -1.45, sg), ey: mix(0, -0.95, sg) };
  const armL0 = { sx: mix(-Math.sin(ph) * 0.45 * w, -0.5, sg), sz: mix(-0.12, -0.08, sg), ex: mix(-0.15 - 0.2 * w, -1.25, sg), ey: mix(0, 1.25, sg) };
  // erguer: braços para cima; ceder: cotovelos dobram; tremer: tremor de esforço
  const er = clamp01(P.erguer ?? 0), ce = clamp01(P.ceder ?? 0), tr = clamp01(P.tremer ?? 0) * Math.sin(t * 22) * 0.05; // ≤ 3,5 Hz (acima de ~6 Hz vira pisca a 30 fps)
  const up = (a: typeof armR0, side: 1 | -1) => ({ sx: mix(a.sx, -3.0 + ce * 0.9 + tr, er), sz: mix(a.sz, 0.06 * side - tr * side, er), ex: mix(a.ex, -0.12 - ce * 1.5 - tr, er), ey: mix(a.ey, 0, er) });
  const armR = up(armR0, 1);
  const armL = up(armL0, -1);
  const legR = { x: -Math.sin(ph) * 0.5 * w, k: Math.max(0, Math.sin(ph + 1.2)) * 0.6 * w };
  const legL = { x: Math.sin(ph) * 0.5 * w, k: Math.max(0, -Math.sin(ph + 1.2)) * 0.6 * w };
  const bob = Math.abs(Math.cos(ph)) * 0.05 * w;

  const Arm = (side: 1 | -1, a: typeof armR, m: THREE.Material) => (
    <group position={[0.46 * side, 2.78, 0]} rotation={[a.sx, 0, a.sz]}>
      <Ball r={0.13} m={glass} />
      <Seg len={0.62} r={0.1} m={glass} />
      <group position={[0, -0.62, 0]} rotation-y={a.ey}>
      <group rotation={[a.ex, 0, 0]}>
        <Ball r={0.1} m={glass} />
        <Seg len={0.56} r={0.085} m={side === 1 ? m : glass} />
        <group position={[0, -0.62, 0]}>
          <Ball r={[0.1, 0.13, 0.06]} m={side === 1 ? m : glass} />
          {side === 1 && pulse > 0.01 ? <mesh geometry={geo().sph} material={pain} scale={[0.085, 0.11, 0.05]} renderOrder={5} /> : null}
          {side === 1 && pulse > 0.01 ? <mesh geometry={geo().sph} material={pain} scale={0.16 + pulse * 0.05} renderOrder={4} /> : null}
          <mesh geometry={geo().cap} material={side === 1 ? m : glass} position={[0.08 * side, 0.02, 0.04]} rotation={[0, 0, 0.6 * side]} scale={[0.035, 0.06, 0.035]} renderOrder={6} />
        </group>
      </group>
      </group>
    </group>
  );
  const Leg = (side: 1 | -1, l: typeof legR) => (
    <group position={[0.18 * side, 1.78, 0]} rotation={[l.x, 0, 0]}>
      <Ball r={0.16} m={glass} />
      <Seg len={0.82} r={0.15} m={glass} />
      <group position={[0, -0.82, 0]} rotation={[l.k, 0, 0]}>
        <Ball r={0.13} m={glass} />
        <Seg len={0.8} r={0.12} m={glass} />
        <Ball r={[0.12, 0.08, 0.24]} p={[0, -0.86, 0.09]} m={glass} />
      </group>
    </group>
  );
  return (
    <group position={P.position} rotation={P.rotation} scale={P.scale ?? 1}>
      <group position={[0, bob, 0]}>
        {/* estômago + enchimento (por trás do vidro) */}
        {(P.estomago ?? 0) > 0.01 ? (
          <group position={[0.06, 2.3, 0.04]} rotation={[0, 0, -0.5]} scale={[0.2, 0.14, 0.13]}>
            <mesh geometry={geo().sph} material={stom} renderOrder={2} />
            {(P.encher ?? 0) > 0 ? <mesh geometry={geo().sph} material={fill} scale={0.92} renderOrder={3} /> : null}
          </group>
        ) : null}
        {/* tronco */}
        <mesh geometry={geo().cap} material={glass} position={[0, 2.42, 0]} scale={[0.38, 0.36, 0.24]} renderOrder={6} />
        <Ball r={[0.33, 0.22, 0.22]} p={[0, 1.86, 0]} m={glass} />
        <mesh geometry={geo().cap} material={glass} position={[0, 2.98, 0]} scale={[0.085, 0.06, 0.085]} renderOrder={6} />
        {/* cabeça */}
        <group position={[0, 3.25, 0]} rotation={[P.olhar?.[1] ?? 0, P.olhar?.[0] ?? 0, 0]}>
          <Ball r={[0.22, 0.26, 0.23]} m={glass} />
          {(P.boca ?? 0) > 0.01 ? <mesh geometry={geo().sph} material={MOUTH} position={[0, -0.09, 0.205]} rotation={[-0.25, 0, 0]} scale={[0.06, 0.075 * clamp01(P.boca ?? 0), 0.03]} renderOrder={7} /> : null}
          {(P.boca ?? 0) > 0.01 ? ([1, -1] as const).map((s) => <mesh key={s} geometry={geo().sph} material={MOUTH} position={[0.08 * s, 0.05, 0.2]} scale={[0.028, 0.034 + 0.01 * clamp01(P.boca ?? 0), 0.02]} renderOrder={7} />) : null}
        </group>
        {Arm(1, armR, hand)}
        {Arm(-1, armL, glass)}
        {Leg(1, legR)}
        {Leg(-1, legL)}
      </group>
    </group>
  );
};
