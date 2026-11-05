// Cenário do vídeo "Escada rolante" (esse treco). Escala: 1 unidade = 1 m.
// Shopping de 2 andares (pé-direito 4,5 m) + escada rolante completa e fiel:
// laço de degraus preso na corrente (sobe por cima, volta de cabeça pra baixo), 2 trilhos de alturas
// diferentes que se juntam nas pontas, treliça, máquina no poço de cima (motor, freio de serviço com mola,
// corrente menor, rodas que puxam, freio auxiliar), corrimão em laço com roda de atrito e sensor,
// escovas de saia, placa-pente que recua, protetor da entrada do corrimão, botão nas duas pontas.
import { useMemo } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { C } from "../theme";
import { Glow } from "./basics";
import { InstM, mat, NoShadow, SparkSpray, TiaoWalk, unitBox } from "./Predio";
import { rnd } from "./World";

export type V3 = [number, number, number];
type P2 = [number, number];
const cl = (x: number, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const pr = (t: number, a: number, b: number) => cl((t - a) / Math.max(1e-4, b - a));

// ======================================================================
// Geometria da escada (linha do eixo dos degraus, em x–y; z = largura)
// ======================================================================
export const E = {
  H: 4.5, // desnível entre os pisos
  X0: -3.9, // canto de baixo da rampa (linha do eixo)
  X1: 3.9, // canto de cima
  XB: -6.1, // roda de baixo (volta)
  XT: 6.1, // roda de cima (máquina)
  Rc: 0.35, // raio das rodas dentadas (linha do eixo)
  rB: 1.4,
  rT: 2.2,
  yB: -0.3, // eixo no plano de baixo (piso = 0)
  yT: 4.2, // eixo no plano de cima (piso = 4,5)
  ang: Math.atan2(4.5, 7.8),
  zMain: 0.6,
  zTrail: 0.44,
  zChain: 0.55,
};
export const TOFF: P2 = [-0.12, 0.3]; // do eixo até o centro do topo do degrau
export const XC_T = E.XT - 0.1; // raiz do pente de cima
export const XC_B = E.XB + 0.1; // raiz do pente de baixo
export const XN_T = E.XT + 0.42; // ponta do corrimão (newel) em cima
export const XN_B = E.XB - 0.42;

const buildCarry = (): P2[] => {
  const pts: P2[] = [];
  const a = E.ang;
  const tlB = E.rB * Math.tan(a / 2), tlT = E.rT * Math.tan(a / 2);
  pts.push([E.XB, E.yB]);
  for (let x = E.XB + 0.25; x < E.X0 - tlB - 0.01; x += 0.25) pts.push([x, E.yB]);
  const cB: P2 = [E.X0 - tlB, E.yB + E.rB];
  for (let i = 0; i <= 16; i++) {
    const q = -Math.PI / 2 + (a * i) / 16;
    pts.push([cB[0] + E.rB * Math.cos(q), cB[1] + E.rB * Math.sin(q)]);
  }
  const sT: P2 = [E.X1 - tlT * Math.cos(a), E.yT - tlT * Math.sin(a)];
  const st0 = pts[pts.length - 1];
  const nInc = 30;
  for (let i = 1; i < nInc; i++) pts.push([st0[0] + ((sT[0] - st0[0]) * i) / nInc, st0[1] + ((sT[1] - st0[1]) * i) / nInc]);
  const cT: P2 = [sT[0] + E.rT * Math.sin(a), sT[1] - E.rT * Math.cos(a)];
  for (let i = 0; i <= 16; i++) {
    const q = Math.PI / 2 + a - (a * i) / 16;
    pts.push([cT[0] + E.rT * Math.cos(q), cT[1] + E.rT * Math.sin(q)]);
  }
  const fl = pts[pts.length - 1][0];
  for (let x = fl + 0.25; x < E.XT - 0.01; x += 0.25) pts.push([x, E.yT]);
  pts.push([E.XT, E.yT]);
  return pts;
};
export const CARRY = buildCarry();

type LP = { x: number; y: number; th: number; d: number };
export const LOOP = (() => {
  const raw: { x: number; y: number; th: number }[] = [];
  CARRY.forEach((p) => raw.push({ x: p[0], y: p[1], th: 0 }));
  const ct: P2 = [E.XT, E.yT - E.Rc];
  for (let i = 1; i <= 24; i++) {
    const al = (Math.PI * i) / 24;
    raw.push({ x: ct[0] + E.Rc * Math.sin(al), y: ct[1] + E.Rc * Math.cos(al), th: -al });
  }
  for (let i = CARRY.length - 2; i >= 0; i--) raw.push({ x: CARRY[i][0], y: CARRY[i][1] - 2 * E.Rc, th: -Math.PI });
  const cb: P2 = [E.XB, E.yB - E.Rc];
  for (let i = 1; i < 24; i++) {
    const be = (Math.PI * i) / 24;
    raw.push({ x: cb[0] - E.Rc * Math.sin(be), y: cb[1] - E.Rc * Math.cos(be), th: -Math.PI - be });
  }
  const pts: LP[] = [];
  let d = 0;
  raw.forEach((p, i) => {
    if (i > 0) d += Math.hypot(p.x - raw[i - 1].x, p.y - raw[i - 1].y);
    pts.push({ ...p, d });
  });
  const last = raw[raw.length - 1];
  const L = d + Math.hypot(raw[0].x - last.x, raw[0].y - last.y);
  const carryLen = pts[CARRY.length - 1].d;
  return { pts, L, carryLen };
})();
export const N_STEPS = Math.round(LOOP.L / 0.4);
export const PITCH = LOOP.L / N_STEPS;

export type LS = { x: number; y: number; th: number; tx: number; ty: number };
export const loopAt = (u: number): LS => {
  const L = LOOP.L;
  const P = LOOP.pts;
  let v = ((u % L) + L) % L;
  let lo = 0, hi = P.length - 1;
  if (v >= P[hi].d) {
    const a = P[hi], b = P[0];
    const f = (v - a.d) / (L - a.d);
    const dx = b.x - a.x, dy = b.y - a.y, dl = Math.hypot(dx, dy) || 1;
    return { x: a.x + dx * f, y: a.y + dy * f, th: a.th + (b.th - 2 * Math.PI - a.th) * f, tx: dx / dl, ty: dy / dl };
  }
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1;
    if (P[m].d <= v) lo = m;
    else hi = m;
  }
  const a = P[lo], b = P[hi];
  const f = (v - a.d) / Math.max(1e-6, b.d - a.d);
  const dx = b.x - a.x, dy = b.y - a.y, dl = Math.hypot(dx, dy) || 1;
  return { x: a.x + dx * f, y: a.y + dy * f, th: a.th + (b.th - a.th) * f, tx: dx / dl, ty: dy / dl };
};
// altura do eixo no ramo de cima, dado x
export const axleY = (x: number) => {
  if (x <= CARRY[0][0]) return CARRY[0][1];
  for (let i = 1; i < CARRY.length; i++) {
    if (x <= CARRY[i][0]) {
      const a = CARRY[i - 1], b = CARRY[i];
      return a[1] + ((b[1] - a[1]) * (x - a[0])) / Math.max(1e-6, b[0] - a[0]);
    }
  }
  return CARRY[CARRY.length - 1][1];
};
// linha do topo dos degraus (piso onde se pisa), dado x
export const treadY = (x: number) => axleY(x - TOFF[0]) + TOFF[1];
// u (no laço) do degrau cujo topo está em x no ramo de cima
export const uAtX = (x: number) => {
  const ax = x - TOFF[0];
  for (let i = 1; i < CARRY.length; i++) {
    if (ax <= CARRY[i][0]) {
      const a = LOOP.pts[i - 1], b = LOOP.pts[i];
      return a.d + ((b.d - a.d) * (ax - a.x)) / Math.max(1e-6, b.x - a.x);
    }
  }
  return LOOP.carryLen;
};

// matriz do "quadro do degrau" (origem no centro do topo do degrau)
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _zAxis = new THREE.Vector3(0, 0, 1);
export const stepFrame = (u: number, extra = 0, pivotAxle = true): THREE.Matrix4 => {
  const p = loopAt(u);
  const m = new THREE.Matrix4().makeTranslation(p.x, p.y, 0);
  _q.setFromAxisAngle(_zAxis, p.th + extra);
  m.multiply(_m.makeRotationFromQuaternion(_q));
  if (pivotAxle) m.multiply(_m.makeTranslation(TOFF[0], TOFF[1], 0));
  return m;
};
export const treadPos = (u: number): V3 => {
  const p = loopAt(u);
  const c = Math.cos(p.th), s = Math.sin(p.th);
  return [p.x + c * TOFF[0] - s * TOFF[1], p.y + s * TOFF[0] + c * TOFF[1], 0];
};
export const stepU = (k: number, s: number) => (((k * PITCH + s) % LOOP.L) + LOOP.L) % LOOP.L;

// ======================================================================
// Texturas procedurais (canvas, determinísticas)
// ======================================================================
const TX = new Map<string, THREE.CanvasTexture>();
const mk = (key: string, w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void, rep: [number, number] = [1, 1]) => {
  const k = `${key}|${rep.join(",")}`;
  const hit = TX.get(k);
  if (hit) return hit;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d")!;
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  t.repeat.set(rep[0], rep[1]);
  TX.set(k, t);
  return t;
};
const shade = (hex: string, d: number) => {
  const c = new THREE.Color(hex);
  c.offsetHSL(0, 0, d);
  return `#${c.getHexString()}`;
};
export const mallFloorTex = (rep: [number, number]) =>
  mk("mfloor", 512, 512, (g, w, h) => {
    g.fillStyle = "#EFE6D6";
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 4; i++)
      for (let j = 0; j < 4; j++) {
        g.fillStyle = shade((i + j) % 2 ? "#EDE3D1" : "#F3EBDD", (rnd(i * 4 + j, 3) - 0.5) * 0.03);
        g.fillRect(i * 128 + 2, j * 128 + 2, 124, 124);
      }
    g.strokeStyle = "rgba(160,140,110,0.55)";
    g.lineWidth = 3;
    for (let i = 0; i <= 4; i++) {
      g.beginPath();
      g.moveTo(i * 128, 0);
      g.lineTo(i * 128, h);
      g.stroke();
      g.beginPath();
      g.moveTo(0, i * 128);
      g.lineTo(w, i * 128);
      g.stroke();
    }
    g.fillStyle = "rgba(255,255,255,0.25)";
    g.fillRect(40, 300, 420, 30);
  }, rep);
export const checkerTex = (rep: [number, number]) =>
  mk("checker", 256, 256, (g, w, h) => {
    g.fillStyle = "#B9C0C6";
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 8; i++)
      for (let j = 0; j < 8; j++) {
        g.save();
        g.translate(i * 32 + 16, j * 32 + 16);
        g.rotate((i + j) % 2 ? 0.6 : -0.6);
        g.fillStyle = "#DCE1E5";
        g.fillRect(-11, -3, 22, 6);
        g.fillStyle = "#8F979E";
        g.fillRect(-11, 3, 22, 2);
        g.restore();
      }
  }, rep);
export const brushedTex = (rep: [number, number], base = "#C9D0D5") =>
  mk(`brushed${base}`, 256, 64, (g, w, h) => {
    g.fillStyle = base;
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 160; i++) {
      g.fillStyle = shade(base, (rnd(i, 41) - 0.5) * 0.12);
      g.fillRect(0, rnd(i, 42) * h, w, 1);
    }
  }, rep);
export const beltTex = (rep: [number, number]) =>
  mk("belt", 128, 128, (g, w, h) => {
    g.fillStyle = "#26282C";
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 8; i++) {
      g.fillStyle = "#3A3D43";
      g.fillRect(0, i * 16, w, 5);
    }
  }, rep);
const signCache = new Map<string, THREE.CanvasTexture>();
export const signTex = (text: string, bg: string, fg = "#FFFFFF") => {
  const k = `${text}|${bg}|${fg}`;
  const hit = signCache.get(k);
  if (hit) return hit;
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 96;
  const g = c.getContext("2d")!;
  g.fillStyle = bg;
  g.fillRect(0, 0, 512, 96);
  g.fillStyle = "rgba(255,255,255,0.18)";
  g.fillRect(0, 0, 512, 10);
  g.font = "800 62px 'Baloo 2', 'Arial Black', Arial, sans-serif";
  g.fillStyle = fg;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(text, 256, 54);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  signCache.set(k, t);
  return t;
};
export const stickerTex = () =>
  mk("sticker", 256, 256, (g, w, h) => {
    g.fillStyle = "#FFD23F";
    g.beginPath();
    g.roundRect(6, 6, w - 12, h - 12, 26);
    g.fill();
    g.strokeStyle = "#16181D";
    g.lineWidth = 10;
    g.stroke();
    g.fillStyle = "#16181D";
    g.font = "800 40px 'Baloo 2', Arial, sans-serif";
    g.textAlign = "center";
    g.fillText("SEGURE O", w / 2, 70);
    g.fillText("CORRIMÃO", w / 2, 112);
    // pictograma: mão no corrimão
    g.lineWidth = 12;
    g.beginPath();
    g.moveTo(40, 200);
    g.lineTo(216, 150);
    g.stroke();
    g.beginPath();
    g.arc(120, 180, 22, 0, Math.PI * 2);
    g.fill();
    g.fillRect(110, 190, 20, 50);
  });

// ======================================================================
// Peças simples
// ======================================================================
const segMat = (a: V3, b: V3, th = 0.05, tw = th): THREE.Matrix4 => {
  const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
  const L = Math.hypot(dx, dy, dz);
  const o = new THREE.Object3D();
  o.position.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
  const dir = new THREE.Vector3(dx, dy, dz).normalize();
  o.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir);
  o.scale.set(L, th, tw);
  o.updateMatrix();
  return o.matrix.clone();
};

// Laço de correia entre dois círculos (corrente da bike, corrente menor, etc.): pontos amostrados.
export const beltLoop = (c1: P2, r1: number, c2: P2, r2: number, n = 120) => {
  const dx = c2[0] - c1[0], dy = c2[1] - c1[1];
  const d = Math.hypot(dx, dy);
  const th = Math.atan2(dy, dx);
  const be = Math.acos(cl((r1 - r2) / d, -1, 1));
  const pts: P2[] = [];
  const a0 = th + be, a1 = th - be + 2 * Math.PI;
  const n1 = Math.max(8, Math.round((n * (a1 - a0)) / (2 * Math.PI)));
  for (let i = 0; i <= n1; i++) {
    const a = a0 + ((a1 - a0) * i) / n1;
    pts.push([c1[0] + r1 * Math.cos(a), c1[1] + r1 * Math.sin(a)]);
  }
  const b0 = th - be, b1 = th + be;
  const n2 = Math.max(6, Math.round((n * (b1 - b0)) / (2 * Math.PI)));
  for (let i = 0; i <= n2; i++) {
    const a = b0 + ((b1 - b0) * i) / n2;
    pts.push([c2[0] + r2 * Math.cos(a), c2[1] + r2 * Math.sin(a)]);
  }
  const ds: number[] = [0];
  for (let i = 1; i < pts.length; i++) ds.push(ds[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const L = ds[ds.length - 1] + Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]);
  const at = (u: number): { x: number; y: number; a: number } => {
    let v = ((u % L) + L) % L;
    let i = 0;
    while (i < pts.length - 1 && ds[i + 1] < v) i++;
    const A = pts[i], B = i < pts.length - 1 ? pts[i + 1] : pts[0];
    const seg = (i < pts.length - 1 ? ds[i + 1] : L) - ds[i];
    const f = (v - ds[i]) / Math.max(1e-6, seg);
    return { x: A[0] + (B[0] - A[0]) * f, y: A[1] + (B[1] - A[1]) * f, a: Math.atan2(B[1] - A[1], B[0] - A[0]) };
  };
  return { pts, L, at };
};

