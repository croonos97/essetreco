import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import { useLayoutEffect } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { rnd } from "../World";

// =====================================================================
// KIT LAGARTIXA — peças comuns (câmera de macro, palco noturno, tubo deformável, texturas).
// Escala do kit de animais: 1 un ≈ 0,5 m  →  1 cm = 0,02 un (CM).
// Os bichos deste kit são modelados em CENTÍMETROS e o grupo raiz aplica scale = CM.
// Tudo é função pura de props/tempo (sem Math.random / Date).
// =====================================================================
export type V3 = [number, number, number];
export const CM = 0.02;
export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const mix = (a: number, b: number, p: number) => a + (b - a) * p;
export const sm = (x: number) => {
  const t = clamp01(x);
  return t * t * (3 - 2 * t);
};
export const seg01 = (t: number, a: number, b: number) => sm((t - a) / Math.max(1e-6, b - a));
export { rnd };

// ---------- câmera de macro (deriva lenta e pequena, sem tremida) ----------
export type LKey = { t: number; pos: V3; look: V3; fov?: number; lin?: boolean }; // lin: trecho linear (câmera que acompanha sem para-e-anda)
const io = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
export const amostraCam = (keys: LKey[], sec: number) => {
  if (sec <= keys[0].t) return { pos: keys[0].pos, look: keys[0].look, fov: keys[0].fov ?? 38 };
  const last = keys[keys.length - 1];
  if (sec >= last.t) return { pos: last.pos, look: last.look, fov: last.fov ?? 38 };
  let i = 0;
  while (i < keys.length - 1 && keys[i + 1].t < sec) i++;
  const a = keys[i], b = keys[i + 1];
  const u = (sec - a.t) / Math.max(b.t - a.t, 1e-3);
  const p = a.lin ? u : io(u);
  const m = (x: V3, y: V3) => x.map((v, k) => v + (y[k] - v) * p) as V3;
  return { pos: m(a.pos, b.pos), look: m(a.look, b.look), fov: (a.fov ?? 38) + ((b.fov ?? 38) - (a.fov ?? 38)) * p };
};
// deriva = amplitude da "respiração" em un (padrão 0,15 cm). Frequências < 0,2 Hz.
export const LagCam: React.FC<{ t: number; keys: LKey[]; deriva?: number; near?: number; far?: number; roll?: number }> = ({ t, keys, deriva = 0.003, near = 0.01, far = 60, roll = 0 }) => {
  const { camera } = useThree();
  useLayoutEffect(() => {
    const k = amostraCam(keys, t);
    const cam = camera as THREE.PerspectiveCamera;
    cam.position.set(k.pos[0] + Math.sin(t * 0.7) * deriva, k.pos[1] + Math.sin(t * 0.9 + 1) * deriva * 0.6, k.pos[2] + Math.cos(t * 0.6) * deriva);
    cam.fov = k.fov;
    cam.near = near;
    cam.far = far;
    cam.up.set(Math.sin(roll), Math.cos(roll), 0);
    cam.lookAt(new THREE.Vector3(...k.look));
    cam.updateProjectionMatrix();
  });
  return null;
};

// ---------- palco noturno (sem sol; a luz vem do cenário) ----------
export const PalcoNoite: React.FC<{ children: React.ReactNode; fundo?: string; exposure?: number; sombras?: boolean }> = ({ children, fundo = "#0B1020", exposure = 1.05, sombras = true }) => {
  const { width, height } = useVideoConfig();
  return (
    <AbsoluteFill style={{ background: fundo }}>
      <ThreeCanvas
        width={width}
        height={height}
        shadows={sombras}
        gl={{ antialias: true, alpha: false, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: exposure, preserveDrawingBuffer: true, localClippingEnabled: true } as never}
        onCreated={({ gl }) => {
          gl.shadowMap.type = THREE.PCFSoftShadowMap;
          gl.outputColorSpace = THREE.SRGBColorSpace;
          gl.localClippingEnabled = true;
        }}
        camera={{ fov: 38, position: [0, 2, 8] }}
      >
        <color attach="background" args={[fundo]} />
        {children}
      </ThreeCanvas>
    </AbsoluteFill>
  );
};

