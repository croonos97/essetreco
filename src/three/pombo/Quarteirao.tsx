import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { Ninho } from "./Beiral";
import { lerpCor, mix, pontilhar, rnd, texCanvas, V3 } from "./PomboComum";

// =====================================================================
// CENÁRIO ÚNICO DO VÍDEO: quarteirão do centro de uma cidade brasileira, fim de tarde dourado.
// Unidade: cm. Calçada do prédio em y = 0; fachada do prédio no plano z = 0 (olhando para +z, a rua).
//  • Prédio antigo (reboco ocre descascado), MARQUISE de concreto (y 335–350, sai 160 cm), com manchas de infiltração embaixo.
//  • Ar-condicionado de janela sobre SUPORTE DE FERRO, debaixo da marquise; NINHO em cima dele (NINHO_Q).
//  • Janela aberta do apartamento ao lado (JANELA), com sala por dentro (homem e menino azuis).
//  • Painel de AZULEJO azul e branco (caravela + pessoa com gaiola de pombos) à esquerda; GAIOLA_AZULEJO = centro da gaiola pintada.
//  • Porta do prédio (zelador), calçada de pedra portuguesa, meio-fio, rua de asfalto.
//  • POSTE com fios (a mãe pousa no fio: FIO_POUSO).
//  • Do outro lado da rua (z 900): sobrado com ANTENA no telhado (ANTENA_POUSO = pouso do falcão) e a PRAÇA à direita
//    (árvores, BANCO do humano da pipoca, PONTO DE ÔNIBUS). Cidade desfocada ao fundo (cilindro pintado, sem luz).
// =====================================================================
export const MARQ = { y0: 335, y1: 350, z1: 160, x0: -620, x1: 620 };
// vizinho térreo à esquerda (laje a 2,5 m), com ANTENA de TV na frente da laje: o falcão fica no mesmo eixo do ninho
export const PREDIO_X0 = -630;
export const VIZINHO = { x0: -1500, x1: PREDIO_X0, alt: 250 };
// antena de TV presa na parede por mão-francesa, debaixo da marquise, 6,5 m à direita do ninho (pouso do falcão no quadro 0)
export const ANTENA_PAREDE: V3 = [600, 285, 36];
export const ANTENA_PAREDE_POUSO: V3 = [600, 285 + 1.1, 36];
export const ANTENA_VIZ: V3 = [-665, VIZINHO.alt, -8];
export const ANTENA_VIZ_POUSO: V3 = [-665, VIZINHO.alt + 62 + 1.1, -8];
export const AR = { x0: -72, x1: -10, y0: 222, y1: 262, z1: 46 }; // caixa do ar de janela (sai da parede até z1)
export const NINHO_Q: V3 = [-50, AR.y1, 24]; // lado esquerdo do ar; o pai fica no lado direito, olhando −x (para o sol)
export const NINHO_Q_FUNDO = AR.y1 + 1.6;
export const JANELA = { x0: 110, x1: 230, y0: 140, y1: 300, fundo: -320 };
export const AZULEJO = { x0: -330, x1: -150, y0: 150, y1: 300, z: 1.6 };
export const GAIOLA_AZULEJO: V3 = [mix(AZULEJO.x0, AZULEJO.x1, 0.73), mix(AZULEJO.y0, AZULEJO.y1, 0.5), AZULEJO.z + 0.2];
export const PORTA = { x0: 340, x1: 460, y1: 270 };
export const CALCADA_Z = 350; // meio-fio do lado do prédio
export const RUA_Y = -15;
export const OUTRO_LADO_Z = 900; // meio-fio da praça / fachada do sobrado
export const POSTE: V3 = [190, 0, 320];
export const FIO = { y: 790, z: 320 };
export const FIO_POUSO: V3 = [70, FIO.y + 0.9, FIO.z];
export const SOBRADO = { x0: -620, x1: 240, z: 920, alt: 660 };
export const ANTENA: V3 = [-130, SOBRADO.alt, 960];
// antena de TV curta em cima da MARQUISE (perto do ninho): o falcão fica grande no mesmo quadro do ninho
export const ANTENA_MQ: V3 = [150, MARQ.y1, 120];
export const ANTENA_MQ_POUSO: V3 = [150, MARQ.y1 + 72 + 1.1, 120];
export const ANTENA_POUSO: V3 = [-130, SOBRADO.alt + 178, 960]; // em cima da barra mais alta
export const BANCO: V3 = [560, 0, 1010]; // banco da praça, de frente para a rua (−z)
export const PONTO: V3 = [1020, 0, 930];
export const PRACA = { x0: 260, x1: 2200, z0: OUTRO_LADO_Z, z1: 2400 };

// ---------- texturas ----------
const fachadaTex = () =>
  texCanvas("q_fachada", 512, 512, (g, w, h) => {
    g.fillStyle = "#D7B583";
    g.fillRect(0, 0, w, h);
    pontilhar(g, w, h, 9000, "#B9935E", 0.5, 1.6, 0.35, 201);
    pontilhar(g, w, h, 5000, "#EBD2A6", 0.5, 1.4, 0.3, 202);
    // reboco descascado (manchas cinza com borda)
    for (let i = 0; i < 9; i++) {
      const x = rnd(i, 203) * w, y = rnd(i, 204) * h, r = 12 + rnd(i, 205) * 30;
      g.fillStyle = "#A9A39A";
      g.beginPath();
      for (let k = 0; k < 10; k++) {
        const a = (k / 10) * Math.PI * 2, rr = r * (0.6 + 0.5 * rnd(i * 10 + k, 206));
        if (k === 0) g.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
        else g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
      }
      g.fill();
    }
    // escorridos verticais
    for (let i = 0; i < 40; i++) {
      const x = rnd(i, 207) * w, L = h * (0.2 + 0.6 * rnd(i, 208));
      const gr = g.createLinearGradient(0, 0, 0, L);
      gr.addColorStop(0, "rgba(80,62,40,0.28)");
      gr.addColorStop(1, "rgba(80,62,40,0)");
      g.fillStyle = gr;
      g.fillRect(x, 0, 2 + rnd(i, 209) * 5, L);
    }
  });
