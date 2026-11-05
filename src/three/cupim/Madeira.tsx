import { useLayoutEffect, useMemo } from "react";
import * as THREE from "three";
import { clamp01, escreveTubo, novoTubo, rnd, texCanvas, V3, Amostra } from "./CupimComum";

// =====================================================================
// MADEIRA + GALERIAS (cupim de madeira seca, Cryptotermes brevis). Unidade: cm.
// Referencial LOCAL da peça:
//   x = comprimento (0 … L, ao longo das fibras)
//   y = normal da face "da frente" (a que a câmera vê): a peça vai de y = −D/2 a +D/2
//   z = largura da face (−W/2 … +W/2)
// O corte longitudinal é o plano y = 0: metade de trás (y<0) fica; a "tampa" (y>0) abre.
// As galerias são centradas no plano y = 0 e escavadas metade em cada lado (seção elíptica:
// meia-largura w no plano, meia-altura r em y). A casca externa nunca é tocada (margem ≥ 0,8 cm).
// g (0..1) = idade da colônia: as galerias nascem e crescem pela frente, e alargam com a idade.
// =====================================================================

// ---------------- dados das galerias ----------------
export type Ponto = { x: number; z: number; s: number; w: number; r: number };
export type Ramo = { pts: Ponto[]; len: number; g0: number; vel: number; raiz: boolean; pai: number; sPai: number };
export type Galerias = { ramos: Ramo[]; x0: number; x1: number; meiaW: number; furo: { x: number; z: number; ramo: number; s: number } };
const DS = 0.05; // espaçamento das amostras (cm)

// Gera galerias determinísticas na faixa x ∈ [x0, x1], |z| ≤ meiaW.
// Rede ramificada: 2 ramos primários a partir do ninho, filhos a cada ~1,5–2,5 cm (até 3 níveis),
// todos escavando na MESMA velocidade (cm por unidade de g) — a rede cresce de dentro para fora.
export const gerarGalerias = (seed: number, x0: number, x1: number, meiaW: number, opts: { wBase?: number; rBase?: number; ramos?: number; z0?: number } = {}): Galerias => {
  const wB = opts.wBase ?? 0.34, rB = opts.rBase ?? 0.26;
  const maxR = opts.ramos ?? 22;
  const ramos: Ramo[] = [];
  const cx = x0 + (x1 - x0) * 0.42, cz = (rnd(seed, 1) - 0.5) * meiaW * 0.3;
  const R = (k: number) => rnd(seed * 31 + k, 7);
  const lim = Math.max(0.5, meiaW - wB * 2.4 - 0.25); // |z| máximo do eixo (casca lateral preservada)
  const tracar = (xs: number, zs: number, ang: number, len: number, k: number, wMul: number) => {
    const pts: Ponto[] = [];
    let x = xs, z = zs, a = ang;
    const nc = 1 + Math.floor(len / 3.5);
    const camaras = Array.from({ length: nc }, (_, i) => (i + 0.3 + R(k * 7 + i) * 0.5) / nc);
    const n = Math.max(2, Math.round(len / DS));
    for (let i = 0; i <= n; i++) {
      const s = i * DS;
      const f = s / len;
      let bump = 0;
      for (const c of camaras) bump = Math.max(bump, Math.exp(-Math.pow(((f - c) * len) / 0.45, 2)));
      const w = wB * wMul * (0.85 + 0.15 * Math.sin(s * 1.7 + k) + 0.75 * bump);
      const r = rB * wMul * (0.85 + 0.12 * Math.sin(s * 2.3 + k) + 0.45 * bump);
      pts.push({ x, z, s, w, r });
      const alvo = Math.cos(a) >= 0 ? 0 : Math.PI; // relaxa para a fibra
      a += (alvo - a) * 0.018 + Math.sin(s * 0.8 + k * 2.1) * 0.03;
      x += Math.cos(a) * DS;
      z += Math.sin(a) * DS;
      if (z > lim) { z = lim; a = Math.cos(a) >= 0 ? -0.15 : Math.PI + 0.15; }
      if (z < -lim) { z = -lim; a = Math.cos(a) >= 0 ? 0.15 : Math.PI - 0.15; }
      if (x < x0 || x > x1) break;
    }
    return pts;
  };
  const L1 = (x1 - cx) * 0.94, L2 = (cx - x0) * 0.94;
  const V = Math.max(L1, L2) / 0.55; // velocidade de escavação (cm por unidade de g)
  const mk = (pts: Ponto[], g0: number, raiz: boolean, pai: number, sPai: number): Ramo | null => {
    // corta o que não cabe até g = 0,97
    const maxLen = (0.97 - g0) * V;
    const cut = pts.filter((p) => p.s <= maxLen);
    if (cut.length < 8) return null;
    return { pts: cut, len: cut[cut.length - 1].s, g0, vel: V, raiz, pai, sPai };
  };
  const fila: { ramo: number; nivel: number }[] = [];
  const p1 = mk(tracar(cx, cz, 0.2, L1, 1, 1.15), 0, true, -1, 0);
  const p2 = mk(tracar(cx, cz, Math.PI - 0.25, L2, 2, 1.1), 0.02, true, -1, 0);
  if (p1) { ramos.push(p1); fila.push({ ramo: 0, nivel: 0 }); }
  if (p2) { ramos.push(p2); fila.push({ ramo: ramos.length - 1, nivel: 0 }); }
  let k = 0;
  while (fila.length && ramos.length < maxR) {
    const { ramo, nivel } = fila.shift()!;
    const P = ramos[ramo];
    if (nivel >= 3) continue;
    let s = 0.9 + R(k++) * 0.8;
    while (s < P.len - 0.6 && ramos.length < maxR) {
      const iP = Math.min(P.pts.length - 1, Math.round(s / DS));
      const q = P.pts[iP];
      const dir = Math.cos(Math.atan2(P.pts[Math.min(P.pts.length - 1, iP + 2)].z - q.z, P.pts[Math.min(P.pts.length - 1, iP + 2)].x - q.x)) >= 0 ? 0 : Math.PI;
      const lado = R(k++) < 0.5 ? 1 : -1;
      const ang = dir + lado * (0.55 + R(k++) * 0.75) * (dir === 0 ? 1 : -1);
      const len = (1.2 + R(k++) * 3.2) * (nivel === 0 ? 1.5 : nivel === 1 ? 1 : 0.6);
      const filho = mk(tracar(q.x, q.z, ang, len, 40 + k, nivel === 0 ? 0.92 : 0.8), P.g0 + q.s / P.vel + 0.015, false, ramo, q.s);
      if (filho) {
        ramos.push(filho);
        fila.push({ ramo: ramos.length - 1, nivel: nivel + 1 });
      }
      s += 1.4 + R(k++) * 1.4;
    }
  }
  // furo de expulsão: num ramo de nível 1 perto do meio; liga a galeria à face da frente (+y)
  let iF = 0, melhor = 1e9;
  ramos.forEach((Rm, i) => {
    if (i < 2) return;
    const p = Rm.pts[Math.floor(Rm.pts.length * 0.55)];
    const d = Math.abs(p.x - (x0 + (x1 - x0) * 0.3)) + Math.abs(p.z) * 0.5;
    if (d < melhor) { melhor = d; iF = i; }
  });
  const pf = ramos[iF].pts[Math.floor(ramos[iF].pts.length * 0.55)];
  const z0 = opts.z0 ?? 0;
  if (z0) ramos.forEach((Rm) => Rm.pts.forEach((p) => (p.z += z0)));
  return { ramos, x0, x1, meiaW, furo: { x: pf.x, z: pf.z, ramo: iF, s: pf.s } };
};
// junta várias colônias numa peça só (ex.: 20 famílias numa porta). furo = o da primeira.
export const mesclarGalerias = (lista: Galerias[]): Galerias => {
  const ramos: Ramo[] = [];
  lista.forEach((G) => {
    const base = ramos.length;
    G.ramos.forEach((R) => ramos.push({ ...R, pai: R.pai >= 0 ? R.pai + base : -1 }));
  });
  const f = lista[0].furo;
  return { ramos, x0: Math.min(...lista.map((g) => g.x0)), x1: Math.max(...lista.map((g) => g.x1)), meiaW: Math.max(...lista.map((g) => g.meiaW)), furo: { ...f } };
};

