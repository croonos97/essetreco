import { useMemo } from "react";
import * as THREE from "three";
import { clamp01, Furry, FurMat, furTexture, KIT, makeFur, mix, perfilGeo, PKey, skinTexture, smooth01, useEnv, V3 } from "./comum";

// =====================================================================
// MACACO-PREGO (Sapajus libidinosus, Serra da Capivara) — formato "Você é um [animal]".
// Escala do kit: 1 un ≈ 0,5 m. Sentado ≈ 0,8 un de altura. Origem = chão entre os pés. Frente = +z.
// Lado DIREITO do macaco = −x (ele olha para +z).
// Braços e pernas são IK de 2 ossos: a cena diz onde cada MÃO deve estar (`maoD.alvo`, no espaço do
// macaco) e para onde a palma aponta; os dedos fecham com `fechar` (0 aberta … 1 punho/segurando).
// O ponto de pega (onde fica o objeto segurado) é `alvo`. Objetos entram como `children` (espaço do macaco).
// =====================================================================
export type Mao = { alvo: V3; palma?: V3; fechar?: number; polegar?: number };
export type MacacoProps = {
  t: number;
  sentar?: number; // 1 sentado sobre os calcanhares (padrão), 0 de pé (bípede)
  quadril?: V3; // deslocamento extra do quadril
  inclinar?: number; // tronco para a frente (rad, somado à postura)
  giro?: number; // tronco gira (yaw)
  maoD?: Mao;
  maoE?: Mao;
  peD?: V3;
  peE?: V3;
  cabeca?: [number, number, number?]; // yaw, pitch(+ = olha para baixo), roll
  boca?: number; // abre a boca (mastigar/falar)
  grito?: number; // grito de alarme: boca grande, dentes, sobrancelhas para cima
  piscar?: number;
  sobrancelha?: number; // -1 brava … +1 surpresa
  convencido?: number; // pálpebras meio baixas + sorrisinho de lado
  sorriso?: number; // boca em arco para cima (0..1)
  rabo?: number; // 0 deitado no chão … 1 enrolado para cima
  femea?: boolean;
  pelo?: number;
  position?: V3;
  rotation?: V3;
  scale?: number;
  children?: React.ReactNode;
};

// ---------- geometrias ----------
const TORSO: PKey[] = [
  [0.0, 0.085, 0.07, 0.075, 0],
  [0.07, 0.112, 0.088, 0.09, 0],
  [0.17, 0.108, 0.08, 0.08, 0],
  [0.27, 0.112, 0.074, 0.07, 0],
  [0.34, 0.07, 0.05, 0.045, 0],
];
let G: {
  torso: THREE.BufferGeometry;
  sph: THREE.SphereGeometry;
  cyl: THREE.CylinderGeometry;
  cone: THREE.ConeGeometry;
  half: THREE.SphereGeometry;
} | null = null;
const geos = () => {
  if (G) return G;
  const torso = perfilGeo(TORSO, { seg: 36, rad: 32 });
  torso.rotateX(-Math.PI / 2); // eixo do perfil (z) vira altura (y); "ht" vai para as costas (−z), "hb" para a barriga (+z)
  G = {
    torso,
    sph: new THREE.SphereGeometry(1, 24, 18),
    cyl: new THREE.CylinderGeometry(1, 1, 1, 14, 1),
    cone: new THREE.ConeGeometry(1, 1, 10),
    half: new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2),
  };
  return G;
};

// ---------- utilidades ----------
const v = (a: V3) => new THREE.Vector3(a[0], a[1], a[2]);
const Y = new THREE.Vector3(0, 1, 0);
const quatY = (dir: THREE.Vector3) => new THREE.Quaternion().setFromUnitVectors(Y, dir.clone().normalize());
const eul = (q: THREE.Quaternion) => {
  const e = new THREE.Euler().setFromQuaternion(q);
  return [e.x, e.y, e.z] as V3;
};
// IK de 2 ossos: devolve cotovelo/joelho e ponta, dados raiz, alvo, comprimentos e direção do polo
const ik2 = (S: THREE.Vector3, T: THREE.Vector3, L1: number, L2: number, pole: THREE.Vector3) => {
  const d0 = T.clone().sub(S);
  const d = Math.min(Math.max(d0.length(), Math.abs(L1 - L2) + 1e-3), (L1 + L2) * 0.999);
  const dir = d0.lengthSq() > 1e-9 ? d0.normalize() : new THREE.Vector3(0, -1, 0);
  const a = Math.acos(THREE.MathUtils.clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1));
  const n = pole.clone().sub(dir.clone().multiplyScalar(pole.dot(dir)));
  if (n.lengthSq() < 1e-8) n.set(0, 0, 1);
  n.normalize();
  const u = dir.clone().multiplyScalar(Math.cos(a)).add(n.multiplyScalar(Math.sin(a)));
  const E = S.clone().add(u.multiplyScalar(L1));
  const W = S.clone().add(dir.clone().multiplyScalar(d));
  return { E, W };
};

