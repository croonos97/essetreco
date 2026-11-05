import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { clamp01, MM, rnd, texCanvas, V3 } from "./CupimComum";

// =====================================================================
// CUPIM DE MADEIRA SECA — Cryptotermes brevis (Kalotermitidae). Modelado em MILÍMETROS.
// Referencial local: origem no chão sob o tórax, +z = frente, +y = cima. O grupo raiz aplica scale = MM·escala.
// Castas (aparência conferida em fontes; ver qa/cupim_kit.md):
//  - operario (pseudergate): ~5 mm, corpo creme translúcido (intestino escuro aparece por dentro do abdômen),
//    cabeça amarelada um pouco mais escura, mandíbulas com dentes e pontas escuras, antenas em contas, SEM olhos.
//  - soldado: ~5 mm, corpo amarelo-pálido; cabeça fragmótica (de "rolha"): curta, alta, frente truncada, enrugada,
//    quase preta na frente e marrom-avermelhada atrás; mandíbulas curtas.
//  - rainha: ~9 mm; cabeça e tórax marrons (é uma alada que perdeu as asas: tocos de asa), olhos, abdômen grande
//    com placas marrons separadas por membrana clara.
//  - alado (siriri): ~11 mm com asas; corpo marrom-escuro, olhos; 4 asas iguais, fumê translúcidas, nervura escura na borda da frente.
// Regras anti-piscada: mastigar ≤ 2,5 Hz, antenas ≤ 1,2 Hz, passada sem patinar (dist), asas ≤ 3,5 Hz.
// =====================================================================
export type Casta = "operario" | "soldado" | "rainha" | "alado";
export type CupimProps = {
  t: number;
  casta?: Casta;
  dist?: number; // mm andados (a cena move o bicho na mesma taxa: dist·MM cm)
  andar?: number; // 0..1 intensidade da passada
  mastigar?: number; // 0..1 (ciclo de mandíbulas a 2,4 Hz)
  mandibula?: number; // abertura fixa 0..1 (somada ao ciclo)
  cabeca?: [number, number]; // yaw, pitch (rad)
  antenas?: number; // amplitude da exploração das antenas (padrão 1)
  piso?: (lat: number) => number; // altura do chão (mm) no deslocamento lateral lat (mm) — chão curvo da galeria
  empurrar?: number; // 0..1 cabeça baixa empurrando (grânulo)
  voar?: number; // alado: 0 asas deitadas → 1 abertas
  bater?: number; // alado: 0..1 batida (≤ 3,5 Hz)
  semAsas?: boolean; // alado que já soltou as asas
  soltarAsas?: number; // 0..1: as asas quebram na base, escorregam para trás e ficam deitadas no chão atrás do bicho (no referencial do bicho)
  barriga?: number; // 0..1: abdômen vira vidro e mostra os micróbios (protistas) nadando lá dentro
  soAsas?: boolean; // desenha só as asas (use com soltarAsas=1 para deixar as asas caídas no lugar depois que o bicho sai)
  escala?: number;
  position?: V3;
  rotation?: V3;
  sombra?: boolean;
  naBoca?: React.ReactNode; // preso entre as mandíbulas (espaço mm, origem na ponta)
};

