import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { rnd } from "../World";
import { KIT, bumpTexture, clamp01, dropGeo, Furry, furTexture, makeFill, makeFur, mix, perfilGeo, PKey, skinTexture, smooth01, useEnv, useGlass, V3 } from "./comum";

// =====================================================================
// ORNITORRINCO — personagem do formato "Você é um [animal]".
// Origem = chão sob a barriga (de pé). Frente = +z. Tamanho ≈ 1 unidade (bico→rabo).
// Toda pose é número 0..1 (exceto t, em segundos, para ciclos). Ver relatorio_kit_animais.md.
// =====================================================================
export type OrnitorrincoProps = {
  t: number; // segundos (ciclos de remar, andar, balançar, mastigar)
  macho?: boolean; // mostra o esporão nas patas de trás
  mae?: boolean; // pelo marrom mais claro e menos avermelhado, barriga clara (cena do leite)
  filhote?: number; // 1 = filhote pelado rosado (cabeça maior); a escala fica com quem usa
  pelo?: number; // nº de cascas de pelo (qualidade). 0 = sem pelo. Padrão 14
  // ---- poses (0..1)
  nadar?: number; // remar com as patas da frente, patas de trás de leme
  mergulhar?: number; // inclina o corpo de bico pra baixo
  balancar?: number; // cabeça varrendo de um lado pro outro (caça)
  fecharOlhos?: number;
  fecharOuvidos?: number;
  fecharNarinas?: number;
  bochechas?: number; // bochechas infladas (marmita)
  mastigar?: number; // mandíbula + bochechas mexendo
  boiar?: number; // patas abertas e soltas, corpo achatado na superfície
  andar?: number; // passo de lado a lado (andar de réptil)
  enrolar?: number; // deita, enrola o rabo pra baixo/frente e encolhe a cabeça (chocar)
  chutar?: number; // extensão do chute da pata de trás
  chutarLado?: "d" | "e" | "ambos";
  // ---- modos especiais (0..1)
  raiox?: number; // pelo se dissolve, corpo vira vidro azul com órgãos dentro
  sensores?: number; // fração dos 40 mil eletrorreceptores acesos no bico
  encher?: number; // nível amarelo dentro do corpo (0.2 = 1/5 do peso)
  veneno?: number; // esporão brilha e forma gotinha (só macho)
  leite?: number; // gotinhas de leite brotando da barriga (fêmea)
  ovos?: number; // 1 ou 2 ovinhos presos entre rabo e barriga (use com enrolar)
  brilhoBico?: number; // destaque emissivo no bico
  brilhoEsporao?: number;
  pele?: number; // espécime de museu: corpo achatado, patas abertas (1799 / vitrine)
  bicoSolto?: number; // bico separado da cabeça (montagem "bico de pato + corpo")
  costura?: number; // costura tracejada vermelha na base do bico (desenha 0..1)
  cortes?: number; // cortinhos de tesoura no couro (0..1 → até 7 marcas) + marcas em volta da base do bico
  brilhoUV?: number; // pelo fluorescente verde-azulado sob luz negra (0..1); a barriga clara brilha mais
  cabeca?: [number, number]; // yaw, pitch extras (rad)
  deitada?: number; // patas recolhidas ao longo do corpo (mãe deitada de lado amamentando)
  bicoLado?: number; // montagem "bico de pato": 1 = bico solto na mesa, à frente do bicho; 0 = encaixado
  boca?: number; // abertura manual do bico (0..1)
  position?: V3;
  rotation?: V3;
  scale?: number;
};

// ---------- formas (perfil ao longo de z) ----------
const BODY: PKey[] = [
  [-0.38, 0.08, 0.05, 0.045, 0.0],
  [-0.31, 0.165, 0.11, 0.088, 0.005],
  [-0.18, 0.225, 0.15, 0.112, 0.012],
  [-0.03, 0.232, 0.155, 0.115, 0.015],
  [0.08, 0.2, 0.138, 0.1, 0.018],
  [0.16, 0.16, 0.12, 0.085, 0.024],
  [0.22, 0.13, 0.1, 0.07, 0.03],
];
const HEAD: PKey[] = [
  [-0.07, 0.13, 0.1, 0.075, 0],
  [0.0, 0.168, 0.132, 0.088, 0.008],
  [0.08, 0.17, 0.126, 0.082, 0.006],
  [0.15, 0.138, 0.098, 0.064, -0.002],
  [0.21, 0.1, 0.066, 0.048, -0.01],
];
const BILL_UP: PKey[] = [
  [-0.03, 0.098, 0.062, 0.01, 0.012],
  [0.03, 0.094, 0.04, 0.008, 0.002],
  [0.12, 0.106, 0.03, 0.007, -0.002],
  [0.2, 0.11, 0.026, 0.006, -0.004],
  [0.255, 0.09, 0.019, 0.005, -0.006],
];
const BILL_LO: PKey[] = [
  [-0.02, 0.08, 0.006, 0.03, 0],
  [0.1, 0.088, 0.005, 0.02, -0.002],
  [0.19, 0.094, 0.004, 0.016, -0.004],
  [0.24, 0.078, 0.003, 0.011, -0.005],
];
const TAIL: PKey[] = [
  [0, 0.12, 0.045, 0.035, 0],
  [0.09, 0.165, 0.036, 0.03, -0.004],
  [0.22, 0.16, 0.028, 0.024, -0.01],
  [0.34, 0.085, 0.018, 0.015, -0.016],
];

