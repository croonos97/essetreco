import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { clamp01, rnd, sm, V3 } from "./CupimComum";

// =====================================================================
// FIBRAS DA MADEIRA (cm). Usadas na frente de escavação: o cupim prende uma fibra, puxa, ela se solta e é comida.
// Fibra estilizada (legível no close): fio de 0,2–0,3 mm de espessura, 2–3 mm de comprimento.
// =====================================================================
const COR_FIBRA = "#D7AE7E";
const COR_CEL = "#FFD23F"; // destaque "CELULOSE" (amarelo do canal)

const fibraMat = () => new THREE.MeshStandardMaterial({ color: COR_FIBRA, roughness: 0.8, emissive: new THREE.Color(COR_CEL), emissiveIntensity: 0 });

// tubo por uma lista de pontos (reconstruído a cada quadro: poucos vértices)
const tuboDe = (pts: THREE.Vector3[], r: number, rFim = r) => {
  const curva = new THREE.CatmullRomCurve3(pts);
  const g = new THREE.TubeGeometry(curva, 24, 1, 8, false);
  // afina até a ponta
  const pos = g.attributes.position as THREE.BufferAttribute;
  const n = 25;
  for (let i = 0; i < n; i++) {
    const c = curva.getPointAt(i / 24);
    const rr = r + (rFim - r) * (i / 24);
    for (let j = 0; j <= 8; j++) {
      const k = i * 9 + j;
      const p = new THREE.Vector3(pos.getX(k), pos.getY(k), pos.getZ(k)).sub(c).multiplyScalar(rr).add(c);
      pos.setXYZ(k, p.x, p.y, p.z);
    }
  }
  g.computeVertexNormals();
  return g;
};

// Uma fibra presa na parede em B, deitada ao longo de dir (fibra da madeira), comprimento L.
// puxar 0..1: a ponta livre é levada até "alvo" (ponta das mandíbulas); em puxar ≥ quebra ela se solta
// e o pedaço solto acompanha o alvo; comer 0..1 encurta o pedaço solto (vai sendo engolido).
export const FibraSoltando: React.FC<{ B: V3; dir: V3; L?: number; r?: number; alvo: V3; puxar: number; quebra?: number; comer?: number; destaque?: number; frente?: V3 }> = ({ B, dir, L = 0.26, r = 0.014, alvo, puxar, quebra = 0.72, comer = 0, destaque = 0, frente }) => {
  const m = useMemo(fibraMat, []);
  m.color.set(COR_FIBRA).lerp(new THREE.Color(COR_CEL), destaque * 0.85);
  m.emissiveIntensity = destaque * 0.45;
  const b = new THREE.Vector3(...B), d = new THREE.Vector3(...dir).normalize(), T = new THREE.Vector3(...alvo);
  const solto = puxar >= quebra;
  const geos = useMemo(() => {
    const out: { g: THREE.BufferGeometry }[] = [];
    const corte = 0.28; // fração que fica presa (toco)
    if (!solto) {
      const p = sm(puxar / quebra);
      const ponta = b.clone().addScaledVector(d, L).lerp(T, p);
      const meio = b.clone().addScaledVector(d, L * (0.35 + 0.1 * p)).lerp(T, p * 0.35);
      out.push({ g: tuboDe([b.clone().addScaledVector(d, -0.01), b.clone().addScaledVector(d, L * 0.15), meio, ponta], r, r * 0.7) });
    } else {
      // toco desfiado na parede
      out.push({ g: tuboDe([b.clone().addScaledVector(d, -0.01), b.clone().addScaledVector(d, L * corte * 0.5), b.clone().addScaledVector(d, L * corte).add(new THREE.Vector3(0, 0.01, 0))], r, r * 0.5) });
      // pedaço solto preso nas mandíbulas, orientado para a frente do bicho, encurtando
      const comp = L * (1 - corte) * (1 - clamp01(comer) * 0.92);
      const f = new THREE.Vector3(...(frente ?? [0, 0, 1])).normalize();
      const lado = new THREE.Vector3(0, 1, 0).cross(f).normalize();
      const a = T.clone().addScaledVector(lado, -comp * 0.5);
      const c = T.clone().addScaledVector(lado, comp * 0.5).addScaledVector(f, comp * 0.15);
      out.push({ g: tuboDe([a, T.clone().addScaledVector(f, 0.01), c], r * 0.9, r * 0.6) });
    }
    return out;
  }, [B[0], B[1], B[2], dir[0], dir[1], dir[2], alvo[0], alvo[1], alvo[2], puxar, comer, solto, L, r]);
  useLayoutEffect(() => () => geos.forEach((x) => x.g.dispose()), [geos]);
  return (
    <>
      {geos.map((x, i) => (
        <mesh key={i} geometry={x.g} material={m} castShadow receiveShadow />
      ))}
    </>
  );
};

