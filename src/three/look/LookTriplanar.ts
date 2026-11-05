import * as THREE from "three";
import { carregarPBR, TexPBR } from "./LookAssets";

// =====================================================================
// TEXTURAS REAIS EM TRIPLANAR (mundo, cm) por cima dos materiais do cenário do kit — sem editar o kit.
//   cor:       diffuse *= mix(1, lum(real)/média, det)          (mantém a cor/arte do modelador)
//   rugosidade roughness = mix(roughness, real·(rough/média), rMix)
//   normal:    UDN triplanar (Ben Golus) com força nor, convertido para o espaço de visão
// Texturas: mipmaps + trilinear + anisotropia 8 (não cintilam). Nada depende do tempo.
// =====================================================================
export type Tipo = "reboco" | "concreto" | "pedra" | "asfalto" | "metal" | "madeira";
// arquivo (public/look/tex/<nome>), tamanho físico do ladrilho (cm, da Poly Haven), força da cor, rugosidade, normal
export const SETS: Record<Tipo, { nome: string; cm: number; det: number; rMix: number; nor: number }> = {
  reboco: { nome: "concrete_layers_02", cm: 200, det: 0.55, rMix: 0.6, nor: 0.9 },
  concreto: { nome: "brushed_concrete_04", cm: 200, det: 0.5, rMix: 0.6, nor: 0.8 },
  pedra: { nome: "concrete_pavement_02", cm: 180, det: 0.25, rMix: 0.5, nor: 0.5 },
  asfalto: { nome: "asphalt_06", cm: 300, det: 0.5, rMix: 0.6, nor: 1.0 },
  metal: { nome: "blue_metal_plate", cm: 120, det: 0.3, rMix: 0.5, nor: 0.5 },
  madeira: { nome: "bark_willow_02", cm: 30, det: 0.15, rMix: 0.5, nor: 0 }, // gravetos instanciados c/ escala não uniforme: normal do mundo distorcida → só cor/rugosidade
};
export type KitPBR = Record<Tipo, TexPBR>;
export const carregarKit = async (): Promise<KitPBR> => {
  const tipos = Object.keys(SETS) as Tipo[];
  const ts = await Promise.all(tipos.map((t) => carregarPBR(SETS[t].nome)));
  return Object.fromEntries(tipos.map((t, i) => [t, ts[i]])) as KitPBR;
};

