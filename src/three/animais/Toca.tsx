import { useMemo } from "react";
import * as THREE from "three";
import { rnd, SkyDome, WaterSurface } from "../World";
import { eucalyptusGeo, groundFernGeo, Inst, reedGeo, spread, tuftGeo, vcMat, plainMat } from "./vegetacao";
import { V3 } from "./comum";

// =====================================================================
// TOCA — corte do barranco (diorama). A face do corte fica em z = 0, virada para +z (câmera em z > 0).
// Rio à esquerda (x < -4,6), barranco com grama em cima (y = 1,6), túnel subindo da beira d'água
// até a câmara de ninho (TOCA_CAMARA), forrada de folhas. Camadas de solo pintadas na face.
// =====================================================================
const TOP = 1.6, BOT = -2.2, X0 = -4.8, X1 = 6.5, DEPTH = 5;
const TUNNEL = [
  [-4.35, 0.18],
  [-3.4, 0.42],
  [-2.2, 0.7],
  [-0.9, 0.55],
  [0.4, 0.38],
  [1.6, 0.52],
  [2.6, 0.45],
] as const;
const CH = { x: 3.55, y: 0.48, rx: 1.05, ry: 0.56 };
const R = 0.24;
// centro do chão da câmara (onde o bicho deita) — use para posicionar a fêmea/ovos
export const TOCA_CAMARA: V3 = [CH.x, CH.y - CH.ry + 0.06, -0.22];
export const TOCA_ENTRADA: V3 = [TUNNEL[0][0], TUNNEL[0][1], -0.2];

const outline = () => {
  const s = new THREE.Shape();
  s.moveTo(X0 - 0.6, BOT);
  s.lineTo(X1, BOT);
  s.lineTo(X1, TOP);
  s.lineTo(-3.0, TOP);
  s.quadraticCurveTo(-4.1, TOP - 0.05, -4.55, 0.9);
  s.quadraticCurveTo(-4.8, 0.2, X0 - 0.6, -0.6);
  s.lineTo(X0 - 0.6, BOT);
  return s;
};
// buraco único: borda de cima do túnel → volta grande pela câmara → borda de baixo do túnel
const holePath = () => {
  const pts = TUNNEL.map(([x, y]) => new THREE.Vector2(x, y));
  const curve = new THREE.SplineCurve(pts);
  const N = 40;
  const top: THREE.Vector2[] = [], bot: THREE.Vector2[] = [];
  for (let i = 0; i <= N; i++) {
    const u = i / N;
    const p = curve.getPoint(u), d = curve.getTangent(u);
    const n = new THREE.Vector2(-d.y, d.x);
    top.push(p.clone().addScaledVector(n, R));
    bot.push(p.clone().addScaledVector(n, -R));
  }
  const h = new THREE.Path();
  h.moveTo(top[0].x, top[0].y);
  top.forEach((p) => h.lineTo(p.x, p.y));
  // câmara (elipse) de cima, dando a volta pela direita, até embaixo
  const a0 = Math.atan2((top[N].y - CH.y) / CH.ry, (top[N].x - CH.x) / CH.rx);
  const a1 = Math.atan2((bot[N].y - CH.y) / CH.ry, (bot[N].x - CH.x) / CH.rx) - Math.PI * 2;
  for (let i = 0; i <= 40; i++) {
    const a = a0 + ((a1 - a0) * i) / 40;
    h.lineTo(CH.x + Math.cos(a) * CH.rx * (1 + 0.04 * Math.sin(a * 5)), CH.y + Math.sin(a) * CH.ry);
  }
  for (let i = N; i >= 0; i--) h.lineTo(bot[i].x, bot[i].y);
  h.closePath();
  return h;
};

// textura das camadas do solo (cobre x ∈ [X0-0.6, X1], y ∈ [BOT, TOP])
const strataTex = () => {
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = 512;
  const g = c.getContext("2d")!;
  const H = 512;
  const bands = [
    [0, 0.06, "#5C7F35"],
    [0.06, 0.2, "#4A3324"],
    [0.2, 0.48, "#6E4A2E"],
    [0.48, 0.74, "#8A5E38"],
    [0.74, 1, "#A47A4E"],
  ] as const;
  for (const [a, b, col] of bands) {
    g.fillStyle = col;
    g.beginPath();
    g.moveTo(0, a * H);
    for (let x = 0; x <= 1024; x += 32) g.lineTo(x, a * H + Math.sin(x * 0.012 + a * 9) * 8);
    g.lineTo(1024, b * H + 10);
    g.lineTo(0, b * H + 10);
    g.fill();
  }
  // pedrinhas e grãos
  for (let i = 0; i < 1600; i++) {
    const x = rnd(i, 81) * 1024, y = (0.15 + rnd(i, 82) * 0.85) * H;
    const r = 1 + rnd(i, 83) * (y > H * 0.6 ? 7 : 3);
    const v = Math.floor(80 + rnd(i, 84) * 90);
    g.fillStyle = `rgba(${v + 40},${v + 20},${v},${0.45 + rnd(i, 85) * 0.4})`;
    g.beginPath();
    g.ellipse(x, y, r * 1.3, r, rnd(i, 86) * 3, 0, Math.PI * 2);
    g.fill();
  }
  // raízes
  g.strokeStyle = "rgba(205,170,120,0.55)";
  for (let i = 0; i < 60; i++) {
    let x = rnd(i, 87) * 1024, y = 0.05 * H;
    g.lineWidth = 1 + rnd(i, 88) * 2.5;
    g.beginPath();
    g.moveTo(x, y);
    const L = 8 + rnd(i, 89) * 14;
    for (let k = 0; k < L; k++) {
      x += (rnd(i * 31 + k, 90) - 0.5) * 22;
      y += 4 + rnd(i * 31 + k, 91) * 7;
      g.lineTo(x, y);
    }
    g.stroke();
  }
  const tx = new THREE.CanvasTexture(c);
  tx.colorSpace = THREE.SRGBColorSpace;
  tx.anisotropy = 4;
  return tx;
};

