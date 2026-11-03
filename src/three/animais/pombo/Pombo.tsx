import { useMemo } from "react";
import * as THREE from "three";

export type V3 = [number, number, number];
export type PomboProps = {
  t: number; position?: V3; rotation?: V3; scale?: number; walk?: number;
  flap?: number; head?: V3; beak?: number; crop?: number; opacity?: number;
  baby?: boolean; female?: boolean; seed?: number;
};

const clamp = (v: number) => Math.max(0, Math.min(1, v));
const noise = (n: number) => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
type Ring = [number, number, number, number];

// Elliptical sections preserve the keel, rounded breast and taper into the tail.
function profile(rings: Ring[], vertical: boolean) {
  const points: number[] = [], indices: number[] = [], uv: number[] = [];
  const curve = new THREE.CatmullRomCurve3(rings.map(r => new THREE.Vector3(r[0], r[1], r[2])));
  const centers = new THREE.CatmullRomCurve3(rings.map(r => new THREE.Vector3(r[3], 0, 0)));
  for (let j = 0; j <= 48; j++) {
    const r = curve.getPoint(j / 48), c = centers.getPoint(j / 48).x;
    for (let i = 0; i <= 48; i++) {
      const a = i / 48 * Math.PI * 2;
      points.push(r.y * Math.cos(a), vertical ? r.x : c + r.z * Math.sin(a), vertical ? c + r.z * Math.sin(a) : r.x);
      uv.push(i / 48, j / 48);
      if (i < 48 && j < 48) { const k = j * 49 + i; if (vertical) indices.push(k, k + 49, k + 1, k + 1, k + 49, k + 50); else indices.push(k, k + 1, k + 49, k + 1, k + 50, k + 49); }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(indices); geo.computeVertexNormals();
  return geo;
}

// A feather has a convex vane, a narrow base and an asymmetric rounded tip.
function featherGeometry() {
  const pos: number[] = [], colors: number[] = [], ids: number[] = [];
  for (let j = 0; j <= 18; j++) {
    const v = j / 18;
    const width = Math.pow(Math.sin(Math.PI * v), 0.52) * (0.88 + 0.12 * v);
    for (let i = 0; i <= 8; i++) {
      const u = i / 4 - 1, x = u * width * (u < 0 ? 0.92 : 1);
      pos.push(x, 0.11 * (1 - u * u) * Math.sin(Math.PI * v) + v * v * 0.035, -v);
      const shade = 0.82 + (1 - Math.abs(u)) * 0.14 + Math.sin(v * 160 + Math.abs(u) * 14) * 0.025;
      colors.push(shade, shade, shade);
      if (i < 8 && j < 18) { const k = j * 9 + i; ids.push(k, k + 1, k + 9, k + 1, k + 10, k + 9); }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  g.setIndex(ids); g.computeVertexNormals(); return g;
}

function Rod({ a, b, radius, material }: { a: V3; b: V3; radius: number; material: THREE.Material }) {
  const p = new THREE.Vector3(...a), q = new THREE.Vector3(...b), d = q.clone().sub(p);
  const rotation = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize());
  return <mesh position={p.add(q).multiplyScalar(0.5)} quaternion={rotation} material={material} castShadow>
    <cylinderGeometry args={[radius * 0.77, radius, d.length(), 8]} />
  </mesh>;
}

export function Pombo({ t, position = [0, 0, 0], rotation = [0, 0, 0], scale = 1, walk = 0, flap = 0, head = [0, 0, 0], beak = 0, crop = 0, opacity = 1, baby = false, female = false, seed = 1 }: PomboProps) {
  const w = clamp(walk), f = clamp(flap), mouth = clamp(beak), op = clamp(opacity);
  const phase = t * 9, bob = Math.sin(phase * 2) * 0.007 * w;
  const geo = useMemo(() => ({
    body: profile([[-0.28, 0.003, 0.006, 0.32], [-0.21, 0.075, 0.075, 0.32], [-0.10, 0.132, 0.138, 0.315], [0.025, 0.143, 0.153, 0.31], [0.125, 0.115, 0.138, 0.33], [0.205, 0.063, 0.085, 0.37], [0.23, 0.003, 0.004, 0.39]], false),
    neck: profile([[0.35, 0.092, 0.092, 0.125], [0.40, 0.086, 0.089, 0.147], [0.46, 0.064, 0.07, 0.173], [0.52, 0.052, 0.057, 0.193], [0.565, 0.048, 0.049, 0.202]], true),
    feather: featherGeometry(),
    bars: [0, 1].map(bar => {
      const points = Array.from({ length: 15 }, (_, i) => {
        const y = -0.063 + i / 14 * 0.139, z = -0.053 - bar * 0.066 - (y + 0.052) * 0.095;
        const x = 0.021 + 0.049 * Math.sqrt(Math.max(0.04, 1 - (y / 0.094) ** 2 - ((z + 0.085) / 0.195) ** 2));
        return new THREE.Vector3(x + 0.010, y, z);
      });
      return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 32, 0.006, 8, false);
    }),
  }), []);
  const m = useMemo(() => {
    const standard = (color: string, roughness = 0.78) => new THREE.MeshStandardMaterial({ color, roughness, transparent: op < 1, opacity: op, side: THREE.DoubleSide });
    const feather = (color: string) => { const v = standard(color); v.vertexColors = true; return v; };
    const iridescent = (color: string, thickness: number) => new THREE.MeshPhysicalMaterial({ color, roughness: 0.38, metalness: 0.22, iridescence: 0.85, iridescenceIOR: 1.35, iridescenceThicknessRange: [thickness, thickness + 160], transparent: op < 1, opacity: op, side: THREE.DoubleSide });
    return { body: standard(baby ? "#9b8770" : female ? "#76818e" : "#74828f"), neck: baby ? standard("#ac9478") : iridescent("#3f8076", 420), wing: standard(baby ? "#bcaa87" : "#91a0ad"), head: standard(baby ? "#bca17d" : "#647580"), covert: feather(baby ? "#b9a182" : "#91a0ad"), light: feather(baby ? "#d0b57d" : "#8393a1"), stripe: standard("#303842"), tail: feather(baby ? "#7b7066" : "#4c5868"), green: iridescent("#408875", 350), purple: iridescent("#76618c", 510), skin: standard(baby ? "#b89585" : "#c68185", 0.62), claw: standard("#51454a", 0.54), bill: standard(baby ? "#6c5b50" : "#4c535d", 0.52), cere: standard(baby ? "#c9ac8e" : "#dfded1", 0.72), iris: standard(baby ? "#332c26" : "#c96e21", 0.36), pupil: standard("#080c0e", 0.12), white: standard("#ffffff", 0.1), mouth: standard("#8b4246"), down: standard("#dfc57c", 0.93), crop: new THREE.MeshPhysicalMaterial({ color: "#e4a056", emissive: "#b96516", emissiveIntensity: 0.22, transparent: true, opacity: op * clamp(crop) * 0.58, roughness: 0.38, depthWrite: false }) };
  }, [baby, female]);
  // Materials belong to this bird; animate them without allocating GPU resources per frame.
  Object.values(m).forEach(material => { material.opacity = op; material.transparent = op < 1; });
  m.crop.transparent = true; m.crop.opacity = op * clamp(crop) * 0.58;
  const feather = (key: string, p: V3, s: V3, r: V3, material: THREE.Material) => <mesh key={key} geometry={geo.feather} position={p} scale={s} rotation={r} material={material} castShadow receiveShadow />;
  const ellipsoid = (key: string, p: V3, s: V3, material: THREE.Material, r: V3 = [0, 0, 0]) => <mesh key={key} position={p} scale={s} rotation={r} material={material} castShadow receiveShadow><sphereGeometry args={[1, 32, 24]} /></mesh>;
  return <group position={position} rotation={rotation} scale={scale * (baby ? 0.56 : 1)}>
    <group position={[0, bob - 0.018, 0]}>
      <mesh geometry={geo.body} material={m.body} scale={baby ? [1.04, 0.94, 0.92] : [1, 1, 1]} castShadow receiveShadow />
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i - 5.5) * 0.034;
        return feather(`tail${i}`, [a * 0.45, 0.331 + Math.abs(a) * 0.08, -0.20], [0.024, 0.031, 0.225 - Math.abs(a) * 0.19], [-0.12, -a * 0.8, 0], m.tail);
      })}
      {[-1, 1].map(side => <group key={side} position={[side * 0.109, 0.365, 0.082]} scale={[side, 1, 1]} rotation={[0, -side * f * 0.2, side * f * (0.08 + Math.sin(t * 17) * 0.40)]}>
        {ellipsoid("wing", [0.021 + f * 0.035, 0, -0.085], baby ? [0.038, 0.059, 0.095] : [0.049, 0.092, 0.19], m.wing)}
        {!baby && <>
          {Array.from({ length: 10 }, (_, i) => feather(`primary${i}`, [0.056 + f * i * 0.019, -0.050 + i * 0.008, -0.12 - i * 0.004], [0.016 + f * 0.007, 0.025, 0.215 - i * 0.006 + f * 0.17], [0, -0.10 - f * (0.30 + i * 0.075), -(1 - f) * Math.PI / 2], i < 3 ? m.tail : m.covert))}
          {f > 0 && Array.from({ length: 7 }, (_, i) => feather(`flight-secondary${i}`, [0.055 + f * i * 0.018, 0.006, -0.010 - i * 0.019], [0.025 * f, 0.018, 0.17 + f * 0.05], [0, -0.45 - f * i * 0.065, -(1 - f) * Math.PI / 2], m.covert))}
          {Array.from({ length: 30 }, (_, i) => {
            const row = Math.floor(i / 6), col = i % 6;
            const y = -0.048 + row * 0.023, z = 0.027 - col * 0.036;
            const x = 0.021 + 0.049 * Math.sqrt(Math.max(0.04, 1 - (y / 0.094) ** 2 - ((z + 0.085) / 0.195) ** 2));
            return feather(`covert${i}`, [x + 0.004, y, z], [0.017, 0.013, 0.073], [0, -f * 0.5, -Math.PI / 2], (row + col) % 3 === 0 ? m.light : m.covert);
          })}
          {geo.bars.map((geometry, bar) => <mesh key={bar} geometry={geometry} material={m.stripe} castShadow receiveShadow />)}
        </>}
        {baby && Array.from({ length: 24 }, (_, i) => {
          const y = (noise(i + seed) - 0.5) * 0.085, z = -0.085 + (noise(i * 3 + seed) - 0.5) * 0.13;
          return <Rod key={`wingdown${i}`} a={[0.055, y, z]} b={[0.077, y + 0.013, z - 0.012]} radius={0.0012} material={m.down} />;
        })}
      </group>)}
      <group position={[0, 0, Math.sin(phase) * w * 0.016]}>
        <mesh geometry={geo.neck} material={m.neck} castShadow receiveShadow />
        {!baby && Array.from({ length: 144 }, (_, i) => {
          const row = Math.floor(i / 24), angle = ((i % 24) + (row % 2) * 0.5) / 24 * Math.PI * 2;
          const radius = 0.084 - row * 0.0053;
          const normal = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
          const tangent = new THREE.Vector3(-Math.sin(angle), 0, Math.cos(angle));
          const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(tangent, normal, new THREE.Vector3(0, 1, 0)));
          return <mesh key={`neck${i}`} geometry={geo.feather} material={row < 3 || Math.sin(angle) > 0.4 ? m.green : m.purple} position={[normal.x * radius, 0.410 + row * 0.020, 0.151 + normal.z * (radius + 0.004) + row * 0.008]} quaternion={q} scale={[0.012, 0.009, 0.029]} receiveShadow />;
        })}
        <group position={[0, 0.558, 0.203]} rotation={[head[0] + Math.sin(phase) * 0.04 * w, head[1], head[2]]}>
          {ellipsoid("skull", [0, 0.015, 0], [baby ? 0.072 : 0.064, 0.078, 0.079], m.head)}
          {ellipsoid("cheeks", [0, -0.014, 0.029], [0.061, 0.049, 0.060], m.head)}
          {[-1, 1].map(side => <group key={side} position={[side * 0.058, 0.028, 0.027]} rotation={[0, side * 0.12, 0]}>
            {ellipsoid("rim", [0, 0, 0], [0.008, 0.018, 0.018], m.cere)}
            {ellipsoid("iris", [side * 0.005, 0, 0], [0.006, baby ? 0.011 : 0.0145, baby ? 0.011 : 0.0145], m.iris)}
            {ellipsoid("pupil", [side * 0.010, 0, 0.002], [0.003, 0.0075, 0.0075], m.pupil)}
            {ellipsoid("glint", [side * 0.0125, 0.004, 0.005], [0.0018, 0.003, 0.003], m.white)}
          </group>)}
          <group position={[0, -0.002, 0.064]} rotation={[-mouth * 0.09, 0, 0]}>
            {ellipsoid("upper-bill", [0, -0.005, 0.034], [baby ? 0.025 : 0.020, 0.016, baby ? 0.063 : 0.054], m.bill, [0.09, 0, 0])}
            {ellipsoid("hook", [0, -0.014, baby ? 0.087 : 0.078], [0.010, 0.013, 0.013], m.bill)}
            {[-1, 1].map(side => ellipsoid(`cere${side}`, [side * 0.011, 0.009, 0.009], [0.015, 0.012, 0.024], m.cere))}
            {[-1, 1].map(side => ellipsoid(`nostril${side}`, [side * 0.0195, 0.008, 0.021], [0.002, 0.003, 0.007], m.bill))}
          </group>
          <group position={[0, -0.016, 0.064]} rotation={[mouth * 0.60, 0, 0]}>
            {ellipsoid("lower-bill", [0, -0.005, 0.033], [0.016, 0.007, baby ? 0.061 : 0.052], m.bill)}
            {mouth > 0.03 && ellipsoid("oral-cavity", [0, 0, 0.025], [0.013, 0.003, 0.037], m.mouth)}
          </group>
        </group>
        {crop > 0 && ellipsoid("crop-overlay", [0, 0.402, 0.208], [0.080 + clamp(crop) * 0.025, 0.073 + clamp(crop) * 0.020, 0.069 + clamp(crop) * 0.024], m.crop)}
      </group>
      {baby && Array.from({ length: 115 }, (_, i) => {
        const y = 0.22 + noise(i * 5 + seed) * 0.37, angle = noise(i * 7 + seed) * Math.PI * 2;
        const upper = y > 0.45, radius = upper ? 0.065 : 0.12 * Math.sqrt(Math.max(0.15, 1 - Math.pow((y - 0.33) / 0.17, 2)));
        const z = upper ? 0.195 : 0.015;
        const a: V3 = [Math.cos(angle) * radius, y, z + Math.sin(angle) * radius];
        const b: V3 = [a[0] * 1.12, y + 0.016 + noise(i + seed) * 0.025, z + (a[2] - z) * 1.13];
        return <Rod key={`down${i}`} a={a} b={b} radius={0.00125} material={m.down} />;
      })}
    </group>
    {[-1, 1].map(side => {
      const step = Math.sin(phase + (side < 0 ? Math.PI : 0)) * w;
      const lift = Math.max(0, step) * 0.042;
      const ankle: V3 = [side * 0.061, 0.035 + lift, step * 0.044];
      return <group key={`leg${side}`} position={[0, f * 0.145, -f * 0.035]} rotation={[-f * 0.8, 0, 0]}>
        {ellipsoid("thigh", [side * 0.061, 0.171 + bob, -0.012], [0.033, 0.067, 0.039], m.body, [-0.3, 0, 0])}
        <Rod a={[side * 0.061, 0.160 + bob, 0.005]} b={[side * 0.061, 0.088 + lift * 0.5, -0.058]} radius={0.012} material={m.skin} />
        <Rod a={[side * 0.061, 0.088 + lift * 0.5, -0.058]} b={ankle} radius={0.009} material={m.skin} />
        {Array.from({ length: 7 }, (_, i) => ellipsoid(`scute${i}`, [side * 0.061, 0.043 + lift + i * 0.007, -0.003 - i * 0.004], [0.009, 0.0016, 0.008], m.skin))}
        {[-1, 0, 1, 2].map(digit => {
          const back = digit === 2;
          const mid: V3 = [ankle[0] + (back ? 0 : digit * 0.019), 0.014 + lift, ankle[2] + (back ? -0.025 : 0.034)];
          const end: V3 = [ankle[0] + (back ? -side * 0.008 : digit * 0.029), 0.008 + lift, ankle[2] + (back ? -0.056 : digit === 0 ? 0.089 : 0.068)];
          return <group key={digit}>
            <Rod a={ankle} b={mid} radius={0.006} material={m.skin} /><Rod a={mid} b={end} radius={0.0047} material={m.skin} />
            {ellipsoid("joint", mid, [0.006, 0.005, 0.006], m.skin)}
            <Rod a={end} b={[end[0], 0.003 + lift, end[2] + (back ? -0.011 : 0.012)]} radius={0.003} material={m.claw} />
          </group>;
        })}
      </group>;
    })}
  </group>;
}
