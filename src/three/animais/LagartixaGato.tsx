import { useMemo } from "react";
import * as THREE from "three";
import { perfilGeo, PKey, useEnv } from "./comum";
import { Amostra, clamp01, CM, escreveTubo, mix, novoTubo, ortoU, rnd, sm, texCanvas, V3 } from "./LagartixaComum";

// =====================================================================
// GATO DOMÉSTICO RAJADO (marrom-acinzentado, peito/focinho/"luvas" brancos) — vídeo da lagartixa.  v2
// Modelado em CENTÍMETROS (raiz com scale = CM). Corpo ≈ 46 cm, ombro ≈ 25 cm. Origem = chão sob a barriga. Frente = +z.
// Lado DIREITO do gato = −x. Silhueta contínua: tronco, pescoço, pernas e rabo são tubos suaves que nascem DE DENTRO
// do corpo (sem juntas de bolinha). Pelo curto liso = textura tigrada + sheen + relevo fino (sem cascas espetadas).
// Patas da frente são IK de 2 ossos: a cena diz onde a ALMOFADA da pata deve encostar (`pataD.alvo`, espaço do gato, cm)
// e para onde as almofadas apontam (`normal`; padrão = chão, [0,-1,0]).
// =====================================================================
export type Pata = { alvo: V3; apertar?: number; unhas?: number; normal?: V3; parede?: boolean };
export type GatoProps = {
  t: number;
  cabeca?: [number, number, number?]; // yaw, pitch (+ = olha para baixo), roll
  boca?: number;
  mastigar?: number; // 0..1 (≈ 2,2 Hz)
  orelhas?: number; // −1 para trás … 0 … 1 atenta
  pupila?: number; // 0 fenda … 1 dilatada
  pataD?: Pata;
  pataE?: Pata;
  agachar?: number;
  bote?: number; // 0..1 salto de ~30 cm em arco
  boteDist?: number; // cm do bote (padrão 30)
  rebolar?: number; // traseiro balança antes do bote (≤ 2,4 Hz)
  rabo?: number;
  arco?: number; // costas arqueadas (+) / esticadas (−), cm no meio do dorso
  naBoca?: React.ReactNode; // espaço da cabeça (cm), preso nos dentes
  pelo?: number; // ignorado (compatibilidade com a v1)
  position?: V3;
  rotation?: V3;
  escala?: number;
};
export const GATO_BOCA: V3 = [0, -2.3, 4.3];

