import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { Amostra } from "../animais/LagartixaComum";
import { Ave, Esqueleto, Especie, Pele, PoseAve, pontoTubo, RaioXAve, texOlho, Texturas } from "./Ave";
import { Papo } from "./Papo";
import { POMBO, texPombo } from "./Pombo";
import { clamp01, escamas, lerpCor, mix, pontilhar, rnd, sm, ss, texCanvas, V3 } from "./PomboComum";

// =====================================================================
// FILHOTE DE POMBO (borracho / squab). Crescimento por `idade` em dias (0…28).
// d0: ~4,5 cm, pele rosada, penugem amarela rala, olhos fechados (bolas escuras sob a pele), bico grande e mole.
// d7: ~11 cm, canhões (penas embainhadas cinza-azuladas) nas asas, costas e cauda; olhos abrindo.
// d25–28: ~25–27 cm, quase todo emplumado (cinza fosco, sem brilho), tufos amarelos na cabeça, bico com base inchada.
// Tamanho por fotos/medidas de criação (filhote ao nascer 15–18 g, ~adulto em 4 semanas).
// =====================================================================

// tamanho natural (bico → cauda, cm) por idade
const TAM: [number, number][] = [[0, 4.6], [3, 6.6], [7, 11], [14, 19], [21, 24], [28, 27]];
export const tamanhoFilhote = (d: number) => {
  let i = 0;
  while (i < TAM.length - 2 && TAM[i + 1][0] < d) i++;
  const [d0, a] = TAM[i], [d1, b] = TAM[i + 1];
  return mix(a, b, clamp01((d - d0) / (d1 - d0)));
};

