import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { C } from "../theme";
import { Box, FlowParticles, Glow, Pipe, RBox, Tree } from "./basics";
import { brickTexture, Clouds, DistantTown, Flat, Forest, GrassTufts, rnd, scatter, SkyDome, terrainHeight, tileTexture, woodTexture } from "./World";

// Cenário do vídeo "Como construir uma piscina".
// Piscina centrada na origem, eixo longo em x. Corte transversal no plano z = 0 (câmera do lado +z).

type V3 = [number, number, number];
type P2 = [number, number];

export const PG = {
  xi: 4, // face interna das paredes (x)
  zi: 2,
  xo: 4.2,
  zo: 2.2,
  floorIn: -1.6,
  floorOut: -1.8,
  wl: -0.15, // linha d'água
  drainZ: -0.7,
  skimX: 1.6,
  muroX: 7.5,
};

export const FLAT: Flat = { x0: -42, x1: 42, z0: -42, z1: 42, margin: 26 };
const HILLS = 9;

// ---------- utilitários ----------
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const mixHex = (a: string, b: string, p: number) => "#" + new THREE.Color(a).lerp(new THREE.Color(b), clamp01(p)).getHexString();
export const popS = (p: number) => {
  if (p <= 0) return 0;
  if (p >= 1) return 1;
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2);
};

const texCache = new Map<string, THREE.Texture>();
const canvasTex = (key: string, w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) => {
  if (texCache.has(key)) return texCache.get(key)!;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d")!);
  const tx = new THREE.CanvasTexture(c);
  tx.wrapS = tx.wrapT = THREE.RepeatWrapping;
  tx.colorSpace = THREE.SRGBColorSpace;
  texCache.set(key, tx);
  return tx;
};
const lawnTex = () =>
  canvasTex("lawn", 512, 512, (g) => {
    g.fillStyle = "#6DB04C";
    g.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 8; i++) {
      g.fillStyle = i % 2 ? "rgba(255,255,255,0.05)" : "rgba(0,40,0,0.05)";
      g.fillRect(i * 64, 0, 64, 512);
    }
    for (let i = 0; i < 2600; i++) {
      const x = rnd(i, 41) * 512, y = rnd(i, 42) * 512;
      g.fillStyle = rnd(i, 43) < 0.5 ? "rgba(40,90,30,0.35)" : "rgba(170,220,120,0.3)";
      g.fillRect(x, y, 2 + rnd(i, 44) * 3, 2 + rnd(i, 45) * 5);
    }
  });
const concreteTex = () =>
  canvasTex("conc", 256, 256, (g) => {
    g.fillStyle = "#BFBAB1";
    g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 900; i++) {
      const v = rnd(i, 51);
      g.fillStyle = v < 0.5 ? "rgba(80,76,70,0.25)" : "rgba(255,255,255,0.25)";
      const s = 1 + rnd(i, 52) * 2.5;
      g.fillRect(rnd(i, 53) * 256, rnd(i, 54) * 256, s, s);
    }
  });
const pavingTex = () =>
  canvasTex("pave", 256, 256, (g) => {
    g.fillStyle = "#A9A39A";
    g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 4; i++)
      for (let j = 0; j < 4; j++) {
        const c = new THREE.Color("#D6CFC2");
        c.offsetHSL(0, 0, (rnd(i * 7 + j, 61) - 0.5) * 0.06);
        g.fillStyle = `#${c.getHexString()}`;
        g.fillRect(i * 64 + 2, j * 64 + 2, 60, 60);
      }
  });
const roofTex = () =>
  canvasTex("roofb", 128, 128, (g) => {
    g.fillStyle = "#A9472A";
    g.fillRect(0, 0, 128, 128);
  });

// polígono → geometria plana (descartada ao trocar)
const usePoly = (pts: P2[], holes: P2[][] = []) => {
  const key = JSON.stringify([pts, holes]);
  const geo = useMemo(() => {
    const s = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
    holes.forEach((h) => s.holes.push(new THREE.Path(h.map(([x, y]) => new THREE.Vector2(x, y)))));
    return new THREE.ShapeGeometry(s);
  }, [key]);
  useEffect(() => () => geo.dispose(), [geo]);
  return geo;
};
const Poly: React.FC<{ pts: P2[]; holes?: P2[][]; z?: number; color: string; opacity?: number; rotX?: boolean; y?: number; map?: THREE.Texture; emissive?: string; ei?: number; rough?: number }> = ({
  pts,
  holes,
  z = 0.004,
  color,
  opacity = 1,
  rotX,
  y = 0,
  map,
  emissive,
  ei = 0,
  rough = 0.95,
}) => {
  const geo = usePoly(pts, holes);
  return (
    <mesh geometry={geo} position={rotX ? [0, y, 0] : [0, 0, z]} rotation={rotX ? [-Math.PI / 2, 0, 0] : [0, 0, 0]} receiveShadow>
      <meshStandardMaterial color={color} map={map ?? null} transparent={opacity < 1} opacity={opacity} depthWrite={opacity >= 1} roughness={rough} emissive={emissive ?? "#000"} emissiveIntensity={ei} />
    </mesh>
  );
};
// retângulo [x0,x1]×[z0,z1] no chão como polígono (coordenada y do shape = -z)
const rectXZ = (x0: number, x1: number, z0: number, z1: number): P2[] => [
  [x0, -z1],
  [x1, -z1],
  [x1, -z0],
  [x0, -z0],
];
// anel retangular no chão; em corte vira um "U" aberto em z = 0
const ringXZ = (ox: number, oz: number, ix: number, iz: number, cut: boolean): { pts: P2[]; holes: P2[][] } => {
  if (!cut) return { pts: rectXZ(-ox, ox, -oz, oz), holes: [rectXZ(-ix, ix, -iz, iz)] };
  return {
    pts: [
      [-ox, 0],
      [-ix, 0],
      [-ix, iz],
      [ix, iz],
      [ix, 0],
      [ox, 0],
      [ox, oz],
      [-ox, oz],
    ],
    holes: [],
  };
};

// ---------- terreno distante (cópia do World.Terrain sem o miolo do quintal) ----------
const FarTerrain: React.FC<{ cut: boolean }> = ({ cut }) => {
  const geo = useMemo(() => {
    const size = 700, seg = 150;
    const g = new THREE.PlaneGeometry(size, size, seg, seg);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) pos.setY(i, terrainHeight(pos.getX(i), pos.getZ(i), FLAT, HILLS) - 0.04);
    const ng = g.toNonIndexed();
    const src = ng.attributes.position.array as Float32Array;
    const keep: number[] = [];
    const cc = ["#74B552", "#62A445", "#86C25E"].map((c) => new THREE.Color(c));
    const cols: number[] = [];
    for (let f = 0; f < src.length / 9; f++) {
      let inside = true;
      let front = false;
      for (let k = 0; k < 3; k++) {
        const x = src[f * 9 + k * 3], z = src[f * 9 + k * 3 + 2];
        if (Math.abs(x) > 39 || Math.abs(z) > 39) inside = false;
        if (z > -0.5) front = true;
      }
      if (inside) continue;
      if (cut && front) continue;
      for (let k = 0; k < 9; k++) keep.push(src[f * 9 + k]);
      const r = rnd(f, 3);
      const c = r < 0.45 ? cc[0] : r < 0.8 ? cc[1] : cc[2];
      for (let k = 0; k < 3; k++) cols.push(c.r, c.g, c.b);
    }
    const out = new THREE.BufferGeometry();
    out.setAttribute("position", new THREE.Float32BufferAttribute(keep, 3));
    out.setAttribute("color", new THREE.Float32BufferAttribute(cols, 3));
    out.computeVertexNormals();
    return out;
  }, [cut]);
  return (
    <mesh geometry={geo} receiveShadow>
      <meshStandardMaterial vertexColors roughness={0.95} flatShading />
    </mesh>
  );
};

// ---------- mundo (céu, colinas, floresta, bairro) ----------
export const PoolWorld: React.FC<{ t: number; cut: boolean; sky?: { top?: string; horizon?: string }; fog?: [string, number, number]; tufts?: boolean }> = ({ t, cut, sky, fog = ["#D8EEF8", 60, 380], tufts = true }) => {
  const spots = useMemo(() => {
    const s = scatter(460, 7, 26, 230, { x0: -30, x1: 30, z0: -30, z1: 30 }, 0, 0, FLAT);
    return cut ? s.filter((p) => p.z < -3) : s;
  }, [cut]);
  return (
    <group>
      <fog attach="fog" args={fog} />
      <SkyDome top={sky?.top} horizon={sky?.horizon ?? fog[0]} bottom={fog[0]} />
      <FarTerrain cut={cut} />
      <Forest spots={spots} flat={FLAT} hills={HILLS} />
      {tufts ? (
        <>
          <GrassTufts
            area={{ x0: -18, x1: 18, z0: -8, z1: cut ? -0.3 : 16 }}
            n={cut ? 800 : 2100}
            seed={5}
            avoid={[
              { x0: -6.1, x1: 6.1, z0: -4.1, z1: 4.1 },
              { x0: -9.2, x1: -6.0, z0: -1.8, z1: 1.8 },
              { x0: 7.2, x1: 7.8, z0: -20, z1: 20 },
              { x0: 11.5, x1: 21, z0: -9.5, z1: -0.5 },
              { x0: -8.5, x1: -4.8, z0: 5.2, z1: 9.5 },
            ]}
            flat={FLAT}
            hills={HILLS}
            y={0.005}
          />
          <GrassTufts area={{ x0: -36, x1: 36, z0: -36, z1: cut ? -0.3 : 36 }} n={1200} seed={9} avoid={[{ x0: -18, x1: 18, z0: -16, z1: 16 }]} flat={FLAT} hills={HILLS} y={0.005} />
        </>
      ) : null}
      <DistantTown center={[10, -95]} n={34} spread={70} flat={FLAT} hills={HILLS} seed={9} />
      <DistantTown center={[-70, -40]} n={14} spread={30} flat={FLAT} hills={HILLS} seed={4} />
      <DistantTown center={[60, -30]} n={12} spread={26} flat={FLAT} hills={HILLS} seed={14} />
      <Clouds t={t} center={[0, -120]} />
    </group>
  );
};

// ---------- solo em blocos (com buraco da piscina) ----------
const SOILS = [
  { top: 0, bot: -0.14, color: "#5E9E42", kind: "grass" },
  { top: -0.14, bot: -1.25, color: "#8E5A36", kind: "top" },
  { top: -1.25, bot: -2.55, color: "#D2A266", kind: "clay" },
  { top: -2.55, bot: -4.1, color: "#7A5338", kind: "dark" },
  { top: -4.1, bot: -7, color: "#8D8A84", kind: "rock" },
];