const marquiseTex = () =>
  texCanvas("q_marquise", 512, 512, (g, w, h) => {
    g.fillStyle = "#A9A59C";
    g.fillRect(0, 0, w, h);
    pontilhar(g, w, h, 8000, "#8E8A81", 0.5, 1.8, 0.4, 211);
    // manchas de infiltração (anéis marrons)
    for (let i = 0; i < 7; i++) {
      const x = rnd(i, 212) * w, y = rnd(i, 213) * h, r = 30 + rnd(i, 214) * 60;
      const gr = g.createRadialGradient(x, y, r * 0.2, x, y, r);
      gr.addColorStop(0, "rgba(120,100,70,0.15)");
      gr.addColorStop(0.85, "rgba(110,85,50,0.35)");
      gr.addColorStop(1, "rgba(110,85,50,0)");
      g.fillStyle = gr;
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
    }
    pontilhar(g, w, h, 300, "#4F5A46", 1, 3, 0.2, 215); // mofo
  });
const pedraTex = () =>
  texCanvas("q_pedra", 512, 512, (g, w, h) => {
    // pedra portuguesa: fundo branco com ondas pretas, pedrinhas
    g.fillStyle = "#E2DDD2";
    g.fillRect(0, 0, w, h);
    g.fillStyle = "#3A3936";
    for (let y = 0; y < h; y += 2)
      for (let x = 0; x < w; x += 2) {
        const onda = Math.sin((x / w) * Math.PI * 4 + (y / h) * Math.PI * 2 * 0) * 0.12;
        const yy = (y / h + onda) % 0.5;
        if (yy > 0.17 && yy < 0.3) g.fillRect(x, y, 2, 2);
      }
    // juntas das pedrinhas
    g.strokeStyle = "rgba(90,85,78,0.35)";
    g.lineWidth = 1;
    for (let i = 0; i < 2600; i++) {
      const x = rnd(i, 216) * w, y = rnd(i, 217) * h, r = 3 + rnd(i, 218) * 3;
      g.strokeRect(x, y, r, r);
    }
  });
const asfaltoTex = () =>
  texCanvas("q_asfalto", 512, 512, (g, w, h) => {
    g.fillStyle = "#4E4E4E";
    g.fillRect(0, 0, w, h);
    pontilhar(g, w, h, 12000, "#3A3A3A", 0.5, 1.5, 0.5, 219);
    pontilhar(g, w, h, 6000, "#6A6865", 0.5, 1.2, 0.4, 220);
    pontilhar(g, w, h, 20, "#2E2E2E", 20, 60, 0.15, 221);
  });
const sobradoTex = () =>
  texCanvas("q_sobrado", 512, 512, (g, w, h) => {
    g.fillStyle = "#9DB8A6";
    g.fillRect(0, 0, w, h);
    pontilhar(g, w, h, 8000, "#86A08F", 0.5, 1.6, 0.35, 222);
    pontilhar(g, w, h, 4000, "#B7CFC0", 0.5, 1.4, 0.3, 223);
  });
