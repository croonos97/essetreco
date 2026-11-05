import { useMemo } from "react";
import { Ave, AveProps, Especie, PoseAve, texOlho, Texturas } from "./Ave";
import { escamas, lerpCor, mix, pontilhar, sm, ss, texCanvas } from "./PomboComum";

// =====================================================================
// FALCÃO-PEREGRINO (Falco peregrinus) — caça pombos no centro das cidades (ANBA / Instituto Butantan).
// ~42 cm, envergadura ~1 m. Capuz preto-ardósia com "bigode" (faixa malar) preto em bochecha branca,
// costas cinza-ardósia barradas, peito claro com barrinhas, cere e anel do olho amarelos, olho grande escuro,
// bico curto com gancho, pés amarelos, asas longas e pontudas.
// =====================================================================
export const FALCAO: Especie = {
  nome: "falcao",
  torso: [
    [-11, 10.0, 0.5, 0.4, 0.4],
    [-10, 10.5, 2.8, 2.2, 2.2],
    [-6.5, 11.5, 5.2, 3.9, 4.5],
    [-1.5, 12.5, 6.0, 4.3, 5.6],
    [3, 14.3, 5.6, 3.9, 5.6],
    [6, 16.7, 4.3, 2.9, 4.6],
  ],
  pesc: { len: [2.0, 1.7, 1.4, 1.0], w: [3.6, 3.0, 2.6, 2.3], ht: [2.2, 1.9, 1.7, 1.6], hb: [3.2, 2.5, 2.0, 1.8] },
  cab: [
    [-2.2, 1.5, 1.4, 1.5, 1.0],
    [-1.5, 2.3, 2.2, 2.1, 1.1],
    [-0.3, 2.6, 2.5, 2.2, 1.2],
    [0.9, 2.45, 2.3, 2.0, 1.2],
    [2.0, 1.9, 1.7, 1.6, 1.1],
    [2.8, 1.25, 1.15, 1.1, 1.0],
    [3.3, 0.7, 0.65, 0.7, 0.95],
  ],
  corCab: "#2B2F36",
  bico: { z0: 2.9, y0: 0.95, len: 1.9, w: 0.6, h: 0.85, gancho: 0.8, cor: "#3A3E4A", hInf: 0.42 },
  cere: { cor: "#F2C230", esc: [0.56, 0.42, 0.55], pos: [0, 1.55, 3.0] },
  olho: { r: 0.74, pos: [1.72, 1.72, 1.35], iris: "#24160F", irisIn: "#331F14", pupila: 0.6, anel: "#F2C230", anelR: 1.02 },
  perna: { quad: [2.2, 8.6, 1.2], tarso: 5, r: 0.5, cor: "#F0C232", dedos: [3.6, 4.4, 3.6, 2.6], unha: "#141210", coxa: "#E4DED2", coxaR: 1.9, coxaLen: 3 },
  cauda: { len: 15, w0: 2.8, w1: 3.4, ang: 8, y: 0.6 },
  asaF: { zF: 4.8, zT: -21, phiT: 72, phiB: -26, off: 0.45, ponta: 3.5 },
  asaA: { L: 50, corda: 12, pulso: 17, corPrim: "#3A414C", nPrim: 10 },
  rough: 0.8,
  rad: 40,
};

const ARD = "#5C6675"; // ardósia azulada
const corpoTex = () =>
  texCanvas("falcao_corpo", 256, 512, (g, w, h) => {
    for (let y = 0; y < h; y++) {
      const v = 1 - y / (h - 1);
      for (let x = 0; x < w; x += 2) {
        const u = x / w;
        const dors = sm(0.5 + 0.5 * Math.cos((u - 0.5) * Math.PI * 2));
        // ventre claro com barrinhas, dorso ardósia; garganta/peito alto branco
        let c = lerpCor("#EDE4D3", "#3A424E", ss(0.22, 0.5, dors));
        // barrinhas finas só na barriga/flancos (abaixo do peito); peito alto branco com gotinhas
        const barra = v < 0.48 && Math.sin(v * 420 + Math.sin(u * 40) * 0.6) > 0.8;
        if (barra) c = lerpCor(c, dors > 0.5 ? "#252A32" : "#6A6058", dors > 0.5 ? 0.55 : 0.3);
        if (v >= 0.5 && v < 0.64 && dors < 0.4 && Math.sin(v * 300) > 0.85 && Math.sin(u * 90) > 0.3) c = lerpCor(c, "#5A5048", 0.6);
        if (v > 0.62) c = lerpCor(c, "#F6F2EA", ss(0.62, 0.7, v) * (1 - dors));
        g.fillStyle = c;
        g.fillRect(x, y, 2, 1);
      }
    }
    pontilhar(g, w, h, 600, "#000000", 1, 2, 0.05, 141);
  });