// osso: cilindro de a até b + bola na junta de b (com pelo ou pele)
const Osso: React.FC<{ a: THREE.Vector3; b: THREE.Vector3; r: number; r2?: number; fur?: FurMat; mat?: THREE.Material; shells?: number; bola?: boolean }> = ({ a, b, r, r2, fur, mat, shells = 0, bola = true }) => {
  const g = geos();
  const d = b.clone().sub(a);
  const L = d.length();
  if (L < 1e-5) return null;
  const mid = a.clone().add(b).multiplyScalar(0.5);
  const rot = eul(quatY(d));
  const rr = r2 ?? r;
  const s: V3 = [(r + rr) / 2, L, (r + rr) / 2];
  return (
    <>
      {fur ? <Furry geo={g.cyl} fur={fur} shells={shells} position={mid.toArray() as V3} rotation={rot} scale={s} /> : <mesh geometry={g.cyl} material={mat} position={mid.toArray() as V3} rotation={rot} scale={s} castShadow />}
      {bola ? fur ? <Furry geo={g.sph} fur={fur} shells={shells} position={b.toArray() as V3} scale={rr * 1.02} /> : <mesh geometry={g.sph} material={mat} position={b.toArray() as V3} scale={rr * 1.02} castShadow /> : null}
    </>
  );
};

// ---------- mão: palma + 4 dedos (2 falanges) + polegar oponível ----------
// Base da mão: +y = direção dos dedos, +z = para onde a palma olha, x = y × z. `lado` = +1 mão direita.
// Na mão direita o polegar fica do lado +x; na esquerda, −x.
export const PEGA: V3 = [0, 0.072, 0.03]; // ponto de pega no espaço da mão
const MaoMesh: React.FC<{ fechar: number; polegar: number; lado: 1 | -1; skin: THREE.Material; nail: THREE.Material; fur: FurMat; shells: number }> = ({ fechar, polegar, lado, skin, nail, fur, shells }) => {
  const g = geos();
  const c = clamp01(fechar);
  const dedos = [-0.021, -0.007, 0.007, 0.021];
  const comp = [0.026, 0.031, 0.03, 0.024];
  return (
    <group>
      {/* dorso peludo do pulso + palma */}
      <Furry geo={g.sph} fur={fur} shells={Math.round(shells * 0.5)} position={[0, 0.012, -0.002]} scale={[0.026, 0.022, 0.019]} />
      <mesh geometry={g.sph} material={skin} position={[0, 0.034, 0.002]} scale={[0.031, 0.031, 0.013]} castShadow />
      {dedos.map((x, i) => {
        const L = comp[i];
        const k = c * (1 - 0.1 * Math.abs(i - 1.5));
        return (
          <group key={i} position={[x, 0.06, 0.002]} rotation={[k * 1.25, 0, (x / 0.021) * -0.06 * (1 - c)]}>
            <mesh geometry={g.cyl} material={skin} position={[0, L * 0.5, 0]} scale={[0.0068, L, 0.0068]} castShadow />
            <mesh geometry={g.sph} material={skin} position={[0, L, 0]} scale={0.0068} />
            <group position={[0, L, 0]} rotation={[k * 1.35, 0, 0]}>
              <mesh geometry={g.cyl} material={skin} position={[0, L * 0.42, 0]} scale={[0.0062, L * 0.84, 0.0062]} castShadow />
              <mesh geometry={g.sph} material={skin} position={[0, L * 0.84, 0]} scale={0.0062} />
              <mesh geometry={g.sph} material={nail} position={[0, L * 0.86, -0.004]} scale={[0.0045, 0.004, 0.0025]} />
            </group>
          </group>
        );
      })}
      {/* polegar: abre para fora quando a mão está aberta; fecha cruzando a frente da palma */}
      <group position={[lado * 0.026, 0.018, 0.006]} rotation={[0.35 + polegar * 0.9, -lado * polegar * 0.5, -lado * mix(0.95, 0.35, polegar)]}>
        <mesh geometry={g.cyl} material={skin} position={[0, 0.013, 0]} scale={[0.0078, 0.026, 0.0078]} castShadow />
        <mesh geometry={g.sph} material={skin} position={[0, 0.026, 0]} scale={0.0078} />
        <group position={[0, 0.026, 0]} rotation={[polegar * 0.9, 0, 0]}>
          <mesh geometry={g.cyl} material={skin} position={[0, 0.0105, 0]} scale={[0.007, 0.021, 0.007]} castShadow />
          <mesh geometry={g.sph} material={skin} position={[0, 0.021, 0]} scale={0.007} />
        </group>
      </group>
    </group>
  );
};

