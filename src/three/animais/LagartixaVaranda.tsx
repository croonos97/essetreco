import { useMemo } from "react";
import * as THREE from "three";
import { clamp01, mix, rnd, sm, texCanvas, V3 } from "./LagartixaComum";

// =====================================================================
// VARANDA BRASILEIRA À NOITE — cenário único do vídeo da lagartixa.
// Escala do kit: 1 un = 0,5 m. Parede do fundo no plano z = 0 (face para +z). Chão y = 0. Forro y = 5,2 (2,6 m).
// x: −3,4 … +3,8. A varanda é aberta para +z (mureta em z = 4,2, quintal escuro atrás).
// Tudo que é coplanar está afastado ≥ 2 mm (0,004 un) ou usa polygonOffset — sem z-fighting.
// =====================================================================
export const VAR = {
  teto: 5.2,
  lampada: [0.0, 4.05, 0.17] as V3, // centro do bulbo
  arandela: [0.0, 4.05, 0] as V3,
  banco: { x0: -1.7, x1: 0.7, y: 0.9, z0: 0.06, z1: 0.76 }, // assento (topo em y)
  porta: { x0: 1.9, x1: 3.5, y1: 4.2 },
  quadro: { c: [1.05, 2.95, 0.0] as V3, w: 0.62, h: 0.48 }, // centro na parede (moldura fica em z ≈ 0,03)
  fresta: { c: [-0.55, 5.06, 0] as V3, w: 0.26, h: 0.045 }, // perto da quina parede–forro
  vassoura: [-2.55, 0, 0.0] as V3,
};

// ---------- texturas ----------
const reboco = () =>
  texCanvas("varReboco", 1024, 1024, (g, W, H) => {
    // tinta acrílica creme, com variação larga + sujeira embaixo e mancha de fuligem em volta da lâmpada (topo)
    const img = g.createImageData(W, H);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const n1 = rnd(Math.floor(x / 64) * 977 + Math.floor(y / 64), 1), n2 = rnd(Math.floor(x / 9) * 977 + Math.floor(y / 9), 2), n3 = rnd(x * 3001 + y, 3);
        const v = 0.93 + (n1 - 0.5) * 0.04 + (n2 - 0.5) * 0.03 + (n3 - 0.5) * 0.03;
        const k = (y * W + x) * 4;
        // verde-água claro (tinta comum de varanda): separa a lagartixa bege da parede
        img.data[k] = 200 * v;
        img.data[k + 1] = 226 * v;
        img.data[k + 2] = 214 * v;
        img.data[k + 3] = 255;
      }
    g.putImageData(img, 0, 0);
    // escorridos e manchas suaves
    for (let i = 0; i < 26; i++) {
      const x = rnd(i, 5) * W, y = rnd(i, 6) * H, r = 30 + rnd(i, 7) * 90;
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, "rgba(120,100,70,0.07)");
      gr.addColorStop(1, "rgba(120,100,70,0)");
      g.fillStyle = gr;
      g.fillRect(x - r, y - r, 2 * r, 2 * r);
    }
  });
const rebocoBump = () =>
  texCanvas("varRebocoB", 512, 512, (g, W, H) => {
    const img = g.createImageData(W, H);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const a = rnd(x * 7919 + y * 31, 1), b = rnd(Math.floor(x / 3) * 911 + Math.floor(y / 3), 2), c = rnd(Math.floor(x / 11) * 911 + Math.floor(y / 11), 4);
        const v = 0.5 + (a - 0.5) * 0.25 + (b - 0.5) * 0.45 + (c - 0.5) * 0.3;
        const k = (y * W + x) * 4;
        img.data[k] = img.data[k + 1] = img.data[k + 2] = Math.round(clamp01(v) * 255);
        img.data[k + 3] = 255;
      }
    g.putImageData(img, 0, 0);
  }, false);
const pvc = () =>
  texCanvas("varPVC", 256, 512, (g, W, H) => {
    g.fillStyle = "#F2F0EA";
    g.fillRect(0, 0, W, H);
    // réguas de 10 cm (0,2 un): 2 réguas por textura (0,4 un) com frisos
    for (let i = 0; i < 2; i++) {
      const y = (i * H) / 2;
      g.fillStyle = "#8F8B82";
      g.fillRect(0, y, W, 7);
      g.fillStyle = "#FFFFFF";
      g.fillRect(0, y + 7, W, 4);
      g.fillStyle = "#CFCBC2";
      g.fillRect(0, y + H / 4 - 2, W, 4);
    }
  });
