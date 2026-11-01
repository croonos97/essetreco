// "Escada rolante" — 28 cenas, câmera e ações cravadas nas palavras do timeline (wordAt).
// Tudo é função pura do tempo. Nos fracassos, a tela fica cinza e o 3D REBOBINA de verdade (◀◀).
import { useContext, useMemo } from "react";
import { ThreeCanvas } from "@remotion/three";
import { AbsoluteFill, Audio, interpolate, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { useThree } from "@react-three/fiber";
import { useLayoutEffect } from "react";
import * as THREE from "three";
import { CoverCtx, Mark } from "../engine/Overlays";
import { cena, pop, prog as progRaw, Timeline, TimelineCtx, wordAt } from "../engine/timeline";
// prog seguro: nunca passa faixa invertida/vazia para o interpolate (faixa invertida = rampa descendente)
const prog = (x: number, a: number, b: number, e?: (v: number) => number): number => {
  if (Math.abs(b - a) < 1e-6) return x >= b ? 1 : 0;
  return a < b ? progRaw(x, a, b, e) : 1 - progRaw(x, b, a, e);
};
import { C, ease, FONT, spring as SP } from "../theme";
import { CityWorld, SkyFollow, Dust } from "../three/Predio";
import { Tag3D, ThinArrow } from "../three/Predio4";
import { Glow } from "../three/basics";
import {
  Bike,
  Checkout,
  E,
  EscState,
  Escalator,
  Esteira,
  Gente,
  hrAt,
  hrY,
  HR,
  Laranja,
  LOOP,
  loopAt,
  Mall,
  MCH,
  N_STEPS,
  Pessoa,
  PITCH,
  Sacolas,
  SHIRTS,
  stepFrame,
  Steps,
  stepU,
  treadPos,
  treadY,
  uAtX,
  V3,
  XC_B,
  XC_T,
  XN_T,
  XN_B,
} from "../three/Escada";
import { rnd } from "../three/World";
import timelineJson from "../../public/escada/timeline.json";

const TL = timelineJson as Timeline;
const S = (id: string) => cena(TL, id).start;
const EN = (id: string) => cena(TL, id).end;
const W = (id: string, w: string, nth = 0) => wordAt(TL, id, w, nth);
const END = TL.duration + 1.5;
const fr = (x: number) => Math.round(x * 30) / 30;
const cl = (x: number, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a: number, b: number, p: number) => a + (b - a) * p;
const bump = (t: number, at: number, len = 0.6) => prog(t, at - 0.1, at + 0.15) * (1 - prog(t, at + len, at + len + 0.4));
const PI = Math.PI;

// ======================================================================
// Palavras-gatilho
// ======================================================================
const A = {
  sacola: W("gancho", "sacola"),
  e1: W("gancho", "e"),
  ate: W("gancho", "até"),
  shopping: W("gancho", "shopping"),
  voce2: W("gancho", "você", 1),
  tem: W("gancho", "Tem", 1), // "Tem gente rolando" (o 1º "tem" é de "você não tem")
  ee: W("gancho", "e", 1),
  esteira2: W("degraus", "esteira"),
  por: W("degraus", "por"),
  cada: W("degraus", "cada"),
  e2: W("degraus", "e"),
  esses: W("degraus", "Esses"),
  essa: W("corrente", "Essa"),
  inclina: W("gancho", "inclina"),
  esteira: W("gancho", "esteira"),
  cima: W("gancho", "cima"),
  naoTem: W("gancho", "não"),
  escadaG: W("gancho", "escada"),
  gente: W("gancho", "gente"),
  rolando: W("gancho", "rolando"),
  laranja: W("gancho", "laranja"),
  voando: W("gancho", "voando"),
  troca: W("degraus", "troca"),
  degraus: W("degraus", "degraus"),
  aluminio: W("degraus", "alumínio"),
  reto: W("degraus", "reto"),
  rola: W("degraus", "rola"),
  degraus2: W("degraus", "degraus", 1),
  solto: W("sobe", "solto"),
  sozinho: W("sobe", "sozinho"),
  correnteM: W("maquina", "corrente"),
  prende: W("corrente", "prende"),
  corrente: W("corrente", "corrente"),
  volta: W("corrente", "volta"),
  bicicleta: W("corrente", "bicicleta"),
  sobem: W("corrente", "sobem"),
  baixo: W("corrente", "baixo"),
  cabeca: W("corrente", "cabeça"),
  corrente2: W("corrente", "corrente", 1),
  anda: W("parada", "anda"),
  naoP: W("parada", "não"),
  piso: W("maquina", "piso"),
  motor: W("maquina", "motor"),
  menor: W("maquina", "menor"),
  rodas: W("maquina", "rodas"),
  puxam: W("maquina", "puxam"),
  maquina: W("maquina", "máquina"),
  balanca: W("empina", "balança"),
  empina: W("empina", "empina"),
  rodinhas: W("trilhos", "rodinhas"),
  trilhos: W("trilhos", "trilhos"),
  alturas: W("trilhos", "alturas"),
  retoT: W("trilhos", "reto"),
  pontas: W("trilhos", "pontas"),
  juntam: W("trilhos", "juntam"),
  chao: W("trilhos", "chão"),
  esteiraT: W("trilhos", "esteira"),
  trilhos3: W("trilhos", "trilhos", 2),
  lotada: W("segurar", "lotada"),
  desequilibra: W("segurar", "desequilibra"),
  vizinho: W("segurar", "vizinho"),
  borracha: W("corrimao", "borracha"),
  junto: W("corrimao", "junto"),
  mesma: W("corrimao", "mesma"),
  corrimao: W("corrimao", "corrimão"),
  patina: W("atrito", "patina"),
  atrasa: W("atrito", "atrasa"),
  mao: W("atrito", "mão"),
  cai: W("atrito", "cai"),
  costas: W("atrito", "costas"),
  atras: W("atrito", "atrás"),
  dois: W("sensor", "2%"),
  degrausS: W("sensor", "degraus"),
  nunca: W("sensor", "nunca"),
  sensor: W("sensor", "sensor"),
  porIsso: W("sensor", "Por"),
  frente: W("sensor", "frente"),
  sensor2: W("sensor", "sensor", 1),
  lateral: W("lateral", "lateral"),
  fresta: W("lateral", "fresta"),
  chinelo: W("lateral", "chinelo"),
  dentro: W("lateral", "dentro"),
  escovas: W("escovas", "escovas"),
  sapato: W("escovas", "sapato"),
  encosta: W("escovas", "encosta"),
  cocegas: W("escovas", "cócegas"),
  meio: W("escovas", "meio"),
  fique: W("escovas", "fique"),
  escovas2: W("escovas", "escovas", 1),
  topo: W("mergulha", "topo"),
  mergulha: W("mergulha", "mergulha"),
  cadarco: W("mergulha", "cadarço"),
  tenis: W("mergulha", "tênis"),
  dedo: W("mergulha", "dedo"),
  ranhuras: W("pente", "ranhuras"),
  pente: W("pente", "pente"),
  encaixa: W("pente", "encaixa"),
  forcar: W("pente", "forçar"),
  recua: W("pente", "recua"),
  desliga: W("pente", "desliga"),
  placa: W("pente", "placa-pente"),
  buraco: W("crianca", "buraco"),
  maozinha: W("crianca", "mãozinha"),
  crianca: W("crianca", "criança"),
  juntoC: W("crianca", "junto"),
  borrachaP: W("protetor", "borracha"),
  interruptor: W("protetor", "interruptor"),
  forcou: W("protetor", "forçou"),
  para: W("protetor", "para"),
  protetor: W("protetor", "protetor"),
  luz: W("luz", "luz"),
  motorL: W("luz", "motor"),
  lotadaL: W("luz", "lotada"),
  re: W("luz", "ré"),
  freio: W("freio1", "freio"),
  mola: W("freio1", "mola"),
  apertado: W("freio1", "apertado"),
  eletricidade: W("freio1", "eletricidade"),
  solta: W("freio1", "solta"),
  sem: W("freio1", "Sem"),
  trava: W("freio1", "trava"),
  servico: W("freio1", "serviço"),
  mesmo: W("arrebenta", "mesmo"),
  arrebentar: W("arrebenta", "arrebentar"),
  segura: W("arrebenta", "segura"),
  soMotor: W("arrebenta", "motor"),
  dispara: W("arrebenta", "dispara"),
  rapido: W("arrebenta", "rápido"),
  hong: W("hongkong", "Hong"),
  fez: W("hongkong", "fez"),
  feridos: W("hongkong", "feridos"),
  dezoito: W("hongkong", "18"),
  segundo: W("freio2", "segundo"),
  rodas2: W("freio2", "rodas"),
  disparar: W("freio2", "disparar"),
  tras: W("freio2", "trás"),
  trava2: W("freio2", "trava"),
  auxiliar: W("freio2", "auxiliar"),
  caiB: W("botao", "cai"),
  empilhando: W("botao", "empilhando"),
  pontasB: W("botao", "pontas"),
  botao: W("botao", "botão"),
  vermelho: W("botao", "vermelho"),
  aperta: W("botao", "aperta"),
  botao2: W("botao", "botão", 1),
  faixa: W("coloque", "faixa"),
  adesivo: W("coloque", "adesivo"),
  tio: W("coloque", "tio"),
  saidaC: W("coloque", "saída"),
  subir: W("pisar", "subir"),
  parabens: W("final", "Parabéns"),
  sabia: W("cta", "Sabia"),
  sim: W("cta", "SIM"),
  nao: W("cta", "Não"),
};

// ======================================================================
// Velocidade da corrente (m/s) e posição integrada
// ======================================================================
const V_KEYS: [number, number][] = [
  [0, 0],
  [19.3, 0],
  [19.8, 0.55],
  [S("parada") - 0.25, 0.55],
  [S("parada") + 0.15, 0],
  [A.puxam - 0.1, 0],
  [A.puxam + 0.7, 0.5],
  [S("pente") - 0.1, 0.5],
  [S("pente") + 0.1, 0],
  [A.encaixa - 0.6, 0],
  [A.encaixa - 0.1, 0.45],
  [A.desliga - 0.02, 0.45],
  [A.desliga + 0.2, 0],
  [S("crianca") - 0.6, 0],
  [S("crianca") - 0.1, 0.5],
  [A.para - 0.02, 0.5],
  [A.para + 0.2, 0],
  [S("luz") - 0.7, 0],
  [S("luz") - 0.2, 0.5],
  [A.luz, 0.5],
  [A.luz + 0.7, 0],
  [A.motorL + 0.1, 0],
  [S("freio1") - 0.02, -0.25],
  [S("freio1"), 0],
  [A.eletricidade + 0.2, 0],
  [A.eletricidade + 0.7, 0.5],
  [A.trava - 0.45, 0.5],
  [A.trava + 0.05, 0],
  [S("arrebenta") - 0.15, 0],
  [S("arrebenta") + 0.1, 0.5],
  [A.arrebentar + 0.05, 0.5],
  [A.arrebentar + 0.6, 0],
  [A.dispara, -0.7],
  [S("hongkong") - 0.05, -2.4],
  [S("hongkong"), 0.5],
  [A.fez, 0.5],
  [A.fez + 0.6, -1.2],
  [S("freio2") - 0.05, -2.0],
  [S("freio2"), 0.5],
  [A.disparar - 0.05, 0.5],
  [A.disparar + 0.3, 0],
  [A.tras, -0.8],
  [A.trava2 - 0.02, -0.9],
  [A.trava2 + 0.15, 0],
  [A.auxiliar + 0.3, 0],
  [S("botao") - 0.1, 0.5],
  [A.aperta - 0.02, 0.5],
  [A.aperta + 0.18, 0],
  [S("coloque") - 0.1, 0],
  [S("coloque") + 0.3, 0.5],
  [END + 1, 0.5],
];
const vAt = (t: number) => {
  if (t <= V_KEYS[0][0]) return V_KEYS[0][1];
  for (let i = 1; i < V_KEYS.length; i++) {
    if (t <= V_KEYS[i][0]) {
      const [a, va] = V_KEYS[i - 1], [b, vb] = V_KEYS[i];
      return va + ((vb - va) * (t - a)) / Math.max(1e-6, b - a);
    }
  }
  return V_KEYS[V_KEYS.length - 1][1];
};
const DT = 1 / 120;
const S_ARR = (() => {
  const n = Math.ceil((END + 2) / DT);
  const a = new Float64Array(n + 1);
  for (let i = 1; i <= n; i++) a[i] = a[i - 1] + vAt((i - 0.5) * DT) * DT;
  return a;
})();
const sAt = (t: number) => {
  if (t <= 0) return 0;
  const f = t / DT;
  const i = Math.min(S_ARR.length - 2, Math.floor(f));
  return S_ARR[i] + (S_ARR[i + 1] - S_ARR[i]) * (f - i);
};
const hsAt = (t: number) => {
  // corrimão: 2% mais rápido; na cena "atrito" ele patina e atrasa
  if (t >= S("atrito") && t < S("sensor")) {
    const t0 = S("atrito");
    return sAt(t0) * 1.02 + (sAt(t) - sAt(t0)) * lerp(1, 0.45, prog(t, A.patina - 0.2, A.patina + 0.4));
  }
  return sAt(t) * 1.02;
};
// degrau k que está em u0 no instante t0
const kAt = (u0: number, t0: number) => ((Math.round((u0 - sAt(t0)) / PITCH) % N_STEPS) + N_STEPS) % N_STEPS;

// ======================================================================
// Rebobinar (cinza + ◀◀): o 3D volta no tempo
// ======================================================================
const RW: { g0: number; g1: number; k: number; label?: boolean }[] = [
  { g0: A.empina + 0.25, g1: S("trilhos"), k: 1.6 },
  { g0: A.atras + 0.0, g1: S("sensor"), k: 1.5 },
  { g0: A.dentro + 0.1, g1: S("escovas"), k: 1.5 },
  { g0: A.dedo + 0.12, g1: S("pente"), k: 1.6 },
  { g0: A.crianca + 0.1, g1: S("protetor"), k: 1.2 },
  { g0: A.rapido + 0.05, g1: S("hongkong"), k: 1.6 },
  { g0: A.feridos + 0.3, g1: S("freio2"), k: 1.8 },
];
const tEff = (t: number) => {
  for (const r of RW) if (t >= r.g0 && t < r.g1) return r.g0 - (t - r.g0) * r.k;
  return t;
};
const grayAt = (t: number) => {
  for (const r of RW) if (t >= r.g0 - 0.04 && t < r.g1) return r;
  return null;
};

// ======================================================================
// Estado da escada (peças nascem nas palavras)
// ======================================================================
const born = (t: number, at: number, d = 0.45) => pop(prog(t, at - 0.05, at + d, (x) => x));
const glowAt = (t: number, at: number) => bump(t, at, 0.55) * 0.9;

// cena "sobe": degraus soltos escorregam rampa abaixo e se empilham
const T_SLIDE = A.solto + 0.35;
const slideU = (u0: number, k: number, t: number) => {
  const dt = Math.max(0, t - T_SLIDE - (1 - u0 / LOOP.carryLen) * 0.25);
  return u0 - 3.6 * dt * dt;
};
const pileM = (k: number, j: number) => {
  const m = new THREE.Matrix4();
  const x = -5.5 - (j % 4) * 0.42 + (rnd(k, 3) - 0.5) * 0.15;
  const y = 0.3 + Math.floor(j / 4) * 0.12;
  m.makeRotationY((rnd(k, 4) - 0.5) * 0.5);
  m.setPosition(x, y, (rnd(k, 5) - 0.5) * 0.25);
  return m;
};
const carryKs = (() => {
  const s0 = 0;
  const out: number[] = [];
  for (let k = 0; k < N_STEPS; k++) {
    const u = stepU(k, s0);
    if (u >= 0.25 && u <= LOOP.carryLen - 0.15) out.push(k);
  }
  out.sort((a, b) => stepU(a, 0) - stepU(b, 0));
  return out;
})();
const pileIndex = new Map<number, number>(carryKs.map((k, i) => [k, i]));
const retKs = (() => {
  const out: number[] = [];
  for (let k = 0; k < N_STEPS; k++) if (!pileIndex.has(k)) out.push(k);
  out.sort((a, b) => stepU(a, 0) - stepU(b, 0));
  return out;
})();
const retIndex = new Map<number, number>(retKs.map((k, i) => [k, i]));
const T_ATTACH = A.prende - 0.1;

const stepPoseAt = (t: number): ((k: number, u: number) => THREE.Matrix4 | null | undefined) | undefined => {
  // montagem: cada degrau desce do alto até encaixar na viga (de baixo para cima)
  if (t >= A.cada - 0.1 && t < S("sobe") - 0.2) {
    return (k: number, u: number) => {
      const j = pileIndex.get(k);
      if (j === undefined) return null;
      const e = fitE(t, j);
      if (e >= 1) return undefined;
      const F = stepFrame(u);
      return new THREE.Matrix4().makeTranslation(0, (1 - e) * (1 - e) * 1.6, 0).multiply(F);
    };
  }
  if (t >= S("sobe") - 0.2 && t < S("corrente")) {
    return (k: number) => {
      const j = pileIndex.get(k);
      if (j === undefined) return null;
      const u0 = stepU(k, 0);
      const u = slideU(u0, k, t);
      if (u > 0.6) return stepFrame(u);
      // chegou embaixo: vai para a pilha
      return pileM(k, j);
    };
  }
  if (t >= S("corrente") && t < T_ATTACH + 1.6) {
    return (k: number, u: number) => {
      const j = pileIndex.get(k);
      if (j === undefined) {
        // degraus do ramo de baixo: também entram um a um (descem e encaixam na corrente), nunca surgem prontos
        const r = retIndex.get(k) ?? 0;
        const t0 = T_ATTACH + 0.45 + (r / Math.max(1, retKs.length - 1)) * 0.95;
        const e = prog(t, t0, t0 + 0.22, (q) => q);
        if (e <= 0.001) return null;
        if (e >= 0.999) return undefined;
        const sc = cl(e / 0.3);
        return new THREE.Matrix4().makeTranslation(0, -(1 - e) * (1 - e) * 1.2, 0).multiply(stepFrame(u)).multiply(new THREE.Matrix4().makeScale(sc, sc, sc));
      }
      const delay = (j / carryKs.length) * 0.9;
      const p = ease.inOut(prog(t, T_ATTACH + delay, T_ATTACH + delay + 0.45));
      if (p >= 0.999) return undefined;
      const a = pileM(k, j), b = stepFrame(u);
      const pa = new THREE.Vector3(), qa = new THREE.Quaternion(), sa = new THREE.Vector3();
      const pb = new THREE.Vector3(), qb = new THREE.Quaternion(), sb = new THREE.Vector3();
      a.decompose(pa, qa, sa);
      b.decompose(pb, qb, sb);
      const pp = pa.clone().lerp(pb, p);
      pp.y += Math.sin(p * PI) * 0.8;
      return new THREE.Matrix4().compose(pp, qa.clone().slerp(qb, p), new THREE.Vector3(1, 1, 1));
    };
  }
  if (t >= S("empina") && t < S("trilhos")) {
    return (k: number, u: number) => (k === K_EMP ? stepFrame(u, empPhi(t)) : undefined);
  }
  return undefined;
};

// 3 degraus em sequência que achatam na ponta de cima (cena "trilhos": "o degrau vira chão")
const K_FLAT = kAt(uAtX(XC_T - 1.95), A.pontas - 0.05);
// degrau que empina (cena 7): no meio da rampa no início da cena
const K_EMP = kAt(uAtX(-1.0), S("empina"));
const empPhi = (t: number) => {
  const b = prog(t, A.balanca - 0.3, A.balanca + 0.2) * Math.sin((t - A.balanca) * 13) * 0.16 * (1 - prog(t, A.empina - 0.2, A.empina));
  const e = 0.75 * ease.out(prog(t, A.empina - 0.15, A.empina + 0.25));
  return b + e;
};

type Xopt = { xr: number; dark: number; bare?: boolean };
// escuridão (apagão): luminárias apagam em cascata; volta quando a eletricidade solta o freio; apaga de novo em "Sem luz"
const darkAt = (t: number) => {
  if (t >= A.luz && t < S("freio1")) return prog(t, A.luz, A.luz + 0.3, (x) => x);
  if (t >= S("freio1") && t < A.eletricidade + 0.2) return 1 - prog(t, A.eletricidade - 0.05, A.eletricidade + 0.15);
  if (t >= A.sem && t < S("arrebenta")) return prog(t, A.sem, A.sem + 0.2, (x) => x);
  return 0;
};
// tampinha do botão abre um pouco antes do tapa
const OPEN_COVER = A.botao - 0.2;
const escState = (t: number, o: Xopt): EscState => {
  const s = sAt(t);
  const xr = o.xr;
  // a estrutura (treliça, saia, poços, placas) só passa a existir no fade de raio-x da cena "corrente"
  const pres = prog(t, O.xr0, O.xr0 + 0.5, (q) => q);
  const stat = t < S("corrente");
  const fitting = t >= A.cada - 0.1 && t < S("sobe") - 0.2;
  const marking = t >= MK.t0 - 0.05 && t < MK.t1 + 0.15;
  const st: EscState = {
    s,
    hs: hsAt(t),
    v: vAt(t),
    stepsVis:
      t < A.cada - 0.1
        ? () => 0
        : fitting
          ? (k: number) => {
              const j = pileIndex.get(k);
              return j === undefined ? 0 : cl(fitE(t, j) / 0.3);
            }
          : marking
            ? (k: number) => (k === K_MARK ? 0 : 1)
            : undefined,
    onlyCarry: stat,
    stepPose: stepPoseAt(t),
    stepGlowK: t >= A.pontas - 0.1 && t < A.esteiraT - 0.9 ? (k: number) => (k === K_FLAT || k === (K_FLAT + N_STEPS - 1) % N_STEPS || k === (K_FLAT + N_STEPS - 2) % N_STEPS ? 1 : 0) : undefined,
    stepGlow: prog(t, A.esses - 0.1, A.esses + 0.25) * (1 - prog(t, S("sobe") - 0.25, S("sobe") + 0.15)) * 0.8 + glowAt(t, A.reto) * 0.4,
    grooves: 1,
    yellow: prog(t, A.faixa - 0.1, A.faixa + 0.5),
    chain: t >= O.xr0 ? prog(t, O.xr0 + 0.05, T_ATTACH + 0.6, (q) => q) : 0,
    sprocketB: t >= O.xr0 ? ease.out(prog(t, O.xr0, O.xr0 + 0.3, (q) => q)) : 0,
    sprocketT: t >= O.xr0 ? ease.out(prog(t, T_ATTACH + 0.05, T_ATTACH + 0.35, (q) => q)) : 0,
    chainGlow:
      glowAt(t, A.corrente2) +
      syncGlow(t) +
      prog(t, A.essa - 0.1, A.essa + 0.25) * (1 - prog(t, S("parada") - 0.3, S("parada"))) * 0.9,
    wheels: born(t, A.rodinhas - 0.2, 0.5),
    tracks: t >= A.trilhos - 0.15 ? prog(t, A.trilhos - 0.15, A.trilhos + 0.8, (q) => q) : 0,
    trackColor: t >= A.trilhos - 0.2 && t < S("segurar") ? 1 : 0,
    trackGlow: glowAt(t, A.trilhos3) + glowAt(t, A.juntam) * 0.7,
    truss: pres * cl(xr * 1.6) * (o.bare ? 0 : 1),
    cladding: o.bare ? 0 : pres * (1 - xr * 0.88),
    skirt: pres,
    skirtXray: o.bare ? 1 : xr * 0.8,
    edgeRed:
      t >= A.fique - 0.3 && t < S("mergulha")
        ? prog(t, A.fique - 0.3, A.fique + 0.2) * (0.6 + 0.4 * Math.sin(t * 9))
        : // contexto da cena "lateral": a fresta entre o degrau e a saia aparece marcada em vermelho
          t >= S("lateral") && t < A.chinelo + 0.25
          ? prog(t, S("lateral") + 0.1, S("lateral") + 0.45) * (0.75 + 0.25 * Math.sin(t * 6))
          : 0,
    machine: t >= S("maquina") ? 1 : 0,
    motorIn: prog(t, A.motor - 0.3, A.motor + 0.45),
    drive: prog(t, A.correnteM - 0.05, A.menor + 0.35, (q) => q),
    hwShow: t >= A.borracha - 0.6 ? 1 : 0,
    magnet: t >= A.freio && t < S("arrebenta") ? 1 - brake1Clamp(t) : 0,
    motorS: t >= A.arrebentar && t < S("hongkong") ? sAt(A.arrebentar) : undefined,
    snap: t >= A.arrebentar && t < S("hongkong") ? t - A.arrebentar : -1,
    brake1: prog(t, A.freio - 0.3, A.freio + 0.4),
    clamp1: brake1Clamp(t),
    brake2: prog(t, A.segundo - 0.2, A.segundo + 0.5),
    clamp2: t >= A.trava2 - 0.05 && t < A.auxiliar + 0.6 ? prog(t, A.trava2 - 0.05, A.trava2 + 0.05) : 0,
    sparks2: t >= A.trava2 && t < A.trava2 + 0.7 ? 1 - (t - A.trava2) / 0.7 : 0,
    glowMotor: glowAt(t, A.motor) + glowAt(t, A.maquina) + glowAt(t, A.mesma) * 0.8,
    glowDrive: glowAt(t, A.menor) * 1.4 + glowAt(t, A.maquina) + (t >= S("arrebenta") && t < A.arrebentar ? 0.5 : 0),
    glowWheels: glowAt(t, A.rodas) + glowAt(t, A.maquina) + glowAt(t, A.rodas2),
    glowBrake1: glowAt(t, A.freio) + glowAt(t, A.servico),
    glowBrake2: glowAt(t, A.segundo) + glowAt(t, A.auxiliar),
    glowSpring: glowAt(t, A.mola) * 1.4,
    balustrade: prog(t, A.borracha - 0.6, A.borracha + 0.1),
    handrail: prog(t, A.borracha - 0.35, A.borracha + 0.85, (q) => q),
    hrMarks: t >= S("corrimao") && t < S("lateral") ? 0.9 : 0,
    hrHidden: (t >= S("corrimao") && t < S("sensor") ? 1 : 0) * prog(t, A.borracha - 0.25, A.borracha + 0.35) * Math.max(0.6, xr),
    hrGlow: glowAt(t, A.borracha) + glowAt(t, A.corrimao),
    sensor: prog(t, A.sensor - 0.25, A.sensor + 0.3),
    sensorGlow: glowAt(t, A.sensor) + glowAt(t, A.sensor2),
    brushes: prog(t, A.escovas - 0.45, A.escovas + 0.9, (q) => q),
    brushBendX: t >= A.encosta - 0.3 && t < A.fique ? treadPos(stepU(kAt(uAtX(-1.2), A.sapato - 1.0), s))[0] + 0.03 : 0,
    brushBend: t >= A.encosta - 0.3 && t < A.fique ? prog(t, A.encosta - 0.3, A.encosta) * (1 - prog(t, A.meio - 0.2, A.meio + 0.2)) : 0,
    brushGlow: glowAt(t, A.escovas) + glowAt(t, A.escovas2) + (t >= S("escovas") && t < A.escovas + 0.4 ? 0.3 : 0),
    // no nascimento os tufos ficam pretos (só a base brilha)
    brushTuftGlow: t < A.escovas + 0.6 ? 0 : glowAt(t, A.escovas) + glowAt(t, A.escovas2),
    // dobra bem marcada só no close do pé encostando
    brushBendAmp: t >= A.encosta - 0.05 && t < A.cocegas - 0.05 ? 1.6 : 1,
    comb: prog(t, A.pente - 0.3, A.pente + 0.3),
    combRecoil: t >= A.recua - 0.25 && t < A.placa - 0.3 ? prog(t, A.recua - 0.25, A.recua) : 0,
    combGlow: glowAt(t, A.pente) + glowAt(t, A.placa),
    combLed: t >= A.recua && t < A.placa - 0.3 ? 1 : 0,
    guard: prog(t, A.borrachaP - 0.3, A.borrachaP + 0.35),
    guardPush: t >= A.forcou - 0.25 && t < A.protetor ? prog(t, A.forcou - 0.25, A.forcou) * (1 - prog(t, A.para + 0.3, A.para + 0.7)) : 0,
    guardGlow: glowAt(t, A.interruptor) + glowAt(t, A.protetor),
    guardLed: t >= A.forcou && t < A.protetor ? 1 : 0,
    button: born(t, A.botao - 0.35, 0.25),
    buttonCover: t >= OPEN_COVER && t < S("coloque") ? prog(t, OPEN_COVER, OPEN_COVER + 0.35) : t >= S("cta") ? prog(t, S("cta") + 0.3, S("cta") + 0.7) : 0,
    buttonPress: t >= A.aperta - 0.12 && t < S("coloque") ? prog(t, A.aperta - 0.12, A.aperta) * (1 - prog(t, A.aperta + 0.4, A.aperta + 0.6)) : 0,
    buttonGlow: glowAt(t, A.botao2) + glowAt(t, A.botao) + (t >= S("cta") ? 0.35 + 0.25 * Math.sin(t * 8) : 0),
    sticker: born(t, A.adesivo - 0.1, 0.4),
    pits: pres > 0.01 ? 1 : 0,
    pitXray: t < O.xr0 + 0.6 ? 1 : xr,
    plates: pres,
  };
  return st;
};
function brake1Clamp(t: number) {
  // mola: sempre apertado; com eletricidade, solta
  if (t < A.freio) return 0;
  if (t < A.apertado) return prog(t, A.mola + 0.2, A.apertado);
  if (t < A.sem) return 1 - prog(t, A.eletricidade + 0.3, A.solta + 0.2);
  if (t < S("arrebenta")) return prog(t, A.sem + 0.05, A.trava);
  if (t < A.arrebentar) return 0;
  if (t < S("hongkong")) return 1;
  return 0;
}

// ======================================================================
// Pessoas
// ======================================================================
const TIAO = "#F2C230";
const U_ENTER = 0.42;
const U_EXIT = uAtX(XC_T - 0.4);
type RiderOpt = { s: number; t: number; seed: number; dens: number; arms?: number; mood?: Pessoa["mood"]; pile?: boolean; hand?: boolean; skip?: Set<number>; walk?: boolean; sway?: number; zSpread?: number; maxX?: number };
const riders = (o: RiderOpt): Pessoa[] => {
  const out: Pessoa[] = [];
  let pileN = 0;
  const list: { k: number; w: number }[] = [];
  for (let k = 0; k < N_STEPS; k++) {
    if (rnd(k, o.seed) > o.dens) continue;
    if (o.skip?.has(k)) continue;
    const u = stepU(k, o.s);
    const w = u > LOOP.L - 6 ? u - LOOP.L : u;
    if (w > LOOP.carryLen + 4) continue;
    list.push({ k, w });
  }
  list.sort((a, b) => a.w - b.w);
  for (const { k, w } of list) {
    const z = (rnd(k, o.seed + 1) - 0.5) * (o.zSpread ?? 0.3);
    const shirt = SHIRTS[(k * 7 + o.seed) % SHIRTS.length];
    const base: Pessoa = { p: [0, 0, z], ry: PI / 2, shirt, id: 100 + k, mood: o.mood ?? (rnd(k, 33) < 0.4 ? "happy" : "neutral"), s: 0.82 + rnd(k, 34) * 0.08 };
    if (w < U_ENTER) {
      if (o.pile) {
        const j = pileN++;
        out.push({ ...base, p: [-6.1 - (j % 3) * 0.6 + (rnd(k, 5) - 0.5) * 0.3, 0.12 + Math.floor(j / 3) * 0.32, (rnd(k, 6) - 0.5) * 1.0], ry: PI / 2 + (rnd(k, 7) - 0.5) * 1.2, rx: -1.35, piv: 0.1, pose: "up", mood: "shock" });
        continue;
      }
      if (o.walk === false) continue;
      const x = XC_B - 0.25 + (w - U_ENTER) * 1.7;
      if (x < -14) continue;
      const ph = w * 9;
      out.push({ ...base, p: [x, 0, z], legL: Math.sin(ph) * 0.5, legR: -Math.sin(ph) * 0.5 });
    } else if (w <= U_EXIT) {
      const u = ((w % LOOP.L) + LOOP.L) % LOOP.L;
      const tp = treadPos(u);
      const sway = (o.sway ?? 0) * Math.sin(o.t * 5 + k);
      const handArm: V3 | undefined = o.hand ? [-0.25, 0, -0.55] : undefined;
      out.push({ ...base, p: [tp[0] - 0.05, tp[1], z], rz: sway, pose: o.arms && rnd(k, 8) < o.arms ? "up" : "down", armL: o.arms ? undefined : handArm, mood: o.mood ?? base.mood });
    } else {
      const x = XC_T + 0.3 + (w - U_EXIT) * 1.7;
      if (x > (o.maxX ?? 14)) continue;
      const ph = w * 9;
      out.push({ ...base, p: [x, E.H, z], legL: Math.sin(ph) * 0.5, legR: -Math.sin(ph) * 0.5 });
    }
  }
  return out;
};
// posição de quem está em cima do degrau k
const onStep = (k: number, t: number, extraPhi = 0): { p: V3; rx: number } => {
  const u = stepU(k, sAt(t));
  const F = stepFrame(u, extraPhi);
  const v = new THREE.Vector3(-0.02, 0, 0).applyMatrix4(F);
  return { p: [v.x, v.y, 0], rx: -extraPhi };
};

// criança + mão no corrimão
const KID_S = 0.62, KID_Z = 0.36;
const KID_U0 = HR.Lv - 2.0;
const kidHandU = (t: number) => {
  if (t >= S("protetor")) {
    const a = prog(t, S("protetor") + 0.2, A.forcou);
    const r = prog(t, A.para + 0.1, A.para + 0.6);
    return HR.Lv - lerp(0.42, 0.1, a) - r * 0.5;
  }
  return Math.min(HR.Lv - 0.05, KID_U0 + (hsAt(t) - hsAt(S("crianca"))));
};
const kidHand = (t: number) => {
  const p = hrAt(kidHandU(t));
  return { x: p.x, y: p.y + 0.05 };
};
// troca de pose da criança (mão no corrimão -> braço solto, sorrindo), interpolada
const KID_Q = (t: number) => prog(t, A.para + 0.1, A.para + 0.45);
const kidPose = (t: number) => {
  const h = kidHand(t);
  const x = Math.min(h.x - 0.3, XN_T - 0.05);
  const y = x < XC_T ? treadY(x) : E.H;
  return { x, y, h };
};
// mergulha: posição do pé com o tênis
const mergPos = (t: number) => {
  const kM = kAt(uAtX(XC_T - 1.3), S("mergulha"));
  const os = onStep(kM, t);
  const pull = prog(t, A.cadarco, A.dedo + 0.1);
  const px = Math.min(os.p[0], XC_T - 0.26) + pull * 0.08;
  return { px, fx: px + 0.034, fz: -0.25 - 0.119, pull };
};

// ======================================================================
// ABERTURA (0–27 s): nenhuma peça existe antes de ser vista entrando.
// Eixo-mestre: câmera lateral do vão (olhando para -z), a mesma em quase todos os planos.
// ======================================================================
const O = {
  p2: A.e1 - 0.03, // corte para o caixa ("e inclina")
  p3: A.ate - 0.04, // ▶▶ arrasta e inclina ("até o andar de cima do shopping")
  legs: [A.ate + 0.01, A.ate + 0.26] as const,
  drag: [A.ate + 0.26, A.ate + 0.76] as const,
  tilt: [A.ate + 0.78, A.shopping + 0.35] as const,
  p4: A.voce2 - 0.04, // "você não tem uma escada rolante"
  board: [A.voce2 + 0.11, A.voce2 + 0.56, A.voce2 + 1.01, A.voce2 + 1.46],
  p5: A.tem - 0.04, // "Tem gente rolando"
  fall: [A.tem + 0.66, A.tem + 0.32, A.tem + 0.45, A.tem + 0.56], // Tião (no alto, cai por último), verde (cai primeiro), vermelho, roxo (dominó)
  slip: A.tem + 0.06,
  p6: A.ee - 0.05, // "e laranja voando"
  p7: A.voando + 0.05,
  hit: A.voando + 0.3,
  p8: S("degraus") + 0.04,
  lona: [A.troca - 0.06, A.esteira2 + 0.3] as const,
  p9: A.por - 0.05,
  showIn: [A.por, A.por + 0.5] as const,
  p10: A.cada - 0.05,
  fit: [A.cada - 0.02, A.cada + 1.15] as const,
  p11: A.e2 - 0.04,
  p11b: A.e2 + 0.72,
  p12: A.esses - 0.05,
  p13: S("sobe"),
  xr0: S("corrente") + 0.05, // fade de raio-x (mesma câmera)
};
const GUARD_C = "#2C3E50";
// carregada por cima da cabeça (passa por cima da registradora e da operadora sem atravessar nada)
const BELT = { x: -3.18, y: 0.36, len: 8.4, ang: E.ang, x0: 3.4, y0: 1.21, z0: 2.6, carryY: 2.2 };
const VB = 1.2; // velocidade da lona (m/s)
const beltAt = (t: number) => {
  const lift = ease.inOut(prog(t, O.legs[0], O.legs[1]));
  const dr = ease.inOut(prog(t, O.drag[0], O.drag[1]));
  const tl = prog(t, O.tilt[0], O.tilt[1], ease.inOut);
  const land = O.tilt[1];
  const bounce = t > land ? -0.025 * Math.sin((t - land) * 26) * Math.exp(-(t - land) * 7) : 0;
  const x = lerp(BELT.x0, BELT.x, dr);
  const z = lerp(BELT.z0, 0, dr);
  const y = t < O.tilt[0] ? lerp(BELT.y0, BELT.carryY, lift) : lerp(BELT.carryY, BELT.y, prog(t, O.tilt[0], O.tilt[0] + 0.35));
  return {
    p: [x, y, z] as V3,
    ang: BELT.ang * tl + bounce,
    legs: 1.25 * (1 - lift),
    belt: t * (t < O.p3 ? 0.5 : VB),
    lona: prog(t, O.lona[0], O.lona[1], (q) => q),
    opacity: 1 - prog(t, O.xr0, O.xr0 + 0.5),
    products: t < O.p3 ? 1 : 0,
  };
};
// ponto na lona (d = distância a partir do pé; h = altura acima da superfície), na esteira já encostada
const beltPt = (d: number, h = 0): V3 => {
  const c = Math.cos(BELT.ang), s = Math.sin(BELT.ang);
  return [BELT.x + d * c - (h - 0.02) * s, BELT.y + d * s + (h - 0.02) * c, 0];
};

// gente da abertura
const RID = [
  { shirt: TIAO, id: 1, bags: 2, end: [-4.9, 1.25] as [number, number] },
  { shirt: "#3DAA66", id: 10, bags: 1, end: [-4.05, -0.55] as [number, number] },
  { shirt: "#E8483B", id: 11, bags: 1, end: [-5.5, -0.15] as [number, number] },
  { shirt: "#9B59B6", id: 12, bags: 1, end: [-3.7, 0.75] as [number, number] },
];
const D_BOARD = 0.35;
const rideD = (i: number, t: number) => D_BOARD + VB * Math.max(0, t - O.board[i]);
// pessoa i rolando rampa abaixo depois de cair (d -> 0, depois rola no chão até deitar de costas)
// pivô sempre no centro do corpo (0,9): sem troca de pivô nem salto de ângulo
const TUMBLE_W = 9;
const tumble = (i: number, t: number) => {
  const tf = O.fall[i];
  const d0 = rideD(i, tf);
  const dt = Math.max(0, t - tf);
  const a = 7.5;
  const d = d0 - 0.5 * a * dt * dt;
  if (d > 0.15) {
    const p = beltPt(d, 0.05);
    return { p: [p[0], p[1], 0] as V3, rx: -dt * TUMBLE_W, settled: false };
  }
  const tg = Math.sqrt((2 * (d0 - 0.15)) / a); // instante (após a queda) em que chega ao pé
  const g = dt - tg;
  const foot = beltPt(0.15, 0.05);
  const [ex, ez] = RID[i].end;
  const k = cl(g / 0.75);
  const ke = ease.out(k);
  const rxFoot = -tg * TUMBLE_W;
  const n = Math.ceil((-1.45 - (rxFoot - 2.2)) / (2 * PI));
  const rxEnd = -1.45 - 2 * PI * n; // ≡ deitado de costas, girando um pouco mais para trás
  return { p: [lerp(foot[0], ex, ke), lerp(foot[1], -0.6, ke), lerp(0, ez, ke)] as V3, rx: lerp(rxFoot, rxEnd, ke), settled: k >= 1 };
};
const BYST: { p: [number, number]; shirt: string; id: number; ry: number }[] = [
  { p: [1.6, 1.9], shirt: "#3DAA66", id: 10, ry: -0.7 },
  { p: [2.5, 2.3], shirt: "#E8483B", id: 11, ry: -0.9 },
  { p: [2.0, 1.3], shirt: "#9B59B6", id: 12, ry: -0.6 },
  { p: [3.2, 1.6], shirt: GUARD_C, id: 8, ry: -0.8 },
];
const TIAO_PILE: V3 = [-4.35, 0, 1.3];
const TP2: V3 = [4.5, 0, 4.6];
const tiaoStair = (t: number): Pessoa => {
  // sobe os degraus (parados) com as sacolas; para no terço de baixo e faz joinha; depois desce e sai de lado
  const x0 = -4.7;
  const xStop = -1.7;
  let x = x0, z = 0.05, ry = PI / 2, walking = false;
  if (t < O.p11b) x = x0;
  else if (t < O.p12 + 0.3) {
    x = lerp(x0, xStop, prog(t, O.p11b, O.p12 + 0.3, (q) => q));
    walking = true;
  } else if (t < S("sobe") + 0.05) x = xStop;
  else if (t < S("sobe") + 0.7) {
    x = lerp(xStop, -4.3, prog(t, S("sobe") + 0.05, S("sobe") + 0.7, (q) => q));
    ry = -PI / 2;
    walking = true;
  } else {
    const k = prog(t, S("sobe") + 0.7, S("sobe") + 0.95, (q) => q);
    x = lerp(-4.3, TIAO_PILE[0], k);
    z = lerp(0.05, TIAO_PILE[2], k);
    ry = k < 1 ? 0.2 : -0.35;
    walking = k < 1;
  }
  const y = x < -3.85 ? 0 : treadY(x);
  const scratch = prog(t, A.sozinho - 0.1, A.sozinho + 0.25) * (1 - prog(t, S("corrente") + 0.4, S("corrente") + 0.8));
  const joinha = t >= A.degraus2 - 0.3 && t < S("sobe");
  return {
    p: [x, y, z],
    ry,
    shirt: TIAO,
    bags: 2,
    id: 1,
    mood: t >= T_SLIDE ? "shock" : "happy",
    legL: walking ? Math.sin(t * 11) * 0.5 : 0,
    legR: walking ? -Math.sin(t * 11) * 0.5 : 0,
    armR: joinha ? [0, 0, 2.7] : scratch > 0.01 ? [-2.7 * scratch, 0, 0.5 * scratch] : undefined,
    look: t >= T_SLIDE ? [-0.7, -0.3] : [0, 0],
  };
};
const openPeople = (t: number): Pessoa[] => {
  const P: Pessoa[] = [];
  const b = beltAt(t);
  // operadora do caixa (no balcão, a abertura inteira)
  P.push({ p: [BELT.x0 + 0.9, 0, BELT.z0 - 1.25], ry: 0.25, shirt: "#2FA84F", mood: t > O.p3 && t < O.p8 ? "shock" : "neutral", look: t > O.p3 ? [-0.9, 0] : [0.2, -0.5], id: 7 });
  if (t < O.p2) {
    // 1: Tião de costas, cheio de sacola, olhando a escada comum
    P.push({ p: [1.0, 0, 5.4], ry: PI, shirt: TIAO, bags: 2, mood: t > A.sacola ? "sad" : "neutral", sweat: t > A.sacola - 0.2 ? 1 : 0, headLean: t > A.sacola ? -0.2 : 0, look: [0.7, 0.6], id: 1 });
    return P;
  }
  if (t < O.p3) {
    // 2: no caixa: olha a esteira andando e tem a ideia
    const idea = t >= A.inclina;
    P.push({ p: TP2, ry: PI, shirt: TIAO, bags: 2, mood: idea ? "happy" : "sad", look: idea ? [0.4, 0.5] : [0.2, -0.7], headLean: idea ? 0.1 : -0.15, id: 1 });
    return P;
  }
  if (t < O.p4) {
    // 3: ▶▶ Tião e o segurança soltam a esteira, arrastam até o vão e levantam a ponta até a borda de cima
    const walking = t >= O.drag[0] - 0.05 && t < O.drag[1];
    const lg = walking ? Math.sin(t * 22) * 0.7 : 0;
    const gx = t < O.tilt[0] ? b.p[0] - 0.4 : BELT.x - 0.4;
    // segura a esteira por cima da cabeça; no fim segura o pé no chão
    const gArm: V3 = t >= O.tilt[0] + 0.3 ? [-1.0, 0, 0.2] : [-2.8, 0, 0.2];
    P.push({ p: [gx, 0, b.p[2] + 0.6], ry: -PI / 2, shirt: GUARD_C, cap: true, lean: t >= O.tilt[0] + 0.3 ? 0.35 : 0.0, armL: gArm, armR: [gArm[0], 0, -gArm[2]], legL: lg, legR: -lg, mood: "shock", id: 8 });
    const farX = b.p[0] + BELT.len * Math.cos(b.ang);
    let tx = farX + 0.35;
    let arms: V3 = [-2.8, 0, 0.2];
    let walkT = walking;
    if (t >= O.tilt[0]) {
      const k = prog(t, O.tilt[0], O.tilt[1] - 0.1, (q) => q);
      tx = lerp(BELT.x + BELT.len + 0.35, 0.9, k);
      arms = [-2.8, 0, 0.2];
      walkT = k < 1;
    }
    const cheer = t > O.tilt[1] + 0.1;
    P.push({ p: [tx, 0, b.p[2] + 0.6], ry: -PI / 2, shirt: TIAO, armL: cheer ? [0, 0, -2.6] : arms, armR: cheer ? [0, 0, 2.6] : [arms[0], 0, -arms[2]], legL: walkT ? Math.sin(t * 22 + 1) * 0.7 : 0, legR: walkT ? -Math.sin(t * 22 + 1) * 0.7 : 0, mood: cheer ? "happy" : "shock", sweat: 1, id: 1 });
    return P;
  }
  if (t < O.p8) {
    // 4–7: gente subindo uma a uma; escorrega, dominó, todos rolam; laranja na testa
    RID.forEach((r, i) => {
      const tb = O.board[i];
      const tf = O.fall[i];
      if (t < tb) {
        // vindo da fila (a pé), ainda no chão
        const x = BELT.x - 0.35 - 1.4 * (tb - t);
        P.push({ p: [x, 0, 0.05], ry: PI / 2, shirt: r.shirt, bags: r.bags, mood: "happy", legL: Math.sin(t * 10 + i) * 0.5, legR: -Math.sin(t * 10 + i) * 0.5, id: r.id });
        return;
      }
      if (t < tf) {
        const d = rideD(i, t);
        const bp = beltPt(d);
        const sl = i === 1 ? prog(t, O.slip, O.slip + 0.2) : prog(t, tf - 0.25, tf);
        P.push({ p: [bp[0] - sl * 0.1, bp[1], 0.05], ry: PI / 2, shirt: r.shirt, bags: r.bags, mood: sl > 0.2 ? "shock" : "happy", legL: sl * 0.9, legR: -sl * 0.25, lean: -0.15 * sl, pose: sl > 0.4 ? "up" : "down", id: r.id });
        return;
      }
      const tm = tumble(i, t);
      if (i === 0 && t >= O.p7) {
        // close: Tião sentado no chão
        const hit = t >= O.hit;
        const kk = hit ? Math.exp(-(t - O.hit) * 6) : 0;
        P.push({ p: [RID[0].end[0], -0.62, RID[0].end[1]], ry: 0.25, shirt: TIAO, sit: 1, mood: hit ? "sad" : "shock", look: hit ? [0, -0.3] : [0.9, 0.3], headLean: hit ? -0.25 * kk + 0.12 : 0, lean: -0.1 * kk, sweat: hit ? 0.8 : 0.4, id: 1 });
        return;
      }
      P.push({ p: tm.p, ry: PI / 2, rx: tm.rx, piv: 0.9, shirt: r.shirt, pose: "up", mood: "shock", id: r.id });
    });
    // segurança assiste do lado (fica no lugar até o corte do plano 8; não bloqueia o close do Tião)
    P.push({ p: [-3.1, 0, 2.3], ry: -0.5, shirt: GUARD_C, cap: true, mood: t > O.p5 ? "shock" : "neutral", look: [-0.6, 0.2], id: 8 });
    return P;
  }
  // 8–17: plateia assiste de pé ao lado (à direita), Tião vira o "testador"
  BYST.forEach((q) => P.push({ p: [q.p[0], 0, q.p[1]], ry: q.ry, shirt: q.shirt, cap: q.id === 8, mood: t >= T_SLIDE && t < S("corrente") ? "shock" : "neutral", look: [-0.6, 0.3], id: q.id }));
  if (t < O.p11b) P.push({ p: [-4.9, 0, 1.6], ry: 0.4, shirt: TIAO, bags: 2, mood: t > O.fit[1] ? "happy" : "neutral", look: [-0.5, 0.4], id: 1 });
  else P.push(tiaoStair(t));
  return P;
};

// laranjas que voam das sacolas quando todo mundo rola
const ORANGES = Array.from({ length: 18 }, (_, i) => {
  const who = i % 4;
  return {
    who,
    t0: O.fall[who] + 0.05 + rnd(i, 51) * 0.25,
    v: [-0.8 - rnd(i, 53) * 2.2, 2.2 + rnd(i, 54) * 2.6, (rnd(i, 55) - 0.35) * 3.2] as V3,
  };
});
const orangePos = (o: (typeof ORANGES)[number], t: number): V3 | null => {
  const dt = t - o.t0;
  if (dt < 0) return null;
  const org = beltPt(rideD(o.who, O.fall[o.who]), 0.9);
  let y = org[1] + o.v[1] * dt - 4.9 * dt * dt;
  let x = org[0] + o.v[0] * dt;
  let z = org[2] + o.v[2] * dt;
  if (y < 0.07) {
    const tg = (o.v[1] + Math.sqrt(o.v[1] * o.v[1] + 4 * 4.9 * (org[1] - 0.07))) / (2 * 4.9);
    const r = dt - tg;
    y = 0.07 + Math.abs(Math.sin(r * 7)) * 0.18 * Math.exp(-r * 2.5);
    x = org[0] + o.v[0] * tg + o.v[0] * 0.4 * (1 - Math.exp(-r * 2));
    z = org[2] + o.v[2] * tg + o.v[2] * 0.4 * (1 - Math.exp(-r * 2));
  }
  return [x, y, z];
};
const FACE = { x: RID[0].end[0], z: RID[0].end[1] };
const HIT = O.hit;
const faceOrange = (t: number): V3 | null => {
  if (t < O.p7) return null;
  const from: V3 = [FACE.x + 1.6, 1.9, FACE.z + 0.3];
  const to: V3 = [FACE.x + 0.04, 0.98, FACE.z + 0.24];
  if (t < HIT) {
    const p = prog(t, O.p7, HIT, (x) => x);
    return [lerp(from[0], to[0], p), lerp(from[1], to[1], p) + Math.sin(p * PI) * 0.35, lerp(from[2], to[2], p)];
  }
  const d = t - HIT;
  return [to[0] + d * 1.6, Math.max(0.07, to[1] + 1.8 * d - 4.9 * d * d), to[2] + d * 1.2];
};

// degraus da montagem (cena "degraus"): ordem de baixo para cima, entram um a um descendo até o encaixe
const fitT = (j: number) => O.fit[0] + (O.fit[1] - O.fit[0] - 0.22) * Math.pow(j / Math.max(1, carryKs.length - 1), 0.62);
const fitE = (t: number, j: number) => prog(t, fitT(j), fitT(j) + 0.22, (q) => q);
// degrau marcado em amarelo que faz a volta inteira (cena "corrente": sobem por cima e voltam por baixo)
const MK = { t0: A.sobem - 0.1, top: A.baixo - 0.6, arc: A.baixo - 0.35, t1: A.essa - 0.25 };
const K_MARK = kAt(uAtX(-4.6), MK.t0);
const markF = (t: number) => {
  // fração extra do laço percorrida além do movimento normal da corrente
  const u0 = stepU(K_MARK, sAt(MK.t0));
  const dTop = Math.max(0.5, LOOP.carryLen + 0.15 - u0 - (sAt(MK.top) - sAt(MK.t0)));
  const dArc = PI * E.Rc + 0.3;
  const rest = LOOP.L - dTop - dArc;
  if (t <= MK.t0) return 0;
  if (t < MK.top) return (dTop * ease.inOut(prog(t, MK.t0 + 0.05, MK.top))) / LOOP.L;
  if (t < MK.arc) return (dTop + dArc * prog(t, MK.top, MK.arc, (q) => q)) / LOOP.L;
  if (t < MK.t1) return (dTop + dArc + rest * ease.inOut(prog(t, MK.arc, MK.t1))) / LOOP.L;
  return 1;
};
const markU = (t: number) => stepU(K_MARK, sAt(t)) + markF(t) * LOOP.L;
// brilho dourado sincronizado (bike x escada) na tela dividida
const syncGlow = (t: number) =>
  prog(t, A.volta - 0.15, A.volta + 0.1) * (1 - prog(t, A.sobem - 0.35, A.sobem - 0.1)) * (0.75 + 0.25 * Math.sin(t * 2 * PI * 1.2)) +
  bump(t, A.corrente, 0.8) * 0.6 +
  bump(t, A.bicicleta, 0.6) * 0.4;

// ======================================================================
// SET PRINCIPAL: shopping + escada + pessoas + extras de cada cena
// ======================================================================
type SetOpt = { xr: number; dark: number; city: boolean; stair?: boolean; hook?: boolean; light?: V3; hk?: boolean; lite?: boolean; rw?: boolean; noShadow?: boolean; bare?: boolean };

const peopleAt = (t: number): Pessoa[] => {
  const s = sAt(t);
  const P: Pessoa[] = [];
  // ABERTURA (0 → fim da cena "corrente"): esteira, rolando, montagem dos degraus, corrente
  if (t < S("parada")) P.push(...openPeople(t));
  // PARADA: Tião puxa a corrente e cai sentado
  if (t >= S("parada") - 0.05 && t < S("maquina")) {
    const pull = prog(t, S("parada") + 0.1, A.anda);
    const slip = ease.in(prog(t, A.anda + 0.2, A.anda + 0.55));
    P.push({ p: [-4.3 - slip * 0.5, 0, 0.0], ry: -PI / 2, shirt: TIAO, lean: lerp(0.5, -0.45, pull) * (1 - slip), armL: [-0.9 + slip * 0.5, 0, 0.15], armR: [-0.9 + slip * 0.5, 0, -0.15], sit: slip, mood: slip > 0.3 ? "sad" : "shock", sweat: 1, id: 1 });
  }
  // EMPINA: boneco no degrau que empina e cai de cara
  if (t >= S("empina") && t < S("trilhos")) {
    const phi = empPhi(t);
    const os = onStep(K_EMP, t, phi);
    const fall = ease.in(prog(t, A.empina + 0.05, A.empina + 0.45));
    P.push({ p: [os.p[0], os.p[1], 0.05], ry: PI / 2, rx: os.rx + fall * 1.3, piv: 0.1, shirt: "#2E6FD8", mood: phi > 0.1 ? "shock" : "neutral", pose: phi > 0.2 ? "up" : "down", id: 40 });

  }
  // TRILHOS: Tião pisa no começo que parece esteira e leva um tranco
  if (t >= A.esteiraT - 1.4 && t < S("segurar")) {
    const tb = A.esteiraT - 0.4;
    if (t < tb) {
      const x = lerp(-8.4, XC_B + 0.2, prog(t, A.esteiraT - 1.4, tb, (x) => x));
      P.push({ p: [x, 0, 0], ry: PI / 2, shirt: TIAO, legL: Math.sin(t * 10) * 0.5, legR: -Math.sin(t * 10) * 0.5, id: 1, bags: 0 });
    } else {
      const kT = kAt(uAtX(XC_B + 0.25), tb);
      const os = onStep(kT, t);
      const jolt = bump(t, tb + 0.15, 0.35);
      P.push({ p: [os.p[0], os.p[1], 0], ry: PI / 2, shirt: TIAO, lean: -jolt * 0.5, armL: [0, 0, -1.6 * jolt], armR: [0, 0, 1.6 * jolt], mood: jolt > 0.2 ? "shock" : "happy", id: 1 });
    }
  }
  // SEGURAR: escada lotada sem corrimão; um desequilibra e agarra o vizinho
  if (t >= S("segurar") && t < S("corrimao")) {
    const kW = kAt(uAtX(0.6), S("segurar"));
    const os = onStep(kW, t);
    const wob = prog(t, A.desequilibra - 0.2, A.desequilibra + 0.3);
    const grab = prog(t, A.vizinho - 0.4, A.vizinho);
    const sw = Math.sin((t - A.desequilibra) * 7) * 0.35 * wob * (1 - grab);
    const whirl = Math.sin(t * 16) * 0.9 * wob * (1 - grab);
    const tomb = ease.in(prog(t, A.vizinho + 0.05, A.vizinho + 0.6));
    P.push({ p: [os.p[0] - tomb * 0.35, os.p[1], 0.15], ry: PI / 2, rz: sw, rx: -tomb * 1.0, piv: 0.1, shirt: "#9B59B6", pose: "down", armR: [whirl, 0, 1.9 * wob + 0.3 * grab], armL: grab > 0.1 ? [-1.3 * grab, 0, -0.6 * grab] : [-whirl, 0, -1.9 * wob], mood: wob > 0.2 ? "shock" : "neutral", sweat: wob, id: 50 });
    const os2 = onStep((kW + 1) % N_STEPS, t);
    P.push({ p: [os2.p[0] - tomb * 0.4, os2.p[1], -0.15], ry: PI / 2, rx: -tomb * 0.9, piv: 0.1, pose: tomb > 0.2 ? "up" : "down", shirt: "#E8483B", mood: grab > 0.3 ? "shock" : "neutral", id: 51 });
    const os3 = onStep((kW + N_STEPS - 2) % N_STEPS, t);
    P.push({ p: [os3.p[0], os3.p[1], 0.0], ry: PI / 2, shirt: TIAO, mood: grab > 0.2 ? "shock" : "neutral", look: [0.3, 0.4], id: 1 });
    P.push(...riders({ s, t, seed: 5, dens: 0.75, skip: new Set([kW, (kW + 1) % N_STEPS, (kW + N_STEPS - 2) % N_STEPS, (kW + N_STEPS - 1) % N_STEPS]) }));
  }
  // ATRITO: a mão do Tião fica para trás e ele cai de costas em quem vem atrás
  if (t >= A.mao - 1.2 && t < S("sensor")) {
    const kT = kAt(uAtX(-0.6), A.mao - 1.2);
    const os = onStep(kT, t);
    const lag = prog(t, A.atrasa, A.mao + 0.2);
    const fall = ease.in(prog(t, A.cai - 0.05, A.costas + 0.25));
    P.push({ p: [os.p[0] - fall * 0.6, os.p[1] - fall * 0.3, 0.12], ry: PI / 2, rx: -fall * 1.25, piv: 0.1, shirt: TIAO, armL: [0.3 + lag * 1.4, 0, -0.45], pose: "down", mood: lag > 0.4 ? "shock" : "neutral", lean: -0.25 * lag, id: 1 });
    const kB = (kT + N_STEPS - 2) % N_STEPS;
    const ob = onStep(kB, t);
    const fall2 = ease.in(prog(t, A.atras - 0.45, A.atras + 0.2));
    P.push({ p: [ob.p[0] - fall2 * 0.5, ob.p[1], 0.05], ry: PI / 2, rx: -fall2 * 1.2, piv: 0.1, shirt: "#1FB5B5", pose: fall2 > 0.1 ? "up" : "down", mood: fall > 0.3 ? "shock" : "neutral", id: 60 });
  }
  // SENSOR: a mão do Tião vai parar na frente
  if (t >= A.porIsso - 0.6 && t < S("lateral")) {
    const t0 = A.porIsso - 0.6;
    const kT = kAt(uAtX(-3.0), t0);
    const os = onStep(kT, t);
    const fw = prog(t, t0 + 0.2, A.frente + 0.4);
    const boing = bump(t, A.frente + 0.45, 0.5);
    P.push({ p: [os.p[0], os.p[1], 0.12], ry: PI / 2, shirt: TIAO, armL: [-0.15 - fw * 0.95, 0, -0.45 + fw * 0.15], mood: boing > 0.1 || fw > 0.85 ? "shock" : "happy", look: [0.6, -0.3], headLean: 0.15 * boing, id: 1 });
  }
  // LATERAL: chinelo puxado pela fresta
  if (t >= S("lateral") && t < S("escovas")) {
    const kC = kAt(uAtX(-1.0), S("lateral"));
    const os = onStep(kC, t);
    const pull = prog(t, A.fresta, A.dentro + 0.1);
    P.push({ p: [os.p[0] - pull * 0.05, os.p[1], 0.26], ry: PI / 2, shirt: "#E84D8A", legL: -pull * 0.2, lean: 0.25 * pull, mood: t > A.chinelo ? "shock" : "neutral", sweat: t > A.chinelo ? 1 : 0, look: [0.8, -0.8], id: 70 });
  }
  // ESCOVAS: esfrega o tênis; cócegas; volta pro meio
  if (t >= A.sapato - 1.0 && t < A.fique - 0.4) {
    const kE = kAt(uAtX(-1.2), A.sapato - 1.0);
    const os = onStep(kE, t);
    const rub = t < A.encosta - 0.2 ? Math.sin(t * 12) * 0.35 * prog(t, A.sapato - 0.8, A.sapato - 0.5) : 0;
    const tick = prog(t, A.cocegas - 0.2, A.cocegas + 0.2) * (1 - prog(t, A.meio - 0.3, A.meio + 0.2));
    const back = prog(t, A.meio - 0.4, A.meio + 0.2);
    P.push({ p: [os.p[0], os.p[1], lerp(0.3, 0.02, back) + tick * Math.sin(t * 24) * 0.02], ry: PI / 2, shirt: "#FF8A1E", legL: rub, mood: tick > 0.05 || back > 0.5 ? "happy" : "neutral", lean: tick * 0.15 * Math.sin(t * 19), headLean: tick * 0.25 * Math.sin(t * 15), id: 80 });
  }
  if (t >= A.fique - 0.4 && t < S("mergulha")) P.push(...riders({ s, t, seed: 8, dens: 0.4, zSpread: 0.15 }));
  // MERGULHA: pessoa chegando no topo (cadarço puxado)
  if (t >= S("mergulha") && t < S("pente")) {
    const kM = kAt(uAtX(XC_T - 1.3), S("mergulha"));
    const os = onStep(kM, t);
    const pull = prog(t, A.cadarco, A.dedo + 0.1);
    const mp = mergPos(t);
    if (!(t >= A.cadarco - 0.8 && t < A.dedo - 0.55)) P.push({ p: [mp.px, E.H, -0.25], ry: PI / 2, shirt: "#2E6FD8", legR: pull * 0.35, lean: 0.12 + 0.2 * pull, mood: t > A.cadarco ? "shock" : "neutral", sweat: t > A.cadarco ? 1 : 0, look: t > A.tenis ? [0, 0] : [0, -1], id: 90 });
  }
  // PENTE: tênis passando pelo pente (levantado)
  if (t >= A.pente - 0.3 && t < A.forcar - 0.2) {
    const kP = kAt(uAtX(XC_T - 0.9), A.encaixa - 0.6);
    const os = onStep(kP, t);
    const x = os.p[0] < XC_T - 0.1 ? os.p[0] : XC_T - 0.1 + (os.p[0] - XC_T + 0.1) * 1.4;
    P.push({ p: [x, E.H + (os.p[0] > XC_T - 0.12 ? 0.02 : 0), -0.3], ry: PI / 2, shirt: "#3DAA66", mood: "happy", legL: Math.sin(t * 6) * 0.2, id: 91 });
  }
  // CRIANÇA / PROTETOR: criança com a mão no corrimão chegando no topo
  if (t >= S("crianca") && t < S("luz")) {
    const kp = kidPose(t);
    const q = KID_Q(t);
    const smile = q > 0.5;
    // adulto ao lado (dá a escala de criança)
    if (t < S("luz")) {
      const ax = Math.min(kp.x - 0.5, XC_T - 0.3);
      P.push({ p: [ax, ax < XC_T ? treadY(ax) : E.H, -0.12], ry: PI / 2, shirt: "#2E6FD8", mood: t > A.maozinha && t < S("protetor") ? "shock" : "neutral", look: [0.5, -0.3], id: 96 });
    }
    const reachA = -Math.atan2(kp.h.x - kp.x, kp.y + 1.38 * KID_S - kp.h.y);
    P.push({ p: [kp.x, kp.y, KID_Z], ry: lerp(PI / 2, PI / 2 - 0.9, q), s: KID_S, shirt: "#E84D8A", armL: [lerp(reachA, 0, q), 0, 0.12 * q], mood: smile ? "happy" : t > A.maozinha && t < S("protetor") ? "shock" : "happy", look: smile ? [0.6, 0.3] : [0.8, -0.6], sweat: t > A.maozinha && t < S("protetor") ? 1 - q : 0, id: 95 });
    // Tião corre (no fundo)
    if (t >= A.maozinha && t < S("protetor") + 1.5) {
      const xr = lerp(13.5, 8.2, prog(t, A.maozinha, S("protetor") + 1.0, (x) => x));
      P.push({ p: [xr, E.H, 1.6], ry: -PI / 2 - 0.3, shirt: TIAO, legL: Math.sin(t * 16) * 0.8, legR: -Math.sin(t * 16) * 0.8, pose: "up", mood: "shock", id: 1 });
    }
  }
  // LUZ / FREIO1: escada lotada, volta de ré, braços para cima; trava com tranco
  if (t >= S("luz") && t < S("arrebenta")) {
    const back = vAt(t) < -0.05;
    const jolt = bump(t, A.trava, 0.25);
    P.push(...riders({ s, t, seed: 11, dens: 0.8, arms: back ? 0.9 : 0, mood: back ? "shock" : undefined, sway: jolt * 0.25, hand: true }));
  }
  // ARREBENTA: ré disparando, todos para cima, empilham embaixo
  if (t >= S("arrebenta") && t < S("hongkong")) {
    const back = t > A.arrebentar + 0.4;
    P.push(...riders({ s, t, seed: 11, dens: 0.8, arms: back ? 1 : 0, mood: back ? "shock" : undefined, pile: back, hand: !back, sway: back ? 0.15 : 0 }));
  }
  // HONG KONG
  if (t >= S("hongkong") && t < S("freio2")) {
    const back = t > A.fez + 0.4;
    P.push(...riders({ s, t, seed: 21, dens: 0.85, arms: back ? 1 : 0, mood: back ? "shock" : undefined, pile: back, sway: back ? 0.2 : 0 }));
  }
  // FREIO2: dispara/ré e trava; ninguém cai
  if (t >= S("freio2") && t < S("botao")) {
    const back = vAt(t) < -0.05;
    const jolt = bump(t, A.trava2, 0.3);
    P.push(...riders({ s, t, seed: 11, dens: 0.75, arms: back ? 0.8 : 0, mood: back ? "shock" : jolt > 0.1 ? "shock" : undefined, sway: jolt * 0.3, hand: !back }));
  }
  // BOTÃO: alguém cai na saída e a escada empilha gente em cima; Tião aperta o botão
  if (t >= S("botao") && t < S("coloque")) {
    const t0 = A.caiB - 0.4;
    const ks: number[] = [];
    for (let i = 0; i < 9; i++) ks.push(kAt(uAtX(XC_T - 0.9 - i * 0.42), t0));
    ks.forEach((k, i) => {
      const u = stepU(k, s);
      const tp = treadPos(Math.min(u, U_EXIT));
      if (i === 0) {
        const fallen = t >= A.caiB;
        const f = ease.in(prog(t, A.caiB - 0.1, A.caiB + 0.3));
        const x = Math.min(tp[0] + (t > t0 ? (t - t0) * 0.5 : 0), XC_T + 0.55);
        P.push({ p: [x + f * 0.4, E.H, 0.0], ry: PI / 2, rx: f * 1.45, piv: 0.1, shirt: "#7A5230", pose: fallen ? "up" : "down", mood: "shock", id: 200 });
        return;
      }
      if (u >= U_EXIT - 0.05) {
        const j = i;
        const h = Math.floor((j - 1) / 2);
        // no close do botão a pilha fica entre a câmera e o botão: some só nesse plano
        if (t >= A.botao - 0.4 && t < A.aperta + 0.6) return;
        P.push({ p: [XC_T + 0.45 + ((j - 1) % 2) * 0.35, E.H + 0.18 + h * 0.3, ((j % 3) - 2) * 0.25], ry: PI / 2 + (rnd(j, 2) - 0.5) * 0.6, rx: -1.3 - rnd(j, 3) * 0.2, piv: 0.1, shirt: SHIRTS[j % SHIRTS.length], pose: "up", mood: "shock", sweat: 1, id: 200 + j });
      } else {
        P.push({ p: [tp[0], tp[1], ((i % 3) - 1) * 0.15], ry: PI / 2, shirt: SHIRTS[i % SHIRTS.length], mood: "neutral", id: 200 + i });
      }
    });
    // Tião no topo, ao lado do botão
    const slap = prog(t, A.aperta - 0.35, A.aperta);
    const tx = lerp(10.5, XN_T + 0.25, prog(t, A.empilhando, A.pontasB + 0.3, (x) => x));
    P.push({ p: [tx, E.H, -0.6], ry: t < A.pontasB + 0.3 ? -PI / 2 : 0.2, legL: t < A.pontasB + 0.3 ? Math.sin(t * 14) * 0.7 : 0, legR: t < A.pontasB + 0.3 ? -Math.sin(t * 14) * 0.7 : 0, shirt: TIAO, armR: [-1.2 - 0.3 * slap, 0, 0.6 * slap - 0.2], lean: 0.25 * slap, mood: t > A.aperta ? "happy" : "shock", id: 1 });
  }
  // COLOQUE: gente ignorando o adesivo; tio parado na saída com o celular
  if (t >= S("coloque") && t < S("pisar")) {
    P.push(...riders({ s, t, seed: 31, dens: 0.55, maxX: XC_T + 0.6 }));
    const tio = t >= A.tio - 0.3;
    if (tio) {
      P.push({ p: [XC_T + 0.6, E.H, 0], ry: PI / 2, shirt: "#4A4F57", phone: true, mood: "relaxed", headLean: 0.35, id: 300, cap: true });
      // a fila espremida atrás do tio
      [0.45, 0.8, 1.15].forEach((dx, i) => P.push({ p: [XC_T + 0.5 - dx * 0.75, E.H, ((i % 2) - 0.5) * 0.3], ry: PI / 2, shirt: SHIRTS[i + 4], mood: "sad", lean: 0.2, id: 301 + i }));
    }
  }
  // PISAR / FINAL: Tião volta com as sacolas e sobe sorrindo
  if (t >= S("pisar") - 0.1 && t < S("cta")) {
    const tb = S("pisar") + 0.25;
    if (t < tb) {
      const x = lerp(-8.0, XC_B + 0.2, prog(t, S("pisar") - 0.6, tb, (x) => x));
      P.push({ p: [x, 0, 0], ry: PI / 2, shirt: TIAO, bags: 2, legL: Math.sin(t * 10) * 0.5, legR: -Math.sin(t * 10) * 0.5, mood: "happy", id: 1 });
    } else {
      const kT = kAt(uAtX(XC_B + 0.25), tb);
      const os = onStep(kT, t);
      P.push({ p: [os.p[0], os.p[1], 0.1], ry: PI / 2, shirt: TIAO, bags: 2, mood: "happy", id: 1 });
    }
    P.push(...riders({ s, t, seed: 41, dens: 0.35 }));
  }
  if (t >= S("final") && t < END) P.push(...riders({ s, t, seed: 43, dens: 0.3 }));
  return P;
};

const SetMain: React.FC<{ t: number; o: SetOpt }> = ({ t, o }) => {
  const st = escState(t, o);
  const ppl = o.lite ? [] : peopleAt(t);
  const fill = 1 - prog(t, O.xr0, O.xr0 + 0.5, (q) => q);
  const hatch = prog(t, A.piso - 0.15, A.piso + 0.45) * (1 - prog(t, S("empina") - 0.6, S("empina") - 0.1));
  return (
    <group>
      {o.city ? (
        <group position={[0, -0.28, 0]}>
          <CityWorld t={t} mood="day" plot="plaza" />
        </group>
      ) : null}
      <Mall t={t} xray={o.xr} dark={o.dark} stair outside={!o.city} fill={fill} hatch={hatch} lite={o.lite} />
      <group position={[0, 0, BELT.z0]}>
        <Checkout x0={BELT.x0} t={t} laser={t < O.p3 ? 1 : 0} />
      </group>
      <Escalator t={t} st={st} />
      <Gente t={t} list={ppl} noShadow={!!o.noShadow} />
      {o.light ? <pointLight position={o.light} intensity={6} distance={6} decay={1.4} color="#FFF2DC" /> : null}
      <Extras t={t} st={st} rw={!!o.rw} />
    </group>
  );
};

// Efeitos e etiquetas presas ao 3D
const Extras: React.FC<{ t: number; st: EscState; rw?: boolean }> = ({ t, st, rw = false }) => {
  const items: React.ReactNode[] = [];
  const tag = (key: string, p: V3, text: string, a: number, b: number, dot = "#FF3B2B", size = 0.032) => {
    if (t >= a && t < b) items.push(<Tag3D key={key} position={p} text={text} show={prog(t, a, a + 0.3, (x) => x)} dot={dot} size={size} />);
  };
  // ===================== ABERTURA =====================
  if (t < O.xr0 + 0.6) {
    const b = beltAt(t);
    items.push(<Esteira key="est" p={b.p} ang={b.ang} len={BELT.len} belt={b.belt} legs={b.legs} lona={b.lona} opacity={b.opacity} products={b.products} />);
    // rolo da lona: depois de enrolar até o pé, cai no chão ao lado e fica ali
    if (t >= O.lona[1]) {
      const k = prog(t, O.lona[1], O.lona[1] + 0.35, (q) => q);
      const op = b.opacity;
      items.push(
        <mesh key="rolo" position={[lerp(BELT.x + 0.05, BELT.x - 0.5, k), lerp(BELT.y + 0.12, 0.16, k * k), lerp(0, 0.95, k)]} rotation={[PI / 2, 0, k * 4]} castShadow={op > 0.99}>
          <cylinderGeometry args={[0.155, 0.155, 0.72, 20]} />
          <meshStandardMaterial color="#2A2C30" roughness={0.8} transparent={op < 0.99} opacity={op} depthWrite={op > 0.5} />
        </mesh>,
      );
    }
    // ideia (lâmpada) quando ele olha a esteira andando
    if (t >= A.inclina - 0.05 && t < O.p3) {
      const k = born(t, A.inclina, 0.3);
      const bp: V3 = [TP2[0] + 0.1, 2.25, TP2[2]];
      items.push(
        <group key="ideia" position={bp} scale={k}>
          <mesh>
            <sphereGeometry args={[0.11, 16, 12]} />
            <meshStandardMaterial color="#FFE36A" emissive="#FFD23F" emissiveIntensity={1.3} />
          </mesh>
          <mesh position={[0, -0.13, 0]}>
            <cylinderGeometry args={[0.05, 0.05, 0.07, 12]} />
            <meshStandardMaterial color="#9AA3AA" metalness={0.5} />
          </mesh>
        </group>,
      );
      items.push(<Glow key="ideiaG" position={bp} size={0.8 * k} color="#FFE7A0" opacity={0.75} />);
    }
    // pancada da ponta encaixando na borda de cima (poeirinha + brilho)
    const land = O.tilt[1];
    if (t >= land - 0.02 && t < land + 1.0) {
      const tip: V3 = [BELT.x + BELT.len * Math.cos(BELT.ang), BELT.y + BELT.len * Math.sin(BELT.ang), 0];
      items.push(<Dust key="pancada" t={t} t0={land} origin={tip} n={16} spread={1.1} size={0.14} seed={4} dur={0.8} />);
      if (t < land + 0.2) items.push(<Glow key="pancG" position={tip} size={1.2 * (1 - (t - land) / 0.2)} color="#FFF2D0" opacity={0.8} />);
    }
    // pés escorregando na lona inclinada (setas vermelhas descendo a rampa)
    if (t >= O.slip - 0.05 && t < Math.max(...O.fall) + 0.2) {
      RID.forEach((_, i) => {
        const a0 = i === 1 ? O.slip : O.fall[i] - 0.25;
        if (t < a0 || t >= O.fall[i] + 0.1) return;
        const d = rideD(i, Math.min(t, O.fall[i]));
        const pa = beltPt(d + 0.15, 0.12), pb = beltPt(d - 0.75, 0.12);
        items.push(<ThinArrow key={`slip${i}`} a={[pa[0], pa[1], 0.55]} b={[pb[0], pb[1], 0.55]} p={prog(t, a0, a0 + 0.2)} color="#FF3B2B" r={0.035} head={0.16} />);
      });
    }
    // laranjas e sacolas voando
    if (t >= Math.min(...O.fall) - 0.4 && t < O.p8) {
      ORANGES.forEach((o, i) => {
        const p = orangePos(o, t);
        if (p) items.push(<Laranja key={`or${i}`} p={p} rot={t * 8 + i} />);
      });
      RID.forEach((r, i) => {
        const dt = t - (O.fall[i] + 0.05);
        if (dt < 0) return;
        const o = beltPt(rideD(i, O.fall[i]), 0.8);
        const y = Math.max(0.2, o[1] + 2.6 * dt - 4.9 * dt * dt);
        const k = Math.min(dt, 0.9);
        items.push(
          <group key={`sac${i}`} position={[o[0] - k * 2.2, y, (i - 1.5) * 0.8 * k]} rotation={[k * 5, k * 3, k * 4]}>
            <Sacolas n={1} />
          </group>,
        );
        void r;
      });
    }
    // laranja na testa (close)
    const fo = faceOrange(t);
    if (fo) items.push(<Laranja key="fo" p={fo} r={0.075} rot={t * 10} />);
    if (t >= HIT && t < HIT + 0.9) {
      for (let i = 0; i < 7; i++) {
        const d = t - HIT;
        const an = (i / 7) * PI * 2;
        items.push(
          <mesh key={`suco${i}`} position={[FACE.x + 0.06 + Math.cos(an) * d * 0.9, 0.98 + Math.sin(an) * d * 0.7 + 0.5 * d - 3 * d * d, FACE.z + 0.32 + d * 0.4]} scale={0.025 * (1 - d)}>
            <sphereGeometry args={[1, 8, 6]} />
            <meshStandardMaterial color="#FFB02E" emissive="#FF8A1E" emissiveIntensity={0.4} />
          </mesh>,
        );
      }
      if (t < HIT + 0.25) items.push(<Glow key="hitG" position={[FACE.x, 0.95, FACE.z + 0.35]} size={0.6 * (1 - (t - HIT) / 0.25)} color="#FFE7B0" opacity={0.9} />);
    }
    // um degrau sozinho, descendo pela grua (close): alumínio com ranhuras, pino e rodinhas
    if (t >= O.p9 - 0.05 && t < O.p10 + 0.05) {
      const k = ease.out(prog(t, O.showIn[0], O.showIn[1], (q) => q));
      const sw = Math.sin((t - O.showIn[0]) * 6) * 0.07 * (1 - prog(t, O.showIn[1], O.showIn[1] + 0.8));
      const pos: V3 = [SHOW[0], lerp(SHOW[1] + 1.7, SHOW[1], k), SHOW[2]];
      items.push(
        <group key="vitrine" position={pos} rotation={[0, -0.55, sw]}>
          <Steps s={0} vis={(kk) => (kk === 0 ? 1 : 0)} pose={(kk) => (kk === 0 ? new THREE.Matrix4() : null)} grooves={1} wheels={1} axle={1} />
          {[[-0.15, -0.45], [-0.15, 0.45], [0.15, -0.45], [0.15, 0.45]].map(([x, z], i) => (
            <Rod key={i} a={[x, 0.0, z]} b={[0, 1.15, 0]} r={0.008} color="#FF8A1E" />
          ))}
          <mesh position={[0, 1.2, 0]}>
            <torusGeometry args={[0.06, 0.018, 8, 16, PI * 1.4]} />
            <meshStandardMaterial color="#F2C230" metalness={0.5} roughness={0.4} />
          </mesh>
          <Rod a={[0, 1.25, 0]} b={[0, 6.0, 0]} r={0.012} color="#3A3F45" />
        </group>,
      );
      tag("dgr", [SHOW[0] + 0.45, SHOW[1] + 0.35, SHOW[2] + 0.5], "DEGRAU DE ALUMÍNIO", A.degraus - 0.05, O.p10 + 0.05, "#FF8A1E", 0.034);
    }
    // montagem: poeirinha a cada degrau que encaixa + linhas de nível sobre cada piso ("reto")
    if (t >= O.fit[0] && t < O.p11) {
      carryKs.forEach((k, j) => {
        const tl = fitT(j) + 0.22;
        const u = stepU(k, 0);
        const tp = treadPos(u);
        if (t >= tl && t < tl + 0.22) items.push(<Glow key={`clk${j}`} position={[tp[0], tp[1] + 0.04, 0.5]} size={0.45 * (1 - (t - tl) / 0.22)} color="#FFFFFF" opacity={0.7} />);
        if (t >= A.reto - 0.35 && j % 3 === 1 && tp[0] > -3.6 && tp[0] < 3.6) {
          const sh = prog(t, A.reto - 0.35 + j * 0.006, A.reto - 0.1 + j * 0.006);
          for (let q = 0; q < 4; q++)
            items.push(
              <mesh key={`lv${j}_${q}`} position={[tp[0] - 0.27 + q * 0.18, tp[1] + 0.035, 0.56]} scale={[sh, 1, 1]}>
                <boxGeometry args={[0.1, 0.018, 0.018]} />
                <meshBasicMaterial color="#3DDC6A" toneMapped={false} />
              </mesh>,
            );
        }
      });
    }
    // Tião subindo: setas vermelhas dos degraus soltos escorregando
    if (t >= T_SLIDE - 0.05 && t < S("corrente") - 0.2) {
      const p = prog(t, T_SLIDE - 0.05, T_SLIDE + 0.25);
      [
        [2.6, 0.4],
        [0.2, -2.0],
        [-2.2, -4.2],
      ].forEach(([x0, x1], i) =>
        items.push(<ThinArrow key={`sl${i}`} a={[x0, treadY(x0) + 0.55, 0.75]} b={[x1, treadY(x1) + 0.55, 0.75]} p={p} color="#FF3B2B" r={0.05} head={0.24} />),
      );
    }
  }
  // degraus presos na corrente: "clique" (brilho) quando cada um encaixa
  if (t >= T_ATTACH && t < T_ATTACH + 1.7) {
    carryKs.forEach((k, j) => {
      const ta = T_ATTACH + (j / carryKs.length) * 0.9 + 0.45;
      if (t >= ta && t < ta + 0.2) {
        const tp = treadPos(stepU(k, sAt(t)));
        items.push(<Glow key={`at${j}`} position={[tp[0], tp[1] + 0.03, 0.6]} size={0.4 * (1 - (t - ta) / 0.2)} color="#FFE29A" opacity={0.8} />);
      }
    });
  }
  // o degrau marcado faz a volta inteira (sobe por cima, volta por baixo de cabeça pra baixo)
  if (t >= MK.t0 - 0.05 && t < MK.t1 + 0.15) {
    const u = markU(t);
    items.push(<Steps key="mark" s={0} vis={(k) => (k === 0 ? 1 : 0)} pose={(k) => (k === 0 ? stepFrame(u) : null)} grooves={1} glow={0.85} yellow={1} axle={1} />);
    const tp = treadPos(u);
    items.push(<Glow key="markG" position={[tp[0], tp[1], 0.6]} size={0.9} color="#FFE36A" opacity={0.55} />);
    // rastro amarelo (lê-se como movimento, não como salto)
    for (let q = 1; q <= 6; q++) {
      const pq = treadPos(markU(t - q * 0.018));
      items.push(<Glow key={`mkT${q}`} position={[pq[0], pq[1], 0.6]} size={0.7 * (1 - q / 7)} color="#FFD23F" opacity={0.45 * (1 - q / 7)} />);
    }
    items.push(<ThinArrow key="mkUp" a={[-3.6, 0.95, 0.95]} b={[3.3, 5.0, 0.95]} p={prog(t, MK.t0, MK.t0 + 0.5) * (1 - prog(t, MK.arc + 0.2, MK.arc + 0.5))} color="#2FB34E" r={0.06} head={0.3} />);
    items.push(<ThinArrow key="mkDn" a={[3.4, 3.0, 0.95]} b={[-3.5, -1.05, 0.95]} p={prog(t, MK.arc - 0.1, MK.arc + 0.4)} color="#FF8A1E" r={0.06} head={0.3} />);
  }
  // freio de serviço: setas da mola (vermelhas, apertando) e do eletroímã (azuis, soltando)
  if (t >= A.mola - 0.15 && t < S("arrebenta")) {
    const bc: V3 = [MCH.gear[0] + 0.02, MCH.gear[1] - 0.02 + 0.22, MCH.motorZ0 - 0.05];
    const red = (t < A.eletricidade - 0.05 ? prog(t, A.mola - 0.15, A.mola + 0.15) : 0) + (t >= A.sem ? prog(t, A.sem, A.sem + 0.25) : 0);
    const blue = t >= A.eletricidade && t < A.sem ? prog(t, A.eletricidade, A.eletricidade + 0.3) : 0;
    if (red > 0.01)
      [-1, 1].forEach((sd) => items.push(<ThinArrow key={`mr${sd}`} a={[bc[0] + sd * 0.85, bc[1], bc[2]]} b={[bc[0] + sd * 0.36, bc[1], bc[2]]} p={red} color="#FF3B2B" r={0.03} head={0.12} />));
    if (blue > 0.01)
      [-1, 1].forEach((sd) => items.push(<ThinArrow key={`mb${sd}`} a={[bc[0] + sd * 0.3, bc[1] + 0.06, bc[2]]} b={[bc[0] + sd * 0.7, bc[1] + 0.06, bc[2]]} p={blue} color="#2F7BFF" r={0.03} head={0.12} />));
  }
  // placa-pente recuando (seta) quando algo força
  if (t >= A.recua - 0.3 && t < A.placa - 0.3) {
    items.push(<ThinArrow key="recuo" a={[XC_T - 0.1, E.H + 0.16, -0.32]} b={[XC_T + 0.32, E.H + 0.16, -0.32]} p={prog(t, A.recua - 0.3, A.recua)} color="#FF3B2B" r={0.025} head={0.1} />);
  }
  // degrau que empina: caixa de laranja em cima cai; seta curva no pino
  if (t >= S("empina") && t < S("trilhos")) {
    const phi = empPhi(t);
    const F = stepFrame(stepU(K_EMP, sAt(tEff(t))), phi);
    const tf = A.empina + 0.1;
    if (t < tf + 1.2) {
      const cp = new THREE.Vector3(0.02, 0.12, -0.28).applyMatrix4(F);
      const dt = Math.max(0, t - tf);
      const pos: V3 = [cp.x - 1.4 * dt, Math.max(0.12, cp.y - 4.9 * dt * dt), cp.z + 0.3 * dt];
      items.push(
        <group key="caixote" position={pos} rotation={[0, 0, phi + dt * 3]}>
          <mesh castShadow>
            <boxGeometry args={[0.3, 0.2, 0.26]} />
            <meshStandardMaterial color="#C48A4A" roughness={0.8} />
          </mesh>
          {[-0.08, 0.0, 0.08].map((x, i) => (
            <Laranja key={i} p={[x, 0.14 + (dt > 0 ? dt * (i + 1) * 0.3 : 0), (i - 1) * 0.06]} r={0.06} rot={t * 6 + i} />
          ))}
        </group>,
      );
    }
    const pin = loopAt(stepU(K_EMP, sAt(tEff(t))));
    items.push(<ArcArrow key="giro" c={[pin.x, pin.y, 0.75]} r={0.42} a0={1.9} a1={0.5} p={prog(t, A.empina - 0.25, A.empina + 0.05)} color="#FF3B2B" />);
  }
  // degraus: placas "fresadas" (ranhuras sendo abertas no degrau do close)
  if (t >= S("pente") && t < A.ranhuras + 0.6) {
    const kG = kAt(uAtX(5.25), S("pente") + 0.2);
    const F = stepFrame(stepU(kG, sAt(t)));
    const zc = lerp(-0.5, 0.5, prog(t, S("pente") + 0.25, A.ranhuras + 0.5, (x) => x));
    const ribs: React.ReactNode[] = [];
    for (let i = 0; i < 34; i++) {
      const z = -0.49 + i * 0.0297;
      if (z > zc) break;
      ribs.push(
        <mesh key={i} position={[0, 0.004, z]}>
          <boxGeometry args={[0.41, 0.012, 0.012]} />
          <meshBasicMaterial color="#FFD23F" toneMapped={false} />
        </mesh>,
      );
    }
    const pp = new THREE.Vector3(), qq = new THREE.Quaternion(), ss = new THREE.Vector3();
    F.decompose(pp, qq, ss);
    items.push(
      <group key="mill" position={pp} quaternion={qq}>
        {/* as ranhuras (que o degrau já tem) acendem em amarelo, uma a uma */}
        {ribs}
      </group>,
    );
  }
  // tags (etiquetas presas ao 3D)
  const kE = K_EMP;
  if (t >= S("empina") && t < S("trilhos")) {
    const os = onStep(kE, t, empPhi(t));
    tag("pino", [os.p[0] + 0.15, os.p[1] - 0.35, 0.65], "PINO", A.balanca - 0.6, S("trilhos"), "#FF3B2B");
  }
  tag("cor", [-2.0, treadY(-2.0) - 0.4, 0.7], "CORRENTE DE AÇO", A.corrente - 0.1, A.bicicleta + 0.85, "#FF8A1E", 0.036);
  tag("mot", [MCH.gear[0] + 0.05, MCH.gear[1] + 0.32, 0.5], "MOTOR", A.motor, A.menor - 0.05);
  tag("men", [6.75, 3.7, MCH.zDrive + 0.05], "CORRENTE MENOR", A.menor, A.rodas);
  tag("rod", [E.XT - 0.1, E.yT + 0.1, 0.6], "RODAS QUE PUXAM", A.rodas, A.maquina + 0.6);
  if (t >= S("trilhos") && t < S("segurar")) {
    tag("rdn", [-0.6, treadY(-0.6) - 0.42, 0.8], "RODINHAS", A.rodinhas, A.trilhos);
    tag("tf", [-1.2, treadY(-1.2) - 0.25, 0.75], "TRILHO DA FRENTE", A.trilhos, A.pontas - 0.1, "#E8352B");
    tag("tt", [-0.4, treadY(-0.4) - 0.62, 0.75], "TRILHO DE TRÁS", A.trilhos + 0.3, A.pontas - 0.1, "#2FB34E");
  }
  tag("bor", [0.8, hrY(0.8) + 0.25, 0.65], "BORRACHA", A.borracha, A.junto + 0.6);
  tag("mes", [HR.wheel[0], HR.wheel[1] + 0.4, 0.65], "MESMA MÁQUINA", A.mesma - 0.2, A.corrimao + 0.5);
  tag("pat", [HR.wheel[0], HR.wheel[1] + 0.38, 0.65], "PATINA", A.patina, A.mao - 0.3);
  // selo pequeno do sensor na entrada da peça (o título grande só vem no "Esse é o sensor do corrimão")
  tag("sen", [XN_T - 0.6, hrY(XN_T - 0.75) - 0.36, 0.66], "SENSOR", A.sensor - 0.05, A.porIsso - 0.1, "#1F6FD8");
  tag("lat", [-1.0, treadY(-1.0) + 0.45, 0.55], "LATERAL PARADA", A.lateral, A.fresta + 0.2);
  // selos pequenos na entrada das peças (o título grande só no "Esse é o X")
  tag("esc", [-1.3, treadY(-1.3) + 0.26, 0.5], "ESCOVAS", A.escovas, A.sapato - 1.0, "#FF8A1E");
  tag("bgp", [XN_T - 0.05, E.H + 0.32, 0.62], "BORRACHA", A.borrachaP - 0.05, A.interruptor - 0.1, "#FF8A1E");
  tag("fre", [-0.9, treadY(-0.9) + 0.05, 0.5], "FRESTA", A.fresta, A.dentro + 0.1);
  tag("int", [XC_T + 0.2, E.H - 0.05, 0.55], "INTERRUPTOR", A.recua - 0.1, A.placa);
  tag("rnh", [XC_T - 0.6, E.H + 0.1, -0.3], "RANHURAS", A.ranhuras, A.pente - 0.2);
  tag("pnt", [XC_T + 0.05, E.H + 0.12, -0.35], "PENTE", A.pente, A.encaixa + 0.3, "#FF8A1E");
  if (!rw) tag("bur", [XN_T - 0.1, E.H + 0.57, 0.62], "BURACO", A.buraco, A.maozinha - 0.3);
  tag("inp", [XN_T - 0.12, E.H + 0.32, 0.62], "INTERRUPTOR", A.interruptor - 0.1, A.para + 0.4);
  tag("mola", [MCH.gear[0] + 0.45, MCH.gear[1] + 0.05, MCH.motorZ0 - 0.05], "MOLA", A.mola - 0.05, A.eletricidade - 0.1);
  tag("ima", [7.2, 3.66, -0.1], "ELETROÍMÃ SOLTA", A.eletricidade, A.sem - 0.1, "#1F6FD8");
  tag("sap", [7.85, 3.3, 0.0], "SAPATAS", A.apertado - 0.2, A.eletricidade - 0.1);
  tag("trv", [E.XT + 0.5, E.yT + 0.0, 1.15], "TRAVA", A.trava2 - 0.1, A.auxiliar + 0.4, "#E8352B");
  tag("cmn", [6.75, 3.72, MCH.zDrive + 0.05], "CORRENTE MENOR", A.mesmo, A.segura - 0.2);
  tag("smt", [MCH.gear[0], MCH.gear[1] + 0.42, 0.6], "SÓ O MOTOR", A.segura, A.dispara - 0.3);
  tag("rdl", [E.XT + 0.35, E.yT + 0.05, 0.62], "RODAS SOLTAS", A.segura + 0.4, A.dispara - 0.3, "#FF8A1E");
  tag("nrm", [E.XT + 0.3, E.yT + 0.0, 1.15], "EXIGIDO POR NORMA", A.segundo, A.disparar - 0.4);
  tag("bt1", [XN_T - 0.38, E.H + 0.75, 0.48], "BOTÃO", A.aperta + 0.6, A.botao2 + 0.6, "#E8352B");
  tag("bt2", [XN_B + 0.38, 0.75, 0.48], "BOTÃO", A.pontasB, A.botao2 + 0.6, "#E8352B");
  // setas apontando os 2 botões
  if (t >= A.aperta + 0.6 && t < S("coloque")) {
    const p = prog(t, A.aperta + 0.6, A.aperta + 1.0);
    items.push(<ThinArrow key="a1" a={[XN_T - 1.6, E.H + 1.9, 0.5]} b={[XN_T - 0.45, E.H + 0.7, 0.5]} p={p} color="#FF3B2B" r={0.05} head={0.25} />);
    items.push(<ThinArrow key="a2" a={[XN_B + 1.7, 1.9, 0.5]} b={[XN_B + 0.45, 0.7, 0.5]} p={p} color="#FF3B2B" r={0.05} head={0.25} />);
  }
  // setas do corrimão andando junto com os degraus
  if (t >= A.junto - 0.2 && t < S("atrito")) {
    const p = prog(t, A.junto - 0.2, A.junto + 0.3);
    items.push(<ThinArrow key="h1" a={[-2.0, hrY(-2.0) + 0.3, 0.6]} b={[0.6, hrY(0.6) + 0.3, 0.6]} p={p} color="#FF8A1E" r={0.05} head={0.25} />);
    items.push(<ThinArrow key="h2" a={[-2.0, treadY(-2.0) + 0.25, 0]} b={[0.6, treadY(0.6) + 0.25, 0]} p={p} color="#FF8A1E" r={0.05} head={0.25} />);
  }
  // nível de bolha no degrau (fica reto)
  if (t >= A.retoT - 0.6 && t < A.pontas) {
    const kL = kAt(uAtX(-0.5), A.retoT - 0.6);
    const tp = treadPos(stepU(kL, sAt(t)));
    const sh = prog(t, A.retoT - 0.6, A.retoT - 0.3);
    items.push(
      <group key="nivel" position={[tp[0], tp[1] + 0.05 * sh, 0.15]} scale={sh}>
        <mesh>
          <boxGeometry args={[0.36, 0.09, 0.09]} />
          <meshStandardMaterial color="#F2C230" roughness={0.5} />
        </mesh>
        <mesh position={[0, 0.02, 0.046]}>
          <boxGeometry args={[0.14, 0.035, 0.01]} />
          <meshStandardMaterial color="#B9F07A" emissive="#7CFF4A" emissiveIntensity={0.4} />
        </mesh>
        <mesh position={[0, 0.02, 0.052]}>
          <sphereGeometry args={[0.012, 8, 6]} />
          <meshBasicMaterial color="#FFFFFF" />
        </mesh>
      </group>,
    );
  }
  // CLAC: degraus achatando na ponta (poeirinha + brilho)
  if (t >= A.chao - 0.1 && t < A.chao + 0.6) items.push(<Glow key="clac" position={[XC_T - 0.7, E.H + 0.05, 0.6]} size={1.0 * (1 - prog(t, A.chao, A.chao + 0.6))} color="#FFE7B0" opacity={0.8} />);
  tag("tsj", [XC_T - 1.35, E.H - 0.55, 0.72], "TRILHOS SE JUNTAM", A.juntam - 0.1, A.chao + 0.3, "#FF8A1E");
  tag("vch", [XC_T - 0.45, E.H + 0.28, 0.6], "DEGRAU VIRA CHÃO", A.chao - 0.05, A.esteiraT - 0.9, "#FF8A1E");
  // chinelo de verdade (sola + tira em Y + pé com dedos) puxado na fresta, com luz atrás da fresta
  if (t >= S("lateral") && t < S("escovas")) {
    const kC = kAt(uAtX(-1.0), S("lateral"));
    const tp = treadPos(stepU(kC, sAt(t)));
    const touch = prog(t, A.fresta - 0.1, A.fresta + 0.2);
    const pull = prog(t, A.chinelo - 0.1, A.dentro + 0.1);
    const fx = tp[0] - 0.05 + 0.034 - pull * 0.05, fz = 0.26 + 0.119;
    items.push(
      <group key="chin" position={[fx - pull * 0.08, tp[1] + 0.012 - pull * 0.03, fz + touch * 0.02]} rotation={[-pull * 0.5, 0, 0]}>
        <mesh position={[0, 0, 0.0]}>
          <boxGeometry args={[0.34, 0.03, 0.25]} />
          <meshStandardMaterial color="#1F2A44" roughness={0.6} />
        </mesh>
        {/* tira em Y */}
        <mesh position={[0.06, 0.05, -0.06]} rotation={[0, 0.5, 0.0]}>
          <boxGeometry args={[0.16, 0.02, 0.03]} />
          <meshStandardMaterial color="#F2F2F0" />
        </mesh>
        <mesh position={[0.06, 0.05, 0.06]} rotation={[0, -0.5, 0.0]}>
          <boxGeometry args={[0.16, 0.02, 0.03]} />
          <meshStandardMaterial color="#F2F2F0" />
        </mesh>
        {/* pé de fora, com dedos */}
        <mesh position={[-0.01, 0.055, 0]}>
          <boxGeometry args={[0.31, 0.095, 0.235]} />
          <meshStandardMaterial color={C.skin} roughness={0.7} />
        </mesh>
        {[0, 1, 2, 3, 4].map((k) => (
          <mesh key={k} position={[0.165, 0.035, -0.09 + k * 0.045]}>
            <boxGeometry args={[0.04, 0.04, 0.034]} />
            <meshStandardMaterial color={C.skin} roughness={0.7} />
          </mesh>
        ))}
      </group>,
    );
    // fresta iluminada (lateral parada x degrau andando)
    items.push(
      <mesh key="frestaLuz" position={[tp[0], tp[1] - 0.01, 0.507]}>
        <boxGeometry args={[1.2, 0.008, 0.012]} />
        <meshBasicMaterial color="#FFE9A8" toneMapped={false} />
      </mesh>,
    );
    if (pull > 0.2) items.push(<Glow key="chg" position={[fx - 0.08, tp[1] + 0.02, 0.5]} size={0.4} color="#FF3022" opacity={0.6 * pull} />);
  }
  // tênis branco + cadarço grosso laranja engolido pela fresta do topo
  if (t >= S("mergulha") && t < S("pente")) {
    const mp = mergPos(t);
    const pull = mp.pull;
    const pl = prog(t, A.cadarco - 0.1, A.cadarco + 0.5);
    const e0 = new THREE.Vector3(mp.fx + 0.08, E.H + 0.135, mp.fz + 0.07);
    const gap = new THREE.Vector3(XC_T + 0.02, E.H + 0.0, mp.fz + 0.11);
    const pts = t < A.cadarco - 0.8 ? [
      e0,
      new THREE.Vector3(lerp(mp.fx + 0.2, (e0.x + gap.x) / 2, pl), lerp(E.H + 0.06, (e0.y + gap.y) / 2, pl), mp.fz + 0.1),
      new THREE.Vector3(lerp(XC_T - 0.06, gap.x - 0.01, pl), lerp(E.H + 0.03, E.H + 0.02, pl), mp.fz + 0.11),
      new THREE.Vector3(gap.x, E.H - 0.04 - pl * 0.2, mp.fz + 0.11),
    ] : [
      // r15: o laço atravessa a linha preta e a ponta afunda DENTRO da fresta
      e0,
      new THREE.Vector3(lerp(mp.fx + 0.2, (e0.x + gap.x) / 2, pl), lerp(E.H + 0.06, (e0.y + gap.y) / 2 + 0.02, pl), mp.fz + 0.1),
      new THREE.Vector3(gap.x - 0.022, E.H + 0.03, mp.fz + 0.11),
      new THREE.Vector3(gap.x - 0.002, E.H + 0.018, mp.fz + 0.11),
      new THREE.Vector3(gap.x, E.H - 0.06 - pl * 0.25, mp.fz + 0.11),
    ];
    const g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 32, 0.02, 8, false);
    items.push(
      <group key="tenis" position={[mp.fx, E.H + 0.03, mp.fz]} rotation={[0, 0, -pull * 0.06]}>
        {/* sola vermelha alta */}
        <mesh position={[0.01, -0.012, 0]} castShadow>
          <boxGeometry args={[0.36, 0.035, 0.26]} />
          <meshStandardMaterial color="#D8342A" roughness={0.6} />
        </mesh>
        {/* corpo + bico arredondado */}
        <mesh position={[-0.04, 0.05, 0]} castShadow>
          <boxGeometry args={[0.26, 0.1, 0.24]} />
          <meshStandardMaterial color="#F7F7F2" roughness={0.6} />
        </mesh>
        <mesh position={[0.09, 0.03, 0]} rotation={[PI / 2, 0, 0]} scale={[1, 1, 0.75]}>
          <cylinderGeometry args={[0.1, 0.1, 0.24, 18]} />
          <meshStandardMaterial color="#F7F7F2" roughness={0.6} />
        </mesh>
        {/* cano (tornozelo) */}
        <mesh position={[-0.11, 0.14, 0]}>
          <boxGeometry args={[0.13, 0.12, 0.2]} />
          <meshStandardMaterial color="#F7F7F2" roughness={0.6} />
        </mesh>
        {/* faixa azul na lateral */}
        <mesh position={[-0.02, 0.04, -0.122]}>
          <boxGeometry args={[0.22, 0.03, 0.004]} />
          <meshStandardMaterial color="#1F6FD8" roughness={0.6} />
        </mesh>
        {/* passadores de cadarço laranja */}
        {[0, 1, 2, 3].map((i) => (
          <mesh key={i} position={[0.05 - i * 0.045, 0.105, 0]}>
            <boxGeometry args={[0.018, 0.012, 0.15]} />
            <meshStandardMaterial color="#FF7A00" roughness={0.6} />
          </mesh>
        ))}
      </group>,
    );
    items.push(
      <mesh key="lace" geometry={g}>
        <meshStandardMaterial color="#FF7A00" roughness={0.6} emissive="#FF7A00" emissiveIntensity={0.15} />
      </mesh>,
    );
    // fresta escura na borda do piso (antes do pente) + luz por baixo
    items.push(
      <mesh key="frestaTopo" position={[XC_T + 0.0235, E.H + 0.021, 0]}>
        <boxGeometry args={[0.045, 0.006, 1.0]} />
        <meshBasicMaterial color="#020203" />
      </mesh>,
    );
    items.push(
      <mesh key="frestaLuzT" position={[XC_T + 0.052, E.H + 0.022, 0]}>
        <boxGeometry args={[0.012, 0.006, 1.0]} />
        <meshBasicMaterial color="#FFE9A8" toneMapped={false} />
      </mesh>,
    );
  }
  // mãozinha da criança indo com o corrimão (braço ligado ao ombro)
  if (t >= S("crianca") && t < A.para + 0.45) {
    const kp = kidPose(t);
    const q = KID_Q(t);
    const sh: V3 = [kp.x, kp.y + 1.38 * KID_S - 0.05, 0.6];
    // a mão sai do corrimão e volta junto do corpo (o braço extra encurta até sumir dentro do braço do boneco)
    const hd: V3 = [lerp(kp.h.x, sh[0] + 0.02, q), lerp(kp.h.y, sh[1] - 0.42 * KID_S, q), 0.6];
    const L = Math.hypot(hd[0] - sh[0], hd[1] - sh[1]);
    const ang = Math.atan2(hd[1] - sh[1], hd[0] - sh[0]);
    items.push(
      <group key="braco" position={[(sh[0] + hd[0]) / 2, (sh[1] + hd[1]) / 2, 0.6]} rotation={[0, 0, ang]}>
        <mesh>
          <boxGeometry args={[L, 0.075, 0.075]} />
          <meshStandardMaterial color="#E84D8A" roughness={0.7} />
        </mesh>
      </group>,
    );
    items.push(
      <mesh key="mao" position={hd}>
        <boxGeometry args={[0.09, 0.06, 0.08]} />
        <meshStandardMaterial color={C.skin} roughness={0.7} />
      </mesh>,
    );
  }
  // mão do Tião abre a tampinha e aperta o botão
  if (t >= A.botao - 0.4 && t < A.aperta + 0.8) {
    const reach = ease.inOut(prog(t, A.botao - 0.2, A.vermelho + 0.1));
    const push = prog(t, A.aperta - 0.15, A.aperta) * (1 - prog(t, A.aperta + 0.3, A.aperta + 0.6));
    const bx = XN_T - 0.38, by = E.H + 0.5;
    const hp: V3 = [bx + 0.07, lerp(by + 0.45, by + 0.04, reach), lerp(0.05, 0.28 + push * 0.12, reach)];
    items.push(
      <group key="maoT" position={hp}>
        <mesh>
          <boxGeometry args={[0.12, 0.13, 0.12]} />
          <meshStandardMaterial color={C.skin} roughness={0.7} />
        </mesh>
        <mesh position={[0.02, 0.05, -0.28]} rotation={[0.35, 0, 0]}>
          <boxGeometry args={[0.15, 0.15, 0.45]} />
          <meshStandardMaterial color={TIAO} roughness={0.7} />
        </mesh>
      </group>,
    );
  }
  // carrinho de brinquedo que trava no pente
  if (t >= A.encaixa && t < A.placa) {
    const kT = kAt(uAtX(XC_T - 0.9), A.encaixa);
    const tp = treadPos(stepU(kT, sAt(t)));
    const x = Math.min(tp[0] + 0.05, XC_T - 0.06);
    items.push(
      <group key="toy" position={[x, E.H + 0.035, -0.2]} rotation={[0, 0, x >= XC_T - 0.061 ? 0.25 : 0]}>
        <mesh castShadow>
          <boxGeometry args={[0.16, 0.05, 0.08]} />
          <meshStandardMaterial color="#E8352B" roughness={0.4} />
        </mesh>
        {[-0.05, 0.05].map((dx) => [-0.045, 0.045].map((dz) => (
          <mesh key={`${dx}${dz}`} position={[dx, -0.025, dz]} rotation={[PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.018, 0.018, 0.012, 10]} />
            <meshStandardMaterial color="#1F2124" />
          </mesh>
        )))}
      </group>,
    );
  }
  // luz de giroflex (apagão)
  return <group>{items}</group>;
};