// seção efetiva de uma amostra na idade g (0 se ainda não escavada). Pontas arredondadas.
export const secao = (R: Ramo, p: Ponto, g: number) => {
  const frente = (g - R.g0) * R.vel;
  if (frente <= 0 || p.s > frente) return { w: 0, r: 0 };
  const idade = g - (R.g0 + p.s / R.vel);
  const larg = 0.55 + 0.45 * clamp01(idade / 0.3); // alarga com o tempo
  let w = p.w * larg, r = p.r * larg;
  const dF = frente - p.s; // ponta (frente) arredondada
  if (dF < w) {
    const k = Math.sqrt(Math.max(0, 1 - Math.pow((w - dF) / w, 2)));
    w *= k;
    r *= k;
  }
  if (R.raiz && p.s < w) {
    const k = Math.sqrt(Math.max(0, 1 - Math.pow((w - p.s) / w, 2)));
    w = Math.max(w * 0.999, w * k);
  }
  return { w, r };
};

// posição de um bicho andando no CHÃO da galeria (ramo i, comprimento s): ponto local, direção (yaw) e seção
export const naGaleria = (G: Galerias, i: number, s: number, g = 1) => {
  const R = G.ramos[i];
  const ss = Math.max(0, Math.min(R.len - 1e-3, s));
  const k = ss / DS;
  const a = R.pts[Math.min(R.pts.length - 1, Math.floor(k))], b = R.pts[Math.min(R.pts.length - 1, Math.floor(k) + 1)];
  const u = k - Math.floor(k);
  const x = a.x + (b.x - a.x) * u, z = a.z + (b.z - a.z) * u;
  const i0 = Math.max(0, Math.floor(k) - 3), i1 = Math.min(R.pts.length - 1, Math.floor(k) + 3);
  const dx = R.pts[i1].x - R.pts[i0].x, dz = R.pts[i1].z - R.pts[i0].z;
  const sec = secao(R, a, g);
  // yaw para usar com rotation=[0,yaw,0] num bicho com frente +z (no referencial da peça, chão = plano y)
  const yaw = Math.atan2(dx, dz);
  return { p: [x, -sec.r, z] as V3, yaw, w: sec.w, r: sec.r, frente: (g - R.g0) * R.vel };
};

