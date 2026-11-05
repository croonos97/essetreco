import { useLayoutEffect, useRef } from "react";
import { useRecurso } from "./LookAssets";
import { aplicarTriplanar, carregarKit, KitPBR } from "./LookTriplanar";
import * as THREE from "three";

// =====================================================================
// MATERIAIS DO LOOK — guia + "upgrade" em tempo de montagem (não edita os arquivos do modelador).
//
// <LookAve>…</LookAve>  envolve qualquer ave do kit (Pombo, Filhote, Falcao, Carcara). A cada render percorre o grupo
// e troca, UMA vez por material (cache), o MeshStandardMaterial por um MeshPhysicalMaterial equivalente:
//   • PENAS (matAve com textura e rugosidade ≥ 0,75): sheen (veludo) → brilho rasante nas bordas, lê como pena,
//     não como plástico. sheenColor ≈ cor clara fria da pena; sheenRoughness 0,5.
//   • PESCOÇO IRIDESCENTE (matAve com uIri = 1): MeshPhysicalMaterial.iridescence = 1, IOR 1,5, espessura
//     250–750 nm, restrita à faixa do pescoço por uma iridescenceMap gerada da mesma faixa de UV (uIriA…uIriB)
//     que o shader do kit usa → verde/roxo muda com o ângulo de visão DE VERDADE (filme fino), por cima da tinta do kit.
//   • OLHO (MeshStandard liso, rugosidade < 0,25, sem shader do kit): clearcoat 1 → reflexo do céu/sol (catchlight).
// O onBeforeCompile e os uniforms do kit (corte do raio-x, pele/pena, iridescência falsa) são preservados:
// o novo material reaproveita o MESMO objeto userData.u, então setCorte() do kit continua funcionando.
//
// <LookConcreto>…</LookConcreto> dá variação de rugosidade (0,72–1,0) a superfícies foscas (rugosidade ≥ 0,85, sem
// roughnessMap): o sol rasante passa a desenhar a textura do concreto/reboco em vez de um plano uniforme.
//
// GUIA rápido para modelagem nova (quando o modelador puder adotar direto):
//   pena:   new MeshPhysicalMaterial({ map, roughness: 0.8, sheen: 0.6, sheenColor: "#C9D3E4", sheenRoughness: 0.5 })
//   pescoço:new MeshPhysicalMaterial({ map, roughness: 0.45, iridescence: 1, iridescenceIOR: 1.5,
//             iridescenceThicknessRange: [250, 750], iridescenceMap: <máscara da faixa> })
//   olho:   new MeshPhysicalMaterial({ map, roughness: 0.15, clearcoat: 1, clearcoatRoughness: 0.04 })
//   bico/pé:roughness 0.45–0.55, clearcoat 0.3 (córneo levemente úmido)
//   concreto/reboco: roughness 0.9 + roughnessMap de ruído (texRugosidade) e, se possível, normalMap suave.
// =====================================================================
type U = Record<string, THREE.IUniform>;
const ehMatAve = (m: THREE.Material): m is THREE.MeshStandardMaterial & { userData: { u: U } } =>
  (m as THREE.MeshStandardMaterial).isMeshStandardMaterial === true && !!(m.userData as { u?: U })?.u?.uCorte;

const mascaraIri = (a: number, b: number, f: number) => {
  const c = document.createElement("canvas");
  c.width = 4;
  c.height = 256;
  const g = c.getContext("2d")!;
  for (let y = 0; y < 256; y++) {
    const v = 1 - (y + 0.5) / 256; // flipY: linha 0 = v 1
    const s = (x: number, e0: number, e1: number) => {
      const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
      return t * t * (3 - 2 * t);
    };
    const w = s(v, a - f, a + f) * (1 - s(v, b - f, b + f));
    const k = Math.round(w * 255);
    g.fillStyle = `rgb(${k},${k},${k})`;
    g.fillRect(0, y, 4, 1);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.NoColorSpace;
  return t;
};

export type OpcoesAve = { sheen?: number; sheenCor?: string; iridescencia?: number; olhoClearcoat?: number };
const paraFisico = (m: THREE.MeshStandardMaterial, o: Required<OpcoesAve>): THREE.Material => {
  const p = new THREE.MeshPhysicalMaterial();
  THREE.MeshStandardMaterial.prototype.copy.call(p, m);
  p.defines = { STANDARD: "", PHYSICAL: "" };
  p.userData = m.userData; // mesmos uniforms do kit (corte etc.)
  p.onBeforeCompile = m.onBeforeCompile;
  const chave = m.customProgramCacheKey();
  const u = (m.userData as { u?: U }).u;
  const pena = !!u && !!m.map && m.roughness >= 0.75;
  const iri = !!u && (u.uIri?.value as number) > 0;
  if (pena) {
    p.sheen = o.sheen;
    p.sheenColor = new THREE.Color(o.sheenCor);
    p.sheenRoughness = 0.5;
  }
  if (iri && o.iridescencia > 0) {
    p.iridescence = o.iridescencia;
    p.iridescenceIOR = 1.5;
    p.iridescenceThicknessRange = [250, 750];
    p.iridescenceMap = mascaraIri(u!.uIriA.value as number, u!.uIriB.value as number, (u!.uIriF.value as number) || 0.05);
  }
  if (!u && m.roughness < 0.25) {
    p.clearcoat = o.olhoClearcoat;
    p.clearcoatRoughness = 0.04;
  }
  p.customProgramCacheKey = () => `${chave}|look|${pena ? "s" : ""}${iri ? "i" : ""}`;
  p.needsUpdate = true;
  return p;
};

const trocar = (raiz: THREE.Object3D, cache: WeakMap<THREE.Material, THREE.Material>, f: (m: THREE.Material) => THREE.Material | null) => {
  raiz.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const subst = (m: THREE.Material) => {
      if (cache.has(m)) return cache.get(m)!;
      for (const novo of [m]) {
        const r = f(novo);
        if (r) {
          cache.set(m, r);
          cache.set(r, r);
          return r;
        }
      }
      cache.set(m, m);
      return m;
    };
    if (Array.isArray(mesh.material)) mesh.material = mesh.material.map(subst);
    else if (mesh.material) mesh.material = subst(mesh.material);
  });
};

