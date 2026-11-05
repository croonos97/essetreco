import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { getInputProps } from "remotion";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { Amostra, catmull, escreveTubo, novoTubo } from "../animais/LagartixaComum";
import { clamp01, CORTE_NENHUM, loftGeo, matAve, MatAve, matFantasma, mix, rnd, Secao, sm, V3 } from "./PomboComum";

// =====================================================================
// AVE GENÉRICA (pombo adulto, filhote e carcará usam o mesmo gerador).
// Unidade: cm. Referencial da raiz: chão = y 0 entre os pés, FRENTE = +z, +x = lado ESQUERDO da ave.
// Corpo: um único tubo contínuo cloaca → dorso → peito → pescoço (sem emenda no peito);
// cabeça = loft próprio, encaixado na ponta do pescoço; bico em 2 mandíbulas (a de baixo abre).
// Pernas: coxa emplumada + tarso + dedos em lofts contínuos (sem juntas de bolinha).
// Asa fechada = casca que acompanha o corpo; asa aberta = superfície articulada (ombro + pulso).
// =====================================================================
export type Especie = {
  nome: string;
  torso: [number, number, number, number, number][]; // [z, yCentro, meiaLarg, alturaCima, alturaBaixo] cloaca → ombro (z crescente)
  pesc: { len: number[]; w: number[]; ht: number[]; hb: number[] }; // pontos do pescoço depois do ombro
  cab: [number, number, number, number, number][]; // [z, w, hTop, hBot, y] no referencial da cabeça (origem = ponta do pescoço)
  corCab: string;
  bico: { z0: number; y0: number; len: number; w: number; h: number; gancho: number; cor: string; corBase?: string; hInf?: number };
  cere?: { cor: string; esc: V3; pos: V3 };
  pele?: { cor: string }; // pele nua do rosto (carcará)
  olho: { r: number; pos: V3; iris: string; irisIn: string; pupila?: number; anel: string; anelR: number };
  perna: { quad: V3; tarso: number; r: number; cor: string; dedos: [number, number, number, number]; unha: string; coxa: string; coxaR: number; coxaLen: number };
  cauda: { len: number; w0: number; w1: number; ang: number; y?: number };
  asaF: { zF: number; zT: number; phiT: number; phiB: number; off: number; ponta: number };
  asaA: { L: number; corda: number; pulso: number; corPrim?: string; nPrim?: number };
  iri?: [number, number, number];
  iriForca?: number;
  rough?: number;
  rad?: number; // resolução do tubo
};
export type Texturas = { corpo: THREE.Texture; asa: THREE.Texture; asaA: THREE.Texture; asaB: THREE.Texture; cauda: THREE.Texture; olho: THREE.Texture; cabeca?: THREE.Texture };
export type Pele = { corpo: THREE.Texture; mask: THREE.Texture; cob: number; maskCab: THREE.Texture; maskAsa: THREE.Texture }; // filhote: pele nua ↔ pena

export type PoseAve = {
  pesc?: number[]; // ângulos ABSOLUTOS (graus) de cada segmento do pescoço no plano sagital (0 = para a frente, 90 = para cima)
  cabeca?: [number, number, number?]; // [yaw, pitch, roll] em graus (pitch = direção do bico; 0 = horizontal, − = para baixo)
  corpoPitch?: number; // graus (+ = peito para cima)
  corpoY?: number; // cm extra de altura do corpo
  corpoZ?: number;
  avancoCab?: number; // cm: desloca a cabeça para a frente/trás (balanço do andar), o pescoço acompanha em cisalhamento
  inflar?: number; // 0..1 papo/pescoço estufado (arrulho)
  bico?: number; // 0..1 abertura
  pulsar?: number; // 0..1 contração do papo (regurgitação) — o pescoço pulsa
  asa?: number; // 0 fechada … 1 aberta (voo)
  bater?: number; // fase do batimento (ciclos)
  amp?: number; // amplitude do batimento (graus)
  leque?: number; // 0..1 cauda aberta
  pes?: { e: V3; d: V3; ergE?: number; ergD?: number }; // posição dos pés (raiz) e quanto o dedo encolhe (pé no ar)
  recolher?: number; // 0..1 pernas recolhidas (voo/sentado)
  sentado?: number; // 0..1 deitado no ninho (barriga no chão, pernas escondidas)
  papo?: number; // 0..1 papo cheio: inchaço na frente da base do pescoço (bolsa)
  levantarAsa?: number; // graus: a asa fechada se afasta do corpo (filhote batendo os cotos)
};

export type RaioXAve = {
  corte?: THREE.Vector4; // plano: lado positivo vira fantasma
  papo?: { parede: number; leite: number; soltar: number; corte?: boolean; lobos?: number; fluxo?: number; entrada?: number; lado?: 1 | -1; descida?: boolean }; // estado do papo (Papo.tsx)
  fantasma?: string;
};

// ---------------- hermite em listas ----------------
const herm = (keys: number[][], z: number, k: number) => {
  let i = 0;
  while (i < keys.length - 2 && keys[i + 1][0] < z) i++;
  const a = keys[i], b = keys[i + 1];
  const p0 = keys[Math.max(0, i - 1)], p3 = keys[Math.min(keys.length - 1, i + 2)];
  const t = clamp01((z - a[0]) / Math.max(1e-6, b[0] - a[0]));
  const m1 = (b[k] - p0[k]) * 0.5, m2 = (p3[k] - a[k]) * 0.5;
  const t2 = t * t, t3 = t2 * t;
  return (2 * t3 - 3 * t2 + 1) * a[k] + (t3 - 2 * t2 + t) * m1 + (-2 * t3 + 3 * t2) * b[k] + (t3 - t2) * m2;
};
const D2R = Math.PI / 180;

