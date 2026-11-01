import { useThree } from "@react-three/fiber";
import { useMemo } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { getInputProps } from "remotion";
import { rnd } from "../World";

// =====================================================================
// KIT ANIMAIS — peças comuns
// Escala do kit: 1 unidade ≈ 0,5 m. Ornitorrinco adulto ≈ 1 unidade do bico ao rabo.
// Tudo é função pura de props/tempo (sem Math.random / Date).
// =====================================================================

export type V3 = [number, number, number];
// Qualidade global (input props do render): --props='{"peloMult":0.5}' reduz as cascas de pelo.
const IP = getInputProps() as { peloMult?: number };
export const KIT = { peloMult: typeof IP.peloMult === "number" ? IP.peloMult : 1 };
export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const mix = (a: number, b: number, p: number) => a + (b - a) * p;
export const smooth01 = (x: number) => {
  const t = clamp01(x);
  return t * t * (3 - 2 * t);
};

// ---------- reflexo (olhos/bico/vidro brilhantes como na referência) ----------
const envCache = new WeakMap<THREE.WebGLRenderer, THREE.Texture>();
export const useEnv = () => {
  const gl = useThree((s) => s.gl);
  return useMemo(() => {
    const hit = envCache.get(gl);
    if (hit) return hit;
    const pm = new THREE.PMREMGenerator(gl);
    const tx = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    pm.dispose();
    envCache.set(gl, tx);
    return tx;
  }, [gl]);
};