// ---------------- texturas ----------------
// Verniz (face externa): cedro/cedrinho envernizado, veios "catedral" + fibras finas. 1 textura = 40 × 10 cm.
const TX = 40, TZ = 10;
const texVerniz = () =>
  texCanvas("cupVerniz", 2048, 512, (g, W, H) => {
    const img = g.createImageData(W, H);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const u = x / W, v = y / H;
        // veios: linhas quase paralelas ao comprimento com ondulação lenta (catedral perto do centro)
        const ond = Math.sin(u * 6.28 * 2 + v * 3) * 0.04 + Math.sin(u * 6.28 * 5 + 1.3) * 0.01;
        const cat = Math.exp(-Math.pow((v - 0.5) / 0.25, 2)) * 0.12 * Math.sin(u * 6.28 * 1.0);
        const anel = (v + ond + cat) * 26;
        const fr = anel - Math.floor(anel);
        const tardio = Math.pow(Math.max(0, Math.sin(fr * Math.PI)), 6); // lenho tardio escuro
        const fib = (rnd(y * 7 + Math.floor(x / 37), 3) - 0.5) * 0.05 + (rnd(y * 13 + 1, 4) - 0.5) * 0.04;
        const lv = 1 - tardio * 0.32 + fib;
        const k = (y * W + x) * 4;
        img.data[k] = Math.max(0, Math.min(255, 168 * lv));
        img.data[k + 1] = Math.max(0, Math.min(255, 98 * lv));
        img.data[k + 2] = Math.max(0, Math.min(255, 54 * lv));
        img.data[k + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    // poros (traços curtos e escuros ao longo da fibra)
    g.fillStyle = "rgba(60,28,12,0.35)";
    for (let i = 0; i < 2600; i++) g.fillRect(rnd(i, 11) * W, rnd(i, 12) * H, 4 + rnd(i, 13) * 12, 1);
  });
const texVernizBump = () =>
  texCanvas("cupVernizB", 1024, 256, (g, W, H) => {
    const img = g.createImageData(W, H);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const v = 0.5 + (rnd(y * 5 + Math.floor(x / 23), 1) - 0.5) * 0.5 + (rnd(y, 2) - 0.5) * 0.3;
        const k = (y * W + x) * 4;
        img.data[k] = img.data[k + 1] = img.data[k + 2] = Math.round(clamp01(v) * 255);
        img.data[k + 3] = 255;
      }
    g.putImageData(img, 0, 0);
  }, false);
// Madeira crua (lado de dentro / corte): mais clara, fibras bem visíveis.
const texCrua = () =>
  texCanvas("cupCrua", 2048, 512, (g, W, H) => {
    const img = g.createImageData(W, H);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const u = x / W, v = y / H;
        const anel = (v + Math.sin(u * 6.28 * 2 + 0.7) * 0.03) * 22;
        const fr = anel - Math.floor(anel);
        const tardio = Math.pow(Math.max(0, Math.sin(fr * Math.PI)), 5);
        const fib = (rnd(y * 11 + Math.floor(x / 29), 5) - 0.5) * 0.09 + (rnd(y * 3 + 7, 6) - 0.5) * 0.05;
        const lv = 1 - tardio * 0.22 + fib;
        const k = (y * W + x) * 4;
        img.data[k] = Math.max(0, Math.min(255, 222 * lv));
        img.data[k + 1] = Math.max(0, Math.min(255, 168 * lv));
        img.data[k + 2] = Math.max(0, Math.min(255, 116 * lv));
        img.data[k + 3] = 255;
      }
    g.putImageData(img, 0, 0);
  });
const texCruaBump = () =>
  texCanvas("cupCruaB", 1024, 512, (g, W, H) => {
    const img = g.createImageData(W, H);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        // fibras: sulcos finos e longos ao longo de x
        const v = 0.5 + (rnd(y * 3 + Math.floor(x / 61), 8) - 0.5) * 0.7 + (rnd(y, 9) - 0.5) * 0.35;
        const k = (y * W + x) * 4;
        img.data[k] = img.data[k + 1] = img.data[k + 2] = Math.round(clamp01(v) * 255);
        img.data[k + 3] = 255;
      }
    g.putImageData(img, 0, 0);
  }, false);
// relevo de fibras fino (repete 4× a textura de fibras) — fibras nítidas nos closes de macro
let BF: THREE.Texture | null = null;
const bumpFino = () => {
  if (BF) return BF;
  BF = texCruaBump().clone();
  BF.repeat.set(4, 4);
  BF.needsUpdate = true;
  return BF;
};
// chão de madeira crua (para closes de anatomia): plano horizontal y = 0, lado `tam` cm, fibras ao longo de x
export const ChaoCru: React.FC<{ tam?: number; position?: V3 }> = ({ tam = 12, position }) => {
  const m = useMemo(() => new THREE.MeshStandardMaterial({ map: texCrua(), bumpMap: bumpFino(), bumpScale: 0.9, roughness: 0.85 }), []);
  const g = useMemo(() => quad([[-tam / 2, 0, tam / 2], [tam / 2, 0, tam / 2], [tam / 2, 0, -tam / 2], [-tam / 2, 0, -tam / 2]], [[0, 0.15], [tam / TX, 0.15], [tam / TX, 0.15 + tam / TZ], [0, 0.15 + tam / TZ]]), [tam]);
  return <mesh geometry={g} material={m} position={position} receiveShadow />;
};
// Topo (corte transversal): anéis de crescimento com centro fora da peça.
const texTopo = () =>
  texCanvas("cupTopo", 512, 512, (g, W, H) => {
    const img = g.createImageData(W, H);
    const cx = W * 0.3, cy = -H * 1.6;
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const d = Math.hypot(x - cx, y - cy) / 26;
        const fr = d - Math.floor(d);
        const tardio = Math.pow(Math.max(0, Math.sin(fr * Math.PI)), 4);
        const raio = Math.abs(Math.sin(Math.atan2(y - cy, x - cx) * 140)) > 0.985 ? 0.06 : 0;
        const lv = 1 - tardio * 0.3 - raio + (rnd(x * 517 + y, 1) - 0.5) * 0.08;
        const k = (y * W + x) * 4;
        img.data[k] = Math.max(0, Math.min(255, 196 * lv));
        img.data[k + 1] = Math.max(0, Math.min(255, 132 * lv));
        img.data[k + 2] = Math.max(0, Math.min(255, 84 * lv));
        img.data[k + 3] = 255;
      }
    g.putImageData(img, 0, 0);
  }, true, false);

