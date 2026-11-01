import { useLayoutEffect, useMemo } from "react";
import * as THREE from "three";
import { useEnv, V3 } from "./comum";
import { FONT_KIT } from "./ui";

// =====================================================================
// VITRINE de museu moderno: sala branca, piso claro brilhante, pedestal com caixa de vidro,
// trilho de spots, placa "Ornithorhynchus anatinus · 1799". O espécime fica em VITRINE_TAMPO.
// =====================================================================
export const VITRINE_TAMPO: V3 = [0, 1.9, 0];

const drawPlaque = (c: HTMLCanvasElement, l1: string, l2: string) => {
  const g = c.getContext("2d")!;
  g.fillStyle = "#1C1E22";
  g.fillRect(0, 0, 512, 192);
  g.fillStyle = "#F4F1EA";
  g.font = `italic 700 44px Georgia, serif`;
  g.fillText(l1, 28, 80);
  g.font = `800 36px ${FONT_KIT}`;
  g.fillStyle = "#C9B27A";
  g.fillText(l2, 28, 140);
};

export const Vitrine: React.FC<{ t: number; placa?: [string, string]; vidro?: boolean }> = ({ placa = ["Ornithorhynchus anatinus", "LONDRES · 1799"], vidro = true }) => {
  const env = useEnv();
  const plaque = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 512;
    c.height = 192;
    const tx = new THREE.CanvasTexture(c);
    tx.colorSpace = THREE.SRGBColorSpace;
    return { c, tx };
  }, []);
  // redesenha sempre: garante a fonte do kit depois que ela carrega
  useLayoutEffect(() => {
    drawPlaque(plaque.c, placa[0], placa[1]);
    plaque.tx.needsUpdate = true;
  });
  const M = useMemo(
    () => ({
      floor: new THREE.MeshStandardMaterial({ color: "#E9E7E3", roughness: 0.18, envMap: env, envMapIntensity: 0.5 }),
      wall: new THREE.MeshStandardMaterial({ color: "#F4F3F0", roughness: 0.9 }),
      wallDark: new THREE.MeshStandardMaterial({ color: "#2A2D33", roughness: 0.8 }),
      ped: new THREE.MeshStandardMaterial({ color: "#FAFAF8", roughness: 0.5 }),
      glass: new THREE.MeshPhysicalMaterial({ color: "#F2FAFF", roughness: 0.02, transparent: true, opacity: 0.16, envMap: env, envMapIntensity: 1.4, depthWrite: false }),
      edge: new THREE.MeshStandardMaterial({ color: "#C8CDD2", metalness: 0.8, roughness: 0.25, envMap: env }),
      felt: new THREE.MeshStandardMaterial({ color: "#2E3138", roughness: 1 }),
      plaque: new THREE.MeshBasicMaterial({ map: plaque.tx }),
      track: new THREE.MeshStandardMaterial({ color: "#26282D", roughness: 0.5 }),
      cone: new THREE.MeshBasicMaterial({ color: "#FFF6E0", transparent: true, opacity: 0.07, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }),
      bulb: new THREE.MeshBasicMaterial({ color: "#FFF8E8" }),
    }),
    [env, plaque],
  );
  const [, ty] = VITRINE_TAMPO;
  return (
    <group>
      <color attach="background" args={["#E9E7E3"]} />
      <fog attach="fog" args={["#ECEBE8", 10, 40]} />
      <mesh material={M.floor} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[40, 40]} />
      </mesh>
      <mesh material={M.wallDark} position={[0, 4, -6]} receiveShadow>
        <planeGeometry args={[40, 8]} />
      </mesh>
      <mesh material={M.wall} position={[-8, 4, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[40, 8]} />
      </mesh>
      {/* pedestal + tampo de feltro */}
      <mesh material={M.ped} position={[0, (ty - 0.05) / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.0, ty - 0.05, 1.4]} />
      </mesh>
      <mesh material={M.felt} position={[0, ty - 0.03, 0]} receiveShadow>
        <boxGeometry args={[1.9, 0.04, 1.3]} />
      </mesh>
      {/* caixa de vidro com arestas */}
      {vidro ? (
        <group position={[0, ty + 0.55, 0]}>
          <mesh material={M.glass} renderOrder={7}>
            <boxGeometry args={[1.95, 1.1, 1.35]} />
          </mesh>
          {[
            [0.975, 0.675],
            [-0.975, 0.675],
            [0.975, -0.675],
            [-0.975, -0.675],
          ].map(([x, z]) => (
            <mesh key={`${x}${z}`} material={M.edge} position={[x, 0, z]}>
              <boxGeometry args={[0.02, 1.1, 0.02]} />
            </mesh>
          ))}
        </group>
      ) : null}
      {/* placa inclinada na frente */}
      <mesh material={M.plaque} position={[0.45, ty - 0.35, 0.72]} rotation={[-0.35, 0, 0]}>
        <planeGeometry args={[0.9, 0.34]} />
      </mesh>
      {/* trilho de spots e cones de luz */}
      <mesh material={M.track} position={[0, 5.2, 0.5]}>
        <boxGeometry args={[8, 0.08, 0.08]} />
      </mesh>
      {[-1.2, 0, 1.2].map((x, i) => (
        <group key={x} position={[x, 5.1, 0.5]}>
          <mesh material={M.track} rotation={[0.4 * (i - 1) * 0.2, 0, 0]}>
            <cylinderGeometry args={[0.1, 0.13, 0.3, 14]} />
          </mesh>
          <mesh material={M.bulb} position={[0, -0.16, 0]}>
            <circleGeometry args={[0.09, 14]} />
          </mesh>
          <mesh material={M.cone} position={[-x * 0.4, -1.6, -0.25]} rotation={[0.15, 0, x * 0.25]} renderOrder={9}>
            <coneGeometry args={[1.0, 3.2, 24, 1, true]} />
          </mesh>
        </group>
      ))}
      <spotLight position={[0, 5, 1.2]} angle={0.45} penumbra={0.6} intensity={30} distance={14} decay={1.5} color="#FFF4DD" />
    </group>
  );
};