// Corrente de rolos ao longo de um laço (links = placas + rolos), instanciada.
export const RollerChain: React.FC<{
  at: (u: number) => { x: number; y: number; a: number };
  L: number;
  s: number;
  z: number;
  pitch?: number;
  color?: string;
  glow?: number;
  size?: number;
  cut?: (u: number) => boolean; // esconder trechos (corrente arrebentada)
  scale?: number;
  vel?: number; // deslocamento por quadro (m); acima de ~1/3 do passo a corrente vira faixa borrada
}> = ({ at, L, s, z, pitch = 0.05, color = "#5D646B", glow = 0, size = 1, cut, scale = 1, vel = 0 }) => {
  const n = Math.max(4, Math.round(L / pitch));
  const p = L / n;
  const blur = Math.min(1, Math.max(0, (Math.abs(vel) / p - 0.3) / 0.15));
  const plates: THREE.Matrix4[] = [], rolls: THREE.Matrix4[] = [];
  for (let j = 0; j < n; j++) {
    const u = j * p + (blur > 0.5 ? 0 : s);
    if (cut && cut(((u % L) + L) % L)) continue;
    const q = at(u);
    const off = blur > 0.5 ? 0 : j % 2 ? 0.012 * size : -0.012 * size;
    plates.push(mat([q.x, q.y, z + off], [0, 0, q.a], [p * (blur > 0.5 ? 1.05 : 1.25) * scale, 0.026 * size * scale, (blur > 0.5 ? 0.03 : 0.006) * size * scale]));
    if (blur <= 0.5) rolls.push(mat([q.x, q.y, z], [Math.PI / 2, 0, 0], [0.011 * size * scale, 0.034 * size * scale, 0.011 * size * scale]));
  }
  return (
    <group>
      <InstM mats={plates} geo={unitBox} max={n} cast={false}>
        <meshStandardMaterial color={color} metalness={0.55} roughness={0.4} emissive="#FFC21F" emissiveIntensity={glow} />
      </InstM>
      <InstM mats={rolls} geo={CYL} max={n} cast={false}>
        <meshStandardMaterial color="#8A939B" metalness={0.6} roughness={0.35} emissive="#FFC21F" emissiveIntensity={glow * 0.6} />
      </InstM>
    </group>
  );
};
const CYL = new THREE.CylinderGeometry(1, 1, 1, 10);
const CYL16 = new THREE.CylinderGeometry(1, 1, 1, 18);

// Roda dentada (disco + dentes), eixo em z.
export const Sprocket: React.FC<{ position: V3; r: number; teeth: number; angle: number; width?: number; color?: string; glow?: number; glowColor?: string; hub?: boolean; blur?: number }> = ({
  position,
  r,
  teeth,
  angle,
  width = 0.04,
  color = "#7A828A",
  glow = 0,
  glowColor = "#FFC21F",
  hub = true,
  blur = 0,
}) => {
  const tm = useMemo(() => {
    const out: THREE.Matrix4[] = [];
    for (let i = 0; i < teeth; i++) {
      const a = (i / teeth) * Math.PI * 2;
      out.push(mat([Math.cos(a) * r, Math.sin(a) * r, 0], [0, 0, a], [r * 0.32, (r * Math.PI * 2) / teeth / 2.1, width]));
    }
    return out;
  }, [r, teeth, width]);
  return (
    <group position={position} rotation={[0, 0, angle]}>
      <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[r * 0.93, r * 0.93, width, 28]} />
        <meshStandardMaterial color={color} metalness={0.55} roughness={0.38} emissive={glowColor} emissiveIntensity={glow} />
      </mesh>
      {blur > 0.5 ? (
        // girando rápido: dentes viram um anel liso (sem efeito carroça)
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[r * 1.12, r * 1.12, width * 0.9, 32]} />
          <meshStandardMaterial color={color} metalness={0.4} roughness={0.55} emissive={glowColor} emissiveIntensity={glow} />
        </mesh>
      ) : (
        <InstM mats={tm} geo={unitBox} cast={false}>
          <meshStandardMaterial color={color} metalness={0.55} roughness={0.38} emissive={glowColor} emissiveIntensity={glow} />
        </InstM>
      )}
      {hub && blur <= 0.5
        ? [0, 1, 2, 3, 4].map((i) => (
            <mesh key={i} position={[Math.cos((i / 5) * Math.PI * 2) * r * 0.55, Math.sin((i / 5) * Math.PI * 2) * r * 0.55, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[r * 0.17, r * 0.17, width * 1.3, 10]} />
              <meshStandardMaterial color="#3A3F45" roughness={0.6} />
            </mesh>
          ))
        : null}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[r * 0.2, r * 0.2, width * 1.8, 14]} />
        <meshStandardMaterial color="#AAB2B9" metalness={0.7} roughness={0.3} />
      </mesh>
    </group>
  );
};

// Mola helicoidal (tubo) entre a e b no eixo x local.
export const Spring: React.FC<{ position: V3; len: number; r?: number; turns?: number; rot?: V3; color?: string; glow?: number }> = ({ position, len, r = 0.05, turns = 7, rot = [0, 0, 0], color = "#E8352B", glow = 0 }) => {
  const geo = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    const n = turns * 14;
    for (let i = 0; i <= n; i++) {
      const a = (i / 14) * Math.PI * 2;
      pts.push(new THREE.Vector3((i / n) * len, Math.cos(a) * r, Math.sin(a) * r));
    }
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), n * 2, r * 0.16, 6, false);
  }, [len, r, turns]);
  return (
    <mesh geometry={geo} position={position} rotation={rot}>
      <meshStandardMaterial color={color} metalness={0.4} roughness={0.35} emissive={color} emissiveIntensity={0.15 + glow} />
    </mesh>
  );
};

// ======================================================================
// Degraus (instanciados)
// ======================================================================
const TREAD_SMOOTH = (() => {
  const g = new THREE.BoxGeometry(0.4, 0.04, 1.0);
  g.translate(0, -0.02, 0);
  return g;
})();
const TREAD_GROOVED = (() => {
  const parts: THREE.BufferGeometry[] = [];
  const base = new THREE.BoxGeometry(0.4, 0.026, 1.0);
  base.translate(0, -0.027, 0);
  parts.push(base);
  for (let i = 0; i < 34; i++) {
    const r = new THREE.BoxGeometry(0.4, 0.016, 0.016);
    r.translate(0, -0.008, -0.49 + i * 0.0297);
    parts.push(r);
  }
  return mergeGeometries(parts)!;
})();
const RISER = (() => {
  const g = new THREE.BoxGeometry(0.02, 0.21, 1.0);
  g.translate(-0.146, -0.13, 0);
  return g;
})();
const L_BRK = (z: number) => mat([-0.02, -0.18, z], [0, 0, 0], [0.32, 0.28, 0.02]);
const L_AXLE = mat([0.12, -0.3, 0], [Math.PI / 2, 0, 0], [0.022, 1.24, 0.022]);
const L_WM = (z: number) => mat([0.12, -0.3, z], [Math.PI / 2, 0, 0], [0.055, 0.035, 0.055]);
const L_WT = (z: number) => mat([-0.16, -0.3, z], [Math.PI / 2, 0, 0], [0.05, 0.035, 0.05]);
const L_YF = mat([-0.175, 0.002, 0], [0, 0, 0], [0.045, 0.004, 0.98]);
const L_YS = (z: number) => mat([0, 0.002, z], [0, 0, 0], [0.4, 0.004, 0.04]);

export type StepPoseFn = (k: number, u: number) => THREE.Matrix4 | null | undefined;
export const Steps: React.FC<{
  s: number;
  vis?: (k: number, u: number) => number; // 0..1 escala de entrada
  pose?: StepPoseFn;
  grooves?: number;
  yellow?: number;
  wheels?: number;
  axle?: number;
  glow?: number;
  glowK?: (k: number) => number; // brilho por degrau
  onlyCarry?: boolean;
}> = ({ s, vis, pose, grooves = 0, yellow = 0, wheels = 0, axle = 1, glow = 0, glowK, onlyCarry = false }) => {
  const M = useMemo(() => {
    const tread: THREE.Matrix4[] = [], treadG: THREE.Matrix4[] = [], riser: THREE.Matrix4[] = [], brk: THREE.Matrix4[] = [], ax: THREE.Matrix4[] = [], wm: THREE.Matrix4[] = [], wt: THREE.Matrix4[] = [], yl: THREE.Matrix4[] = [];
    const glowCols: string[] = [], glowColsG: string[] = [];
    const tmp = new THREE.Matrix4();
    for (let k = 0; k < N_STEPS; k++) {
      const u = stepU(k, s);
      if (onlyCarry && u > LOOP.carryLen + 0.2) continue;
      const sc = vis ? vis(k, u) : 1;
      if (sc <= 0.001) continue;
      let F = pose ? pose(k, u) : undefined;
      if (F === null) continue;
      if (!F) F = stepFrame(u);
      if (sc < 0.999) F = F.clone().multiply(new THREE.Matrix4().makeScale(sc, sc, sc));
      const gk = glowK ? glowK(k) : 0;
      const col = gk > 0.01 ? `#${new THREE.Color("#FFFFFF").lerp(new THREE.Color("#FFD23F"), cl(gk)).getHexString()}` : "#FFFFFF";
      if (grooves > 0.5) {
        treadG.push(F.clone());
        glowColsG.push(col);
      } else {
        tread.push(F.clone());
        glowCols.push(col);
      }
      riser.push(F.clone());
      for (const z of [-0.47, 0.47]) brk.push(tmp.multiplyMatrices(F, L_BRK(z)).clone());
      if (axle > 0.01) ax.push(tmp.multiplyMatrices(F, L_AXLE).clone());
      if (wheels > 0.01 || axle > 0.01) for (const z of [-E.zMain, E.zMain]) wm.push(tmp.multiplyMatrices(F, L_WM(z)).clone().multiply(new THREE.Matrix4().makeScale(wheels > 0.01 ? wheels : 0.5, 1, wheels > 0.01 ? wheels : 0.5)));
      if (wheels > 0.01) for (const z of [-E.zTrail, E.zTrail]) wt.push(tmp.multiplyMatrices(F, L_WT(z)).clone().multiply(new THREE.Matrix4().makeScale(wheels, 1, wheels)));
      if (yellow > 0.01) {
        yl.push(tmp.multiplyMatrices(F, L_YF).clone());
        for (const z of [-0.48, 0.48]) yl.push(tmp.multiplyMatrices(F, L_YS(z)).clone());
      }
    }
    return { tread, treadG, riser, brk, ax, wm, wt, yl, glowCols, glowColsG };
  }, [s, vis, pose, grooves, yellow, wheels, axle, glowK, onlyCarry]);
  const alu = "#C7CDD2";
  return (
    <group>
      <InstM mats={M.tread} colors={M.glowCols} geo={TREAD_SMOOTH} max={N_STEPS}>
        <meshStandardMaterial color="#E4E8EB" map={brushedTex([1, 1], "#D4DADF")} metalness={0.45} roughness={0.38} emissive="#FFC21F" emissiveIntensity={glow} />
      </InstM>
      <InstM mats={M.treadG} colors={M.glowColsG} geo={TREAD_GROOVED} max={N_STEPS}>
        <meshStandardMaterial color={alu} metalness={0.45} roughness={0.36} emissive="#FFC21F" emissiveIntensity={glow} />
      </InstM>
      <InstM mats={M.riser} geo={RISER} max={N_STEPS}>
        <meshStandardMaterial color="#5E666E" metalness={0.45} roughness={0.42} emissive="#FFC21F" emissiveIntensity={glow * 0.7} />
      </InstM>
      <InstM mats={M.brk} geo={unitBox} max={N_STEPS * 2} cast={false}>
        <meshStandardMaterial color="#6F777E" metalness={0.4} roughness={0.5} emissive="#FFC21F" emissiveIntensity={glow * 0.5} />
      </InstM>
      <InstM mats={M.ax} geo={CYL} max={N_STEPS} cast={false}>
        <meshStandardMaterial color="#5B6268" metalness={0.6} roughness={0.35} />
      </InstM>
      <InstM mats={M.wm} geo={CYL16} max={N_STEPS * 2} cast={false}>
        <meshStandardMaterial color="#25272B" roughness={0.7} />
      </InstM>
      <InstM mats={M.wt} geo={CYL16} max={N_STEPS * 2} cast={false}>
        <meshStandardMaterial color="#25272B" roughness={0.7} />
      </InstM>
      {yellow > 0.01 ? (
        <InstM mats={M.yl} geo={unitBox} max={N_STEPS * 3} cast={false}>
          <meshStandardMaterial color="#FFD21F" roughness={0.5} emissive="#FFB800" emissiveIntensity={0.15} transparent={yellow < 1} opacity={yellow} />
        </InstM>
      ) : null}
    </group>
  );
};

// ======================================================================
// Trilhos (ramo de cima e de baixo, 2 alturas)
// ======================================================================
const TRACKS = (() => {
  const main: THREE.Matrix4[] = [], trail: THREE.Matrix4[] = [];
  const samples = (off: number, dy: number, ret: boolean) => {
    const out: V3[] = [];
    for (let x = E.XB + 0.12; x <= E.XT - 0.12 + 1e-6; x += 0.2) {
      const y = axleY(x - off) + dy - (ret ? 2 * E.Rc : 0);
      out.push([x, y, 0]);
    }
    return out;
  };
  const push = (arr: THREE.Matrix4[], pts: V3[], z: number) => {
    for (let i = 1; i < pts.length; i++) arr.push(segMat([pts[i - 1][0], pts[i - 1][1], z], [pts[i][0], pts[i][1], z], 0.035, 0.05));
  };
  for (const z of [-E.zMain, E.zMain]) {
    push(main, samples(0, -0.085, false), z);
    push(main, samples(0, -0.085, true), z);
  }
  for (const z of [-E.zTrail, E.zTrail]) {
    push(trail, samples(0.28, -0.085, false), z);
    push(trail, samples(-0.28, -0.085, true), z);
  }
  return { main, trail };
})();
const trackX = (m: THREE.Matrix4) => m.elements[12];
export const Tracks: React.FC<{ show: number; colored?: number; glow?: number }> = ({ show, colored = 0, glow = 0 }) => {
  if (show <= 0.01) return null;
  const cm = `#${new THREE.Color("#7D858C").lerp(new THREE.Color("#E8352B"), colored).getHexString()}`;
  const ct = `#${new THREE.Color("#7D858C").lerp(new THREE.Color("#2FB34E"), colored).getHexString()}`;
  // os trilhos se desenham da ponta de baixo até a de cima
  const xEnd = E.XB - 0.2 + (E.XT - E.XB + 0.4) * cl(show);
  const main = show >= 0.999 ? TRACKS.main : TRACKS.main.filter((m) => trackX(m) <= xEnd);
  const trail = show >= 0.999 ? TRACKS.trail : TRACKS.trail.filter((m) => trackX(m) <= xEnd);
  return (
    <group>
      <InstM mats={main} geo={unitBox} max={TRACKS.main.length} cast={false}>
        <meshStandardMaterial color={cm} metalness={0.45} roughness={0.4} emissive={cm} emissiveIntensity={glow * 0.5 + colored * 0.15} />
      </InstM>
      <InstM mats={trail} geo={unitBox} max={TRACKS.trail.length} cast={false}>
        <meshStandardMaterial color={ct} metalness={0.45} roughness={0.4} emissive={ct} emissiveIntensity={glow * 0.5 + colored * 0.15} />
      </InstM>
    </group>
  );
};

// Corrente dos degraus (os dois lados) seguindo o laço.
export const StepChain: React.FC<{ s: number; show: number; glow?: number; vel?: number; size?: number }> = ({ s, show, glow = 0, vel = 0, size = 2.6 }) => {
  const at = (u: number) => {
    const q = loopAt(u);
    return { x: q.x, y: q.y, a: Math.atan2(q.ty, q.tx) };
  };
  if (show <= 0.01) return null;
  // "show" < 1: a corrente está sendo puxada de uma ponta à outra (u medido no laço, a partir da roda de baixo)
  return (
    <group>
      {[-E.zChain, E.zChain].map((z) => (
        <RollerChain key={z} at={at} L={LOOP.L} s={s} z={z} pitch={PITCH / 3} size={size} color="#4E555C" glow={glow} vel={vel} cut={show < 0.999 ? (u) => ((((u - s) % LOOP.L) + LOOP.L) % LOOP.L) > show * LOOP.L : undefined} />
      ))}
    </group>
  );
};

