import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { clamp01, MM, rnd, V3 } from "./CupimComum";

// =====================================================================
// GRÂNULOS FECAIS do cupim de madeira seca (Cryptotermes brevis). Modelados em MILÍMETROS.
// Forma (fontes em qa/cupim_kit.md): ~0,8–1 mm de comprimento, alongados, pontas arredondadas,
// SEIS faces côncavas no comprido (seção de "estrela" de 6 quinas), duros e secos;
// cor varia com a madeira (bege-claro a marrom). Saem pelo furinho de expulsão (~1 mm) e fazem montinho embaixo.
// =====================================================================
export const GRAO_L = 0.9, GRAO_R = 0.25;
const GG = new Map<number, THREE.BufferGeometry>();
// eixo do grão = z. det = detalhe (anéis × lados)
export const graoGeo = (det = 1) => {
  const hit = GG.get(det);
  if (hit) return hit;
  const nA = Math.max(8, Math.round(22 * det)), nL = 6 * Math.max(3, Math.round(8 * det));
  const pos: number[] = [], idx: number[] = [], uv: number[] = [];
  for (let i = 0; i <= nA; i++) {
    const t = i / nA; // 0..1 ao longo
    const z = (t - 0.5) * GRAO_L;
    const perfil = Math.pow(Math.max(0, Math.sin(Math.PI * t)), 0.42); // pontas arredondadas e rombudas
    for (let j = 0; j <= nL; j++) {
      const th = (j / nL) * Math.PI * 2;
      // 6 quinas (cristas) com faces côncavas entre elas
      const c = Math.abs(Math.cos(3 * th));
      const r = GRAO_R * perfil * (0.74 + 0.26 * Math.pow(c, 0.35));
      // as quinas somem perto das pontas (arredondado)
      const k = Math.min(1, perfil * 1.6);
      const rr = GRAO_R * perfil * (1 - k) * 0.92 + r * k;
      pos.push(Math.cos(th) * rr, Math.sin(th) * rr, z);
      uv.push(j / nL, t);
    }
  }
  for (let i = 0; i < nA; i++)
    for (let j = 0; j < nL; j++) {
      const a = i * (nL + 1) + j, b = a + nL + 1;
      idx.push(a, a + 1, b, b, a + 1, b + 1);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  GG.set(det, g);
  return g;
};
const corGrao = (i: number, base: THREE.Color) => {
  const v = 0.82 + rnd(i, 21) * 0.3;
  return base.clone().multiplyScalar(v).lerp(new THREE.Color("#6E4526"), rnd(i, 22) * 0.35);
};
const matGrao = () => new THREE.MeshStandardMaterial({ color: "#FFFFFF", roughness: 0.92, metalness: 0 });

// ---------- montinho (instanced) ----------
// Montinho cônico no chão (y = 0 do grupo), centro na origem. cresce 0..1 = quantidade (o cone cresce com ∛).
// raio/altura finais em cm. Só a CASCA tem grãos (até ~3 camadas); por dentro, um cone cor de grão tapa as frestas.
// Quando cresce, cada grão mantém seu lugar relativo (sem pulos).
export const MontinhoGraos: React.FC<{ n?: number; cresce?: number; raio?: number; altura?: number; cor?: string; position?: V3; rotation?: V3; sombra?: boolean; seed?: number }> = ({ n = 2600, cresce = 1, raio = 1.0, altura = 0.6, cor = "#C49A6C", position, rotation, sombra = true, seed = 1 }) => {
  const ref = useRef<THREE.InstancedMesh>(null);
  const mat = useMemo(matGrao, []);
  const nucleo = useMemo(() => new THREE.MeshStandardMaterial({ color: new THREE.Color(cor).multiplyScalar(0.62), roughness: 1 }), [cor]);
  const geoN = useMemo(() => new THREE.ConeGeometry(1, 1, 48, 1, true).translate(0, 0.5, 0), []);
  const dados = useMemo(() => {
    const base = new THREE.Color(cor);
    return Array.from({ length: n }, (_, i) => {
      const u = rnd(i + seed * 1000, 1), a = rnd(i + seed * 1000, 2) * Math.PI * 2;
      const rn = Math.sqrt(u) * 1.08; // distribuição uniforme no disco (+ alguns rolados para fora)
      const prof = Math.pow(rnd(i + seed * 1000, 3), 2) * 0.09; // cm abaixo da superfície
      return { rn, a, prof, ordem: rnd(i + seed * 1000, 9), rot: [rnd(i, 4) * 6.28, rnd(i, 5) * 6.28, rnd(i, 6) * 6.28] as V3, cor: corGrao(i + seed * 7, base) };
    });
  }, [n, cor, seed]);
  const k = Math.cbrt(clamp01(cresce));
  const R = raio * Math.max(0.15, k), H = altura * k;
  const hCone = (r: number, a: number) => H * Math.max(0, 1 - r / R) * (0.92 + 0.08 * Math.cos(a * 3));
  useLayoutEffect(() => {
    const im = ref.current;
    if (!im) return;
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    let c = 0;
    for (let i = 0; i < n; i++) {
      const d = dados[i];
      if (d.ordem > cresce) continue;
      const r = d.rn * R;
      const y = Math.max(GRAO_R * MM * 0.85, hCone(r, d.a) - d.prof);
      // deitados, encostados na encosta do monte
      e.set(Math.PI / 2 + (d.rot[0] - 3.14) * 0.25, d.rot[1], (d.rot[2] - 3.14) * 0.2, "YXZ");
      q.setFromEuler(e);
      m4.compose(new THREE.Vector3(Math.cos(d.a) * r, y, Math.sin(d.a) * r), q, new THREE.Vector3(MM, MM, MM));
      im.setMatrixAt(c, m4);
      im.setColorAt(c, d.cor);
      c++;
    }
    im.count = c;
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
    im.computeBoundingSphere();
  });
  return (
    <group position={position} rotation={rotation}>
      <instancedMesh ref={ref} args={[graoGeo(0.5), mat, n]} castShadow={sombra} receiveShadow={sombra} frustumCulled={false} />
      {H > 0.05 ? <mesh geometry={geoN} material={nucleo} scale={[R * 0.93, Math.max(0.001, H - 0.06), R * 0.93]} position={[0, 0.002, 0]} receiveShadow /> : null}
    </group>
  );
};

// ---------- grão solto (um só, mm) ----------
export const Grao: React.FC<{ position?: V3; rotation?: V3; escala?: number; cor?: string; det?: number; sombra?: boolean; destaque?: number }> = ({ position, rotation, escala = 1, cor = "#C49A6C", det = 1, sombra = true, destaque = 0 }) => {
  const m = useMemo(() => new THREE.MeshStandardMaterial({ color: cor, roughness: 0.9 }), [cor]);
  m.emissive.set("#FFD23F");
  m.emissiveIntensity = destaque * 0.35;
  return <mesh geometry={graoGeo(det)} material={m} position={position} rotation={rotation} scale={MM * escala} castShadow={sombra} receiveShadow={sombra} />;
};

// ---------- trajetória de um grão expulso pelo furo ----------
// Sai do furo (posição p0, cm) empurrado na direção n (normal da face), cai com gravidade e para no montinho (yChao).
// t = s desde a expulsão. Retorna posição (cm) e rotação. Rolamento ≤ 2 voltas/s.
export const quedaGrao = (t: number, p0: V3, n: V3, yChao: number, vSai = 6, sem = 0) => {
  const g = 981 * 0.55; // queda "em câmera lenta" moderada (legível): ~0,55 g
  const tt = Math.max(0, t);
  // fase 1: sai do furo (0,25 s, empurrado)
  const t1 = 0.25;
  if (tt < t1) {
    const k = tt / t1;
    const d = 0.12 * k; // cm para fora
    return { p: [p0[0] + n[0] * d, p0[1] + n[1] * d, p0[2] + n[2] * d] as V3, rot: [0, 0, 0] as V3, parado: false };
  }
  const t2 = tt - t1;
  const x0 = p0[0] + n[0] * 0.12, y0 = p0[1] + n[1] * 0.12, z0 = p0[2] + n[2] * 0.12;
  const vx = n[0] * vSai, vz = n[2] * vSai;
  const tChao = Math.sqrt((2 * Math.max(0, y0 - yChao)) / g);
  const tc = Math.min(t2, tChao);
  const y = y0 - 0.5 * g * tc * tc;
  const rolar = Math.min(t2, tChao) * 2 * Math.PI * 1.5 + sem;
  return { p: [x0 + vx * tc, Math.max(yChao, y), z0 + vz * tc] as V3, rot: [rolar, rolar * 0.3, 0] as V3, parado: t2 >= tChao };
};