// ponto na superfície da cabeça (lado s) na altura y e posição z (local da cabeça), afundado `inset`
const headSurf = (z: number, y: number, inset: number): [number, number, number] => {
  let i = 0;
  while (i < HEAD.length - 2 && HEAD[i + 1][0] < z) i++;
  const a = HEAD[i], b = HEAD[i + 1], k = (z - a[0]) / (b[0] - a[0]);
  const w = a[1] + (b[1] - a[1]) * k, ht = a[2] + (b[2] - a[2]) * k, yc = (a[4] ?? 0) + ((b[4] ?? 0) - (a[4] ?? 0)) * k;
  const yy = Math.min(0.97, Math.max(-0.97, (y - yc) / ht));
  return [w * Math.sqrt(1 - yy * yy) - inset, y, z];
};
const EYE_R = 0.0175;
const EYE = headSurf(0.1, 0.045, 0.0135); // centro do olho: só ~1/7 do raio fica para fora
const EYE_S = headSurf(0.1, 0.045, 0); // superfície da cabeça na altura do olho
// inclinação da normal da cabeça no olho (elipse w × ht): a dobra da pálpebra fica deitada na superfície
const EYE_TILT = (() => {
  const a = HEAD[1], b = HEAD[2], k = (0.1 - a[0]) / (b[0] - a[0]);
  const w = a[1] + (b[1] - a[1]) * k, ht = a[2] + (b[2] - a[2]) * k, yc = (a[4] ?? 0) + ((b[4] ?? 0) - (a[4] ?? 0)) * k;
  return Math.atan2((0.045 - yc) / (ht * ht), EYE_S[0] / (w * w));
})();
const EAR = headSurf(0.03, 0.06, 0.002);

let G: ReturnType<typeof buildGeos> | null = null;
const buildGeos = () => {
  const body = perfilGeo(BODY, { seg: 64, rad: 48 });
  const head = perfilGeo(HEAD, { seg: 48, rad: 44 });
  const billUp = perfilGeo(BILL_UP, { seg: 40, rad: 40, capBack: 0.3, edge: 0.18 });
  const billLo = perfilGeo(BILL_LO, { seg: 32, rad: 32, capBack: 0.3, edge: 0.2 });
  const tail = perfilGeo(TAIL, { seg: 36, rad: 36, capBack: 0.5 });
  tail.rotateY(Math.PI);
  const inner = body.clone();
  inner.scale(0.9, 0.88, 0.94);
  const limb = new THREE.CapsuleGeometry(1, 1, 6, 16);
  const sphere = new THREE.SphereGeometry(1, 28, 20);
  const lid = new THREE.SphereGeometry(1, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2);
  const claw = new THREE.ConeGeometry(1, 1, 8);
  claw.rotateX(Math.PI / 2);
  claw.translate(0, 0, 0.5);
  const fan = (r: number, a0: number, a1: number, lobes: number) => {
    const s = new THREE.Shape();
    s.moveTo(0, 0);
    const n = 40;
    for (let i = 0; i <= n; i++) {
      const a = a0 + ((a1 - a0) * i) / n;
      const lobe = 0.86 + 0.14 * Math.abs(Math.cos(((i / n) * lobes * Math.PI)));
      s.lineTo(Math.sin(a) * r * lobe, Math.cos(a) * r * lobe);
    }
    s.lineTo(0, 0);
    const g = new THREE.ShapeGeometry(s, 8);
    g.rotateX(Math.PI / 2); // plano xz, frente = +z
    g.scale(1, 1, -1);
    return g;
  };
  const webFront = fan(1, -1.15, 1.15, 4);
  const webHind = fan(1, -0.9, 0.9, 4);
  const torus = new THREE.TorusGeometry(1, 0.16, 12, 40);
  const ring = new THREE.TorusGeometry(1, 0.08, 8, 40);
  const gut = new THREE.TorusKnotGeometry(0.05, 0.016, 80, 8, 3, 5);
  return { body, head, billUp, billLo, tail, inner, limb, sphere, lid, claw, webFront, webHind, torus, ring, gut };
};
const geos = () => (G ??= buildGeos());
// marcas de tesoura sobre o dorso/flancos (posição + normal tiradas da malha do corpo)
let CUTS: { p: THREE.Vector3; n: THREE.Vector3 }[] | null = null;
const cutSpots = () => {
  if (CUTS) return CUTS;
  const g = geos().body;
  const pos = g.attributes.position as THREE.BufferAttribute, nor = g.attributes.normal as THREE.BufferAttribute;
  const row = 49;
  const pick: [number, number][] = [[24, 30], [30, 20], [36, 31], [42, 18], [28, 27], [46, 29], [34, 22]];
  CUTS = pick.map(([i, j]) => ({ p: new THREE.Vector3().fromBufferAttribute(pos, i * row + j), n: new THREE.Vector3().fromBufferAttribute(nor, i * row + j) }));
  return CUTS;
};