// ---------- materiais ----------
const useMats = (femea: boolean) => {
  const env = useEnv();
  return useMemo(() => {
    // pelo mais curto, mais denso e de fio mais grosso: macio, sem cara de espinho (revisão r1, P2-6)
    const corpo = makeFur({ map: furTexture(femea ? "#86603C" : "#7A5230", femea ? "#D2AE80" : "#C9A070", 21), len: 0.016, dens: 230, rootDark: 0.28, tip: 0.18, clump: 0.5, flow: [0, -0.8, -0.35] });
    const membro = makeFur({ map: furTexture("#4B3121", "#5F3F29", 22), len: 0.014, dens: 260, rootDark: 0.25, tip: 0.18, clump: 0.34, flow: [0, -0.8, 0] });
    const escuro = makeFur({ map: furTexture("#2A1A11", "#3B2717", 23), len: 0.014, dens: 280, rootDark: 0.2, tip: 0.2, clump: 0.5, flow: [0, 0.15, -0.9] });
    const claro = makeFur({ map: furTexture("#CDA87C", "#E6CDA6", 24), len: 0.008, dens: 420, rootDark: 0.12, tip: 0.12, clump: 0.55, flow: [0, -0.6, -0.4] });
    const rabo = makeFur({ map: furTexture("#33211A", "#4A3121", 25), len: 0.018, dens: 220, rootDark: 0.25, tip: 0.2, clump: 0.4, flow: [0, 0.8, 0] });
    return {
      corpo,
      membro,
      escuro,
      claro,
      rabo,
      pele: new THREE.MeshStandardMaterial({ map: skinTexture("#DDB58A", 31, 1400, 0.04), roughness: 0.62 }),
      focinho: new THREE.MeshStandardMaterial({ map: skinTexture("#E8C9A0", 32, 1400, 0.035), roughness: 0.55 }),
      mao: new THREE.MeshStandardMaterial({ map: skinTexture("#3B2B24", 33, 1800, 0.06), roughness: 0.6 }),
      unha: new THREE.MeshStandardMaterial({ color: "#1C1512", roughness: 0.3 }),
      iris: new THREE.MeshStandardMaterial({ color: "#3A2112", roughness: 0.06, envMap: env, envMapIntensity: 0.8 }),
      pupila: new THREE.MeshStandardMaterial({ color: "#0B0604", roughness: 0.05, envMap: env, envMapIntensity: 0.6 }),
      brilho: new THREE.MeshBasicMaterial({ color: "#FFFFFF" }),
      sobr: new THREE.MeshStandardMaterial({ color: "#2A1910", roughness: 0.9 }),
      boca: new THREE.MeshStandardMaterial({ color: "#3A1414", roughness: 0.7 }),
      dente: new THREE.MeshStandardMaterial({ color: "#FAF5EA", roughness: 0.35 }),
      lingua: new THREE.MeshStandardMaterial({ color: "#D9727A", roughness: 0.5 }),
      narina: new THREE.MeshStandardMaterial({ color: "#3A2418", roughness: 0.7 }),
    };
  }, [femea, env]);
};

