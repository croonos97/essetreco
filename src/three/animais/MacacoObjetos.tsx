import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { rnd } from "../World";
import { clamp01, dropGeo, skinTexture, useEnv, V3 } from "./comum";

// =====================================================================
// Objetos do macaco-prego (escala do kit, 1 un ≈ 0,5 m). Todos com origem no centro de apoio.
// =====================================================================
const blob = (seed: number, amp: number, detail = 2) => {
  const g = new THREE.IcosahedronGeometry(1, detail);
  const p = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const k = 1 + amp * (Math.sin(x * 3.1 + seed) * 0.5 + Math.sin(y * 4.3 + seed * 2) * 0.3 + Math.sin(z * 5.7 + seed * 3) * 0.2);
    p.setXYZ(i, x * k, y * k, z * k);
  }
  const ng = g.toNonIndexed();
  ng.computeVertexNormals();
  return ng;
};
const GEO = new Map<string, THREE.BufferGeometry>();
const once = (k: string, f: () => THREE.BufferGeometry) => (GEO.has(k) ? GEO.get(k)! : (GEO.set(k, f()), GEO.get(k)!));
const SPH = new THREE.SphereGeometry(1, 20, 14);
const HALF = new THREE.SphereGeometry(1, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2);
const CYL = new THREE.CylinderGeometry(1, 1, 1, 10, 1);

// ---------- pedra-martelo de quartzo (≈ 1 kg: 0,2 un de diâmetro) ----------
export const PEDRA_R = 0.078;
export const Pedra: React.FC<{ position?: V3; rotation?: V3; scale?: number; cor?: string; seed?: number; brilho?: number }> = ({ position, rotation, scale = 1, cor = "#9E9483", seed = 3, brilho = 0 }) => {
  const env = useEnv();
  // seixo de quartzo: bege-acinzentado com veios claros e pintas escuras (não pode parecer ovo)
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#FFFFFF", map: skinTexture(cor, 44, 900, 0.22), roughness: 0.5, flatShading: true, envMap: env, envMapIntensity: 0.45, emissive: new THREE.Color("#FFD23F"), emissiveIntensity: 0 }), [cor, env]);
  mat.emissiveIntensity = brilho;
  const g = once(`pedra${seed}`, () => blob(seed, 0.2, 1));
  return <mesh geometry={g} material={mat} position={position} rotation={rotation} scale={[PEDRA_R * scale * 1.12, PEDRA_R * scale * 0.85, PEDRA_R * scale]} castShadow receiveShadow />;
};

// extensão vertical real da pedra (min/max y em relação ao centro) com a rotação e a escala dadas: usada para
// colisão pedra-pedra (o martelo para na superfície da pedra de baixo, sem interpenetrar)
export const pedraExtY = (seed = 3, scale = 1, rotation: V3 = [0, 0, 0]): [number, number] => {
  const g = once(`pedra${seed}`, () => blob(seed, 0.2, 1));
  const p = g.attributes.position as THREE.BufferAttribute;
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation));
  const v = new THREE.Vector3();
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < p.count; i++) {
    v.set(p.getX(i) * PEDRA_R * scale * 1.12, p.getY(i) * PEDRA_R * scale * 0.85, p.getZ(i) * PEDRA_R * scale).applyQuaternion(q);
    lo = Math.min(lo, v.y);
    hi = Math.max(hi, v.y);
  }
  return [lo, hi];
};