// ---------- 40 mil sensores no bico (instanciados) ----------
const sampleSurface = (g: THREE.BufferGeometry, n: number, seed: number, topBias = 0.75) => {
  const pos = g.attributes.position as THREE.BufferAttribute;
  const nor = g.attributes.normal as THREE.BufferAttribute;
  const idx = g.index!.array;
  const tris = idx.length / 3;
  const cum = new Float64Array(tris);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  let acc = 0;
  for (let i = 0; i < tris; i++) {
    a.fromBufferAttribute(pos, idx[i * 3]);
    b.fromBufferAttribute(pos, idx[i * 3 + 1]);
    c.fromBufferAttribute(pos, idx[i * 3 + 2]);
    const ar = b.clone().sub(a).cross(c.clone().sub(a)).length() / 2;
    const ny = (nor.getY(idx[i * 3]) + nor.getY(idx[i * 3 + 1]) + nor.getY(idx[i * 3 + 2])) / 3;
    acc += ar * (ny > 0 ? 1 : 1 - topBias);
    cum[i] = acc;
  }
  const out: { p: THREE.Vector3; n: THREE.Vector3 }[] = [];
  for (let k = 0; k < n; k++) {
    const r = rnd(k, seed) * acc;
    let lo = 0, hi = tris - 1;
    while (lo < hi) {
      const m = (lo + hi) >> 1;
      if (cum[m] < r) lo = m + 1;
      else hi = m;
    }
    let u = rnd(k, seed + 1), v = rnd(k, seed + 2);
    if (u + v > 1) {
      u = 1 - u;
      v = 1 - v;
    }
    const i0 = idx[lo * 3], i1 = idx[lo * 3 + 1], i2 = idx[lo * 3 + 2];
    a.fromBufferAttribute(pos, i0);
    b.fromBufferAttribute(pos, i1);
    c.fromBufferAttribute(pos, i2);
    const p = a.clone().multiplyScalar(1 - u - v).add(b.clone().multiplyScalar(u)).add(c.clone().multiplyScalar(v));
    const nn = new THREE.Vector3(nor.getX(i0), nor.getY(i0), nor.getZ(i0)).normalize();
    out.push({ p, n: nn });
  }
  return out;
};
const sensorMat = () =>
  new THREE.ShaderMaterial({
    uniforms: { uOn: { value: 0 }, uT: { value: 0 } },
    depthWrite: false,
    transparent: true,
    vertexShader: `attribute float aR; uniform float uOn; uniform float uT; varying float vB;
      void main(){ float on = step(aR, uOn); vB = on*(0.6+0.4*sin(uT*9.0+aR*90.0));
        vec4 p = instanceMatrix*vec4(position*on,1.0); gl_Position = projectionMatrix*modelViewMatrix*p; }`,
    fragmentShader: `varying float vB; void main(){ if (vB<=0.0) discard; gl_FragColor = vec4(mix(vec3(0.0,0.42,1.0), vec3(0.45,0.88,1.0), vB), 1.0); }`,
  });
const Sensores: React.FC<{ geo: THREE.BufferGeometry; n: number; seed: number; on: number; t: number }> = ({ geo, n, seed, on, t }) => {
  const ref = useRef<THREE.InstancedMesh>(null);
  const mat = useMemo(sensorMat, []);
  const dot = useMemo(() => {
    const g = new THREE.CircleGeometry(0.0012, 5);
    return g;
  }, [n, seed]);
  useLayoutEffect(() => {
    const im = ref.current;
    if (!im) return;
    const pts = sampleSurface(geo, n, seed);
    // ordem de acender: onda da ponta do bico para a base (+ aleatório)
    const ar = new Float32Array(n);
    pts.forEach((q, i) => (ar[i] = 0.002 + 0.996 * (0.55 * (1 - Math.min(1, Math.max(0, q.p.z / 0.26))) + 0.45 * rnd(i, seed + 9))));
    dot.setAttribute("aR", new THREE.InstancedBufferAttribute(ar, 1));
    const o = new THREE.Object3D();
    const zf = new THREE.Vector3(0, 0, 1);
    pts.forEach((s, i) => {
      o.position.copy(s.p).addScaledVector(s.n, 0.0012);
      o.quaternion.setFromUnitVectors(zf, s.n);
      o.updateMatrix();
      im.setMatrixAt(i, o.matrix);
    });
    im.instanceMatrix.needsUpdate = true;
  }, [geo, n, seed, dot]);
  mat.uniforms.uOn.value = on;
  mat.uniforms.uT.value = t;
  return <instancedMesh ref={ref} args={[dot, mat, n]} frustumCulled={false} visible={on > 0} renderOrder={3} />;
};