// ---------- especificações extremas (mesma forma de listas) ----------
const N: Especie = {
  nome: "filhote_d0",
  torso: [
    [-1.6, 0.95, 0.12, 0.1, 0.1],
    [-1.42, 1.0, 0.72, 0.58, 0.62],
    [-0.8, 1.06, 1.05, 0.9, 1.0],
    [0.1, 1.06, 1.06, 0.88, 1.04],
    [0.8, 1.12, 0.84, 0.68, 0.84],
    [1.25, 1.28, 0.56, 0.46, 0.52],
  ],
  pesc: { len: [0.45, 0.42, 0.38, 0.28], w: [0.5, 0.45, 0.42, 0.42], ht: [0.38, 0.35, 0.34, 0.34], hb: [0.45, 0.4, 0.36, 0.36] },
  cab: [
    [-0.62, 0.36, 0.3, 0.34, 0.3],
    [-0.42, 0.56, 0.5, 0.48, 0.32],
    [-0.1, 0.66, 0.6, 0.52, 0.34],
    [0.25, 0.62, 0.56, 0.48, 0.34],
    [0.55, 0.47, 0.42, 0.38, 0.3],
    [0.8, 0.3, 0.27, 0.26, 0.26],
    [0.95, 0.18, 0.15, 0.16, 0.25],
  ],
  corCab: "#E2A196",
  bico: { z0: 0.66, y0: 0.22, len: 1.25, w: 0.4, h: 0.36, gancho: 0.06, cor: "#BFA29C", hInf: 0.26 }, // bico GRANDE e bulboso (real)
  cere: { cor: "#D8B2A8", esc: [0.32, 0.22, 0.46], pos: [0, 0.36, 0.86] }, // base carnuda
  olho: { r: 0.27, pos: [0.44, 0.5, 0.12], iris: "#2A2226", irisIn: "#2A2226", pupila: 0.3, anel: "#D9938A", anelR: 0.9 },
  perna: { quad: [0.4, 0.02, 0.1], tarso: 0.5, r: 0.08, cor: "#D9998F", dedos: [0.5, 0.6, 0.5, 0.35], unha: "#B98C84", coxa: "#E2A196", coxaR: 0.25, coxaLen: 0.5 },
  cauda: { len: 0.3, w0: 0.22, w1: 0.2, ang: 10, y: 0.05 },
  asaF: { zF: 0.75, zT: -0.9, phiT: 40, phiB: -14, off: 0.04, ponta: 0.2 },
  asaA: { L: 2, corda: 0.8, pulso: 0.8 },
  iri: [0.55, 0.96, 0.05],
  iriForca: 0,
  rough: 0.62,
  rad: 36,
};
// d28: proporções de pombo, cabeça e base do bico maiores, cauda e asa curtas
const J: Especie = {
  ...POMBO,
  nome: "filhote_d28",
  torso: POMBO.torso.map(([z, y, w, ht, hb]) => [z * 0.86, y * 0.86, w * 0.9, ht * 0.9, hb * 0.92]) as Especie["torso"],
  pesc: { len: POMBO.pesc.len.map((v) => v * 0.82), w: POMBO.pesc.w.map((v) => v * 0.88), ht: POMBO.pesc.ht.map((v) => v * 0.88), hb: POMBO.pesc.hb.map((v) => v * 0.88) },
  cab: POMBO.cab.map(([z, w, h, hb, y]) => [z * 0.98, w * 1.02, h * 1.02, hb * 1.0, y]) as Especie["cab"],
  corCab: "#7E8692",
  bico: { z0: 1.8, y0: 0.35, len: 1.75, w: 0.3, h: 0.32, gancho: 0.12, cor: "#4A4246", hInf: 0.22 },
  cere: { cor: "#D8BFB8", esc: [0.24, 0.14, 0.42], pos: [0, 0.61, 2.12] },
  olho: { r: 0.4, pos: [0.92, 1.05, 0.66], iris: "#4A2C20", irisIn: "#5A3626", pupila: 0.42, anel: "#9A8A90", anelR: 0.92 },
  perna: { ...POMBO.perna, quad: [1.2, 4.6, 0.5], tarso: 2.2, r: 0.27, cor: "#B66A70" },
  cauda: { len: 7.2, w0: 2.0, w1: 2.4, ang: 6, y: 0.4 },
  asaF: { zF: 2.6, zT: -11.8, phiT: 70, phiB: -24, off: 0.3, ponta: 2.0 },
  asaA: { L: 26, corda: 8, pulso: 10.5 },
  iriForca: 0.25,
  rough: 0.85,
};
const lerpLista = <T extends number[]>(a: T[], b: T[], p: number) => a.map((r, i) => r.map((v, k) => mix(v, b[i][k], p))) as T[];
const lerpNum = (a: number[], b: number[], p: number) => a.map((v, i) => mix(v, b[i], p));
const lerpV3 = (a: V3, b: V3, p: number) => lerpNum(a, b, p) as V3;
// forma (0 = recém-nascido … 1 = 4 semanas)
export const formaFilhote = (d: number) => Math.pow(sm(clamp01(d / 27)), 0.85);
export const especieFilhote = (d: number): { E: Especie; escala: number } => {
  const p = formaFilhote(d);
  const E: Especie = {
    nome: "filhote",
    torso: lerpLista(N.torso, J.torso, p),
    pesc: { len: lerpNum(N.pesc.len, J.pesc.len, p), w: lerpNum(N.pesc.w, J.pesc.w, p), ht: lerpNum(N.pesc.ht, J.pesc.ht, p), hb: lerpNum(N.pesc.hb, J.pesc.hb, p) },
    cab: lerpLista(N.cab, J.cab, p),
    corCab: lerpCor(N.corCab, J.corCab, p),
    bico: {
      z0: mix(N.bico.z0, J.bico.z0, p), y0: mix(N.bico.y0, J.bico.y0, p), len: mix(N.bico.len, J.bico.len, p), w: mix(N.bico.w, J.bico.w, p), h: mix(N.bico.h, J.bico.h, p),
      gancho: mix(N.bico.gancho, J.bico.gancho, p), hInf: mix(N.bico.hInf!, J.bico.hInf!, p), cor: lerpCor(N.bico.cor, J.bico.cor, ss(0.15, 0.7, p)),
    },
    cere: { cor: lerpCor(N.cere!.cor, J.cere!.cor, p), esc: lerpV3(N.cere!.esc, J.cere!.esc, p), pos: lerpV3(N.cere!.pos, J.cere!.pos, p) },
    olho: { ...J.olho, r: mix(N.olho.r, J.olho.r, p), pos: lerpV3(N.olho.pos, J.olho.pos, p), anel: lerpCor(N.olho.anel, J.olho.anel, p) },
    perna: { ...J.perna, quad: lerpV3(N.perna.quad, J.perna.quad, p), tarso: mix(N.perna.tarso, J.perna.tarso, p), r: mix(N.perna.r, J.perna.r, p), dedos: lerpNum(N.perna.dedos, J.perna.dedos, p) as Especie["perna"]["dedos"], coxaR: mix(N.perna.coxaR, J.perna.coxaR, p), cor: lerpCor(N.perna.cor, J.perna.cor, p) },
    cauda: { len: mix(N.cauda.len, J.cauda.len, p), w0: mix(N.cauda.w0, J.cauda.w0, p), w1: mix(N.cauda.w1, J.cauda.w1, p), ang: mix(N.cauda.ang, J.cauda.ang, p), y: mix(N.cauda.y!, J.cauda.y!, p) },
    asaF: { zF: mix(N.asaF.zF, J.asaF.zF, p), zT: mix(N.asaF.zT, J.asaF.zT, p), phiT: mix(N.asaF.phiT, J.asaF.phiT, p), phiB: mix(N.asaF.phiB, J.asaF.phiB, p), off: mix(N.asaF.off, J.asaF.off, p), ponta: mix(N.asaF.ponta, J.asaF.ponta, p) },
    asaA: { L: mix(N.asaA.L, J.asaA.L, p), corda: mix(N.asaA.corda, J.asaA.corda, p), pulso: mix(N.asaA.pulso, J.asaA.pulso, p) },
    iri: J.iri,
    iriForca: J.iriForca! * ss(0.7, 1, p),
    rough: mix(N.rough!, J.rough!, p),
    rad: 36,
  };
  const natural = mix(4.6, 27, p);
  return { E, escala: tamanhoFilhote(d) / natural };
};
// cobertura de penas (0 nua … 1 emplumada)
export const coberturaFilhote = (d: number) => clamp01(ss(4, 22, d) * 1.05);

