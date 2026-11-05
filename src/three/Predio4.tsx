// Sets novos do "Prédio v4" (esse treco). Escala: 1 unidade = 1 m.
// Reaproveita o kit da v2 (./Predio) e acrescenta os degraus novos da corrente.
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { ease } from "../theme";
import { Glow } from "./basics";
import { B, clayTex, concreteTex, glassTex, grassTex, InstM, mat, rockTex, SOIL, TiaoWalk, topsoilTex, unitBox } from "./Predio";
import { brickTexture, rnd, tileTexture, WaterSurface, woodTexture } from "./World";

type V3 = [number, number, number];
const cl = (x: number, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const pr = (t: number, a: number, b: number) => cl((t - a) / Math.max(1e-4, b - a));

// ======================================================================
// Etiqueta pequena presa a um ponto 3D (estilo "• APERTO" da referência)
// ======================================================================
const tagCache = new Map<string, { tex: THREE.CanvasTexture; aspect: number }>();
const tagTex = (text: string, dot: string, dark: boolean) => {
  const key = `${text}|${dot}|${dark}`;
  const hit = tagCache.get(key);
  if (hit) return hit;
  const h = 96;
  const c0 = document.createElement("canvas").getContext("2d")!;
  c0.font = "800 58px 'Baloo 2', 'Arial Black', Arial, sans-serif";
  const tw = c0.measureText(text).width;
  const w = Math.ceil(tw + h * 1.25);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d")!;
  g.fillStyle = dark ? "rgba(22,24,29,0.92)" : "#FFFFFF";
  g.strokeStyle = dark ? "#FFFFFF" : "#16181D";
  g.lineWidth = 6;
  g.beginPath();
  g.roundRect(4, 4, w - 8, h - 8, (h - 8) / 2);
  g.fill();
  g.stroke();
  g.fillStyle = dot;
  g.beginPath();
  g.arc(h * 0.48, h / 2, 13, 0, Math.PI * 2);
  g.fill();
  g.font = "800 58px 'Baloo 2', 'Arial Black', Arial, sans-serif";
  g.fillStyle = dark ? "#FFFFFF" : "#16181D";
  g.textBaseline = "middle";
  g.fillText(text, h * 0.78, h / 2 + 4);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const out = { tex, aspect: w / h };
  tagCache.set(key, out);
  return out;
};
export const Tag3D: React.FC<{ position: V3; text: string; show: number; dot?: string; size?: number; dark?: boolean }> = ({ position, text, show, dot = "#FF3B2B", size = 0.034, dark = false }) => {
  const T = tagTex(text, dot, dark);
  if (show <= 0.01) return null;
  const s = size * popS(show);
  return (
    <sprite position={position} scale={[s * T.aspect, s, 1]} renderOrder={999}>
      <spriteMaterial map={T.tex} sizeAttenuation={false} depthTest={false} depthWrite={false} transparent toneMapped={false} opacity={cl(show * 3)} />
    </sprite>
  );
};
const popS = (p: number) => {
  if (p >= 1) return 1;
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2);
};