const TORSO: PKey[] = [
  [-23, 5.0, 5.5, 5.5, 0.5],
  [-17, 7.6, 7.4, 7.6, 0.5],
  [-6, 7.2, 7.0, 7.8, 0],
  [6, 7.6, 7.4, 8.2, 0.4],
  [15, 6.8, 6.8, 8.0, 0.8],
  [21, 4.6, 5.0, 5.5, 2.0],
];
// cabeça de gato: nuca → nariz (z), bochechas largas, focinho curto
const CABECA: PKey[] = [
  [-4.2, 2.6, 2.8, 2.6, 0.4],
  [-2.6, 4.3, 4.0, 3.5, 0.5],
  [-0.4, 4.9, 4.1, 3.9, 0.3],
  [1.6, 4.7, 3.4, 3.7, -0.2],
  [3.2, 3.1, 2.3, 3.0, -0.7],
  [4.4, 1.9, 1.5, 2.2, -1.0],
  [5.0, 0.9, 0.8, 1.3, -1.1],
];
const vira = (g0: THREE.BufferGeometry) => {
  g0.scale(-1, 1, 1);
  const n = g0.attributes.normal as THREE.BufferAttribute;
  for (let i = 0; i < n.count; i++) n.setXYZ(i, -n.getX(i), -n.getY(i), -n.getZ(i));
  return g0;
};
let G: null | { torso: THREE.BufferGeometry; cab: THREE.BufferGeometry; sph: THREE.SphereGeometry; cyl: THREE.CylinderGeometry; cone: THREE.ConeGeometry; olho: THREE.SphereGeometry; palp: THREE.SphereGeometry; orelha: THREE.BufferGeometry; orelhaIn: THREE.BufferGeometry } = null;
const orelhaGeo = (k: number, esp: number) => {
  // triângulo de pontas arredondadas, extrudado com chanfro (concha fina)
  const s = new THREE.Shape();
  const w = 1.9 * k, h = 3.4 * k;
  s.moveTo(-w, 0);
  s.quadraticCurveTo(-w * 0.75, h * 0.6, -0.18 * k, h * 0.97);
  s.quadraticCurveTo(0, h * 1.03, 0.18 * k, h * 0.97);
  s.quadraticCurveTo(w * 0.75, h * 0.6, w, 0);
  s.quadraticCurveTo(0, -0.35 * k, -w, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth: esp, bevelEnabled: true, bevelThickness: esp * 0.6, bevelSize: 0.18 * k, bevelSegments: 4, curveSegments: 14 });
  g.translate(0, 0, -esp / 2);
  // concha: curva a orelha para a frente
  const p = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    p.setZ(i, p.getZ(i) - 0.22 * (x * x) / k);
  }
  g.computeVertexNormals();
  return g;
};
// pupila vertical colada na superfície do olho (elipsoide 1 × 0,92 × 1): nunca flutua fora do globo
const PUP_CACHE = new Map<number, THREE.BufferGeometry>();
const pupilaGeo = (pup: number) => {
  const k = Math.round(pup * 20) / 20;
  const hit = PUP_CACHE.get(k);
  if (hit) return hit;
  const a = 0.07 + 0.3 * k, b = 0.5;
  const g = new THREE.CircleGeometry(1, 40, 0, Math.PI * 2);
  // subdivide em anéis para a superfície acompanhar a curvatura
  const pos: number[] = [], idx: number[] = [];
  const R = 8, S = 40;
  pos.push(0, 0, 0);
  for (let r = 1; r <= R; r++) for (let s2 = 0; s2 < S; s2++) {
    const ang = (s2 / S) * Math.PI * 2, rr = r / R;
    pos.push(Math.cos(ang) * rr * a, Math.sin(ang) * rr * b, 0);
  }
  for (let s2 = 0; s2 < S; s2++) idx.push(0, 1 + s2, 1 + ((s2 + 1) % S));
  for (let r = 1; r < R; r++) for (let s2 = 0; s2 < S; s2++) {
    const i0 = 1 + (r - 1) * S + s2, i1 = 1 + (r - 1) * S + ((s2 + 1) % S), j0 = i0 + S, j1 = i1 + S;
    idx.push(i0, j0, j1, i0, j1, i1);
  }
  for (let i = 0; i < pos.length; i += 3) {
    const x = pos[i], y = pos[i + 1];
    pos[i + 2] = Math.sqrt(Math.max(0, 1 - x * x - (y / 0.92) * (y / 0.92))) + 0.006;
  }
  g.dispose();
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  out.setIndex(idx);
  out.computeVertexNormals();
  PUP_CACHE.set(k, out);
  return out;
};
const geos = () => {
  if (G) return G;
  const olho = new THREE.SphereGeometry(1, 32, 24);
  olho.rotateX(Math.PI / 2);
  G = {
    torso: vira(perfilGeo(TORSO, { seg: 48, rad: 40 })),
    cab: vira(perfilGeo(CABECA, { seg: 44, rad: 44, edge: 0.12 })),
    sph: new THREE.SphereGeometry(1, 28, 20),
    cyl: new THREE.CylinderGeometry(1, 1, 1, 8, 1),
    cone: new THREE.ConeGeometry(1, 1, 16, 1),
    olho,
    palp: new THREE.SphereGeometry(1, 24, 10, 0, Math.PI * 2, 0, 0.95),
    orelha: orelhaGeo(1, 0.35),
    orelhaIn: orelhaGeo(0.72, 0.12),
  };
  return G;
};

const rajado = () =>
  texCanvas("gatoRaj", 512, 512, (g, W, H) => {
    const img = g.createImageData(W, H);
    const base = new THREE.Color("#8A7864"), esc = new THREE.Color("#2E261F"), bra = new THREE.Color("#EADFCB"), cla = new THREE.Color("#B6A68F");
    const c = new THREE.Color();
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const u = x / W, v = y / H;
        const ang = -Math.PI / 2 + 2 * Math.PI * u;
        const top = Math.sin(ang);
        c.copy(base).lerp(cla, 0.3 * rnd(Math.floor(u * 90) * 97 + Math.floor(v * 90), 2));
        // listras transversais onduladas (somem embaixo)
        const ph = v * 13 + Math.sin(u * 18) * 0.25 + 0.12 * Math.sin(v * 40);
        const st = Math.pow(Math.max(0, Math.cos(ph * Math.PI * 2)), 3);
        c.lerp(esc, st * 0.85 * sm((top + 0.2) / 0.5));
        // risca dorsal
        if (Math.abs(u - 0.5) < 0.025) c.lerp(esc, 0.7);
        // barriga e peito brancos
        c.lerp(bra, sm((-top - 0.35) / 0.3));
        const k = (y * W + x) * 4;
        img.data[k] = Math.round(255 * Math.pow(clamp01(c.r), 1 / 2.2));
        img.data[k + 1] = Math.round(255 * Math.pow(clamp01(c.g), 1 / 2.2));
        img.data[k + 2] = Math.round(255 * Math.pow(clamp01(c.b), 1 / 2.2));
        img.data[k + 3] = 255;
      }
    g.putImageData(img, 0, 0);
  }, true, true, false);