// ---------------- ESQUELETO (função pura: também usada para posicionar filhote/leite) ----------------
export type Esqueleto = {
  ctrl: { p: THREE.Vector3; w: number; ht: number; hb: number }[]; // pontos de controle do tubo (referencial do CORPO)
  nTorso: number;
  cab: THREE.Matrix4; // referencial da cabeça no CORPO
  corpo: THREE.Matrix4; // corpo → raiz
};
export const esqueleto = (E: Especie, P: PoseAve): Esqueleto => {
  const inf = P.inflar ?? 0, pul = P.pulsar ?? 0;
  const sen = P.sentado ?? 0;
  const ctrl = E.torso.map(([z, y, w, ht, hb], i) => {
    const last = i >= E.torso.length - 2;
    const k = last ? 1 + inf * 0.22 + pul * 0.06 : 1;
    return { p: new THREE.Vector3(0, y, z), w: w * (last ? 1 + inf * 0.12 : 1), ht, hb: hb * k };
  });
  const nTorso = ctrl.length;
  // pescoço: cadeia 2D (z, y) a partir do ombro
  const ang = P.pesc ?? E.pesc.len.map(() => 80);
  let p = ctrl[nTorso - 1].p.clone();
  const nP = E.pesc.len.length;
  const base = ctrl[nTorso - 1].p.clone();
  for (let i = 0; i < nP; i++) {
    const a = (ang[Math.min(i, ang.length - 1)] ?? 80) * D2R;
    p = p.clone().add(new THREE.Vector3(0, Math.sin(a), Math.cos(a)).multiplyScalar(E.pesc.len[i]));
    // inflar: a base do pescoço (papo) engorda bastante; pulsar: o papo contrai/expande
    const wInf = i <= 1 ? 1 + inf * (i === 0 ? 0.55 : 0.35) + pul * (i === 0 ? 0.12 : 0.08) : 1 + inf * 0.12;
    const hbInf = i <= 1 ? 1 + inf * (i === 0 ? 0.8 : 0.5) + pul * (i === 0 ? 0.22 : 0.14) : 1 + inf * 0.15;
    ctrl.push({ p, w: E.pesc.w[i] * wInf, ht: E.pesc.ht[i] * (1 + inf * 0.15), hb: E.pesc.hb[i] * hbInf });
  }
  // balanço da cabeça: cisalhamento do pescoço para a frente (cabeça mantém a altura)
  const av = P.avancoCab ?? 0;
  if (av !== 0)
    for (let i = 0; i < nP; i++) {
      const c = ctrl[nTorso + i];
      c.p.z += av * ((i + 1) / nP);
    }
  void base;
  // cabeça
  const [hy, hp, hr] = P.cabeca ?? [0, 0, 0];
  const cab = new THREE.Matrix4().compose(ctrl[ctrl.length - 1].p.clone(), new THREE.Quaternion().setFromEuler(new THREE.Euler(-hp * D2R, hy * D2R, (hr ?? 0) * D2R, "YXZ")), new THREE.Vector3(1, 1, 1));
  // o pescoço entra na cabeça (sem degrau): ponto extra no meio da cabeça
  const cIn = new THREE.Vector3(0, E.cab[1][4] * 0.75, E.cab[1][0] * 0.4).applyMatrix4(cab);
  const ult = ctrl[ctrl.length - 1];
  ctrl.push({ p: cIn, w: ult.w * 0.9, ht: ult.ht * 0.9, hb: ult.hb * 0.9 });
  // corpo → raiz
  const pitch = (P.corpoPitch ?? 0) * D2R;
  const yQ = E.perna.quad[1];
  const corpo = new THREE.Matrix4()
    .makeTranslation(0, (P.corpoY ?? 0) - sen * (yQ * 0.55), P.corpoZ ?? 0)
    .multiply(new THREE.Matrix4().makeTranslation(0, yQ, 0))
    .multiply(new THREE.Matrix4().makeRotationX(-pitch))
    .multiply(new THREE.Matrix4().makeTranslation(0, -yQ, 0));
  return { ctrl, nTorso, cab, corpo };
};
// pontos úteis no referencial da RAIZ (aplique a matriz da raiz para ir ao mundo)
export const pontoCabeca = (E: Especie, P: PoseAve, local: V3): THREE.Vector3 => {
  const S = esqueleto(E, P);
  return new THREE.Vector3(...local).applyMatrix4(S.cab).applyMatrix4(S.corpo);
};
// meio da boca (entre as mandíbulas abertas, perto da comissura) no referencial da cabeça
export const bocaLocal = (E: Especie, abertura: number): V3 => {
  const b = E.bico;
  const a = abertura * 0.5;
  return [0, b.y0 - 0.2 - Math.sin(a * 0.5) * b.len * 0.35, b.z0 + b.len * 0.38];
};
export const pontaBicoLocal = (E: Especie): V3 => [0, E.bico.y0 - E.bico.gancho * 0.6, E.bico.z0 + E.bico.len];
export const matrizRaiz = (position: V3 = [0, 0, 0], rotation: V3 = [0, 0, 0], escala = 1) =>
  new THREE.Matrix4().compose(new THREE.Vector3(...position), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)), new THREE.Vector3(escala, escala, escala));

// ---------------- amostragem do tubo ----------------
const N_ANEIS = 64;
export const amostrarTubo = (S: Esqueleto, n = N_ANEIS): Amostra[] => {
  const C = S.ctrl;
  const K = C.length;
  const out: Amostra[] = [];
  let u = new THREE.Vector3(0, 1, 0);
  const pt = (i: number) => C[Math.max(0, Math.min(K - 1, i))].p;
  for (let k = 0; k < n; k++) {
    const tau = ((K - 1) * k) / (n - 1);
    const i = Math.min(K - 2, Math.floor(tau));
    const f = tau - i;
    const p0 = i > 0 ? pt(i - 1) : pt(0).clone().multiplyScalar(2).sub(pt(1));
    const p3 = i + 2 < K ? pt(i + 2) : pt(K - 1).clone().multiplyScalar(2).sub(pt(K - 2));
    const p = catmull(p0, pt(i), pt(i + 1), p3, f);
    const pa = catmull(p0, pt(i), pt(i + 1), p3, Math.min(1, f + 0.01));
    const pb = catmull(p0, pt(i), pt(i + 1), p3, Math.max(0, f - 0.01));
    const d = pa.sub(pb).normalize();
    u = u.clone().sub(d.clone().multiplyScalar(u.dot(d)));
    if (u.lengthSq() < 1e-8) u.set(0, 0, -1);
    u.normalize();
    // tamanhos: hermite pelos índices
    const ix = (key: "w" | "ht" | "hb") => {
      const a = C[i][key], b = C[i + 1][key];
      const a0 = C[Math.max(0, i - 1)][key], b1 = C[Math.min(K - 1, i + 2)][key];
      const m1 = (b - a0) * 0.5, m2 = (b1 - a) * 0.5;
      const t2 = f * f, t3 = t2 * f;
      return Math.max(0.02, (2 * t3 - 3 * t2 + 1) * a + (t3 - 2 * t2 + f) * m1 + (-2 * t3 + 3 * t2) * b + (t3 - t2) * m2);
    };
    out.push({ p, d, u: u.clone(), w: ix("w"), ht: ix("ht"), hb: ix("hb"), s: tau });
  }
  return out;
};
// ponto na superfície do tubo: tau (índice de controle), ang (0 = ventre, π/2 = lado direito (−x), π = dorso), off = cm para fora
export const pontoTubo = (A: Amostra[], tau: number, ang: number, off = 0) => {
  const K = A[A.length - 1].s;
  const x = (clamp01(tau / K) * (A.length - 1));
  const i = Math.min(A.length - 2, Math.floor(x)), f = x - i;
  const a = A[i], b = A[i + 1];
  const p = a.p.clone().lerp(b.p, f), d = a.d.clone().lerp(b.d, f).normalize(), u = a.u.clone().lerp(b.u, f).normalize();
  const w = mix(a.w, b.w, f) + off, ht = mix(a.ht, b.ht, f) + off, hb = mix(a.hb, b.hb, f) + off;
  const s = new THREE.Vector3().crossVectors(d, u).normalize();
  const an = -Math.PI / 2 + ang;
  const sa = Math.sin(an), ca = Math.cos(an);
  const h = sa > 0 ? ht : hb;
  const pos = p.clone().addScaledVector(s, w * ca).addScaledVector(u, h * sa);
  const nrm = s.clone().multiplyScalar(ca / Math.max(0.01, w)).addScaledVector(u, sa / Math.max(0.01, h)).normalize();
  return { pos, nrm, d };
};