// Seta fina com ponta (forças): de a até b, crescendo com p.
export const ThinArrow: React.FC<{ a: V3; b: V3; p?: number; color?: string; r?: number; head?: number }> = ({ a, b, p = 1, color = "#2F7BFF", r = 0.06, head = 0.32 }) => {
  if (p <= 0.01) return null;
  const A = new THREE.Vector3(...a), Bv = new THREE.Vector3(...b);
  const E = A.clone().lerp(Bv, cl(p));
  const dir = E.clone().sub(A);
  const L = dir.length();
  if (L < 0.02) return null;
  dir.normalize();
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  const shaft = Math.max(0.01, L - head * 1.2);
  const mid = A.clone().add(dir.clone().multiplyScalar(shaft / 2));
  const tip = A.clone().add(dir.clone().multiplyScalar(shaft + head * 0.6));
  return (
    <group renderOrder={10}>
      <mesh position={mid} quaternion={q}>
        <cylinderGeometry args={[r, r, shaft, 8]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
      <mesh position={tip} quaternion={q}>
        <coneGeometry args={[r * 3.2, head * 1.2, 12]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
    </group>
  );
};

// ======================================================================
// Fluxo do peso: bolinhas amarelas descendo viga -> pilar -> chão
// ======================================================================
export const WeightFlow: React.FC<{ t: number; amount: number; floors?: number; z?: number; side?: boolean }> = ({ t, amount, floors = 4, z = 6.25 }) => {
  const paths = useMemo(() => {
    const out: V3[][] = [];
    const cols = B.CX;
    for (let k = 1; k <= floors; k++) {
      const y = k * B.H - 0.5;
      for (let i = 0; i < cols.length - 1; i++) {
        const mid = (cols[i] + cols[i + 1]) / 2;
        out.push([[mid, y, z], [cols[i], y, z], [cols[i], 0.2, z]]);
        out.push([[mid, y, z], [cols[i + 1], y, z], [cols[i + 1], 0.2, z]]);
      }
    }
    return out.map((p) => {
      const L = p.slice(1).reduce((s, q, i) => s + Math.hypot(q[0] - p[i][0], q[1] - p[i][1]), 0);
      return { p, L };
    });
  }, [floors, z]);
  const mats = useMemo(() => {
    const out: THREE.Matrix4[] = [];
    if (amount <= 0.01) return out;
    paths.forEach(({ p, L }, pi) => {
      const n = Math.max(3, Math.round(L / 1.1));
      for (let i = 0; i < n; i++) {
        let s = (((i / n) * L + t * 3.2 + rnd(pi, 3) * 2) % L + L) % L;
        let q: V3 = p[0];
        for (let j = 0; j < p.length - 1; j++) {
          const a = p[j], b = p[j + 1];
          const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
          if (s <= l) {
            q = [a[0] + ((b[0] - a[0]) * s) / l, a[1] + ((b[1] - a[1]) * s) / l, a[2]];
            break;
          }
          s -= l;
        }
        const sc = 0.17 * cl(amount * 1.5);
        out.push(mat(q, [0, 0, 0], [sc, sc, sc]));
      }
    });
    return out;
  }, [t, amount, paths]);
  const geo = useMemo(() => new THREE.SphereGeometry(1, 10, 8), []);
  return (
    <InstM mats={mats} geo={geo} max={600} cast={false} receive={false}>
      <meshBasicMaterial color="#FFD23F" toneMapped={false} />
    </InstM>
  );
};

// Paredes de tijolo de vedação entre os pilares (fachada da frente, andares de baixo).
export const InfillWalls: React.FC<{ floors?: number; z?: number; show?: number; skip?: number[] }> = ({ floors = 4, z = 6.0, show = 1, skip = [] }) => {
  const tex = useMemo(() => {
    const t0 = brickTexture("#B8613E", "#E2D3BD", 16, 8).clone();
    t0.repeat.set(1.4, 1.3);
    t0.needsUpdate = true;
    return t0;
  }, []);
  const mats = useMemo(() => {
    const out: THREE.Matrix4[] = [];
    for (let k = 0; k < floors; k++)
      for (let i = 0; i < 3; i++) {
        if (k === 0 && skip.includes(i)) continue;
        const x = (B.CX[i] + B.CX[i + 1]) / 2;
        const h = 2.45 * show;
        out.push(mat([x, k * B.H + h / 2 + (k ? 0 : 0.27), z], [0, 0, 0], [3.3, h, 0.22]));
      }
    return out;
  }, [floors, z, show, skip.join()]);
  if (show <= 0.01) return null;
  return (
    <InstM mats={mats} geo={unitBox} max={floors * 3}>
      <meshStandardMaterial map={tex} roughness={0.9} />
    </InstM>
  );
};

// ======================================================================
// Parede de tijolo que se derruba com a marreta (tijolos instanciados)
// ======================================================================
export const BreakWall: React.FC<{ t: number; tb: number; position: V3; w?: number; h?: number; dir?: number; hit?: V3 }> = ({ t, tb, position, w = 3.3, h = 2.5, dir = 1, hit = [0, 1.2, 0] }) => {
  const BW = 0.25, BH = 0.105;
  const bricks = useMemo(() => {
    const out: { x: number; y: number; c: string }[] = [];
    const rows = Math.floor(h / BH), cols = Math.ceil(w / BW);
    const pal = ["#B8613E", "#A9573A", "#C26C46", "#B05A3A", "#9E5034"];
    for (let r = 0; r < rows; r++)
      for (let c = 0; c <= cols; c++) {
        const x = -w / 2 + c * BW + (r % 2 ? BW / 2 : 0);
        if (x > w / 2 - BW / 2 + 0.01 || x < -w / 2 + BW / 2 - 0.01) continue;
        out.push({ x, y: r * BH + BH / 2, c: pal[Math.floor(rnd(r * 41 + c, 5) * pal.length)] });
      }
    return out;
  }, [w, h]);
  const geo = useMemo(() => new THREE.BoxGeometry(BW - 0.012, BH - 0.012, 0.12), []);
  const data = useMemo(() => {
    const mats: THREE.Matrix4[] = [];
    const cols: string[] = [];
    const dt = t - tb;
    bricks.forEach((b, i) => {
      const d = Math.hypot(b.x - hit[0], b.y - hit[1]);
      const delay = d * 0.09;
      const u = dt - delay;
      if (u <= 0) {
        mats.push(mat([b.x, b.y, 0]));
      } else {
        const v = (3.2 - d * 0.6) * (0.7 + rnd(i, 9) * 0.6);
        const vx = (b.x - hit[0]) * (0.8 + rnd(i, 10)) * 0.9;
        const vz = dir * Math.max(0.6, v) * 0.55;
        const vy = 1.2 + rnd(i, 11) * 1.4;
        let y = b.y + vy * u - 4.9 * u * u;
        const tLand = (vy + Math.sqrt(vy * vy + 19.6 * Math.max(0, b.y - 0.06))) / 9.8;
        const uu = Math.min(u, tLand);
        if (u >= tLand) y = 0.06 + (rnd(i, 13) * 0.08);
        const x = b.x + vx * uu;
        const z = vz * uu * 1.0;
        const spin = Math.min(u, tLand) * (4 + rnd(i, 12) * 6);
        mats.push(mat([x, y, z], [spin, spin * 0.6, spin * 0.3]));
      }
      cols.push(b.c);
    });
    return { mats, cols };
  }, [t, tb, bricks]);
  return (
    <group position={position}>
      <InstM mats={data.mats} colors={data.cols} geo={geo} max={bricks.length}>
        <meshStandardMaterial roughness={0.9} />
      </InstM>
      {/* argamassa atrás (some quando a parede cai) */}
      {t < tb + 0.05 ? (
        <mesh position={[0, h / 2, -0.03]}>
          <boxGeometry args={[w, h, 0.06]} />
          <meshStandardMaterial color="#D9CCB6" roughness={1} />
        </mesh>
      ) : null}
    </group>
  );
};

// Puffs de poeira/fumaça genéricos ao longo de um caminho (instanciados).
export const Puffs: React.FC<{
  t: number;
  pts: V3[];
  amount: number;
  n?: number;
  size?: number;
  color?: string;
  speed?: number;
  end?: number; // fração do caminho onde os puffs param (acumulam)
  opacity?: number;
  seed?: number;
  wobble?: number;
}> = ({ t, pts, amount, n = 40, size = 0.5, color = "#55595F", speed = 0.25, end = 1, opacity = 0.85, seed = 3, wobble = 0.3 }) => {
  const segs = useMemo(() => {
    const out: { a: V3; b: V3; len: number; s0: number }[] = [];
    let s0 = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
      out.push({ a, b, len, s0 });
      s0 += len;
    }
    return { out, total: s0 };
  }, [JSON.stringify(pts)]);
  const geo = useMemo(() => new THREE.IcosahedronGeometry(1, 1), []);
  const mats = useMemo(() => {
    const out: THREE.Matrix4[] = [];
    const k = Math.round(n * cl(amount));
    const T = segs.total;
    for (let i = 0; i < k; i++) {
      let u = (rnd(i, seed) + t * speed) % 1;
      const pile = u > end;
      if (pile) u = end - rnd(i, seed + 7) * 0.12;
      const s = u * T;
      const sg = segs.out.find((g) => s >= g.s0 && s <= g.s0 + g.len) ?? segs.out[segs.out.length - 1];
      const f = cl((s - sg.s0) / Math.max(1e-4, sg.len));
      const p: V3 = [sg.a[0] + (sg.b[0] - sg.a[0]) * f, sg.a[1] + (sg.b[1] - sg.a[1]) * f, sg.a[2] + (sg.b[2] - sg.a[2]) * f];
      const w = wobble * (0.4 + u);
      const sc = size * (0.55 + rnd(i, seed + 2) * 0.7) * (0.6 + 0.6 * Math.min(1, u * 3));
      out.push(mat([p[0] + (rnd(i, seed + 3) - 0.5) * w + Math.sin(t * 2 + i) * 0.05, p[1] + (rnd(i, seed + 4) - 0.5) * w * 0.6, p[2] + (rnd(i, seed + 5) - 0.5) * w], [i, i * 0.7, 0], [sc, sc * 0.85, sc]));
    }
    return out;
  }, [t, amount, segs, n, end, seed, size]);
  if (!mats.length) return null;
  return (
    <InstM mats={mats} geo={geo} max={n} cast={false} receive={false}>
      <meshStandardMaterial color={color} roughness={1} flatShading transparent opacity={opacity} depthWrite={false} />
    </InstM>
  );
};

// Chamas (cones que tremulam) + luz.
export const Flames: React.FC<{ t: number; position: V3; amount: number; scale?: number; light?: boolean }> = ({ t, position, amount, scale = 1, light = true }) => {
  if (amount <= 0.01) return null;
  const s = scale * amount;
  return (
    <group position={position} scale={s}>
      {Array.from({ length: 9 }).map((_, i) => {
        const a = (i / 9) * Math.PI * 2;
        const r = i === 0 ? 0 : 0.35 + (i % 3) * 0.12;
        const h = (i === 0 ? 1.9 : 1.0 + rnd(i, 5) * 0.8) * (0.8 + 0.25 * Math.sin(t * (9 + i) + i));
        return (
          <group key={i} position={[Math.cos(a) * r, 0, Math.sin(a) * r]}>
            <mesh position={[0, h / 2, 0]}>
              <coneGeometry args={[0.32, h, 7]} />
              <meshBasicMaterial color="#FF7A1E" toneMapped={false} transparent opacity={0.92} />
            </mesh>
            <mesh position={[0, h * 0.32, 0.02]}>
              <coneGeometry args={[0.18, h * 0.6, 7]} />
              <meshBasicMaterial color="#FFE07A" toneMapped={false} />
            </mesh>
          </group>
        );
      })}
      <Glow position={[0, 1, 0]} size={4.5} color="#FF8A2E" opacity={0.75} />
      {light ? <pointLight position={[0, 1.4, 0.6]} intensity={30 * amount} distance={12} color="#FF8A3C" /> : null}
    </group>
  );
};

// ======================================================================
// VIGA EM CLOSE (aperto/puxão/racha) e CONCRETO ARMADO (raio-x)
// ======================================================================
export const BEAM = { L: 8.7, h: 0.62, d: 0.5, y0: 3.2, colX: 4.0 };
const sagAt = (x: number, sag: number) => -sag * Math.max(0, 1 - Math.pow((2 * x) / BEAM.L, 2));
export const BeamSet: React.FC<{
  t: number;
  sag: number;
  crack: number;
  xray: number;
  rebar: number;
  stirrup: number;
  glowBeam?: number;
  glowSteel?: number;
  load: number;
}> = ({ t, sag, crack, xray, rebar, stirrup, glowBeam = 0, glowSteel = 0, load }) => {
  const geo = useMemo(() => new THREE.BoxGeometry(BEAM.L, BEAM.h, BEAM.d, 60, 4, 2), []);
  const slabGeo = useMemo(() => new THREE.BoxGeometry(BEAM.L + 1.6, 0.24, 6.4, 60, 1, 2), []);
  const base = useMemo(() => Float32Array.from(geo.attributes.position.array as Float32Array), [geo]);
  const sbase = useMemo(() => Float32Array.from(slabGeo.attributes.position.array as Float32Array), [slabGeo]);
  useLayoutEffect(() => {
    const p = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const x = base[i * 3], y = base[i * 3 + 1];
      // embaixo estica (mais comprido), em cima encurta
      const stretch = 1 + (y < 0 ? 0.012 : -0.006) * (sag / 0.4);
      p.setX(i, x * stretch);
      p.setY(i, y + sagAt(x, sag));
    }
    p.needsUpdate = true;
    geo.computeVertexNormals();
    const q = slabGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < q.count; i++) q.setY(i, sbase[i * 3 + 1] + sagAt(sbase[i * 3], sag) * (1 - Math.abs(sbase[i * 3 + 2]) / 4));
    q.needsUpdate = true;
    slabGeo.computeVertexNormals();
  }, [sag, geo, slabGeo]);
  const conc = concreteTex("#C9C6BE", [3, 0.4], 0);
  const tr = xray > 0.01;
  const yb = BEAM.y0 + BEAM.h / 2;
  const stir = useMemo(() => {
    const out: THREE.Matrix4[] = [];
    const n = Math.floor(30 * cl(stirrup));
    for (let i = 0; i < n; i++) {
      const x = -4.1 + (i / 29) * 8.2;
      const s = sagAt(x, sag);
      for (const [dy, dz, sx, sy, sz] of [
        [-0.24, 0, 0.02, 0.02, 0.38],
        [0.24, 0, 0.02, 0.02, 0.38],
        [0, -0.19, 0.02, 0.48, 0.02],
        [0, 0.19, 0.02, 0.48, 0.02],
      ])
        out.push(mat([x, yb + dy + s, dz], [0, 0, 0], [sx, sy, sz]));
    }
    return out;
  }, [stirrup, sag]);
  const rebarX = (1 - ease.out(cl(rebar))) * 11;
  return (
    <group>
      {/* piso */}
      <mesh position={[0, -0.15, 0]} receiveShadow>
        <boxGeometry args={[14, 0.3, 9]} />
        <meshStandardMaterial map={concreteTex("#B9B5AC", [4, 3], 0)} roughness={0.95} />
      </mesh>
      {/* pilares */}
      {[-1, 1].map((k) =>
        [0, -4].map((z) => (
          <mesh key={`${k}${z}`} position={[k * BEAM.colX, BEAM.y0 / 2 + 0.3, z]} castShadow receiveShadow>
            <boxGeometry args={[0.62, BEAM.y0 + 0.6, 0.62]} />
            <meshStandardMaterial map={concreteTex("#C6C3BB")} roughness={0.85} />
          </mesh>
        )),
      )}
      {/* viga de trás (fixa) */}
      <mesh position={[0, yb, -4]} castShadow>
        <boxGeometry args={[BEAM.L, BEAM.h, BEAM.d]} />
        <meshStandardMaterial map={conc} roughness={0.85} />
      </mesh>
      {/* viga da frente (enverga) */}
      <mesh geometry={geo} position={[0, yb, 0]} castShadow receiveShadow renderOrder={tr ? 2 : 0}>
        <meshStandardMaterial
          key={tr ? "x" : "s"}
          map={conc}
          color={tr ? "#CFE4F2" : "#FFFFFF"}
          roughness={0.85}
          transparent={tr}
          opacity={1 - 0.72 * xray}
          depthWrite={!tr}
          emissive="#FFA930"
          emissiveIntensity={glowBeam * 1.1}
        />
      </mesh>
      {/* laje em cima */}
      <mesh geometry={slabGeo} position={[0, BEAM.y0 + BEAM.h + 0.12, -2]} castShadow receiveShadow>
        <meshStandardMaterial map={concreteTex("#CBC8C0", [3, 2], 0)} roughness={0.85} />
      </mesh>
      {/* trinca: cunha escura abrindo de baixo para cima no meio do vão */}
      {crack > 0.01
        ? [0, -0.9, 1.1].map((x0, i) => {
            const c = cl(crack * (i ? 0.75 : 1));
            const hh = BEAM.h * (i ? 0.55 : 0.85) * c;
            const s = sagAt(x0, sag);
            return (
              <group key={i} position={[x0, BEAM.y0 + s, BEAM.d / 2 + 0.004]}>
                {Array.from({ length: 5 }).map((_, j) => {
                  const f0 = j / 5, f1 = (j + 1) / 5;
                  const xa = Math.sin(j * 2.3 + i) * 0.05, xb = Math.sin((j + 1) * 2.3 + i) * 0.05;
                  const len = Math.hypot(xb - xa, (f1 - f0) * hh);
                  const wdt = (0.06 * (1 - f0) + 0.01) * c;
                  return (
                    <mesh key={j} position={[(xa + xb) / 2, ((f0 + f1) / 2) * hh, 0]} rotation={[0, 0, Math.atan2(xb - xa, (f1 - f0) * hh) * -1]}>
                      <boxGeometry args={[wdt, len + 0.01, 0.02]} />
                      <meshBasicMaterial color="#2A221C" />
                    </mesh>
                  );
                })}
              </group>
            );
          })
        : null}
      {/* barras de aço (entram pela direita, embaixo) */}
      {rebar > 0.001
        ? [-0.13, 0, 0.13].map((z, i) => (
            <group key={i}>
              {Array.from({ length: 12 }).map((_, j) => {
                const x = -4.2 + (j + 0.5) * (8.4 / 12) + rebarX;
                const s = sagAt(x - rebarX, sag);
                return (
                  <mesh key={j} position={[x, BEAM.y0 + 0.09 + s, z]} rotation={[0, 0, Math.PI / 2]} renderOrder={3}>
                    <cylinderGeometry args={[0.035, 0.035, 8.4 / 12 + 0.01, 8]} />
                    <meshStandardMaterial color="#B5562E" metalness={0.5} roughness={0.45} emissive="#FF7A1E" emissiveIntensity={0.25 + glowSteel * 1.4} />
                  </mesh>
                );
              })}
            </group>
          ))
        : null}
      <InstM mats={stir} geo={unitBox} max={30 * 4} cast={false}>
        <meshStandardMaterial color="#9A4E2E" metalness={0.5} roughness={0.5} emissive="#FF7A1E" emissiveIntensity={0.2 + glowSteel} />
      </InstM>
      {/* carga em cima da laje: paletes de sacos de cimento */}
      {load > 0.001 ? (
        <group position={[0, BEAM.y0 + BEAM.h + 0.24 + (1 - ease.in(cl(load))) * 7 + sagAt(0, sag), -0.8]}>
          {[-1.6, 0, 1.6].map((x, i) => (
            <group key={i} position={[x, 0, (i % 2) * 0.4]}>
              <mesh position={[0, 0.07, 0]} castShadow>
                <boxGeometry args={[1.3, 0.14, 1.1]} />
                <meshStandardMaterial map={woodTexture("#B07A48")} />
              </mesh>
              {Array.from({ length: 6 }).map((_, j) => (
                <mesh key={j} position={[(j % 2 ? 0.3 : -0.3), 0.26 + Math.floor(j / 2) * 0.24, 0]} castShadow>
                  <boxGeometry args={[0.58, 0.22, 1.0]} />
                  <meshStandardMaterial color={j % 3 ? "#D9CFB8" : "#CFC3A6"} roughness={0.9} />
                </mesh>
              ))}
            </group>
          ))}
        </group>
      ) : null}
      {/* fundo: parede do outro lado com janela para a cidade */}
      <mesh position={[0, 2.2, -4.35]}>
        <boxGeometry args={[8, 0.4, 0.2]} />
        <meshStandardMaterial color="#D9D4C8" />
      </mesh>
      {t < 0 ? null : null}
    </group>
  );
};

