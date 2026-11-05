import { useMemo } from "react";
import * as THREE from "three";
import { rnd, woodTexture } from "../World";
import { useEnv, V3 } from "./comum";

// =====================================================================
// MUSEU / GABINETE DE 1799 (Londres) à luz de vela.
// Sala 12×10, pé-direito 6. Mesa no centro com tampo em y = MUSEU_MESA[1].
// Estante de livros, potes com espécimes, janela de noite com lua, castiçal com chama tremendo.
// Use no Shot com ambient≈0.25 e sunPower≈0.15 (a luz vem das velas).
// =====================================================================
export const MUSEU_MESA: V3 = [0, 1.62, 0];

const wallpaper = () => {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d")!;
  g.fillStyle = "#2F4A3B";
  g.fillRect(0, 0, 256, 256);
  g.fillStyle = "#3B5B49";
  for (let y = 0; y < 4; y++)
    for (let x = 0; x < 4; x++) {
      const cx = x * 64 + (y % 2) * 32, cy = y * 64 + 32;
      g.beginPath();
      g.ellipse(cx, cy, 10, 20, 0, 0, Math.PI * 2);
      g.fill();
      g.beginPath();
      g.ellipse(cx, cy, 20, 8, 0, 0, Math.PI * 2);
      g.fill();
    }
  g.strokeStyle = "#C9A85B";
  g.globalAlpha = 0.25;
  for (let x = 0; x < 256; x += 32) {
    g.beginPath();
    g.moveTo(x, 0);
    g.lineTo(x, 256);
    g.stroke();
  }
  const tx = new THREE.CanvasTexture(c);
  tx.wrapS = tx.wrapT = THREE.RepeatWrapping;
  tx.repeat.set(6, 3);
  tx.colorSpace = THREE.SRGBColorSpace;
  return tx;
};

export const Vela: React.FC<{ t: number; position: V3; luz?: number; semLuz?: boolean }> = ({ t, position, luz = 1, semLuz }) => {
  const env = useEnv();
  const M = useMemo(
    () => ({
      brass: new THREE.MeshStandardMaterial({ color: "#C9A04E", metalness: 0.9, roughness: 0.25, envMap: env }),
      wax: new THREE.MeshStandardMaterial({ color: "#F4EBD5", roughness: 0.5, emissive: new THREE.Color("#FFB45A"), emissiveIntensity: 0.15 }),
      flame: new THREE.MeshBasicMaterial({ color: "#FFE7A3" }),
      halo: new THREE.MeshBasicMaterial({ color: "#FFB347", transparent: true, opacity: 0.25, depthWrite: false, blending: THREE.AdditiveBlending }),
    }),
    [env],
  );
  const fl = 1 + Math.sin(t * 13) * 0.06 + Math.sin(t * 7.3 + 1) * 0.05;
  return (
    <group position={position}>
      <mesh material={M.brass} position={[0, 0.03, 0]}>
        <cylinderGeometry args={[0.16, 0.2, 0.06, 20]} />
      </mesh>
      <mesh material={M.brass} position={[0, 0.2, 0]}>
        <cylinderGeometry args={[0.035, 0.05, 0.32, 12]} />
      </mesh>
      <mesh material={M.brass} position={[0, 0.37, 0]}>
        <cylinderGeometry args={[0.08, 0.05, 0.04, 16]} />
      </mesh>
      <mesh material={M.wax} position={[0, 0.55, 0]}>
        <cylinderGeometry args={[0.045, 0.045, 0.34, 14]} />
      </mesh>
      <group position={[0, 0.78, 0]} scale={[1, fl, 1]} rotation={[0, 0, Math.sin(t * 5) * 0.08]}>
        <mesh material={M.flame} scale={[0.035, 0.08, 0.035]}>
          <sphereGeometry args={[1, 12, 10]} />
        </mesh>
        <mesh material={M.halo} scale={0.22}>
          <sphereGeometry args={[1, 12, 10]} />
        </mesh>
      </group>
      {!semLuz ? <pointLight position={[0, 0.85, 0]} color="#FFB062" intensity={9 * luz * fl} distance={14} decay={1.6} /> : null}
    </group>
  );
};