// painel de azulejo (azul e branco): moldura, mar, caravela à esquerda, pessoa com gaiola de pombos à direita
const azulejoTex = () =>
  texCanvas("q_azulejo", 1024, 864, (g, w, h) => {
    const AZ = "#1F4A97";
    g.fillStyle = "#F4F1EA";
    g.fillRect(0, 0, w, h);
    g.strokeStyle = AZ;
    g.fillStyle = AZ;
    // moldura com volutas
    g.lineWidth = 18;
    g.strokeRect(20, 20, w - 40, h - 40);
    g.lineWidth = 6;
    g.strokeRect(52, 52, w - 104, h - 104);
    for (let k = 0; k < 22; k++) {
      const x = 70 + k * ((w - 140) / 21);
      g.beginPath();
      g.arc(x, 36, 10, 0, Math.PI);
      g.stroke();
      g.beginPath();
      g.arc(x, h - 36, 10, Math.PI, 0);
      g.stroke();
    }
    // céu com nuvens (traço)
    g.lineWidth = 4;
    for (let i = 0; i < 5; i++) {
      const x = 140 + i * 170, y = 140 + (i % 2) * 40;
      g.beginPath();
      g.arc(x, y, 26, Math.PI, 0);
      g.arc(x + 40, y, 22, Math.PI, 0);
      g.stroke();
    }
    // mar (ondas)
    g.lineWidth = 5;
    for (let r = 0; r < 6; r++) {
      g.beginPath();
      for (let x = 70; x < w - 70; x += 4) {
        const y = 600 + r * 32 + Math.sin(x * 0.05 + r) * 8;
        if (x === 70) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.stroke();
    }
    // CARAVELA (casco, mastros, velas com cruz)
    g.beginPath();
    g.moveTo(120, 560);
    g.quadraticCurveTo(260, 650, 420, 560);
    g.lineTo(400, 520);
    g.lineTo(140, 520);
    g.closePath();
    g.fill();
    g.lineWidth = 6;
    for (const [x, y0, y1] of [[190, 520, 260], [270, 520, 220], [350, 520, 290]]) {
      g.beginPath();
      g.moveTo(x, y0);
      g.lineTo(x, y1);
      g.stroke();
    }
    g.lineWidth = 5;
    for (const [x, yT, s] of [[190, 280, 70], [270, 240, 90], [350, 300, 60]]) {
      g.beginPath();
      g.moveTo(x - s * 0.6, yT);
      g.quadraticCurveTo(x - s * 0.8, yT + s, x - s * 0.6, yT + s * 1.6);
      g.lineTo(x + s * 0.6, yT + s * 1.6);
      g.quadraticCurveTo(x + s * 0.8, yT + s, x + s * 0.6, yT);
      g.closePath();
      g.stroke();
      // cruz
      g.fillRect(x - 4, yT + s * 0.45, 8, s * 0.7);
      g.fillRect(x - s * 0.25, yT + s * 0.7, s * 0.5, 8);
    }
    // PESSOA com chapéu e capa, segurando a GAIOLA (à direita)
    const px = 660, py = 300;
    g.beginPath();
    g.arc(px, py, 30, 0, Math.PI * 2);
    g.fill(); // cabeça
    g.fillRect(px - 50, py - 34, 100, 10); // aba do chapéu
    g.fillRect(px - 24, py - 66, 48, 34); // copa
    g.beginPath(); // capa / corpo
    g.moveTo(px - 30, py + 34);
    g.lineTo(px - 90, py + 330);
    g.lineTo(px + 70, py + 330);
    g.lineTo(px + 34, py + 34);
    g.closePath();
    g.fill();
    g.lineWidth = 14; // braço estendido até a gaiola
    g.beginPath();
    g.moveTo(px + 30, py + 80);
    g.lineTo(745, py + 120);
    g.stroke();
    // GAIOLA (cúpula com grades) e dois pombos dentro
    const gx = 0.73 * w, gy = 0.5 * h;
    g.lineWidth = 5;
    g.beginPath();
    g.arc(gx, gy - 10, 70, Math.PI, 0);
    g.lineTo(gx + 70, gy + 80);
    g.lineTo(gx - 70, gy + 80);
    g.closePath();
    g.stroke();
    g.fillRect(gx - 80, gy + 78, 160, 10);
    g.beginPath();
    g.arc(gx, gy - 90, 10, 0, Math.PI * 2);
    g.stroke();
    for (let k = -3; k <= 3; k++) {
      g.beginPath();
      g.moveTo(gx + k * 20, gy - 10 - Math.sqrt(Math.max(0, 70 * 70 - (k * 20) ** 2)));
      g.lineTo(gx + k * 20, gy + 80);
      g.stroke();
    }
    for (const [bx, by, d] of [[gx - 28, gy + 50, 1], [gx + 26, gy + 46, -1]]) {
      g.beginPath();
      g.ellipse(bx, by, 22, 14, 0, 0, Math.PI * 2);
      g.fill();
      g.beginPath();
      g.arc(bx + d * 20, by - 16, 9, 0, Math.PI * 2);
      g.fill();
    }
    // juntas dos azulejos (grade de 12 × 10)
    g.strokeStyle = "rgba(150,150,150,0.55)";
    g.lineWidth = 2;
    for (let i = 1; i < 12; i++) {
      g.beginPath();
      g.moveTo((i * w) / 12, 0);
      g.lineTo((i * w) / 12, h);
      g.stroke();
    }
    for (let j = 1; j < 10; j++) {
      g.beginPath();
      g.moveTo(0, (j * h) / 10);
      g.lineTo(w, (j * h) / 10);
      g.stroke();
    }
  });
const cidadeTex = () =>
  texCanvas(
    "q_cidade",
    2048,
    512,
    (g0, w, h) => {
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      const g = c.getContext("2d")!;
      const ceu = g.createLinearGradient(0, 0, 0, h * 0.62);
      ceu.addColorStop(0, "#9FB9D6");
      ceu.addColorStop(0.7, "#F2D9B6");
      ceu.addColorStop(1, "#F7CF98");
      g.fillStyle = ceu;
      g.fillRect(0, 0, w, h);
      const cores = ["#E9DCC6", "#D2B998", "#B8B4AE", "#C8A386", "#EFE6D6", "#A7A9AA", "#D9C7A9"];
      for (let i = 0; i < 80; i++) {
        const bw = 30 + rnd(i, 231) * 90, bh = 80 + rnd(i, 232) * 220 * (0.4 + 0.6 * rnd(i, 233));
        const x = rnd(i, 234) * w, y = h * 0.62 - bh;
        g.fillStyle = cores[Math.floor(rnd(i, 235) * cores.length)];
        g.fillRect(x, y, bw, bh + h);
        g.fillStyle = "rgba(70,70,80,0.3)";
        for (let yy = y + 8; yy < h * 0.62; yy += 13) for (let xx = x + 5; xx < x + bw - 6; xx += 11) g.fillRect(xx, yy, 5, 6);
      }
      g.fillStyle = "#7C7A70";
      g.fillRect(0, h * 0.62, w, h);
      g0.filter = "blur(5px)";
      g0.drawImage(c, 0, 0);
      g0.filter = "none";
    },
    true,
    true,
  );
const grelhaArTex = () =>
  texCanvas("q_grelha_ar", 256, 128, (g, w, h) => {
    g.fillStyle = "#DCD8CC";
    g.fillRect(0, 0, w, h);
    g.fillStyle = "#77746C";
    for (let y = 10; y < h - 8; y += 9) g.fillRect(12, y, w - 24, 4);
    g.fillStyle = "#BDB8AA";
    g.fillRect(w * 0.68, 10, w * 0.26, 30); // painel de botões
  });
const janelasTex = () =>
  texCanvas("q_janelas_fundo", 256, 256, (g, w, h) => {
    g.fillStyle = "#3C4350";
    g.fillRect(0, 0, w, h);
    g.fillStyle = "rgba(255,230,190,0.25)";
    g.fillRect(0, 0, w, h * 0.3);
  });

// ---------- auxiliares ----------
const Caixa: React.FC<{ a: V3; b: V3; m: THREE.Material; sombra?: boolean }> = ({ a, b, m, sombra = true }) => (
  <mesh position={[(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]} material={m} castShadow={sombra} receiveShadow>
    <boxGeometry args={[Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]), Math.abs(b[2] - a[2])]} />
  </mesh>
);
// plano com UV em cm (rep = cm por repetição)
const Plano: React.FC<{ c: V3; tam: [number, number]; rot: V3; tx: THREE.Texture; rep: number; cor?: string; rough?: number }> = ({ c, tam, rot, tx, rep, cor = "#ffffff", rough = 0.95 }) => {
  const m = useMemo(() => {
    const t = tx.clone();
    t.needsUpdate = true;
    t.repeat.set(tam[0] / rep, tam[1] / rep);
    return new THREE.MeshStandardMaterial({ map: t, color: cor, roughness: rough });
  }, [tx, tam[0], tam[1], rep, cor, rough]); // eslint-disable-line
  return (
    <mesh position={c} rotation={rot} material={m} receiveShadow>
      <planeGeometry args={tam} />
    </mesh>
  );
};
const matRep = (tx: THREE.Texture, rx: number, ry: number, cor = "#ffffff", rough = 0.95) => {
  const t = tx.clone();
  t.needsUpdate = true;
  t.repeat.set(rx, ry);
  return new THREE.MeshStandardMaterial({ map: t, color: cor, roughness: rough });
};