// cabeça (UV de esfera: u = 0,25 é a frente +z, v = 0 topo): "M" na testa, listras nas bochechas
// pernas: listras em anel, "luvas" brancas no fim (v → 1 = pata)
const pernaTex = (luva: number) =>
  texCanvas(`gatoPerna${luva}`, 256, 256, (g, W, H) => {
    const img = g.createImageData(W, H);
    const base = new THREE.Color("#8A7864"), esc = new THREE.Color("#2E261F"), bra = new THREE.Color("#EEE9E1"), cla = new THREE.Color("#B6A68F");
    const c = new THREE.Color();
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const u = x / W, v = y / H;
        const ang = -Math.PI / 2 + 2 * Math.PI * u;
        const fora = Math.cos(ang) * 0.5 + Math.sin(ang) * 0.5;
        c.copy(base).lerp(cla, 0.3 * rnd(Math.floor(u * 60) * 97 + Math.floor(v * 80), 2));
        const st = Math.pow(Math.max(0, Math.cos((v * 6.5 + Math.sin(u * 12) * 0.08) * Math.PI * 2)), 3);
        c.lerp(esc, st * 0.8 * sm((fora + 0.3) / 0.6));
        c.lerp(bra, sm((v - luva) / 0.14));
        const k = (y * W + x) * 4;
        img.data[k] = Math.round(255 * Math.pow(clamp01(c.r), 1 / 2.2));
        img.data[k + 1] = Math.round(255 * Math.pow(clamp01(c.g), 1 / 2.2));
        img.data[k + 2] = Math.round(255 * Math.pow(clamp01(c.b), 1 / 2.2));
        img.data[k + 3] = 255;
      }
    g.putImageData(img, 0, 0);
  }, true, true, false);
// cabeça (UV do perfil: u em volta, 0,5 = topo; v 0 nuca → 1 nariz): "M" na testa, listras nas bochechas, focinho/queixo brancos
const cabTex = () =>
  texCanvas("gatoCab2", 512, 512, (g, W, H) => {
    const img = g.createImageData(W, H);
    const base = new THREE.Color("#8F7D68"), esc = new THREE.Color("#2E261F"), cla = new THREE.Color("#BBAA92"), bra = new THREE.Color("#F1ECE4");
    const c = new THREE.Color();
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const u = x / W, v = y / H;
        const ang = -Math.PI / 2 + 2 * Math.PI * u;
        const top = Math.sin(ang), lat = Math.cos(ang);
        c.copy(base).lerp(cla, 0.25 * rnd(Math.floor(u * 160) * 97 + Math.floor(v * 160), 3));
        const du = u - 0.5;
        // testa: linhas finas (M) correndo da nuca para os olhos
        if (top > 0.55 && v > 0.12 && v < 0.62) {
          const l = Math.cos(du * 95 + Math.sin(v * 9) * 0.6);
          if (l > 0.55) c.lerp(esc, 0.85 * sm((0.62 - v) / 0.15) * sm((v - 0.12) / 0.1));
        }
        // bochechas: duas listras escuras saindo do canto do olho para trás
        if (Math.abs(lat) > 0.55 && top > -0.35 && top < 0.35) {
          const l1 = Math.abs(top - (0.05 + (0.62 - v) * 0.5)), l2 = Math.abs(top - (-0.18 + (0.62 - v) * 0.4));
          if ((l1 < 0.04 || l2 < 0.035) && v > 0.25 && v < 0.62) c.lerp(esc, 0.85);
        }
        // nuca listrada
        if (v < 0.25 && top > 0 && Math.cos(v * 70) > 0.5) c.lerp(esc, 0.6);
        // focinho, queixo e garganta brancos
        const bQ = sm((-top + 0.15) / 0.3) * sm((v - 0.5) / 0.12);
        const bF = sm((v - 0.8) / 0.06) * sm((0.35 - Math.abs(lat) * 0.4 - top * 0.2) / 0.2);
        c.lerp(bra, clamp01(bQ + bF));
        const k = (y * W + x) * 4;
        img.data[k] = Math.round(255 * Math.pow(clamp01(c.r), 1 / 2.2));
        img.data[k + 1] = Math.round(255 * Math.pow(clamp01(c.g), 1 / 2.2));
        img.data[k + 2] = Math.round(255 * Math.pow(clamp01(c.b), 1 / 2.2));
        img.data[k + 3] = 255;
      }
    g.putImageData(img, 0, 0);
  }, true, true, false);