// ======================================================================
// PERFURATRIZ (estaca escavada) — trado girando, furo, concreto subindo
// ======================================================================
export const AugerRig: React.FC<{ x: number; depth: number; t: number; spin: number; lift?: number }> = ({ x, depth, t, spin, lift = 0 }) => {
  const H = 16;
  const brace = useMemo(() => {
    const out: THREE.Matrix4[] = [];
    for (let i = 0; i < 16; i++) {
      const y = 1 + i * 0.95;
      out.push(mat([0, y + 0.47, 0.0], [0, 0, (i % 2 ? 1 : -1) * 0.95], [1.25, 0.08, 0.08]));
      out.push(mat([0, y, 0], [0, 0, 0], [0.9, 0.08, 0.08]));
    }
    return out;
  }, []);
  const tipY = -depth + lift;
  const flights = useMemo(() => {
    const out: THREE.Matrix4[] = [];
    for (let i = 0; i < 26; i++) {
      const a = i * 0.55 + t * spin * 9;
      out.push(mat([Math.cos(a) * 0.28, i * 0.12, Math.sin(a) * 0.28], [0.35, -a, 0], [0.62, 0.04, 0.22]));
    }
    return out;
  }, [t, spin]);
  return (
    <group position={[x, 0, SOIL.face - 0.05]}>
      <group position={[0, 0, -3.6]}>
        <mesh position={[0, 0.55, 0]} castShadow>
          <boxGeometry args={[3.4, 1.1, 4.6]} />
          <meshStandardMaterial color="#2E3238" roughness={0.8} />
        </mesh>
        {[-1, 1].map((k) => (
          <mesh key={k} position={[k * 1.6, 0.55, 0]}>
            <boxGeometry args={[0.35, 1.0, 4.8]} />
            <meshStandardMaterial color="#1F2226" roughness={0.9} />
          </mesh>
        ))}
        <mesh position={[0, 1.7, -0.4]} castShadow>
          <boxGeometry args={[2.8, 1.3, 3.2]} />
          <meshStandardMaterial color="#E8452C" roughness={0.5} />
        </mesh>
        <mesh position={[0.9, 2.75, 0.5]} castShadow>
          <boxGeometry args={[1.2, 1.1, 1.3]} />
          <meshStandardMaterial color="#E8452C" roughness={0.5} />
        </mesh>
        <mesh position={[0.9, 2.8, 1.16]}>
          <boxGeometry args={[1.0, 0.7, 0.02]} />
          <meshStandardMaterial color="#9CCBE4" roughness={0.1} metalness={0.3} />
        </mesh>
      </group>
      {[-0.5, 0.5].map((k) => (
        <mesh key={k} position={[k, H / 2, -0.7]} castShadow>
          <boxGeometry args={[0.18, H, 0.18]} />
          <meshStandardMaterial color="#E8452C" roughness={0.5} />
        </mesh>
      ))}
      <group position={[0, 0, -0.7]}>
        <InstM mats={brace} geo={unitBox} max={32}>
          <meshStandardMaterial color="#C93A24" roughness={0.5} />
        </InstM>
      </group>
      {/* cabeça rotativa e haste (kelly) */}
      <mesh position={[0, 2.6 + lift, -0.15]} castShadow>
        <boxGeometry args={[0.9, 0.9, 0.9]} />
        <meshStandardMaterial color="#3A4047" metalness={0.5} roughness={0.4} />
      </mesh>
      <mesh position={[0, (2.6 + lift + tipY) / 2, 0]}>
        <cylinderGeometry args={[0.1, 0.1, Math.max(0.1, 2.6 + lift - tipY), 8]} />
        <meshStandardMaterial color="#6E757C" metalness={0.7} roughness={0.3} />
      </mesh>
      <group position={[0, tipY, 0]}>
        <InstM mats={flights} geo={unitBox} max={26}>
          <meshStandardMaterial color="#8A929A" metalness={0.6} roughness={0.35} />
        </InstM>
        <mesh position={[0, -0.15, 0]}>
          <coneGeometry args={[0.32, 0.4, 10]} />
          <meshStandardMaterial color="#5E656C" metalness={0.6} />
        </mesh>
      </group>
    </group>
  );
};
// furo escavado + concreto subindo (estaca escavada), na face do corte.
export const BoredPile: React.FC<{ x: number; hole: number; fill: number; glow?: number; full?: number }> = ({ x, hole, fill, glow = 0, full = 23.5 }) => {
  const R = 0.75;
  const conc = concreteTex("#BDBAB2");
  return (
    <group position={[x, 0.3, SOIL.face]}>
      {hole > 0.05 ? (
        <mesh position={[0, -hole / 2, 0.03]}>
          <planeGeometry args={[R * 2 + 0.1, hole]} />
          <meshStandardMaterial color="#24180F" roughness={1} />
        </mesh>
      ) : null}
      {fill > 0.05 ? (
        <group>
          <mesh position={[0, -full + fill / 2, 0]} castShadow>
            <cylinderGeometry args={[R, R, fill, 16]} />
            <meshStandardMaterial map={conc} color="#FFFFFF" roughness={0.8} emissive="#FFA930" emissiveIntensity={glow * 1.1} />
          </mesh>
          <mesh position={[0, -full + 0.02, 0]}>
            <coneGeometry args={[R, 0.9, 16]} />
            <meshStandardMaterial color="#9E9B93" roughness={0.8} emissive="#FFA930" emissiveIntensity={glow * 1.1} />
          </mesh>
        </group>
      ) : null}
    </group>
  );
};

// ======================================================================
// SOLO EM CORTE COM CISTERNA (nicho aberto na frente)
// ======================================================================
type NB = { x0: number; x1: number; y0: number; y1: number; z0: number };
const notchBoxes = (ya: number, yb: number, N: NB, W: number, Z0: number, F: number) => {
  // retorna caixas [cx,cy,cz,sx,sy,sz] para a camada [ya,yb] tirando o nicho
  const out: number[][] = [];
  const oy0 = Math.max(ya, N.y0), oy1 = Math.min(yb, N.y1);
  const add = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number) => {
    if (x1 - x0 > 0.001 && y1 - y0 > 0.001 && z1 - z0 > 0.001) out.push([(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, x1 - x0, y1 - y0, z1 - z0]);
  };
  if (oy1 <= oy0) {
    add(-W / 2, W / 2, ya, yb, Z0, F);
    return out;
  }
  add(-W / 2, N.x0, ya, yb, Z0, F);
  add(N.x1, W / 2, ya, yb, Z0, F);
  add(N.x0, N.x1, ya, yb, Z0, N.z0);
  add(N.x0, N.x1, ya, oy0, N.z0, F);
  add(N.x0, N.x1, oy1, yb, N.z0, F);
  return out;
};
export const CISTERN = { x0: -16.5, x1: -8.6, y0: -4.6, y1: -0.7, z0: 1.6 };
export const CutSoil: React.FC<{ notch?: NB }> = ({ notch = CISTERN }) => {
  const W = 520, Z0 = -260, F = SOIL.face;
  const layers: [number, number, React.ReactNode, string][] = [
    [-0.35, 0, <meshStandardMaterial map={grassTex([60, 30])} roughness={1} />, "g"],
    [-2.6, -0.35, <meshStandardMaterial map={topsoilTex([52, 1])} roughness={1} />, "t"],
    [SOIL.clay, -2.6, <meshStandardMaterial map={clayTex([40, 1.6])} roughness={1} />, "c"],
    [SOIL.rock, SOIL.clay, <meshStandardMaterial map={rockTex([34, 6])} roughness={1} />, "r"],
  ];
  return (
    <group>
      {layers.map(([ya, yb, m, key]) =>
        notchBoxes(ya, yb, { ...notch }, W, Z0, F).map((b, i) => (
          <mesh key={`${key}${i}`} position={[b[0], b[1], b[2]]} receiveShadow>
            <boxGeometry args={[b[3], b[4], b[5]]} />
            {m}
          </mesh>
        )),
      )}
      <mesh position={[0, SOIL.clay, F + 0.02]}>
        <planeGeometry args={[W, 0.35]} />
        <meshBasicMaterial color="#5D554B" />
      </mesh>
    </group>
  );
};

// Tanque de concreto em corte (cisterna/caixa) com água e superfície ondulada.
export const OpenTank: React.FC<{ t: number; box: { x0: number; x1: number; y0: number; y1: number; z0: number; z1: number }; level: number; glow?: number; label?: boolean }> = ({ t, box, level, glow = 0 }) => {
  const w = box.x1 - box.x0, h = box.y1 - box.y0, d = box.z1 - box.z0;
  const cx = (box.x0 + box.x1) / 2, cz = (box.z0 + box.z1) / 2;
  const T = 0.22;
  const m = <meshStandardMaterial map={concreteTex("#A9A9A2", [2, 1], 0)} roughness={0.9} emissive="#FFA930" emissiveIntensity={glow * 1.1} />;
  const lv = cl(level) * (h - 0.6);
  return (
    <group>
      <mesh position={[cx, box.y0 + T / 2, cz]} receiveShadow>
        <boxGeometry args={[w, T, d]} />
        {m}
      </mesh>
      <mesh position={[cx, box.y1 - T / 2, cz - 0.0]} receiveShadow>
        <boxGeometry args={[w, T, d]} />
        {m}
      </mesh>
      <mesh position={[cx, box.y0 + h / 2, box.z0 + T / 2]}>
        <boxGeometry args={[w, h, T]} />
        {m}
      </mesh>
      {[box.x0 + T / 2, box.x1 - T / 2].map((x) => (
        <mesh key={x} position={[x, box.y0 + h / 2, cz]}>
          <boxGeometry args={[T, h, d]} />
          {m}
        </mesh>
      ))}
      {lv > 0.04 ? (
        <>
          <mesh position={[cx, box.y0 + T + lv / 2, cz + T / 2]}>
            <boxGeometry args={[w - 2 * T - 0.02, lv, d - T - 0.04]} />
            <meshStandardMaterial color="#2C93E0" transparent opacity={0.72} roughness={0.1} emissive="#1E7ED0" emissiveIntensity={0.3 + glow * 0.3} depthWrite={false} />
          </mesh>
          <WaterSurface size={[w - 2 * T - 0.02, d - T - 0.04]} position={[cx, box.y0 + T + lv + 0.01, cz + T / 2]} t={t} amp={0.05} seg={28} />
        </>
      ) : null}
    </group>
  );
};

// Torneira de jardim com jato e balde (vizinhos).
export const GardenTap: React.FC<{ t: number; position: V3; flow: number; rot?: number }> = ({ t, position, flow, rot = 0 }) => (
  <group position={position} rotation={[0, rot, 0]}>
    <mesh position={[0, 0.55, 0]} castShadow>
      <boxGeometry args={[0.22, 1.1, 0.22]} />
      <meshStandardMaterial map={brickTexture("#B8613E", "#E2D3BD", 16, 8)} roughness={0.9} />
    </mesh>
    <mesh position={[0, 0.95, 0.2]} rotation={[Math.PI / 2, 0, 0]}>
      <cylinderGeometry args={[0.05, 0.05, 0.25, 8]} />
      <meshStandardMaterial color="#C8D0D6" metalness={0.8} roughness={0.2} />
    </mesh>
    <mesh position={[0, 0.88, 0.32]}>
      <cylinderGeometry args={[0.045, 0.04, 0.14, 8]} />
      <meshStandardMaterial color="#C8D0D6" metalness={0.8} roughness={0.2} />
    </mesh>
    <mesh position={[0, 1.06, 0.2]}>
      <boxGeometry args={[0.2, 0.05, 0.05]} />
      <meshStandardMaterial color="#D8402C" />
    </mesh>
    {/* jato */}
    {flow > 0.02 ? (
      <mesh position={[0, 0.81 - 0.3, 0.32]}>
        <cylinderGeometry args={[0.03 * flow + 0.008, 0.04 * flow + 0.01, 0.6, 8]} />
        <meshStandardMaterial color="#6CC4F5" transparent opacity={0.85} emissive="#1E8ED6" emissiveIntensity={0.3} />
      </mesh>
    ) : (
      <mesh position={[0, 0.78 - ((t * 0.9) % 1) * 0.55, 0.32]} scale={[0.035, 0.05, 0.035]}>
        <sphereGeometry args={[1, 8, 6]} />
        <meshStandardMaterial color="#6CC4F5" transparent opacity={0.8} />
      </mesh>
    )}
    {/* balde */}
    <group position={[0, 0, 0.36]}>
      <mesh position={[0, 0.22, 0]} castShadow>
        <cylinderGeometry args={[0.22, 0.17, 0.44, 14, 1, true]} />
        <meshStandardMaterial color="#2E7BD6" side={THREE.DoubleSide} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.02, 0]}>
        <cylinderGeometry args={[0.17, 0.17, 0.03, 14]} />
        <meshStandardMaterial color="#2E7BD6" />
      </mesh>
      {flow > 0.05 ? (
        <mesh position={[0, 0.12 + 0.2 * flow, 0]}>
          <cylinderGeometry args={[0.19, 0.19, 0.02, 14]} />
          <meshStandardMaterial color="#5BB8F2" emissive="#1E8ED6" emissiveIntensity={0.3} />
        </mesh>
      ) : null}
    </group>
  </group>
);

