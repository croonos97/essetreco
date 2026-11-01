import { useMemo } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { Clouds, fbm, rnd, SkyDome } from "../World";
import { clamp01, mix, V3 } from "./comum";
import { Inst, Spot, spread, tuftGeo } from "./vegetacao";
import { Lasca, Pedra } from "./MacacoObjetos";

// =====================================================================
// Cenários do macaco-prego (escala do kit, 1 un ≈ 0,5 m).
// - SerraCapivara: laje de arenito vermelho em (0,0,0), paredões ao fundo (−z), caatinga verde-acinzentada.
// - MataAtlantica: chão de folhas, troncos altos, cipós, luz verde filtrada; GALHO_BANDO (macacos) e
//   GALHO_GAVIAO (pouso do gavião-real).
// - GaviaoReal (voando/pousado), Arqueologo, Escavacao (quadrícula de barbante), CorteEstrato, VitrineLasca.
// =====================================================================
const paint = (g: THREE.BufferGeometry, c: string, jitter = 0.12, seed = 1) => {
  const ng = g.index ? g.toNonIndexed() : g;
  const n = ng.attributes.position.count;
  const col = new Float32Array(n * 3);
  const base = new THREE.Color(c);
  for (let i = 0; i < n; i++) {
    const cc = base.clone();
    cc.offsetHSL(0, 0, (rnd(Math.floor(i / 3), seed) - 0.5) * jitter);
    col.set([cc.r, cc.g, cc.b], i * 3);
  }
  ng.setAttribute("color", new THREE.BufferAttribute(col, 3));
  for (const k of Object.keys(ng.attributes)) if (!["position", "normal", "color"].includes(k)) ng.deleteAttribute(k);
  ng.computeVertexNormals();
  return ng;
};
const MATS = new Map<string, THREE.Material>();
const vc = (k: string, o: THREE.MeshStandardMaterialParameters = {}) => (MATS.has(k) ? MATS.get(k)! : (MATS.set(k, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, flatShading: true, ...o })), MATS.get(k)!));
const std = (k: string, o: THREE.MeshStandardMaterialParameters) => (MATS.has(k) ? MATS.get(k)! : (MATS.set(k, new THREE.MeshStandardMaterial(o)), MATS.get(k)!));
const GEO = new Map<string, THREE.BufferGeometry>();
const once = (k: string, f: () => THREE.BufferGeometry) => (GEO.has(k) ? GEO.get(k)! : (GEO.set(k, f()), GEO.get(k)!));
const SPH = new THREE.SphereGeometry(1, 20, 14);
const CYL = new THREE.CylinderGeometry(1, 1, 1, 12, 1);
const CONE = new THREE.ConeGeometry(1, 1, 10);

// ---------------------------------------------------------------- SERRA DA CAPIVARA
export const serraAltura = (x: number, z: number) => {
  const r = Math.hypot(x, z * 1.2);
  const flat = clamp01((r - 2.6) / 6);
  return (fbm(x * 0.12 + 3, z * 0.12) - 0.5) * 0.5 * flat + Math.pow(Math.max(0, r - 14) / 40, 1.5) * 6;
};
const serraChao = () =>
  once("serraChao", () => {
    const g = new THREE.PlaneGeometry(2, 2, 150, 150);
    g.rotateX(-Math.PI / 2);
    const p = g.attributes.position as THREE.BufferAttribute;
    const col = new Float32Array(p.count * 3);
    const A = new THREE.Color("#C98A5B"), B = new THREE.Color("#B06A40"), C = new THREE.Color("#A99A68"), D = new THREE.Color("#D7A574");
    for (let i = 0; i < p.count; i++) {
      const u = p.getX(i), v = p.getZ(i);
      const x = Math.sign(u) * Math.pow(Math.abs(u), 2.2) * 160, z = Math.sign(v) * Math.pow(Math.abs(v), 2.2) * 160;
      p.setXYZ(i, x, serraAltura(x, z), z);
      const n1 = fbm(x * 0.2, z * 0.2), n2 = fbm(x * 0.9 + 4, z * 0.9);
      const c = A.clone().lerp(B, clamp01((n1 - 0.45) * 3)).lerp(C, clamp01((n2 - 0.55) * 2.5) * 0.7).lerp(D, clamp01((0.35 - n1) * 3));
      col.set([c.r, c.g, c.b], i * 3);
    }
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    g.computeVertexNormals();
    return g;
  });
// paredão de arenito: bloco alto com faixas horizontais avermelhadas e fendas verticais
const paredaoGeo = (seed: number) =>
  once(`paredao${seed}`, () => {
    const g = new THREE.BoxGeometry(1, 1, 1, 10, 16, 6);
    const p = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const lay = Math.floor((y + 0.5) * 9);
      const dx = (rnd(lay, seed) - 0.5) * 0.06 + Math.sin(y * 20 + seed) * 0.01;
      const top = y > 0.45 ? (rnd(Math.round(x * 30) + seed, 7) - 0.5) * 0.05 : 0;
      p.setXYZ(i, x * (1 + dx) + (z > 0.4 ? Math.sin(x * 37 + seed) * 0.012 : 0), y + top, z * (1 + dx * 0.6));
    }
    g.translate(0, 0.5, 0);
    const ng = g.toNonIndexed();
    const q = ng.attributes.position as THREE.BufferAttribute;
    const col = new Float32Array(q.count * 3);
    const bands = ["#B4532F", "#C9774A", "#D9A070", "#A24A2A", "#C26A3E", "#E0B07E", "#9E4426"].map((c) => new THREE.Color(c));
    for (let i = 0; i < q.count; i += 3) {
      const y = (q.getY(i) + q.getY(i + 1) + q.getY(i + 2)) / 3;
      const x = (q.getX(i) + q.getX(i + 1) + q.getX(i + 2)) / 3;
      const c = bands[Math.floor(y * 11 + rnd(Math.floor(x * 6), seed) * 1.5) % bands.length].clone();
      if (Math.abs(Math.sin(x * 23 + seed)) > 0.93) c.multiplyScalar(0.72); // fendas escuras
      c.offsetHSL(0, 0, (rnd(i, seed + 3) - 0.5) * 0.06);
      for (let k = 0; k < 3; k++) col.set([c.r, c.g, c.b], (i + k) * 3);
    }
    ng.setAttribute("color", new THREE.BufferAttribute(col, 3));
    ng.computeVertexNormals();
    return ng;
  });
