import { useMemo } from "react";
import * as THREE from "three";
import { clamp01, mix, skinTexture, useEnv, V3 } from "./comum";

// =====================================================================
// CIENTISTA de 1799 (Londres): peruca branca empoada com cachos laterais e rabicho com laço,
// casaca azul com abas, colete creme, gravata de babado, culote, meias brancas, sapato de fivela.
// Segura LUPA (mão direita) e TESOURA (mão esquerda). Altura ≈ 3,4 un. Frente = +z.
// =====================================================================
export type CientistaProps = {
  t: number;
  lupa?: number; // 0 = lupa baixa, 1 = lupa na frente do olho
  cortar?: number; // 0..1 intensidade do "tec-tec" da tesoura (e braço esquerdo à frente)
  inclinar?: number; // debruçar sobre a mesa
  olhar?: [number, number]; // yaw, pitch da cabeça
  espanto?: number; // sobrancelhas sobem, boca abre
  position?: V3;
  rotation?: V3;
  scale?: number;
};

const SPH = new THREE.SphereGeometry(1, 24, 18);
const CAP = new THREE.CapsuleGeometry(1, 1, 6, 14);
const CYL = new THREE.CylinderGeometry(1, 1, 1, 20);
const TOR = new THREE.TorusGeometry(1, 0.32, 10, 24);