// ======================================================================
// Treliça, revestimento, saia, balaustrada
// ======================================================================
const trussTop = (x: number) => axleY(x) - 0.14;
const trussBot = (x: number) => axleY(x) - 2 * E.Rc - 0.45;
const TRUSS = (() => {
  const bars: THREE.Matrix4[] = [];
  const xs: number[] = [];
  for (let x = E.XB - 0.4; x <= E.XT + 0.4; x += 0.75) xs.push(x);
  for (const z of [-0.78, 0.78]) {
    for (let i = 1; i < xs.length; i++) {
      const a = xs[i - 1], b = xs[i];
      bars.push(segMat([a, trussTop(a), z], [b, trussTop(b), z], 0.07, 0.07));
      bars.push(segMat([a, trussBot(a), z], [b, trussBot(b), z], 0.07, 0.07));
      bars.push(segMat(i % 2 ? [a, trussTop(a), z] : [a, trussBot(a), z], i % 2 ? [b, trussBot(b), z] : [b, trussTop(b), z], 0.045, 0.045));
    }
    xs.forEach((x) => bars.push(segMat([x, trussBot(x), z], [x, trussTop(x), z], 0.06, 0.06)));
  }
  xs.forEach((x, i) => {
    if (i % 2) return;
    bars.push(segMat([x, trussBot(x), -0.78], [x, trussBot(x), 0.78], 0.05, 0.05));
    bars.push(segMat([x, trussTop(x) - 0.05, -0.78], [x, trussTop(x) - 0.05, 0.78], 0.04, 0.04));
  });
  return bars;
})();
export const Truss: React.FC<{ show: number; glow?: number }> = ({ show, glow = 0 }) =>
  show > 0.01 ? (
    <InstM mats={TRUSS} geo={unitBox} cast={false}>
      <meshStandardMaterial color="#E0B13A" metalness={0.25} roughness={0.55} emissive="#FFC21F" emissiveIntensity={glow} transparent={show < 0.98} opacity={Math.min(1, show)} depthWrite alphaTest={show < 0.98 ? 0.02 : 0} />
    </InstM>
  ) : null;

const sideShape = (top: (x: number) => number, bot: (x: number) => number, x0: number, x1: number, dx = 0.2) => {
  const sh = new THREE.Shape();
  sh.moveTo(x0, bot(x0));
  for (let x = x0; x <= x1 + 1e-6; x += dx) sh.lineTo(x, bot(x));
  for (let x = x1; x >= x0 - 1e-6; x -= dx) sh.lineTo(x, top(x));
  sh.closePath();
  return new THREE.ShapeGeometry(sh);
};
const CLAD = sideShape((x) => treadY(x) - 0.08, (x) => trussBot(x) - 0.06, E.XB - 1.0, E.XT + 1.0);
const SOFFIT = (() => {
  // fita inferior (fundo da treliça)
  const pos: number[] = [], idx: number[] = [];
  const xs: number[] = [];
  for (let x = E.XB - 1.0; x <= E.XT + 1.0 + 1e-6; x += 0.2) xs.push(x);
  xs.forEach((x, i) => {
    const y = trussBot(x) - 0.06;
    pos.push(x, y, -0.84, x, y, 0.84);
    if (i > 0) {
      const a = (i - 1) * 2, b = i * 2;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
})();
export const Cladding: React.FC<{ show: number }> = ({ show }) => {
  if (show <= 0.01) return null;
  const tr = show < 0.999;
  return (
    <group>
      {[-0.84, 0.84].map((z) => (
        <mesh key={z} geometry={CLAD} position={[0, 0, z]} receiveShadow castShadow={!tr} renderOrder={tr ? 3 : 0}>
          <meshStandardMaterial map={brushedTex([0.5, 0.5], "#D9DEE2")} color="#E6EAED" metalness={0.35} roughness={0.38} side={THREE.DoubleSide} transparent={tr} opacity={show} depthWrite={!tr} />
        </mesh>
      ))}
      <mesh geometry={SOFFIT} receiveShadow renderOrder={tr ? 3 : 0}>
        <meshStandardMaterial color="#DDE2E6" metalness={0.3} roughness={0.45} side={THREE.DoubleSide} transparent={tr} opacity={show} depthWrite={!tr} />
      </mesh>
    </group>
  );
};

// Saia (lateral parada) + capa do deck: existe desde o início.
const SKIRT = sideShape((x) => treadY(x) + 0.26, (x) => treadY(x) - 0.06, XC_B + 0.05, XC_T - 0.05, 0.1);
const DECK = sideShape((x) => treadY(x) + 0.33, (x) => treadY(x) + 0.26, XN_B + 0.2, XN_T - 0.2, 0.1);
export const Skirt: React.FC<{ glowRed?: number; xray?: number; show?: number }> = ({ glowRed = 0, xray = 0, show = 1 }) => {
  const op = (1 - xray * 0.75) * Math.min(1, show);
  const tr = op < 0.99;
  return (
  <group>
    {[-0.52, 0.52].map((z) => (
      <mesh key={z} geometry={SKIRT} position={[0, 0, z]} receiveShadow castShadow={!tr} renderOrder={tr ? 3 : 0}>
        <meshStandardMaterial map={brushedTex([0.6, 0.6], "#C9D0D5")} color="#D7DDE1" metalness={0.5} roughness={0.3} side={THREE.DoubleSide} emissive="#FF2A1A" emissiveIntensity={glowRed} transparent={tr} opacity={op} depthWrite={!tr} />
      </mesh>
    ))}
    {[-0.57, 0.57].map((z) => (
      <mesh key={z} geometry={DECK} position={[0, 0, z]} receiveShadow renderOrder={tr ? 3 : 0}>
        <meshStandardMaterial color="#B8C0C6" metalness={0.5} roughness={0.32} side={THREE.DoubleSide} transparent={tr} opacity={op} depthWrite={!tr} />
      </mesh>
    ))}
    {/* tampa do deck (faixa horizontal no topo da saia) */}
    {[-0.545, 0.545].map((z) => {
      const pts: THREE.Matrix4[] = [];
      for (let x = XC_B + 0.05; x < XC_T - 0.1; x += 0.2) pts.push(segMat([x, treadY(x) + 0.265, z], [x + 0.2, treadY(x + 0.2) + 0.265, z], 0.02, 0.07));
      return (
        <InstM key={z} mats={pts} geo={unitBox} cast={false}>
          <meshStandardMaterial color="#9AA3AA" metalness={0.55} roughness={0.3} transparent={tr} opacity={op} />
        </InstM>
      );
    })}
  </group>
  );
};

// Linha borda vermelha (fique longe da beirada): ao longo da saia, na altura do degrau.
export const EdgeGlow: React.FC<{ amount: number }> = ({ amount }) => {
  if (amount <= 0.01) return null;
  const pts: THREE.Matrix4[] = [];
  for (const z of [-0.5, 0.5]) for (let x = XC_B + 0.2; x < XC_T - 0.2; x += 0.2) pts.push(segMat([x, treadY(x) + 0.03, z], [x + 0.2, treadY(x + 0.2) + 0.03, z], 0.025, 0.03));
  return (
    <InstM mats={pts} geo={unitBox} cast={false}>
      <meshBasicMaterial color="#FF3022" toneMapped={false} transparent opacity={amount} />
    </InstM>
  );
};

// Balaustrada de vidro (com as pontas arredondadas = newels).
const GLASS = (() => {
  const sh = new THREE.Shape();
  const top = (x: number) => treadY(x) + 0.9;
  const bot = (x: number) => treadY(x) + 0.33;
  const xa = XN_B, xb = XN_T;
  sh.moveTo(xa, bot(xa));
  for (let x = xa; x <= xb; x += 0.2) sh.lineTo(x, bot(x));
  // newel de cima
  const cy = E.H + 0.52;
  for (let i = 0; i <= 12; i++) {
    const a = -Math.PI / 2 + (Math.PI * i) / 12;
    sh.lineTo(xb + Math.cos(a) * 0.38, cy + Math.sin(a) * 0.38);
  }
  for (let x = xb; x >= xa; x -= 0.2) sh.lineTo(x, top(x));
  const cyb = 0.52;
  for (let i = 0; i <= 12; i++) {
    const a = Math.PI / 2 + (Math.PI * i) / 12;
    sh.lineTo(xa + Math.cos(a) * 0.38, cyb + Math.sin(a) * 0.38);
  }
  sh.closePath();
  return new THREE.ShapeGeometry(sh);
})();

// Corrimão: laço visível (em cima da balaustrada) + laço escondido (desce no poço, passa pela roda de atrito).
export const HR = (() => {
  const vis: THREE.Vector3[] = [];
  const z = 0;
  const hY = (x: number) => treadY(x) + 0.95;
  // sai da boca de baixo, sobe a ponta (newel), percorre e desce a ponta de cima até a boca
  for (let i = 0; i <= 14; i++) {
    const a = -Math.PI / 2 - (Math.PI * i) / 14;
    vis.push(new THREE.Vector3(XN_B + Math.cos(a) * 0.42, 0.53 + Math.sin(a) * 0.42, z));
  }
  for (let x = XN_B + 0.2; x < XN_T - 0.1; x += 0.25) vis.push(new THREE.Vector3(x, hY(x), z));
  for (let i = 0; i <= 14; i++) {
    const a = Math.PI / 2 - (Math.PI * i) / 14;
    vis.push(new THREE.Vector3(XN_T + Math.cos(a) * 0.42, E.H + 0.53 + Math.sin(a) * 0.42, z));
  }
  const hid: THREE.Vector3[] = [
    new THREE.Vector3(XN_T, E.H + 0.11, z),
    new THREE.Vector3(XN_T - 0.25, E.H + 0.08, z),
    new THREE.Vector3(XN_T - 0.32, E.H - 0.3, z),
    new THREE.Vector3(E.XT + 0.6, E.H - 0.85, z),
    new THREE.Vector3(E.XT + 0.3, E.H - 1.18, z),
    new THREE.Vector3(E.XT - 0.2, E.H - 1.05, z),
  ];
  for (let x = E.XT - 0.6; x > E.XB + 0.6; x -= 0.4) hid.push(new THREE.Vector3(x, axleY(x) - 0.45, z));
  hid.push(new THREE.Vector3(E.XB - 0.25, -0.85, z), new THREE.Vector3(XN_B + 0.32, -0.3, z), new THREE.Vector3(XN_B + 0.25, 0.08, z), new THREE.Vector3(XN_B, 0.11, z));
  const cv = new THREE.CatmullRomCurve3(vis, false, "centripetal");
  const ch = new THREE.CatmullRomCurve3(hid, false, "centripetal");
  const Lv = cv.getLength(), Lh = ch.getLength();
  const tubeV = new THREE.TubeGeometry(cv, 260, 0.048, 8, false);
  const tubeH = new THREE.TubeGeometry(ch, 200, 0.048, 8, false);
  return { cv, ch, Lv, Lh, L: Lv + Lh, tubeV, tubeH, wheel: [E.XT + 0.3, E.H - 0.93] as P2 };
})();
// tubo parcial do corrimão (fração desenhada a partir da boca de baixo), em cache por quadro de fração
const HR_PART = new Map<number, THREE.BufferGeometry>();
const hrPartial = (f: number) => {
  const segs = 260, rad = 8;
  const n = Math.max(1, Math.round(cl(f) * segs));
  const hit = HR_PART.get(n);
  if (hit) return hit;
  const g = HR.tubeV.clone();
  g.setDrawRange(0, n * rad * 6);
  HR_PART.set(n, g);
  return g;
};
export const hrAt = (u: number): THREE.Vector3 => {
  const v = ((u % HR.L) + HR.L) % HR.L;
  return v < HR.Lv ? HR.cv.getPointAt(v / HR.Lv) : HR.ch.getPointAt((v - HR.Lv) / HR.Lh);
};
// ponto do corrimão visível em x (ramo de cima)
export const hrY = (x: number) => treadY(x) + 0.95;

export const Balustrade: React.FC<{
  show: number;
  handrail: number;
  hs: number;
  marks?: number;
  hidden?: number;
  glow?: number;
  glassOpacity?: number;
  sides?: number[];
}> = ({ show, handrail, hs, marks = 0, hidden = 0, glow = 0, glassOpacity = 0.28, sides = [-0.6, 0.6] }) => {
  const mk = useMemo(() => {
    if (marks <= 0.01) return [] as THREE.Matrix4[];
    const out: THREE.Matrix4[] = [];
    const n = Math.round(HR.L / 0.55);
    for (const z of sides)
      for (let j = 0; j < n; j++) {
        const u = j * (HR.L / n) + hs;
        const v = ((u % HR.L) + HR.L) % HR.L;
        if (v > HR.Lv && hidden < 0.5) continue;
        const p = hrAt(u), q = hrAt(u + 0.05);
        out.push(segMat([p.x, p.y + 0.0, z], [q.x, q.y + 0.0, z], 0.1, 0.104));
      }
    return out;
  }, [hs, marks, hidden, sides.join()]);
  return (
    <group>
      {show > 0.01
        ? sides.map((z) => (
            <group key={z} position={[0, 0, z * 0.95]} scale={[1, show, 1]}>
              <mesh geometry={GLASS}>
                <meshStandardMaterial color="#CFEFFF" transparent opacity={glassOpacity} roughness={0.05} metalness={0.1} side={THREE.DoubleSide} depthWrite={false} />
              </mesh>
            </group>
          ))
        : null}
      {handrail > 0.01
        ? sides.map((z) => (
            <group key={`h${z}`} position={[0, 0, z]}>
              {/* a faixa de borracha é estendida de baixo para cima (drawRange ao longo do tubo) */}
              <mesh geometry={handrail >= 0.999 ? HR.tubeV : hrPartial(handrail)} scale={[1, 1, 1]} castShadow>
                <meshStandardMaterial color="#1D1F23" roughness={0.55} emissive="#FFC21F" emissiveIntensity={glow} />
              </mesh>
              {hidden > 0.01 ? (
                <mesh geometry={HR.tubeH}>
                  <meshStandardMaterial color="#1D1F23" roughness={0.55} emissive="#FFC21F" emissiveIntensity={glow} transparent opacity={hidden} />
                </mesh>
              ) : null}
            </group>
          ))
        : null}
      {marks > 0.01 ? (
        <InstM mats={mk} geo={unitBox} cast={false}>
          <meshBasicMaterial color="#FFD23F" toneMapped={false} transparent opacity={marks} />
        </InstM>
      ) : null}
    </group>
  );
};

// Boca de entrada do corrimão (nas duas pontas) + protetor de borracha com interruptor.
export const Inlet: React.FC<{ top: boolean; z: number; guard: number; push?: number; glow?: number; led?: number }> = ({ top, z, guard, push = 0, glow = 0, led = 0 }) => {
  const x = top ? XN_T - 0.12 : XN_B + 0.12;
  const y = (top ? E.H : 0) + 0.11;
  const sgn = top ? 1 : -1;
  return (
    <group position={[x, y, z]}>
      <mesh position={[-sgn * 0.08, 0, 0]} castShadow>
        <boxGeometry args={[0.22, 0.2, 0.17]} />
        <meshStandardMaterial color="#C3CAD0" metalness={0.5} roughness={0.3} />
      </mesh>
      <mesh position={[sgn * 0.033, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
        <circleGeometry args={[0.065, 20]} />
        <meshBasicMaterial color="#050506" side={THREE.DoubleSide} />
      </mesh>
      {guard > 0.01 ? (
        <group position={[sgn * (0.05 + push * 0.03 + (1 - Math.min(1, guard)) * 0.45), 0, 0]}>
          {/* aba de borracha (anel) */}
          <mesh rotation={[0, Math.PI / 2, 0]} scale={[1, 1, 0.35]}>
            <torusGeometry args={[0.085, 0.03, 8, 20]} />
            <meshStandardMaterial color="#3A3D42" roughness={0.8} emissive="#FFC21F" emissiveIntensity={glow} />
          </mesh>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <mesh key={i} position={[sgn * 0.01, Math.cos(i) * 0.04, Math.sin(i) * 0.04]} rotation={[i, 0, 0]}>
              <boxGeometry args={[0.012, 0.06, 0.02]} />
              <meshStandardMaterial color="#2A2C30" roughness={0.9} />
            </mesh>
          ))}
          {/* interruptor */}
          <mesh position={[-sgn * 0.07, -0.13, 0.0]}>
            <boxGeometry args={[0.08, 0.05, 0.06]} />
            <meshStandardMaterial color="#F2C230" roughness={0.5} emissive="#FFC21F" emissiveIntensity={glow} />
          </mesh>
          <mesh position={[-sgn * 0.07, -0.1, 0.035]}>
            <sphereGeometry args={[0.012, 10, 8]} />
            <meshBasicMaterial color={led > 0.5 ? "#FF2A1A" : "#3DBE5A"} toneMapped={false} />
          </mesh>
        </group>
      ) : null}
    </group>
  );
};

// Botão de parada (nas duas pontas), com tampinha.
export const StopButton: React.FC<{ top: boolean; show: number; cover?: number; press?: number; glow?: number }> = ({ top, show, cover = 0, press = 0, glow = 0 }) => {
  if (show <= 0.01) return null;
  const x = top ? XN_T - 0.38 : XN_B + 0.38;
  const y = (top ? E.H : 0) + 0.5;
  return (
    <group position={[x, y, 0.5]} scale={show}>
      <mesh position={[0, 0, 0.02]} castShadow>
        <boxGeometry args={[0.16, 0.22, 0.05]} />
        <meshStandardMaterial color="#F2C230" roughness={0.5} emissive="#FFC21F" emissiveIntensity={glow * 0.6} />
      </mesh>
      <mesh position={[0, 0, -0.01 + press * 0.012]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.05, 0.055, 0.03, 20]} />
        <meshStandardMaterial color="#E21E14" roughness={0.35} emissive="#FF2A1A" emissiveIntensity={0.25 + glow} />
      </mesh>
      <mesh position={[0, 0, -0.028 + press * 0.012]} scale={[1, 1, 0.5]}>
        <sphereGeometry args={[0.05, 16, 10]} />
        <meshStandardMaterial color="#F02A1E" roughness={0.3} emissive="#FF2A1A" emissiveIntensity={0.25 + glow} />
      </mesh>
      {/* tampinha transparente articulada no topo */}
      <group position={[0, 0.1, -0.01]} rotation={[cover * 1.9, 0, 0]}>
        <mesh position={[0, -0.09, -0.03]}>
          <boxGeometry args={[0.15, 0.18, 0.006]} />
          <meshStandardMaterial color="#E9F6FF" transparent opacity={0.35} roughness={0.1} depthWrite={false} />
        </mesh>
      </group>
      <mesh position={[0, -0.07, -0.009]}>
        <planeGeometry args={[0.12, 0.03]} />
        <meshBasicMaterial color="#16181D" side={THREE.DoubleSide} polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-4} />
      </mesh>
    </group>
  );
};