// barra fina entre dois pontos (cintas da grua, cabos)
const Rod: React.FC<{ a: V3; b: V3; r?: number; color?: string }> = ({ a, b, r = 0.01, color = "#3A3F45" }) => {
  const A3 = new THREE.Vector3(...a), B3 = new THREE.Vector3(...b);
  const d = B3.clone().sub(A3);
  const L = d.length();
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize());
  const m = A3.clone().add(B3).multiplyScalar(0.5);
  return (
    <mesh position={[m.x, m.y, m.z]} quaternion={q}>
      <cylinderGeometry args={[r, r, L, 6]} />
      <meshStandardMaterial color={color} roughness={0.6} />
    </mesh>
  );
};
// seta curva (giro) no plano x–y: arco de a0 a a1 (rad) em volta de c
const ArcArrow: React.FC<{ c: V3; r: number; a0: number; a1: number; p: number; color?: string }> = ({ c, r, a0, a1, p, color = "#FF3B2B" }) => {
  if (p <= 0.01) return null;
  const n = 8;
  const pts: V3[] = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + (a1 - a0) * (i / n) * p;
    pts.push([c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r, c[2]]);
  }
  return (
    <group>
      {pts.slice(1, -1).map((q, i) => (
        <Rod key={i} a={pts[i]} b={q} r={0.03} color={color} />
      ))}
      <ThinArrow a={pts[n - 1]} b={pts[n]} p={1} color={color} r={0.03} head={0.14} />
    </group>
  );
};
const SHOW: V3 = [-0.7, 3.05, 1.9];