// ---------------- ANTI-DOBRA ----------------
// No lado de DENTRO de uma curva do tubo (pescoço dobrado), a meia-altura da seção não pode passar do raio de
// curvatura, senão os anéis se cruzam e a malha "abre" (corneta/cavidade). Limita ht/hb a 0,8·R e suaviza.
export const limitaDobra = (A: Amostra[]) => {
  const n = A.length;
  const lim: { hb: number; ht: number }[] = A.map(() => ({ hb: 1e9, ht: 1e9 }));
  for (let i = 1; i < n - 1; i++) {
    const dd = A[i + 1].d.clone().sub(A[i - 1].d);
    const ds = A[i + 1].p.distanceTo(A[i - 1].p);
    const k = dd.length() / Math.max(1e-4, ds); // curvatura (1/cm)
    if (k < 1e-3) continue;
    const R = 1 / k;
    const lado = dd.dot(A[i].u); // > 0: curva para o dorso (dentro = dorso); < 0: dentro = ventre
    if (lado < 0) lim[i].hb = Math.min(lim[i].hb, 0.8 * R);
    else lim[i].ht = Math.min(lim[i].ht, 0.8 * R);
  }
  // espalha o limite para os vizinhos (o cruzamento vem de anéis próximos) e suaviza
  for (let pass = 0; pass < 2; pass++)
    for (let i = 1; i < n - 1; i++) {
      lim[i].hb = Math.min(lim[i].hb, lim[i - 1].hb * 1.15 + 0.05, lim[i + 1].hb * 1.15 + 0.05);
      lim[i].ht = Math.min(lim[i].ht, lim[i - 1].ht * 1.15 + 0.05, lim[i + 1].ht * 1.15 + 0.05);
    }
  for (let i = 0; i < n; i++) {
    A[i].hb = Math.min(A[i].hb, Math.max(0.05, lim[i].hb));
    A[i].ht = Math.min(A[i].ht, Math.max(0.05, lim[i].ht));
  }
};

// ---------------- hooks de geometria (descarta a anterior) ----------------
const useGeo = (make: () => THREE.BufferGeometry, deps: unknown[]) => {
  const g = useMemo(make, deps); // eslint-disable-line
  useEffect(() => () => g.dispose(), [g]);
  return g;
};

// ---------------- CABEÇA ----------------
const cabecaGeo = (E: Especie) =>
  loftGeo(
    (() => {
      const out: Secao[] = [];
      const z0 = E.cab[0][0], z1 = E.cab[E.cab.length - 1][0];
      for (let i = 0; i <= 28; i++) {
        const z = mix(z0, z1, 0.5 - 0.5 * Math.cos((Math.PI * i) / 28));
        out.push({ p: new THREE.Vector3(0, herm(E.cab, z, 4), z), w: herm(E.cab, z, 1), h: herm(E.cab, z, 2), hb: herm(E.cab, z, 3) });
      }
      return out;
    })(),
    28,
  );
// mandíbula: loft da base até a ponta, curvando para baixo no gancho
const mandibulaGeo = (E: Especie, sup: boolean) => {
  const b = E.bico;
  const S: Secao[] = [];
  const n = 16;
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const z = b.len * u;
    const curva = -b.gancho * Math.pow(u, 2.6);
    const tw = Math.pow(1 - u, 0.7) * 0.9 + 0.1 * (1 - u);
    const w = b.w * (sup ? 1 : 0.88) * Math.max(0.04, tw);
    const h = (sup ? b.h : b.hInf ?? b.h * 0.55) * Math.max(0.05, Math.pow(1 - u, 0.6));
    S.push({ p: new THREE.Vector3(0, sup ? curva + h * 0.15 : -h * 0.6 + curva * 0.35, z), w, h: sup ? h : h * 0.5, hb: sup ? h * 0.35 : h });
  }
  return loftGeo(S, 14);
};
// olho: esfera com íris/pupila PINTADAS (pólo +y = centro da pupila) → nada solto
export const texOlho = (iris: string, irisIn: string, pupila = 0.36, chave = "") => {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 128;
  const g = c.getContext("2d")!;
  // linha y da textura = v (y 0 = pólo de cima = pupila)
  for (let y = 0; y < 128; y++) {
    const v = y / 127; // 0 pólo de cima
    let col = "#0B0B0C";
    if (v > pupila * 0.5) col = irisIn;
    if (v > pupila * 0.5 + 0.06) col = iris;
    if (v > 0.42) col = "#3A2A20";
    g.fillStyle = col;
    g.fillRect(0, y, 128, 1);
  }
  // raias da íris
  g.globalAlpha = 0.25;
  for (let i = 0; i < 64; i++) {
    g.fillStyle = i % 2 ? "#ffffff" : "#5A1A00";
    g.fillRect(i * 2, pupila * 64 + 6, 1, 0.42 * 128 - pupila * 64 - 6);
  }
  g.globalAlpha = 1;
  void chave;
  const tx = new THREE.CanvasTexture(c);
  tx.colorSpace = THREE.SRGBColorSpace;
  tx.flipY = true; // linha 0 do canvas = v 1 = pólo +y (pupila)
  return tx;
};

