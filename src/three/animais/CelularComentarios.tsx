import { RoundedBox } from "@react-three/drei";
import { useLayoutEffect, useMemo } from "react";
import * as THREE from "three";
import { clamp01, useEnv, V3 } from "./comum";
import { FONT_KIT } from "./ui";

// =====================================================================
// CELULAR com o vídeo do bicho e comentários "é IA" subindo.
// Tela desenhada em canvas (fiel a um app de vídeo curto). Tamanho ≈ 1,5 × 3,2 un.
// abrir: painel de comentários sobe (0..1). mostrar: quantos comentários já apareceram (fracionário).
// =====================================================================
export const COMENTARIOS_PADRAO: { u: string; txt: string; likes: string; cor: string }[] = [
  { u: "lucas.tavares", txt: "isso é IA kkkkk", likes: "8.412", cor: "#F28B54" },
  { u: "bia_moraes", txt: "é IA, bicho não existe", likes: "5.930", cor: "#7FB3F5" },
  { u: "rafa.gamer07", txt: "pato com corpo de castor? IA", likes: "3.208", cor: "#9ED36A" },
  { u: "dona.cida", txt: "meu Deus que bicho é esse", likes: "2.771", cor: "#E58AC8" },
  { u: "prof.joao.bio", txt: "existe sim, é da Austrália", likes: "1.904", cor: "#F2C94C" },
  { u: "mari.souza", txt: "jurava que era montagem", likes: "1.122", cor: "#B79CF2" },
];