// ---------- materiais por instância ----------
const useMats = (filhote: boolean, mae = false) => {
  const env = useEnv();
  return useMemo(() => {
    const fur = filhote
      ? makeFur({ map: skinTexture("#F0A7A0", 7, 2200, 0.05), len: 0.004, rough: 0.55, rootDark: 0.0, tip: 0 })
      : makeFur({ map: mae ? furTexture("#7A5638", "#C9A47C", 3) : furTexture("#8A5230", "#E3B783", 2), len: 0.026, dens: 150, rootDark: mae ? 0.22 : 0.38, tip: 0.22, clump: 0.46 });
    const furTail = filhote
      ? fur
      : makeFur({ map: furTexture("#6A3E22", "#A8764B", 4), len: 0.016, dens: 190, rootDark: 0.38, tip: 0.16, flow: [0, -0.1, -0.8] });
    const furLeg = filhote ? fur : makeFur({ map: furTexture("#6A4024", "#86573A", 5), len: 0.0075, dens: 520, rootDark: 0.25, tip: 0.14, clump: 0.3, flow: [0, -0.6, 0] });
    const billBump = bumpTexture(6, 6000);
    const bill = new THREE.MeshStandardMaterial({
      map: skinTexture(filhote ? "#D99A92" : "#25272B", 11, 1200, 0.02),
      bumpMap: billBump,
      bumpScale: 0.12,
      roughness: 0.68,
      envMap: env,
      envMapIntensity: 0.18,
      emissive: new THREE.Color("#5FD0FF"),
      emissiveIntensity: 0,
    });
    const billUnder = new THREE.MeshStandardMaterial({ map: skinTexture(filhote ? "#E6B0A6" : "#4D4548", 12, 3000, 0.05), bumpMap: billBump, bumpScale: 0.12, roughness: 0.6, envMap: env, envMapIntensity: 0.3 });
    const eye = new THREE.MeshStandardMaterial({ color: "#040405", roughness: 0.08, metalness: 0, envMap: env, envMapIntensity: 0.55 });
    const eyeRing = new THREE.MeshStandardMaterial({ color: "#EAD3AE", roughness: 0.8 });
    const lid = new THREE.MeshStandardMaterial({ color: filhote ? "#C98378" : "#3A2215", roughness: 0.9 });
    const spark = new THREE.MeshBasicMaterial({ color: "#FFFFFF" });
    const skin = new THREE.MeshStandardMaterial({ map: skinTexture(filhote ? "#E9A39A" : "#4A3527", 13, 2500, 0.06), bumpMap: billBump, bumpScale: 0.4, roughness: 0.55, envMap: env, envMapIntensity: 0.4 });
    const web = new THREE.MeshStandardMaterial({ color: filhote ? "#E2A49B" : "#5C3F2C", roughness: 0.6, side: THREE.DoubleSide, envMap: env, envMapIntensity: 0.3 });
    const claw = new THREE.MeshStandardMaterial({ color: "#4A3B30", roughness: 0.35, envMap: env, envMapIntensity: 0.6 });
    const spur = new THREE.MeshStandardMaterial({ color: "#F3E7CB", roughness: 0.3, envMap: env, envMapIntensity: 0.8, emissive: new THREE.Color("#C8FF3A"), emissiveIntensity: 0 });
    const dark = new THREE.MeshStandardMaterial({ color: "#120D0B", roughness: 0.6 });
    const venom = new THREE.MeshStandardMaterial({ color: "#8CFF2E", roughness: 0.05, transparent: true, opacity: 0.85, emissive: new THREE.Color("#7CFF2E"), emissiveIntensity: 0.6, envMap: env });
    const milk = new THREE.MeshStandardMaterial({ color: "#FFFDF4", roughness: 0.08, envMap: env, envMapIntensity: 1 });
    const egg = new THREE.MeshStandardMaterial({ map: skinTexture("#F3E9D2", 21, 1600, 0.05), roughness: 0.6, envMap: env, envMapIntensity: 0.3 });
    const organ = (c: string) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.35, emissive: new THREE.Color(c), emissiveIntensity: 0.35, transparent: true, opacity: 0.9, envMap: env });
    const organs = { brain: organ("#F6A3C8"), heart: organ("#FF5D72"), gut: organ("#9EE37C"), bone: organ("#F4F1E6"), plate: organ("#F5E2B0") };
    const fill = makeFill("#FFD23F");
    return { furLeg, lid, eyeRing, fur, furTail, bill, billUnder, eye, spark, skin, web, claw, spur, dark, venom, milk, egg, organs, fill };
  }, [filhote, mae, env]);
};