// tampões de terra compactada que a mãe põe no túnel (APC: "2-9 compacted soil plugs"), entre a entrada e o ninho
const PLUG_AT = [0.3, 2.15, 3.4, 4.6]; // o 1º tapa a boca do túnel // posições ao longo do túnel (índice fracionário em TUNNEL)
const tunnelAt = (f: number) => {
  const i = Math.min(TUNNEL.length - 2, Math.floor(f)), k = f - i;
  return [TUNNEL[i][0] + (TUNNEL[i + 1][0] - TUNNEL[i][0]) * k, TUNNEL[i][1] + (TUNNEL[i + 1][1] - TUNNEL[i][1]) * k] as const;
};
const PLUG_GEO = new THREE.CylinderGeometry(1, 1, 1, 14, 1);
PLUG_GEO.rotateX(Math.PI / 2);
const PLUG_MAT = new THREE.MeshStandardMaterial({ color: "#7A5434", roughness: 1, flatShading: true });
export const Toca: React.FC<{ t: number; fog?: [string, number, number]; tampoes?: number }> = ({ t, fog = ["#DDEFF3", 20, 140], tampoes = 0 }) => {
  const G = useMemo(() => {
    const W = X1 - (X0 - 0.6), Hh = TOP - BOT;
    const fixUV = (g: THREE.BufferGeometry) => {
      const p = g.attributes.position as THREE.BufferAttribute;
      const uv = new Float32Array(p.count * 2);
      for (let i = 0; i < p.count; i++) {
        uv[i * 2] = (p.getX(i) - (X0 - 0.6)) / W;
        uv[i * 2 + 1] = 1 - (TOP - p.getY(i)) / Hh;
      }
      g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
      return g;
    };
    const front = outline();
    front.holes.push(holePath());
    const slab = new THREE.ExtrudeGeometry(front, { depth: 0.42, bevelEnabled: false, curveSegments: 24 });
    slab.translate(0, 0, -0.42);
    const back = new THREE.ExtrudeGeometry(outline(), { depth: DEPTH, bevelEnabled: false, curveSegments: 24 });
    back.translate(0, 0, -0.42 - DEPTH);
    const tex = strataTex();
    const face = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 });
    const inner = new THREE.MeshStandardMaterial({ color: "#3B2819", roughness: 1 });
    const side = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95, color: "#B79A80" });
    return { slab: fixUV(slab), back: fixUV(back), face, inner, side };
  }, []);
  const sp = useMemo(() => {
    const onTop = (x: number) => x > -3.0 && x < X1 - 0.2;
    const h = () => TOP + 0.07; // em cima do tampo de grama
    return {
      tuft: spread(1300, 91, { x0: -3, x1: X1, z0: -DEPTH - 0.4, z1: -0.05 }, () => h(), (x) => onTop(x), 0.8, 1.6),
      fern: spread(16, 92, { x0: -2.5, x1: X1 - 0.5, z0: -DEPTH, z1: -0.6 }, () => TOP + 0.07, () => true, 0.8, 1.4),
      reed: spread(40, 93, { x0: -5.2, x1: -4.2, z0: -DEPTH, z1: -0.1 }, (x) => (x < -4.6 ? -0.1 : 0.5), () => true, 0.8, 1.3),
      nest: spread(160, 94, { x0: CH.x - CH.rx * 0.8, x1: CH.x + CH.rx * 0.8, z0: -0.4, z1: -0.05 }, () => CH.y - CH.ry + 0.05, () => true, 0.5, 1.1),
      euc: spread(8, 95, { x0: -2, x1: 30, z0: -40, z1: -8 }, () => TOP - 0.2, () => true, 0.8, 1.1),
    };
  }, []);
  const leaf = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(0, -0.12);
    s.quadraticCurveTo(0.05, 0, 0, 0.12);
    s.quadraticCurveTo(-0.05, 0, 0, -0.12);
    const g = new THREE.ShapeGeometry(s, 3);
    g.rotateX(-Math.PI / 2 + 0.3);
    return g;
  }, []);
  const euc = eucalyptusGeo();
  return (
    <group>
      <fog attach="fog" args={fog} />
      <SkyDome top="#4FA9E6" horizon={fog[0]} bottom={fog[0]} />
      {PLUG_AT.slice(0, Math.ceil(tampoes * PLUG_AT.length - 1e-6)).map((f, i) => {
        const k = Math.min(1, tampoes * PLUG_AT.length - i);
        const [x, y] = tunnelAt(f);
        return <mesh key={i} geometry={PLUG_GEO} material={PLUG_MAT} position={[x, y, -0.2]} scale={[R * 1.05 * k, R * 1.05 * k, 0.4]} castShadow receiveShadow />;
      })}
      {/* chão ao fundo */}
      <mesh position={[0, TOP - 0.02, -60]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[300, 110]} />
        <meshStandardMaterial color="#7BAE50" roughness={0.95} />
      </mesh>
      {/* bloco: frente com o túnel (fino) + resto do barranco */}
      <mesh geometry={G.slab} material={[G.face, G.inner]} castShadow receiveShadow />
      <mesh geometry={G.back} material={[G.inner, G.side]} receiveShadow />
      {/* tampo de grama */}
      <mesh position={[(X1 - 3.0) / 2, TOP + 0.03, -(DEPTH + 0.42) / 2]} receiveShadow>
        <boxGeometry args={[X1 + 3.0, 0.08, DEPTH + 0.42]} />
        <meshStandardMaterial color="#79B04C" roughness={0.95} />
      </mesh>
      {/* luz quente dentro da câmara (sem ela a barriga some na sombra da borda do corte) */}
      <pointLight position={[CH.x, CH.y + 0.15, 1.0]} color="#FFF3E2" intensity={4} distance={4} decay={1.4} />
      {/* folhas secas do ninho */}
      <Inst geo={leaf} spots={sp.nest} material={plainMat("#A07A42", { side: THREE.DoubleSide })} castShadow={false} color={(s) => ["#9C7440", "#B38A4E", "#7F5E36", "#C2A062"][Math.floor(s.k * 4)]} />
      {/* vegetação em cima */}
      <Inst geo={tuftGeo()} spots={sp.tuft} material={plainMat("#7DB552", { side: THREE.DoubleSide })} castShadow={false} color={(s) => (s.k < 0.5 ? "#6FA846" : "#8CC05A")} />
      <Inst geo={groundFernGeo()} spots={sp.fern} material={vcMat("bush")} />
      <Inst geo={reedGeo()} spots={sp.reed} material={vcMat("reed")} sway={{ t, amp: 0.05 }} castShadow={false} />
      <Inst geo={euc.trunk} spots={sp.euc} material={vcMat("euc", { flatShading: true })} />
      <Inst geo={euc.crown} spots={sp.euc} material={vcMat("eucC", { flatShading: true })} />
      {/* rio à esquerda em corte */}
      <mesh position={[X0 - 6, (BOT - 0.0) / 2 - 0.02, -(DEPTH + 0.42) / 2]} renderOrder={4}>
        <boxGeometry args={[12, -BOT, DEPTH + 0.42]} />
        <meshStandardMaterial color="#3FA3B8" transparent opacity={0.55} roughness={0.1} depthWrite={false} />
      </mesh>
      <mesh position={[X0 - 6, BOT - 0.05, -(DEPTH + 0.42) / 2]}>
        <boxGeometry args={[12, 0.1, DEPTH + 0.42]} />
        <meshStandardMaterial color="#8F7B5C" roughness={1} />
      </mesh>
      <WaterSurface t={t} size={[12, DEPTH + 0.42]} position={[X0 - 6, 0, -(DEPTH + 0.42) / 2]} color="#62B7C9" deep="#2C7D8E" opacity={0.85} amp={0.02} seg={40} />
    </group>
  );
};

// Entrada da toca vista de fora (buraco escuro com borda de terra), para planos no Riacho.
export const EntradaToca: React.FC<{ position?: V3; rotation?: V3; scale?: number }> = ({ position, rotation, scale = 1 }) => (
  <group position={position} rotation={rotation} scale={scale}>
    {/* montinho de terra do barranco, com o buraco escuro na frente (+z) */}
    <mesh position={[0, -0.12, -0.12]} scale={[0.55, 0.32, 0.48]} castShadow receiveShadow>
      <dodecahedronGeometry args={[1, 1]} />
      <meshStandardMaterial color="#6E5236" roughness={1} flatShading />
    </mesh>
    <mesh position={[0, 0.1, 0.33]} rotation={[-0.25, 0, 0]} scale={[0.27, 0.2, 1]}>
      <circleGeometry args={[1, 28]} />
      <meshStandardMaterial color="#0B0705" roughness={1} />
    </mesh>
    <mesh position={[0, 0.1, 0.32]} rotation={[-0.25, 0, 0]} scale={[0.3, 0.23, 0.12]}>
      <torusGeometry args={[1, 0.16, 10, 28, Math.PI]} />
      <meshStandardMaterial color="#5E4029" roughness={1} flatShading />
    </mesh>
  </group>
);