// ---------- geometria por perfil (corpo liso de bicho) ----------
// keys: [z, meiaLargura, alturaCima, alturaBaixo, yCentro?] ao longo do eixo z (frente = +z).
export type PKey = [number, number, number, number, number?];
const hermite = (keys: PKey[], z: number, idx: number) => {
  let i = 0;
  while (i < keys.length - 2 && keys[i + 1][0] < z) i++;
  const a = keys[i], b = keys[i + 1];
  const p0 = keys[Math.max(0, i - 1)], p3 = keys[Math.min(keys.length - 1, i + 2)];
  const t = clamp01((z - a[0]) / Math.max(1e-6, b[0] - a[0]));
  const va = (a[idx] as number) ?? 0, vb = (b[idx] as number) ?? 0;
  const v0 = (p0[idx] as number) ?? 0, v3 = (p3[idx] as number) ?? 0;
  const m1 = (vb - v0) * 0.5, m2 = (v3 - va) * 0.5;
  const t2 = t * t, t3 = t2 * t;
  return (2 * t3 - 3 * t2 + 1) * va + (t3 - 2 * t2 + t) * m1 + (-2 * t3 + 3 * t2) * vb + (t3 - t2) * m2;
};
export const perfilGeo = (keys: PKey[], opts: { seg?: number; rad?: number; edge?: number; pow?: number; capFront?: number; capBack?: number } = {}) => {
  const { seg = 56, rad = 40, edge = 0.14, pow = 0.5, capFront = 1, capBack = 1 } = opts;
  const z0 = keys[0][0], z1 = keys[keys.length - 1][0];
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  for (let i = 0; i <= seg; i++) {
    const s = 0.5 - 0.5 * Math.cos((Math.PI * i) / seg);
    const z = z0 + (z1 - z0) * s;
    const w = Math.max(0, hermite(keys, z, 1));
    const ht = Math.max(0, hermite(keys, z, 2));
    const hb = Math.max(0, hermite(keys, z, 3));
    const yc = hermite(keys, z, 4);
    // arredonda as pontas
    const eb = Math.pow(clamp01(s / edge), pow), ef = Math.pow(clamp01((1 - s) / edge), pow);
    const env = mix(1, eb, capBack) * mix(1, ef, capFront);
    for (let j = 0; j <= rad; j++) {
      const a = -Math.PI / 2 + (2 * Math.PI * j) / rad; // começa embaixo (costura escondida na barriga)
      const sa = Math.sin(a), ca = Math.cos(a);
      const h = sa > 0 ? ht : hb;
      const ys = sa > 0 ? sa : -Math.pow(-sa, 0.85); // barriga um pouco mais chata
      pos.push(w * ca * env, yc + h * ys * env, z);
      uv.push(j / rad, s);
    }
  }
  const row = rad + 1;
  for (let i = 0; i < seg; i++)
    for (let j = 0; j < rad; j++) {
      const a = i * row + j, b = a + row;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  // costura: média das normais da primeira e última coluna
  const n = g.attributes.normal as THREE.BufferAttribute;
  for (let i = 0; i <= seg; i++) {
    const a = i * row, b = i * row + rad;
    const x = n.getX(a) + n.getX(b), y = n.getY(a) + n.getY(b), z = n.getZ(a) + n.getZ(b);
    const l = Math.hypot(x, y, z) || 1;
    n.setXYZ(a, x / l, y / l, z / l);
    n.setXYZ(b, x / l, y / l, z / l);
  }
  // pontas: normal apontando para fora no eixo
  for (let j = 0; j <= rad; j++) {
    n.setXYZ(j, 0, 0, -1);
    n.setXYZ(seg * row + j, 0, 0, 1);
  }
  return g;
};

// ---------- texturas procedurais (canvas) ----------
const texCache = new Map<string, THREE.Texture>();
const canvasTex = (key: string, w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, srgb = true) => {
  if (texCache.has(key)) return texCache.get(key)!;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d")!);
  const tx = new THREE.CanvasTexture(c);
  tx.wrapS = tx.wrapT = THREE.RepeatWrapping;
  if (srgb) tx.colorSpace = THREE.SRGBColorSpace;
  tx.anisotropy = 4;
  texCache.set(key, tx);
  return tx;
};
const hex = (c: THREE.Color) => `#${c.getHexString()}`;

// Pelo: degradê dorso→barriga em u (u=0/1 barriga, u=0.5 dorso) + milhares de fios curtos.
export const furTexture = (dorso: string, ventre: string, seed = 1, fios = 9000) =>
  canvasTex(`fur${dorso}${ventre}${seed}${fios}`, 512, 512, (g) => {
    const cd = new THREE.Color(dorso), cv = new THREE.Color(ventre);
    for (let x = 0; x < 512; x += 2) {
      const u = x / 512;
      const k = smooth01((Math.abs(u - 0.5) * 2 - 0.45) / 0.4); // 0 dorso, 1 barriga
      const c = cd.clone().lerp(cv, k);
      g.fillStyle = hex(c);
      g.fillRect(x, 0, 2, 512);
    }
    for (let i = 0; i < fios; i++) {
      const x = rnd(i, seed) * 512, y = rnd(i, seed + 1) * 512;
      const u = x / 512;
      const k = smooth01((Math.abs(u - 0.5) * 2 - 0.45) / 0.4);
      const c = cd.clone().lerp(cv, k);
      c.offsetHSL(0, 0, (rnd(i, seed + 2) - 0.5) * 0.16);
      g.strokeStyle = hex(c);
      g.globalAlpha = 0.55;
      g.lineWidth = 1 + rnd(i, seed + 3) * 1.4;
      const L = 5 + rnd(i, seed + 4) * 9;
      const a = Math.PI / 2 + (rnd(i, seed + 5) - 0.5) * 0.6; // fios deitados para trás (v)
      g.beginPath();
      g.moveTo(x, y);
      g.quadraticCurveTo(x + Math.cos(a) * L * 0.5 + 1.5, y - Math.sin(a) * L * 0.5, x + Math.cos(a) * L, y - Math.sin(a) * L);
      g.stroke();
    }
    g.globalAlpha = 1;
  });

// Pele lisa com poros (bico, patas, filhote pelado).
export const skinTexture = (base: string, seed = 3, poros = 2600, contraste = 0.08) =>
  canvasTex(`skin${base}${seed}${poros}${contraste}`, 256, 256, (g) => {
    g.fillStyle = base;
    g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < poros; i++) {
      const c = new THREE.Color(base);
      c.offsetHSL(0, 0, (rnd(i, seed) - 0.5) * contraste * 2);
      g.fillStyle = hex(c);
      g.globalAlpha = 0.6;
      const r = 0.6 + rnd(i, seed + 1) * 1.6;
      g.beginPath();
      g.arc(rnd(i, seed + 2) * 256, rnd(i, seed + 3) * 256, r, 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;
  });

// Relevo (bump) granulado para pele/bico.
export const bumpTexture = (seed = 5, n = 5000) =>
  canvasTex(`bump${seed}${n}`, 256, 256, (g) => {
    g.fillStyle = "#808080";
    g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < n; i++) {
      const v = Math.floor(90 + rnd(i, seed) * 90);
      g.fillStyle = `rgb(${v},${v},${v})`;
      g.beginPath();
      g.arc(rnd(i, seed + 1) * 256, rnd(i, seed + 2) * 256, 0.7 + rnd(i, seed + 3) * 1.5, 0, Math.PI * 2);
      g.fill();
    }
  }, false);

// ---------- PELO EM CAMADAS (shell fur) ----------
// O corpo é desenhado 1 vez com a textura de pelo e mais N "cascas" deslocadas pela normal
// (uma só draw call instanciada). Cada casca descarta o que não é fio → silhueta peluda real.
export type FurOpts = {
  map?: THREE.Texture;
  color?: string;
  len?: number; // comprimento do fio (unidades)
  dens?: number; // fios por unidade
  flow?: V3; // direção em que o pelo deita (espaço do objeto)
  rough?: number;
  rootDark?: number; // escurecimento na raiz (0..1)
  tip?: number; // clareamento da ponta
  clump?: number; // espessura do fio (0.3..0.6)
};
type FurU = { uGlow: { value: number }; uGlowC: { value: THREE.Color }; uScl: { value: number }; uLen: { value: number }; uDens: { value: number }; uN: { value: number }; uDissolve: { value: number }; uFlow: { value: THREE.Vector3 }; uRoot: { value: number }; uTip: { value: number }; uClump: { value: number } };

const FUR_HEAD = /* glsl */ `
uniform float uGlow; uniform vec3 uGlowC; uniform float uLen; uniform float uDens; uniform float uScl; uniform float uN; uniform float uDissolve; uniform vec3 uFlow; uniform float uRoot; uniform float uTip; uniform float uClump;
varying float vSh; varying vec3 vFP; varying vec3 vNo;
float fh(vec3 p){ p = fract(p*0.3183099+vec3(0.71,0.113,0.419)); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
`;
const patchFur = (m: THREE.Material, u: FurU, shell: boolean) => {
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = FUR_HEAD + sh.vertexShader.replace(
      "#include <begin_vertex>",
      `#include <begin_vertex>
       vec3 scW = vec3(length(modelMatrix[0].xyz), length(modelMatrix[1].xyz), length(modelMatrix[2].xyz)) / uScl;
       vFP = position * scW * uDens; vNo = normalize(objectNormal * scW);
       ${shell ? "vSh = (uN - float(gl_InstanceID)) / uN; transformed += (objectNormal * vSh * uLen + uFlow * vSh * vSh * uLen) / scW;" : "vSh = 0.0;"}`,
    );
    sh.fragmentShader = FUR_HEAD + sh.fragmentShader
      .replace(
        "#include <clipping_planes_fragment>",
        `#include <clipping_planes_fragment>
         if (uDissolve > 0.0 && fh(floor(vFP*0.35)) < uDissolve*1.05) discard;
         ${shell ? `vec3 cc = floor(vFP); vec3 ff = fract(vFP); vec3 jj = vec3(fh(cc), fh(cc+3.1), fh(cc+7.7));
         vec3 dv = ff - (0.3 + 0.4*jj); vec3 nn = normalize(vNo); dv -= dot(dv, nn) * nn;
         float d = length(dv);
         float rr = uClump * (1.0 - vSh) * (0.55 + 0.45*jj.x);
         if (d > rr) discard;` : ""}`,
      )
      .replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
         if (uGlow > 0.0) { float ventre = smoothstep(0.25, -0.55, normalize(vNo).y); totalEmissiveRadiance += uGlowC * uGlow * mix(0.45, 1.35, ventre) * (0.08 + 2.2 * pow(dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11)), 1.6)); }`,
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
         ${shell ? "float vv = fh(floor(vFP)+1.3); diffuseColor.rgb *= mix(1.0 - uRoot, 1.0 + uTip, vSh) * (0.88 + 0.24*vv);" : "diffuseColor.rgb *= (1.0 - uRoot);"}`,
      );
  };
  m.customProgramCacheKey = () => (shell ? "furShell" : "furBase");
};