// arbusto da caatinga (galhos finos + copa cinza-esverdeada em bolotas)
const caatingaGeo = (variant: number) =>
  once(`caat${variant}`, () => {
    const parts: THREE.BufferGeometry[] = [];
    const trunk = new THREE.CylinderGeometry(0.035, 0.06, 1.1, 6);
    trunk.translate(0, 0.55, 0);
    parts.push(paint(trunk, "#6E5A48", 0.1, variant));
    for (let k = 0; k < 3; k++) {
      const b = new THREE.CylinderGeometry(0.018, 0.03, 0.6, 5);
      b.translate(0, 0.3, 0);
      b.rotateZ((k - 1) * 0.7 + 0.2);
      b.translate(0, 0.8, 0);
      parts.push(paint(b, "#6E5A48", 0.1, variant + k));
    }
    const cols = variant % 2 ? ["#8E9A6A", "#A3A578", "#7C8A5C"] : ["#9AA27A", "#B2AE84", "#86926A"];
    for (let k = 0; k < 6; k++) {
      const s = new THREE.IcosahedronGeometry(0.32 + rnd(k, variant) * 0.2, 0);
      s.scale(1, 0.7, 1);
      s.translate((rnd(k, variant + 1) - 0.5) * 0.9, 1.15 + rnd(k, variant + 2) * 0.45, (rnd(k, variant + 3) - 0.5) * 0.8);
      parts.push(paint(s, cols[k % 3], 0.16, variant + 9 + k));
    }
    return mergeGeometries(parts)!;
  });
// mandacaru (cacto colunar com braços)
const mandacaruGeo = () =>
  once("mandacaru", () => {
    const parts: THREE.BufferGeometry[] = [];
    const col = (h: number, r: number) => {
      const c = new THREE.CylinderGeometry(r, r * 1.05, h, 8, 3);
      c.translate(0, h / 2, 0);
      return c;
    };
    parts.push(paint(col(2.6, 0.13), "#557F48", 0.12, 3));
    for (const [y, s] of [[1.0, 1], [1.5, -1]] as const) {
      const a = col(0.35, 0.1);
      a.rotateZ(-s * Math.PI / 2);
      a.translate(s * 0.17, y, 0);
      parts.push(paint(a, "#557F48", 0.12, 4));
      const b = col(0.9, 0.1);
      b.translate(s * 0.34, y, 0);
      parts.push(paint(b, "#4E7642", 0.12, 5));
    }
    return mergeGeometries(parts)!;
  });