export const Cientista1799: React.FC<CientistaProps> = (P) => {
  const { t } = P;
  const env = useEnv();
  const M = useMemo(() => {
    const s = (c: string, r = 0.8, o: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: r, ...o });
    return {
      skin: new THREE.MeshStandardMaterial({ map: skinTexture("#F2C8A8", 51, 1500, 0.04), roughness: 0.6 }),
      cheek: s("#EBA48C", 0.7),
      wig: new THREE.MeshStandardMaterial({ map: skinTexture("#F4F1EA", 52, 4000, 0.06), roughness: 0.95 }),
      coat: s("#2E4F86", 0.75),
      coatDark: s("#22396A", 0.8),
      gold: s("#D9B25A", 0.3, { metalness: 0.8, envMap: env }),
      vest: s("#EADFC4", 0.8),
      white: s("#FAF8F2", 0.8),
      breeches: s("#C9B48C", 0.8),
      shoe: s("#1B1A1C", 0.35, { envMap: env, envMapIntensity: 0.6 }),
      silver: s("#E3E6EA", 0.2, { metalness: 0.95, envMap: env }),
      eye: s("#1E1A18", 0.2),
      ribbon: s("#151515", 0.5),
      brow: s("#BDB6AA", 0.9),
      mouth: s("#8E4A44", 0.6),
      brass: s("#C9A04E", 0.25, { metalness: 0.9, envMap: env }),
      lens: new THREE.MeshPhysicalMaterial({ color: "#E8F6FF", roughness: 0.02, transparent: true, opacity: 0.35, envMap: env, envMapIntensity: 1.5 }),
      wood: s("#6B4126", 0.6),
      steel: s("#D7DCE0", 0.18, { metalness: 0.95, envMap: env }),
    };
  }, [env]);
  const lupa = clamp01(P.lupa ?? 0), cut = clamp01(P.cortar ?? 0), lean = clamp01(P.inclinar ?? 0), wow = clamp01(P.espanto ?? 0);
  const snip = cut * (0.5 + 0.5 * Math.sin(t * Math.PI * 2 * 2.2));
  const breathe = Math.sin(t * 1.6) * 0.01;
  // braço direito (lupa): ombro x pra frente/cima
  const rSx = mix(-0.3, -2.0, lupa), rSz = mix(0.18, 0.35, lupa), rEx = mix(-0.5, -1.3, lupa);
  // braço esquerdo (tesoura)
  const lSx = mix(-0.4, -1.1, cut), lSz = mix(-0.18, -0.1, cut), lEx = mix(-0.6, -0.9, cut);
  const Arm = (side: 1 | -1, sx: number, sz: number, ex: number, tool: React.ReactNode) => (
    <group position={[0.5 * side, 2.62, 0]} rotation={[sx, 0, sz]}>
      <mesh geometry={CAP} material={M.coat} position={[0, -0.3, 0]} scale={[0.13, 0.25, 0.13]} castShadow />
      <group position={[0, -0.62, 0]} rotation={[ex, 0, 0]}>
        <mesh geometry={CAP} material={M.coat} position={[0, -0.25, 0]} scale={[0.115, 0.22, 0.115]} castShadow />
        {/* punho com renda */}
        <mesh geometry={CYL} material={M.coatDark} position={[0, -0.46, 0]} scale={[0.14, 0.1, 0.14]} />
        <mesh geometry={CYL} material={M.white} position={[0, -0.54, 0]} scale={[0.12, 0.06, 0.12]} />
        <group position={[0, -0.64, 0]}>
          <mesh geometry={SPH} material={M.skin} scale={[0.085, 0.1, 0.06]} />
          {tool}
        </group>
      </group>
    </group>
  );
  const lupaNode = (
    <group position={[0, -0.08, 0.04]} rotation={[0, 0, 0]}>
      <mesh geometry={CYL} material={M.wood} position={[0, -0.05, 0]} scale={[0.025, 0.22, 0.025]} />
      <group position={[0, -0.3, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <mesh geometry={TOR} material={M.brass} scale={[0.15, 0.15, 0.15]} />
        <mesh geometry={CYL} material={M.lens} scale={[0.145, 0.02, 0.145]} rotation={[Math.PI / 2, 0, 0]} />
      </group>
    </group>
  );
  const blade = (a: number) => (
    <group rotation={[0, 0, a]}>
      <mesh geometry={SPH} material={M.steel} position={[0, -0.13, 0]} scale={[0.012, 0.13, 0.004]} />
      <mesh geometry={TOR} material={M.steel} position={[0, 0.07, 0]} scale={[0.045, 0.045, 0.045]} rotation={[Math.PI / 2, 0, 0]} />
    </group>
  );
  const tesoura = (
    <group position={[0, -0.08, 0.06]} rotation={[0.3, 0, 0]}>
      {blade(0.08 + snip * 0.35)}
      {blade(-0.08 - snip * 0.35)}
      <mesh geometry={SPH} material={M.brass} scale={0.012} />
    </group>
  );
  return (
    <group position={P.position} rotation={P.rotation} scale={P.scale ?? 1}>
      {/* pernas: culote + meias + sapatos de fivela */}
      {([1, -1] as const).map((s) => (
        <group key={s} position={[0.17 * s, 0, 0]}>
          <mesh geometry={CAP} material={M.white} position={[0, 0.45, 0]} scale={[0.11, 0.38, 0.11]} castShadow />
          <mesh geometry={CAP} material={M.breeches} position={[0, 1.15, 0]} scale={[0.15, 0.32, 0.15]} castShadow />
          <mesh geometry={SPH} material={M.shoe} position={[0, 0.06, 0.08]} scale={[0.12, 0.07, 0.22]} castShadow />
          <mesh material={M.silver} position={[0, 0.1, 0.2]}>
            <boxGeometry args={[0.1, 0.06, 0.02]} />
          </mesh>
        </group>
      ))}
      <group rotation={[lean * 0.45, 0, 0]} position={[0, 1.4, 0]}>
        <group position={[0, -1.4 + breathe, 0]}>
          {/* colete + casaca com abas */}
          <mesh geometry={CAP} material={M.vest} position={[0, 2.1, 0.02]} scale={[0.4, 0.42, 0.3]} castShadow />
          <mesh material={M.coat} position={[0, 2.05, -0.03]} castShadow>
            <cylinderGeometry args={[0.47, 0.56, 1.25, 16, 1, true, Math.PI * 0.18, Math.PI * 1.64]} />
          </mesh>
          <mesh material={M.coat} position={[0, 1.3, -0.12]} rotation={[-0.12, 0, 0]} castShadow>
            <cylinderGeometry args={[0.5, 0.62, 0.7, 16, 1, true, Math.PI * 0.55, Math.PI * 0.9]} />
          </mesh>
          {/* lapelas e botões dourados */}
          {([1, -1] as const).map((s) => (
            <group key={s}>
              <mesh material={M.coatDark} position={[0.18 * s, 2.42, 0.32]} rotation={[0.15, 0, 0.3 * s]}>
                <boxGeometry args={[0.12, 0.42, 0.04]} />
              </mesh>
              {[0, 1, 2, 3].map((i) => (
                <mesh key={i} geometry={SPH} material={M.gold} position={[0.26 * s, 2.3 - i * 0.18, 0.37 - i * 0.01]} scale={0.03} />
              ))}
            </group>
          ))}
          {/* gravata de babado */}
          <mesh geometry={SPH} material={M.white} position={[0, 2.55, 0.3]} scale={[0.12, 0.16, 0.08]} />
          <mesh geometry={SPH} material={M.white} position={[0, 2.38, 0.32]} scale={[0.09, 0.12, 0.06]} />
          {/* cabeça */}
          <group position={[0, 2.95, 0.02]} rotation={[(P.olhar?.[1] ?? 0) + lupa * 0.1, P.olhar?.[0] ?? 0, 0]}>
            <mesh geometry={CYL} material={M.skin} position={[0, -0.18, 0]} scale={[0.1, 0.15, 0.1]} />
            <mesh geometry={SPH} material={M.skin} scale={[0.25, 0.29, 0.26]} castShadow />
            <mesh geometry={SPH} material={M.skin} position={[0, -0.02, 0.26]} scale={[0.05, 0.07, 0.06]} />
            {([1, -1] as const).map((s) => (
              <group key={s}>
                <mesh geometry={SPH} material={M.eye} position={[0.09 * s, 0.05, 0.225]} scale={[0.028, 0.034, 0.02]} />
                <mesh geometry={SPH} material={M.white} position={[0.095 * s, 0.065, 0.24]} scale={0.008} />
                <mesh material={M.brow} position={[0.09 * s, 0.12 + wow * 0.04, 0.23]} rotation={[0, 0, (0.15 - wow * 0.3) * s]}>
                  <boxGeometry args={[0.09, 0.022, 0.02]} />
                </mesh>
                <mesh geometry={SPH} material={M.cheek} position={[0.15 * s, -0.06, 0.18]} scale={[0.05, 0.035, 0.03]} />
                {/* cachos laterais da peruca (2 rolos) */}
                {[0, 1].map((k) => (
                  <mesh key={k} geometry={TOR} material={M.wig} position={[0.24 * s, 0.02 - k * 0.11, -0.02]} rotation={[0, Math.PI / 2, 0]} scale={[0.06, 0.06, 0.12]} />
                ))}
              </group>
            ))}
            <mesh geometry={SPH} material={M.mouth} position={[0, -0.13, 0.225]} scale={[0.05, 0.012 + wow * 0.03, 0.02]} />
            {/* peruca: topo fofo + rabicho com laço */}
            <mesh geometry={SPH} material={M.wig} position={[0, 0.12, -0.03]} scale={[0.27, 0.22, 0.29]} castShadow />
            <mesh geometry={SPH} material={M.wig} position={[0, 0.06, -0.13]} scale={[0.26, 0.24, 0.2]} />
            <mesh geometry={CAP} material={M.wig} position={[0, -0.12, -0.3]} rotation={[0.35, 0, 0]} scale={[0.05, 0.12, 0.05]} />
            {([1, -1] as const).map((s) => (
              <mesh key={s} geometry={SPH} material={M.ribbon} position={[0.06 * s, -0.04, -0.28]} rotation={[0, 0, 0.6 * s]} scale={[0.07, 0.035, 0.02]} />
            ))}
          </group>
          {Arm(1, rSx, rSz, rEx, lupaNode)}
          {Arm(-1, lSx, lSz, lEx, tesoura)}
        </group>
      </group>
    </group>
  );
};