// textura de solo para a face do corte (grãos, pedrinhas, veios), sem padrão óbvio
const soilTex = (kind: string, base: string) =>
  canvasTex("soil" + kind, 512, 512, (g) => {
    const c0 = new THREE.Color(base);
    g.fillStyle = base;
    g.fillRect(0, 0, 512, 512);
    const shade = (dl: number, a: number) => {
      const c = c0.clone();
      c.offsetHSL(0, 0, dl);
      return `rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)},${a})`;
    };
    // manchas grandes suaves (quebra a repetição)
    for (let i = 0; i < 40; i++) {
      const x = rnd(i, 201) * 512, y = rnd(i, 202) * 512, r = 30 + rnd(i, 203) * 90;
      const grd = g.createRadialGradient(x, y, 0, x, y, r);
      grd.addColorStop(0, shade((rnd(i, 204) - 0.5) * 0.12, 0.5));
      grd.addColorStop(1, shade(0, 0));
      g.fillStyle = grd;
      g.fillRect(x - r, y - r, 2 * r, 2 * r);
    }
    if (kind === "clay")
      for (let i = 0; i < 22; i++) {
        g.strokeStyle = shade((rnd(i, 205) - 0.4) * 0.12, 0.55);
        g.lineWidth = 2 + rnd(i, 206) * 5;
        const y = rnd(i, 207) * 512;
        g.beginPath();
        for (let x = -10; x <= 522; x += 32) g.lineTo(x, y + Math.sin(x * 0.02 + i) * 6);
        g.stroke();
      }
    // grãos
    const nG = kind === "rock" ? 900 : 2600;
    for (let i = 0; i < nG; i++) {
      g.fillStyle = shade((rnd(i, 208) - 0.5) * 0.3, 0.7);
      const sz = 1 + rnd(i, 209) * 3;
      g.fillRect(rnd(i, 210) * 512, rnd(i, 211) * 512, sz, sz);
    }
    // pedrinhas / cascalho
    const nP = kind === "rock" ? 160 : kind === "dark" ? 60 : kind === "top" ? 45 : 30;
    for (let i = 0; i < nP; i++) {
      const x = rnd(i, 212) * 512, y = rnd(i, 213) * 512;
      const rx = (kind === "rock" ? 8 : 3) + rnd(i, 214) * (kind === "rock" ? 22 : 8);
      const ry = rx * (0.55 + rnd(i, 215) * 0.35);
      const pc = kind === "rock" ? ["#A7A39C", "#7D7972", "#B9B4AA", "#6B6862"][i % 4] : kind === "clay" ? "#B98A52" : kind === "dark" ? "#5E412C" : "#B88A5C";
      g.fillStyle = "rgba(0,0,0,0.25)";
      g.beginPath();
      g.ellipse(x + 1.5, y + 2, rx, ry, rnd(i, 216) * 3, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = pc;
      g.beginPath();
      g.ellipse(x, y, rx, ry, rnd(i, 216) * 3, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "rgba(255,255,255,0.18)";
      g.beginPath();
      g.ellipse(x - rx * 0.3, y - ry * 0.35, rx * 0.35, ry * 0.25, 0, 0, Math.PI * 2);
      g.fill();
    }
    if (kind === "grass")
      for (let i = 0; i < 500; i++) {
        g.strokeStyle = shade((rnd(i, 217) - 0.5) * 0.2, 0.9);
        g.lineWidth = 2;
        const x = rnd(i, 218) * 512;
        g.beginPath();
        g.moveTo(x, 512);
        g.lineTo(x + (rnd(i, 219) - 0.5) * 10, 512 - 60 - rnd(i, 220) * 200);
        g.stroke();
      }
  });

// face do corte (z = 0) em camadas texturizadas, com o buraco/casco recortado
export const SoilFace: React.FC<{ hx: number; hz?: number; pb: number; bed?: boolean }> = ({ hx, hz = PG.zo, pb, bed = false }) => {
  const W = 40;
  const mats = useMemo(
    () =>
      SOILS.map((L) => {
        const tx = soilTex(L.kind, L.color).clone();
        const h = L.top - L.bot;
        tx.repeat.set(1 / 3.2, L.kind === "grass" ? 1 / h : 1 / 3.2);
        if (L.kind === "grass") tx.offset.set(0, -L.bot / h);
        tx.needsUpdate = true;
        return tx;
      }),
    [],
  );
  const rects: { pts: P2[]; i: number }[] = [];
  SOILS.forEach((L, i) => {
    const y0 = L.bot, y1 = L.top;
    const r = (a: number, b: number, c: number, d: number): P2[] => [[a, c], [b, c], [b, d], [a, d]];
    if (y1 <= pb || hx <= 0.001) rects.push({ pts: r(-W, W, y0, y1), i });
    else {
      rects.push({ pts: r(-W, -hx, y0, y1), i }, { pts: r(hx, W, y0, y1), i });
      if (y0 < pb) rects.push({ pts: r(-hx, hx, y0, pb), i });
    }
  });
  return (
    <group>
      {rects.map((q, k) => (
        <Poly key={k} pts={q.pts} z={0.003} color="#FFFFFF" map={mats[q.i]} />
      ))}
      {/* parede do fundo do buraco também com textura (vista no corte) */}
      {hx > 0.001 && pb < -0.05
        ? SOILS.map((L, i) => {
            const y1 = Math.min(L.top, 0), y0 = Math.max(L.bot, pb);
            if (y1 <= y0) return null;
            return <Poly key={`b${i}`} pts={[[-hx, y0], [hx, y0], [hx, y1], [-hx, y1]]} z={-hz + 0.012} color="#B8B0A6" map={mats[i]} />;
          })
        : null}
      {/* linhas entre camadas e linha de corte do gramado */}
      {SOILS.slice(1).map((L, i) => (
        <mesh key={`l${i}`} position={[0, L.top, 0.004]}>
          <planeGeometry args={[2 * W, i === 0 ? 0.05 : 0.025]} />
          <meshStandardMaterial color={i === 0 ? "#3B2414" : "#000"} transparent opacity={i === 0 ? 0.9 : 0.18} depthWrite={false} />
        </mesh>
      ))}
      <mesh position={[0, 0.0, 0.004]}>
        <planeGeometry args={[2 * W, 0.035]} />
        <meshStandardMaterial color="#2F5A22" />
      </mesh>
      {/* cascalho sob a piscina (leito da válvula) */}
      {bed ? <Poly pts={[[-0.9, pb - 0.55], [0.9, pb - 0.55], [0.9, pb], [-0.9, pb]]} z={0.0045} color="#FFFFFF" map={mats[4]} /> : null}
    </group>
  );
};
type HoleBox = { x0: number; x1: number; y0: number; y1: number; z0: number; z1: number };
export const Soil: React.FC<{ cut: boolean; dig: number; wet?: number; foot?: number; bed?: boolean }> = ({ cut, dig, wet = 0, foot = 1, bed = false }) => {
  const R = 40;
  const zF = cut ? 0 : R;
  const hx = PG.xo * (0.2 + 0.8 * foot), hz = PG.zo * (0.3 + 0.7 * foot);
  const holes: HoleBox[] = dig > 0.001 ? [{ x0: -hx, x1: hx, y0: PG.floorOut * dig, y1: 0.1, z0: -hz, z1: hz }] : [];
  const cells = useMemo(() => {
    const uniq = (a: number[], lo: number, hi: number) => Array.from(new Set(a.map((v) => Math.max(lo, Math.min(hi, v))))).sort((p, q) => p - q);
    const xs = uniq([-R, R, ...holes.flatMap((h) => [h.x0, h.x1])], -R, R);
    const ys = uniq([0, -7, ...SOILS.map((s) => s.bot), ...holes.flatMap((h) => [h.y0])], -7, 0);
    const zs = uniq([-R, zF, ...holes.flatMap((h) => [h.z0, h.z1])], -R, zF);
    const out: { p: V3; s: V3; color: string }[] = [];
    for (let i = 0; i < xs.length - 1; i++)
      for (let j = 0; j < ys.length - 1; j++)
        for (let k = 0; k < zs.length - 1; k++) {
          const c: V3 = [(xs[i] + xs[i + 1]) / 2, (ys[j] + ys[j + 1]) / 2, (zs[k] + zs[k + 1]) / 2];
          if (holes.some((h) => c[0] > h.x0 && c[0] < h.x1 && c[1] > h.y0 && c[1] < h.y1 && c[2] > h.z0 && c[2] < h.z1)) continue;
          const L = SOILS.find((s) => c[1] <= s.top && c[1] > s.bot) ?? SOILS[SOILS.length - 1];
          out.push({ p: c, s: [xs[i + 1] - xs[i], ys[j + 1] - ys[j], zs[k + 1] - zs[k]], color: L.color });
        }
    return out;
  }, [JSON.stringify(holes), zF]);
  return (
    <group>
      {cells.map((c, i) => (
        <mesh key={i} position={c.p} receiveShadow>
          <boxGeometry args={c.s} />
          <meshStandardMaterial color={mixHex(c.color, "#3A2618", wet * (c.p[1] > -3 ? 0.55 : 0))} roughness={1} />
        </mesh>
      ))}
      {cut ? <SoilFace hx={hx} hz={hz} pb={dig > 0.001 ? PG.floorOut * dig : 0} bed={bed} /> : null}
    </group>
  );
};

const Pebbles: React.FC<{ dig: number }> = ({ dig }) => {
  const ref = useRef<THREE.InstancedMesh>(null);
  const items = useMemo(() => {
    const r: { x: number; y: number; s: number; c: string }[] = [];
    for (let i = 0; i < 420; i++) {
      const x = (rnd(i, 71) - 0.5) * 50;
      const y = -0.3 - rnd(i, 72) * 6.6;
      r.push({ x, y, s: 0.03 + rnd(i, 73) * 0.06, c: y < -3 ? "#8C6D48" : y < -1.3 ? "#B9874E" : "#6E4228" });
    }
    return r;
  }, []);
  const vis = items.filter((p) => !(Math.abs(p.x) < PG.xo + 0.1 && p.y > PG.floorOut * dig - 0.1));
  useLayoutEffect(() => {
    const im = ref.current;
    if (!im) return;
    const o = new THREE.Object3D();
    vis.forEach((p, i) => {
      o.position.set(p.x, p.y, 0.006);
      o.rotation.set(0, 0, i);
      o.scale.set(p.s * (1 + rnd(i, 74)), p.s, 1);
      o.updateMatrix();
      im.setMatrixAt(i, o.matrix);
      im.setColorAt(i, new THREE.Color(p.c));
    });
    im.count = vis.length;
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
  }, [vis.length]);
  return (
    <instancedMesh frustumCulled={false} ref={ref} args={[undefined, undefined, items.length]}>
      <circleGeometry args={[1, 6]} />
      <meshStandardMaterial roughness={1} />
    </instancedMesh>
  );
};

// grama (com textura de gramado aparado) e calçada em volta da piscina
export const Lawn: React.FC<{ cut: boolean; deck: number; foot?: number }> = ({ cut, deck, foot = 1 }) => {
  const tex = useMemo(() => {
    const t = lawnTex().clone();
    t.repeat.set(1 / 5, 1 / 5);
    t.needsUpdate = true;
    return t;
  }, []);
  const inner = deck > 0 ? [5.8, 3.8] : [PG.xo * (0.2 + 0.8 * foot), PG.zo * (0.3 + 0.7 * foot)];
  const r = ringXZ(40, 40, inner[0], inner[1], cut);
  return <Poly pts={r.pts} holes={r.holes} rotX y={0.004} color="#FFFFFF" map={tex} />;
};

// ---------- casa térrea de tijolo com telha colonial ----------
const RoofTiles: React.FC<{ len: number; slope: number; rows: number; cols: number; color?: string }> = ({ len, slope, rows, cols, color = "#C2532F" }) => {
  const ref = useRef<THREE.InstancedMesh>(null);
  const geo = useMemo(() => {
    const g = new THREE.CylinderGeometry(0.15, 0.17, slope / rows + 0.08, 8, 1, true, 0, Math.PI);
    g.rotateX(Math.PI / 2);
    g.rotateZ(Math.PI / 2);
    return g;
  }, [slope, rows]);
  useLayoutEffect(() => {
    const im = ref.current;
    if (!im) return;
    const o = new THREE.Object3D();
    let n = 0;
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        o.position.set(-len / 2 + (c + 0.5) * (len / cols), 0.02, -slope / 2 + (r + 0.5) * (slope / rows));
        o.rotation.set(0, 0, 0);
        o.scale.set(1, 1, 1);
        o.updateMatrix();
        im.setMatrixAt(n, o.matrix);
        const col = new THREE.Color(color);
        col.offsetHSL(0, 0, (rnd(n, 91) - 0.5) * 0.08);
        im.setColorAt(n, col);
        n++;
      }
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
  }, [len, slope, rows, cols]);
  return (
    <group>
      <instancedMesh frustumCulled={false} ref={ref} args={[geo, undefined, rows * cols]} castShadow receiveShadow>
        <meshStandardMaterial roughness={0.7} side={THREE.DoubleSide} />
      </instancedMesh>
      <mesh position={[0, -0.03, 0]} receiveShadow>
        <boxGeometry args={[len, 0.06, slope]} />
        <meshStandardMaterial color="#8E3B22" map={roofTex()} roughness={0.9} />
      </mesh>
    </group>
  );
};

const BrickWall: React.FC<{ size: V3; position: V3; rows?: number; base?: string }> = ({ size, position, rows = 1, base = "#C4704A" }) => {
  const mats = useMemo(() => {
    const mk = (w: number, h: number) => {
      const t = brickTexture(base, "#E9DCCB", 16, 8).clone();
      t.repeat.set(w / 2.4, h / 1.5);
      t.needsUpdate = true;
      return new THREE.MeshStandardMaterial({ map: t, roughness: 0.9 });
    };
    const [x, y, z] = size;
    return [mk(z, y), mk(z, y), mk(x, z), mk(x, z), mk(x, y), mk(x, y)];
  }, [size.join(), base, rows]);
  return (
    <mesh position={position} material={mats} castShadow receiveShadow>
      <boxGeometry args={size} />
    </mesh>
  );
};

const WinLit = { v: 0 };
const Window: React.FC<{ position: V3; w?: number; h?: number; rot?: number }> = ({ position, w = 1.3, h = 1.0, rot = 0 }) => (
  <group position={position} rotation={[0, rot, 0]}>
    <Box size={[w + 0.16, h + 0.16, 0.06]} position={[0, 0, 0.0]} color="#F5F2EA" />
    <Box size={[w, h, 0.07]} position={[0, 0, 0.01]} color={WinLit.v > 0 ? "#FFD79A" : "#9ED3EC"} emissive={WinLit.v > 0 ? "#FFB347" : "#9ED3EC"} emissiveIntensity={0.15 + WinLit.v * 1.4} />
    <Box size={[0.05, h, 0.09]} position={[0, 0, 0.02]} color="#F5F2EA" />
    <Box size={[w + 0.3, 0.07, 0.18]} position={[0, -h / 2 - 0.08, 0.06]} color="#F5F2EA" />
  </group>
);

export const House: React.FC<{ position?: V3; lit?: number }> = ({ position = [0, 0, -12], lit = 0 }) => {
  WinLit.v = lit;
  const W = 13, D = 6, H = 2.9, ridge = 1.7;
  const half = D / 2 + 0.6;
  const slope = Math.hypot(half, ridge);
  const ang = Math.atan2(ridge, half);
  const gable = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(-D / 2, 0);
    s.lineTo(0, ridge);
    s.lineTo(D / 2, 0);
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.2, bevelEnabled: false });
    return g;
  }, []);
  const gtex = useMemo(() => {
    const t = brickTexture("#C4704A", "#E9DCCB", 16, 8).clone();
    t.repeat.set(1 / 2.4, 1 / 1.5);
    t.needsUpdate = true;
    return t;
  }, []);
  return (
    <group position={position}>
      <Box size={[W + 0.6, 0.25, D + 0.6]} position={[0, 0.12, 0]} color="#CFC8BB" />
      <BrickWall size={[W, H, D]} position={[0, H / 2 + 0.25, 0]} />
      {/* faixa de reboco no rodapé e beiral */}
      <Box size={[W + 0.04, 0.35, D + 0.04]} position={[0, 0.42, 0]} color="#EDE4D3" />
      <Box size={[W + 0.04, 0.2, D + 0.04]} position={[0, H + 0.15, 0]} color="#F5F0E6" />
      {[-1, 1].map((k) => (
        <mesh key={k} geometry={gable} position={[k < 0 ? -W / 2 : W / 2 - 0.2, H + 0.25, 0]} rotation={[0, Math.PI / 2, 0]} castShadow>
          <meshStandardMaterial map={gtex} roughness={0.9} />
        </mesh>
      ))}
      {[-1, 1].map((k) => (
        <group key={k} position={[0, H + 0.25 + ridge / 2 + 0.05, (k * half) / 2]} rotation={[k * ang, 0, 0]}>
          <RoofTiles len={W + 0.9} slope={slope} rows={11} cols={44} />
        </group>
      ))}
      <Box size={[W + 0.9, 0.16, 0.3]} position={[0, H + 0.25 + ridge + 0.04, 0]} color="#9E4527" />
      {/* frente (virada para a piscina, +z) */}
      <group position={[0, 0.25, D / 2 + 0.03]}>
        <Window position={[-4.6, 1.6, 0]} />
        <Window position={[4.6, 1.6, 0]} />
        <Window position={[2.2, 1.6, 0]} w={1.0} h={0.8} />
        {/* porta de vidro de correr */}
        <Box size={[2.4, 2.1, 0.06]} position={[-1.2, 1.05, 0]} color="#F5F2EA" />
        <Box size={[2.2, 1.95, 0.07]} position={[-1.2, 1.02, 0.01]} color={lit > 0 ? "#FFD79A" : "#8FC6E0"} emissive={lit > 0 ? "#FFB347" : "#8FC6E0"} emissiveIntensity={0.15 + lit * 1.2} />
        <Box size={[0.06, 1.95, 0.09]} position={[-1.2, 1.02, 0.02]} color="#F5F2EA" />
        {/* torneira */}
        <Box size={[0.12, 0.12, 0.12]} position={[-3.4, 0.55, 0.05]} color="#C8D0D6" />
      </group>
      {/* lâmpada da varanda */}
      <Box size={[0.25, 0.18, 0.12]} position={[-1.2, 2.75, D / 2 + 0.08]} color="#FFF3C8" emissive="#FFE29A" emissiveIntensity={0.3 + lit * 2} />
      {lit > 0 ? <Glow position={[-1.2, 2.75, D / 2 + 0.3]} size={2.2} color="#FFC46B" opacity={0.7 * lit} /> : null}
      {/* fundos */}
      <Window position={[-3, 1.85, -D / 2 - 0.03]} rot={Math.PI} />
      <Window position={[3, 1.85, -D / 2 - 0.03]} rot={Math.PI} />
      <Window position={[W / 2 + 0.03, 1.85, 0]} rot={Math.PI / 2} />
      <Window position={[-W / 2 - 0.03, 1.85, 0]} rot={-Math.PI / 2} />
    </group>
  );
};