// Pia com torneira (último andar).
export const SinkUnit: React.FC<{ t: number; position: V3; flow: number; rot?: number }> = ({ t, position, flow, rot = 0 }) => (
  <group position={position} rotation={[0, rot, 0]}>
    <mesh position={[0, 0.45, 0]} castShadow receiveShadow>
      <boxGeometry args={[1.6, 0.9, 0.6]} />
      <meshStandardMaterial map={woodTexture("#C8A27A")} roughness={0.7} />
    </mesh>
    <mesh position={[0, 0.93, 0]}>
      <boxGeometry args={[1.7, 0.06, 0.66]} />
      <meshStandardMaterial color="#E8E4DC" roughness={0.4} />
    </mesh>
    <mesh position={[0, 0.93, 0.02]}>
      <boxGeometry args={[0.8, 0.07, 0.42]} />
      <meshStandardMaterial color="#B9C2C8" metalness={0.7} roughness={0.25} />
    </mesh>
    <mesh position={[0, 1.15, -0.24]}>
      <cylinderGeometry args={[0.04, 0.04, 0.44, 8]} />
      <meshStandardMaterial color="#C8D0D6" metalness={0.85} roughness={0.15} />
    </mesh>
    <mesh position={[0, 1.36, -0.12]} rotation={[Math.PI / 2, 0, 0]}>
      <cylinderGeometry args={[0.035, 0.035, 0.26, 8]} />
      <meshStandardMaterial color="#C8D0D6" metalness={0.85} roughness={0.15} />
    </mesh>
    {flow > 0.02 ? (
      <mesh position={[0, 1.08, 0.0]}>
        <cylinderGeometry args={[0.025 * flow + 0.006, 0.035 * flow + 0.008, 0.56, 8]} />
        <meshStandardMaterial color="#6CC4F5" transparent opacity={0.85} emissive="#1E8ED6" emissiveIntensity={0.35} />
      </mesh>
    ) : null}
    {t < -1 ? null : null}
  </group>
);

// ======================================================================
// CHUVEIRO (apagão): Tião ensaboado sem água
// ======================================================================
export const ShowerSet: React.FC<{ t: number; flow: number; dark: number; foam: number; mood: "neutral" | "shock" | "sad" | "happy"; look: number }> = ({ t, flow, dark, foam, mood, look }) => {
  const tile = useMemo(() => {
    const t0 = tileTexture("#E6F2F5", "#B8CDD5", 8).clone();
    t0.repeat.set(3, 3);
    t0.needsUpdate = true;
    return t0;
  }, []);
  const floorT = useMemo(() => {
    const t0 = tileTexture("#9FB3BC", "#6E838C", 8).clone();
    t0.repeat.set(3, 2);
    t0.needsUpdate = true;
    return t0;
  }, []);
  const streaks = useMemo(() => {
    const out: THREE.Matrix4[] = [];
    const n = Math.round(60 * cl(flow));
    for (let i = 0; i < n; i++) {
      const a = rnd(i, 3) * Math.PI * 2, r = rnd(i, 4) * 0.28;
      const ph = (rnd(i, 5) + t * 2.4) % 1;
      const y = 2.35 - ph * 2.3;
      const spread = 1 + (2.35 - y) * 0.18;
      out.push(mat([0.35 + Math.cos(a) * r * spread, y, -0.15 + Math.sin(a) * r * spread], [0, 0, 0], [0.015, 0.22, 0.015]));
    }
    return out;
  }, [t, flow]);
  return (
    <group>
      {/* paredes */}
      <mesh position={[0, 1.5, -1.2]} receiveShadow>
        <planeGeometry args={[4, 3]} />
        <meshStandardMaterial map={tile} roughness={0.3} />
      </mesh>
      <mesh position={[-2, 1.5, 0.3]} rotation={[0, Math.PI / 2, 0]} receiveShadow>
        <planeGeometry args={[3, 3]} />
        <meshStandardMaterial map={tile} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0, 0.3]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[4, 3]} />
        <meshStandardMaterial map={floorT} roughness={0.4} />
      </mesh>
      {/* janelinha */}
      <mesh position={[-1.2, 2.35, -1.19]}>
        <planeGeometry args={[0.8, 0.5]} />
        <meshStandardMaterial color={dark > 0.5 ? "#5D6E8A" : "#BFE3F7"} emissive={dark > 0.5 ? "#2A3550" : "#BFE3F7"} emissiveIntensity={0.6} />
      </mesh>
      {/* cano e chuveiro */}
      <mesh position={[0.35, 2.55, -1.12]}>
        <cylinderGeometry args={[0.03, 0.03, 0.5, 8]} />
        <meshStandardMaterial color="#C8D0D6" metalness={0.85} roughness={0.15} />
      </mesh>
      <mesh position={[0.35, 2.75, -0.8]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.03, 0.03, 0.66, 8]} />
        <meshStandardMaterial color="#C8D0D6" metalness={0.85} roughness={0.15} />
      </mesh>
      <mesh position={[0.35, 2.62, -0.45]}>
        <cylinderGeometry args={[0.2, 0.12, 0.16, 16]} />
        <meshStandardMaterial color="#E4E8EB" metalness={0.6} roughness={0.25} />
      </mesh>
      <InstM mats={streaks} geo={unitBox} max={60} cast={false} receive={false}>
        <meshBasicMaterial color="#BFE6FF" transparent opacity={0.75} />
      </InstM>
      {flow < 0.05 ? (
        <mesh position={[0.35, 2.48 - ((t * 0.7) % 1) * 0.9, -0.45]} scale={[0.03, 0.045, 0.03]}>
          <sphereGeometry args={[1, 8, 6]} />
          <meshStandardMaterial color="#9AD6FF" />
        </mesh>
      ) : null}
      {/* registro e saboneteira */}
      <mesh position={[1.1, 1.3, -1.17]}>
        <cylinderGeometry args={[0.09, 0.09, 0.06, 14]} />
        <meshStandardMaterial color="#C8D0D6" metalness={0.8} />
      </mesh>
      <mesh position={[-1.4, 1.2, -1.1]}>
        <boxGeometry args={[0.4, 0.05, 0.16]} />
        <meshStandardMaterial color="#C8D0D6" metalness={0.8} />
      </mesh>
      <mesh position={[-1.4, 1.27, -1.1]}>
        <boxGeometry args={[0.18, 0.08, 0.1]} />
        <meshStandardMaterial color="#F2A7C3" />
      </mesh>
      {/* box de vidro */}
      <mesh position={[1.3, 1.1, 0.3]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[2.6, 2.2]} />
        <meshStandardMaterial color="#D7EEF6" transparent opacity={0.16} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      <group position={[0.35, 0, -0.1]}>
        <TiaoWalk t={t} outfit="towel" mood={mood} foam={foam} look={[0, look]} headLean={-0.25 * look} wet={flow > 0.1} armLOverride={mood === "shock" ? [0, 0, -2.4] : [0, 0, 0.3]} armROverride={mood === "shock" ? [0, 0, 2.4] : [-2.6, 0, -0.3]} />
      </group>
      {foam > 0.05
        ? Array.from({ length: 10 }).map((_, i) => {
            const u = (rnd(i, 21) + t * 0.25) % 1;
            return (
              <mesh key={i} position={[0.35 + Math.sin(i * 1.7) * 0.5, 1.6 + u * 1.2, -0.1 + Math.cos(i * 2.3) * 0.4]} scale={0.04 + rnd(i, 22) * 0.05}>
                <sphereGeometry args={[1, 10, 8]} />
                <meshStandardMaterial color="#FFFFFF" transparent opacity={0.6 * (1 - u)} roughness={0.1} />
              </mesh>
            );
          })
        : null}
      <pointLight position={[0.5, 2.8, 1.2]} intensity={dark > 0.5 ? 2 : 14} distance={8} color={dark > 0.5 ? "#8FA6D8" : "#FFF4E0"} />
    </group>
  );
};

// ======================================================================
// VASOS + TUBO DE QUEDA no prédio em corte
// ======================================================================
export const STACK = { x: 5.4, z: 1.4, r: 0.32 };
const toiletGeos = () => {
  const bowl = new THREE.CylinderGeometry(0.26, 0.2, 0.42, 14);
  bowl.translate(0, 0.21, 0.12);
  const tank = new THREE.BoxGeometry(0.5, 0.42, 0.2);
  tank.translate(0, 0.62, -0.18);
  const seat = new THREE.CylinderGeometry(0.28, 0.28, 0.04, 14);
  seat.translate(0, 0.44, 0.12);
  return { bowl, tank, seat };
};
export const ToiletColumn: React.FC<{ t: number; floors: number[]; x?: number; z?: number; rot?: number; flushAt?: (k: number) => number; glow?: number }> = ({ t, floors, x = STACK.x - 1.0, z = STACK.z, rot = Math.PI / 2, flushAt, glow = 0 }) => {
  const G = useMemo(() => toiletGeos(), []);
  const mats = useMemo(() => floors.map((k) => mat([x, k * B.H, z], [0, rot, 0])), [floors.join(), x, z, rot]);
  const swirl = useMemo(() => {
    const out: THREE.Matrix4[] = [];
    if (!flushAt) return out;
    floors.forEach((k) => {
      const f = t - flushAt(k);
      if (f < 0 || f > 1.2) return;
      out.push(mat([x + 0.12 * Math.sin(rot), k * B.H + 0.43, z + 0.12 * Math.cos(rot)], [0, t * 12, 0], [0.4 * (1 - f / 1.4), 0.02, 0.4 * (1 - f / 1.4)]));
    });
    return out;
  }, [t, floors.join()]);
  return (
    <group>
      <InstM mats={mats} geo={G.bowl} max={floors.length}>
        <meshStandardMaterial color="#F7F7F4" roughness={0.25} emissive="#FFA930" emissiveIntensity={glow} />
      </InstM>
      <InstM mats={mats} geo={G.tank} max={floors.length}>
        <meshStandardMaterial color="#F0F0EC" roughness={0.25} emissive="#FFA930" emissiveIntensity={glow} />
      </InstM>
      <InstM mats={mats} geo={G.seat} max={floors.length}>
        <meshStandardMaterial color="#E6E6E0" roughness={0.3} />
      </InstM>
      <InstM mats={swirl} geo={unitBox} max={floors.length} cast={false}>
        <meshStandardMaterial color="#4AA8E8" emissive="#1E8ED6" emissiveIntensity={0.4} />
      </InstM>
    </group>
  );
};
// Cano grosso que nasce do topo e desce atravessando os andares (translúcido para ver a descarga).
export const DropStack: React.FC<{ grow: number; glow?: number; x?: number; z?: number; top?: number; bottom?: number; opacity?: number }> = ({ grow, glow = 0, x = STACK.x, z = STACK.z, top = B.top + 1.5, bottom = -1.2, opacity = 0.78 }) => {
  if (grow <= 0.001) return null;
  const L = (top - bottom) * cl(grow);
  return (
    <group>
      <mesh position={[x, top - L / 2, z]} renderOrder={4}>
        <cylinderGeometry args={[STACK.r, STACK.r, L, 18]} />
        <meshStandardMaterial color="#D3DADF" roughness={0.3} transparent opacity={opacity} depthWrite={false} emissive="#FFA930" emissiveIntensity={glow * 0.9} />
      </mesh>
      {/* luvas a cada andar */}
      {Array.from({ length: 31 }).map((_, k) => {
        const y = k * B.H + 0.4;
        if (y < top - L || y > top) return null;
        return (
          <mesh key={k} position={[x, y, z]}>
            <cylinderGeometry args={[STACK.r + 0.05, STACK.r + 0.05, 0.16, 18]} />
            <meshStandardMaterial color="#C9CFD3" roughness={0.4} emissive="#FFA930" emissiveIntensity={glow * 0.9} />
          </mesh>
        );
      })}
      {/* ramais dos vasos */}
      {Array.from({ length: 30 }).map((_, k) => {
        const y = k * B.H + 0.22;
        if (y < top - L) return null;
        return (
          <mesh key={`r${k}`} position={[x - 0.45, y, z]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.12, 0.12, 0.6, 10]} />
            <meshStandardMaterial color="#E8ECEE" roughness={0.3} />
          </mesh>
        );
      })}
    </group>
  );
};
// Bolotas de descarga (marrom) caindo: sem tubo caem no chão do andar de baixo; com tubo descem pelo tubo.
export const Flushes: React.FC<{ t: number; drops: { t0: number; k: number }[]; inPipe: boolean; x?: number; z?: number }> = ({ t, drops, inPipe, x = STACK.x, z = STACK.z }) => {
  const geo = useMemo(() => new THREE.IcosahedronGeometry(1, 1), []);
  const out = useMemo(() => {
    const m: THREE.Matrix4[] = [];
    const puddle: THREE.Matrix4[] = [];
    drops.forEach((d, i) => {
      const u = t - d.t0;
      if (u < 0) return;
      const y0 = d.k * B.H + 0.4;
      if (inPipe) {
        const y = y0 - 18 * u * u * 0.5 - 4 * u;
        if (y < -1.0) return;
        for (let j = 0; j < 3; j++) m.push(mat([x + Math.sin(i + j) * 0.08, y + j * 0.28, z + Math.cos(i * 2 + j) * 0.08], [i, j, 0], [0.14, 0.18, 0.14]));
      } else {
        const floorY = (d.k - 1) * B.H + 0.05;
        const y = Math.max(floorY + 0.05, y0 - 4.9 * u * u);
        const landed = y <= floorY + 0.06;
        if (!landed) for (let j = 0; j < 3; j++) m.push(mat([x - 0.8 + j * 0.1, y + j * 0.2, z + 0.3], [i, j, 0], [0.13, 0.16, 0.13]));
        else {
          const s = Math.min(1, (u - Math.sqrt((y0 - floorY) / 4.9)) * 3 + 0.2);
          puddle.push(mat([x - 0.8, floorY + 0.02, z + 0.3], [0, 0, 0], [0.6 * s + 0.1, 0.02, 0.45 * s + 0.1]));
        }
      }
    });
    return { m, puddle };
  }, [t, drops, inPipe]);
  return (
    <group>
      <InstM mats={out.m} geo={geo} max={drops.length * 3} cast={false} receive={false}>
        <meshStandardMaterial color="#7A5230" roughness={0.5} />
      </InstM>
      <InstM mats={out.puddle} geo={geo} max={drops.length} cast={false} receive={false}>
        <meshStandardMaterial color="#6E4A2A" roughness={0.3} />
      </InstM>
    </group>
  );
};