type Forma = {
  comp: number;
  cabC: V3; cabR: V3; cor: { cab: string; cabFrente?: string; torax: string; abd: string; perna: string; mand: string; mandPonta: string };
  pron: V3; pronC: V3;
  abd: { z0: number; comp: number; raio: number; achat: number; y: number; intestino: number; placas: number };
  pernaEsc: number; antN: number; antR: number; mandL: number; olhos: boolean; fragmotica: boolean; asas: boolean;
};
const FORMAS: Record<Casta, Forma> = {
  operario: {
    comp: 5, cabC: [0, 0.58, 1.55], cabR: [0.52, 0.4, 0.58],
    cor: { cab: "#D9B577", torax: "#EBDCB8", abd: "#F1E6CC", perna: "#EFE3C6", mand: "#C79A55", mandPonta: "#2B140A" },
    pron: [0.56, 0.17, 0.33], pronC: [0, 0.6, 0.84],
    abd: { z0: -0.05, comp: 2.75, raio: 0.66, achat: 0.78, y: 0.56, intestino: 0.92, placas: 0.08 },
    pernaEsc: 1, antN: 13, antR: 0.044, mandL: 0.52, olhos: false, fragmotica: false, asas: false,
  },
  soldado: {
    comp: 5, cabC: [0, 0.68, 1.55], cabR: [0.6, 0.5, 0.66],
    cor: { cab: "#7A3518", cabFrente: "#140A05", torax: "#E9D49A", abd: "#F0E2B2", perna: "#EDDFB4", mand: "#4A220E", mandPonta: "#140805" },
    pron: [0.62, 0.17, 0.34], pronC: [0, 0.62, 0.78],
    abd: { z0: -0.05, comp: 2.6, raio: 0.64, achat: 0.78, y: 0.56, intestino: 0.75, placas: 0.08 },
    pernaEsc: 1, antN: 11, antR: 0.042, mandL: 0.42, olhos: false, fragmotica: true, asas: false,
  },
  rainha: {
    comp: 9, cabC: [0, 0.72, 1.75], cabR: [0.6, 0.45, 0.62],
    cor: { cab: "#4A2B17", torax: "#5C3A20", abd: "#EFE0C0", perna: "#B98E5E", mand: "#5A3015", mandPonta: "#1A0C05" },
    pron: [0.64, 0.19, 0.38], pronC: [0, 0.72, 0.95],
    abd: { z0: -0.05, comp: 5.6, raio: 1.08, achat: 0.82, y: 0.95, intestino: 0.2, placas: 1 },
    pernaEsc: 1.2, antN: 16, antR: 0.047, mandL: 0.5, olhos: true, fragmotica: false, asas: false,
  },
  alado: {
    comp: 6, cabC: [0, 0.66, 1.68], cabR: [0.58, 0.44, 0.62],
    cor: { cab: "#3E2414", torax: "#4C2D18", abd: "#6A452A", perna: "#A57A4E", mand: "#4A2810", mandPonta: "#140805" },
    pron: [0.62, 0.18, 0.36], pronC: [0, 0.68, 0.92],
    abd: { z0: -0.05, comp: 3.2, raio: 0.68, achat: 0.8, y: 0.6, intestino: 0, placas: 1 },
    pernaEsc: 1.12, antN: 16, antR: 0.045, mandL: 0.46, olhos: true, fragmotica: false, asas: true,
  },
};
// ponta das mandíbulas (mm, referencial do cupim, cabeça reta) — para a fibra/grânulo
export const pontaMandibula = (casta: Casta = "operario"): V3 => {
  const F = FORMAS[casta];
  return [0, F.cabC[1] - F.cabR[1] * 0.55, F.cabC[2] + F.cabR[2] * 0.85 + F.mandL * 0.95];
};
// ponta das mandíbulas com a pose da cabeça (mm, referencial do cupim): use para prender fibra/grão
export const pontaMandibulaPose = (casta: Casta = "operario", cabeca: [number, number] = [0, 0], empurrar = 0): V3 => {
  const F = FORMAS[casta];
  const pm = pontaMandibula(casta);
  const neck = new THREE.Vector3(0, F.cabC[1] - 0.05, F.cabC[2] - F.cabR[2] * 0.75);
  const v = new THREE.Vector3(...pm).sub(neck).applyEuler(new THREE.Euler(cabeca[1] + clamp01(empurrar) * 0.35, cabeca[0], 0)).add(neck);
  v.y -= clamp01(empurrar) * 0.08;
  return v.toArray() as V3;
};
export const comprimentoCupim = (casta: Casta = "operario") => FORMAS[casta].comp;

// ---------- materiais ----------
// cutícula: brilho de cera (clearcoat) + leve translucidez (emissivo); abdômen com intestino escuro "por dentro"
const cuticula = (cor: string, op: { brilho?: number; trans?: number } = {}) =>
  new THREE.MeshPhysicalMaterial({ color: cor, roughness: 0.42, clearcoat: op.brilho ?? 0.55, clearcoatRoughness: 0.35, sheen: 0.3, sheenColor: new THREE.Color("#FFF6E0"), emissive: new THREE.Color(cor), emissiveIntensity: op.trans ?? 0.12 });
const abdomenMat = (F: Forma, mapa: THREE.Texture) => {
  const m = new THREE.MeshPhysicalMaterial({ color: "#FFFFFF", map: mapa, roughness: 0.45, clearcoat: 0.25, clearcoatRoughness: 0.4, emissive: new THREE.Color(F.cor.abd), emissiveIntensity: F.abd.placas > 0.5 ? 0.05 : 0.22 });
  const amt = F.abd.intestino;
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uGut = { value: new THREE.Color("#4A2C14") };
    sh.uniforms.uAmt = { value: amt };
    sh.vertexShader = "varying float vAx;\n" + sh.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\n vAx = uv.y;");
    sh.fragmentShader =
      "varying float vAx; uniform vec3 uGut; uniform float uAmt;\n" +
      sh.fragmentShader.replace(
        "#include <normal_fragment_maps>",
        `#include <normal_fragment_maps>
        float gutK;
        { float fac = abs(dot(normalize(normal), normalize(vViewPosition)));
          float m = smoothstep(0.08, 0.22, vAx) * (1.0 - smoothstep(0.8, 0.94, vAx)) * (0.8 + 0.2 * sin(vAx * 38.0));
          gutK = uAmt * m * smoothstep(0.2, 0.8, fac);
          diffuseColor.rgb = mix(diffuseColor.rgb, uGut, gutK); }`,
      ).replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\n totalEmissiveRadiance *= 1.0 - 0.85 * gutK;",
      );
  };
  m.customProgramCacheKey = () => "cupAbd" + amt.toFixed(2);
  return m;
};
// textura do abdômen (u em volta, v ao longo; dorso = u 0,5). 10 segmentos.
const texAbd = (casta: Casta) =>
  texCanvas("cupAbd_" + casta, 256, 512, (g, W, H) => {
    const F = FORMAS[casta];
    g.fillStyle = F.cor.abd;
    g.fillRect(0, 0, W, H);
    const placa = casta === "alado" ? "#3C2414" : casta === "rainha" ? "#6A4426" : "#D8C49A";
    for (let k = 0; k < 10; k++) {
      const v0 = (k / 10) * H, v1 = ((k + 1) / 10) * H;
      const gap = casta === "rainha" ? (v1 - v0) * 0.38 : (v1 - v0) * 0.16; // membrana entre placas (rainha: esticada)
      g.globalAlpha = F.abd.placas >= 1 ? 1 : 0.55;
      g.fillStyle = placa;
      // tergito (dorso) e esternito (ventre, mais estreito)
      const larg = casta === "alado" ? 0.95 : 0.62;
      g.fillRect(W * (0.5 - larg / 2), v0 + gap * 0.5, W * larg, v1 - v0 - gap);
      if (F.abd.placas >= 1) {
        g.fillRect(0, v0 + gap * 0.5, W * 0.12, v1 - v0 - gap);
        g.fillRect(W * 0.88, v0 + gap * 0.5, W * 0.12, v1 - v0 - gap);
      }
      g.globalAlpha = 1;
    }
    // pelos/pontos finos
    g.fillStyle = "rgba(90,60,30,0.35)";
    for (let i = 0; i < 220; i++) g.fillRect(rnd(i, 3) * W, rnd(i, 4) * H, 2, 2);
  });