// cabeça: capuz escuro (metade de cima) + "bigode" preto descendo do olho; bochecha e garganta brancas
const cabTex = () =>
  texCanvas("falcao_cab", 256, 128, (g, w, h) => {
    for (let x = 0; x < w; x++) {
      const u = x / w; // 0 lado direito, 0.25 topo, 0.5 lado esquerdo, 0.75 garganta
      for (let y = 0; y < h; y++) {
        const v = 1 - y / (h - 1); // 0 nuca … 1 frente
        const cima = u > 0.0 && u < 0.5 ? 1 : 0;
        // distância angular abaixo do meio do lado (0 = linha do olho)
        const abaixo = u >= 0.5 && u < 0.75 ? u - 0.5 : u >= 0.75 ? 1 - u : -1;
        let escuro = cima;
        // nuca escura também um pouco abaixo da linha do olho
        if (abaixo >= 0 && abaixo < 0.06 && v < 0.5) escuro = 1;
        // bigode: faixa larga descendo do olho (v ≈ 0,55–0,7)
        if (abaixo >= 0 && abaixo < 0.26 && v > 0.45 && v < 0.74) escuro = 1;
        if (abaixo >= 0 && abaixo < 0.1 && v < 0.6) escuro = 1; // capuz desce atrás do olho
        g.fillStyle = escuro ? "#1F232A" : "#F3EFE6";
        g.fillRect(x, y, 1, 1);
      }
    }
  });
const asaTex = () =>
  texCanvas("falcao_asa", 512, 256, (g, w, h) => {
    for (let x = 0; x < w; x++) {
      const a = x / (w - 1);
      g.fillStyle = lerpCor(ARD, "#2B3038", ss(0.62, 0.9, a));
      g.fillRect(x, 0, 1, h);
    }
    escamas(g, w * 0.66, h, 18, 22, "#1E232A", 0.45, 142);
    escamas(g, w * 0.66, h, 18, 22, "#8C96A4", 0.18, 143);
  });
const asaATex = () =>
  texCanvas("falcao_asaA", 512, 256, (g, w, h) => {
    for (let x = 0; x < w; x++) {
      const u = x / (w - 1);
      g.fillStyle = lerpCor(ARD, "#252A31", ss(0.45, 0.95, u));
      g.fillRect(x, 0, 1, h);
    }
    escamas(g, w * 0.5, h, 18, 22, "#1E232A", 0.4, 144);
  });
const asaBTex = () =>
  texCanvas("falcao_asaB", 256, 128, (g, w, h) => {
    g.fillStyle = "#DCD6CB";
    g.fillRect(0, 0, w, h);
    g.fillStyle = "#5E5A55";
    for (let x = 0; x < w; x += 7) g.fillRect(x, 0, 2, h);
  });
const caudaTex = () =>
  texCanvas("falcao_cauda", 256, 128, (g, w, h) => {
    for (let x = 0; x < w; x++) {
      const a = x / (w - 1);
      let c = Math.sin(a * 60) > 0.4 ? "#2A3038" : "#5E6876";
      if (a > 0.93) c = "#D9D4CA";
      g.fillStyle = c;
      g.fillRect(x, 0, 1, h);
    }
  });
export const texFalcao = (): Texturas => ({
  corpo: corpoTex(),
  cabeca: cabTex(),
  asa: asaTex(),
  asaA: asaATex(),
  asaB: asaBTex(),
  cauda: caudaTex(),
  olho: texOlho("#24160F", "#331F14", 0.6, "falcao"),
});

// pousado (ereto), olhando em volta: `olhar` = yaw da cabeça em graus (vira para o ninho)
export const poseFalcao = (olhar = 0, baixar = 0): PoseAve => ({ pesc: [72, 80, 72, 60], cabeca: [olhar, -10 - baixar], corpoPitch: 28, pes: { e: [2.6, 0.5, 0.4], d: [-2.6, 0.5, 0.4] } });
// mergulho (asas fechadas junto ao corpo, pernas recolhidas)
export const poseFalcaoMergulho = (): PoseAve => ({ pesc: [20, 15, 10, 0], cabeca: [0, 5], corpoPitch: 0, recolher: 1, leque: 0 });
export const poseFalcaoVoo = (t: number, f = 2, amp = 30): PoseAve => ({ asa: 1, bater: t * f, amp, recolher: 1, pesc: [30, 25, 15, 5], cabeca: [0, -8], corpoPitch: 3, leque: 0.3 });
// saindo do mergulho (asas meio abertas, freio)
export const poseFalcaoFreio = (k: number): PoseAve => ({ asa: mix(0.45, 1, k), bater: 0.25, amp: 10, recolher: 1, pesc: [30, 20, 10, 0], cabeca: [0, 0], corpoPitch: mix(-10, 20, k), leque: 0.6 * k });

export const Falcao: React.FC<Omit<AveProps, "E" | "tx">> = (p) => {
  const tx = useMemo(() => texFalcao(), []);
  return <Ave E={FALCAO} tx={tx} {...p} />;
};
