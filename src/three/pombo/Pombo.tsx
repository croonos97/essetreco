import { useMemo } from "react";
import * as THREE from "three";
import { andarPombo, Ave, bocaLocal, AveProps, Especie, PoseAve, RaioXAve, texOlho, Texturas } from "./Ave";
import { Papo } from "./Papo";
import { escamas, lerpCor, mix, pontilhar, rnd, sm, ss, texCanvas, V3 } from "./PomboComum";

// =====================================================================
// POMBO-DOMÉSTICO (Columba livia) — macho e fêmea adultos. 1 un = 1 cm; ~32 cm do bico à ponta da cauda.
// Cinza-azulado, duas faixas pretas na asa, faixa preta na ponta da cauda, pescoço iridescente verde/roxo,
// olho laranja, cere branca, bico escuro, pés vermelho-rosados.
// =====================================================================
export const POMBO: Especie = {
  nome: "pombo",
  torso: [
    [-8.6, 6.6, 0.35, 0.3, 0.3],
    [-7.8, 6.9, 2.0, 1.55, 1.55],
    [-5.2, 7.5, 3.9, 2.8, 3.2],
    [-1.6, 8.0, 4.85, 3.35, 4.3],
    [1.9, 9.1, 4.7, 3.1, 4.6],
    [4.4, 10.8, 3.6, 2.3, 3.9],
  ],
  pesc: { len: [1.9, 1.7, 1.5, 1.2], w: [2.7, 1.95, 1.4, 0.95], ht: [1.65, 1.25, 0.95, 0.8], hb: [2.6, 1.65, 1.15, 0.85] },
  cab: [
    [-1.4, 0.7, 0.6, 0.83, 0.35],
    [-0.95, 1.12, 1.08, 1.2, 0.41],
    [-0.2, 1.32, 1.34, 1.28, 0.49],
    [0.6, 1.24, 1.24, 1.14, 0.53],
    [1.35, 0.93, 0.9, 0.88, 0.45],
    [1.95, 0.55, 0.52, 0.56, 0.39],
    [2.3, 0.3, 0.28, 0.34, 0.37],
  ],
  corCab: "#6A7384",
  bico: { z0: 1.9, y0: 0.35, len: 1.95, w: 0.21, h: 0.26, gancho: 0.16, cor: "#2E2C2E", hInf: 0.15 },
  cere: { cor: "#ECEAE4", esc: [0.25, 0.15, 0.4], pos: [0, 0.59, 2.25] },
  olho: { r: 0.44, pos: [0.93, 1.07, 0.68], iris: "#E2551D", irisIn: "#F2A23A", pupila: 0.34, anel: "#7E6F78", anelR: 0.92 },
  perna: { quad: [1.35, 5.4, 0.6], tarso: 2.6, r: 0.27, cor: "#C45762", dedos: [2.6, 3.1, 2.6, 1.8], unha: "#2A2628", coxa: "#8F99A8", coxaR: 1.25, coxaLen: 3 },
  cauda: { len: 11.5, w0: 2.3, w1: 3.0, ang: 6, y: 0.5 },
  asaF: { zF: 3.0, zT: -15.2, phiT: 72, phiB: -26, off: 0.32, ponta: 2.5 },
  asaA: { L: 31, corda: 9.5, pulso: 12.5, corPrim: "#3F444D", nPrim: 9 },
  iri: [0.55, 0.96, 0.05],
  iriForca: 1,
  rad: 40,
};
// fêmea: um pouco menor, pescoço mais fino e menos iridescente, cinza levemente amarronzado
export const POMBA: Especie = {
  ...POMBO,
  nome: "pomba",
  pesc: { len: [1.85, 1.65, 1.45, 1.1], w: [2.4, 1.8, 1.4, 1.02], ht: [1.5, 1.15, 0.95, 0.82], hb: [2.3, 1.5, 1.12, 0.88] },
  iriForca: 0.55,
};
export const ESC_POMBA = 0.93;

// ---------------- texturas ----------------
// corpo: canvas x = volta (0 ventre, 0.5 dorso), y = comprimento (linha 0 = cabeça; flipY)
const corpoTex = (chave: string, base: { ventre: string; dorso: string; uropigio: string; peito: string; pesc: string; cauda: string }) =>
  texCanvas(`pombo_corpo_${chave}`, 256, 512, (g, w, h) => {
    for (let y = 0; y < h; y++) {
      const v = 1 - y / (h - 1); // 0 cloaca … 1 cabeça
      for (let x = 0; x < w; x += 4) {
        const u = x / w;
        const dors = 0.5 + 0.5 * Math.cos((u - 0.5) * Math.PI * 2); // 1 no dorso
        let c = lerpCor(base.ventre, base.dorso, sm(dors));
        if (v < 0.12) c = lerpCor(base.cauda, c, ss(0.05, 0.12, v));
        if (v > 0.12 && v < 0.32) c = lerpCor(c, base.uropigio, sm(dors) * (1 - Math.abs(v - 0.22) / 0.1) * 0.8);
        if (v > 0.36) c = lerpCor(c, base.peito, ss(0.36, 0.5, v) * (1 - sm(dors) * 0.6));
        if (v > 0.5) c = lerpCor(c, base.pesc, ss(0.5, 0.62, v));
        g.fillStyle = c;
        g.fillRect(x, y, 4, 1);
      }
    }
    escamas(g, w, h, 14, 18, "#ffffff", 0.07, 3);
    escamas(g, w, h, 14, 18, "#1C2230", 0.06, 5);
    pontilhar(g, w, h, 900, "#20283A", 1, 3, 0.05, 7);
  });