// ---------- classificação automática ----------
const statsImg = new WeakMap<object, { r: number; g: number; b: number; std: number }>();
const stats = (img: CanvasImageSource & object) => {
  const hit = statsImg.get(img);
  if (hit) return hit;
  const c = document.createElement("canvas");
  c.width = c.height = 32;
  const g = c.getContext("2d")!;
  g.drawImage(img, 0, 0, 32, 32);
  const d = g.getImageData(0, 0, 32, 32).data;
  let r = 0, gg = 0, b = 0, l2 = 0;
  const n = d.length / 4;
  for (let i = 0; i < d.length; i += 4) {
    r += d[i] / 255;
    gg += d[i + 1] / 255;
    b += d[i + 2] / 255;
    const l = (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255;
    l2 += l * l;
  }
  r /= n; gg /= n; b /= n;
  const L = 0.2126 * r + 0.7152 * gg + 0.0722 * b;
  const v = { r, g: gg, b, std: Math.sqrt(Math.max(0, l2 / n - L * L)) };
  statsImg.set(img, v);
  return v;
};
export const classificar = (mesh: THREE.Mesh, m: THREE.MeshStandardMaterial, minRug: number): Tipo | null => {
  if (m.metalness >= 0.1 && !m.map) return "metal";
  if (m.roughness < minRug) return null;
  if ((mesh as THREE.InstancedMesh).isInstancedMesh && !m.map) return "madeira"; // gravetos do ninho
  let r = m.color.r, g = m.color.g, b = m.color.b, std = 0;
  // material.color é linear; leva para ~sRGB para comparar com o canvas
  const s = (x: number) => Math.pow(x, 1 / 2.2);
  r = s(r); g = s(g); b = s(b);
  const img = m.map?.image as (CanvasImageSource & object) | undefined;
  if (img && (img as HTMLCanvasElement).width) {
    const st = stats(img);
    r *= st.r; g *= st.g; b *= st.b; std = st.std;
  }
  const L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  const sat = mx > 0 ? (mx - mn) / mx : 0;
  if (std > 0.17) return "pedra"; // pedra portuguesa (ondas claro/escuro)
  if (L < 0.36 && sat < 0.15) return "asfalto";
  if (g > r && sat > 0.3) return null; // folhagem
  if (r > g && sat > 0.38) return L < 0.5 ? "madeira" : null; // tronco/ninho escuro; telha (viva) fica como está
  if (r > g && L < 0.5 && sat > 0.2) return "madeira"; // fundo do ninho
  if (sat < 0.1) return "concreto";
  return "reboco";
};

// ---------- shader ----------
const VTX_DECL = /* glsl */ `varying vec3 vTpW; varying vec3 vTpN;`;
const VTX_BODY = /* glsl */ `
{
  vec4 tpP = vec4(transformed, 1.0);
  vec3 tpN = objectNormal;
  #ifdef USE_INSTANCING
    tpP = instanceMatrix * tpP;
    tpN = mat3(instanceMatrix) * tpN;
  #endif
  vTpW = (modelMatrix * tpP).xyz;
  vTpN = normalize(mat3(modelMatrix) * tpN);
}`;
const FRAG_DECL = /* glsl */ `
varying vec3 vTpW; varying vec3 vTpN;
uniform sampler2D tpDif, tpNor, tpRou;
uniform float tpEsc, tpDet, tpDifM, tpRMix, tpRouM, tpNorF;
vec3 tpPesos(vec3 n){ vec3 w = pow(abs(n), vec3(4.0)); return w / (w.x + w.y + w.z); }
vec4 tpAmostra(sampler2D t, vec3 p, vec3 w){
  return texture2D(t, p.zy * tpEsc) * w.x + texture2D(t, p.xz * tpEsc) * w.y + texture2D(t, p.xy * tpEsc) * w.z;
}`;
const FRAG_MAP = /* glsl */ `
{
  vec3 tpw = tpPesos(normalize(vTpN));
  vec3 d = tpAmostra(tpDif, vTpW, tpw).rgb;
  float l = dot(d, vec3(0.2126, 0.7152, 0.0722)) / max(tpDifM, 1e-3);
  diffuseColor.rgb *= clamp(mix(1.0, l, tpDet), 0.35, 1.8);
}`;
const FRAG_ROUGH = /* glsl */ `
{
  vec3 tpw = tpPesos(normalize(vTpN));
  float r = tpAmostra(tpRou, vTpW, tpw).g / max(tpRouM, 1e-3);
  roughnessFactor = clamp(mix(roughnessFactor, roughnessFactor * r, tpRMix), 0.05, 1.0);
}`;
const FRAG_NORMAL = /* glsl */ `
if (tpNorF > 0.0) {
  vec3 N = normalize(vTpN);
  vec3 tpw = tpPesos(N);
  vec3 p = vTpW * tpEsc;
  vec2 nx = (texture2D(tpNor, p.zy).xy * 2.0 - 1.0) * tpNorF;
  vec2 ny = (texture2D(tpNor, p.xz).xy * 2.0 - 1.0) * tpNorF;
  vec2 nz = (texture2D(tpNor, p.xy).xy * 2.0 - 1.0) * tpNorF;
  // UDN: soma as derivadas de cada projeção à normal do mundo
  vec3 wx = vec3(N.x, nx.y + N.y, nx.x + N.z);
  vec3 wy = vec3(ny.x + N.x, N.y, ny.y + N.z);
  vec3 wz = vec3(nz.x + N.x, nz.y + N.y, N.z);
  vec3 wn = normalize(wx * tpw.x + wy * tpw.y + wz * tpw.z);
  vec3 vn = normalize((viewMatrix * vec4(wn, 0.0)).xyz);
  // se a perturbação virar para trás da normal da geometria, mantém a da geometria (nunca inverte → sem manchas pretas)
  normal = dot(vn, normal) > 0.2 ? vn : normal;
}`;

const FEITOS = new WeakSet<THREE.Material>();
const patch = (m: THREE.MeshStandardMaterial, tx: TexPBR, cfg: (typeof SETS)[Tipo], forca: number, tipo: Tipo) => {
  if (FEITOS.has(m)) return;
  FEITOS.add(m);
  const u = {
    tpDif: { value: tx.dif },
    tpNor: { value: tx.nor },
    tpRou: { value: tx.rou },
    tpEsc: { value: 1 / cfg.cm },
    tpDet: { value: cfg.det * forca },
    tpDifM: { value: tx.difMedia },
    tpRMix: { value: cfg.rMix * forca },
    tpRouM: { value: tx.rouMedia },
    tpNorF: { value: cfg.nor * forca },
  };
  const antes = m.onBeforeCompile;
  m.onBeforeCompile = (sh, r) => {
    antes?.call(m, sh, r);
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\n" + VTX_DECL).replace("#include <worldpos_vertex>", "#include <worldpos_vertex>\n" + VTX_BODY);
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "#include <common>\n" + FRAG_DECL)
      .replace("#include <map_fragment>", "#include <map_fragment>\n" + FRAG_MAP)
      .replace("#include <roughnessmap_fragment>", "#include <roughnessmap_fragment>\n" + FRAG_ROUGH)
      .replace("#include <normal_fragment_maps>", "#include <normal_fragment_maps>\n" + FRAG_NORMAL);
  };
  const k0 = m.customProgramCacheKey.bind(m);
  m.customProgramCacheKey = () => `${k0()}|tp3`;
  m.userData.lookTipo = tipo;
  m.needsUpdate = true;
};

export const aplicarTriplanar = (raiz: THREE.Object3D, kit: KitPBR, minRug: number, forca: number) => {
  raiz.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const ms = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const mm of ms) {
      const m = mm as THREE.MeshStandardMaterial;
      if (!m || !m.isMeshStandardMaterial || FEITOS.has(m) || (m.userData as { u?: unknown }).u) continue;
      if ((m as THREE.Material).transparent) continue;
      const tipo = classificar(mesh, m, minRug);
      if (!tipo) {
        FEITOS.add(m);
        continue;
      }
      patch(m, kit[tipo], SETS[tipo], forca, tipo);
    }
  });
};