const lajota = () =>
  texCanvas("varLajota", 512, 512, (g, W, H) => {
    // cerâmica vermelha 30×30 (2×2 por textura = 0,6 m)
    for (let i = 0; i < 2; i++)
      for (let j = 0; j < 2; j++) {
        const c = 0.9 + rnd(i * 7 + j, 3) * 0.12;
        g.fillStyle = `rgb(${Math.round(150 * c)},${Math.round(62 * c)},${Math.round(44 * c)})`;
        g.fillRect(i * 256, j * 256, 256, 256);
        for (let k = 0; k < 500; k++) {
          g.fillStyle = rnd(k, i * 2 + j) > 0.5 ? "rgba(255,200,170,0.06)" : "rgba(60,20,10,0.08)";
          g.fillRect(i * 256 + rnd(k, 8) * 256, j * 256 + rnd(k, 9) * 256, 3 + rnd(k, 10) * 8, 2 + rnd(k, 11) * 6);
        }
      }
    g.fillStyle = "#5E4B40";
    for (let i = 0; i <= 2; i++) {
      g.fillRect(i * 256 - 3, 0, 6, H);
      g.fillRect(0, i * 256 - 3, W, 6);
    }
  });
const madeira = (cor: string, key: string) =>
  texCanvas(`varMad${key}`, 256, 512, (g, W, H) => {
    g.fillStyle = cor;
    g.fillRect(0, 0, W, H);
    for (let i = 0; i < 90; i++) {
      const x = rnd(i, 1) * W;
      g.strokeStyle = rnd(i, 2) > 0.5 ? "rgba(40,20,5,0.22)" : "rgba(255,220,170,0.10)";
      g.lineWidth = 1 + rnd(i, 3) * 3;
      g.beginPath();
      g.moveTo(x, 0);
      for (let y = 0; y <= H; y += 32) g.lineTo(x + Math.sin(y * 0.02 + i) * 6 * rnd(i, 4), y);
      g.stroke();
    }
  });
// QUADRO: aquarela de naturalista do séc. XVII (no estilo das pranchas do Brasil holandês, ~1640)
export const aquarelaTex = () =>
  texCanvas(
    "varAquarela",
    768,
    600,
    (g, W, H) => {
      // papel envelhecido
      const gr = g.createRadialGradient(W / 2, H / 2, 50, W / 2, H / 2, W * 0.7);
      gr.addColorStop(0, "#EBDDB8");
      gr.addColorStop(1, "#C9B07E");
      g.fillStyle = gr;
      g.fillRect(0, 0, W, H);
      for (let i = 0; i < 1600; i++) {
        g.fillStyle = `rgba(110,80,40,${0.03 + rnd(i, 2) * 0.05})`;
        g.beginPath();
        g.arc(rnd(i, 3) * W, rnd(i, 4) * H, 0.5 + rnd(i, 5) * 2.5, 0, 7);
        g.fill();
      }
      // manchas de umidade (foxing)
      for (let i = 0; i < 14; i++) {
        const x = rnd(i, 6) * W, y = rnd(i, 7) * H, r = 8 + rnd(i, 8) * 30;
        const rg = g.createRadialGradient(x, y, 0, x, y, r);
        rg.addColorStop(0, "rgba(140,90,40,0.25)");
        rg.addColorStop(1, "rgba(140,90,40,0)");
        g.fillStyle = rg;
        g.fillRect(x - r, y - r, 2 * r, 2 * r);
      }
      // lagartixa pintada (vista de cima, rabo em S), lavagens sobrepostas
      g.save();
      g.translate(W * 0.45, H * 0.46);
      g.rotate(-0.25);
      const wash = (a: number, cor: string) => {
        g.fillStyle = cor;
        g.globalAlpha = a;
      };
      // rabo
      g.lineCap = "round";
      for (let p = 0; p < 3; p++) {
        g.strokeStyle = p === 0 ? "rgba(120,100,70,0.55)" : "rgba(90,70,50,0.25)";
        g.lineWidth = 26 - p * 6;
        g.beginPath();
        g.moveTo(-60, 0);
        g.bezierCurveTo(-150, 10, -170, 80, -250, 70);
        g.bezierCurveTo(-300, 64, -320, 20, -330, 5);
        g.stroke();
      }
      // corpo
      wash(0.75, "#9C8A68");
      g.beginPath();
      g.ellipse(20, 0, 110, 38, 0, 0, 7);
      g.fill();
      // cabeça
      g.beginPath();
      g.moveTo(120, -30);
      g.quadraticCurveTo(200, -24, 222, 0);
      g.quadraticCurveTo(200, 24, 120, 30);
      g.fill();
      // patas com dedos alargados
      const pata = (x: number, y: number, a: number) => {
        g.save();
        g.translate(x, y);
        g.rotate(a);
        g.globalAlpha = 0.7;
        g.strokeStyle = "#8A7656";
        g.lineWidth = 10;
        g.beginPath();
        g.moveTo(0, 0);
        g.lineTo(0, 46);
        g.lineTo(18, 70);
        g.stroke();
        g.fillStyle = "#7C6A4C";
        for (let k = 0; k < 5; k++) {
          g.beginPath();
          g.ellipse(18 + Math.cos(k * 0.5 - 0.4) * 20, 70 + Math.sin(k * 0.5 - 0.4) * 20, 6, 4, k * 0.5, 0, 7);
          g.fill();
        }
        g.restore();
      };
      pata(80, 28, -0.4);
      pata(80, -28, Math.PI + 0.4);
      pata(-50, 28, 0.5);
      pata(-50, -28, Math.PI - 0.5);
      // faixas em W escuras
      g.globalAlpha = 0.55;
      g.strokeStyle = "#4A3A28";
      g.lineWidth = 7;
      for (let k = 0; k < 4; k++) {
        const x = 70 - k * 38;
        g.beginPath();
        g.moveTo(x, -30);
        g.lineTo(x - 12, -12);
        g.lineTo(x - 4, 0);
        g.lineTo(x - 12, 12);
        g.lineTo(x, 30);
        g.stroke();
      }
      // olho
      g.globalAlpha = 0.9;
      g.fillStyle = "#3A2C1C";
      g.beginPath();
      g.arc(175, -16, 6, 0, 7);
      g.arc(175, 16, 6, 0, 7);
      g.fill();
      // traço a pena
      g.globalAlpha = 0.6;
      g.strokeStyle = "#3A2A18";
      g.lineWidth = 2;
      g.beginPath();
      g.ellipse(20, 0, 110, 38, 0, 0, 7);
      g.stroke();
      g.restore();
      g.globalAlpha = 1;
      // legenda antiga
      g.fillStyle = "rgba(60,40,20,0.85)";
      g.font = "italic 44px Georgia, serif";
      g.textAlign = "center";
      g.fillText("Lagartixa", W / 2, H - 70);
      g.font = "italic 26px Georgia, serif";
      g.fillText("Brasilia · ex Africa", W / 2, H - 34);
      // borda manchada
      g.strokeStyle = "rgba(120,90,50,0.5)";
      g.lineWidth = 10;
      g.strokeRect(14, 14, W - 28, H - 28);
    },
    true,
    false,
  );

