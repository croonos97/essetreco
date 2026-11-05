import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { makeGlass } from "../animais/comum";
import { texCanvas } from "./PomboComum";
import { HumanoAzul } from "../animais/LagartixaHumano";
import { clamp01, HUMANO, mix, rnd, sm, V3 } from "./PomboComum";

// =====================================================================
// HUMANOS AZUIS do vídeo (todos em vidro azul translúcido, reuso de HumanoAzul; 175 cm = escala HUMANO).
//  • Zelador com vassoura: roupa "A" (camisa listrada: anéis azul-escuros + boné) e roupa "B" (jaqueta azul-média, sem boné)
//    → "mesmo de roupa trocada". A camisa usa renderOrder 7 (sempre depois do corpo, ordem fixa → sem piscada).
//  • Homem da pipoca sentado no banco, com saquinho na mão esquerda, jogando com a direita (Pipoca = grãos em arco).
//  • Homem + menino crescendo (idade → altura). O menino começa com 4 anos: NUNCA bebê.
// =====================================================================
const vidro = (cor: string) => makeGlass(cor);

// ---------- roupas ----------
const Camisa: React.FC<{ roupa: "A" | "B"; escala: number; position?: V3; rotation?: V3 }> = ({ roupa, escala, position, rotation }) => {
  const M = useMemo(() => ({ listra: vidro("#2346B8"), jaq: vidro("#1F3D9A") }), []);
  // tronco do HumanoAzul de pé: quadril 1,85; peito em 1,85 + 0,95 (meias 0,42 × 0,23)
  return (
    <group position={position} rotation={rotation} scale={escala}>
      {roupa === "A"
        ? [0.25, 0.45, 0.65, 0.85, 1.05].map((y, i) => (
            <mesh key={i} material={M.listra} position={[0, 1.85 + y, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[0.36 + (y > 0.8 ? 0.08 : 0), 0.24, 1]} renderOrder={7}>
              <torusGeometry args={[1, 0.09, 8, 28]} />
            </mesh>
          ))
        : (
          <mesh material={M.jaq} position={[0, 1.85 + 0.3, 0]} scale={[0.5, 0.95, 0.31]} renderOrder={7}>
            <capsuleGeometry args={[1, 0.6, 8, 20]} />
          </mesh>
        )}
    </group>
  );
};

// ---------- vassoura (objeto opaco) ----------
export const Vassoura: React.FC = () => {
  const M = useMemo(() => ({ cabo: new THREE.MeshStandardMaterial({ color: "#B9864C", roughness: 0.7 }), base: new THREE.MeshStandardMaterial({ color: "#C83C2E", roughness: 0.6 }), pelo: new THREE.MeshStandardMaterial({ color: "#2E2B28", roughness: 0.9 }) }), []);
  // origem = mão; cabo ao longo de −y (do espaço da mão) até o chão
  return (
    <group>
      <mesh material={M.cabo} position={[0, -0.6, 0]} castShadow>
        <cylinderGeometry args={[0.025, 0.025, 2.4, 8]} />
      </mesh>
      <mesh material={M.base} position={[0, -1.82, 0]} castShadow>
        <boxGeometry args={[0.55, 0.12, 0.1]} />
      </mesh>
      <mesh material={M.pelo} position={[0, -1.98, 0]} castShadow>
        <boxGeometry args={[0.52, 0.22, 0.08]} />
      </mesh>
    </group>
  );
};

// zelador: varrer (0..1), parar e "abrir os braços" (braços abertos, vassoura encostada fica a cargo da cena)
export const Zelador: React.FC<{ t: number; roupa?: "A" | "B"; varrer?: number; enxotar?: number; bracosAbertos?: number; andar?: number; fase?: number; position?: V3; rotation?: V3; semVassoura?: boolean }> = ({ t, roupa = "A", varrer = 1, enxotar = 0, bracosAbertos = 0, andar = 0, fase, position, rotation, semVassoura }) => {
  const sw = Math.sin(t * Math.PI * 2 * 0.8) * varrer; // vaivém da vassoura (0,8 Hz)
  const ab = clamp01(bracosAbertos);
  const en = clamp01(enxotar) * Math.sin(t * Math.PI * 2 * 1.2); // sacode a vassoura para espantar
  const bracoD = { ombro: [mix(0.55 + 0.25 * sw + 0.6 * Math.max(0, en), 0.15, ab), mix(0.2 * sw, 0, ab), mix(0.1, 1.2, ab)] as [number, number, number], cotovelo: mix(0.5, 0.1, ab) };
  const bracoE = { ombro: [mix(0.75 + 0.2 * sw, 0.15, ab), mix(-0.3, 0, ab), mix(0.05, 1.2, ab)] as [number, number, number], cotovelo: mix(0.9, 0.1, ab) };
  return (
    <group position={position} rotation={rotation}>
      <HumanoAzul t={t} escala={HUMANO} andar={andar} fase={fase} bone={roupa === "A"} cor={roupa === "A" ? "#8FD0FF" : "#86C2FF"} bracoD={bracoD} bracoE={bracoE} maoD={semVassoura || ab > 0.5 ? null : <group rotation={[0.9, 0, 0]}><Vassoura /></group>} />
      <Camisa roupa={roupa} escala={HUMANO} />
    </group>
  );
};

// ---------- pipoca ----------
// grão fofo: 5 bolinhas fundidas (lê como pipoca, não como pedrinha)
let GP: THREE.BufferGeometry | null = null;
export const geoPipoca = () => {
  if (GP) return GP;
  const parts = [[0, 0, 0, 1], [0.7, 0.3, 0.1, 0.75], [-0.6, 0.35, 0.2, 0.7], [0.1, 0.55, -0.6, 0.7], [0.05, -0.5, 0.5, 0.6]].map(([x, y, z, r]) => new THREE.IcosahedronGeometry(r, 1).translate(x, y, z));
  GP = mergeGeometries(parts, false)!;
  GP.computeVertexNormals();
  return GP;
};
const texSaco = () =>
  texCanvas("saco_pipoca", 64, 64, (g, w, h) => {
    for (let x = 0; x < w; x += 8) {
      g.fillStyle = (x / 8) % 2 ? "#F4EFE6" : "#D2352B";
      g.fillRect(x, 0, 8, h);
    }
  });
// saquinho de papel listrado vermelho e branco, aberto em cima, com pipocas aparecendo
export const SacoPipoca: React.FC = () => {
  const M = useMemo(() => ({ saco: new THREE.MeshStandardMaterial({ map: texSaco(), roughness: 0.85, side: THREE.DoubleSide }), pip: new THREE.MeshStandardMaterial({ color: "#FFF9EC", roughness: 0.85 }) }), []);
  return (
    <group>
      <mesh material={M.saco} castShadow>
        <cylinderGeometry args={[0.095, 0.075, 0.26, 16, 1, true]} />
      </mesh>
      <mesh material={M.saco} position={[0, -0.13, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.075, 16]} />
      </mesh>
      {[[0, 0.13, 0], [0.04, 0.14, 0.03], [-0.04, 0.135, -0.02], [0.02, 0.15, -0.04], [-0.03, 0.15, 0.04]].map((p, i) => (
        <mesh key={i} geometry={geoPipoca()} material={M.pip} position={p as V3} scale={0.022} castShadow />
      ))}
    </group>
  );
};
const N_PIP = 60;
// grãos jogados em levas: cada grão sai da mão em `mao` (mundo) e cai num ponto do chão em volta de `alvo`
export const Pipoca: React.FC<{ t: number; t0: number; mao: V3; alvo: V3; raio?: number; levas?: number; periodo?: number }> = ({ t, t0, mao, alvo, raio = 70, levas = 6, periodo = 1.6 }) => {
  const mesh = useMemo(() => {
    const m = new THREE.InstancedMesh(geoPipoca(), new THREE.MeshStandardMaterial({ color: "#FFF9EC", roughness: 0.85 }), N_PIP);
    m.castShadow = true;
    return m;
  }, []);
  useEffect(() => () => mesh.dispose(), [mesh]);
  const M4 = new THREE.Matrix4(), q = new THREE.Quaternion();
  const porLeva = Math.floor(N_PIP / levas);
  for (let i = 0; i < N_PIP; i++) {
    const leva = Math.floor(i / porLeva);
    const ts = t0 + leva * periodo + (i % porLeva) * 0.03;
    const voo = 0.75;
    const a = rnd(i, 261) * Math.PI * 2, r = raio * Math.sqrt(rnd(i, 262));
    const fim = new THREE.Vector3(alvo[0] + Math.cos(a) * r, alvo[1] + 0.6, alvo[2] + Math.sin(a) * r);
    const ini = new THREE.Vector3(...mao);
    let p: THREE.Vector3, s = 0.8 + rnd(i, 263) * 0.3; // grão ~2 cm
    if (t < ts) {
      p = ini; // ainda no saquinho/mão (escondido dentro da mão: escala 0 só antes de sair)
      s = 0.0001;
    } else {
      const u = clamp01((t - ts) / voo);
      p = ini.clone().lerp(fim, u);
      p.y += Math.sin(Math.PI * u) * 60; // arco
    }
    q.setFromEuler(new THREE.Euler(rnd(i, 264) * 6 + t * 2 * (t < ts + voo ? 1 : 0), rnd(i, 265) * 6, 0));
    M4.compose(p, q, new THREE.Vector3(s, s * 0.85, s));
    mesh.setMatrixAt(i, M4);
  }
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingSphere();
  return <primitive object={mesh} />;
};

// homem sentado no banco jogando pipoca (braço direito arremessa a cada `periodo` s, a partir de t0)
export const HomemPipoca: React.FC<{ t: number; t0?: number; periodo?: number; position?: V3; rotation?: V3 }> = ({ t, t0 = 0, periodo = 1.6, position, rotation }) => {
  const ph = (((t - t0) % periodo) + periodo) % periodo / periodo;
  const joga = sm(clamp01(ph / 0.25)) * (1 - sm(clamp01((ph - 0.35) / 0.4)));
  const saco = useMemo(() => new THREE.MeshStandardMaterial({ color: "#E8E2D6", roughness: 0.8 }), []);
  const listra = useMemo(() => new THREE.MeshStandardMaterial({ color: "#C8402F", roughness: 0.8 }), []);
  return (
    <group position={position} rotation={rotation}>
      <HumanoAzul
        t={t}
        escala={HUMANO}
        sentar={1}
        bracoD={{ ombro: [0.3 + 0.9 * joga, 0.3, 0.15], cotovelo: 1.2 - 0.8 * joga }}
        bracoE={{ ombro: [0.55, -0.25, 0.05], cotovelo: 1.25 }}
        maoE={
          <group position={[0, -0.14, 0.05]}>
            <SacoPipoca />
          </group>
        }
      />
    </group>
  );
};

// altura humana por idade (cm): 4 anos ≈ 102, 18 anos ≈ 175 (curvas de crescimento masculino)
const ALT: [number, number][] = [[4, 102], [6, 116], [8, 128], [10, 138], [12, 149], [14, 163], [16, 172], [18, 175]];
export const alturaHumano = (idade: number) => {
  const d = Math.max(4, idade);
  let i = 0;
  while (i < ALT.length - 2 && ALT[i + 1][0] < d) i++;
  const [a0, h0] = ALT[i], [a1, h1] = ALT[i + 1];
  return mix(h0, h1, clamp01((d - a0) / (a1 - a0)));
};
// menino que cresce até a altura do homem (escala uniforme do mesmo manequim azul; idade mínima 4 anos)
export const MeninoCrescendo: React.FC<{ t: number; idade: number; position?: V3; rotation?: V3 }> = ({ t, idade, position, rotation }) => (
  <HumanoAzul t={t} escala={(HUMANO * alturaHumano(idade)) / 175} position={position} rotation={rotation} cor="#A6DBFF" />
);
