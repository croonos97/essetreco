import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { clamp01, mix, rnd, sm, texCanvas } from "./LagartixaComum";

// =====================================================================
// LUPA CIRCULAR (picture-in-picture) — dedo → lamelas → pelinhos → pontinhas encostando no forro.
// Fica por cima do quadro principal (a lagartixa no forro continua visível atrás), presa ao dedo por uma linha.
// nivel: 0 = dedo inteiro com as lamelas encostadas no forro · 1 = uma lamela: floresta de pelinhos (cerdas)
//        2 = pontinhas das cerdas abertas em leque (espátulas) tocando o forro.   (contínuo, zoom sem corte)
// Escala da cena interna: 1 = 1 mm (ESQUEMA: pelinhos e pontinhas exagerados em tamanho/quantidade).
// =====================================================================
export type LupaProps = {
  t: number;
  nivel: number;
  cx: number; // centro da lupa (px no quadro 1080×1920)
  cy: number;
  raio?: number; // px
  ancora?: [number, number]; // ponto do dedo na tela (px)
  abrir?: number; // 0..1 (a lupa cresce do dedo até o lugar)
  cola?: number; // 0..1 gota de cola aparece e é riscada com um X
  rotulo?: string; // etiqueta embaixo (padrão "ESQUEMA · AMPLIADO")
  etapas?: [string, string, string]; // nome de cada nível (só palavras que a narração diz)
};

// ---------- câmera interna (zoom em escala log) ----------
const NIV = [
  { pos: [0.35, -0.42, 2.0], look: [0.2, -0.2, 0], fov: 40 },
  { pos: [0.2, -0.12, 0.34], look: [0.15, -0.055, 0], fov: 40 },
  { pos: [0.172, -0.0085, 0.032], look: [0.166, -0.003, 0.006], fov: 40 },
];
const CamLupa: React.FC<{ nivel: number }> = ({ nivel }) => {
  const { camera } = useThree();
  useLayoutEffect(() => {
    const n = Math.max(0, Math.min(2, nivel));
    const i = Math.min(1, Math.floor(n));
    const f = sm(n - i);
    const A = NIV[i], B = NIV[i + 1];
    // interpola em log da distância ao alvo (zoom uniforme)
    const look = new THREE.Vector3(...(A.look as [number, number, number])).lerp(new THREE.Vector3(...(B.look as [number, number, number])), f);
    const dA = new THREE.Vector3(...(A.pos as [number, number, number])).sub(new THREE.Vector3(...(A.look as [number, number, number])));
    const dB = new THREE.Vector3(...(B.pos as [number, number, number])).sub(new THREE.Vector3(...(B.look as [number, number, number])));
    const len = Math.exp(mix(Math.log(dA.length()), Math.log(dB.length()), f));
    const dir = dA.normalize().lerp(dB.normalize(), f).normalize();
    const cam = camera as THREE.PerspectiveCamera;
    cam.position.copy(look).addScaledVector(dir, len);
    cam.near = len * 0.02;
    cam.far = len * 60;
    cam.fov = 40;
    cam.up.set(0, 1, 0);
    cam.lookAt(look);
    cam.updateProjectionMatrix();
  });
  return null;
};

const forroTex = () =>
  texCanvas("lupaForro", 256, 256, (g, W, H) => {
    g.fillStyle = "#EEECE6";
    g.fillRect(0, 0, W, H);
    for (let i = 0; i < 1400; i++) {
      g.fillStyle = rnd(i, 1) > 0.5 ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.4)";
      g.fillRect(rnd(i, 2) * W, rnd(i, 3) * H, 2, 2);
    }
  });