// contato pedra-sobre-pedra exato (malha contra malha): devolve a altura do centro da pedra de CIMA, relativa ao
// centro da de baixo, em que as duas superfícies se tocam (raios verticais dos vértices de cada uma contra a outra)
const pedraMesh = (seed: number, scale: number, rotation: V3, pos: V3) => {
  const m = new THREE.Mesh(once(`pedra${seed}`, () => blob(seed, 0.2, 1)), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
  m.position.set(...pos);
  m.rotation.set(...rotation);
  m.scale.set(PEDRA_R * scale * 1.12, PEDRA_R * scale * 0.85, PEDRA_R * scale);
  m.updateMatrixWorld(true);
  return m;
};
export const pedraContatoY = (cima: { seed: number; scale: number; rot: V3; dx: number; dz: number }, baixo: { seed: number; scale: number; rot: V3 }): number => pedraContato(cima, baixo).y;
// y do contato + quantos raios ficam a menos de 6 mm (≈ área de apoio: maior = as pedras "assentam" uma na outra)
export const pedraContato = (cima: { seed: number; scale: number; rot: V3; dx: number; dz: number }, baixo: { seed: number; scale: number; rot: V3 }): { y: number; perto: number } => {
  const H0 = 1; // começa bem acima e mede a menor folga vertical
  const A = pedraMesh(cima.seed, cima.scale, cima.rot, [cima.dx, H0, cima.dz]);
  const B = pedraMesh(baixo.seed, baixo.scale, baixo.rot, [0, 0, 0]);
  const rc = new THREE.Raycaster();
  const ds: number[] = [];
  const corre = (de: THREE.Mesh, contra: THREE.Mesh, dir: THREE.Vector3) => {
    const p = (de.geometry as THREE.BufferGeometry).attributes.position as THREE.BufferAttribute;
    const v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(de.matrixWorld);
      rc.set(v, dir);
      const hit = rc.intersectObject(contra, false)[0];
      if (hit) ds.push(hit.distance);
    }
  };
  corre(A, B, new THREE.Vector3(0, -1, 0));
  corre(B, A, new THREE.Vector3(0, 1, 0));
  const folga = Math.min(...ds);
  return { y: H0 - folga, perto: ds.filter((d) => d < folga + 0.006).length };
};

// ---------- coquinho (castanha de palmeira) que racha em duas metades ----------
export const Coquinho: React.FC<{ quebrar?: number; position?: V3; rotation?: V3; scale?: number; semMiolo?: boolean }> = ({ quebrar = 0, position, rotation, scale = 1, semMiolo = false }) => {
  const M = useMemo(
    () => ({
      casca: new THREE.MeshStandardMaterial({ map: skinTexture("#6A4222", 41, 1800, 0.12), roughness: 0.75 }),
      miolo: new THREE.MeshStandardMaterial({ color: "#F3EAD4", roughness: 0.55 }),
    }),
    [],
  );
  const q = clamp01(quebrar);
  const S: V3 = [0.032, 0.028, 0.042];
  if (q < 0.02)
    return (
      <group position={position} rotation={rotation} scale={scale}>
        <mesh geometry={SPH} material={M.casca} position={[0, S[1], 0]} scale={S} castShadow />
        <mesh geometry={CYL} material={M.casca} position={[0, S[1], S[2] * 1.05]} rotation={[Math.PI / 2, 0, 0]} scale={[0.004, 0.012, 0.004]} />
      </group>
    );
  const open = Math.min(1, q * 1.4);
  return (
    <group position={position} rotation={rotation} scale={scale}>
      {[1, -1].map((s) => (
        <group key={s} position={[s * open * 0.032, 0.004 + Math.sin(open * (Math.PI / 2 - 0.15)) * 0.028, 0]} rotation={[0, 0, -s * (Math.PI / 2 - 0.15) * open]}>
          <group rotation={[0, 0, s > 0 ? -Math.PI / 2 : Math.PI / 2]}>
            <mesh geometry={HALF} material={M.casca} scale={S} castShadow />
            {!(semMiolo && s > 0) ? <mesh geometry={SPH} material={M.miolo} position={[0, 0.001, 0]} scale={[S[0] * 0.8, 0.003, S[2] * 0.8]} /> : null}
            {/* miolo inteiro (castanha) assentado na metade da direita até ser tirado */}
            {s > 0 && !semMiolo ? <mesh geometry={SPH} material={M.miolo} position={[0, 0.004, 0]} scale={[S[0] * 0.55, 0.012, S[2] * 0.55]} /> : null}
          </group>
        </group>
      ))}
      {Array.from({ length: 5 }).map((_, i) => (
        <mesh key={i} geometry={SPH} material={M.casca} position={[(rnd(i, 3) - 0.5) * 0.12 * open, 0.004, (rnd(i, 4) - 0.5) * 0.12 * open]} rotation={[rnd(i, 5) * 3, rnd(i, 6) * 3, 0]} scale={[0.008, 0.003, 0.006]} />
      ))}
    </group>
  );
};