// ---------- geometrias (cache) ----------
let GEO: null | { esf: THREE.SphereGeometry; cap: THREE.CapsuleGeometry; conta: THREE.SphereGeometry } = null;
const geo = () => (GEO ??= { esf: new THREE.SphereGeometry(1, 40, 28), cap: new THREE.CapsuleGeometry(1, 1, 6, 14), conta: new THREE.SphereGeometry(1, 16, 12) });
const abdCache = new Map<string, THREE.LatheGeometry>();
const abdGeo = (F: Forma, key: string) => {
  const hit = abdCache.get(key);
  if (hit) return hit;
  const pts: THREE.Vector2[] = [];
  const N = 90;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    let r = Math.pow(Math.sin(Math.PI * (0.03 + 0.97 * t)), 0.5) * (1 - 0.3 * t * t);
    if (t < 0.06) r *= 0.75 + 0.25 * (t / 0.06);
    const sulco = Math.pow(Math.abs(Math.cos(Math.PI * t * 10)), 24); // constrição entre segmentos
    r *= 1 - 0.07 * sulco;
    pts.push(new THREE.Vector2(Math.max(0.001, r * F.abd.raio), -t * F.abd.comp));
  }
  const g = new THREE.LatheGeometry(pts, 48);
  g.rotateX(Math.PI / 2); // eixo y do torno → z (para trás); dorso = u 0,5
  g.scale(1, F.abd.achat, 1);
  g.computeVertexNormals();
  abdCache.set(key, g);
  return g;
};
// cabeça fragmótica do soldado: elipsoide com a frente truncada e inclinada, rugosa; frente preta → trás avermelhada
let SOLD: THREE.BufferGeometry | null = null;
const cabecaSoldado = (F: Forma) => {
  if (SOLD) return SOLD;
  const g = new THREE.SphereGeometry(1, 72, 48);
  const pos = g.attributes.position as THREE.BufferAttribute;
  const cols = new Float32Array(pos.count * 3);
  const cF = new THREE.Color(F.cor.cabFrente), cT = new THREE.Color(F.cor.cab), c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    // superelipsoide (n = 2,8): cabeça "de caixa", lados quase paralelos (vista de cima retangular)
    const dx = pos.getX(i), dy = pos.getY(i), dz = pos.getZ(i);
    const n = 2.8;
    const k0 = Math.pow(Math.pow(Math.abs(dx), n) + Math.pow(Math.abs(dy), n) + Math.pow(Math.abs(dz), n), 1 / n);
    let x = dx / k0, y = dy / k0, z = dz / k0;
    // face frontal truncada, inclinada (topo recua) e côncava: a "rolha" que tampa a galeria
    const zf = 0.42 - 0.3 * y;
    let frente = 0;
    if (z > zf) {
      frente = 1;
      z = zf + (z - zf) * 0.08 - 0.1 * Math.max(0, 1 - (x * x) / 0.7 - (y * y) / 0.7);
    }
    // rugas fortes na frente, leves atrás
    const rug = (Math.sin(x * 34 + y * 9) * Math.sin(y * 37 - x * 7) * 0.022 + Math.sin(x * 15 + y * 21) * 0.014) * (0.25 + 0.75 * clamp01((z + 0.1) / 0.45));
    const k = 1 + rug;
    pos.setXYZ(i, x * k * F.cabR[0], y * k * F.cabR[1], z * F.cabR[2] + rug * 0.5 * F.cabR[2] * frente);
    c.copy(cT).lerp(cF, clamp01((z + 0.15) / 0.5));
    cols[i * 3] = c.r;
    cols[i * 3 + 1] = c.g;
    cols[i * 3 + 2] = c.b;
  }
  g.setAttribute("color", new THREE.BufferAttribute(cols, 3));
  g.computeVertexNormals();
  SOLD = g;
  return g;
};
// mandíbula (crescente com dentes na borda interna), desenhada para a esquerda (+x), comprimento 1
let MAND: THREE.ExtrudeGeometry | null = null;
const mandGeo = () => {
  if (MAND) return MAND;
  const s = new THREE.Shape();
  s.moveTo(0.12, 0);
  s.bezierCurveTo(0.26, 0.25, 0.26, 0.62, 0.02, 1.0); // borda externa → ponta
  s.lineTo(-0.06, 0.94);
  s.lineTo(0.06, 0.82); // dente apical
  s.lineTo(-0.02, 0.74);
  s.lineTo(0.1, 0.62); // dente
  s.lineTo(0.0, 0.52);
  s.lineTo(0.1, 0.4); // dente
  s.bezierCurveTo(0.03, 0.26, -0.02, 0.12, -0.06, 0.02);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.16, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.03, bevelSegments: 2, curveSegments: 10 });
  g.rotateX(Math.PI / 2); // forma no plano horizontal, ponta para +z
  g.translate(0, 0.08, 0);
  // gradiente base → ponta (cor por vértice)
  const pos = g.attributes.position as THREE.BufferAttribute;
  const col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const k = clamp01((pos.getZ(i) - 0.35) / 0.5);
    col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = 1 - k; // 1 = base (cor), 0 = ponta (escura) — misturado no material
  }
  g.setAttribute("aPonta", new THREE.BufferAttribute(col.filter((_, j) => j % 3 === 0), 1));
  g.computeVertexNormals();
  MAND = g;
  return g;
};
const mandMat = (base: string, ponta: string) => {
  const m = new THREE.MeshPhysicalMaterial({ color: base, roughness: 0.3, clearcoat: 0.8 });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uPonta = { value: new THREE.Color(ponta) };
    sh.vertexShader = "attribute float aPonta; varying float vP;\n" + sh.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\n vP = aPonta;");
    sh.fragmentShader = "varying float vP; uniform vec3 uPonta;\n" + sh.fragmentShader.replace("#include <color_fragment>", "#include <color_fragment>\n diffuseColor.rgb = mix(uPonta, diffuseColor.rgb, vP);");
  };
  m.customProgramCacheKey = () => "cupMand" + base + ponta;
  return m;
};
// asa: elipse alongada com base estreita; textura fumê com nervuras (alpha)
let ASA: THREE.ShapeGeometry | null = null;
const asaGeo = () => {
  if (ASA) return ASA;
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.bezierCurveTo(0.12, 0.05, 0.5, 0.12, 1, 0.1);
  s.bezierCurveTo(1.02, 0.06, 1.02, -0.06, 0.98, -0.1);
  s.bezierCurveTo(0.6, -0.14, 0.15, -0.1, 0, -0.02);
  s.closePath();
  const g = new THREE.ShapeGeometry(s, 24);
  const pos = g.attributes.position as THREE.BufferAttribute, U = g.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) U.setXY(i, pos.getX(i), (pos.getY(i) + 0.15) / 0.3);
  ASA = g;
  return g;
};
const texAsa = () =>
  texCanvas("cupAsa", 512, 128, (g, W, H) => {
    g.clearRect(0, 0, W, H);
    g.fillStyle = "rgba(150,132,110,0.42)";
    g.fillRect(0, 0, W, H);
    // nervura costal escura (borda da frente = v alto) e radiais
    g.strokeStyle = "rgba(60,40,25,0.95)";
    g.lineWidth = 7;
    g.beginPath();
    g.moveTo(0, H * 0.82);
    g.bezierCurveTo(W * 0.4, H * 0.86, W * 0.8, H * 0.86, W, H * 0.8);
    g.stroke();
    g.lineWidth = 3;
    g.strokeStyle = "rgba(70,50,35,0.7)";
    for (const y of [0.68, 0.56]) {
      g.beginPath();
      g.moveTo(0, H * y);
      g.bezierCurveTo(W * 0.4, H * (y + 0.02), W * 0.7, H * (y + 0.04), W * 0.97, H * (y + 0.1));
      g.stroke();
    }
    g.lineWidth = 1.5;
    g.strokeStyle = "rgba(80,60,40,0.45)";
    for (let k = 0; k < 9; k++) {
      g.beginPath();
      g.moveTo(W * (0.1 + k * 0.08), H * 0.55);
      g.quadraticCurveTo(W * (0.16 + k * 0.08), H * 0.35, W * (0.22 + k * 0.085), H * 0.12);
      g.stroke();
    }
  }, true, false);