// relevo de pelo curto (riscos finos deitados)
const peloBump = () =>
  texCanvas("gatoPeloB", 256, 256, (g, W, H) => {
    g.fillStyle = "#808080";
    g.fillRect(0, 0, W, H);
    for (let i = 0; i < 9000; i++) {
      const x = rnd(i, 1) * W, y = rnd(i, 2) * H;
      g.strokeStyle = rnd(i, 3) > 0.5 ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.35)";
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + (rnd(i, 4) - 0.5) * 2, y + 4 + rnd(i, 5) * 4);
      g.stroke();
    }
  }, false);
const pelo = (map: THREE.Texture) => {
  const b = peloBump().clone();
  b.needsUpdate = true;
  b.repeat.set(6, 6);
  return new THREE.MeshPhysicalMaterial({ map, bumpMap: b, bumpScale: 0.35, roughness: 0.88, sheen: 1, sheenRoughness: 0.55, sheenColor: new THREE.Color("#B8AC9C"), emissive: new THREE.Color("#2A2018"), emissiveIntensity: 0.12 });
};

// tubo suave por pontos de controle (Catmull-Rom), raio interpolado; v da textura = 0 → 1 ao longo
const _p = new THREE.Vector3();
const tuboPts = (g: THREE.BufferGeometry, pts: THREE.Vector3[], raios: number[], up0: THREE.Vector3, achata = 1) => {
  const { aneis } = g.userData as { aneis: number };
  const n = pts.length;
  const at = (k: number) => pts[Math.max(0, Math.min(n - 1, k))];
  const pos = (s: number, out: THREE.Vector3) => {
    const f = s * (n - 1);
    const i = Math.min(n - 2, Math.floor(f));
    const t = f - i;
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    const t2 = t * t, t3 = t2 * t;
    out.set(0, 0, 0).addScaledVector(p0, -0.5 * t3 + t2 - 0.5 * t).addScaledVector(p1, 1.5 * t3 - 2.5 * t2 + 1).addScaledVector(p2, -1.5 * t3 + 2 * t2 + 0.5 * t).addScaledVector(p3, 0.5 * t3 - 0.5 * t2);
    return out;
  };
  const rad = (s: number) => {
    const f = s * (raios.length - 1);
    const i = Math.min(raios.length - 2, Math.floor(f));
    return mix(raios[i], raios[i + 1], sm(f - i));
  };
  const A: Amostra[] = [];
  let up = up0.clone();
  for (let i = 0; i < aneis; i++) {
    const s = i / (aneis - 1);
    const p = pos(s, new THREE.Vector3());
    const d = pos(Math.min(1, s + 0.01), _p.clone()).sub(pos(Math.max(0, s - 0.01), new THREE.Vector3())).normalize();
    up = ortoU(up, d);
    const r = rad(s);
    A.push({ p, d, u: up.clone(), w: r, ht: r * achata, hb: r * achata, s });
  }
  escreveTubo(g, A, 1);
};