export const LAJE_TOPO = 0.07;
// material do chão com um buraco retangular opcional (para a escavação aparecer)
const chaoMat = (b?: [number, number, number, number]) => {
  const k = b ? `chaoB${b.join(",")}` : "serraChao";
  if (MATS.has(k)) return MATS.get(k)!;
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92 });
  if (b) {
    m.onBeforeCompile = (sh) => {
      sh.vertexShader = "varying vec3 vWP;\n" + sh.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\n vWP = (modelMatrix * vec4(position, 1.0)).xyz;");
      sh.fragmentShader = "varying vec3 vWP;\n" + sh.fragmentShader.replace("#include <clipping_planes_fragment>", `#include <clipping_planes_fragment>\n if (vWP.x > ${b[0].toFixed(3)} && vWP.x < ${b[2].toFixed(3)} && vWP.z > ${b[1].toFixed(3)} && vWP.z < ${b[3].toFixed(3)}) discard;`);
    };
    m.customProgramCacheKey = () => k;
  }
  MATS.set(k, m);
  return m;
};
export const SerraCapivara: React.FC<{ t: number; livre?: { x: number; z: number; r: number }[]; luz?: "dia" | "tarde"; laje?: boolean; buraco?: [number, number, number, number] }> = ({ t, livre = [], luz = "dia", laje = true, buraco }) => {
  const sp = useMemo(() => {
    const ok = (r0: number) => (x: number, z: number) => Math.hypot(x, z) > r0 && !livre.some((l) => Math.hypot(x - l.x, z - l.z) < l.r);
    return {
      caat: spread(90, 301, { x0: -40, x1: 40, z0: -40, z1: 25 }, serraAltura, ok(3.2), 0.7, 1.5),
      cact: spread(14, 302, { x0: -30, x1: 30, z0: -30, z1: 10 }, serraAltura, ok(4), 0.8, 1.3),
      tuft: spread(900, 303, { x0: -12, x1: 12, z0: -12, z1: 12 }, serraAltura, ok(1.4), 0.6, 1.2),
      rock: spread(40, 304, { x0: -14, x1: 14, z0: -14, z1: 10 }, serraAltura, ok(1.8), 0.4, 1.4),
    };
  }, [JSON.stringify(livre)]); // eslint-disable-line
  const paredoes = useMemo(
    () =>
      Array.from({ length: 9 }).map((_, i) => {
        const a = -Math.PI / 2 + (i - 4) * 0.33 + (rnd(i, 311) - 0.5) * 0.15;
        const r = 26 + rnd(i, 312) * 18;
        return { x: Math.cos(a) * r, z: Math.sin(a) * r, w: 10 + rnd(i, 313) * 10, h: 7 + rnd(i, 314) * 9, d: 6 + rnd(i, 315) * 5, ry: -a + Math.PI / 2 + (rnd(i, 316) - 0.5) * 0.4, seed: i };
      }),
    [],
  );
  const tarde = luz === "tarde";
  return (
    <group>
      <fog attach="fog" args={[tarde ? "#F0C9A0" : "#E8D9C3", 30, 220]} />
      <SkyDome top={tarde ? "#5E86C9" : "#3E8FD6"} horizon={tarde ? "#F4C58F" : "#E9DCC6"} bottom={tarde ? "#F4C58F" : "#E9DCC6"} />
      <mesh geometry={serraChao()} material={chaoMat(buraco)} receiveShadow />
      {laje ? (
        <mesh position={[0, LAJE_TOPO / 2 - 0.02, 0]} receiveShadow castShadow>
          <boxGeometry args={[2.5, LAJE_TOPO + 0.04, 2.2, 1, 1, 1]} />
          <meshStandardMaterial color="#B86A41" roughness={0.95} />
        </mesh>
      ) : null}
      {paredoes.map((p, i) => (
        <mesh key={i} geometry={paredaoGeo(p.seed)} material={vc("paredao")} position={[p.x, serraAltura(p.x, p.z) - 0.5, p.z]} rotation={[0, p.ry, 0]} scale={[p.w, p.h, p.d]} castShadow receiveShadow />
      ))}
      <Inst geo={caatingaGeo(1)} spots={sp.caat.filter((_, i) => i % 2)} material={vc("caat")} />
      <Inst geo={caatingaGeo(2)} spots={sp.caat.filter((_, i) => !(i % 2))} material={vc("caat")} />
      <Inst geo={mandacaruGeo()} spots={sp.cact} material={vc("cact")} />
      <Inst geo={tuftGeo()} spots={sp.tuft} material={std("tuftC", { roughness: 0.9, side: THREE.DoubleSide })} castShadow={false} color={(s) => (s.k < 0.4 ? "#C8B57A" : s.k < 0.8 ? "#A9A06A" : "#8E9660")} />
      <Inst geo={once("pedrinha", () => new THREE.DodecahedronGeometry(0.18, 0))} spots={sp.rock} material={std("pedrinha", { color: "#A9603C", roughness: 0.95, flatShading: true })} />
      <Clouds t={t} n={10} height={60} spread={200} center={[0, -150]} />
    </group>
  );
};

// ---------------------------------------------------------------- MATA ATLÂNTICA
export const GALHO_BANDO: V3 = [0, 3.0, 0]; // galho horizontal (eixo x), raio 0,13
export const GALHO_GAVIAO: V3 = [0.6, 6.4, -1.2]; // galho mais alto
const arvoreGeo = (v: number) =>
  once(`arv${v}`, () => {
    const parts: THREE.BufferGeometry[] = [];
    const h = 16 + v * 3;
    const tr = new THREE.CylinderGeometry(0.28, 0.42, h, 9, 4);
    tr.translate(0, h / 2, 0);
    parts.push(paint(tr, v % 2 ? "#6B5A46" : "#7A6A55", 0.14, v));
    for (let k = 0; k < 4; k++) {
      const b = new THREE.BoxGeometry(0.08, 1.2, 0.9);
      b.translate(0, 0.6, 0.45);
      b.rotateY((k / 4) * Math.PI * 2 + v);
      parts.push(paint(b, "#6B5A46", 0.1, v + k)); // sapopemas
    }
    const greens = ["#3F7A3A", "#4E8C3E", "#2F6431", "#5C9A45"];
    for (let k = 0; k < 9; k++) {
      const s = new THREE.IcosahedronGeometry(1.6 + rnd(k, v) * 1.6, 0);
      s.scale(1, 0.55, 1);
      s.translate((rnd(k, v + 1) - 0.5) * 5, h - 1 + rnd(k, v + 2) * 2.5, (rnd(k, v + 3) - 0.5) * 5);
      parts.push(paint(s, greens[k % 4], 0.18, v + 20 + k));
    }
    return mergeGeometries(parts)!;
  });
const cipoGeo = (seed: number) =>
  once(`cipo${seed}`, () => {
    const pts = Array.from({ length: 8 }).map((_, i) => new THREE.Vector3(Math.sin(i * 0.9 + seed) * 0.3, 14 - i * 1.9, Math.cos(i * 0.7 + seed) * 0.2));
    return paint(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.035, 5), "#4F5A33", 0.1, seed);
  });
const folhagemGeo = () =>
  once("folhagem", () => {
    const parts: THREE.BufferGeometry[] = [];
    for (let k = 0; k < 7; k++) {
      const s = new THREE.Shape();
      s.moveTo(0, 0);
      s.quadraticCurveTo(0.22, 0.45, 0, 1.1);
      s.quadraticCurveTo(-0.22, 0.45, 0, 0);
      const g = new THREE.ShapeGeometry(s, 3);
      g.rotateX(-0.5);
      g.rotateY((k / 7) * Math.PI * 2);
      parts.push(paint(g, k % 2 ? "#3E7D3C" : "#5A9A47", 0.15, k));
    }
    return mergeGeometries(parts)!;
  });