// ---------- insetos ----------
const asaTex = () =>
  texCanvas("varAsa2", 128, 128, (g, W, H) => {
    // asa de mariposa marrom-acinzentada escura (contrasta com a parede clara): faixa clara em zigue-zague e mancha-olho
    g.clearRect(0, 0, W, H);
    const forma = () => {
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(W, H * 0.22);
      g.quadraticCurveTo(W * 0.98, H * 0.9, W * 0.22, H);
      g.closePath();
    };
    const gr = g.createLinearGradient(0, 0, W, H);
    gr.addColorStop(0, "#6B5845");
    gr.addColorStop(1, "#3E3127");
    g.fillStyle = gr;
    forma();
    g.fill();
    g.save();
    forma();
    g.clip();
    g.strokeStyle = "#B9A27E";
    g.lineWidth = 7;
    g.beginPath();
    for (let k = 0; k <= 6; k++) g.lineTo(W * (0.15 + k * 0.13), H * (0.55 + (k % 2 ? 0.08 : -0.06)));
    g.stroke();
    g.fillStyle = "#D8C49C";
    g.beginPath();
    g.arc(W * 0.58, H * 0.36, 9, 0, 7);
    g.fill();
    g.fillStyle = "#2A211A";
    g.beginPath();
    g.arc(W * 0.58, H * 0.36, 4.5, 0, 7);
    g.fill();
    g.restore();
    g.strokeStyle = "#2A211A";
    g.lineWidth = 3;
    forma();
    g.stroke();
  }, true, false);
