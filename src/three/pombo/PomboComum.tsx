import { ThreeCanvas } from "@remotion/three";
import { useMemo } from "react";
import { AbsoluteFill, getInputProps, useVideoConfig } from "remotion";
import * as THREE from "three";
import { clamp01, CupimCam, mix, rnd, seg01, sm, texCanvas } from "../cupim/CupimComum";

// =====================================================================
// KIT POMBO ("Você bebe leite de macho.") — peças comuns.
// UNIDADE: 1 un = 1 cm (como o kit do cupim). Pombo adulto ≈ 32 cm do bico à cauda.
// Humano azul (HumanoAzul, 3,5 un) entra com scale = HUMANO (50) → 175 cm.
// Tudo é função pura de props/tempo (sem Math.random / Date).
// =====================================================================
export { clamp01, mix, rnd, seg01, sm, texCanvas, CupimCam as PomboCam };
export type { V3, LKey } from "../cupim/CupimComum";
export const HUMANO = 50;

// ---------- palco de dia: exposição FIXA em todos os planos ----------
export const EXPOSICAO = 1.0;
export const PalcoDia: React.FC<{ children: React.ReactNode; fundo?: string }> = ({ children, fundo = "#E9D6B8" }) => {
  const { width, height } = useVideoConfig();
  return (
    <AbsoluteFill style={{ background: fundo }}>
      <ThreeCanvas
        width={width}
        height={height}
        shadows
        gl={{ antialias: true, alpha: false, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: EXPOSICAO, preserveDrawingBuffer: true, localClippingEnabled: true } as never}
        onCreated={({ gl }) => {
          gl.shadowMap.type = THREE.PCFSoftShadowMap;
          gl.outputColorSpace = THREE.SRGBColorSpace;
          gl.localClippingEnabled = true;
        }}
        camera={{ fov: 38, position: [0, 60, 120] }}
      >
        <color attach="background" args={[fundo]} />
        {children}
      </ThreeCanvas>
    </AbsoluteFill>
  );
};

// ---------- LUZ DO DIA: idêntica em todos os planos ----------
// Sol da tarde (direcional, ÚNICA luz com sombra, direção/intensidade fixas) + céu + rebatido do concreto.
// Só o recorte do mapa de sombra muda por plano (foco/raio).
// fim de tarde dourado: sol baixo (~21°) vindo da rua (+z), um pouco da esquerda; entra por baixo da marquise até o ninho
export const SOL_DIR = new THREE.Vector3(-0.34, 0.36, 0.87).normalize();
export const LuzDia: React.FC<{ foco?: [number, number, number]; raio?: number }> = ({ foco = [0, 15, 20], raio = 60 }) => {
  const dist = raio * 3;
  const pos: [number, number, number] = [foco[0] + SOL_DIR.x * dist, foco[1] + SOL_DIR.y * dist, foco[2] + SOL_DIR.z * dist];
  const alvo = useMemo(() => new THREE.Object3D(), []);
  alvo.position.set(...foco);
  alvo.updateMatrixWorld();
  return (
    <>
      <primitive object={alvo} />
      <hemisphereLight args={["#F1E4D2", "#8F7F6A", 1.0]} />
      <ambientLight intensity={0.22} color="#FFF6EA" />
      <directionalLight
        position={pos}
        target={alvo}
        intensity={2.5}
        color="#FFD9A6"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-raio}
        shadow-camera-right={raio}
        shadow-camera-top={raio}
        shadow-camera-bottom={-raio}
        shadow-camera-near={raio * 0.5}
        shadow-camera-far={raio * 6}
        shadow-bias={-0.0004}
        shadow-normalBias={raio * 0.0012}
        shadow-radius={3}
      />
      {/* preenchimento frio do lado da sombra (sem sombra): nenhuma face fica preta */}
      <directionalLight position={[foco[0] - 150, foco[1] + 60, foco[2] + 120]} intensity={0.45} color="#D8E4FF" />
    </>
  );
};