// ======================================================================
// BANHEIROS EM CORTE: ralo, sifão, tubo de queda e ventilação
// ======================================================================
const tubeOf = (pts: V3[], r: number, seg = 80) => {
  const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)), false, "catmullrom", 0.0);
  return new THREE.TubeGeometry(curve, seg, r, 12, false);
};
export const BATH = { drain: [0.6, 0, 0.6] as V3, stackX: 2.6, stackZ: 0.6 };
const P_STRAIGHT: V3[] = [
  [0.6, -0.05, 0.6],
  [0.6, -0.6, 0.6],
  [0.6, -0.9, 0.6],
  [1.0, -0.98, 0.6],
  [2.4, -1.05, 0.6],
];
const P_TRAP: V3[] = [
  [0.6, -0.05, 0.6],
  [0.6, -0.55, 0.6],
  [0.6, -0.9, 0.6],
  [0.66, -1.12, 0.6],
  [0.85, -1.24, 0.6],
  [1.04, -1.12, 0.6],
  [1.1, -0.9, 0.6],
  [1.1, -0.72, 0.6],
  [1.3, -0.74, 0.6],
  [2.4, -0.82, 0.6],
];
const P_WATER: V3[] = [
  [0.6, -0.78, 0.6],
  [0.6, -0.9, 0.6],
  [0.66, -1.12, 0.6],
  [0.85, -1.24, 0.6],
  [1.04, -1.12, 0.6],
  [1.1, -0.9, 0.6],
  [1.1, -0.78, 0.6],
];
// caminho do gás do esgoto: sobe pelo tubo de queda, entra no ramal e sai pelo ralo
const GAS_STRAIGHT: V3[] = [[2.6, -3.5, 0.6], [2.6, -1.05, 0.6], [1.0, -0.98, 0.6], [0.6, -0.9, 0.6], [0.6, 0.1, 0.6], [0.4, 1.4, 0.5], [0.1, 1.9, 0.4]];
const GAS_TRAP: V3[] = [[2.6, -3.5, 0.6], [2.6, -0.82, 0.6], [1.3, -0.74, 0.6], [1.1, -0.72, 0.6], [1.1, -0.9, 0.6], [0.85, -1.24, 0.6], [0.6, -0.9, 0.6], [0.6, 0.1, 0.6], [0.4, 1.4, 0.5], [0.1, 1.9, 0.4]];

const Tube: React.FC<{ pts: V3[]; r: number; draw?: number; color?: string; opacity?: number; glow?: number; seg?: number }> = ({ pts, r, draw = 1, color = "#EEF1F2", opacity = 0.5, glow = 0, seg = 80 }) => {
  const geo = useMemo(() => tubeOf(pts, r, seg), [JSON.stringify(pts), r, seg]);
  const idx = geo.index ? geo.index.count : 0;
  geo.setDrawRange(0, Math.floor(idx * cl(draw) / 6) * 6);
  if (draw <= 0.001) return null;
  return (
    <mesh geometry={geo} renderOrder={opacity < 1 ? 4 : 0}>
      <meshStandardMaterial color={color} roughness={0.3} transparent={opacity < 1} opacity={opacity} depthWrite={opacity >= 1} side={THREE.DoubleSide} emissive="#FFA930" emissiveIntensity={glow} />
    </mesh>
  );
};

// Um banheiro em corte (piso cortado na frente para ver o encanamento embaixo).
const BathRoom: React.FC<{ y: number; wallColor?: string; toilet?: boolean; drain?: boolean }> = ({ y, toilet = true, drain = true }) => {
  const tile = useMemo(() => {
    const t0 = tileTexture("#EAF4F6", "#BFD4DB", 8).clone();
    t0.repeat.set(4, 2.5);
    t0.needsUpdate = true;
    return t0;
  }, []);
  const floorT = useMemo(() => {
    const t0 = tileTexture("#C9D3D8", "#94A6AE", 6).clone();
    t0.repeat.set(5, 3);
    t0.needsUpdate = true;
    return t0;
  }, []);
  const G = useMemo(() => toiletGeos(), []);
  return (
    <group position={[0, y, 0]}>
      <mesh position={[0, -0.15, 0]} receiveShadow castShadow>
        <boxGeometry args={[7, 0.3, 4.4]} />
        <meshStandardMaterial map={concreteTex("#B9B5AC", [3, 2], 0)} roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.006, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[7, 4.4]} />
        <meshStandardMaterial map={floorT} roughness={0.35} />
      </mesh>
      <mesh position={[0, 1.4, -2.2]} receiveShadow>
        <planeGeometry args={[7, 2.8]} />
        <meshStandardMaterial map={tile} roughness={0.3} />
      </mesh>
      <mesh position={[-3.5, 1.4, 0]} rotation={[0, Math.PI / 2, 0]} receiveShadow>
        <planeGeometry args={[4.4, 2.8]} />
        <meshStandardMaterial map={tile} roughness={0.3} />
      </mesh>
      {/* forro do andar de baixo (teto) */}
      <mesh position={[0, -0.34, -2.0]}>
        <boxGeometry args={[7, 0.06, 0.4]} />
        <meshStandardMaterial color="#E9E6DE" />
      </mesh>
      {toilet ? (
        <group position={[-1.9, 0, -1.6]}>
          <mesh geometry={G.bowl} castShadow>
            <meshStandardMaterial color="#F7F7F4" roughness={0.25} />
          </mesh>
          <mesh geometry={G.tank} castShadow>
            <meshStandardMaterial color="#F0F0EC" roughness={0.25} />
          </mesh>
          <mesh geometry={G.seat}>
            <meshStandardMaterial color="#E6E6E0" roughness={0.3} />
          </mesh>
        </group>
      ) : null}
      {/* pia */}
      <group position={[1.2, 0, -1.9]}>
        <mesh position={[0, 0.85, 0]} castShadow>
          <boxGeometry args={[0.9, 0.12, 0.5]} />
          <meshStandardMaterial color="#F7F7F4" roughness={0.25} />
        </mesh>
        <mesh position={[0, 0.42, 0.05]}>
          <cylinderGeometry args={[0.07, 0.09, 0.8, 10]} />
          <meshStandardMaterial color="#F0F0EC" />
        </mesh>
        <mesh position={[0, 1.55, -0.24]}>
          <boxGeometry args={[0.7, 0.8, 0.03]} />
          <meshStandardMaterial color="#AFC6D4" metalness={0.6} roughness={0.08} />
        </mesh>
      </group>
      {drain ? (
        <group position={[BATH.drain[0], 0.012, BATH.drain[2]]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.16, 20]} />
            <meshStandardMaterial color="#C8D0D6" metalness={0.8} roughness={0.25} />
          </mesh>
          {[-0.08, -0.03, 0.02, 0.07].map((x) => (
            <mesh key={x} position={[x, 0.004, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[0.025, 0.22]} />
              <meshBasicMaterial color="#3A4047" />
            </mesh>
          ))}
        </group>
      ) : null}
    </group>
  );
};