// ---------- bigorna: laje de arenito com covinhas de tanto bater ----------
export const BIGORNA_TOPO = 0.16;
export const Bigorna: React.FC<{ position?: V3; rotation?: V3; scale?: number; cascas?: number }> = ({ position, rotation, scale = 1, cascas = 9 }) => {
  const M = useMemo(
    () => ({
      pedra: new THREE.MeshStandardMaterial({ map: skinTexture("#B4673F", 51, 2600, 0.12), roughness: 0.92, flatShading: true }),
      cova: new THREE.MeshStandardMaterial({ color: "#6E3A22", roughness: 1 }),
      casca: new THREE.MeshStandardMaterial({ color: "#5B391E", roughness: 0.8 }),
    }),
    [],
  );
  const g = once("bigorna", () => {
    const b = new THREE.BoxGeometry(0.72, 0.16, 0.52, 6, 2, 5);
    const p = b.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const k = 1 - 0.1 * Math.pow(Math.abs(x) / 0.36, 3) - 0.1 * Math.pow(Math.abs(z) / 0.26, 3);
      p.setXYZ(i, x * k + Math.sin(z * 9) * 0.015, y > 0 ? y + Math.sin(x * 11 + z * 7) * 0.008 : y, z * k + Math.sin(x * 8) * 0.012);
    }
    b.translate(0, 0.08, 0);
    const ng = b.toNonIndexed();
    ng.computeVertexNormals();
    return ng;
  });
  return (
    <group position={position} rotation={rotation} scale={scale}>
      <mesh geometry={g} material={M.pedra} castShadow receiveShadow />
      {[[-0.12, 0.05], [0.1, -0.06], [0.02, 0.1], [0.2, 0.09]].map(([x, z], i) => (
        <mesh key={i} geometry={SPH} material={M.cova} position={[x, BIGORNA_TOPO + 0.012, z]} scale={[0.045 - i * 0.006, 0.006, 0.038 - i * 0.005]} />
      ))}
      {Array.from({ length: cascas }).map((_, i) => {
        const a = rnd(i, 61) * Math.PI * 2, r = 0.32 + rnd(i, 62) * 0.25;
        return <mesh key={i} geometry={HALF} material={M.casca} position={[Math.cos(a) * r, 0.006, Math.sin(a) * r * 0.8]} rotation={[rnd(i, 63) > 0.5 ? Math.PI : 0, a, 0.3]} scale={[0.03, 0.02, 0.04]} />;
      })}
    </group>
  );
};

// ---------- lasca afiada de quartzo (gume brilha com `brilho`) ----------
export const Lasca: React.FC<{ position?: V3; rotation?: V3; scale?: number; seed?: number; brilho?: number; cor?: string }> = ({ position, rotation, scale = 1, seed = 1, brilho = 0, cor = "#766E62" }) => {
  const env = useEnv();
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: cor, roughness: 0.3, metalness: 0.05, flatShading: true, envMap: env, envMapIntensity: 0.35, emissive: new THREE.Color("#FFF6D8"), emissiveIntensity: 0 }), [cor, env]);
  mat.emissiveIntensity = brilho * 0.35;
  const g = once(`lasca${seed}`, () => {
    const s = new THREE.Shape();
    const n = 7;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const r = (i === 0 ? 1.35 : 0.65 + rnd(i, seed) * 0.45) * 0.05;
      const x = Math.cos(a) * r * 0.75, y = Math.sin(a) * r;
      if (i === 0) s.moveTo(x, y);
      else s.lineTo(x, y);
    }
    const e = new THREE.ExtrudeGeometry(s, { depth: 0.004, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.006, bevelSegments: 1 });
    e.center();
    const ng = e.toNonIndexed();
    ng.computeVertexNormals();
    return ng;
  });
  return <mesh geometry={g} material={mat} position={position} rotation={rotation} scale={scale} castShadow />;
};