export const MataAtlantica: React.FC<{ t: number; livre?: { x: number; z: number; r: number }[] }> = ({ t, livre = [] }) => {
  const sp = useMemo(() => {
    const ok = (r0: number) => (x: number, z: number) => Math.hypot(x, z + 2) > r0 && !livre.some((l) => Math.hypot(x - l.x, z - l.z) < l.r);
    return {
      arv: spread(46, 401, { x0: -30, x1: 30, z0: -40, z1: 8 }, () => 0, (x, z) => ok(3.5)(x, z) && !(z > -3.2 && Math.abs(x) < 5), 0.8, 1.3),
      cipo: spread(26, 402, { x0: -12, x1: 12, z0: -16, z1: 2 }, () => 0, ok(1.5), 0.7, 1.1),
      folha: spread(140, 403, { x0: -14, x1: 14, z0: -16, z1: 6 }, () => 0, ok(1.0), 0.6, 1.6),
    };
  }, [JSON.stringify(livre)]); // eslint-disable-line
  return (
    <group>
      <fog attach="fog" args={["#A9C79B", 6, 60]} />
      <SkyDome top="#BFE0B8" horizon="#A9C79B" bottom="#5F7A4E" />
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[200, 200]} />
        <meshStandardMaterial color="#5B4B33" roughness={1} />
      </mesh>
      <Inst geo={arvoreGeo(0)} spots={sp.arv.filter((_, i) => i % 2)} material={vc("arv")} />
      <Inst geo={arvoreGeo(1)} spots={sp.arv.filter((_, i) => !(i % 2))} material={vc("arv")} />
      <Inst geo={cipoGeo(1)} spots={sp.cipo} material={vc("cipo", { flatShading: false })} sway={{ t, amp: 0.02 }} />
      <Inst geo={folhagemGeo()} spots={sp.folha} material={vc("folhag", { side: THREE.DoubleSide })} castShadow={false} />
      {/* árvore principal com os dois galhos da cena */}
      <group position={[-1.6, 0, -0.6]}>
        <mesh position={[0, 8, 0]} castShadow>
          <cylinderGeometry args={[0.32, 0.45, 16, 12]} />
          <meshStandardMaterial color="#6E5C47" roughness={0.95} flatShading />
        </mesh>
      </group>
      <mesh position={[GALHO_BANDO[0] - 0.4, GALHO_BANDO[1], GALHO_BANDO[2]]} rotation={[0, 0, Math.PI / 2 + 0.06]} castShadow receiveShadow>
        <cylinderGeometry args={[0.1, 0.16, 5.2, 10]} />
        <meshStandardMaterial color="#6E5C47" roughness={0.95} flatShading />
      </mesh>
      <mesh position={[GALHO_GAVIAO[0] - 1.0, GALHO_GAVIAO[1] - 0.12, GALHO_GAVIAO[2]]} rotation={[0, 0.25, Math.PI / 2 - 0.1]} castShadow>
        <cylinderGeometry args={[0.08, 0.13, 3.6, 10]} />
        <meshStandardMaterial color="#6E5C47" roughness={0.95} flatShading />
      </mesh>
      {/* feixes de luz filtrada */}
      {[[-3, -4], [2.5, -6], [5, -2]].map(([x, z], i) => (
        <mesh key={i} position={[x, 7, z]} rotation={[0.25, 0, 0.3]}>
          <cylinderGeometry args={[0.5, 1.6, 16, 12, 1, true]} />
          <meshBasicMaterial color="#F6FFD8" transparent opacity={0.07} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  );
};

// ---------------------------------------------------------------- GAVIÃO-REAL (harpia)
// ≈ 1 m de altura pousado (2 un). Origem = pés (pousado) ou centro do corpo (voando). Frente = +z.
// voar 1 = asas abertas batendo; crista 0..1 levanta os dois topetes; silhueta = tudo escuro (gavião genérico ao longe)
const stripeTex = (a: string, b: string, n: number) => {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 256;
  const g = c.getContext("2d")!;
  for (let i = 0; i < n; i++) {
    g.fillStyle = i % 2 ? a : b;
    g.fillRect(0, (i / n) * 256, 64, 256 / n + 1);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
};
export const GaviaoReal: React.FC<{ t: number; voar?: number; crista?: number; cabeca?: [number, number]; silhueta?: boolean; bater?: number; position?: V3; rotation?: V3; scale?: number }> = ({ t, voar = 0, crista = 1, cabeca = [0, 0], silhueta = false, bater = 1, position, rotation, scale = 1 }) => {
  const M = useMemo(() => {
    const s = (c: string, o: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.75, ...o });
    if (silhueta) {
      const d = s("#2A2C30");
      return { cinza: d, escuro: d, dorso: d, branco: d, calca: d, bico: d, pe: d, olho: d, iris: d, asa: d, asaB: d, rabo: d };
    }
    return {
      cinza: s("#A3A8AC"),
      escuro: s("#2F3236"),
      // costas cinza-ardósia (não preto): o preto fica só na faixa do peito e na crista; corpo todo preto + barriga branca = pinguim
      dorso: s("#5A6068"),
      calca: new THREE.MeshStandardMaterial({ map: stripeTex("#F1EFE8", "#8C8E92", 7), roughness: 0.8 }),
      branco: s("#F1EFE8"),
      bico: s("#1C1C1E", { roughness: 0.3 }),
      pe: s("#E2AE3A", { roughness: 0.5 }),
      olho: s("#120E0A", { roughness: 0.05 }),
      iris: s("#D9C28A", { roughness: 0.15 }),
      asa: new THREE.MeshStandardMaterial({ map: stripeTex("#3A3E44", "#55595F", 9), roughness: 0.8, side: THREE.DoubleSide }),
      asaB: new THREE.MeshStandardMaterial({ map: stripeTex("#D9D6CE", "#7E8186", 9), roughness: 0.8, side: THREE.DoubleSide }),
      rabo: new THREE.MeshStandardMaterial({ map: stripeTex("#3A3E44", "#C9C7C0", 7), roughness: 0.8, side: THREE.DoubleSide }),
    };
  }, [silhueta]);
  const wing = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(0, 0.12);
    s.lineTo(1.3, 0.22);
    // dedos das primárias
    for (let k = 0; k < 6; k++) {
      const x = 1.3 + k * 0.12;
      s.lineTo(x + 0.1, 0.05 - k * 0.07);
      s.lineTo(x + 0.02, -0.02 - k * 0.07);
    }
    s.lineTo(1.25, -0.5);
    s.quadraticCurveTo(0.6, -0.62, 0, -0.35);
    s.lineTo(0, 0.12);
    const g = new THREE.ShapeGeometry(s, 6);
    g.rotateX(-Math.PI / 2); // plano xz, envergadura em +x, frente em +z
    return g;
  }, []);
  const fly = clamp01(voar);
  const flap = (Math.sin(t * 5.2) * 0.55 * bater + (1 - bater) * 0.12) * fly;
  const fold = 1 - fly;
  const cr = Math.max(0.75, clamp01(crista));
  return (
    <group position={position} rotation={rotation} scale={scale}>
      {/* pousado: corpo de pé; voando: corpo deitado */}
      <group position={[0, mix(1.0, 0, fly), 0]} rotation={[mix(-0.8, 0.05, fly), 0, 0]}>
        {/* corpo: costas cinza-escuro, barriga branca, faixa preta larga no peito */}
        <mesh geometry={SPH} material={M.dorso} scale={[0.31, 0.28, 0.58]} castShadow />
        <mesh geometry={SPH} material={M.branco} position={[0, -0.09, -0.02]} scale={[0.27, 0.22, 0.54]} />
        <mesh geometry={SPH} material={M.escuro} position={[0, -0.02, 0.32]} scale={[0.33, 0.29, 0.2]} />
        {/* rabo listrado, chato, saindo para trás (pousado: aponta para baixo, atrás do corpo) */}
        <mesh geometry={SPH} material={M.rabo} position={[0, mix(0.1, 0.2, fly), mix(-0.78, -0.62, fly)]} rotation={[mix(0.15, 0.35, fly), 0, 0]} scale={[mix(0.17, 0.2, fly), 0.06, mix(0.5, 0.42, fly)]} castShadow />
        {/* asas: abertas batendo (voando) ou fechadas como capa escura colada nas costas (pousado) */}
        {fly > 0.5
          ? ([1, -1] as const).map((s) => (
              <group key={s} position={[s * 0.25, 0.08, 0.1]} rotation={[0, 0, s * flap]} scale={[s * (0.55 + 0.45 * fly), 1, 1]}>
                <mesh geometry={wing} material={M.asa} castShadow />
                <mesh geometry={wing} material={M.asaB} position={[0, -0.004, 0]} />
              </group>
            ))
          : null}
        {fold >= 0.5
          ? ([1, -1] as const).map((s) => (
              <group key={s}>
                {/* asa dobrada: longa, listrada, ponta passando do corpo por cima do rabo (silhueta de rapina) */}
                <mesh geometry={SPH} material={M.dorso} position={[s * 0.27, 0.07, -0.12]} rotation={[0.05, s * 0.1, s * 0.15]} scale={[0.12, 0.27, 0.6]} castShadow />
                <mesh geometry={SPH} material={M.asa} position={[s * 0.3, 0.05, -0.38]} rotation={[0.1, s * 0.08, s * 0.2]} scale={[0.07, 0.2, 0.5]} />
              </group>
            ))
          : null}
        {/* cabeça: cinza, bico preto em gancho, sobrancelha escura (cara de predador) e crista dupla preta */}
        <group position={[0, 0.18, 0.5]} rotation={[mix(0.8, 0, fly) - 0.1 + cabeca[1], cabeca[0], 0]} scale={1.3}>
          <mesh geometry={SPH} material={M.cinza} scale={[0.19, 0.2, 0.21]} castShadow />
          <mesh geometry={SPH} material={M.escuro} position={[0, -0.05, -0.08]} scale={[0.2, 0.17, 0.17]} />
          {([1, -1] as const).map((s) => (
            <group key={s}>
              <mesh geometry={SPH} material={M.iris} position={[s * 0.08, 0.035, 0.155]} scale={[0.032, 0.03, 0.025]} />
              <mesh geometry={SPH} material={M.olho} position={[s * 0.082, 0.035, 0.172]} scale={[0.016, 0.016, 0.012]} />
              {/* pálpebra/sobrancelha reta e baixa, ponta de dentro mais baixa: cara de bravo */}
              <mesh geometry={SPH} material={M.escuro} position={[s * 0.075, 0.062, 0.16]} rotation={[0.25, 0, s * 0.28]} scale={[0.065, 0.017, 0.04]} />
            </group>
          ))}
          <mesh geometry={SPH} material={M.cinza} position={[0, 0.0, 0.17]} scale={[0.06, 0.055, 0.06]} />
          <group position={[0, 0.0, 0.2]} rotation={[0.15, 0, 0]}>
            <mesh geometry={CONE} material={M.bico} position={[0, 0.0, 0.085]} rotation={[Math.PI / 2, 0, 0]} scale={[0.062, 0.2, 0.075]} castShadow />
            {/* gancho */}
            <mesh geometry={CONE} material={M.bico} position={[0, -0.05, 0.17]} rotation={[Math.PI, 0, 0]} scale={[0.032, 0.09, 0.038]} />
          </group>
          {/* crista dupla: dois leques de penas pretas compridas que levantam com `crista` */}
          {([1, -1] as const).map((s) => (
            <group key={s} position={[s * 0.07, 0.13, -0.05]} rotation={[-0.9 + cr * 0.75, 0, s * (0.15 + cr * 0.35)]}>
              {[0, 1, 2, 3].map((k) => (
                <mesh key={k} geometry={CONE} material={M.escuro} position={[s * k * 0.018, 0.13, -k * 0.02]} rotation={[0, 0, s * (k - 1.5) * 0.12]} scale={[0.03, 0.27 - k * 0.03, 0.012]} />
              ))}
            </group>
          ))}
        </group>
        {/* pernas: "calça" de penas brancas + pé amarelo grosso com garras pretas */}
        {([1, -1] as const).map((s) => (
          <group key={s} position={[s * 0.13, -0.2, mix(-0.3, -0.05, fly)]} rotation={[mix(0.8, 1.4, fly), 0, 0]}>
            <mesh geometry={SPH} material={M.calca} position={[0, -0.12, 0]} scale={[0.1, 0.17, 0.1]} />
            <mesh geometry={CYL} material={M.pe} position={[0, -0.3, 0]} scale={[0.055, 0.16, 0.055]} />
            {[-1, 0, 1].map((k) => (
              <group key={k} position={[k * 0.045, -0.38, 0.04]} rotation={[mix(-1.4, 0.2, fly) - 0.2, k * 0.35, 0]}>
                <mesh geometry={CYL} material={M.pe} position={[0, 0.0, 0.05]} rotation={[Math.PI / 2, 0, 0]} scale={[0.022, 0.1, 0.022]} />
                <mesh geometry={CONE} material={M.bico} position={[0, -0.02, 0.11]} rotation={[2.4, 0, 0]} scale={[0.016, 0.07, 0.016]} />
              </group>
            ))}
            <mesh geometry={CONE} material={M.bico} position={[0, -0.4, -0.06]} rotation={[-2.4, 0, 0]} scale={[0.016, 0.07, 0.016]} />
          </group>
        ))}
      </group>
    </group>
  );
};