// ---------------- PERNA ----------------
const pernaGeos = (E: Especie, quad: THREE.Vector3, pe: THREE.Vector3, erg: number, lado: 1 | -1, recolher: number) => {
  const L = E.perna;
  // tornozelo (intertarsal) acima e um pouco atrás do pé
  const tor = new THREE.Vector3(pe.x, pe.y + L.tarso * mix(0.95, 0.4, recolher), pe.z - L.tarso * mix(0.32, 0.9, recolher));
  // coxa emplumada: do quadril (dentro do corpo) ao tornozelo, com joelho para a frente
  const joelho = quad.clone().lerp(tor, 0.5).add(new THREE.Vector3(0, 0, 1.0));
  const coxa: Secao[] = [];
  for (let i = 0; i <= 8; i++) {
    const u = i / 8;
    const p = u < 0.5 ? quad.clone().lerp(joelho, u * 2) : joelho.clone().lerp(tor, (u - 0.5) * 2);
    const r = L.coxaR * mix(1, 0.42, sm(u));
    coxa.push({ p, w: r, h: r });
  }
  // tarso: tornozelo → pé
  const tars: Secao[] = [];
  for (let i = 0; i <= 8; i++) {
    const u = i / 8;
    const p = tor.clone().lerp(pe, u);
    const r = L.r * (u < 0.1 ? mix(1.35, 1, u / 0.1) : u > 0.85 ? mix(1, 1.25, (u - 0.85) / 0.15) : 1);
    tars.push({ p, w: r, h: r * 1.05 });
  }
  // dedos: 3 para a frente (abertos), 1 para trás. Enrolam quando erguido.
  const dedos: { g: THREE.BufferGeometry; unha: THREE.BufferGeometry }[] = [];
  const angs = [-28 * lado, 0, 28 * lado, 180];
  for (let k = 0; k < 4; k++) {
    const len = L.dedos[k];
    const a = (angs[k] + (k === 3 ? 0 : -lado * 4)) * D2R;
    const dir = new THREE.Vector3(Math.sin(a), 0, Math.cos(a));
    const S: Secao[] = [];
    const n = 10;
    let q = pe.clone().add(new THREE.Vector3(0, -L.r * 0.7, 0));
    let pitch = -0.05;
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      const r = L.r * mix(0.85, 0.42, u) * (k === 3 ? 0.95 : 1);
      S.push({ p: q.clone(), w: r * 1.05, h: r * 0.8 });
      pitch += erg * 0.22 + (u > 0.75 ? 0.05 : 0);
      q = q.clone().add(dir.clone().multiplyScalar(Math.cos(pitch) * (len / n)).add(new THREE.Vector3(0, -Math.sin(pitch) * (len / n), 0)));
      if (!erg) q.y = Math.max(q.y, 0.18 - (u > 0.8 ? 0.12 : 0));
    }
    // unha: continua a ponta, escura e curva
    const ult = S[S.length - 1].p, pen = S[S.length - 2].p;
    const dd = ult.clone().sub(pen).normalize();
    const U: Secao[] = [];
    for (let i = 0; i <= 5; i++) {
      const u = i / 5;
      U.push({ p: ult.clone().addScaledVector(dd, u * len * 0.13).add(new THREE.Vector3(0, -u * u * len * 0.05, 0)), w: L.r * 0.36 * (1 - u * 0.85), h: L.r * 0.4 * (1 - u * 0.85) });
    }
    U[0].p.addScaledVector(dd, -len * 0.05);
    dedos.push({ g: loftGeo(S, 10), unha: loftGeo(U, 8) });
  }
  return { coxa: loftGeo(coxa, 14), tars: loftGeo(tars, 12), dedos };
};
const Perna: React.FC<{ E: Especie; quad: THREE.Vector3; pe: THREE.Vector3; erg: number; lado: 1 | -1; mats: { coxa: THREE.Material; tars: THREE.Material; unha: THREE.Material }; recolher: number; sombra: boolean }> = ({ E, quad, pe, erg, lado, mats, recolher, sombra }) => {
  const key = [quad.x, quad.y, quad.z, pe.x, pe.y, pe.z, erg, recolher].map((v) => v.toFixed(3)).join(",");
  const G = useMemo(() => pernaGeos(E, quad, pe, erg, lado, recolher), [key, E]); // eslint-disable-line
  useEffect(
    () => () => {
      G.coxa.dispose();
      G.tars.dispose();
      G.dedos.forEach((d) => (d.g.dispose(), d.unha.dispose()));
    },
    [G],
  );
  return (
    <group>
      <mesh geometry={G.coxa} material={mats.coxa} castShadow={sombra} />
      <mesh geometry={G.tars} material={mats.tars} castShadow={sombra} />
      {G.dedos.map((d, i) => (
        <group key={i}>
          <mesh geometry={d.g} material={mats.tars} castShadow={sombra} />
          <mesh geometry={d.unha} material={mats.unha} castShadow={sombra} />
        </group>
      ))}
    </group>
  );
};

