import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { perfilGeo, PKey, useEnv } from "./comum";
import { Amostra, catmull, clamp01, CM, escreveTubo, mix, novoTubo, ortoU, rnd, sm, texCanvas, V3, vidroRaioX } from "./LagartixaComum";

// =====================================================================
// LAGARTIXA-DE-PAREDE (Hemidactylus mabouia) — kit do vídeo "Você dá o rabo para sobreviver".
// Modelada em CENTÍMETROS (raiz com scale = CM → kit 1 un = 0,5 m). Adulta = 12 cm (5,6 cm de corpo + 6,4 cm de rabo).
// Referencial local: chão/parede/teto = plano y = 0; costas = +y; FRENTE = +z; cloaca em z = 0; focinho em z ≈ +5,6.
// Para pôr na parede/teto use `rotation={noPlano(normal, frente)}` (LagartixaComum).
// Coluna = cadeia de 19 segmentos: 5 do tronco (0,8 cm) + 14 do rabo (0,457 cm, "anéis" 0…13).
// `s` = comprimento de arco a partir do pescoço (s = 0) — cloaca em s = 4,0; ponta do rabo em s = 10,4.
// "Anel k" = plano de quebra no MEIO da vértebra k do rabo (s = 4 + (k + 0,5)·0,457). Anéis 0–4 não têm linha de quebra.
// =====================================================================
export const TRONCO = 4.0;
export const N_TR = 5;
export const N_RB = 14;
export const L_TR = TRONCO / N_TR;
export const L_RB = 6.4 / N_RB;
export const S_FIM = TRONCO + 6.4;
export const Y0 = 0.5;
export const sAnel = (k: number) => TRONCO + (k + 0.5) * L_RB;
const LENS = [...Array(N_TR).fill(L_TR), ...Array(N_RB).fill(L_RB)] as number[];
const S_J = LENS.reduce<number[]>((a, l) => (a.push(a[a.length - 1] + l), a), [0]); // s de cada junta (20)

export type RaioX = {
  ate: number; // 0..1 — até onde a barra de raio-x já passou no rabo (da base para a ponta)
  tracejados?: number; // quantos tracejados amarelos acesos (0..9; contam a partir do anel 5)
  musculo?: number; // 0..1 contração do músculo em volta do anel `quebraAnel`
  quebraAnel?: number;
  quebra?: number; // 0..1 o osso parte na linha (abre uma fresta)
  opac?: number;
  falha?: number; // 0..1 tracejado que tenta acender no cano regenerado (vermelho apagando)
  semMusculo?: boolean; // esconde os feixes de músculo (comparação osso × cano)
};
export type Regen = { anel: number; comp?: number; fita?: number }; // comp = cm regenerados (padrão: o que faltava); fita 0..1
export type Soltar = { anel: number; afastar?: number; pedaco?: boolean; tSolta?: number; amp?: number };
export type LagartixaProps = {
  t: number;
  dist?: number; // cm andados (fase da passada, sem patinar)
  andar?: number; // 0 parada … 1 andando
  correr?: number; // 0..1 postura de corrida (corpo mais alto, passada maior, mais ondulação)
  cabeca?: [number, number, number?]; // yaw (+ = esquerda dela), pitch (+ = olha para cima), roll
  boca?: number;
  lingua?: number;
  curva?: number; // curva lateral do corpo (rad no total)
  rabo?: number; // balanço vivo do rabo (0..1)
  raboCurva?: number; // curva fixa do rabo (rad no total)
  raboErguer?: number; // ponta do rabo levantada (rad)
  soltar?: Soltar;
  regen?: Regen;
  raioX?: RaioX;
  filhote?: boolean;
  escala?: number; // multiplica o tamanho (filhote usa 0,5)
  naBoca?: React.ReactNode; // objeto preso na ponta da boca (espaço da cabeça, cm)
  sombra?: boolean;
  marca?: { anel: number; op: number }; // anel amarelo aceso no ponto de quebra (aviso antes de soltar)
  position?: V3;
  rotation?: V3;
};
export const BOCA_PONTA: V3 = [0, -0.06, 1.5];

// ---------- perfil do corpo (meia-largura, alto, baixo) ----------
const PK: [number, number, number, number][] = [
  [-0.6, 0.36, 0.27, 0.2],
  [0.0, 0.4, 0.3, 0.22],
  [0.7, 0.58, 0.32, 0.24],
  [1.8, 0.72, 0.33, 0.25],
  [3.0, 0.68, 0.32, 0.24],
  [3.8, 0.52, 0.29, 0.23],
  [4.3, 0.41, 0.29, 0.24],
  [5.0, 0.34, 0.25, 0.21],
];
const perfil = (s: number): [number, number, number] => {
  if (s >= 5.0) {
    const u = clamp01((s - 5.0) / (S_FIM - 5.0));
    const k = Math.pow(1 - u, 0.85);
    return [0.34 * k + 0.018, 0.25 * k + 0.018, 0.21 * k + 0.018];
  }
  let i = 0;
  while (i < PK.length - 2 && PK[i + 1][0] < s) i++;
  const a = PK[i], b = PK[i + 1];
  const p = sm((s - a[0]) / (b[0] - a[0]));
  return [mix(a[1], b[1], p), mix(a[2], b[2], p), mix(a[3], b[3], p)];
};

// ---------- cadeia (coluna) ----------
type Cadeia = { P: THREE.Vector3[]; D: THREE.Vector3[]; U: THREE.Vector3[]; lens: number[]; s0: number };
const rot = (v: THREE.Vector3, ax: THREE.Vector3, a: number) => v.clone().applyAxisAngle(ax, a);
const cadeiaDe = (p0: THREE.Vector3, d0: THREE.Vector3, u0: THREE.Vector3, lens: number[], yaw: number[], pitch: number[], s0: number, apoio?: (s: number) => number | null): Cadeia => {
  const P = [p0.clone()], D: THREE.Vector3[] = [], U: THREE.Vector3[] = [];
  let d = d0.clone().normalize(), u = ortoU(u0, d);
  let s = s0;
  for (let i = 0; i < lens.length; i++) {
    d = rot(d, u, yaw[i] ?? 0);
    const side = new THREE.Vector3().crossVectors(d, u).normalize();
    d = rot(d, side, pitch[i] ?? 0);
    s += lens[i];
    const alvo = apoio ? apoio(s) : null;
    if (alvo !== null && alvo !== undefined) {
      const dy = THREE.MathUtils.clamp((alvo - P[i].y) / lens[i], -0.95, 0.95);
      const hz = new THREE.Vector3(d.x, 0, d.z);
      if (hz.lengthSq() > 1e-6) {
        hz.normalize().multiplyScalar(Math.sqrt(1 - dy * dy));
        d = new THREE.Vector3(hz.x, dy, hz.z);
      }
    }
    u = ortoU(u, d);
    D.push(d.clone());
    U.push(u.clone());
    P.push(P[i].clone().addScaledVector(d, lens[i]));
  }
  return { P, D, U, lens, s0 };
};
// amostra a cadeia no comprimento de arco s (global)
const _a = new THREE.Vector3(), _b = new THREE.Vector3();
const quadroEm = (c: Cadeia, s: number) => {
  const n = c.lens.length;
  let sl = s - c.s0;
  if (sl <= 0) {
    // extrapola para a frente (dentro da cabeça)
    return { p: c.P[0].clone().addScaledVector(c.D[0], sl), d: c.D[0].clone(), u: c.U[0].clone() };
  }
  let i = 0;
  while (i < n - 1 && sl > c.lens[i]) {
    sl -= c.lens[i];
    i++;
  }
  const f = clamp01(sl / c.lens[i]);
  const P = c.P;
  const p0 = i > 0 ? P[i - 1] : P[0].clone().multiplyScalar(2).sub(P[1]);
  const p3 = i + 2 <= n ? P[i + 2] : P[n].clone().multiplyScalar(2).sub(P[n - 1]);
  const p = catmull(p0, P[i], P[i + 1], p3, f);
  catmull(p0, P[i], P[i + 1], p3, Math.min(1, f + 0.02), _a);
  catmull(p0, P[i], P[i + 1], p3, Math.max(0, f - 0.02), _b);
  const d = _a.clone().sub(_b);
  if (d.lengthSq() < 1e-12) d.copy(c.D[i]);
  d.normalize();
  const uA = i > 0 ? c.U[i - 1].clone().add(c.U[i]) : c.U[i].clone();
  const uB = i + 1 < n ? c.U[i].clone().add(c.U[i + 1]) : c.U[i].clone();
  const u = ortoU(uA.normalize().lerp(uB.normalize(), f), d);
  return { p, d, u };
};