let ASA: THREE.BufferGeometry | null = null;
const asaGeo = () => {
  if (ASA) return ASA;
  const g = new THREE.PlaneGeometry(1, 1);
  g.translate(0.5, -0.5, 0); // pivô na raiz da asa (canto)
  ASA = g;
  return g;
};
// Mariposa (envergadura ~3 cm = 0,06 un). bater: fase das asas. Bate ≤ 4 Hz (regra anti-tremida).
export const Mariposa: React.FC<{ t: number; position?: V3; rotation?: V3; escala?: number; bater?: number; pousada?: boolean }> = ({ t, position, rotation, escala = 1, bater, pousada }) => {
  const m = useMemo(() => new THREE.MeshStandardMaterial({ map: asaTex(), transparent: true, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.9, emissive: new THREE.Color("#FFFFFF"), emissiveMap: asaTex(), emissiveIntensity: 0.7 }), []); // emissiva com a própria textura: as duas faces têm a mesma cor
  const corpo = useMemo(() => new THREE.MeshStandardMaterial({ map: peloTex(), color: "#7A6450", roughness: 1, emissive: new THREE.Color("#5A4636"), emissiveIntensity: 0.5 }), []);
  const ant = useMemo(() => new THREE.MeshStandardMaterial({ color: "#3A2E25", roughness: 0.8, emissive: new THREE.Color("#3A2E25"), emissiveIntensity: 0.4 }), []);
  const a = pousada ? 1.35 : 0.5 + 0.55 * (0.5 + 0.5 * Math.sin((bater ?? t * 2.4) * Math.PI * 2));
  const s = 0.03 * escala;
  return (
    <group position={position} rotation={rotation} scale={s}>
      {/* corpo peludo: cabeça, tórax e abdômen ao longo do eixo z (frente = +z) */}
      <mesh material={corpo} position={[0, 0, 0.36]} scale={0.1}>
        <sphereGeometry args={[1, 10, 8]} />
      </mesh>
      <mesh material={corpo} position={[0, 0, 0.12]} scale={[0.15, 0.14, 0.2]}>
        <sphereGeometry args={[1, 12, 10]} />
      </mesh>
      <mesh material={corpo} position={[0, -0.01, -0.38]} scale={[0.11, 0.1, 0.34]}>
        <sphereGeometry args={[1, 12, 10]} />
      </mesh>
      {/* antenas */}
      {[1, -1].map((sg) => (
        <mesh key={`a${sg}`} material={ant} position={[sg * 0.09, 0.04, 0.6]} rotation={[Math.PI / 2 - 0.2, 0, sg * 0.45]}>
          <cylinderGeometry args={[0.012, 0.02, 0.5, 5]} />
        </mesh>
      ))}
      {/* asas: anterior e posterior, varridas para trás a partir do tórax */}
      {[1, -1].map((sg) => (
        <group key={sg} scale={[sg, 1, 1]}>
          <group position={[0.08, 0.02, 0.22]} rotation={[0, 0, a]}>
            <mesh geometry={asaGeo()} material={m} rotation={[Math.PI / 2, 0, 0.35]} scale={[1.05, 0.85, 1]} />
            <mesh geometry={asaGeo()} material={m} rotation={[Math.PI / 2, 0, 1.0]} scale={[0.7, 0.62, 1]} position={[0, -0.003, -0.12]} />
          </group>
        </group>
      ))}
    </group>
  );
};
const peloTex = () =>
  texCanvas("varPeloMariposa", 64, 64, (g, W, H) => {
    g.fillStyle = "#7A6450";
    g.fillRect(0, 0, W, H);
    for (let i = 0; i < 400; i++) {
      g.fillStyle = rnd(i, 1) > 0.5 ? "rgba(200,170,130,0.35)" : "rgba(40,30,20,0.35)";
      g.fillRect(rnd(i, 2) * W, rnd(i, 3) * H, 1.5, 3);
    }
  });
export const Mosca: React.FC<{ t: number; position?: V3; rotation?: V3; escala?: number }> = ({ t, position, rotation, escala = 1 }) => {
  const corpo = useMemo(() => new THREE.MeshStandardMaterial({ color: "#22242A", roughness: 0.4, metalness: 0.2 }), []);
  const asa = useMemo(() => new THREE.MeshStandardMaterial({ color: "#C8D8E8", transparent: true, opacity: 0.35, roughness: 0.2, side: THREE.DoubleSide, depthWrite: false }), []);
  const olho = useMemo(() => new THREE.MeshStandardMaterial({ color: "#7A1E14", roughness: 0.3 }), []);
  const a = 0.2 + 0.15 * Math.sin(t * 3.5 * Math.PI * 2);
  return (
    <group position={position} rotation={rotation} scale={0.016 * escala}>
      <mesh material={corpo} scale={[0.32, 0.3, 0.6]}>
        <sphereGeometry args={[1, 10, 8]} />
      </mesh>
      <mesh material={olho} position={[0, 0.05, 0.55]} scale={[0.3, 0.25, 0.22]}>
        <sphereGeometry args={[1, 10, 8]} />
      </mesh>
      {[1, -1].map((sg) => (
        <mesh key={sg} material={asa} position={[sg * 0.2, 0.3, -0.2]} rotation={[-Math.PI / 2 + 0.1, 0, sg * a]} scale={[0.35, 0.8, 1]}>
          <circleGeometry args={[1, 12]} />
        </mesh>
      ))}
    </group>
  );
};
// Órbitas suaves em volta da lâmpada (< 0,5 Hz), sem atravessar a parede.
export const orbitaInseto = (t: number, i: number, raio = 0.5): V3 => {
  const L = VAR.lampada;
  const w = 0.28 + rnd(i, 1) * 0.25;
  const a = t * w * Math.PI * 2 + rnd(i, 2) * 6.28;
  const r = raio * (0.5 + rnd(i, 3) * 0.6) * (1 + 0.15 * Math.sin(t * 0.7 + i));
  // z preso entre 0,12 e 0,34: os insetos ficam colados na parede/lâmpada e nunca passam perto da lente
  return [L[0] + Math.cos(a) * r, L[1] + Math.sin(a * 1.3 + i) * r * 0.45 + (rnd(i, 4) - 0.5) * 0.2, Math.min(0.28, Math.max(0.1, L[2] + 0.04 + Math.sin(a) * r * 0.3))];
};
export const NuvemInsetos: React.FC<{ t: number; mariposas?: number; mosquitos?: number; sem?: number[] }> = ({ t, mariposas = 4, mosquitos = 0, sem = [] }) => {
  const mq = useMemo(() => new THREE.MeshBasicMaterial({ color: "#2A2620" }), []);
  return (
    <>
      {Array.from({ length: mariposas }).map((_, i) => {
        if (sem.includes(i)) return null;
        const p = orbitaInseto(t, i, 0.3);
        const p2 = orbitaInseto(t + 0.05, i, 0.3);
        const yaw = Math.atan2(p2[0] - p[0], p2[2] - p[2]);
        return <Mariposa key={i} t={t + i * 0.13} position={p} rotation={[0, yaw, 0]} escala={0.8 + rnd(i, 7) * 0.5} />;
      })}
      {Array.from({ length: mosquitos }).map((_, i) => {
        const p = orbitaInseto(t * 1.4, 20 + i, 0.35);
        return (
          <mesh key={`m${i}`} material={mq} position={p} scale={[0.004, 0.004, 0.009]}>
            <sphereGeometry args={[1, 6, 4]} />
          </mesh>
        );
      })}
    </>
  );
};