// ---------------- materiais ----------------
// Injeta: posição local da peça (atributo position, geometria já está no referencial da peça) e
// descarte dentro da faixa de raio-x [uA, uB] em x.
type Faixa = { uA: { value: number }; uB: { value: number }; uC: { value: THREE.Vector4 }; uF: { value: THREE.Vector4 } };
const comFaixa = (m: THREE.MeshStandardMaterial, U: Faixa, chave: string) => {
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uA = U.uA;
    sh.uniforms.uB = U.uB;
    sh.uniforms.uC = U.uC;
    sh.uniforms.uF = U.uF;
    sh.vertexShader = "varying vec3 vLoc;\n" + sh.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\n vLoc = position;");
    sh.fragmentShader = "varying vec3 vLoc; uniform float uA; uniform float uB; uniform vec4 uC; uniform vec4 uF;\n" + sh.fragmentShader.replace("void main() {", "void main() {\n if (vLoc.x > uA && vLoc.x < uB) discard;\n if (vLoc.y > uC.w && length(vLoc.xz - uC.xy) < uC.z) discard;\n if (vLoc.y > uF.w && length(vLoc.xz - uF.xy) < uF.z) discard;");
  };
  m.customProgramCacheKey = () => "cupFaixa" + chave;
  return m;
};

// ---------------- geometria das faces (no referencial da peça) ----------------
// retângulo com 4 cantos (ordem anti-horária vista pela normal) e uv por coordenadas
const quad = (P: V3[], uv: [number, number][], seg: [number, number] = [1, 1]) => {
  const g = new THREE.PlaneGeometry(1, 1, seg[0], seg[1]);
  const pos = g.attributes.position as THREE.BufferAttribute, U = g.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const a = pos.getX(i) + 0.5, b = pos.getY(i) + 0.5; // a: 0→1 (P0→P1), b: 0→1 (P0→P3)
    const p = [0, 1, 2].map((k) => P[0][k] + (P[1][k] - P[0][k]) * a + (P[3][k] - P[0][k]) * b);
    pos.setXYZ(i, p[0], p[1], p[2]);
    U.setXY(i, uv[0][0] + (uv[1][0] - uv[0][0]) * a + (uv[3][0] - uv[0][0]) * b, uv[0][1] + (uv[1][1] - uv[0][1]) * a + (uv[3][1] - uv[0][1]) * b);
  }
  g.computeVertexNormals();
  return g;
};

// faces externas de uma metade (y de ya a yb). lado: +1 = tampa (face y=+D/2), −1 = fundo (face y=−D/2)
const facesMetade = (L: number, W: number, ya: number, yb: number, lado: 1 | -1) => {
  const w = W / 2;
  const long: THREE.BufferGeometry[] = [];
  const topo: THREE.BufferGeometry[] = [];
  const yF = lado > 0 ? yb : ya; // face larga externa
  // face larga (normal ±y)
  if (lado > 0) long.push(quad([[0, yF, w], [L, yF, w], [L, yF, -w], [0, yF, -w]], [[0, w / TZ], [L / TX, w / TZ], [L / TX, -w / TZ], [0, -w / TZ]], [Math.ceil(L / 4), 2]));
  else long.push(quad([[0, yF, -w], [L, yF, -w], [L, yF, w], [0, yF, w]], [[0, -w / TZ], [L / TX, -w / TZ], [L / TX, w / TZ], [0, w / TZ]], [Math.ceil(L / 4), 2]));
  // laterais (normal ±z): uv v = y deslocado (veio diferente do da face larga)
  long.push(quad([[0, ya, w], [L, ya, w], [L, yb, w], [0, yb, w]], [[0, 0.3 + ya / TZ], [L / TX, 0.3 + ya / TZ], [L / TX, 0.3 + yb / TZ], [0, 0.3 + yb / TZ]], [Math.ceil(L / 4), 1]));
  long.push(quad([[L, ya, -w], [0, ya, -w], [0, yb, -w], [L, yb, -w]], [[L / TX, 0.6 + ya / TZ], [0, 0.6 + ya / TZ], [0, 0.6 + yb / TZ], [L / TX, 0.6 + yb / TZ]], [Math.ceil(L / 4), 1]));
  // topos (normal ±x)
  const s = 1 / 12;
  topo.push(quad([[L, ya, w], [L, ya, -w], [L, yb, -w], [L, yb, w]], [[0.5 + w * s, 0.3 + ya * s], [0.5 - w * s, 0.3 + ya * s], [0.5 - w * s, 0.3 + yb * s], [0.5 + w * s, 0.3 + yb * s]]));
  topo.push(quad([[0, ya, -w], [0, ya, w], [0, yb, w], [0, yb, -w]], [[0.5 - w * s, 0.3 + ya * s], [0.5 + w * s, 0.3 + ya * s], [0.5 + w * s, 0.3 + yb * s], [0.5 - w * s, 0.3 + yb * s]]));
  return { long, topo };
};