// ---------- ângulos da coluna a partir das props ----------
export type Pose = { yaw: number[]; pitch: number[]; fase: number; Y: number };
const passo = (P: LagartixaProps) => 1.9 + 2.6 * (P.correr ?? 0); // passada maior na corrida: mantém ≤ 3,5 passos/s
const pose = (P: LagartixaProps): Pose => {
  const t = P.t;
  const andar = clamp01(P.andar ?? 0), cor = clamp01(P.correr ?? 0);
  const fase = (P.dist ?? 0) / passo(P);
  const yaw: number[] = [], pitch: number[] = [];
  const und = (0.07 + 0.07 * cor) * andar;
  const curva = P.curva ?? 0;
  for (let i = 0; i < N_TR; i++) {
    const w = i === 0 ? 0.3 : 1;
    yaw.push(w * (curva / N_TR + und * Math.sin(2 * Math.PI * fase) * (i < 3 ? 1 : -0.4)));
    pitch.push(0);
  }
  const vivo = P.rabo ?? 0.25;
  for (let k = 0; k < N_RB; k++) {
    const u = k / (N_RB - 1);
    // ondulação lenta (≤ 1,2 Hz) + contrabalanço da passada
    const onda = vivo * 0.09 * Math.sin(t * 2 * Math.PI * 0.55 - k * 0.55) * (0.3 + u);
    const passada = -und * 0.9 * Math.sin(2 * Math.PI * fase - 0.8 - k * 0.25);
    yaw.push((P.raboCurva ?? 0) / N_RB + onda + passada);
    pitch.push(k > N_RB - 5 ? (P.raboErguer ?? 0) / 4 : 0);
  }
  return { yaw, pitch, fase, Y: Y0 + 0.12 * cor };
};

// ---------- pele (textura procedural) ----------
const pele = (filhote: boolean) =>
  texCanvas(`lagPele${filhote}`, 512, 1024, (g, W, H) => {
    const img = g.createImageData(W, H);
    const dors = new THREE.Color(filhote ? "#C9C1B2" : "#A39A8A"), dorsC = new THREE.Color(filhote ? "#DDD6C8" : "#BDB3A1"), barr = new THREE.Color("#EEE8DC"), esc = new THREE.Color(filhote ? "#2E2822" : "#544A3F"), cla = new THREE.Color("#DDD4C4");
    const c = new THREE.Color();
    const nz = (x: number, y: number, f: number, k: number) => {
      const xi = Math.floor(x * f), yi = Math.floor(y * f);
      return rnd(xi * 131 + yi * 7, k);
    };
    for (let y = 0; y < H; y++) {
      const s = (y / H) * S_FIM;
      for (let x = 0; x < W; x++) {
        const u = x / W;
        const ang = -Math.PI / 2 + 2 * Math.PI * u;
        const top = Math.sin(ang); // 1 = costas, -1 = barriga
        const lat = Math.cos(ang); // lado
        const dorsal = sm((top + 0.25) / 0.9);
        c.copy(barr).lerp(dors, dorsal);
        c.lerp(dorsC, dorsal * 0.35 * nz(u * 3, s * 0.8, 6, 3));
        // manchinhas finas
        const m = nz(u, s / S_FIM, 90, 1) * 0.6 + nz(u, s / S_FIM, 37, 2) * 0.4;
        c.multiplyScalar(1 + (m - 0.5) * 0.18 * dorsal);
        // faixas em W no tronco (escuras com margem clara atrás)
        if (s > 0.2 && s < 4.2 && top > -0.35) {
          const bandas = [0.45, 1.25, 2.05, 2.85, 3.65];
          for (const b of bandas) {
            const sc = b + 0.22 * Math.abs(lat) - 0.1 * Math.cos(lat * 10) + (nz(u, s, 40, 9) - 0.5) * 0.05;
            const dd = s - sc;
            const forte = sm((top - 0.0) / 0.55) * (filhote ? 1 : 0.75) * (0.75 + 0.25 * Math.cos(lat * 7.0));
            if (dd > -0.13 && dd < 0.05) c.lerp(esc, forte * sm((dd + 0.13) / 0.05) * (0.82 + 0.18 * m));
            else if (dd >= 0.05 && dd < 0.16) c.lerp(cla, forte * 0.55);
          }
        }
        // risca escura do lado do pescoço
        if (s < 0.9 && Math.abs(Math.abs(lat) - 0.8) < 0.12 && top > -0.2) c.lerp(esc, 0.5 * (1 - s / 0.9));
        // rabo tigrado: faixas escuras a cada ~0,5 cm (somem na barriga)
        if (s > 4.1) {
          const ph = ((s - 4.1) / 0.5) % 1;
          const forte = sm((top + 0.45) / 0.55) * (filhote ? 1 : 0.9);
          if (ph < 0.38) c.lerp(esc, forte * sm(Math.sin((ph / 0.38) * Math.PI) * 1.6) * 0.9);
          else if (ph < 0.5) c.lerp(cla, forte * 0.4);
        }
        const k = (y * W + x) * 4;
        img.data[k] = Math.round(clamp01(c.r) * 255);
        img.data[k + 1] = Math.round(clamp01(c.g) * 255);
        img.data[k + 2] = Math.round(clamp01(c.b) * 255);
        img.data[k + 3] = 255;
      }
    }
    // converte de linear (THREE.Color) para sRGB do canvas
    for (let i = 0; i < img.data.length; i += 4)
      for (let j = 0; j < 3; j++) img.data[i + j] = Math.round(255 * Math.pow(img.data[i + j] / 255, 1 / 2.2));
    g.putImageData(img, 0, 0);
  }, true, true, false);
// escamas granulares (bump)
const relevo = () =>
  texCanvas("lagBump", 512, 1024, (g, W, H) => {
    const img = g.createImageData(W, H);
    const NU = 96, NS = 300;
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const a = (x / W) * NU, b = (y / H) * NS + (Math.floor((x / W) * NU) % 2) * 0.5;
        const fa = a - Math.floor(a) - 0.5, fb = b - Math.floor(b) - 0.5;
        const d = Math.sqrt(fa * fa + fb * fb) * 2;
        const v = Math.max(0, 1 - d * d) * 0.8 + 0.2 * rnd(Math.floor(a) * 977 + Math.floor(b), 4);
        const k = (y * W + x) * 4;
        img.data[k] = img.data[k + 1] = img.data[k + 2] = Math.round(70 + v * 150);
        img.data[k + 3] = 255;
      }
    g.putImageData(img, 0, 0);
  }, false, true, false);
const cabecaTex = (filhote: boolean) =>
  texCanvas(`lagCab${filhote}`, 256, 256, (g, W, H) => {
    const img = g.createImageData(W, H);
    const dors = new THREE.Color("#A39A8A"), barr = new THREE.Color("#EEE8DC"), esc = new THREE.Color("#4F463B");
    const c = new THREE.Color();
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const u = x / W, v = y / H; // v: 0 nuca … 1 focinho
        const ang = -Math.PI / 2 + 2 * Math.PI * u;
        const top = Math.sin(ang), lat = Math.cos(ang);
        c.copy(barr).lerp(dors, sm((top + 0.35) / 0.8));
        const m = rnd(Math.floor(u * 140) * 131 + Math.floor(v * 110), 5);
        c.multiplyScalar(1 + (m - 0.5) * 0.08 * sm(top + 0.3));
        // risca escura focinho → olho → ouvido
        const linha = 0.18 + 0.1 * (v - 0.5);
        if (Math.abs(top - linha) < 0.11 && Math.abs(lat) > 0.3) c.lerp(esc, (filhote ? 0.75 : 0.55) * sm((0.11 - Math.abs(top - linha)) / 0.06));
        // pintinhas escuras no topo
        if (top > 0.6 && m > 0.86) c.lerp(esc, 0.5);
        const k = (y * W + x) * 4;
        img.data[k] = Math.round(255 * Math.pow(clamp01(c.r), 1 / 2.2));
        img.data[k + 1] = Math.round(255 * Math.pow(clamp01(c.g), 1 / 2.2));
        img.data[k + 2] = Math.round(255 * Math.pow(clamp01(c.b), 1 / 2.2));
        img.data[k + 3] = 255;
      }
    g.putImageData(img, 0, 0);
  }, true, true, false);
