// Cenário do vídeo "Como construir um prédio" (esse treco).
// Escala: 1 unidade = 1 m. Prédio 14,4×14,4 m, 30 andares de 3 m (90 m) + casa de máquinas/caixa d'água.
import { useThree } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { ease } from "../theme";
import { Glow, RBox } from "./basics";
import { C } from "../theme";
import { Tiao } from "./Tiao";
type TMood = "neutral" | "happy" | "cold" | "shock" | "sad" | "relaxed";
type TPose = "down" | "up" | "hug" | "wave" | "point";
import { brickTexture, Clouds, DistantTown, Flat, Forest, GrassTufts, rnd, World, WaterSurface, RainStreaks, woodTexture } from "./World";

type V3 = [number, number, number];
const cl = (x: number, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const pr = (t: number, a: number, b: number) => cl((t - a) / Math.max(1e-4, b - a));
const popE = (p: number) => {
  if (p <= 0) return 0;
  if (p >= 1) return 1;
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2);
};

// ======================================================================
// Utilitários
// ======================================================================
const _o = new THREE.Object3D();
export const mat = (p: V3, r: V3 = [0, 0, 0], s: V3 = [1, 1, 1]) => {
  _o.position.set(p[0], p[1], p[2]);
  _o.rotation.set(r[0], r[1], r[2]);
  _o.scale.set(s[0], s[1], s[2]);
  _o.updateMatrix();
  return _o.matrix.clone();
};

// Malha instanciada genérica (matrizes já prontas). Atualiza a cada quadro.
export const InstM: React.FC<{
  mats: THREE.Matrix4[];
  colors?: string[];
  geo: THREE.BufferGeometry;
  max?: number;
  cast?: boolean;
  receive?: boolean;
  children: React.ReactNode;
}> = ({ mats, colors, geo, max, cast = true, receive = true, children }) => {
  const ref = useRef<THREE.InstancedMesh>(null);
  const n = Math.max(1, max ?? mats.length);
  useLayoutEffect(() => {
    const im = ref.current;
    if (!im) return;
    const c = new THREE.Color();
    const k = Math.min(n, mats.length);
    for (let i = 0; i < k; i++) {
      im.setMatrixAt(i, mats[i]);
      if (colors) {
        c.set(colors[i] ?? "#ffffff");
        im.setColorAt(i, c);
      }
    }
    im.count = k;
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
  });
  return (
    <instancedMesh ref={ref} args={[geo, undefined, n]} castShadow={cast} receiveShadow={receive} frustumCulled={false}>
      {children}
    </instancedMesh>
  );
};

// O sol do Stage tem far=80 de sombra; aqui ampliamos para a escala do prédio.
export const ShadowFix: React.FC<{ size?: number; far?: number; map?: number }> = ({ size = 75, far = 420, map = 1536 }) => {
  const { scene } = useThree();
  useLayoutEffect(() => {
    scene.traverse((o) => {
      const l = o as THREE.DirectionalLight;
      if (l.isDirectionalLight && l.castShadow) {
        if (l.shadow.mapSize.x !== map) {
          l.shadow.mapSize.set(map, map);
          if (l.shadow.map) {
            l.shadow.map.dispose();
            (l.shadow as unknown as { map: null }).map = null;
          }
        }
        const c = l.shadow.camera;
        if (c.right !== size || c.far !== far) {
          c.left = -size;
          c.right = size;
          c.top = size;
          c.bottom = -size;
          c.near = 1;
          c.far = far;
          c.updateProjectionMatrix();
        }
      }
    });
  });
  return null;
};