// Antes x depois (tela dividida): rampa (pé escorrega) x degrau (pé reto)
const SetFoot: React.FC<{ t: number; v: "A" | "B" }> = ({ t, v }) => {
  const ang = 0.52;
  const k = prog(t, O.p11 + 0.1, O.p11b - 0.05, (q) => q);
  const slide = v === "A" ? k * k : 0;
  const x = v === "A" ? 0.25 - slide * 1.1 : 0;
  const y = v === "A" ? 0.62 + x * Math.tan(ang) : 0.3;
  const who: Pessoa = {
    p: [x, y, 0],
    ry: PI / 2,
    shirt: TIAO,
    bags: 1,
    rx: v === "A" ? -0.3 * slide : 0,
    piv: 0.1,
    legL: v === "A" ? 0.7 * slide : 0,
    legR: v === "A" ? -0.2 * slide : 0,
    mood: v === "A" ? (slide > 0.05 ? "shock" : "neutral") : "happy",
    id: 1,
  };
  return (
    <group>
      <mesh position={[0, -0.05, 0]} receiveShadow>
        <boxGeometry args={[14, 0.1, 8]} />
        <meshStandardMaterial color="#E9E1D2" roughness={0.8} />
      </mesh>
      <mesh position={[0, 2.5, -2.5]}>
        <boxGeometry args={[14, 5, 0.1]} />
        <meshStandardMaterial color={v === "A" ? "#F6DAD5" : "#DDF1DF"} roughness={0.9} />
      </mesh>
      {v === "A" ? (
        <group position={[0, 0.62 - 0.1 / Math.cos(ang), 0]} rotation={[0, 0, ang]}>
          <mesh receiveShadow castShadow>
            <boxGeometry args={[4.2, 0.2, 1.1]} />
            <meshStandardMaterial map={beltRamp()} color="#3A3D43" roughness={0.8} />
          </mesh>
        </group>
      ) : (
        <group>
          {[-0.4, 0, 0.4].map((dx, i) => (
            <mesh key={i} position={[dx, 0.15 + i * 0.3 - 0.3, 0]} receiveShadow castShadow>
              <boxGeometry args={[0.4, 0.3, 1.1]} />
              <meshStandardMaterial color="#C7CDD2" metalness={0.45} roughness={0.36} />
            </mesh>
          ))}
        </group>
      )}
      <Gente t={t} list={[who]} />
      {v === "A" ? (
        <ThinArrow a={[0.45, 0.85 + 0.45 * Math.tan(ang), 0.55]} b={[-0.55, 0.85 - 0.55 * Math.tan(ang), 0.55]} p={prog(t, O.p11 + 0.1, O.p11 + 0.35)} color="#FF3B2B" r={0.035} head={0.15} />
      ) : (
        <group position={[0.0, 0.36, 0.56]} scale={prog(t, O.p11 + 0.1, O.p11 + 0.35)}>
          <mesh>
            <boxGeometry args={[0.36, 0.08, 0.08]} />
            <meshStandardMaterial color="#F2C230" roughness={0.5} />
          </mesh>
          <mesh position={[0, 0.018, 0.042]}>
            <boxGeometry args={[0.13, 0.032, 0.008]} />
            <meshStandardMaterial color="#B9F07A" emissive="#7CFF4A" emissiveIntensity={0.4} />
          </mesh>
          <mesh position={[0, 0.02, 0.048]}>
            <sphereGeometry args={[0.011, 8, 6]} />
            <meshBasicMaterial color="#FFFFFF" />
          </mesh>
        </group>
      )}
    </group>
  );
};
let _ramp: THREE.CanvasTexture | null = null;
const beltRamp = () => {
  if (_ramp) return _ramp;
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 64;
  const g = c.getContext("2d")!;
  g.fillStyle = "#26282C";
  g.fillRect(0, 0, 64, 64);
  g.fillStyle = "#3A3D43";
  for (let i = 0; i < 4; i++) g.fillRect(i * 16, 0, 5, 64);
  _ramp = new THREE.CanvasTexture(c);
  _ramp.wrapS = _ramp.wrapT = THREE.RepeatWrapping;
  _ramp.repeat.set(10, 1);
  return _ramp;
};

