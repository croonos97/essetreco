import { useMemo } from "react";
import { Ave, AveProps, Especie, PoseAve, texOlho, Texturas } from "./Ave";
import { escamas, lerpCor, mix, pontilhar, sm, ss, texCanvas } from "./PomboComum";

// =====================================================================
// CARCARÁ (Caracara plancus) — predador de pombos nas cidades brasileiras. ~56 cm, envergadura ~1,2 m.
// Boné preto, rosto de pele nua vermelho-alaranjada, bico grande azulado com gancho, pescoço/peito creme
// barrado de preto, barriga e costas marrom-escuras, pernas longas amarelas, cauda creme barrada com faixa preta,
// mancha clara nas primárias (aparece no voo).
// =====================================================================
export const CARCARA: Especie = {
  nome: "carcara",
  torso: [
    [-14, 12.5, 0.6, 0.5, 0.5],
    [-12.8, 13.0, 3.4, 2.6, 2.6],
    [-8.5, 14.0, 6.2, 4.6, 5.2],
    [-2.5, 15.0, 7.2, 5.1, 6.4],
    [3, 17.0, 6.6, 4.6, 6.4],
    [7, 20.0, 5.0, 3.4, 5.4],
  ],
  pesc: { len: [3.4, 3.0, 2.6, 1.8], w: [4.0, 3.1, 2.5, 2.1], ht: [2.6, 2.1, 1.8, 1.6], hb: [3.8, 2.8, 2.1, 1.7] },
  cab: [
    [-2.6, 1.4, 1.3, 1.4, 1.1],
    [-1.8, 2.3, 2.2, 2.1, 1.2],
    [-0.4, 2.6, 2.6, 2.2, 1.3],
    [1.0, 2.45, 2.4, 2.0, 1.3],
    [2.4, 1.9, 1.8, 1.6, 1.2],
    [3.4, 1.3, 1.3, 1.15, 1.05],
    [4.0, 0.8, 0.85, 0.8, 1.0],
  ],
  corCab: "#E9DFC8",
  bico: { z0: 3.3, y0: 1.15, len: 3.4, w: 0.72, h: 1.05, gancho: 1.0, cor: "#AEB9C6", hInf: 0.5 },
  cere: { cor: "#E98A45", esc: [0.62, 0.45, 0.75], pos: [0, 1.9, 3.45] },
  pele: { cor: "#E0623A" },
  olho: { r: 0.62, pos: [1.95, 2.1, 1.5], iris: "#7A4E2A", irisIn: "#94622F", pupila: 0.36, anel: "#E07A45", anelR: 0.95 },
  perna: { quad: [2.4, 10.2, 1.5], tarso: 7.6, r: 0.55, cor: "#E5BE45", dedos: [4.0, 4.8, 4.0, 3.0], unha: "#1E1A18", coxa: "#E2D6BC", coxaR: 2.0, coxaLen: 4 },
  cauda: { len: 20, w0: 3.4, w1: 4.6, ang: 10, y: 0.8 },
  asaF: { zF: 5.6, zT: -25, phiT: 72, phiB: -26, off: 0.5, ponta: 4 },
  asaA: { L: 56, corda: 17, pulso: 23, corPrim: "#1E1A17", nPrim: 9 },
  rough: 0.85,
  rad: 40,
};

const corpoTex = () =>
  texCanvas("carcara_corpo", 256, 512, (g, w, h) => {
    for (let y = 0; y < h; y++) {
      const v = 1 - y / (h - 1);
      for (let x = 0; x < w; x += 4) {
        const u = x / w;
        const dors = sm(0.5 + 0.5 * Math.cos((u - 0.5) * Math.PI * 2));
        let c = "#2E2620";
        if (v < 0.1) c = lerpCor("#E6D9BC", c, ss(0.06, 0.12, v)); // infracaudais claras
        const creme = v > 0.5 ? ss(0.5, 0.62, v) : 0; // peito e pescoço creme
        c = lerpCor(c, "#EAE0C8", creme * (1 - dors * ss(0.5, 0.7, 1 - v + 0.2) * 0.6));
        // barras pretas no peito e na parte alta das costas
        const barr = ss(0.42, 0.55, v) * (1 - ss(0.72, 0.82, v));
        if (barr > 0 && Math.sin(v * 260) > 0.35) c = lerpCor(c, "#2A221C", barr * 0.85);
        g.fillStyle = c;
        g.fillRect(x, y, 4, 1);
      }
    }
    pontilhar(g, w, h, 700, "#000000", 1, 2.5, 0.06, 71);
  });