export type FurMat = { base: THREE.MeshStandardMaterial; shell: THREE.MeshLambertMaterial; u: FurU };
export const makeFur = (o: FurOpts): FurMat => {
  const u: FurU = {
    uGlow: { value: 0 },
    uGlowC: { value: new THREE.Color("#33FFD2") },
    uScl: { value: 1 },
    uLen: { value: o.len ?? 0.02 },
    uDens: { value: o.dens ?? 260 },
    uN: { value: 12 },
    uDissolve: { value: 0 },
    uFlow: { value: new THREE.Vector3(...(o.flow ?? [0, -0.25, -0.6])) },
    uRoot: { value: o.rootDark ?? 0.35 },
    uTip: { value: o.tip ?? 0.12 },
    uClump: { value: o.clump ?? 0.42 },
  };
  const params = { map: o.map ?? null, color: o.map ? "#FFFFFF" : o.color ?? "#7A5234", roughness: o.rough ?? 0.92 };
  const base = new THREE.MeshStandardMaterial(params);
  // cascas em Lambert: ~3× mais barato que PBR e quase igual em fio fino
  const shell = new THREE.MeshLambertMaterial({ map: params.map, color: params.color });
  patchFur(base, u, false);
  patchFur(shell, u, true);
  return { base, shell, u };
};
export const useFur = (o: FurOpts, deps: unknown[]) => useMemo(() => makeFur(o), deps); // eslint-disable-line