// ---------- pata ----------
type LegPose = { sz: number; sx: number; sy: number; ez: number; ex: number; fx: number; fy: number };
const Pata: React.FC<{
  lado: 1 | -1;
  tras: boolean;
  p: LegPose;
  m: ReturnType<typeof useMats>;
  furOn: boolean;
  shells: number;
  dissolve: number;
  glass: THREE.Material | null;
  esporao: boolean;
  veneno: number;
  brilhoEsporao: number;
  t: number;
}> = ({ lado, tras, p, m, shells, dissolve, glass, esporao, veneno, brilhoEsporao, t }) => {
  const g = geos();
  const up = tras ? 0.06 : 0.07, lo = tras ? 0.05 : 0.06, r = tras ? 0.033 : 0.03;
  const skin = glass ?? m.skin, web = glass ?? m.web, claw = glass ?? m.claw;
  const toes = 5;
  if (tras && esporao) m.spur.emissiveIntensity = Math.max(veneno * 0.9, brilhoEsporao * 1.4);
  const footLen = tras ? 0.09 : 0.1;
  return (
    <group rotation={[p.sx, p.sy, p.sz * lado]}>
      {/* braço */}
      <Furry geo={g.limb} fur={m.furLeg} shells={Math.round(shells * 0.6)} dissolve={dissolve} position={[0, -up / 2, 0]} scale={[r, up / 2, r * 0.95]} />
      {glass ? <mesh geometry={g.limb} material={glass} position={[0, -up / 2, 0]} scale={[r, up / 2, r]} /> : null}
      <group position={[0, -up, 0]} rotation={[p.ex, 0, p.ez * lado]}>
        <Furry geo={g.limb} fur={m.furLeg} shells={Math.round(shells * 0.6)} dissolve={dissolve} position={[0, -lo / 2, 0]} scale={[r * 0.82, lo / 2, r * 0.8]} />
        {glass ? <mesh geometry={g.limb} material={glass} position={[0, -lo / 2, 0]} scale={[r * 0.82, lo / 2, r * 0.8]} /> : null}
        {/* esporão (macho): no tornozelo, do lado de fora, apontando para trás e para fora */}
        {tras && esporao ? (
          <group position={[0.03 * lado, -lo + 0.012, -0.012]} rotation={[-0.25, 2.3 * lado, 0]}>
            <mesh geometry={g.claw} material={glass ?? m.spur} scale={[0.014, 0.014, 0.08]} castShadow />
            {veneno > 0.02 ? (
              <mesh geometry={dropGeo()} material={m.venom} position={[0, -0.01 - veneno * 0.012 - Math.max(0, Math.sin(t * 2.2)) * 0.004 * veneno, 0.08]} scale={0.01 * smooth01(veneno * 1.5)} />
            ) : null}
          </group>
        ) : null}
        {/* pé */}
        <group position={[0, -lo - 0.006, 0]} rotation={[p.fx, p.fy + (tras ? Math.PI - 0.5 * lado : 0.25 * lado), -(p.sz + p.ez) * lado]}>
          <mesh geometry={g.sphere} material={skin} scale={[0.046, 0.015, footLen * 0.5]} position={[0, 0, footLen * 0.25]} castShadow />
          {Array.from({ length: toes }).map((_, i) => {
            const a = ((i - 2) / 2) * (tras ? 0.55 : 0.75);
            const L = footLen * (0.85 - Math.abs(i - 2) * 0.09);
            return (
              <group key={i} rotation={[0, a, 0]}>
                <mesh geometry={g.limb} material={skin} rotation={[Math.PI / 2, 0, 0]} position={[0, 0.0, L * 0.55]} scale={[0.0085, L * 0.32, 0.0075]} />
                <mesh geometry={g.claw} material={claw} position={[0, -0.002, L * 0.88]} scale={[0.005, 0.004, tras ? 0.018 : 0.015]} rotation={[0.25, 0, 0]} />
              </group>
            );
          })}
          {/* membrana: na frente passa das unhas */}
          <mesh geometry={tras ? g.webHind : g.webFront} material={web} position={[0, -0.002, 0.004]} scale={tras ? [footLen * 0.95, 1, footLen * 0.8] : [footLen * 1.25, 1, footLen * 1.3]} />
        </group>
      </group>
    </group>
  );
};

// fração de área de um círculo cheio até a altura h (0..1) → inverte por bisseção
const areaAte = (h: number) => {
  const th = 2 * Math.acos(1 - 2 * h);
  return (th - Math.sin(th)) / (2 * Math.PI);
};
export const nivelPorVolume = (v: number) => {
  if (v <= 0) return 0;
  if (v >= 1) return 1;
  let a = 0, b = 1;
  for (let i = 0; i < 24; i++) {
    const m = (a + b) / 2;
    if (areaAte(m) < v) a = m;
    else b = m;
  }
  return (a + b) / 2;
};

// costura tracejada vermelha em volta da base do bico (desenhada aos poucos: p 0..1)
const COST = new THREE.MeshBasicMaterial({ color: "#FF2B2B" });
const DASH = new THREE.BoxGeometry(1, 1, 1);
const Costura: React.FC<{ p: number }> = ({ p }) => {
  const N = 26;
  const n = Math.round(clamp01(p) * N);
  return (
    <group position={[0, -0.006, 0.168]}>
      {Array.from({ length: n }).map((_, i) => {
        const a = (i / N) * Math.PI * 2 + Math.PI / 2;
        const x = Math.cos(a) * 0.108, y = Math.sin(a) * 0.072;
        return <mesh key={i} geometry={DASH} material={COST} position={[x, y, 0]} rotation={[0, 0, a + Math.PI / 2]} scale={[0.014, 0.0045, 0.006]} />;
      })}
    </group>
  );
};

// marcas do corte em volta da base do bico (onde o Shaw cortou): talhos curtos e irregulares
const MarcasBico: React.FC<{ n: number; m: THREE.Material }> = ({ n, m }) => (
  <group position={[0, -0.004, 0.158]}>
    {Array.from({ length: n }).map((_, i) => {
      const a = Math.PI * (0.05 + (i / 8) * 0.9) + (rnd(i, 71) - 0.5) * 0.15;
      const x = Math.cos(a) * 0.112, y = Math.sin(a) * 0.078;
      return <mesh key={i} geometry={geos().sphere} material={m} position={[x, y, 0.004]} rotation={[0, 0, a + Math.PI / 2 + (rnd(i, 72) - 0.5) * 0.6]} scale={[0.016 + rnd(i, 73) * 0.008, 0.0028, 0.006]} />;
    })}
  </group>
);