// Segundos absolutos dentro de um <Sequence>
export const useSeg = (from = 0) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  return from + f / fps;
};

// ---------- texturas de canvas (cache global) ----------
const cache = new Map<string, THREE.Texture>();
export const texCanvas = (key: string, w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void, srgb = true, repeat = true, flipY = true) => {
  const hit = cache.get(key);
  if (hit) return hit;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d")!, w, h);
  const tx = new THREE.CanvasTexture(c);
  if (repeat) tx.wrapS = tx.wrapT = THREE.RepeatWrapping;
  if (srgb) tx.colorSpace = THREE.SRGBColorSpace;
  tx.flipY = flipY;
  tx.anisotropy = 8;
  tx.generateMipmaps = true;
  tx.minFilter = THREE.LinearMipmapLinearFilter;
  cache.set(key, tx);
  return tx;
};
export const hex = (c: THREE.Color) => `#${c.getHexString()}`;

// ---------- frame ortonormal ----------
export type Quadro = { p: THREE.Vector3; d: THREE.Vector3; u: THREE.Vector3 }; // posição, direção (tangente), cima
export const ortoU = (u: THREE.Vector3, d: THREE.Vector3) => {
  const r = u.clone().sub(d.clone().multiplyScalar(u.dot(d)));
  if (r.lengthSq() < 1e-10) r.set(0, 1, 0).sub(d.clone().multiplyScalar(d.y));
  return r.normalize();
};

// ---------- TUBO DEFORMÁVEL com seção elíptica (corpo/rabo de bicho) ----------
// Recebe uma lista de amostras (posição, tangente, cima, meia-largura w, alturas ht/hb, s = comprimento de arco).
// A geometria tem nº fixo de anéis (alocada uma vez) e é reescrita a cada quadro.
// Atributo aS = comprimento de arco (cm) por vértice — usado por shaders (raio-x, rabo regenerado, fita).
export type Amostra = { p: THREE.Vector3; d: THREE.Vector3; u: THREE.Vector3; w: number; ht: number; hb: number; s: number };
export const novoTubo = (aneis: number, rad: number) => {
  const g = new THREE.BufferGeometry();
  const nv = aneis * (rad + 1);
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(nv * 3), 3));
  g.setAttribute("normal", new THREE.BufferAttribute(new Float32Array(nv * 3), 3));
  g.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(nv * 2), 2));
  g.setAttribute("aS", new THREE.BufferAttribute(new Float32Array(nv), 1));
  const idx: number[] = [];
  for (let i = 0; i < aneis - 1; i++)
    for (let j = 0; j < rad; j++) {
      const a = i * (rad + 1) + j, b = a + rad + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  g.setIndex(idx);
  g.userData = { aneis, rad };
  return g;
};
const _s = new THREE.Vector3();
// vLen: comprimento total de referência para a coordenada v da textura (v = s / vLen)
export const escreveTubo = (g: THREE.BufferGeometry, A: Amostra[], vLen: number, uRot = 0) => {
  const { aneis, rad } = g.userData as { aneis: number; rad: number };
  const P = g.attributes.position as THREE.BufferAttribute, U = g.attributes.uv as THREE.BufferAttribute, S = g.attributes.aS as THREE.BufferAttribute;
  for (let i = 0; i < aneis; i++) {
    const a = A[Math.min(i, A.length - 1)];
    _s.crossVectors(a.d, a.u).normalize(); // lado
    for (let j = 0; j <= rad; j++) {
      const k = i * (rad + 1) + j;
      const ang = -Math.PI / 2 + (2 * Math.PI * j) / rad + uRot;
      const sa = Math.sin(ang), ca = Math.cos(ang);
      const h = sa > 0 ? a.ht : a.hb;
      const ys = sa > 0 ? sa : -Math.pow(-sa, 0.8);
      const xs = Math.sign(ca) * Math.pow(Math.abs(ca), 0.92); // um pouco mais "quadrado" (corpo achatado)
      P.setXYZ(k, a.p.x + _s.x * a.w * xs + a.u.x * h * ys, a.p.y + _s.y * a.w * xs + a.u.y * h * ys, a.p.z + _s.z * a.w * xs + a.u.z * h * ys);
      U.setXY(k, j / rad, a.s / vLen);
      S.setX(k, a.s);
    }
  }
  P.needsUpdate = U.needsUpdate = S.needsUpdate = true;
  g.computeVertexNormals();
  // costura
  const N = g.attributes.normal as THREE.BufferAttribute;
  for (let i = 0; i < aneis; i++) {
    const a = i * (rad + 1), b = a + rad;
    const x = N.getX(a) + N.getX(b), y = N.getY(a) + N.getY(b), z = N.getZ(a) + N.getZ(b);
    const l = Math.hypot(x, y, z) || 1;
    N.setXYZ(a, x / l, y / l, z / l);
    N.setXYZ(b, x / l, y / l, z / l);
  }
  N.needsUpdate = true;
  g.computeBoundingSphere();
};