// Placa-pente (dentes amarelos encaixados nas ranhuras) + interruptor que desliga se ela recuar.
const COMB_TEETH = (() => {
  const out: THREE.Matrix4[] = [];
  for (let i = 0; i < 33; i++) out.push(mat([-0.06, -0.006, -0.475 + i * 0.0297], [0, 0, -0.16], [0.13, 0.012, 0.012]));
  return out;
})();
export const Comb: React.FC<{ top: boolean; show: number; recoil?: number; glow?: number; led?: number; base?: number }> = ({ top, show, recoil = 0, glow = 0, led = 0, base = 1 }) => {
  if (base <= 0.01 && show <= 0.01) return null;
  const x = top ? XC_T : XC_B;
  const y = top ? E.H : 0;
  const sgn = top ? 1 : -1;
  const drop = 1 - Math.min(1, show);
  return (
    <group position={[x + sgn * recoil * 0.05, y + 0.012, 0]} rotation={[0, top ? 0 : Math.PI, 0]}>
      {/* placa de base */}
      {base > 0.01 ? (
        <mesh position={[0.11, -0.01, 0]} receiveShadow>
          <boxGeometry args={[0.24, 0.025, 1.0]} />
          <meshStandardMaterial map={checkerTex([1, 4])} color="#D2D8DC" metalness={0.5} roughness={0.35} />
        </mesh>
      ) : null}
      {show > 0.01 ? (
        // o pente desce de cima e encaixa nas ranhuras
        <group position={[0, drop * drop * 0.55, 0]} rotation={[0, 0, -drop * 0.35]}>
          <mesh position={[0.0, -0.004, 0]}>
            <boxGeometry args={[0.05, 0.02, 1.0]} />
            <meshStandardMaterial color="#F2C21E" roughness={0.45} emissive="#FFB800" emissiveIntensity={0.15 + glow} />
          </mesh>
          <InstM mats={COMB_TEETH} geo={unitBox} cast={false}>
            <meshStandardMaterial color="#F2C21E" roughness={0.45} emissive="#FFB800" emissiveIntensity={0.15 + glow} />
          </InstM>
          {/* interruptor embaixo da placa */}
          <mesh position={[0.18, -0.09, 0.42]}>
            <boxGeometry args={[0.1, 0.08, 0.08]} />
            <meshStandardMaterial color="#2C3036" roughness={0.6} emissive="#FFC21F" emissiveIntensity={glow * 0.5} />
          </mesh>
          <mesh position={[0.13 - recoil * 0.02, -0.09, 0.42]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.012, 0.012, 0.06, 8]} />
            <meshStandardMaterial color="#C9D0D5" metalness={0.6} />
          </mesh>
          <mesh position={[0.22, -0.05, 0.42]}>
            <sphereGeometry args={[0.014, 10, 8]} />
            <meshBasicMaterial color={led > 0.5 ? "#FF2A1A" : "#3DBE5A"} toneMapped={false} />
          </mesh>
        </group>
      ) : (
        <mesh position={[-0.003, -0.01, 0]}>
          <boxGeometry args={[0.012, 0.025, 1.0]} />
          <meshStandardMaterial color="#8F979E" metalness={0.5} roughness={0.35} />
        </mesh>
      )}
    </group>
  );
};

// Escovas da saia (lateral), crescendo com "show".
const BRUSH = (() => {
  const out: THREE.Matrix4[] = [];
  for (const z of [-0.515, 0.515])
    for (let x = XC_B + 0.15; x < XC_T - 0.15; x += 0.035) {
      const y = treadY(x) + 0.13;
      const dir = z > 0 ? -1 : 1;
      out.push(mat([x, y, z + dir * 0.05], [0, 0, (rnd(Math.round(x * 100), 3) - 0.5) * 0.3], [0.02, 0.1, 0.11]));
    }
  const base: THREE.Matrix4[] = [];
  for (const z of [-0.515, 0.515]) for (let x = XC_B + 0.15; x < XC_T - 0.35; x += 0.2) base.push(segMat([x, treadY(x) + 0.13, z], [x + 0.2, treadY(x + 0.2) + 0.13, z], 0.05, 0.03));
  return { out, base };
})();
const BRUSH_P = (() => {
  const out: { x: number; y: number; z: number; dir: number }[] = [];
  for (const z of [-0.515, 0.515])
    for (let x = XC_B + 0.15; x < XC_T - 0.15; x += 0.035) out.push({ x, y: treadY(x) + 0.13, z, dir: z > 0 ? -1 : 1 });
  return out;
})();
// "show": as escovas são aparafusadas ao longo da saia, de baixo para cima (a frente da montagem anda em x).
const BRUSH_X0 = XC_B + 0.15, BRUSH_X1 = XC_T - 0.15;
const SCREWS = (() => {
  const out: THREE.Matrix4[] = [];
  for (const z of [-0.515, 0.515]) for (let x = BRUSH_X0 + 0.1; x < XC_T - 0.35; x += 0.4) out.push(mat([x, treadY(x) + 0.13, z + (z > 0 ? -0.018 : 0.018)], [Math.PI / 2, 0, 0], [0.014, 0.012, 0.014]));
  return out;
})();
export const Brushes: React.FC<{ show: number; glow?: number; tuftGlow?: number; bendX?: number; bend?: number; amp?: number }> = ({ show, glow = 0, tuftGlow, bendX = 0, bend = 0, amp = 1 }) => {
  const g = cl(show);
  const xEnd = BRUSH_X0 - 0.3 + (BRUSH_X1 - BRUSH_X0 + 0.6) * g;
  const mats = useMemo(() => {
    if (bend <= 0.01 && g >= 0.999) return BRUSH.out;
    const e = new THREE.Euler();
    const v = new THREE.Vector3();
    const out: THREE.Matrix4[] = [];
    BRUSH_P.forEach((b, i) => {
      // tufo só existe atrás da frente de montagem; nos últimos 30 cm ele ainda está crescendo
      const grow = g >= 0.999 ? 1 : cl((xEnd - b.x) / 0.3);
      if (grow <= 0.02) return;
      const k = b.z > 0 ? Math.max(0, 1 - Math.abs(b.x - bendX) / 0.3) * bend : 0;
      const len = 0.11 * grow;
      e.set(-b.dir * k * 0.55 * amp, b.dir * k * 0.8 * amp, (rnd(i, 3) - 0.5) * 0.3 * (1 - k));
      v.set(0, 0, b.dir * (len / 2)).applyEuler(e);
      out.push(mat([b.x + v.x, b.y + v.y, b.z + v.z], [e.x, e.y, e.z], [0.02, 0.1 * (1 - k * 0.3), len]));
    });
    return out;
  }, [bend, bendX, g, amp, xEnd]);
  const base = g >= 0.999 ? BRUSH.base : BRUSH.base.filter((m) => m.elements[12] <= xEnd);
  const screws = g >= 0.999 ? SCREWS : SCREWS.filter((m) => m.elements[12] <= xEnd - 0.15);
  return show > 0.01 ? (
    <group>
      <InstM mats={mats} geo={unitBox} max={BRUSH.out.length} cast={false}>
        <meshStandardMaterial color="#1A1B1F" roughness={0.95} emissive="#FFC21F" emissiveIntensity={(tuftGlow ?? glow) * 0.6} />
      </InstM>
      <InstM mats={base} geo={unitBox} max={BRUSH.base.length} cast={false}>
        <meshStandardMaterial color="#F2C21E" roughness={0.45} emissive="#FFB800" emissiveIntensity={0.15 + glow * 0.5} />
      </InstM>
      <InstM mats={screws} geo={CYL} max={SCREWS.length} cast={false}>
        <meshStandardMaterial color="#6E767E" metalness={0.7} roughness={0.3} />
      </InstM>
    </group>
  ) : null;
};

// ======================================================================
// Máquina (poço de cima): motor, freio de serviço, redutor, corrente menor, eixo, rodas, freio auxiliar
// ======================================================================
export const MCH = {
  shaft: [E.XT, E.yT - E.Rc] as P2,
  gear: [E.XT + 1.35, E.H - 1.22] as P2,
  zDrive: 0.92,
  rDrive: 0.3,
  rGear: 0.12,
  motorZ0: 0.15,
  motorZ1: 0.78,
};
const DRIVE = beltLoop(MCH.shaft, MCH.rDrive, MCH.gear, MCH.rGear, 140);
// ponto do laço da corrente menor mais perto da catraca do motor (de onde ela começa a ser passada)
const DRIVE_START = (() => {
  let best = 0, bd = 1e9;
  for (let u = 0; u < DRIVE.L; u += 0.01) {
    const q = DRIVE.at(u);
    const d = Math.hypot(q.x - MCH.gear[0], q.y - MCH.gear[1] - MCH.rGear);
    if (d < bd) {
      bd = d;
      best = u;
    }
  }
  return best;
})();
export const DRIVE_LOOP = DRIVE;

export const Machine: React.FC<{
  t: number;
  s: number; // posição da corrente dos degraus
  show: number;
  motorS?: number; // posição "do motor" (fica parado se a corrente menor arrebentar)
  snap?: number; // segundos desde a ruptura da corrente menor (<0 = inteira)
  brake1?: number;
  clamp1?: number; // 0 solto, 1 apertado
  brake2?: number;
  clamp2?: number;
  glowMotor?: number;
  glowDrive?: number;
  glowWheels?: number;
  glowBrake1?: number;
  glowBrake2?: number;
  glowSpring?: number;
  sparks2?: number;
  motorIn?: number; // 0..1: motor entra deslizando e encaixa
  drive?: number; // 0..1: corrente menor sendo passada da catraca do motor até a roda grande
  hwShow?: number; // roda de atrito do corrimão
  vel?: number; // velocidade da corrente dos degraus (m/s), para o desfoque de movimento
  magnet?: number; // 0..1 eletroímã energizado (puxa as sapatas)
}> = ({ t, s, show, motorS, snap = -1, brake1 = 0, clamp1 = 0, brake2 = 0, clamp2 = 0, glowMotor = 0, glowDrive = 0, glowWheels = 0, glowBrake1 = 0, glowBrake2 = 0, glowSpring = 0, sparks2 = 0, motorIn = 1, drive = 1, hwShow = 1, vel = 0, magnet = 0 }) => {
  if (show <= 0.01) return null;
  const vf = Math.abs(vel) / 30; // m por quadro
  const shaftBlur = vf / E.Rc > ((2 * Math.PI) / Math.round((2 * Math.PI * E.Rc) / (PITCH / 3))) * 0.35 ? 1 : 0;
  const mIn = cl(motorIn);
  // o motor desce pelo alçapão aberto e encaixa na base (com um quique pequeno)
  const mOff: V3 = [0, (1 - mIn) * 1.9 - Math.sin(mIn * Math.PI) * 0.0 + (mIn > 0.92 ? Math.sin((mIn - 0.92) * 40) * 0.01 : 0), 0];
  const ms = motorS ?? s;
  const shaftA = -s / E.Rc;
  const gearA = (-ms / E.Rc) * (MCH.rDrive / MCH.rGear);
  const motorA = gearA * 9;
  const driveS = (-ms / E.Rc) * MCH.rDrive; // deslocamento da corrente menor
  const [mx, my] = MCH.gear;
  const broken = snap >= 0;
  const cutU = DRIVE.L * 0.33;
  return (
    <group scale={[1, 1, 1]} position={[0, 0, 0]}>
      {/* eixo principal + rodas que puxam (nas duas correntes) */}
      <mesh position={[MCH.shaft[0], MCH.shaft[1], 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 2.4, 14]} />
        <meshStandardMaterial color="#9AA3AB" metalness={0.7} roughness={0.3} />
      </mesh>
      {[-E.zChain, E.zChain].map((z) => (
        <Sprocket key={z} position={[MCH.shaft[0], MCH.shaft[1], z]} r={E.Rc} teeth={Math.round((2 * Math.PI * E.Rc) / (PITCH / 3))} angle={shaftA} width={0.05} glow={glowWheels} blur={shaftBlur} />
      ))}
      {/* roda grande da corrente menor */}
      <Sprocket position={[MCH.shaft[0], MCH.shaft[1], MCH.zDrive]} r={MCH.rDrive} teeth={30} angle={shaftA} width={0.035} color="#6E767E" glow={glowDrive * 0.5} blur={vf / E.Rc > ((2 * Math.PI) / 30) * 0.35 ? 1 : 0} />
      {/* redutor + motor (descem pelo alçapão e encaixam) */}
      {mIn > 0.01 ? (
      <group position={[mx + mOff[0], my + mOff[1], mOff[2]]}>
        <mesh position={[0, -0.02, MCH.zDrive - 0.12]} castShadow>
          <boxGeometry args={[0.46, 0.5, 0.16]} />
          <meshStandardMaterial color="#2F6FB5" roughness={0.45} metalness={0.25} emissive="#FFC21F" emissiveIntensity={glowMotor * 0.6} />
        </mesh>
        <Sprocket position={[0, 0, MCH.zDrive]} r={MCH.rGear} teeth={13} angle={gearA} width={0.035} color="#6E767E" glow={glowDrive * 0.5} blur={((vf / E.Rc) * MCH.rDrive) / MCH.rGear > ((2 * Math.PI) / 13) * 0.35 ? 1 : 0} />
        {/* motor (corpo com aletas) */}
        <group position={[0.02, -0.02, (MCH.motorZ0 + MCH.motorZ1) / 2]}>
          <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[0.24, 0.24, MCH.motorZ1 - MCH.motorZ0, 28]} />
            <meshStandardMaterial color="#2F6FB5" roughness={0.42} metalness={0.3} emissive="#FFC21F" emissiveIntensity={glowMotor} />
          </mesh>
          {Array.from({ length: 16 }).map((_, i) => {
            const a = (i / 16) * Math.PI * 2;
            return (
              <mesh key={i} position={[Math.cos(a) * 0.255, Math.sin(a) * 0.255, 0]} rotation={[0, 0, a]}>
                <boxGeometry args={[0.04, 0.02, MCH.motorZ1 - MCH.motorZ0 - 0.06]} />
                <meshStandardMaterial color="#285F9C" roughness={0.45} emissive="#FFC21F" emissiveIntensity={glowMotor * 0.8} />
              </mesh>
            );
          })}
          <mesh position={[0, -0.27, 0]}>
            <boxGeometry args={[0.36, 0.06, 0.5]} />
            <meshStandardMaterial color="#3A3F45" roughness={0.6} />
          </mesh>
          <mesh position={[0, 0.28, 0.1]}>
            <boxGeometry args={[0.14, 0.08, 0.16]} />
            <meshStandardMaterial color="#26292E" roughness={0.6} />
          </mesh>
        </group>
        {/* disco do freio de serviço na traseira do motor */}
        {brake1 > 0.01 ? (
          <group position={[0.02, -0.02, MCH.motorZ0 - 0.05 - (1 - Math.min(1, brake1)) * 0.9]}>
            <group rotation={[0, 0, motorA]}>
              <mesh rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.2, 0.2, 0.025, 30]} />
                <meshStandardMaterial color="#B8C0C7" metalness={0.75} roughness={0.25} emissive="#FF5A1A" emissiveIntensity={clamp1 * 0.1} />
              </mesh>
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <mesh key={i} position={[Math.cos(i) * 0.12, Math.sin(i) * 0.12, -0.014]}>
                  <boxGeometry args={[0.03, 0.03, 0.005]} />
                  <meshStandardMaterial color="#5C636A" />
                </mesh>
              ))}
            </group>
            {/* sapatas dos dois lados (apertadas pela mola, soltas pelo eletroímã) */}
            {[-1, 1].map((sd) => (
              <group key={sd} position={[sd * (0.26 + (1 - clamp1) * 0.05), 0.0, 0]}>
                <mesh>
                  <boxGeometry args={[0.05, 0.16, 0.08]} />
                  <meshStandardMaterial color="#D04A2B" roughness={0.6} emissive="#FFC21F" emissiveIntensity={glowBrake1} />
                </mesh>
                <mesh position={[sd * 0.06, 0, 0]}>
                  <boxGeometry args={[0.07, 0.3, 0.06]} />
                  <meshStandardMaterial color="#3B4047" metalness={0.3} roughness={0.5} />
                </mesh>
                <Spring position={[sd * (0.4 + (1 - clamp1) * 0.05), 0.0, 0]} len={0.16 - (1 - clamp1) * 0.04} r={0.045} rot={[0, sd > 0 ? Math.PI : 0, 0]} glow={glowSpring} />
              </group>
            ))}
            {/* eletroímã (bobina azul): com eletricidade acende e puxa as sapatas */}
            <mesh position={[0, 0.27, 0]}>
              <boxGeometry args={[0.3, 0.12, 0.12]} />
              <meshStandardMaterial color="#1F6FD8" roughness={0.45} emissive="#5FB0FF" emissiveIntensity={0.05 + magnet * 0.9} />
            </mesh>
            {[-1, 1].map((sd) => (
              <mesh key={`fio${sd}`} position={[sd * 0.2, 0.15, 0]} rotation={[0, 0, sd * 0.6]}>
                <cylinderGeometry args={[0.008, 0.008, 0.22, 6]} />
                <meshStandardMaterial color="#1F6FD8" roughness={0.5} emissive="#5FB0FF" emissiveIntensity={magnet * 0.6} />
              </mesh>
            ))}
          </group>
        ) : null}
      </group>
      ) : null}
      {/* corrente menor: liga o redutor à roda grande (é passada da catraca do motor até a roda grande) */}
      {drive > 0.004 || broken ? (
      <RollerChain
        at={DRIVE.at}
        L={DRIVE.L}
        s={driveS}
        z={MCH.zDrive}
        pitch={0.06}
        size={1.6}
        color="#4A5057"
        glow={glowDrive}
        vel={(vf / E.Rc) * MCH.rDrive}
        cut={
          broken
            ? (u) => Math.abs(u - cutU) < 0.06 + Math.min(0.25, snap * 0.6)
            : drive < 0.999
              ? (u) => ((((u - driveS - DRIVE_START) % DRIVE.L) + DRIVE.L) % DRIVE.L) > cl(drive) * DRIVE.L
              : undefined
        }
      />
      ) : null}
      {broken && snap < 2.5 ? <BrokenLinks t={t} snap={snap} origin={DRIVE.at(cutU)} z={MCH.zDrive} /> : null}
      {broken && snap < 0.35 ? <Glow position={[DRIVE.at(cutU).x, DRIVE.at(cutU).y, MCH.zDrive + 0.05]} size={1.4 * (1 - snap / 0.35)} color="#FFE2A0" opacity={0.95} /> : null}
      {broken && snap < 0.8 ? <SparkSpray t={t} origin={[DRIVE.at(cutU).x, DRIVE.at(cutU).y, MCH.zDrive]} amount={1} n={30} up={1} spread={0.4} scale={0.5} seed={88} /> : null}
      {/* freio auxiliar: disco com catraca no eixo principal (lado oposto) + sensor de velocidade */}
      {brake2 > 0.01 ? (
        <group position={[MCH.shaft[0], MCH.shaft[1], 1.1 + (1 - Math.min(1, brake2)) * 0.8]}>
          <Sprocket position={[0, 0, 0]} r={0.27} teeth={18} angle={shaftA} width={0.05} color="#C4372A" glow={glowBrake2} glowColor="#FFC21F" hub={false} />
          {/* lingueta (trava) */}
          <group position={[0.42, 0.26, 0]} rotation={[0, 0, 0.9 - clamp2 * 0.55]}>
            <mesh position={[-0.14, 0, 0]}>
              <boxGeometry args={[0.3, 0.07, 0.07]} />
              <meshStandardMaterial color="#F2C230" roughness={0.45} emissive="#FFC21F" emissiveIntensity={glowBrake2} />
            </mesh>
          </group>
          <mesh position={[0.45, 0.3, 0]}>
            <boxGeometry args={[0.16, 0.16, 0.12]} />
            <meshStandardMaterial color="#2C3036" roughness={0.6} />
          </mesh>
          {sparks2 > 0.01 ? <SparkSpray t={t} origin={[0.22, 0.18, 0.02]} amount={sparks2} n={26} up={1} spread={0.3} scale={0.45} seed={91} /> : null}
          {/* sensor de velocidade (disco dentado + leitor) */}
          <mesh position={[0, -0.36, 0.0]}>
            <boxGeometry args={[0.12, 0.1, 0.1]} />
            <meshStandardMaterial color="#1F6FD8" roughness={0.5} emissive="#5FB0FF" emissiveIntensity={glowBrake2 * 0.4} />
          </mesh>
        </group>
      ) : null}
      {/* roda de atrito do corrimão (dos dois lados) */}
      {hwShow > 0.01
        ? [-0.6, 0.6].map((z) => <Sprocket key={`hw${z}`} position={[HR.wheel[0], HR.wheel[1], z]} r={0.24} teeth={0} angle={-s / 0.24} width={0.1} color="#3A3F45" hub={vf / 0.24 < 0.25} />)
        : null}
    </group>
  );
};