const asaTex = (chave: string, cob: string, barra: string, prim: string, ponta: string) =>
  texCanvas(`pombo_asa_${chave}`, 512, 256, (g, w, h) => {
    // x = a (ombro → ponta), y: linha 0 = b 1 (borda de baixo)
    for (let x = 0; x < w; x++) {
      const a = x / (w - 1);
      for (let y = 0; y < h; y += 2) {
        const b = 1 - y / (h - 1);
        let c = lerpCor(cob, "#8F99A8", ss(0.0, 0.18, 1 - b) * 0.0 + (b < 0.12 ? 0.35 : 0));
        // primárias e secundárias (parte de trás)
        if (a > 0.66) c = lerpCor(c, "#8E98A7", ss(0.66, 0.72, a));
        if (a > 0.73) c = lerpCor(c, prim, ss(0.73, 0.8, a));
        if (a > 0.88) c = lerpCor(c, ponta, ss(0.88, 0.97, a));
        // duas faixas pretas inclinadas (só da metade de baixo para baixo)
        const vis = ss(0.16, 0.3, b);
        for (const ac of [0.41, 0.535]) {
          const centro = ac + 0.13 * b;
          const d = Math.abs(a - centro);
          if (d < 0.03) c = lerpCor(c, barra, vis * (1 - ss(0.022, 0.03, d)));
        }
        g.fillStyle = c;
        g.fillRect(x, y, 1, 2);
      }
    }
    // bordas de pena: coberteiras (escamas) e linhas das rêmiges
    escamas(g, w * 0.62, h, 20, 26, "#ffffff", 0.1, 11);
    g.strokeStyle = "#ffffff";
    g.globalAlpha = 0.12;
    g.lineWidth = 2;
    for (let i = 0; i < 16; i++) {
      const x0 = w * (0.64 + i * 0.022);
      g.beginPath();
      g.moveTo(x0, h);
      g.lineTo(x0 + w * 0.08, 0);
      g.stroke();
    }
    g.globalAlpha = 1;
  });
const asaAbertaTex = (chave: string, cob: string, barra: string, prim: string, ponta: string) =>
  texCanvas(`pombo_asaA_${chave}`, 512, 256, (g, w, h) => {
    for (let x = 0; x < w; x++) {
      const u = x / (w - 1);
      for (let y = 0; y < h; y += 2) {
        const c0 = 1 - y / (h - 1); // 0 bordo de ataque … 1 bordo de fuga
        let c = cob;
        if (u < 0.4) {
          if (c0 > 0.78) c = lerpCor(c, "#7E8897", 1);
          if (c0 > 0.93) c = lerpCor(c, "#3A3E46", 0.8);
          if (u > 0.05 && u < 0.38) {
            for (const [a0, a1] of [[0.5, 0.6], [0.68, 0.78]]) if (c0 > a0 && c0 < a1) c = barra;
          }
        } else {
          if (c0 > 0.32) c = lerpCor(c, prim, ss(0.32, 0.45, c0));
          c = lerpCor(c, ponta, ss(0.68, 0.95, u) * ss(0.3, 0.6, c0) + ss(0.86, 1, u) * 0.5);
        }
        g.fillStyle = c;
        g.fillRect(x, y, 1, 2);
      }
    }
    // raques das rêmiges
    g.strokeStyle = "#20242B";
    g.globalAlpha = 0.35;
    g.lineWidth = 2;
    for (let i = 0; i < 20; i++) {
      const x0 = w * (i < 11 ? 0.02 + i * 0.034 : 0.4 + (i - 11) * 0.066);
      g.beginPath();
      g.moveTo(x0, h * 0.25);
      g.lineTo(x0 + (i < 11 ? 0 : w * 0.05), h);
      g.stroke();
    }
    g.globalAlpha = 1;
  });
const asaBaixoTex = (chave: string) =>
  texCanvas(`pombo_asaB_${chave}`, 256, 128, (g, w, h) => {
    const gr = g.createLinearGradient(0, h, 0, 0);
    gr.addColorStop(0, "#E3E6EA");
    gr.addColorStop(0.7, "#C9CED6");
    gr.addColorStop(1, "#8E949E");
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
  });