// ---------- peças ----------
const Arandela: React.FC<{ acesa: number }> = ({ acesa }) => {
  const louca = useMemo(() => new THREE.MeshStandardMaterial({ color: "#E8E2D4", roughness: 0.45, emissive: new THREE.Color("#FFD9A0"), emissiveIntensity: 0.12 }), []);
  const metal = useMemo(() => new THREE.MeshStandardMaterial({ color: "#B9B2A4", roughness: 0.4, metalness: 0.7 }), []);
  const bulbo = useMemo(() => new THREE.MeshStandardMaterial({ color: "#FFF6E0", emissive: new THREE.Color("#FFD9A0"), emissiveIntensity: 3, roughness: 0.2, toneMapped: false }), []);
  bulbo.emissiveIntensity = 0.2 + 3.3 * acesa;
  const [x, y] = VAR.arandela;
  return (
    <group position={[x, y, 0]}>
      {/* base de louça redonda na parede */}
      <mesh material={louca} position={[0, -0.02, 0.025]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.12, 0.13, 0.05, 28]} />
      </mesh>
      {/* bocal inclinado */}
      <mesh material={louca} position={[0, -0.02, 0.09]} rotation={[Math.PI / 2 - 0.35, 0, 0]}>
        <cylinderGeometry args={[0.055, 0.06, 0.1, 20]} />
      </mesh>
      <mesh material={metal} position={[0, -0.005, 0.13]} rotation={[Math.PI / 2 - 0.35, 0, 0]}>
        <cylinderGeometry args={[0.045, 0.045, 0.05, 18]} />
      </mesh>
      {/* lâmpada bulbo (a luz real vem do pointLight da Varanda) */}
      {/* bulbo em pera (A60): esfera + pescoço afinando até o bocal — não vira "carinha" */}
      <group position={[0, -0.005, 0.15]} rotation={[Math.PI / 2 - 0.35, 0, 0]}>
        <mesh material={bulbo} position={[0, 0.075, 0]} scale={[0.058, 0.064, 0.058]}>
          <sphereGeometry args={[1, 24, 18]} />
        </mesh>
        <mesh material={bulbo} position={[0, 0.02, 0]}>
          <cylinderGeometry args={[0.03, 0.05, 0.05, 20]} />
        </mesh>
      </group>
      {/* fio até o forro */}
      <mesh material={louca} position={[0, (VAR.teto - y) / 2 + 0.05, 0.012]}>
        <boxGeometry args={[0.025, VAR.teto - y - 0.1, 0.016]} />
      </mesh>
    </group>
  );
};
const Banco: React.FC = () => {
  const m = useMemo(() => {
    const map = madeira("#6E4E36", "banco").clone();
    map.needsUpdate = true;
    map.repeat.set(3, 0.6);
    return new THREE.MeshStandardMaterial({ map, roughness: 0.7 });
  }, []);
  const b = VAR.banco;
  const w = b.x1 - b.x0, d = b.z1 - b.z0;
  return (
    <group>
      <mesh material={m} position={[(b.x0 + b.x1) / 2, b.y - 0.045, (b.z0 + b.z1) / 2]} castShadow receiveShadow>
        <boxGeometry args={[w, 0.09, d]} />
      </mesh>
      {[b.x0 + 0.15, b.x1 - 0.15].map((x) =>
        [b.z0 + 0.1, b.z1 - 0.1].map((z) => (
          <mesh key={`${x}${z}`} material={m} position={[x, (b.y - 0.09) / 2, z]} castShadow receiveShadow>
            <boxGeometry args={[0.1, b.y - 0.09, 0.1]} />
          </mesh>
        )),
      )}
      <mesh material={m} position={[(b.x0 + b.x1) / 2, 0.3, (b.z0 + b.z1) / 2]} castShadow>
        <boxGeometry args={[w - 0.3, 0.06, 0.06]} />
      </mesh>
    </group>
  );
};
const Porta: React.FC<{ abrir: number; luzDentro: number }> = ({ abrir, luzDentro }) => {
  const m = useMemo(() => new THREE.MeshStandardMaterial({ map: madeira("#6E4528", "porta"), roughness: 0.6 }), []);
  const bat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#EFE8DA", roughness: 0.6 }), []);
  const mac = useMemo(() => new THREE.MeshStandardMaterial({ color: "#D8C08A", roughness: 0.3, metalness: 0.8 }), []);
  const dentro = useMemo(() => new THREE.MeshBasicMaterial({ color: "#FFD9A8", toneMapped: false }), []);
  dentro.color.set("#FFD9A8").multiplyScalar(0.25 + 0.75 * luzDentro);
  const P = VAR.porta;
  const w = P.x1 - P.x0;
  return (
    <group>
      {/* vão (interior iluminado, recuado) */}
      <mesh material={dentro} position={[(P.x0 + P.x1) / 2, P.y1 / 2, -0.3]}>
        <planeGeometry args={[w, P.y1]} />
      </mesh>
      {/* batente */}
      {[P.x0 - 0.06, P.x1 + 0.06].map((x) => (
        <mesh key={x} material={bat} position={[x, P.y1 / 2, 0.02]} castShadow>
          <boxGeometry args={[0.12, P.y1, 0.06]} />
        </mesh>
      ))}
      <mesh material={bat} position={[(P.x0 + P.x1) / 2, P.y1 + 0.06, 0.02]}>
        <boxGeometry args={[w + 0.24, 0.12, 0.06]} />
      </mesh>
      {/* folha (dobradiça no x0, abre para dentro) */}
      <group position={[P.x0, 0, -0.02]} rotation={[0, abrir * 1.7, 0]}>
        <mesh material={m} position={[w / 2, P.y1 / 2, -0.04]} castShadow receiveShadow>
          <boxGeometry args={[w - 0.02, P.y1 - 0.02, 0.07]} />
        </mesh>
        {/* almofadas */}
        {[1.1, 3.0].map((y) => (
          <mesh key={y} material={m} position={[w / 2, y, 0.0]} castShadow>
            <boxGeometry args={[w - 0.5, y > 2 ? 1.6 : 1.2, 0.02]} />
          </mesh>
        ))}
        <mesh material={mac} position={[w - 0.18, 2.05, 0.04]}>
          <sphereGeometry args={[0.045, 16, 12]} />
        </mesh>
      </group>
    </group>
  );
};
const Quadro: React.FC = () => {
  const pin = useMemo(() => new THREE.MeshStandardMaterial({ map: aquarelaTex(), roughness: 0.85 }), []);
  const mold = useMemo(() => new THREE.MeshStandardMaterial({ color: "#3B2414", roughness: 0.5 }), []);
  const ouro = useMemo(() => new THREE.MeshStandardMaterial({ color: "#B08A3E", roughness: 0.35, metalness: 0.8 }), []);
  const vidro = useMemo(() => new THREE.MeshPhysicalMaterial({ color: "#FFFFFF", roughness: 0.05, transparent: true, opacity: 0.08, depthWrite: false }), []);
  const { c, w, h } = VAR.quadro;
  const f = 0.055;
  return (
    <group position={[c[0], c[1], 0]} rotation={[0.03, 0, 0]}>
      <mesh material={pin} position={[0, 0, 0.022]}>
        <planeGeometry args={[w, h]} />
      </mesh>
      <mesh material={vidro} position={[0, 0, 0.034]}>
        <planeGeometry args={[w, h]} />
      </mesh>
      {[
        [0, h / 2 + f / 2, w + 2 * f, f],
        [0, -h / 2 - f / 2, w + 2 * f, f],
        [w / 2 + f / 2, 0, f, h],
        [-w / 2 - f / 2, 0, f, h],
      ].map(([x, y, ww, hh], i) => (
        <mesh key={i} material={mold} position={[x, y, 0.03]} castShadow>
          <boxGeometry args={[ww, hh, 0.05]} />
        </mesh>
      ))}
      {/* filete dourado */}
      {[
        [0, h / 2 + 0.006, w + 0.012, 0.012],
        [0, -h / 2 - 0.006, w + 0.012, 0.012],
        [w / 2 + 0.006, 0, 0.012, h],
        [-w / 2 - 0.006, 0, 0.012, h],
      ].map(([x, y, ww, hh], i) => (
        <mesh key={`o${i}`} material={ouro} position={[x, y, 0.04]}>
          <boxGeometry args={[ww, hh, 0.012]} />
        </mesh>
      ))}
      {/* prego e cordão */}
      <mesh material={ouro} position={[0, h / 2 + 0.35, 0.01]}>
        <sphereGeometry args={[0.012, 8, 6]} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} material={mold} position={[s * w * 0.18, h / 2 + 0.18, 0.012]} rotation={[0, 0, s * 0.95]}>
          <boxGeometry args={[0.008, 0.42, 0.006]} />
        </mesh>
      ))}
    </group>
  );
};
// Vassoura: sem props fica encostada na parede; com position/rotation vira objeto solto (o humano segura pelo cabo; origem = base das cerdas).
export const Vassoura: React.FC<{ position?: V3; rotation?: V3 }> = ({ position, rotation }) => {
  const cabo = useMemo(() => new THREE.MeshStandardMaterial({ color: "#C9A56E", roughness: 0.6 }), []);
  const bloco = useMemo(() => new THREE.MeshStandardMaterial({ color: "#C8322A", roughness: 0.45 }), []);
  const cerda = useMemo(() => new THREE.MeshStandardMaterial({ color: "#2B2B2E", roughness: 0.8 }), []);
  const [x, , z] = VAR.vassoura;
  const inc = 0.22;
  return (
    <group position={position ?? [x, 0, z + 0.32]} rotation={rotation ?? [-inc, 0, 0.05]}>
      <mesh material={cerda} position={[0, 0.1, 0]} castShadow>
        <boxGeometry args={[0.6, 0.2, 0.12]} />
      </mesh>
      <mesh material={bloco} position={[0, 0.25, 0]} castShadow>
        <boxGeometry args={[0.62, 0.1, 0.13]} />
      </mesh>
      <mesh material={cabo} position={[0, 0.3 + 1.2, 0]} castShadow>
        <cylinderGeometry args={[0.022, 0.022, 2.4, 12]} />
      </mesh>
    </group>
  );
};
const Fresta: React.FC = () => {
  // rachado escuro no reboco + uma fenda funda (onde ela se enfia)
  const esc = useMemo(() => new THREE.MeshBasicMaterial({ color: "#14100C" }), []);
  const borda = useMemo(() => new THREE.MeshStandardMaterial({ color: "#C9B992", roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), []);
  const { c, w, h } = VAR.fresta;
  const forma = useMemo(() => {
    const s = new THREE.Shape();
    const n = 14;
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      const x = (u - 0.5) * w;
      const y = h * 0.5 * Math.sin(u * Math.PI) * (0.7 + 0.3 * rnd(i, 4));
      if (i === 0) s.moveTo(x, y);
      else s.lineTo(x, y);
    }
    for (let i = n; i >= 0; i--) {
      const u = i / n;
      s.lineTo((u - 0.5) * w, -h * 0.5 * Math.sin(u * Math.PI) * (0.6 + 0.3 * rnd(i, 5)));
    }
    return new THREE.ShapeGeometry(s);
  }, [w, h]);
  return (
    <group position={[c[0], c[1], 0.003]} rotation={[0, 0, 0.12]}>
      <mesh geometry={forma} material={borda} scale={[1.25, 1.9, 1]} position={[0, 0, 0.0]} />
      <mesh geometry={forma} material={esc} position={[0, 0, 0.004]} />
    </group>
  );
};