// Catmull-Rom entre pontos de junta (curva suave que passa pelas juntas)
export const catmull = (p0: THREE.Vector3, p1: THREE.Vector3, p2: THREE.Vector3, p3: THREE.Vector3, t: number, out = new THREE.Vector3()) => {
  const t2 = t * t, t3 = t2 * t;
  out.set(0, 0, 0);
  out.addScaledVector(p0, -0.5 * t3 + t2 - 0.5 * t);
  out.addScaledVector(p1, 1.5 * t3 - 2.5 * t2 + 1);
  out.addScaledVector(p2, -1.5 * t3 + 2 * t2 + 0.5 * t);
  out.addScaledVector(p3, 0.5 * t3 - 0.5 * t2);
  return out;
};

// Coloca um bicho num plano: y local = normal do plano, z local = "frente" projetada no plano.
export const noPlano = (normal: V3, frente: V3): V3 => {
  const n = new THREE.Vector3(...normal).normalize();
  const f = ortoU(new THREE.Vector3(...frente), n);
  const x = new THREE.Vector3().crossVectors(n, f);
  const m = new THREE.Matrix4().makeBasis(x, n, f);
  const e = new THREE.Euler().setFromRotationMatrix(m);
  return [e.x, e.y, e.z];
};

// Material "raio-x" com fresnel, que só aparece numa faixa de comprimento de arco [uA, uB] (atributo aS).
export const vidroRaioX = (cor = "#9FD8FF") =>
  new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { uColor: { value: new THREE.Color(cor) }, uOp: { value: 1 }, uA: { value: 0 }, uB: { value: 0 } },
    vertexShader: /* glsl */ `
      attribute float aS; varying float vS; varying vec3 vN; varying vec3 vV;
      void main(){ vS = aS; vN = normalize(normalMatrix*normal); vec4 mv = modelViewMatrix*vec4(position,1.0); vV = -mv.xyz; gl_Position = projectionMatrix*mv; }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform float uOp; uniform float uA; uniform float uB; varying float vS; varying vec3 vN; varying vec3 vV;
      void main(){
        if (vS < uA || vS > uB) discard;
        vec3 n = normalize(vN); vec3 v = normalize(vV);
        float f = pow(1.0 - abs(dot(n, v)), 2.0);
        float sp = pow(max(dot(reflect(-normalize(vec3(0.4,0.8,0.5)), n), v), 0.0), 30.0);
        vec3 c = mix(uColor*0.9, vec3(1.0), f*0.6) + sp*0.6;
        gl_FragColor = vec4(c, uOp*clamp(0.12 + 0.75*f + sp*0.6, 0.0, 1.0));
      }`,
  });

// conversões entre o espaço local de um bicho (cm) e o mundo (un)
export const matrizBicho = (position: V3 = [0, 0, 0], rotation: V3 = [0, 0, 0], escala = 1) =>
  new THREE.Matrix4().compose(new THREE.Vector3(...position), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)), new THREE.Vector3(escala * CM, escala * CM, escala * CM));
export const localParaMundo = (p: V3, position?: V3, rotation?: V3, escala = 1): V3 => new THREE.Vector3(...p).applyMatrix4(matrizBicho(position, rotation, escala)).toArray() as V3;
export const mundoParaLocal = (p: V3, position?: V3, rotation?: V3, escala = 1): V3 => new THREE.Vector3(...p).applyMatrix4(matrizBicho(position, rotation, escala).invert()).toArray() as V3;