// Set da bicicleta (tela dividida, analogia)
const SetBike: React.FC<{ t: number }> = ({ t }) => {
  // mesmo giro da roda da escada: v_bike / 0,16 = v_corrente / Rc
  const s = sAt(t) * (0.16 / E.Rc);
  return (
    <group>
      <Mall t={t} xray={0} dark={0} outside />
      <group position={[11.0, 0, 2.2]} rotation={[0, 0, 0]}>
        <Bike t={t} s={s} glow={syncGlow(t)} />
      </group>
      <Tag3D position={[11.0, 1.15, 2.4]} text="BICICLETA" show={prog(t, A.bicicleta - 0.2, A.bicicleta + 0.1)} dot="#FF8A1E" size={0.05} />
    </group>
  );
};

// ======================================================================
// Palco (cópia do Stage com tamanho próprio) + câmera com tempo explícito
// ======================================================================
type Key = { t: number; pos: V3; look: V3; fov?: number };
const sample = (keys: Key[], sec: number) => {
  if (sec <= keys[0].t) return { ...keys[0], fov: keys[0].fov ?? 45 };
  const last = keys[keys.length - 1];
  if (sec >= last.t) return { ...last, fov: last.fov ?? 45 };
  let i = 0;
  while (i < keys.length - 1 && keys[i + 1].t < sec) i++;
  const a = keys[i], b = keys[i + 1];
  const p = ease.inOut((sec - a.t) / Math.max(b.t - a.t, 0.001));
  const mix = (x: number[], y: number[]) => x.map((v, k) => v + (y[k] - v) * p) as V3;
  return { t: sec, pos: mix(a.pos, b.pos), look: mix(a.look, b.look), fov: (a.fov ?? 45) + ((b.fov ?? 45) - (a.fov ?? 45)) * p };
};
// spline de Hermite com velocidade contínua nos keys internos e parada suave só nas pontas (sem anda-e-para)
const sampleSmooth = (keys: Key[], sec: number) => {
  const n = keys.length;
  if (n < 3) return sample(keys, sec);
  if (sec <= keys[0].t) return { ...keys[0], fov: keys[0].fov ?? 45 };
  if (sec >= keys[n - 1].t) return { ...keys[n - 1], fov: keys[n - 1].fov ?? 45 };
  let i = 0;
  while (i < n - 2 && keys[i + 1].t < sec) i++;
  const a = keys[i], b = keys[i + 1];
  const dt = Math.max(1e-3, b.t - a.t);
  const f = (sec - a.t) / dt;
  const h00 = 2 * f ** 3 - 3 * f ** 2 + 1, h10 = f ** 3 - 2 * f ** 2 + f, h01 = -2 * f ** 3 + 3 * f ** 2, h11 = f ** 3 - f ** 2;
  const tan = (j: number, sel: (k: Key) => number[]) => {
    if (j <= 0 || j >= n - 1) return sel(keys[j]).map(() => 0);
    const p0 = sel(keys[j - 1]), p1 = sel(keys[j + 1]);
    const d = Math.max(1e-3, keys[j + 1].t - keys[j - 1].t);
    return p0.map((v, q) => (p1[q] - v) / d);
  };
  const mix = (sel: (k: Key) => number[]) => {
    const pa = sel(a), pb = sel(b), ma = tan(i, sel), mb = tan(i + 1, sel);
    return pa.map((v, q) => h00 * v + h10 * dt * ma[q] + h01 * pb[q] + h11 * dt * mb[q]);
  };
  const fov = mix((k) => [k.fov ?? 45])[0];
  return { t: sec, pos: mix((k) => k.pos) as V3, look: mix((k) => k.look) as V3, fov };
};
const Rig: React.FC<{ keys: Key[]; t: number; shake: number; smooth?: boolean }> = ({ keys, t, shake, smooth = false }) => {
  const { camera } = useThree();
  useLayoutEffect(() => {
    const k = smooth ? sampleSmooth(keys, t) : sample(keys, t);
    const d = 0.025;
    // tremida em Hz (≤ 4,6 Hz = 0,96 rad/quadro, bem abaixo de Nyquist): lê-se como tremor, não como pisca
    const w = 2 * PI * t;
    const sx = shake ? (Math.sin(w * 4.6) + 0.7 * Math.sin(w * 2.9 + 1.3)) * shake * 0.75 : 0;
    const sy = shake ? (Math.cos(w * 3.7) + 0.6 * Math.sin(w * 2.3 + 0.4)) * shake * 0.75 : 0;
    camera.position.set(k.pos[0] + Math.sin(t * 0.7) * d + sx, k.pos[1] + Math.sin(t * 0.9 + 1) * d * 0.6 + sy, k.pos[2] + Math.cos(t * 0.6) * d);
    const cam = camera as THREE.PerspectiveCamera;
    cam.fov = k.fov;
    cam.near = 0.03;
    cam.far = 400;
    cam.lookAt(new THREE.Vector3(...k.look));
    cam.updateProjectionMatrix();
  });
  return null;
};