// ---------- peças ----------
export const ArDeJanela: React.FC<{ sombra?: boolean }> = ({ sombra = true }) => {
  const M = useMemo(
    () => ({
      caixa: new THREE.MeshStandardMaterial({ color: "#D8D3C6", roughness: 0.55, metalness: 0.1 }),
      grelha: new THREE.MeshStandardMaterial({ map: grelhaArTex(), roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
      ferro: new THREE.MeshStandardMaterial({ color: "#3B302A", roughness: 0.7, metalness: 0.4 }),
      coco: new THREE.MeshStandardMaterial({ color: "#EEEDE6", roughness: 0.8 }),
    }),
    [],
  );
  const A = AR;
  const coco = useMemo(() => {
    const m = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), M.coco, 30);
    const M4 = new THREE.Matrix4();
    for (let i = 0; i < 30; i++) {
      const x = mix(A.x0 + 3, A.x1 - 3, rnd(i, 241)), z = mix(30, A.z1 - 1.5, rnd(i, 242));
      const r = 0.4 + rnd(i, 243) * 0.9;
      M4.compose(new THREE.Vector3(x, A.y1, z), new THREE.Quaternion(), new THREE.Vector3(r * 1.4, r * 0.3, r));
      m.setMatrixAt(i, M4);
    }
    m.receiveShadow = true;
    return m;
  }, [M]); // eslint-disable-line
  useEffect(() => () => coco.dispose(), [coco]);
  return (
    <group>
      <Caixa a={[A.x0, A.y0, 0]} b={[A.x1, A.y1, A.z1]} m={M.caixa} sombra={sombra} />
      <mesh position={[(A.x0 + A.x1) / 2, (A.y0 + A.y1) / 2, A.z1 + 0.15]} material={M.grelha} receiveShadow>
        <planeGeometry args={[A.x1 - A.x0 - 4, A.y1 - A.y0 - 4]} />
      </mesh>
      {/* suporte de ferro: cantoneira horizontal + mão-francesa diagonal + chapa na parede (2 lados) */}
      {[A.x0 + 6, A.x1 - 6].map((x) => (
        <group key={x}>
          <Caixa a={[x - 1.5, A.y0 - 3, 0.3]} b={[x + 1.5, A.y0, A.z1 + 4]} m={M.ferro} sombra={sombra} />
          <mesh position={[x, A.y0 - 28, 22]} rotation={[Math.atan2(A.z1, 52), 0, 0]} material={M.ferro} castShadow={sombra}>
            <boxGeometry args={[2.6, 62, 2.6]} />
          </mesh>
          <Caixa a={[x - 3, A.y0 - 56, 0.2]} b={[x + 3, A.y0 + 2, 1.4]} m={M.ferro} sombra={sombra} />
        </group>
      ))}
      <primitive object={coco} />
    </group>
  );
};

