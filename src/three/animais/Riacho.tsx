import { useMemo } from "react";
import * as THREE from "three";
import { Clouds, fbm, rnd, SkyDome, WaterSurface } from "../World";
import { eucalyptusGeo, groundFernGeo, Inst, reedGeo, rockGeo, Spot, spread, treeFernGeo, tuftGeo, vcMat, plainMat } from "./vegetacao";

// =====================================================================
// RIACHO australiano em escala do bicho (1 un ≈ 0,5 m).
// Rio correndo ao longo de x, centrado em z = rioZ(x), largura ~9 un, água em y = 0.
// Margens de barro, junco, pedras; eucaliptos altos, samambaias-arborescentes, colinas.
// Use riachoAltura(x,z) para pôr bichos/objetos no chão da margem.
// =====================================================================
export const RIO_MEIA = 4.5; // meia-largura da água
export const rioZ = (x: number) => Math.sin(x * 0.05) * 2.2 + Math.sin(x * 0.013 + 1) * 4;
export const riachoAltura = (x: number, z: number) => {
  const d = Math.abs(z - rioZ(x));
  const s = (a: number, b: number, v: number) => {
    const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };
  const bed = -1.25 * (1 - 0.6 * s(0, RIO_MEIA, d)) + (fbm(x * 0.4, z * 0.4) - 0.5) * 0.3;
  const far = Math.max(0, d - 9);
  const land = 0.55 + fbm(x * 0.06 + 5, z * 0.06 + 2) * 1.4 + Math.pow(far / 60, 1.6) * 30 * (0.5 + fbm(x * 0.012, z * 0.012));
  const w = s(RIO_MEIA - 1.0, RIO_MEIA + 1.8, d);
  return bed + (land - bed) * w;
};
const naAgua = (x: number, z: number, m = 0.4) => Math.abs(z - rioZ(x)) < RIO_MEIA + m;

// Terreno com malha densa no centro (detalhe perto da câmera) e larga longe.
const terrainGeo = (cx: number, cz: number) => {
  const N = 170;
  const g = new THREE.PlaneGeometry(2, 2, N, N);
  g.rotateX(-Math.PI / 2);
  const p = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const u = p.getX(i), v = p.getZ(i);
    const x = cx + Math.sign(u) * Math.pow(Math.abs(u), 2.3) * 300;
    const z = cz + Math.sign(v) * Math.pow(Math.abs(v), 2.3) * 300;
    p.setXYZ(i, x, riachoAltura(x, z), z);
  }
  // chão liso (normais suaves) com manchas de cor por vértice — como o chão da referência
  const ng = g;
  ng.computeVertexNormals();
  const cnt = ng.attributes.position.count;
  const col = new Float32Array(cnt * 3);
  const pos = ng.attributes.position as THREE.BufferAttribute;
  const C = {
    bed: new THREE.Color("#A08B66"),
    gravel: new THREE.Color("#8C7D66"),
    mud: new THREE.Color("#7D5E3E"),
    grassA: new THREE.Color("#86B556"),
    grassB: new THREE.Color("#73A54A"),
    dry: new THREE.Color("#B9B470"),
    hill: new THREE.Color("#6E9A55"),
  };
  const sm = (a: number, b: number, v: number) => Math.min(1, Math.max(0, (v - a) / (b - a)));
  for (let i = 0; i < cnt; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const n1 = fbm(x * 0.12 + 7, z * 0.12), n2 = fbm(x * 0.5, z * 0.5 + 3);
    const wet = C.bed.clone().lerp(C.gravel, n2);
    const bank = C.mud.clone().lerp(C.gravel, n2 * 0.5);
    const grass = C.grassA.clone().lerp(C.grassB, sm(0.35, 0.65, n1)).lerp(C.dry, sm(0.6, 0.78, n1) * 0.8);
    let c = wet.lerp(bank, sm(-0.5, -0.1, y)).lerp(grass, sm(0.25, 0.6, y));
    if (y > 6) c = c.lerp(C.hill, sm(6, 14, y));
    c.offsetHSL(0, 0, (n2 - 0.5) * 0.06);
    col.set([c.r, c.g, c.b], i * 3);
  }
  ng.setAttribute("color", new THREE.BufferAttribute(col, 3));
  return ng;
};

export type RiachoProps = {
  t: number;
  centro?: [number, number]; // região de interesse (detalhe da vegetação perto)
  fog?: [string, number, number];
  ceu?: { top?: string; horizon?: string };
  nuvens?: boolean;
  agua?: boolean;
  folhasBoiando?: boolean;
  densidade?: number; // 0.5..1.5 multiplica a quantidade de plantas
  livre?: { x: number; z: number; r: number }[]; // clareiras sem planta (em volta do bicho e da câmera)
};

