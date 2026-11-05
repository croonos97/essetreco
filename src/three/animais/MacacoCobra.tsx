import { useThree } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { clamp01, mix, smooth01, V3 } from "./comum";
import { Larva } from "./Presas";
import { Macaco as Mac, MacacoProps, Mao } from "./Macaco";
import { serraAltura } from "./MacacoCenarios";

// =====================================================================
// CENAS NOVAS do roteiro v2 de "Você é um macaco" (cobra, alarme, graveto no nariz).
// Arquivo independente: só LÊ o kit (modelo do macaco e serraAltura). Escala do kit: 1 un ≈ 0,5 m.
// - Serpente: tubo com eixo recalculado a cada quadro, moldura "de pé" (v = 0 sempre no dorso, sem torção),
//   cabeça própria. tipo "jararaca" (venenosa: manchas em "V" escuras, cabeça triangular, faixa atrás do olho)
//   ou "cipo" (inofensiva: fina, verde lisa, cabeça oval).
// - caminhoCobra / corpoNoCaminho: o corpo inteiro segue o MESMO caminho sinuoso fixo no chão (ondulação
//   lateral de verdade: a cobra desliza pelas curvas, nada treme).
// - passada(): pés/mãos de andar (bípede) ou correr (quatro apoios) sem patinar (fase = distância andada).
// - OndasGrito: arcos amarelos ")))" que saem da boca na direção para onde o macaco grita.
// - TroncoFuro (mesmas medidas/posição do tronco do vídeo), GravetoFino, EspirroNuvem.
// =====================================================================

const Y = new THREE.Vector3(0, 1, 0);
const v3 = (a: V3) => new THREE.Vector3(a[0], a[1], a[2]);

// ---------------------------------------------------------------- ponto no rosto do macaco
// Repete a cadeia de transformações do modelo (Macaco.tsx) para achar, no espaço do PAI do macaco, um ponto dado
// no espaço da cabeça (ex.: narina [0.009, -0.026, 0.127], boca [0, -0.054, 0.118]).
export const NARINA_E: V3 = [0.009, -0.026, 0.127];
export const BOCA_L: V3 = [0, -0.056, 0.124];
export const pontoCabeca = (P: Pick<MacacoProps, "sentar" | "quadril" | "inclinar" | "giro" | "cabeca" | "position" | "rotation" | "scale">, local: V3): V3 => {
  const sen = clamp01(P.sentar ?? 1);
  const hip = new THREE.Vector3(0, mix(0.33, 0.115, sen), mix(0, -0.03, sen)).add(v3(P.quadril ?? [0, 0, 0]));
  const incl = mix(0.1, 0.3, sen) + (P.inclinar ?? 0);
  const [hy, hp, hr] = [P.cabeca?.[0] ?? 0, P.cabeca?.[1] ?? 0, P.cabeca?.[2] ?? 0];
  const m = new THREE.Matrix4();
  const outer = new THREE.Matrix4().compose(v3(P.position ?? [0, 0, 0]), new THREE.Quaternion().setFromEuler(new THREE.Euler(...(P.rotation ?? [0, 0, 0]))), new THREE.Vector3(1, 1, 1).multiplyScalar(P.scale ?? 1));
  const tronco = new THREE.Matrix4().compose(hip, new THREE.Quaternion().setFromEuler(new THREE.Euler(incl, P.giro ?? 0, 0)), new THREE.Vector3(1, 1, 1));
  const cab = new THREE.Matrix4().compose(new THREE.Vector3(0, 0.36, 0.02), new THREE.Quaternion().setFromEuler(new THREE.Euler(hp - incl * 0.75, hy, hr)), new THREE.Vector3(1, 1, 1));
  const inner = new THREE.Matrix4().makeTranslation(0, 0.06, 0);
  m.multiply(outer).multiply(tronco).multiply(cab).multiply(inner);
  return v3(local).applyMatrix4(m).toArray() as V3;
};
// direção "para a frente do rosto" no espaço do pai
export const frenteCabeca = (P: Parameters<typeof pontoCabeca>[0]): V3 => {
  const a = v3(pontoCabeca(P, [0, 0, 0]));
  const b = v3(pontoCabeca(P, [0, 0, 1]));
  return b.sub(a).normalize().toArray() as V3;
};

