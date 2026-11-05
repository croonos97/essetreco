import { useMemo } from "react";
import * as THREE from "three";
import { clamp01, MM, noPlano, V3 } from "./CupimComum";
import { ik2, Osso } from "./Cupim";

// =====================================================================
// FORMIGA doméstica (~2,6 mm, marrom-escura brilhante) — a "invasora" que o soldado barra. Modelada em mm.
// Referencial: origem no chão sob o tórax, +z frente, +y cima (igual ao cupim).
// Passada em tripé sem patinar (dist em mm). Ciclo de 2 mm → a 6 mm/s são 3 passos/s (< 4 Hz).
// =====================================================================
let GE: THREE.SphereGeometry | null = null;
const esf = () => (GE ??= new THREE.SphereGeometry(1, 28, 20));
const PERN = [
  { ins: [0.12, 0.3, 0.55], pe: [0.85, 0, 1.05], fase: 0 },
  { ins: [0.13, 0.28, 0.35], pe: [1.0, 0, 0.3], fase: 0.5 },
  { ins: [0.13, 0.28, 0.15], pe: [0.9, 0, -0.55], fase: 0 },
];
export const Formiga: React.FC<{ t: number; dist?: number; andar?: number; position?: V3; rotation?: V3; escala?: number; cabeca?: number; sombra?: boolean }> = ({ t, dist = 0, andar = 1, position, rotation, escala = 1, cabeca = 0, sombra = true }) => {
  const m = useMemo(() => new THREE.MeshPhysicalMaterial({ color: "#3A2215", roughness: 0.3, clearcoat: 0.9, clearcoatRoughness: 0.2 }), []);
  const mp = useMemo(() => new THREE.MeshPhysicalMaterial({ color: "#5A3A24", roughness: 0.4, clearcoat: 0.5 }), []);
  const C = 2.0, A = C * 0.5 * clamp01(andar);
  const pernas: React.ReactNode[] = [];
  PERN.forEach((L, li) =>
    [1, -1].forEach((sx, si) => {
      const fase = (((dist / C + L.fase + (si ? 0.5 : 0)) % 1) + 1) % 1;
      const dz = fase < 0.5 ? A / 2 - (fase / 0.5) * A : -A / 2 + ((fase - 0.5) / 0.5) * A;
      const dy = fase < 0.5 ? 0 : Math.sin(((fase - 0.5) / 0.5) * Math.PI) * 0.18 * andar;
      const ins = new THREE.Vector3(sx * L.ins[0], L.ins[1], L.ins[2]);
      const pe = new THREE.Vector3(sx * L.pe[0], dy, L.pe[2] + dz);
      const joelho = ik2(ins, pe, 0.62, 0.62, new THREE.Vector3(sx, 1.1, 0));
      pernas.push(
        <group key={li * 2 + si}>
          <Osso a={ins} b={joelho} r={0.045} m={mp} s={sombra} />
          <Osso a={joelho} b={pe} r={0.03} m={mp} s={sombra} />
        </group>,
      );
    }),
  );
  // antenas cotoveladas: escapo longo + funículo, balançando devagar (≤ 1 Hz)
  const ant = [1, -1].map((sx) => {
    const base = new THREE.Vector3(sx * 0.1, 0.5, 1.15);
    const w = Math.sin(t * 2 * Math.PI * 0.9 + (sx > 0 ? 0 : 1.3)) * 0.2;
    const cot = base.clone().add(new THREE.Vector3(sx * 0.35, 0.35, 0.25));
    const ponta = cot.clone().add(new THREE.Vector3(sx * (0.15 + w * 0.3), -0.25, 0.55 + w * 0.2));
    return (
      <group key={sx}>
        <Osso a={base} b={cot} r={0.025} m={mp} s={sombra} />
        <Osso a={cot} b={ponta} r={0.03} m={mp} s={sombra} />
      </group>
    );
  });
  return (
    <group position={position} rotation={rotation} scale={escala * MM}>
      <group rotation={[0, cabeca, 0]} position={[0, 0, 0]}>
        <mesh geometry={esf()} material={m} position={[0, 0.42, 1.0]} scale={[0.28, 0.24, 0.32]} castShadow={sombra} />
        {[1, -1].map((sx) => <mesh key={sx} geometry={esf()} material={mp} position={[sx * 0.09, 0.32, 1.32]} rotation={[0, sx * 0.5, 0]} scale={[0.05, 0.035, 0.12]} />)}
        {ant}
      </group>
      <mesh geometry={esf()} material={m} position={[0, 0.4, 0.38]} scale={[0.17, 0.18, 0.42]} castShadow={sombra} />
      <mesh geometry={esf()} material={m} position={[0, 0.42, -0.12]} scale={[0.09, 0.11, 0.09]} />
      <mesh geometry={esf()} material={m} position={[0, 0.44, -0.62]} scale={[0.36, 0.32, 0.5]} castShadow={sombra} />
      {pernas}
    </group>
  );
};

// ---------- trilha de formigas ----------
// Caminho = pontos (cm) com a normal da superfície em cada trecho. Os bichos andam a v cm/s, espaçados de "passo" cm.
// O caminho deve começar e terminar ESCONDIDO (dentro da parede/de um buraco): nada aparece do nada.
export type Trilha = { p: V3[]; n: V3[] };
const prep = (T: Trilha) => {
  const P = T.p.map((x) => new THREE.Vector3(...x));
  const acc = [0];
  for (let i = 1; i < P.length; i++) acc.push(acc[i - 1] + P[i].distanceTo(P[i - 1]));
  return { P, acc, total: acc[acc.length - 1] };
};
export const naTrilha = (T: Trilha, s: number) => {
  const { P, acc, total } = prep(T);
  const ss = ((s % total) + total) % total;
  let i = 0;
  while (i < acc.length - 2 && acc[i + 1] < ss) i++;
  const u = (ss - acc[i]) / Math.max(1e-6, acc[i + 1] - acc[i]);
  const p = P[i].clone().lerp(P[i + 1], u);
  const d = P[i + 1].clone().sub(P[i]).normalize();
  // normal suavizada perto das quinas (±0,25 cm)
  let n = new THREE.Vector3(...T.n[i]);
  const L = acc[i + 1] - acc[i];
  const dA = ss - acc[i], dB = acc[i + 1] - ss;
  if (dB < 0.25 && i + 1 < T.n.length) n = n.clone().lerp(new THREE.Vector3(...T.n[i + 1]), (0.25 - dB) / 0.5);
  if (dA < 0.25 && i > 0) n = n.clone().lerp(new THREE.Vector3(...T.n[i - 1]), (0.25 - dA) / 0.5);
  void L;
  n.normalize();
  return { p: p.toArray() as V3, rot: noPlano(n.toArray() as V3, d.toArray() as V3), total };
};
export const FilaFormigas: React.FC<{ t: number; trilha: Trilha; v?: number; passo?: number; trecho?: [number, number]; sombra?: boolean }> = ({ t, trilha, v = 0.6, passo = 2.4, trecho, sombra = false }) => {
  const { total } = useMemo(() => prep(trilha), [trilha]);
  const n = Math.floor(total / passo);
  const out: React.ReactNode[] = [];
  for (let k = 0; k < n; k++) {
    const s = (t * v + k * passo + (k % 3) * 0.3) % total;
    if (trecho && (s < trecho[0] || s > trecho[1])) continue;
    const q = naTrilha(trilha, s);
    out.push(<Formiga key={k} t={t + k} dist={(t * v + k * passo) / MM} position={q.p} rotation={q.rot} sombra={sombra} />);
  }
  return <>{out}</>;
};