type Look = { sky: [string, string]; sun: V3; power?: number; amb?: number; shadow: number; exp?: number };
const LOOK: Record<string, Look> = {
  mall: { sky: ["#6FB6E6", "#E4F1F6"], sun: [18, 34, 30], shadow: 18, exp: 1.06, amb: 1.15, power: 2.2 },
  wide: { sky: ["#4C9FE0", "#D6EBF5"], sun: [60, 90, 70], shadow: 45, exp: 1.06, power: 2.4 },
  close: { sky: ["#6FB6E6", "#E4F1F6"], sun: [14, 26, 24], shadow: 8, exp: 1.08, amb: 1.25, power: 2.0 },
  pit: { sky: ["#3A3F46", "#5A6069"], sun: [14, 30, 26], shadow: 8, exp: 1.1, amb: 1.5, power: 1.6 },
  dark: { sky: ["#1B2236", "#2C3550"], sun: [14, 30, 26], shadow: 18, exp: 0.95, amb: 0.55, power: 0.7 },
  night: { sky: ["#0E1324", "#1E2238"], sun: [-14, 30, 26], shadow: 18, exp: 0.95, amb: 0.45, power: 0.55 },
};

const Palco: React.FC<{ children: React.ReactNode; L: Look; w: number; h: number; map?: number; far?: number }> = ({ children, L, w, h, map = 1536, far = 140 }) => (
  <AbsoluteFill style={{ background: `linear-gradient(180deg, ${L.sky[0]} 0%, ${L.sky[1]} 70%)`, width: w, height: h }}>
    <ThreeCanvas
      width={w}
      height={h}
      shadows
      gl={{ antialias: true, alpha: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: L.exp ?? 1.08, preserveDrawingBuffer: true }}
      onCreated={({ gl }) => {
        gl.shadowMap.type = THREE.PCFShadowMap;
        gl.outputColorSpace = THREE.SRGBColorSpace;
      }}
      camera={{ fov: 45, position: [0, 2, 8] }}
    >
      <hemisphereLight args={["#DDEEFF", "#9C8A6E", 0.9 * (L.amb ?? 1)]} />
      <ambientLight intensity={0.25 * (L.amb ?? 1)} />
      <directionalLight
        position={L.sun}
        intensity={L.power ?? 2.4}
        castShadow
        shadow-mapSize={[map, map]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
        shadow-radius={5}
        shadow-camera-left={-L.shadow}
        shadow-camera-right={L.shadow}
        shadow-camera-top={L.shadow}
        shadow-camera-bottom={-L.shadow}
        shadow-camera-near={0.5}
        shadow-camera-far={far}
        color="#FFF4E2"
      />
      <directionalLight position={[-6, 4, -5]} intensity={0.35} color="#BFD9FF" />
      {children}
    </ThreeCanvas>
  </AbsoluteFill>
);

// ======================================================================
// PLANOS
// ======================================================================
type KK = [number, V3, V3, number, boolean?];
const K = (list: KK[]): Key[] => {
  const out: Key[] = [];
  list.forEach(([t, pos, look, fov, isCut], i) => {
    if (isCut && i > 0) {
      const p = out[out.length - 1];
      out.push({ t: t - 0.002, pos: p.pos, look: p.look, fov: p.fov });
    }
    out.push({ t, pos, look, fov });
  });
  return out;
};
type Plan = {
  from: number;
  to: number;
  look: keyof typeof LOOK;
  keys: Key[];
  xr?: number | ((t: number) => number);
  city?: boolean;
  dark?: (t: number) => number;
  shake?: (t: number) => number;
  clip?: "top" | "bottom";
  set?: "main" | "bike" | "footA" | "footB";
  smooth?: boolean;
  bare?: boolean;
  stair?: boolean;
  hook?: boolean;
  light?: V3;
};
const P = (from: number, to: number, look: keyof typeof LOOK, kk: KK[], o: Partial<Plan> = {}): Plan => ({ from: fr(from), to: fr(to), look, keys: K(kk), ...o });
// câmera que segue um ponto (degrau/pessoa)
const follow = (a: number, b: number, dt: number, at: (t: number) => V3, off: V3, lookOff: V3, fov: number): KK[] => {
  const out: KK[] = [];
  for (let t = a; t < b - 1e-4; t += dt) {
    const p = at(t);
    out.push([t, [p[0] + off[0], p[1] + off[1], p[2] + off[2]], [p[0] + lookOff[0], p[1] + lookOff[1], p[2] + lookOff[2]], fov]);
  }
  const p = at(b);
  out.push([b, [p[0] + off[0], p[1] + off[1], p[2] + off[2]], [p[0] + lookOff[0], p[1] + lookOff[1], p[2] + lookOff[2]], fov]);
  return out;
};
const stepAt = (k: number) => (t: number): V3 => treadPos(stepU(k, sAt(tEff(t))));
const jolt = (at: number, amp = 0.05, len = 0.35) => (t: number) => (t > at && t < at + len ? amp * (1 - (t - at) / len) : 0);

const k12 = kAt(uAtX(-0.6), A.mao - 1.2);
const kSensor = kAt(uAtX(-3.0), A.porIsso - 0.6);
const kLat = kAt(uAtX(-1.0), S("lateral"));
const kEsc = kAt(uAtX(-1.2), A.sapato - 1.0);
const kPisar = () => kAt(uAtX(XC_B + 0.25), S("pisar") + 0.25);

const K_SEG = kAt(uAtX(0.6), S("segurar"));
const PLANS: Plan[] = [
  // ---------------- 1 GANCHO (eixo-mestre: lateral do vão) ----------------
  P(0, O.p2, "mall", [
    [0, [1.7, 2.75, 10.8], [-0.6, 2.2, 0], 52],
    [O.p2, [1.55, 2.68, 10.2], [-0.6, 2.2, 0], 52],
  ]),
  // o caixa: esteira andando com as laranjas, placa CAIXA 3, operadora, leitor
  P(O.p2, O.p3, "mall", [
    [O.p2, [4.95, 2.15, 7.5], [4.6, 1.2, 2.6], 50],
    [O.p3, [4.9, 2.05, 7.1], [4.6, 1.15, 2.6], 48],
  ]),
  // ▶▶ solta, arrasta até o vão e levanta a ponta até a borda de cima (um plano só)
  P(O.p3, O.p4, "mall", [
    [O.p3, [0.4, 3.4, 19.5], [0.4, 2.5, 0], 56],
    [O.p4, [0.4, 3.4, 19.3], [0.4, 2.55, 0], 56],
  ], { shake: jolt(O.tilt[1], 0.03, 0.3) }),
  // esteira inclinada vazia; gente subindo uma a uma
  P(O.p4, O.p5, "mall", [
    [O.p4, [-6.4, 0.6, 6.0], [-0.5, 2.6, 0], 54],
    [O.p5, [-6.35, 0.6, 5.95], [-0.7, 2.5, 0], 54],
  ]),
  // escorrega, dominó
  P(O.p5, O.p6, "mall", [
    [O.p5, [-6.35, 0.6, 5.95], [-0.7, 2.5, 0], 54],
    [O.p6, [-6.3, 0.62, 5.9], [-1.4, 2.0, 0], 54],
  ], { shake: (t) => (t > O.fall[1] && t < O.fall[1] + 0.4 ? 0.012 : 0) }),
  // todos rolam até o pé; laranjas quicando
  P(O.p6, O.p7, "mall", [
    [O.p6, [-1.6, 2.5, 12.6], [-2.5, 1.3, 0], 54],
    [O.p7, [-1.8, 2.4, 12.3], [-2.7, 1.2, 0], 54],
  ], { shake: () => 0.01 }),
  // close do Tião no chão: laranja na testa
  P(O.p7, O.p8, "close", [
    [O.p7, [FACE.x + 0.28, 1.02, FACE.z + 1.75], [FACE.x, 0.84, FACE.z], 40],
    [HIT, [FACE.x + 0.22, 0.99, FACE.z + 1.4], [FACE.x, 0.84, FACE.z], 38],
    [O.p8, [FACE.x + 0.2, 0.98, FACE.z + 1.3], [FACE.x, 0.84, FACE.z], 37],
  ], { shake: jolt(HIT, 0.025, 0.3) }),
  // ---------------- 2 DEGRAUS ----------------
  // a lona sai enrolando de cima para baixo; sobra a viga
  P(O.p8, O.p9, "mall", [
    [O.p8, [0.2, 3.0, 16.5], [0.0, 2.3, 0], 56],
    [O.p9, [0.2, 3.0, 16.2], [0.0, 2.3, 0], 56],
  ]),
  // um degrau só, descendo pela grua (close 3/4)
  P(O.p9, O.p10, "close", [
    [O.p9, [1.0, 3.5, 4.45], [SHOW[0], SHOW[1] - 0.05, SHOW[2]], 40],
    [O.p10, [0.85, 3.42, 4.2], [SHOW[0], SHOW[1] - 0.05, SHOW[2]], 39],
  ]),
  // os degraus encaixam na viga um a um, de baixo para cima (mesma câmera do eixo)
  P(O.p10, O.p11, "mall", [
    [O.p10, [0.2, 3.0, 16.5], [0.0, 2.3, 0], 56],
    [O.p11, [0.1, 2.9, 15.0], [0.0, 2.3, 0], 56],
  ]),
  // antes x depois: rampa (o pé escorrega) x degrau (o pé fica reto)
  P(O.p11, O.p11b, "close", [
    [O.p11, [0.15, 0.95, 3.1], [-0.1, 0.8, 0], 40],
    [O.p11b, [0.1, 0.95, 2.9], [-0.1, 0.8, 0], 40],
  ], { clip: "top", set: "footA" }),
  P(O.p11, O.p11b, "close", [
    [O.p11, [0.15, 0.95, 3.1], [-0.1, 0.7, 0], 40],
    [O.p11b, [0.1, 0.95, 2.9], [-0.1, 0.7, 0], 40],
  ], { clip: "bottom", set: "footB" }),
  // Tião sobe os degraus andando, com as sacolas
  P(O.p11b, O.p12, "mall", [
    [O.p11b, [-2.6, 1.9, 6.2], [-3.6, 1.0, 0], 48],
    [O.p12, [-2.0, 2.3, 6.2], [-2.9, 1.4, 0], 48],
  ]),
  // "Esses são os degraus": escada de degraus inteira, todos acendem
  P(O.p12, S("sobe"), "mall", [
    [O.p12, [0.2, 3.0, 16.5], [0.0, 2.3, 0], 56],
    [S("sobe"), [0.2, 3.0, 16.3], [0.0, 2.3, 0], 56],
  ]),
  // ---------------- 3 SOBE ----------------
  // mesma câmera: Tião desce e sai de lado; os degraus soltos escorregam e empilham; tilt até a pilha
  P(S("sobe"), S("corrente"), "mall", [
    [S("sobe"), [0.2, 3.0, 16.3], [0.0, 2.3, 0], 56],
    [T_SLIDE + 0.45, [0.0, 2.9, 16.0], [-0.4, 2.1, 0], 56],
    [S("corrente"), [-4.0, 2.0, 8.2], [-5.2, 0.6, 0], 50],
  ], { shake: (t) => (t > T_SLIDE + 0.6 && t < T_SLIDE + 1.3 ? 0.012 : 0) }),
  // ---------------- 4 CORRENTE ----------------
  // fade de raio-x na mesma câmera; a corrente é puxada de ponta a ponta e os degraus são presos nela
  P(S("corrente"), A.corrente - 0.25, "mall", [
    [S("corrente"), [-4.0, 2.0, 8.2], [-5.2, 0.6, 0], 50],
    [O.xr0 + 0.65, [-0.4, 3.0, 15.0], [-0.2, 2.0, 0], 56],
    [A.corrente - 0.25, [-0.4, 3.0, 14.6], [-0.2, 2.0, 0], 56],
  ], { xr: (t) => prog(t, O.xr0, O.xr0 + 0.5) }),
  // tela dividida: bicicleta (em cima) e corrente da escada (embaixo), mesmo ritmo e mesmo brilho
  P(A.corrente - 0.25, A.sobem - 0.1, "close", [
    [A.corrente - 0.25, [11.0, 0.95, 3.6], [11.0, 0.55, 2.2], 40],
    [A.sobem - 0.1, [10.8, 0.9, 3.4], [10.9, 0.5, 2.2], 40],
  ], { clip: "top", set: "bike" }),
  P(A.corrente - 0.25, A.sobem - 0.1, "close", [
    [A.corrente - 0.25, [-4.7, 1.0, 2.5], [-6.0, -0.55, 0.3], 46],
    [A.sobem - 0.1, [-4.4, 0.9, 2.3], [-5.9, -0.5, 0.3], 46],
  ], { clip: "bottom", xr: 1, bare: true, light: [-5.5, 0.2, 1.2] }),
  // um degrau marcado sobe por cima e volta por baixo, de cabeça pra baixo
  P(A.sobem - 0.1, A.essa - 0.15, "mall", [
    [A.sobem - 0.1, [0.3, 2.2, 18.0], [0.2, 1.8, 0], 56],
    [A.essa - 0.15, [0.3, 2.25, 17.4], [0.2, 1.85, 0], 56],
  ], { xr: 1 }),
  // "Essa é a corrente": a corrente inteira acende
  P(A.essa - 0.15, S("parada"), "mall", [
    [A.essa - 0.15, [0.3, 2.25, 17.4], [0.2, 1.85, 0], 56],
    [S("parada"), [0.3, 2.3, 16.4], [0.2, 1.9, 0], 56],
  ], { xr: 1 }),
  // ---------------- 5 PARADA ----------------
  P(S("parada"), S("maquina"), "mall", [
    [S("parada"), [-3.0, 2.0, 3.9], [-5.2, 0.2, 0.2], 50],
    [S("maquina"), [-3.3, 1.8, 3.6], [-5.2, 0.1, 0.2], 50],
  ], { xr: 0.8, shake: jolt(A.anda + 0.55, 0.05, 0.3), light: [-6, 0.4, 1.4] }),
  // ---------------- 6 MÁQUINA ----------------
  P(S("maquina"), A.motor - 0.3, "mall", [
    [S("maquina"), [7.2, 7.4, 3.6], [7.0, 4.4, 0], 50],
    [A.piso + 0.45, [7.35, 5.7, 0.6], [7.3, 3.6, 0.25], 50],
    [A.motor - 0.62, [7.5, 4.05, 0.55], [7.45, 3.3, 0.4], 50],
    [A.motor - 0.3, [8.3, 3.92, 2.25], [7.4, 3.25, 0.45], 46],
  ], { xr: (t) => prog(t, A.piso, A.piso + 0.55), light: [7, 3.8, 1.5], smooth: true }),
  P(A.motor - 0.3, A.correnteM - 0.1, "pit", [
    [A.motor - 0.3, [8.3, 3.92, 2.25], [7.4, 3.3, 0.45], 46],
    [A.correnteM - 0.1, [8.15, 3.8, 2.1], [7.4, 3.25, 0.45], 44],
  ], { xr: 1, light: [7.6, 4.1, 1.6] }),
  P(A.correnteM - 0.1, A.rodas - 0.1, "pit", [
    [A.correnteM - 0.1, [8.6, 3.9, 2.5], [7.0, 3.45, 0.6], 46],
    [A.rodas - 0.1, [8.35, 3.95, 2.6], [6.8, 3.5, 0.6], 46],
  ], { xr: 1, light: [6.8, 4.1, 2.0] }),
  // tilt seguindo a corrente até as rodas que puxam os degraus
  P(A.rodas - 0.1, S("empina"), "pit", [
    [A.rodas - 0.1, [8.35, 3.95, 2.6], [6.8, 3.5, 0.6], 46],
    [A.puxam, [6.4, 4.0, 2.9], [5.8, 3.85, 0.3], 48],
    [S("empina"), [4.4, 3.6, 4.6], [5.6, 3.9, 0.0], 52],
  ], { xr: 1, light: [6.4, 4.2, 1.8], smooth: true }),
  // ---------------- 7 EMPINA ----------------
  P(S("empina"), S("trilhos"), "close", follow(S("empina"), S("trilhos"), 0.5, stepAt(K_EMP), [1.2, 0.6, 3.2], [0, 0.35, 0], 46), { xr: 1 }),
  // ---------------- 8 TRILHOS ----------------
  P(S("trilhos"), A.trilhos - 0.1, "close", [
    [S("trilhos"), [0.1, treadY(-0.6) - 0.1, 1.8], [-0.6, treadY(-0.6) - 0.45, 0.5], 40],
    [A.trilhos - 0.1, [0.0, treadY(-0.6) - 0.05, 1.7], [-0.6, treadY(-0.6) - 0.42, 0.5], 40],
  ], { xr: 1, light: [-0.5, treadY(-0.5) - 0.2, 1.4] }),
  P(A.trilhos - 0.1, A.pontas - 0.05, "mall", [
    [A.trilhos - 0.1, [0.4, 2.0, 4.0], [-0.8, 1.2, 0.3], 48],
    [A.pontas - 0.05, [-0.6, 1.7, 3.9], [-1.4, 0.9, 0.3], 48],
  ], { xr: 1, light: [-0.8, 1.4, 1.5] }),
  P(A.pontas - 0.05, A.esteiraT - 0.9, "mall", [
    [A.pontas - 0.05, [2.6, 3.6, 1.8], [4.6, 4.25, 0], 50],
    [A.esteiraT - 0.9, [2.85, 3.72, 1.7], [4.85, 4.35, 0], 50],
  ], { xr: 1, bare: true, shake: jolt(A.chao, 0.03, 0.35), light: [4.4, 4.4, 1.2] }),
  P(A.esteiraT - 0.9, S("segurar"), "mall", [
    [A.esteiraT - 0.9, [-4.6, 1.0, 2.8], [-6.0, 0.6, 0], 48],
    [A.trilhos3 - 0.2, [-3.6, 1.6, 3.6], [-4.8, 1.0, 0], 50],
    [S("segurar"), [-3.2, 1.9, 3.9], [-4.2, 1.3, 0], 50],
  ], { shake: jolt(A.esteiraT - 0.25, 0.03, 0.3) }),
  // ---------------- 9 SEGURAR ----------------
  P(S("segurar"), A.desequilibra - 0.05, "mall", [
    [S("segurar"), [3.4, 6.2, 5.8], [0.0, 2.4, 0], 48],
    [A.desequilibra - 0.05, [3.0, 5.9, 5.4], [0.2, 2.4, 0], 48],
  ]),
  P(A.desequilibra - 0.05, S("corrimao"), "mall", follow(A.desequilibra - 0.05, S("corrimao"), 0.4, stepAt(K_SEG), [1.5, 1.5, 2.9], [-0.2, 1.0, 0], 46), { shake: jolt(A.vizinho + 0.5, 0.03, 0.35) }),
  // ---------------- 10 CORRIMÃO ----------------
  P(S("corrimao"), A.junto + 0.6, "mall", [
    [S("corrimao"), [0.0, 3.4, 9.0], [0.2, 2.5, 0], 50],
    [A.junto + 0.6, [1.0, 3.7, 8.7], [0.7, 2.6, 0], 50],
  ], { xr: 0.85 }),
  P(A.junto + 0.6, A.mesma - 0.3, "mall", [
    [A.junto + 0.6, [XN_T + 0.9, E.H + 1.6, 1.6], [XN_T - 0.1, E.H + 0.5, 0.6], 48],
    [A.mesma - 0.3, [E.XT + 1.25, E.H - 0.7, 1.7], [HR.wheel[0], HR.wheel[1], 0.6], 48],
  ], { xr: 1, light: [6.6, 4.1, 1.8] }),
  P(A.mesma - 0.3, S("atrito"), "pit", [
    [A.mesma - 0.3, [5.0, 3.95, 2.7], [6.3, 3.7, 0.5], 48],
    [S("atrito"), [5.3, 3.9, 2.5], [6.4, 3.7, 0.5], 46],
  ], { xr: 1, light: [6.6, 4.1, 1.8] }),
  // ---------------- 11 ATRITO ----------------
  P(S("atrito"), A.mao - 0.9, "pit", [
    [S("atrito"), [7.4, 4.1, 2.4], [6.45, 3.65, 0.6], 42],
    [A.mao - 0.9, [7.45, 4.05, 2.3], [6.45, 3.62, 0.6], 42],
  ], { xr: 1, light: [6.8, 4.0, 1.4], shake: (t) => 0.004 }),
  P(A.mao - 0.9, A.cai - 0.15, "mall", follow(A.mao - 0.9, A.cai - 0.15, 0.4, stepAt(k12), [1.1, 0.9, 2.8], [-0.1, 0.9, 0.3], 46)),
  P(A.cai - 0.15, S("sensor"), "mall", [
    [A.cai - 0.15, [1.6, 3.2, 5.6], [-0.9, 1.9, 0], 50],
    [S("sensor"), [1.4, 3.0, 5.2], [-1.1, 1.8, 0], 50],
  ], { shake: jolt(A.costas, 0.04, 0.4) }),
  // ---------------- 12 SENSOR ----------------
  P(S("sensor"), A.degrausS - 0.15, "mall", [
    [S("sensor"), [-0.2, 2.9, 4.3], [-0.6, 2.2, 0.5], 46],
    [A.degrausS - 0.15, [0.2, 3.1, 4.1], [-0.3, 2.4, 0.5], 46],
  ]),
  P(A.degrausS - 0.15, A.sensor - 0.2, "close", [
    [A.degrausS - 0.15, [0.9, 3.35, 2.1], [-0.4, 2.55, 0.4], 42],
    [A.sensor - 0.2, [0.6, 3.25, 2.0], [-0.6, 2.45, 0.4], 42],
  ]),
  P(A.sensor - 0.2, A.porIsso - 0.6, "close", [
    [A.sensor - 0.2, [5.25, 5.6, 1.9], [5.75, 5.25, 0.6], 38],
    [A.porIsso - 0.6, [5.3, 5.5, 1.75], [5.75, 5.25, 0.6], 38],
  ]),
  P(A.porIsso - 0.6, S("lateral"), "mall", follow(A.porIsso - 0.6, S("lateral"), 0.5, stepAt(kSensor), [1.0, 1.0, 2.9], [0.25, 0.9, 0.3], 46)),
  // ---------------- 13 LATERAL ----------------
  P(S("lateral"), A.fresta - 0.1, "mall", follow(S("lateral"), A.fresta - 0.1, 0.5, stepAt(kLat), [0.85, 2.35, 1.95], [0.0, 0.02, 0.42], 46)),
  P(A.fresta - 0.1, A.chinelo + 0.25, "close", follow(A.fresta - 0.1, A.chinelo + 0.25, 0.4, stepAt(kLat), [0.32, 0.27, 1.08], [0.0, 0.04, 0.44], 36), { xr: 1 }),
  P(A.chinelo + 0.25, S("escovas"), "close", follow(A.chinelo + 0.25, S("escovas"), 0.4, stepAt(kLat), [1.05, 1.42, 0.3], [-0.05, 1.33, 0.26], 34)),
  // ---------------- 14 ESCOVAS ----------------
  P(S("escovas"), A.sapato - 1.0, "close", [
    [S("escovas"), [-0.95, treadY(-0.95) + 0.36, 0.12], [-1.25, treadY(-1.25) + 0.13, 0.5], 40],
    [A.sapato - 1.0, [-1.05, treadY(-1.05) + 0.34, 0.14], [-1.35, treadY(-1.35) + 0.13, 0.5], 40],
  ]),
  P(A.sapato - 1.0, A.encosta - 0.05, "close", follow(A.sapato - 1.0, A.encosta - 0.05, 0.4, stepAt(kEsc), [0.36, 0.28, 1.12], [0.0, 0.1, 0.45], 36), { xr: 1 }),
  P(A.encosta - 0.05, A.cocegas - 0.05, "close", follow(A.encosta - 0.05, A.cocegas - 0.05, 0.4, stepAt(kEsc), [0.3, 0.24, 0.98], [0.0, 0.09, 0.46], 34), { xr: 1 }),
  P(A.cocegas - 0.05, A.meio - 0.1, "close", follow(A.cocegas - 0.05, A.meio - 0.1, 0.4, stepAt(kEsc), [1.05, 1.42, 0.35], [-0.05, 1.33, 0.28], 34)),
  P(A.meio - 0.1, A.fique - 0.4, "close", follow(A.meio - 0.1, A.fique - 0.4, 0.4, stepAt(kEsc), [0.45, 0.5, 1.45], [0.0, 0.08, 0.3], 40), { xr: 1 }),
  P(A.fique - 0.4, S("mergulha"), "mall", [
    [A.fique - 0.4, [-7.4, 1.8, 2.0], [0.0, 2.6, 0], 46],
    [S("mergulha"), [-7.0, 2.1, 2.2], [0.5, 2.9, 0], 46],
  ]),
  // ---------------- 15 MERGULHA ----------------
  P(S("mergulha"), A.cadarco - 0.8, "close", [
    [S("mergulha"), [6.6, 5.0, -0.02], [5.92, 4.5, -0.35], 38],
    [A.cadarco - 0.8, [6.55, 4.95, -0.05], [5.93, 4.5, -0.35], 38],
  ]),
  P(A.cadarco - 0.8, A.dedo - 0.55, "close", [
    [A.cadarco - 0.8, [XC_T - 0.04, E.H + 0.26, -0.369 + 0.62], [XC_T - 0.03, E.H + 0.03, -0.369 + 0.08], 40],
    [A.dedo - 0.55, [XC_T - 0.02, E.H + 0.24, -0.369 + 0.57], [XC_T - 0.01, E.H + 0.02, -0.369 + 0.08], 38],
  ], { shake: jolt(A.cadarco, 0.02, 0.5) }),
  P(A.dedo - 0.55, S("pente"), "close", [
    [A.dedo - 0.55, [7.6, 6.0, -0.25], [5.85, 5.85, -0.25], 36],
    [S("pente"), [7.5, 5.99, -0.25], [5.85, 5.85, -0.25], 36],
  ]),
  // ---------------- 16 PENTE ----------------
  P(S("pente"), A.pente - 0.3, "close", [
    [S("pente"), [4.85, 5.3, 0.3], [5.3, 4.5, 0.0], 42],
    [A.pente - 0.3, [4.9, 5.2, 0.28], [5.35, 4.5, 0.0], 42],
  ]),
  P(A.pente - 0.3, A.forcar - 0.2, "close", [
    [A.pente - 0.3, [5.55, 4.75, 0.25], [6.02, 4.5, -0.05], 38],
    [A.forcar - 0.2, [5.6, 4.72, 0.22], [6.03, 4.5, -0.05], 38],
  ]),
  P(A.forcar - 0.2, A.placa - 0.5, "close", [
    [A.forcar - 0.2, [5.55, 4.95, 0.3], [6.05, 4.45, -0.1], 42],
    [A.placa - 0.5, [5.6, 4.9, 0.28], [6.05, 4.45, -0.1], 42],
  ], { xr: 0.7, shake: jolt(A.desliga + 0.05, 0.03, 0.3), light: [6.3, 4.3, 1.0] }),
  P(A.placa - 0.5, S("crianca"), "mall", [
    [A.placa - 0.5, [4.3, 6.1, 2.7], [6.0, 4.5, 0], 44],
    [S("crianca"), [4.0, 6.2, 2.9], [6.0, 4.5, 0], 44],
  ]),
  // ---------------- 17 CRIANÇA ----------------
  P(S("crianca"), A.buraco - 0.05, "mall", [
    [S("crianca"), [7.6, 5.75, 2.9], [5.9, 5.3, 0.4], 44],
    [A.buraco - 0.05, [7.5, 5.7, 2.7], [6.0, 5.25, 0.4], 44],
  ]),
  P(A.buraco - 0.05, S("protetor"), "close", [
    [A.buraco - 0.05, [7.75, 5.5, 2.6], [6.45, 5.1, 0.5], 44],
    [A.crianca + 0.1, [7.6, 5.4, 2.4], [6.45, 5.05, 0.52], 42],
    [S("protetor"), [7.6, 5.4, 2.4], [6.45, 5.05, 0.52], 42],
  ]),
  // ---------------- 18 PROTETOR ----------------
  P(S("protetor"), A.forcou - 0.3, "close", [
    [S("protetor"), [7.1, 5.15, 2.4], [6.55, 4.72, 0.6], 38],
    [A.forcou - 0.3, [7.05, 5.1, 2.3], [6.55, 4.72, 0.6], 38],
  ]),
  P(A.forcou - 0.3, S("luz"), "mall", [
    [A.forcou - 0.3, [7.6, 5.4, 2.8], [6.2, 4.8, 0.4], 44],
    [S("luz"), [7.4, 5.3, 2.6], [6.0, 4.8, 0.4], 44],
  ], { shake: jolt(A.para + 0.05, 0.03, 0.3) }),
  // ---------------- 19 LUZ ----------------
  P(S("luz"), A.lotadaL - 0.05, "mall", [
    [S("luz"), [6.0, 6.6, 10.5], [-0.4, 3.0, -1], 54],
    [A.lotadaL - 0.05, [5.2, 6.2, 10.0], [-0.4, 2.8, -1], 54],
  ]),
  P(A.lotadaL - 0.05, S("freio1"), "mall", [
    [A.lotadaL - 0.05, [-3.4, 1.7, 4.0], [0.3, 3.2, 0], 50],
    [S("freio1"), [-3.0, 1.8, 3.8], [0.3, 3.2, 0], 50],
  ]),
  // ---------------- 20 FREIO DE SERVIÇO ----------------
  P(S("freio1"), A.mola - 0.1, "pit", [
    [S("freio1"), [8.35, 4.15, -1.0], [7.45, 3.15, 0.35], 62],
    [A.mola - 0.1, [8.3, 4.1, -1.0], [7.45, 3.15, 0.3], 60],
  ], { xr: 1, light: [8.0, 3.9, -0.5] }),
  P(A.mola - 0.1, A.eletricidade - 0.1, "pit", [
    [A.mola - 0.1, [7.95, 3.8, -0.6], [7.55, 3.22, 0.1], 46],
    [A.eletricidade - 0.1, [7.9, 3.75, -0.58], [7.55, 3.22, 0.1], 44],
  ], { xr: 1, light: [8.0, 3.7, -0.4] }),
  P(A.eletricidade - 0.1, A.sem - 0.25, "pit", [
    [A.eletricidade - 0.1, [7.65, 3.85, -0.62], [7.47, 3.42, 0.08], 40],
    [A.sem - 0.25, [7.7, 3.9, -0.65], [7.47, 3.4, 0.08], 42],
  ], { xr: 1, light: [7.7, 3.9, -0.4] }),
  P(A.sem - 0.25, A.servico - 0.55, "mall", [
    [A.sem - 0.25, [4.2, 4.4, 8.4], [-0.3, 2.4, 0], 50],
    [A.servico - 0.55, [3.9, 4.2, 8.0], [-0.3, 2.4, 0], 50],
  ], { dark: (t) => prog(t, A.sem - 0.05, A.sem + 0.1), shake: jolt(A.trava + 0.02, 0.05, 0.35) }),
  P(A.servico - 0.55, S("arrebenta"), "pit", [
    [A.servico - 0.55, [8.35, 4.1, -1.0], [7.45, 3.15, 0.35], 60],
    [S("arrebenta"), [8.3, 4.05, -1.0], [7.45, 3.15, 0.35], 60],
  ], { xr: 1, light: [8.0, 3.9, -0.5], dark: () => 0.5 }),
  // ---------------- 21 ARREBENTA (clímax) ----------------
  P(S("arrebenta"), A.segura - 0.4, "pit", [
    [S("arrebenta"), [7.5, 3.95, 3.0], [6.8, 3.45, 0.9], 42],
    [A.arrebentar, [7.4, 3.9, 2.8], [6.8, 3.45, 0.9], 40],
    [A.segura - 0.4, [7.5, 3.95, 2.9], [6.8, 3.45, 0.9], 42],
  ], { xr: 1, light: [6.8, 4.0, 1.8], shake: jolt(A.arrebentar + 0.03, 0.05, 0.6) }),
  P(A.segura - 0.4, A.dispara - 0.25, "pit", [
    [A.segura - 0.4, [7.6, 4.4, 2.9], [6.6, 3.6, 0.2], 46],
    [A.dispara - 0.25, [7.4, 4.5, 3.2], [6.4, 3.7, 0.0], 48],
  ], { xr: 1, light: [6.9, 4.2, 1.8] }),
  P(A.dispara - 0.25, S("hongkong"), "mall", [
    [A.dispara - 0.25, [-7.6, 1.0, 3.4], [-3.2, 2.2, 0], 54],
    [A.rapido, [-7.9, 0.8, 3.1], [-3.6, 1.8, 0], 56],
    [S("hongkong"), [-8.0, 0.8, 3.0], [-3.6, 1.8, 0], 56],
  ], { shake: (t) => 0.015 + 0.035 * prog(t, A.dispara, A.rapido) }),
  // ---------------- 22 HONG KONG ----------------
  P(S("hongkong"), A.fez - 0.05, "night", [
    [S("hongkong"), [8.2, 8.2, 4.6], [-0.4, 2.0, 0], 46],
    [A.fez - 0.05, [7.8, 7.6, 5.0], [-0.8, 1.8, 0], 46],
  ], { dark: () => 1 }),
  P(A.fez - 0.05, A.feridos - 0.45, "night", [
    [A.fez - 0.05, [3.6, 5.2, 4.6], [-2.0, 1.6, 0], 50],
    [A.feridos - 0.45, [1.6, 3.6, 3.4], [-2.8, 1.1, 0], 46],
  ], { shake: () => 0.03, dark: () => 1 }),
  P(A.feridos - 0.45, S("freio2"), "night", [
    [A.feridos - 0.45, [-1.0, 3.2, 7.4], [-4.0, 0.8, 0], 52],
    [S("freio2"), [-1.2, 3.0, 7.2], [-4.2, 0.7, 0], 52],
  ], { shake: () => 0.02, dark: () => 1 }),
  // ---------------- 23 FREIO AUXILIAR ----------------
  P(S("freio2"), A.rodas2 - 0.05, "pit", [
    [S("freio2"), [7.6, 3.8, 3.6], [6.1, 3.8, 0.7], 48],
    [A.rodas2 - 0.05, [7.4, 3.85, 3.4], [6.05, 3.8, 0.6], 50],
  ], { xr: 1, light: [6.5, 4.2, 2.0] }),
  P(A.rodas2 - 0.05, A.disparar - 0.15, "pit", [
    [A.rodas2 - 0.05, [6.75, 4.0, 2.05], [6.1, 3.85, 1.1], 40],
    [A.disparar - 0.15, [6.8, 3.95, 2.1], [6.1, 3.85, 1.1], 40],
  ], { xr: 1, light: [6.5, 4.1, 1.8] }),
  P(A.disparar - 0.15, A.trava2 - 0.3, "mall", [
    [A.disparar - 0.15, [3.2, 4.0, 8.8], [-0.5, 2.3, 0], 50],
    [A.trava2 - 0.3, [2.8, 3.8, 8.2], [-0.6, 2.2, 0], 50],
  ], { shake: (t) => (vAt(t) < 0 ? 0.02 : 0) }),
  P(A.trava2 - 0.3, S("botao"), "pit", [
    [A.trava2 - 0.3, [7.3, 3.85, 3.0], [6.15, 3.85, 0.9], 46],
    [A.auxiliar + 0.4, [7.4, 3.9, 3.2], [6.1, 3.85, 0.8], 48],
  ], { xr: 1, light: [6.5, 4.2, 2.0], shake: jolt(A.trava2 + 0.03, 0.05, 0.4) }),
  // ---------------- 24 BOTÃO ----------------
  P(S("botao"), A.empilhando - 0.05, "mall", [
    [S("botao"), [9.8, 6.6, 3.9], [6.5, 4.8, 0], 48],
    [A.empilhando - 0.05, [9.5, 6.3, 3.5], [6.6, 4.9, 0], 46],
  ]),
  P(A.empilhando - 0.05, A.pontasB - 0.1, "mall", [
    [A.empilhando - 0.05, [8.2, 6.9, 1.4], [6.7, 4.7, 0.0], 44],
    [A.pontasB - 0.1, [8.05, 6.8, 1.3], [6.7, 4.7, 0.0], 44],
  ], { shake: () => 0.012 }),
  P(A.pontasB - 0.1, A.botao - 0.4, "mall", [
    [A.pontasB - 0.1, [0.0, 3.6, 10.5], [0.0, 2.4, 0], 54],
    [A.botao - 0.4, [0.3, 3.7, 10.2], [0.0, 2.4, 0], 54],
  ]),
  P(A.botao - 0.4, A.aperta + 0.6, "close", [
    [A.botao - 0.4, [5.6, 5.4, -0.4], [6.06, 4.95, 0.5], 44],
    [A.aperta - 0.3, [5.75, 5.2, -0.45], [6.08, 4.98, 0.5], 40],
    [A.aperta + 0.6, [5.75, 5.2, -0.42], [6.08, 4.98, 0.5], 40],
  ], { shake: jolt(A.aperta, 0.03, 0.3) }),
  P(A.aperta + 0.6, S("coloque"), "mall", [
    [A.aperta + 0.6, [0.0, 3.4, 11.2], [0.0, 2.4, 0], 54],
    [S("coloque"), [0.4, 3.6, 11.0], [0.0, 2.4, 0], 54],
  ]),
  // ---------------- 25 COLOQUE ----------------
  P(S("coloque"), A.adesivo - 0.1, "mall", [
    [S("coloque"), [1.0, 3.7, 2.6], [-0.6, 2.3, 0], 44],
    [A.adesivo - 0.1, [0.6, 3.5, 2.3], [-0.8, 2.2, 0], 44],
  ]),
  P(A.adesivo - 0.1, A.tio - 0.3, "mall", [
    [A.adesivo - 0.1, [-5.0, 1.4, 2.6], [-6.4, 0.7, 0.5], 42],
    [A.tio - 0.3, [-5.3, 1.3, 2.4], [-6.4, 0.7, 0.5], 42],
  ]),
  P(A.tio - 0.3, S("pisar"), "mall", [
    [A.tio - 0.3, [9.0, 6.0, 3.4], [6.3, 4.9, 0], 46],
    [S("pisar"), [8.6, 5.8, 3.0], [6.3, 4.9, 0], 46],
  ]),
  // ---------------- 26 PISAR ----------------
  P(S("pisar"), S("final"), "mall", [
    [S("pisar"), [-4.4, 1.6, 3.0], [-6.0, 1.0, 0.2], 48],
    [S("final"), [-3.0, 2.2, 3.2], [-4.4, 1.6, 0.2], 48],
  ]),
  // ---------------- 27 FINAL ----------------
  P(S("final"), S("cta"), "wide", [
    [S("final"), [0.6, 4.2, 9.5], [-1.0, 2.6, 0], 52],
    [S("cta"), [12.0, 15.5, 33.0], [0.0, 3.6, -3], 50],
  ], { city: true, xr: 0.55 }),
  // ---------------- 28 CTA ----------------
  P(S("cta"), END, "close", [
    [S("cta"), [5.6, 5.35, -0.85], [6.08, 4.95, 0.5], 44],
    [END, [5.98, 5.15, -0.35], [6.06, 4.97, 0.5], 38],
  ]),
];

// ======================================================================
// Overlays 2D
// ======================================================================
const capY = (t: number) => {
  if (t >= O.p7 && t < O.p8) return 1500;
  if (t >= A.corrente - 0.25 && t < A.sobem - 0.1) return 870;
  if (t >= O.p11 && t < O.p11b) return 870;
  if (t >= S("cta")) return 1560;
  return 1240;
};
const Legenda: React.FC = () => {
  const cover = useContext(CoverCtx);
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (cover) return null;
  const sec = frame / fps;
  const words = TL.cenas.flatMap((c) => c.words);
  const idx = words.findIndex((w, i) => sec >= w.s && sec < (words.at(i + 1)?.s ?? w.e + 0.35));
  const w = idx >= 0 ? words.at(idx) : undefined;
  if (!w || sec > w.e + 0.6) return null;
  const p = spring({ frame: frame - Math.round(w.s * fps), fps, config: SP.snappy });
  const text = w.w.replace(/[.,:;!?"]+$/g, "").replace(/^["]+/, "");
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          top: capY(sec),
          left: 50,
          right: 50,
          textAlign: "center",
          fontFamily: FONT,
          fontWeight: 800,
          fontSize: w.kw ? 118 : 102,
          lineHeight: 1,
          letterSpacing: -1,
          color: w.kw ? C.accent : "#FFFFFF",
          WebkitTextStroke: `22px ${C.ink}`,
          paintOrder: "stroke fill",
          textShadow: "0 0 28px rgba(0,0,0,0.6), 0 8px 0 rgba(0,0,0,0.35)",
          transform: `translateY(${interpolate(p, [0, 1], [20, 0])}px) scale(${interpolate(p, [0, 1], [0.8, 1])})`,
          opacity: interpolate(frame - Math.round(w.s * fps), [0, 2], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
        }}
      >
        {text}
      </div>
    </AbsoluteFill>
  );
};