// íris cinza-dourada com reticulado e pupila vertical de borda lobada (olho sem pálpebra)
const irisTex = () =>
  texCanvas("lagIris", 256, 256, (g, W, H) => {
    const img = g.createImageData(W, H);
    const c = new THREE.Color();
    const ouro = new THREE.Color("#C2A866"), cinza = new THREE.Color("#9A9484"), esc = new THREE.Color("#2A251C");
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const phi = (x / W) * Math.PI * 2, th = (1 - y / H) * Math.PI;
        const px = th * Math.cos(phi), py = th * Math.sin(phi);
        const r = th;
        const ret = Math.sin(phi * 22 + Math.sin(r * 30) * 1.5) * 0.5 + 0.5;
        c.copy(cinza).lerp(ouro, 0.55 + 0.3 * Math.sin(r * 9));
        c.lerp(esc, ret * 0.28 * sm(r / 0.2));
        c.lerp(esc, sm((r - 0.7) / 0.45) * 0.85); // borda escura (dá profundidade ao globo)
        // pupila: fenda vertical com 4 lóbulos (no eixo local py = vertical do olho)
        const lob = 0.012 * Math.cos(py * 40);
        if (Math.abs(px) < 0.05 + lob && Math.abs(py) < 0.62) c.copy(new THREE.Color("#050505"));
        const k = (y * W + x) * 4;
        img.data[k] = Math.round(255 * Math.pow(clamp01(c.r), 1 / 2.2));
        img.data[k + 1] = Math.round(255 * Math.pow(clamp01(c.g), 1 / 2.2));
        img.data[k + 2] = Math.round(255 * Math.pow(clamp01(c.b), 1 / 2.2));
        img.data[k + 3] = 255;
      }
    g.putImageData(img, 0, 0);
  }, true, false, false);
const fitaTex = () =>
  texCanvas("lagFita", 256, 512, (g, W, H) => {
    g.fillStyle = "#B9BDC2";
    g.fillRect(0, 0, W, H);
    // espiral: faixas diagonais com borda escura e brilho
    for (let i = -8; i < 16; i++) {
      const y0 = i * 48;
      g.fillStyle = "#C3C7CC"; // prata lisa (sem cara de quadriculado)
      g.beginPath();
      g.moveTo(0, y0);
      g.lineTo(W, y0 + 64);
      g.lineTo(W, y0 + 112);
      g.lineTo(0, y0 + 48);
      g.fill();
      g.strokeStyle = "rgba(80,84,90,0.55)";
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(0, y0);
      g.lineTo(W, y0 + 64);
      g.stroke();
    }
    // tramado do tecido da fita
    g.globalAlpha = 0.05;
    g.strokeStyle = "#ffffff";
    for (let x = 0; x < W; x += 4) {
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x, H);
      g.stroke();
    }
    for (let i = 0; i < 260; i++) {
      g.fillStyle = rnd(i, 3) > 0.5 ? "#ffffff" : "#6b6f75";
      g.globalAlpha = 0.25;
      g.fillRect(rnd(i, 1) * W, rnd(i, 2) * H, 10 + rnd(i, 4) * 30, 2);
    }
    g.globalAlpha = 1;
  });
const tracejadoTex = () =>
  texCanvas("lagTrac", 128, 8, (g, W, H) => {
    g.clearRect(0, 0, W, H);
    g.fillStyle = "#ffffff";
    for (let i = 0; i < 8; i++) g.fillRect(i * 16, 0, 10, H);
  }, false);

const membroTex = () =>
  texCanvas("lagMembro", 128, 128, (g, W, H) => {
    g.fillStyle = "#B1A795";
    g.fillRect(0, 0, W, H);
    for (let i = 0; i < 500; i++) {
      g.fillStyle = rnd(i, 1) > 0.5 ? "rgba(70,58,45,0.18)" : "rgba(240,230,210,0.15)";
      g.fillRect(rnd(i, 2) * W, rnd(i, 3) * H, 3, 3);
    }
    g.fillStyle = "rgba(78,66,54,0.55)";
    g.fillRect(0, H * 0.3, W, H * 0.12);
    g.fillRect(0, H * 0.7, W, H * 0.1);
  });
// ---------- materiais ----------
type PeleU = { uRegen: { value: number }; uXA: { value: number }; uXB: { value: number }; uScan: { value: number } };
const matPele = (filhote: boolean) => {
  const m = new THREE.MeshPhysicalMaterial({
    map: pele(filhote),
    bumpMap: relevo(),
    bumpScale: 0.25,
    roughness: 0.55,
    sheen: 0.6,
    sheenRoughness: 0.5,
    sheenColor: new THREE.Color("#F5D9C4"),
    clearcoat: 0.25,
    clearcoatRoughness: 0.5,
    emissive: new THREE.Color("#5A3A2A"),
    emissiveIntensity: 0.12,
  });
  const u: PeleU = { uRegen: { value: 999 }, uXA: { value: 999 }, uXB: { value: -1 }, uScan: { value: 0 } };
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = "attribute float aS; varying float vS;\n" + sh.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\n vS = aS;");
    sh.fragmentShader =
      "varying float vS; uniform float uRegen; uniform float uXA; uniform float uXB; uniform float uScan;\n" +
      sh.fragmentShader
        .replace(
          "#include <bumpmap_pars_fragment>",
          THREE.ShaderChunk.bumpmap_pars_fragment.replace("uniform float bumpScale;", "uniform float bumpScale; float gBK = 1.0;").split("bumpScale *").join("bumpScale * gBK *"),
        )
        .replace("#include <clipping_planes_fragment>", "#include <clipping_planes_fragment>\n if (vS > uXA && vS < uXB) discard;")
        .replace(
          "#include <map_fragment>",
          `#include <map_fragment>
           if (vS > uRegen) { float nn = fract(sin(dot(floor(vMapUv*vec2(60.0,400.0)), vec2(12.9898,78.233)))*43758.5453);
             float k = smoothstep(uRegen, uRegen + 0.12, vS);
             diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.60,0.65,0.70) * (0.96 + 0.06*nn), k); }`, // cartilagem cinza-azulada (lê cinza mesmo sob a luz quente)
        )
        .replace("#include <normal_fragment_maps>", "gBK = vS > uRegen + 0.05 ? 0.12 : 1.0;\n#include <normal_fragment_maps>")
        .replace(
          "#include <emissivemap_fragment>",
          `#include <emissivemap_fragment>
           totalEmissiveRadiance += vec3(0.25,0.75,1.0) * uScan * 3.0 * smoothstep(0.16, 0.0, abs(vS - uXB));
           totalEmissiveRadiance += vec3(0.10,0.14,0.19) * smoothstep(uRegen, uRegen + 0.12, vS);`,
        );
  };
  m.customProgramCacheKey = () => "lagPele";
  return { m, u };
};