// ---------- graveto: haste fina com raminhos e folhas (folhas 0..1 = quantas ainda presas) ----------
export const GRAVETO_L = 0.42;
export const Graveto: React.FC<{ folhas?: number; molhado?: number; t?: number; quebrar?: number; position?: V3; rotation?: V3; scale?: number }> = ({ folhas = 1, molhado = 0, t = 0, quebrar = 0, position, rotation, scale = 1 }) => {
  const M = useMemo(
    () => ({
      pau: new THREE.MeshStandardMaterial({ color: "#7A5536", roughness: 0.85 }),
      ponta: new THREE.MeshStandardMaterial({ color: "#C9A276", roughness: 0.8 }),
      folha: new THREE.MeshStandardMaterial({ color: "#7E9B4A", roughness: 0.7, side: THREE.DoubleSide }),
      agua: new THREE.MeshStandardMaterial({ color: "#BFE6FF", roughness: 0.05, transparent: true, opacity: 0.85 }),
    }),
    [],
  );
  const leaf = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(0, 0);
    s.quadraticCurveTo(0.032, 0.045, 0, 0.1); // folha grande o bastante para ler no close
    s.quadraticCurveTo(-0.032, 0.045, 0, 0);
    return new THREE.ShapeGeometry(s, 4);
  }, []);
  const nLeaf = 7;
  const kept = Math.round(clamp01(folhas) * nLeaf);
  const q = clamp01(quebrar);
  return (
    <group position={position} rotation={rotation} scale={scale}>
      {/* haste ao longo de +y, de 0 a GRAVETO_L */}
      <mesh geometry={CYL} material={M.pau} position={[0, GRAVETO_L / 2, 0]} scale={[0.0065, GRAVETO_L, 0.0065]} castShadow />
      <mesh geometry={SPH} material={M.ponta} position={[0, GRAVETO_L, 0]} scale={0.0068} />
      {/* pedaço que quebra fora (na base) */}
      {q < 0.98 ? <mesh geometry={CYL} material={M.pau} position={[0.02 * q, -0.06 - q * 0.05, 0]} rotation={[0, 0, 0.5 * q]} scale={[0.0065, 0.12, 0.0065]} castShadow /> : null}
      {Array.from({ length: nLeaf }).map((_, i) => {
        const y = 0.08 + (i / nLeaf) * (GRAVETO_L - 0.1);
        const s = i % 2 ? 1 : -1;
        if (i >= kept) return null;
        return (
          <group key={i} position={[0, y, 0]} rotation={[0, i * 1.9, s * 0.9]}>
            <mesh geometry={CYL} material={M.pau} position={[0, 0.012, 0]} scale={[0.002, 0.024, 0.002]} />
            <mesh geometry={leaf} material={M.folha} position={[0, 0.022, 0]} rotation={[0.4, 0, 0]} />
          </group>
        );
      })}
      {molhado > 0.02
        ? [0, 1, 2].map((j) => {
            const ph = (t * 1.6 + j / 3) % 1;
            return <mesh key={j} geometry={dropGeo()} material={M.agua} position={[0, GRAVETO_L - ph * 0.08, 0.004]} rotation={[Math.PI, 0, 0]} scale={0.007 * molhado * (0.6 + 0.4 * (1 - ph))} />;
          })
        : null}
    </group>
  );
};

// ---------- corações amarelos subindo (correio elegante) ----------
const HEART = (() => {
  const s = new THREE.Shape();
  s.moveTo(0, -0.5);
  s.bezierCurveTo(0.6, -0.05, 0.45, 0.55, 0, 0.25);
  s.bezierCurveTo(-0.45, 0.55, -0.6, -0.05, 0, -0.5);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.18, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.08, bevelSegments: 2 });
  g.center();
  return g;
})();
export const Coracoes: React.FC<{ t: number; n?: number; forca?: number; position?: V3; raio?: number; faceY?: number }> = ({ t, n = 9, forca = 1, position, raio = 0.25, faceY = 0 }) => {
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#FFD21F", emissive: new THREE.Color("#FFB800"), emissiveIntensity: 0.55, roughness: 0.35 }), []);
  if (forca <= 0.01) return null;
  return (
    <group position={position}>
      {Array.from({ length: n }).map((_, i) => {
        const ph = (t * 0.45 + rnd(i, 71)) % 1;
        const a = rnd(i, 72) * Math.PI * 2;
        const r = raio * (0.3 + rnd(i, 73) * 0.7);
        const s = 0.085 * forca * (0.7 + rnd(i, 74) * 0.5) * Math.sin(Math.PI * Math.min(1, ph * 1.2));
        return <mesh key={i} geometry={HEART} material={mat} position={[Math.cos(a) * r + Math.sin(t * 2 + i) * 0.02, ph * 0.5, Math.sin(a) * r * 0.5]} rotation={[0, faceY + Math.sin(t * 1.5 + i) * 0.15, Math.sin(t + i) * 0.12]} scale={Math.max(0.0001, s)} />;
      })}
    </group>
  );
};