const BrokenLinks: React.FC<{ t: number; snap: number; origin: { x: number; y: number }; z: number }> = ({ snap, origin, z }) => {
  const mats: THREE.Matrix4[] = [];
  for (let i = 0; i < 14; i++) {
    const a = rnd(i, 71) * Math.PI * 2;
    const v = 1.5 + rnd(i, 72) * 2.5;
    const x = origin.x + Math.cos(a) * v * snap;
    const y = origin.y + Math.abs(Math.sin(a)) * v * snap * 1.2 - 4.9 * snap * snap;
    const zz = z + (rnd(i, 73) - 0.3) * v * snap;
    if (y < E.H - 1.9) continue;
    mats.push(mat([x, y, zz], [snap * 9 + i, snap * 7, i], [0.05, 0.025, 0.012]));
  }
  return (
    <InstM mats={mats} geo={unitBox} max={14} cast={false}>
      <meshStandardMaterial color="#5A6168" metalness={0.6} roughness={0.35} emissive="#FF8A1E" emissiveIntensity={Math.max(0, 1 - snap * 1.2)} />
    </InstM>
  );
};

// Sensor do corrimão (roda que encosta no corrimão + caixa com LED), perto da boca de cima.
export const HandrailSensor: React.FC<{ show: number; hs: number; glow?: number; alarm?: number }> = ({ show, hs, glow = 0, alarm = 0 }) => {
  if (show <= 0.01) return null;
  const x = XN_T - 0.75;
  const y = hrY(x);
  const rise = 1 - Math.min(1, show);
  return (
    <group position={[x, y - rise * 0.6, 0.6]}>
      {/* braçadeira que prende o sensor ao corrimão */}
      <mesh position={[0, -0.05, 0.045]}>
        <boxGeometry args={[0.05, 0.12, 0.02]} />
        <meshStandardMaterial color="#9AA3AA" metalness={0.6} roughness={0.3} />
      </mesh>
      {/* cabo de leitura (desce até a máquina pela boca do corrimão) */}
      <mesh position={[0.22, -0.2, 0]} rotation={[0, 0, Math.PI / 2 - 0.18]}>
        <cylinderGeometry args={[0.008, 0.008, 0.45, 6]} />
        <meshStandardMaterial color="#1F6FD8" roughness={0.5} />
      </mesh>
      <mesh position={[0, -0.1, 0]} rotation={[Math.PI / 2, 0, -hs / 0.035]}>
        <cylinderGeometry args={[0.035, 0.035, 0.03, 14]} />
        <meshStandardMaterial color="#C9D0D5" metalness={0.6} roughness={0.3} />
      </mesh>
      <mesh position={[0, -0.18, 0]}>
        <boxGeometry args={[0.14, 0.09, 0.08]} />
        <meshStandardMaterial color="#1F6FD8" roughness={0.45} emissive="#5FB0FF" emissiveIntensity={glow * 0.6} />
      </mesh>
      <mesh position={[0.04, -0.18, 0.042]}>
        <sphereGeometry args={[0.012, 8, 6]} />
        <meshBasicMaterial color={alarm > 0.5 ? "#FF2A1A" : "#3DFF6A"} toneMapped={false} />
      </mesh>
    </group>
  );
};

// ======================================================================
// Poços (concreto) e tampas de piso
// ======================================================================
export const Pits: React.FC<{ xray: number }> = ({ xray }) => (
  <group>
    {/* poço de cima (casa de máquinas) */}
    <group>
      <mesh position={[E.XT + 0.85, E.H - 1.95, 0]} receiveShadow>
        <boxGeometry args={[3.3, 0.12, 2.4]} />
        <meshStandardMaterial color="#A7A39B" roughness={0.95} />
      </mesh>
      <mesh position={[E.XT + 2.5, E.H - 1.0, 0]} receiveShadow>
        <boxGeometry args={[0.12, 1.9, 2.4]} />
        <meshStandardMaterial color="#B3AEA5" roughness={0.95} />
      </mesh>
      <mesh position={[E.XT + 0.85, E.H - 1.0, -1.2]} receiveShadow>
        <boxGeometry args={[3.3, 1.9, 0.12]} />
        <meshStandardMaterial color="#B9B4AB" roughness={0.95} />
      </mesh>
      <mesh position={[E.XT + 0.85, E.H - 1.0, 1.2]} visible={xray < 0.95}>
        <boxGeometry args={[3.3, 1.9, 0.12]} />
        <meshStandardMaterial color="#F2EDE4" roughness={0.9} transparent={xray > 0.01} opacity={1 - xray} depthWrite={xray < 0.5} />
      </mesh>
    </group>
    {/* poço de baixo */}
    <group>
      <mesh position={[E.XB - 0.6, -1.85, 0]} receiveShadow>
        <boxGeometry args={[2.4, 0.12, 2.4]} />
        <meshStandardMaterial color="#A7A39B" roughness={0.95} />
      </mesh>
      <mesh position={[E.XB - 1.8, -0.95, 0]} receiveShadow>
        <boxGeometry args={[0.12, 1.8, 2.4]} />
        <meshStandardMaterial color="#B3AEA5" roughness={0.95} />
      </mesh>
      <mesh position={[E.XB - 0.6, -0.95, -1.2]} receiveShadow>
        <boxGeometry args={[2.4, 1.8, 0.12]} />
        <meshStandardMaterial color="#B9B4AB" roughness={0.95} />
      </mesh>
    </group>
  </group>
);

// ======================================================================
// A ESCADA ROLANTE completa (estado controlado por props)
// ======================================================================
export type EscState = {
  s: number;
  hs?: number;
  stepsVis?: (k: number, u: number) => number;
  stepPose?: StepPoseFn;
  stepGlow?: number;
  stepGlowK?: (k: number) => number;
  onlyCarry?: boolean;
  grooves?: number;
  yellow?: number;
  chain?: number;
  chainGlow?: number;
  axle?: number;
  wheels?: number;
  tracks?: number;
  trackColor?: number;
  trackGlow?: number;
  truss?: number;
  trussGlow?: number;
  cladding?: number;
  skirt?: number;
  skirtXray?: number;
  edgeRed?: number;
  machine?: number;
  motorS?: number;
  snap?: number;
  brake1?: number;
  clamp1?: number;
  brake2?: number;
  clamp2?: number;
  sparks2?: number;
  glowMotor?: number;
  glowDrive?: number;
  glowWheels?: number;
  glowBrake1?: number;
  glowBrake2?: number;
  glowSpring?: number;
  balustrade?: number;
  handrail?: number;
  hrMarks?: number;
  hrHidden?: number;
  hrGlow?: number;
  sensor?: number;
  sensorGlow?: number;
  brushes?: number;
  brushGlow?: number;
  brushBendX?: number;
  brushBend?: number;
  brushTuftGlow?: number;
  brushBendAmp?: number;
  comb?: number;
  combRecoil?: number;
  combGlow?: number;
  combLed?: number;
  guard?: number;
  guardPush?: number;
  guardGlow?: number;
  guardLed?: number;
  button?: number;
  buttonCover?: number;
  buttonPress?: number;
  buttonGlow?: number;
  sticker?: number;
  pits?: number;
  pitXray?: number;
  // r16
  v?: number; // velocidade da corrente (m/s) para o desfoque
  motorIn?: number;
  drive?: number;
  hwShow?: number;
  magnet?: number;
  plates?: number; // placas de piso das pontas (base do pente) existem?
  sprocketB?: number; // rodas dentadas das pontas (entram com a corrente)
  sprocketT?: number;
  skirtShow?: number;
};

export const Escalator: React.FC<{ t: number; st: EscState }> = ({ t, st }) => {
  const hs = st.hs ?? st.s * 1.02;
  return (
    <group>
      <Steps
        s={st.s}
        vis={st.stepsVis}
        pose={st.stepPose}
        grooves={st.grooves ?? 0}
        yellow={st.yellow ?? 0}
        wheels={st.wheels ?? 0}
        axle={st.chain ?? 0}
        glow={st.stepGlow ?? 0}
        glowK={st.stepGlowK}
        onlyCarry={st.onlyCarry}
      />
      <StepChain s={st.s} show={st.chain ?? 0} glow={st.chainGlow ?? 0} vel={Math.abs(st.v ?? 0) / 30} />
      {(st.sprocketB ?? (st.chain ?? 0)) > 0.01 ? (
        <group scale={1}>
          {[-E.zChain, E.zChain].map((z) => (
            <group key={z} position={[E.XB, E.yB - E.Rc, z + Math.sign(z) * (1 - Math.min(1, st.sprocketB ?? 1)) * 0.9]}>
              <Sprocket position={[0, 0, 0]} r={E.Rc} teeth={Math.round((2 * Math.PI * E.Rc) / (PITCH / 3))} angle={-st.s / E.Rc} width={0.05} glow={(st.chainGlow ?? 0) * 0.5} blur={Math.abs(st.v ?? 0) / 30 / E.Rc > 0.13 ? 1 : 0} />
            </group>
          ))}
        </group>
      ) : null}
      {(st.machine ?? 0) < 0.01 && (st.sprocketT ?? 0) > 0.01
        ? [-E.zChain, E.zChain].map((z) => (
            <group key={`t${z}`} position={[E.XT, E.yT - E.Rc, z + Math.sign(z) * (1 - Math.min(1, st.sprocketT ?? 1)) * 0.9]}>
              <Sprocket position={[0, 0, 0]} r={E.Rc} teeth={Math.round((2 * Math.PI * E.Rc) / (PITCH / 3))} angle={-st.s / E.Rc} width={0.05} glow={(st.chainGlow ?? 0) * 0.5} />
            </group>
          ))
        : null}
      <Tracks show={st.tracks ?? 0} colored={st.trackColor ?? 0} glow={st.trackGlow ?? 0} />
      <Truss show={st.truss ?? 0} glow={st.trussGlow ?? 0} />
      <Cladding show={st.cladding ?? 0} />
      {(st.skirt ?? 1) > 0.01 ? <Skirt xray={st.skirtXray ?? 0} show={st.skirt ?? 1} glowRed={0} /> : null}
      <EdgeGlow amount={st.edgeRed ?? 0} />
      <Machine
        t={t}
        s={st.s}
        show={st.machine ?? 0}
        motorS={st.motorS}
        snap={st.snap ?? -1}
        brake1={st.brake1 ?? 0}
        clamp1={st.clamp1 ?? 0}
        brake2={st.brake2 ?? 0}
        clamp2={st.clamp2 ?? 0}
        sparks2={st.sparks2 ?? 0}
        glowMotor={st.glowMotor}
        glowDrive={st.glowDrive}
        glowWheels={st.glowWheels}
        glowBrake1={st.glowBrake1}
        glowBrake2={st.glowBrake2}
        glowSpring={st.glowSpring}
        motorIn={st.motorIn}
        drive={st.drive}
        hwShow={st.hwShow}
        vel={st.v}
        magnet={st.magnet}
      />
      <Balustrade show={st.balustrade ?? 0} handrail={st.handrail ?? 0} hs={hs} marks={st.hrMarks ?? 0} hidden={st.hrHidden ?? 0} glow={st.hrGlow ?? 0} />
      {(st.handrail ?? 0) > 0.01 ? (
        <group>
          {[-0.6, 0.6].map((z) => (
            <group key={z}>
              <Inlet top z={z} guard={st.guard ?? 0} push={st.guardPush ?? 0} glow={st.guardGlow ?? 0} led={st.guardLed ?? 0} />
              <Inlet top={false} z={z} guard={st.guard ?? 0} />
            </group>
          ))}
        </group>
      ) : null}
      <HandrailSensor show={st.sensor ?? 0} hs={hs} glow={st.sensorGlow ?? 0} />
      <Brushes show={st.brushes ?? 0} glow={st.brushGlow ?? 0} tuftGlow={st.brushTuftGlow} bendX={st.brushBendX ?? 0} bend={st.brushBend ?? 0} amp={st.brushBendAmp ?? 1} />
      <Comb top show={st.comb ?? 0} recoil={st.combRecoil ?? 0} glow={st.combGlow ?? 0} led={st.combLed ?? 0} base={st.plates ?? 1} />
      <Comb top={false} show={st.comb ?? 0} glow={st.combGlow ?? 0} base={st.plates ?? 1} />
      <StopButton top show={st.button ?? 0} cover={st.buttonCover ?? 0} press={st.buttonPress ?? 0} glow={st.buttonGlow ?? 0} />
      <StopButton top={false} show={st.button ?? 0} glow={st.buttonGlow ?? 0} />
      {(st.sticker ?? 0) > 0.01 ? (
        <mesh position={[XN_B + 0.12, 0.62, 0.6]} rotation={[0, 0, 0]} scale={st.sticker}>
          <planeGeometry args={[0.32, 0.32]} />
          <meshStandardMaterial map={stickerTex()} roughness={0.6} side={THREE.DoubleSide} polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-4} />
        </mesh>
      ) : null}
      {(st.pits ?? 1) > 0.01 ? <Pits xray={st.pitXray ?? 0} /> : null}
    </group>
  );
};