export const MACACO_OMBRO = 0.105;
const SORRISO = new THREE.TorusGeometry(1, 0.16, 8, 20, Math.PI);

// só o antebraço + mão do macaco (para entrar pela borda do quadro sem o corpo). `de` = ponto do cotovelo
// (fora do quadro), `alvo` = ponto de pega; lado +1 = mão direita.
export const BracoMacaco: React.FC<{ de: V3; alvo: V3; palma?: V3; fechar?: number; lado?: 1 | -1; pelo?: number; children?: React.ReactNode }> = ({ de, alvo, palma = [0, -1, 0], fechar = 0.75, lado = 1, pelo = 12, children }) => {
  const m = useMats(false);
  const shells = Math.round(pelo * KIT.peloMult);
  m.membro.u.uScl.value = 1;
  m.membro.u.uN.value = Math.max(1, shells);
  const E = v(de), T = v(alvo);
  let W = T.clone();
  let basis = new THREE.Matrix4();
  for (let it = 0; it < 2; it++) {
    const fy = W.clone().sub(E).normalize();
    const pn = v(palma).normalize();
    const fz = pn.clone().sub(fy.clone().multiplyScalar(pn.dot(fy)));
    if (fz.lengthSq() < 1e-6) fz.set(0, 0, 1);
    fz.normalize();
    basis = new THREE.Matrix4().makeBasis(new THREE.Vector3().crossVectors(fy, fz), fy, fz);
    W = T.clone().sub(v(PEGA).applyMatrix4(basis));
  }
  const q = new THREE.Quaternion().setFromRotationMatrix(basis);
  return (
    <group>
      <Osso a={E} b={W} r={0.027} r2={0.021} fur={m.membro} shells={Math.round(shells * 0.7)} bola={false} />
      <group position={W.toArray() as V3} quaternion={q}>
        <MaoMesh fechar={fechar} polegar={fechar} lado={lado} skin={m.mao} nail={m.unha} fur={m.membro} shells={shells} />
      </group>
      {children}
    </group>
  );
};