const Arvore: React.FC<{ p: V3; s?: number; seed: number }> = ({ p, s = 1, seed }) => {
  const M = useMemo(() => ({ tronco: new THREE.MeshStandardMaterial({ color: "#5E4A39", roughness: 0.9 }), folha: new THREE.MeshStandardMaterial({ color: "#5C7A3E", roughness: 0.9 }), folha2: new THREE.MeshStandardMaterial({ color: "#73904C", roughness: 0.9 }) }), []);
  return (
    <group position={p} scale={s}>
      <mesh material={M.tronco} position={[0, 160, 0]} castShadow>
        <cylinderGeometry args={[12, 18, 320, 10]} />
      </mesh>
      {Array.from({ length: 9 }, (_, i) => (
        <mesh key={i} material={i % 2 ? M.folha : M.folha2} position={[(rnd(i, seed) - 0.5) * 260, 330 + rnd(i, seed + 1) * 160, (rnd(i, seed + 2) - 0.5) * 260]} castShadow receiveShadow>
          <icosahedronGeometry args={[90 + rnd(i, seed + 3) * 60, 1]} />
        </mesh>
      ))}
    </group>
  );
};
export const BancoPraca: React.FC<{ p?: V3; rotY?: number }> = ({ p = BANCO, rotY = 0 }) => {
  const M = useMemo(() => ({ madeira: new THREE.MeshStandardMaterial({ color: "#8A5F3A", roughness: 0.8 }), ferro: new THREE.MeshStandardMaterial({ color: "#2F3532", roughness: 0.6, metalness: 0.4 }) }), []);
  return (
    <group position={p} rotation={[0, rotY, 0]}>
      {[0, 1, 2].map((k) => (
        <Caixa key={k} a={[-80, 44, -22 + k * 14]} b={[80, 48, -12 + k * 14]} m={M.madeira} />
      ))}
      {[0, 1].map((k) => (
        <Caixa key={k} a={[-80, 58 + k * 16, 22]} b={[80, 70 + k * 16, 26]} m={M.madeira} />
      ))}
      {[-70, 70].map((x) => (
        <group key={x}>
          <Caixa a={[x - 2, 0, -20]} b={[x + 2, 44, -16]} m={M.ferro} />
          <Caixa a={[x - 2, 0, 20]} b={[x + 2, 92, 24]} m={M.ferro} />
        </group>
      ))}
    </group>
  );
};
export const PontoOnibus: React.FC<{ p?: V3 }> = ({ p = PONTO }) => {
  const M = useMemo(() => ({ ferro: new THREE.MeshStandardMaterial({ color: "#5C6A72", roughness: 0.5, metalness: 0.5 }), teto: new THREE.MeshStandardMaterial({ color: "#A9B9C2", roughness: 0.4, metalness: 0.2 }), placa: new THREE.MeshStandardMaterial({ color: "#2D6FB0", roughness: 0.5 }) }), []);
  return (
    <group position={p} rotation={[0, Math.PI, 0]}>
      {[-150, 150].map((x) => (
        <Caixa key={x} a={[x - 4, 0, 40]} b={[x + 4, 250, 48]} m={M.ferro} />
      ))}
      <Caixa a={[-170, 250, -40]} b={[170, 258, 70]} m={M.teto} />
      <Caixa a={[-140, 42, 20]} b={[140, 47, 44]} m={M.ferro} />
      <Caixa a={[190, 180, -2]} b={[230, 250, 2]} m={M.placa} />
      <Caixa a={[208, 0, -2]} b={[212, 180, 2]} m={M.ferro} />
    </group>
  );
};
export const AntenaParede: React.FC = () => {
  const m = useMemo(() => new THREE.MeshStandardMaterial({ color: "#7D8288", roughness: 0.45, metalness: 0.6 }), []);
  const [x, y, z] = ANTENA_PAREDE;
  return (
    <group>
      {/* chapa na parede + braço até a frente + barra (ao longo de x) onde o falcão pousa + varetas */}
      <mesh material={m} position={[x, y - 20, 0.8]} castShadow><boxGeometry args={[8, 30, 1.6]} /></mesh>
      <mesh material={m} position={[x, y - 30, z / 2]} castShadow><boxGeometry args={[2.4, 2.4, z]} /></mesh>
      <mesh material={m} position={[x, y - 15, z]} castShadow><cylinderGeometry args={[1.2, 1.2, 30, 8]} /></mesh>
      <mesh material={m} position={[x, y, z]} rotation={[0, 0, Math.PI / 2]} castShadow><cylinderGeometry args={[1.1, 1.1, 46, 8]} /></mesh>
      {[-18, -6, 6, 18].map((dx) => (
        <mesh key={dx} material={m} position={[x + dx, y - 12, z]} rotation={[Math.PI / 2, 0, 0]} castShadow><cylinderGeometry args={[0.6, 0.6, 26, 6]} /></mesh>
      ))}
    </group>
  );
};
// antena de TV na frente da laje do vizinho (62 cm): o falcão pousa na barra de cima (ANTENA_VIZ_POUSO)
export const AntenaVizinho: React.FC = () => {
  const m = useMemo(() => new THREE.MeshStandardMaterial({ color: "#7D8288", roughness: 0.45, metalness: 0.6 }), []);
  // base na mureta (y alt+14); mastro até a barra de cima (alt+62); barras ao longo de x (o falcão olha para a rua, +z, e vira a cabeça para o ninho, +x)
  return (
    <group position={[ANTENA_VIZ[0], ANTENA_VIZ[1], ANTENA_VIZ[2]]}>
      <mesh material={m} position={[0, 14 + 24, 0]} castShadow>
        <cylinderGeometry args={[1.3, 1.8, 48, 10]} />
      </mesh>
      <mesh material={m} position={[0, 16, 0]} castShadow>
        <cylinderGeometry args={[7, 8, 4, 14]} />
      </mesh>
      {[44, 62].map((y, i) => (
        <mesh key={y} material={m} position={[0, y, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[1.1, 1.1, 60 - i * 22, 8]} />
        </mesh>
      ))}
      {[-22, -8, 6, 20].map((z) => (
        <mesh key={z} material={m} position={[z, 44, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.6, 0.6, 30, 6]} />
        </mesh>
      ))}
    </group>
  );
};
// antena curta (72 cm) na marquise: mastro + 2 barras; o falcão pousa na barra de cima (ANTENA_MQ_POUSO)
export const AntenaMarquise: React.FC = () => {
  const m = useMemo(() => new THREE.MeshStandardMaterial({ color: "#7D8288", roughness: 0.45, metalness: 0.6 }), []);
  return (
    <group position={ANTENA_MQ}>
      <mesh material={m} position={[0, 36, 0]} castShadow>
        <cylinderGeometry args={[1.3, 1.8, 72, 10]} />
      </mesh>
      <mesh material={m} position={[0, 2, 0]} castShadow>
        <cylinderGeometry args={[10, 12, 4, 16]} />
      </mesh>
      {[50, 72].map((y, i) => (
        <mesh key={y} material={m} position={[0, y, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[1.1, 1.1, 70 - i * 20, 8]} />
        </mesh>
      ))}
      {[-25, -10, 5, 20].map((x) => (
        <mesh key={x} material={m} position={[x, 50, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.6, 0.6, 30, 6]} />
        </mesh>
      ))}
    </group>
  );
};
export const Antena: React.FC = () => {
  const m = useMemo(() => new THREE.MeshStandardMaterial({ color: "#7D8288", roughness: 0.45, metalness: 0.6 }), []);
  return (
    <group position={ANTENA}>
      <mesh material={m} position={[0, 90, 0]} castShadow>
        <cylinderGeometry args={[1.6, 2.2, 180, 10]} />
      </mesh>
      {[120, 150, 176].map((y, i) => (
        <mesh key={y} material={m} position={[0, y, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[1.1, 1.1, 120 - i * 25, 8]} />
        </mesh>
      ))}
      {/* elementos da antena (varetas para a frente) na barra de baixo */}
      {[-45, -25, -5, 15, 35].map((x) => (
        <mesh key={x} material={m} position={[x, 120, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.6, 0.6, 40, 6]} />
        </mesh>
      ))}
    </group>
  );
};
export const Poste: React.FC = () => {
  const M = useMemo(() => ({ concreto: new THREE.MeshStandardMaterial({ color: "#B1ADA4", roughness: 0.9 }), fio: new THREE.MeshStandardMaterial({ color: "#1E1E1E", roughness: 0.6 }) }), []);
  return (
    <group>
      <mesh material={M.concreto} position={[POSTE[0], 450, POSTE[2]]} castShadow>
        <cylinderGeometry args={[9, 14, 900, 10]} />
      </mesh>
      <Caixa a={[POSTE[0] - 70, 812, POSTE[2] - 5]} b={[POSTE[0] + 70, 822, POSTE[2] + 5]} m={M.concreto} />
      {/* fios ao longo da rua (raio 0,8 cm: grosso o bastante para não cintilar) */}
      {[FIO.y, FIO.y + 6].map((y, i) => (
        <mesh key={y} material={M.fio} position={[0, y, FIO.z + i * 45]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.8, 0.8, 4000, 6]} />
        </mesh>
      ))}
    </group>
  );
};
export const CidadeFundo: React.FC = () => {
  const mat = useMemo(() => {
    const t = cidadeTex();
    t.wrapS = THREE.RepeatWrapping;
    t.repeat.set(2, 1);
    return new THREE.MeshBasicMaterial({ map: t, side: THREE.BackSide, toneMapped: false, fog: false, depthWrite: false });
  }, []);
  return (
    <mesh position={[0, 300, 600]} material={mat} renderOrder={-10}>
      <cylinderGeometry args={[5500, 5500, 6000, 64, 1, true]} />
    </mesh>
  );
};

// ---------- quarteirão ----------
export const Quarteirao: React.FC<{ ninho?: boolean; sombra?: boolean; detalhe?: boolean }> = ({ ninho = true, sombra = true, detalhe = true }) => {
  const T = useMemo(() => ({ fachada: fachadaTex(), marq: marquiseTex(), pedra: pedraTex(), asfalto: asfaltoTex(), sobrado: sobradoTex(), azulejo: azulejoTex(), fundo: janelasTex() }), []);
  const M = useMemo(
    () => ({
      fachada: matRep(T.fachada, 4, 4),
      friso: new THREE.MeshStandardMaterial({ color: "#E6CFA4", roughness: 0.85 }),
      marq: matRep(T.marq, 4, 1.2),
      marqBorda: new THREE.MeshStandardMaterial({ color: "#B7B2A8", roughness: 0.9 }),
      azulejo: new THREE.MeshStandardMaterial({ map: T.azulejo, roughness: 0.25, metalness: 0.0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
      moldAz: new THREE.MeshStandardMaterial({ color: "#E9E2D2", roughness: 0.6 }),
      madeira: new THREE.MeshStandardMaterial({ color: "#4D6B4E", roughness: 0.7 }), // venezianas verdes
      porta: new THREE.MeshStandardMaterial({ color: "#5A3B26", roughness: 0.7 }),
      sala: new THREE.MeshStandardMaterial({ color: "#E8DCC6", roughness: 0.95, side: THREE.BackSide }),
      piso: new THREE.MeshStandardMaterial({ color: "#8C6A4C", roughness: 0.8 }),
      vidroEsc: new THREE.MeshStandardMaterial({ map: T.fundo, roughness: 0.3, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
      meioFio: new THREE.MeshStandardMaterial({ color: "#BDB8AE", roughness: 0.9 }),
      sobrado: matRep(T.sobrado, 4, 3),
      telhado: new THREE.MeshStandardMaterial({ color: "#A0573A", roughness: 0.85 }),
      vizinho: matRep(T.sobrado, 3, 1, "#D9E3E6"),
    }),
    [T],
  );
  const J = JANELA;
  return (
    <group>
      <CidadeFundo />
      {/* ---- prédio: fachada em painéis em volta da janela e da porta (nenhum painel se sobrepõe) ---- */}
      <Caixa a={[PREDIO_X0, MARQ.y1, -30]} b={[1400, 1500, 0]} m={M.fachada} sombra={sombra} />
      <Caixa a={[PREDIO_X0, 0, -30]} b={[J.x0, MARQ.y0, 0]} m={M.fachada} sombra={sombra} />
      <Caixa a={[J.x1, 0, -30]} b={[PORTA.x0, MARQ.y0, 0]} m={M.fachada} sombra={sombra} />
      <Caixa a={[PORTA.x1, 0, -30]} b={[1400, MARQ.y0, 0]} m={M.fachada} sombra={sombra} />
      <Caixa a={[J.x0, 0, -30]} b={[J.x1, J.y0, 0]} m={M.fachada} sombra={sombra} />
      <Caixa a={[J.x0, J.y1, -30]} b={[J.x1, MARQ.y0, 0]} m={M.fachada} sombra={sombra} />
      <Caixa a={[PORTA.x0, PORTA.y1, -30]} b={[PORTA.x1, MARQ.y0, 0]} m={M.fachada} sombra={sombra} />
      {/* faixa entre a fachada e a marquise (o painel de cima começa em MARQ.y1) */}
      <Caixa a={[PREDIO_X0, MARQ.y0, -30]} b={[1400, MARQ.y1, -0.5]} m={M.fachada} sombra={sombra} />
      {/* rodapé de pedra */}
      <Caixa a={[PREDIO_X0, 0, 0]} b={[J.x0, 40, 3]} m={M.friso} sombra={sombra} />
      <Caixa a={[J.x1, 0, 0]} b={[PORTA.x0, 40, 3]} m={M.friso} sombra={sombra} />
      <Caixa a={[PORTA.x1, 0, 0]} b={[1400, 40, 3]} m={M.friso} sombra={sombra} />
      {/* janelas dos andares de cima (vidro escuro recuado + moldura) */}
      {detalhe
        ? [-480, -250, 0, 250, 500].flatMap((x) =>
            [520, 820, 1120].map((y) => (
              <group key={`${x}_${y}`}>
                <mesh position={[x, y + 80, 0.3]} material={M.vidroEsc}>
                  <planeGeometry args={[100, 160]} />
                </mesh>
                <Caixa a={[x - 62, y - 10, 0]} b={[x + 62, y, 6]} m={M.friso} sombra={sombra} />
                <Caixa a={[x - 58, y + 160, 0]} b={[x + 58, y + 172, 4]} m={M.friso} sombra={sombra} />
              </group>
            )),
          )
        : null}
      {/* cornija acima da marquise */}
      <Caixa a={[PREDIO_X0, 420, 0]} b={[1400, 434, 10]} m={M.friso} sombra={sombra} />
      {/* ---- vizinho térreo (laje a 2,5 m) + antena ---- */}
      <Caixa a={[VIZINHO.x0, 0, -30]} b={[VIZINHO.x1, VIZINHO.alt, 0]} m={M.vizinho} sombra={sombra} />
      <Caixa a={[VIZINHO.x0, VIZINHO.alt, -30]} b={[VIZINHO.x1, VIZINHO.alt + 14, 6]} m={M.friso} sombra={sombra} />
      <Caixa a={[VIZINHO.x0, 0, -400]} b={[VIZINHO.x1, VIZINHO.alt, -30]} m={M.vizinho} sombra={sombra} />
      <mesh position={[-1050, 110, 0.3]} material={M.vidroEsc}>
        <planeGeometry args={[260, 200]} />
      </mesh>
      <AntenaVizinho />
      <AntenaParede />
      {/* ---- marquise ---- */}
      <Caixa a={[MARQ.x0, MARQ.y0, 0]} b={[MARQ.x1, MARQ.y1, MARQ.z1]} m={M.marq} sombra={sombra} />
      <Caixa a={[MARQ.x0, MARQ.y0 - 8, MARQ.z1 - 6]} b={[MARQ.x1, MARQ.y1 + 6, MARQ.z1]} m={M.marqBorda} sombra={sombra} />
      {/* ---- janela aberta do apartamento (sala por dentro) ---- */}
      <mesh position={[(J.x0 + J.x1) / 2, (J.y0 + J.y1) / 2 + 20, J.fundo / 2]} material={M.sala} receiveShadow>
        <boxGeometry args={[400, J.y1 - J.y0 + 120, -J.fundo]} />
      </mesh>
      <Caixa a={[(J.x0 + J.x1) / 2 - 199, J.y0 - 40, J.fundo + 1]} b={[(J.x0 + J.x1) / 2 + 199, J.y0 - 39, -0.5]} m={M.piso} sombra={false} />
      {/* moldura e peitoril */}
      <Caixa a={[J.x0 - 10, J.y0 - 6, 0]} b={[J.x1 + 10, J.y0, 8]} m={M.friso} sombra={sombra} />
      <Caixa a={[J.x0 - 10, J.y1, 0]} b={[J.x1 + 10, J.y1 + 8, 5]} m={M.friso} sombra={sombra} />
      <Caixa a={[J.x0 - 10, J.y0, 0]} b={[J.x0, J.y1, 5]} m={M.friso} sombra={sombra} />
      <Caixa a={[J.x1, J.y0, 0]} b={[J.x1 + 10, J.y1, 5]} m={M.friso} sombra={sombra} />
      {/* venezianas verdes abertas contra a fachada */}
      <Caixa a={[J.x0 - 75, J.y0 + 2, 5]} b={[J.x0 - 12, J.y1 - 2, 8]} m={M.madeira} sombra={sombra} />
      <Caixa a={[J.x1 + 12, J.y0 + 2, 5]} b={[J.x1 + 75, J.y1 - 2, 8]} m={M.madeira} sombra={sombra} />
      {/* ---- porta do prédio (recuada) ---- */}
      <Caixa a={[PORTA.x0, 0, -30]} b={[PORTA.x1, PORTA.y1, -20]} m={M.porta} sombra={sombra} />
      {/* ---- painel de azulejo (moldura + face pintada 0,3 cm à frente) ---- */}
      <Caixa a={[AZULEJO.x0 - 8, AZULEJO.y0 - 8, 0]} b={[AZULEJO.x1 + 8, AZULEJO.y1 + 8, AZULEJO.z - 0.3]} m={M.moldAz} sombra={sombra} />
      <mesh position={[(AZULEJO.x0 + AZULEJO.x1) / 2, (AZULEJO.y0 + AZULEJO.y1) / 2, AZULEJO.z]} material={M.azulejo} receiveShadow>
        <planeGeometry args={[AZULEJO.x1 - AZULEJO.x0, AZULEJO.y1 - AZULEJO.y0]} />
      </mesh>
      {/* ---- ar de janela + ninho ---- */}
      <ArDeJanela sombra={sombra} />
      {ninho ? <Ninho sombra={sombra} position={NINHO_Q} /> : null}
      {/* ---- calçada, meio-fio, rua ---- */}
      <Plano c={[0, 0, (CALCADA_Z - 12) / 2]} tam={[4000, CALCADA_Z - 12]} rot={[-Math.PI / 2, 0, 0]} tx={T.pedra} rep={220} />
      <Caixa a={[-2000, RUA_Y, CALCADA_Z - 12]} b={[2000, 0, CALCADA_Z]} m={M.meioFio} sombra={sombra} />
      <Plano c={[0, RUA_Y, (CALCADA_Z + OUTRO_LADO_Z) / 2]} tam={[4000, OUTRO_LADO_Z - CALCADA_Z]} rot={[-Math.PI / 2, 0, 0]} tx={T.asfalto} rep={300} />
      <Caixa a={[-2000, RUA_Y, OUTRO_LADO_Z]} b={[2000, 0, OUTRO_LADO_Z + 12]} m={M.meioFio} sombra={sombra} />
      {/* faixa amarela no meio da rua */}
      <mesh position={[0, RUA_Y + 0.3, (CALCADA_Z + OUTRO_LADO_Z) / 2]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[4000, 10]} />
        <meshStandardMaterial color="#D8B33A" roughness={0.8} />
      </mesh>
      <Poste />
      {/* ---- outro lado: sobrado com antena + praça ---- */}
      <Plano c={[0, 0, (OUTRO_LADO_Z + 12 + 3200) / 2]} tam={[4000, 3200 - OUTRO_LADO_Z - 12]} rot={[-Math.PI / 2, 0, 0]} tx={T.pedra} rep={220} />
      <Caixa a={[SOBRADO.x0, 0, SOBRADO.z]} b={[SOBRADO.x1, SOBRADO.alt, SOBRADO.z + 900]} m={M.sobrado} sombra={sombra} />
      <Caixa a={[SOBRADO.x0 - 10, SOBRADO.alt, SOBRADO.z - 15]} b={[SOBRADO.x1 + 10, SOBRADO.alt + 18, SOBRADO.z + 900]} m={M.friso} sombra={sombra} />
      {detalhe
        ? [-500, -300, -100, 100].flatMap((x) =>
            [120, 400].map((y) => (
              <group key={`s${x}_${y}`}>
                <mesh position={[x, y + 90, SOBRADO.z - 0.3]} rotation={[0, Math.PI, 0]} material={M.vidroEsc}>
                  <planeGeometry args={[90, 180]} />
                </mesh>
                <Caixa a={[x - 55, y - 8, SOBRADO.z - 6]} b={[x + 55, y, SOBRADO.z]} m={M.friso} sombra={sombra} />
              </group>
            )),
          )
        : null}
      <Antena />
      <Arvore p={[700, 0, 1500]} seed={251} />
      <Arvore p={[1350, 0, 1250]} s={1.1} seed={252} />
      <Arvore p={[420, 0, 1900]} s={0.9} seed={253} />
      <Arvore p={[1800, 0, 1800]} seed={254} />
      <BancoPraca />
      <PontoOnibus />
    </group>
  );
};
void lerpCor;