// ---------- geometrias fixas ----------
let G: null | {
  cab: THREE.BufferGeometry;
  mand: THREE.BufferGeometry;
  sph: THREE.SphereGeometry;
  olho: THREE.SphereGeometry;
  cyl: THREE.CylinderGeometry;
  cylT: THREE.CylinderGeometry;
  cone: THREE.ConeGeometry;
  tub: THREE.ConeGeometry;
  toro: THREE.TorusGeometry;
  dedo: THREE.BufferGeometry;
  vert: THREE.BufferGeometry;
  musc: THREE.BufferGeometry;
  disco: THREE.CircleGeometry;
  trac: THREE.TorusGeometry;
} = null;
const CAB: PKey[] = [
  [-0.35, 0.38, 0.22, 0.12, 0.0],
  [0.12, 0.58, 0.28, 0.12, 0.03],
  [0.55, 0.64, 0.29, 0.11, 0.04],
  [0.95, 0.54, 0.26, 0.09, 0.03],
  [1.3, 0.38, 0.2, 0.08, 0.01],
  [1.55, 0.24, 0.15, 0.07, 0.0],
  [1.7, 0.1, 0.09, 0.05, -0.01],
];
// grânulos da cabeça: pontos na superfície do perfil CAB (interpolação linear das seções), fileiras alternadas
const GRAN_CAB: THREE.Matrix4[] = (() => {
  const out: THREE.Matrix4[] = [];
  const sec = (z: number) => {
    let i = 0;
    while (i < CAB.length - 2 && CAB[i + 1][0] < z) i++;
    const a = CAB[i], b = CAB[i + 1];
    const p = Math.max(0, Math.min(1, (z - a[0]) / (b[0] - a[0])));
    return [a[1] + (b[1] - a[1]) * p, a[2] + (b[2] - a[2]) * p, (a[4] ?? 0) + ((b[4] ?? 0) - (a[4] ?? 0)) * p];
  };
  let k = 0;
  for (let z = -0.2; z < 1.55; z += 0.085) {
    const [w, ht, yc] = sec(z);
    for (let a = 0.18; a < Math.PI - 0.18; a += 0.16) {
      const aa = a + ((k++ % 2) * 0.08);
      const x = Math.cos(aa) * w * 0.98, y = yc + Math.sin(aa) * ht * 0.98;
      // pula a região dos olhos
      if (z > 0.55 && z < 1.1 && Math.abs(Math.abs(x) - 0.4) < 0.17 && y > 0.0) continue;
      const n = new THREE.Vector3(Math.cos(aa) / Math.max(w, 0.01), Math.sin(aa) / Math.max(ht, 0.01), 0).normalize();
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);
      const sz = 0.026 + 0.01 * ((k * 7919) % 5) / 5; // grânulos baixos e da cor da cabeça (sem cara de "abacaxi")
      out.push(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(sz, sz * 0.32, sz)));
    }
  }
  return out;
})();
const MAND: PKey[] = [
  [-0.2, 0.36, 0.05, 0.15, 0],
  [0.45, 0.56, 0.05, 0.16, 0],
  [1.0, 0.43, 0.05, 0.11, 0],
  [1.42, 0.22, 0.04, 0.07, 0],
  [1.63, 0.07, 0.03, 0.03, 0],
];
const geos = () => {
  if (G) return G;
  // dedo: almofada alargada com lamelas divididas por baixo + falange livre fina com unha
  const pad = new THREE.SphereGeometry(1, 18, 10);
  pad.scale(0.18, 0.05, 0.11);
  pad.translate(0.22, 0.045, 0);
  const parts: THREE.BufferGeometry[] = [pad];
  for (let i = 0; i < 7; i++) {
    const x = 0.09 + i * 0.042;
    const larg = 0.1 * Math.sqrt(Math.max(0.05, 1 - Math.pow((x - 0.22) / 0.18, 2)));
    for (const sgn of [-1, 1]) {
      const b = new THREE.BoxGeometry(0.018, 0.012, larg * 0.92);
      b.translate(x, 0.006, sgn * (larg * 0.5 + 0.004));
      parts.push(b);
    }
  }
  const fal = new THREE.CylinderGeometry(0.018, 0.026, 0.16, 6);
  fal.rotateZ(-Math.PI / 2 + 0.45);
  fal.translate(0.42, 0.1, 0);
  const unha = new THREE.ConeGeometry(0.018, 0.07, 6);
  unha.rotateZ(-Math.PI / 2 - 0.5);
  unha.translate(0.51, 0.115, 0);
  const base = new THREE.CylinderGeometry(0.035, 0.045, 0.14, 6);
  base.rotateZ(-Math.PI / 2);
  base.translate(0.04, 0.05, 0);
  parts.push(fal, unha, base);
  const dedo = mergeGeometries(parts.map((p) => p.toNonIndexed()))!;
  dedo.computeVertexNormals();
  // vértebra caudal: carretel com côndilos e asinhas (processos transversos)
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i <= 16; i++) {
    const y = -0.5 + i / 16;
    const r = 0.55 + 0.45 * Math.pow(Math.abs(y) * 2, 3);
    pts.push(new THREE.Vector2(r, y));
  }
  const corpo = new THREE.LatheGeometry(pts, 14);
  const asa = new THREE.BoxGeometry(1.9, 0.16, 0.3);
  asa.translate(0, 0.0, 0);
  const espinho = new THREE.BoxGeometry(0.2, 0.25, 0.9);
  espinho.translate(0, 0.0, 0.6);
  const vert = mergeGeometries([corpo.toNonIndexed(), asa.toNonIndexed(), espinho.toNonIndexed()])!;
  vert.rotateX(Math.PI / 2); // eixo do osso = z
  vert.computeVertexNormals();
  const mp: THREE.Vector2[] = [];
  for (let i = 0; i <= 12; i++) {
    const y = -0.5 + i / 12;
    mp.push(new THREE.Vector2(0.25 + 0.75 * Math.sin((i / 12) * Math.PI), y));
  }
  const musc = new THREE.LatheGeometry(mp, 16);
  musc.rotateX(Math.PI / 2);
  // perfilGeo sai com as faces para dentro neste uso: espelha em x (forma simétrica) e inverte as normais
  const vira = (g0: THREE.BufferGeometry) => {
    g0.scale(-1, 1, 1);
    const n = g0.attributes.normal as THREE.BufferAttribute;
    for (let i = 0; i < n.count; i++) n.setXYZ(i, -n.getX(i), -n.getY(i), -n.getZ(i));
    return g0;
  };
  const cab = vira(perfilGeo(CAB, { seg: 40, rad: 36, edge: 0.1 }));
  const mand = vira(perfilGeo(MAND, { seg: 30, rad: 28, edge: 0.12 }));
  const olho = new THREE.SphereGeometry(1, 32, 24);
  olho.rotateX(Math.PI / 2); // polo (centro da íris) em +z
  const trac = new THREE.TorusGeometry(1, 0.1, 6, 48);
  G = {
    cab,
    mand,
    sph: new THREE.SphereGeometry(1, 16, 12),
    olho,
    cyl: new THREE.CylinderGeometry(1, 1, 1, 10, 1),
    cylT: new THREE.CylinderGeometry(0.68, 1, 1, 14, 1),
    cone: new THREE.ConeGeometry(1, 1, 8),
    tub: new THREE.ConeGeometry(1, 1, 3),
    toro: new THREE.TorusGeometry(1, 0.22, 8, 28),
    dedo,
    vert,
    musc,
    disco: new THREE.CircleGeometry(1, 28),
    trac,
  };
  return G;
};

// ---------- pernas (IK de 2 ossos) ----------
const Y = new THREE.Vector3(0, 1, 0);
const ik2 = (S: THREE.Vector3, T: THREE.Vector3, L1: number, L2: number, pole: THREE.Vector3) => {
  const d0 = T.clone().sub(S);
  const d = Math.min(Math.max(d0.length(), Math.abs(L1 - L2) + 1e-3), (L1 + L2) * 0.999);
  const dir = d0.lengthSq() > 1e-9 ? d0.normalize() : new THREE.Vector3(0, -1, 0);
  const a = Math.acos(THREE.MathUtils.clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1));
  const n = pole.clone().sub(dir.clone().multiplyScalar(pole.dot(dir)));
  if (n.lengthSq() < 1e-8) n.set(0, 1, 0);
  n.normalize();
  const E = S.clone().add(dir.clone().multiplyScalar(Math.cos(a)).add(n.multiplyScalar(Math.sin(a))).multiplyScalar(L1));
  return { E, W: S.clone().add(dir.clone().multiplyScalar(d)) };
};
const quatY = (dir: THREE.Vector3) => new THREE.Quaternion().setFromUnitVectors(Y, dir.clone().normalize());
const Osso: React.FC<{ a: THREE.Vector3; b: THREE.Vector3; r1: number; r2: number; m: THREE.Material }> = ({ a, b, r1, r2, m }) => {
  const g = geos();
  const d = b.clone().sub(a);
  const L = d.length();
  if (L < 1e-5) return null;
  const q = quatY(d);
  const mid = a.clone().add(b).multiplyScalar(0.5);
  return (
    <>
      <mesh geometry={g.cylT} material={m} position={mid} quaternion={q} scale={[r1, L, r1]} castShadow />
      <mesh geometry={g.sph} material={m} position={b} scale={r1 * 0.7} castShadow />
    </>
  );
};
// pé: 5 dedos em leque (frente = direção `dir` no plano), dedo I menor
const Pe: React.FC<{ p: THREE.Vector3; dir: number; lado: 1 | -1; m: THREE.Material; tras: boolean }> = ({ p, dir, lado, m, tras }) => {
  const g = geos();
  const comp = tras ? [0.62, 0.9, 1.0, 1.05, 0.95] : [0.6, 0.88, 1.0, 1.0, 0.85];
  const ab = tras ? 1.9 : 1.75;
  return (
    <group position={[p.x, 0, p.z]} rotation={[0, dir, 0]}>
      <mesh geometry={g.sph} material={m} position={[0, 0.06, 0]} scale={[0.14, 0.06, 0.12]} castShadow />
      {comp.map((c, i) => {
        const a = (i / 4 - 0.5) * ab * lado;
        return (
          <group key={i} rotation={[0, -Math.PI / 2 + a, 0]} position={[0, 0, 0]} scale={[c * 1.15, 1, c > 0.7 ? 1 : 0.8]}>
            <mesh geometry={g.dedo} material={m} position={[0.07, 0, 0]} castShadow />
          </group>
        );
      })}
    </group>
  );
};