// ---------- balão de aviso amarelo (genérico, sem marca) ----------
export const BalaoAviso: React.FC<{ aparecer?: number; position?: V3; scale?: number }> = ({ aparecer = 1, position, scale = 1 }) => {
  const M = useMemo(() => ({ y: new THREE.MeshStandardMaterial({ color: "#FFD21F", roughness: 0.4, emissive: new THREE.Color("#FFB000"), emissiveIntensity: 0.25 }), w: new THREE.MeshBasicMaterial({ color: "#1B1B1B" }) }), []);
  const a = clamp01(aparecer);
  if (a < 0.01) return null;
  const s = scale * (a < 1 ? 1.15 * Math.sin((a * Math.PI) / 2) : 1);
  return (
    <group position={position} scale={s}>
      <mesh geometry={SPH} material={M.y} scale={[0.085, 0.065, 0.03]} castShadow />
      <mesh geometry={CYL} material={M.y} position={[-0.03, -0.06, 0]} rotation={[0, 0, -0.5]} scale={[0.012, 0.05, 0.012]} />
      <mesh geometry={CYL} material={M.w} position={[0, 0.012, 0.031]} rotation={[Math.PI / 2, 0, 0]} scale={[0.009, 0.004, 0.032]} />
      <mesh geometry={CYL} material={M.w} position={[0, 0.012, 0.03]} scale={[0.008, 0.06, 0.004]} />
      <mesh geometry={SPH} material={M.w} position={[0, -0.034, 0.03]} scale={[0.009, 0.009, 0.004]} />
    </group>
  );
};