// ---------- texturas ----------
const PENUGEM = "#F0CF57";
const peleTex = () =>
  texCanvas("filhote_pele", 256, 256, (g, w, h) => {
    g.fillStyle = "#D2A39B"; // cinza-rosada
    g.fillRect(0, 0, w, h);
    pontilhar(g, w, h, 90, "#A88480", 6, 16, 0.25, 20); // mosqueado
    pontilhar(g, w, h, 1400, "#B5847E", 0.6, 1.6, 0.35, 21);
    pontilhar(g, w, h, 300, "#E6BFB6", 1, 3, 0.25, 22);
    // veias finas
    g.strokeStyle = "#B4606A";
    g.globalAlpha = 0.18;
    for (let i = 0; i < 20; i++) {
      let x = rnd(i, 23) * w, y = rnd(i, 24) * h;
      g.beginPath();
      g.moveTo(x, y);
      for (let k = 0; k < 5; k++) g.lineTo((x += (rnd(i * 5 + k, 25) - 0.5) * 40), (y += (rnd(i * 5 + k, 26) - 0.5) * 40));
      g.stroke();
    }
    g.globalAlpha = 1;
  });
// máscara (canal R): ordem em que as penas cobrem (0 = primeiro)
const mascaraCorpo = () =>
  texCanvas("filhote_mask_corpo", 128, 256, (g, w, h) => {
    for (let y = 0; y < h; y++) {
      const v = 1 - y / (h - 1);
      for (let x = 0; x < w; x += 2) {
        const u = x / w;
        const dors = 0.5 + 0.5 * Math.cos((u - 0.5) * Math.PI * 2);
        let m = mix(0.72, 0.3, sm(dors));
        if (v > 0.55) m = mix(m, 0.8, ss(0.55, 0.7, v));
        if (v < 0.1) m = 0.35;
        m += (rnd(x * 31 + y, 27) - 0.5) * 0.08;
        const c = Math.round(clamp01(m) * 255);
        g.fillStyle = `rgb(${c},${c},${c})`;
        g.fillRect(x, y, 2, 1);
      }
    }
  }, false);