// ---------- COMPONENTE ----------
export const Lagartixa: React.FC<LagartixaProps> = (P) => {
  const filhote = !!P.filhote;
  const g = geos();
  const env = useEnv();
  const { m: skin, u: SU } = useMemo(() => matPele(filhote), [filhote]);
  const headM = useMemo(
    () => new THREE.MeshPhysicalMaterial({ map: cabecaTex(filhote), bumpMap: relevo(), bumpScale: 0.15, roughness: 0.5, sheen: 0.5, sheenColor: new THREE.Color("#F5D9C4"), clearcoat: 0.3, emissive: new THREE.Color("#5A3A2A"), emissiveIntensity: 0.12 }),
    [filhote],
  );
  const membro = useMemo(() => new THREE.MeshPhysicalMaterial({ map: membroTex(), color: "#FFFFFF", roughness: 0.55, sheen: 0.5, sheenColor: new THREE.Color("#F5D9C4"), emissive: new THREE.Color("#5A3A2A"), emissiveIntensity: 0.12 }), []);
  const olhoM = useMemo(() => new THREE.MeshPhysicalMaterial({ map: irisTex(), roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.05, envMap: env, envMapIntensity: 0.35, emissive: new THREE.Color("#FFFFFF"), emissiveMap: irisTex(), emissiveIntensity: 0.18 }), [env]);
  const tubM = useMemo(() => new THREE.MeshStandardMaterial({ color: "#9A907E", roughness: 0.6, emissive: new THREE.Color("#3A2A20"), emissiveIntensity: 0.15 }), []);
  const corneaM = useMemo(() => new THREE.MeshPhysicalMaterial({ color: "#FFFFFF", roughness: 0.02, metalness: 0, transparent: true, opacity: 0.07, clearcoat: 1, clearcoatRoughness: 0.0, envMap: env, envMapIntensity: 0.8, depthWrite: false }), [env]);
  const brilhoM = useMemo(() => new THREE.MeshBasicMaterial({ color: "#FFFFFF", toneMapped: false }), []);
  const granM = useMemo(() => new THREE.MeshPhysicalMaterial({ color: "#B9A88E", roughness: 0.6, sheen: 0.4, sheenColor: new THREE.Color("#F5D9C4"), emissive: new THREE.Color("#5A3A2A"), emissiveIntensity: 0.1 }), []);
  const escuro = useMemo(() => new THREE.MeshStandardMaterial({ color: "#1B1512", roughness: 0.6 }), []);
  const bocaM = useMemo(() => new THREE.MeshStandardMaterial({ color: "#D98A8A", roughness: 0.45, emissive: new THREE.Color("#5A1E1E"), emissiveIntensity: 0.2 }), []);
  const toco = useMemo(() => new THREE.MeshStandardMaterial({ color: "#E3B7A6", roughness: 0.5, emissive: new THREE.Color("#6A3A30"), emissiveIntensity: 0.15 }), []);
  const fitaM = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({ map: fitaTex(), color: "#F4F6F9", metalness: 0.85, roughness: 0.16, envMap: env, envMapIntensity: 2.2 }); // fita prateada brilhante (lê como silver tape)
    const u = { uF: { value: 0 } };
    m.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, u);
      sh.vertexShader = "attribute float aS; varying float vS;\n" + sh.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\n vS = aS;");
      sh.fragmentShader = "varying float vS; uniform float uF;\n" + sh.fragmentShader.replace("#include <clipping_planes_fragment>", "#include <clipping_planes_fragment>\n if (vS > uF) discard;");
    };
    m.customProgramCacheKey = () => "lagFita";
    return { m, u };
  }, [env]);
  const vidro = useMemo(() => vidroRaioX("#A8DCFF"), []);
  const ossoM = useMemo(() => new THREE.MeshStandardMaterial({ color: "#F6F1E2", roughness: 0.45, emissive: new THREE.Color("#BFB49A"), emissiveIntensity: 0.6 }), []);
  const cartM = useMemo(() => new THREE.MeshStandardMaterial({ color: "#E3F1F3", roughness: 0.35, emissive: new THREE.Color("#9CC9D2"), emissiveIntensity: 0.6, transparent: true, opacity: 0.92 }), []);
  const muscM = useMemo(() => new THREE.MeshStandardMaterial({ color: "#E0473F", roughness: 0.5, emissive: new THREE.Color("#B0261F"), emissiveIntensity: 0.5, transparent: true, opacity: 0.6, depthWrite: false }), []);
  const tracM = useMemo(() => new THREE.MeshBasicMaterial({ color: "#FFD23F", alphaMap: tracejadoTex(), alphaTest: 0.5, toneMapped: false }), []);
  const falhaM = useMemo(() => new THREE.MeshBasicMaterial({ color: "#FF4A3D", alphaMap: tracejadoTex(), transparent: true, toneMapped: false, depthWrite: false }), []);
  (falhaM.alphaMap as THREE.Texture).repeat.set(1, 1);
  const marcaM = useMemo(() => new THREE.MeshBasicMaterial({ color: "#FFE15A", transparent: true, toneMapped: false, depthWrite: false }), []);

  const tuboCorpo = useMemo(() => novoTubo(150, 40), []);
  const tuboPed = useMemo(() => novoTubo(90, 32), []);
  const tuboFita = useMemo(() => novoTubo(60, 32), []);
  const tuboCart = useMemo(() => novoTubo(50, 12), []);
  const granRef = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const R = granRef.current;
    if (!R || R.userData.ok) return;
    GRAN_CAB.forEach((m, i) => R.setMatrixAt(i, m));
    R.instanceMatrix.needsUpdate = true;
    R.userData.ok = true;
  });
  const tubInst = useRef<THREE.InstancedMesh>(null);
  const vertInst = useRef<THREE.InstancedMesh>(null);
  const muscInst = useRef<THREE.InstancedMesh>(null);
  const tracInst = useRef<THREE.InstancedMesh>(null);

  // ----- coluna -----
  const ps = pose(P);
  const corpoCad = cadeiaDe(new THREE.Vector3(0, ps.Y, TRONCO), new THREE.Vector3(0, 0, -1), Y, LENS, ps.yaw, ps.pitch, 0, (s) => (s > TRONCO + 0.6 ? perfil(s)[2] * 0.9 + 0.03 : null));
  const sl = P.soltar;
  const sCut = sl ? sAnel(sl.anel) : null;
  const rg = P.regen;
  const sReg = rg ? sAnel(rg.anel) : null;
  const regComp = rg ? Math.min(rg.comp ?? S_FIM - (sReg as number), S_FIM - (sReg as number)) : 0;
  const sFimCorpo = sCut ?? (rg ? (sReg as number) + regComp : S_FIM);
  // perfil efetivo (rabo regenerado: emenda um pouco mais grossa e ponta que acompanha o crescimento)
  const perfilEf = (s: number): [number, number, number] => {
    const b = perfil(s);
    if (rg && s > (sReg as number)) {
      const r0 = perfil(sReg as number);
      const x = s - (sReg as number);
      const fimR = regComp;
      const full = S_FIM - (sReg as number);
      // cone liso: parte do raio da emenda (+8 %) e afina até a ponta atual
      const k = Math.pow(clamp01(1 - x / Math.max(0.05, full)), 0.75) * 1.08 * (1 - 0.06 * sm(x / 0.4));
      const bud = Math.pow(clamp01((fimR - x) / Math.min(0.5, Math.max(0.05, fimR))), 0.55);
      return [Math.max(0.012, r0[0] * k * bud), Math.max(0.012, r0[1] * k * bud), Math.max(0.012, r0[2] * k * bud)];
    }
    return b;
  };
  const amostras = (cad: Cadeia, s0: number, s1: number, n: number): Amostra[] => {
    const A: Amostra[] = [];
    for (let i = 0; i < n; i++) {
      const s = s0 + ((s1 - s0) * i) / (n - 1);
      const q = quadroEm(cad, s);
      const [w, ht, hb] = perfilEf(s);
      // ponta arredondada (só se o tubo acaba de verdade, não no corte)
      let k = 1;
      if (Math.abs(s1 - S_FIM) < 1e-3 || (rg && !sl)) k = Math.pow(clamp01((s1 - s) / 0.05), 0.5);
      if (i === n - 1 && !(sl && Math.abs(s1 - (sCut as number)) < 1e-4)) k = 0.001;
      A.push({ p: q.p, d: q.d, u: q.u, w: w * k, ht: ht * k, hb: hb * k, s });
    }
    return A;
  };
  const Acorpo = amostras(corpoCad, -0.6, sFimCorpo, 150);
  escreveTubo(tuboCorpo, Acorpo, S_FIM);

  // ----- pedaço solto -----
  const pedOn = !!sl && sl.pedaco !== false;
  let pedCad: Cadeia | null = null;
  let Aped: Amostra[] = [];
  if (sl && pedOn) {
    const q = quadroEm(corpoCad, sCut as number);
    const k0 = sl.anel;
    const lens = [S_J[N_TR + k0 + 1] - (sCut as number), ...LENS.slice(N_TR + k0 + 1)];
    const tt = P.t - (sl.tSolta ?? P.t);
    const yaw = lens.map((_, i) => ps.yaw[N_TR + k0 + i] + mexidaRabo(tt, i, lens.length, sl.amp ?? 1));
    const p0 = q.p.clone().addScaledVector(q.d, sl.afastar ?? 0);
    pedCad = cadeiaDe(p0, q.d, q.u, lens, yaw, [], sCut as number, (s) => perfil(s)[2] * 0.9 + 0.03);
    Aped = amostras(pedCad, sCut as number, S_FIM, 90);
    escreveTubo(tuboPed, Aped, S_FIM);
  }

  // ----- raio-x -----
  const rx = P.raioX;
  const xA = TRONCO + 0.1;
  const xB = rx ? mix(xA, S_FIM + 0.05, clamp01(rx.ate)) : -1;
  SU.uXA.value = rx && rx.ate > 0 ? xA : 999;
  SU.uXB.value = xB;
  SU.uScan.value = rx && rx.ate > 0.001 && rx.ate < 0.999 ? 1 : 0;
  SU.uRegen.value = rg ? (sReg as number) : 999;
  vidro.uniforms.uA.value = xA;
  vidro.uniforms.uB.value = xB;
  vidro.uniforms.uOp.value = rx?.opac ?? 1;

  // ----- fita prateada -----
  const fitaOn = rg && (rg.fita ?? 0) > 0 && regComp > 0.1;
  if (fitaOn) {
    const s0 = (sReg as number) - 0.04, s1 = (sReg as number) + regComp * 0.92;
    const A = amostras(corpoCad, s0, s1, 60).map((a) => ({ ...a, w: a.w * 1.12 + 0.012, ht: a.ht * 1.12 + 0.012, hb: a.hb * 1.12 + 0.012 }));
    escreveTubo(tuboFita, A, 2.2);
    fitaM.u.uF.value = mix(s0, s1, clamp01(rg!.fita ?? 0));
  }
  // ----- cartilagem (raio-x do rabo regenerado) -----
  const cartOn = rg && rx && rx.ate > 0 && regComp > 0.1;
  if (cartOn) {
    const s0 = (sReg as number) - 0.02, s1 = (sReg as number) + regComp - 0.08;
    const A = amostras(corpoCad, s0, s1, 50).map((a, i, arr) => ({ ...a, w: a.w * 0.36, ht: a.ht * 0.36, hb: a.hb * 0.36 * (i === arr.length - 1 ? 0.01 : 1) }));
    escreveTubo(tuboCart, A, 3);
  }

  // ----- instâncias: tubérculos, vértebras, músculos, tracejados -----
  useLayoutEffect(() => {
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), pos = new THREE.Vector3();
    const surf = (A: Amostra[], s: number, ang: number, out: THREE.Vector3, nrm: THREE.Vector3) => {
      const s0 = A[0].s, s1 = A[A.length - 1].s;
      const f = clamp01((s - s0) / (s1 - s0)) * (A.length - 1);
      const a = A[Math.floor(f)], b = A[Math.min(A.length - 1, Math.floor(f) + 1)];
      const t = f - Math.floor(f);
      const p = a.p.clone().lerp(b.p, t), d = a.d.clone().lerp(b.d, t).normalize(), u = ortoU(a.u.clone().lerp(b.u, t), d);
      const sd = new THREE.Vector3().crossVectors(d, u).normalize();
      const w = mix(a.w, b.w, t), ht = mix(a.ht, b.ht, t), hb = mix(a.hb, b.hb, t);
      const sa = Math.sin(ang), ca = Math.cos(ang);
      const h = sa > 0 ? ht : hb;
      out.copy(p).addScaledVector(sd, w * ca).addScaledVector(u, h * sa);
      nrm.copy(sd).multiplyScalar(ca / Math.max(w, 1e-3)).addScaledVector(u, sa / Math.max(h, 1e-3)).normalize();
      return d;
    };
    // tubérculos triédricos: fileiras no dorso + verticilos de espinhos no rabo original
    const T = tubInst.current;
    if (T) {
      let n = 0;
      const nrm = new THREE.Vector3();
      const put = (A: Amostra[], s: number, ang: number, size: number) => {
        if (n >= T.count) return;
        if (s < A[0].s + 0.02 || s > A[A.length - 1].s - 0.04) return;
        if (sReg !== null && s > sReg - 0.05) return;
        if (rx && rx.ate > 0 && s > xA && s < xB) return;
        const d = surf(A, s, ang, pos, nrm);
        q.setFromUnitVectors(Y, nrm.clone().addScaledVector(d, -0.6).normalize());
        m4.compose(pos, q, sc.set(size, size * 0.8, size));
        T.setMatrixAt(n++, m4);
      };
      const all = (A: Amostra[]) => {
        for (let s = 0.35; s < 3.9; s += 0.27) for (const a of [0.42, 0.85, 1.25, 1.6, 1.95, 2.3, 2.7]) put(A, s + (a > 1.5 ? 0.13 : 0), a, 0.045);
        for (let k = 0; k < N_RB; k++) {
          const s = TRONCO + (k + 0.15) * L_RB;
          const r = perfil(s)[0];
          for (const a of [0.15, 0.8, 1.57, 2.34, 2.99]) put(A, s, a, Math.max(0.025, r * 0.17));
        }
      };
      all(Acorpo);
      if (pedOn) all(Aped);
      T.count = n;
      T.instanceMatrix.needsUpdate = true;
    }
    // vértebras / músculos / tracejados (só no trecho já varrido pelo raio-x)
    const V = vertInst.current, M = muscInst.current, R = tracInst.current;
    if (V && M && R) {
      let nv = 0, nm = 0, nr = 0;
      const tr = rx?.tracejados ?? 0;
      for (let k = 0; k < N_RB; k++) {
        const sMid = sAnel(k);
        if (!rx || sMid - L_RB * 0.5 > xB) continue;
        if (sReg !== null && sMid > sReg + 0.01) continue; // rabo regenerado: sem osso
        const noPed = sCut !== null && sMid > sCut + 1e-4;
        const corta = sCut !== null && Math.abs(sMid - sCut) < 1e-4;
        const src = noPed ? pedCad : corpoCad;
        if (!src || (noPed && !pedOn)) continue;
        const A = noPed ? Aped : Acorpo;
        const r = perfil(sMid)[0];
        const L = L_RB * 0.86;
        // metade de trás/da frente quando o osso parte nesta junta
        const quebraK = rx.quebraAnel === k ? clamp01(rx.quebra ?? 0) : 0;
        const halves: [number, number, Cadeia, Amostra[]][] = [];
        if (corta) {
          halves.push([sMid - L / 2, sMid, corpoCad, Acorpo]);
          if (pedOn && pedCad) halves.push([sMid, sMid + L / 2, pedCad, Aped]);
        } else if (quebraK > 0) {
          halves.push([sMid - L / 2, sMid - 0.07 * quebraK, src, A]);
          halves.push([sMid + 0.07 * quebraK, sMid + L / 2, src, A]);
        } else halves.push([sMid - L / 2, sMid + L / 2, src, A]);
        for (const [a, b, cad] of halves) {
          const q0 = quadroEm(cad, (a + b) / 2);
          const fr = new THREE.Matrix4().makeBasis(new THREE.Vector3().crossVectors(q0.u, q0.d).normalize(), q0.u, q0.d.clone().negate());
          q.setFromRotationMatrix(fr);
          m4.compose(q0.p, q, sc.set(r * 0.36, r * 0.36, (b - a) * 1.0));
          V.setMatrixAt(nv++, m4);
        }
        // músculo (contrai em volta do anel escolhido)
        const qm = quadroEm(src, sMid);
        const cont = rx.quebraAnel !== undefined && Math.abs(k - rx.quebraAnel) <= 1 ? clamp01(rx.musculo ?? 0) * (k === rx.quebraAnel ? 1 : 0.6) : 0;
        const frm = new THREE.Matrix4().makeBasis(new THREE.Vector3().crossVectors(qm.u, qm.d).normalize(), qm.u, qm.d.clone().negate());
        q.setFromRotationMatrix(frm);
        // dois feixes de músculo, um de cada lado do osso; contraem apertando o osso
        const sdm = new THREE.Vector3().crossVectors(qm.d, qm.u).normalize();
        for (const lado of [-1, 1]) {
          const pm = qm.p.clone().addScaledVector(sdm, lado * r * (0.5 - 0.12 * cont));
          m4.compose(pm, q, sc.set(r * 0.26 * (1 - 0.25 * cont), r * 0.34 * (1 - 0.2 * cont), L_RB * 0.5 * (1 + 0.1 * cont)));
          M.setMatrixAt(nm++, m4);
        }
        // tracejado no meio da vértebra (não nos 5 primeiros)
        if (k >= 3 && k - 3 < tr && !corta) {
          const qq = quadroEm(src, sMid);
          const frt = new THREE.Matrix4().makeBasis(new THREE.Vector3().crossVectors(qq.u, qq.d).normalize(), qq.u, qq.d.clone().negate());
          q.setFromRotationMatrix(frt);
          const acende = clamp01(tr - (k - 3));
          m4.compose(qq.p, q, sc.setScalar(r * 0.78 * (0.6 + 0.4 * sm(acende))));
          R.setMatrixAt(nr++, m4);
        }
      }
      V.count = nv;
      M.count = nm;
      R.count = nr;
      V.instanceMatrix.needsUpdate = M.instanceMatrix.needsUpdate = R.instanceMatrix.needsUpdate = true;
    }
  });

  // ----- cabeça -----
  const q0 = quadroEm(corpoCad, 0);
  const fwd = q0.d.clone().negate();
  const side = new THREE.Vector3().crossVectors(q0.u, fwd).normalize();
  const cabM = new THREE.Matrix4().makeBasis(side, q0.u, fwd);
  const cabQ = new THREE.Quaternion().setFromRotationMatrix(cabM);
  const [cy, cp, cr] = P.cabeca ?? [0, 0, 0];
  const giro = new THREE.Quaternion().setFromEuler(new THREE.Euler(-(cp ?? 0), cy ?? 0, cr ?? 0, "YXZ"));
  cabQ.multiply(giro);
  const boca = clamp01(P.boca ?? 0);
  const lin = clamp01(P.lingua ?? 0);
  const hs = filhote ? 1.18 : 1;

  // ----- pernas -----
  const andar = clamp01(P.andar ?? 0), cor = clamp01(P.correr ?? 0);
  const S = passo(P);
  const pernas: { s: number; lado: 1 | -1; tras: boolean; off: number }[] = [
    { s: 0.72, lado: 1, tras: false, off: 0 },
    { s: 0.72, lado: -1, tras: false, off: 0.5 },
    { s: 3.75, lado: 1, tras: true, off: 0.5 },
    { s: 3.75, lado: -1, tras: true, off: 0 },
  ];
  const pernaEls = pernas.map((pp, i) => {
    const q = quadroEm(corpoCad, pp.s);
    const sd = new THREE.Vector3().crossVectors(q.u, q.d).normalize().multiplyScalar(-1); // +x local do bicho
    const [w] = perfil(pp.s);
    const ombro = q.p.clone().addScaledVector(sd, pp.lado * w * 0.7).addScaledVector(q.u, -0.08);
    const fase = (((ps.fase + pp.off) % 1) + 1) % 1;
    const st = 0.62;
    let zo = 0, lift = 0;
    if (fase < st) zo = mix(0.5, -0.5, fase / st) * S * st;
    else {
      const k = (fase - st) / (1 - st);
      zo = mix(-0.5, 0.5, sm(k)) * S * st;
      lift = Math.sin(Math.PI * k) * (0.45 + 0.25 * cor);
    }
    zo *= andar;
    lift *= andar;
    const abre = pp.tras ? 1.25 : 1.15;
    const alvo = new THREE.Vector3(pp.lado * (abre + 0.15 + 0.1 * cor), 0.02 + lift, (pp.tras ? -0.55 : 3.75) + zo);
    const L1 = pp.tras ? 0.85 : 0.72, L2 = pp.tras ? 0.8 : 0.68;
    const pole = new THREE.Vector3(pp.lado * 0.3, 1, pp.tras ? 0.6 : -0.6);
    const { E, W } = ik2(ombro, alvo, L1, L2, pole);
    const dirPe = pp.tras ? pp.lado * 0.55 : pp.lado * -0.25;
    return (
      <group key={i}>
        <mesh geometry={g.sph} material={membro} position={ombro} scale={pp.tras ? 0.25 : 0.21} />
        <Osso a={ombro} b={E} r1={pp.tras ? 0.24 : 0.19} r2={0} m={membro} />
        <Osso a={E} b={W} r1={pp.tras ? 0.155 : 0.13} r2={0} m={membro} />
        <Pe p={W} dir={dirPe} lado={pp.lado} m={membro} tras={pp.tras} />
      </group>
    );
  });

  const esc = (P.escala ?? (filhote ? 0.5 : 1)) * CM;
  const vis = (on: boolean) => (on ? undefined : false);
  return (
    <group position={P.position} rotation={P.rotation} scale={esc} ref={(gr: THREE.Group | null) => { if (gr && P.sombra === false) gr.traverse((o) => { o.castShadow = false; }); }}>
      {/* corpo + rabo (um tubo só) */}
      <mesh geometry={tuboCorpo} material={skin} castShadow={P.sombra !== false} receiveShadow />
      {rx && rx.ate > 0 ? <mesh geometry={tuboCorpo} material={vidro} renderOrder={8} /> : null}
      {/* toco limpo no corte */}
      {sl ? <Toco a={Acorpo[Acorpo.length - 1]} m={toco} osso={ossoM} vira={false} /> : null}
      {pedOn ? (
        <>
          <mesh geometry={tuboPed} material={skin} castShadow={P.sombra !== false} />
          {rx && rx.ate > 0 ? <mesh geometry={tuboPed} material={vidro} renderOrder={8} /> : null}
          <Toco a={Aped[0]} m={toco} osso={ossoM} vira />
        </>
      ) : null}
      {fitaOn ? <mesh geometry={tuboFita} material={fitaM.m} castShadow /> : null}
      {cartOn ? <mesh geometry={tuboCart} material={cartM} renderOrder={7} /> : null}
      {P.marca && P.marca.op > 0.001 ? <AnelFalha cad={corpoCad} s={sAnel(P.marca.anel)} r={perfilEf(sAnel(P.marca.anel))[0] * 1.02} m={marcaM} op={P.marca.op} /> : null}
      {cartOn && (rx?.falha ?? 0) > 0 ? <AnelFalha cad={corpoCad} s={(sReg as number) + regComp * 0.45} r={perfilEf((sReg as number) + regComp * 0.45)[0]} m={falhaM} op={rx!.falha!} /> : null}
      <instancedMesh ref={tubInst} args={[g.tub, tubM, 420]} castShadow frustumCulled={false} />
      <instancedMesh ref={vertInst} args={[g.vert, ossoM, 32]} frustumCulled={false} visible={vis(!!rx && rx.ate > 0)} />
      <instancedMesh ref={muscInst} args={[g.sph, muscM, 32]} frustumCulled={false} renderOrder={7} visible={vis(!!rx && rx.ate > 0 && !rx.semMusculo)} />
      <instancedMesh ref={tracInst} args={[g.trac, tracM, 16]} frustumCulled={false} renderOrder={9} visible={vis(!!rx && rx.ate > 0)} />
      {/* cabeça */}
      <group position={q0.p} quaternion={cabQ} scale={hs}>
        <group position={[0, 0.03, -0.12]}>
          <mesh geometry={g.cab} material={headM} castShadow receiveShadow />
          {/* olhos grandes, sem pálpebra */}
          {[1, -1].map((sg) => (
            <group key={sg} position={[sg * 0.41, 0.12, 0.8]} rotation={[0.25, sg * 1.05, 0]}>
              <mesh geometry={g.olho} material={olhoM} scale={0.21 * (filhote ? 1.08 : 1)} />
              {/* córnea (brille) transparente um pouco maior: volume + reflexo */}
              <mesh geometry={g.olho} material={corneaM} scale={0.228 * (filhote ? 1.08 : 1)} position={[0, 0, 0.012]} />
              {/* brilho fixo no olho (dá vida, não pisca) */}
              <mesh geometry={g.sph} material={brilhoM} position={[0.05 * sg, 0.08, 0.205]} scale={0.026} />
            </group>
          ))}
          {/* narinas */}
          {[1, -1].map((sg) => (
            <mesh key={`n${sg}`} geometry={g.sph} material={escuro} position={[sg * 0.1, 0.06, 1.6]} scale={[0.03, 0.025, 0.02]} />
          ))}
          {/* abertura do ouvido */}
          {[1, -1].map((sg) => (
            <mesh key={`o${sg}`} geometry={g.sph} material={escuro} position={[sg * 0.42, 0.02, 0.0]} rotation={[0, sg * 0.4, 0]} scale={[0.03, 0.07, 0.05]} />
          ))}
          {/* boca por dentro */}
          <mesh geometry={g.sph} material={bocaM} position={[0, -0.06, 0.75]} scale={[0.36, 0.06 + 0.1 * boca, 0.85]} />
          {/* mandíbula (abre para comer) */}
          <group position={[0, -0.05, 0.05]} rotation={[boca * 0.55, 0, 0]}>
            <mesh geometry={g.mand} material={headM} position={[0, -0.02, 0]} scale={[0.96, 1, 0.97]} castShadow />
            {/* língua carnuda */}
            <group position={[0, 0.02, 1.1]} rotation={[-lin * 0.9, 0, 0]}>
              <mesh geometry={g.sph} material={bocaM} position={[0, 0.02, 0.15 + lin * 0.55]} scale={[0.13, 0.05, 0.28 + lin * 0.15]} />
            </group>
          </group>
          {/* grânulos/tubérculos da cabeça */}
          <instancedMesh args={[g.sph, granM, GRAN_CAB.length]} ref={granRef} castShadow />
          {P.naBoca ? <group position={BOCA_PONTA}>{P.naBoca}</group> : null}
        </group>
      </group>
      {pernaEls}
    </group>
  );
};