export const BathSection: React.FC<{
  t: number;
  trap: number; // 0 cano reto, 1 sifão
  trapWater: number; // 0..1 nível da água guardada
  gas: number; // quantidade de fedor
  gasThrough: boolean; // o gás atravessa até o ralo
  upper: boolean; // mostra o banheiro de cima
  plugY: number; // posição da descarga caindo no tubo (<-50 = nenhuma)
  vent: number; // 0..1 cano de ventilação nascendo
  air: number; // fluxo de ar no cano de ventilação
  glowTrap?: number;
  glowVent?: number;
  suck?: number; // 0..1 água do sifão sendo puxada para o tubo
}> = ({ t, trap, trapWater, gas, gasThrough, upper, plugY, vent, air, glowTrap = 0, glowVent = 0, suck = 0 }) => {
  const SX = BATH.stackX, SZ = BATH.stackZ;
  const VX = 3.25;
  const ventPts: V3[] = [
    [VX, 9.0, SZ],
    [VX, -0.6, SZ],
    [VX, -1.6, SZ],
    [VX, -1.9, SZ],
    [SX + 0.1, -2.3, SZ],
  ];
  const airMats = useMemo(() => {
    const out: THREE.Matrix4[] = [];
    if (air <= 0.01) return out;
    for (let i = 0; i < 14; i++) {
      const u = (i / 14 + t * 0.6) % 1;
      const y = 9 - u * 10.5;
      out.push(mat([VX, y, SZ + 0.0], [0, 0, Math.PI], [0.12, 0.3, 0.12]));
    }
    return out;
  }, [t, air]);
  const coneGeo = useMemo(() => new THREE.ConeGeometry(1, 1, 10), []);
  return (
    <group>
      <BathRoom y={0} />
      {upper ? <BathRoom y={3.2} drain={false} /> : null}
      {upper ? (
        // ramal do vaso de cima até o tubo de queda
        <Tube pts={[[-1.9, 3.0, -1.4], [-1.9, 2.75, -1.0], [0, 2.7, SZ], [SX - 0.1, 2.65, SZ]]} r={0.12} opacity={0.6} />
      ) : null}
      {/* tubo de queda */}
      <mesh position={[SX, 1.8, SZ]} renderOrder={4}>
        <cylinderGeometry args={[0.26, 0.26, 12.6, 18]} />
        <meshStandardMaterial color="#E8ECEE" roughness={0.3} transparent opacity={0.5} depthWrite={false} />
      </mesh>
      {/* descarga despencando no tubo */}
      {plugY > -50 ? (
        <group position={[SX, plugY, SZ]}>
          <mesh>
            <cylinderGeometry args={[0.2, 0.2, 1.3, 14]} />
            <meshStandardMaterial color="#3E9BE0" transparent opacity={0.85} emissive="#1E7ED0" emissiveIntensity={0.3} />
          </mesh>
          {/* ar sendo puxado atrás da água */}
          {[0, 1, 2].map((i) => (
            <mesh key={i} position={[0, 0.9 + i * 0.35, 0]} scale={[0.1, 0.18, 0.1]}>
              <coneGeometry args={[1, 1, 8]} />
              <meshBasicMaterial color="#FFFFFF" toneMapped={false} />
            </mesh>
          ))}
        </group>
      ) : null}
      {/* ramal do ralo: reto (some) ou sifão (desenha) */}
      <Tube pts={P_STRAIGHT} r={0.11} opacity={0.55 * (1 - cl(trap * 1.3))} draw={1} />
      <Tube pts={P_TRAP} r={0.11} opacity={0.55} draw={trap} glow={glowTrap * 0.8} seg={120} />
      {trap > 0.95 && trapWater > 0.02 ? <Tube pts={P_WATER} r={0.085} opacity={0.9} color="#3FA8F0" draw={trapWater} glow={glowTrap * 0.6} seg={80} /> : null}
      {/* água do sifão sendo sugada */}
      {suck > 0.01 && suck < 0.99 ? (
        <mesh position={[1.3 + 1.1 * suck, -0.76 - 0.05 * suck, SZ]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.07, 0.07, 0.5, 10]} />
          <meshStandardMaterial color="#3FA8F0" emissive="#1E7ED0" emissiveIntensity={0.4} />
        </mesh>
      ) : null}
      {/* fedor (gás verde) */}
      <Puffs t={t} pts={trap > 0.5 ? GAS_TRAP : GAS_STRAIGHT} amount={gas} n={46} size={0.11} color="#7FBF3A" speed={0.32} end={gasThrough ? 1 : trap > 0.5 ? 0.33 : 1} opacity={0.75} seed={11} wobble={0.25} />
      {gasThrough && gas > 0.05 ? <Puffs t={t + 3} pts={[[0.6, 0.1, 0.6], [0.3, 1.0, 0.5], [-0.2, 1.8, 0.4], [-0.6, 2.4, 0.2]]} amount={gas} n={26} size={0.2} color="#8FD14A" speed={0.35} opacity={0.6} seed={17} wobble={0.6} /> : null}
      {/* ventilação */}
      {vent > 0.001 ? <Tube pts={ventPts} r={0.13} opacity={0.6} color="#DDE6EA" draw={vent} glow={glowVent * 0.9} seg={100} /> : null}
      {vent > 0.98 ? <Tube pts={[[VX, -0.62, SZ], [2.0, -0.78, SZ]]} r={0.1} opacity={0.6} color="#DDE6EA" glow={glowVent * 0.9} /> : null}
      {vent > 0.98 ? (
        <mesh position={[VX, 9.15, SZ]}>
          <cylinderGeometry args={[0.28, 0.2, 0.18, 14]} />
          <meshStandardMaterial color="#9AA6AE" metalness={0.4} />
        </mesh>
      ) : null}
      <InstM mats={airMats} geo={coneGeo} max={14} cast={false} receive={false}>
        <meshBasicMaterial color="#9BE0FF" toneMapped={false} transparent opacity={0.9 * cl(air)} />
      </InstM>
      {/* teto/telhado no topo da ventilação */}
      <mesh position={[0, 6.6, -0.6]}>
        <boxGeometry args={[7.4, 0.3, 5]} />
        <meshStandardMaterial map={concreteTex("#B9B5AC", [3, 2], 0)} roughness={0.9} />
      </mesh>
    </group>
  );
};