// Cinza + linhas de VHS + ◀◀ (fracasso desfeito)
const Rewind: React.FC = () => {
  const cover = useContext(CoverCtx);
  const frame = useCurrentFrame();
  const t = frame / 30;
  const r = grayAt(t);
  if (!r) return null;
  const lines = Array.from({ length: 9 }, (_, i) => ((i * 213 + frame * 37) % 1920));
  const jit = Math.sin(frame * 3.1) * 6;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {lines.map((y, i) => (
        <div key={i} style={{ position: "absolute", left: 0, right: 0, top: y, height: 3 + (i % 3) * 2, background: "rgba(255,255,255,0.55)" }} />
      ))}
      <AbsoluteFill style={{ background: "rgba(40,40,40,0.12)" }} />
      {cover ? null : (
        <div style={{ position: "absolute", top: 560 + jit, width: "100%", display: "flex", justifyContent: "center" }}>
          <svg width={240} height={150} viewBox="0 0 160 100" style={{ filter: "drop-shadow(0 6px 0 rgba(0,0,0,0.35))" }}>
            <path d="M78 10 L18 50 L78 90 Z" fill="#FFFFFF" stroke={C.ink} strokeWidth={7} strokeLinejoin="round" />
            <path d="M146 10 L86 50 L146 90 Z" fill="#FFFFFF" stroke={C.ink} strokeWidth={7} strokeLinejoin="round" />
          </svg>
        </div>
      )}
    </AbsoluteFill>
  );
};