const mascaraUniforme = (k: string, m: number) =>
  texCanvas(`filhote_mask_${k}`, 64, 64, (g, w, h) => {
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const c = Math.round(clamp01(m + (rnd(x * 7 + y * 131, 28) - 0.5) * 0.06) * 255);
        g.fillStyle = `rgb(${c},${c},${c})`;
        g.fillRect(x, y, 1, 1);
      }
  }, false);
const corpoJuvTex = () =>
  texCanvas("filhote_corpo_juv", 256, 512, (g, w, h) => {
    for (let y = 0; y < h; y++) {
      const v = 1 - y / (h - 1);
      for (let x = 0; x < w; x += 4) {
        const u = x / w;
        const dors = 0.5 + 0.5 * Math.cos((u - 0.5) * Math.PI * 2);
        let c = lerpCor("#9097A2", "#A2A8B1", sm(dors));
        if (v > 0.5) c = lerpCor(c, "#737A86", ss(0.5, 0.65, v));
        g.fillStyle = c;
        g.fillRect(x, y, 4, 1);
      }
    }
    escamas(g, w, h, 12, 16, "#ffffff", 0.08, 31);
    pontilhar(g, w, h, 500, "#E8D27A", 1, 2.5, 0.12, 32); // restos de penugem
  });
export const texFilhote = (): Texturas & { pele: Pele } => {
  const ad = texPombo(false);
  return {
    ...ad,
    corpo: corpoJuvTex(),
    olho: texOlho("#2E2222", "#3C2A26", 0.42, "filhote"),
    pele: { corpo: peleTex(), mask: mascaraCorpo(), maskCab: mascaraUniforme("cab", 0.86), maskAsa: mascaraUniforme("asa", 0.18), cob: 0 },
  };
};