// ---------------------------------------------------------------- ARQUEOLOGIA
// Arqueólogo low-poly (≈ 1,75 m = 3,5 un de pé). ajoelhar 0..1; pincel = braço varrendo; rosto neutro e genérico.
export const Arqueologo: React.FC<{ t: number; ajoelhar?: number; pincel?: number; camisa?: string; pele?: string; position?: V3; rotation?: V3; scale?: number }> = ({ t, ajoelhar = 1, pincel = 1, camisa = "#C9B28A", pele = "#C68E62", position, rotation, scale = 1 }) => {
  const k = clamp01(ajoelhar);
  const sw = Math.sin(t * 7) * 0.35 * pincel;
  const M = useMemo(
    () => ({
      camisa: std(`cam${camisa}`, { color: camisa, roughness: 0.85 }),
      calca: std("calca", { color: "#6E6A5A", roughness: 0.9 }),
      pele: std(`pele${pele}`, { color: pele, roughness: 0.7 }),
      chapeu: std("chapeu", { color: "#D9C9A0", roughness: 0.85 }),
      bota: std("bota", { color: "#4A3A2C", roughness: 0.8 }),
      pincel: std("pincel", { color: "#B5833F", roughness: 0.6 }),
    }),
    [camisa, pele],
  );
  const hipY = mix(1.8, 0.9, k);
  return (
    <group position={position} rotation={rotation} scale={scale}>
      {/* pernas (ajoelhado: coxas para a frente, canelas no chão) */}
      {([1, -1] as const).map((s) => (
        <group key={s} position={[s * 0.2, hipY, 0]} rotation={[mix(0, -1.3, k), 0, 0]}>
          <mesh geometry={CYL} material={M.calca} position={[0, -0.45, 0]} scale={[0.15, 0.9, 0.15]} castShadow />
          <group position={[0, -0.9, 0]} rotation={[mix(0, 1.35, k), 0, 0]}>
            <mesh geometry={CYL} material={M.calca} position={[0, -0.42, 0]} scale={[0.13, 0.84, 0.13]} castShadow />
            <mesh geometry={SPH} material={M.bota} position={[0, -0.86, 0.08]} scale={[0.13, 0.1, 0.2]} />
          </group>
        </group>
      ))}
      {/* tronco inclinado para a frente */}
      <group position={[0, hipY, 0]} rotation={[mix(0.1, 0.6, k), 0, 0]}>
        <mesh geometry={CYL} material={M.camisa} position={[0, 0.55, 0]} scale={[0.36, 1.1, 0.26]} castShadow />
        <mesh geometry={SPH} material={M.camisa} position={[0, 1.1, 0]} scale={[0.4, 0.18, 0.28]} />
        <group position={[0, 1.42, 0.02]} rotation={[0.2, 0, 0]}>
          <mesh geometry={SPH} material={M.pele} scale={[0.22, 0.26, 0.23]} castShadow />
          <mesh geometry={CYL} material={M.chapeu} position={[0, 0.2, 0]} scale={[0.25, 0.16, 0.25]} />
          <mesh geometry={CYL} material={M.chapeu} position={[0, 0.13, 0]} scale={[0.42, 0.025, 0.42]} castShadow />
        </group>
        {/* braço direito com pincel varrendo; esquerdo apoiado */}
        <group position={[-0.42, 1.05, 0]} rotation={[-1.0 + sw * 0.4, 0, 0.2 + sw * 0.3]}>
          <mesh geometry={CYL} material={M.camisa} position={[0, -0.32, 0]} scale={[0.1, 0.64, 0.1]} />
          <group position={[0, -0.64, 0]} rotation={[-0.5, 0, 0]}>
            <mesh geometry={CYL} material={M.pele} position={[0, -0.28, 0]} scale={[0.08, 0.56, 0.08]} />
            <mesh geometry={CYL} material={M.pincel} position={[0, -0.6, 0.05]} rotation={[0.4, 0, 0]} scale={[0.03, 0.3, 0.03]} />
            <mesh geometry={CYL} material={M.chapeu} position={[0, -0.78, 0.12]} rotation={[0.4, 0, 0]} scale={[0.06, 0.1, 0.03]} />
          </group>
        </group>
        <group position={[0.42, 1.05, 0]} rotation={[-0.9, 0, -0.15]}>
          <mesh geometry={CYL} material={M.camisa} position={[0, -0.32, 0]} scale={[0.1, 0.64, 0.1]} />
          <mesh geometry={CYL} material={M.pele} position={[0, -0.9, 0.05]} rotation={[-0.4, 0, 0]} scale={[0.08, 0.56, 0.08]} />
        </group>
      </group>
    </group>
  );
};