// ---------- IK de 2 ossos ----------
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3();
export const ik2 = (hip: THREE.Vector3, alvo: THREE.Vector3, l1: number, l2: number, polo: THREE.Vector3) => {
  const d = _a.copy(alvo).sub(hip);
  let L = d.length();
  L = Math.min(L, (l1 + l2) * 0.999);
  L = Math.max(L, Math.abs(l1 - l2) + 1e-3);
  d.normalize();
  const a = (l1 * l1 - l2 * l2 + L * L) / (2 * L);
  const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  const p = _b.copy(polo).sub(d.clone().multiplyScalar(polo.dot(d))).normalize();
  return hip.clone().add(d.clone().multiplyScalar(a)).add(p.multiplyScalar(h));
};
// cápsula entre dois pontos
const _q = new THREE.Quaternion(), _y = new THREE.Vector3(0, 1, 0);
export const Osso: React.FC<{ a: THREE.Vector3; b: THREE.Vector3; r: number; m: THREE.Material; s?: boolean }> = ({ a, b, r, m, s }) => {
  const d = _c.copy(b).sub(a);
  const L = d.length();
  _q.setFromUnitVectors(_y, d.clone().normalize());
  const mid = a.clone().add(b).multiplyScalar(0.5);
  return <mesh geometry={geo().cap} material={m} position={mid} quaternion={_q.clone()} scale={[r, Math.max(0.001, L / 2 - r * 0.5), r]} castShadow={s} />;
};