// ▶▶ do time-lapse do gancho
const FastFwd: React.FC = () => {
  const cover = useContext(CoverCtx);
  const frame = useCurrentFrame();
  const t = frame / 30;
  if (cover || t < O.p3 || t >= O.p4) return null;
  const blink = Math.floor(t * 4) % 2 ? 1 : 0.75;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <svg width={170} height={110} viewBox="0 0 160 100" style={{ position: "absolute", right: 60, top: 300, opacity: blink, filter: "drop-shadow(0 6px 0 rgba(0,0,0,0.35))" }}>
        <path d="M14 10 L74 50 L14 90 Z" fill="#FFFFFF" stroke={C.ink} strokeWidth={7} strokeLinejoin="round" />
        <path d="M82 10 L142 50 L82 90 Z" fill="#FFFFFF" stroke={C.ink} strokeWidth={7} strokeLinejoin="round" />
      </svg>
    </AbsoluteFill>
  );
};

// Selos de estado (como na referência): "SEM ELETRICIDADE / FREIO ATIVADO" etc.
const Selo: React.FC<{ y: number; text: string; bg: string; p: number }> = ({ y, text, bg, p }) => (
  <div style={{ position: "absolute", top: y, width: "100%", display: "flex", justifyContent: "center", transform: `scale(${p})`, opacity: Math.min(1, p * 2) }}>
    <div style={{ padding: "12px 34px 8px", borderRadius: 16, background: bg, color: "#fff", fontFamily: FONT, fontWeight: 800, fontSize: 46, letterSpacing: 1.5, boxShadow: "0 8px 0 rgba(0,0,0,0.25)", border: `5px solid ${C.ink}` }}>{text}</div>
  </div>
);
const Selos: React.FC = () => {
  const cover = useContext(CoverCtx);
  const frame = useCurrentFrame();
  const t = frame / 30;
  if (cover) return null;
  const sp = (at: number) => spring({ frame: frame - Math.round(at * 30), fps: 30, config: SP.bouncy });
  const out: React.ReactNode[] = [];
  const pair = (a: string, ca: string, b: string, cb: string, at: number) => {
    out.push(<Selo key={`${a}${at}`} y={270} text={a} bg={ca} p={sp(at)} />);
    out.push(<Selo key={`${b}${at}`} y={360} text={b} bg={cb} p={sp(at + 0.12)} />);
  };
  if (t >= A.luz && t < S("freio1")) out.push(<Selo key="se" y={270} text="SEM ELETRICIDADE" bg="#2C3036" p={sp(A.luz)} />);
  if (t >= A.apertado - 0.1 && t < A.eletricidade) pair("SEM ELETRICIDADE", "#2C3036", "FREIO ATIVADO", "#E8352B", A.apertado - 0.1);
  if (t >= A.eletricidade && t < A.sem) pair("COM ELETRICIDADE", "#1F6FD8", "FREIO DESATIVADO", "#2FA84F", A.eletricidade);
  if (t >= A.sem && t < S("arrebenta")) pair("SEM ELETRICIDADE", "#2C3036", "FREIO ATIVADO", "#E8352B", A.sem);
  if (t >= A.segura && t < A.dispara - 0.25) out.push(<Selo key="fa" y={270} text="FREIO ATIVADO" bg="#E8352B" p={sp(A.segura)} />);
  if (t >= A.disparar - 0.05 && t < A.trava2 - 0.3) {
    out.push(<Selo key="sv" y={270} text="SOBREVELOCIDADE" bg="#E8352B" p={sp(A.disparar - 0.05)} />);
    if (t >= A.tras - 0.2) out.push(<Selo key="re" y={360} text="RÉ" bg="#E8352B" p={sp(A.tras - 0.2)} />);
  }
  if (t >= A.auxiliar + 0.4 && t < S("botao")) {
    out.push(<Selo key="nv1" y={270} text="NÃO VOLTA DE RÉ" bg="#2FA84F" p={sp(A.auxiliar + 0.4)} />);
    out.push(<Selo key="nv2" y={360} text="NEM SE A CORRENTE ARREBENTAR" bg="#2C3036" p={sp(A.auxiliar + 0.55)} />);
  }
  if (t >= A.fique - 0.1 && t < S("mergulha")) out.push(<Selo key="fq" y={270} text="FIQUE LONGE DA BEIRADA" bg="#E8352B" p={sp(A.fique - 0.1)} />);
  if (t >= A.botao2 - 0.4 && t < S("coloque")) out.push(<Selo key="bv" y={270} text="BOTÃO VERMELHO NAS DUAS PONTAS" bg="#E8352B" p={sp(A.botao2 - 0.4)} />);
  return <AbsoluteFill style={{ pointerEvents: "none" }}>{out}</AbsoluteFill>;
};

