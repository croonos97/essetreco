import { useMemo } from "react";
import * as THREE from "three";
import { makeGlass } from "../animais/comum";
import { clamp01, V3 } from "./CupimComum";

// =====================================================================
// MÃO AZUL DE VIDRO (mesmo material do humano azul). Unidade: cm, mão adulta ~19 cm.
// Referencial: punho na origem, dedos para +z, palma para −y, polegar do lado +x (mão direita vista de cima).
// fechar 0..1 = dedos dobram (punho). polegar 0..1 = polegar esticado para a frente (0 = recolhido no punho).
// Pontos úteis: PONTA_POLEGAR (polegar esticado, mão fechada) e NOS_DEDOS (nós do punho, para bater).
// =====================================================================
export const PONTA_POLEGAR: V3 = [3.6, -0.75, 13.8];
export const NOS_DEDOS: V3 = [0, -1.2, 10.6];
let G: { cap: THREE.CapsuleGeometry; sph: THREE.SphereGeometry } | null = null;
const geo = () => (G ??= { cap: new THREE.CapsuleGeometry(1, 1, 8, 16), sph: new THREE.SphereGeometry(1, 28, 20) });
const Falange: React.FC<{ len: number; r: number; m: THREE.Material; dobra: number; children?: React.ReactNode }> = ({ len, r, m, dobra, children }) => (
  <group rotation={[dobra, 0, 0]}>
    <mesh geometry={geo().cap} material={m} position={[0, 0, len / 2]} rotation={[Math.PI / 2, 0, 0]} scale={[r, Math.max(0.01, len / 2 - r * 0.3), r]} renderOrder={6} />
    <group position={[0, 0, len]}>{children}</group>
  </group>
);
export const MaoAzul: React.FC<{ fechar?: number; polegar?: number; antebraco?: boolean; cor?: string; position?: V3; rotation?: V3; escala?: number }> = ({ fechar = 1, polegar = 1, antebraco = true, cor = "#8FD0FF", position, rotation, escala = 1 }) => {
  const m = useMemo(() => makeGlass(cor), [cor]);
  const f = clamp01(fechar), pl = clamp01(polegar);
  const dedos = [
    { x: -2.6, L: [3.9, 2.3, 1.9], r: 0.78 },
    { x: -0.9, L: [4.5, 2.7, 2.0], r: 0.85 },
    { x: 0.85, L: [4.3, 2.6, 2.0], r: 0.83 },
    { x: 2.5, L: [3.9, 2.4, 1.9], r: 0.8 },
  ];
  return (
    <group position={position} rotation={rotation} scale={escala}>
      {antebraco ? <mesh geometry={geo().cap} material={m} position={[0, 0.2, -12]} rotation={[Math.PI / 2, 0, 0]} scale={[3.0, 11, 2.6]} renderOrder={6} /> : null}
      {/* palma */}
      <mesh geometry={geo().sph} material={m} position={[0, 0, 4.4]} scale={[4.4, 1.5, 4.9]} renderOrder={6} />
      {dedos.map((d, i) => (
        <group key={i} position={[d.x, 0, 8.7 - Math.abs(d.x) * 0.25]}>
          <Falange len={d.L[0]} r={d.r} m={m} dobra={f * 1.45}>
            <Falange len={d.L[1]} r={d.r * 0.92} m={m} dobra={f * 1.6}>
              <Falange len={d.L[2]} r={d.r * 0.85} m={m} dobra={f * 1.1} />
            </Falange>
          </Falange>
        </group>
      ))}
      {/* polegar: esticado para a frente (pl = 1) ou dobrado sobre os dedos (pl = 0) */}
      <group position={[3.6 - 0.4 * pl, -0.6 + 0.3 * pl, 2.6 + 2.9 * pl]} rotation={[0.05 * pl + 0.5 * (1 - pl), 0.05 * pl - 1.1 * (1 - pl), 0]}>
        <Falange len={4.2} r={1.0} m={m} dobra={0}>
          <Falange len={3.2} r={0.9} m={m} dobra={0.9 * (1 - pl)} />
        </Falange>
      </group>
    </group>
  );
};