// ---------------------------------------------------------------- texturas das cobras
const TEX = new Map<string, THREE.Texture>();
const fract = (x: number) => x - Math.floor(x);
const hex = (c: string) => new THREE.Color(c);
const texJararaca = () => {
  if (TEX.has("jar")) return TEX.get("jar")!;
  // u (x do canvas) = ao longo do corpo (0 cabeça … 1 rabo); v (y) = em volta (0/1 = dorso, 0,5 = barriga)
  const W = 2048, H = 128;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d")!;
  const img = g.createImageData(W, H);
  const fundo = hex("#A99577"), fundoEsc = hex("#8E7A5E"), barriga = hex("#E9DEC2"), mancha = hex("#3B2A1C"), borda = hex("#EFE4C8");
  const PER = 1 / 17; // pares de manchas ao longo do corpo
  for (let y = 0; y < H; y++) {
    const v = 1 - (y + 0.5) / H; // flipY: linha de cima do canvas = v 1
    const lado = v < 0.5 ? 1 : -1;
    const d = Math.min(v, 1 - v); // 0 dorso … 0,5 barriga
    for (let x = 0; x < W; x++) {
      const u = (x + 0.5) / W;
      let col: THREE.Color;
      if (d > 0.36) col = barriga.clone().lerp(hex("#D9CCAA"), fract(Math.sin(x * 12.9898 + y * 78.233) * 43758.5) * 0.35);
      else {
        col = fundo.clone().lerp(fundoEsc, clamp01((d - 0.12) / 0.2) * 0.5);
        // mancha em "V" invertido (trapézio escuro no flanco, ponta estreita no dorso); lados alternados
        const uc = (Math.floor(u / PER + (lado > 0 ? 0 : 0.5)) + 0.5 - (lado > 0 ? 0 : 0.5)) * PER;
        const du = Math.abs(u - uc) / PER;
        const meia = 0.07 + 0.24 * clamp01((d - 0.04) / 0.28);
        const dentro = d > 0.04 && d < 0.32 && du < meia;
        const naBorda = d > 0.03 && d < 0.335 && du < meia + 0.06 && !dentro;
        if (dentro) col = mancha.clone().lerp(hex("#5A4029"), clamp01(du / meia) * 0.35);
        else if (naBorda) col = borda.clone();
        // escamas: losangos sutis
        const su = fract(u * 260 + (Math.floor(v * 36) % 2) * 0.5), sv = fract(v * 36);
        const esc = Math.abs(su - 0.5) + Math.abs(sv - 0.5);
        if (esc > 0.82) col.multiplyScalar(0.84);
      }
      const i = (y * W + x) * 4;
      img.data[i] = col.r * 255;
      img.data[i + 1] = col.g * 255;
      img.data[i + 2] = col.b * 255;
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.anisotropy = 16;
  TEX.set("jar", t);
  return t;
};
const texCipo = () => {
  if (TEX.has("cipo")) return TEX.get("cipo")!;
  const W = 1024, H = 64;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d")!;
  const img = g.createImageData(W, H);
  const dorso = hex("#5E9A34"), flanco = hex("#79B444"), barriga = hex("#D3E59A");
  for (let y = 0; y < H; y++) {
    const v = 1 - (y + 0.5) / H;
    const d = Math.min(v, 1 - v);
    for (let x = 0; x < W; x++) {
      const u = (x + 0.5) / W;
      const col = d > 0.37 ? barriga.clone() : dorso.clone().lerp(flanco, clamp01(d / 0.3));
      const su = fract(u * 200 + (Math.floor(v * 24) % 2) * 0.5), sv = fract(v * 24);
      if (Math.abs(su - 0.5) + Math.abs(sv - 0.5) > 0.86) col.multiplyScalar(0.9);
      const i = (y * W + x) * 4;
      img.data[i] = col.r * 255;
      img.data[i + 1] = col.g * 255;
      img.data[i + 2] = col.b * 255;
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.anisotropy = 16;
  TEX.set("cipo", t);
  return t;
};

// ---------------------------------------------------------------- cabeças
const GEO = new Map<string, THREE.BufferGeometry>();
const once = (k: string, f: () => THREE.BufferGeometry) => (GEO.has(k) ? GEO.get(k)! : (GEO.set(k, f()), GEO.get(k)!));
// cabeça triangular da jararaca: largura 1, comprimento 1 (+z), altura 1 (centrada em y). Cores por vértice:
// topo pardo, faixa escura do olho até o canto da boca, queixo creme.
const cabecaJararacaGeo = () =>
  once("cabJar", () => {
    // esfera deformada: vista de cima em triângulo (nuca larga com "bochechas" de veneno, focinho estreito),
    // topo achatado, focinho mais baixo. z de 0 (nuca) a 1 (focinho); largura total 1; altura total ≈ 1.
    const g = new THREE.SphereGeometry(0.5, 40, 28);
    const p = g.attributes.position as THREE.BufferAttribute;
    const col = new Float32Array(p.count * 3);
    const topo = hex("#5E4A34"), esc = hex("#24180F"), creme = hex("#E6D9B8"), lado = hex("#8A7454");
    for (let i = 0; i < p.count; i++) {
      const x0 = p.getX(i), y0 = p.getY(i), z0 = p.getZ(i);
      const zz = z0 + 0.5; // 0 nuca … 1 focinho
      const larg = mix(1.08, 0.38, Math.pow(zz, 1.15)) * (zz < 0.18 ? mix(0.82, 1, zz / 0.18) : 1);
      let y = y0 * mix(0.92, 0.58, zz);
      if (y > 0.18 * mix(0.92, 0.58, zz)) y = mix(y, 0.18 * mix(0.92, 0.58, zz) + (y - 0.18 * mix(0.92, 0.58, zz)) * 0.35, 1); // topo chato
      y -= zz * 0.06;
      const x = x0 * larg;
      p.setXYZ(i, x, y, zz);
      // cor por vértice (suave): topo pardo, laterais claras, faixa escura do olho ao canto da boca, queixo creme
      const yn = y0 / 0.5; // −1 … 1
      let c = yn > 0.35 ? topo.clone() : lado.clone().lerp(topo, clamp01((yn - 0.05) / 0.3));
      const yl = mix(0.05, -0.45, clamp01((0.66 - zz) / 0.62));
      const faixa = Math.abs(x0) > 0.22 && zz < 0.7 ? clamp01(1 - Math.abs(yn - yl) / 0.16) : 0;
      c.lerp(esc, smooth01(faixa * 1.6));
      c.lerp(creme, smooth01((-yn - 0.45) / 0.25));
      col.set([c.r, c.g, c.b], i * 3);
    }
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    g.computeVertexNormals();
    return g;
  });
const SPH = new THREE.SphereGeometry(1, 16, 12);
const CYL = new THREE.CylinderGeometry(1, 1, 1, 8, 1);

// ---------------------------------------------------------------- tubo "de pé" (sem torção)
const SEG = 110, RING = 14;
const novoTubo = () => {
  const g = new THREE.BufferGeometry();
  const n = (SEG + 1) * (RING + 1);
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  g.setAttribute("normal", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  const uv = new Float32Array(n * 2);
  for (let i = 0; i <= SEG; i++) for (let j = 0; j <= RING; j++) uv.set([i / SEG, j / RING], (i * (RING + 1) + j) * 2);
  g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  const idx: number[] = [];
  for (let i = 0; i < SEG; i++)
    for (let j = 0; j < RING; j++) {
      const a = i * (RING + 1) + j, b = a + RING + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  g.setIndex(idx);
  return g;
};
// raio ao longo do corpo (u 0 pescoço … 1 ponta do rabo)
const perfil = (tipo: "jararaca" | "cipo", u: number) =>
  tipo === "jararaca"
    ? (u < 0.05 ? 0.62 + (u / 0.05) * 0.2 : u < 0.22 ? 0.82 + ((u - 0.05) / 0.17) * 0.18 : 1 - Math.pow(Math.max(0, (u - 0.62) / 0.38), 1.25) * 0.9)
    : (u < 0.04 ? 0.75 + (u / 0.04) * 0.25 : 1 - Math.pow(Math.max(0, (u - 0.5) / 0.5), 1.3) * 0.85);

export type SerpenteProps = {
  t: number;
  tipo: "jararaca" | "cipo";
  corpo: (u: number) => V3; // eixo do corpo (espaço do pai): u 0 = pescoço … 1 = ponta do rabo
  raio?: number; // raio máximo do corpo
  lingua?: number; // 0..1 língua bifurcada entrando e saindo (≈ 1,2 Hz, suave)
  olhos?: number; // 1 abertos … 0 fechados (cobra-cipó "fora de combate", cômico)
  cabecaVisivel?: boolean;
  giroCabeca?: number; // yaw extra da cabeça (olhar para os lados)
  ergueCabeca?: number; // pitch extra (+ = focinho para cima)
};
export const Serpente: React.FC<SerpenteProps> = ({ t, tipo, corpo, raio = tipo === "jararaca" ? 0.036 : 0.016, lingua = 1, olhos = 1, cabecaVisivel = true, giroCabeca = 0, ergueCabeca = 0 }) => {
  const geo = useMemo(novoTubo, []);
  const M = useMemo(
    () => ({
      pele: new THREE.MeshStandardMaterial({ map: tipo === "jararaca" ? texJararaca() : texCipo(), roughness: tipo === "jararaca" ? 0.62 : 0.42 }),
      cab: tipo === "jararaca" ? new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 }) : new THREE.MeshStandardMaterial({ color: "#5E9A34", roughness: 0.42 }),
      queixo: new THREE.MeshStandardMaterial({ color: "#D3E59A", roughness: 0.5 }),
      iris: new THREE.MeshStandardMaterial({ color: tipo === "jararaca" ? "#C9A04A" : "#E6D24A", roughness: 0.15 }),
      pupila: new THREE.MeshStandardMaterial({ color: "#0B0B0B", roughness: 0.1 }),
      brilho: new THREE.MeshBasicMaterial({ color: "#FFFFFF" }),
      lingua: new THREE.MeshStandardMaterial({ color: "#C0283E", roughness: 0.45 }),
      palpebra: new THREE.MeshStandardMaterial({ color: "#5E9A34", roughness: 0.5 }),
      sobr: new THREE.MeshStandardMaterial({ color: "#7E6A4E", roughness: 0.6 }),
    }),
    [tipo],
  );
  // ---- eixo do corpo e moldura sem torção (lado = T × Y; cima = lado × T)
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= SEG; i++) pts.push(v3(corpo(i / SEG)));
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const T = new THREE.Vector3(), L = new THREE.Vector3(), U = new THREE.Vector3(), last = new THREE.Vector3(1, 0, 0);
  for (let i = 0; i <= SEG; i++) {
    T.copy(pts[Math.min(SEG, i + 1)]).sub(pts[Math.max(0, i - 1)]);
    if (T.lengthSq() < 1e-12) T.set(0, 0, 1);
    T.normalize();
    L.crossVectors(T, Y);
    if (L.lengthSq() < 1e-6) L.copy(last);
    L.normalize();
    last.copy(L);
    U.crossVectors(L, T).normalize();
    const r = raio * perfil(tipo, i / SEG);
    for (let j = 0; j <= RING; j++) {
      const a = (j / RING) * Math.PI * 2;
      const cu = Math.cos(a) * r * 0.82, cl = Math.sin(a) * r; // barriga um pouco achatada
      const p = pts[i];
      pos.setXYZ(i * (RING + 1) + j, p.x + U.x * cu + L.x * cl, p.y + U.y * cu + L.y * cl - (Math.cos(a) < -0.5 ? r * 0.08 : 0), p.z + U.z * cu + L.z * cl);
    }
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  // ---- cabeça: no pescoço (pts[0]), para a frente = pts[0] − pts[3]
  const f = pts[0].clone().sub(pts[3]).normalize();
  const fq = new THREE.Quaternion().setFromAxisAngle(Y, giroCabeca);
  f.applyQuaternion(fq);
  const side = new THREE.Vector3().crossVectors(Y, f);
  if (side.lengthSq() < 1e-6) side.set(1, 0, 0);
  side.normalize();
  const up0 = new THREE.Vector3().crossVectors(f, side).normalize();
  const fp = f.clone().applyAxisAngle(side, -ergueCabeca);
  const up = up0.clone().applyAxisAngle(side, -ergueCabeca);
  const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(side, up, fp));
  const fl = clamp01(lingua) * smooth01((Math.sin(t * 7.4) - 0.2) / 0.8); // 1,2 Hz, estende e recolhe suave
  const R = raio;
  const jar = tipo === "jararaca";
  const HW = jar ? R * 2.2 : R * 1.6, HL = jar ? R * 3.0 : R * 3.0, HH = jar ? R * 2.0 : R * 1.25; // largura, comprimento, altura
  const ol = clamp01(olhos);
  return (
    <group>
      <mesh geometry={geo} material={M.pele} castShadow receiveShadow />
      {cabecaVisivel ? (
        <group position={pts[0].toArray() as V3} quaternion={q}>
          {jar ? (
            <mesh geometry={cabecaJararacaGeo()} material={M.cab} position={[0, R * 0.05, -R * 0.5]} scale={[HW, HH, HL]} castShadow />
          ) : (
            <>
              <mesh geometry={SPH} material={M.cab} position={[0, R * 0.1, HL * 0.32]} scale={[HW * 0.5, HH * 0.5, HL * 0.62]} castShadow />
              <mesh geometry={SPH} material={M.queixo} position={[0, -R * 0.22, HL * 0.33]} scale={[HW * 0.44, HH * 0.3, HL * 0.56]} />
            </>
          )}
          {([1, -1] as const).map((s) => {
            const ex = s * (jar ? HW * 0.36 : HW * 0.43), ey = jar ? -HH * 0.04 : HH * 0.18, ez = jar ? HL * 0.52 : HL * 0.55;
            const er = jar ? R * 0.26 : R * 0.48;
            return (
              <group key={s} position={[ex, ey, ez]} rotation={[0, s * 0.35, 0]}>
                <mesh geometry={SPH} material={M.iris} scale={[er * 0.6, er * ol + 0.0005, er]} />
                {ol > 0.2 ? <mesh geometry={SPH} material={M.pupila} position={[s * er * 0.42, 0, 0]} scale={jar ? [er * 0.22, er * 0.85 * ol, er * 0.22] : [er * 0.3, er * 0.5 * ol, er * 0.5]} /> : null}
                {ol > 0.2 ? <mesh geometry={SPH} material={M.brilho} position={[s * er * 0.55, er * 0.3, er * 0.2]} scale={er * 0.16} /> : null}
                {/* sobrancelha de escama (cara de "brava" da jararaca) */}
                {!jar && ol < 0.95 ? <mesh geometry={SPH} material={M.palpebra} position={[s * er * 0.05, 0, 0]} scale={[er * 0.68, er * (1 - ol) * 1.02 + 0.0005, er * 1.04]} /> : null}
              </group>
            );
          })}
          {/* língua bifurcada */}
          {fl > 0.03 ? (
            <group position={[0, -HH * 0.12, HL * 0.92]} rotation={[0.08, 0, 0]}>
              <mesh geometry={CYL} material={M.lingua} position={[0, 0, R * 1.1 * fl]} rotation={[Math.PI / 2, 0, 0]} scale={[R * 0.09, R * 2.2 * fl, R * 0.09]} />
              {([1, -1] as const).map((s) => (
                <mesh key={s} geometry={CYL} material={M.lingua} position={[s * R * 0.22 * fl, 0, R * (2.2 + 0.45) * fl]} rotation={[Math.PI / 2, 0, -s * 0.45]} scale={[R * 0.07, R * 1.0 * fl, R * 0.07]} />
              ))}
            </group>
          ) : null}
        </group>
      ) : null}
    </group>
  );
};

// ---------------------------------------------------------------- caminho e corpo no chão
// caminho sinuoso fixo no chão: começa em `de`, vai na direção `ang` (rad, 0 = +x), curvas de amplitude `amp`
// e comprimento de onda `onda`. s = distância ao longo do caminho (aprox.); s < 0 continua reto para trás.
export type Caminho = (s: number) => V3;
export const caminhoCobra = (de: V3, ang: number, amp = 0.09, onda = 0.75, chao: (x: number, z: number) => number = serraAltura): Caminho => {
  const dx = Math.cos(ang), dz = Math.sin(ang);
  return (s) => {
    const lat = s > 0 ? Math.sin((s / onda) * Math.PI * 2) * amp * Math.min(1, s / 0.3) : 0;
    const x = de[0] + dx * s - dz * lat, z = de[2] + dz * s + dx * lat;
    return [x, chao(x, z), z];
  };
};
// eixo do corpo: cabeça em s = frente; o corpo atrás dela, pelo MESMO caminho; `ergue` levanta a parte da frente
// (pescoço em "S", como cobra em alerta), sempre com o corpo de trás no chão.
export const corpoNoCaminho = (cam: Caminho, frente: number, L: number, raio: number, ergue = 0) => (u: number): V3 => {
  const s = frente - u * L;
  const p = cam(s);
  const k = Math.max(0, 1 - u / 0.26);
  const lift = ergue * (k * k * (3 - 2 * k)) * 0.2;
  return [p[0], p[1] + raio * 0.8 + lift, p[2]];
};

// ---------------------------------------------------------------- passada (bípede ou 4 apoios), sem patinar
// dist = distância já andada (un); C = comprimento do ciclo (2 passos); a = 0 parado … 1 andando.
// Devolve alvos dos pés (e das mãos, no modo 4 apoios) no espaço do macaco e o balanço do quadril.
export const passada = (dist: number, a: number, modo: "bipede" | "quatro", C = modo === "bipede" ? 0.36 : 0.5) => {
  const pe = (fase: number, x: number, z0: number, alto: number): V3 => {
    const p = fract(dist / C + fase);
    let z: number, y = 0;
    if (p < 0.5) z = C / 4 - (p / 0.5) * (C / 2);
    else {
      const qq = (p - 0.5) / 0.5;
      z = -C / 4 + qq * (C / 2);
      y = Math.sin(qq * Math.PI) * alto;
    }
    return [x, 0.03 + y * a, z0 + z * a];
  };
  if (modo === "bipede")
    return {
      peD: pe(0, -0.075, 0, 0.05),
      peE: pe(0.5, 0.075, 0, 0.05),
      bob: -Math.abs(Math.sin((dist / C) * Math.PI * 2)) * 0.012 * a,
      maoD: undefined as V3 | undefined,
      maoE: undefined as V3 | undefined,
    };
  return {
    peD: pe(0, -0.07, -0.04, 0.06),
    peE: pe(0.5, 0.07, -0.04, 0.06),
    maoD: pe(0.5, -0.09, 0.3, 0.07),
    maoE: pe(0, 0.09, 0.3, 0.07),
    bob: -Math.abs(Math.sin((dist / C) * Math.PI * 2)) * 0.018 * a,
  };
};
// pose de "4 apoios" (correndo) para o Macaco do kit: tronco deitado, quadril baixo, cabeça olhando para a frente
export const QUATRO = { sentar: 0, inclinar: 1.15, quadril: [0, -0.085, -0.05] as V3, cabecaPitch: -0.55 };

// ---------------------------------------------------------------- ondas do grito (arcos ")))" amarelos)
const ARCO = new THREE.RingGeometry(0.86, 1, 28, 1, -0.75, 1.5);
export const OndasGrito: React.FC<{ t: number; forca: number; position: V3; dir: V3; alcance?: number; periodo?: number; cor?: string }> = ({ t, forca, position, dir, alcance = 0.24, periodo = 0.9, cor = "#FFD23F" }) => {
  const cam = useThree((s) => s.camera);
  const ref = useRef<THREE.Group>(null);
  const N = 3;
  const mats = useMemo(() => Array.from({ length: N }).map(() => new THREE.MeshBasicMaterial({ color: cor, transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false })), [cor]);
  const sombra = useMemo(() => Array.from({ length: N }).map(() => new THREE.MeshBasicMaterial({ color: "#7A4A00", transparent: true, depthWrite: false, side: THREE.DoubleSide })), []);
  useLayoutEffect(() => {
    const g = ref.current;
    if (!g || !g.parent) return;
    g.parent.updateWorldMatrix(true, false);
    const pq = new THREE.Quaternion();
    g.parent.getWorldQuaternion(pq);
    // direção do grito vista pela câmera (com leve viés para cima, para nunca virar um anel em volta da cabeça)
    const dw = v3(dir).applyQuaternion(pq);
    const dc = dw.applyQuaternion(cam.quaternion.clone().invert());
    const ang = Math.atan2(dc.y + 0.25, dc.x);
    const rz = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), ang);
    g.quaternion.copy(pq.invert().multiply(cam.quaternion).multiply(rz));
  });
  const k = clamp01(forca);
  return (
    <group ref={ref} position={position} visible={k > 0.005}>
      {mats.map((m, i) => {
        const p = fract(t / periodo + i / N);
        const op = k * Math.sin(Math.PI * Math.min(1, p * 1.15)) * 0.95;
        m.opacity = op;
        sombra[i].opacity = op * 0.45;
        const s = 0.05 + p * alcance;
        return (
          <group key={i}>
            <mesh geometry={ARCO} material={sombra[i]} position={[0.004, -0.004, -0.002]} scale={s * 1.03} renderOrder={8} />
            <mesh geometry={ARCO} material={m} scale={s} renderOrder={9} />
          </group>
        );
      })}
    </group>
  );
};

// ---------------------------------------------------------------- tronco com furo (mesmo do vídeo)
// MESMAS medidas, posição e cor do tronco de src/videos/Macaco.tsx (TRONCO, FURO_N, raio 0,24–0,30, altura 1,0,
// #7A5E44), com mais lados (o furo fica rente à casca: sem disco flutuando) e o interior escuro do buraco.
export const TRONCO_C: V3 = [0.15, 0, 0.55];
export const FURO_N: V3 = (() => {
  const l = Math.hypot(0.5, 0.87);
  return [0.5 / l, 0, -0.87 / l];
})();
export const FURO_Y = 0.3;
const raioTronco = (y: number) => 0.3 - 0.06 * y;
// boca do furo (mundo) e eixo do graveto lá dentro
export const FURO_BOCA: V3 = [TRONCO_C[0] + FURO_N[0] * raioTronco(FURO_Y), FURO_Y, TRONCO_C[2] + FURO_N[2] * raioTronco(FURO_Y)];
const TRONCO_MAT = new THREE.MeshStandardMaterial({ color: "#7A5E44", roughness: 0.95, flatShading: true });
const FURO_MAT = new THREE.MeshBasicMaterial({ color: "#120C08", polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
const BORDA_MAT = new THREE.MeshStandardMaterial({ color: "#5C4431", roughness: 1, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
export const TroncoFuro: React.FC = () => (
  <group position={TRONCO_C}>
    <mesh material={TRONCO_MAT} position={[0, 0.5, 0]} castShadow receiveShadow>
      <cylinderGeometry args={[0.24, 0.3, 1.0, 28]} />
    </mesh>
    {/* casca: anéis e topo cortado */}
    <mesh position={[0, 1.0005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <circleGeometry args={[0.235, 28]} />
      <meshStandardMaterial color="#B08A62" roughness={0.9} />
    </mesh>
    <group position={[FURO_N[0] * (raioTronco(FURO_Y) + 0.001), FURO_Y, FURO_N[2] * (raioTronco(FURO_Y) + 0.001)]} rotation={[0, Math.atan2(FURO_N[0], FURO_N[2]), 0]}>
      <mesh material={BORDA_MAT}>
        <ringGeometry args={[0.07, 0.092, 24]} />
      </mesh>
      <mesh material={FURO_MAT}>
        <circleGeometry args={[0.072, 24]} />
      </mesh>
    </group>
  </group>
);

// ---------------------------------------------------------------- graveto fino (sem folhas), +y = comprimento
const PAU = new THREE.MeshStandardMaterial({ color: "#7A5536", roughness: 0.85 });
const PONTA = new THREE.MeshStandardMaterial({ color: "#C9A276", roughness: 0.8 });
export const GravetoFino: React.FC<{ L?: number; r?: number; position?: V3; quaternion?: THREE.Quaternion; rotation?: V3 }> = ({ L = 0.2, r = 0.0042, position, quaternion, rotation }) => (
  <group position={position} quaternion={quaternion} rotation={quaternion ? undefined : rotation}>
    <mesh geometry={CYL} material={PAU} position={[0, L / 2, 0]} scale={[r, L, r]} castShadow />
    <mesh geometry={SPH} material={PONTA} position={[0, L, 0]} scale={r * 1.02} />
    <mesh geometry={SPH} material={PAU} position={[0, 0, 0]} scale={r * 1.02} />
    {/* nózinho no meio */}
    <mesh geometry={SPH} material={PAU} position={[r * 0.6, L * 0.42, 0]} scale={[r * 0.9, r * 1.6, r * 0.9]} />
  </group>
);
// orientação que leva +y para a direção d
export const quatPara = (d: V3) => new THREE.Quaternion().setFromUnitVectors(Y, v3(d).normalize());

// ---------------------------------------------------------------- espirro: nuvenzinha + gotinhas estilizadas
const NUVEM = new THREE.MeshStandardMaterial({ color: "#FFFFFF", roughness: 1, transparent: true, depthWrite: false });
const GOTA = new THREE.MeshStandardMaterial({ color: "#CFEFFF", roughness: 0.1, transparent: true, depthWrite: false, emissive: new THREE.Color("#BFE6FF"), emissiveIntensity: 0.3 });
const gotaGeo = () =>
  once("gota", () => {
    const g = new THREE.SphereGeometry(1, 12, 10);
    const p = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i);
      const k = y > 0 ? 1 - y * 0.75 : 1;
      p.setXYZ(i, p.getX(i) * k, y * 1.5, p.getZ(i) * k);
    }
    g.computeVertexNormals();
    return g;
  });
// k 0..1 (0,6 s de vida); +z = direção do espirro (frente do focinho)
export const EspirroNuvem: React.FC<{ k: number; position?: V3; quaternion?: THREE.Quaternion; scale?: number }> = ({ k, position, quaternion, scale = 1 }) => {
  if (k <= 0 || k >= 1) return null;
  const e = 1 - Math.pow(1 - k, 2.2);
  NUVEM.opacity = 0.92 * (1 - Math.pow(k, 2.5));
  GOTA.opacity = 0.9 * (1 - Math.pow(k, 3));
  return (
    <group position={position} quaternion={quaternion} scale={scale}>
      {Array.from({ length: 10 }).map((_, i) => {
        const a = (i / 10) * Math.PI * 2;
        const d = 0.015 + e * (0.05 + (0.5 + 0.5 * Math.sin(i * 7.3)) * 0.035);
        return <mesh key={i} geometry={SPH} material={NUVEM} position={[Math.cos(a) * d * 0.7, Math.sin(a) * d * 0.55, 0.02 + e * (0.07 + 0.02 * Math.sin(i * 3.1))]} scale={0.01 + e * 0.022 * (0.75 + 0.25 * Math.sin(i * 5.7))} />;
      })}
      {/* gotinhas azul-claras em arco (tipo desenho), caem um pouco */}
      {Array.from({ length: 6 }).map((_, i) => {
        const a = -0.9 + (i / 5) * 1.8;
        const d = 0.04 + e * 0.16;
        const yy = Math.sin(a) * d * 0.6 - k * k * 0.05;
        const dirq = new THREE.Quaternion().setFromUnitVectors(Y, new THREE.Vector3(Math.sin(a) * 0.6, 0.15 - k * 0.8, 1).normalize().negate());
        return <mesh key={`g${i}`} geometry={gotaGeo()} material={GOTA} position={[Math.sin(a) * d * 0.8, yy, 0.03 + Math.cos(a) * d]} quaternion={dirq} scale={0.0055} />;
      })}
    </group>
  );
};

// ---------------------------------------------------------------- larva branca (bicho de buraco), curvada em "C"
// origem = cabeça (presa na ponta do graveto); o corpo se curva para baixo. Contorce devagar (≈ 1 Hz).
const LARVA_M = new THREE.MeshStandardMaterial({ color: "#F1E3C2", roughness: 0.45 });
const LARVA_D = new THREE.MeshStandardMaterial({ color: "#E2CFA4", roughness: 0.5 });
const LARVA_C = new THREE.MeshStandardMaterial({ color: "#7A4A22", roughness: 0.4 });
export const LarvaBranca: React.FC<{ t: number; position?: V3; rotation?: V3; scale?: number }> = ({ t, position, rotation, scale = 1 }) => {
  const n = 9;
  const curva = 0.38 + Math.sin(t * 6.3) * 0.12;
  let x = 0, y = 0, a = 0;
  const segs: V3[] = [];
  for (let i = 0; i < n; i++) {
    segs.push([0, y, x]);
    a += curva;
    x -= Math.cos(a) * 0.011;
    y -= Math.sin(a) * 0.011;
  }
  return (
    <group position={position} rotation={rotation} scale={scale}>
      <mesh geometry={SPH} material={LARVA_C} position={[0, 0.002, 0.006]} scale={[0.0075, 0.0068, 0.0075]} />
      {segs.map((p, i) => {
        const r = 0.0085 + Math.sin((i / (n - 1)) * Math.PI) * 0.003 - (i === n - 1 ? 0.002 : 0);
        return <mesh key={i} geometry={SPH} material={i % 2 ? LARVA_D : LARVA_M} position={p} scale={[r * 1.05, r, r * 0.95]} />;
      })}
    </group>
  );
};
export { Larva };
export type { Mao };
export { Mac as MacacoKit };