// tracejado vermelho que tenta acender no cano de cartilagem (e falha)
const AnelFalha: React.FC<{ cad: Cadeia; s: number; r: number; m: THREE.MeshBasicMaterial; op: number }> = ({ cad, s, r, m, op }) => {
  const q = quadroEm(cad, s);
  const fr = new THREE.Matrix4().makeBasis(new THREE.Vector3().crossVectors(q.u, q.d).normalize(), q.u, q.d.clone().negate());
  m.opacity = op;
  return <mesh geometry={geos().trac} material={m} position={q.p} quaternion={new THREE.Quaternion().setFromRotationMatrix(fr)} scale={r * 1.15} renderOrder={9} />;
};
// toco: disco liso cor de carne clara com pontinho de osso no meio (sem sangue)
const Toco: React.FC<{ a: Amostra; m: THREE.Material; osso: THREE.Material; vira: boolean }> = ({ a, m, osso, vira }) => {
  const g = geos();
  const d = a.d.clone().multiplyScalar(vira ? -1 : 1);
  const sd = new THREE.Vector3().crossVectors(a.d, a.u).normalize();
  const mt = new THREE.Matrix4().makeBasis(sd, a.u, d);
  const q = new THREE.Quaternion().setFromRotationMatrix(mt);
  const p = a.p.clone();
  return (
    <group position={p} quaternion={q}>
      <mesh geometry={g.sph} material={m} scale={[a.w * 0.99, (a.ht + a.hb) * 0.5, 0.06]} position={[0, (a.ht - a.hb) * 0.25, 0]} />
      <mesh geometry={g.sph} material={osso} scale={[a.w * 0.22, a.w * 0.22, 0.07]} position={[0, 0, 0.01]} />
    </group>
  );
};