// ---------- cobra (corpo = tubo ao longo de uma curva recalculada a cada quadro) ----------
// `corpo(u)` devolve o ponto do eixo do corpo (espaço do pai) para u = 0 (focinho) … 1 (ponta do rabo).
// tipo "coral": anéis vermelho/preto/branco-amarelado (venenosa, reconhecível); "verde": cobra-cipó fina, verde, inofensiva.
const anelTex = (tipo: "coral" | "verde") => {
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = 16;
  const g = c.getContext("2d")!;
  if (tipo === "coral") {
    // tríades: vermelho largo | preto | amarelo | preto | amarelo | preto | vermelho...
    const seq: [string, number][] = [["#D7362B", 46], ["#151515", 10], ["#F2E3A0", 6], ["#151515", 10], ["#F2E3A0", 6], ["#151515", 10]];
    let x = 0;
    while (x < 1024) for (const [col, w] of seq) (g.fillStyle = col), g.fillRect(x, 0, w + 1, 16), (x += w);
  } else {
    const gr = g.createLinearGradient(0, 0, 1024, 0);
    gr.addColorStop(0, "#5E8F3A");
    gr.addColorStop(1, "#7FA84A");
    g.fillStyle = gr;
    g.fillRect(0, 0, 1024, 16);
    g.fillStyle = "#4E7A30";
    for (let x = 0; x < 1024; x += 18) g.fillRect(x, 0, 3, 16);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
};
export const Cobra: React.FC<{ t: number; tipo: "coral" | "verde"; corpo: (u: number) => V3; raio?: number; lingua?: number; boca?: number; esconderCabeca?: boolean }> = ({ t, tipo, corpo, raio = 0.022, lingua = 1, boca = 0, esconderCabeca = false }) => {
  const M = useMemo(
    () => ({
      pele: new THREE.MeshStandardMaterial({ map: anelTex(tipo), roughness: 0.38, envMapIntensity: 0.6 }),
      cab: new THREE.MeshStandardMaterial({ color: tipo === "coral" ? "#151515" : "#6E9A40", roughness: 0.35 }),
      olho: new THREE.MeshStandardMaterial({ color: "#0B0B0B", roughness: 0.1 }),
      brilho: new THREE.MeshBasicMaterial({ color: "#FFFFFF" }),
      lingua: new THREE.MeshStandardMaterial({ color: "#C2263A", roughness: 0.5 }),
    }),
    [tipo],
  );
  const N = 48;
  const pts = Array.from({ length: N + 1 }, (_, i) => new THREE.Vector3(...corpo(i / N)));
  const curve = new THREE.CatmullRomCurve3(pts);
  const tube = useMemo(() => {
    const g = new THREE.TubeGeometry(curve, 96, 1, 10, false);
    // afina na ponta do rabo e um pouco no pescoço
    const p = g.attributes.position as THREE.BufferAttribute;
    const uv = g.attributes.uv as THREE.BufferAttribute;
    const centro = new THREE.Vector3(), v3 = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      const u = uv.getX(i);
      curve.getPointAt(Math.min(1, u), centro);
      const k = raio * (u < 0.06 ? 0.75 + (u / 0.06) * 0.25 : 1 - Math.pow(Math.max(0, (u - 0.55) / 0.45), 1.4) * 0.92);
      v3.set(p.getX(i), p.getY(i), p.getZ(i)).sub(centro).multiplyScalar(k).add(centro);
      p.setXYZ(i, v3.x, v3.y, v3.z);
    }
    g.computeVertexNormals();
    return g;
  }, [t, raio, ...pts.map((q) => q.x + q.y * 7 + q.z * 13)]); // eslint-disable-line
  useEffect(() => () => tube.dispose(), [tube]);
  const head = pts[0];
  const dir = pts[0].clone().sub(pts[2]).normalize();
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
  const fl = lingua * Math.max(0, Math.sin(t * 6.3)); // língua entra e sai (~1 Hz)
  return (
    <group>
      <mesh geometry={tube} material={M.pele} castShadow receiveShadow />
      {!esconderCabeca ? (
        <group position={head.toArray() as V3} quaternion={q}>
          <mesh material={M.cab} position={[0, 0.002, 0.012]} scale={[raio * 1.35, raio * 0.85, raio * 1.9]} castShadow>
            <sphereGeometry args={[1, 16, 12]} />
          </mesh>
          {tipo === "coral" ? (
            <mesh material={M.pele} position={[0, 0.001, -0.006]} scale={[raio * 1.2, raio * 0.95, raio * 0.7]}>
              <sphereGeometry args={[1, 12, 10]} />
            </mesh>
          ) : null}
          {([1, -1] as const).map((s) => (
            <group key={s} position={[s * raio * 0.95, raio * 0.35, raio * 1.6]}>
              <mesh material={M.olho} scale={raio * 0.32}>
                <sphereGeometry args={[1, 10, 8]} />
              </mesh>
              <mesh material={M.brilho} position={[raio * 0.08, raio * 0.12, raio * 0.2]} scale={raio * 0.1}>
                <sphereGeometry args={[1, 6, 4]} />
              </mesh>
            </group>
          ))}
          {boca > 0.02 ? (
            <mesh material={M.lingua} position={[0, -raio * 0.35, raio * 2.6]} rotation={[boca * 0.5, 0, 0]} scale={[raio * 0.9, raio * 0.12, raio * 0.9]}>
              <sphereGeometry args={[1, 10, 6]} />
            </mesh>
          ) : null}
          {fl > 0.05
            ? ([1, -1] as const).map((s) => (
                <mesh key={s} material={M.lingua} position={[s * raio * 0.12, -raio * 0.2, raio * (3.4 + fl * 1.4)]} rotation={[Math.PI / 2, 0, s * 0.35]} scale={[raio * 0.07, raio * (1.2 + fl * 1.4), raio * 0.07]}>
                  <cylinderGeometry args={[1, 1, 1, 5]} />
                </mesh>
              ))
            : null}
        </group>
      ) : null}
    </group>
  );
};
// cobra rastejando por um caminho no chão: `frente` = distância (un) que a cabeça já andou; ondula lateralmente
export const corpoRastejando = (caminho: (s: number) => V3, frente: number, L: number, t: number, amp = 0.05, ergue = 0, y = 0) => (u: number): V3 => {
  const s = frente - u * L;
  const a = caminho(s), b = caminho(s + 0.01);
  const tx = b[0] - a[0], tz = b[2] - a[2];
  const n = Math.hypot(tx, tz) || 1;
  const w = Math.sin(s * 9 - t * 0) * amp * Math.min(1, u * 6); // ondas presas ao chão (a cobra desliza por elas)
  const lift = ergue * Math.pow(Math.max(0, 1 - u / 0.22), 2) * 0.16;
  return [a[0] - (tz / n) * w, y + a[1] + lift, a[2] + (tx / n) * w];
};