// Parede de fibras desfiadas na frente de escavação (instanced): fiapos saindo de um retângulo
// centro c, normal n (para fora da parede), fibra ao longo de dir. tamanho [larg, alt] cm.
export const FrenteMastigacao: React.FC<{ c: V3; n: V3; dir: V3; tam?: [number, number]; qtd?: number; seed?: number }> = ({ c, n, dir, tam = [0.5, 0.3], qtd = 70, seed = 3 }) => {
  const ref = useRef<THREE.InstancedMesh>(null);
  const geo = useMemo(() => new THREE.CapsuleGeometry(1, 1, 4, 8), []);
  const m = useMemo(() => new THREE.MeshStandardMaterial({ color: "#D9B486", roughness: 0.85 }), []);
  useLayoutEffect(() => {
    const im = ref.current;
    if (!im) return;
    const N = new THREE.Vector3(...n).normalize(), D = new THREE.Vector3(...dir).normalize();
    const S = new THREE.Vector3().crossVectors(N, D).normalize();
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
    for (let i = 0; i < qtd; i++) {
      const u = rnd(i + seed * 100, 1) - 0.5, v = rnd(i + seed * 100, 2) - 0.5;
      const L = 0.04 + rnd(i, 3) * 0.12, r = 0.006 + rnd(i, 4) * 0.006;
      // fiapo apontando para fora e meio deitado ao longo da fibra
      const ax = N.clone().multiplyScalar(0.6 + rnd(i, 5) * 0.4).addScaledVector(D, (rnd(i, 6) - 0.5) * 1.4).addScaledVector(S, (rnd(i, 7) - 0.5) * 0.6).normalize();
      q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), ax);
      const p = new THREE.Vector3(...c).addScaledVector(S, u * tam[0]).addScaledVector(D.clone().cross(S).normalize().multiplyScalar(-1), 0).addScaledVector(new THREE.Vector3().crossVectors(S, N).normalize(), v * tam[1]).addScaledVector(ax, L * 0.5);
      m4.compose(p, q, new THREE.Vector3(r, L * 0.5, r));
      im.setMatrixAt(i, m4);
    }
    im.instanceMatrix.needsUpdate = true;
    im.computeBoundingSphere();
  }, [c[0], c[1], c[2], n[0], n[1], n[2], dir[0], dir[1], dir[2], qtd, seed]);
  return <instancedMesh ref={ref} args={[geo, m, qtd]} castShadow receiveShadow />;
};

// FIBRA AMPLIADA (explicativa, "CELULOSE"): feixe que se abre em fios mais finos (microfibrilas).
// Comprimento L (cm, ao longo de +x), raio R. abrir 0..1 separa os fios; destaque 0..1 tinge de amarelo.
export const FibraAmpliada: React.FC<{ L?: number; R?: number; abrir?: number; destaque?: number; t?: number; position?: V3; rotation?: V3 }> = ({ L = 6, R = 0.5, abrir = 0, destaque = 1, position, rotation }) => {
  const N = 19;
  const m = useMemo(() => new THREE.MeshStandardMaterial({ color: COR_FIBRA, roughness: 0.55, emissive: new THREE.Color(COR_CEL), emissiveIntensity: 0 }), []);
  m.color.set(COR_FIBRA).lerp(new THREE.Color("#F6C945"), destaque);
  m.emissiveIntensity = 0.25 * destaque;
  const geos = useMemo(() => {
    const out: THREE.BufferGeometry[] = [];
    // posições em favo (hexagonal) na seção
    const cel: [number, number][] = [[0, 0]];
    for (let k = 0; k < 6; k++) cel.push([Math.cos((k * Math.PI) / 3), Math.sin((k * Math.PI) / 3)]);
    for (let k = 0; k < 12; k++) {
      const a = (k * Math.PI) / 6;
      const rr = k % 2 === 0 ? 2 : Math.sqrt(3);
      cel.push([Math.cos(a) * rr, Math.sin(a) * rr]);
    }
    const rf = R / 4.6;
    for (let i = 0; i < N; i++) {
      const [cy, cz] = cel[i];
      const pts: THREE.Vector3[] = [];
      for (let k = 0; k <= 12; k++) {
        const x = (k / 12) * L;
        // a ponta direita se abre (fios separando); torção leve do feixe
        const ab = abrir * Math.pow(k / 12, 2) * 1.8;
        const tw = (k / 12) * 0.6;
        const y = (cy * Math.cos(tw) - cz * Math.sin(tw)) * rf * 2.05 * (1 + ab);
        const z = (cy * Math.sin(tw) + cz * Math.cos(tw)) * rf * 2.05 * (1 + ab);
        pts.push(new THREE.Vector3(x, y, z));
      }
      out.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, rf, 12, false));
    }
    return out;
  }, [L, R, abrir]);
  useLayoutEffect(() => () => geos.forEach((g) => g.dispose()), [geos]);
  return (
    <group position={position} rotation={rotation}>
      {geos.map((g, i) => (
        <mesh key={i} geometry={g} material={m} castShadow receiveShadow />
      ))}
    </group>
  );
};