// ---------------- face do corte (y = 0) com as galerias escavadas ----------------
// Grade fina só na região das galerias; fora dela, planos lisos. Profundidade = união de "discos elípticos".
const PASSO = 0.055;
const faceCorte = (L: number, W: number, hx0: number, hx1: number) => {
  const w = W / 2;
  const nx = Math.ceil((hx1 - hx0) / PASSO), nz = Math.ceil(W / PASSO);
  const g = new THREE.PlaneGeometry(1, 1, nx, nz);
  const pos = g.attributes.position as THREE.BufferAttribute, U = g.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const a = pos.getX(i) + 0.5, b = pos.getY(i) + 0.5;
    const x = hx0 + (hx1 - hx0) * a, z = w - W * b; // normal +y
    pos.setXYZ(i, x, 0, z);
    U.setXY(i, x / TX, 0.15 + z / TZ);
  }
  g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(pos.count * 3).fill(1), 3));
  g.userData = { nx, nz };
  g.computeVertexNormals();
  const lisos: THREE.BufferGeometry[] = [];
  if (hx0 > 0.001) lisos.push(quad([[0, 0, w], [hx0, 0, w], [hx0, 0, -w], [0, 0, -w]], [[0, 0.15 + w / TZ], [hx0 / TX, 0.15 + w / TZ], [hx0 / TX, 0.15 - w / TZ], [0, 0.15 - w / TZ]]));
  if (hx1 < L - 0.001) lisos.push(quad([[hx1, 0, w], [L, 0, w], [L, 0, -w], [hx1, 0, -w]], [[hx1 / TX, 0.15 + w / TZ], [L / TX, 0.15 + w / TZ], [L / TX, 0.15 - w / TZ], [hx1 / TX, 0.15 - w / TZ]]));
  return { grade: g, lisos, nx, nz };
};
// escreve a profundidade na grade para a idade g
const escava = (geo: THREE.BufferGeometry, G: Galerias, g: number, destaque = 0) => {
  const pos = geo.attributes.position as THREE.BufferAttribute, col = geo.attributes.color as THREE.BufferAttribute;
  // hash espacial das amostras
  const C = 0.6;
  const mapa = new Map<number, number[]>();
  const disc: { x: number; z: number; w: number; r: number }[] = [];
  G.ramos.forEach((R) => {
    for (const p of R.pts) {
      const s = secao(R, p, g);
      if (s.w <= 0.001) continue;
      const id = disc.length;
      disc.push({ x: p.x, z: p.z, w: s.w, r: s.r });
      const i0 = Math.floor((p.x - s.w) / C), i1 = Math.floor((p.x + s.w) / C), j0 = Math.floor((p.z - s.w) / C), j1 = Math.floor((p.z + s.w) / C);
      for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
        const k = i * 10007 + j;
        const l = mapa.get(k);
        if (l) l.push(id);
        else mapa.set(k, [id]);
      }
    }
  });
  const D = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const l = mapa.get(Math.floor(x / C) * 10007 + Math.floor(z / C));
    let dep = 0;
    if (l)
      for (const id of l) {
        const d = disc[id];
        const q = ((x - d.x) * (x - d.x) + (z - d.z) * (z - d.z)) / (d.w * d.w);
        if (q < 1) dep = Math.max(dep, d.r * Math.sqrt(1 - q));
      }
    D[i] = dep;
  }
  // suaviza (2 passadas 3×3): tira os "degraus" da grade nas paredes íngremes
  const { nx, nz } = geo.userData as { nx: number; nz: number };
  const cols = nx + 1;
  const T = new Float32Array(pos.count);
  for (let pass = 0; pass < 2; pass++) {
    for (let r = 0; r <= nz; r++)
      for (let c = 0; c <= nx; c++) {
        let sum = 0, n = 0;
        for (let dr = -1; dr <= 1; dr++)
          for (let dc = -1; dc <= 1; dc++) {
            const rr = r + dr, cc = c + dc;
            if (rr < 0 || rr > nz || cc < 0 || cc > nx) continue;
            sum += D[rr * cols + cc];
            n++;
          }
        T[r * cols + c] = sum / n;
      }
    D.set(T);
  }
  for (let i = 0; i < pos.count; i++) {
    const dep = D[i] < 0.004 ? 0 : D[i];
    pos.setY(i, -dep);
    const k = Math.min(1, dep / 0.3); // fundo da galeria mais escuro e mais quente (oclusão), legível
    const kd = destaque * Math.min(1, dep / 0.04);
    col.setXYZ(i, (1 - 0.5 * k) * (1 - kd) + 1.25 * kd, (1 - 0.58 * k) * (1 - kd) + 0.3 * kd, (1 - 0.66 * k) * (1 - kd) + 0.22 * kd);
  }
  pos.needsUpdate = true;
  col.needsUpdate = true;
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
};

// tubo (raio-x) de um ramo na idade g — mesma seção das galerias escavadas
const escreveRamo = (geo: THREE.BufferGeometry, R: Ramo, g: number) => {
  const A: Amostra[] = [];
  const up = new THREE.Vector3(0, 1, 0);
  const n = R.pts.length;
  for (let i = 0; i < n; i++) {
    const p = R.pts[i];
    const q = R.pts[Math.min(n - 1, i + 1)], o = R.pts[Math.max(0, i - 1)];
    const d = new THREE.Vector3(q.x - o.x, 0, q.z - o.z).normalize();
    const s = secao(R, p, g);
    const w = s.w > 0 ? Math.max(0.0005, s.w) : 0, r = s.w > 0 ? Math.max(0.0005, s.r) : 0; // trecho ainda não escavado: tubo de raio 0 (antes virava um "fio" visível)
    A.push({ p: new THREE.Vector3(p.x, 0, p.z), d, u: up, w, ht: r, hb: r, s: p.s });
  }
  escreveTubo(geo, A, 10);
};