// Céu que acompanha a câmera (evita o recorte do far=400 quando a câmera está longe da origem).
export const SkyFollow: React.FC<{ top: string; horizon: string; bottom?: string }> = ({ top, horizon, bottom }) => {
  const matl = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        depthTest: false,
        fog: false,
        uniforms: { top: { value: new THREE.Color(top) }, hor: { value: new THREE.Color(horizon) }, bot: { value: new THREE.Color(bottom ?? horizon) } },
        vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0);} `,
        fragmentShader: `uniform vec3 top; uniform vec3 hor; uniform vec3 bot; varying vec3 vP;
          void main(){ float h = vP.y; vec3 c = h>0.0 ? mix(hor, top, pow(clamp(h*1.6,0.0,1.0),0.7)) : mix(hor, bot, clamp(-h*4.0,0.0,1.0)); gl_FragColor = vec4(c,1.0); }`,
      }),
    [top, horizon, bottom],
  );
  const ref = useRef<THREE.Mesh>(null);
  const { scene } = useThree();
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    // esconde o SkyDome fixo do World (recortado pelo far quando a câmera se afasta da origem)
    scene.traverse((o) => {
      const mm = o as THREE.Mesh;
      if (mm !== m && mm.isMesh && mm.renderOrder === -10 && (mm.material as THREE.Material).type === "ShaderMaterial") mm.visible = false;
    });
    m.onBeforeRender = (_r, _s, cam) => {
      m.position.copy(cam.position);
      m.updateMatrixWorld();
    };
  });
  return (
    <mesh ref={ref} material={matl} renderOrder={-20} frustumCulled={false}>
      <sphereGeometry args={[300, 32, 16]} />
    </mesh>
  );
};

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
const speckle = (g: CanvasRenderingContext2D, w: number, h: number, base: string, n: number, amp: number, seed: number, size = 3) => {
  for (let i = 0; i < n; i++) {
    g.fillStyle = shade(base, (rnd(i, seed) - 0.5) * amp);
    const s = 1 + rnd(i, seed + 3) * size;
    g.fillRect(rnd(i, seed + 1) * w, rnd(i, seed + 2) * h, s, s);
  }
};

export const concreteTex = (base = "#C4C2BB", rep: [number, number] = [1, 1], lines = 2) =>
  mk(`conc${base}${lines}`, 256, 256, (g, w, h) => {
    g.fillStyle = base;
    g.fillRect(0, 0, w, h);
    speckle(g, w, h, base, 2600, 0.12, 31, 2);
    for (let i = 0; i < 14; i++) {
      const x = rnd(i, 41) * w, y = rnd(i, 42) * h, r = 20 + rnd(i, 43) * 50;
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, "rgba(90,85,75,0.10)");
      gr.addColorStop(1, "rgba(90,85,75,0)");
      g.fillStyle = gr;
      g.fillRect(0, 0, w, h);
    }
    g.fillStyle = "rgba(60,60,55,0.28)";
    for (let k = 1; k <= lines; k++) g.fillRect(0, (k / (lines + 1)) * h, w, 2);
    g.fillStyle = "rgba(50,50,48,0.45)";
    for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) g.fillRect(((i + 0.5) / 4) * w, ((j + 0.5) / 3) * h, 4, 4);
  }, rep);

export const houseTex = () =>
  mk("house", 512, 256, (g, w, h) => {
    g.fillStyle = "#F7F3EC";
    g.fillRect(0, 0, w, h);
    g.fillStyle = "rgba(0,0,0,0.045)";
    for (let y = 0; y < h; y += 12) g.fillRect(0, y, w, 1);
    g.fillStyle = "rgba(0,0,0,0.12)";
    g.fillRect(0, h - 22, w, 22);
    const win = (x0: number) => {
      const x = x0 * w, y = 0.24 * h, ww = 0.18 * w, hh = 0.42 * h;
      g.fillStyle = "#FFFFFF";
      g.fillRect(x - 8, y - 8, ww + 16, hh + 16);
      const gr = g.createLinearGradient(x, y, x + ww, y + hh);
      gr.addColorStop(0, "#5E8FB0");
      gr.addColorStop(0.5, "#9CCBE4");
      gr.addColorStop(1, "#4D7896");
      g.fillStyle = gr;
      g.fillRect(x, y, ww, hh);
      g.fillStyle = "#FFFFFF";
      g.fillRect(x + ww / 2 - 3, y, 6, hh);
      g.fillRect(x, y + hh * 0.4, ww, 5);
      g.fillStyle = "rgba(0,0,0,0.18)";
      g.fillRect(x - 12, y + hh + 8, ww + 24, 8);
    };
    win(0.13);
    win(0.69);
  });
const houseLitTex = () =>
  mk("houseLit", 512, 256, (g, w, h) => {
    g.fillStyle = "#000";
    g.fillRect(0, 0, w, h);
    [0.13, 0.69].forEach((x0, i) => {
      g.fillStyle = i ? "#FFC46A" : "#FFD99A";
      g.fillRect(x0 * w, 0.24 * h, 0.18 * w, 0.42 * h);
      g.fillStyle = "#000";
      g.fillRect(x0 * w + 0.09 * w - 3, 0.24 * h, 6, 0.42 * h);
    });
  });
export const roofTex = () =>
  mk("roof", 256, 256, (g, w, h) => {
    g.fillStyle = "#C9653C";
    g.fillRect(0, 0, w, h);
    const rows = 8, cols = 10;
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols + 1; c++) {
        const x = c * (w / cols) + (r % 2 ? w / cols / 2 : 0);
        const y = r * (h / rows);
        const col = shade("#CF6B40", (rnd(r * 13 + c, 7) - 0.5) * 0.08);
        const gr = g.createLinearGradient(0, y, 0, y + h / rows);
        gr.addColorStop(0, shade(col, 0.06));
        gr.addColorStop(1, shade(col, -0.1));
        g.fillStyle = gr;
        g.beginPath();
        g.roundRect(x + 1, y + 1, w / cols - 2, h / rows - 2, 6);
        g.fill();
      }
    g.fillStyle = "rgba(60,20,10,0.35)";
    for (let r = 1; r < rows; r++) g.fillRect(0, r * (h / rows) - 2, w, 3);
  });
export const glassTex = () =>
  mk("glass", 256, 160, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, w, h);
    gr.addColorStop(0, "#6C9DBE");
    gr.addColorStop(0.45, "#B9DDF0");
    gr.addColorStop(0.55, "#8DB9D6");
    gr.addColorStop(1, "#4F7C9E");
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
    g.fillStyle = "rgba(255,255,255,0.18)";
    g.beginPath();
    g.moveTo(w * 0.2, 0);
    g.lineTo(w * 0.42, 0);
    g.lineTo(w * 0.12, h);
    g.lineTo(0, h);
    g.fill();
    g.fillStyle = "#3B4652";
    g.fillRect(0, 0, w, 6);
    g.fillRect(0, h - 6, w, 6);
    g.fillRect(0, 0, 6, h);
    g.fillRect(w - 6, 0, 6, h);
    g.fillRect(w / 3 - 2, 0, 4, h);
    g.fillRect((2 * w) / 3 - 2, 0, 4, h);
    g.fillRect(0, h * 0.78, w, 4);
  });
export const glassLitTex = () =>
  mk("glassLit", 256, 160, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, "#FFE3A8");
    gr.addColorStop(1, "#F2A95A");
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
    g.fillStyle = "rgba(120,60,20,0.35)";
    g.fillRect(w * 0.05, h * 0.55, w * 0.25, h * 0.35);
    g.fillRect(w * 0.6, h * 0.45, w * 0.1, h * 0.5);
    g.fillStyle = "rgba(255,255,255,0.35)";
    g.fillRect(w * 0.42, h * 0.08, w * 0.16, h * 0.08);
    g.fillStyle = "#3B4652";
    g.fillRect(0, 0, w, 6);
    g.fillRect(0, h - 6, w, 6);
    g.fillRect(0, 0, 6, h);
    g.fillRect(w - 6, 0, 6, h);
    g.fillRect(w / 3 - 2, 0, 4, h);
    g.fillRect((2 * w) / 3 - 2, 0, 4, h);
    g.fillRect(0, h * 0.78, w, 4);
  });
export const asphaltTex = (rep: [number, number]) =>
  mk("asphalt", 256, 64, (g, w, h) => {
    g.fillStyle = "#4E5258";
    g.fillRect(0, 0, w, h);
    speckle(g, w, h, "#4E5258", 900, 0.1, 51, 2);
    g.fillStyle = "#F2F2EE";
    g.fillRect(0, h / 2 - 1.5, w * 0.5, 3);
    g.fillStyle = "rgba(255,255,255,0.75)";
    g.fillRect(0, 2, w, 2);
    g.fillRect(0, h - 4, w, 2);
  }, rep);
export const paverTex = (rep: [number, number]) =>
  mk("paver", 128, 128, (g, w, h) => {
    g.fillStyle = "#A9A69E";
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 4; i++)
      for (let j = 0; j < 4; j++) {
        g.fillStyle = shade("#D3CFC5", (rnd(i * 7 + j, 3) - 0.5) * 0.06);
        g.fillRect(i * 32 + 1.5, j * 32 + 1.5, 29, 29);
      }
  }, rep);
export const grassTex = (rep: [number, number]) =>
  mk("grass", 256, 256, (g, w, h) => {
    g.fillStyle = "#73B451";
    g.fillRect(0, 0, w, h);
    speckle(g, w, h, "#73B451", 3000, 0.12, 61, 3);
  }, rep);
export const dirtTex = (rep: [number, number]) =>
  mk("dirt", 256, 256, (g, w, h) => {
    g.fillStyle = "#9C7350";
    g.fillRect(0, 0, w, h);
    speckle(g, w, h, "#9C7350", 3500, 0.14, 71, 3);
    for (let i = 0; i < 30; i++) {
      g.fillStyle = "rgba(80,55,35,0.25)";
      g.fillRect(rnd(i, 72) * w, rnd(i, 73) * h, 30, 3);
    }
  }, rep);
export const clayTex = (rep: [number, number]) =>
  mk("clay", 256, 256, (g, w, h) => {
    g.fillStyle = "#B57B4C";
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 40; i++) {
      const x = rnd(i, 81) * w, y = rnd(i, 82) * h, r = 10 + rnd(i, 83) * 40;
      g.fillStyle = rnd(i, 84) > 0.5 ? "rgba(140,85,45,0.35)" : "rgba(205,150,100,0.3)";
      g.beginPath();
      g.ellipse(x, y, r * 1.6, r * 0.6, 0, 0, Math.PI * 2);
      g.fill();
    }
    speckle(g, w, h, "#B57B4C", 2200, 0.16, 85, 2);
    for (let i = 0; i < 40; i++) {
      g.fillStyle = shade("#8E8678", (rnd(i, 86) - 0.5) * 0.2);
      g.beginPath();
      g.ellipse(rnd(i, 87) * w, rnd(i, 88) * h, 3 + rnd(i, 89) * 4, 2 + rnd(i, 90) * 3, 0, 0, Math.PI * 2);
      g.fill();
    }
  }, rep);
export const topsoilTex = (rep: [number, number]) =>
  mk("topsoil", 256, 128, (g, w, h) => {
    g.fillStyle = "#6E4A30";
    g.fillRect(0, 0, w, h);
    speckle(g, w, h, "#6E4A30", 2000, 0.14, 91, 3);
    g.strokeStyle = "rgba(240,220,190,0.25)";
    for (let i = 0; i < 14; i++) {
      g.beginPath();
      const x = rnd(i, 92) * w;
      g.moveTo(x, 0);
      g.lineTo(x + 6, 20 + rnd(i, 93) * 40);
      g.stroke();
    }
  }, rep);
export const rockTex = (rep: [number, number]) =>
  mk("rock", 256, 256, (g, w, h) => {
    g.fillStyle = "#7D7A74";
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 70; i++) {
      const x = rnd(i, 101) * w, y = rnd(i, 102) * h, r = 8 + rnd(i, 103) * 24;
      g.fillStyle = shade("#A29D93", (rnd(i, 104) - 0.5) * 0.18);
      g.strokeStyle = "rgba(40,38,35,0.55)";
      g.lineWidth = 2;
      g.beginPath();
      for (let k = 0; k < 7; k++) {
        const a = (k / 7) * Math.PI * 2;
        const rr = r * (0.75 + rnd(i * 7 + k, 105) * 0.4);
        if (k === 0) g.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.7);
        else g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.7);
      }
      g.closePath();
      g.fill();
      g.stroke();
    }
  }, rep);
export const numberTex = (n: number) =>
  mk(`num${n}`, 128, 128, (g, w, h) => {
    g.fillStyle = "#E9E4D8";
    g.fillRect(0, 0, w, h);
    g.fillStyle = "#E8A21E";
    g.fillRect(6, 6, w - 12, h - 12);
    g.fillStyle = "#1E2228";
    g.font = "bold 78px 'Baloo 2', Arial, sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(String(n), w / 2, h / 2 + 6);
  });
export const sectionTex = (rep: [number, number]) =>
  mk("section", 128, 128, (g, w, h) => {
    g.fillStyle = "#5E646C";
    g.fillRect(0, 0, w, h);
    g.fillStyle = "#3E434A";
    g.fillRect(0, 0, w, h * 0.12);
    g.fillStyle = "#C9C5BB";
    g.fillRect(0, h * 0.86, w, h * 0.14);
    g.fillStyle = "rgba(255,226,170,0.35)";
    g.fillRect(w * 0.1, h * 0.25, w * 0.35, h * 0.45);
    g.fillRect(w * 0.6, h * 0.25, w * 0.3, h * 0.45);
  }, rep);
export const stairWallTex = (rep: [number, number]) =>
  mk("stairwall", 64, 256, (g, w, h) => {
    g.fillStyle = "#EEEAE0";
    g.fillRect(0, 0, w, h);
    g.fillStyle = "#6E9C86";
    g.fillRect(0, h * 0.62, w, h * 0.38);
    g.fillStyle = "#3D5E50";
    g.fillRect(0, h * 0.62, w, 5);
    speckle(g, w, h, "#E2DED2", 300, 0.05, 111, 2);
  }, rep);

// ======================================================================
// Casinha (instanciada): corpo com janelas, empena, telhado de telha, chaminé, porta
// ======================================================================
export const HOUSE = { w: 6, h: 2.7, d: 5, roofH: 1.6, stack: 4.32 };
const useHouseGeos = () =>
  useMemo(() => {
    const body = new THREE.BoxGeometry(HOUSE.w, HOUSE.h, HOUSE.d);
    body.translate(0, HOUSE.h / 2, 0);
    const s = new THREE.Shape();
    s.moveTo(-HOUSE.w / 2 - 0.2, 0);
    s.lineTo(0, HOUSE.roofH);
    s.lineTo(HOUSE.w / 2 + 0.2, 0);
    s.closePath();
    const gable = new THREE.ExtrudeGeometry(s, { depth: HOUSE.d, bevelEnabled: false });
    gable.translate(0, 0, -HOUSE.d / 2);
    const slope = Math.hypot(HOUSE.w / 2 + 0.45, HOUSE.roofH);
    const roof = new THREE.BoxGeometry(slope, 0.16, HOUSE.d + 0.7);
    const chim = new THREE.BoxGeometry(0.6, 1.5, 0.6);
    const door = new THREE.BoxGeometry(0.95, 1.95, 0.08);
    return { body, gable, roof, chim, door, slope, ang: Math.atan2(HOUSE.roofH, HOUSE.w / 2 + 0.2) };
  }, []);

export type HouseItem = { m: THREE.Matrix4; wall: string; roof: string; storeys?: number; noRoof?: boolean };
export const Houses: React.FC<{ items: HouseItem[]; night?: number; cast?: boolean; crack?: number }> = ({ items, night = 0, cast = true }) => {
  const G = useHouseGeos();
  const parts = useMemo(() => {
    const body: THREE.Matrix4[] = [], bodyC: string[] = [], gable: THREE.Matrix4[] = [], gableC: string[] = [];
    const roof: THREE.Matrix4[] = [], roofC: string[] = [], chim: THREE.Matrix4[] = [], door: THREE.Matrix4[] = [];
    const tmp = new THREE.Matrix4();
    for (const it of items) {
      const st = it.storeys ?? 1;
      for (let j = 0; j < st; j++) {
        body.push(tmp.multiplyMatrices(it.m, mat([0, j * HOUSE.h, 0])).clone());
        bodyC.push(it.wall);
      }
      door.push(tmp.multiplyMatrices(it.m, mat([-0.35, 0.97, HOUSE.d / 2 + 0.02])).clone());
      if (it.noRoof) continue;
      const y = st * HOUSE.h;
      gable.push(tmp.multiplyMatrices(it.m, mat([0, y, 0])).clone());
      gableC.push(it.wall);
      for (const k of [-1, 1]) {
        roof.push(tmp.multiplyMatrices(it.m, mat([(k * (HOUSE.w / 2 + 0.2)) / 2, y + HOUSE.roofH / 2 + 0.1, 0], [0, 0, -k * G.ang])).clone());
        roofC.push(it.roof);
      }
      chim.push(tmp.multiplyMatrices(it.m, mat([1.7, y + 1.0, -1.1])).clone());
    }
    return { body, bodyC, gable, gableC, roof, roofC, chim, door };
  }, [items]);
  return (
    <group>
      <InstM mats={parts.body} colors={parts.bodyC} geo={G.body} cast={cast}>
        <meshStandardMaterial map={houseTex()} emissiveMap={houseLitTex()} emissive="#FFD9A0" emissiveIntensity={night * 1.1} roughness={0.85} />
      </InstM>
      <InstM mats={parts.gable} colors={parts.gableC} geo={G.gable} cast={cast}>
        <meshStandardMaterial roughness={0.9} />
      </InstM>
      <InstM mats={parts.roof} colors={parts.roofC} geo={G.roof} cast={cast}>
        <meshStandardMaterial map={roofTex()} roughness={0.7} />
      </InstM>
      <InstM mats={parts.chim} geo={G.chim} cast={cast}>
        <meshStandardMaterial color="#9A5A44" roughness={0.9} />
      </InstM>
      <InstM mats={parts.door} geo={G.door} cast={false}>
        <meshStandardMaterial color="#7A4B2A" roughness={0.7} />
      </InstM>
    </group>
  );
};

// ======================================================================
// Bairro: ruas, calçadas, quadras com casinhas, árvores, postes e carros
// ======================================================================
export const ROADS = [-154, -110, -66, -22, 22, 66, 110, 154];
const BLOCKS = [-132, -88, -44, 0, 44, 88, 132];
export const CITY_FLAT: Flat = { x0: -170, x1: 170, z0: -170, z1: 170, margin: 45 };
const WALLS = ["#F6E7D2", "#F3D9C8", "#E6EEF2", "#F4EFC9", "#DDEBD6", "#F2DDE2", "#F8F4EC", "#E9DCCB"];
const ROOFS = ["#FFFFFF", "#F0D0C0", "#D9D2CC", "#FFE0C8", "#B9B3B0"];

export const unitBox = new THREE.BoxGeometry(1, 1, 1);

export const Bairro: React.FC<{ t: number; night?: number; zMax?: number; plot?: "dirt" | "plaza"; cars?: boolean; tufts?: boolean }> = ({
  t,
  night = 0,
  zMax = 999,
  plot = "dirt",
  cars = true,
  tufts = true,
}) => {
  const S = useMemo(() => {
    // quadras
    const side: THREE.Matrix4[] = [], grass: THREE.Matrix4[] = [];
    const houses: HouseItem[] = [];
    const trees: { x: number; z: number; s: number; k: number; r: number }[] = [];
    const clipZ = (z0: number, z1: number) => [z0, Math.min(z1, zMax)] as const;
    BLOCKS.forEach((bx, i) =>
      BLOCKS.forEach((bz, j) => {
        const [z0, z1] = clipZ(bz - 18, bz + 18);
        if (z1 <= z0) return;
        side.push(mat([bx, 0.09, (z0 + z1) / 2], [0, 0, 0], [36, 0.18, z1 - z0]));
        const isPlot = bx === 0 && bz === 0;
        const [g0, g1] = clipZ(bz - 15, bz + 15);
        if (!isPlot && g1 > g0) grass.push(mat([bx, 0.2, (g0 + g1) / 2], [0, 0, 0], [30, 0.12, g1 - g0]));
        if (isPlot) return;
        const park = rnd(i * 7 + j, 3) < 0.12 && Math.abs(bx) + Math.abs(bz) > 50;
        if (park) {
          for (let k = 0; k < 9; k++) trees.push({ x: bx + (rnd(k + i * 9, j) - 0.5) * 24, z: bz + (rnd(k + j * 9, i + 3) - 0.5) * 24, s: 1 + rnd(k, i + j) * 0.6, k: rnd(k, 5) * 0.9, r: rnd(k, 6) * 6 });
          return;
        }
        const lots: { x: number; z: number; r: number }[] = [];
        [-11.25, -3.75, 3.75, 11.25].forEach((o) => {
          lots.push({ x: bx + o, z: bz + 12, r: 0 });
          lots.push({ x: bx + o, z: bz - 12, r: Math.PI });
        });
        [-3.75, 3.75].forEach((o) => {
          lots.push({ x: bx + 12, z: bz + o, r: Math.PI / 2 });
          lots.push({ x: bx - 12, z: bz + o, r: -Math.PI / 2 });
        });
        lots.forEach((l, k) => {
          const seed = i * 131 + j * 17 + k;
          if (rnd(seed, 11) < 0.1) return;
          if (l.z + 4 > zMax) return;
          const s = 0.92 + rnd(seed, 12) * 0.18;
          const st = rnd(seed, 13) < 0.22 ? 2 : 1;
          houses.push({ m: mat([l.x, 0.26, l.z], [0, l.r + (rnd(seed, 14) - 0.5) * 0.06, 0], [s, s, s]), wall: WALLS[Math.floor(rnd(seed, 15) * WALLS.length)], roof: ROOFS[Math.floor(rnd(seed, 16) * ROOFS.length)], storeys: st });
        });
        for (let k = 0; k < 3; k++) {
          const x = bx + (rnd(k + i * 5, j + 20) - 0.5) * 10, z = bz + (rnd(k + j * 5, i + 21) - 0.5) * 10;
          if (z + 3 < zMax) trees.push({ x, z, s: 0.9 + rnd(k, i + 22) * 0.5, k: rnd(k, j + 23) * 0.9, r: rnd(k, 24) * 6 });
        }
      }),
    );
    // árvores e postes de calçada
    const poles: THREE.Matrix4[] = [], heads: THREE.Matrix4[] = [], arms: THREE.Matrix4[] = [];
    ROADS.forEach((L, li) => {
      if (Math.abs(L) > 120) return;
      for (let s = -126; s <= 126; s += 11) {
        if (ROADS.some((R) => Math.abs(s - R) < 7)) continue;
        for (const side2 of [-1, 1]) {
          const seed = li * 300 + s + side2 * 7;
          if (rnd(seed, 30) < 0.25) continue;
          const zz = L + side2 * 5.6;
          if (zz + 2 < zMax) trees.push({ x: s, z: zz, s: 0.7 + rnd(seed, 31) * 0.25, k: rnd(seed, 32) * 0.6, r: rnd(seed, 33) * 6 });
          if (s + 2 < zMax) trees.push({ x: L + side2 * 5.6, z: s + 5, s: 0.7 + rnd(seed, 34) * 0.25, k: rnd(seed, 35) * 0.6, r: rnd(seed, 36) * 6 });
        }
      }
      for (let s = -121; s <= 121; s += 22) {
        if (ROADS.some((R) => Math.abs(s - R) < 6)) continue;
        for (const side2 of [-1, 1]) {
          const z = L + side2 * 4.6;
          if (z < zMax) {
            poles.push(mat([s, 3.6, z], [0, 0, 0], [0.16, 7.2, 0.16]));
            arms.push(mat([s, 7.1, z - side2 * 0.8], [0, 0, 0], [0.1, 0.1, 1.6]));
            heads.push(mat([s, 7.0, z - side2 * 1.5], [0, 0, 0], [0.5, 0.18, 0.7]));
          }
          const x = L + side2 * 4.6;
          if (s + 0.5 < zMax) {
            poles.push(mat([x, 3.6, s], [0, 0, 0], [0.16, 7.2, 0.16]));
            arms.push(mat([x - side2 * 0.8, 7.1, s], [0, 0, 0], [1.6, 0.1, 0.1]));
            heads.push(mat([x - side2 * 1.5, 7.0, s], [0, 0, 0], [0.7, 0.18, 0.5]));
          }
        }
      }
    });
    const near = (x: number, z: number) => Math.abs(x) < 70 && Math.abs(z) < 70;
    const housesN = houses.filter((h) => near(h.m.elements[12], h.m.elements[14]));
    const housesF = houses.filter((h) => !near(h.m.elements[12], h.m.elements[14]));
    const treesN = trees.filter((tr) => near(tr.x, tr.z));
    const treesF = trees.filter((tr) => !near(tr.x, tr.z));
    return { side, grass, housesN, housesF, treesN, treesF, poles, heads, arms };
  }, [zMax]);
  const farRef = useRef<THREE.Group>(null);
  useLayoutEffect(() => {
    farRef.current?.traverse((o) => {
      o.castShadow = false;
    });
  });

  // carros
  const C = useMemo(() => {
    const out: { axis: 0 | 1; L: number; off: number; dir: number; s0: number; v: number; col: string }[] = [];
    const cols = ["#E8483B", "#F2F2F0", "#2E6FD8", "#2C2F36", "#F2C230", "#8FA3B5", "#3DAA66", "#C9CDD2"];
    ROADS.forEach((L, li) => {
      if (Math.abs(L) > 110) return;
      for (const axis of [0, 1] as const)
        for (const dir of [-1, 1]) {
          for (let k = 0; k < 4; k++) {
            const seed = li * 50 + axis * 20 + (dir + 1) * 5 + k;
            out.push({ axis, L, off: dir * 2.1, dir, s0: rnd(seed, 40) * 352, v: 7 + rnd(seed, 41) * 6, col: cols[Math.floor(rnd(seed, 42) * cols.length)] });
          }
        }
    });
    return out;
  }, []);
  const carMats = useMemo(() => {
    const body: THREE.Matrix4[] = [], cabin: THREE.Matrix4[] = [], wheel: THREE.Matrix4[] = [], light: THREE.Matrix4[] = [], bodyC: string[] = [];
    const tmp = new THREE.Matrix4();
    if (!cars) return { body, cabin, wheel, light, bodyC };
    C.forEach((c) => {
      const s = ((((c.s0 + c.dir * c.v * t) % 352) + 352) % 352) - 176;
      const x = c.axis === 0 ? s : c.L + c.off;
      const z = c.axis === 0 ? c.L - c.off : s;
      if (z > zMax - 1) return;
      const ry = c.axis === 0 ? (c.dir > 0 ? 0 : Math.PI) : c.dir > 0 ? -Math.PI / 2 : Math.PI / 2;
      const base = mat([x, 0.03, z], [0, ry, 0]);
      body.push(tmp.multiplyMatrices(base, mat([0, 0.62, 0], [0, 0, 0], [4.2, 0.75, 1.85])).clone());
      bodyC.push(c.col);
      cabin.push(tmp.multiplyMatrices(base, mat([-0.25, 1.28, 0], [0, 0, 0], [2.3, 0.65, 1.65])).clone());
      for (const wx of [-1.35, 1.35]) for (const wz of [-0.85, 0.85]) wheel.push(tmp.multiplyMatrices(base, mat([wx, 0.36, wz], [Math.PI / 2, 0, 0], [0.72, 0.28, 0.72])).clone());
      for (const wz of [-0.6, 0.6]) light.push(tmp.multiplyMatrices(base, mat([2.11, 0.7, wz], [0, 0, 0], [0.05, 0.2, 0.4])).clone());
    });
    return { body, cabin, wheel, light, bodyC };
  }, [t, C, cars, zMax]);
  const wheelGeo = useMemo(() => new THREE.CylinderGeometry(0.5, 0.5, 1, 10), []);
  const roadLen = 352;
  const zEnd = Math.min(176, zMax);
  const tuftAvoid = useMemo(() => {
    const a: Flat[] = [];
    ROADS.forEach((L) => {
      a.push({ x0: -200, x1: 200, z0: L - 7.5, z1: L + 7.5 });
      a.push({ x0: L - 7.5, x1: L + 7.5, z0: -200, z1: 200 });
    });
    a.push({ x0: -19, x1: 19, z0: -19, z1: 19 });
    return a;
  }, []);
  return (
    <group>
      {/* ruas */}
      {ROADS.map((L) =>
        L + 4 < zMax ? (
          <mesh key={`x${L}`} position={[0, 0.03, L]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <planeGeometry args={[roadLen, 8]} />
            <meshStandardMaterial map={asphaltTex([44, 1])} roughness={0.92} />
          </mesh>
        ) : null,
      )}
      {ROADS.map((L) => (
        <mesh key={`z${L}`} position={[L, 0.036, (-176 + zEnd) / 2]} rotation={[-Math.PI / 2, 0, Math.PI / 2]} receiveShadow>
          <planeGeometry args={[zEnd + 176, 8]} />
          <meshStandardMaterial map={asphaltTex([(zEnd + 176) / 8, 1])} roughness={0.92} />
        </mesh>
      ))}
      <InstM mats={S.side} geo={unitBox} cast={false}>
        <meshStandardMaterial map={paverTex([18, 18])} roughness={0.95} />
      </InstM>
      <InstM mats={S.grass} geo={unitBox} cast={false}>
        <meshStandardMaterial map={grassTex([5, 5])} roughness={1} />
      </InstM>
      {/* terreno da obra / praça */}
      <mesh position={[0, 0.2, Math.min(0, (zMax - 15) / 2)]} receiveShadow>
        <boxGeometry args={[30, 0.12, Math.min(30, zMax + 15)]} />
        <meshStandardMaterial map={plot === "dirt" ? dirtTex([4, 4]) : grassTex([4, 4])} roughness={1} />
      </mesh>
      <Houses items={S.housesN} night={night} />
      <Forest spots={S.treesN} flat={CITY_FLAT} hills={14} scale={0.95} />
      <group ref={farRef}>
        <Houses items={S.housesF} night={night} cast={false} />
        <Forest spots={S.treesF} flat={CITY_FLAT} hills={14} scale={0.95} />
      </group>
      <InstM mats={S.poles} geo={unitBox} cast={false}>
        <meshStandardMaterial color="#5E646C" roughness={0.6} metalness={0.3} />
      </InstM>
      <InstM mats={S.arms} geo={unitBox} cast={false}>
        <meshStandardMaterial color="#5E646C" roughness={0.6} metalness={0.3} />
      </InstM>
      <InstM mats={S.heads} geo={unitBox} cast={false}>
        <meshStandardMaterial color="#DDE3E8" emissive="#FFD48A" emissiveIntensity={night * 2.2} />
      </InstM>
      {cars ? (
        <group>
          <InstM mats={carMats.body} colors={carMats.bodyC} geo={unitBox} max={140}>
            <meshStandardMaterial roughness={0.35} metalness={0.25} />
          </InstM>
          <InstM mats={carMats.cabin} geo={unitBox} max={140}>
            <meshStandardMaterial color="#2C3B4A" roughness={0.2} metalness={0.4} />
          </InstM>
          <InstM mats={carMats.wheel} geo={wheelGeo} max={560} cast={false}>
            <meshStandardMaterial color="#1F2124" roughness={0.8} />
          </InstM>
          <InstM mats={carMats.light} geo={unitBox} max={280} cast={false}>
            <meshStandardMaterial color="#FFF6D8" emissive="#FFF2C0" emissiveIntensity={0.3 + night * 3} />
          </InstM>
        </group>
      ) : null}
      {tufts ? <GrassTufts area={{ x0: -80, x1: 80, z0: -80, z1: Math.min(80, zMax) }} n={1800} avoid={tuftAvoid} flat={CITY_FLAT} hills={14} y={0.26} /> : null}
    </group>
  );
};

// Mundo completo da cidade (céu, colinas, floresta, prédios ao fundo, nuvens) + bairro.
export type Mood = "day" | "storm" | "sunset";
const MOODS: Record<Mood, { fog: [string, number, number]; top: string; hor: string; night: number }> = {
  day: { fog: ["#D6EBF5", 150, 400], top: "#4C9FE0", hor: "#D6EBF5", night: 0 },
  storm: { fog: ["#3C4550", 90, 360], top: "#1D232C", hor: "#46505C", night: 1 },
  sunset: { fog: ["#F0B68E", 150, 400], top: "#4E62A6", hor: "#F6B98C", night: 0.85 },
};
export const CityWorld: React.FC<{ t: number; mood?: Mood; zMax?: number; ground?: boolean; plot?: "dirt" | "plaza"; nightOverride?: number }> = ({
  t,
  mood = "day",
  zMax,
  ground = true,
  plot = "dirt",
  nightOverride,
}) => {
  const M = MOODS[mood];
  const night = nightOverride ?? M.night;
  return (
    <group>
      <SkyFollow top={M.top} horizon={M.hor} />
      <World t={t} flat={CITY_FLAT} hills={ground ? 14 : 0} trees={460} fog={M.fog} sky={{ top: M.top, horizon: M.hor }} clouds={false} ground={ground} />
      <DistantTown center={[40, -275]} n={70} spread={130} tall={0.55} seed={21} flat={CITY_FLAT} hills={ground ? 14 : 0} />
      <DistantTown center={[-60, 270]} n={50} spread={120} tall={0.45} seed={33} flat={CITY_FLAT} hills={ground ? 14 : 0} />
      {mood === "day" ? <Clouds t={t} n={14} height={135} spread={170} center={[0, -70]} /> : mood === "sunset" ? <SunsetClouds t={t} /> : <StormClouds t={t} />}
      <Bairro t={t} night={night} zMax={zMax} plot={plot} />
    </group>
  );
};

const SunsetClouds: React.FC<{ t: number }> = ({ t }) => (
  <group>
    {Array.from({ length: 30 }).map((_, i) => {
      const x = (rnd(i, 11) - 0.5) * 420 + t * 0.8;
      const z = (rnd(i, 12) - 0.5) * 420;
      const y = 105 + rnd(i, 13) * 45;
      const s = 6 + rnd(i, 14) * 8;
      return (
        <group key={i} position={[x, y, z]} scale={s}>
          {[
            [0, 0, 0, 1],
            [1.1, -0.15, 0.1, 0.78],
            [-1.05, -0.2, 0, 0.72],
            [0.45, 0.5, 0, 0.7],
          ].map(([cx, cy, cz, r], k) => (
            <mesh key={k} position={[cx, cy, cz]}>
              <icosahedronGeometry args={[r, 1]} />
              <meshStandardMaterial color="#F7C6A8" emissive="#E89A7A" emissiveIntensity={0.45} roughness={1} flatShading />
            </mesh>
          ))}
        </group>
      );
    })}
  </group>
);
const StormClouds: React.FC<{ t: number }> = ({ t }) => (
  <group>
    {Array.from({ length: 26 }).map((_, i) => {
      const x = (rnd(i, 501) - 0.5) * 460 + t * 1.5;
      const z = (rnd(i, 502) - 0.5) * 460;
      const y = 150 + rnd(i, 503) * 30;
      const s = 16 + rnd(i, 504) * 14;
      return (
        <mesh key={i} position={[x, y, z]} scale={[s * 1.8, s * 0.6, s * 1.4]}>
          <icosahedronGeometry args={[1, 1]} />
          <meshStandardMaterial color="#3A414B" roughness={1} flatShading />
        </mesh>
      );
    })}
  </group>
);

// ======================================================================
// Gancho: torre de casinhas que caem do céu, racham e desmoronam
// ======================================================================
const NH = 30;
export const houseLand = (i: number) => 0.08 + 3.45 * Math.pow(i / (NH - 1), 0.78);
export const HouseTower: React.FC<{ t: number; crush: number; tilt: number; collapse: number; tc: number; crack: number; landK?: number; brick?: boolean; slow?: number }> = ({ t, crush, tilt, collapse, tc, crack, landK = 1, brick = false, slow = 1 }) => {
  const items = useMemo(() => [] as HouseItem[], []);
  items.length = 0;
  const brickMats: THREE.Matrix4[] = [];
  const sway = Math.sin(t * 1.4) * 0.6 + Math.sin(t * 2.3) * 0.25;
  let y = 0.26;
  for (let i = 0; i < NH; i++) {
    const tl = houseLand(i) * landK;
    if (t < tl - 0.45) break;
    const fall = cl((t - (tl - 0.45)) / 0.45);
    const dropY = (1 - fall * fall) * 40;
    const bounce = t > tl ? Math.exp(-(t - tl) * 9) * Math.sin((t - tl) * 26) * 0.12 : 0;
    const squash = 1 - bounce;
    const sc = i === 0 || i === 1 ? 1 - crush * (i === 0 ? 0.42 : 0.18) : 1;
    const hgt = HOUSE.stack * sc;
    const off = (rnd(i, 7) - 0.5) * 0.7 + sway * Math.pow(i / NH, 2) * 3;
    const yaw = (rnd(i, 8) - 0.5) * 0.5;
    // inclinação rígida em torno da base (x) + separação na queda
    const ang = tilt;
    let px = off + Math.sin(ang) * (y + hgt / 2);
    let py = Math.cos(ang) * y + dropY;
    let rz = -ang;
    let rx = 0;
    if (collapse > 0) {
      const delay = (1 - i / NH) * 0.35;
      const dt = Math.max(0, t - tc - delay);
      const g = 0.5 * 120 * slow * dt * dt;
      const land = 1.2 + rnd(i, 9) * 2.6 + (i % 4) * 0.8;
      const vx = 3 + i * 0.75 + rnd(i, 10) * 5;
      px += vx * dt * 0.7 + (rnd(i, 14) - 0.5) * 8 * dt;
      py = Math.max(land, py - g);
      const done = py <= land + 0.01 ? 1 : 0;
      rz -= (1.2 + rnd(i, 11) * 2.5) * Math.min(dt, 1.2) * (done ? 0.6 : 1);
      rx += (rnd(i, 12) - 0.5) * 2.4 * Math.min(dt, 1.2);
    }
    const mm = mat([px, py, (rnd(i, 13) - 0.5) * 0.6], [rx, yaw, rz], [1, sc * squash, 1]);
    items.push({ m: mm, wall: WALLS[(i * 3) % WALLS.length], roof: ROOFS[i % ROOFS.length] });
    if (brick && i < 3) brickMats.push(mm);
    y += hgt;
  }
  return (
    <group>
      <Houses items={[...items]} />
      {brick ? <BrickSkin mats={brickMats} /> : null}
      {crack > 0 ? <HouseCracks p={crack} crush={crush} /> : null}
    </group>
  );
};

// Casca de tijolo à vista nas casas de baixo (para o close da parede rachando).
const BrickSkin: React.FC<{ mats: THREE.Matrix4[] }> = ({ mats }) => {
  const geo = useMemo(() => {
    const g = new THREE.BoxGeometry(HOUSE.w + 0.02, HOUSE.h - 0.02, HOUSE.d + 0.015);
    g.translate(0, HOUSE.h / 2, 0);
    return g;
  }, []);
  const tex = useMemo(() => {
    const t0 = brickTexture("#B8613E", "#E2D3BD", 16, 8).clone();
    t0.repeat.set(2.2, 1.4);
    t0.needsUpdate = true;
    return t0;
  }, []);
  return (
    <InstM mats={mats} geo={geo} max={3}>
      <meshStandardMaterial map={tex} roughness={0.9} />
    </InstM>
  );
};

// Rachaduras em zigue-zague na casa da base (frente e lateral).
const HouseCracks: React.FC<{ p: number; crush: number }> = ({ p, crush }) => {
  const paths: [number, number][][] = [
    [[-1.0, 2.6], [-0.7, 2.1], [-1.05, 1.7], [-0.6, 1.2], [-0.9, 0.7], [-0.55, 0.25]],
    [[1.6, 2.6], [1.3, 2.2], [1.7, 1.8], [1.35, 1.3], [1.6, 0.9]],
    [[-2.9, 2.0], [-2.4, 1.75], [-2.7, 1.4], [-2.2, 1.0]],
    [[2.95, 2.4], [2.5, 1.9], [2.85, 1.5], [2.4, 1.1], [2.7, 0.6]],
  ];
  const sy = 1 - crush * 0.42;
  return (
    <group position={[0, 0.26, HOUSE.d / 2 + 0.03]} scale={[1, sy, 1]}>
      {paths.map((pts, k) => {
        const segs = pts.length - 1;
        const shown = p * segs * (0.8 + k * 0.08);
        return pts.slice(0, -1).map((a, i) => {
          const b = pts[i + 1];
          const f = cl(shown - i);
          if (f <= 0) return null;
          const ex = a[0] + (b[0] - a[0]) * f, ey = a[1] + (b[1] - a[1]) * f;
          const len = Math.hypot(ex - a[0], ey - a[1]);
          return (
            <mesh key={`${k}-${i}`} position={[(a[0] + ex) / 2, (a[1] + ey) / 2, 0]} rotation={[0, 0, Math.atan2(ey - a[1], ex - a[0])]}>
              <boxGeometry args={[len + 0.06, 0.07 + p * 0.06, 0.03]} />
              <meshBasicMaterial color="#2B1A14" />
            </mesh>
          );
        });
      })}
    </group>
  );
};

// Seta 3D grossa (peso, vento).
export const Arrow3D: React.FC<{ position: V3; dir?: V3; len?: number; color?: string; scale?: number; opacity?: number }> = ({ position, dir = [0, -1, 0], len = 6, color = "#FF6A2B", scale = 1, opacity = 1 }) => {
  const q = useMemo(() => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(...dir).normalize()), [dir.join()]);
  if (scale <= 0.001 || opacity <= 0.01) return null;
  return (
    <group position={position} quaternion={q} scale={scale}>
      <mesh position={[0, -len / 2 + 0.2, 0]}>
        <cylinderGeometry args={[0.55, 0.55, len - 1.8, 12]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.35} transparent={opacity < 1} opacity={opacity} />
      </mesh>
      <mesh position={[0, len / 2 - 0.6, 0]}>
        <coneGeometry args={[1.3, 2.2, 14]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.35} transparent={opacity < 1} opacity={opacity} />
      </mesh>
    </group>
  );
};

// Nuvem de poeira (bolhas que crescem e sobem).
export const Dust: React.FC<{ t: number; t0: number; origin: V3; n?: number; spread?: number; size?: number; seed?: number; color?: string; dur?: number }> = ({
  t,
  t0,
  origin,
  n = 22,
  spread = 14,
  size = 5,
  seed = 1,
  color = "#D8CDB8",
  dur = 2.5,
}) => {
  const dt = t - t0;
  const geo = useMemo(() => new THREE.IcosahedronGeometry(1, 1), []);
  const mats = useMemo(() => {
    const out: THREE.Matrix4[] = [];
    if (dt <= 0 || dt > dur + 1.5) return out;
    for (let i = 0; i < n; i++) {
      const d0 = Math.max(0, dt - rnd(i, seed) * 0.4);
      const a = rnd(i, seed + 1) * Math.PI * 2;
      const r = spread * (0.3 + rnd(i, seed + 2)) * (1 - Math.exp(-d0 * 1.6));
      const s = size * (0.5 + rnd(i, seed + 3)) * (0.3 + Math.min(1, d0 * 0.9)) * (d0 > dur ? Math.max(0, 1 - (d0 - dur) / 1.5) : 1);
      out.push(mat([origin[0] + Math.cos(a) * r, origin[1] + s * 0.5 + d0 * (1 + rnd(i, seed + 4) * 2), origin[2] + Math.sin(a) * r * 0.7], [a, a * 2, 0], [s, s * 0.8, s]));
    }
    return out;
  }, [dt, n, seed]);
  if (!mats.length) return null;
  return (
    <InstM mats={mats} geo={geo} cast={false} receive={false} max={n}>
      <meshStandardMaterial color={color} roughness={1} flatShading transparent opacity={0.82} depthWrite={false} />
    </InstM>
  );
};

// ======================================================================
// O PRÉDIO: estrutura (pilares/vigas/lajes), núcleo, fachada, elevador, cobertura
// ======================================================================
export const B = { H: 3, N: 30, top: 90, CX: [-6, -2, 2, 6], half: 7.2, coreOut: 2.2, coreIn: 1.8, coreTop: 93.5 };

export type BuildState = {
  floors: number; // 0..30
  glowC?: number;
  glowB?: number;
  glowS?: number;
  sway?: number; // deslocamento do topo (m)
  core?: number; // altura do núcleo (m)
  coreGlow?: number;
  cut?: boolean; // corte frontal (meia fachada) mostrando o poço
  cutLeft?: boolean; // tira a parede esquerda do núcleo (close do freio)
  ghost?: number; // 1 = sólido
  facade?: number; // 0..1
  lit?: number; // fração de janelas acesas
  rebar?: number; // <0 desligado; 0..1 concretagem do pilar do canto
  rebarCage?: number;
  roof?: boolean; // platibanda / acabamento
  coreGhost?: number; // núcleo em raio-x (1 = sólido)
  coreDark?: boolean; // poço escuro (contraste para os cabos)
};

const off = (y: number, sway: number) => sway * Math.pow(cl(y / B.top), 2);

export const Building: React.FC<{ s: BuildState; t: number }> = ({ s, t }) => {
  const sway = s.sway ?? 0;
  const cut = !!s.cut;
  const ghost = s.ghost ?? 1;
  const tr = ghost < 1;
  const geos = useMemo(() => {
    const col = new THREE.BoxGeometry(0.7, 3, 0.7);
    const beam = new THREE.BoxGeometry(1, 0.5, 0.4);
    return { col, beam };
  }, []);
  const parts = useMemo(() => {
    const cols: THREE.Matrix4[] = [], beams: THREE.Matrix4[] = [], slabs: THREE.Matrix4[] = [];
    const nF = Math.ceil(s.floors);
    for (let k = 0; k < Math.min(B.N, nF); k++) {
      const q = cl(s.floors - k);
      const qc = ease.out(cl(q / 0.45));
      const qb = ease.out(cl((q - 0.3) / 0.4));
      const qs = popE(cl((q - 0.5) / 0.5));
      const y0 = k * B.H, y1 = y0 + B.H;
      const o0 = off(y0, sway), o1 = off(y1, sway), om = (o0 + o1) / 2;
      const rz = -Math.atan2(o1 - o0, B.H);
      if (qc > 0)
        for (const x of B.CX)
          for (const z of B.CX) {
            if (cut && z > 0) continue;
            if ((s.rebar ?? -1) >= 0 && k === 0 && x === 6 && z === 6) continue;
            const h = B.H * qc;
            cols.push(mat([x + om, y0 + h / 2, z], [0, 0, rz], [1, qc, 1]));
          }
      const yb = y1 - 0.5;
      const ob = off(yb, sway);
      if (qb > 0)
        for (const a of B.CX)
          for (const c of [-4, 0, 4]) {
            // ao longo de x (em z = a) e ao longo de z (em x = a)
            if (!(cut && a > 0) && !(s.cutLeft && c < 0)) beams.push(mat([c + ob, yb, a], [0, 0, 0], [4 * qb, 1, 1]));
            if (!(cut && c > 0) && !(s.cutLeft && a < 0)) beams.push(mat([a + ob, yb, c], [0, Math.PI / 2, 0], [4 * qb, 1, 1]));
          }
      const ys = y1 - 0.125;
      const os = off(ys, sway);
      if (qs > 0) {
        const W = B.half * 2, ring = B.half - B.coreOut;
        const pieces: [number, number, number, number][] = [
          [0, -(B.coreOut + ring / 2), W, ring],
          [0, B.coreOut + ring / 2, W, ring],
          [-(B.coreOut + ring / 2), 0, ring, B.coreOut * 2],
          [B.coreOut + ring / 2, 0, ring, B.coreOut * 2],
        ];
        pieces.forEach(([x, z, w, d], pi) => {
          if (cut && pi === 1) return;
          if (s.cutLeft && pi === 2) return;
          slabs.push(mat([x * qs + os, ys, z * qs], [0, 0, 0], [w * qs, 0.25, d * qs]));
        });
      }
    }
    return { cols, beams, slabs };
  }, [s.floors, sway, cut, s.rebar, s.cutLeft]);
  const g = (v?: number) => (v ?? 0) * 1.1;
  const conc = concreteTex("#C6C3BB");
  const M = (glow?: number, base = "#FFFFFF") => (
    <meshStandardMaterial key={tr ? "g" : "s"} color={base} map={conc} roughness={0.85} emissive="#FFA930" emissiveIntensity={g(glow)} transparent={tr} opacity={ghost} depthWrite={!tr} />
  );
  return (
    <group>
      {/* sapata/laje do térreo */}
      {s.floors > 0 ? (
        <mesh position={[0, 0.12, cut ? -3.6 : 0]} receiveShadow castShadow>
          <boxGeometry args={[15.4, 0.3, cut ? 8.2 : 15.4]} />
          {M(0, "#B7B3AA")}
        </mesh>
      ) : null}
      <InstM mats={parts.cols} geo={geos.col} max={B.N * 16}>
        {M(s.glowC)}
      </InstM>
      <InstM mats={parts.beams} geo={geos.beam} max={B.N * 24}>
        {M(s.glowB, "#E9E6DE")}
      </InstM>
      <InstM mats={parts.slabs} geo={unitBox} max={B.N * 4}>
        {M(s.glowS, "#F2EFE8")}
      </InstM>
      {(s.rebar ?? -1) >= 0 ? <RebarColumn pour={s.rebar ?? 0} cage={s.rebarCage ?? 1} position={[6, 0.25, 6]} /> : null}
      {(s.core ?? 0) > 0.05 ? <Core h={s.core ?? 0} glow={s.coreGlow ?? 0} cut={cut} ghost={Math.min(ghost, s.coreGhost ?? 1)} cutLeft={!!s.cutLeft} dark={!!s.coreDark} /> : null}
      {(s.facade ?? 0) > 0 ? <Facade floors={Math.round((s.facade ?? 0) * B.N)} lit={s.lit ?? 0} t={t} /> : null}
      {s.roof ? <RoofTop /> : null}
    </group>
  );
};

// Pilar com a gaiola de ferro aparente (corte mostrando o ferro dentro do concreto).
const RebarColumn: React.FC<{ pour: number; cage: number; position: V3 }> = ({ pour, cage, position }) => {
  const geoBar = useMemo(() => new THREE.CylinderGeometry(0.028, 0.028, 1, 6), []);
  const bars = useMemo(() => {
    const out: THREE.Matrix4[] = [];
    const h = 3.6 * cage;
    for (const x of [-0.25, 0, 0.25])
      for (const z of [-0.25, 0, 0.25]) {
        if (x === 0 && z === 0) continue;
        out.push(mat([x, h / 2, z], [0, 0, 0], [1, h, 1]));
      }
    return out;
  }, [cage]);
  const stir = useMemo(() => {
    const out: THREE.Matrix4[] = [];
    const n = Math.floor(22 * cage);
    for (let i = 0; i < n; i++) {
      const y = 0.08 + i * 0.15;
      out.push(mat([0, y, 0.27], [0, 0, 0], [0.58, 0.022, 0.022]));
      out.push(mat([0, y, -0.27], [0, 0, 0], [0.58, 0.022, 0.022]));
      out.push(mat([0.27, y, 0], [0, 0, 0], [0.022, 0.022, 0.58]));
      out.push(mat([-0.27, y, 0], [0, 0, 0], [0.022, 0.022, 0.58]));
    }
    return out;
  }, [cage]);
  const h = 3 * pour;
  const wet = pour < 1 ? 0.75 : 1;
  return (
    <group position={position}>
      <InstM mats={bars} geo={geoBar} max={8}>
        <meshStandardMaterial color="#8C4A2C" roughness={0.55} metalness={0.5} />
      </InstM>
      <InstM mats={stir} geo={unitBox} max={88}>
        <meshStandardMaterial color="#9A5434" roughness={0.55} metalness={0.5} />
      </InstM>
      {h > 0.02 ? (
        <group>
          {/* concreto em L: deixa o quadrante da frente aberto para ver o ferro */}
          <mesh position={[0, h / 2, -0.175]} castShadow receiveShadow>
            <boxGeometry args={[0.7, h, 0.35]} />
            <meshStandardMaterial color={wet < 1 ? "#A9A69E" : "#FFFFFF"} map={concreteTex("#C6C3BB")} roughness={0.8 * wet} />
          </mesh>
          <mesh position={[-0.175, h / 2, 0.175]} castShadow receiveShadow>
            <boxGeometry args={[0.35, h, 0.35]} />
            <meshStandardMaterial color={wet < 1 ? "#A9A69E" : "#FFFFFF"} map={concreteTex("#C6C3BB")} roughness={0.8 * wet} />
          </mesh>
          {/* faces de corte destacadas */}
          <mesh position={[0.18, h / 2, 0.002]}>
            <boxGeometry args={[0.34, h, 0.004]} />
            <meshStandardMaterial color="#9E9A90" />
          </mesh>
          <mesh position={[0.002, h / 2, 0.18]}>
            <boxGeometry args={[0.004, h, 0.34]} />
            <meshStandardMaterial color="#9E9A90" />
          </mesh>
        </group>
      ) : null}
      {/* forma de madeira atrás */}
      <mesh position={[0, 1.6, -0.4]} castShadow>
        <boxGeometry args={[0.86, 3.2, 0.05]} />
        <meshStandardMaterial map={woodTexture("#C49A62")} roughness={0.8} />
      </mesh>
      <mesh position={[-0.4, 1.6, 0]} castShadow>
        <boxGeometry args={[0.05, 3.2, 0.86]} />
        <meshStandardMaterial map={woodTexture("#C49A62")} roughness={0.8} />
      </mesh>
    </group>
  );
};

// Núcleo de concreto (torre grossa no meio) com forma trepante amarela no topo enquanto sobe.
const Core: React.FC<{ h: number; glow: number; cut: boolean; ghost: number; cutLeft?: boolean; dark?: boolean }> = ({ h, glow, cut, ghost, cutLeft, dark }) => {
  const tr = ghost < 1;
  const tex = concreteTex("#9C978C", [1, 1], 0);
  const wallTex = useMemo(() => {
    const t2 = tex.clone();
    t2.repeat.set(1, Math.max(1, h / 3));
    t2.needsUpdate = true;
    return t2;
  }, [Math.round(h)]);
  const m =  <meshStandardMaterial key={tr ? "g" : "s"} map={wallTex} color={tr ? "#BFD9EA" : dark ? "#7A766F" : "#F2EBDD"} roughness={0.85} emissive="#FFA930" emissiveIntensity={glow * 1.1} transparent={tr} opacity={ghost} depthWrite={!tr} />;
  const T = 0.4, O = B.coreOut;
  return (
    <group>
      <mesh position={[0, h / 2, -O + T / 2]} castShadow receiveShadow>
        <boxGeometry args={[O * 2, h, T]} />
        {m}
      </mesh>
      {!cut ? (
        <mesh position={[0, h / 2, O - T / 2]} castShadow receiveShadow>
          <boxGeometry args={[O * 2, h, T]} />
          {m}
        </mesh>
      ) : null}
      {(cutLeft ? [1] : [-1, 1]).map((k) => (
        <mesh key={k} position={[k * (O - T / 2), h / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[T, h, O * 2 - (cut ? 0 : 2 * T)]} />
          {m}
        </mesh>
      ))}
      {h < B.coreTop - 0.1 ? (
        <group position={[0, h + 0.4, 0]}>
          {[
            [0, -O - 0.15, O * 2 + 0.6, 0.3],
            [0, O + 0.15, O * 2 + 0.6, 0.3],
            [-O - 0.15, 0, 0.3, O * 2],
            [O + 0.15, 0, 0.3, O * 2],
          ].map(([x, z, w, d], i) => (
            <mesh key={i} position={[x, 0, z]}>
              <boxGeometry args={[w, 1.6, d]} />
              <meshStandardMaterial color="#F2C230" roughness={0.6} />
            </mesh>
          ))}
        </group>
      ) : null}
      {cut && h > B.coreTop - 0.1 ? (
        // tampa da casa de máquinas
        <mesh position={[0, B.coreTop + 0.15, -0.3]} castShadow>
          <boxGeometry args={[O * 2, 0.3, O * 2 - 0.6]} />
          {m}
        </mesh>
      ) : null}
    </group>
  );
};

// Fachada: vidros com caixilho, faixas brancas, varandas com guarda-corpo de vidro.
const Facade: React.FC<{ floors: number; lit: number; t: number }> = ({ floors, lit }) => {
  const pane = useMemo(() => new THREE.PlaneGeometry(4.75, 2.55), []);
  const P = useMemo(() => {
    const dark: THREE.Matrix4[] = [], on: THREE.Matrix4[] = [], band: THREE.Matrix4[] = [], balc: THREE.Matrix4[] = [], rail: THREE.Matrix4[] = [], bar: THREE.Matrix4[] = [];
    const F = B.half - 0.15;
    const sides: { r: number; f: (u: number) => [number, number] }[] = [
      { r: 0, f: (u) => [u, F] },
      { r: Math.PI, f: (u) => [-u, -F] },
      { r: Math.PI / 2, f: (u) => [F, -u] },
      { r: -Math.PI / 2, f: (u) => [-F, u] },
    ];
    for (let k = 0; k < floors; k++) {
      const y = k * B.H + 1.45;
      sides.forEach((sd, si) =>
        [-4.8, 0, 4.8].forEach((u, j) => {
          const [x, z] = sd.f(u);
          const m = mat([x, y, z], [0, sd.r, 0]);
          (rnd(k * 12 + si * 3 + j, 77) < lit ? on : dark).push(m);
        }),
      );
      band.push(mat([0, k * B.H + 2.85, B.half + 0.05], [0, 0, 0], [14.6, 0.5, 0.3]));
      band.push(mat([0, k * B.H + 2.85, -B.half - 0.05], [0, 0, 0], [14.6, 0.5, 0.3]));
      band.push(mat([B.half + 0.05, k * B.H + 2.85, 0], [0, 0, 0], [0.3, 0.5, 14.6]));
      band.push(mat([-B.half - 0.05, k * B.H + 2.85, 0], [0, 0, 0], [0.3, 0.5, 14.6]));
      if (k >= 1) {
        const yb = k * B.H;
        [-4.8, 0, 4.8].forEach((u, j) => {
          if ((k + j) % 2 === 0 || j === 1) {
            balc.push(mat([u, yb + 0.1, B.half + 0.8], [0, 0, 0], [4.3, 0.22, 1.5]));
            rail.push(mat([u, yb + 0.7, B.half + 1.5], [0, 0, 0], [4.3, 1.0, 0.05]));
            bar.push(mat([u, yb + 1.22, B.half + 1.5], [0, 0, 0], [4.3, 0.07, 0.1]));
          }
        });
        if (k % 2 === 1) {
          balc.push(mat([B.half + 0.8, yb + 0.1, 0], [0, 0, 0], [1.5, 0.22, 4.3]));
          rail.push(mat([B.half + 1.5, yb + 0.7, 0], [0, 0, 0], [0.05, 1.0, 4.3]));
          bar.push(mat([B.half + 1.5, yb + 1.22, 0], [0, 0, 0], [0.1, 0.07, 4.3]));
        }
      }
    }
    return { dark, on, band, balc, rail, bar };
  }, [floors, lit]);
  return (
    <group>
      <InstM mats={P.dark} geo={pane} max={B.N * 12} cast={false}>
        <meshStandardMaterial map={glassTex()} roughness={0.15} metalness={0.35} />
      </InstM>
      <InstM mats={P.on} geo={pane} max={B.N * 12} cast={false}>
        <meshStandardMaterial map={glassTex()} emissiveMap={glassLitTex()} emissive="#FFFFFF" emissiveIntensity={1.15} roughness={0.2} />
      </InstM>
      <InstM mats={P.band} geo={unitBox} max={B.N * 4}>
        <meshStandardMaterial color="#F1EFEA" roughness={0.6} />
      </InstM>
      <InstM mats={P.balc} geo={unitBox} max={B.N * 5}>
        <meshStandardMaterial color="#EAE7E0" roughness={0.6} />
      </InstM>
      <InstM mats={P.rail} geo={unitBox} max={B.N * 5} cast={false}>
        <meshStandardMaterial color="#BFE3F2" transparent opacity={0.45} roughness={0.1} depthWrite={false} />
      </InstM>
      <InstM mats={P.bar} geo={unitBox} max={B.N * 5}>
        <meshStandardMaterial color="#5C6670" roughness={0.4} metalness={0.5} />
      </InstM>
    </group>
  );
};

const RoofTop: React.FC = () => (
  <group>
    {[
      [0, B.half + 0.05, 14.7, 0.3],
      [0, -B.half - 0.05, 14.7, 0.3],
      [B.half + 0.05, 0, 0.3, 14.7],
      [-B.half - 0.05, 0, 0.3, 14.7],
    ].map(([x, z, w, d], i) => (
      <mesh key={i} position={[x, B.top + 0.6, z]} castShadow>
        <boxGeometry args={[w, 1.2, d]} />
        <meshStandardMaterial color="#ECEAE4" roughness={0.6} />
      </mesh>
    ))}
  </group>
);

// ======================================================================
// Elevador: trilhos, cabine, contrapeso, polia com motor, cabos, garras e faíscas
// ======================================================================
export const EL = { cabX: -0.5, cabW: 2.0, cabH: 2.6, cabD: 2.4, cwX: 1.2, sheaveY: 91.6, sheaveX: 0.35, sheaveR: 0.85, railL: -1.62, railR: 0.62 };
export const cwTop = (yc: number) => 86.2 - yc;

export const Elevator: React.FC<{
  t: number;
  yc: number; // base da cabine
  appear?: number;
  claw?: number; // 0 aberto, 1 travado
  broken?: number; // 0 inteiro, 1 rompido (mostra cabo partido)
  whip?: number;
  breakAt?: number;
  glowCab?: number;
  glowCable?: number;
  glowCw?: number;
  glowClaw?: number;
  glowRail?: number;
  sparks?: number;
  speed?: number; // para linhas de velocidade
  strands?: number[]; // tempos de rompimento de cada fio (cena do cabo)
  rider?: { mood: TMood; pose: TPose; sit?: number; sweat?: number; arms?: boolean; hop?: number; look?: [number, number] };
  crowd?: number; // passageiros extras (0..5)
  cw?: number; // 0 sem contrapeso, 1 contrapeso no lugar (desce de cima)
  ropes?: number; // nº de cabos no feixe
  ropeAlive?: number[]; // 1 visível, 0 some (fade)
  ropeGlowArr?: number[];
  ropeLen?: number; // 0..1 cabo nascendo do topo até a cabine
  rails?: number; // 0..1 trilhos subindo
  motorScale?: number;
  motorHeat?: number;
  motorGlow?: number;
}> = ({ rider, t, yc, appear = 1, claw = 0, broken = 0, whip = 0, breakAt, glowCab = 0, glowCable = 0, glowCw = 0, glowClaw = 0, glowRail = 0, sparks = 0, speed = 0, strands, crowd = 0, cw: cwShow = 1, ropes = 3, ropeAlive, ropeGlowArr, ropeLen = 1, rails = 1, motorScale = 1, motorHeat = 0, motorGlow = 0 }) => {
  const cabTop = yc + EL.cabH;
  const cw = cwTop(yc) + (1 - cl(cwShow)) * 30;
  const sheaveAng = -yc / EL.sheaveR;
  const steel = "#A9B2BA";
  const yTopRope = EL.sheaveY;
  const leftX = EL.sheaveX - EL.sheaveR;
  const rightX = EL.sheaveX + EL.sheaveR;
  const yHook = cabTop + 0.55;
  const breakY = broken >= 0.5 && breakAt !== undefined ? breakAt : yHook + 1.6;
  const em = (v: number) => ({ emissive: "#FFB02E", emissiveIntensity: v * 1.2 });
  return (
    <group>
      {/* trilhos-guia (T) da cabine e do contrapeso */}
      {[EL.railL, EL.railR].map((x) => {
        const d = x < 0 ? 1 : -1;
        return (
          <group key={x}>
            <mesh position={[x - d * 0.09, 46 * rails, 0]} scale={[1, Math.max(0.001, rails), 1]}>
              <boxGeometry args={[0.05, 92, 0.38]} />
              <meshStandardMaterial color="#3E5A78" metalness={0.55} roughness={0.3} {...em(glowRail)} />
            </mesh>
 <mesh position={[x + d * 0.03, 46 * rails, 0]} scale={[1, Math.max(0.001, rails), 1]}>
              <boxGeometry args={[0.2, 92, 0.07]} />
              <meshStandardMaterial color="#4F6E8E" metalness={0.6} roughness={0.25} {...em(glowRail)} />
            </mesh>
            <InstM mats={railClips(x - d * 0.06)} geo={unitBox} max={124} cast={false}>
              <meshStandardMaterial color="#4A525A" metalness={0.5} roughness={0.4} />
            </InstM>
          </group>
        );
      })}
      {[-0.75, 0.75].map((z) => (
        <mesh key={z} position={[EL.cwX, 46, z]}>
          <boxGeometry args={[0.18, 92, 0.08]} />
          <meshStandardMaterial color="#7D868F" metalness={0.6} roughness={0.35} />
        </mesh>
      ))}
      {/* cabine */}
      <group position={[EL.cabX, yc, 0]} scale={[1, appear, 1]}>
        {/* cabine em casca: fundo, laterais, piso e teto + frente de vidro (vê-se o Tião dentro) */}
        {[
          [0, EL.cabH / 2, -EL.cabD / 2 + 0.03, EL.cabW, EL.cabH, 0.06],
          [-EL.cabW / 2 + 0.03, EL.cabH / 2, 0, 0.06, EL.cabH, EL.cabD],
          [EL.cabW / 2 - 0.03, EL.cabH / 2, 0, 0.06, EL.cabH, EL.cabD],
          [0, 0.04, 0, EL.cabW, 0.08, EL.cabD],
          [0, EL.cabH - 0.04, 0, EL.cabW, 0.08, EL.cabD],
        ].map(([x, y, z, w, h, d], i) => (
          <mesh key={i} position={[x, y, z]} castShadow receiveShadow>
            <boxGeometry args={[w, h, d]} />
            <meshStandardMaterial color={i === 3 ? "#5E5048" : "#C3CBD2"} metalness={i === 3 ? 0.1 : 0.5} roughness={0.3} {...em(glowCab)} />
          </mesh>
        ))}
        {/* corrimão e espelho internos */}
        <mesh position={[0, 0.95, -EL.cabD / 2 + 0.1]}>
          <boxGeometry args={[EL.cabW - 0.2, 0.05, 0.05]} />
          <meshStandardMaterial color="#E8ECEF" metalness={0.8} roughness={0.2} />
        </mesh>
        <mesh position={[0, 1.6, -EL.cabD / 2 + 0.065]}>
          <boxGeometry args={[1.2, 0.9, 0.01]} />
          <meshStandardMaterial color="#9FB4C4" metalness={0.7} roughness={0.08} />
        </mesh>
        {/* frente: moldura + vidro */}
        {[-1, 1].map((k) => (
          <mesh key={`f${k}`} position={[k * (EL.cabW / 2 - 0.1), EL.cabH / 2, EL.cabD / 2]}>
            <boxGeometry args={[0.2, EL.cabH, 0.06]} />
            <meshStandardMaterial color="#9EA8B1" metalness={0.6} roughness={0.25} />
          </mesh>
        ))}
        <mesh position={[0, EL.cabH / 2, EL.cabD / 2]}>
          <boxGeometry args={[EL.cabW - 0.4, EL.cabH, 0.02]} />
          <meshStandardMaterial color="#CFEAF6" transparent opacity={0.14} roughness={0.05} depthWrite={false} />
        </mesh>
        {rider ? (
          <group position={[0.05, 0.08, -0.15]}>
            <TiaoWalk
              t={t}
              scale={0.82}
              mood={rider.mood}
              pose={rider.pose}
              sit={rider.sit ?? 0}
              sweat={rider.sweat ?? 0}
              look={rider.look ?? [0, 0]}
              armLOverride={rider.arms ? [0, 0, -2.6 + Math.sin(t * 22) * 0.25] : undefined}
              armROverride={rider.arms ? [0, 0, 2.6 + Math.sin(t * 19) * 0.25] : undefined}
              legL={rider.sit ? 0 : Math.sin(t * 18) * 0.25 * (rider.arms ? 1 : 0)}
              legR={rider.sit ? 0 : -Math.sin(t * 18) * 0.25 * (rider.arms ? 1 : 0)}
              position={[0, rider.hop ?? 0, 0]}
            />
          </group>
        ) : null}
        {crowd > 0 ? <NoShadow>{crowdKids(crowd, rider, t)}</NoShadow> : null}
        {false
          ? [[-0.55, -0.55, 0.3], [0.55, -0.6, -0.3], [-0.6, 0.35, 0.2], [0.6, 0.4, -0.25], [0.0, 0.62, 0.1]].slice(0, crowd).map(([x, z, r], i) => (
              <group key={`cr${i}`} position={[x, 0.08 + (rider?.hop ?? 0) * (1 + i * 0.3), z]}>
                <TiaoWalk t={t + i * 0.7} scale={0.74} rotation={r} mood={rider?.mood === "shock" ? "shock" : i % 2 ? "sad" : "neutral"} pose={rider?.arms ? "up" : "down"} sweat={rider?.sweat ?? 0.6} sit={rider?.sit ?? 0} look={[i % 2 ? 0.6 : -0.6, 0]} shirt={["#3DAA66", "#E8483B", "#2E6FD8", "#9B59B6", "#F2F2F0"][i]} />
              </group>
            ))
          : null}
        <mesh position={[0, EL.cabH - 0.18, EL.cabD / 2 + 0.02]}>
          <boxGeometry args={[1.6, 0.14, 0.02]} />
          <meshStandardMaterial color="#FFFFFF" emissive="#FFF4D8" emissiveIntensity={1.4} />
        </mesh>
        <mesh position={[0.78, 1.25, EL.cabD / 2 + 0.02]}>
          <boxGeometry args={[0.14, 0.4, 0.02]} />
          <meshStandardMaterial color="#2B3138" emissive="#59D0FF" emissiveIntensity={0.6} />
        </mesh>
        {/* travessa superior e gancho do cabo */}
        <mesh position={[0, EL.cabH + 0.005, 0]}>
          <boxGeometry args={[EL.cabW - 0.02, 0.02, EL.cabD - 0.02]} />
          <meshStandardMaterial color="#59626B" roughness={0.6} />
        </mesh>
        <mesh position={[0, EL.cabH + 0.2, 0]} castShadow>
          <boxGeometry args={[EL.cabW + 0.4, 0.18, 0.3]} />
          <meshStandardMaterial color="#3E4650" metalness={0.5} roughness={0.4} />
        </mesh>
        <mesh position={[0, EL.cabH + 0.42, 0]}>
          <boxGeometry args={[0.3, 0.3, 0.3]} />
          <meshStandardMaterial color="#2F353C" metalness={0.5} />
        </mesh>
        {/* montantes laterais com corrediças */}
        {[-1, 1].map((k) => (
          <mesh key={k} position={[k * (EL.cabW / 2 + 0.08), EL.cabH / 2 + 0.1, 0]}>
            <boxGeometry args={[0.08, EL.cabH + 0.3, 0.3]} />
            <meshStandardMaterial color="#3E4650" metalness={0.5} roughness={0.4} />
          </mesh>
        ))}
        <mesh position={[0, -0.1, 0]}>
          <boxGeometry args={[EL.cabW + 0.25, 0.2, 0.5]} />
          <meshStandardMaterial color="#3E4650" metalness={0.5} roughness={0.4} />
        </mesh>
        {/* freio de segurança: garras em cunha que saem da lateral e mordem a alma do trilho */}
        {[-1, 1].map((k) => {
          const rx = (k < 0 ? EL.railL : EL.railR) - EL.cabX;
          const d = k < 0 ? 1 : -1;
          const hot = glowClaw * 1.3 + claw * sparks * 0.9;
          return (
            <group key={`c${k}`} position={[rx, -0.38, 0]}>
              {/* caixa do freio (aberta para o trilho) */}
              <mesh position={[d * 0.46, 0, 0]}>
                <boxGeometry args={[0.12, 0.62, 0.86]} />
                <meshStandardMaterial color="#E8B21E" metalness={0.3} roughness={0.5} {...em(glowClaw)} />
              </mesh>
              {[-1].map((s2) => (
                <mesh key={`h${s2}`} position={[d * 0.33, 0, s2 * 0.4]}>
                  <boxGeometry args={[0.36, 0.62, 0.06]} />
                  <meshStandardMaterial color="#E8B21E" metalness={0.3} roughness={0.5} {...em(glowClaw)} />
                </mesh>
              ))}
              {/* haste de acionamento */}
              <mesh position={[d * 0.46, 1.4, 0]}>
                <boxGeometry args={[0.05, 2.2, 0.05]} />
                <meshStandardMaterial color="#3A4047" metalness={0.5} />
              </mesh>
              {/* cunhas */}
              {[-1, 1].map((s2) => (
                <group key={s2} position={[d * (0.36 - 0.27 * claw), 0, s2 * (0.09 + 0.16 * (1 - claw))]}>
                  <mesh geometry={WEDGE} rotation={[0, s2 > 0 ? 0 : Math.PI, 0]}>
                    <meshStandardMaterial color="#D9422C" metalness={0.35} roughness={0.4} emissive="#FF7A2E" emissiveIntensity={hot} />
                  </mesh>
                  {[-0.15, -0.05, 0.05, 0.15].map((yy) => (
                    <mesh key={yy} position={[0, yy, -s2 * 0.035]}>
                      <boxGeometry args={[0.24, 0.025, 0.02]} />
                      <meshStandardMaterial color="#5A1E14" />
                    </mesh>
                  ))}
                </group>
              ))}
            </group>
          );
        })}
      </group>
      {/* linhas de velocidade */}
      {speed > 0.05
        ? [0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <mesh key={`v${i}`} position={[-1.95 + i * 0.4, yc - 1 + ((i * 0.37 + t * 3.5) % 1) * 4.5, EL.cabD / 2 + 0.35 + (i % 2) * 0.3]}>
              <boxGeometry args={[0.025, 1.2 * speed, 0.025]} />
              <meshBasicMaterial color="#FFFFFF" transparent opacity={0.6 * speed} />
            </mesh>
          ))
        : null}
      {/* contrapeso */}
      <group position={[EL.cwX, cw - 2.6, 0]} visible={cwShow > 0.001}>
        <mesh position={[0, 1.3, 0]} castShadow>
          <boxGeometry args={[0.55, 2.6, 1.3]} />
          <meshStandardMaterial color="#B8462E" metalness={0.3} roughness={0.5} {...em(glowCw)} />
        </mesh>
        {Array.from({ length: 8 }).map((_, i) => (
          <mesh key={i} position={[0, 0.2 + i * 0.3, 0]}>
            <boxGeometry args={[0.52, 0.03, 1.32]} />
            <meshStandardMaterial color="#3A4047" />
          </mesh>
        ))}
      </group>
      {/* polia, motor e freio na casa de máquinas */}
      <group position={[EL.sheaveX, EL.sheaveY, 0]}>
        <group rotation={[0, 0, sheaveAng]}>
          <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[EL.sheaveR, EL.sheaveR, 0.45, 32]} />
            <meshStandardMaterial color="#8A939C" metalness={0.7} roughness={0.3} {...em(glowCable)} />
          </mesh>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <mesh key={i} rotation={[0, 0, (i / 6) * Math.PI]} position={[0, 0, 0.24]}>
              <boxGeometry args={[EL.sheaveR * 1.7, 0.08, 0.04]} />
              <meshStandardMaterial color="#4B535B" />
            </mesh>
          ))}
        </group>
        <group position={[0, 0, -0.7]} scale={motorScale}>
          <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -0.45 * (motorScale - 1) * 0.0]}>
            <cylinderGeometry args={[0.55, 0.55, 0.9, 20]} />
            <meshStandardMaterial color={motorHeat > 0.3 ? "#6A2A1E" : "#2D6DB5"} metalness={0.3} roughness={0.45} emissive={motorHeat > 0 ? "#FF4A10" : "#FFB02E"} emissiveIntensity={motorHeat * 0.9 + motorGlow * 1.2} />
          </mesh>
          {[-0.3, -0.1, 0.1, 0.3].map((z) => (
            <mesh key={z} rotation={[Math.PI / 2, 0, 0]} position={[0, 0, z]}>
              <cylinderGeometry args={[0.6, 0.6, 0.06, 20]} />
              <meshStandardMaterial color={motorHeat > 0.3 ? "#4A1E14" : "#1F4F86"} emissive="#FF4A10" emissiveIntensity={motorHeat * 0.6} />
            </mesh>
          ))}
          <mesh position={[0, -0.55, 0]}>
            <boxGeometry args={[0.9, 0.2, 0.9]} />
            <meshStandardMaterial color="#2F353C" />
          </mesh>
        </group>
        <mesh position={[0, -0.95, -0.4]}>
          <boxGeometry args={[2.4, 0.25, 1.6]} />
          <meshStandardMaterial color="#3E4650" />
        </mesh>
      </group>
      {/* cabos de aço */}
      {broken < 0.5 && !strands && ropeLen > 0.001 ? (
        <group>
          {Array.from({ length: ropes }, (_, i) => (ropes === 1 ? 0 : (i / (ropes - 1) - 0.5) * Math.min(0.5, ropes * 0.09))).map((dz, i) => {
            const al = ropeAlive ? ropeAlive[i] ?? 1 : 1;
            if (al <= 0.01) return null;
            const yb = yTopRope - (yTopRope - yHook) * cl(ropeLen);
            const gl = glowCable + (ropeGlowArr ? ropeGlowArr[i] ?? 0 : 0);
            return (
              <mesh key={i} position={[leftX + (ropes > 3 ? dz * 1.5 : 0), (yb + yTopRope) / 2, dz * (ropes > 3 ? 0.3 : 1)]}>
                <cylinderGeometry args={[ropes > 3 ? 0.045 : 0.045, ropes > 3 ? 0.045 : 0.045, Math.max(0.01, yTopRope - yb), 6]} />
                <meshStandardMaterial color="#DCE3E8" metalness={0.5} roughness={0.25} emissive={gl > 0.05 ? "#FFB02E" : "#8FA4B5"} emissiveIntensity={gl > 0.05 ? gl * 1.2 : 0.35} transparent={al < 1} opacity={al} depthWrite={al >= 1} />
              </mesh>
            );
          })}
        </group>
      ) : null}
      {strands ? <CableStrands t={t} times={strands} x={leftX} y0={yHook} yBreak={breakY} y1={yTopRope} whip={whip} glow={glowCable} /> : null}
      {broken >= 0.5 && !strands ? (
        <group>
          {/* pedaço de cima balança e sobe */}
          {[-0.08, 0, 0.08].map((dz) => (
            <mesh key={dz} position={[leftX + Math.sin(t * 9 + dz * 30) * 0.15, (breakY + whip + yTopRope) / 2, dz]}>
              <cylinderGeometry args={[0.03, 0.03, Math.max(0.1, yTopRope - breakY - whip), 6]} />
              <meshStandardMaterial color="#DCE3E8" metalness={0.5} roughness={0.25} emissive="#8FA4B5" emissiveIntensity={0.35} />
            </mesh>
          ))}
          {/* toco preso na cabine */}
          {[-0.08, 0, 0.08].map((dz, i) => (
            <mesh key={`s${dz}`} position={[leftX + 0.05 * (i - 1), yHook + 0.45, dz]} rotation={[0, 0, (i - 1) * 0.08]}>
              <cylinderGeometry args={[0.03, 0.03, 0.9, 6]} />
              <meshStandardMaterial color="#DCE3E8" metalness={0.5} roughness={0.25} emissive="#8FA4B5" emissiveIntensity={0.35} />
            </mesh>
          ))}
        </group>
      ) : null}
      {/* lado do contrapeso */}
      {(cwShow > 0.001 ? [-0.08, 0, 0.08] : []).map((dz) => (
        <mesh key={`r${dz}`} position={[rightX, (cw + 0.3 + yTopRope) / 2, dz]}>
          <cylinderGeometry args={[0.03, 0.03, Math.max(0.1, yTopRope - cw - 0.3), 6]} />
          <meshStandardMaterial color="#DCE3E8" metalness={0.5} roughness={0.25} {...em(glowCable)} />
        </mesh>
      ))}
      <mesh position={[(leftX + rightX) / 2 + 0.36, cw + 0.15, 0]} visible={cwShow > 0.001}>
        <boxGeometry args={[0.3, 0.3, 0.3]} />
        <meshStandardMaterial color="#2F353C" />
      </mesh>
      {/* faíscas nas garras */}
      {sparks > 0.01
        ? [EL.railL, EL.railR].map((x, k) => <SparkSpray key={k} t={t} origin={[x + (x < 0 ? 0.05 : -0.05), yc - 0.38, 0.12]} amount={sparks} seed={k * 9 + 3} n={50} scale={0.55} />)
        : null}
      {sparks > 0.01 ? (
        <>
          <Glow position={[EL.railL + 0.05, yc - 0.35, 0.2]} size={0.9 * sparks} color="#FFB347" opacity={0.75} />
          <Glow position={[EL.railR - 0.05, yc - 0.35, 0.2]} size={0.9 * sparks} color="#FFB347" opacity={0.75} />
          <pointLight position={[EL.railL + 0.3, yc - 0.3, 0.8]} intensity={12 * sparks} distance={8} color="#FFB04A" />
        </>
      ) : null}
    </group>
  );
};

// Grupo cujos filhos não projetam sombra (economiza o passe de sombra no render por CPU).
export const NoShadow: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const ref = useRef<THREE.Group>(null);
  useLayoutEffect(() => {
    ref.current?.traverse((o) => {
      o.castShadow = false;
    });
  });
  return <group ref={ref}>{children}</group>;
};
const crowdKids = (crowd: number, rider: { mood: TMood; arms?: boolean; hop?: number; sweat?: number; sit?: number } | undefined, t: number) =>
  [[-0.55, -0.55, 0.3], [0.55, -0.6, -0.3], [-0.6, 0.35, 0.2], [0.6, 0.4, -0.25], [0.0, 0.62, 0.1]].slice(0, crowd).map(([x, z, r], i) => (
    <group key={`cr${i}`} position={[x, 0.08 + (rider?.hop ?? 0) * (1 + i * 0.3), z]}>
      <TiaoWalk t={t + i * 0.7} scale={0.74} rotation={r} mood={rider?.mood === "shock" ? "shock" : rider?.mood === "happy" ? "happy" : i % 2 ? "sad" : "neutral"} pose={rider?.arms ? "up" : "down"} sweat={rider?.sweat ?? 0.6} sit={rider?.sit ?? 0} look={[i % 2 ? 0.6 : -0.6, 0]} shirt={["#3DAA66", "#E8483B", "#2E6FD8", "#9B59B6", "#F2F2F0"][i]} />
    </group>
  ));

// Cunha (prisma trapezoidal): fina em cima, grossa embaixo.
const WEDGE = (() => {
  const sh = new THREE.Shape();
  sh.moveTo(-0.03, -0.24);
  sh.lineTo(0.05, -0.24);
  sh.lineTo(0.05, 0.24);
  sh.lineTo(0.0, 0.24);
  sh.closePath();
  const g = new THREE.ExtrudeGeometry(sh, { depth: 0.26, bevelEnabled: false });
  g.translate(0, 0, -0.13);
  g.rotateY(Math.PI / 2);
  return g;
})();
const clipCache = new Map<number, THREE.Matrix4[]>();
const railClips = (x: number) => {
  if (!clipCache.has(x)) {
    const out: THREE.Matrix4[] = [];
    for (let i = 0; i < 62; i++) for (const z of [-0.15, 0.15]) out.push(mat([x, 0.75 + i * 1.5, z], [0, 0, 0], [0.08, 0.16, 0.08]));
    clipCache.set(x, out);
  }
  return clipCache.get(x)!;
};

// Faíscas: riscos incandescentes espirrando para cima/fora (cabine descendo).
export const SparkSpray: React.FC<{ t: number; origin: V3; amount: number; seed?: number; n?: number; up?: number; spread?: number; scale?: number }> = ({ t, origin, amount, seed = 1, n = 40, up = 1, spread = 1, scale = 1 }) => {
  const mats = useMemo(() => {
    const out: THREE.Matrix4[] = [];
    const k = Math.round(n * cl(amount));
    for (let i = 0; i < k; i++) {
      const life = (rnd(i, seed) + t * 2.6) % 1;
      const a = rnd(i, seed + 1) * Math.PI * 2;
      const v = (1.5 + rnd(i, seed + 2) * 2.5) * spread * scale;
      const x = Math.cos(a) * v * life;
      const z = Math.abs(Math.sin(a)) * v * life * 0.9 + 0.1;
      const y = (up * (2.2 + rnd(i, seed + 3) * 1.5) * life - 4.5 * life * life) * scale;
      const vy = up * 2.2 - 9 * life;
      const ang = Math.atan2(vy, Math.cos(a) * v);
      const len = (0.14 + 0.2 * (1 - life)) * scale;
      out.push(mat([origin[0] + x, origin[1] + y, origin[2] + z], [0, 0, ang], [len, 0.025 * scale, 0.025 * scale]));
    }
    return out;
  }, [t, amount, seed, n, up, spread, scale, origin.join()]);
  return (
    <InstM mats={mats} geo={unitBox} max={n} cast={false} receive={false}>
      <meshBasicMaterial color="#FFD27A" toneMapped={false} />
    </InstM>
  );
};

// Close do cabo: 7 fios; cada um estoura no seu tempo.
const CableStrands: React.FC<{ t: number; times: number[]; x: number; y0: number; yBreak: number; y1: number; whip: number; glow: number }> = ({ t, times, x, y0, yBreak, y1, whip, glow }) => {
  const rr = 0.075;
  const pos: [number, number][] = [[0, 0], ...Array.from({ length: 6 }, (_, i) => [Math.cos((i / 6) * Math.PI * 2) * rr, Math.sin((i / 6) * Math.PI * 2) * rr] as [number, number])];
  return (
    <group>
      {pos.map(([dx, dz], i) => {
        const tb = times[i] ?? 99;
        const br = t >= tb;
        const dt = Math.max(0, t - tb);
        const curl = br ? Math.min(1, dt * 8) : 0;
        const gapU = br ? 0.05 + whip + Math.min(0.3, dt * 1.2) : 0;
        const gapL = br ? 0.05 + Math.min(0.15, dt * 0.8) : 0;
        const tipLen = 0.28;
        const ox = dx * (1 + curl * 3.5) + (i === 0 && br ? 0.12 * curl : 0), oz = dz * (1 + curl * 3.5);
        return (
          <group key={i}>
            <mesh position={[x + dx, (y0 + yBreak - gapL - tipLen) / 2, dz]}>
              <cylinderGeometry args={[0.03, 0.03, yBreak - gapL - tipLen - y0, 8]} />
              <meshStandardMaterial color="#8D959D" metalness={0.6} roughness={0.35} emissive="#FFB02E" emissiveIntensity={glow} />
            </mesh>
            <mesh position={[x + (dx + ox) / 2, yBreak - gapL - tipLen / 2, (dz + oz) / 2]} rotation={[(oz - dz) * 5, 0, -(ox - dx) * 5]}>
              <cylinderGeometry args={[0.03, br ? 0.01 : 0.03, tipLen, 6]} />
              <meshStandardMaterial color={br ? "#E8ECEF" : "#9AA3AB"} metalness={0.5} roughness={0.35} />
            </mesh>
            <mesh position={[x + (dx + ox) / 2, yBreak + gapU + tipLen / 2, (dz + oz) / 2]} rotation={[-(oz - dz) * 5, 0, (ox - dx) * 5]}>
              <cylinderGeometry args={[br ? 0.01 : 0.03, 0.03, tipLen, 6]} />
              <meshStandardMaterial color={br ? "#E8ECEF" : "#9AA3AB"} metalness={0.5} roughness={0.35} />
            </mesh>
            <mesh position={[x + dx, (yBreak + gapU + tipLen + y1) / 2, dz]}>
              <cylinderGeometry args={[0.03, 0.03, Math.max(0.05, y1 - yBreak - gapU - tipLen), 8]} />
              <meshStandardMaterial color="#8D959D" metalness={0.6} roughness={0.35} emissive="#FFB02E" emissiveIntensity={glow} />
            </mesh>
            {br && dt < 0.25 ? <Glow position={[x + dx, yBreak, dz + 0.05]} size={0.35 * (1 - dt * 4)} color="#FFE2A0" opacity={0.9} /> : null}
            {br && dt < 0.3 ? <SparkSpray t={t} origin={[x + dx, yBreak, dz]} amount={1} n={8} up={1} spread={0.25} scale={0.3} seed={60 + i} /> : null}
          </group>
        );
      })}
    </group>
  );
};

// ======================================================================
// Água: canos de vidro com a água correndo dentro (volume + listras de fluxo)
// ======================================================================
export const WaterLine: React.FC<{ pts: V3[]; fill: number; t: number; r?: number; speed?: number; glow?: number; wobble?: number; pipe?: boolean; color?: string }> = ({
  pts,
  fill,
  t,
  r = 0.22,
  speed = 6,
  glow = 0,
  wobble = 0,
  pipe = true,
  color = "#3FA8F0",
}) => {
  const segs = useMemo(() => {
    const out: { a: THREE.Vector3; b: THREE.Vector3; len: number; s0: number }[] = [];
    let s0 = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = new THREE.Vector3(...pts[i]), b = new THREE.Vector3(...pts[i + 1]);
      const len = a.distanceTo(b);
      out.push({ a, b, len, s0 });
      s0 += len;
    }
    return out;
  }, [JSON.stringify(pts)]);
  const total = segs.reduce((s, x) => s + x.len, 0);
  const F = cl(fill, 0, total) + (fill > 0.2 && fill < total ? Math.sin(t * 7) * wobble : 0);
  const up = new THREE.Vector3(0, 1, 0);
  const cyl = (a: THREE.Vector3, b: THREE.Vector3, rad: number, key: string, m: React.ReactNode) => {
    const len = a.distanceTo(b);
    if (len < 0.01) return null;
    const mid = a.clone().add(b).multiplyScalar(0.5);
    const q = new THREE.Quaternion().setFromUnitVectors(up, b.clone().sub(a).normalize());
    return (
      <mesh key={key} position={mid} quaternion={q}>
        <cylinderGeometry args={[rad, rad, len, 14]} />
        {m}
      </mesh>
    );
  };
  // listras de fluxo (traços brancos correndo dentro da água)
  const streaks = useMemo(() => {
    const out: THREE.Matrix4[] = [];
    if (F <= 0.3) return out;
    const n = Math.min(70, Math.floor(F / 1.6));
    for (let i = 0; i < n; i++) {
      const s = ((i / n) * F + t * speed) % F;
      const sg = segs.find((g) => s >= g.s0 && s <= g.s0 + g.len) ?? segs[segs.length - 1];
      const u = (s - sg.s0) / sg.len;
      const p = sg.a.clone().lerp(sg.b, u);
      const d = sg.b.clone().sub(sg.a).normalize();
      const q = new THREE.Quaternion().setFromUnitVectors(up, d);
      const e = new THREE.Euler().setFromQuaternion(q);
      const a2 = rnd(i, 3) * Math.PI * 2;
      const side = new THREE.Vector3(Math.cos(a2), 0, Math.sin(a2)).multiplyScalar(r * 0.55);
      if (Math.abs(d.y) < 0.5) side.set(0, Math.sin(a2) * r * 0.55, 0);
      out.push(mat([p.x + side.x, p.y + side.y, p.z + side.z], [e.x, e.y, e.z], [0.04, 0.9, 0.04]));
    }
    return out;
  }, [F, t, speed, segs]);
  const wm = <meshStandardMaterial color={color} emissive="#1E8ED6" emissiveIntensity={0.35 + glow} transparent opacity={0.88} roughness={0.15} />;
  return (
    <group>
      {pipe
        ? segs.map((g, i) => cyl(g.a, g.b, r + 0.07, `p${i}`, <meshStandardMaterial color="#E4F0F6" transparent opacity={0.42} roughness={0.1} metalness={0.1} depthWrite={false} emissive="#FFB02E" emissiveIntensity={glow * 0.6} />))
        : null}
      {pipe
        ? pts.slice(1, -1).map((p, i) => (
            <mesh key={`j${i}`} position={p}>
              <sphereGeometry args={[r + 0.12, 12, 10]} />
              <meshStandardMaterial color="#9AA6AE" metalness={0.4} roughness={0.4} />
            </mesh>
          ))
        : null}
      {segs.map((g, i) => {
        if (F <= g.s0) return null;
        const u = cl((F - g.s0) / g.len);
        return cyl(g.a, g.a.clone().lerp(g.b, u), r, `w${i}`, wm);
      })}
      <InstM mats={streaks} geo={unitBox} max={70} cast={false} receive={false}>
        <meshBasicMaterial color="#E6F7FF" transparent opacity={0.8} />
      </InstM>
    </group>
  );
};

// Caixa d'água no topo (em corte) e cisterna/bomba no térreo.
export const Tank: React.FC<{ level: number; t: number; glow?: number; position: V3; size: V3; open?: boolean; color?: string }> = ({ level, t, glow = 0, position, size, open = true, color = "#DCE3E6" }) => {
  const [w, h, d] = size;
  const T = 0.2;
  const m = <meshStandardMaterial color={color} roughness={0.6} emissive="#FFA930" emissiveIntensity={glow * 1.1} map={concreteTex("#D2D6D6", [1, 1], 1)} />;
  const lv = cl(level) * (h - 0.4);
  return (
    <group position={position}>
      <mesh position={[0, T / 2, 0]} receiveShadow castShadow>
        <boxGeometry args={[w, T, d]} />
        {m}
      </mesh>
      <mesh position={[0, h / 2, -d / 2 + T / 2]} castShadow>
        <boxGeometry args={[w, h, T]} />
        {m}
      </mesh>
      {[-1, 1].map((k) => (
        <mesh key={k} position={[k * (w / 2 - T / 2), h / 2, 0]} castShadow>
          <boxGeometry args={[T, h, d]} />
          {m}
        </mesh>
      ))}
      {!open ? (
        <mesh position={[0, h / 2, d / 2 - T / 2]} castShadow>
          <boxGeometry args={[w, h, T]} />
          {m}
        </mesh>
      ) : (
        // borda de corte em vidro
        <mesh position={[0, h / 2, d / 2 - 0.02]}>
          <boxGeometry args={[w, h, 0.04]} />
          <meshStandardMaterial color="#CFEAF6" transparent opacity={0.18} depthWrite={false} />
        </mesh>
      )}
      <mesh position={[0, h + 0.08, -d / 4]} castShadow>
        <boxGeometry args={[w + 0.1, 0.16, d / 2]} />
        {m}
      </mesh>
      {lv > 0.05 ? (
        <>
          <mesh position={[0, T + lv / 2, 0]}>
            <boxGeometry args={[w - 2 * T - 0.02, lv, d - 2 * T - 0.02]} />
            <meshStandardMaterial color="#2C93E0" transparent opacity={0.7} roughness={0.1} emissive="#1E7ED0" emissiveIntensity={0.25} depthWrite={false} />
          </mesh>
          <WaterSurface size={[w - 2 * T - 0.02, d - 2 * T - 0.02]} position={[0, T + lv + 0.01, 0]} t={t} amp={0.04} seg={24} />
        </>
      ) : null}
    </group>
  );
};

export const Pump: React.FC<{ t: number; on: number; position: V3; scale?: number }> = ({ t, on, position, scale = 1 }) => {
  const ang = on * t * 18;
  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 0.25, 0]} castShadow>
        <boxGeometry args={[2.0, 0.5, 1.0]} />
        <meshStandardMaterial color="#3E4650" roughness={0.6} />
      </mesh>
      <mesh position={[-0.35, 0.95, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.42, 0.42, 1.1, 20]} />
        <meshStandardMaterial color="#2D6DB5" metalness={0.3} roughness={0.4} emissive="#4AA3FF" emissiveIntensity={on * 0.15} />
      </mesh>
      {Array.from({ length: 6 }).map((_, i) => (
        <mesh key={i} position={[-0.35 + (i - 2.5) * 0.17, 0.95, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.45, 0.45, 0.04, 20]} />
          <meshStandardMaterial color="#255A96" />
        </mesh>
      ))}
      <mesh position={[0.6, 0.95, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.5, 0.5, 0.45, 20]} />
        <meshStandardMaterial color="#C8CED3" metalness={0.5} roughness={0.35} />
      </mesh>
      <group position={[-0.95, 0.95, 0]} rotation={[ang, 0, 0]}>
        {[0, 1, 2].map((i) => (
          <mesh key={i} rotation={[(i / 3) * Math.PI, 0, 0]}>
            <boxGeometry args={[0.06, 0.75, 0.12]} />
            <meshStandardMaterial color="#F2C230" />
          </mesh>
        ))}
      </group>
    </group>
  );
};

// ======================================================================
// Raio e para-raios
// ======================================================================
export const Bolt: React.FC<{ from: V3; to: V3; seed: number; on: number; width?: number }> = ({ from, to, seed, on, width = 0.5 }) => {
  const pts = useMemo(() => {
    const a = new THREE.Vector3(...from), b = new THREE.Vector3(...to);
    const out: THREE.Vector3[] = [];
    const n = 16;
    for (let i = 0; i <= n; i++) {
      const p = a.clone().lerp(b, i / n);
      if (i > 0 && i < n) {
        p.x += (rnd(i, seed) - 0.5) * 14;
        p.z += (rnd(i, seed + 1) - 0.5) * 10;
      }
      out.push(p);
    }
    return out;
  }, [from.join(), to.join(), seed]);
  const branches = useMemo(() => {
    const out: THREE.Vector3[][] = [];
    [4, 8, 11].forEach((k, j) => {
      const p0 = pts[k];
      const br: THREE.Vector3[] = [p0];
      let p = p0.clone();
      for (let i = 0; i < 4; i++) {
        p = p.clone().add(new THREE.Vector3((rnd(i + j * 9, seed + 5) - 0.3) * 12 * (j % 2 ? -1 : 1), -6 - rnd(i, seed + 6) * 6, (rnd(i, seed + 7) - 0.5) * 6));
        br.push(p);
      }
      out.push(br);
    });
    return out;
  }, [pts, seed]);
  if (on <= 0.01) return null;
  const seg = (a: THREE.Vector3, b: THREE.Vector3, w: number, key: string, op = 1) => {
    const len = a.distanceTo(b);
    const mid = a.clone().add(b).multiplyScalar(0.5);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    return (
      <mesh key={key} position={mid} quaternion={q}>
        <cylinderGeometry args={[w, w, len + w, 6]} />
        <meshBasicMaterial color="#F4F8FF" transparent opacity={op * on} toneMapped={false} />
      </mesh>
    );
  };
  return (
    <group>
      {pts.slice(0, -1).map((p, i) => seg(p, pts[i + 1], width, `m${i}`))}
      {pts.slice(0, -1).map((p, i) => seg(p, pts[i + 1], width * 5, `h${i}`, 0.18))}
      {branches.map((br, j) => br.slice(0, -1).map((p, i) => seg(p, br[i + 1], width * 0.5, `b${j}-${i}`, 0.8)))}
      {pts.filter((_, i) => i % 3 === 0).map((p, i) => (
        <Glow key={`g${i}`} position={[p.x, p.y, p.z]} size={22} color="#BFD8FF" opacity={0.35 * on} />
      ))}
      <Glow position={to} size={40} color="#E6F0FF" opacity={0.9 * on} />
    </group>
  );
};

// Faíscas descendo a fachada depois do raio.
export const FacadeSparks: React.FC<{ t: number; t0: number; amount: number }> = ({ t, t0, amount }) => {
  const mats = useMemo(() => {
    const out: THREE.Matrix4[] = [];
    const dt = t - t0;
    if (dt < 0 || amount <= 0) return out;
    for (let i = 0; i < 90; i++) {
      const d = dt - rnd(i, 601) * 0.5;
      if (d < 0) continue;
      const face = i % 2;
      const u = (rnd(i, 602) - 0.5) * 14;
      const y = B.top + 1 - 0.5 * 30 * d * d;
      if (y < 0) continue;
      const outw = 7.6 + d * (1 + rnd(i, 603) * 3);
      const p: V3 = face ? [u, y, outw] : [outw, y, u];
      out.push(mat(p, [0, 0, 0], [0.12, 0.9 + d * 2, 0.12]));
    }
    return out;
  }, [t, t0, amount]);
  return (
    <InstM mats={mats} geo={unitBox} max={90} cast={false} receive={false}>
      <meshBasicMaterial color="#FFE08A" toneMapped={false} />
    </InstM>
  );
};

export const RodPath: V3[] = [
  [0.4, B.coreTop + 3.0, 0.4],
  [0.4, B.coreTop + 0.4, 2.0],
  [5.5, B.top + 1.3, 5.5],
  [7.6, B.top + 1.3, 7.6],
  [7.6, 0.4, 7.6],
  [8.4, 0.4, 8.4],
];
export const LightningRod: React.FC<{ rod: number; cable: number; glow?: number; pulse?: number; t: number }> = ({ rod, cable, glow = 0, pulse = -1 }) => {
  const segs = useMemo(() => {
    const out: { a: THREE.Vector3; b: THREE.Vector3; len: number; s0: number }[] = [];
    let s0 = 0;
    for (let i = 0; i < RodPath.length - 1; i++) {
      const a = new THREE.Vector3(...RodPath[i]), b = new THREE.Vector3(...RodPath[i + 1]);
      out.push({ a, b, len: a.distanceTo(b), s0 });
      s0 += a.distanceTo(b);
    }
    return out;
  }, []);
  const total = segs.reduce((s, x) => s + x.len, 0);
  const L = cable * total;
  const up = new THREE.Vector3(0, 1, 0);
  const rodH = 5.5 * ease.out(cl(rod));
  const baseY = B.coreTop + 2.6;
  const at = (s: number) => {
    const sg = segs.find((g) => s >= g.s0 && s <= g.s0 + g.len) ?? segs[segs.length - 1];
    return sg.a.clone().lerp(sg.b, cl((s - sg.s0) / sg.len));
  };
  return (
    <group>
      {rod > 0.01 ? (
        <group position={[0, baseY, 0]}>
          <mesh position={[0, rodH / 2, 0]} castShadow>
            <cylinderGeometry args={[0.07, 0.12, rodH, 10]} />
            <meshStandardMaterial color="#C9CED3" metalness={0.85} roughness={0.2} emissive="#FFC24A" emissiveIntensity={glow * 1.5} />
          </mesh>
          <mesh position={[0, rodH + 0.3 * cl(rod), 0]}>
            <coneGeometry args={[0.14, 0.6 * cl(rod), 10]} />
            <meshStandardMaterial color="#E6EAEE" metalness={0.9} roughness={0.15} emissive="#FFC24A" emissiveIntensity={glow * 1.5} />
          </mesh>
          <mesh position={[0, 0.2, 0]}>
            <cylinderGeometry args={[0.35, 0.45, 0.4, 12]} />
            <meshStandardMaterial color="#59626B" metalness={0.5} />
          </mesh>
        </group>
      ) : null}
      {segs.map((g, i) => {
        if (L <= g.s0) return null;
        const u = cl((L - g.s0) / g.len);
        const b = g.a.clone().lerp(g.b, u);
        const len = g.a.distanceTo(b);
        if (len < 0.01) return null;
        const mid = g.a.clone().add(b).multiplyScalar(0.5);
        const q = new THREE.Quaternion().setFromUnitVectors(up, b.clone().sub(g.a).normalize());
        return (
          <mesh key={i} position={mid} quaternion={q}>
            <cylinderGeometry args={[0.22, 0.22, len, 8]} />
            <meshStandardMaterial color="#C8783A" metalness={0.6} roughness={0.3} emissive="#FF9A3C" emissiveIntensity={0.25 + glow * 1.5 + (pulse >= 0 ? 1.2 : 0)} />
          </mesh>
        );
      })}
      {cable > 0.02 && cable < 0.999 ? <Glow position={at(L).toArray() as V3} size={3.5} color="#FFD27A" opacity={0.95} /> : null}
      {pulse >= 0 && pulse <= 1 ? (
        <>
          <Glow position={at(pulse * total).toArray() as V3} size={16} color="#FFE07A" opacity={1} />
          <Glow position={at(Math.max(0, pulse - 0.04) * total).toArray() as V3} size={10} color="#FFE07A" opacity={0.7} />
          <pointLight position={at(pulse * total).toArray() as V3} intensity={120} distance={20} color="#FFD27A" />
        </>
      ) : null}
      {/* haste de aterramento */}
      {cable > 0.98 ? (
        <mesh position={[8.4, 0.3, 8.4]}>
          <boxGeometry args={[0.8, 0.25, 0.8]} />
          <meshStandardMaterial color="#59626B" metalness={0.5} emissive="#FFC24A" emissiveIntensity={glow} />
        </mesh>
      ) : null}
    </group>
  );
};

export const GroundRings: React.FC<{ t: number; t0: number; position: V3 }> = ({ t, t0, position }) => {
  const dt = t - t0;
  if (dt < 0 || dt > 1.4) return null;
  return (
    <group position={position}>
      {[0, 0.25, 0.5].map((d, i) => {
        const u = dt - d;
        if (u < 0 || u > 0.9) return null;
        const r = 1 + u * 14;
        return (
          <mesh key={i} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[r, r + 0.5, 48]} />
            <meshBasicMaterial color="#FFE07A" transparent opacity={(1 - u / 0.9) * 0.9} toneMapped={false} side={THREE.DoubleSide} />
          </mesh>
        );
      })}
    </group>
  );
};

// Linhas de vento (traços brancos ondulando) cruzando o topo.
export const WindLines: React.FC<{ t: number; amount: number }> = ({ t, amount }) => {
  const mats = useMemo(() => {
    const out: THREE.Matrix4[] = [];
    const n = Math.round(46 * cl(amount));
    for (let i = 0; i < n; i++) {
      const y = 45 + rnd(i, 701) * 60;
      const z = (rnd(i, 702) - 0.3) * 50;
      const x = ((rnd(i, 703) * 160 + t * (40 + rnd(i, 704) * 25)) % 160) - 80;
      const wob = Math.sin(t * 3 + i) * 0.15;
      out.push(mat([x, y + Math.sin(x * 0.08 + i) * 2, z], [0, 0, wob], [10 + rnd(i, 705) * 10, 0.45, 0.45]));
    }
    return out;
  }, [t, amount]);
  return (
    <InstM mats={mats} geo={unitBox} max={46} cast={false} receive={false}>
      <meshBasicMaterial color="#FFFFFF" transparent opacity={0.75} />
    </InstM>
  );
};

// ======================================================================
// SET B: corte do solo (afunda / estacas)
// ======================================================================
export const SOIL = { face: 6, top: 0, clay: -22, rock: -140 };
export const SoilBlock: React.FC<{ glowRock?: number; settle?: number }> = ({ glowRock = 0, settle = 0 }) => {
  const W = 520, Z0 = -260, F = SOIL.face;
  const D = F - Z0;
  const box = (y0: number, y1: number, m: React.ReactNode, key: string) => (
    <mesh key={key} position={[0, (y0 + y1) / 2, (Z0 + F) / 2]} receiveShadow>
      <boxGeometry args={[W, y1 - y0, D]} />
      {m}
    </mesh>
  );
  return (
    <group>
      {box(-0.35, 0, <meshStandardMaterial map={grassTex([60, 30])} roughness={1} />, "g")}
      {box(-2.6, -0.35, <meshStandardMaterial map={topsoilTex([52, 1])} roughness={1} />, "t")}
      {box(SOIL.clay, -2.6, <meshStandardMaterial map={clayTex([40, 1.6])} roughness={1} />, "c")}
      {box(SOIL.rock, SOIL.clay, <meshStandardMaterial map={rockTex([34, 6])} roughness={1} emissive="#FFB040" emissiveIntensity={glowRock * 0.6} />, "r")}
      {/* faixa de transição clara entre as camadas */}
      <mesh position={[0, SOIL.clay, F + 0.02]}>
        <planeGeometry args={[W, 0.35]} />
        <meshBasicMaterial color="#5D554B" />
      </mesh>
      {/* zona comprimida sob o prédio */}
      {settle > 0 ? (
        <mesh position={[0, -6, F + 0.03]}>
          <planeGeometry args={[22, 11]} />
          <meshBasicMaterial color="#5A3218" transparent opacity={0.35 * settle} depthWrite={false} />
        </mesh>
      ) : null}
    </group>
  );
};

export const PILE_X = [-6, -2, 2, 6];
export const Piles: React.FC<{ depths: number[]; glow?: number }> = ({ depths, glow = 0 }) => (
  <group>
    {PILE_X.map((x, i) => {
      const d = depths[i] ?? 0;
      if (d <= 0.05) return null;
      return (
        <group key={i}>
          <mesh position={[x, -d / 2 + 0.3, SOIL.face]} castShadow>
            <cylinderGeometry args={[0.75, 0.75, d, 16]} />
            <meshStandardMaterial map={concreteTex("#BDBAB2")} color="#FFFFFF" roughness={0.8} emissive="#FFA930" emissiveIntensity={glow * 1.1} />
          </mesh>
          <mesh position={[x, -d + 0.3, SOIL.face]}>
            <coneGeometry args={[0.75, 1.1, 16]} />
            <meshStandardMaterial color="#9E9B93" roughness={0.8} emissive="#FFA930" emissiveIntensity={glow * 1.1} />
          </mesh>
        </group>
      );
    })}
  </group>
);

// Bate-estaca: esteira, cabine, torre treliçada e martelo.
export const PileDriver: React.FC<{ x: number; hammer: number; t: number }> = ({ x, hammer }) => {
  const H = 14;
  const brace = useMemo(() => {
    const out: THREE.Matrix4[] = [];
    for (let i = 0; i < 14; i++) {
      const y = 1 + i * 0.95;
      out.push(mat([0, y + 0.47, 0.0], [0, 0, (i % 2 ? 1 : -1) * 0.95], [1.25, 0.08, 0.08]));
      out.push(mat([0, y, 0], [0, 0, 0], [0.9, 0.08, 0.08]));
    }
    return out;
  }, []);
  return (
    <group position={[x, 0, SOIL.face - 0.2]}>
      {/* esteira e cabine (atrás, sobre o chão) */}
      <group position={[0, 0, -3.4]}>
        <mesh position={[0, 0.55, 0]} castShadow>
          <boxGeometry args={[3.4, 1.1, 4.6]} />
          <meshStandardMaterial color="#2E3238" roughness={0.8} />
        </mesh>
        <mesh position={[0, 1.6, -0.4]} castShadow>
          <boxGeometry args={[2.6, 1.2, 3.0]} />
          <meshStandardMaterial color="#F2B21E" roughness={0.5} />
        </mesh>
        <mesh position={[0.9, 2.6, 0.4]} castShadow>
          <boxGeometry args={[1.2, 1.1, 1.3]} />
          <meshStandardMaterial color="#F2B21E" roughness={0.5} />
        </mesh>
        <mesh position={[0.9, 2.65, 1.06]}>
          <boxGeometry args={[1.0, 0.7, 0.02]} />
          <meshStandardMaterial color="#9CCBE4" roughness={0.1} metalness={0.3} />
        </mesh>
        <mesh position={[0, 3.5, 1.7]} rotation={[0.95, 0, 0]} castShadow>
          <boxGeometry args={[0.25, 4.5, 0.25]} />
          <meshStandardMaterial color="#D99A12" />
        </mesh>
      </group>
      {/* torre */}
      {[-0.5, 0.5].map((k) => (
        <mesh key={k} position={[k, H / 2, 0.6]} castShadow>
          <boxGeometry args={[0.18, H, 0.18]} />
          <meshStandardMaterial color="#F2B21E" roughness={0.5} />
        </mesh>
      ))}
      <group position={[0, 0, 0.6]}>
        <InstM mats={brace} geo={unitBox} max={28}>
          <meshStandardMaterial color="#E0A114" roughness={0.5} />
        </InstM>
      </group>
      <mesh position={[0, H + 0.3, 0.6]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.4, 0.4, 0.3, 16]} />
        <meshStandardMaterial color="#59626B" metalness={0.5} />
      </mesh>
      {/* martelo */}
      <mesh position={[0, 1.2 + hammer, 0.2]} castShadow>
        <boxGeometry args={[1.0, 2.2, 1.0]} />
        <meshStandardMaterial color="#3A4047" metalness={0.5} roughness={0.4} />
      </mesh>
      <mesh position={[0, (2.3 + hammer + H) / 2, 0.2]}>
        <cylinderGeometry args={[0.03, 0.03, Math.max(0.1, H - 2.3 - hammer), 6]} />
        <meshStandardMaterial color="#2E3236" />
      </mesh>
    </group>
  );
};

// Rachaduras no chão em volta do prédio que afunda.
export const GroundCracks: React.FC<{ p: number }> = ({ p }) => {
  const mats = useMemo(() => {
    const out: THREE.Matrix4[] = [];
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2 + rnd(i, 801) * 0.3;
      for (let k = 0; k < 4; k++) {
        const f = cl(p * 4 - k * 0.7);
        if (f <= 0) continue;
        const r = 9 + k * 2.4;
        const aa = a + (k % 2 ? 0.12 : -0.12);
        const z = Math.sin(aa) * r;
        if (z > SOIL.face - 0.5) continue;
        out.push(mat([Math.cos(aa) * r, 0.05, z], [0, -aa, 0], [2.6 * f, 0.06, 0.18]));
      }
    }
    return out;
  }, [p]);
  return (
    <InstM mats={mats} geo={unitBox} max={64} cast={false}>
      <meshBasicMaterial color="#3A2416" />
    </InstM>
  );
};

// ======================================================================
// SET C: escadaria infinita
// ======================================================================
export const STAIR = { run: 2.88, w: 1.1, zc: 0.8, x0: -1.44 };
export const stairPos = (u: number): { p: V3; rot: number } => {
  const k = Math.floor(u), f = u - k;
  const y0 = k * 3;
  if (f < 0.44) {
    const s = f / 0.44;
    return { p: [STAIR.x0 + STAIR.run * s, y0 + 1.5 * s, -STAIR.zc], rot: Math.PI / 2 };
  }
  if (f < 0.5) {
    const s = (f - 0.44) / 0.06;
    return { p: [1.44 + 0.55 * Math.sin(s * Math.PI), y0 + 1.5, -STAIR.zc + 2 * STAIR.zc * s], rot: Math.PI / 2 - Math.PI * s };
  }
  if (f < 0.94) {
    const s = (f - 0.5) / 0.44;
    return { p: [1.44 - STAIR.run * s, y0 + 1.5 + 1.5 * s, STAIR.zc], rot: -Math.PI / 2 };
  }
  const s = (f - 0.94) / 0.06;
  return { p: [-1.44 - 0.55 * Math.sin(s * Math.PI), y0 + 3, STAIR.zc - 2 * STAIR.zc * s], rot: -Math.PI / 2 - Math.PI * s };
};

export const StairScene: React.FC<{ t: number; u: number; sit: number; sweat: number; mood: "neutral" | "sad" | "shock"; walk: number }> = ({ t, u, sit, sweat, mood, walk }) => {
  const N = 30;
  const G = useMemo(() => {
    const steps: THREE.Matrix4[] = [], under: THREE.Matrix4[] = [], land: THREE.Matrix4[] = [], rails: THREE.Matrix4[] = [], posts: THREE.Matrix4[] = [], lamps: THREE.Matrix4[] = [], doors: THREE.Matrix4[] = [];
    const ang = Math.atan2(1.5, STAIR.run);
    const L = Math.hypot(1.5, STAIR.run);
    for (let k = 0; k < N; k++) {
      const y0 = k * 3;
      for (let i = 0; i < 9; i++) {
        const h = (1.5 / 9) * (i + 1);
        steps.push(mat([STAIR.x0 + STAIR.run * ((i + 0.5) / 9), y0 + h - 0.085, -STAIR.zc], [0, 0, 0], [STAIR.run / 9 + 0.01, 0.17, STAIR.w]));
        steps.push(mat([1.44 - STAIR.run * ((i + 0.5) / 9), y0 + 1.5 + h - 0.085, STAIR.zc], [0, 0, 0], [STAIR.run / 9 + 0.01, 0.17, STAIR.w]));
      }
      under.push(mat([0, y0 + 0.66, -STAIR.zc], [0, 0, ang], [L + 0.2, 0.22, STAIR.w]));
      under.push(mat([0, y0 + 2.16, STAIR.zc], [0, 0, -ang], [L + 0.2, 0.22, STAIR.w]));
      land.push(mat([2.04, y0 + 1.4, 0], [0, 0, 0], [1.2, 0.2, 2.8]));
      land.push(mat([-2.04, y0 + 2.9, 0], [0, 0, 0], [1.2, 0.2, 2.8]));
      // corrimão interno (lado do vão)
      rails.push(mat([0, y0 + 0.75 + 0.95, -STAIR.zc + STAIR.w / 2], [0, 0, ang], [L, 0.06, 0.06]));
      rails.push(mat([0, y0 + 2.25 + 0.95, STAIR.zc - STAIR.w / 2], [0, 0, -ang], [L, 0.06, 0.06]));
      for (let i = 0; i < 4; i++) {
        const s = (i + 0.5) / 4;
        posts.push(mat([STAIR.x0 + STAIR.run * s, y0 + 1.5 * s + 0.5, -STAIR.zc + STAIR.w / 2], [0, 0, 0], [0.04, 0.95, 0.04]));
        posts.push(mat([1.44 - STAIR.run * s, y0 + 1.5 + 1.5 * s + 0.5, STAIR.zc - STAIR.w / 2], [0, 0, 0], [0.04, 0.95, 0.04]));
      }
      lamps.push(mat([2.0, y0 + 3.9, -1.42], [0, 0, 0], [0.9, 0.12, 0.08]));
      doors.push(mat([-2.68, y0 + 3 + 1.05, 0], [0, 0, 0], [0.06, 2.1, 1.0]));
    }
    return { steps, under, land, rails, posts, lamps, doors };
  }, []);
  const conc = concreteTex("#BCB8AE");
  const st = stairPos(u);
  const bob = Math.abs(Math.sin(u * 9 * Math.PI)) * 0.08 * walk;
  const swing = Math.sin(u * 9 * Math.PI) * 0.6 * walk;
  return (
    <group>
      <InstM mats={G.steps} geo={unitBox} max={N * 18}>
        <meshStandardMaterial map={conc} color="#E6E2D8" roughness={0.85} />
      </InstM>
      <InstM mats={G.under} geo={unitBox} max={N * 2}>
        <meshStandardMaterial map={conc} color="#D6D2C8" roughness={0.85} />
      </InstM>
      <InstM mats={G.land} geo={unitBox} max={N * 2}>
        <meshStandardMaterial map={conc} color="#E6E2D8" roughness={0.85} />
      </InstM>
      <InstM mats={G.rails} geo={unitBox} max={N * 2}>
        <meshStandardMaterial color="#C8402E" roughness={0.4} metalness={0.3} />
      </InstM>
      <InstM mats={G.posts} geo={unitBox} max={N * 8}>
        <meshStandardMaterial color="#59626B" roughness={0.5} metalness={0.4} />
      </InstM>
      <InstM mats={G.lamps} geo={unitBox} max={N} cast={false}>
        <meshStandardMaterial color="#FFFFFF" emissive="#FFF6E0" emissiveIntensity={2.2} />
      </InstM>
      <InstM mats={G.doors} geo={unitBox} max={N}>
        <meshStandardMaterial color="#8A3A2C" roughness={0.6} />
      </InstM>
      {/* paredes */}
      <mesh position={[0, 46, -1.48]} receiveShadow>
        <planeGeometry args={[5.5, 92]} />
        <meshStandardMaterial map={stairWallTex([1, 92 / 3])} roughness={0.9} />
      </mesh>
      {[-1, 1].map((k) => (
        <mesh key={k} position={[k * 2.7, 46, 0]} rotation={[0, -k * Math.PI / 2, 0]} receiveShadow>
          <planeGeometry args={[3.0, 92]} />
          <meshStandardMaterial map={stairWallTex([1, 92 / 3])} roughness={0.9} />
        </mesh>
      ))}
      <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[5.5, 3.0]} />
        <meshStandardMaterial map={conc} color="#CFCBC0" />
      </mesh>
      <mesh position={[0, 92, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[5.5, 3.0]} />
        <meshStandardMaterial color="#FFFFFF" emissive="#FFFFFF" emissiveIntensity={1.5} />
      </mesh>
      {/* face de corte do prédio em volta da escada */}
      {[-1, 1].map((k) => (
        <mesh key={`cf${k}`} position={[k * 9.2, 46, 1.4]}>
          <planeGeometry args={[13, 92]} />
          <meshStandardMaterial map={sectionTex([1, 92 / 3])} roughness={0.9} />
        </mesh>
      ))}
      {/* números dos andares nos patamares */}
      {Array.from({ length: N }).map((_, k) => (
        <mesh key={k} position={[-2.0, (k + 1) * 3 + 1.7, -1.46]}>
          <planeGeometry args={[0.95, 0.95]} />
          <meshStandardMaterial map={numberTex(k + 1)} roughness={0.7} />
        </mesh>
      ))}
      <mesh position={[-2.0, 1.7, -1.46]}>
        <planeGeometry args={[0.95, 0.95]} />
        <meshStandardMaterial map={numberTex(0)} roughness={0.7} />
      </mesh>
      <TiaoWalk
        legL={sit > 0.5 ? 0 : Math.max(0, Math.sin(u * 9 * Math.PI)) * 0.9 * walk - 0.1 * walk}
        legR={sit > 0.5 ? 0 : Math.max(0, -Math.sin(u * 9 * Math.PI)) * 0.9 * walk - 0.1 * walk}
        position={[st.p[0], st.p[1] + bob + (sit > 0 ? -0.05 : 0), st.p[2]]}
        rotation={sit > 0.5 ? 0.5 : st.rot}
        t={t}
        mood={mood}
        sweat={sweat}
        sit={sit}
        lean={sit > 0.5 ? 0.35 : 0.25 * walk}
        headLean={sit > 0.5 ? 0.35 : 0}
        armLOverride={sit > 0.5 ? [-0.3, 0, 0.6] : [swing, 0, 0.12]}
        armROverride={sit > 0.5 ? [-0.3, 0, -0.6] : [-swing, 0, -0.12]}
      />
    </group>
  );
};

// ======================================================================
// SET D: Crystal Palace, Nova York, 1854 (vinheta em sépia)
// ======================================================================
export const OTIS = { postX: 1.7, top: 15.5 };
export const OtisScene: React.FC<{ t: number; hp: number; cut: number; tCut: number; axe: number; lock: number; cheer: number; hat: number }> = ({ t, hp, cut, tCut, axe, lock, cheer, hat }) => {
  const wood = woodTexture("#B07A48");
  const teeth = useMemo(() => {
    const out: THREE.Matrix4[] = [];
    for (let i = 0; i < 52; i++) {
      const y = 0.8 + i * 0.28;
      for (const k of [-1, 1]) out.push(mat([k * (OTIS.postX - 0.24), y, 0], [0, 0, k * 0.6], [0.22, 0.24, 0.36]));
    }
    return out;
  }, []);
  const crowd = useMemo(() => {
    const out: { x: number; z: number; r: number; c: string; hat: boolean; s: number }[] = [];
    const cols = ["#3A2E28", "#4A3A30", "#2F2A2A", "#5A4636", "#6B5240", "#3E3530"];
    for (let i = 0; i < 34; i++) {
      const a = -1.25 + (i / 33) * 2.5 + (rnd(i, 901) - 0.5) * 0.08;
      const r = 6.2 + (i % 3) * 1.4 + rnd(i, 902) * 0.6;
      const x = Math.sin(a) * r, z = Math.cos(a) * r + 0.5;
      out.push({ x, z, r: Math.atan2(-x, -z + 0.5), c: cols[i % cols.length], hat: rnd(i, 903) < 0.6, s: 0.9 + rnd(i, 904) * 0.2 });
    }
    return out;
  }, []);
  const cm = useMemo(() => {
    const body: THREE.Matrix4[] = [], bodyC: string[] = [], head: THREE.Matrix4[] = [], hatM: THREE.Matrix4[] = [], brim: THREE.Matrix4[] = [], arm: THREE.Matrix4[] = [], bonnet: THREE.Matrix4[] = [];
    const tmp = new THREE.Matrix4();
    crowd.forEach((p, i) => {
      const jump = cheer * Math.max(0, Math.sin(t * 9 + i * 1.3)) * 0.18;
      const base = mat([p.x, jump, p.z], [0, p.r, 0], [p.s, p.s, p.s]);
      body.push(tmp.multiplyMatrices(base, mat([0, 0.75, 0], [0, 0, 0], [1, 1, 1])).clone());
      bodyC.push(p.c);
      head.push(tmp.multiplyMatrices(base, mat([0, 1.68, 0])).clone());
      if (p.hat) {
        hatM.push(tmp.multiplyMatrices(base, mat([0, 2.05, 0])).clone());
        brim.push(tmp.multiplyMatrices(base, mat([0, 1.86, 0])).clone());
      } else bonnet.push(tmp.multiplyMatrices(base, mat([0, 1.78, -0.04])).clone());
      for (const k of [-1, 1]) {
        const up = cheer * (2.6 + Math.sin(t * 10 + i) * 0.25);
        arm.push(tmp.multiplyMatrices(base, mat([k * 0.33, 1.25, 0], [0, 0, k * (0.15 + up)])).clone().multiply(mat([0, -0.32, 0])));
      }
    });
    return { body, bodyC, head, hatM, brim, arm, bonnet };
  }, [crowd, cheer, t]);
  const geos = useMemo(
    () => ({
      body: new THREE.CylinderGeometry(0.26, 0.42, 1.5, 10),
      head: new THREE.SphereGeometry(0.2, 12, 10),
      hat: new THREE.CylinderGeometry(0.17, 0.17, 0.42, 12),
      brim: new THREE.CylinderGeometry(0.3, 0.3, 0.03, 14),
      arm: new THREE.BoxGeometry(0.12, 0.64, 0.12),
      bonnet: new THREE.SphereGeometry(0.24, 12, 10, 0, Math.PI * 2, 0, Math.PI / 1.7),
    }),
    [],
  );
  // salão: arcos de ferro, abóbada de vidro, colunas, galerias, bandeiras
  const arches = useMemo(() => Array.from({ length: 11 }, (_, i) => -36 + i * 6), []);
  const pawl = lock;
  const ropeTopY = OTIS.top - 0.3;
  const frameTop = hp + 2.9;
  const cutY = 14.85;
  const dropped = cut > 0;
  const tipY = Math.max(frameTop + 0.3, cutY - (t - tCut) * 9);
  return (
    <group>
      {/* piso */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[90, 90]} />
        <meshStandardMaterial map={woodTexture("#A8784C")} color="#E8D9C0" roughness={0.9} />
      </mesh>
      {/* abóbada de vidro + arcos */}
      <mesh position={[0, 12, -6]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[16, 16, 70, 32, 1, true, -Math.PI / 2, Math.PI]} />
        <meshStandardMaterial color="#DDEBF0" transparent opacity={0.22} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      {arches.map((z) => (
        <group key={z}>
          <mesh position={[0, 12, z]}>
            <torusGeometry args={[16, 0.28, 8, 40, Math.PI]} />
            <meshStandardMaterial color="#5A5F66" metalness={0.5} roughness={0.5} />
          </mesh>
          {[-1, 1].map((k) => (
            <mesh key={k} position={[k * 16, 6, z]} castShadow>
              <cylinderGeometry args={[0.35, 0.45, 12, 12]} />
              <meshStandardMaterial color="#5A5F66" metalness={0.5} roughness={0.5} />
            </mesh>
          ))}
          {[-1, 1].map((k) => (
            <mesh key={`f${k}`} position={[k * 13.5, 9.5, z + 3]} rotation={[0, 0, k * 0.05]}>
              <boxGeometry args={[0.05, 3.2, 1.6]} />
              <meshStandardMaterial color={["#B8463A", "#3A5FA0", "#E6C25A"][(z / 6 + 7) % 3 | 0]} roughness={0.8} />
            </mesh>
          ))}
        </group>
      ))}
      {/* galerias laterais */}
      {[-1, 1].map((k) => (
        <group key={k}>
          <mesh position={[k * 13.6, 6, -6]} castShadow receiveShadow>
            <boxGeometry args={[4.8, 0.3, 70]} />
            <meshStandardMaterial map={wood} color="#E3D2B5" />
          </mesh>
          <mesh position={[k * 11.3, 6.6, -6]}>
            <boxGeometry args={[0.1, 0.9, 70]} />
            <meshStandardMaterial color="#5A5F66" metalness={0.4} />
          </mesh>
        </group>
      ))}
      {/* parede do fundo com rosácea */}
      <mesh position={[0, 14, -40]}>
        <planeGeometry args={[34, 28]} />
        <meshStandardMaterial color="#D9CBB0" roughness={0.9} />
      </mesh>
      <mesh position={[0, 16, -39.9]}>
        <circleGeometry args={[5, 32]} />
        <meshStandardMaterial color="#F6E8C8" emissive="#F6E2B0" emissiveIntensity={0.6} />
      </mesh>
      {Array.from({ length: 12 }).map((_, i) => (
        <mesh key={i} position={[0, 16, -39.85]} rotation={[0, 0, (i / 12) * Math.PI]}>
          <boxGeometry args={[10, 0.16, 0.05]} />
          <meshStandardMaterial color="#5A5F66" />
        </mesh>
      ))}
      {/* estandes / caixotes da exposição */}
      {[
        [-8, -6, 2],
        [8.5, -9, 1.5],
        [-9, 3, 1.2],
        [9.5, 2, 1.6],
        [-5, -14, 2.4],
        [6, -16, 2.2],
      ].map(([x, z, s], i) => (
        <mesh key={i} position={[x, s / 2, z]} castShadow>
          <boxGeometry args={[s * 1.4, s, s]} />
          <meshStandardMaterial map={wood} color="#E6D3B0" />
        </mesh>
      ))}
      {/* torre do elevador */}
      {[-1, 1].map((k) => (
        <mesh key={k} position={[k * OTIS.postX, OTIS.top / 2, 0]} castShadow>
          <boxGeometry args={[0.35, OTIS.top, 0.5]} />
          <meshStandardMaterial map={wood} color="#F0DFC2" roughness={0.8} />
        </mesh>
      ))}
      <InstM mats={teeth} geo={unitBox} max={104}>
        <meshStandardMaterial color="#5A5F66" metalness={0.5} roughness={0.5} />
      </InstM>
      <mesh position={[0, OTIS.top + 0.2, 0]} castShadow>
        <boxGeometry args={[4.4, 0.4, 0.7]} />
        <meshStandardMaterial map={wood} color="#F0DFC2" />
      </mesh>
      {[-1, 1].map((k) => (
        <mesh key={`b${k}`} position={[k * 2.6, OTIS.top * 0.35, 0]} rotation={[0, 0, k * 0.12]} castShadow>
          <boxGeometry args={[0.25, OTIS.top * 0.7, 0.3]} />
          <meshStandardMaterial map={wood} color="#E3D2B5" />
        </mesh>
      ))}
      {/* polia no topo */}
      <mesh position={[0.3, OTIS.top - 0.15, 0.45]} rotation={[0, 0, t * (dropped ? 0 : 2)]}>
        <torusGeometry args={[0.45, 0.08, 8, 20]} />
        <meshStandardMaterial color="#4A4F56" metalness={0.6} />
      </mesh>
      {/* corda: plataforma → polia → guincho */}
      {!dropped ? (
        <mesh position={[-0.15, (frameTop + ropeTopY) / 2, 0.45]}>
          <cylinderGeometry args={[0.045, 0.045, ropeTopY - frameTop, 8]} />
          <meshStandardMaterial color="#C9A46A" roughness={0.9} />
        </mesh>
      ) : (
        <>
          <mesh position={[-0.15 + Math.sin(t * 14) * 0.05 * Math.max(0, 1 - (t - tCut)), (cutY + 0.25 + ropeTopY) / 2 + Math.min(1, (t - tCut) * 3), 0.45]}>
            <cylinderGeometry args={[0.045, 0.045, Math.max(0.1, ropeTopY - cutY - 0.25), 8]} />
            <meshStandardMaterial color="#C9A46A" roughness={0.9} />
          </mesh>
          <mesh position={[-0.15 + Math.sin(t * 10) * 0.2, (frameTop + tipY) / 2, 0.45]} rotation={[0, 0, Math.sin(t * 8) * 0.15]}>
            <cylinderGeometry args={[0.045, 0.045, Math.max(0.1, tipY - frameTop), 8]} />
            <meshStandardMaterial color="#C9A46A" roughness={0.9} />
          </mesh>
        </>
      )}
      <mesh position={[0.75, OTIS.top / 2 - 0.4, 0.45]}>
        <cylinderGeometry args={[0.045, 0.045, OTIS.top - 1.6, 8]} />
        <meshStandardMaterial color="#C9A46A" roughness={0.9} />
      </mesh>
      <mesh position={[0.75, 0.6, 0.9]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.5, 0.5, 1.2, 16]} />
        <meshStandardMaterial map={wood} color="#C9A070" />
      </mesh>
      {/* ajudante com machado no topo */}
      <mesh position={[-1.1, 13.1, 1.0]} castShadow>
        <boxGeometry args={[1.4, 0.15, 0.9]} />
        <meshStandardMaterial map={wood} color="#E3D2B5" />
      </mesh>
      <group position={[-1.15, 13.18, 1.0]}>
        <mesh position={[0, 0.75, 0]} castShadow>
          <cylinderGeometry args={[0.22, 0.32, 1.4, 10]} />
          <meshStandardMaterial color="#3E3530" />
        </mesh>
        <mesh position={[0, 1.6, 0]}>
          <sphereGeometry args={[0.2, 12, 10]} />
          <meshStandardMaterial color="#E9C9A6" />
        </mesh>
        <mesh position={[0, 1.95, 0]}>
          <cylinderGeometry args={[0.16, 0.16, 0.38, 12]} />
          <meshStandardMaterial color="#222" />
        </mesh>
        <group position={[0.25, 1.25, 0.1]} rotation={[0, 0, -0.4 - axe * 1.9]}>
          <mesh position={[0, 0.5, 0]}>
            <boxGeometry args={[0.07, 1.1, 0.07]} />
            <meshStandardMaterial map={wood} color="#B08050" />
          </mesh>
          <mesh position={[0.15, 1.0, 0]}>
            <boxGeometry args={[0.35, 0.25, 0.04]} />
            <meshStandardMaterial color="#9AA2AA" metalness={0.8} roughness={0.25} />
          </mesh>
        </group>
      </group>
      {lock > 0 && t - tCut < 0.55 ? <SparkSpray t={t} origin={[1.5, hp + 2.75, 0.3]} amount={1} n={16} up={1} spread={0.5} scale={0.6} seed={43} /> : null}
      {cut > 0 && t - tCut < 0.35 ? <SparkSpray t={t} origin={[-0.15, cutY, 0.6]} amount={1} n={18} up={1} spread={0.6} scale={0.7} seed={41} /> : null}
      {/* plataforma */}
      <group position={[0, hp, 0]}>
        <mesh position={[0, 0, 0]} castShadow receiveShadow>
          <boxGeometry args={[2.9, 0.22, 2.6]} />
          <meshStandardMaterial map={wood} color="#E8D3AE" />
        </mesh>
        {[-1, 1].map((k) => (
          <mesh key={k} position={[k * 1.38, 1.45, 0]} castShadow>
            <boxGeometry args={[0.16, 2.9, 0.22]} />
            <meshStandardMaterial map={wood} color="#E8D3AE" />
          </mesh>
        ))}
        <mesh position={[0, 2.9, 0]} castShadow>
          <boxGeometry args={[3.0, 0.22, 0.26]} />
          <meshStandardMaterial map={wood} color="#E8D3AE" />
        </mesh>
        {/* mola de carroça (arqueada) */}
        <mesh position={[0, 3.05 - lock * 0.1, 0]} rotation={[0, 0, 0]} scale={[1, 1 - lock * 0.6, 1]}>
          <torusGeometry args={[1.25, 0.06, 6, 24, Math.PI]} />
          <meshStandardMaterial color="#4A4F56" metalness={0.6} />
        </mesh>
        {/* lingüetas (travas) que saltam e entram no dente da cremalheira */}
        {[-1, 1].map((k) => (
          <group key={`p${k}`} position={[k * 1.25, 2.75, 0.18]} rotation={[0, 0, k * 0.85 * (1 - pawl)]}>
            <mesh position={[k * 0.24, 0, 0]}>
              <boxGeometry args={[0.5, 0.13, 0.16]} />
              <meshStandardMaterial color="#2E3238" metalness={0.6} emissive="#FFC24A" emissiveIntensity={pawl * (1 - cl((t - tCut - 0.5) * 2)) * 0.9} />
            </mesh>
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.07, 0.07, 0.22, 10]} />
              <meshStandardMaterial color="#8A8F96" metalness={0.7} />
            </mesh>
          </group>
        ))}
        {/* guarda-corpo */}
        {[-1, 1].map((k) => (
          <mesh key={`r${k}`} position={[0, 0.85, k * 1.25]}>
            <boxGeometry args={[2.7, 0.07, 0.07]} />
            <meshStandardMaterial map={wood} color="#E8D3AE" />
          </mesh>
        ))}
        <mesh position={[0.85, 0.42, -0.6]} castShadow>
          <boxGeometry args={[0.8, 0.6, 0.7]} />
          <meshStandardMaterial map={wood} color="#D8BE90" />
        </mesh>
        <mesh position={[0.95, 0.35, 0.55]} castShadow>
          <cylinderGeometry args={[0.32, 0.32, 0.5, 14]} />
          <meshStandardMaterial map={wood} color="#C9A070" />
        </mesh>
        {/* o inventor (Tião de cartola e bigode) */}
        <group position={[-0.35, 0.11, 0.1]}>
          <Tiao t={t} mood={cheer > 0.3 ? "happy" : hat > 0.5 ? "shock" : "neutral"} pose="down" rotation={0.15} armLOverride={hat > 0.5 ? [0, 0, -1.35 - Math.sin(t * 6) * 0.15] : undefined} armROverride={hat > 0.5 ? [0, 0, 1.35 + Math.sin(t * 6) * 0.15] : undefined} />
          <mesh position={[0, 1.66, 0.245]}>
            <boxGeometry args={[0.26, 0.05, 0.03]} />
            <meshStandardMaterial color="#2A1E18" />
          </mesh>
          <group position={[0, 2.02 + (hat > 0.5 ? Math.abs(Math.sin(t * 8)) * 0.06 : 0), 0]}>
            <mesh position={[0, 0.25, 0]}>
              <cylinderGeometry args={[0.24, 0.24, 0.5, 16]} />
              <meshStandardMaterial color="#1E1E22" roughness={0.6} />
            </mesh>
            <mesh>
              <cylinderGeometry args={[0.38, 0.38, 0.04, 18]} />
              <meshStandardMaterial color="#1E1E22" roughness={0.6} />
            </mesh>
            <mesh position={[0, 0.08, 0]}>
              <cylinderGeometry args={[0.245, 0.245, 0.08, 16]} />
              <meshStandardMaterial color="#6E3A2A" />
            </mesh>
          </group>
        </group>
      </group>
      {/* plateia */}
      <InstM mats={cm.body} colors={cm.bodyC} geo={geos.body} max={40}>
        <meshStandardMaterial roughness={0.9} />
      </InstM>
      <InstM mats={cm.head} geo={geos.head} max={40}>
        <meshStandardMaterial color="#E9C9A6" roughness={0.8} />
      </InstM>
      <InstM mats={cm.hatM} geo={geos.hat} max={40}>
        <meshStandardMaterial color="#1E1E22" roughness={0.6} />
      </InstM>
      <InstM mats={cm.brim} geo={geos.brim} max={40}>
        <meshStandardMaterial color="#1E1E22" roughness={0.6} />
      </InstM>
      <InstM mats={cm.bonnet} geo={geos.bonnet} max={40}>
        <meshStandardMaterial color="#8E6A50" roughness={0.8} />
      </InstM>
      <InstM mats={cm.arm} geo={geos.arm} max={80}>
        <meshStandardMaterial color="#3A2E28" roughness={0.9} />
      </InstM>
    </group>
  );
};

export { RainStreaks };

// ======================================================================
const mixColorW = (a: string, b: string, p: number) => "#" + new THREE.Color(a).lerp(new THREE.Color(b), p).getHexString();

// Mascote do canal: Tião, boneco de blocos expressivo.
// Cópia do Tião com pernas que andam (legL/legR em rad), para a escada.
export const TiaoWalk: React.FC<{
  legL?: number;
  legR?: number;
  position?: [number, number, number];
  rotation?: number;
  scale?: number;
  mood?: TMood;
  pose?: TPose;
  outfit?: "casual" | "towel" | "dummy";
  cold?: number; // 0..1 tom azulado + tremedeira
  t: number; // segundos (para piscar, respirar)
  look?: [number, number]; // olhar (x,y) -1..1
  wet?: boolean;
  phone?: boolean;
  armROverride?: [number, number, number];
  armLOverride?: [number, number, number];
  sweat?: number;
  sit?: number; // 0..1 sentado
  lean?: number; // inclinação do tronco para frente (rad)
  headLean?: number; // inclinação extra da cabeça (rad)
  belt?: number; // cinto visível 0..1
  beltGlow?: number;
  shirt?: string;
  sick?: number; // 0..1 enjoado (pele esverdeada)
  hammer?: boolean; // marreta na mão direita
  helmet?: boolean; // capacete amarelo de obra
  cap?: boolean; // quepe de porteiro
  foam?: number; // espuma de sabão na cabeça 0..1
}> = ({ legL = 0, legR = 0, position = [0, 0, 0], rotation = 0, scale = 1, mood = "neutral", pose = "down", outfit = "casual", cold = 0, t, look = [0, 0], wet = false, phone = false, armROverride, armLOverride, sweat = 0, sit = 0, lean = 0, headLean = 0, belt = 0, beltGlow = 0, shirt, sick = 0, hammer = false, helmet = false, cap = false, foam = 0 }) => {
  const dummy = outfit === "dummy";
  const skin = dummy ? "#F2C94C" : mixColorW(mixColorW(C.skin, C.skinCold, cold), "#9CCB6A", sick * 0.75);
  const hair = dummy ? "#E3B63A" : C.hair;
  const shiver = cold > 0.2 ? Math.sin(t * 60) * 0.012 * cold : 0;
  const breathe = Math.sin(t * 2.2) * 0.012;
  const blink = (t * 1000) % 3400 < 120 ? 0.12 : 1;
  const torsoColor = outfit === "towel" ? skin : dummy ? "#2F3540" : shirt ?? C.shirt;
  const legColor = outfit === "towel" ? skin : dummy ? "#2F3540" : C.jeans;
  const sleeve = outfit === "towel" ? skin : dummy ? "#2F3540" : shirt ?? C.shirt;

  // braços (rotação no ombro: z abre para os lados, x levanta para frente)
  let armL: [number, number, number] = [0, 0, 0.12];
  let armR: [number, number, number] = [0, 0, -0.12];
  if (pose === "up") {
    const w = Math.sin(t * 8) * 0.12;
    armL = [0, 0, -2.35 - w];
    armR = [0, 0, 2.35 + w];
  } else if (pose === "hug") {
    armL = [-1.25, 0.0, 1.0];
    armR = [-1.25, 0.0, -1.0];
  } else if (pose === "wave") {
    armL = [0, 0, 0.12];
    armR = [0, 0, 2.5 + Math.sin(t * 9) * 0.35];
  } else if (pose === "point") {
    armL = [0, 0, 0.12];
    armR = [-1.4, 0, -0.2];
  }

  if (phone) armR = [-1.1, 0, 0.35];
  if (armROverride) armR = armROverride;
  if (armLOverride) armL = armLOverride;
  const eyeY = 1.77 + look[1] * 0.012;
  const eyeX = look[0] * 0.018;
  const happyEyes = mood === "happy" || mood === "relaxed";

  // sobrancelhas por humor
  const brow = { neutral: 0, happy: 0.1, relaxed: 0.05, cold: -0.35, shock: 0.25, sad: -0.4 }[mood];
  const browY = { neutral: 1.88, happy: 1.9, relaxed: 1.88, cold: 1.885, shock: 1.93, sad: 1.885 }[mood];

  return (
    <group position={[position[0] + shiver, position[1], position[2]]} rotation={[0, rotation, 0]} scale={scale}>
      {/* pernas (giram no quadril quando sentado) */}
      {[
        [-0.14, legL],
        [0.14, legR],
      ].map(([x, a]) => (
        <group key={x} position={[0, 0.78, 0]} rotation={[(-Math.PI / 2) * sit - a, 0, 0]}>
          <group position={[0, -0.78, 0]}>
            <RBox size={[0.24, 0.78, 0.26]} position={[x, 0.39, 0]} color={legColor} radius={0.05} />
            <RBox size={[0.26, 0.1, 0.34]} position={[x, 0.05, 0.04]} color={outfit === "towel" ? skin : C.ink} radius={0.04} />
          </group>
        </group>
      ))}
      {outfit === "towel" ? <RBox size={[0.66, 0.42, 0.36]} position={[0, 0.72, 0]} color={C.towel} radius={0.08} /> : null}

      {/* corpo de cima: gira no quadril */}
      <group position={[0, 0.78, 0]} rotation={[lean, 0, 0]}>
      <group position={[0, -0.78, 0]}>
      {/* tronco */}
      <group position={[0, 1.13 + breathe, 0]}>
        <RBox size={[0.62, 0.66, 0.34]} color={torsoColor} radius={0.09} />
        {outfit === "casual" ? <RBox size={[0.3, 0.06, 0.02]} position={[0, 0.3, 0.171]} color={"#E0A91C"} radius={0.01} /> : null}
        {dummy
          ? [-0.16, 0.16].map((x) => (
              <group key={x} position={[x, 0.12, 0.172]}>
                <mesh>
                  <circleGeometry args={[0.07, 16]} />
                  <meshStandardMaterial color="#F2C94C" />
                </mesh>
                <mesh position={[0, 0, 0.002]}>
                  <circleGeometry args={[0.07, 16, 0, Math.PI / 2]} />
                  <meshStandardMaterial color={C.ink} />
                </mesh>
                <mesh position={[0, 0, 0.002]}>
                  <circleGeometry args={[0.07, 16, Math.PI, Math.PI / 2]} />
                  <meshStandardMaterial color={C.ink} />
                </mesh>
              </group>
            ))
          : null}
        {belt > 0.01 ? (
          <group scale={[1, 1, 1]}>
            <RBox size={[0.12, 0.86, 0.04]} position={[0, 0.02, 0.19]} rotation={[0, 0, 0.72]} color="#2E3138" radius={0.02} emissive="#FFD23F" emissiveIntensity={beltGlow} />
            <RBox size={[0.68, 0.11, 0.04]} position={[0, -0.27, 0.19]} color="#2E3138" radius={0.02} emissive="#FFD23F" emissiveIntensity={beltGlow} />
            <RBox size={[0.1, 0.08, 0.05]} position={[0.26, -0.27, 0.21]} color="#A9B1B8" radius={0.02} />
          </group>
        ) : null}
      </group>

      {/* braços */}
      <group position={[-0.39, 1.38 + breathe, 0]} rotation={armL}>
        <RBox size={[0.18, 0.56, 0.2]} position={[0, -0.27, 0]} color={sleeve} radius={0.06} />
        <RBox size={[0.17, 0.15, 0.19]} position={[0, -0.6, 0]} color={skin} radius={0.06} />
      </group>
      <group position={[0.39, 1.38 + breathe, 0]} rotation={armR}>
        <RBox size={[0.18, 0.56, 0.2]} position={[0, -0.27, 0]} color={sleeve} radius={0.06} />
        <RBox size={[0.17, 0.15, 0.19]} position={[0, -0.6, 0]} color={skin} radius={0.06} />
        {phone ? <RBox size={[0.2, 0.04, 0.34]} position={[0, -0.7, 0.05]} color={C.ink} radius={0.03} emissive={"#5FF3FF"} emissiveIntensity={0.3} /> : null}
        {hammer ? (
          <group position={[0, -0.62, 0.02]}>
            <mesh position={[0, -0.42, 0]}>
              <cylinderGeometry args={[0.035, 0.04, 0.95, 8]} />
              <meshStandardMaterial map={woodTexture("#A8693E")} roughness={0.7} />
            </mesh>
            <mesh position={[0, -0.92, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <boxGeometry args={[0.2, 0.42, 0.2]} />
              <meshStandardMaterial color="#4A4F56" metalness={0.7} roughness={0.35} />
            </mesh>
          </group>
        ) : null}
      </group>

      {/* cabeça: gira no pescoço */}
      <group position={[0, 1.48, 0]} rotation={[headLean, 0, 0]}>
      <group position={[0, -1.48 + breathe * 1.2, 0]}>
        {sweat > 0.01
          ? [0, 1, 2].map((i) => {
              const u = ((t * 0.9 + i / 3) % 1 + 1) % 1;
              return (
                <mesh key={`sw${i}`} position={[i === 1 ? -0.3 : 0.3, 2.0 - u * 0.5, 0.15 + i * 0.03]} scale={[0.045 * sweat, 0.07 * sweat, 0.045 * sweat]}>
                  <sphereGeometry args={[1, 10, 8]} />
                  <meshStandardMaterial color="#7FD3FF" emissive="#7FD3FF" emissiveIntensity={0.3} transparent opacity={1 - u} />
                </mesh>
              );
            })
          : null}
        <RBox size={[0.52, 0.5, 0.46]} position={[0, 1.74, 0]} color={skin} radius={0.12} />
        {helmet ? (
          <group position={[0, 1.99, 0]}>
            <mesh>
              <sphereGeometry args={[0.31, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
              <meshStandardMaterial color="#F2C230" roughness={0.45} />
            </mesh>
            <mesh position={[0, 0.0, 0.08]}>
              <cylinderGeometry args={[0.36, 0.36, 0.03, 18]} />
              <meshStandardMaterial color="#F2C230" roughness={0.45} />
            </mesh>
          </group>
        ) : null}
        {cap ? (
          <group position={[0, 2.02, 0]}>
            <mesh>
              <cylinderGeometry args={[0.3, 0.28, 0.16, 16]} />
              <meshStandardMaterial color="#1F3A66" roughness={0.6} />
            </mesh>
            <mesh position={[0, -0.06, 0.24]} rotation={[0.25, 0, 0]}>
              <boxGeometry args={[0.36, 0.03, 0.2]} />
              <meshStandardMaterial color="#14223A" roughness={0.5} />
            </mesh>
          </group>
        ) : null}
        {foam > 0.01
          ? Array.from({ length: 9 }).map((_, i) => (
              <mesh key={`fo${i}`} position={[Math.cos(i * 2.1) * 0.2, 2.02 + (i % 3) * 0.07, Math.sin(i * 2.1) * 0.17]} scale={foam * (0.11 + (i % 4) * 0.025)}>
                <sphereGeometry args={[1, 10, 8]} />
                <meshStandardMaterial color="#FFFFFF" roughness={0.3} />
              </mesh>
            ))
          : null}
        <RBox size={[0.55, 0.14, 0.5]} position={[0, 1.98, -0.01]} color={hair} radius={0.06} />
        <RBox size={[0.55, 0.3, 0.12]} position={[0, 1.86, -0.2]} color={hair} radius={0.05} />
        {wet ? <RBox size={[0.56, 0.06, 0.52]} position={[0, 2.06, -0.01]} color={C.water} radius={0.03} opacity={0.6} /> : null}
        {/* orelhas */}
        <RBox size={[0.06, 0.12, 0.1]} position={[-0.28, 1.74, 0]} color={skin} radius={0.03} />
        <RBox size={[0.06, 0.12, 0.1]} position={[0.28, 1.74, 0]} color={skin} radius={0.03} />

        {/* olhos */}
        {[-0.11, 0.11].map((x) => (
          <group key={x} position={[x, eyeY, 0.232]}>
            {happyEyes ? (
              <mesh rotation={[0, 0, 0]} position={[0, -0.01, 0.005]}>
                <torusGeometry args={[0.045, 0.014, 6, 12, Math.PI]} />
                <meshStandardMaterial color={C.ink} />
              </mesh>
            ) : (
              <group scale={[1, mood === "shock" ? 1.25 * blink : blink, 1]}>
                <mesh>
                  <boxGeometry args={[0.105, 0.125, 0.012]} />
                  <meshStandardMaterial color="#fff" roughness={0.4} />
                </mesh>
                <mesh position={[eyeX, -0.008, 0.008]}>
                  <boxGeometry args={[0.055, 0.075, 0.01]} />
                  <meshStandardMaterial color={C.ink} roughness={0.3} />
                </mesh>
                <mesh position={[eyeX + 0.012, 0.012, 0.014]}>
                  <boxGeometry args={[0.016, 0.016, 0.004]} />
                  <meshStandardMaterial color="#fff" emissive="#fff" emissiveIntensity={0.4} />
                </mesh>
              </group>
            )}
          </group>
        ))}
        {/* sobrancelhas */}
        <mesh position={[-0.11, browY, 0.236]} rotation={[0, 0, -brow]}>
          <boxGeometry args={[0.13, 0.03, 0.012]} />
          <meshStandardMaterial color={dummy ? C.ink : C.hair} />
        </mesh>
        <mesh position={[0.11, browY, 0.236]} rotation={[0, 0, brow]}>
          <boxGeometry args={[0.13, 0.03, 0.012]} />
          <meshStandardMaterial color={dummy ? C.ink : C.hair} />
        </mesh>
        {/* boca */}
        {mood === "happy" || mood === "relaxed" ? (
          <mesh position={[0, 1.63, 0.232]} rotation={[0, 0, Math.PI]}>
            <torusGeometry args={[mood === "happy" ? 0.075 : 0.055, 0.018, 6, 14, Math.PI]} />
            <meshStandardMaterial color={C.ink} />
          </mesh>
        ) : mood === "sad" ? (
          <mesh position={[0, 1.6, 0.232]}>
            <torusGeometry args={[0.06, 0.016, 6, 14, Math.PI]} />
            <meshStandardMaterial color={C.ink} />
          </mesh>
        ) : mood === "shock" ? (
          <mesh position={[0, 1.62, 0.231]} rotation={[Math.PI / 2, 0, 0]} scale={[1, 1, 1.35]}>
            <cylinderGeometry args={[0.05, 0.05, 0.012, 16]} />
            <meshStandardMaterial color={C.ink} />
          </mesh>
        ) : mood === "cold" ? (
          <group position={[0, 1.62, 0.232]}>
            <mesh>
              <boxGeometry args={[0.16, 0.06, 0.01]} />
              <meshStandardMaterial color={C.ink} />
            </mesh>
            <mesh position={[0, 0, 0.006]}>
              <boxGeometry args={[0.14, 0.022, 0.006]} />
              <meshStandardMaterial color="#fff" />
            </mesh>
          </group>
        ) : (
          <mesh position={[0, 1.63, 0.232]}>
            <boxGeometry args={[0.13, 0.025, 0.01]} />
            <meshStandardMaterial color={C.ink} />
          </mesh>
        )}
      </group>
      </group>
      </group>
      </group>
    </group>
  );
};