export type VarandaProps = {
  t: number;
  lampada?: number; // 0..1 (passagem de tempo)
  dia?: number; // 0 noite … 1 dia (céu do quintal)
  porta?: number; // 0 fechada … 1 aberta
  insetos?: boolean;
  semMariposas?: number[];
  sombras?: boolean;
  semVassoura?: boolean;
  luzK?: number; // multiplica só a luz da lâmpada (planos colados na lâmpada: ~0,25), o bulbo continua aceso
};
export const Varanda: React.FC<VarandaProps> = ({ t, lampada = 1, dia = 0, porta = 0, insetos = true, semMariposas = [], sombras = true, semVassoura, luzK = 1 }) => {
  const parede = useMemo(() => {
    const map = reboco().clone();
    map.needsUpdate = true;
    map.repeat.set(1.6, 1.4);
    const bump = rebocoBump().clone();
    bump.needsUpdate = true;
    bump.repeat.set(26, 22);
    return new THREE.MeshStandardMaterial({ map, bumpMap: bump, bumpScale: 0.6, roughness: 0.93 });
  }, []);
  const forro = useMemo(() => {
    const map = pvc().clone();
    map.needsUpdate = true;
    map.repeat.set(1, 4.2 / 0.4);
    map.rotation = 0;
    const bump = map.clone();
    bump.needsUpdate = true;
    return new THREE.MeshStandardMaterial({ map, bumpMap: bump, bumpScale: 2.5, roughness: 0.45, color: "#E9E6DE" });
  }, []);
  const chao = useMemo(() => {
    const map = lajota().clone();
    map.needsUpdate = true;
    map.repeat.set(7.2 / 1.2, 4.4 / 1.2);
    return new THREE.MeshStandardMaterial({ map, roughness: 0.5, metalness: 0.0 });
  }, []);
  const branco = useMemo(() => new THREE.MeshStandardMaterial({ color: "#EFEDE6", roughness: 0.5 }), []);
  const rodape = useMemo(() => new THREE.MeshStandardMaterial({ color: "#7D3A28", roughness: 0.5 }), []);
  const mureta = useMemo(() => new THREE.MeshStandardMaterial({ color: "#E4D6B8", roughness: 0.9 }), []);
  const ceu = useMemo(() => new THREE.MeshBasicMaterial({ color: "#0E1630" }), []);
  ceu.color.set("#0E1630").lerp(new THREE.Color("#8FC4EA"), clamp01(dia));
  const planta = useMemo(() => new THREE.MeshStandardMaterial({ color: "#16251A", roughness: 1 }), []);
  const acesa = clamp01(lampada);
  const L = VAR.lampada;
  return (
    <group>
      {/* luz da lâmpada (a única luz forte; sombra estável, sem ligar/desligar) */}
      <pointLight position={[L[0], L[1] - 0.02, L[2] + 0.1]} intensity={5.5 * acesa * luzK} distance={0} decay={0} /* luz uniforme: a parede tem a mesma cor em todos os cortes */ color="#FFC27A" castShadow={sombras} shadow-mapSize={[2048, 2048]} shadow-bias={-0.0006} shadow-normalBias={0.006} shadow-camera-near={0.03} shadow-camera-far={14} />
      {/* rebatimento quente vindo da frente (luz de dentro da casa/rebote no chão) */}
      <pointLight position={[0.8, 2.0, 3.2]} intensity={2.4 * (0.4 + 0.6 * acesa)} distance={0} decay={2} color="#D8DEFF" />
      {/* luar + rebatimento suave */}
      <hemisphereLight args={[new THREE.Color("#5B6E9E").lerp(new THREE.Color("#CFE3FF"), dia), new THREE.Color("#2A1E16"), 0.7 + 1.2 * dia]} />
      <directionalLight position={[2, 3, 8]} intensity={0.25 + 1.5 * dia} color="#9DB4FF" />
      {/* parede do fundo */}
      <mesh material={parede} position={[0.2, VAR.teto / 2, 0]} receiveShadow>
        <planeGeometry args={[7.2, VAR.teto]} />
      </mesh>
      {/* rodapé */}
      <mesh material={rodape} position={[0.2, 0.08, 0.012]} receiveShadow>
        <boxGeometry args={[7.2, 0.16, 0.024]} />
      </mesh>
      {/* forro de PVC + moldura de acabamento na quina */}
      <mesh material={forro} position={[0.2, VAR.teto, 2.1]} rotation={[Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[7.2, 4.2]} />
      </mesh>
      <mesh material={branco} position={[0.2, VAR.teto - 0.035, 0.035]}>
        <boxGeometry args={[7.2, 0.07, 0.07]} />
      </mesh>
      {/* chão de lajota */}
      <mesh material={chao} position={[0.2, 0, 2.2]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[7.2, 4.4]} />
      </mesh>
      {/* mureta + pilares da frente, quintal escuro */}
      <mesh material={mureta} position={[0.2, 0.45, 4.3]} receiveShadow castShadow>
        <boxGeometry args={[7.2, 0.9, 0.25]} />
      </mesh>
      {[-3.3, 3.7].map((x) => (
        <mesh key={x} material={mureta} position={[x, VAR.teto / 2, 4.3]} castShadow>
          <boxGeometry args={[0.35, VAR.teto, 0.35]} />
        </mesh>
      ))}
      <mesh material={ceu} position={[0, 4, 14]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[60, 30]} />
      </mesh>
      {[...Array(9)].map((_, i) => (
        <mesh key={i} material={planta} position={[-4 + i * 1.1, 0.6 + rnd(i, 2) * 0.8, 7 + rnd(i, 3) * 2]} scale={[0.8 + rnd(i, 4), 1 + rnd(i, 5) * 1.4, 0.8]}>
          <sphereGeometry args={[1, 10, 8]} />
        </mesh>
      ))}
      {/* paredes laterais (fecham a varanda à esquerda) */}
      <mesh material={parede} position={[-3.4, VAR.teto / 2, 2.1]} rotation={[0, Math.PI / 2, 0]} receiveShadow>
        <planeGeometry args={[4.2, VAR.teto]} />
      </mesh>
      <Arandela acesa={acesa} />
      <Banco />
      <Porta abrir={porta} luzDentro={0.5} />
      <Quadro />
      {!semVassoura ? <Vassoura /> : null}
      <Fresta />
      {/* tomada na parede, atrás do banco (dá escala e "mundo" aos closes do rabo no banco) */}
      <group position={[0.82, 1.2, 0.006]}>
        <mesh material={branco}>
          <boxGeometry args={[0.09, 0.13, 0.012]} />
        </mesh>
        {[-0.016, 0.016].map((x) => (
          <mesh key={x} position={[x, 0, 0.007]}>
            <circleGeometry args={[0.007, 12]} />
            <meshBasicMaterial color="#2A2A2A" />
          </mesh>
        ))}
      </group>
      {/* halo de luz na parede em volta da lâmpada (falso bloom, estático) */}
      <mesh position={[L[0], L[1], 0.006]} renderOrder={2}>
        <circleGeometry args={[0.45, 40]} />
        <meshBasicMaterial color="#FFB866" transparent opacity={0.025 * acesa} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </mesh>
      <mesh position={[L[0], L[1], L[2] + 0.02]} renderOrder={3}>
        <sphereGeometry args={[0.22, 20, 14]} />
        <meshBasicMaterial color="#FFCF8A" transparent opacity={0.04 * acesa} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </mesh>
      {insetos ? <NuvemInsetos t={t} sem={semMariposas} /> : null}
    </group>
  );
};
void mix;
void sm;