// ---------- geometria: loft estático (seções elípticas ao longo de uma curva) ----------
// pts: centro de cada seção; w/h: meias-dimensões (lateral/vertical do quadro); up: vetor "cima" inicial.
export type Secao = { p: THREE.Vector3; w: number; h: number; hb?: number };
export const loftGeo = (S: Secao[], rad = 16, up = new THREE.Vector3(0, 1, 0), fechar = true) => {
  const n = S.length;
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  let u = up.clone();
  const frames: { d: THREE.Vector3; u: THREE.Vector3; s: THREE.Vector3 }[] = [];
  for (let i = 0; i < n; i++) {
    const a = S[Math.max(0, i - 1)].p, b = S[Math.min(n - 1, i + 1)].p;
    const d = b.clone().sub(a).normalize();
    u = u.clone().sub(d.clone().multiplyScalar(u.dot(d)));
    if (u.lengthSq() < 1e-8) u.set(0, 0, 1);
    u.normalize();
    frames.push({ d, u: u.clone(), s: new THREE.Vector3().crossVectors(d, u).normalize() });
  }
  for (let i = 0; i < n; i++) {
    const { u: uu, s } = frames[i];
    const c = S[i];
    for (let j = 0; j <= rad; j++) {
      const ang = (2 * Math.PI * j) / rad;
      const sa = Math.sin(ang), ca = Math.cos(ang);
      const h = sa > 0 ? c.h : c.hb ?? c.h;
      pos.push(c.p.x + s.x * c.w * ca + uu.x * h * sa, c.p.y + s.y * c.w * ca + uu.y * h * sa, c.p.z + s.z * c.w * ca + uu.z * h * sa);
      uv.push(j / rad, i / (n - 1));
    }
  }
  for (let i = 0; i < n - 1; i++)
    for (let j = 0; j < rad; j++) {
      const a = i * (rad + 1) + j, b = a + rad + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  if (fechar) {
    // tampas (leque) nas duas pontas
    for (const [i, flip] of [[0, true], [n - 1, false]] as [number, boolean][]) {
      const c = pos.length / 3;
      pos.push(S[i].p.x, S[i].p.y, S[i].p.z);
      uv.push(0.5, i / (n - 1));
      for (let j = 0; j < rad; j++) {
        const a = i * (rad + 1) + j;
        if (flip) idx.push(c, a, a + 1);
        else idx.push(c, a + 1, a);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
};

// ---------- material de plumagem/pele com: iridescência por ângulo, corte de raio-x e cobertura (filhote) ----------
// uCorte: plano no mundo (xyz = normal, w = d). Tudo com dot(n,p)+d > 0 é descartado (vira fantasma).
// Iridescência: peso por faixa de v da UV [uIriA,uIriB] (pescoço) × uIri; cor verde ↔ roxo pelo ângulo de visão.
// Cobertura: se uPele=1, mistura map (pena) com uCorPele/uMapPele usando a máscara (canal R de uMask) e uCob.
export type MatAve = THREE.MeshStandardMaterial & { userData: { u: Record<string, THREE.IUniform> } };
export const CORTE_NENHUM = new THREE.Vector4(0, 0, 0, -1); // nunca descarta
// DEPURAÇÃO: --props='{"dentro":true}' pinta de MAGENTA o lado de dentro das malhas fechadas (furo/dobra aparece na hora)
export const DEBUG_DENTRO = (getInputProps() as { dentro?: boolean }).dentro === true;
export const matAve = (o: { map?: THREE.Texture; cor?: string; rough?: number; iri?: [number, number, number]; pele?: { map: THREE.Texture; mask: THREE.Texture }; side?: THREE.Side; emiss?: number }) => {
  const fechado = (o.side ?? THREE.FrontSide) === THREE.FrontSide;
  const dbg = DEBUG_DENTRO && fechado;
  const m = new THREE.MeshStandardMaterial({ map: o.map ?? null, color: o.cor ?? "#ffffff", roughness: o.rough ?? 0.78, metalness: 0, side: dbg ? THREE.DoubleSide : o.side ?? THREE.FrontSide }) as MatAve;
  const u: Record<string, THREE.IUniform> = {
    uCorte: { value: CORTE_NENHUM.clone() },
    uIri: { value: o.iri ? 1 : 0 },
    uIriA: { value: o.iri ? o.iri[0] : 0 },
    uIriB: { value: o.iri ? o.iri[1] : 0 },
    uIriF: { value: o.iri ? o.iri[2] : 0 }, // largura da borda (fade)
    uCob: { value: 1 },
    uPele: { value: o.pele ? 1 : 0 },
    uMapPele: { value: o.pele?.map ?? null },
    uMask: { value: o.pele?.mask ?? null },
  };
  m.userData.u = u;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vWPos;\nvarying vec2 vUvA;")
      .replace("#include <worldpos_vertex>", "#include <worldpos_vertex>\nvWPos = (modelMatrix * vec4(transformed,1.0)).xyz;\nvUvA = uv;");
    sh.fragmentShader = sh.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
        varying vec3 vWPos; varying vec2 vUvA;
        uniform vec4 uCorte; uniform float uIri, uIriA, uIriB, uIriF, uCob, uPele;
        uniform sampler2D uMapPele; uniform sampler2D uMask;`,
      )
      .replace("#include <clipping_planes_fragment>", "#include <clipping_planes_fragment>\nif (dot(uCorte.xyz, vWPos) + uCorte.w > 0.0) discard;")
      .replace(
        "#include <map_fragment>",
        `#include <map_fragment>
        if (uPele > 0.5) {
          vec3 pel = texture2D(uMapPele, vUvA).rgb;
          float mk = texture2D(uMask, vUvA).r;
          float k = smoothstep(mk - 0.07, mk + 0.07, uCob);
          diffuseColor.rgb = mix(pel, diffuseColor.rgb, k);
        }`,
      )
      .replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
        if (uIri > 0.0) {
          float w = smoothstep(uIriA - uIriF, uIriA + uIriF, vUvA.y) * (1.0 - smoothstep(uIriB - uIriF, uIriB + uIriF, vUvA.y));
          float fr = clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0);
          vec3 verde = vec3(0.13, 0.36, 0.24), roxo = vec3(0.36, 0.17, 0.38);
          // brilho metálico: forte de lado (pescoço), fraco de frente; base cinza-ardósia aparece
          float lado = 1.0 - fr;
          vec3 iri = mix(roxo, verde, smoothstep(0.25, 0.75, fr));
          diffuseColor.rgb = mix(diffuseColor.rgb, iri, w * uIri * mix(0.28, 0.72, smoothstep(0.1, 0.7, lado)));
        }`,
      )
      .replace("#include <dithering_fragment>", dbg ? "#include <dithering_fragment>\nif (!gl_FrontFacing) gl_FragColor = vec4(1.0, 0.0, 1.0, 1.0);" : "#include <dithering_fragment>");
  };
  m.customProgramCacheKey = () => (dbg ? "matAve2dbg" : "matAve2");
  return m;
};
export const setCorte = (ms: (MatAve | THREE.Material)[], plano: THREE.Vector4) => {
  for (const m of ms) {
    const u = (m as MatAve).userData?.u;
    if (u?.uCorte) (u.uCorte.value as THREE.Vector4).copy(plano);
  }
};

// ---------- FANTASMA (raio-x): cor única + alfa por fresnel → ordem de desenho não importa ----------
// Só é desenhado onde o material normal foi cortado (lado positivo do plano).
export const matFantasma = (cor = "#E4EEF7") =>
  new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.FrontSide,
    uniforms: { uColor: { value: new THREE.Color(cor) }, uOp: { value: 1 }, uCorte: { value: CORTE_NENHUM.clone() }, uAtivo: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec3 vN; varying vec3 vV; varying vec3 vW;
      void main(){ vN = normalize(normalMatrix*normal); vec4 w = modelMatrix*vec4(position,1.0); vW = w.xyz; vec4 mv = viewMatrix*w; vV = -mv.xyz; gl_Position = projectionMatrix*mv; }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform float uOp; uniform vec4 uCorte; uniform float uAtivo; varying vec3 vN; varying vec3 vV; varying vec3 vW;
      void main(){
        if (uAtivo < 0.5) discard;
        if (dot(uCorte.xyz, vW) + uCorte.w <= 0.0) discard;
        vec3 n = normalize(vN); vec3 v = normalize(vV);
        float f = pow(1.0 - abs(dot(n, v)), 2.0);
        gl_FragColor = vec4(uColor, uOp * clamp(0.10 + 0.70 * f, 0.0, 0.85));
      }`,
  });

// ---------- texturas utilitárias ----------
// ruído determinístico de manchas (pinta pontos suaves)
export const pontilhar = (g: CanvasRenderingContext2D, w: number, h: number, n: number, cor: string, rmin: number, rmax: number, alpha: number, seed: number) => {
  g.fillStyle = cor;
  for (let i = 0; i < n; i++) {
    const x = rnd(i, seed) * w, y = rnd(i, seed + 1) * h, r = mix(rmin, rmax, rnd(i, seed + 2));
    g.globalAlpha = alpha * (0.4 + 0.6 * rnd(i, seed + 3));
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
  g.globalAlpha = 1;
};
// escamas de pena (meia-lua) em grade defasada, cor de borda mais clara/escura
export const escamas = (g: CanvasRenderingContext2D, w: number, h: number, sx: number, sy: number, cor: string, alpha: number, seed: number) => {
  g.strokeStyle = cor;
  g.lineWidth = Math.max(1, sx * 0.08);
  for (let j = 0, y = 0; y < h + sy; j++, y += sy * 0.62)
    for (let x = (j % 2) * sx * 0.5; x < w + sx; x += sx) {
      g.globalAlpha = alpha * (0.5 + 0.5 * rnd(j * 97 + Math.floor(x), seed));
      g.beginPath();
      g.arc(x, y, sx * 0.55, 0.15 * Math.PI, 0.85 * Math.PI);
      g.stroke();
    }
  g.globalAlpha = 1;
};
export const lerpCor = (a: string, b: string, p: number) => "#" + new THREE.Color(a).lerp(new THREE.Color(b), clamp01(p)).getHexString();
export const ss = (a: number, b: number, x: number) => sm((x - a) / (b - a));