const ACHADOS = [
  { x: -0.6, z: 0.3, lasca: false, seed: 5, ry: 0.4 },
  { x: 0.35, z: -0.45, lasca: true, seed: 2, ry: 1.1 },
  { x: 0.7, z: 0.4, lasca: false, seed: 8, ry: 2.0 },
  { x: -0.15, z: -0.1, lasca: true, seed: 4, ry: 2.6 },
  { x: -0.75, z: -0.55, lasca: true, seed: 6, ry: 0.2 },
];
// escavação: cova retangular com camadas na parede, quadrícula de barbante e estacas. Origem = centro da boca da cova.
export const Escavacao: React.FC<{ largura?: number; fundo?: number; profundidade?: number; achados?: number; position?: V3 }> = ({ largura = 2.4, fundo = 1.8, profundidade = 0.7, achados = 1, position }) => {
  const W = largura, D = fundo, H = profundidade;
  const layers = ["#B5683F", "#9C5534", "#C9874F", "#7E4A2E", "#A86E46"];
  const terraMat = std("terraMonte", { color: "#8C5234", roughness: 1, flatShading: true });
  return (
    <group position={position}>
      {/* paredes com faixas (lado interno) */}
      {([[0, -D / 2, 0], [0, D / 2, Math.PI], [-W / 2, 0, Math.PI / 2], [W / 2, 0, -Math.PI / 2]] as const).map(([x, z, ry], i) =>
        layers.map((c, j) => (
          <mesh key={`${i}${j}`} position={[x, -((j + 0.5) / layers.length) * H, z]} rotation={[0, ry, 0]}>
            <planeGeometry args={[i < 2 ? W : D, H / layers.length + 0.002]} />
            <meshStandardMaterial color={c} roughness={1} side={THREE.DoubleSide} />
          </mesh>
        )),
      )}
      <mesh position={[0, -H, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[W, D]} />
        <meshStandardMaterial color="#8C5234" roughness={1} />
      </mesh>
      {/* pedras-martelo e lascas antigas (o MESMO modelo das do macaco) no fundo: cada uma começa coberta por um montinho
          de terra que o pincel vai baixando (a terra some de cima dela; a pedra não se mexe nem cresce) */}
      {ACHADOS.map((f, i) => {
        const r = clamp01(achados * ACHADOS.length - i);
        const p: V3 = [f.x * W * 0.42, -H, f.z * D * 0.42];
        return (
          <group key={i} position={p}>
            {f.lasca ? <Lasca seed={f.seed} position={[0, 0.03, 0]} rotation={[Math.PI / 2, f.ry, 0]} scale={2.2} brilho={0.25 * r} /> : <Pedra seed={f.seed} position={[0, 0.06, 0]} rotation={[0, f.ry, 0]} scale={1.4} brilho={0.2 * r} />}
            {r < 0.999 ? <mesh geometry={SPH} material={terraMat} position={[0, 0.0, 0]} scale={[0.2, 0.16 * (1 - r) + 0.001, 0.18]} castShadow receiveShadow /> : null}
          </group>
        );
      })}
      {/* estacas + barbante em quadrícula */}
      {[-W / 2, 0, W / 2].map((x) =>
        [-D / 2, D / 2].map((z) => (
          <mesh key={`${x}${z}`} position={[x, 0.15, z]} castShadow>
            <boxGeometry args={[0.05, 0.4, 0.05]} />
            <meshStandardMaterial color="#C9A276" />
          </mesh>
        )),
      )}
      {[-W / 2, -W / 4, 0, W / 4, W / 2].map((x, i) => (
        <mesh key={`x${i}`} position={[x, 0.3, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.008, 0.008, D, 4]} />
          <meshBasicMaterial color="#FFFFFF" />
        </mesh>
      ))}
      {[-D / 2, 0, D / 2].map((z, i) => (
        <mesh key={`z${i}`} position={[0, 0.3, z]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.008, 0.008, W, 4]} />
          <meshBasicMaterial color="#FFFFFF" />
        </mesh>
      ))}
    </group>
  );
};