// Malha peluda: corpo + cascas instanciadas. `shells` = 0 desliga o pelo (filhote pelado / economia).
export const Furry: React.FC<{
  geo: THREE.BufferGeometry;
  fur: FurMat;
  shells?: number;
  dissolve?: number;
  visible?: boolean;
  castShadow?: boolean;
  position?: V3;
  rotation?: V3;
  scale?: number | V3;
}> = ({ geo, fur, shells = 12, dissolve = 0, visible = true, castShadow = true, position, rotation, scale }) => {
  // cada malha tem o próprio material de cascas (uN = nº de cascas desta malha); a casca de fora é
  // desenhada primeiro (instância 0) e esconde as de dentro pelo teste de profundidade
  fur.u.uDissolve.value = dissolve;
  const shellMat = useMemo(() => {
    const m = new THREE.MeshLambertMaterial({ map: fur.base.map, color: fur.base.color });
    patchFur(m, { ...fur.u, uN: { value: Math.max(1, shells) } }, true);
    return m;
  }, [fur, shells]);
  if (!visible || dissolve >= 1) return null;
  return (
    <group position={position} rotation={rotation} scale={scale as never}>
      <mesh geometry={geo} material={fur.base} castShadow={castShadow} receiveShadow />
      {shells > 0 ? <instancedMesh key={shells} args={[geo, shellMat, shells]} frustumCulled={false} /> : null}
    </group>
  );
};