// cena interna: forro no plano y = 0 (vista de lado, de baixo), dedo pendurado embaixo com as lamelas para cima
const N_LAM = 8;
const MacroDedo: React.FC<{ t: number; nivel: number }> = ({ t, nivel }) => {
  const forro = useMemo(() => new THREE.MeshStandardMaterial({ map: forroTex(), roughness: 0.6, emissive: new THREE.Color("#BDB8AC"), emissiveIntensity: 0.5 }), []);
  const pele = useMemo(() => new THREE.MeshStandardMaterial({ color: "#C8B79C", roughness: 0.55, emissive: new THREE.Color("#4A3426"), emissiveIntensity: 0.2 }), []);
  const lam = useMemo(() => new THREE.MeshStandardMaterial({ color: "#D9CBB2", roughness: 0.5, emissive: new THREE.Color("#4A3426"), emissiveIntensity: 0.15 }), []);
  const cerda = useMemo(() => new THREE.MeshStandardMaterial({ color: "#E9DFC9", roughness: 0.4, emissive: new THREE.Color("#6B5A44"), emissiveIntensity: 0.3 }), []);
  const esp = useMemo(() => new THREE.MeshStandardMaterial({ color: "#FFE9A8", roughness: 0.4, emissive: new THREE.Color("#B08A30"), emissiveIntensity: 0.45, side: THREE.DoubleSide }), []);
  const cerdaRef = useRef<THREE.InstancedMesh>(null);
  const espRef = useRef<THREE.InstancedMesh>(null);
  const cyl = useMemo(() => {
    const c = new THREE.CylinderGeometry(0.45, 1, 1, 8, 1);
    c.translate(0, 0.5, 0);
    return c;
  }, []);
  const disco = useMemo(() => new THREE.CircleGeometry(1, 10), []);
  // lamelas: placas transversais ao longo do dedo (x), alturas crescentes perto da ponta
  const LAM = useMemo(() => Array.from({ length: N_LAM }, (_, i) => ({ x: -0.95 + i * 0.27, top: -0.115, w: 0.24 })), []);
  const cerdasOn = 1;
  const espOn = clamp01((nivel - 1.3) / 0.4);
  useLayoutEffect(() => {
    const C = cerdaRef.current, E = espRef.current;
    if (!C || !E) return;
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
    let n = 0, ne = 0;
    // cerdas na lamela do meio (alvo do zoom) e um pouco nas vizinhas
    for (let li = 0; li < N_LAM; li++) {
      const L = LAM[li];
      const dens = li === 4 ? 1 : 0.4;
      for (let a = 0; a < 16; a++)
        for (let b = 0; b < 14; b++) {
          if (rnd(a * 31 + b + li * 977, 2) > dens) continue;
          const x = L.x - L.w * 0.42 + (a / 15) * L.w * 0.84 + (rnd(a * 13 + b, 3) - 0.5) * 0.008;
          const z = -0.12 + (b / 13) * 0.24 + (rnd(a * 7 + b, 4) - 0.5) * 0.008;
          const len = (0 - L.top) * (0.9 + rnd(a + b * 3, 5) * 0.1) * mix(0.3, 1, cerdasOn); // alturas variadas (orgânico, não paliçada)
          const incl = 0.25 + 0.1 * Math.sin(t * 0.8 + a * 0.3) + (rnd(a * 5 + b * 11, 6) - 0.5) * 0.25; // inclinação irregular, balanço lento
          q.setFromEuler(new THREE.Euler(0, 0, -incl));
          p.set(x + Math.sin(incl) * len * 0.0, L.top, z);
          m4.compose(p, q, s.set(0.0019 * mix(0.3, 1, cerdasOn), len / Math.cos(incl), 0.0019 * mix(0.3, 1, cerdasOn)));
          C.setMatrixAt(n++, m4);
          // espátulas: leque de discos na ponta, tocando o forro (y ≈ 0)
          if (li === 4 && Math.abs(a - 8) <= 2 && Math.abs(b - 7) <= 2 && espOn > 0) {
            const tx = x + Math.tan(incl) * len / Math.cos(incl) * Math.cos(incl);
            for (let k = 0; k < 9; k++) {
              const ang = (k / 8 - 0.5) * 1.6;
              p.set(tx + Math.sin(ang) * 0.0024, -0.00015, z + Math.cos(ang) * 0.0024 - 0.0012);
              q.setFromEuler(new THREE.Euler(-Math.PI / 2, 0, ang));
              m4.compose(p, q, s.setScalar(0.0008 * espOn));
              E.setMatrixAt(ne++, m4);
            }
          }
        }
    }
    C.count = n;
    E.count = ne;
    C.instanceMatrix.needsUpdate = E.instanceMatrix.needsUpdate = true;
  });
  return (
    <>
      <hemisphereLight args={["#FFF4E0", "#5A4A3A", 1.1]} />
      <directionalLight position={[1, -2, 3]} intensity={1.6} color="#FFE2B8" />
      <directionalLight position={[-2, -1, -1]} intensity={0.5} color="#AFC8FF" />
      {/* forro (bloco acima de y = 0) */}
      <mesh material={forro} position={[0, 0.5, 0]}>
        <boxGeometry args={[40, 1, 40]} />
      </mesh>
      {/* dedo: almofada achatada, pendurada */}
      <mesh material={pele} position={[0.05, -0.42, 0]} scale={[1.3, 0.2, 0.26]}>
        <sphereGeometry args={[1, 40, 24]} />
      </mesh>
      {/* falange livre com unha (sobe da ponta) */}
      <mesh material={pele} position={[1.45, -0.42, 0]} rotation={[0, 0, -0.55]} scale={[0.07, 0.5, 0.07]}>
        <cylinderGeometry args={[0.6, 1, 1, 10]} />
      </mesh>
      {/* lamelas: placas encostadas no forro de baixo */}
      {LAM.map((L, i) => (
        <mesh key={`s${i}`} position={[L.x + L.w * 0.5 + 0.015, -0.21, 0]} scale={[0.012, 0.1, 0.25]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color="#6B5A44" />
        </mesh>
      ))}
      {LAM.map((L, i) => (
        <group key={i} position={[L.x, -0.26, 0]}>
          <mesh material={lam} position={[0, 0, 0]} scale={[L.w * 0.47, L.top + 0.26, 0.24]}>
            <sphereGeometry args={[1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
          </mesh>
        </group>
      ))}
      <instancedMesh ref={cerdaRef} args={[cyl, cerda, 1200]} frustumCulled={false} />
      <instancedMesh ref={espRef} args={[disco, esp, 400]} frustumCulled={false} visible={espOn > 0} />
    </>
  );
};

export const LupaDedo: React.FC<LupaProps> = ({ t, nivel, cx, cy, raio = 300, ancora, abrir = 1, cola = 0, rotulo = "ESQUEMA · AMPLIADO", etapas = ["LAMELAS", "PELINHOS", "PONTINHAS"] }) => {
  const a = sm(abrir);
  if (a <= 0.001) return null;
  const [ax, ay] = ancora ?? [cx, cy + raio + 200];
  const x = mix(ax, cx, a), y = mix(ay, cy, a), r = raio * mix(0.12, 1, a);
  const d = Math.hypot(x - ax, y - ay) || 1;
  const ex = x + ((ax - x) / d) * r, ey = y + ((ay - y) / d) * r;
  const D = Math.round(raio * 2);
  const etapa = nivel < 0.6 ? etapas[0] : nivel < 1.5 ? etapas[1] : etapas[2];
  const cl = clamp01(cola);
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      <svg width={1080} height={1920} style={{ position: "absolute", left: 0, top: 0 }}>
        <line x1={ax} y1={ay} x2={ex} y2={ey} stroke="#FFFFFF" strokeWidth={6} />
        <circle cx={ax} cy={ay} r={16} fill="none" stroke="#FFFFFF" strokeWidth={6} />
      </svg>
      <div
        style={{
          position: "absolute",
          left: x - r,
          top: y - r,
          width: 2 * r,
          height: 2 * r,
          borderRadius: "50%",
          overflow: "hidden",
          border: "10px solid #FFFFFF",
          boxShadow: "0 12px 40px rgba(0,0,0,0.55)",
          boxSizing: "border-box",
          background: "#1a1a1a",
        }}
      >
        <div style={{ position: "absolute", left: r - D / 2, top: r - D / 2, width: D, height: D, transform: `scale(${r / raio})` }}>
          <ThreeCanvas width={D} height={D} gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.1, preserveDrawingBuffer: true }} camera={{ fov: 40, position: [0, 0, 4] }}>
            <color attach="background" args={["#2A2620"]} />
            <CamLupa nivel={nivel} />
            <MacroDedo t={t} nivel={nivel} />
          </ThreeCanvas>
        </div>
        {/* gota de cola riscada */}
        {cl > 0 ? (
          <svg width={2 * r} height={2 * r} style={{ position: "absolute", left: 0, top: 0 }}>
            <g transform={`translate(${r * 1.35} ${r * 0.62}) scale(${(r / 300) * sm(cl / 0.4)})`}>
              <path d="M0,-70 C25,-30 45,0 45,25 A45,45 0 1 1 -45,25 C-45,0 -25,-30 0,-70 Z" fill="#F4F0DC" stroke="#3A3A3A" strokeWidth={6} />
              <text x={0} y={38} textAnchor="middle" fontFamily="Inter, Arial Black, sans-serif" fontWeight={900} fontSize={30} fill="#3A3A3A">
                COLA
              </text>
              {cl > 0.45 ? (
                <g stroke="#E8352B" strokeWidth={16} strokeLinecap="round" opacity={sm((cl - 0.45) / 0.2)}>
                  <line x1={-60} y1={-60} x2={60} y2={80} />
                  <line x1={60} y1={-60} x2={-60} y2={80} />
                </g>
              ) : null}
            </g>
          </svg>
        ) : null}
      </div>
      {/* etiqueta embaixo da lupa */}
      <div style={{ position: "absolute", left: x - 260, width: 520, top: y + r + 14, textAlign: "center", opacity: a, fontFamily: "Inter, Arial Black, sans-serif", fontWeight: 900, color: "#FFFFFF", textShadow: "0 0 8px #000, 0 0 3px #000" }}>
        <div style={{ fontSize: 46, color: "#FFD23F" }}>{etapa}</div>
        <div style={{ fontSize: 26, opacity: 0.9 }}>{rotulo}</div>
      </div>
    </div>
  );
};