// corte estratigráfico (diorama): bloco de terra em camadas com pedras-martelo acesas em cada camada antiga.
// Face do corte em z = 0 (câmera em z > 0). Topo em y = 0. acender 0..1 acende as pedras de baixo para cima.
export const CorteEstrato: React.FC<{ acender?: number; position?: V3 }> = ({ acender = 1, position }) => {
  const layers = [
    { h: 0.35, c: "#C98A5B" },
    { h: 0.45, c: "#A8613C" },
    { h: 0.4, c: "#C9874F" },
    { h: 0.5, c: "#8E5234" },
    { h: 0.45, c: "#B57247" },
  ];
  let y = 0;
  return (
    <group position={position}>
      {layers.map((l, i) => {
        const y0 = y;
        y -= l.h;
        const lit = clamp01(acender * (layers.length + 1) - (layers.length - i));
        return (
          <group key={i}>
            <mesh position={[0, (y0 + y) / 2, -1.5]} receiveShadow>
              <boxGeometry args={[6, l.h, 3]} />
              <meshStandardMaterial color={l.c} roughness={1} />
            </mesh>
            {i > 0
              ? [0, 1].map((k) =>
                  (i + k) % 2 ? (
                    <Lasca key={k} seed={((i * 2 + k) % 6) + 1} position={[-1.6 + k * 2.1 + rnd(i, 601 + k) * 0.8, (y0 + y) / 2, 0.01]} rotation={[0, 0, rnd(i, 605 + k) * 3]} scale={3.2} brilho={0.1 + 1.0 * lit} />
                  ) : (
                    <Pedra key={k} seed={((i * 3 + k) % 7) + 1} position={[-1.6 + k * 2.1 + rnd(i, 601 + k) * 0.8, (y0 + y) / 2, 0.0]} rotation={[0.3, rnd(i, 607 + k) * 3, 0]} scale={1.7} cor="#857B6B" brilho={0.05 + 0.55 * lit} />
                  ),
                )
              : null}
          </group>
        );
      })}
    </group>
  );
};