// Medidor "CORRIMÃO × DEGRAUS" (cena do sensor) e velocímetro (clímax / freio auxiliar)
const Gauge: React.FC<{ title: string; value: number; min: number; max: number; zones: [number, number, string][]; label: string; p: number; y?: number; corner?: boolean }> = ({ title, value, min, max, zones, label, p, y = 300, corner = false }) => {
  const ang = (v: number) => -120 + ((cl(v, min, max) - min) / (max - min)) * 240;
  const arc = (a0: number, a1: number, r: number) => {
    const P1 = [100 + r * Math.sin((a0 * PI) / 180), 100 - r * Math.cos((a0 * PI) / 180)];
    const P2 = [100 + r * Math.sin((a1 * PI) / 180), 100 - r * Math.cos((a1 * PI) / 180)];
    return `M${P1[0]} ${P1[1]} A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${P2[0]} ${P2[1]}`;
  };
  const a = ang(value);
  return (
    <div style={{ position: "absolute", top: corner ? 240 : y, ...(corner ? { right: 28, width: 460 } : { width: "100%" }), display: "flex", flexDirection: "column", alignItems: "center", transformOrigin: "top right", transform: `scale(${p * (corner ? 0.58 : 1)})`, opacity: Math.min(1, p * 2) }}>
      <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 44, color: "#fff", WebkitTextStroke: `10px ${C.ink}`, paintOrder: "stroke fill", marginBottom: 6, whiteSpace: "nowrap" }}>{title}</div>
      <svg width={460} height={330} viewBox="0 0 200 145">
        <circle cx={100} cy={100} r={92} fill="rgba(22,24,29,0.88)" stroke="#fff" strokeWidth={4} />
        {zones.map(([v0, v1, c], i) => (
          <path key={i} d={arc(ang(v0), ang(v1), 74)} stroke={c} strokeWidth={16} fill="none" />
        ))}
        <g transform={`rotate(${a} 100 100)`}>
          <path d="M97 100 L100 34 L103 100 Z" fill="#FFFFFF" />
        </g>
        <circle cx={100} cy={100} r={9} fill="#FFFFFF" />
        <text x={100} y={136} textAnchor="middle" fontFamily={FONT} fontWeight={800} fontSize={22} fill="#FFFFFF">
          {label}
        </text>
      </svg>
    </div>
  );
};
const Gauges: React.FC = () => {
  const cover = useContext(CoverCtx);
  const frame = useCurrentFrame();
  const t = frame / 30;
  if (cover) return null;
  const sp = (at: number) => spring({ frame: frame - Math.round(at * 30), fps: 30, config: SP.bouncy });
  if (t >= S("sensor") && t < A.sensor - 0.2) {
    let v = 0.5;
    if (t >= A.dois - 0.2) v = lerp(0.5, 2.0, prog(t, A.dois - 0.2, A.dois + 0.3));
    if (t >= A.nunca - 0.1) v = 2.0 - 3.0 * bump(t, A.nunca + 0.2, 0.35);
    const lab = v < 0 ? "MAIS DEVAGAR ✗" : `+${v.toFixed(1).replace(".", ",")}%`;
    return (
      <AbsoluteFill style={{ pointerEvents: "none" }}>
        <Gauge title="CORRIMÃO × DEGRAUS" value={v} min={-2} max={3} zones={[[-2, 0, "#E8352B"], [0, 2, "#2FB34E"], [2, 3, "#5B636B"]]} label={lab} p={sp(S("sensor"))} />
      </AbsoluteFill>
    );
  }
  if (t >= A.dispara - 0.25 && t < A.rapido + 0.05) {
    const v = Math.abs(vAt(t)) / 0.5;
    return (
      <AbsoluteFill style={{ pointerEvents: "none" }}>
        <Gauge title="VELOCIDADE DE RÉ" value={v} min={0} max={5} zones={[[0, 1, "#2FB34E"], [1, 1.2, "#F2C230"], [1.2, 5, "#E8352B"]]} label={`${v.toFixed(1).replace(".", ",")}×`} p={sp(A.dispara - 0.25)} corner />
      </AbsoluteFill>
    );
  }
  if (t >= A.disparar - 0.15 && t < A.trava2 - 0.3) {
    const v = lerp(1.0, 1.25, prog(t, A.disparar - 0.1, A.disparar + 0.4));
    return (
      <AbsoluteFill style={{ pointerEvents: "none" }}>
        <Gauge title="SENSOR DE VELOCIDADE" value={v} min={0} max={1.6} zones={[[0, 1, "#2FB34E"], [1, 1.2, "#F2C230"], [1.2, 1.6, "#E8352B"]]} label={t > A.tras - 0.2 ? "SENTIDO INVERTIDO" : `${v.toFixed(2).replace(".", ",")}×`} p={sp(A.disparar - 0.15)} y={520} />
      </AbsoluteFill>
    );
  }
  return null;
};

const Icons: React.FC = () => {
  const cover = useContext(CoverCtx);
  const frame = useCurrentFrame();
  const t = frame / 30;
  if (cover) return null;
  const sp = (at: number) => spring({ frame: frame - Math.round(at * 30), fps: 30, config: SP.bouncy });
  const out: React.ReactNode[] = [];
  const badge = (key: string, at: number, x: number, y: number, bg: string, child: React.ReactNode, size = 170) =>
    out.push(
      <div key={key} style={{ position: "absolute", left: x - size / 2, top: y - size / 2, width: size, height: size, borderRadius: size / 2, background: bg, border: `8px solid ${C.ink}`, display: "flex", alignItems: "center", justifyContent: "center", transform: `scale(${sp(at)})`, boxShadow: "0 8px 0 rgba(0,0,0,0.3)" }}>
        {child}
      </div>,
    );
  // a corrente não anda sozinha: pausa
  if (t >= A.naoP - 0.1 && t < S("maquina")) badge("pause", A.naoP - 0.1, 880, 420, "#2C3036", <div style={{ display: "flex", gap: 22 }}><div style={{ width: 26, height: 84, background: "#fff", borderRadius: 6 }} /><div style={{ width: 26, height: 84, background: "#fff", borderRadius: 6 }} /></div>);
  // o pente recua e desliga tudo
  if (t >= A.desliga - 0.05 && t < A.placa - 0.3)
    badge(
      "power",
      A.desliga - 0.05,
      880,
      420,
      "#E8352B",
      <svg width={96} height={96} viewBox="0 0 100 100">
        <path d="M30 26 A34 34 0 1 0 70 26" fill="none" stroke="#fff" strokeWidth={13} strokeLinecap="round" />
        <path d="M50 12 L50 52" stroke="#fff" strokeWidth={13} strokeLinecap="round" />
      </svg>,
    );
  // antes x depois (tela dividida): rampa ✕, degrau ✓
  if (t >= O.p11 + 0.15 && t < O.p11b) {
    badge("xA", O.p11 + 0.15, 900, 250, "#E8352B", <svg width={90} height={90} viewBox="0 0 100 100"><path d="M22 22 L78 78 M78 22 L22 78" stroke="#fff" strokeWidth={16} strokeLinecap="round" /></svg>, 150);
    badge("okB", O.p11 + 0.3, 900, 1210, "#2FA84F", <svg width={90} height={90} viewBox="0 0 100 100"><path d="M18 54 L42 76 L84 26" fill="none" stroke="#fff" strokeWidth={16} strokeLinecap="round" strokeLinejoin="round" /></svg>, 150);
  }
  return <AbsoluteFill style={{ pointerEvents: "none" }}>{out}</AbsoluteFill>;
};

// Cartela "HONG KONG · 2017" + contador de feridos
const HongKong: React.FC = () => {
  const cover = useContext(CoverCtx);
  const frame = useCurrentFrame();
  const t = frame / 30;
  if (cover || t < S("hongkong") || t >= S("freio2")) return null;
  const a = spring({ frame: frame - Math.round(S("hongkong") * 30), fps: 30, config: SP.bouncy });
  const n = Math.round(interpolate(t, [A.dezoito - 0.55, A.dezoito - 0.05], [0, 18], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
  const b = spring({ frame: frame - Math.round((A.dezoito - 0.55) * 30), fps: 30, config: SP.bouncy });
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div style={{ position: "absolute", top: 260, width: "100%", display: "flex", justifyContent: "center", transform: `scale(${a})` }}>
        <div style={{ padding: "16px 40px 10px", background: "rgba(22,24,29,0.92)", border: "5px solid #fff", borderRadius: 20, fontFamily: FONT, fontWeight: 800, color: "#fff", fontSize: 60, letterSpacing: 3, display: "flex", gap: 18, alignItems: "center" }}>
          <div style={{ width: 22, height: 22, borderRadius: 11, background: "#FF3B2B", boxShadow: "0 0 18px #FF3B2B" }} />
          HONG KONG · 2017
        </div>
      </div>
      {t >= A.dezoito - 0.55 ? (
        <div style={{ position: "absolute", top: 400, width: "100%", textAlign: "center", fontFamily: FONT, fontWeight: 800, transform: `scale(${b})` }}>
          <span style={{ fontSize: 170, color: "#FF3B2B", WebkitTextStroke: `18px ${C.ink}`, paintOrder: "stroke fill", fontVariantNumeric: "tabular-nums" }}>{n}</span>
          <span style={{ fontSize: 80, color: "#fff", WebkitTextStroke: `14px ${C.ink}`, paintOrder: "stroke fill", marginLeft: 18 }}>FERIDOS</span>
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

// Escurecimento (apagão / Hong Kong noturno)
const Tint: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / 30;
  let o = 0;
  o = darkAt(t) * 0.32;
  let hk = 0;
  if (t >= S("hongkong") && t < S("freio2")) hk = 0.3;
  if (o <= 0 && hk <= 0) return null;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {o > 0 ? <AbsoluteFill style={{ background: "#0B1636", opacity: o, mixBlendMode: "multiply" }} /> : null}
      {hk > 0 ? <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(30,40,90,0.5), rgba(120,30,60,0.35))", opacity: hk / 0.3, mixBlendMode: "multiply" }} /> : null}
    </AbsoluteFill>
  );
};

// Linhas de velocidade no clímax (escada disparando de ré)
const SpeedLines: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / 30;
  if (t < A.dispara || t >= S("hongkong")) return null;
  const k = prog(t, A.dispara, A.rapido);
  return (
    <AbsoluteFill style={{ pointerEvents: "none", overflow: "hidden" }}>
      {Array.from({ length: 16 }).map((_, i) => {
        const y = ((i * 137 + frame * (30 + 40 * k)) % 2300) - 200;
        const x = (i * 263) % 1080;
        return <div key={i} style={{ position: "absolute", left: x, top: y, width: 6, height: 160 + 140 * k, background: "rgba(255,255,255,0.55)", transform: "rotate(-30deg)", opacity: 0.35 + 0.5 * k }} />;
      })}
    </AbsoluteFill>
  );
};

// Rótulo da peça: só aparece quando a peça nasce na fala
const LABEL_AT: Record<string, number> = {
  DEGRAUS: A.degraus,
  CORRENTE: A.corrente,
  "MÁQUINA": A.motor,
  TRILHOS: A.trilhos,
  "CORRIMÃO": A.borracha,
  "SENSOR DO CORRIMÃO": A.sensor,
  ESCOVAS: A.escovas,
  "PLACA-PENTE": A.pente,
  "PROTETOR DO CORRIMÃO": A.borrachaP,
  "FREIO DE SERVIÇO": A.freio,
  "FREIO AUXILIAR": A.segundo,
  "BOTÃO DE PARADA": A.botao,
};
// regra da referência: o título grande amarelo só entra no "Esse é o X" (a peça já foi apresentada por selo pequeno)
const ESSE_AT = (c: (typeof TL.cenas)[number]) => {
  const hits = c.words.filter((w) => /^ess[aeo]s?$/i.test(w.w.replace(/[^A-Za-zÀ-ú]/g, "")));
  return hits.length ? hits[hits.length - 1].s : undefined;
};
const TopLabelE: React.FC = () => {
  const cover = useContext(CoverCtx);
  const frame = useCurrentFrame();
  if (cover) return null;
  const sec = frame / 30;
  const c = TL.cenas.find((x) => sec >= x.start - 0.1 && sec < x.end + 0.22);
  if (!c || !c.label) return null;
  const at = (ESSE_AT(c) ?? LABEL_AT[c.label] ?? c.start) - 0.1;
  if (sec < at) return null;
  const p = spring({ frame: frame - Math.round(at * 30), fps: 30, config: SP.bouncy });
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div style={{ position: "absolute", top: 150, width: "100%", display: "flex", justifyContent: "center" }}>
        <div style={{ padding: "6px 30px 2px", fontFamily: FONT, fontWeight: 800, fontSize: c.label.length > 14 ? 74 : 92, letterSpacing: 1, color: "#FFD23F", WebkitTextStroke: `16px ${C.ink}`, paintOrder: "stroke fill", textShadow: "0 8px 0 rgba(0,0,0,0.35)", whiteSpace: "nowrap", transform: `translateY(${interpolate(p, [0, 1], [-40, 0])}px) scale(${interpolate(p, [0, 1], [0.6, 1])})`, opacity: interpolate(p, [0, 0.3], [0, 1], { extrapolateRight: "clamp" }) }}>
          {c.label}
        </div>
      </div>
    </AbsoluteFill>
  );
};

// Flash nos impactos
const IMPACTS = [HIT, O.tilt[1], A.chao, A.arrebentar, A.trava2, A.aperta, A.trava, A.desliga];
const Flash: React.FC = () => {
  const frame = useCurrentFrame();
  const o = Math.max(0, ...IMPACTS.map((s) => interpolate(frame, [s * 30 - 1, s * 30, s * 30 + 6], [0, 0.45, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })));
  if (o <= 0) return null;
  return <AbsoluteFill style={{ background: "#fff", opacity: o, pointerEvents: "none" }} />;
};

// Card final: Sabia do botão? Comente SIM / Não sabia? Comente NÃO
const Card: React.FC = () => {
  const cover = useContext(CoverCtx);
  const frame = useCurrentFrame();
  if (cover) return null;
  const t = frame / 30;
  if (t < A.sabia - 0.05) return null;
  const a = spring({ frame: frame - Math.round((A.sabia - 0.05) * 30), fps: 30, config: SP.bouncy });
  const b = spring({ frame: frame - Math.round((A.nao - 0.05) * 30), fps: 30, config: SP.bouncy });
  const line = (txt: string, s: number, size: number, color: string, stroke: number) => (
    <div style={{ fontSize: size, lineHeight: 1.02, color, WebkitTextStroke: `${stroke}px ${C.ink}`, paintOrder: "stroke fill", textShadow: "0 8px 0 rgba(0,0,0,0.3)", transform: `scale(${s})`, opacity: Math.min(1, s * 2) }}>{txt}</div>
  );
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div style={{ position: "absolute", top: 230, width: "100%", textAlign: "center", fontFamily: FONT, fontWeight: 800 }}>
        {line("SABIA DO BOTÃO? COMENTE", a, 58, "#FFFFFF", 12)}
        {line("“SIM”", a, 150, "#3DDC6A", 18)}
        {t >= A.nao - 0.05 ? <div style={{ height: 26 }} /> : null}
        {t >= A.nao - 0.05 ? line("NÃO SABIA? COMENTE", b, 54, "#FFFFFF", 11) : null}
        {t >= A.nao - 0.05 ? line("“NÃO”", b, 150, "#FFD23F", 18) : null}
      </div>
    </AbsoluteFill>
  );
};

// ======================================================================
// Composição
// ======================================================================
const PRE = 2;
const PlanView: React.FC<{ p: Plan }> = ({ p }) => {
  const frame = useCurrentFrame() - PRE;
  const hidden = frame < 0;
  const t = p.from + frame / 30;
  const te = tEff(t);
  const dk = p.look === "night" || p.look === "wide" ? 0 : darkAt(te);
  const L0 = LOOK[p.look];
  const L: Look = dk > 0.001 ? { ...L0, power: lerp(L0.power ?? 2.4, 0.35, dk), amb: lerp(L0.amb ?? 1, 0.35, dk), exp: lerp(L0.exp ?? 1.08, 0.9, dk), sky: dk > 0.5 ? LOOK.dark.sky : L0.sky } : L0;
  const w = 1080, h = p.clip ? 960 : 1920;
  const xr = typeof p.xr === "function" ? p.xr(te) : p.xr ?? 0;
  // sombra das pessoas: decidida UMA vez por plano (nunca pela contagem do quadro, que liga/desliga e pisca)
  const noShadow = useMemo(() => {
    if (p.look === "pit" || p.set) return false;
    let n = 0;
    for (let i = 0; i <= 6; i++) n = Math.max(n, peopleAt(tEff(lerp(p.from, p.to, i / 6))).length);
    return n > 6;
  }, [p]);
  const o: SetOpt = { xr, dark: Math.max(dk, p.dark ? p.dark(te) : 0), city: !!p.city, stair: p.stair, hook: p.hook, light: p.light, lite: p.look === "pit", rw: te !== t, noShadow, bare: p.bare };
  const content = (
    // mapa de sombra e frustum fixos no próprio directionalLight (sem dispose/troca em tempo de render)
    <Palco L={L} w={w} h={h} map={p.look === "close" || p.look === "pit" || p.city ? 1024 : 1536} far={p.city ? 300 : 140}>
      <Rig keys={p.keys} t={te} shake={p.shake ? p.shake(te) : 0} smooth={p.smooth} />
      {p.city ? <SkyFollow top="#4C9FE0" horizon="#D6EBF5" /> : null}
      {p.set === "bike" ? <SetBike t={te} /> : p.set === "footA" ? <SetFoot t={te} v="A" /> : p.set === "footB" ? <SetFoot t={te} v="B" /> : <SetMain t={te} o={o} />}
    </Palco>
  );
  if (!p.clip) return <AbsoluteFill style={{ opacity: hidden ? 0 : 1 }}>{content}</AbsoluteFill>;
  return <div style={{ position: "absolute", left: 0, top: p.clip === "top" ? 0 : 960, width: 1080, height: 960, overflow: "hidden", opacity: hidden ? 0 : 1 }}>{content}</div>;
};

const Divider: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / 30;
  const split = (t >= A.corrente - 0.25 && t < A.sobem - 0.1) || (t >= O.p11 && t < O.p11b);
  if (!split) return null;
  return <div style={{ position: "absolute", left: 0, right: 0, top: 954, height: 12, background: "#fff", boxShadow: "0 0 0 4px #16181D" }} />;
};

const GrayLayer: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const frame = useCurrentFrame();
  const g = grayAt(frame / 30);
  return <AbsoluteFill style={{ filter: g ? "grayscale(1) contrast(1.05) brightness(0.92)" : undefined }}>{children}</AbsoluteFill>;
};

export const Escada: React.FC = () => (
  <TimelineCtx.Provider value={TL}>
    <AbsoluteFill style={{ background: "#D6EBF5" }}>
      <GrayLayer>
        {PLANS.map((p, i) => (
          // cada plano monta PRE quadros antes, invisível: o canvas, as sombras e as pessoas já estão prontos no 1º quadro visível
          <Sequence key={i} from={Math.round(p.from * 30) - PRE} durationInFrames={Math.max(1, Math.round(p.to * 30) - Math.round(p.from * 30)) + PRE} layout="none">
            <PlanView p={p} />
          </Sequence>
        ))}
        <Divider />
        <Tint />
      </GrayLayer>
      <Rewind />
      <Flash />
      <FastFwd />
      <Selos />
      <Gauges />
      <HongKong />
      <Icons />
      <Mark at={A.vizinho + 0.35} kind="x" x={760} y={760} size={170} until={S("corrimao") - 0.1} />
      <Mark at={A.sapato - 0.1} kind="x" x={790} y={700} size={150} until={A.encosta - 0.3} />
      <Card />
      <SpeedLines />
      <TopLabelE />
      <Legenda />
      <Audio src={staticFile("escada/narracao.wav")} />
      <Audio src={staticFile("escada/trilha.wav")} volume={0.9} />
    </AbsoluteFill>
  </TimelineCtx.Provider>
);

export const escadaDuration = (fps: number) => Math.ceil((TL.duration + 1.5) * fps);
// silencia avisos de imports usados só em algumas cenas
void [Dust, XN_B, MCH];