// ---------------- PEÇA DE MADEIRA ----------------
export type PecaProps = {
  L: number; // comprimento (cm)
  W: number; // largura da face (cm)
  D: number; // espessura (cm)
  gal: Galerias;
  g?: number; // idade das galerias 0..1
  abrir?: number; // 0..1 corte longitudinal abrindo
  modoAbrir?: "livro" | "tirar"; // livro: a tampa gira na dobradiça z=+W/2 e deita ao lado (bancada); tirar: a tampa sai para +y (peça na parede)
  tirarDist?: number; // cm (modo tirar)
  raioX?: { a: number; b: number; borda?: number }; // faixa transparente em x (cm); borda = largura da linha de varredura
  furo?: boolean; // furinho de expulsão na face da frente (buraco de 1 mm de verdade)
  furoTampado?: boolean; // o soldado tapa o furo com a cabeça: sem o fundo escuro (a cabeça aparece no buraco)
  amassado?: { x: number; z: number; r: number; k: number }; // dedo afundando a face da frente: buraco de raio r (cm) em (x,z), k 0..1 = profundidade; mostra galerias e cupins por baixo
  destaque?: number; // 0..1 pinta de vermelho a madeira que FALTA (fundo das galerias no corte aberto)
  sombras?: boolean;
  position?: V3;
  rotation?: V3;
  children?: React.ReactNode; // coisas DENTRO da peça (referencial local: cupins, grânulos)
  tampaFilhos?: React.ReactNode; // coisas presas na tampa
};