const CACHE_AVE = new WeakMap<THREE.Material, THREE.Material>();
export const LookAve: React.FC<{ children: React.ReactNode } & OpcoesAve> = ({ children, sheen = 0.6, sheenCor = "#C9D3E4", iridescencia = 1, olhoClearcoat = 1 }) => {
  const g = useRef<THREE.Group>(null);
  const o = { sheen, sheenCor, iridescencia, olhoClearcoat };
  useLayoutEffect(() => {
    if (!g.current) return;
    trocar(g.current, CACHE_AVE, (m) => {
      const s = m as THREE.MeshStandardMaterial;
      if (!s.isMeshStandardMaterial || (m as THREE.MeshPhysicalMaterial).isMeshPhysicalMaterial) return null;
      if (ehMatAve(m) || s.roughness < 0.25) return paraFisico(s, o);
      return null;
    });
  });
  return <group ref={g}>{children}</group>;
};

// ---------- concreto / reboco: variação de rugosidade ----------
let _rug: THREE.CanvasTexture | null = null;
export const texRugosidade = () => {
  if (_rug) return _rug;
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d")!;
  g.fillStyle = "rgb(235,235,235)";
  g.fillRect(0, 0, 256, 256);
  // ruído determinístico (hash), em 3 escalas: manchas grandes de desgaste + grão
  const h = (i: number) => {
    const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  };
  for (let i = 0; i < 60; i++) {
    const v = 185 + Math.round(h(i) * 50);
    g.fillStyle = `rgba(${v},${v},${v},0.35)`;
    g.beginPath();
    g.arc(h(i + 1000) * 256, h(i + 2000) * 256, 10 + h(i + 3000) * 40, 0, Math.PI * 2);
    g.fill();
  }
  for (let i = 0; i < 6000; i++) {
    const v = 175 + Math.round(h(i + 9000) * 80);
    g.fillStyle = `rgba(${v},${v},${v},0.5)`;
    g.fillRect(h(i + 5000) * 256, h(i + 7000) * 256, 1 + h(i + 8000) * 2, 1 + h(i + 8500) * 2);
  }
  _rug = new THREE.CanvasTexture(c);
  _rug.colorSpace = THREE.NoColorSpace;
  _rug.wrapS = _rug.wrapT = THREE.RepeatWrapping;
  return _rug;
};
const CACHE_CONC = new WeakMap<THREE.Material, THREE.Material>();
// fallback antigo: só variação de rugosidade procedural (sem arquivos)
const concretoProcedural = (raiz: THREE.Object3D, minRugosidade: number) =>
  trocar(raiz, CACHE_CONC, (m) => {
    const s = m as THREE.MeshStandardMaterial;
    if (!s.isMeshStandardMaterial || s.roughnessMap || s.roughness < minRugosidade || ehMatAve(m)) return null;
    const t = texRugosidade().clone();
    if (s.map) t.repeat.copy(s.map.repeat).multiplyScalar(2);
    else t.repeat.set(8, 8);
    t.needsUpdate = true;
    s.roughnessMap = t;
    s.roughness = 1;
    s.needsUpdate = true;
    return s;
  });

// <LookConcreto real> (padrão): texturas REAIS CC0 (Poly Haven, 1k) em projeção TRIPLANAR no espaço do mundo
// (escala física em cm, sem depender das UVs esticadas das caixas do kit). A COR do modelador é mantida: a textura
// real entra como variação de luminância centrada em 1 (sujeira/manchas), + normal map + rugosidade.
// Classificação automática de cada material do cenário (sem editar src/three/pombo/*): ver classificar() em LookTriplanar.
// real={false} → fallback procedural antigo.
export const LookConcreto: React.FC<{ children: React.ReactNode; minRugosidade?: number; real?: boolean; forca?: number }> = ({ children, minRugosidade = 0.85, real = true, forca = 1 }) => {
  const g = useRef<THREE.Group>(null);
  const kit = useRecurso<KitPBR>(real ? "pbr:kit" : null, carregarKit);
  useLayoutEffect(() => {
    if (!g.current) return;
    if (!real) concretoProcedural(g.current, minRugosidade);
    else if (kit) aplicarTriplanar(g.current, kit, minRugosidade, forca);
  });
  return <group ref={g}>{children}</group>;
};