export const Macaco: React.FC<MacacoProps> = (P) => {
  const { t } = P;
  const fem = !!P.femea;
  const m = useMats(fem);
  const g = geos();
  const shells = Math.round((P.pelo ?? 12) * KIT.peloMult);
  const sc = P.scale ?? 1;
  for (const f of [m.corpo, m.membro, m.escuro, m.claro, m.rabo]) {
    f.u.uScl.value = sc;
    f.u.uN.value = Math.max(1, shells);
  }
  const sen = clamp01(P.sentar ?? 1);
  const breath = Math.sin(t * 2.2) * 0.006;

  // ---- quadril e tronco
  const hip = v([0, mix(0.33, 0.115, sen), mix(0, -0.03, sen)]).add(v(P.quadril ?? [0, 0, 0]));
  const incl = mix(0.1, 0.3, sen) + (P.inclinar ?? 0);
  const torsoM = new THREE.Matrix4().compose(hip, new THREE.Quaternion().setFromEuler(new THREE.Euler(incl, P.giro ?? 0, 0, "YXZ")), new THREE.Vector3(1, 1, 1));
  const T = (p: V3) => v(p).applyMatrix4(torsoM);
  const shoulderD = T([-MACACO_OMBRO, 0.285, -0.005]);
  const shoulderE = T([MACACO_OMBRO, 0.285, -0.005]);
  const hipD = T([-0.065, 0.02, 0.01]);
  const hipE = T([0.065, 0.02, 0.01]);

  // ---- braços (IK) e mãos
  const L1 = 0.165, L2 = 0.155;
  const restD: Mao = { alvo: [-0.09, mix(0.32, 0.2, sen), mix(0.12, 0.2, sen)], palma: [0.2, -1, 0.2], fechar: 0.35 };
  const restE: Mao = { alvo: [0.09, mix(0.32, 0.2, sen), mix(0.12, 0.2, sen)], palma: [-0.2, -1, 0.2], fechar: 0.35 };
  const arm = (lado: 1 | -1, S: THREE.Vector3, mao: Mao) => {
    // lado +1 = direita (−x)
    const pole = v([-lado * 0.9, -0.6, -0.5]);
    const target = v(mao.alvo);
    const pn = v(mao.palma ?? [lado * 1, 0, 0]).normalize();
    // pega fica à frente da palma: resolve 2 vezes para achar o pulso
    let W = target.clone();
    let basis = new THREE.Matrix4();
    let E = S.clone();
    for (let it = 0; it < 2; it++) {
      const r = ik2(S, W, L1, L2, pole);
      E = r.E;
      const fy = r.W.clone().sub(E).normalize();
      const fz = pn.clone().sub(fy.clone().multiplyScalar(pn.dot(fy)));
      if (fz.lengthSq() < 1e-6) fz.set(0, 0, 1);
      fz.normalize();
      const fx = new THREE.Vector3().crossVectors(fy, fz);
      basis = new THREE.Matrix4().makeBasis(fx, fy, fz);
      const off = v(PEGA).applyMatrix4(basis);
      W = target.clone().sub(off);
    }
    const r = ik2(S, W, L1, L2, pole);
    const q = new THREE.Quaternion().setFromRotationMatrix(basis);
    return { E: r.E, W: r.W, q, mao };
  };
  const aD = arm(1, shoulderD, P.maoD ?? restD);
  const aE = arm(-1, shoulderE, P.maoE ?? restE);

  // ---- pernas (IK)
  const footRest = (lado: 1 | -1): V3 => [-lado * mix(0.075, 0.085, sen), 0.03, mix(0.0, 0.17, sen)];
  const leg = (lado: 1 | -1, H: THREE.Vector3, pe?: V3) => {
    const A = v(pe ?? footRest(lado));
    const pole = v([-lado * 0.35, mix(0, 0.8, sen), 1]);
    return { H, ...ik2(H, A, 0.16, 0.15, pole) };
  };
  const lD = leg(1, hipD, P.peD);
  const lE = leg(-1, hipE, P.peE);

  // ---- rabo: corrente de segmentos (sai das costas, deita no chão e enrola na ponta)
  const tail: THREE.Vector3[] = [T([0, 0.035, -0.07])];
  {
    const N = 10, seg = 0.068;
    let pitch = -0.9;
    const yaw0 = Math.PI + (P.giro ?? 0) + Math.sin(t * 0.9) * 0.25; // acompanha o giro do tronco (o rabo sai das costas)
    const curl = clamp01(P.rabo ?? 0.35);
    for (let i = 0; i < N; i++) {
      const k = i / (N - 1);
      pitch += i < 3 ? 0.28 : 0.04 + curl * 0.32 * k * k * 3;
      const yaw = yaw0 + Math.sin(t * 1.3 - i * 0.5) * 0.12 * k;
      const d = new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
      const p = tail[i].clone().add(d.multiplyScalar(seg));
      if (p.y < 0.03) p.y = 0.03;
      tail.push(p);
    }
  }

  // ---- rosto
  const gr = clamp01(P.grito ?? 0);
  const bo = Math.max(clamp01(P.boca ?? 0), gr);
  const pis = clamp01(P.piscar ?? 0);
  const conv = clamp01(P.convencido ?? 0);
  const sor = clamp01(P.sorriso ?? 0);
  const sob = THREE.MathUtils.clamp((P.sobrancelha ?? 0) + gr * 0.9, -1, 1);
  const lid = Math.max(pis, conv * 0.45);
  const [hy, hp, hr] = [P.cabeca?.[0] ?? 0, P.cabeca?.[1] ?? 0, P.cabeca?.[2] ?? 0];
  const tufo = fem ? 0.6 : 1;

  const sh = shells;
  return (
    <group position={P.position} rotation={P.rotation} scale={sc}>
      {/* ---------- tronco ---------- */}
      <group position={hip.toArray() as V3} rotation={[incl, P.giro ?? 0, 0]}>
        <group scale={[1 + breath, 1, 1 + breath]}>
          <Furry geo={g.torso} fur={m.corpo} shells={sh} />
          {/* peito claro */}
          <Furry geo={g.sph} fur={m.claro} shells={Math.round(sh * 0.7)} position={[0, 0.22, 0.045]} scale={[0.085, 0.085, 0.045]} />
          {/* bumbum / coxas */}
          <Furry geo={g.sph} fur={m.corpo} shells={sh} position={[0, 0.0, -0.01]} scale={[0.1, 0.07, 0.09]} />
        </group>
        {/* ---------- cabeça ---------- */}
        <group position={[0, 0.36, 0.02]} rotation={[hp - incl * 0.75, hy, hr]}>
          <Furry geo={g.cyl} fur={m.corpo} shells={sh} position={[0, -0.04, -0.01]} scale={[0.05, 0.06, 0.05]} />
          <group position={[0, 0.06, 0]}>
            {/* crânio claro + bochechas */}
            <Furry geo={g.sph} fur={m.claro} shells={sh} scale={[0.1, 0.094, 0.096]} />
            {/* boné escuro (o "prego") com dois tufos */}
            <Furry geo={g.half} fur={m.escuro} shells={sh} position={[0, 0.012, -0.012]} rotation={[-0.32, 0, 0]} scale={[0.1, 0.085, 0.1]} />
            {([1, -1] as const).map((s) => (
              <Furry key={s} geo={g.cone} fur={m.escuro} shells={Math.round(sh * 0.8)} position={[s * 0.042, 0.088, 0.012]} rotation={[-0.25, 0, -s * 0.35]} scale={[0.026 * tufo, 0.045 * tufo, 0.022 * tufo]} />
            ))}
            {/* máscara do rosto */}
            <mesh geometry={g.sph} material={m.pele} position={[0, -0.004, 0.066]} scale={[0.07, 0.074, 0.042]} castShadow />
            {/* focinho */}
            <mesh geometry={g.sph} material={m.focinho} position={[0, -0.036, 0.094]} scale={[0.046, 0.034 + bo * 0.012, 0.034]} />
            {([1, -1] as const).map((s) => (
              <mesh key={s} geometry={g.sph} material={m.narina} position={[s * 0.009, -0.026, 0.127]} rotation={[0, 0, s * 0.5]} scale={[0.0045, 0.003, 0.0025]} />
            ))}
            {/* boca: linha → oval aberta com dentes (grito) */}
            <group position={[0, -0.054 - bo * 0.008, 0.118]} rotation={[-0.35, 0, 0]}>
              {sor > 0.05 && bo < 0.2 ? (
                <mesh geometry={SORRISO} material={m.boca} position={[0, 0.006, 0.002]} rotation={[0, 0, Math.PI]} scale={[0.019, 0.012 + sor * 0.004, 0.02]} />
              ) : (
                <mesh geometry={g.sph} material={m.boca} scale={[0.018 + gr * 0.008 + conv * 0.003, 0.0025 + bo * 0.017, 0.008]} position={[conv * 0.004, 0, 0]} rotation={[0, 0, conv * 0.18]} />
              )}
              {bo > 0.25 ? <mesh geometry={g.sph} material={m.dente} position={[0, 0.006 + bo * 0.007, 0.004]} scale={[0.012 + gr * 0.005, 0.0035, 0.004]} /> : null}
              {gr > 0.4 ? ([1, -1] as const).map((s) => <mesh key={s} geometry={g.cone} material={m.dente} position={[s * 0.012, 0.004 + gr * 0.006, 0.005]} rotation={[Math.PI, 0, 0]} scale={[0.003, 0.008 * gr, 0.003]} />) : null}
              {bo > 0.35 ? <mesh geometry={g.sph} material={m.lingua} position={[0, -0.008 - bo * 0.004, 0.0]} scale={[0.01, 0.004, 0.006]} /> : null}
            </group>
            {/* olhos grandes e brilhantes */}
            {([1, -1] as const).map((s) => (
              <group key={s} position={[s * 0.031, 0.013, 0.096]}>
                <mesh geometry={g.sph} material={m.iris} scale={[0.0185, 0.0185 * (1 - 0.92 * lid), 0.012]} />
                <mesh geometry={g.sph} material={m.pupila} position={[0, 0, 0.0075]} scale={[0.009, 0.009 * (1 - 0.92 * lid), 0.006]} />
                {lid < 0.6 ? <mesh geometry={g.sph} material={m.brilho} position={[0.006, 0.007 * (1 - lid), 0.0115]} scale={0.0046} /> : null}
                {lid < 0.6 ? <mesh geometry={g.sph} material={m.brilho} position={[-0.006, -0.005, 0.0115]} scale={0.002} /> : null}
                {/* pálpebra (pele) desce por cima quando pisca/convencido */}
                {lid > 0.02 ? <mesh geometry={g.half} material={m.pele} position={[0, 0.0, 0.001]} rotation={[mix(-1.75, -0.1, lid), 0, 0]} scale={[0.0195, 0.0195, 0.0135]} /> : null}
                {/* sobrancelha */}
                <mesh geometry={g.cyl} material={m.sobr} position={[0, 0.026 + sob * 0.008, -0.002 - Math.abs(sob) * 0.003]} rotation={[0, 0, Math.PI / 2 + s * (-sob * 0.35 + conv * 0.15)]} scale={[0.0026, 0.021, 0.003]} />
              </group>
            ))}
            {/* orelhas */}
            {([1, -1] as const).map((s) => (
              <group key={s} position={[s * 0.1, 0.0, -0.005]} rotation={[0, s * 0.5, s * (0.25 - gr * 0.3)]}>
                <mesh geometry={g.sph} material={m.pele} scale={[0.012, 0.03, 0.026]} castShadow />
                <mesh geometry={g.sph} material={m.narina} position={[s * 0.004, 0, 0.004]} scale={[0.006, 0.018, 0.014]} />
              </group>
            ))}
          </group>
        </group>
      </group>
      {/* ---------- braços e mãos ---------- */}
      {[aD, aE].map((a, i) => {
        const lado = (i === 0 ? 1 : -1) as 1 | -1;
        const S = i === 0 ? shoulderD : shoulderE;
        return (
          <group key={i}>
            <Furry geo={g.sph} fur={m.membro} shells={Math.round(sh * 0.6)} position={S.toArray() as V3} scale={0.032} />
            <Osso a={S} b={a.E} r={0.03} r2={0.026} fur={m.membro} shells={Math.round(sh * 0.7)} />
            <Osso a={a.E} b={a.W} r={0.025} r2={0.021} fur={m.membro} shells={Math.round(sh * 0.7)} bola={false} />
            <group position={a.W.toArray() as V3} quaternion={a.q}>
              <MaoMesh fechar={a.mao.fechar ?? 0.35} polegar={a.mao.polegar ?? a.mao.fechar ?? 0.35} lado={lado} skin={m.mao} nail={m.unha} fur={m.membro} shells={sh} />
            </group>
          </group>
        );
      })}
      {/* ---------- pernas e pés ---------- */}
      {[lD, lE].map((l, i) => {
        const lado = i === 0 ? 1 : -1;
        const fwd = new THREE.Vector3(-lado * 0.15, 0, 1).normalize();
        const toe = l.W.clone().add(fwd.clone().multiplyScalar(0.075));
        toe.y = Math.max(0.012, toe.y - 0.012);
        return (
          <group key={i}>
            <Osso a={l.H} b={l.E} r={0.042} r2={0.033} fur={m.membro} shells={Math.round(sh * 0.7)} />
            <Osso a={l.E} b={l.W} r={0.03} r2={0.022} fur={m.membro} shells={Math.round(sh * 0.7)} />
            <Osso a={l.W} b={toe} r={0.018} r2={0.016} mat={m.mao} />
            {[-1, 0, 1].map((k) => (
              <mesh key={k} geometry={g.sph} material={m.mao} position={toe.clone().add(new THREE.Vector3(k * 0.012, -0.002, 0.012)).toArray() as V3} scale={[0.007, 0.006, 0.014]} />
            ))}
          </group>
        );
      })}
      {/* ---------- rabo ---------- */}
      {tail.slice(1).map((p, i) => (
        <Osso key={i} a={tail[i]} b={p} r={0.03 - i * 0.0015} r2={0.03 - (i + 1) * 0.0015} fur={m.rabo} shells={Math.round(sh * 0.8)} />
      ))}
      {P.children}
    </group>
  );
};

// pega de duas mãos: alvos para as duas mãos dos lados de um objeto no centro `c` (raio `r`)
export const pegaDupla = (c: V3, r: number, fechar = 0.8): { maoD: Mao; maoE: Mao } => ({
  maoD: { alvo: [c[0] - r, c[1], c[2]], palma: [1, 0, 0], fechar },
  maoE: { alvo: [c[0] + r, c[1], c[2]], palma: [-1, 0, 0], fechar },
});
export const smoothStep = smooth01;