// ======================================================================
// SHOPPING (2 andares, vitrines, praça de alimentação, claraboia)
// ======================================================================
export const MALL = { x0: -15, x1: 15, z0: -10, z1: 12, H: E.H, roof: 9.6 };
const SHOPS_G = [
  { x0: -15, x1: -10, name: "CAFÉ", c: "#8A4B2A", in: "#F3D9B5" },
  { x0: -10, x1: -5, name: "MODA", c: "#D6336C", in: "#FCE4EC" },
  { x0: -5, x1: 0, name: "TÊNIS", c: "#1F6FD8", in: "#E3F0FF" },
  { x0: 0, x1: 5, name: "BRINQUEDOS", c: "#F28C1E", in: "#FFF1D6" },
  { x0: 5, x1: 10, name: "MERCADO", c: "#2FA84F", in: "#E8F7EA" },
  { x0: 10, x1: 15, name: "LIVROS", c: "#7B4BC4", in: "#F0E8FB" },
];
const SHOPS_U = [
  { x0: -15, x1: -10, name: "ÓTICA", c: "#0E9AA7", in: "#E0F7F8" },
  { x0: -10, x1: -5, name: "CELULAR", c: "#2C3E50", in: "#E9EEF2" },
  { x0: -5, x1: 0, name: "PERFUMES", c: "#C2185B", in: "#FCE4EC" },
  { x0: 0, x1: 5, name: "GAMES", c: "#5E35B1", in: "#EDE7F6" },
  { x0: 5, x1: 10, name: "ESPORTES", c: "#E53935", in: "#FFEBEE" },
  { x0: 10, x1: 15, name: "CINEMA", c: "#212121", in: "#ECEFF1" },
];
const SHOP_Z = -7.4;

const ShopRow: React.FC<{ y: number; shops: typeof SHOPS_G; dark: number }> = ({ y, shops, dark }) => {
  const prods = useMemo(() => {
    const m: THREE.Matrix4[] = [], c: string[] = [];
    shops.forEach((sh, i) => {
      for (let r = 0; r < 3; r++)
        for (let k = 0; k < 9; k++) {
          const x = sh.x0 + 0.6 + k * 0.42;
          const yy = y + 0.6 + r * 0.7;
          const hh = 0.18 + rnd(i * 31 + r * 9 + k, 5) * 0.25;
          m.push(mat([x, yy + hh / 2, -9.55], [0, 0, 0], [0.3, hh, 0.28]));
          c.push(["#E8483B", "#F2C230", "#2E6FD8", "#3DAA66", "#F2F2F0", "#FF8A1E", "#9B59B6"][Math.floor(rnd(i * 13 + r * 7 + k, 6) * 7)]);
        }
    });
    return { m, c };
  }, [shops, y]);
  const shelves = useMemo(() => {
    const m: THREE.Matrix4[] = [];
    shops.forEach((sh) => {
      for (let r = 0; r < 3; r++) m.push(mat([(sh.x0 + sh.x1) / 2, y + 0.55 + r * 0.7, -9.55], [0, 0, 0], [sh.x1 - sh.x0 - 0.6, 0.05, 0.5]));
    });
    return m;
  }, [shops, y]);
  const lit = 1 - dark;
  return (
    <group>
      {shops.map((sh, i) => {
        const w = sh.x1 - sh.x0;
        const cx = (sh.x0 + sh.x1) / 2;
        return (
          <group key={i}>
            {/* interior */}
            <mesh position={[cx, y + 0.01, (SHOP_Z - 10) / 2]} receiveShadow>
              <boxGeometry args={[w - 0.1, 0.02, 10 + SHOP_Z]} />
              <meshStandardMaterial color={shade(sh.in, -0.05)} roughness={0.8} />
            </mesh>
            <mesh position={[cx, y + 1.9, -9.94]}>
              <planeGeometry args={[w - 0.1, 3.8]} />
              <meshStandardMaterial color={sh.in} roughness={0.9} emissive={sh.in} emissiveIntensity={0.25 * lit} />
            </mesh>
            {/* divisórias */}
            <mesh position={[sh.x0 + 0.05, y + 1.95, (SHOP_Z - 10) / 2]}>
              <boxGeometry args={[0.1, 3.9, 10 + SHOP_Z]} />
              <meshStandardMaterial color="#E9E2D6" roughness={0.9} />
            </mesh>
            {/* vitrine: vidro + caixilhos */}
            <mesh position={[cx, y + 1.5, SHOP_Z]}>
              <planeGeometry args={[w - 0.2, 3.0]} />
              <meshStandardMaterial color="#BFE6F5" transparent opacity={0.22} roughness={0.05} side={THREE.DoubleSide} depthWrite={false} />
            </mesh>
            {[0.15, w / 2 - 0.6, w / 2 + 0.6, w - 0.15].map((dx, j) => (
              <mesh key={j} position={[sh.x0 + dx, y + 1.5, SHOP_Z]}>
                <boxGeometry args={[0.06, 3.0, 0.06]} />
                <meshStandardMaterial color="#5B636B" metalness={0.5} roughness={0.35} />
              </mesh>
            ))}
            <mesh position={[cx, y + 0.04, SHOP_Z]}>
              <boxGeometry args={[w - 0.1, 0.08, 0.1]} />
              <meshStandardMaterial color="#5B636B" metalness={0.5} roughness={0.35} />
            </mesh>
            {/* letreiro */}
            <mesh position={[cx, y + 3.35, SHOP_Z + 0.06]}>
              <boxGeometry args={[w - 0.3, 0.62, 0.12]} />
              <meshStandardMaterial color={sh.c} roughness={0.5} />
            </mesh>
            <mesh position={[cx, y + 3.35, SHOP_Z + 0.125]}>
              <planeGeometry args={[Math.min(w - 0.5, 3.6), 0.62 * (Math.min(w - 0.5, 3.6) / 3.6)]} />
              <meshStandardMaterial map={signTex(sh.name, sh.c)} roughness={0.5} emissive="#FFFFFF" emissiveMap={signTex(sh.name, sh.c)} emissiveIntensity={0.35 * lit} polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-4} />
            </mesh>
            {/* manequim / expositor na frente */}
            <mesh position={[cx - 1.2, y + 0.6, SHOP_Z - 0.8]} castShadow>
              <boxGeometry args={[0.9, 1.2, 0.5]} />
              <meshStandardMaterial color={shade(sh.c, 0.25)} roughness={0.7} />
            </mesh>
            <mesh position={[cx + 1.3, y + 0.45, SHOP_Z - 1.0]} castShadow>
              <cylinderGeometry args={[0.35, 0.35, 0.9, 16]} />
              <meshStandardMaterial color="#FFFFFF" roughness={0.6} />
            </mesh>
          </group>
        );
      })}
      <InstM mats={shelves} geo={unitBox} cast={false}>
        <meshStandardMaterial color="#D9D2C6" roughness={0.8} />
      </InstM>
      <InstM mats={prods.m} colors={prods.c} geo={unitBox} cast={false}>
        <meshStandardMaterial roughness={0.6} />
      </InstM>
    </group>
  );
};

// Placas de piso (laje) em retângulos, deixando os furos da escada.
const Slab: React.FC<{ x0: number; x1: number; z0: number; z1: number; y: number; th?: number; tex?: boolean; opacity?: number }> = ({ x0, x1, z0, z1, y, th = 0.35, tex = true, opacity = 1 }) => (
  <mesh position={[(x0 + x1) / 2, y - th / 2, (z0 + z1) / 2]} receiveShadow castShadow={opacity > 0.99}>
    <boxGeometry args={[x1 - x0, th, z1 - z0]} />
    <meshStandardMaterial
      map={tex ? mallFloorTex([(x1 - x0) / 2.4, (z1 - z0) / 2.4]) : undefined}
      color={tex ? "#FFFFFF" : "#CFC8BC"}
      roughness={0.35}
      metalness={0.05}
      transparent={opacity < 0.99}
      opacity={opacity}
      depthWrite={opacity > 0.5}
    />
  </mesh>
);

const Railing: React.FC<{ a: P2; b: P2; y: number }> = ({ a, b, y }) => {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
  const posts = Math.max(2, Math.round(L / 1.6));
  return (
    <group position={[(a[0] + b[0]) / 2, y, (a[1] + b[1]) / 2]} rotation={[0, -ang, 0]}>
      <mesh position={[0, 0.55, 0]}>
        <planeGeometry args={[L, 0.95]} />
        <meshStandardMaterial color="#CFEFFF" transparent opacity={0.22} side={THREE.DoubleSide} depthWrite={false} roughness={0.05} />
      </mesh>
      <mesh position={[0, 1.05, 0]}>
        <boxGeometry args={[L, 0.06, 0.08]} />
        <meshStandardMaterial color="#B9C1C7" metalness={0.6} roughness={0.25} />
      </mesh>
      {Array.from({ length: posts + 1 }).map((_, i) => (
        <mesh key={i} position={[-L / 2 + (i * L) / posts, 0.52, 0]}>
          <boxGeometry args={[0.05, 1.04, 0.05]} />
          <meshStandardMaterial color="#9AA3AA" metalness={0.6} roughness={0.3} />
        </mesh>
      ))}
    </group>
  );
};

const Planter: React.FC<{ p: V3; s?: number; seed?: number }> = ({ p, s = 1, seed = 0 }) => (
  <group position={p} scale={s}>
    <mesh position={[0, 0.35, 0]} castShadow receiveShadow>
      <cylinderGeometry args={[0.6, 0.5, 0.7, 18]} />
      <meshStandardMaterial color="#E9E2D6" roughness={0.6} />
    </mesh>
    <mesh position={[0, 0.69, 0]}>
      <cylinderGeometry args={[0.55, 0.55, 0.04, 18]} />
      <meshStandardMaterial color="#5A3E2B" roughness={1} />
    </mesh>
    <mesh position={[0, 1.4, 0]} castShadow>
      <cylinderGeometry args={[0.06, 0.09, 1.4, 8]} />
      <meshStandardMaterial color={C.trunk} roughness={0.9} />
    </mesh>
    {[0, 1, 2, 3, 4].map((i) => (
      <mesh key={i} position={[Math.cos(i * 1.3 + seed) * 0.35, 2.1 + (i % 2) * 0.35, Math.sin(i * 1.3 + seed) * 0.35]} castShadow>
        <icosahedronGeometry args={[0.55 - (i % 3) * 0.08, 0]} />
        <meshStandardMaterial color={i % 2 ? C.leaf : C.leafDark} roughness={0.85} flatShading />
      </mesh>
    ))}
  </group>
);

const Kiosk: React.FC<{ p: V3; name: string; c: string }> = ({ p, name, c }) => (
  <group position={p}>
    <mesh position={[0, 0.55, 0]} castShadow receiveShadow>
      <boxGeometry args={[1.8, 1.1, 1.1]} />
      <meshStandardMaterial color="#FFFFFF" roughness={0.5} />
    </mesh>
    <mesh position={[0, 0.85, 0.56]}>
      <boxGeometry args={[1.82, 0.3, 0.02]} />
      <meshStandardMaterial color={c} roughness={0.5} />
    </mesh>
    {[-0.8, 0.8].map((x) => (
      <mesh key={x} position={[x, 1.6, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 1.0, 8]} />
        <meshStandardMaterial color="#9AA3AA" metalness={0.5} />
      </mesh>
    ))}
    <mesh position={[0, 2.15, 0]} castShadow>
      <boxGeometry args={[2.1, 0.12, 1.4]} />
      <meshStandardMaterial color={c} roughness={0.5} />
    </mesh>
    <mesh position={[0, 2.45, 0]}>
      <boxGeometry args={[1.6, 0.42, 0.08]} />
      <meshStandardMaterial color="#FFFFFF" roughness={0.5} />
    </mesh>
    <mesh position={[0, 2.45, 0.045]}>
      <planeGeometry args={[1.5, 0.3]} />
      <meshStandardMaterial map={signTex(name, c)} roughness={0.5} polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-4} />
    </mesh>
  </group>
);

const FoodCourt: React.FC = () => (
  <group>
    {[
      [-13.4, -4.8],
      [-10.6, -4.2],
      [-13.0, -1.2],
      [-10.4, -0.8],
      [-12.6, 2.2],
      [-10.4, 4.4],
      [-13.2, 6.0],
      [-10.8, 8.2],
      [-13.4, 9.8],
      [12.4, 5.6],
      [9.6, 6.6],
    ].map(([x, z], i) => (
      <group key={i} position={[x, 0, z]}>
        <mesh position={[0, 0.74, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.55, 0.55, 0.05, 20]} />
          <meshStandardMaterial color="#FFFFFF" roughness={0.5} />
        </mesh>
        <mesh position={[0, 0.37, 0]}>
          <cylinderGeometry args={[0.05, 0.05, 0.74, 8]} />
          <meshStandardMaterial color="#5B636B" metalness={0.5} />
        </mesh>
        {[0, 1, 2, 3].map((k) => {
          const a = (k / 4) * Math.PI * 2 + i;
          return (
            <group key={k} position={[Math.cos(a) * 0.85, 0, Math.sin(a) * 0.85]} rotation={[0, -a + Math.PI / 2, 0]}>
              <mesh position={[0, 0.45, 0]} castShadow>
                <boxGeometry args={[0.42, 0.06, 0.42]} />
                <meshStandardMaterial color={["#FF8A1E", "#2E6FD8", "#3DAA66", "#E8483B"][(k + i) % 4]} roughness={0.6} />
              </mesh>
              <mesh position={[0, 0.72, -0.19]}>
                <boxGeometry args={[0.42, 0.5, 0.05]} />
                <meshStandardMaterial color={["#FF8A1E", "#2E6FD8", "#3DAA66", "#E8483B"][(k + i) % 4]} roughness={0.6} />
              </mesh>
            </group>
          );
        })}
      </group>
    ))}
  </group>
);