export const PecaMadeira: React.FC<PecaProps> = (P) => {
  const { L, W, D, gal } = P;
  const g = P.g ?? 1;
  const abrir = clamp01(P.abrir ?? 0);
  const xr = P.raioX;
  const faixa = useMemo<Faixa>(() => ({ uA: { value: 1e9 }, uB: { value: -1e9 }, uC: { value: new THREE.Vector4(0, 0, 0, 1e9) }, uF: { value: new THREE.Vector4(0, 0, 0, 1e9) } }), []);
  // furinho de verdade (buraco na casca) quando há furo
  faixa.uF.value.set(gal.furo.x, gal.furo.z, P.furo ? 0.05 : 0, P.furo ? D / 2 - 0.004 : 1e9);
  faixa.uA.value = xr ? xr.a : 1e9;
  faixa.uB.value = xr ? xr.b : -1e9;
  const am = P.amassado && P.amassado.k > 0.001 ? P.amassado : null;
  faixa.uC.value.set(am ? am.x : 0, am ? am.z : 0, am ? am.r * 1.5 : 0, am ? D / 2 - 0.004 : 1e9);
  const M = useMemo(() => {
    const verniz = comFaixa(new THREE.MeshStandardMaterial({ map: texVerniz(), bumpMap: texVernizBump(), bumpScale: 0.6, roughness: 0.42, metalness: 0 }), faixa, "v");
    const topo = comFaixa(new THREE.MeshStandardMaterial({ map: texTopo(), roughness: 0.85 }), faixa, "t");
    const corte = new THREE.MeshStandardMaterial({ map: texCrua(), bumpMap: bumpFino(), bumpScale: 0.9, roughness: 0.85, vertexColors: true });
    const corteLiso = new THREE.MeshStandardMaterial({ map: texCrua(), bumpMap: bumpFino(), bumpScale: 0.9, roughness: 0.85 });
    const tubo = new THREE.MeshStandardMaterial({ color: "#7A4E2E", roughness: 0.9, side: THREE.BackSide, emissive: new THREE.Color("#3A2010"), emissiveIntensity: 0.35, map: texCrua() });
    // volume interno (só aparece pela faixa): âmbar, sem luz, fibras
    const interior = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      uniforms: { uMap: { value: texCrua() } },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader: `uniform sampler2D uMap; varying vec2 vUv; void main(){ vec3 c = texture2D(uMap, vUv).rgb; gl_FragColor = vec4(c*vec3(0.78,0.66,0.52), 1.0);
        #include <colorspace_fragment>
      }`,
    });
    // casca fantasma (a superfície continua inteira): transparente só dentro da faixa, linha de varredura nas bordas
    const fantasma = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { uA: faixa.uA, uB: faixa.uB, uMap: { value: texVerniz() }, uBorda: { value: 0.25 } },
      vertexShader: `varying vec3 vLoc; varying vec3 vN; varying vec3 vV; varying vec2 vUv;
        void main(){ vLoc = position; vUv = uv; vN = normalize(normalMatrix*normal); vec4 mv = modelViewMatrix*vec4(position,1.0); vV = -mv.xyz; gl_Position = projectionMatrix*mv; }`,
      fragmentShader: `uniform float uA; uniform float uB; uniform float uBorda; uniform sampler2D uMap; varying vec3 vLoc; varying vec3 vN; varying vec3 vV; varying vec2 vUv;
        void main(){
          if (vLoc.x <= uA || vLoc.x >= uB) discard;
          float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.0);
          vec3 tex = texture2D(uMap, vUv).rgb;
          float e = max(1.0 - smoothstep(0.0, uBorda, vLoc.x - uA), 1.0 - smoothstep(0.0, uBorda, uB - vLoc.x));
          vec3 c = mix(tex * 1.25, vec3(0.80, 0.93, 1.0), 0.45) + e * vec3(0.55, 0.9, 1.0);
          float a = 0.14 + 0.35 * f + 0.12 * (1.0 - tex.r) + e * 0.75;
          gl_FragColor = vec4(c, clamp(a, 0.0, 1.0));
          #include <colorspace_fragment>
        }`,
    });
    const furo = new THREE.MeshBasicMaterial({ color: "#1C0F07", polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
    const furoBorda = new THREE.MeshStandardMaterial({ color: "#C29368", roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    return { verniz, topo, corte, corteLiso, tubo, interior, fantasma, furo, furoBorda };
  }, [faixa]);
  if (xr) M.fantasma.uniforms.uBorda.value = xr.borda ?? 0.25;

  const geo = useMemo(() => {
    const atras = facesMetade(L, W, -D / 2, 0, -1);
    const tampa = facesMetade(L, W, 0, D / 2, 1);
    const tubos = gal.ramos.map((R) => novoTubo(R.pts.length, 14));
    const caixa = new THREE.BoxGeometry(L - 0.04, D - 0.06, W - 0.06).translate(L / 2, 0, 0); // volume interno (BackSide) — 0,3 mm para dentro: a face de trás não fica coplanar com a parede/vizinhos (piscava no raio-x)
    return { atras, tampa, tubos, caixa };
  }, [L, W, D, gal]);
  const aberto0 = abrir > 0.0005;
  // grade do corte só existe quando a peça abre (economiza memória nas peças grandes)
  const corteG = useMemo(() => (aberto0 ? faceCorte(L, W, Math.max(0, gal.x0 - 0.6), Math.min(L, gal.x1 + 0.6)) : null), [aberto0, L, W, gal]);
  // cratera do dedo: casca envernizada dobrada para dentro, bordas lascadas
  const cratera = useMemo(() => {
    if (!am) return null;
    const g = new THREE.RingGeometry(am.r, am.r * 1.5, 48, 4);
    const pos = g.attributes.position as THREE.BufferAttribute, uv = g.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i);
      const rr = Math.hypot(x, y), a = Math.atan2(y, x);
      const u = (am.r * 1.5 - rr) / (am.r * 0.5); // 0 na borda externa, 1 na interna
      const lasca = 1 + 0.18 * u * Math.sin(a * 7 + Math.sin(a * 13) * 2);
      const px = am.x + Math.cos(a) * rr * lasca, pz = am.z + Math.sin(a) * rr * lasca;
      const py = D / 2 - am.k * 0.35 * Math.pow(u, 1.6);
      pos.setXYZ(i, px, py, pz);
      uv.setXY(i, px / TX, pz / TZ);
    }
    g.computeVertexNormals();
    return g;
  }, [am?.x, am?.z, am?.r, am?.k, D]);

  const aberto = aberto0;
  useLayoutEffect(() => {
    if (corteG) escava(corteG.grade, gal, g, P.destaque ?? 0);
  }, [corteG, g, gal, P.destaque]);
  const dentro = !!xr || !!am;
  useLayoutEffect(() => {
    if (dentro) gal.ramos.forEach((R, i) => escreveRamo(geo.tubos[i], R, g));
  }, [dentro, g, gal, geo]);

  const sombras = P.sombras ?? true;
  // transformação da tampa
  const modo = P.modoAbrir ?? "livro";
  let tampaPos: V3 = [0, 0, 0], tampaRot: V3 = [0, 0, 0];
  if (modo === "livro") {
    // gira em torno do eixo x passando por (y=0, z=+W/2)… dobradiça na aresta de cima
    const th = abrir * Math.PI; // + = a tampa sobe primeiro e deita do lado +z
    tampaRot = [th, 0, 0];
    tampaPos = [0, (W / 2) * Math.sin(th), W / 2 - (W / 2) * Math.cos(th)];
  } else {
    tampaPos = [0, abrir * (P.tirarDist ?? 12), 0];
  }

  const furoEl = P.furo ? (
    <group position={[gal.furo.x, D / 2, gal.furo.z]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]} material={M.furoBorda}>
        <ringGeometry args={[0.05, 0.085, 24]} />
      </mesh>
      {P.furoTampado ? null : (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.03, 0]} material={M.furo}>
          <circleGeometry args={[0.052, 24]} />
        </mesh>
      )}
    </group>
  ) : null;

  return (
    <group position={P.position} rotation={P.rotation}>
      {/* metade de trás */}
      {geo.atras.long.map((gg, i) => <mesh key={"al" + i} geometry={gg} material={M.verniz} castShadow={sombras} receiveShadow={sombras} />)}
      {geo.atras.topo.map((gg, i) => <mesh key={"at" + i} geometry={gg} material={M.topo} castShadow={sombras} receiveShadow={sombras} />)}
      {corteG ? (
        <>
          <mesh geometry={corteG.grade} material={M.corte} receiveShadow={sombras} castShadow={false} />
          {corteG.lisos.map((gg, i) => <mesh key={"cl" + i} geometry={gg} material={M.corteLiso} receiveShadow={sombras} />)}
        </>
      ) : null}
      {/* tampa */}
      <group position={tampaPos} rotation={tampaRot}>
        {geo.tampa.long.map((gg, i) => <mesh key={"tl" + i} geometry={gg} material={M.verniz} castShadow={sombras} receiveShadow={sombras} />)}
        {geo.tampa.topo.map((gg, i) => <mesh key={"tt" + i} geometry={gg} material={M.topo} castShadow={sombras} receiveShadow={sombras} />)}
        {corteG ? (
          <group scale={[1, -1, 1]}>
            <mesh geometry={corteG.grade} material={M.corte} receiveShadow={sombras} />
            {corteG.lisos.map((gg, i) => <mesh key={"tcl" + i} geometry={gg} material={M.corteLiso} receiveShadow={sombras} />)}
          </group>
        ) : null}
        {furoEl}
        {P.tampaFilhos}
      </group>
      {/* raio-x: volume interno, túneis e casca fantasma */}
      {cratera && !aberto ? <mesh geometry={cratera} material={M.verniz} castShadow={sombras} receiveShadow={sombras} /> : null}
      {dentro && !aberto ? (
        <>
          <mesh geometry={geo.caixa} material={M.interior} />
          {geo.tubos.map((gg, i) => <mesh key={"tb" + i} geometry={gg} material={M.tubo} />)}
          {xr ? geo.atras.long.concat(geo.tampa.long).map((gg, i) => <mesh key={"fa" + i} geometry={gg} material={M.fantasma} renderOrder={20 + i} /> /* ordem fixa: sem troca de ordem entre faces transparentes quando a câmera anda (piscava) */) : null}
          {P.furo ? (
            <mesh position={[gal.furo.x, D / 4, gal.furo.z]} material={M.tubo}>
              <cylinderGeometry args={[0.07, 0.08, D / 2, 16, 1, true]} />
            </mesh>
          ) : null}
        </>
      ) : null}
      {P.children}
    </group>
  );
};