// ---------- penugem amarela e canhões (instâncias no referencial do CORPO) ----------
const N_PEN = 820, N_CAN = 160;
const conePen = new THREE.ConeGeometry(0.5, 1, 4, 1).translate(0, 0.5, 0); // base no ponto, ponta para +y
const cilCan = (() => {
  const g = new THREE.CylinderGeometry(0.32, 0.5, 1, 6, 1).translate(0, 0.5, 0);
  return g;
})();
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _y = new THREE.Vector3(0, 1, 0);
const Penugem: React.FC<{ A: Amostra[]; S: Esqueleto; idade: number; cob: number; esc: number }> = ({ A, idade, cob, esc }) => {
  const mesh = useMemo(() => new THREE.InstancedMesh(conePen, new THREE.MeshStandardMaterial({ color: PENUGEM, roughness: 0.9 }), N_PEN), []);
  useEffect(() => () => mesh.dispose(), [mesh]);
  const K = A[A.length - 1].s;
  const comp = mix(0.36, 0.7, ss(0, 6, idade)) / esc; // cm reais → unidades da forma
  const grosso = 0.03 / esc;
  for (let i = 0; i < N_PEN; i++) {
    const tau = mix(0.6, K - 0.4, Math.pow(rnd(i, 41), 0.6)); // mais densa no pescoço
    const ang = Math.PI * mix(0.4, 1.6, rnd(i, 42));
    const { pos, nrm, d } = pontoTubo(A, tau, ang, 0);
    const dors = 0.5 - 0.5 * Math.cos(ang);
    const v = tau / K;
    let m = mix(0.72, 0.3, sm(dors));
    if (v > 0.55) m = mix(m, 0.8, ss(0.55, 0.7, v));
    // some quando a pena cobre; uns tufos no pescoço/cabeça ficam (m alto)
    const vis = 1 - ss(m - 0.05, m + 0.12, cob) * (v > 0.75 && rnd(i, 43) < 0.35 ? 0.55 : 1);
    const dir = nrm.clone().multiplyScalar(0.3).addScaledVector(d, -1).normalize();
    dir.x += (rnd(i, 44) - 0.5) * 0.5;
    dir.normalize();
    _q.setFromUnitVectors(_y, dir);
    const L = comp * (0.6 + 0.6 * rnd(i, 45)) * vis;
    _s.set(grosso * Math.max(0.001, vis), Math.max(0.0001, L), grosso * Math.max(0.001, vis));
    _m.compose(pos, _q, _s);
    mesh.setMatrixAt(i, _m);
  }
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingSphere();
  return <primitive object={mesh} />;
};
const Canhoes: React.FC<{ A: Amostra[]; idade: number; cob: number; esc: number }> = ({ A, idade, cob, esc }) => {
  const mesh = useMemo(() => {
    const m = new THREE.InstancedMesh(cilCan, new THREE.MeshStandardMaterial({ color: "#4F6079", roughness: 0.4 }), N_CAN);
    return m;
  }, []);
  useEffect(() => () => mesh.dispose(), [mesh]);
  const K = A[A.length - 1].s;
  const cresce = ss(3.5, 9, idade) * (1 - ss(13, 19, idade)); // aparece, cresce e é coberto
  const comp = (mix(0.25, 1.1, ss(3.5, 11, idade)) / esc) * cresce;
  const grosso = (mix(0.07, 0.14, ss(4, 12, idade)) / esc) * Math.max(0.001, cresce);
  for (let i = 0; i < N_CAN; i++) {
    // fileiras na lateral (asa), no dorso e na base da cauda
    const fil = i % 4 === 3 ? 1 : i % 4 === 2 ? 2 : 0;
    const tau = fil === 2 ? mix(0.5, 1.6, rnd(i, 51)) : mix(1.2, Math.min(K - 3, 4.6), rnd(i, 51));
    const lado = rnd(i, 52) < 0.5 ? 1 : -1;
    const ang = fil === 1 ? Math.PI * mix(0.85, 1.15, rnd(i, 53)) : Math.PI + lado * Math.PI * mix(0.32, 0.52, rnd(i, 53));
    const { pos, nrm, d } = pontoTubo(A, tau, ang, 0);
    const dir = nrm.clone().multiplyScalar(0.15).addScaledVector(d, -1).normalize(); // rentes, deitados para trás em fileiras
    _q.setFromUnitVectors(_y, dir);
    const L = comp * (0.7 + 0.5 * rnd(i, 54)) * (fil === 0 ? 1.3 : 1);
    _s.set(Math.max(1e-4, grosso), Math.max(1e-4, L), Math.max(1e-4, grosso));
    _m.compose(pos.addScaledVector(nrm, -grosso * 0.5), _q, _s);
    mesh.setMatrixAt(i, _m);
  }
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingSphere();
  void cob;
  return <primitive object={mesh} />;
};
// penugem da cabeça (tufos amarelos) no referencial da cabeça
const PenugemCab: React.FC<{ E: Especie; idade: number; esc: number }> = ({ E, idade, esc }) => {
  const n = 240;
  const mesh = useMemo(() => new THREE.InstancedMesh(conePen, new THREE.MeshStandardMaterial({ color: PENUGEM, roughness: 0.9 }), n), []);
  useEffect(() => () => mesh.dispose(), [mesh]);
  const sec = E.cab[2];
  const comp = (mix(0.42, 0.8, ss(0, 6, idade)) * mix(1, 0.6, ss(14, 28, idade))) / esc;
  const grosso = 0.03 / esc;
  for (let i = 0; i < n; i++) {
    const th = mix(0.05, 1.5, rnd(i, 61)); // do topo até os lados/garganta
    const ph = rnd(i, 62) * Math.PI * 2;
    const z = mix(E.cab[0][0], E.cab[4][0], rnd(i, 63));
    const p = new THREE.Vector3(Math.sin(th) * Math.cos(ph) * sec[1] * 0.98, sec[4] + Math.cos(th) * sec[2] * 0.98, z);
    const nrm = new THREE.Vector3(Math.sin(th) * Math.cos(ph), Math.cos(th), 0.15).normalize();
    const dir = nrm.clone().multiplyScalar(0.6).add(new THREE.Vector3(0, 0.25, -0.9)).normalize();
    _q.setFromUnitVectors(_y, dir);
    _s.set(grosso, comp * (0.6 + 0.7 * rnd(i, 64)), grosso);
    _m.compose(p, _q, _s);
    mesh.setMatrixAt(i, _m);
  }
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingSphere();
  return <primitive object={mesh} />;
};