// Escada fixa (só no gancho): degraus de concreto/granito com corrimão.
// escada comum: atrás do vão (fica sempre no cenário, nunca entra/sai por corte)
export const STAIR_Z = -2.1;
export const FixedStair: React.FC = () => {
  const steps = useMemo(() => {
    const m: THREE.Matrix4[] = [];
    const n = 26;
    for (let i = 0; i < n; i++) {
      const x = -1.4 - i * (7.6 / n);
      const y = (i + 1) * (E.H / n);
      m.push(mat([x, y / 2, STAIR_Z], [0, 0, 0], [7.6 / n + 0.02, y, 1.5]));
    }
    return m;
  }, []);
  return (
    <group>
      <InstM mats={steps} geo={unitBox}>
        <meshStandardMaterial color="#D8D2C7" roughness={0.7} />
      </InstM>
      {[STAIR_Z - 0.75, STAIR_Z + 0.75].map((z) => (
        <mesh key={z} position={[-5.2, E.H / 2 + 0.95, z]} rotation={[0, 0, -Math.atan2(E.H, 7.6)]}>
          <boxGeometry args={[8.9, 0.06, 0.06]} />
          <meshStandardMaterial color="#8C949B" metalness={0.6} roughness={0.3} />
        </mesh>
      ))}
    </group>
  );
};