// ---------------- ASA FECHADA (casca sobre o corpo) ----------------
// envelope do torso por z (com prolongamento atrás da cloaca, seguindo a cauda)
const envelope = (E: Especie, z: number) => {
  const T = E.torso as unknown as number[][];
  const zV = T[0][0];
  if (z >= zV + 2) return { yc: herm(T, z, 1), w: herm(T, z, 2), ht: herm(T, z, 3), hb: herm(T, z, 4) };
  const a = { yc: herm(T, zV + 2, 1), w: herm(T, zV + 2, 2), ht: herm(T, zV + 2, 3), hb: herm(T, zV + 2, 4) };
  const dz = zV + 2 - z;
  const ang = E.cauda.ang * D2R;
  return { yc: a.yc - Math.tan(ang) * dz * 0.8, w: Math.max(0.8, a.w - dz * 0.35), ht: Math.max(0.6, a.ht - dz * 0.12), hb: a.hb };
};
const asaFechadaGeo = (E: Especie, lado: 1 | -1, inflar: number, escala = 1) => {
  const A = E.asaF;
  const na = 34, nb = 14;
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  for (let i = 0; i <= na; i++) {
    const a = i / na;
    for (let j = 0; j <= nb; j++) {
      const b = j / nb; // 0 = borda de cima (dorso), 1 = borda de baixo
      // contorno: frente arredondada (dobra do pulso), ponta afinando sobre a cauda
      const zF = A.zF - 2.4 * (1 - Math.pow(Math.sin(Math.PI * mix(0.04, 0.96, b)), 0.6));
      const zT = A.zT + (A.ponta * Math.pow(Math.abs(b - 0.2), 1.3)) * 1.2;
      const z = mix(zF, zT, a) * 1;
      const env = envelope(E, z);
      // largura da faixa angular: estreita na ponta
      const aPonta = sm((a - 0.62) / 0.38);
      const phiT = mix(A.phiT, 86, aPonta) * D2R;
      const phiB = mix(A.phiB, mix(A.phiT, 86, 1) - 22, aPonta * aPonta) * D2R;
      const phi = mix(phiT, phiB, b);
      const off = (A.off * (1 + 0.6 * Math.sin(Math.PI * b) * (1 - a)) + 0.12 + inflar * 0.25 * (1 - a)) * mix(0.55, 1, sm(a / 0.12));
      const h = phi >= 0 ? env.ht : env.hb;
      const conv = mix(1, 0.25, aPonta); // pontas convergem para o dorso
      const x = lado * (env.w * Math.cos(phi) * conv + off * Math.cos(phi) + (1 - conv) * 0.35);
      const y = env.yc + h * Math.sin(phi) + off * Math.sin(phi) + aPonta * 0.1;
      pos.push(x * escala, y, z);
      uv.push(a, b);
    }
  }
  for (let i = 0; i < na; i++)
    for (let j = 0; j < nb; j++) {
      const p = i * (nb + 1) + j, q = p + nb + 1;
      if (lado > 0) idx.push(p, q, p + 1, q, q + 1, p + 1);
      else idx.push(p, p + 1, q, q, p + 1, q + 1);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
};

// ---------------- ASA ABERTA (voo) ----------------
// superfície (x = envergadura 0..L, c = corda 0 bordo de ataque … 1 bordo de fuga) dobrada no ombro e no pulso.
export const asaAbertaGeo = (E: Especie, lado: 1 | -1, abre: number, flap: number, maoFlap: number) => {
  const A = E.asaA;
  const L = A.L, xp = A.pulso;
  const nx = 40, nc = 10;
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  const dobra = 1 - abre; // 0 aberta
  const sweep1 = -dobra * 70 * D2R, sweep2 = -dobra * 150 * D2R;
  const m1 = new THREE.Matrix4().makeRotationZ(lado * flap * D2R).multiply(new THREE.Matrix4().makeRotationY(-lado * sweep1));
  const pulso = new THREE.Vector3(lado * xp, 0, 0);
  const m2 = new THREE.Matrix4().makeTranslation(pulso.x, 0, 0).multiply(new THREE.Matrix4().makeRotationZ(lado * maoFlap * D2R)).multiply(new THREE.Matrix4().makeRotationY(-lado * sweep2)).multiply(new THREE.Matrix4().makeTranslation(-pulso.x, 0, 0));
  const mm = new THREE.Matrix4();
  for (let i = 0; i <= nx; i++) {
    const u = i / nx;
    const x = u * L;
    // bordo de ataque e de fuga (cm, +z = frente)
    const zle = mix(1.2, 2.2, sm(x / xp)) - (x > xp ? Math.pow((x - xp) / (L - xp), 1.6) * 3.2 : 0);
    let zte: number;
    if (x <= xp) zte = -A.corda + 0.6 * Math.sin((Math.PI * x) / xp);
    else {
      const v = (x - xp) / (L - xp);
      zte = mix(-A.corda * 0.62, zle - 0.4, Math.pow(v, 0.9)); // só as coberteiras; as primárias são penas separadas
    }
    const mBlend = sm((x - (xp - 2)) / 4);
    for (let j = 0; j <= nc; j++) {
      const c = j / nc;
      const z = mix(zle, zte, c);
      const y = (0.55 * Math.sin(Math.PI * Math.pow(c, 0.7)) + (c < 0.25 ? 0.6 * (1 - c / 0.25) : 0)) * (1 - 0.55 * u); // bordo de ataque grosso
      const p = new THREE.Vector3(lado * x, y, z);
      // mistura das transformações (pulso suave)
      const pa = p.clone().applyMatrix4(m1);
      const pb = p.clone().applyMatrix4(mm.copy(m1).multiply(m2));
      const q = pa.lerp(pb, mBlend);
      pos.push(q.x, q.y, q.z);
      uv.push(u, c);
    }
  }
  for (let i = 0; i < nx; i++)
    for (let j = 0; j < nc; j++) {
      const p = i * (nc + 1) + j, q = p + nc + 1;
      if (lado > 0) idx.push(p, q, p + 1, q, q + 1, p + 1);
      else idx.push(p, p + 1, q, q, p + 1, q + 1);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
};

// primárias SEPARADAS (penas longas que saem da mão, em leque) com a mesma articulação ombro+pulso
export const primariasGeo = (E: Especie, lado: 1 | -1, abre: number, flap: number, maoFlap: number) => {
  const A = E.asaA;
  const L = A.L, xp = A.pulso, n = A.nPrim ?? 9;
  const dobra = 1 - abre;
  const sweep1 = -dobra * 70 * D2R, sweep2 = -dobra * 150 * D2R;
  const m1 = new THREE.Matrix4().makeRotationZ(lado * flap * D2R).multiply(new THREE.Matrix4().makeRotationY(-lado * sweep1));
  const m2 = new THREE.Matrix4().makeTranslation(lado * xp, 0, 0).multiply(new THREE.Matrix4().makeRotationZ(lado * maoFlap * D2R)).multiply(new THREE.Matrix4().makeRotationY(-lado * sweep2)).multiply(new THREE.Matrix4().makeTranslation(-lado * xp, 0, 0));
  const M = new THREE.Matrix4().copy(m1).multiply(m2);
  const gs: THREE.BufferGeometry[] = [];
  const largMax = (A.corda / n) * 1.5;
  for (let i = 0; i < n; i++) {
    const s = i / (n - 1); // 0 = primária interna … 1 = ponta da asa
    const x0 = mix(xp + 0.5, L * 0.78, Math.pow(s, 0.9));
    const z0 = mix(-A.corda * 0.45, -0.6, s);
    const ang = mix(-80, -12, Math.pow(s, 0.8)) * D2R; // internas apontam para trás, externas para fora
    const len = mix(A.corda * 0.95, (L - x0) * 0.95 + A.corda * 0.35, Math.pow(s, 0.7));
    const dir = new THREE.Vector3(Math.cos(ang) * lado, 0, Math.sin(ang));
    const S: Secao[] = [];
    for (let k = 0; k <= 8; k++) {
      const u = k / 8;
      const w = largMax * (0.55 + 0.45 * Math.sin(Math.PI * Math.min(1, u * 0.9 + 0.1))) * (u > 0.8 ? 1 - (u - 0.8) * 3.5 : 1);
      const p = new THREE.Vector3(lado * x0, -0.06 - 0.03 * i, z0).addScaledVector(dir, u * len).add(new THREE.Vector3(0, -0.25 * u * u, 0));
      S.push({ p, w: Math.max(0.05, w), h: 0.07 });
    }
    const g = loftGeo(S, 8, new THREE.Vector3(0, 1, 0), true);
    g.deleteAttribute("uv");
    g.applyMatrix4(M);
    gs.push(g);
  }
  const g = mergeGeometries(gs, false)!;
  gs.forEach((x) => x.dispose());
  g.computeVertexNormals();
  return g;
};

// ---------------- CAUDA ----------------
const caudaGeo = (E: Especie, leque: number) => {
  // laje de penas com espessura (seção elíptica achatada), abre em leque; ponta arredondada
  const C = E.cauda;
  const S: Secao[] = [];
  const n = 18;
  for (let i = 0; i <= n; i++) {
    const a = i / n;
    const larg = mix(C.w0, C.w1 + leque * C.w1 * 2.2, Math.pow(a, 0.8)) * (a > 0.9 ? Math.sqrt(Math.max(0.02, 1 - Math.pow((a - 0.9) / 0.1, 2) * (0.35 + leque * 0.4))) : 1);
    const th = mix(0.55, 0.12, a);
    S.push({ p: new THREE.Vector3(0, -a * a * 0.6 + th * 0.2, -a * C.len), w: larg, h: th * 0.6, hb: th * 0.4 });
  }
  const g = loftGeo(S, 20, new THREE.Vector3(0, 1, 0), true);
  // uv: x = comprimento (a), y = largura → troca para o padrão da textura (a, lado)
  const uv = g.attributes.uv as THREE.BufferAttribute;
  for (let k = 0; k < uv.count; k++) {
    const u = uv.getX(k), v = uv.getY(k);
    uv.setXY(k, v, 0.5 + 0.5 * Math.cos(u * Math.PI * 2));
  }
  return g;
};

// =====================================================================
export type AveProps = {
  E: Especie;
  tx: Texturas;
  pose: PoseAve;
  t?: number;
  pele?: Pele;
  raioX?: RaioXAve;
  position?: V3;
  rotation?: V3;
  escala?: number;
  sombra?: boolean;
  semPernas?: boolean;
  escalaAsa?: number; // filhote: asa pequena
  palpebra?: number; // 0 fechada … 1 aberta (se definido, desenha as pálpebras)
  corPalpebra?: string;
  naCabeca?: React.ReactNode; // filhos no referencial da cabeça
  olhosNoRaioX?: boolean; // false: os olhos somem junto quando o corpo vira vidro (fantasma)
  noCorpo?: (S: Esqueleto, A: Amostra[]) => React.ReactNode; // filhos no referencial do corpo (penugem, canhões, papo)
};
export const Ave: React.FC<AveProps> = (P) => {
  const { E, tx, pose } = P;
  const sombra = P.sombra ?? true;
  // materiais
  const M = useMemo(() => {
    const pele = P.pele ? { map: P.pele.corpo, mask: P.pele.mask } : undefined;
    return {
      corpo: matAve({ map: tx.corpo, iri: E.iri, rough: E.rough ?? 0.82, pele }),
      cab: matAve({ map: tx.cabeca, cor: tx.cabeca ? "#ffffff" : E.corCab, rough: 0.8, pele: P.pele ? { map: P.pele.corpo, mask: P.pele.maskCab } : undefined }),
      asa: matAve({ map: tx.asa, rough: 0.85, side: THREE.DoubleSide, pele: P.pele ? { map: P.pele.corpo, mask: P.pele.maskAsa } : undefined }),
      asaA: matAve({ map: tx.asaA, rough: 0.85, side: THREE.FrontSide }),
      asaB: matAve({ map: tx.asaB, rough: 0.85, side: THREE.BackSide }),
      cauda: matAve({ map: tx.cauda, rough: 0.85, side: THREE.DoubleSide }),
      bico: matAve({ cor: E.bico.cor, rough: 0.45 }),
      boca: matAve({ cor: "#5E4C52", rough: 0.7 }), // interior rosa-acinzentado escuro (nunca vermelho)
      prim: new THREE.MeshStandardMaterial({ color: E.asaA.corPrim ?? "#4C525C", roughness: 0.75, side: THREE.DoubleSide }),
      cere: matAve({ cor: E.cere?.cor ?? "#ffffff", rough: 0.95 }),
      pelef: matAve({ cor: E.pele?.cor ?? "#ffffff", rough: 0.7 }),
      olho: new THREE.MeshStandardMaterial({ map: tx.olho, roughness: 0.18, metalness: 0 }),
      anel: matAve({ cor: E.olho.anel, rough: 0.7 }),
      coxa: matAve({ map: tx.corpo, rough: 0.9 }),
      tars: matAve({ cor: E.perna.cor, rough: 0.55 }),
      unha: matAve({ cor: E.perna.unha, rough: 0.4 }),
      fant: matFantasma(P.raioX?.fantasma),
      palp: matAve({ cor: P.corPalpebra ?? "#D99A92", rough: 0.6, side: THREE.DoubleSide }),
    };
  }, [tx, P.pele?.corpo, P.raioX?.fantasma, P.corPalpebra, E.iri?.join(","), E.bico.cor, E.perna.cor, E.olho.anel, E.corCab, E.cere?.cor, E.pele?.cor]); // eslint-disable-line
  M.corpo.userData.u.uIri.value = E.iri ? E.iriForca ?? 1 : 0;
  // cobertura (filhote)
  for (const m of [M.corpo, M.cab, M.asa]) m.userData.u.uCob.value = P.pele?.cob ?? 1;
  // corte de raio-x
  const corte = P.raioX?.corte ?? CORTE_NENHUM;
  const temRaio = !!P.raioX?.corte;
  for (const m of Object.values(M)) if ((m as MatAve).userData?.u?.uCorte) ((m as MatAve).userData.u.uCorte.value as THREE.Vector4).copy(corte);
  M.fant.uniforms.uCorte.value.copy(corte);
  M.fant.uniforms.uAtivo.value = temRaio ? 1 : 0;

  const S = esqueleto(E, pose);
  const A = amostrarTubo(S);
  // PAPO CHEIO: bolsa na frente (lado ventral) da base do pescoço — a frente estufa ~40 %, os lados ~15 %
  const pp = clamp01(pose.papo ?? 0) * (1 + 0.12 * (pose.pulsar ?? 0));
  if (pp > 0) {
    const ta = S.nTorso - 1.35, tb = S.nTorso + 1.0;
    for (const a of A) {
      if (a.s <= ta || a.s >= tb) continue;
      const b = Math.pow(Math.sin((Math.PI * (a.s - ta)) / (tb - ta)), 2);
      a.hb *= 1 + 0.42 * pp * b;
      a.w *= 1 + 0.14 * pp * b;
    }
  }
  if ((getInputProps() as { semAntiDobra?: boolean }).semAntiDobra !== true) limitaDobra(A); // controle do teste magenta
  const tubo = useMemo(() => novoTubo(N_ANEIS, E.rad ?? 40), [E.rad]);
  useEffect(() => () => tubo.dispose(), [tubo]);
  escreveTubo(tubo, A, S.ctrl.length - 1);

  const cabG = useGeo(() => cabecaGeo(E), [E]);
  const mandS = useGeo(() => mandibulaGeo(E, true), [E]);
  const mandI = useGeo(() => mandibulaGeo(E, false), [E]);
  const olhoG = useMemo(() => new THREE.SphereGeometry(1, 28, 20), []);
  const anelG = useMemo(() => new THREE.TorusGeometry(1, 0.13, 10, 32), []);
  const esfG = useMemo(() => new THREE.SphereGeometry(1, 24, 16), []);
  // pálpebra = quarto de esfera em volta do pólo (+y), metade x ≥ 0; a outra é a mesma girada 180° em y
  const palpG = useMemo(() => new THREE.SphereGeometry(1, 24, 12, Math.PI / 2, Math.PI, 0, Math.PI / 2 + 0.25), []);
  const inflar = pose.inflar ?? 0;
  const ea = P.escalaAsa ?? 1;
  const asaE = useGeo(() => asaFechadaGeo(E, 1, inflar, ea), [E, inflar.toFixed(3), ea]);
  const asaD = useGeo(() => asaFechadaGeo(E, -1, inflar, ea), [E, inflar.toFixed(3), ea]);
  const leque = pose.leque ?? 0;
  const caudaG = useGeo(() => caudaGeo(E, leque), [E, leque.toFixed(3)]);
  // asa aberta
  const abre = clamp01(pose.asa ?? 0);
  const fase = (pose.bater ?? 0) * Math.PI * 2;
  const amp = pose.amp ?? 38;
  const flap = abre > 0.3 ? 8 + amp * Math.sin(fase) : 0;
  const maoFlap = abre > 0.3 ? amp * 0.55 * Math.sin(fase - 0.7) : 0;
  const voar = abre > 0.3;
  const aaKey = [abre, flap, maoFlap].map((v) => v.toFixed(2)).join(",");
  const asaAE = useGeo(() => (voar ? asaAbertaGeo(E, 1, abre, flap, maoFlap) : new THREE.BufferGeometry()), [E, aaKey, voar]);
  const asaAD = useGeo(() => (voar ? asaAbertaGeo(E, -1, abre, flap, maoFlap) : new THREE.BufferGeometry()), [E, aaKey, voar]);
  const primE = useGeo(() => (voar ? primariasGeo(E, 1, abre, flap, maoFlap) : new THREE.BufferGeometry()), [E, aaKey, voar]);
  const primD = useGeo(() => (voar ? primariasGeo(E, -1, abre, flap, maoFlap) : new THREE.BufferGeometry()), [E, aaKey, voar]);

  // cabeça
  const cabPos = new THREE.Vector3(), cabQ = new THREE.Quaternion(), um = new THREE.Vector3();
  S.cab.decompose(cabPos, cabQ, um);
  const cabE = new THREE.Euler().setFromQuaternion(cabQ);
  // corpo
  const cPos = new THREE.Vector3(), cQ = new THREE.Quaternion();
  S.corpo.decompose(cPos, cQ, um);
  const cE = new THREE.Euler().setFromQuaternion(cQ);
  // ombro (asa aberta) e cauda no referencial do corpo
  const T = E.torso;
  const zV = T[0][0];
  const sh = T[T.length - 2];
  const ombro: V3 = [0, sh[1] + sh[3] * 0.55, sh[0] - 1.2];
  const raizCauda: V3 = [0, T[0][1] + (E.cauda.y ?? 0.4), zV + 1.2];
  const caudaRot: V3 = [-E.cauda.ang * D2R, 0, 0];
  // pés (referencial da raiz) e quadris (corpo → raiz)
  const quadE = new THREE.Vector3(E.perna.quad[0], E.perna.quad[1], E.perna.quad[2]).applyMatrix4(S.corpo);
  const quadD = new THREE.Vector3(-E.perna.quad[0], E.perna.quad[1], E.perna.quad[2]).applyMatrix4(S.corpo);
  const rec = clamp01(Math.max(pose.recolher ?? 0, pose.sentado ?? 0));
  const peE = new THREE.Vector3(...(pose.pes?.e ?? [E.perna.quad[0] + 0.2, 0.25, E.perna.quad[2] + 0.6]));
  const peD = new THREE.Vector3(...(pose.pes?.d ?? [-E.perna.quad[0] - 0.2, 0.25, E.perna.quad[2] + 0.6]));
  if (rec > 0) {
    // recolhidas: pés sobem para baixo da barriga/atrás
    const alvo = (q: THREE.Vector3) => q.clone().add(new THREE.Vector3(0, -E.perna.tarso * 0.55, -E.perna.tarso * 0.6));
    peE.lerp(alvo(quadE), rec);
    peD.lerp(alvo(quadD), rec);
  }
  const ab = clamp01(pose.bico ?? 0);
  const b = E.bico;
  const mats = { coxa: temRaio ? M.coxa : M.coxa, tars: M.tars, unha: M.unha };
  const F = M.fant;
  return (
    <group position={P.position} rotation={P.rotation} scale={P.escala ?? 1}>
      <group position={cPos} rotation={cE}>
        {/* corpo + pescoço (um tubo só) */}
        <mesh geometry={tubo} material={M.corpo} castShadow={sombra} receiveShadow />
        {temRaio ? <mesh geometry={tubo} material={F} renderOrder={20} /> : null}
        {/* cabeça */}
        <group position={cabPos} rotation={cabE}>
          <mesh geometry={cabG} material={M.cab} castShadow={sombra} />
          {temRaio ? <mesh geometry={cabG} material={F} renderOrder={20} /> : null}
          {/* bico */}
          <group position={[0, b.y0, b.z0]}>
            <mesh geometry={mandS} material={M.bico} castShadow={sombra} />
            <group position={[0, -b.h * 0.25, 0]} rotation={[ab * 0.55, 0, 0]}>
              <mesh geometry={mandI} material={M.bico} castShadow={sombra} />
            </group>
            {ab > 0.02 ? <mesh geometry={esfG} material={M.boca} position={[0, -b.h * 0.45, b.len * 0.12]} rotation={[ab * 0.25, 0, 0]} scale={[b.w * 0.75, b.h * 0.35, b.len * 0.32]} /> : null}
            {temRaio ? <mesh geometry={mandS} material={F} renderOrder={20} /> : null}
          </group>
          {E.cere ? <mesh geometry={esfG} material={M.cere} position={E.cere.pos} scale={E.cere.esc} castShadow={sombra} /> : null}
          {E.pele ? <mesh geometry={esfG} material={M.pelef} position={[0, b.y0 + 0.15, b.z0 - 0.55]} scale={[E.cab[3][1] * 0.98, b.h * 1.2, 1.2]} /> : null}
          {/* olhos (pupila pintada no globo; pólo +y da esfera aponta para fora) */}
          {(temRaio && P.olhosNoRaioX === false ? [] : [1, -1]).map((l) => (
            <group key={l} position={[l * E.olho.pos[0], E.olho.pos[1], E.olho.pos[2]]} rotation={[0, 0, -l * Math.PI / 2 + l * 0.12]}>
              <group rotation={[0.18, 0, 0]}>
                <mesh geometry={olhoG} material={M.olho} scale={E.olho.r} />
                <mesh geometry={anelG} material={M.anel} position={[0, E.olho.r * 0.55, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[E.olho.r * E.olho.anelR, E.olho.r * E.olho.anelR, E.olho.r * 0.9]} />
                {P.palpebra !== undefined ? (
                  <>
                    <mesh geometry={palpG} material={M.palp} rotation={[0, 0, -(1 - P.palpebra) * 0.02 - P.palpebra * 0.95]} scale={E.olho.r * (1.07 - 0.22 * sm(P.palpebra))} />
                    <mesh geometry={palpG} material={M.palp} rotation={[0, Math.PI, (1 - P.palpebra) * 0.02 + P.palpebra * 0.95]} scale={E.olho.r * (1.07 - 0.22 * sm(P.palpebra))} />
                  </>
                ) : null}
              </group>
            </group>
          ))}
          {P.naCabeca}
        </group>
        {/* asas */}
        {!voar ? (
          <>
            {([1, -1] as const).map((l) => {
              const piv: V3 = [l * sh[2] * 0.85, sh[1] + sh[3] * 0.35, sh[0] - 1];
              const lev = (pose.levantarAsa ?? 0) * D2R;
              return (
                <group key={l} position={piv} rotation={[0, 0, l * lev]}>
                  <group position={[-piv[0], -piv[1], -piv[2]]}>
                    <mesh geometry={l > 0 ? asaE : asaD} material={M.asa} castShadow={sombra} receiveShadow />
                    {temRaio ? <mesh geometry={l > 0 ? asaE : asaD} material={F} renderOrder={20} /> : null}
                  </group>
                </group>
              );
            })}
          </>
        ) : (
          <group position={ombro}>
            {[asaAE, asaAD].map((g, i) => (
              <group key={i} position={[(i === 0 ? 1 : -1) * (sh[2] * 0.62), 0, 0]}>
                <mesh geometry={g} material={M.asaA} castShadow={sombra} />
                <mesh geometry={g} material={M.asaB} castShadow={sombra} />
                <mesh geometry={i === 0 ? primE : primD} material={M.prim} castShadow={sombra} />
              </group>
            ))}
          </group>
        )}
        {/* cauda */}
        <group position={raizCauda} rotation={caudaRot}>
          <mesh geometry={caudaG} material={M.cauda} castShadow={sombra} receiveShadow />
          {temRaio ? <mesh geometry={caudaG} material={F} renderOrder={20} /> : null}
        </group>
        {P.noCorpo ? P.noCorpo(S, A) : null}
      </group>
      {/* pernas (referencial da raiz) */}
      {P.semPernas || (pose.sentado ?? 0) > 0.98 ? null : (
        <>
          <Perna E={E} quad={quadE} pe={peE} erg={pose.pes?.ergE ?? rec} lado={1} mats={mats} recolher={rec} sombra={sombra} />
          <Perna E={E} quad={quadD} pe={peD} erg={pose.pes?.ergD ?? rec} lado={-1} mats={mats} recolher={rec} sombra={sombra} />
        </>
      )}
    </group>
  );
};

// ---------------- ANDAR: pés + balanço de cabeça (função pura) ----------------
// dist = cm andados; passo = cm por passo (meio ciclo). Cabeça: fase de "trava" (fica parada no mundo) + empurrão rápido.
export const andarPombo = (E: Especie, dist: number, passo = 4.2, intens = 1) => {
  const q = E.perna.quad;
  const ciclo = dist / (2 * passo);
  const pe = (fase: number, lado: 1 | -1): { p: V3; erg: number } => {
    const f = ((fase % 1) + 1) % 1;
    const apoio = 0.62;
    let z: number, y: number;
    if (f < apoio) {
      z = passo - (f / apoio) * 2 * passo; // pé fixo no mundo → corre para trás na raiz
      y = 0.25;
    } else {
      const u = (f - apoio) / (1 - apoio);
      const s = sm(u);
      z = -passo + s * 2 * passo;
      y = 0.25 + Math.sin(Math.PI * u) * 1.6;
    }
    return { p: [lado * (q[0] + 0.25), mix(0.25, y, intens), q[2] + 0.6 + z * 0.5 * intens], erg: f < 0.62 ? 0 : Math.sin(Math.PI * ((f - 0.62) / 0.38)) * 0.6 * intens };
  };
  const e = pe(ciclo, 1), d = pe(ciclo + 0.5, -1);
  // cabeça: cada passo (meio ciclo) → trava 70 % + empurrão 30 %
  const fp = (((dist / passo) % 1) + 1) % 1;
  const trava = 0.7;
  const rel = fp < trava ? -(fp / trava) : -1 + sm((fp - trava) / (1 - trava));
  const avanco = (rel + 0.5) * passo * 0.9 * intens;
  const bob = Math.abs(Math.sin(Math.PI * 2 * ciclo)) * 0.35 * intens;
  return { pes: { e: e.p, d: d.p, ergE: e.erg, ergD: d.erg }, avancoCab: avanco, corpoY: bob, rolagem: Math.sin(Math.PI * 2 * ciclo) * 2 * intens };
};
void rnd;