const olhoTex = () =>
  texCanvas("gatoOlho", 256, 256, (g, W, H) => {
    const img = g.createImageData(W, H);
    const c = new THREE.Color();
    const a = new THREE.Color("#D6B44A"), b = new THREE.Color("#8FA53E"), esc = new THREE.Color("#2B2117");
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const phi = (x / W) * Math.PI * 2, th = (1 - y / H) * Math.PI;
        const r = th;
        c.copy(b).lerp(a, sm((r - 0.15) / 0.5));
        c.multiplyScalar(0.9 + 0.1 * Math.sin(phi * 23 + r * 5));
        c.lerp(esc, sm((r - 0.68) / 0.1)); // anel escuro + "esclera" escura natural
        const k = (y * W + x) * 4;
        img.data[k] = Math.round(255 * Math.pow(clamp01(c.r), 1 / 2.2));
        img.data[k + 1] = Math.round(255 * Math.pow(clamp01(c.g), 1 / 2.2));
        img.data[k + 2] = Math.round(255 * Math.pow(clamp01(c.b), 1 / 2.2));
        img.data[k + 3] = 255;
      }
    g.putImageData(img, 0, 0);
  }, true, false, false);

// IK 2 ossos
const ik2 = (S: THREE.Vector3, T: THREE.Vector3, L1: number, L2: number, pole: THREE.Vector3) => {
  const d0 = T.clone().sub(S);
  const d = Math.min(Math.max(d0.length(), Math.abs(L1 - L2) + 1e-3), (L1 + L2) * 0.999);
  const dir = d0.lengthSq() > 1e-9 ? d0.normalize() : new THREE.Vector3(0, -1, 0);
  const a = Math.acos(THREE.MathUtils.clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1));
  const n = pole.clone().sub(dir.clone().multiplyScalar(pole.dot(dir)));
  if (n.lengthSq() < 1e-8) n.set(0, 0, 1);
  n.normalize();
  const E = S.clone().add(dir.clone().multiplyScalar(Math.cos(a)).add(n.multiplyScalar(Math.sin(a))).multiplyScalar(L1));
  return { E, W: S.clone().add(dir.clone().multiplyScalar(d)) };
};
const Y = new THREE.Vector3(0, 1, 0);
export const Gato: React.FC<GatoProps> = (P) => {
  const { t } = P;
  const g = geos();
  const env = useEnv();
  const M = useMemo(() => {
    return {
      corpo: pelo(rajado()),
      tronco: (() => {
        const m = pelo(rajado());
        const u = { uArco: { value: 0 } };
        m.onBeforeCompile = (sh) => {
          Object.assign(sh.uniforms, u);
          sh.vertexShader = "uniform float uArco;\n" + sh.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\n transformed.y += uArco * max(0.0, 1.0 - pow(position.z / 22.0, 2.0));");
        };
        m.customProgramCacheKey = () => "gatoTronco";
        return { m, u };
      })(),
      cab: pelo(cabTex()),
      perna: pelo(pernaTex(0.74)),
      pernaT: pelo(pernaTex(0.88)),
      rabo: pelo(pernaTex(2)),
      orelha: pelo(texCanvas("gatoOrelha", 64, 64, (c) => { c.fillStyle = "#7E6C58"; c.fillRect(0, 0, 64, 64); })),
      bra: pelo(texCanvas("gatoBranco2", 64, 64, (c) => { c.fillStyle = "#F0EBE3"; c.fillRect(0, 0, 64, 64); })),
      olho: new THREE.MeshPhysicalMaterial({ map: olhoTex(), roughness: 0.1, clearcoat: 1, clearcoatRoughness: 0.03, envMap: env, envMapIntensity: 0.9, emissive: new THREE.Color("#FFFFFF"), emissiveMap: olhoTex(), emissiveIntensity: 0.12 }),
      pupila: new THREE.MeshBasicMaterial({ color: "#050505" }),
      nariz: new THREE.MeshStandardMaterial({ color: "#D98C8C", roughness: 0.45 }),
      rosa: new THREE.MeshStandardMaterial({ color: "#E7A3A0", roughness: 0.6 }),
      orelhaIn: new THREE.MeshStandardMaterial({ color: "#D9A39B", roughness: 0.8 }),
      boca: new THREE.MeshStandardMaterial({ color: "#5A2225", roughness: 0.6 }),
      dente: new THREE.MeshStandardMaterial({ color: "#F6F3EA", roughness: 0.3 }),
      bigode: new THREE.MeshStandardMaterial({ color: "#FFFFFF", roughness: 0.4, emissive: new THREE.Color("#999999"), emissiveIntensity: 0.5 }),
      contorno: new THREE.MeshStandardMaterial({ color: "#1C1612", roughness: 0.5 }),
      vinco: new THREE.MeshStandardMaterial({ color: "#9C9184", roughness: 0.9 }),
      unha: new THREE.MeshStandardMaterial({ color: "#F0E8DC", roughness: 0.3 }),
    };
  }, [env]);
  const tubos = useMemo(() => ({ pernas: [0, 1, 2, 3].map(() => novoTubo(40, 22)), pesc: novoTubo(24, 30), rabo: novoTubo(48, 16) }), []);

  // ----- corpo -----
  M.tronco.u.uArco.value = P.arco ?? 0;
  const ag = clamp01(P.agachar ?? 0), bt = clamp01(P.bote ?? 0);
  const salto = Math.sin(bt * Math.PI);
  const bodyY = 20 - 6 * ag * (1 - bt) + 9 * salto;
  const bodyZ = (P.boteDist ?? 30) * sm(bt);
  const bodyPitch = -0.08 * ag * (1 - bt) - 0.25 * salto + 0.12 * ag * (1 - bt);
  const rebola = (P.rebolar ?? 0) * Math.sin(t * 2.4 * Math.PI * 2) * 0.06;
  const corpoM = new THREE.Matrix4().compose(new THREE.Vector3(0, bodyY, bodyZ), new THREE.Quaternion().setFromEuler(new THREE.Euler(bodyPitch, rebola, 0)), new THREE.Vector3(1, 1, 1));
  const doCorpo = (p: V3) => new THREE.Vector3(...p).applyMatrix4(corpoM);
  const Yv = new THREE.Vector3(0, 1, 0);

  // ----- pernas: tubo contínuo de dentro do corpo até a pata -----
  type PL = { raiz: V3; ombro: V3; alvo: V3; L1: number; L2: number; pole: V3; frente: boolean; lado: 1 | -1; pata?: Pata; luva: number };
  const pFrente = (lado: number): V3 => (bt > 0 ? [lado * 3.6, mix(0, 14, salto), bodyZ + 14 + 10 * salto] : [lado * 3.6, 0, 14 + 3 * ag]);
  const pTras = (lado: number): V3 => (bt > 0 ? [lado * 4.2, 6 * salto, bodyZ - 16 - 12 * salto] : [lado * 4.6, 0, -13]);
  const pernas: PL[] = [
    { raiz: [-1.2, 1.5, 12.5], ombro: [-4.2, -2.5, 13], alvo: P.pataD?.alvo ?? pFrente(-1), L1: 10.5, L2: 10, pole: [0, 0, -1], frente: true, lado: -1, pata: P.pataD, luva: 0.8 },
    { raiz: [1.2, 1.5, 12.5], ombro: [4.2, -2.5, 13], alvo: P.pataE?.alvo ?? pFrente(1), L1: 10.5, L2: 10, pole: [0, 0, -1], frente: true, lado: 1, pata: P.pataE, luva: 0.8 },
    { raiz: [-1.2, 1.5, -15], ombro: [-4.6, -1.5, -15], alvo: pTras(-1), L1: 11, L2: 12, pole: [0, 0, 1], frente: false, lado: -1, luva: 0.88 },
    { raiz: [1.2, 1.5, -15], ombro: [4.6, -1.5, -15], alvo: pTras(1), L1: 11, L2: 12, pole: [0, 0, 1], frente: false, lado: 1, luva: 0.88 },
  ];
  const patas = pernas.map((L, i) => {
    const raiz = doCorpo(L.raiz), S = doCorpo(L.ombro);
    const n = new THREE.Vector3(...(L.pata?.normal ?? (L.pata?.parede ? [0, 0, 1] : [0, -1, 0]))).normalize();
    const alvo = new THREE.Vector3(...L.alvo);
    // base da pata: o centro da almofada fica a 0,9 cm do ponto de contato, do lado oposto à normal
    const pc = alvo.clone().addScaledVector(n, -0.95);
    // "para cima" da pata (direção dos dedos): no chão = frente do gato; na parede = para cima
    const dedos = n.y < -0.7 ? new THREE.Vector3(0, 0, 1) : ortoU(Yv.clone(), n);
    const W = pc.clone().addScaledVector(dedos, -1.3).addScaledVector(n, -0.9);
    const { E, W: Wr } = ik2(S, W, L.L1, L.L2, new THREE.Vector3(...L.pole));
    const delta = Wr.clone().sub(W); // se não alcança, a pata vem junto
    pc.add(delta);
    const pts = [raiz, S.clone().lerp(raiz, 0.1), E, Wr.clone().lerp(E, 0.08), Wr, pc.clone().add(delta.clone().multiplyScalar(0))];
    const r = L.frente ? [3.6, 3.4, 2.5, 2.05, 1.85, 1.0] : [4.2, 4.4, 2.4, 1.6, 1.45, 0.8];
    tuboPts(tubos.pernas[i], pts, r, new THREE.Vector3(L.lado, 0, 0));
    const yP = n.clone().negate(); // eixo y da pata = contrário da almofada
    const zP = ortoU(dedos.clone(), yP);
    const xP = new THREE.Vector3().crossVectors(yP, zP);
    const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(xP, yP, zP));
    return { L, pc, q, i };
  });

  // ----- pescoço + cabeça -----
  const [cy, cp, cr] = P.cabeca ?? [0, 0.1, 0];
  const cabPos = doCorpo([0, 10, 23.5]);
  tuboPts(tubos.pesc, [doCorpo([0, -1, 10]), doCorpo([0, 3, 17]), doCorpo([0, 7.5, 21.5]), cabPos.clone().add(new THREE.Vector3(0, -0.5, -1.2))], [6.4, 5.8, 4.4, 3.6], new THREE.Vector3(0, 1, 0), 1);
  const mast = (P.mastigar ?? 0) * (0.5 + 0.5 * Math.sin(t * 2.2 * Math.PI * 2));
  const boca = clamp01(Math.max(P.boca ?? 0, mast * 0.45));
  const pup = clamp01(P.pupila ?? 0.3);
  const ore = P.orelhas ?? 0;
  const atras = Math.max(0, -ore);

  // ----- rabo -----
  {
    const rab = P.rabo ?? 0.4;
    const pts: THREE.Vector3[] = [];
    let p = doCorpo([0, 2, -19]);
    let a = -0.5;
    for (let i = 0; i < 9; i++) {
      pts.push(p.clone());
      a += 0.24 + rab * 0.08 * Math.sin(t * 1.1 * Math.PI * 2 - i * 0.5);
      const yaw = rab * 0.3 * Math.sin(t * 0.8 * Math.PI * 2 - i * 0.4);
      p = p.clone().add(new THREE.Vector3(Math.sin(yaw) * 3.3, Math.sin(a) * 3.6, -Math.cos(a) * 3.6 * Math.cos(yaw)));
    }
    tuboPts(tubos.rabo, pts, [2.6, 1.9, 1.75, 1.65, 1.55, 1.45, 1.3, 1.0, 0.05], new THREE.Vector3(0, 1, 0));
  }

  return (
    <group position={P.position} rotation={P.rotation} scale={(P.escala ?? 1) * CM}>
      <group position={[0, bodyY, bodyZ]} rotation={[bodyPitch, rebola, 0]}>
        <mesh geometry={g.torso} material={M.tronco.m} castShadow receiveShadow />
      </group>
      <mesh geometry={tubos.pesc} material={M.corpo} castShadow />
      <mesh geometry={tubos.rabo} material={M.rabo} castShadow />
      {patas.map(({ L, pc, q, i }) => {
        const ap = clamp01(L.pata?.apertar ?? 0), un = clamp01(L.pata?.unhas ?? 0);
        return (
          <group key={i}>
            <mesh geometry={tubos.pernas[i]} material={L.frente ? M.perna : M.pernaT} castShadow receiveShadow />
            {/* pata: almofada única + 4 dedinhos fundidos, feijõezinhos rosa e unhas */}
            <group position={pc} quaternion={q} scale={[1, 1 - 0.12 * ap, 1]}>
              <mesh geometry={g.sph} material={M.bra} scale={[1.75, 1.0, 1.95]} castShadow />
              {[-1.05, -0.36, 0.36, 1.05].map((x, k) => (
                <group key={k}>
                  <mesh geometry={g.sph} material={M.bra} position={[x * 1.08, -0.12, 1.6 - Math.abs(x) * 0.32]} scale={[0.6, 0.66, 0.72]} castShadow />
                  {k < 3 ? <mesh geometry={g.sph} material={M.vinco} position={[(x + 0.35) * 1.08, 0.12, 1.75 - Math.abs(x + 0.35) * 0.32]} scale={[0.07, 0.4, 0.5]} /> : null}
                  <mesh geometry={g.sph} material={M.rosa} position={[x, -0.72, 1.5 - Math.abs(x) * 0.32]} scale={[0.33, 0.1, 0.33]} />
                  {un > 0 ? <mesh geometry={g.cone} material={M.unha} position={[x, -0.55, 2.1 - Math.abs(x) * 0.32 + un * 0.2]} rotation={[Math.PI / 2 + 0.55, 0, 0]} scale={[0.13, 0.65 * un, 0.13]} /> : null}
                </group>
              ))}
              <mesh geometry={g.sph} material={M.rosa} position={[0, -0.92, 0.1]} scale={[0.8, 0.12, 0.65]} />
            </group>
          </group>
        );
      })}
      {/* CABEÇA */}
      <group position={cabPos} rotation={[cp, cy, cr ?? 0, "YXZ"]}>
        <mesh geometry={g.cab} material={M.cab} castShadow receiveShadow />
        {/* almofadinhas do bigode (brancas, fundidas no focinho) */}
        {[1, -1].map((s) => (
          <mesh key={`m${s}`} geometry={g.sph} material={M.bra} scale={[1.15, 0.95, 1.0]} position={[s * 0.85, -1.75, 4.05]} />
        ))}
        <mesh geometry={g.sph} material={M.nariz} position={[0, -0.95, 4.85]} rotation={[0.3, 0, 0]} scale={[0.58, 0.36, 0.34]} />
        {/* olhos (um pouco afundados na cabeça; pupila vertical) */}
        {[1, -1].map((s) => (
          <group key={`o${s}`} position={[s * 1.62, 0.6, 3.05]} rotation={[-0.06, s * 0.38, 0]}>
            <mesh geometry={g.sph} material={M.contorno} position={[0, 0, -0.12]} scale={[1.08, 1.0, 0.95]} />
            <mesh geometry={g.olho} material={M.olho} scale={[1.0, 0.92, 1.0]} />
            {/* pálpebras de pelo: deixam o olho amendoado */}
            <mesh geometry={g.palp} material={M.orelha} rotation={[-0.35, 0, 0]} scale={1.1} />
            <mesh geometry={g.palp} material={M.orelha} rotation={[Math.PI + 0.75, 0, 0]} scale={1.1} />
            <mesh geometry={pupilaGeo(pup)} material={M.pupila} />
          </group>
        ))}
        {/* orelhas: concha arredondada com parte interna rosada */}
        {[1, -1].map((s) => (
          <group key={`e${s}`} position={[s * 2.45, 3.0, -1.0]} rotation={[-0.15 - 0.4 * atras + 0.1 * Math.max(0, ore), s * (0.25 - 0.7 * atras), -s * (0.3 + 0.2 * atras)]}>
            <mesh geometry={g.orelha} material={M.orelha} castShadow />
            <mesh geometry={g.orelhaIn} material={M.orelhaIn} position={[0, 0.25, 0.32]} />
          </group>
        ))}
        {/* bigodes */}
        {[1, -1].map((s) =>
          [0, 1, 2].map((k) => (
            <mesh key={`w${s}${k}`} geometry={g.cyl} material={M.bigode} position={[s * (1.4 + 2.6), -1.6 - k * 0.32 + 0.25, 3.7]} rotation={[0.12 * (k - 1), 0, s * (Math.PI / 2 - 0.12 * (k - 1)) - s * 0.12]} scale={[0.035, 5.4, 0.035]} />
          )),
        )}
        {/* mandíbula */}
        <group position={[0, -2.2, 1.6]} rotation={[boca * 0.6, 0, 0]}>
          <mesh geometry={g.sph} material={M.bra} scale={[1.3, 0.8, 1.9]} position={[0, -0.35, 1.7]} />
          <mesh geometry={g.sph} material={M.boca} scale={[1.15, 0.3, 1.6]} position={[0, 0.15, 1.8]} />
          {[1, -1].map((s) => (
            <mesh key={`d${s}`} geometry={g.cone} material={M.dente} position={[s * 0.75, 0.45, 3.0]} scale={[0.15, 0.42, 0.15]} />
          ))}
        </group>
        {[1, -1].map((s) => (
          <mesh key={`D${s}`} geometry={g.cone} material={M.dente} position={[s * 0.72, -2.15, 4.1]} rotation={[Math.PI, 0, 0]} scale={[0.16, 0.5 * clamp01(boca * 3), 0.16]} />
        ))}
        {P.naBoca ? <group position={GATO_BOCA}>{P.naBoca}</group> : null}
      </group>
    </group>
  );
};