// ---------- balança de dois pratos (régua de peso) ----------
// origem = pé da balança no chão; pratos a ±BAL_BRACO no eixo x, na altura BAL_PRATO_Y. inclinar > 0 desce o prato da direita (+x).
export const BAL_BRACO = 0.46;
export const BAL_PRATO_Y = 0.42;
export const balancaPrato = (lado: 1 | -1, inclinar = 0): V3 => [lado * BAL_BRACO * Math.cos(inclinar), BAL_PRATO_Y - lado * BAL_BRACO * Math.sin(inclinar), 0];
export const Balanca: React.FC<{ inclinar?: number; position?: V3; rotation?: V3; scale?: number }> = ({ inclinar = 0, position, rotation, scale = 1 }) => {
  const M = useMemo(
    () => ({
      madeira: new THREE.MeshStandardMaterial({ map: skinTexture("#7A5536", 77, 600, 0.1), roughness: 0.8 }),
      metal: new THREE.MeshStandardMaterial({ color: "#C9A24A", roughness: 0.35, metalness: 0.6 }),
      corda: new THREE.MeshStandardMaterial({ color: "#5B4632", roughness: 0.9 }),
    }),
    [],
  );
  const H = BAL_PRATO_Y + 0.3; // eixo do braço
  return (
    <group position={position} rotation={rotation} scale={scale}>
      <mesh geometry={CYL} material={M.madeira} position={[0, 0.02, 0]} scale={[0.14, 0.04, 0.14]} castShadow receiveShadow />
      <mesh geometry={CYL} material={M.madeira} position={[0, H / 2, 0]} scale={[0.022, H, 0.022]} castShadow />
      <group position={[0, H, 0]} rotation={[0, 0, -inclinar]}>
        <mesh geometry={CYL} material={M.madeira} rotation={[0, 0, Math.PI / 2]} scale={[0.016, BAL_BRACO * 2 + 0.04, 0.016]} castShadow />
        <mesh geometry={SPH} material={M.metal} scale={0.03} />
      </group>
      {([1, -1] as const).map((s) => {
        const p = balancaPrato(s, inclinar);
        const top: V3 = [p[0], H - s * BAL_BRACO * Math.sin(inclinar), 0];
        return (
          <group key={s}>
            {[0, 1, 2].map((k) => {
              const a = (k / 3) * Math.PI * 2;
              const b: V3 = [p[0] + Math.cos(a) * 0.15, p[1] + 0.01, Math.sin(a) * 0.15];
              const mid: V3 = [(top[0] + b[0]) / 2, (top[1] + b[1]) / 2, (top[2] + b[2]) / 2];
              const d = new THREE.Vector3(b[0] - top[0], b[1] - top[1], b[2] - top[2]);
              const qq = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize());
              return <mesh key={k} geometry={CYL} material={M.corda} position={mid} quaternion={qq} scale={[0.003, d.length(), 0.003]} />;
            })}
            <mesh geometry={CYL} material={M.metal} position={[p[0], p[1], 0]} scale={[0.17, 0.012, 0.17]} castShadow receiveShadow />
          </group>
        );
      })}
    </group>
  );
};

// ---------- espirro cômico: nuvenzinha branca saindo do nariz (sem nojeira) ----------
const PUFF = new THREE.MeshStandardMaterial({ color: "#FFFFFF", roughness: 1, transparent: true, depthWrite: false });
export const Espirro: React.FC<{ k: number; position?: V3; rotation?: V3; scale?: number }> = ({ k, position, rotation, scale = 1 }) => {
  if (k <= 0 || k >= 1) return null;
  PUFF.opacity = 0.9 * (1 - Math.pow(k, 2));
  return (
    <group position={position} rotation={rotation} scale={scale}>
      {Array.from({ length: 9 }).map((_, i) => {
        const a = (i / 9) * Math.PI * 2;
        const d = 0.02 + k * (0.09 + rnd(i, 81) * 0.06);
        return (
          <mesh key={i} geometry={SPH} material={PUFF} position={[Math.cos(a) * d * 0.6, Math.sin(a) * d * 0.5, d * 1.4]} scale={0.012 + k * 0.022 * (0.7 + rnd(i, 82) * 0.6)} />
        );
      })}
    </group>
  );
};