// ======================================================================
// INCÊNDIO: corte de 6 andares com apartamento, corredor, elevador e escada
// ======================================================================
export const FIRE = { floors: 6, H: 3, fireK: 2, xApt0: -9, xApt1: -2.4, xCor1: 1.0, xSt1: 5.6, z0: -2.6, z1: 2.6 };
const stairFlights = () => {
  const steps: THREE.Matrix4[] = [], land: THREE.Matrix4[] = [], rail: THREE.Matrix4[] = [];
  const x0 = 1.5, x1 = 4.9, run = x1 - x0;
  const ang = Math.atan2(1.5, run);
  for (let k = 0; k < FIRE.floors; k++) {
    const y0 = k * FIRE.H;
    for (let i = 0; i < 9; i++) {
      const h = (1.5 / 9) * (i + 1);
      steps.push(mat([x0 + run * ((i + 0.5) / 9), y0 + h - 0.085, -1.3], [0, 0, 0], [run / 9 + 0.01, 0.17, 1.4]));
      steps.push(mat([x1 - run * ((i + 0.5) / 9), y0 + 1.5 + h - 0.085, 0.3], [0, 0, 0], [run / 9 + 0.01, 0.17, 1.4]));
    }
    land.push(mat([x1 + 0.35, y0 + 1.4, -0.5], [0, 0, 0], [0.7, 0.2, 3.0]));
    land.push(mat([x0 - 0.25, y0 + 2.9, -0.5], [0, 0, 0], [0.5, 0.2, 3.0]));
    rail.push(mat([(x0 + x1) / 2, y0 + 0.75 + 0.95, -0.55], [0, 0, ang], [Math.hypot(run, 1.5), 0.06, 0.06]));
    rail.push(mat([(x0 + x1) / 2, y0 + 2.25 + 0.95, 1.05], [0, 0, -ang], [Math.hypot(run, 1.5), 0.06, 0.06]));
  }
  return { steps, land, rail };
};
export const stairWalk = (u: number): { p: V3; rot: number } => {
  // u em andares (0 = térreo do corte); desce/sobe pelos lances
  const k = Math.floor(u), f = u - k;
  const y0 = k * FIRE.H;
  const x0 = 1.5, x1 = 4.9;
  if (f < 0.5) {
    const s = f / 0.5;
    return { p: [x0 + (x1 - x0) * s, y0 + 1.5 * s + 0.02, -1.3], rot: Math.PI / 2 };
  }
  const s = (f - 0.5) / 0.5;
  return { p: [x1 - (x1 - x0) * s, y0 + 1.5 + 1.5 * s + 0.02, 0.3], rot: -Math.PI / 2 };
};
export const FireSection: React.FC<{
  t: number;
  fire: number;
  smokeCor: number; // fumaça no corredor
  smokeStair: number; // fumaça subindo pela escada
  doors: number; // 0 abertas, 1 fechadas
  glowDoors?: number;
  glowStair?: number;
  elevAlarm?: number;
  tiao?: { p: V3; rot: number; mood: "neutral" | "shock" | "sad" | "happy"; walk?: number; cough?: number; arms?: "up" | "nose" | "none" };
}> = ({ t, fire, smokeCor, smokeStair, doors, glowDoors = 0, glowStair = 0, elevAlarm = 0, tiao }) => {
  const F = FIRE;
  const S = useMemo(() => stairFlights(), []);
  const conc = concreteTex("#BCB8AE", [2, 1], 0);
  const floorTile = useMemo(() => {
    const t0 = tileTexture("#D9D2C4", "#B5AA98", 6).clone();
    t0.repeat.set(6, 2);
    t0.needsUpdate = true;
    return t0;
  }, []);
  const wood = useMemo(() => {
    const t0 = woodTexture("#B9875A").clone();
    t0.repeat.set(4, 2);
    t0.needsUpdate = true;
    return t0;
  }, []);
  const slabs = useMemo(() => Array.from({ length: F.floors + 1 }, (_, k) => mat([(F.xApt0 + F.xSt1) / 2, k * F.H - 0.15, 0], [0, 0, 0], [F.xSt1 - F.xApt0 + 0.6, 0.3, F.z1 - F.z0])), []);
  const walls = useMemo(() => {
    const out: THREE.Matrix4[] = [];
    for (let k = 0; k < F.floors; k++) {
      const y = k * F.H + 1.35;
      // parede apartamento | corredor (com porta)
      out.push(mat([F.xApt1, y, -1.6], [0, 0, 0], [0.18, 2.7, 2.0]));
      out.push(mat([F.xApt1, y, 1.8], [0, 0, 0], [0.18, 2.7, 1.6]));
      out.push(mat([F.xApt1, k * F.H + 2.45, 0.3], [0, 0, 0], [0.18, 0.5, 2.2]));
      // parede corredor | escada (vão da porta corta-fogo em z -2.4..-1.3)
      out.push(mat([F.xCor1, y, 0.65], [0, 0, 0], [0.22, 2.7, 3.9]));
      out.push(mat([F.xCor1, k * F.H + 2.5, -1.85], [0, 0, 0], [0.22, 0.4, 1.1]));
      // parede externa da escada
      out.push(mat([F.xSt1, y, 0], [0, 0, 0], [0.22, 2.7, 5.2]));
    }
    return out;
  }, []);
  const doorAng = (k: number) => {
    const d = cl(doors * 1.6 - (F.floors - 1 - k) * 0.12);
    return (Math.PI / 2) * (1 - ease.inOut(d));
  };
  return (
    <group>
      <InstM mats={slabs} geo={unitBox} max={F.floors + 1}>
        <meshStandardMaterial map={conc} roughness={0.9} />
      </InstM>
      <InstM mats={walls} geo={unitBox} max={F.floors * 6}>
        <meshStandardMaterial color="#EDE6D8" roughness={0.9} />
      </InstM>
      {/* paredes do fundo */}
      {Array.from({ length: F.floors }).map((_, k) => (
        <group key={k}>
          <mesh position={[(F.xApt0 + F.xApt1) / 2, k * F.H + 1.35, F.z0]} receiveShadow>
            <boxGeometry args={[F.xApt1 - F.xApt0, 2.7, 0.2]} />
            <meshStandardMaterial color={["#F2DDC8", "#DDE9F2", "#E6F0DA", "#F4E6EE", "#F2E8C8", "#DCE6EE"][k % 6]} roughness={0.9} />
          </mesh>
          <mesh position={[(F.xApt1 + F.xCor1) / 2, k * F.H + 1.35, F.z0]}>
            <boxGeometry args={[F.xCor1 - F.xApt1, 2.7, 0.2]} />
            <meshStandardMaterial color="#D9D3C6" roughness={0.9} />
          </mesh>
          <mesh position={[(F.xCor1 + F.xSt1) / 2, k * F.H + 1.35, F.z0]}>
            <boxGeometry args={[F.xSt1 - F.xCor1, 2.7, 0.2]} />
            <meshStandardMaterial color="#E8E2D2" roughness={0.9} />
          </mesh>
          {/* janela do apartamento */}
          <mesh position={[-6.2, k * F.H + 1.6, F.z0 + 0.11]}>
            <planeGeometry args={[2.2, 1.3]} />
            <meshStandardMaterial map={glassTex()} roughness={0.15} />
          </mesh>
          {/* piso */}
          <mesh position={[(F.xApt0 + F.xApt1) / 2, k * F.H + 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[F.xApt1 - F.xApt0, F.z1 - F.z0]} />
            <meshStandardMaterial map={wood} roughness={0.7} />
          </mesh>
          <mesh position={[(F.xApt1 + F.xCor1) / 2, k * F.H + 0.006, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[F.xCor1 - F.xApt1, F.z1 - F.z0]} />
            <meshStandardMaterial map={floorTile} roughness={0.5} />
          </mesh>
          {/* móveis: sofá e mesa */}
          <mesh position={[-7.6, k * F.H + 0.4, -1.6]} castShadow>
            <boxGeometry args={[2.0, 0.8, 0.9]} />
            <meshStandardMaterial color={["#5A7DB5", "#B5655A", "#6E9C6A", "#9B7BB5", "#C9A04A", "#5AA5B5"][k % 6]} roughness={0.8} />
          </mesh>
          <mesh position={[-4.4, k * F.H + 0.75, -0.4]} castShadow>
            <boxGeometry args={[1.3, 0.08, 0.9]} />
            <meshStandardMaterial map={woodTexture("#9A6A40")} />
          </mesh>
          <mesh position={[-4.4, k * F.H + 0.37, -0.4]}>
            <boxGeometry args={[0.1, 0.74, 0.1]} />
            <meshStandardMaterial color="#5A3E28" />
          </mesh>
          {/* luminária */}
          <mesh position={[-5, k * F.H + 2.85, 0]}>
            <boxGeometry args={[0.8, 0.06, 0.3]} />
            <meshStandardMaterial color="#FFFFFF" emissive="#FFF2D8" emissiveIntensity={1.3} />
          </mesh>
          {/* porta do elevador no corredor */}
          <group position={[-0.8, k * F.H, F.z0 + 0.12]}>
            <mesh position={[0, 1.1, 0]}>
              <boxGeometry args={[1.3, 2.2, 0.05]} />
              <meshStandardMaterial color="#B9C2C9" metalness={0.7} roughness={0.25} />
            </mesh>
            <mesh position={[0, 1.1, 0.03]}>
              <boxGeometry args={[0.02, 2.2, 0.01]} />
              <meshStandardMaterial color="#5A646C" />
            </mesh>
            <mesh position={[0.9, 1.25, 0.02]}>
              <boxGeometry args={[0.16, 0.3, 0.03]} />
              <meshStandardMaterial color="#2B3138" emissive={elevAlarm > 0 && k === F.fireK ? "#FF2A1A" : "#59D0FF"} emissiveIntensity={elevAlarm > 0 && k === F.fireK ? 1.5 * (0.5 + 0.5 * Math.sin(t * 18)) : 0.6} />
            </mesh>
            <mesh position={[0, 2.45, 0.02]}>
              <boxGeometry args={[0.6, 0.18, 0.03]} />
              <meshStandardMaterial color="#1E2228" emissive="#FF6A2A" emissiveIntensity={0.5} />
            </mesh>
          </group>
          {/* porta corta-fogo (dobradiça em z = -2.4) */}
          <group position={[F.xCor1 + 0.12, k * F.H, -2.4]} rotation={[0, doorAng(k), 0]}>
            <mesh position={[0, 1.05, 0.55]} castShadow>
              <boxGeometry args={[0.07, 2.1, 1.08]} />
              <meshStandardMaterial color="#C8322A" roughness={0.45} metalness={0.2} emissive="#FFB02E" emissiveIntensity={glowDoors * 1.1} />
            </mesh>
            <mesh position={[0.06, 1.0, 0.75]}>
              <boxGeometry args={[0.05, 0.06, 0.6]} />
              <meshStandardMaterial color="#D8DDE1" metalness={0.8} />
            </mesh>
            <mesh position={[0.04, 1.6, 0.55]}>
              <boxGeometry args={[0.02, 0.4, 0.25]} />
              <meshStandardMaterial color="#BFE3F2" transparent opacity={0.6} />
            </mesh>
          </group>
          {/* placa SAÍDA */}
          <mesh position={[F.xCor1 - 0.13, k * F.H + 2.5, -0.8]} rotation={[0, -Math.PI / 2, 0]}>
            <planeGeometry args={[0.6, 0.22]} />
            <meshStandardMaterial color="#2DBE5A" emissive="#2DBE5A" emissiveIntensity={0.9} />
          </mesh>
          <mesh position={[3.2, k * F.H + 2.9, -2.4]}>
            <boxGeometry args={[0.9, 0.08, 0.2]} />
            <meshStandardMaterial color="#FFFFFF" emissive="#FFF6E0" emissiveIntensity={1.6} />
          </mesh>
        </group>
      ))}
      <InstM mats={S.steps} geo={unitBox} max={F.floors * 18}>
        <meshStandardMaterial map={conc} color="#E6E2D8" roughness={0.85} emissive="#FFA930" emissiveIntensity={glowStair * 0.8} />
      </InstM>
      <InstM mats={S.land} geo={unitBox} max={F.floors * 2}>
        <meshStandardMaterial map={conc} color="#E6E2D8" roughness={0.85} emissive="#FFA930" emissiveIntensity={glowStair * 0.8} />
      </InstM>
      <InstM mats={S.rail} geo={unitBox} max={F.floors * 2}>
        <meshStandardMaterial color="#D8402C" roughness={0.4} metalness={0.3} />
      </InstM>
      {/* fogo no apartamento */}
      <Flames t={t} position={[-6.3, F.fireK * F.H, -0.6]} amount={fire} scale={1.0} />
      <Flames t={t + 1.3} position={[-7.6, F.fireK * F.H + 0.6, -1.6]} amount={fire * 0.8} scale={0.75} light={false} />
      <Flames t={t + 2.1} position={[-4.4, F.fireK * F.H + 0.75, -0.4]} amount={fire * 0.6} scale={0.5} light={false} />
      {/* fumaça: apartamento -> corredor -> porta da escada */}
      <Puffs
        t={t}
        pts={[[-6.3, F.fireK * F.H + 2.0, -0.4], [-3.4, F.fireK * F.H + 2.4, 0.4], [-1.0, F.fireK * F.H + 2.3, 0.0], [0.6, F.fireK * F.H + 2.1, -1.8]]}
        amount={smokeCor}
        n={46}
        size={0.4}
        color="#45484D"
        speed={0.22}
        end={doors > 0.6 ? 0.88 : 1}
        seed={23}
        wobble={0.9}
      />
      <Puffs
        t={t}
        pts={[
          [1.6, F.fireK * F.H + 2.1, -1.8],
          [3.2, F.fireK * F.H + 3.0, -0.6],
          [2.2, F.fireK * F.H + 5.0, -0.2],
          [3.6, F.fireK * F.H + 7.2, -0.6],
          [2.4, F.fireK * F.H + 9.4, -0.2],
          [3.4, F.fireK * F.H + 11.6, -0.6],
        ]}
        amount={smokeStair}
        n={70}
        size={0.75}
        color="#3E4146"
        speed={0.2}
        seed={29}
        wobble={1.6}
      />
      {tiao ? (
        <TiaoWalk
          t={t}
          position={tiao.p}
          rotation={tiao.rot}
          mood={tiao.mood}
          sweat={tiao.cough ?? 0}
          legL={(tiao.walk ?? 0) * Math.sin(t * 13) * 0.7}
          legR={-(tiao.walk ?? 0) * Math.sin(t * 13) * 0.7}
          armLOverride={tiao.arms === "up" ? [0, 0, -2.5] : tiao.arms === "nose" ? [-2.2, 0, 0.6] : undefined}
          armROverride={tiao.arms === "up" ? [0, 0, 2.5] : tiao.arms === "nose" ? [-2.2, 0, -0.6] : undefined}
          sick={tiao.cough ?? 0}
        />
      ) : null}
    </group>
  );
};

// ======================================================================
// LAJE DO TOPO: trincas, poças, manta preta, ralos e água escorrendo
// ======================================================================
const ROOF_Y = B.top + 0.02;
export const RoofWork: React.FC<{ t: number; crack: number; wet: number; manta: number; drains: number; flow: number; glow?: number; heat?: number }> = ({ t, crack, wet, manta, drains, flow, glow = 0, heat = 0 }) => {
  const cracks = useMemo(() => {
    const out: THREE.Matrix4[] = [];
    const lines: [number, number, number, number][] = [];
    // trincas em zigue-zague partindo de alguns pontos
    for (let c = 0; c < 7; c++) {
      let x = (rnd(c, 501) - 0.5) * 11, z = (rnd(c, 502) - 0.5) * 11;
      if (Math.abs(x) < 2.8 && Math.abs(z) < 2.8) x += 3.5;
      let a = rnd(c, 503) * Math.PI * 2;
      for (let s = 0; s < 6; s++) {
        const L = 0.6 + rnd(c * 9 + s, 504) * 0.8;
        a += (rnd(c * 9 + s, 505) - 0.5) * 1.6;
        const nx = x + Math.cos(a) * L, nz = z + Math.sin(a) * L;
        lines.push([x, z, nx, nz]);
        x = nx;
        z = nz;
      }
    }
    return lines;
  }, []);
  const crackMats = useMemo(() => {
    const out: THREE.Matrix4[] = [];
    const n = Math.floor(cracks.length * cl(crack));
    for (let i = 0; i < n; i++) {
      const [x0, z0, x1, z1] = cracks[i];
      if (Math.max(Math.abs(x0), Math.abs(z0), Math.abs(x1), Math.abs(z1)) > 7.0) continue;
      const L = Math.hypot(x1 - x0, z1 - z0);
      out.push(mat([(x0 + x1) / 2, ROOF_Y + 0.02, (z0 + z1) / 2], [0, -Math.atan2(z1 - z0, x1 - x0), 0], [L, 0.02, 0.07]));
    }
    return out;
  }, [crack, cracks]);
  const mantaW = 14.2 * cl(manta);
  const drainsAt: [number, number][] = [
    [-6.3, -6.3],
    [6.3, -6.3],
    [-6.3, 6.3],
    [6.3, 6.3],
  ];
  const streams = useMemo(() => {
    const out: THREE.Matrix4[] = [];
    if (flow <= 0.01) return out;
    for (let i = 0; i < 64; i++) {
      const d = drainsAt[i % 4];
      const sx = (rnd(i, 601) - 0.5) * 12, sz = (rnd(i, 602) - 0.5) * 12;
      const u = (rnd(i, 603) + t * 0.55) % 1;
      const x = sx + (d[0] - sx) * u, z = sz + (d[1] - sz) * u;
      if (Math.abs(x) < 2.5 && Math.abs(z) < 2.5) continue;
      out.push(mat([x, ROOF_Y + 0.08, z], [0, -Math.atan2(d[1] - sz, d[0] - sx), 0], [0.5, 0.03, 0.06]));
    }
    return out;
  }, [t, flow]);
  return (
    <group>
      <InstM mats={crackMats} geo={unitBox} max={60} cast={false}>
        <meshBasicMaterial color="#2A221C" />
      </InstM>
      {/* poças */}
      {wet > 0.01
        ? [
            [3.6, -4.2, 1.6],
            [-4.8, 3.0, 1.2],
            [4.5, 4.8, 1.0],
            [-3.6, -4.5, 1.3],
          ].map(([x, z, r], i) => (
            <mesh key={i} position={[x, ROOF_Y + 0.03, z]} rotation={[-Math.PI / 2, 0, 0]} scale={[r * cl(wet) + 0.01, r * 0.7 * cl(wet) + 0.01, 1]}>
              <circleGeometry args={[1, 20]} />
              <meshStandardMaterial color="#6D8CA6" roughness={0.05} metalness={0.3} transparent opacity={0.8} />
            </mesh>
          ))
        : null}
      {/* manta preta desenrolando de x=-7.1 para +7.1 */}
      {manta > 0.001 ? (
        <group>
          {/* faixas em volta do núcleo */}
          <mesh position={[-7.1 + mantaW / 2, ROOF_Y + 0.05, 0]} receiveShadow>
            <boxGeometry args={[mantaW, 0.04, 14.2]} />
            <meshStandardMaterial color="#1E2023" roughness={0.75} emissive="#FFB02E" emissiveIntensity={glow * 0.5} />
          </mesh>
          {/* emendas */}
          {Array.from({ length: 7 }).map((_, i) => {
            const x = -7.1 + (i + 1) * 2.0;
            if (x > -7.1 + mantaW) return null;
            return (
              <mesh key={i} position={[x, ROOF_Y + 0.075, 0]}>
                <boxGeometry args={[0.06, 0.01, 14.2]} />
                <meshStandardMaterial color="#3A3D42" />
              </mesh>
            );
          })}
          {/* rolo */}
          {manta < 0.999 ? (
            <mesh position={[-7.1 + mantaW, ROOF_Y + 0.35, 0]} rotation={[Math.PI / 2, 0, t * 3]} castShadow>
              <cylinderGeometry args={[0.32 * (1 - manta * 0.5), 0.32 * (1 - manta * 0.5), 14.2, 18]} />
              <meshStandardMaterial color="#26282C" roughness={0.6} />
            </mesh>
          ) : null}
        </group>
      ) : null}
      {/* ralos nos cantos */}
      {drains > 0.01
        ? drainsAt.map(([x, z], i) => (
            <group key={i} position={[x, ROOF_Y + 0.08, z]} scale={popS(cl(drains))}>
              <mesh rotation={[-Math.PI / 2, 0, 0]}>
                <circleGeometry args={[0.35, 20]} />
                <meshStandardMaterial color="#9AA2AA" metalness={0.7} roughness={0.3} emissive="#FFB02E" emissiveIntensity={glow} />
              </mesh>
              <mesh position={[0, 0.12, 0]}>
                <sphereGeometry args={[0.24, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
                <meshStandardMaterial color="#6E767E" metalness={0.6} wireframe />
              </mesh>
            </group>
          ))
        : null}
      <InstM mats={streams} geo={unitBox} max={64} cast={false} receive={false}>
        <meshBasicMaterial color="#8FD3FF" toneMapped={false} transparent opacity={0.85} />
      </InstM>
      {heat > 0.01 ? <pointLight position={[0, ROOF_Y + 6, 0]} intensity={60 * heat} distance={20} color="#FFB060" /> : null}
    </group>
  );
};

// Último andar por dentro: teto rachado pingando no balde, chuva na janela.
export const LeakRoom: React.FC<{ t: number; drip: number; stain: number }> = ({ t, drip, stain }) => {
  const drops = useMemo(() => {
    const out: THREE.Matrix4[] = [];
    if (drip <= 0.01) return out;
    for (const [x, z, ph] of [
      [0.2, 0, 0],
      [0.25, 0.05, 0.45],
      [-1.4, -0.6, 0.2],
    ]) {
      const u = (t * 1.3 + ph) % 1;
      const y = 2.9 - u * u * 2.6;
      if (x < 0 && y < 0.05) continue;
      out.push(mat([x, Math.max(0.5, y), z], [0, 0, 0], [0.05, 0.08, 0.05]));
    }
    return out;
  }, [t, drip]);
  const geo = useMemo(() => new THREE.SphereGeometry(1, 10, 8), []);
  const wall = useMemo(() => {
    const t0 = concreteTex("#EAE3D6", [2, 1], 0).clone();
    t0.needsUpdate = true;
    return t0;
  }, []);
  return (
    <group>
      <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[8, 6]} />
        <meshStandardMaterial map={woodTexture("#B9875A")} roughness={0.7} />
      </mesh>
      <mesh position={[0, 3.0, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[8, 6]} />
        <meshStandardMaterial map={wall} roughness={0.9} />
      </mesh>
      {/* mancha e trinca no teto */}
      <mesh position={[0.2, 2.985, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[1.3 * stain + 0.01, 0.9 * stain + 0.01, 1]}>
        <circleGeometry args={[1, 24]} />
        <meshStandardMaterial color="#9C8B6A" transparent opacity={0.65} />
      </mesh>
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} position={[-0.6 + i * 0.45, 2.98, Math.sin(i * 1.7) * 0.15]} rotation={[Math.PI / 2, 0, 0.5 + Math.sin(i * 2.1)]}>
          <planeGeometry args={[0.5, 0.03]} />
          <meshBasicMaterial color="#3A2E22" side={THREE.DoubleSide} />
        </mesh>
      ))}
      <mesh position={[0, 1.5, -3]}>
        <planeGeometry args={[8, 3]} />
        <meshStandardMaterial map={wall} color="#F2E2D0" roughness={0.9} />
      </mesh>
      <mesh position={[-4, 1.5, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[6, 3]} />
        <meshStandardMaterial map={wall} color="#F2E2D0" roughness={0.9} />
      </mesh>
      {/* janela com chuva lá fora */}
      <mesh position={[-1.6, 1.7, -2.98]}>
        <planeGeometry args={[2.4, 1.5]} />
        <meshStandardMaterial color="#5E7088" emissive="#3B4A60" emissiveIntensity={0.7} />
      </mesh>
      {Array.from({ length: 16 }).map((_, i) => (
        <mesh key={i} position={[-2.7 + (i % 8) * 0.3, 2.35 - (((t * 1.8 + rnd(i, 7)) % 1) * 1.3), -2.97]}>
          <planeGeometry args={[0.012, 0.18]} />
          <meshBasicMaterial color="#C8DDF0" />
        </mesh>
      ))}
      {/* sofá encostado */}
      <mesh position={[2.6, 0.4, -2.4]}>
        <boxGeometry args={[2.0, 0.8, 0.9]} />
        <meshStandardMaterial color="#6E8BB5" roughness={0.8} />
      </mesh>
      <InstM mats={drops} geo={geo} max={3} cast={false}>
        <meshStandardMaterial color="#7FC6F2" emissive="#1E8ED6" emissiveIntensity={0.4} />
      </InstM>
      <pointLight position={[1.5, 2.6, 2]} intensity={10} distance={10} color="#DCE6F2" />
    </group>
  );
};

// ======================================================================
// PORTARIA: hall com balcão, interfone, caixas de correio e elevador
// ======================================================================
export const Lobby: React.FC<{ t: number; desk: number; intercom: number; buzz: number; glowDesk?: number; glowInter?: number }> = ({ t, desk, intercom, buzz, glowDesk = 0, glowInter = 0 }) => {
  const floorT = useMemo(() => {
    const t0 = tileTexture("#EDE7DC", "#CFC6B6", 4).clone();
    t0.repeat.set(5, 4);
    t0.needsUpdate = true;
    return t0;
  }, []);
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]} receiveShadow>
        <planeGeometry args={[14, 10]} />
        <meshStandardMaterial map={floorT} roughness={0.25} metalness={0.05} />
      </mesh>
      <mesh position={[0, 1.6, -4]} receiveShadow>
        <boxGeometry args={[14, 3.2, 0.2]} />
        <meshStandardMaterial map={woodTexture("#9C6E46")} roughness={0.6} />
      </mesh>
      <mesh position={[-6, 1.6, 0]} receiveShadow>
        <boxGeometry args={[0.2, 3.2, 8]} />
        <meshStandardMaterial color="#EFEAE0" roughness={0.8} />
      </mesh>
      <mesh position={[0, 3.2, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[14, 10]} />
        <meshStandardMaterial color="#F4F1EA" />
      </mesh>
      {[-3, 0, 3].map((x) => (
        <mesh key={x} position={[x, 3.15, -1]}>
          <cylinderGeometry args={[0.3, 0.3, 0.05, 16]} />
          <meshStandardMaterial color="#FFFFFF" emissive="#FFF0D0" emissiveIntensity={1.4} />
        </mesh>
      ))}
      {/* portas do elevador no fundo */}
      {[2.4, 4.4].map((x) => (
        <group key={x} position={[x, 0, -3.88]}>
          <mesh position={[0, 1.15, 0]}>
            <boxGeometry args={[1.3, 2.3, 0.05]} />
            <meshStandardMaterial color="#C9D0D6" metalness={0.8} roughness={0.2} />
          </mesh>
          <mesh position={[0, 2.5, 0.02]}>
            <boxGeometry args={[0.5, 0.16, 0.02]} />
            <meshStandardMaterial color="#1E2228" emissive="#FF8A2E" emissiveIntensity={0.7} />
          </mesh>
        </group>
      ))}
      {/* caixas de correio */}
      <group position={[-5.88, 1.3, -1.8]}>
        {Array.from({ length: 12 }).map((_, i) => (
          <mesh key={i} position={[0, (i % 4) * 0.32, Math.floor(i / 4) * 0.42]} rotation={[0, Math.PI / 2, 0]}>
            <boxGeometry args={[0.38, 0.28, 0.06]} />
            <meshStandardMaterial color="#B8A06A" metalness={0.6} roughness={0.35} />
          </mesh>
        ))}
      </group>
      {/* vaso com planta */}
      <group position={[-5.2, 0, 2.8]}>
        <mesh position={[0, 0.35, 0]}>
          <cylinderGeometry args={[0.35, 0.28, 0.7, 14]} />
          <meshStandardMaterial color="#E8E2D6" />
        </mesh>
        {[0, 1, 2, 3, 4].map((i) => (
          <mesh key={i} position={[Math.cos(i * 1.3) * 0.2, 1.0 + (i % 2) * 0.35, Math.sin(i * 1.3) * 0.2]}>
            <icosahedronGeometry args={[0.38, 0]} />
            <meshStandardMaterial color={i % 2 ? "#3D8A43" : "#4FA453"} flatShading />
          </mesh>
        ))}
      </group>
      {/* sofá */}
      <mesh position={[-1.5, 0.35, -3.2]} castShadow>
        <boxGeometry args={[2.4, 0.7, 0.9]} />
        <meshStandardMaterial color="#C9B8A0" roughness={0.9} />
      </mesh>
      {/* balcão da portaria */}
      {desk > 0.01 ? (
        <group position={[2.6, 0, -0.6]} scale={popS(cl(desk))}>
          <mesh position={[0, 0.55, 0]} castShadow>
            <boxGeometry args={[3.2, 1.1, 0.8]} />
            <meshStandardMaterial map={woodTexture("#7A5232")} roughness={0.5} emissive="#FFA930" emissiveIntensity={glowDesk} />
          </mesh>
          <mesh position={[0, 1.13, 0.05]}>
            <boxGeometry args={[3.3, 0.06, 0.95]} />
            <meshStandardMaterial color="#2B2E33" roughness={0.3} />
          </mesh>
          {/* monitores das câmeras */}
          {[-0.7, 0.1].map((x) => (
            <group key={x} position={[x, 1.42, -0.15]} rotation={[0, Math.PI, 0]}>
              <mesh>
                <boxGeometry args={[0.7, 0.45, 0.05]} />
                <meshStandardMaterial color="#1E2228" />
              </mesh>
              <mesh position={[0, 0, -0.03]}>
                <planeGeometry args={[0.62, 0.38]} />
                <meshStandardMaterial color="#5E8FB0" emissive="#7FB8E0" emissiveIntensity={0.8} side={THREE.DoubleSide} />
              </mesh>
            </group>
          ))}
        </group>
      ) : null}
      {/* interfone na parede lateral (perto da porta) */}
      {intercom > 0.01 ? (
        <group position={[-5.86, 1.45, 1.6]} rotation={[0, Math.PI / 2, 0]} scale={popS(cl(intercom))}>
          <mesh>
            <boxGeometry args={[0.42, 0.7, 0.08]} />
            <meshStandardMaterial color="#C9CDD1" metalness={0.6} roughness={0.3} emissive="#FFA930" emissiveIntensity={glowInter} />
          </mesh>
          <mesh position={[0, 0.2, 0.05]}>
            <boxGeometry args={[0.3, 0.16, 0.02]} />
            <meshStandardMaterial color="#1E2228" emissive="#59D0FF" emissiveIntensity={0.6 + buzz * Math.abs(Math.sin(t * 20))} />
          </mesh>
          {Array.from({ length: 12 }).map((_, i) => (
            <mesh key={i} position={[-0.1 + (i % 3) * 0.1, 0.0 - Math.floor(i / 3) * 0.08, 0.05]}>
              <boxGeometry args={[0.07, 0.05, 0.02]} />
              <meshStandardMaterial color="#5A646C" emissive="#FFD27A" emissiveIntensity={buzz > 0.5 && i === 7 ? 1.5 : 0} />
            </mesh>
          ))}
          <mesh position={[0, -0.28, 0.05]}>
            <circleGeometry args={[0.06, 12]} />
            <meshStandardMaterial color="#2B3138" />
          </mesh>
        </group>
      ) : null}
      {/* fachada de vidro (porta de entrada) */}
      <mesh position={[0, 1.6, 4.5]}>
        <planeGeometry args={[14, 3.2]} />
        <meshStandardMaterial color="#CFE6F2" transparent opacity={0.12} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
};