// ABDÔMEN DE VIDRO com os micróbios do intestino (protistas flagelados), nadando devagar (≤ 0,5 Hz).
// Só uma casca transparente (sem depthWrite) por cima de micróbios opacos: sem erro de ordenação.
export const MICROBIO_CORES = ["#3FD6C6", "#7FE36B", "#B98BFF", "#5BB8FF"];
const BarrigaVidro: React.FC<{ F: Forma; casta: Casta; k: number; t: number }> = ({ F, casta, k, t }) => {
  const ref = useRef<THREE.InstancedMesh>(null);
  const N = 70;
  const vidro = useMemo(() => new THREE.MeshPhysicalMaterial({ color: "#FFF3DC", roughness: 0.15, transparent: true, depthWrite: false, clearcoat: 1, side: THREE.FrontSide }), []);
  vidro.opacity = 1 - 0.72 * clamp01(k);
  const tripa = useMemo(() => new THREE.MeshStandardMaterial({ color: "#8A6038", roughness: 0.7, transparent: true, depthWrite: false }), []);
  tripa.opacity = 0.35 * clamp01(k);
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#FFFFFF", roughness: 0.4, emissive: new THREE.Color("#2A6A60"), emissiveIntensity: 0.6 }), []);
  useLayoutEffect(() => {
    const im = ref.current;
    if (!im) return;
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color();
    const n = Math.round(N * clamp01(k * 1.5));
    for (let i = 0; i < N; i++) {
      const u = 0.18 + 0.64 * rnd(i, 61); // ao longo do abdômen
      const a = rnd(i, 62) * 6.28 + t * (0.25 + 0.2 * rnd(i, 63)) * (i % 2 ? 1 : -1);
      const rr = F.abd.raio * 0.55 * Math.sqrt(rnd(i, 64)) * Math.sin(Math.PI * u);
      const z = F.abd.z0 - 0.05 - u * F.abd.comp + Math.sin(t * 0.4 + i) * 0.05;
      const p = new THREE.Vector3(Math.cos(a) * rr, F.abd.y + Math.sin(a) * rr * F.abd.achat, z);
      q.setFromEuler(new THREE.Euler(rnd(i, 65) * 6.28, a + t * 0.3, rnd(i, 66) * 6.28));
      const sz = 0.05 + 0.04 * rnd(i, 67);
      m4.compose(p, q, i < n ? new THREE.Vector3(sz, sz, sz * 2.6) : new THREE.Vector3(0, 0, 0));
      im.setMatrixAt(i, m4);
      im.setColorAt(i, c.set(MICROBIO_CORES[i % 4]));
    }
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
  });
  return (
    <>
      <instancedMesh ref={ref} args={[geo().esf, mat, N]} frustumCulled={false} />
      <mesh geometry={geo().esf} material={tripa} position={[0, F.abd.y, F.abd.z0 - 0.05 - F.abd.comp * 0.5]} scale={[F.abd.raio * 0.62, F.abd.raio * 0.55, F.abd.comp * 0.36]} renderOrder={8} />
      <mesh geometry={abdGeo(F, casta)} material={vidro} position={[0, F.abd.y, F.abd.z0 - 0.05]} renderOrder={9} />
    </>
  );
};

// cerdas (pelos finos e esparsos) no abdômen: instanced, presas na superfície, inclinadas para trás
const Pelos: React.FC<{ F: Forma; casta: Casta; m: THREE.Material }> = ({ F, casta, m }) => {
  const ref = useRef<THREE.InstancedMesh>(null);
  const N = 90;
  useLayoutEffect(() => {
    const im = ref.current;
    if (!im) return;
    const g = abdGeo(F, casta);
    const P = g.attributes.position as THREE.BufferAttribute, Nn = g.attributes.normal as THREE.BufferAttribute;
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
    for (let i = 0; i < N; i++) {
      const k = Math.floor(rnd(i, 41) * P.count);
      const p = new THREE.Vector3(P.getX(k), P.getY(k) + F.abd.y, P.getZ(k) + F.abd.z0 - 0.05);
      const n = new THREE.Vector3(Nn.getX(k), Nn.getY(k), Nn.getZ(k)).normalize();
      const ax = n.clone().add(new THREE.Vector3(0, 0, -0.9)).normalize();
      const L = 0.1 + rnd(i, 42) * 0.1;
      q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), ax);
      m4.compose(p.addScaledVector(ax, L * 0.45), q, new THREE.Vector3(0.006, L * 0.5, 0.006));
      im.setMatrixAt(i, m4);
    }
    im.instanceMatrix.needsUpdate = true;
    im.computeBoundingSphere();
  }, [F, casta]);
  return <instancedMesh ref={ref} args={[geo().cap, m, N]} renderOrder={4} />;
};