export const Museu1799: React.FC<{ t: number; velas?: number }> = ({ t, velas = 1 }) => {
  const env = useEnv();
  const M = useMemo(() => {
    const floor = woodTexture("#6B4428").clone();
    floor.needsUpdate = true;
    floor.repeat.set(4, 4);
    floor.wrapS = floor.wrapT = THREE.RepeatWrapping;
    return {
      floor: new THREE.MeshStandardMaterial({ map: floor, roughness: 0.55, envMap: env, envMapIntensity: 0.25 }),
      wall: new THREE.MeshStandardMaterial({ map: wallpaper(), roughness: 0.9 }),
      wood: new THREE.MeshStandardMaterial({ map: woodTexture("#5A351E"), roughness: 0.5, envMap: env, envMapIntensity: 0.25 }),
      woodLight: new THREE.MeshStandardMaterial({ map: woodTexture("#7A4A2A"), roughness: 0.55 }),
      felt: new THREE.MeshStandardMaterial({ color: "#2F5A3C", roughness: 1 }),
      glass: new THREE.MeshPhysicalMaterial({ color: "#E9F7F2", roughness: 0.05, transparent: true, opacity: 0.28, envMap: env, envMapIntensity: 1.2 }),
      liquid: new THREE.MeshStandardMaterial({ color: "#D9C46A", transparent: true, opacity: 0.55, roughness: 0.1 }),
      specimen: new THREE.MeshStandardMaterial({ color: "#8C6A4E", roughness: 0.6 }),
      night: new THREE.MeshBasicMaterial({ color: "#1B2A55" }),
      moon: new THREE.MeshBasicMaterial({ color: "#F5F1DC" }),
      paper: new THREE.MeshStandardMaterial({ color: "#EFE4C8", roughness: 0.9 }),
      ink: new THREE.MeshStandardMaterial({ color: "#16141A", roughness: 0.2 }),
      quill: new THREE.MeshStandardMaterial({ color: "#F8F6F0", roughness: 0.8, side: THREE.DoubleSide }),
    };
  }, [env]);
  const books = useMemo(
    () =>
      Array.from({ length: 4 }).flatMap((_, row) => {
        let x = -2.3;
        const out: { x: number; y: number; w: number; h: number; c: string; tilt: number }[] = [];
        let i = 0;
        while (x < 2.2) {
          const w = 0.12 + rnd(row * 50 + i, 3) * 0.12, h = 0.55 + rnd(row * 50 + i, 4) * 0.3;
          out.push({ x: x + w / 2, y: 0.9 + row * 1.15, w, h, c: ["#7A2E2A", "#2F4E6E", "#5B4A2A", "#3E5A3A", "#8A6A3A", "#4B2F4F"][Math.floor(rnd(row * 50 + i, 5) * 6)], tilt: rnd(row * 50 + i, 6) < 0.08 ? 0.25 : 0 });
          x += w + 0.01;
          i++;
        }
        return out;
      }),
    [],
  );
  const [mx, my, mz] = MUSEU_MESA;
  return (
    <group>
      <fog attach="fog" args={["#1A1410", 6, 26]} />
      <color attach="background" args={["#120E0B"]} />
      {/* piso, paredes, rodapé de madeira */}
      <mesh material={M.floor} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[14, 12]} />
      </mesh>
      <mesh material={M.wall} position={[0, 3, -5]}>
        <planeGeometry args={[14, 6]} />
      </mesh>
      <mesh material={M.wall} position={[-6, 3, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[12, 6]} />
      </mesh>
      <mesh material={M.wall} position={[6, 3, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[12, 6]} />
      </mesh>
      <mesh material={M.wood} position={[0, 0.6, -4.97]}>
        <boxGeometry args={[14, 1.2, 0.06]} />
      </mesh>
      <mesh material={M.wood} position={[-5.97, 0.6, 0]}>
        <boxGeometry args={[0.06, 1.2, 12]} />
      </mesh>
      {/* janela de noite com lua */}
      <group position={[2.6, 3.2, -4.95]}>
        <mesh material={M.night}>
          <planeGeometry args={[1.8, 2.4]} />
        </mesh>
        <mesh material={M.moon} position={[0.45, 0.6, 0.01]}>
          <circleGeometry args={[0.22, 24]} />
        </mesh>
        {[-0.9, 0, 0.9].map((x) => (
          <mesh key={x} material={M.woodLight} position={[x, 0, 0.03]}>
            <boxGeometry args={[0.08, 2.5, 0.06]} />
          </mesh>
        ))}
        {[-1.2, 0, 1.2].map((y) => (
          <mesh key={y} material={M.woodLight} position={[0, y, 0.03]}>
            <boxGeometry args={[1.9, 0.08, 0.06]} />
          </mesh>
        ))}
      </group>
      {/* estante */}
      <group position={[-5.6, 0, -1.2]} rotation={[0, Math.PI / 2, 0]}>
        <mesh material={M.wood} position={[0, 2.5, -0.3]}>
          <boxGeometry args={[5, 5, 0.08]} />
        </mesh>
        {[0, 1, 2, 3, 4].map((r) => (
          <mesh key={r} material={M.wood} position={[0, 0.6 + r * 1.15, 0]} castShadow>
            <boxGeometry args={[5, 0.08, 0.62]} />
          </mesh>
        ))}
        {books.map((b, i) => (
          <mesh key={i} position={[b.x, b.y - 0.3 + b.h / 2 - 0.25, 0]} rotation={[0, 0, b.tilt]}>
            <boxGeometry args={[b.w, b.h, 0.45]} />
            <meshStandardMaterial color={b.c} roughness={0.7} />
          </mesh>
        ))}
      </group>
      {/* potes com espécimes (aparador ao fundo) */}
      <mesh material={M.wood} position={[-1.6, 1.1, -4.4]} castShadow>
        <boxGeometry args={[3.2, 0.12, 0.9]} />
      </mesh>
      <mesh material={M.wood} position={[-1.6, 0.52, -4.4]}>
        <boxGeometry args={[3.0, 1.04, 0.8]} />
      </mesh>
      {[-2.7, -1.9, -1.1, -0.4].map((x, i) => (
        <group key={x} position={[x, 1.16, -4.4]}>
          <mesh material={M.liquid} position={[0, 0.3, 0]}>
            <cylinderGeometry args={[0.2, 0.2, 0.55, 16]} />
          </mesh>
          <mesh material={M.specimen} position={[0, 0.3, 0]} scale={[0.1, 0.18 + i * 0.03, 0.08]}>
            <sphereGeometry args={[1, 10, 8]} />
          </mesh>
          <mesh material={M.glass} position={[0, 0.34, 0]}>
            <cylinderGeometry args={[0.22, 0.22, 0.68, 18]} />
          </mesh>
          <mesh material={M.wood} position={[0, 0.71, 0]}>
            <cylinderGeometry args={[0.23, 0.23, 0.06, 18]} />
          </mesh>
        </group>
      ))}
      <Vela t={t + 1.3} position={[0.4, 1.16, -4.4]} luz={0.5 * velas} />
      {/* mesa de trabalho com feltro, papéis, tinteiro e pena */}
      <group position={[mx, 0, mz]}>
        <mesh material={M.wood} position={[0, my - 0.06, 0]} castShadow receiveShadow>
          <boxGeometry args={[3.4, 0.12, 1.8]} />
        </mesh>
        <mesh material={M.felt} position={[0, my + 0.005, 0]} receiveShadow>
          <boxGeometry args={[3.0, 0.01, 1.4]} />
        </mesh>
        {[
          [-1.55, -0.75],
          [1.55, -0.75],
          [-1.55, 0.75],
          [1.55, 0.75],
        ].map(([x, z]) => (
          <mesh key={`${x}${z}`} material={M.wood} position={[x, (my - 0.12) / 2, z]} castShadow>
            <cylinderGeometry args={[0.07, 0.05, my - 0.12, 10]} />
          </mesh>
        ))}
        <mesh material={M.paper} position={[1.05, my + 0.02, 0.35]} rotation={[0, 0.2, 0]}>
          <boxGeometry args={[0.6, 0.01, 0.8]} />
        </mesh>
        <mesh material={M.ink} position={[1.3, my + 0.07, -0.35]}>
          <cylinderGeometry args={[0.07, 0.09, 0.13, 14]} />
        </mesh>
        <mesh material={M.quill} position={[1.25, my + 0.3, -0.33]} rotation={[0.2, 0, -0.45]} scale={[0.05, 0.32, 0.01]}>
          <sphereGeometry args={[1, 10, 8]} />
        </mesh>
        <Vela t={t} position={[-1.15, my, -0.35]} luz={velas} />
      </group>
    </group>
  );
};