const cabTex = () =>
  texCanvas("carcara_cab", 128, 128, (g, w, h) => {
    // loft da cabeça: x = volta (0 lado, 0.25 topo, 0.5 outro lado, 0.75 baixo), y: linha 0 = frente (flipY: v 1 = frente)
    for (let x = 0; x < w; x++) {
      const u = x / w;
      const topo = 1 - Math.min(1, Math.abs(u - 0.25) / 0.17);
      for (let y = 0; y < h; y++) {
        const v = 1 - y / (h - 1);
        const bone = sm(topo * 1.6) * (1 - ss(0.72, 0.88, v));
        g.fillStyle = lerpCor("#EDE3CC", "#1D1815", bone);
        g.fillRect(x, y, 1, 1);
      }
    }
  });
const asaTex = () =>
  texCanvas("carcara_asa", 512, 256, (g, w, h) => {
    g.fillStyle = "#3A2F27";
    g.fillRect(0, 0, w, h);
    escamas(g, w * 0.7, h, 22, 26, "#C9B79A", 0.28, 72);
    const gr = g.createLinearGradient(w * 0.65, 0, w, 0);
    gr.addColorStop(0, "rgba(30,24,20,0)");
    gr.addColorStop(1, "rgba(20,16,14,0.9)");
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
  });
const asaATex = () =>
  texCanvas("carcara_asaA", 512, 256, (g, w, h) => {
    g.fillStyle = "#33291F";
    g.fillRect(0, 0, w, h);
    escamas(g, w * 0.4, h * 0.6, 22, 26, "#BCA98C", 0.25, 73);
    // mancha clara nas primárias, com barrinhas
    for (let x = Math.round(w * 0.6); x < w * 0.84; x++)
      for (let y = Math.round(h * 0.25); y < h * 0.75; y++) {
        const bar = Math.sin(x * 0.55) > 0.6;
        g.fillStyle = bar ? "#6E6052" : "#E8DECB";
        g.fillRect(x, y, 1, 1);
      }
    g.fillStyle = "#16120F";
    g.fillRect(w * 0.86, 0, w * 0.14, h);
  });
const asaBTex = () =>
  texCanvas("carcara_asaB", 256, 128, (g, w, h) => {
    g.fillStyle = "#3B3129";
    g.fillRect(0, 0, w, h);
    g.fillStyle = "#E1D7C4";
    g.fillRect(w * 0.6, h * 0.25, w * 0.24, h * 0.5);
  });
const caudaTex = () =>
  texCanvas("carcara_cauda", 256, 128, (g, w, h) => {
    for (let x = 0; x < w; x++) {
      const a = x / (w - 1);
      let c = Math.sin(a * 70) > 0.55 ? "#6F6152" : "#ECE4D3";
      if (a > 0.8) c = "#1C1714";
      g.fillStyle = c;
      g.fillRect(x, 0, 1, h);
    }
  });
export const texCarcara = (): Texturas => ({
  corpo: corpoTex(),
  cabeca: cabTex(),
  asa: asaTex(),
  asaA: asaATex(),
  asaB: asaBTex(),
  cauda: caudaTex(),
  olho: texOlho("#7A4E2A", "#94622F", 0.36, "carcara"),
});

export const POSE_CARCARA: PoseAve = { pesc: [70, 78, 70, 55], cabeca: [0, -12], corpoPitch: 22, pes: { e: [2.8, 0.5, 2.5], d: [-2.8, 0.5, 2.5] } };
export const poseCarcaraVoo = (t: number, f = 1.6, amp = 30): PoseAve => ({ asa: 1, bater: t * f, amp, recolher: 1, pesc: [30, 30, 20, 5], cabeca: [0, -12], corpoPitch: 2, leque: 0.4 });
export const poseCarcaraAtaque = (k: number): PoseAve => ({ pesc: [mix(70, 40, k), mix(78, 30, k), mix(70, 10, k), mix(55, -20, k)], cabeca: [0, mix(-12, -40, k)], corpoPitch: mix(22, 5, k), bico: 0.5 * k, asa: k > 0.5 ? 0.85 : 0, bater: 0.2, amp: 20 });

export const Carcara: React.FC<Omit<AveProps, "E" | "tx">> = (p) => {
  const tx = useMemo(() => texCarcara(), []);
  return <Ave E={CARCARA} tx={tx} {...p} />;
};