// x (cm) onde a seção transversal corta mais galeria (área de furos máxima)
export const melhorSecao = (gal: Galerias, g = 1) => {
  let best = (gal.x0 + gal.x1) / 2, bestA = -1;
  for (let x = gal.x0 + 1; x < gal.x1 - 1; x += 0.25) {
    let a = 0;
    gal.ramos.forEach((R) => {
      for (let i = 1; i < R.pts.length; i++) {
        const p = R.pts[i - 1], q = R.pts[i];
        if ((p.x - x) * (q.x - x) > 0) continue;
        const s = secao(R, p, g);
        a += s.w * s.r;
      }
    });
    if (a > bestA) { bestA = a; best = x; }
  }
  return best;
};
// ---------------- SEÇÃO TRANSVERSAL (comparação "menos material") ----------------
// Fatia fina (espessura e) em x = xs: retângulo D × W com os furos das galerias na idade g.
export const SecaoTransversal: React.FC<{ gal: Galerias; W: number; D: number; xs: number; g?: number; e?: number; destaque?: number; position?: V3; rotation?: V3 }> = ({ gal, W, D, xs, g = 1, e = 0.6, destaque = 0, position, rotation }) => {
  const furos = useMemo(() => {
    if (xs < 0) xs = melhorSecao(gal, g);
    const out: { z: number; w: number; r: number }[] = [];
    gal.ramos.forEach((R) => {
      for (let i = 1; i < R.pts.length; i++) {
        const a = R.pts[i - 1], b = R.pts[i];
        if ((a.x - xs) * (b.x - xs) > 0) continue;
        const s = secao(R, a, g);
        if (s.w < 0.01) continue;
        const ang = Math.atan2(b.z - a.z, b.x - a.x);
        out.push({ z: a.z, w: Math.min(s.w / Math.max(0.35, Math.abs(Math.cos(ang))), s.w * 2.2), r: s.r });
      }
    });
    return out;
  }, [gal, xs, g]);
  const geo = useMemo(() => {
    const sh = new THREE.Shape();
    sh.moveTo(-W / 2, -D / 2);
    sh.lineTo(W / 2, -D / 2);
    sh.lineTo(W / 2, D / 2);
    sh.lineTo(-W / 2, D / 2);
    sh.closePath();
    for (const f of furos) {
      const h = new THREE.Path();
      h.absellipse(f.z, 0, f.w, f.r, 0, Math.PI * 2, true, 0);
      sh.holes.push(h);
    }
    const gg = new THREE.ExtrudeGeometry(sh, { depth: e, bevelEnabled: false, curveSegments: 24 });
    // uv da face: coordenadas em cm → textura de topo
    const pos = gg.attributes.position as THREE.BufferAttribute, U = gg.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) U.setXY(i, 0.5 + pos.getX(i) / 12, 0.3 + pos.getY(i) / 12);
    return gg;
  }, [furos, W, D, e]);
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ map: texTopo(), roughness: 0.85 }), []);
  const borda = useMemo(() => new THREE.MeshBasicMaterial({ color: "#FF3B30", transparent: true, opacity: 1, depthWrite: true }), []);
  borda.opacity = destaque;
  return (
    <group position={position} rotation={rotation}>
      <mesh geometry={geo} material={mat} castShadow receiveShadow />
      {destaque > 0.01
        ? furos.map((f, i) => (
            <mesh key={i} position={[f.z, 0, e + 0.004]} scale={[f.w, f.r, 1]} material={borda} renderOrder={5}>
              <ringGeometry args={[0.86, 1.0, 40]} />
            </mesh>
          ))
        : null}
    </group>
  );
};

// peça lisa (sem galerias) — batente do outro lado, travessa, etc.
export const GAL_VAZIA: Galerias = { ramos: [], x0: 0, x1: 0, meiaW: 1, furo: { x: 0, z: 0, ramo: 0, s: 0 } };
export { texVerniz };