const W = 540, H = 1170;
const heart = (g: CanvasRenderingContext2D, x: number, y: number, r: number) => {
  g.beginPath();
  g.moveTo(x, y + r * 0.9);
  g.bezierCurveTo(x - r * 1.4, y - r * 0.1, x - r * 0.7, y - r * 1.2, x, y - r * 0.45);
  g.bezierCurveTo(x + r * 0.7, y - r * 1.2, x + r * 1.4, y - r * 0.1, x, y + r * 0.9);
  g.fill();
};
const drawScreen = (g: CanvasRenderingContext2D, t: number, abrir: number, mostrar: number, lista: typeof COMENTARIOS_PADRAO, total: string) => {
  // vídeo (fundo): céu, mata, rio e o ornitorrinco nadando
  const sky = g.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, "#7CC6EE");
  sky.addColorStop(0.45, "#CFEAF2");
  sky.addColorStop(0.46, "#6FAE52");
  sky.addColorStop(0.62, "#5E9A47");
  sky.addColorStop(0.63, "#4FA7B8");
  sky.addColorStop(1, "#2E7F92");
  g.fillStyle = sky;
  g.fillRect(0, 0, W, H);
  for (let i = 0; i < 9; i++) {
    const x = (i * 71 + 20) % W;
    g.fillStyle = i % 2 ? "#4E8F3E" : "#5FA243";
    g.beginPath();
    g.ellipse(x, 470 + (i % 3) * 14, 46, 70, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#E3DDD0";
    g.fillRect(x - 5, 480, 10, 70);
  }
  const bx = 270 + Math.sin(t * 0.8) * 40, by = 820 + Math.sin(t * 2) * 6;
  g.fillStyle = "rgba(255,255,255,0.35)";
  for (let k = 0; k < 4; k++) {
    g.beginPath();
    g.ellipse(bx - 40 - k * 40, by + 34, 30 - k * 4, 5, 0, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = "#6A3E22";
  g.beginPath();
  g.ellipse(bx - 120, by + 10, 60, 22, 0.1, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#8A5230";
  g.beginPath();
  g.ellipse(bx - 10, by, 110, 52, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#E3B783";
  g.beginPath();
  g.ellipse(bx - 10, by + 30, 90, 20, 0, 0, Math.PI);
  g.fill();
  g.fillStyle = "#26282C";
  g.beginPath();
  g.roundRect(bx + 80, by - 12, 120, 34, 17);
  g.fill();
  g.fillStyle = "#050505";
  g.beginPath();
  g.arc(bx + 62, by - 22, 13, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#FFFFFF";
  g.beginPath();
  g.arc(bx + 66, by - 27, 4, 0, Math.PI * 2);
  g.fill();
  // barra de progresso + ícones laterais
  g.fillStyle = "rgba(255,255,255,0.35)";
  g.fillRect(0, H - 6, W, 6);
  g.fillStyle = "#FFFFFF";
  g.fillRect(0, H - 6, W * ((t * 0.07) % 1), 6);
  [0, 1, 2].forEach((i) => {
    const cy = 560 + i * 92;
    g.fillStyle = "rgba(0,0,0,0.25)";
    g.beginPath();
    g.arc(W - 46, cy, 30, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#FFFFFF";
    if (i === 0) heart(g, W - 46, cy, 15);
    else if (i === 1) {
      g.beginPath();
      g.ellipse(W - 46, cy - 2, 16, 13, 0, 0, Math.PI * 2);
      g.moveTo(W - 56, cy + 6);
      g.lineTo(W - 62, cy + 17);
      g.lineTo(W - 46, cy + 10);
      g.fill();
    } else {
      g.beginPath();
      g.moveTo(W - 60, cy + 12);
      g.lineTo(W - 32, cy);
      g.lineTo(W - 60, cy - 12);
      g.lineTo(W - 54, cy);
      g.fill();
    }
  });
  g.textAlign = "left";
  g.fillStyle = "#FFFFFF";
  g.font = `800 26px ${FONT_KIT}`;
  g.fillText("@essetreco3d", 24, 1040);
  g.font = `700 22px ${FONT_KIT}`;
  g.fillText("Você é um ornitorrinco", 24, 1074);
  // barra de status
  g.font = `800 22px ${FONT_KIT}`;
  g.fillText("9:41", 34, 42);
  g.fillRect(W - 70, 24, 40, 18);
  // painel de comentários
  const a = clamp01(abrir);
  if (a > 0) {
    const top = H - (H * 0.66) * (1 - Math.pow(1 - a, 3));
    g.fillStyle = "rgba(0,0,0,0.25)";
    g.fillRect(0, 0, W, H);
    g.fillStyle = "#FFFFFF";
    g.beginPath();
    g.roundRect(0, top, W, H - top + 30, 26);
    g.fill();
    g.fillStyle = "#D3D3D3";
    g.beginPath();
    g.roundRect(W / 2 - 30, top + 12, 60, 7, 4);
    g.fill();
    g.fillStyle = "#16181D";
    g.font = `800 24px ${FONT_KIT}`;
    g.textAlign = "center";
    g.fillText(total ? `${total} comentários` : "Comentários", W / 2, top + 56); // sem número inventado por padrão
    g.textAlign = "left";
    lista.forEach((c, i) => {
      const k = clamp01(mostrar - i);
      if (k <= 0) return;
      const y = top + 100 + i * 112 + (1 - k) * 30;
      g.globalAlpha = k;
      g.fillStyle = c.cor;
      g.beginPath();
      g.arc(52, y + 26, 26, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "#FFFFFF";
      g.font = `900 24px ${FONT_KIT}`;
      g.textAlign = "center";
      g.fillText(c.u[0].toUpperCase(), 52, y + 35);
      g.textAlign = "left";
      g.fillStyle = "#8A8D93";
      g.font = `700 19px ${FONT_KIT}`;
      g.fillText(c.u, 94, y + 14);
      g.fillStyle = "#16181D";
      g.font = `800 25px ${FONT_KIT}`;
      g.fillText(c.txt, 94, y + 48);
      g.fillStyle = "#9A9DA3";
      g.font = `700 17px ${FONT_KIT}`;
      g.fillText("Responder", 94, y + 78);
      g.fillStyle = i < 3 ? "#FF3B5C" : "#B0B3B8";
      heart(g, W - 44, y + 22, 12);
      g.textAlign = "center";
      g.fillStyle = "#8A8D93";
      g.font = `700 16px ${FONT_KIT}`;
      g.fillText(c.likes, W - 44, y + 56);
      g.textAlign = "left";
      g.globalAlpha = 1;
    });
  }
};

export const CelularComentarios: React.FC<{
  t: number;
  abrir?: number;
  mostrar?: number;
  comentarios?: typeof COMENTARIOS_PADRAO;
  total?: string;
  position?: V3;
  rotation?: V3;
  scale?: number;
}> = ({ t, abrir = 1, mostrar = 6, comentarios = COMENTARIOS_PADRAO, total = "", position, rotation, scale = 1 }) => {
  const env = useEnv();
  const { tex, canvas } = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    const tx = new THREE.CanvasTexture(c);
    tx.colorSpace = THREE.SRGBColorSpace;
    tx.anisotropy = 8;
    return { tex: tx, canvas: c };
  }, []);
  useLayoutEffect(() => {
    drawScreen(canvas.getContext("2d")!, t, abrir, mostrar, comentarios, total);
    tex.needsUpdate = true;
  }, [t, abrir, mostrar, comentarios, total, canvas, tex]);
  const M = useMemo(
    () => ({
      body: new THREE.MeshStandardMaterial({ color: "#2B2D33", metalness: 0.6, roughness: 0.3, envMap: env }),
      rim: new THREE.MeshStandardMaterial({ color: "#B9BEC6", metalness: 0.95, roughness: 0.2, envMap: env }),
      screen: new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }),
      glass: new THREE.MeshPhysicalMaterial({ color: "#FFFFFF", roughness: 0.03, transparent: true, opacity: 0.08, envMap: env, envMapIntensity: 1.6, depthWrite: false }),
      lens: new THREE.MeshStandardMaterial({ color: "#0A0A0C", roughness: 0.05, envMap: env }),
    }),
    [env, tex],
  );
  return (
    <group position={position} rotation={rotation} scale={scale}>
      <RoundedBox args={[1.52, 3.22, 0.16]} radius={0.17} smoothness={4} material={M.rim} castShadow />
      <RoundedBox args={[1.46, 3.16, 0.17]} radius={0.15} smoothness={4} material={M.body} />
      <mesh material={M.screen} position={[0, 0, 0.0865]}>
        <planeGeometry args={[1.38, 2.99]} />
      </mesh>
      <mesh material={M.glass} position={[0, 0, 0.089]} renderOrder={8}>
        <planeGeometry args={[1.42, 3.08]} />
      </mesh>
      <mesh material={M.lens} position={[0, 1.38, 0.09]}>
        <circleGeometry args={[0.035, 16]} />
      </mesh>
      {[0.6, 0.25].map((y) => (
        <mesh key={y} material={M.rim} position={[0.77, y, 0]}>
          <boxGeometry args={[0.03, 0.26, 0.06]} />
        </mesh>
      ))}
    </group>
  );
};