const caudaTex = (chave: string, base: string, faixa: string) =>
  texCanvas(`pombo_cauda_${chave}`, 256, 128, (g, w, h) => {
    for (let x = 0; x < w; x++) {
      const a = x / (w - 1);
      let c = base;
      if (a > 0.8) c = lerpCor(base, faixa, ss(0.8, 0.85, a));
      g.fillStyle = c;
      g.fillRect(x, 0, 1, h);
    }
    // bordas externas mais claras + separação das retrizes
    g.fillStyle = "#C9D0D9";
    g.globalAlpha = 0.5;
    g.fillRect(0, 0, w * 0.8, h * 0.06);
    g.fillRect(0, h * 0.94, w * 0.8, h * 0.06);
    g.globalAlpha = 0.18;
    g.fillStyle = "#1A1E26";
    for (let i = 1; i < 12; i++) g.fillRect(0, (h * i) / 12, w, 1);
    g.globalAlpha = 1;
  });

export const texPombo = (femea = false): Texturas => {
  const k = femea ? "f" : "m";
  return {
    corpo: corpoTex(k, femea
      ? { ventre: "#8F949F", dorso: "#A4A9B3", uropigio: "#B8BCC4", peito: "#8B8A95", pesc: "#626574", cauda: "#8A8E98" }
      : { ventre: "#8F99A9", dorso: "#A6B0BF", uropigio: "#BBC3CF", peito: "#8B92A3", pesc: "#5D6677", cauda: "#8C96A5" }),
    asa: femea ? asaTex(k, "#ADB3BD", "#1E1D20", "#646872", "#2A2A2E") : asaTex(k, "#B2BBC8", "#18191C", "#5D6470", "#25282E"),
    asaA: femea ? asaAbertaTex(k, "#B1B0B5", "#1E1D20", "#77757B", "#2A2A2E") : asaAbertaTex(k, "#B2BBC8", "#18191C", "#7A8391", "#25282E"),
    asaB: asaBaixoTex(k),
    cauda: femea ? caudaTex(k, "#8E8D93", "#222226") : caudaTex(k, "#8D97A6", "#202227"),
    olho: texOlho("#E2551D", "#F4A63A", 0.34, "pombo"),
  };
};

// ---------------- poses ----------------
export const POSE_PARADO: PoseAve = { pesc: [70, 80, 84, 82], cabeca: [0, -6] };
export const poseArrulho = (t: number, k = 1): PoseAve => {
  const curv = 0.5 - 0.5 * Math.cos(t * Math.PI * 2 * 0.9); // reverência ~0,9 Hz
  return {
    inflar: k * (0.75 + 0.25 * curv),
    papo: k,
    pesc: [mix(72, 58, k), mix(84, 70, k * curv), mix(86, 88, k), mix(80, mix(84, 100, curv), k)],
    cabeca: [0, mix(-4, -28, k * curv)],
    corpoPitch: -6 * k * curv,
    leque: 0.55 * k,
  };
};
export const poseVoo = (t: number, f = 3, amp = 40): PoseAve => ({ asa: 1, bater: t * f, amp, recolher: 1, pesc: [38, 42, 28, 12], cabeca: [0, -2], corpoPitch: 4, leque: 0.45 });
// alimentando: pescoço curvado para baixo/frente, bico aberto, papo pulsando (~1,6 Hz)
export const poseAlimentar = (t: number, k = 1, f = 1.6, baixar = 1): PoseAve => {
  const pul = 0.5 + 0.5 * Math.sin(t * Math.PI * 2 * f);
  const b = k * baixar;
  return {
    pesc: [mix(72, 58, b), mix(84, 22, b), mix(86, -28, b), mix(80, -62, b)],
    cabeca: [0, mix(-4, -58, b) + pul * 4 * k, 0],
    corpoPitch: mix(0, -6, b),
    bico: 0.4 * k,
    pulsar: pul * k,
    papo: k, // papo cheio (bolsa) enquanto alimenta
    avancoCab: -0.4 * pul * k,
  };
};
// bicando o chão (pipoca): ciclo de ~1,4 Hz, cabeça desce até o chão e volta
export const poseBicar = (t: number, k = 1, f = 1.4): PoseAve => {
  const c = Math.pow(Math.max(0, Math.sin(t * Math.PI * 2 * f)), 2);
  return { pesc: [mix(70, 20, k * c), mix(80, -20, k * c), mix(84, -60, k * c), mix(82, -80, k * c)], cabeca: [0, mix(-6, -75, k * c)], corpoPitch: -14 * k * c, bico: 0.15 * k * c };
};
export { andarPombo };

// ---------------- componente ----------------
export type PomboProps = Omit<AveProps, "E" | "tx"> & { femea?: boolean };
export const Pombo: React.FC<PomboProps> = ({ femea, escala, raioX, ...r }) => {
  const tx = useMemo(() => texPombo(femea), [femea]);
  const E = femea ? POMBA : POMBO;
  return (
    <Ave
      E={E}
      tx={tx}
      escala={(escala ?? 1) * (femea ? ESC_POMBA : 1)}
      raioX={raioX}
      noCorpo={raioX?.papo ? (S, A) => <Papo S={S} A={A} {...(raioX.papo as NonNullable<RaioXAve["papo"]>)} t={r.t ?? 0} bocaL={bocaLocal(E, r.pose.bico ?? 0)} /> : undefined}
      {...r}
    />
  );
};
void rnd;
void THREE;
export type { V3 };