export const Mall: React.FC<{ t: number; xray?: number; dark?: number; stair?: boolean; outside?: boolean; fill?: number; hatch?: number; lite?: boolean }> = ({ xray = 0, dark = 0, stair = true, outside = true, fill = 0, hatch = 0, lite = false }) => {
  const H = E.H;
  const pO = 1 - xray * 0.82;
  const fT = fill < 0.99;
  return (
    <group>
      {/* tampa provisória do furo de baixo (antes de a escada existir); some no raio-x */}
      {fill > 0.01 ? (
        <mesh position={[(XC_B + 0.24 - 1.6) / 2, -0.037, 0]} receiveShadow renderOrder={fT ? 2 : 0}>
          <boxGeometry args={[-1.6 - XC_B - 0.24, 0.05, 1.26]} />
          <meshStandardMaterial map={mallFloorTex([1.7, 0.5])} color="#FFFFFF" roughness={0.35} metalness={0.05} transparent={fT} opacity={fill} depthWrite={!fT} />
        </mesh>
      ) : null}
      {/* chão de fora (se não houver cidade) */}
      {outside ? (
        <mesh position={[0, -0.02, 30]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[90, 36]} />
          <meshStandardMaterial map={checkerTex([1, 1])} color="#C9C4BA" roughness={0.95} />
        </mesh>
      ) : null}
      {/* térreo (furo da escada: x∈[-8.8,-1.6], z∈[-0.9,0.9]) */}
      <Slab x0={-15} x1={15} z0={-10} z1={-2} y={0} th={0.4} />
      <Slab x0={-15} x1={15} z0={2} z1={12} y={0} th={0.4} />
      <Slab x0={-15} x1={-8.8} z0={-2} z1={2} y={0} th={0.4} />
      <Slab x0={-1.6} x1={15} z0={-2} z1={2} y={0} th={0.4} />
      <group>
        <Slab x0={-8.8} x1={-1.6} z0={0.9} z1={2} y={0} th={0.4} opacity={pO} />
        <Slab x0={-8.8} x1={-1.6} z0={-2} z1={-0.9} y={0} th={0.4} opacity={pO} />
        <Slab x0={3.8} x1={8.8} z0={0.9} z1={2} y={H} opacity={pO} />
        <Slab x0={3.8} x1={8.8} z0={-2} z1={-0.9} y={H} opacity={pO} />
      </group>
      {/* tampas do furo de baixo (placa de piso sobre o poço + faixas laterais) */}
      <mesh position={[(-8.8 + XC_B + 0.24) / 2, 0.006, 0]} receiveShadow visible={pO > 0.25}>
        <boxGeometry args={[XC_B + 0.24 + 8.8, 0.025, 1.8]} />
        <meshStandardMaterial map={checkerTex([5, 2])} color="#DCE1E5" metalness={0.45} roughness={0.38} transparent={pO < 0.99} opacity={pO} depthWrite={pO > 0.5} />
      </mesh>
      {[-0.76, 0.76].map((z) => (
        <mesh key={z} position={[(XC_B + 0.24 - 1.6) / 2, 0.006, z]} receiveShadow visible={pO > 0.25}>
          <boxGeometry args={[-1.6 - XC_B - 0.24, 0.025, 0.28]} />
          <meshStandardMaterial color="#C3CAD0" metalness={0.45} roughness={0.38} transparent={pO < 0.99} opacity={pO} depthWrite={pO > 0.5} />
        </mesh>
      ))}
      {/* andar de cima: galeria do fundo, ala direita (com furo da escada), ala esquerda */}
      <Slab x0={-15} x1={15} z0={-10} z1={-3.2} y={H} />
      <Slab x0={-15} x1={-9} z0={-3.2} z1={12} y={H} />
      <Slab x0={3.8} x1={15} z0={-3.2} z1={-2} y={H} />
      <Slab x0={3.8} x1={15} z0={2} z1={12} y={H} />
      <Slab x0={8.8} x1={15} z0={-2} z1={2} y={H} />
      {/* tampa do poço de cima: abre como alçapão (dobradiça na ponta de fora) */}
      <group position={[8.8, H + 0.006, 0]} rotation={[0, 0, -hatch * 1.75]}>
        <mesh position={[-(8.8 - XC_T + 0.24) / 2, 0, 0]} receiveShadow visible={pO > 0.25 || hatch > 0.5}>
          <boxGeometry args={[8.8 - XC_T + 0.24, 0.025, 1.8]} />
          <meshStandardMaterial map={checkerTex([5, 2])} color="#DCE1E5" metalness={0.45} roughness={0.38} transparent={pO < 0.99 && hatch < 0.5} opacity={hatch > 0.5 ? 1 : pO} depthWrite={pO > 0.5 || hatch > 0.5} />
        </mesh>
      </group>
      {[-0.76, 0.76].map((z) => (
        <mesh key={z} position={[(3.8 + XC_T - 0.24) / 2, H + 0.006, z]} receiveShadow visible={pO > 0.25}>
          <boxGeometry args={[XC_T - 0.24 - 3.8, 0.025, 0.28]} />
          <meshStandardMaterial color="#C3CAD0" metalness={0.45} roughness={0.38} transparent={pO < 0.99} opacity={pO} depthWrite={pO > 0.5} />
        </mesh>
      ))}
      {/* caixa da casa de máquinas pendurada embaixo do piso de cima (forro) */}
      <mesh visible={xray < 0.95} position={[E.XT + 0.85, H - 1.0, 0]}>
        <boxGeometry args={[3.45, 1.95, 2.6]} />
        <meshStandardMaterial color="#F4EFE6" roughness={0.85} transparent opacity={0.999 - xray * 0.92} depthWrite={xray < 0.3} side={THREE.DoubleSide} />
      </mesh>
      {/* guarda-corpos de vidro em volta do vão */}
      <Railing a={[-9, -3.2]} b={[-9, 12]} y={H} />
      <Railing a={[-9, -3.2]} b={[3.8, -3.2]} y={H} />
      <Railing a={[3.8, -3.2]} b={[3.8, -0.95]} y={H} />
      <Railing a={[3.8, 0.95]} b={[3.8, 12]} y={H} />
      {/* paredes */}
      <mesh position={[0, MALL.roof / 2, -10.1]} receiveShadow>
        <boxGeometry args={[30.4, MALL.roof, 0.2]} />
        <meshStandardMaterial color="#F3EADB" roughness={0.9} />
      </mesh>
      {[-15.1, 15.1].map((x) => (
        <mesh key={x} position={[x, MALL.roof / 2, 1]} receiveShadow castShadow>
          <boxGeometry args={[0.2, MALL.roof, 22.2]} />
          <meshStandardMaterial color="#EFE3CF" roughness={0.9} />
        </mesh>
      ))}
      {/* faixa de cor nas paredes laterais */}
      {[-14.99, 14.99].map((x) => (
        <mesh key={`f${x}`} position={[x, H + 0.6, 1]} rotation={[0, x < 0 ? Math.PI / 2 : -Math.PI / 2, 0]}>
          <planeGeometry args={[22, 0.5]} />
          <meshStandardMaterial color="#FF8A1E" roughness={0.6} />
        </mesh>
      ))}
      {/* teto com claraboia (o teto não projeta sombra para a luz entrar) */}
      <group>
        <mesh position={[0, MALL.roof + 0.2, -6.6]}>
          <boxGeometry args={[30.4, 0.4, 6.8]} />
          <meshStandardMaterial color="#F7F2EA" roughness={0.9} />
        </mesh>
        <mesh position={[-12, MALL.roof + 0.2, 4.4]}>
          <boxGeometry args={[6.4, 0.4, 15.2]} />
          <meshStandardMaterial color="#F7F2EA" roughness={0.9} />
        </mesh>
        <mesh position={[9.4, MALL.roof + 0.2, 4.4]}>
          <boxGeometry args={[11.6, 0.4, 15.2]} />
          <meshStandardMaterial color="#F7F2EA" roughness={0.9} />
        </mesh>
        {/* claraboia: vidro + caibros */}
        <mesh position={[-2.6, MALL.roof + 0.35, 4.4]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[12.8, 15.2]} />
          <meshStandardMaterial color="#BFE6F5" transparent opacity={0.18} roughness={0.05} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
        {Array.from({ length: 9 }).map((_, i) => (
          <mesh key={i} position={[-9 + i * 1.6, MALL.roof + 0.36, 4.4]}>
            <boxGeometry args={[0.08, 0.1, 15.2]} />
            <meshStandardMaterial color="#F7F2EA" roughness={0.6} />
          </mesh>
        ))}
        {/* luminárias (painéis) no teto do térreo, sob a galeria */}
        {Array.from({ length: 10 }).map((_, i) => (
          <mesh key={`l${i}`} position={[-13.5 + i * 3, H - 0.36, -5.4]} rotation={[Math.PI / 2, 0, 0]}>
            <planeGeometry args={[1.2, 0.5]} />
            <meshStandardMaterial color="#FFFFFF" emissive="#FFF4D8" emissiveIntensity={dark > (i + 1) / 11 ? 0 : 1.4} side={THREE.DoubleSide} />
          </mesh>
        ))}
        {Array.from({ length: 10 }).map((_, i) => (
          <mesh key={`m${i}`} position={[-13.5 + i * 3, MALL.roof - 0.01, -5.4]} rotation={[Math.PI / 2, 0, 0]}>
            <planeGeometry args={[1.2, 0.5]} />
            <meshStandardMaterial color="#FFFFFF" emissive="#FFF4D8" emissiveIntensity={dark > (i + 1) / 11 ? 0 : 1.4} side={THREE.DoubleSide} />
          </mesh>
        ))}
      </group>
      {/* pilares redondos */}
      {[
        [-9, -3.2],
        [3.8, -3.2],
        [-9, 11.7],
        [3.8, 11.7],
        [9.5, -3.2],
        [9.5, 5.0],
        [-3, -3.2],
        [-14.7, 11.7],
        [14.7, 11.7],
      ].map(([x, z], i) => (
        <group key={i}>
          <mesh position={[x, H / 2 - 0.2, z]} castShadow receiveShadow>
            <cylinderGeometry args={[0.3, 0.3, H, 18]} />
            <meshStandardMaterial color="#FBF7F0" roughness={0.6} />
          </mesh>
          <mesh position={[x, H + (MALL.roof - H) / 2, z]} castShadow receiveShadow>
            <cylinderGeometry args={[0.26, 0.26, MALL.roof - H, 18]} />
            <meshStandardMaterial color="#FBF7F0" roughness={0.6} />
          </mesh>
        </group>
      ))}
      {lite ? null : <ShopRow y={0} shops={SHOPS_G} dark={dark} />}
      {lite ? null : <ShopRow y={H} shops={SHOPS_U} dark={dark} />}
      {lite ? null : <FoodCourt />}
      {lite ? null : <group>
      <Planter p={[-7.8, 0, 11.0]} s={1.1} seed={1} />
      <Planter p={[3.0, 0, 11.2]} s={1.1} seed={5} />
      <Planter p={[12.5, 0, 2.6]} s={1.0} seed={2} />
      <Planter p={[12.5, H, 2.6]} s={0.9} seed={3} />
      <Planter p={[-12.5, H, 2.6]} s={0.9} seed={4} />
      <Planter p={[12.5, H, 9.5]} s={0.9} seed={6} />
      <Planter p={[-12.5, H, 9.5]} s={0.9} seed={7} />
      <Kiosk p={[-11.6, 0, 11.0]} name="SORVETE" c="#E84D8A" />
      <Kiosk p={[11.6, 0, 10.6]} name="PIPOCA" c="#F28C1E" />
      </group>}
      {/* bancos */}
      {[
        [10.5, -1.6],
        [13.5, 0.2],
      ].map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh position={[0, 0.45, 0]} castShadow>
            <boxGeometry args={[1.8, 0.08, 0.5]} />
            <meshStandardMaterial map={brushedTex([1, 1], "#B57A48")} color="#C08452" roughness={0.6} />
          </mesh>
          <mesh position={[0, 0.22, 0]}>
            <boxGeometry args={[1.5, 0.44, 0.35]} />
            <meshStandardMaterial color="#5B636B" metalness={0.5} roughness={0.4} />
          </mesh>
        </group>
      ))}
      {stair ? <FixedStair /> : null}
      {/* fachada: platibanda com letreiro "SHOPPING" no alto (sem marca) */}
      <mesh position={[0, MALL.roof + 0.9, 12.0]} castShadow>
        <boxGeometry args={[30.4, 1.4, 0.3]} />
        <meshStandardMaterial color="#E8714A" roughness={0.6} />
      </mesh>
      <mesh position={[0, MALL.roof + 0.9, 12.16]}>
        <planeGeometry args={[9, 1.2]} />
        <meshStandardMaterial map={signTex("SHOPPING", "#E8714A")} roughness={0.6} polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-4} />
      </mesh>
      {/* corte (seção) na frente: bordas das lajes em cinza escuro */}
      {/* (no andar de cima a laje só existe nas alas: x<-9 e x>3,8; o vão fica aberto) */}
      {(
        [
          [0, -15.2, 15.2],
          [H, -15.2, -9],
          [H, 3.8, 15.2],
        ] as [number, number, number][]
      ).map(([y, x0, x1]) => (
        <mesh key={`c${y}${x0}`} position={[(x0 + x1) / 2, y - 0.18, 12.01]}>
          <planeGeometry args={[x1 - x0, 0.36]} />
          <meshStandardMaterial color="#8B8478" roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
};

// ======================================================================
// Personagens e objetos
// ======================================================================
export type Mood = "neutral" | "happy" | "cold" | "shock" | "sad" | "relaxed";
export type Pose = "down" | "up" | "hug" | "wave" | "point";
export type Pessoa = {
  p: V3;
  ry?: number;
  rx?: number;
  rz?: number;
  piv?: number;
  mood?: Mood;
  pose?: Pose;
  shirt?: string;
  s?: number;
  legL?: number;
  legR?: number;
  armL?: V3;
  armR?: V3;
  bags?: number;
  phone?: boolean;
  sit?: number;
  lean?: number;
  headLean?: number;
  look?: [number, number];
  sweat?: number;
  id?: number;
  cap?: boolean;
};
export const SHIRTS = ["#3DAA66", "#E8483B", "#2E6FD8", "#9B59B6", "#F2F2F0", "#FF8A1E", "#1FB5B5", "#E84D8A", "#7A5230", "#4A4F57"];

// Sacolas de compras (presas nas mãos com os braços para baixo).
export const Sacolas: React.FC<{ n?: number; swing?: number }> = ({ n = 2, swing = 0 }) => (
  <group>
    {[-1, 1].map((sd) =>
      Array.from({ length: n }).map((_, i) => {
        const col = [["#C99A63", "#E8483B"], ["#F7F7F2", "#2E6FD8"]][(sd + 1) / 2][i % 2];
        return (
          <group key={`${sd}${i}`} position={[sd * 0.47, 0.79, -0.03 + i * 0.12 * sd]} rotation={[swing * (i ? -1 : 1), 0, sd * 0.05]}>
            <mesh position={[0, -0.27, 0]} castShadow>
              <boxGeometry args={[0.32, 0.38, 0.15]} />
              <meshStandardMaterial color={col} roughness={0.85} />
            </mesh>
            <mesh position={[0, -0.05, 0]}>
              <torusGeometry args={[0.07, 0.012, 6, 14, Math.PI]} />
              <meshStandardMaterial color={col} roughness={0.85} />
            </mesh>
            {col === "#F7F7F2"
              ? [0, 1, 2].map((k) => (
                  <mesh key={k} position={[-0.08 + k * 0.08, -0.07, 0]}>
                    <sphereGeometry args={[0.055, 12, 10]} />
                    <meshStandardMaterial color="#FF8A1E" roughness={0.7} />
                  </mesh>
                ))
              : null}
          </group>
        );
      }),
    )}
  </group>
);

const ShadowOff: React.FC<{ on: boolean; children: React.ReactNode }> = ({ on, children }) => (on ? <NoShadow>{children}</NoShadow> : <group>{children}</group>);
export const Gente: React.FC<{ t: number; list: Pessoa[]; noShadow?: boolean }> = ({ t, list, noShadow = false }) => (
  <ShadowOff on={noShadow}>
    {list.map((q, i) => {
      const piv = q.piv ?? 0.8;
      const s = q.s ?? 0.85;
      return (
        <group key={q.id ?? i} position={q.p} rotation={[0, q.ry ?? 0, 0]}>
          <group position={[0, piv * s, 0]} rotation={[q.rx ?? 0, 0, q.rz ?? 0]}>
            <group position={[0, -piv * s, 0]} scale={s}>
              <TiaoWalk
                t={t + (q.id ?? i) * 0.37}
                mood={q.mood ?? "neutral"}
                pose={q.pose ?? "down"}
                shirt={q.shirt}
                legL={q.legL ?? 0}
                legR={q.legR ?? 0}
                armLOverride={q.armL}
                armROverride={q.armR}
                phone={q.phone}
                sit={q.sit ?? 0}
                lean={q.lean ?? 0}
                headLean={q.headLean ?? 0}
                look={q.look ?? [0, 0]}
                sweat={q.sweat ?? 0}
                cap={q.cap}
              />
              {q.bags ? <Sacolas n={q.bags} swing={Math.sin(t * 7 + i) * 0.15} /> : null}
            </group>
          </group>
        </group>
      );
    })}
  </ShadowOff>
);

export const Laranja: React.FC<{ p: V3; r?: number; rot?: number }> = ({ p, r = 0.07, rot = 0 }) => (
  <group position={p} rotation={[rot, rot * 0.7, 0]}>
    <mesh castShadow>
      <sphereGeometry args={[r, 14, 12]} />
      <meshStandardMaterial color="#FF8A1E" roughness={0.75} />
    </mesh>
    <mesh position={[0, r * 0.95, 0]}>
      <boxGeometry args={[r * 0.5, r * 0.15, r * 0.25]} />
      <meshStandardMaterial color="#3D8A43" roughness={0.8} />
    </mesh>
  </group>
);

// Esteira do caixa (módulo solto do balcão): pivô no pé, inclinação "ang", correia andando.
// lona: 0 = correia inteira; 1 = correia toda enrolada (sai de cima para baixo como um tapete) -> sobra a viga.
export const Esteira: React.FC<{ p: V3; ang: number; len: number; belt: number; legs?: number; lona?: number; opacity?: number; products?: number; sign?: boolean }> = ({
  p,
  ang,
  len,
  belt,
  legs = 1,
  lona = 0,
  opacity = 1,
  products = 0,
  sign = true,
}) => {
  if (opacity <= 0.01) return null;
  const tr = opacity < 0.99;
  const tex = beltTex([1, len / 0.4]);
  const tx = tex.clone();
  tx.needsUpdate = true;
  const keep = Math.max(0.0, (len - 0.1) * (1 - lona)); // trecho de correia que ainda está estendido (a partir do pé)
  tx.repeat.set(1, Math.max(0.01, keep) / 0.4);
  tx.offset.set(0, -belt / 0.4);
  const rollR = 0.045 + 0.11 * Math.sqrt(lona);
  const mOp = (extra: Record<string, unknown> = {}) => ({ transparent: tr, opacity, depthWrite: !tr, ...extra });
  return (
    <group position={p} rotation={[0, 0, ang]}>
      <group position={[len / 2, 0, 0]}>
        {/* viga de inox (a estrutura que sobra) */}
        <mesh position={[0, -0.18, 0]} castShadow={!tr} receiveShadow>
          <boxGeometry args={[len, 0.3, 0.86]} />
          <meshStandardMaterial map={brushedTex([4, 1], "#C4CBD1")} color="#CDD3D8" metalness={0.45} roughness={0.35} {...mOp()} />
        </mesh>
        {/* correia preta com frisos (andando) */}
        {keep > 0.05 ? (
          <mesh position={[-len / 2 + 0.05 + keep / 2, -0.025, 0]} rotation={[-Math.PI / 2, 0, -Math.PI / 2]} receiveShadow>
            <planeGeometry args={[0.7, keep]} />
            <meshStandardMaterial map={tx} roughness={0.8} {...mOp()} />
          </mesh>
        ) : null}
        {/* rolo da lona enrolando (desce de cima para baixo) */}
        {lona > 0.01 && lona < 0.999 ? (
          <group position={[-len / 2 + 0.05 + keep, -0.02 + rollR, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <mesh rotation={[0, (lona * len) / 0.12, 0]} castShadow>
              <cylinderGeometry args={[rollR, rollR, 0.72, 20]} />
              <meshStandardMaterial map={tx} color="#3A3D43" roughness={0.8} {...mOp()} />
            </mesh>
          </group>
        ) : null}
        {/* bordas */}
        {[-0.41, 0.41].map((z) => (
          <mesh key={z} position={[0, 0.0, z]}>
            <boxGeometry args={[len, 0.07, 0.05]} />
            <meshStandardMaterial color="#AEB6BD" metalness={0.6} roughness={0.3} {...mOp()} />
          </mesh>
        ))}
        {/* rolinhos nas pontas */}
        {[-len / 2 + 0.05, len / 2 - 0.05].map((x) => (
          <mesh key={x} position={[x, -0.06, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.06, 0.06, 0.74, 12]} />
            <meshStandardMaterial color="#2A2C30" roughness={0.7} {...mOp()} />
          </mesh>
        ))}
        {/* plaquinha "CAIXA 3" no pé (fica torta quando a esteira inclina) */}
        {sign ? (
          <group position={[-len / 2 + 0.35, 0.05, 0.45]}>
            <mesh position={[0, 0.25, 0]}>
              <cylinderGeometry args={[0.018, 0.018, 0.5, 8]} />
              <meshStandardMaterial color="#9AA3AA" metalness={0.5} {...mOp()} />
            </mesh>
            <mesh position={[0, 0.58, 0]}>
              <boxGeometry args={[0.62, 0.2, 0.03]} />
              <meshStandardMaterial color="#2FA84F" roughness={0.5} {...mOp()} />
            </mesh>
            <mesh position={[0, 0.58, 0.018]}>
              <planeGeometry args={[0.58, 0.16]} />
              <meshStandardMaterial map={signTex("CAIXA 3", "#2FA84F")} roughness={0.5} polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-4} {...mOp()} />
            </mesh>
          </group>
        ) : null}
        {/* produtos andando na correia (só no balcão) */}
        {products > 0.01
          ? [0, 1, 2, 3, 4, 5, 6].map((i) => {
              const span = Math.min(3.2, len - 0.8);
              const d = ((((i * 0.55 + belt) % span) + span) % span) - len / 2 + 0.4;
              const isO = i % 2 === 0;
              const cols = ["#E8352B", "#F2C230", "#2E6FD8", "#3DAA66"];
              return isO ? (
                <Laranja key={i} p={[d, 0.05, (i % 4 ? 0.14 : -0.14)]} r={0.075} rot={belt * 6 + i} />
              ) : (
                <mesh key={i} position={[d, 0.1, -0.1]} castShadow>
                  <boxGeometry args={[0.18, 0.2 + (i % 3) * 0.06, 0.16]} />
                  <meshStandardMaterial color={cols[i % 4]} roughness={0.6} />
                </mesh>
              );
            })
          : null}
        {legs > 0.01
          ? [-len / 2 + 0.3, len / 2 - 0.3].map((x) =>
              [-0.35, 0.35].map((z) => (
                <mesh key={`${x}${z}`} position={[x, -0.33 - 0.35 * legs, z]}>
                  <boxGeometry args={[0.06, 0.7 * legs, 0.06]} />
                  <meshStandardMaterial color="#5B636B" metalness={0.5} {...mOp()} />
                </mesh>
              )),
            )
          : null}
      </group>
    </group>
  );
};

// Balcão do caixa (fica no lugar quando a esteira é arrancada): gabinete, caixa registradora, leitor com laser,
// poste com placa luminosa "CAIXA 3". x0 = ponta da frente do balcão.
export const Checkout: React.FC<{ x0: number; t: number; laser?: number }> = ({ x0, t, laser = 1 }) => (
  <group position={[x0, 0, 0]}>
    {/* gabinete */}
    <mesh position={[1.5, 0.42, 0]} castShadow receiveShadow>
      <boxGeometry args={[3.0, 0.84, 0.9]} />
      <meshStandardMaterial color="#2FA84F" roughness={0.55} />
    </mesh>
    <mesh position={[1.5, 0.86, 0]}>
      <boxGeometry args={[3.04, 0.04, 0.94]} />
      <meshStandardMaterial color="#E9EDF0" metalness={0.3} roughness={0.4} />
    </mesh>
    {/* registradora (ao lado, na frente) */}
    <group position={[0.55, 0, -0.85]}>
      <mesh position={[0, 0.45, 0]} castShadow>
        <boxGeometry args={[0.8, 0.9, 0.6]} />
        <meshStandardMaterial color="#E9EDF0" roughness={0.5} />
      </mesh>
      <mesh position={[0, 1.02, 0]} castShadow>
        <boxGeometry args={[0.5, 0.22, 0.4]} />
        <meshStandardMaterial color="#2C3036" roughness={0.5} />
      </mesh>
      <mesh position={[0, 1.3, 0.05]} rotation={[-0.35, 0, 0]}>
        <boxGeometry args={[0.42, 0.3, 0.04]} />
        <meshStandardMaterial color="#16181D" emissive="#5FF3FF" emissiveIntensity={0.45} />
      </mesh>
    </group>
    {/* leitor de código (vidro + laser vermelho piscando) */}
    <mesh position={[0.35, 0.885, 0]}>
      <boxGeometry args={[0.36, 0.012, 0.3]} />
      <meshStandardMaterial color="#1D2B33" metalness={0.2} roughness={0.1} emissive="#FF2A1A" emissiveIntensity={laser * (0.35 + 0.25 * Math.sin(t * 9))} />
    </mesh>
    {/* placa luminosa "CAIXA 3" pendurada do teto (o caminho da esteira por cima do balcão fica livre) */}
    {[-0.5, 0.5].map((dx) => (
      <mesh key={dx} position={[1.2 + dx, 3.78, -0.3]}>
        <cylinderGeometry args={[0.012, 0.012, 0.74, 6]} />
        <meshStandardMaterial color="#9AA3AA" metalness={0.5} />
      </mesh>
    ))}
    <mesh position={[1.2, 3.25, -0.3]}>
      <boxGeometry args={[1.3, 0.42, 0.08]} />
      <meshStandardMaterial color="#2FA84F" roughness={0.5} emissive="#2FA84F" emissiveIntensity={0.35} />
    </mesh>
    {[1, -1].map((sd) => (
      <mesh key={sd} position={[1.2, 3.25, -0.3 + sd * 0.045]} rotation={[0, sd > 0 ? 0 : Math.PI, 0]}>
        <planeGeometry args={[1.2, 0.36]} />
        <meshStandardMaterial map={signTex("CAIXA 3", "#2FA84F")} roughness={0.5} emissive="#FFFFFF" emissiveIntensity={0.15} polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-4} />
      </mesh>
    ))}
  </group>
);

// Esmerilhadeira (corta a esteira em placas).
export const Grinder: React.FC<{ p: V3; t: number; on: number }> = ({ p, t, on }) => (
  <group position={p}>
    <mesh position={[0.25, 0.15, 0]} rotation={[0, 0, 0.1]}>
      <boxGeometry args={[0.5, 0.13, 0.13]} />
      <meshStandardMaterial color="#1F6FD8" roughness={0.5} />
    </mesh>
    <mesh position={[0, 0.06, 0]} rotation={[0, 0, t * 40 * on]}>
      <cylinderGeometry args={[0.16, 0.16, 0.02, 24]} />
      <meshStandardMaterial color="#8C949B" metalness={0.6} roughness={0.35} />
    </mesh>
    <mesh position={[0.02, 0.12, 0.0]}>
      <boxGeometry args={[0.2, 0.07, 0.2]} />
      <meshStandardMaterial color="#2A2C30" roughness={0.6} />
    </mesh>
    {on > 0.01 ? <SparkSpray t={t} origin={[-0.05, 0.0, 0]} amount={on} n={34} up={0.6} spread={0.8} scale={0.6} seed={5} /> : null}
  </group>
);

// Bicicleta (analogia da corrente) — vista de lado, plano x–y.
export const Bike: React.FC<{ t: number; s: number; glow?: number }> = ({ t, s, glow = 0 }) => {
  const front: P2 = [0, 0.38], rear: P2 = [-0.62, 0.38];
  const ring: P2 = [0, 0.38];
  const chain = useMemo(() => beltLoop(ring, 0.16, [-0.62, 0.38], 0.07, 100), []);
  const wheelR = 0.48;
  const wA = -s / 0.07;
  return (
    <group>
      {/* rodas */}
      {[
        [-0.62, 0.48],
        [0.75, 0.48],
      ].map(([x, y], i) => (
        <group key={i} position={[x, y, 0]} rotation={[0, 0, wA * 0.15]}>
          <mesh>
            <torusGeometry args={[wheelR, 0.035, 10, 40]} />
            <meshStandardMaterial color="#1F2124" roughness={0.7} />
          </mesh>
          {Array.from({ length: 12 }).map((_, k) => (
            <mesh key={k} rotation={[0, 0, (k / 12) * Math.PI]}>
              <boxGeometry args={[wheelR * 2, 0.008, 0.008]} />
              <meshStandardMaterial color="#C9D0D5" metalness={0.7} />
            </mesh>
          ))}
        </group>
      ))}
      {/* quadro vermelho */}
      {(
        [
          [[0, 0.38], [-0.62, 0.48]],
          [[0, 0.38], [-0.15, 1.0]],
          [[-0.15, 1.0], [-0.62, 0.48]],
          [[-0.15, 1.0], [0.55, 1.02]],
          [[0, 0.38], [0.55, 1.02]],
          [[0.55, 1.02], [0.75, 0.48]],
        ] as [P2, P2][]
      ).map(([a, b], i) => {
        const m = segMat([a[0], a[1], 0.08], [b[0], b[1], 0.08], 0.045, 0.045);
        const pp = new THREE.Vector3(), qq = new THREE.Quaternion(), ss = new THREE.Vector3();
        m.decompose(pp, qq, ss);
        return (
          <mesh key={i} position={pp} quaternion={qq} scale={ss}>
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color="#D8342A" roughness={0.4} metalness={0.2} />
          </mesh>
        );
      })}
      <mesh position={[-0.2, 1.08, 0.08]}>
        <boxGeometry args={[0.28, 0.06, 0.14]} />
        <meshStandardMaterial color="#1F2124" />
      </mesh>
      <mesh position={[0.55, 1.12, 0.08]}>
        <boxGeometry args={[0.06, 0.06, 0.5]} />
        <meshStandardMaterial color="#1F2124" />
      </mesh>
      {/* coroa + catraca + corrente */}
      <Sprocket position={[ring[0], ring[1], 0.14]} r={0.16} teeth={26} angle={-s / 0.16} width={0.012} color="#B9C1C7" glow={glow * 0.4} />
      <Sprocket position={[rear[0], rear[1], 0.14]} r={0.07} teeth={12} angle={-s / 0.07} width={0.012} color="#B9C1C7" glow={glow * 0.4} hub={false} />
      <RollerChain at={chain.at} L={chain.L} s={s} z={0.14} pitch={0.036} size={0.75} color="#3A3F45" glow={glow} />
      {/* pedivela */}
      <group position={[0, 0.38, 0.2]} rotation={[0, 0, -s / 0.16]}>
        <mesh position={[0.09, 0, 0]}>
          <boxGeometry args={[0.18, 0.03, 0.02]} />
          <meshStandardMaterial color="#9AA3AA" metalness={0.6} />
        </mesh>
      </group>
      {front ? null : null}
      {t < -1 ? null : null}
    </group>
  );
};

// Mostrador 3D simples (velocímetro) não é usado: os medidores são 2D no vídeo.
export { pr as progE, cl as clampE };