// ---------- poses ----------
// d0–d5: deitado no ninho, cabeça pesada apoiada; pedir comida: pescoço esticado para cima, bico aberto, asas tremendo
export const poseFilhoteDeitado = (d: number, t = 0): PoseAve => {
  const p = formaFilhote(d);
  const resp = Math.sin(t * Math.PI * 2 * 0.5) * 2;
  return { sentado: 1, pesc: [mix(30, 64, p), mix(5, 78, p), mix(-25, 82, p) + resp, mix(-35, 80, p)], cabeca: [0, mix(-30, -6, p)] };
};
export const poseFilhotePedindo = (d: number, k = 1, t = 0, cotos = 0): PoseAve => {
  const p = formaFilhote(d);
  // cotos: bate as asinhas (≤ 3 Hz, amplitude pequena)
  return { sentado: 1, pesc: [mix(mix(30, 64, p), 80, k), mix(mix(5, 78, p), 95, k), mix(mix(-25, 82, p), 92, k), mix(mix(-35, 80, p), 85, k)], cabeca: [0, mix(mix(-30, -6, p), 35, k)], bico: 0.1 * k, levantarAsa: cotos * (14 + 12 * Math.sin(t * Math.PI * 2 * 2.6)) };
};

// ---------- componente ----------
export type FilhoteProps = { idade: number; t?: number; pose?: PoseAve; position?: V3; rotation?: V3; raioX?: RaioXAve; sombra?: boolean; olhos?: number; fantasma?: boolean };
// fantasma = filhote inteiro em vidro claro (para "crescer até a altura do pai"), sem penugem/canhões opacos
const CORTE_TUDO = new THREE.Vector4(0, 0, 0, 1);
export const Filhote: React.FC<FilhoteProps> = ({ idade, t = 0, pose, position, rotation, raioX: rx0, sombra = true, olhos, fantasma }) => {
  const raioX: RaioXAve | undefined = fantasma ? { corte: CORTE_TUDO, fantasma: "#FFFDF2" } : rx0;
  const dk = Math.round(idade * 20) / 20;
  const { E, escala } = useMemo(() => especieFilhote(dk), [dk]);
  const tx = useMemo(() => texFilhote(), []);
  const cob = coberturaFilhote(dk);
  const pele = useMemo(() => ({ ...tx.pele, cob }), [tx, cob]);
  const abre = olhos ?? ss(4.5, 8.5, dk);
  const ps = pose ?? poseFilhoteDeitado(dk, t);
  return (
    <Ave
      E={E}
      tx={tx}
      pose={ps}
      t={t}
      pele={pele}
      escala={escala}
      position={position}
      rotation={rotation}
      raioX={raioX}
      sombra={fantasma ? false : sombra}
      palpebra={abre}
      olhosNoRaioX={!fantasma}
      corPalpebra={lerpCor(lerpCor("#6E5566", "#C98E88", ss(1, 6, dk)), "#8B8F98", ss(10, 22, dk))}
      escalaAsa={1}
      naCabeca={!fantasma ? <PenugemCab E={E} idade={dk} esc={escala} /> : null}
      noCorpo={(S, A) => (
        <>
          {fantasma ? null : <Penugem A={A} S={S} idade={dk} cob={cob} esc={escala} />}
          {fantasma ? null : <Canhoes A={A} idade={dk} cob={cob} esc={escala} />}
          {raioX?.papo ? <Papo S={S} A={A} {...raioX.papo} t={t} bocaL={[0, E.bico.y0 - 0.1, E.bico.z0 + E.bico.len * 0.3]} /> : null}
        </>
      )}
    />
  );
};