// ---------- rabo solto: mexida (seno amortecido, ≤ 2,4 Hz) ----------
export const mexidaRabo = (tt: number, i: number, n: number, amp = 1) => {
  if (tt <= 0) return 0;
  const u = i / Math.max(1, n - 1);
  const A = amp * 0.22 * Math.exp(-tt / 9) * (0.7 + 0.3 * Math.sin(tt * 1.3));
  const f = mix(1.8, 1.1, clamp01(tt / 20)); // Hz: começa rápido e vai cansando (≤ 2,4 Hz: sem efeito estroboscópico)
  const ataque = sm(tt / 0.12);
  return ataque * A * Math.sin(2 * Math.PI * f * tt - i * 0.85) * (0.35 + 0.65 * u) + ataque * A * 0.4 * Math.sin(2 * Math.PI * f * 0.5 * tt + 1.3);
};

// ---------- RABO SOLTO independente (no banco, na boca do gato, dando cambalhota) ----------
// Origem = ponto de quebra (anel `anel`); o pedaço deita no plano y = 0 do grupo, saindo para −z.
// salto: pulo em arco (até `altura` cm) + uma volta completa em torno do eixo lateral.
export type RaboSoltoProps = {
  t: number;
  anel: number;
  tSolta: number; // instante da soltura (s) — a mexida conta a partir daqui
  amp?: number;
  salto?: { t0: number; dur: number; altura?: number; volta?: number };
  apoiado?: boolean;
  regen?: boolean;
  filhote?: boolean;
  escala?: number;
  position?: V3;
  rotation?: V3;
};
export const raboSoltoSalto = (t: number, s?: RaboSoltoProps["salto"]) => {
  if (!s) return { y: 0, ang: 0, x: 0 };
  const k = clamp01((t - s.t0) / s.dur);
  if (k <= 0 || k >= 1) return { y: 0, ang: k >= 1 ? (s.volta ?? 1) * Math.PI * 2 : 0, x: k >= 1 ? 1 : 0 };
  return { y: 4 * k * (1 - k) * (s.altura ?? 3), ang: sm(k) * (s.volta ?? 1) * Math.PI * 2, x: k };
};
export const RaboSolto: React.FC<RaboSoltoProps> = (P) => {
  const filhote = !!P.filhote;
  const { m: skin } = useMemo(() => matPele(filhote), [filhote]);
  const toco = useMemo(() => new THREE.MeshStandardMaterial({ color: "#E3B7A6", roughness: 0.5, emissive: new THREE.Color("#6A3A30"), emissiveIntensity: 0.15 }), []);
  const ossoM = useMemo(() => new THREE.MeshStandardMaterial({ color: "#F4EEDC", roughness: 0.45 }), []);
  const tubo = useMemo(() => novoTubo(90, 32), []);
  const tubM = useMemo(() => new THREE.MeshStandardMaterial({ color: "#9A907E", roughness: 0.6, emissive: new THREE.Color("#3A2A20"), emissiveIntensity: 0.15 }), []);
  const g = geos();
  const tubInst = useRef<THREE.InstancedMesh>(null);
  const sCut = sAnel(P.anel);
  const lens = [S_J[N_TR + P.anel + 1] - sCut, ...LENS.slice(N_TR + P.anel + 1)];
  const tt = P.t - P.tSolta;
  const sal = raboSoltoSalto(P.t, P.salto);
  const noAr = sm(sal.y / 0.8); // transição suave chão ↔ ar (sem pulo de forma)
  const yaw = lens.map((_, i) => mexidaRabo(tt, i, lens.length, (P.amp ?? 1) * mix(1, 0.45, noAr)));
  const pitch = lens.map((_, i) => noAr * 0.1 * Math.sin(i * 0.7 + tt * 4));
  const [, , hb0] = perfil(sCut);
  // apoio contínuo: no chão segue a altura do perfil; no ar vai mudando suavemente para reto (sem troca brusca de forma)
  const cad = cadeiaDe(new THREE.Vector3(0, hb0 + 0.03, 0), new THREE.Vector3(0, 0, -1), Y, lens, yaw, pitch, sCut, P.apoiado === false ? undefined : (s) => mix(perfil(s)[2] * 0.9 + 0.03, hb0 + 0.03, noAr));
  const A: Amostra[] = [];
  for (let i = 0; i < 90; i++) {
    const s = sCut + ((S_FIM - sCut) * i) / 89;
    const q = quadroEm(cad, s);
    const [w, ht, hb] = perfil(s);
    const k = i === 89 ? 0.001 : 1;
    A.push({ p: q.p, d: q.d, u: q.u, w: w * k, ht: ht * k, hb: hb * k, s });
  }
  escreveTubo(tubo, A, S_FIM);
  useLayoutEffect(() => {
    const T = tubInst.current;
    if (!T) return;
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), pos = new THREE.Vector3();
    let n = 0;
    for (let k = P.anel; k < N_RB; k++) {
      const s = TRONCO + (k + 0.15) * L_RB;
      if (s < sCut + 0.03) continue;
      const f = ((s - sCut) / (S_FIM - sCut)) * 89;
      const a = A[Math.floor(f)];
      const sd = new THREE.Vector3().crossVectors(a.d, a.u).normalize();
      const r = perfil(s)[0];
      for (const ang of [0.15, 0.8, 1.57, 2.34, 2.99]) {
        const h = Math.sin(ang) > 0 ? a.ht : a.hb;
        pos.copy(a.p).addScaledVector(sd, a.w * Math.cos(ang)).addScaledVector(a.u, h * Math.sin(ang));
        const nrm = sd.clone().multiplyScalar(Math.cos(ang)).addScaledVector(a.u, Math.sin(ang)).normalize().addScaledVector(a.d, -0.6).normalize();
        q.setFromUnitVectors(Y, nrm);
        const size = Math.max(0.025, r * 0.17);
        m4.compose(pos, q, sc.set(size * 0.9, size * 1.4, size * 0.9));
        T.setMatrixAt(n++, m4);
      }
    }
    T.count = n;
    T.instanceMatrix.needsUpdate = true;
  });
  // centro de giro da cambalhota = meio do pedaço
  const meio = quadroEm(cad, (sCut + S_FIM) / 2).p;
  const esc = (P.escala ?? (filhote ? 0.5 : 1)) * CM;
  return (
    <group position={P.position} rotation={P.rotation} scale={esc}>
      <group position={[0, sal.y, -sal.x * 1.2]}>
        <group position={meio} rotation={[sal.ang, 0, 0]}>
          <group position={meio.clone().negate()}>
            <mesh geometry={tubo} material={skin} castShadow receiveShadow />
            <Toco a={A[0]} m={toco} osso={ossoM} vira />
            <instancedMesh ref={tubInst} args={[g.tub, tubM, 80]} castShadow frustumCulled={false} />
          </group>
        </group>
      </group>
    </group>
  );
};

// ponto (cm, espaço local da lagartixa) num comprimento de arco s da coluna — para a cena prender a pata do gato etc.
export const pontoColuna = (P: LagartixaProps, s: number): V3 => {
  const ps = pose(P);
  const c = cadeiaDe(new THREE.Vector3(0, ps.Y, TRONCO), new THREE.Vector3(0, 0, -1), Y, LENS, ps.yaw, ps.pitch, 0, (x) => (x > TRONCO + 0.6 ? perfil(x)[2] * 0.9 + 0.03 : null));
  return quadroEm(c, s).p.toArray() as V3;
};