export const Ornitorrinco: React.FC<OrnitorrincoProps> = (P) => {
  const { t, macho = false, chutarLado = "d" } = P;
  const fil = (P.filhote ?? 0) > 0.5;
  const m = useMats(fil, !!P.mae);
  const g = geos();
  const pel = clamp01(P.pele ?? 0);
  const nad = P.nadar ?? 0, mer = P.mergulhar ?? 0, bal = P.balancar ?? 0, boi = Math.max(P.boiar ?? 0, pel), and = P.andar ?? 0, enr = P.enrolar ?? 0, chu = P.chutar ?? 0;
  const rx = clamp01(P.raiox ?? 0);
  const shells = fil ? 0 : Math.round((P.pelo ?? 14) * KIT.peloMult);
  const dissolve = rx;
  const glassOp = smooth01(rx * 1.4);
  m.fur.u.uN.value = Math.max(1, shells);
  m.fur.u.uScl.value = m.furTail.u.uScl.value = m.furLeg.u.uScl.value = P.scale ?? 1;
  m.furLeg.u.uN.value = Math.max(1, Math.round(shells * 0.6));
  m.furTail.u.uN.value = Math.max(1, Math.round(shells * 0.8));
  const uv = clamp01(P.brilhoUV ?? 0);
  m.fur.u.uGlow.value = uv * 0.55;
  m.furTail.u.uGlow.value = uv * 0.45;
  m.furLeg.u.uGlow.value = uv * 0.35;
  const glass = useGlass("#7EC8FF", glassOp);
  const useGlassParts = rx > 0.5 ? glass : null;

  // ---- ciclos
  const ph = t * Math.PI * 2 * 1.5; // remada
  const phW = t * Math.PI * 2 * 1.8; // passo
  const sw = Math.max(nad, boi);
  // ---- corpo
  const bodyRoll = Math.sin(ph) * 0.06 * nad + Math.sin(phW) * 0.05 * and;
  const bodyYaw = Math.sin(phW) * 0.12 * and + Math.sin(ph * 0.5) * 0.05 * nad;
  const bob = Math.abs(Math.sin(phW)) * 0.01 * and;
  const pitch = mer * 0.55 + enr * 0.18;
  const lie = enr * 0.08 + sw * 0.02 + pel * 0.11; // abaixa o corpo
  // ---- cabeça
  const sweep = Math.sin(t * Math.PI * 2 * 1.4) * 0.5 * bal;
  const headYaw = sweep + (P.cabeca?.[0] ?? 0) + Math.sin(phW) * -0.08 * and;
  const headPitch = (P.cabeca?.[1] ?? 0) + enr * 0.55 - nad * 0.08 + mer * 0.1;
  const chew = (P.mastigar ?? 0) * (0.5 + 0.5 * Math.sin(t * Math.PI * 2 * 2.6));
  const jaw = Math.max(P.boca ?? 0, chew * 0.6) * 0.22;
  const cheek = clamp01(P.bochechas ?? 0) * (1 + chew * 0.06 * Math.sin(t * 30));
  const lidC = clamp01(Math.max(P.fecharOlhos ?? 0, fil ? 1 : 0));
  const earC = clamp01(P.fecharOuvidos ?? 0);
  const noseC = clamp01(P.fecharNarinas ?? 0);
  const headS = fil ? 1.3 : 1.12;

  // ---- patas (ângulos-base de pé, depois mistura com nadar/boiar/andar/enrolar/chutar)
  const leg = (tras: boolean, lado: 1 | -1): LegPose => {
    const base: LegPose = { sz: 1.0, sx: 0, sy: 0, ez: -1.0, ex: 0, fx: 0, fy: 0 };
    const off = (lado === 1 ? 0 : Math.PI) + (tras ? Math.PI : 0);
    // andar: balanço frente/trás alternado + levantar
    const s = Math.sin(phW + off), c = Math.cos(phW + off);
    let { sz, sx, sy, ez, ex, fx, fy } = base;
    sx += s * 0.55 * and * (tras ? -1 : 1);
    sz += Math.max(0, c) * 0.35 * and;
    // nadar / boiar: patas abertas na horizontal
    const swimSz = tras ? 1.25 : 1.45, swimEz = tras ? -0.25 : -0.35;
    sz = mix(sz, swimSz, sw);
    ez = mix(ez, swimEz, sw);
    if (!tras) {
      // remada: varre de frente pra trás, pé "corta" a água na volta
      const st = Math.sin(ph + (lado === 1 ? 0 : Math.PI));
      sy += st * 0.75 * nad * lado;
      fx += Math.max(0, -Math.cos(ph + (lado === 1 ? 0 : Math.PI))) * 1.1 * nad;
      sy += Math.sin(t * 1.3 + lado) * 0.08 * boi;
    } else {
      // leme: patas de trás pra trás
      sy += -0.9 * nad * lado;
      sx += Math.sin(ph * 0.5 + lado) * 0.12 * nad;
      sy += -0.4 * boi * lado;
    }
    // enrolar: encolhe
    sz = mix(sz, tras ? 0.7 : 0.6, enr);
    sx = mix(sx, tras ? 0.6 : -0.6, enr);
    ez = mix(ez, -1.4, enr);
    // deitada (amamentando): patas recolhidas ao longo do corpo, pés deitados
    const dei = P.deitada ?? 0;
    sz = mix(sz, 0.35, dei);
    sx = mix(sx, tras ? 1.2 : 0.75, dei);
    sy = mix(sy, 0, dei);
    ez = mix(ez, -0.7, dei);
    fx = mix(fx, tras ? 0.4 : -0.3, dei);
    // chute
    const kicks = tras && (chutarLado === "ambos" || (chutarLado === "d" ? lado === 1 : lado === -1));
    if (kicks) {
      sy = mix(sy, -1.2 * lado, chu);
      sz = mix(sz, 1.55, chu);
      ez = mix(ez, 0.2, chu);
      fx = mix(fx, -0.6, chu);
    }
    return { sz, sx, sy, ez, ex, fx, fy };
  };

  const tailCurl = enr * -2.25;
  const tailYaw = Math.sin(ph * 0.5) * 0.18 * nad + Math.sin(phW + 0.6) * 0.15 * and;
  const tailPitch = tailCurl + Math.sin(ph) * 0.08 * nad + 0.06 * boi;
  const footY = 0.18;
  const organOp = smooth01((rx - 0.15) * 2);
  if (organOp > 0) Object.values(m.organs).forEach((o) => (o.opacity = 0.92 * organOp));
  m.bill.emissiveIntensity = (P.brilhoBico ?? 0) * 0.9;
  // `encher` é fração do VOLUME (0.2 = 1/5); converte para altura numa elipse (aprox.)
  const vol = clamp01(P.encher ?? 0);
  m.fill.uniforms.uLevel.value = nivelPorVolume(vol);
  m.fill.uniforms.uT.value = t;
  m.fill.uniforms.uY0.value = -0.115;
  m.fill.uniforms.uY1.value = 0.17;
  const enc = P.encher ?? 0;

  const billMat = useGlassParts ?? m.bill;
  const billUnderMat = useGlassParts ?? m.billUnder;
  const eyeMat = useGlassParts ?? m.eye;

  return (
    <group position={P.position} rotation={P.rotation} scale={P.scale ?? 1}>
      <group position={[0, footY - lie + bob, 0]} rotation={[pitch, bodyYaw, bodyRoll]} scale={[1 + pel * 0.12, 1 - pel * 0.6, 1]}>
        {/* ---------- corpo ---------- */}
        <Furry geo={g.body} fur={m.fur} shells={shells} dissolve={dissolve} />
        {rx > 0.02 ? <mesh geometry={g.body} material={glass} renderOrder={5} /> : null}
        {enc > 0 ? <mesh geometry={g.inner} material={m.fill} renderOrder={2} /> : null}
        {(P.cortes ?? 0) > 0
          ? cutSpots()
              .slice(0, Math.round(clamp01(P.cortes ?? 0) * 7))
              .map((c, i) => (
                <mesh key={i} geometry={g.sphere} material={m.dark} position={c.p.clone().addScaledVector(c.n, 0.012).toArray()} quaternion={new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), c.n)} scale={[0.018, 0.004, 0.0035]} />
              ))
          : null}
        {/* órgãos (raio-x) */}
        {organOp > 0 ? (
          <group>
            <mesh geometry={g.sphere} material={m.organs.heart} position={[0, -0.03, 0.12]} scale={[0.04, 0.036, 0.042]} />
            <mesh visible={(P.encher ?? 0) <= 0} geometry={g.gut} material={m.organs.gut} position={[0, -0.04, -0.08]} scale={[1.6, 1.0, 1.5]} rotation={[Math.PI / 2, 0, 0]} />
            {Array.from({ length: 16 }).map((_, i) => (
              <mesh key={i} geometry={g.sphere} material={m.organs.bone} position={[0, 0.075 - Math.pow((i - 8) / 9, 2) * 0.03, -0.32 + i * 0.03]} scale={[0.012, 0.009, 0.01]} />
            ))}
          </group>
        ) : null}
        {/* leite: gotinhas brotando da pele da barriga */}
        {(P.leite ?? 0) > 0.01
          ? Array.from({ length: 9 }).map((_, i) => {
              const k = clamp01((P.leite ?? 0) * 1.6 - rnd(i, 31) * 0.6);
              const bead = (t * 0.6 + rnd(i, 32)) % 1;
              const x = (rnd(i, 33) - 0.5) * 0.12, z = -0.04 + rnd(i, 34) * 0.1;
              return k > 0 ? (
                <group key={i} position={[x, -0.112 - bead * 0.012 * k, z]}>
                  <mesh geometry={dropGeo()} material={m.milk} scale={0.0055 * k * (0.7 + bead * 0.5)} rotation={[Math.PI, 0, 0]} />
                </group>
              ) : null;
            })
          : null}
        {/* ---------- cabeça ---------- */}
        <group position={[0, 0.035, 0.17]} rotation={[headPitch, headYaw, 0]} scale={headS}>
          <Furry geo={g.head} fur={m.fur} shells={shells} dissolve={dissolve} />
          {rx > 0.02 ? <mesh geometry={g.head} material={glass} renderOrder={5} /> : null}
          {organOp > 0 ? <mesh geometry={g.sphere} material={m.organs.brain} position={[0, 0.03, 0.0]} scale={[0.058, 0.045, 0.068]} /> : null}
          {/* bochechas (marmita) */}
          {cheek > 0.01
            ? ([1, -1] as const).map((s) => (
                <Furry key={s} geo={g.sphere} fur={m.furLeg} shells={Math.round(shells * 0.6)} dissolve={dissolve} position={[0.11 * s, -0.03, 0.085]} scale={[0.07 * (0.35 + 0.75 * cheek), 0.06 * (0.4 + 0.7 * cheek), 0.075 * (0.4 + 0.65 * cheek)]} />
              ))
            : null}
          {/* olhos embutidos; fechar = o olho achata e afunda (o pelo da cabeça cobre) e fica só a dobra */}
          {([1, -1] as const).map((s) => {
            const open = 1 - smooth01(lidC);
            return (
              <group key={s}>
                {open > 0.04 ? (
                  <group position={[(EYE[0] - 0.02 * (1 - open)) * s, EYE[1], EYE[2]]} rotation={[-0.2, 0.75 * s, 0]}>
                    <mesh geometry={g.sphere} material={eyeMat} scale={[EYE_R, EYE_R * (0.15 + 0.85 * open), EYE_R]} />
                    {!useGlassParts && open > 0.6 ? <mesh geometry={g.sphere} material={m.spark} position={[0.0025 * s, 0.006, 0.015]} scale={0.0034} /> : null}
                    {!useGlassParts && open > 0.6 ? <mesh geometry={g.sphere} material={m.spark} position={[-0.004 * s, -0.006, 0.016]} scale={0.0015} /> : null}
                  </group>
                ) : null}
                {!useGlassParts && lidC > 0.5 ? (
                  <mesh geometry={g.sphere} material={m.lid} position={[(EYE_S[0] - 0.001) * s, EYE_S[1], EYE_S[2]]} rotation={[0, 0, EYE_TILT * s]} scale={[0.0022, 0.0015 + 0.001 * (1 - lidC), 0.014]} />
                ) : null}
              </group>
            );
          })}
          {/* ouvidos (aberturas na mesma dobra dos olhos) */}
          {([1, -1] as const).map((s) => (
            <mesh key={s} geometry={g.sphere} material={m.dark} position={[EAR[0] * s, EAR[1], EAR[2]]} rotation={[0, 1.2 * s, 0]} scale={[0.004, 0.016 * (1 - earC) + 0.0005, 0.011]} />
          ))}
          {/* ---------- bico ---------- */}
          {(P.costura ?? 0) > 0 ? <Costura p={P.costura ?? 0} /> : null}
          {(P.cortes ?? 0) > 0 ? <MarcasBico n={Math.round(clamp01(P.cortes ?? 0) * 9)} m={m.dark} /> : null}
          <group position={[0, -0.014 + (P.bicoSolto ?? 0) * 0.12 - (P.bicoLado ?? 0) * 0.13, 0.175 + (P.bicoSolto ?? 0) * 0.38 + (P.bicoLado ?? 0) * 0.34]} rotation={[0.07 - (P.bicoSolto ?? 0) * 0.25, (P.bicoSolto ?? 0) * 0.2, 0]}>
            <mesh geometry={g.billUp} material={billMat} castShadow />
            <Sensores geo={g.billUp} n={26000} seed={41} on={P.sensores ?? 0} t={t} />
            {/* narinas no alto, perto da ponta */}
            {([1, -1] as const).map((s) => (
              <mesh key={s} geometry={g.sphere} material={m.dark} position={[0.02 * s, 0.017, 0.2]} rotation={[0.1, 0.25 * s, 0]} scale={[0.0075 * (1 - noseC * 0.85), 0.0035, 0.011]} />
            ))}
            {organOp > 0
              ? ([1, -1] as const).map((s) => <mesh key={s} geometry={g.sphere} material={m.organs.plate} position={[0.04 * s, -0.004, 0.05]} scale={[0.026, 0.006, 0.042]} />)
              : null}
            <group position={[0, -0.009, 0.0]} rotation={[jaw, 0, 0]}>
              <mesh geometry={g.billLo} material={billUnderMat} castShadow />
              <Sensores geo={g.billLo} n={14000} seed={42} on={P.sensores ?? 0} t={t} />
              {organOp > 0
                ? ([1, -1] as const).map((s) => <mesh key={s} geometry={g.sphere} material={m.organs.plate} position={[0.036 * s, 0.002, 0.05]} scale={[0.022, 0.005, 0.04]} />)
                : null}
            </group>
          </group>
        </group>
        {/* ---------- patas ---------- */}
        {/* deitada de lado (amamentando), as patas ficam recolhidas sob o pelo */}
        {([1, -1] as const).filter(() => (P.deitada ?? 0) <= 0.5).map((s) => (
          <group key={`f${s}`} position={[0.15 * s, -0.065, 0.13]} scale={1 - 0.4 * (P.deitada ?? 0)}>
            <Pata lado={s} tras={false} p={leg(false, s)} m={m} furOn shells={shells} dissolve={dissolve} glass={useGlassParts} esporao={false} veneno={0} brilhoEsporao={0} t={t} />
          </group>
        ))}
        {([1, -1] as const).filter(() => (P.deitada ?? 0) <= 0.5).map((s) => (
          <group key={`h${s}`} position={[0.15 * s, -0.07, -0.24]} scale={1 - 0.4 * (P.deitada ?? 0)}>
            <Pata lado={s} tras p={leg(true, s)} m={m} furOn shells={shells} dissolve={dissolve} glass={useGlassParts} esporao={macho} veneno={P.veneno ?? 0} brilhoEsporao={P.brilhoEsporao ?? 0} t={t} />
          </group>
        ))}
        {/* ---------- rabo de castor ---------- */}
        <group position={[0, 0.0, -0.35]} rotation={[tailPitch, tailYaw, 0]} scale={fil ? 0.75 : 1}>
          <Furry geo={g.tail} fur={m.furTail} shells={Math.round(shells * 0.8)} dissolve={dissolve} />
          {rx > 0.02 ? <mesh geometry={g.tail} material={glass} renderOrder={5} /> : null}
        </group>
        {/* ovinhos entre o rabo e a barriga */}
        {(P.ovos ?? 0) > 0
          ? Array.from({ length: Math.min(2, Math.round(P.ovos ?? 0)) }).map((_, i) => (
              <mesh key={i} geometry={g.sphere} material={m.egg} position={[(i - 0.5) * 0.05, -0.13, -0.2 + i * 0.015]} scale={[0.026, 0.024, 0.032]} rotation={[0.3, i, 0.2]} castShadow />
            ))
          : null}
      </group>
    </group>
  );
};