// casa do vizinho (reboco amarelo)
export const NeighborHouse: React.FC<{ position?: V3 }> = ({ position = [16, 0, -5] }) => {
  const W = 8, D = 7, H = 2.8;
  return (
    <group position={position}>
      <RBox size={[W, H, D]} position={[0, H / 2, 0]} color="#EBC874" radius={0.03} />
      <Box size={[W + 0.04, 0.3, D + 0.04]} position={[0, 0.15, 0]} color="#C9A55A" />
      {[-1, 1].map((k) => (
        <group key={k} position={[(k * (W / 2 + 0.5)) / 2, H + ((W / 2 + 0.5) * Math.tan(0.42)) / 2, 0]} rotation={[0, 0, -k * 0.42]}>
          <group rotation={[0, Math.PI / 2, 0]}>
            <RoofTiles len={D + 0.8} slope={(W / 2 + 0.5) / Math.cos(0.42)} rows={9} cols={24} color="#B85A36" />
          </group>
        </group>
      ))}
      <Window position={[-W / 2 - 0.03, 1.5, -1.6]} rot={-Math.PI / 2} />
      <Window position={[-W / 2 - 0.03, 1.5, 1.6]} rot={-Math.PI / 2} />
      <Window position={[0, 1.5, D / 2 + 0.03]} />
    </group>
  );
};

// muro de divisa (tijolo à vista) com mancha de umidade
export const Muro: React.FC<{ cut: boolean; stain: number; t: number }> = ({ cut, stain, t }) => {
  const z0 = -18, z1 = cut ? 0 : 14;
  const L = z1 - z0;
  const H = 2.2;
  return (
    <group>
      <BrickWall size={[0.22, H, L]} position={[PG.muroX, H / 2, (z0 + z1) / 2]} base="#BF6A45" />
      <Box size={[0.32, 0.08, L]} position={[PG.muroX, H + 0.04, (z0 + z1) / 2]} color="#D9D2C5" />
      {/* alicerce (aparece no corte) */}
      <Box size={[0.5, 0.6, L]} position={[PG.muroX, -0.3, (z0 + z1) / 2]} color="#9E9A92" cast={false} />
      {cut ? (
        <mesh position={[PG.muroX, -0.3, 0.006]}>
          <planeGeometry args={[0.5, 0.6]} />
          <meshStandardMaterial color="#A8A49B" map={concreteTex()} />
        </mesh>
      ) : null}
      {stain > 0.01 ? <Stain stain={stain} t={t} /> : null}
    </group>
  );
};

const Stain: React.FC<{ stain: number; t: number }> = ({ stain, t }) => {
  const blobs = [
    [-1.2, 0.35, 1.0],
    [-0.5, 0.55, 0.85],
    [-1.8, 0.4, 0.7],
    [-0.9, 0.95, 0.55],
    [-1.5, 0.8, 0.5],
  ];
  return (
    <group>
      {[-1, 1].map((side) => (
        <group key={side} position={[PG.muroX + side * 0.115, 0, 0]} rotation={[0, (side * Math.PI) / 2, 0]}>
          {blobs.map(([z, y, r], i) => {
            const s = clamp01(stain * 1.4 - i * 0.12) * r;
            if (s <= 0.01) return null;
            return (
              <mesh key={i} position={[-side * z, y * (0.5 + stain * 0.6), 0.003 + i * 0.0005]} scale={[s * 1.25, s, 1]}>
                <circleGeometry args={[1, 14]} />
                <meshStandardMaterial color="#4A2E22" transparent opacity={0.5} roughness={0.3} depthWrite={false} />
              </mesh>
            );
          })}
          {/* escorridos */}
          {[0, 1, 2, 3].map((k) => {
            const len = clamp01(stain * 1.6 - 0.4 - k * 0.1) * (0.8 + k * 0.1);
            if (len <= 0.01) return null;
            const z = [-0.6, -1.1, -1.5, -0.9][k];
            const drip = ((t * 0.8 + k * 0.27) % 1) * len;
            return (
              <group key={k}>
                <mesh position={[-side * z, 0.95 - len / 2 + 0.1, 0.006]}>
                  <planeGeometry args={[0.07, len]} />
                  <meshStandardMaterial color="#2E3E52" transparent opacity={0.55} roughness={0.1} depthWrite={false} />
                </mesh>
                <mesh position={[-side * z, 1.05 - drip, 0.03]} scale={[0.05, 0.07, 0.05]}>
                  <sphereGeometry args={[1, 8, 6]} />
                  <meshStandardMaterial color="#9FD8F5" roughness={0.05} transparent opacity={0.85} />
                </mesh>
              </group>
            );
          })}
        </group>
      ))}
      {/* poça no pé do muro (lado do vizinho) */}
      <mesh position={[PG.muroX + 0.75, 0.012, -1.1]} rotation={[-Math.PI / 2, 0, 0]} scale={[0.6 * stain + 0.01, 1.2 * stain + 0.01, 1]}>
        <circleGeometry args={[1, 18]} />
        <meshStandardMaterial color="#5C8FB2" roughness={0.05} metalness={0.2} transparent opacity={0.75} />
      </mesh>
    </group>
  );
};

// pátio de cimento entre casa e piscina
export const Patio: React.FC = () => {
  const tex = useMemo(() => {
    const t = pavingTex().clone();
    t.repeat.set(14 / 2.4, 2.4 / 2.4);
    t.needsUpdate = true;
    return t;
  }, []);
  return (
    <mesh position={[0, 0.02, -7.6]} receiveShadow>
      <boxGeometry args={[14, 0.06, 2.4]} />
      <meshStandardMaterial map={tex} roughness={0.9} />
    </mesh>
  );
};

// ---------- casa de máquinas ----------
export const HUT = { x0: -8.9, x1: -6.4, z0: -1.5, z1: 1.5, h: 1.75 };
export const PUMP: V3 = [-8.25, 0, -0.75];
export const TANK: V3 = [-7.2, 0, -0.75];
export const MachineHut: React.FC<{ cut: boolean; pump: number; tank: number; dirt: number; glow: number; t: number; flow: number }> = ({ cut, pump, tank, dirt, glow, t, flow }) => {
  const z1 = cut ? 0 : HUT.z1;
  const zc = (HUT.z0 + z1) / 2;
  const L = z1 - HUT.z0;
  const th = 0.16;
  return (
    <group>
      <Box size={[HUT.x1 - HUT.x0 + 0.2, 0.12, L + 0.1]} position={[(HUT.x0 + HUT.x1) / 2, 0.06, zc]} color="#BDB8AE" />
      <BrickWall size={[th, HUT.h, L]} position={[HUT.x0 + th / 2, HUT.h / 2, zc]} />
      <BrickWall size={[th, HUT.h, L]} position={[HUT.x1 - th / 2, HUT.h / 2, zc]} />
      <BrickWall size={[HUT.x1 - HUT.x0, HUT.h, th]} position={[(HUT.x0 + HUT.x1) / 2, HUT.h / 2, HUT.z0 + th / 2]} />
      {!cut ? <BrickWall size={[HUT.x1 - HUT.x0, HUT.h, th]} position={[(HUT.x0 + HUT.x1) / 2, HUT.h / 2, HUT.z1 - th / 2]} /> : null}
      <Box size={[HUT.x1 - HUT.x0 + 0.4, 0.14, L + (cut ? 0.2 : 0.4)]} position={[(HUT.x0 + HUT.x1) / 2, HUT.h + 0.07, zc - (cut ? 0.1 : 0)]} color="#D9D4CA" />
      {/* porta de veneziana virada para a piscina */}
      <group position={[HUT.x1 + 0.01, 0.95, cut ? -0.85 : 0]}>
        <Box size={[0.04, 1.6, 0.9]} color="#5B7F95" />
        {Array.from({ length: 9 }).map((_, i) => (
          <Box key={i} size={[0.06, 0.03, 0.8]} position={[0.02, -0.65 + i * 0.16, 0]} color="#456578" />
        ))}
      </group>
      {pump > 0.01 ? <Pump s={popS(pump)} t={t} flow={flow} /> : null}
      {tank > 0.01 ? <SandTank s={popS(tank)} dirt={dirt} glow={glow} t={t} flow={flow} /> : null}
    </group>
  );
};