// pernas: ponto de inserção, pé em repouso, fase do tripé
const PERNAS = [
  { ins: [0.26, 0.42, 0.8], pe: [1.0, 0, 1.55], fase: 0, esc: 0.92 },
  { ins: [0.3, 0.4, 0.46], pe: [1.32, 0, 0.42], fase: 0.5, esc: 1 },
  { ins: [0.3, 0.4, 0.13], pe: [1.15, 0, -0.8], fase: 0, esc: 1.12 },
];

export const Cupim: React.FC<CupimProps> = (P) => {
  const casta = P.casta ?? "operario";
  const F = FORMAS[casta];
  const t = P.t;
  const M = useMemo(() => {
    const cab = cuticula(F.cor.cab, { brilho: 0.7, trans: casta === "operario" ? 0.12 : 0.04 });
    const cabSold = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.45, clearcoat: 0.6, clearcoatRoughness: 0.4 });
    const tor = cuticula(F.cor.torax, { trans: casta === "operario" || casta === "soldado" ? 0.14 : 0.04 });
    const perna = cuticula(F.cor.perna, { trans: 0.12, brilho: 0.3 });
    const ant = cuticula(F.cor.perna, { trans: 0.1, brilho: 0.3 });
    const abd = abdomenMat(F, texAbd(casta));
    const mand = mandMat(F.cor.mand, F.cor.mandPonta);
    const olho = new THREE.MeshPhysicalMaterial({ color: "#0C0A0A", roughness: 0.15, clearcoat: 1 });
    const asa = new THREE.MeshStandardMaterial({ map: texAsa(), transparent: true, depthWrite: false, side: THREE.DoubleSide, roughness: 0.3, metalness: 0.1 });
    const toco = cuticula("#3A2414", { brilho: 0.6, trans: 0 });
    const clipeo = cuticula(casta === "soldado" ? "#2A140A" : new THREE.Color(F.cor.cab).lerp(new THREE.Color("#FFF4DC"), 0.45).getStyle(), { brilho: 0.6, trans: 0.1 });
    const pelo = new THREE.MeshStandardMaterial({ color: "#F4EBD6", roughness: 0.6, transparent: true, opacity: 0.75, depthWrite: false });
    return { cab, cabSold, tor, perna, ant, abd, mand, olho, asa, toco, clipeo, pelo };
  }, [casta]);

  // ---- passada (tripé) sem patinar: ciclo de C mm, apoio = metade do ciclo, amplitude A = C/2
  const andar = clamp01(P.andar ?? 0);
  const C = 2.0 * F.pernaEsc, A = C * 0.5 * andar;
  const dist = P.dist ?? 0;
  const piso = P.piso ?? (() => 0);
  const sombra = P.sombra ?? true;
  const lado = [1, -1];
  const pernas: React.ReactNode[] = [];
  const corpoY = 0.04 * andar * Math.sin((dist / C) * Math.PI * 4); // sobe-desce leve
  PERNAS.forEach((L, li) => {
    lado.forEach((sx, si) => {
      const e = L.esc * F.pernaEsc;
      const fase = (((dist / C + L.fase + (si === 1 ? 0.5 : 0)) % 1) + 1) % 1;
      let dz: number, dy: number;
      if (fase < 0.5) {
        dz = A / 2 - (fase / 0.5) * A; // apoio: o pé fica parado no chão
        dy = 0;
      } else {
        const u = (fase - 0.5) / 0.5;
        dz = -A / 2 + u * A;
        dy = Math.sin(u * Math.PI) * 0.28 * andar;
      }
      const ins = new THREE.Vector3(sx * L.ins[0] * (F.pron[0] / 0.56), L.ins[1] * (F.abd.y / 0.56) - corpoY * 0, L.ins[2]);
      const quadril = ins.clone().add(new THREE.Vector3(sx * 0.2 * e, -0.06, 0));
      const peX = sx * L.pe[0] * e;
      const pe = new THREE.Vector3(peX, piso(peX) + dy - corpoY, L.pe[2] * e + dz);
      const dentro = new THREE.Vector3(-sx, 0, 0).multiplyScalar(0.28 * e);
      const tornoz = pe.clone().add(dentro).add(new THREE.Vector3(0, 0.14 * e, 0));
      const lf = 0.78 * e, lt = 0.72 * e;
      const joelho = ik2(quadril, tornoz, lf, lt, new THREE.Vector3(sx * 1.0, 0.75, 0));
      const k = li * 2 + si;
      pernas.push(
        <group key={k}>
          <Osso a={ins} b={quadril} r={0.11 * e} m={M.perna} s={sombra} />
          <Osso a={quadril} b={joelho} r={0.1 * e} m={M.perna} s={sombra} />
          <Osso a={joelho} b={tornoz} r={0.052 * e} m={M.perna} s={sombra} />
          <Osso a={tornoz} b={tornoz.clone().lerp(pe, 0.5)} r={0.04 * e} m={M.perna} s={sombra} />
          <Osso a={tornoz.clone().lerp(pe, 0.5)} b={pe} r={0.034 * e} m={M.perna} s={sombra} />
          <mesh geometry={geo().esf} material={M.mand} position={pe} scale={0.03 * e} />
        </group>,
      );
    });
  });

  // ---- cabeça: yaw/pitch + balanço do mastigar + empurrar
  const mast = clamp01(P.mastigar ?? 0);
  const ciclo = 0.5 - 0.5 * Math.cos(t * Math.PI * 2 * 2.4);
  const abre = clamp01((P.mandibula ?? 0) + mast * ciclo * 0.9);
  const emp = clamp01(P.empurrar ?? 0);
  const [yaw, pitch] = P.cabeca ?? [0, 0];
  const pitchT = pitch + emp * 0.35 + mast * ciclo * 0.06;
  const neck: V3 = [0, F.cabC[1] - 0.05, F.cabC[2] - F.cabR[2] * 0.75];
  const cabLocal: V3 = [0, F.cabC[1] - neck[1], F.cabC[2] - neck[2]];

  // ---- antenas (instanced): exploração lenta
  const antRef = useRef<THREE.InstancedMesh>(null);
  const amp = P.antenas ?? 1;
  useLayoutEffect(() => {
    const im = antRef.current;
    if (!im) return;
    const m4 = new THREE.Matrix4();
    let n = 0;
    for (const sx of [1, -1]) {
      const base = F.fragmotica
        ? new THREE.Vector3(sx * F.cabR[0] * 0.98, cabLocal[1] - F.cabR[1] * 0.05, cabLocal[2] + F.cabR[2] * 0.2)
        : new THREE.Vector3(sx * F.cabR[0] * 0.62, cabLocal[1] + F.cabR[1] * 0.25, cabLocal[2] + F.cabR[2] * 0.62);
      let yawA = sx * (0.55 + 0.25 * amp * Math.sin(t * 2 * Math.PI * 0.55 + (sx > 0 ? 0 : 1.7)));
      let pit = 0.3 + 0.12 * amp * Math.sin(t * 2 * Math.PI * 0.8 + (sx > 0 ? 0.6 : 2.2));
      const p = base.clone();
      for (let i = 0; i < F.antN; i++) {
        const k = i / (F.antN - 1);
        const r = F.antR * (1.15 - 0.35 * k) * (i === 0 ? 1.5 : i === 1 ? 1.15 : 1);
        m4.compose(p, new THREE.Quaternion().setFromEuler(new THREE.Euler(-pit, yawA, 0, "YXZ")), new THREE.Vector3(r, r, r * 1.45));
        im.setMatrixAt(n++, m4);
        const passo = r * 2.75 + (i === 0 ? 0.03 : 0);
        p.add(new THREE.Vector3(Math.sin(yawA) * Math.cos(pit), Math.sin(pit), Math.cos(yawA) * Math.cos(pit)).multiplyScalar(passo));
        pit -= 0.028 + 0.02 * amp * Math.sin(t * 2 * Math.PI * 1.1 + i * 0.4 + sx);
        yawA += sx * 0.02 * Math.sin(t * 2 * Math.PI * 0.9 + i * 0.3);
      }
    }
    im.count = n;
    im.instanceMatrix.needsUpdate = true;
    im.computeBoundingSphere();
  });

  // ---- asas (alado)
  const voar = clamp01(P.voar ?? 0);
  const bat = (P.bater ?? 0) * Math.sin(t * Math.PI * 2 * 3.2) * 0.6;
  const asas: React.ReactNode[] = [];
  const sol = clamp01(P.soltarAsas ?? 0);
  if (F.asas && !P.semAsas) {
    const Lw = 8.2;
    [
      { z: 0.62, y: 0.86, ord: 31, ab: 0.06 },
      { z: 0.3, y: 0.83, ord: 30, ab: -0.04 },
    ].forEach((w, wi) =>
      [1, -1].forEach((sx) => {
        // repouso: deitadas sobre o abdômen, apontando para trás, um pouco para o lado; voo: abertas para o lado
        const yawR = Math.PI + sx * (0.08 + w.ab * 0.5); // para trás
        const yawV = sx * (Math.PI / 2 + (wi === 0 ? -0.25 : 0.1));
        const yawW = yawR + (yawV - yawR) * voar;
        const rollW = -voar * (0.12 + bat);
        asas.push(
          <group
            key={wi + "_" + sx}
            // soltar: a asa recua 3–4 mm e desce até o chão, abrindo um pouco para o lado (fica deitada atrás do bicho)
            position={[sx * (0.18 + sol * (0.5 + wi * 0.35)), (w.y + (wi === 0 ? 0.035 : 0) + (sx > 0 ? 0.012 : 0)) * (1 - sol) + sol * (0.02 + wi * 0.012 + (sx > 0 ? 0.006 : 0)), w.z - sol * (3.2 + wi * 0.8)]}
            rotation={[0, yawW + sol * sx * (0.25 + wi * 0.15), 0]}>
            <group rotation={[rollW, 0, 0]}>
              <mesh geometry={asaGeo()} material={M.asa} rotation={[-Math.PI / 2, 0, -Math.PI / 2]} scale={[Lw, Lw * (sx > 0 ? 1 : -1), 1]} renderOrder={w.ord} />
            </group>
          </group>,
        );
      }),
    );
  }

  const esc = (P.escala ?? 1) * MM;
  const ponta = pontaMandibula(casta);
  if (P.soAsas)
    return (
      <group position={P.position} rotation={P.rotation} scale={esc}>
        {asas}
      </group>
    );
  return (
    <group position={P.position} rotation={P.rotation} scale={esc}>
      <group position={[0, corpoY - emp * 0.08, 0]}>
        {/* tórax: pronoto (escudo), meso e metanoto, ventre */}
        <mesh geometry={geo().esf} material={M.tor} position={[F.pronC[0], F.pronC[1], F.pronC[2]]} scale={F.pron} castShadow={sombra} />
        <mesh geometry={geo().esf} material={M.tor} position={[0, F.pronC[1] - 0.04, F.pronC[2] - 0.4]} scale={[F.pron[0] * 0.82, F.pron[1] * 0.95, 0.24]} castShadow={sombra} />
        <mesh geometry={geo().esf} material={M.tor} position={[0, F.pronC[1] - 0.06, F.pronC[2] - 0.74]} scale={[F.pron[0] * 0.86, F.pron[1] * 0.95, 0.24]} castShadow={sombra} />
        <mesh geometry={geo().esf} material={M.tor} position={[0, F.pronC[1] - 0.2, F.pronC[2] - 0.4]} scale={[0.34, 0.22, 0.62]} />
        {casta === "rainha" ? (
          // tocos de asa (escamas) no meso e metanoto
          [1, -1].flatMap((sx) => [0.4, 0.74].map((dz, j) => <mesh key={sx + "_" + j} geometry={geo().esf} material={M.toco} position={[sx * F.pron[0] * 0.7, F.pronC[1] + 0.05, F.pronC[2] - dz - 0.08]} scale={[0.22, 0.05, 0.16]} rotation={[0, sx * 0.5, 0]} />))
        ) : null}
        {/* abdômen */}
        {(P.barriga ?? 0) > 0.001 ? (
          <BarrigaVidro F={F} casta={casta} k={P.barriga ?? 0} t={t} />
        ) : (
          <mesh geometry={abdGeo(F, casta)} material={M.abd} position={[0, F.abd.y, F.abd.z0 - 0.05]} castShadow={sombra} />
        )}
        <Pelos F={F} casta={casta} m={M.pelo} />
        {/* cercos */}
        {[1, -1].map((sx) => (
          <mesh key={sx} geometry={geo().cap} material={M.perna} position={[sx * 0.14, F.abd.y + 0.02, F.abd.z0 - F.abd.comp - 0.02]} rotation={[-1.2, 0, sx * 0.4]} scale={[0.035, 0.09, 0.035]} />
        ))}
        {/* cabeça (pescoço articulado) */}
        <group position={neck} rotation={[pitchT, yaw, 0]}>
          {F.fragmotica ? (
            <mesh geometry={cabecaSoldado(F)} material={M.cabSold} position={cabLocal} castShadow={sombra} />
          ) : (
            <mesh geometry={geo().esf} material={M.cab} position={cabLocal} scale={F.cabR} castShadow={sombra} />
          )}
          {/* clípeo (faixa clara na frente da cabeça) e labro (lábio de cima, cobre a base das mandíbulas) */}
          {F.fragmotica ? null : (
            <>
              <mesh geometry={geo().esf} material={M.clipeo} position={[0, cabLocal[1] - F.cabR[1] * 0.18, cabLocal[2] + F.cabR[2] * 0.8]} scale={[F.cabR[0] * 0.5, F.cabR[1] * 0.32, F.cabR[2] * 0.3]} />
              <mesh geometry={geo().esf} material={M.clipeo} position={[0, cabLocal[1] - F.cabR[1] * 0.42, cabLocal[2] + F.cabR[2] * 0.98]} scale={[F.cabR[0] * 0.36, F.cabR[1] * 0.14, F.cabR[2] * 0.26]} />
            </>
          )}
          {/* mandíbulas */}
          {[1, -1].map((sx) => (
            <group key={sx} position={[sx * F.cabR[0] * 0.36, cabLocal[1] - F.cabR[1] * 0.5, cabLocal[2] + F.cabR[2] * 0.8]} rotation={[0, sx * (0.12 + 0.55 * abre), 0]}>
              <mesh geometry={mandGeo()} material={M.mand} scale={[sx * F.mandL, F.mandL * 0.9, F.mandL]} castShadow={sombra} />
            </group>
          ))}
          {/* olhos (só reprodutores) */}
          {F.olhos
            ? [1, -1].map((sx) => <mesh key={sx} geometry={geo().esf} material={M.olho} position={[sx * F.cabR[0] * 0.86, cabLocal[1] + F.cabR[1] * 0.05, cabLocal[2] + F.cabR[2] * 0.25]} scale={[0.1, 0.17, 0.2]} />)
            : null}
          <instancedMesh ref={antRef} args={[geo().conta, M.ant, F.antN * 2]} castShadow={sombra} frustumCulled={false} />
          {P.naBoca ? <group position={[ponta[0], ponta[1] - neck[1], ponta[2] - neck[2]]}>{P.naBoca}</group> : null}
        </group>
        {asas}
      </group>
      {pernas}
    </group>
  );
};