// vitrine de museu com etiqueta (canvas) e a lasca da humanidade; a etiqueta pode girar e cair (cair 0..1)
const labelTex = (texto: string) => {
  // 2048 px + mipmaps + anisotropia: o texto não "ferve" (treme) quando a câmera se aproxima devagar
  const c = document.createElement("canvas");
  c.width = 2048;
  c.height = 640;
  const g = c.getContext("2d")!;
  g.fillStyle = "#F7F2E6";
  g.fillRect(0, 0, 2048, 640);
  g.strokeStyle = "#2A2A2A";
  g.lineWidth = 24;
  g.strokeRect(32, 32, 1984, 576);
  g.fillStyle = "#1E1E1E";
  let fs = 208;
  do {
    g.font = `800 ${fs}px 'MontserratET', 'Baloo 2', sans-serif`;
    fs -= 8;
  } while (g.measureText(texto).width > 1760 && fs > 72);
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(texto, 1024, 328);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.anisotropy = 16;
  return t;
};
export const VITRINE_M_TOPO: V3 = [0, 1.6, 0];
export const VitrineMuseu: React.FC<{ etiqueta?: string; cair?: number; children?: React.ReactNode; position?: V3; vidro?: boolean }> = ({ etiqueta = "FERRAMENTA HUMANA", cair = 0, children, position, vidro = true }) => {
  const tex = useMemo(() => (etiqueta ? labelTex(etiqueta) : null), [etiqueta]);
  const k = clamp01(cair);
  return (
    <group position={position}>
      <color attach="background" args={["#5E6878"]} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[40, 40]} />
        <meshStandardMaterial color="#5A4A3C" roughness={0.6} />
      </mesh>
      <mesh position={[0, 4, -4]}>
        <planeGeometry args={[40, 8]} />
        <meshStandardMaterial color="#6E7889" roughness={1} />
      </mesh>
      <mesh position={[0, VITRINE_M_TOPO[1] / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.8, VITRINE_M_TOPO[1], 1.2]} />
        <meshStandardMaterial color="#EDE7DA" roughness={0.8} />
      </mesh>
      <mesh position={[0, VITRINE_M_TOPO[1] + 0.01, 0]} receiveShadow>
        <boxGeometry args={[1.7, 0.02, 1.1]} />
        <meshStandardMaterial color="#2F3E5C" roughness={0.9} />
      </mesh>
      {vidro ? (
        <mesh position={[0, VITRINE_M_TOPO[1] + 0.5, 0]} renderOrder={8}>
          <boxGeometry args={[1.76, 1.0, 1.16]} />
          <meshStandardMaterial color="#DDF2FF" transparent opacity={0.1} roughness={0.05} depthWrite={false} />
        </mesh>
      ) : null}
      {/* etiqueta em pé na frente da peça: gira e tomba com `cair` */}
      <group visible={!!tex} position={[0.04, VITRINE_M_TOPO[1] + 0.02, 0.33]} rotation={[-k * 1.45, 0, k * 0.5]}>
        <mesh position={[0, 0.055, 0]}>
          <planeGeometry args={[0.34, 0.106]} />
          <meshStandardMaterial map={tex ?? undefined} roughness={0.7} />
        </mesh>
      </group>
      {children}
      <spotLight position={[0, 5, 2]} angle={0.5} penumbra={0.6} intensity={22} distance={12} decay={1.4} color="#FFF4DD" castShadow />
    </group>
  );
};