const Pump: React.FC<{ s: number; t: number; flow: number }> = ({ s, t, flow }) => (
  <group position={PUMP} scale={s}>
    <Box size={[0.8, 0.12, 0.5]} position={[0, 0.18, 0]} color="#6F757C" />
    {/* motor */}
    <mesh position={[-0.15, 0.42, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
      <cylinderGeometry args={[0.17, 0.17, 0.42, 18]} />
      <meshStandardMaterial color="#2D6FB6" roughness={0.4} metalness={0.3} />
    </mesh>
    {Array.from({ length: 6 }).map((_, i) => (
      <mesh key={i} position={[-0.3 + i * 0.06, 0.42, 0]} rotation={[0, 0, Math.PI / 2]}>
        <torusGeometry args={[0.172, 0.01, 4, 18]} />
        <meshStandardMaterial color="#245C99" />
      </mesh>
    ))}
    <mesh position={[-0.4, 0.42, 0]} rotation={[flow > 0 ? t * 20 : 0, 0, Math.PI / 2]}>
      <cylinderGeometry args={[0.13, 0.13, 0.06, 6]} />
      <meshStandardMaterial color="#1E3F66" />
    </mesh>
    {/* corpo da bomba + pré-filtro com tampa transparente */}
    <mesh position={[0.18, 0.42, 0]} castShadow>
      <cylinderGeometry args={[0.2, 0.2, 0.36, 18]} />
      <meshStandardMaterial color="#EDEDE8" roughness={0.4} />
    </mesh>
    <mesh position={[0.3, 0.72, 0]}>
      <cylinderGeometry args={[0.14, 0.14, 0.26, 16]} />
      <meshStandardMaterial color="#CFEFFA" transparent opacity={0.55} roughness={0.1} />
    </mesh>
  </group>
);

const SandTank: React.FC<{ s: number; dirt: number; glow: number; t: number; flow: number }> = ({ s, dirt, glow, t, flow }) => {
  const R = 0.42;
  return (
    <group position={TANK} scale={s}>
      <mesh position={[0, 0.1, 0]}>
        <cylinderGeometry args={[R * 0.9, R, 0.2, 20]} />
        <meshStandardMaterial color="#3C4E5E" />
      </mesh>
      {/* camadas: brita, areia, sujeira presa em cima, água */}
      <mesh position={[0, 0.32, 0]}>
        <cylinderGeometry args={[R - 0.03, R - 0.03, 0.24, 20]} />
        <meshStandardMaterial color="#8E8B85" roughness={1} />
      </mesh>
      <mesh position={[0, 0.69, 0]}>
        <cylinderGeometry args={[R - 0.03, R - 0.03, 0.5, 20]} />
        <meshStandardMaterial color="#E4C68C" roughness={1} emissive="#FFB347" emissiveIntensity={glow * 0.6} />
      </mesh>
      {dirt > 0.01
        ? Array.from({ length: 14 }).map((_, i) => {
            const u = ((t * 0.5 + rnd(i, 341)) % 1 + 1) % 1;
            return (
              <mesh key={`sp${i}`} position={[(rnd(i, 342) - 0.5) * 0.6, 1.2 - u * 0.25, R - 0.04]} scale={0.022}>
                <icosahedronGeometry args={[1, 0]} />
                <meshStandardMaterial color="#4A3A20" />
              </mesh>
            );
          })
        : null}
      <mesh position={[0, 0.94 + dirt * 0.05, 0]} scale={[1, Math.max(0.01, dirt), 1]}>
        <cylinderGeometry args={[R - 0.03, R - 0.03, 0.11, 20]} />
        <meshStandardMaterial color="#5A4A2A" roughness={1} />
      </mesh>
      <mesh position={[0, 1.1, 0]}>
        <cylinderGeometry args={[R - 0.03, R - 0.03, 0.26, 20]} />
        <meshStandardMaterial color="#8FD3F2" transparent opacity={0.6} roughness={0.1} />
      </mesh>
      {/* grãos de areia */}
      {Array.from({ length: 26 }).map((_, i) => (
        <mesh key={i} position={[(rnd(i, 81) - 0.5) * 0.6, 0.48 + rnd(i, 82) * 0.42, R - 0.02]} scale={0.018 + rnd(i, 83) * 0.012}>
          <icosahedronGeometry args={[1, 0]} />
          <meshStandardMaterial color={rnd(i, 84) < 0.5 ? "#C9A469" : "#F2DBA8"} />
        </mesh>
      ))}
      {/* casca transparente */}
      <mesh position={[0, 0.7, 0]}>
        <cylinderGeometry args={[R, R, 1.2, 24, 1, true]} />
        <meshStandardMaterial color="#CFEFFA" transparent opacity={0.28} roughness={0.05} side={THREE.DoubleSide} depthWrite={false} emissive="#FFD23F" emissiveIntensity={glow * 0.5} />
      </mesh>
      <mesh position={[0, 1.3, 0]} scale={[1, 0.4, 1]}>
        <sphereGeometry args={[R, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#2F5E86" roughness={0.4} />
      </mesh>
      {/* válvula seletora */}
      <mesh position={[0, 1.55, 0]}>
        <cylinderGeometry args={[0.13, 0.13, 0.16, 16]} />
        <meshStandardMaterial color="#1F2A33" />
      </mesh>
      <Box size={[0.32, 0.04, 0.05]} position={[0.08, 1.66, 0]} color="#E8352B" />
      {/* manômetro */}
      <mesh position={[0.12, 1.62, 0.12]} rotation={[-0.5, 0, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 0.03, 14]} />
        <meshStandardMaterial color="#F5F5F0" />
      </mesh>
      {flow > 0 ? (
        <FlowParticles points={[[0, 1.2, 0.1], [0.05, 0.95, 0.15], [-0.05, 0.6, 0.18], [0.02, 0.25, 0.15]]} t={t} count={8} speed={0.6} size={0.025} color="#BFE9FF" visible={flow} />
      ) : null}
    </group>
  );
};

// ---------- canos (no plano do corte, z = 0) ----------
export const drainPipePath = (): V3[] => [
  [2.3, -2.0, 0.0],
  [-6.85, -2.0, 0.0],
  [-6.95, -1.9, 0.0],
  [-6.95, -0.1, 0.0],
  [-7.2, 0.25, -0.35],
  [-7.9, 0.42, -0.75],
];
export const pumpToTank = (): V3[] => [
  [PUMP[0] + 0.3, 0.86, -0.75],
  [PUMP[0] + 0.3, 1.2, -0.75],
  [TANK[0] - 0.25, 1.45, -0.75],
  [TANK[0], 1.45, -0.75],
];
export const returnPath = (): V3[] => [
  [TANK[0] + 0.12, 1.5, -0.75],
  [TANK[0] + 0.55, 1.45, -0.45],
  [-6.55, 0.9, 0.0],
  [-6.55, -0.55, 0.0],
  [-4.4, -0.55, 0.0],
  [-4.1, -0.5, -0.7],
  [-3.95, -0.48, -0.8],
];
export const Pipes: React.FC<{ p: number; t: number; flow: number; drains: number[] }> = ({ p, t, flow, drains }) => {
  if (p <= 0.01) return null;
  const s = popS(p);
  const col = "#F2F2EE";
  const water = (u: number) => (u > 0.5 ? "#BFE9FF" : "#8ED3F7");
  return (
    <group>
      <group scale={[1, 1, 1]}>
        <Pipe points={drainPipePath()} radius={0.075 * s} color={col} segments={80} />
        {drains.map((x, i) => (
          <Pipe key={i} points={[[x, -1.62, PG.drainZ], [x, -2.0, PG.drainZ], [x, -2.0, -0.2], [x, -2.0, 0.0]]} radius={0.06 * s} color={col} segments={20} />
        ))}
        <Pipe points={pumpToTank()} radius={0.06 * s} color={col} segments={30} />
        <Pipe points={returnPath()} radius={0.065 * s} color={col} segments={60} />
      </group>
      {flow > 0.01 ? (
        <>
          <FlowParticles points={drainPipePath().map(([x, y, z]) => [x, y, z + 0.05] as V3)} t={t} count={34} speed={0.22} size={0.045} color={water} visible={flow} />
          <FlowParticles points={returnPath().map(([x, y, z]) => [x, y, z + 0.05] as V3)} t={t} count={22} speed={0.3} size={0.045} color="#CFF1FF" visible={flow} />
          <FlowParticles points={pumpToTank()} t={t} count={8} speed={0.5} size={0.04} color="#CFF1FF" visible={flow} />
        </>
      ) : null}
    </group>
  );
};

// ---------- a piscina (um modelo só, que cresce) ----------
type TileSpot = { p: V3; r: V3; w: number; h: number; band: boolean; z: number };
const tileSpots = (): TileSpot[] => {
  const out: TileSpot[] = [];
  const off = 0.034;
  // fundo
  for (let i = 0; i < 16; i++) for (let j = 0; j < 8; j++) out.push({ p: [-4 + 0.25 + i * 0.5, PG.floorIn + off, -2 + 0.25 + j * 0.5], r: [-Math.PI / 2, 0, 0], w: 0.5, h: 0.5, band: false, z: -2 + 0.25 + j * 0.5 });
  // paredes longas (fundo z=-2 e frente z=+2)
  for (const sz of [-1, 1])
    for (let i = 0; i < 16; i++)
      for (let r = 0; r < 4; r++) out.push({ p: [-4 + 0.25 + i * 0.5, PG.floorIn + 0.2 + r * 0.4, sz * (PG.zi - off)], r: [0, sz < 0 ? 0 : Math.PI, 0], w: 0.5, h: 0.4, band: r === 3, z: sz * PG.zi });
  // paredes curtas
  for (const sx of [-1, 1])
    for (let j = 0; j < 8; j++)
      for (let r = 0; r < 4; r++) out.push({ p: [sx * (PG.xi - off), PG.floorIn + 0.2 + r * 0.4, -2 + 0.25 + j * 0.5], r: [0, (-sx * Math.PI) / 2, 0], w: 0.5, h: 0.4, band: r === 3, z: -2 + 0.25 + j * 0.5 });
  return out;
};

const Tiles: React.FC<{ p: number; cut: boolean; glow: number }> = ({ p, cut, glow }) => {
  const ref = useRef<THREE.InstancedMesh>(null);
  const all = useMemo(() => tileSpots(), []);
  const spots = useMemo(() => all.filter((s) => !cut || s.z < 0), [cut]);
  const N = all.length;
  const pk = Math.round(p * 400) / 400;
  useLayoutEffect(() => {
    const im = ref.current;
    if (!im) return;
    const o = new THREE.Object3D();
    let n = 0;
    all.forEach((s, i) => {
      if (cut && s.z >= 0) return;
      const local = clamp01((pk * (N + 30) - i) / 30);
      const sc = popS(local);
      o.position.set(...s.p);
      o.rotation.set(...s.r);
      o.scale.set(Math.max(0.0001, sc) * (s.w - 0.035), Math.max(0.0001, sc) * (s.h - 0.035), 1);
      o.updateMatrix();
      im.setMatrixAt(n, o.matrix);
      const col = new THREE.Color(s.band ? "#1C5F95" : ["#2E9BD6", "#3AA7DE", "#2A8FCB", "#36A0D8"][Math.floor(rnd(i, 31) * 4)]);
      im.setColorAt(n, col);
      n++;
    });
    im.count = n;
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
  }, [pk, cut]);
  return (
    <instancedMesh frustumCulled={false} ref={ref} args={[undefined, undefined, N]} receiveShadow>
      <boxGeometry args={[1, 1, 0.022]} />
      <meshStandardMaterial roughness={0.25} metalness={0.05} emissive="#FF9A2A" emissiveIntensity={glow * 0.22} />
    </instancedMesh>
  );
};

// camada interna (manta preta ou rejunte claro): fundo + paredes, com varredura em x
const Liner: React.FC<{ sweep: number; off: number; color: string; cut: boolean; rough?: number; glow?: number }> = ({ sweep, off, color, cut, rough = 0.45, glow = 0 }) => {
  if (sweep <= 0.001) return null;
  const x0 = -PG.xi, x1 = -PG.xi + 2 * PG.xi * sweep;
  const zf = cut ? 0 : PG.zi;
  const len = x1 - x0;
  const h = -PG.floorIn;
  const mat = <meshStandardMaterial color={color} roughness={rough} emissive="#FFC24A" emissiveIntensity={glow * 0.4} />;
  const zb = -PG.zi + off;
  return (
    <group>
      <mesh position={[(x0 + x1) / 2, PG.floorIn + off, (-PG.zi + zf) / 2]} receiveShadow>
        <boxGeometry args={[len, 0.012, zf + PG.zi]} />
        {mat}
      </mesh>
      <mesh position={[(x0 + x1) / 2, PG.floorIn + h / 2, zb]} receiveShadow>
        <boxGeometry args={[len, h, 0.012]} />
        {mat}
      </mesh>
      {!cut ? (
        <mesh position={[(x0 + x1) / 2, PG.floorIn + h / 2, PG.zi - off]} receiveShadow>
          <boxGeometry args={[len, h, 0.012]} />
          {mat}
        </mesh>
      ) : null}
      <mesh position={[-PG.xi + off, PG.floorIn + h / 2, (-PG.zi + zf) / 2]} receiveShadow>
        <boxGeometry args={[0.012, h, zf + PG.zi]} />
        {mat}
      </mesh>
      {sweep > 0.98 ? (
        <mesh position={[PG.xi - off, PG.floorIn + h / 2, (-PG.zi + zf) / 2]} receiveShadow>
          <boxGeometry args={[0.012, h, zf + PG.zi]} />
          {mat}
        </mesh>
      ) : null}
    </group>
  );
};

// casco de concreto (sobe de baixo pra cima)
const Shell: React.FC<{ build: number; cut: boolean; glow: number; outerDirt?: number }> = ({ build, cut, glow }) => {
  const tex = useMemo(() => {
    const t = concreteTex().clone();
    t.repeat.set(3, 1);
    t.needsUpdate = true;
    return t;
  }, []);
  if (build <= 0.001) return null;
  const top = PG.floorOut + 0.2 + (-PG.floorOut - 0.2) * build;
  const wallH = top - PG.floorIn;
  const zf = cut ? 0 : PG.zo;
  const mat = <meshStandardMaterial color="#C9C4BA" map={tex} roughness={0.92} emissive="#FF9A2A" emissiveIntensity={glow * 0.2} />;
  return (
    <group>
      <mesh position={[0, (PG.floorOut + PG.floorIn) / 2, (-PG.zo + zf) / 2]} castShadow receiveShadow>
        <boxGeometry args={[2 * PG.xo, 0.2, zf + PG.zo]} />
        {mat}
      </mesh>
      {wallH > 0.01 ? (
        <>
          <mesh position={[0, PG.floorIn + wallH / 2, -PG.zi - 0.1]} castShadow receiveShadow>
            <boxGeometry args={[2 * PG.xo, wallH, 0.2]} />
            {mat}
          </mesh>
          {!cut ? (
            <mesh position={[0, PG.floorIn + wallH / 2, PG.zi + 0.1]} castShadow receiveShadow>
              <boxGeometry args={[2 * PG.xo, wallH, 0.2]} />
              {mat}
            </mesh>
          ) : null}
          {[-1, 1].map((k) => (
            <mesh key={k} position={[k * (PG.xi + 0.1), PG.floorIn + wallH / 2, (-PG.zi + (cut ? 0 : PG.zi)) / 2]} castShadow receiveShadow>
              <boxGeometry args={[0.2, wallH, (cut ? 0 : PG.zi) + PG.zi]} />
              {mat}
            </mesh>
          ))}
        </>
      ) : null}
    </group>
  );
};

// gaiola de vergalhão (instanciada)
const Rebar: React.FC<{ drop: number; cut: boolean; vis: number }> = ({ drop, cut, vis }) => {
  const ref = useRef<THREE.InstancedMesh>(null);
  const bars = useMemo(() => {
    const out: { p: V3; s: V3 }[] = [];
    const st = 0.4;
    const H = -PG.floorOut;
    const zf = cut ? 0 : PG.zo - 0.1;
    // malha do fundo
    for (let x = -4.0; x <= 4.01; x += st) out.push({ p: [x, PG.floorOut + 0.1, (-PG.zo + 0.1 + zf) / 2], s: [0.03, 0.03, zf + PG.zo - 0.1] });
    for (let z = -2.0; z <= (cut ? 0 : 2.01); z += st) out.push({ p: [0, PG.floorOut + 0.1, z], s: [8.2, 0.03, 0.03] });
    // paredes: verticais + horizontais
    for (const sz of cut ? [-1] : [-1, 1]) {
      for (let x = -4.0; x <= 4.01; x += st) out.push({ p: [x, PG.floorOut + H / 2 + 0.1, sz * (PG.zi + 0.1)], s: [0.03, H + 0.2, 0.03] });
      for (let y = PG.floorOut + 0.2; y <= 0.1; y += st) out.push({ p: [0, y, sz * (PG.zi + 0.1)], s: [8.2, 0.03, 0.03] });
    }
    for (const sx of [-1, 1]) {
      for (let z = -2.0; z <= (cut ? 0 : 2.01); z += st) out.push({ p: [sx * (PG.xi + 0.1), PG.floorOut + H / 2 + 0.1, z], s: [0.03, H + 0.2, 0.03] });
      for (let y = PG.floorOut + 0.2; y <= 0.1; y += st) out.push({ p: [sx * (PG.xi + 0.1), y, (-PG.zo + (cut ? 0 : PG.zo)) / 2], s: [0.03, 0.03, (cut ? 0 : PG.zo) + PG.zo] });
    }
    return out;
  }, [cut]);
  useLayoutEffect(() => {
    const im = ref.current;
    if (!im) return;
    const o = new THREE.Object3D();
    bars.forEach((b, i) => {
      o.position.set(b.p[0], b.p[1], b.p[2]);
      o.scale.set(...b.s);
      o.updateMatrix();
      im.setMatrixAt(i, o.matrix);
    });
    im.instanceMatrix.needsUpdate = true;
  }, [bars, vis > 0.01]);
  if (vis <= 0.01) return null;
  return (
    <group position={[0, drop, 0]}>
      <instancedMesh frustumCulled={false} ref={ref} args={[undefined, undefined, bars.length]} castShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#8A4A2E" roughness={0.6} metalness={0.4} />
      </instancedMesh>
    </group>
  );
};

// borda de pedra (peças encaixando ao redor)
const Coping: React.FC<{ p: number; cut: boolean; glow: number }> = ({ p, cut, glow }) => {
  const ref = useRef<THREE.InstancedMesh>(null);
  const stones = useMemo(() => {
    const out: { p: V3; s: V3; z: number }[] = [];
    const ox = PG.xi + 0.45, oz = PG.zi + 0.45;
    const nL = 18;
    const wL = (2 * ox) / nL;
    // perímetro em ordem: fundo (esq→dir), lateral dir, frente (dir→esq), lateral esq
    for (let i = 0; i < nL; i++) out.push({ p: [-ox + (i + 0.5) * wL, 0.04, -PG.zi - 0.2], s: [wL - 0.03, 0.08, 0.6], z: -PG.zi });
    const nS = 8;
    const wS = (2 * (PG.zi - 0.1)) / nS;
    for (let j = 0; j < nS; j++) out.push({ p: [PG.xi + 0.2, 0.04, -PG.zi + 0.1 + (j + 0.5) * wS], s: [0.6, 0.08, wS - 0.03], z: -PG.zi + 0.1 + (j + 0.5) * wS });
    for (let i = nL - 1; i >= 0; i--) out.push({ p: [-ox + (i + 0.5) * wL, 0.04, PG.zi + 0.2], s: [wL - 0.03, 0.08, 0.6], z: PG.zi });
    for (let j = nS - 1; j >= 0; j--) out.push({ p: [-PG.xi - 0.2, 0.04, -PG.zi + 0.1 + (j + 0.5) * wS], s: [0.6, 0.08, wS - 0.03], z: -PG.zi + 0.1 + (j + 0.5) * wS });
    return out;
  }, []);
  const pk = Math.round(p * 300) / 300;
  useLayoutEffect(() => {
    const im = ref.current;
    if (!im) return;
    const o = new THREE.Object3D();
    let n = 0;
    const N = stones.length;
    stones.forEach((s, i) => {
      if (cut && s.z > 0.05) return;
      const local = clamp01((pk * (N + 8) - i) / 8);
      const drop = (1 - popS(local)) * 0.8;
      o.position.set(s.p[0], s.p[1] + drop, s.p[2]);
      const sc = local > 0 ? 1 : 0.0001;
      o.scale.set(s.s[0] * sc, s.s[1] * sc, s.s[2] * sc);
      o.updateMatrix();
      im.setMatrixAt(n, o.matrix);
      const c = new THREE.Color("#E9DEC7");
      c.offsetHSL(0, 0, (rnd(i, 13) - 0.5) * 0.07);
      im.setColorAt(n, c);
      n++;
    });
    im.count = n;
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
  }, [pk, cut]);
  if (p <= 0.001) return null;
  return (
    <instancedMesh frustumCulled={false} ref={ref} args={[undefined, undefined, stones.length]} castShadow receiveShadow>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial roughness={0.85} emissive="#FFC24A" emissiveIntensity={glow * 0.4} />
    </instancedMesh>
  );
};

// deck de placas em volta (racha e levanta quando a piscina sobe)
const Deck: React.FC<{ p: number; cut: boolean; lift: number }> = ({ p, cut, lift }) => {
  const ref = useRef<THREE.InstancedMesh>(null);
  const slabs = useMemo(() => {
    const out: { x: number; z: number; w: number; d: number; inner: boolean; k: number }[] = [];
    const ox = 5.8, oz = 3.8, ix = PG.xi + 0.45, iz = PG.zi + 0.45;
    const s = 0.68;
    let k = 0;
    for (let x = -ox; x < ox - 0.01; x += s)
      for (let z = -oz; z < oz - 0.01; z += s) {
        const cx = x + s / 2, cz = z + s / 2;
        if (Math.abs(cx) < ix + 0.1 && Math.abs(cz) < iz + 0.1) continue;
        const inner = Math.abs(cx) < ix + 0.8 && Math.abs(cz) < iz + 0.8;
        out.push({ x: cx, z: cz, w: s, d: s, inner, k: k++ });
      }
    return out;
  }, []);
  const lk = Math.round(lift * 200) / 200;
  const pk = Math.round(p * 100) / 100;
  useLayoutEffect(() => {
    const im = ref.current;
    if (!im) return;
    const o = new THREE.Object3D();
    let n = 0;
    slabs.forEach((s, i) => {
      if (cut && s.z > 0.2) return;
      const local = clamp01((pk * (slabs.length + 20) - i * 0.6) / 20);
      const r = rnd(i, 17);
      const lc = Math.min(lk, 1.1);
      const L = s.inner ? lc : lc * 0.3 * r;
      // inclina para fora da piscina
      const dx = Math.sign(s.x) * (Math.abs(s.x) > PG.xi + 0.45 ? 1 : 0);
      const dz = Math.sign(s.z) * (Math.abs(s.z) > PG.zi + 0.45 ? 1 : 0);
      o.position.set(s.x + dx * L * 0.15, 0.03 + L * (0.25 + r * 0.35), s.z + dz * L * 0.15);
      o.rotation.set(dz * L * (0.5 + r * 0.4), (r - 0.5) * L * 0.4, -dx * L * (0.5 + r * 0.4));
      const sc = local > 0 ? 1 : 0.0001;
      o.scale.set((s.w - 0.03) * sc, 0.07 * sc, (s.d - 0.03) * sc);
      o.updateMatrix();
      im.setMatrixAt(n, o.matrix);
      const c = new THREE.Color("#D5CDBE");
      c.offsetHSL(0, 0, (r - 0.5) * 0.06);
      im.setColorAt(n, c);
      n++;
    });
    im.count = n;
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
  }, [lk, pk, cut]);
  if (p <= 0.001) return null;
  return (
    <group>
      <instancedMesh frustumCulled={false} ref={ref} args={[undefined, undefined, slabs.length]} castShadow receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial roughness={0.9} />
      </instancedMesh>
      {/* contrapiso cinza por baixo */}
      <Poly {...ringXZ(5.8, 3.8, PG.xo, PG.zo, cut)} rotX y={0.006} color="#8F8A80" />
    </group>
  );
};

// ralo de fundo com tampa abaulada
const Drain: React.FC<{ x: number; glow: number; s?: number }> = ({ x, glow, s = 1 }) => (
  <group position={[x, PG.floorIn + 0.035, PG.drainZ]} scale={s}>
    <mesh>
      <cylinderGeometry args={[0.27, 0.29, 0.03, 24]} />
      <meshStandardMaterial color="#F2F2EE" roughness={0.4} emissive="#FFC24A" emissiveIntensity={glow * 0.8} />
    </mesh>
    <mesh position={[0, 0.0, 0]} scale={[1, 0.38, 1]}>
      <sphereGeometry args={[0.24, 22, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
      <meshStandardMaterial color="#DADDE0" roughness={0.35} emissive="#FFC24A" emissiveIntensity={glow * 0.8} />
    </mesh>
    {[-0.12, -0.04, 0.04, 0.12].map((k) => (
      <mesh key={k} position={[k, 0.075, 0]} rotation={[0, 0, 0]}>
        <boxGeometry args={[0.025, 0.02, 0.32]} />
        <meshStandardMaterial color="#2B3036" />
      </mesh>
    ))}
  </group>
);

// válvula hidrostática no fundo (no plano do corte: meia peça + tubo até o cascalho)
const Valve: React.FC<{ s: number; open: number; glow: number; t: number; jet: number; half: boolean }> = ({ s, open, glow, t, jet, half }) => {
  const th0 = half ? Math.PI / 2 : 0;
  const thL = half ? Math.PI : Math.PI * 2;
  const brass = <meshStandardMaterial color="#D9A441" metalness={0.55} roughness={0.32} emissive="#FFB02A" emissiveIntensity={glow * 0.9} side={THREE.DoubleSide} />;
  const tubeLen = 0.78;
  const col = clamp01(Math.max(jet * 1.2, open));
  return (
    <group position={[0, PG.floorIn + 0.03, half ? 0.012 : 0]} scale={Math.max(0.0001, s)}>
      {/* flange */}
      <mesh>
        <cylinderGeometry args={[0.27, 0.29, 0.06, 28, 1, false, th0, thL]} />
        {brass}
      </mesh>
      {/* tubo atravessando o casco */}
      <mesh position={[0, -tubeLen / 2, 0]}>
        <cylinderGeometry args={[0.14, 0.14, tubeLen, 24, 1, true, th0, thL]} />
        <meshStandardMaterial color="#E9E6DD" roughness={0.5} side={THREE.DoubleSide} />
      </mesh>
      {/* interior escuro do tubo */}
      <mesh position={[0, -tubeLen / 2, -0.001]}>
        <cylinderGeometry args={[0.125, 0.125, tubeLen, 24, 1, true, th0, thL]} />
        <meshStandardMaterial color="#3A3F45" side={THREE.BackSide} />
      </mesh>
      {/* água do chão subindo pelo tubo */}
      {col > 0.01 ? (
        <mesh position={[0, -tubeLen + (tubeLen * col) / 2, 0]}>
          <cylinderGeometry args={[0.12, 0.12, tubeLen * col, 24, 1, false, th0, thL]} />
          <meshStandardMaterial color="#49B6F5" emissive="#2E9BE0" emissiveIntensity={0.35} transparent opacity={0.85} side={THREE.DoubleSide} />
        </mesh>
      ) : null}
      {/* tubo em corte (desenhado na face do corte) */}
      {half ? (
        <group position={[0, -tubeLen / 2 - 0.02, 0.006]}>
          <mesh>
            <planeGeometry args={[0.3, tubeLen]} />
            <meshStandardMaterial color="#E9E6DD" roughness={0.5} />
          </mesh>
          <mesh position={[0, 0, 0.001]}>
            <planeGeometry args={[0.22, tubeLen]} />
            <meshStandardMaterial color="#2E3338" />
          </mesh>
          {col > 0.01 ? (
            <mesh position={[0, -tubeLen / 2 + (tubeLen * col) / 2, 0.002]}>
              <planeGeometry args={[0.22, tubeLen * col]} />
              <meshStandardMaterial color="#49B6F5" emissive="#2E9BE0" emissiveIntensity={0.5} />
            </mesh>
          ) : null}
          {col > 0.01
            ? [0, 1, 2].map((k) => {
                const u = ((t * 1.5 + k / 3) % 1 + 1) % 1;
                const y = -tubeLen / 2 + u * tubeLen * col;
                return (
                  <mesh key={k} position={[0, y, 0.003]} rotation={[0, 0, 0]}>
                    <coneGeometry args={[0.07, 0.12, 3]} />
                    <meshBasicMaterial color="#FFFFFF" />
                  </mesh>
                );
              })
            : null}
        </group>
      ) : null}
      {/* grelha + tampinha com dobradiça */}
      <mesh position={[0, 0.035, 0]}>
        <cylinderGeometry args={[0.15, 0.15, 0.02, 24, 1, false, th0, thL]} />
        <meshStandardMaterial color="#1E2329" side={THREE.DoubleSide} />
      </mesh>
      <group position={[-0.2, 0.06, 0]} rotation={[0, 0, -open * 1.5]}>
        <mesh position={[0.2, 0, 0]}>
          <cylinderGeometry args={[0.2, 0.2, 0.04, 26, 1, false, th0, thL]} />
          {brass}
        </mesh>
      </group>
      {/* setas de pressão dentro do tubo (somem quando abre) */}
      {jet > 0.01
        ? Array.from({ length: 16 }).map((_, i) => {
            const u = ((t * 1.4 + i / 16) % 1 + 1) % 1;
            return (
              <mesh key={i} position={[(rnd(i, 3) - 0.5) * 0.18 * (1 + u * 2), 0.07 + u * 1.2 * jet, -0.06 - rnd(i, 4) * 0.1]} scale={0.03 + u * 0.035}>
                <sphereGeometry args={[1, 8, 6]} />
                <meshStandardMaterial color="#DDF4FF" transparent opacity={0.85 * (1 - u)} roughness={0.1} />
              </mesh>
            );
          })
        : null}
      {jet > 0.01 ? (
        <mesh position={[0, 0.07 + 0.25 * jet, -0.05]}>
          <coneGeometry args={[0.13 * jet, 0.5 * jet, 16, 1, true]} />
          <meshStandardMaterial color="#9FDCFF" transparent opacity={0.45} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      ) : null}
    </group>
  );
};

// escada inox
const Ladder: React.FC<{ s: number }> = ({ s }) => (
  <group scale={[1, Math.max(0.0001, s), 1]}>
    {[-3.35, -2.8].map((x) => (
      <Pipe key={x} points={[[x, -1.2, -1.9], [x, 0.55, -1.9], [x, 0.8, -2.2], [x, 0.55, -2.55], [x, 0.05, -2.6]]} radius={0.035} color="#DDE3E8" segments={40} />
    ))}
    {[-0.3, -0.75].map((y) => (
      <Box key={y} size={[0.55, 0.04, 0.16]} position={[-3.075, y, -1.86]} color="#E8EDF0" />
    ))}
  </group>
);

// boca do skimmer na parede + tampa no deck (abre mostrando o cesto)
const Skimmer: React.FC<{ s: number; glow: number; open?: number; inside?: number }> = ({ s, glow, open = 0, inside = 0 }) => (
  <group>
    <group position={[PG.skimX, PG.wl - 0.02, -PG.zi + 0.05]} scale={[popS(s), popS(s), 1]}>
      <Box size={[0.74, 0.42, 0.04]} color="#F4F4F0" emissive="#FFC24A" emissiveIntensity={glow} />
      <Box size={[0.6, 0.3, 0.06]} position={[0, 0, 0.005]} color="#11161B" />
      <Box size={[0.56, 0.12, 0.02]} position={[0, -0.08, 0.03]} color="#E6E6E0" />
    </group>
    {s > 0.5 ? (
      <group position={[PG.skimX, 0.09, -PG.zi - 0.75]}>
        {/* tampa: desliza para o lado quando abre */}
        <mesh position={[open * 0.55, open * 0.02, 0]} rotation={[0, 0, open * 0.08]}>
          <cylinderGeometry args={[0.22, 0.22, 0.03, 22]} />
          <meshStandardMaterial color="#F2F2EE" emissive="#FFC24A" emissiveIntensity={glow} />
        </mesh>
        {open > 0.01 ? (
          <group>
            <mesh position={[0, 0.005, 0]}>
              <cylinderGeometry args={[0.2, 0.2, 0.012, 24]} />
              <meshStandardMaterial color="#0F1418" />
            </mesh>
            <mesh position={[0, 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[0.15, 0.2, 28]} />
              <meshStandardMaterial color="#F4F4F0" emissive="#FFC24A" emissiveIntensity={glow} />
            </mesh>
            {/* cesto */}
            <mesh position={[0, 0.013, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[0.13, 0.15, 28]} />
              <meshStandardMaterial color="#DDE3E8" />
            </mesh>
            {Array.from({ length: Math.round(7 * inside) }).map((_, i) => (
              <mesh key={i} position={[(rnd(i, 331) - 0.5) * 0.16, 0.016 + i * 0.002, (rnd(i, 332) - 0.5) * 0.16]} rotation={[-Math.PI / 2, 0, i * 1.9]} scale={[0.05, 0.1, 1]}>
                <circleGeometry args={[1, 8]} />
                <meshStandardMaterial color={["#7A8F2A", "#9A7A2A", "#5E8A2E", "#A5662B"][i % 4]} side={THREE.DoubleSide} />
              </mesh>
            ))}
          </group>
        ) : null}
      </group>
    ) : null}
  </group>
);

// bico de retorno + refletores
const Fittings: React.FC<{ ret: number; lights: number; t: number; flow: number }> = ({ ret, lights, t, flow }) => (
  <group>
    {ret > 0.01 ? (
      <group position={[-PG.xi + 0.04, -0.48, -0.8]} scale={popS(ret)}>
        <mesh rotation={[0, 0, -Math.PI / 2]}>
          <cylinderGeometry args={[0.05, 0.09, 0.1, 14]} />
          <meshStandardMaterial color="#F4F4F0" />
        </mesh>
        {flow > 0.01
          ? Array.from({ length: 10 }).map((_, i) => {
              const u = ((t * 1.3 + i / 10) % 1 + 1) % 1;
              return (
                <mesh key={i} position={[0.1 + u * 1.6, Math.sin(i * 2.1) * 0.05 * u, Math.cos(i * 1.7) * 0.06 * u]} scale={0.03 + u * 0.03}>
                  <sphereGeometry args={[1, 8, 6]} />
                  <meshStandardMaterial color="#E8FAFF" transparent opacity={0.7 * (1 - u) * flow} />
                </mesh>
              );
            })
          : null}
      </group>
    ) : null}
    {lights > 0.001
      ? [-0.8, 3.1].map((x) => (
          <group key={x} position={[x, -0.85, -PG.zi + 0.045]}>
            <mesh>
              <cylinderGeometry args={[0.13, 0.13, 0.03, 18]} />
              <meshStandardMaterial color="#F6FBFF" emissive="#BFF6FF" emissiveIntensity={lights * 4} />
            </mesh>
            <Glow position={[0, 0, 0.3]} size={4.2} color="#5FE0FF" opacity={lights * 0.95} />
          </group>
        ))
      : null}
  </group>
);

// folhas (boiando ou caindo)
export type Leaf = { x: number; z: number; y: number; r: number; s: number; c: string; vis: number };
const Leaves: React.FC<{ leaves: Leaf[] }> = ({ leaves }) => {
  const geo = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(0, -0.16);
    s.quadraticCurveTo(0.11, -0.02, 0, 0.16);
    s.quadraticCurveTo(-0.11, -0.02, 0, -0.16);
    const g = new THREE.ShapeGeometry(s);
    g.rotateX(-Math.PI / 2);
    return g;
  }, []);
  return (
    <group>
      {leaves.map((l, i) =>
        l.vis > 0.01 ? (
          <mesh key={i} geometry={geo} position={[l.x, l.y, l.z]} rotation={[0, l.r, 0]} scale={l.s * l.vis} castShadow>
            <meshStandardMaterial color={l.c} side={THREE.DoubleSide} roughness={0.7} />
          </mesh>
        ) : null,
      )}
    </group>
  );
};

// algas: manchas verdes nas paredes e no fundo + filamentos boiando
const Algae: React.FC<{ a: number; cut: boolean; t: number }> = ({ a, cut, t }) => {
  if (a <= 0.01) return null;
  const items = Array.from({ length: 46 }).map((_, i) => {
    const onFloor = i % 3 === 0;
    const side = i % 5 === 1 && !cut ? 1 : -1;
    const x = -3.7 + rnd(i, 101) * 7.4;
    const z = onFloor ? -1.8 + rnd(i, 102) * (cut ? 1.7 : 3.6) : side * (PG.zi - 0.05);
    const y = onFloor ? PG.floorIn + 0.05 : PG.floorIn + 0.15 + rnd(i, 103) * 1.35;
    return { x, y, z, onFloor, side, s: (0.22 + rnd(i, 104) * 0.45) * clamp01(a * 1.6 - rnd(i, 105) * 0.6) };
  });
  return (
    <group>
      {items.map((it, i) =>
        it.s > 0.01 ? (
          <mesh key={i} position={[it.x, it.y, it.z]} rotation={it.onFloor ? [-Math.PI / 2, 0, i] : [0, it.side > 0 ? Math.PI : 0, i]} scale={[it.s * 1.5, it.s, 1]}>
            <circleGeometry args={[1, 9]} />
            <meshStandardMaterial color={["#2F5214", "#3E6A1A", "#4F7D22"][i % 3]} transparent opacity={0.92} depthWrite={false} roughness={0.9} />
          </mesh>
        ) : null,
      )}
      {/* faixa de lodo na linha d'água */}
      <mesh position={[0, PG.wl - 0.05, -PG.zi + 0.05]}>
        <planeGeometry args={[7.9, 0.2 * a]} />
        <meshStandardMaterial color="#3F5E18" transparent opacity={0.9} depthWrite={false} />
      </mesh>
      {/* filamentos e nata de alga boiando */}
      {Array.from({ length: 16 }).map((_, i) => {
        const x = -3.5 + rnd(i, 111) * 7, z = -1.8 + rnd(i, 112) * (cut ? 1.7 : 3.6);
        const sc = (0.25 + rnd(i, 113) * 0.5) * clamp01(a * 1.4 - rnd(i, 114) * 0.4);
        if (sc <= 0.01) return null;
        return (
          <group key={`f${i}`} position={[x + Math.sin(t * 0.4 + i) * 0.08, PG.wl + 0.03, z]} rotation={[-Math.PI / 2, 0, i * 1.7]}>
            <mesh scale={[sc * 1.8, sc, 1]}>
              <circleGeometry args={[1, 7]} />
              <meshStandardMaterial color="#5C7F1E" transparent opacity={0.85} depthWrite={false} roughness={0.8} />
            </mesh>
            {[0, 1, 2].map((k) => (
              <mesh key={k} position={[sc * (1.2 + k * 0.4), (k - 1) * sc * 0.5, 0.001]} rotation={[0, 0, (k - 1) * 0.5]}>
                <planeGeometry args={[sc * 1.6, 0.025]} />
                <meshStandardMaterial color="#3E5E14" />
              </mesh>
            ))}
          </group>
        );
      })}
    </group>
  );
};

// água da piscina: volume translúcido + superfície com ondinha
export const PoolWater: React.FC<{ level: number; t: number; cut: boolean; color: string; deep: string; opacity: number; inPit?: boolean; volOpacity?: number; glow?: number }> = ({ level, t, cut, color, deep, opacity, inPit, volOpacity = 0.38, glow = 0 }) => {
  const x = inPit ? PG.xo : PG.xi;
  const z = inPit ? PG.zo : PG.zi;
  const floor = inPit ? PG.floorOut : PG.floorIn + 0.05;
  const h = level - floor;
  if (h <= 0.01) return null;
  const zf = cut ? 0 : z;
  return (
    <group>
      <mesh position={[0, floor + h / 2, (-z + zf) / 2]} renderOrder={2}>
        <boxGeometry args={[2 * x - 0.01, h, z + zf - 0.01]} />
        <meshStandardMaterial color={deep} transparent opacity={volOpacity} roughness={0.1} depthWrite={false} emissive={deep} emissiveIntensity={glow * 0.9} />
      </mesh>
      <WaterPlane size={[2 * x - 0.01, z + zf - 0.01]} position={[0, level, (-z + zf) / 2]} t={t} color={color} deep={deep} opacity={opacity} glow={glow} />
    </group>
  );
};

const WaterPlane: React.FC<{ size: [number, number]; position: V3; t: number; color: string; deep: string; opacity: number; glow?: number }> = ({ size, position, t, color, deep, opacity, glow = 0 }) => {
  const geo = useMemo(() => new THREE.PlaneGeometry(size[0], size[1], 64, 32), [size.join()]);
  const base = useMemo(() => Float32Array.from(geo.attributes.position.array as Float32Array), [geo]);
  useEffect(() => () => geo.dispose(), [geo]);
  useLayoutEffect(() => {
    const p = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const x = base[i * 3], y = base[i * 3 + 1];
      p.setZ(i, 0.04 * (Math.sin(x * 2.2 + t * 2.4) + Math.sin(y * 2.9 - t * 1.9) * 0.7 + Math.sin((x + y) * 5.1 + t * 3.3) * 0.3 + Math.sin(x * 7.3 - y * 4.1 + t * 4.2) * 0.15));
    }
    p.needsUpdate = true;
    geo.computeVertexNormals();
  }, [t, geo]);
  return (
    <mesh geometry={geo} position={position} rotation={[-Math.PI / 2, 0, 0]} renderOrder={3}>
      <meshPhysicalMaterial color={color} roughness={0.04} metalness={0.05} clearcoat={1} clearcoatRoughness={0.03} specularIntensity={1} transparent opacity={opacity} emissive={deep} emissiveIntensity={0.22 + glow * 1.1} depthWrite={false} side={THREE.DoubleSide} />
    </mesh>
  );
};

// ---------- setas 3D ----------
export const Arrow3: React.FC<{ from: V3; to: V3; color?: string; r?: number; opacity?: number }> = ({ from, to, color = "#FF5A2A", r = 0.07, opacity = 1 }) => {
  const a = new THREE.Vector3(...from), b = new THREE.Vector3(...to);
  const dir = b.clone().sub(a);
  const len = dir.length();
  if (len < 0.01 || opacity <= 0.01) return null;
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
  const head = Math.min(len * 0.45, r * 4);
  return (
    <group position={from} quaternion={q}>
      <mesh position={[0, (len - head) / 2, 0]}>
        <cylinderGeometry args={[r, r, len - head, 10]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.35} transparent={opacity < 1} opacity={opacity} />
      </mesh>
      <mesh position={[0, len - head / 2, 0]}>
        <coneGeometry args={[r * 2.4, head, 14]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.35} transparent={opacity < 1} opacity={opacity} />
      </mesh>
    </group>
  );
};

// setas de sucção convergindo para o ralo (animadas)
export const Suction: React.FC<{ x: number; amt: number; t: number; color?: string; reach?: number; flat?: boolean }> = ({ x, amt, t, color = "#FF6A2A", reach = 1, flat = false }) => {
  if (amt <= 0.01) return null;
  const n = flat ? 8 : 6;
  return (
    <group position={[x, PG.floorIn + 0.08, PG.drainZ]}>
      {Array.from({ length: n }).map((_, i) => {
        const ang = flat ? (i / n) * Math.PI * 2 : (i / n) * Math.PI + 0.2;
        const ph = ((t * 1.4 + i * 0.37) % 1 + 1) % 1;
        const R = (0.95 + 0.35 * reach) * (1 - ph * 0.45);
        const from: V3 = flat ? [Math.cos(ang) * R, 0.02, Math.sin(ang) * R] : [Math.cos(ang) * R, Math.sin(ang) * R * 0.85, 0.05];
        const to: V3 = flat ? [Math.cos(ang) * (R - 0.45), 0.02, Math.sin(ang) * (R - 0.45)] : [Math.cos(ang) * (R - 0.45), Math.sin(ang) * (R - 0.45) * 0.85, 0.05];
        return <Arrow3 key={i} from={from} to={to} color={color} r={(0.035 + 0.03 * amt) * (flat ? 1.3 : 1)} opacity={Math.min(1, amt * 1.3) * (ph < 0.8 ? 1 : (1 - ph) * 5)} />;
      })}
    </group>
  );
};

// cáusticas animadas no fundo
const causticTex = () =>
  canvasTex("caustic", 256, 256, (g) => {
    g.fillStyle = "#000";
    g.fillRect(0, 0, 256, 256);
    g.strokeStyle = "rgba(255,255,255,0.9)";
    g.lineCap = "round";
    // rede de células (Voronoi aproximado) tileável
    const pts: [number, number][] = [];
    for (let i = 0; i < 26; i++) pts.push([rnd(i, 301) * 256, rnd(i, 302) * 256]);
    const img = g.getImageData(0, 0, 256, 256);
    for (let y = 0; y < 256; y++)
      for (let x = 0; x < 256; x++) {
        let d1 = 1e9, d2 = 1e9;
        for (const [px, py] of pts)
          for (const ox of [-256, 0, 256])
            for (const oy of [-256, 0, 256]) {
              const d = Math.hypot(x - px - ox, y - py - oy);
              if (d < d1) {
                d2 = d1;
                d1 = d;
              } else if (d < d2) d2 = d;
            }
        const e = Math.max(0, 1 - (d2 - d1) / 7);
        const v = Math.round(255 * e * e);
        const k = (y * 256 + x) * 4;
        img.data[k] = img.data[k + 1] = img.data[k + 2] = v;
        img.data[k + 3] = 255;
      }
    g.putImageData(img, 0, 0);
  });
export const Caustics: React.FC<{ t: number; amt: number; cut: boolean }> = ({ t, amt, cut }) => {
  const [a, b] = useMemo(() => {
    const m = (r: number) => {
      const tx = causticTex().clone();
      tx.repeat.set(2 * PG.xi / r, (cut ? PG.zi : 2 * PG.zi) / r);
      tx.needsUpdate = true;
      return tx;
    };
    return [m(1.3), m(1.9)];
  }, [cut]);
  if (amt <= 0.01) return null;
  a.offset.set(t * 0.05, t * 0.031);
  b.offset.set(-t * 0.037, t * 0.045);
  const zc = cut ? -PG.zi / 2 : 0;
  const zl = cut ? PG.zi : 2 * PG.zi;
  return (
    <group>
      {[a, b].map((tx, i) => (
        <mesh key={i} position={[0, PG.floorIn + 0.05 + i * 0.002, zc]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={1}>
          <planeGeometry args={[2 * PG.xi - 0.02, zl - 0.02]} />
          <meshBasicMaterial map={tx} color="#CFF6FF" transparent opacity={0.28 * amt} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
};

// placas de grama que rasgam e levantam em volta (piscina saindo da terra)
export const Turf: React.FC<{ p: number }> = ({ p }) => {
  if (p <= 0.01) return null;
  const items: { x: number; z: number; rx: number; rz: number; w: number; d: number }[] = [];
  const ox = 5.8, oz = 3.8;
  for (let i = 0; i < 9; i++) {
    const x = -ox + 0.6 + (i / 8) * (2 * ox - 1.2);
    items.push({ x, z: oz + 0.35, rx: 1, rz: 0, w: 1.2, d: 0.7 });
    items.push({ x, z: -oz - 0.35, rx: -1, rz: 0, w: 1.2, d: 0.7 });
  }
  for (let j = 0; j < 6; j++) {
    const z = -oz + 0.6 + (j / 5) * (2 * oz - 1.2);
    items.push({ x: ox + 0.35, z, rx: 0, rz: 1, w: 0.7, d: 1.2 });
    items.push({ x: -ox - 0.35, z, rx: 0, rz: -1, w: 0.7, d: 1.2 });
  }
  return (
    <group>
      {items.map((it, i) => {
        const r = rnd(i, 311);
        const a = p * (0.35 + r * 0.55);
        return (
          <group key={i} position={[it.x + it.rz * p * 0.15, 0.02 + p * 0.12 * r, it.z + it.rx * p * 0.15]} rotation={[it.rx * a, (r - 0.5) * 0.3 * p, -it.rz * a]}>
            <mesh position={[0, -0.09, 0]} castShadow>
              <boxGeometry args={[it.w - 0.05, 0.18, it.d - 0.05]} />
              <meshStandardMaterial color="#6E4A2E" roughness={1} />
            </mesh>
            <mesh position={[0, 0.005, 0]}>
              <boxGeometry args={[it.w - 0.04, 0.03, it.d - 0.04]} />
              <meshStandardMaterial color="#67AA48" roughness={1} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
};

// terra caindo do casco enquanto ele sobe
export const FallingDirt: React.FC<{ t: number; lift: number; on: number }> = ({ t, lift, on }) => {
  if (on <= 0.01 || lift < 0.2) return null;
  const bottom = PG.floorOut + lift;
  return (
    <group>
      {Array.from({ length: 30 }).map((_, i) => {
        const side = i % 4;
        const al = (rnd(i, 321) - 0.5) * 2;
        const x = side < 2 ? al * PG.xo : (side === 2 ? 1 : -1) * (PG.xo + 0.05);
        const z = side < 2 ? (side === 0 ? 1 : -1) * (PG.zo + 0.05) : al * PG.zo;
        const u = ((t * 0.9 + rnd(i, 322)) % 1 + 1) % 1;
        const y0 = bottom + 0.2 + rnd(i, 323) * 0.9;
        const y = y0 - u * u * 3.2;
        if (y < PG.floorOut + 0.1) return null;
        return (
          <mesh key={i} position={[x * 1.01, y, z * 1.01]} rotation={[u * 5 + i, i, u * 3]} scale={(0.06 + rnd(i, 324) * 0.08) * on}>
            <icosahedronGeometry args={[1, 0]} />
            <meshStandardMaterial color={i % 3 ? "#6E4A2E" : "#8E5A36"} flatShading />
          </mesh>
        );
      })}
    </group>
  );
};

// ---------- fenômenos no corte ----------
// polígono no plano do corte (z = 0)
export const CutPoly: React.FC<{ pts: P2[]; color: string; opacity?: number; z?: number }> = ({ pts, color, opacity = 0.6, z = 0.01 }) => <Poly pts={pts} color={color} opacity={opacity} z={z} rough={0.4} />;

// lençol freático: tudo abaixo de wt (menos o buraco da piscina)
export const waterTablePts = (wt: number, pitBottom: number, t: number): P2[] => {
  const W = 40;
  const wave = (x: number) => wt + Math.sin(x * 1.3 + t * 2) * 0.05 + Math.sin(x * 0.4 - t) * 0.04;
  const top: P2[] = [];
  if (wt <= pitBottom) {
    for (let x = W; x >= -W; x -= 1) top.push([x, wave(x)]);
    return [[-W, -7], [W, -7], ...top];
  }
  const out: P2[] = [[-W, -7], [W, -7]];
  for (let x = W; x >= PG.xo; x -= 1) out.push([x, wave(x)]);
  out.push([PG.xo, wave(PG.xo)], [PG.xo, pitBottom], [-PG.xo, pitBottom], [-PG.xo, wave(-PG.xo)]);
  for (let x = -PG.xo - 1; x >= -W; x -= 1) out.push([x, wave(x)]);
  return out;
};

// mancha úmida em U em volta do buraco
export const wetPts = (r: number, depth: number): P2[] => {
  const pts: P2[] = [];
  const cx = 0, cy = depth / 2;
  const ax = PG.xo + r, ay = -depth / 2 + r * 0.8;
  for (let k = 0; k <= 24; k++) {
    const a = Math.PI + (k / 24) * Math.PI; // de 180° a 360° (metade de baixo)
    const n = 1 + Math.sin(k * 2.3) * 0.08;
    pts.push([cx + Math.cos(a) * ax * n, Math.min(0, cy + Math.sin(a) * (ay + 0.4) * n)]);
  }
  pts[0] = [-(PG.xo + r), 0];
  pts[pts.length - 1] = [PG.xo + r, 0];
  return [...pts, [PG.xo, 0], [PG.xo, depth], [-PG.xo, depth], [-PG.xo, 0]];
};

// poros e fios d'água atravessando a parede (close no corte)
export const Pores: React.FC<{ t: number; amt: number }> = ({ t, amt }) => {
  if (amt <= 0.01) return null;
  return (
    <group>
      {Array.from({ length: 34 }).map((_, i) => (
        <mesh key={i} position={[PG.xi + 0.02 + rnd(i, 121) * 0.16, -1.75 + rnd(i, 122) * 1.65, 0.012]} scale={0.008 + rnd(i, 123) * 0.014}>
          <circleGeometry args={[1, 7]} />
          <meshStandardMaterial color="#45413B" />
        </mesh>
      ))}
      {Array.from({ length: 9 }).map((_, i) => {
        const y = -1.4 + rnd(i, 131) * 1.1;
        const u = ((t * 0.55 + rnd(i, 132)) % 1 + 1) % 1;
        const x = PG.xi + u * 0.9;
        const wob = Math.sin(u * 14 + i) * 0.02;
        return (
          <mesh key={i} position={[x, y + wob - u * 0.15, 0.03]} scale={[0.035, 0.022, 0.02]}>
            <sphereGeometry args={[1, 8, 6]} />
            <meshStandardMaterial color="#5FC3F5" emissive="#5FC3F5" emissiveIntensity={0.4} transparent opacity={amt * (u < 0.9 ? 1 : (1 - u) * 10)} />
          </mesh>
        );
      })}
    </group>
  );
};

// faixa úmida avançando pelo solo até o muro
export const leakPts = (p: number, t: number): P2[] => {
  const x0 = PG.xo, x1 = PG.xo + (PG.muroX + 0.25 - PG.xo) * p;
  const top: P2[] = [];
  const bot: P2[] = [];
  for (let k = 0; k <= 16; k++) {
    const x = x0 + ((x1 - x0) * k) / 16;
    const u = k / 16;
    top.push([x, -0.45 + Math.sin(k * 1.7 + t) * 0.04 + u * 0.15]);
    bot.push([x, -1.45 + Math.sin(k * 2.1) * 0.08 + u * 0.55]);
  }
  return [...bot, ...top.reverse()];
};

// torrões voando + poeira quando a piscina sai da terra
export const Debris: React.FC<{ p: number }> = ({ p }) => {
  if (p <= 0.01 || p >= 0.999) return null;
  return (
    <group>
      {Array.from({ length: 40 }).map((_, i) => {
        const side = i % 4;
        const along = (rnd(i, 141) - 0.5) * 2;
        const base: V3 = side === 0 ? [along * 4.4, 0, PG.zo + 0.4] : side === 1 ? [along * 4.4, 0, -PG.zo - 0.4] : side === 2 ? [PG.xo + 0.4, 0, along * 2.2] : [-PG.xo - 0.4, 0, along * 2.2];
        const dir: V3 = side === 0 ? [0, 0, 1] : side === 1 ? [0, 0, -1] : side === 2 ? [1, 0, 0] : [-1, 0, 0];
        const sp = 1.2 + rnd(i, 142) * 2.2;
        const tt = clamp01(p * 1.6 - rnd(i, 143) * 0.5) * 1.1;
        const y = sp * 1.6 * tt - 4.9 * tt * tt;
        if (tt <= 0 || y < -0.1) return null;
        return (
          <mesh key={i} position={[base[0] + dir[0] * sp * tt, Math.max(0, y) + 0.1, base[2] + dir[2] * sp * tt]} rotation={[tt * 6 + i, tt * 4, i]} scale={0.12 + rnd(i, 144) * 0.18} castShadow>
            <icosahedronGeometry args={[1, 0]} />
            <meshStandardMaterial color={i % 3 ? "#7B4B2C" : "#5E9E42"} flatShading roughness={1} />
          </mesh>
        );
      })}
      {Array.from({ length: 10 }).map((_, i) => {
        const a = (i / 10) * Math.PI * 2;
        const s = 0.4 + p * 1.6 * (0.6 + rnd(i, 151) * 0.6);
        return (
          <mesh key={`d${i}`} position={[Math.cos(a) * 5.2, 0.3 + p * 0.6, Math.sin(a) * 3.2]} scale={s}>
            <icosahedronGeometry args={[1, 1]} />
            <meshStandardMaterial color="#C9AE8A" transparent opacity={0.35 * (1 - p)} depthWrite={false} flatShading />
          </mesh>
        );
      })}
    </group>
  );
};

// rachaduras na grama em volta
export const GroundCracks: React.FC<{ p: number; cut: boolean }> = ({ p, cut }) => {
  if (p <= 0.01) return null;
  const cracks = Array.from({ length: 14 }).map((_, i) => {
    const a = (i / 14) * Math.PI * 2 + rnd(i, 161) * 0.3;
    const r0x = 6.0, r0z = 4.0;
    return { x: Math.cos(a) * r0x, z: Math.sin(a) * r0z, a, len: (1.2 + rnd(i, 162) * 2.4) * p };
  });
  return (
    <group>
      {cracks
        .filter((c) => !cut || c.z < -0.3)
        .map((c, i) => (
          <group key={i} position={[c.x, 0.012, c.z]} rotation={[0, -c.a, 0]}>
            {[0, 1, 2].map((k) => (
              <mesh key={k} position={[(k + 0.5) * (c.len / 3), 0, Math.sin(k * 2.7 + i) * 0.12]} rotation={[-Math.PI / 2, 0, Math.sin(k * 3 + i) * 0.35]}>
                <planeGeometry args={[c.len / 3 + 0.05, 0.07 * (1 - k * 0.25)]} />
                <meshStandardMaterial color="#2A1B12" />
              </mesh>
            ))}
          </group>
        ))}
    </group>
  );
};

// ---------- montagem da piscina ----------
export type PoolState = {
  dig: number;
  cut: boolean;
  pitWater: number; // nível absoluto da água no buraco de terra (sem casco)
  pitColor: string;
  mud: number;
  rebarDrop: number;
  rebarVis: number;
  build: number;
  shellGlow: number;
  rubber: number;
  rubberGlow: number;
  tiles: number;
  coping: number;
  deck: number;
  ladder: number;
  water: number; // nível da água no casco (-99 = sem água)
  waterColor: string;
  waterDeep: string;
  waterOpacity: number;
  volOpacity: number;
  algae: number;
  dirt: number;
  leaves: Leaf[];
  drains: number[];
  drainGlow: number;
  skimmer: number;
  skimGlow: number;
  ret: number;
  lights: number;
  flow: number;
  valve: number;
  valveOpen: number;
  valveGlow: number;
  valveJet: number;
  lift: number;
  tilt: number;
  skimOpen?: number;
  skimIn?: number;
  caustic?: number;
};

export const Pool: React.FC<{ s: PoolState; t: number; children?: React.ReactNode }> = ({ s, t, children }) => {
  const cut = s.cut;
  return (
    <group position={[0, s.lift, 0]} rotation={[0, 0, s.tilt]}>
      <Rebar drop={s.rebarDrop} cut={cut} vis={s.rebarVis} />
      <Shell build={s.build} cut={cut} glow={s.shellGlow} />
      {s.lift > 0.02 && !cut ? (
        <group>
          {[-1, 1].map((k) => (
            <mesh key={`a${k}`} position={[0, -1.25, k * (PG.zo + 0.02)]} scale={[1, 1, 1]}>
              <boxGeometry args={[2 * PG.xo + 0.06, 1.1, 0.03]} />
              <meshStandardMaterial color="#6E4A2E" roughness={1} />
            </mesh>
          ))}
          {[-1, 1].map((k) => (
            <mesh key={`b${k}`} position={[k * (PG.xo + 0.02), -1.25, 0]}>
              <boxGeometry args={[0.03, 1.1, 2 * PG.zo + 0.06]} />
              <meshStandardMaterial color="#6E4A2E" roughness={1} />
            </mesh>
          ))}
        </group>
      ) : null}
      <Liner sweep={s.rubber} off={0.008} color="#1E2022" cut={cut} rough={0.35} glow={s.rubberGlow} />
      <Liner sweep={s.tiles > 0 ? 1 : 0} off={0.018} color="#DCE6EA" cut={cut} rough={0.6} />
      {s.tiles > 0 ? <Tiles p={s.tiles} cut={cut} glow={s.rubberGlow} /> : null}
      <Coping p={s.coping} cut={cut} glow={s.rubberGlow} />
      {s.ladder > 0 ? <Ladder s={popS(s.ladder)} /> : null}
      {s.drains.map((x, i) => (
        <Drain key={i} x={x} glow={s.drainGlow} />
      ))}
      {s.valve > 0 ? <Valve s={popS(s.valve)} open={s.valveOpen} glow={s.valveGlow} t={t} jet={s.valveJet} half={cut} /> : null}
      <Skimmer s={s.skimmer} glow={s.skimGlow} open={s.skimOpen ?? 0} inside={s.skimIn ?? 0} />
      <Fittings ret={s.ret} lights={s.lights} t={t} flow={s.flow} />
      <Algae a={s.algae} cut={cut} t={t} />
      <Caustics t={t} amt={s.caustic ?? 0} cut={cut} />
      {s.dirt > 0.01
        ? Array.from({ length: 30 }).map((_, i) => (
            <mesh key={i} position={[-3.7 + rnd(i, 171) * 7.4, PG.floorIn + 0.05, -1.8 + rnd(i, 172) * (cut ? 1.7 : 3.6)]} rotation={[-Math.PI / 2, 0, i]} scale={(0.04 + rnd(i, 173) * 0.08) * s.dirt}>
              <circleGeometry args={[1, 6]} />
              <meshStandardMaterial color="#5B4630" />
            </mesh>
          ))
        : null}
      {children}
      {s.water > -50 ? <PoolWater level={s.water} t={t} cut={cut} color={s.waterColor} deep={s.lights > 0 ? mixHex(s.waterDeep, "#19C8FF", s.lights) : s.waterDeep} opacity={s.waterOpacity} volOpacity={s.volOpacity} glow={s.lights} /> : null}
      <Leaves leaves={s.leaves} />
    </group>
  );
};

// água + lama no buraco de terra (antes do casco)
export const PitWater: React.FC<{ s: PoolState; t: number }> = ({ s, t }) => (
  <group>
    {s.mud > 0.01 ? (
      <group>
        <mesh position={[0, PG.floorOut * s.dig + 0.03, s.cut ? -PG.zo / 2 : 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[2 * PG.xo, s.cut ? PG.zo : 2 * PG.zo]} />
          <meshStandardMaterial color="#4A3020" roughness={0.12} metalness={0.15} transparent opacity={s.mud} />
        </mesh>
        {Array.from({ length: 9 }).map((_, i) => (
          <mesh key={i} position={[-3.5 + rnd(i, 181) * 7, PG.floorOut * s.dig + 0.04, -1.9 + rnd(i, 182) * (s.cut ? 1.7 : 3.8)]} rotation={[-Math.PI / 2, 0, 0]} scale={[0.3 + rnd(i, 183) * 0.5, 0.2 + rnd(i, 184) * 0.3, 1]}>
            <circleGeometry args={[1, 14]} />
            <meshStandardMaterial color="#6E4E36" roughness={0.05} metalness={0.3} transparent opacity={s.mud} />
          </mesh>
        ))}
      </group>
    ) : null}
    {s.pitWater > PG.floorOut * s.dig + 0.02 ? <PoolWater level={s.pitWater} t={t} cut={s.cut} color={s.pitColor} deep="#2A6E9A" opacity={0.85} inPit volOpacity={0.5} /> : null}
  </group>
);

// ---------- adereços do quintal ----------
export const DirtPile: React.FC<{ p: number; position?: V3 }> = ({ p, position = [5.6, 0, -3.9] }) =>
  p > 0.01 ? (
    <group position={position} scale={[p, p, p]}>
      <mesh position={[0, 0.25, 0]} scale={[1.5, 0.75, 1.1]} castShadow>
        <icosahedronGeometry args={[1, 1]} />
        <meshStandardMaterial color="#8E5A36" flatShading roughness={1} />
      </mesh>
      <mesh position={[0.7, 0.1, 0.5]} scale={[0.8, 0.45, 0.7]} castShadow>
        <icosahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color="#7A4B2C" flatShading roughness={1} />
      </mesh>
    </group>
  ) : null;

export const ShovelP: React.FC<{ position: V3; rot: V3 }> = ({ position, rot }) => (
  <group position={position} rotation={rot}>
    <mesh position={[0, 0.7, 0]} castShadow>
      <cylinderGeometry args={[0.03, 0.03, 1.4, 8]} />
      <meshStandardMaterial map={woodTexture()} color="#C8935C" />
    </mesh>
    <Box size={[0.22, 0.05, 0.06]} position={[0, 1.42, 0]} color="#2E2F33" />
    <mesh position={[0, -0.12, 0]} scale={[1, 1, 0.25]} castShadow>
      <sphereGeometry args={[0.18, 12, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
      <meshStandardMaterial color="#8B949C" metalness={0.5} roughness={0.4} side={THREE.DoubleSide} />
    </mesh>
  </group>
);

export const Hose: React.FC<{ on: number; t: number; level: number }> = ({ on, t, level }) => (
  <group>
    <Pipe points={[[-3.4, 0.8, -8.85], [-3.4, 0.08, -8.6], [-3.0, 0.06, -6.5], [-2.4, 0.06, -4.0], [-1.8, 0.08, -2.6], [-1.6, 0.25, -2.25]]} radius={0.045} color="#2F9E5B" segments={60} />
    {on > 0.01 ? (
      <>
        <Pipe points={[[-1.6, 0.25, -2.2], [-1.45, 0.25, -1.9], [-1.3, Math.max(level, -1.7) * 0.4, -1.55], [-1.2, Math.max(level, -1.7), -1.4]]} radius={0.05 * on} color="#9FDCFF" opacity={0.8} segments={20} />
        {Array.from({ length: 6 }).map((_, i) => {
          const u = ((t * 2 + i / 6) % 1 + 1) % 1;
          const a = (i / 6) * Math.PI * 2;
          return (
            <mesh key={i} position={[-1.2 + Math.cos(a) * u * 0.4, Math.max(level, -1.7) + 0.05 + Math.sin(u * Math.PI) * 0.15, -1.4 + Math.sin(a) * u * 0.4]} scale={0.04 * on}>
              <sphereGeometry args={[1, 6, 5]} />
              <meshStandardMaterial color="#E6F7FF" transparent opacity={1 - u} />
            </mesh>
          );
        })}
      </>
    ) : null}
  </group>
);

// calha de concreto (betoneira) despejando
export const Chute: React.FC<{ on: number; t: number; level: number }> = ({ on, t, level }) =>
  on > 0.01 ? (
    <group>
      <group position={[6.2, 2.2, 3.4]} rotation={[0, 0.6, 0]}>
        <mesh position={[-1.4, -0.5, 0]} rotation={[0, 0, 0.42]} castShadow>
          <boxGeometry args={[3.2, 0.08, 0.5]} />
          <meshStandardMaterial color="#7A8288" metalness={0.5} roughness={0.5} />
        </mesh>
        {[-1, 1].map((k) => (
          <mesh key={k} position={[-1.4, -0.38, k * 0.25]} rotation={[0, 0, 0.42]}>
            <boxGeometry args={[3.2, 0.25, 0.04]} />
            <meshStandardMaterial color="#6A7278" metalness={0.5} />
          </mesh>
        ))}
      </group>
      <Pipe points={[[3.0, 0.9, 1.6], [2.6, 0.3, 1.2], [2.3, level, 0.9]]} radius={0.17 * on} color="#9D9890" segments={16} />
      {Array.from({ length: 5 }).map((_, i) => {
        const u = ((t * 1.5 + i / 5) % 1 + 1) % 1;
        return (
          <mesh key={i} position={[2.3 + Math.cos(i * 2) * u * 0.6, level + 0.05, 0.9 + Math.sin(i * 2) * u * 0.5]} scale={[0.25 * (1 - u * 0.5), 0.06, 0.25]}>
            <sphereGeometry args={[1, 10, 6]} />
            <meshStandardMaterial color="#A39E95" roughness={0.9} />
          </mesh>
        );
      })}
    </group>
  ) : null;

// pastilha de cloro + respingo
export const Tablet: React.FC<{ p: number; from: V3; to: V3; t: number }> = ({ p, from, to }) => {
  if (p <= 0 || p >= 1.6) return null;
  const u = Math.min(1, p);
  const x = from[0] + (to[0] - from[0]) * u;
  const z = from[2] + (to[2] - from[2]) * u;
  const y = from[1] + (to[1] - from[1]) * u + Math.sin(u * Math.PI) * 0.9;
  const splash = p > 1 ? p - 1 : 0;
  return (
    <group>
      {p <= 1 ? (
        <mesh position={[x, y, z]} rotation={[u * 8, u * 5, 0]} castShadow>
          <cylinderGeometry args={[0.17, 0.17, 0.07, 18]} />
          <meshStandardMaterial color="#FFFFFF" emissive="#FFFFFF" emissiveIntensity={0.5} />
        </mesh>
      ) : null}
      {splash > 0
        ? Array.from({ length: 10 }).map((_, i) => {
            const a = (i / 10) * Math.PI * 2;
            const s = splash / 0.6;
            return (
              <mesh key={i} position={[to[0] + Math.cos(a) * s * 0.5, to[1] + Math.sin(s * Math.PI) * 0.35, to[2] + Math.sin(a) * s * 0.5]} scale={0.05 * (1 - s)}>
                <sphereGeometry args={[1, 6, 5]} />
                <meshStandardMaterial color="#F2FBFF" />
              </mesh>
            );
          })
        : null}
      {splash > 0 ? (
        <mesh position={[to[0], to[1] + 0.03, to[2]]} rotation={[-Math.PI / 2, 0, 0]} scale={0.2 + splash * 1.8}>
          <ringGeometry args={[0.8, 1, 28]} />
          <meshStandardMaterial color="#FFFFFF" transparent opacity={0.6 * (1 - splash / 0.6)} />
        </mesh>
      ) : null}
    </group>
  );
};

export const Lounger: React.FC<{ position: V3; rot?: number }> = ({ position, rot = 0 }) => (
  <group position={position} rotation={[0, rot, 0]}>
    <Box size={[0.7, 0.08, 1.5]} position={[0, 0.3, 0.1]} color="#F4F1EA" />
    <Box size={[0.7, 0.08, 0.7]} position={[0, 0.55, -0.85]} rotation={[0.7, 0, 0]} color="#F4F1EA" />
    <Box size={[0.66, 0.05, 1.4]} position={[0, 0.36, 0.1]} color="#2E9BD6" />
    {[-0.3, 0.3].map((x) => [-0.5, 0.75].map((z) => <Box key={`${x}${z}`} size={[0.05, 0.3, 0.05]} position={[x, 0.15, z]} color="#D9D4CA" />))}
  </group>
);

export const Umbrella: React.FC<{ position: V3 }> = ({ position }) => (
  <group position={position}>
    <mesh position={[0, 1.2, 0]}>
      <cylinderGeometry args={[0.04, 0.04, 2.4, 8]} />
      <meshStandardMaterial color="#EDEDE8" />
    </mesh>
    <mesh position={[0, 2.3, 0]} castShadow>
      <coneGeometry args={[1.4, 0.55, 8, 1, true]} />
      <meshStandardMaterial color="#F2C230" side={THREE.DoubleSide} flatShading />
    </mesh>
  </group>
);

export const YardTrees: React.FC<{ cut: boolean }> = ({ cut }) => {
  const trees: { p: V3; s: number; seed: number }[] = [
    { p: [-11, 0, -5], s: 2.4, seed: 1 },
    { p: [-13, 0, 3], s: 2.0, seed: 2.2 },
    { p: [-9.5, 0, -10.5], s: 1.9, seed: 1.4 },
    { p: [10.5, 0, -11], s: 2.2, seed: 2.6 },
    { p: [5.5, 0, -6.2], s: 1.6, seed: 0.6 },
    { p: [-12, 0, 9], s: 2.3, seed: 1.9 },
    { p: [12, 0, 6], s: 2.0, seed: 0.3 },
    { p: [-6.2, 0, -5.0], s: 1.5, seed: 1.1 },
  ];
  return (
    <group>
      {trees
        .filter((tr) => !cut || tr.p[2] < -1.5)
        .map((tr, i) => (
          <Tree key={i} position={tr.p} scale={tr.s} seed={tr.seed} />
        ))}
    </group>
  );
};

export { mixHex, clamp01 };