export const Riacho: React.FC<RiachoProps> = ({ t, centro = [0, 0], fog = ["#DDEFF3", 25, 260], ceu, nuvens = true, agua = true, folhasBoiando = true, densidade = 1, livre = [] }) => {
  const [cx, cz] = centro;
  const geo = useMemo(() => terrainGeo(cx, cz), [cx, cz]);
  const D = densidade;
  const sp = useMemo(() => {
    const h = riachoAltura;
    const A = (r: number) => ({ x0: cx - r, x1: cx + r, z0: cz - r, z1: cz + r });
    const far = (r0: number) => (x: number, z: number) => !naAgua(x, z, 2.5) && Math.hypot(x - cx, z - cz) > r0;
    const clear = (s: Spot[], k = 1) => s.filter((q) => !livre.some((l) => Math.hypot(q.x - l.x, q.z - l.z) < l.r * k));
    const sink = (s: Spot[], d: number) => clear(s.map((q) => ({ ...q, y: q.y - d })), 1.6);
    return {
      euc: sink(spread(Math.round(70 * D), 1, A(130), h, far(9)), 0.2),
      fern: sink(spread(Math.round(46 * D), 2, A(40), h, (x, z) => !naAgua(x, z, 1.6) && Math.hypot(x - cx, z - cz) > 3), 0.1),
      bush: clear(spread(Math.round(160 * D), 3, A(30), h, (x, z) => !naAgua(x, z, 0.9)), 1.3),
      reed: clear(spread(Math.round(260 * D), 4, A(34), h, (x, z) => {
        const d = Math.abs(z - rioZ(x));
        return d > RIO_MEIA - 0.9 && d < RIO_MEIA + 1.4;
      }), 1.3),
      tuft: clear(spread(Math.round(2600 * D), 5, A(16), h, (x, z) => !naAgua(x, z, 0.8)), 0.5),
      rock: clear(spread(Math.round(70 * D), 6, A(30), h, (x, z) => {
        const d = Math.abs(z - rioZ(x));
        return d > RIO_MEIA - 2.5 && d < RIO_MEIA + 2.2;
      }, 0.15, 0.7)),
      leaf: spread(40, 7, A(18), () => 0.02, (x, z) => Math.abs(z - rioZ(x)) < RIO_MEIA - 0.5, 0.6, 1.2),
    };
  }, [cx, cz, D, JSON.stringify(livre)]);
  const euc = eucalyptusGeo();
  const leafGeo = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(0, -0.2);
    s.quadraticCurveTo(0.07, 0, 0, 0.2);
    s.quadraticCurveTo(-0.07, 0, 0, -0.2);
    const g = new THREE.ShapeGeometry(s, 4);
    g.rotateX(-Math.PI / 2);
    return g;
  }, []);
  const tuftMat = useMemo(() => new THREE.MeshStandardMaterial({ roughness: 0.9, side: THREE.DoubleSide }), []);
  // folhas descendo o rio
  const leaves = sp.leaf.map((l, i) => {
    const x = ((l.x - cx + t * 0.35 + 18) % 36) - 18 + cx;
    return { ...l, x, z: rioZ(x) + (l.z - rioZ(l.x)), y: 0.035 + Math.sin(t * 2 + i) * 0.01, r: l.r + t * 0.2 };
  });
  // água acompanha o meandro em trechos retos
  const segs = useMemo(() => Array.from({ length: 14 }).map((_, i) => cx - 140 + i * 20), [cx]);
  return (
    <group>
      <fog attach="fog" args={fog} />
      <SkyDome top={ceu?.top ?? "#4FA9E6"} horizon={ceu?.horizon ?? fog[0]} bottom={fog[0]} />
      <mesh geometry={geo} receiveShadow>
        <meshStandardMaterial vertexColors roughness={0.95} />
      </mesh>
      {agua
        ? segs.map((x0, i) => {
            const xm = x0 + 10;
            const ang = Math.atan((rioZ(x0 + 20) - rioZ(x0)) / 20);
            return (
              <group key={i} position={[xm, 0, rioZ(xm)]} rotation={[0, -ang, 0]}>
                <WaterSurface t={t} size={[21.5, RIO_MEIA * 2 + 3.2]} position={[0, 0, 0]} color="#62B7C9" deep="#2C7D8E" opacity={0.8} amp={0.025} seg={Math.abs(xm - cx) < 25 ? 64 : 12} />
              </group>
            );
          })
        : null}
      <Inst geo={euc.trunk} spots={sp.euc} material={vcMat("euc", { flatShading: true })} scale={[1, 1, 1]} />
      <Inst geo={euc.crown} spots={sp.euc} material={vcMat("eucC", { flatShading: true })} castShadow />
      <Inst geo={treeFernGeo()} spots={sp.fern} material={vcMat("fern")} tilt={0.15} />
      <Inst geo={groundFernGeo()} spots={sp.bush} material={vcMat("bush")} />
      <Inst geo={reedGeo()} spots={sp.reed} material={vcMat("reed")} sway={{ t, amp: 0.05 }} castShadow={false} />
      <Inst geo={tuftGeo()} spots={sp.tuft} material={tuftMat} castShadow={false} color={(s) => (s.k < 0.45 ? "#6FA846" : s.k < 0.85 ? "#86BC57" : "#A9B864")} />
      <Inst geo={rockGeo()} spots={sp.rock} material={plainMat("#9A958A", { flatShading: true })} receiveShadow color={(s) => (s.k < 0.5 ? "#8E8A80" : s.k < 0.8 ? "#A7A194" : "#7D7A72")} />
      {folhasBoiando ? <Inst geo={leafGeo} spots={leaves} material={plainMat("#9B8B4E", { side: THREE.DoubleSide })} castShadow={false} color={(s) => (s.k < 0.5 ? "#A38F4C" : "#7E8C4A")} /> : null}
      {nuvens ? <Clouds t={t} n={16} height={70} spread={240} center={[cx, cz - 160]} /> : null}
    </group>
  );
};