// ---------- VIDRO "RAIO-X" (humano translúcido / bicho por dentro) ----------
export const makeGlass = (color = "#8FD3FF", opacity = 1) =>
  new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.FrontSide,
    uniforms: { uColor: { value: new THREE.Color(color) }, uOp: { value: opacity }, uRim: { value: new THREE.Color("#FFFFFF") } },
    vertexShader: /* glsl */ `
      varying vec3 vN; varying vec3 vV;
      #include <common>
      void main(){
        vec4 p = vec4(position,1.0);
        #ifdef USE_INSTANCING
          p = instanceMatrix * p;
          vN = normalize(normalMatrix * mat3(instanceMatrix) * normal);
        #else
          vN = normalize(normalMatrix * normal);
        #endif
        vec4 mv = modelViewMatrix * p; vV = -mv.xyz; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform float uOp; uniform vec3 uRim; varying vec3 vN; varying vec3 vV;
      void main(){
        vec3 n = normalize(vN); vec3 v = normalize(vV);
        float f = pow(1.0 - abs(dot(n, v)), 2.2);
        vec3 L = normalize(vec3(0.4, 0.8, 0.5));
        float sp = pow(max(dot(reflect(-L, n), v), 0.0), 36.0);
        float sp2 = pow(max(dot(reflect(-normalize(vec3(-0.6,0.3,0.6)), n), v), 0.0), 18.0) * 0.35;
        vec3 c = mix(uColor * 0.95, uRim, f * 0.55) + (sp + sp2) * 0.9;
        float a = uOp * clamp(0.2 + 0.72 * f + sp * 0.8, 0.0, 1.0);
        gl_FragColor = vec4(c, a);
      }`,
  });
export const useGlass = (color: string, opacity: number) => {
  const m = useMemo(() => makeGlass(color), [color]);
  m.uniforms.uOp.value = opacity;
  return m;
};

// Volume que "enche" de baixo pra cima (nível 0..1 da altura local yMin..yMax).
export const makeFill = (color = "#FFD23F") =>
  new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { uColor: { value: new THREE.Color(color) }, uLevel: { value: 0 }, uY0: { value: -0.1 }, uY1: { value: 0.2 }, uT: { value: 0 } },
    vertexShader: `varying vec3 vP; varying vec3 vN; varying vec3 vV; void main(){ vP = position; vN = normalize(normalMatrix*normal); vec4 mv = modelViewMatrix*vec4(position,1.0); vV=-mv.xyz; gl_Position = projectionMatrix*mv; }`,
    fragmentShader: `uniform vec3 uColor; uniform float uLevel; uniform float uY0; uniform float uY1; uniform float uT; varying vec3 vP; varying vec3 vN; varying vec3 vV;
      void main(){ float y = (vP.y - uY0)/(uY1-uY0); float wave = 0.015*sin(vP.z*40.0 + uT*5.0);
        if (y > uLevel + wave) discard;
        float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 1.5);
        float top = smoothstep(uLevel-0.04, uLevel, y);
        gl_FragColor = vec4(uColor*(0.85+0.4*f) + top*0.35, 0.78); }`,
  });

// Brilho emissivo de "destaque" (quando a narração nomeia o traço).
export const glowPulse = (t: number, at: number, dur = 0.7) => {
  const x = (t - at) / dur;
  if (x < 0 || x > 1) return 0;
  return Math.sin(x * Math.PI);
};

// Gotinha (forma de lágrima) — veneno, leite, água.
export const dropGeo = (() => {
  let g: THREE.BufferGeometry | null = null;
  return () => {
    if (g) return g;
    const pts: THREE.Vector2[] = [];
    for (let i = 0; i <= 16; i++) {
      // ponta para cima (y=+1), fundo redondo (y=-1)
      const a = Math.PI - (i / 16) * Math.PI;
      const r = Math.sin(a) * Math.pow(Math.sin(a / 2), 1.6);
      pts.push(new THREE.Vector2(Math.max(0.0001, r), Math.cos(a)));
    }
    g = new THREE.LatheGeometry(pts, 16);
    return g;
  };
})();
