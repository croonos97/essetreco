import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { fbm, rnd, SkyDome } from "../World";
import { Inst, rockGeo, Spot, spread, plainMat } from "./vegetacao";

// =====================================================================
// FUNDO DO RIO (câmera submersa). Chão de areia + cascalho em y≈0, superfície em y = `superficie`.
// Plantas aquáticas balançando, galho afundado, folhas no fundo, cáusticas animadas,
// feixes de luz e partículas em suspensão. Use com <TintaAgua> por cima.
// =====================================================================
export const fundoAltura = (x: number, z: number) => Math.sin(x * 2.6 + z * 0.8) * 0.025 + (fbm(x * 0.25 + 3, z * 0.25) - 0.5) * 0.5;

export type FundoProps = { t: number; superficie?: number; centro?: [number, number]; luz?: number; livre?: { x: number; z: number; r: number }[] };

const causticMat = () =>
  new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uT: { value: 0 }, uK: { value: 1 } },
    vertexShader: `varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0);} `,
    fragmentShader: `uniform float uT; uniform float uK; varying vec2 vP;
      float c(vec2 p){ float v=0.0; for(int i=0;i<3;i++){ p = vec2(p.x+sin(p.y*1.7+uT*0.9+float(i)), p.y+cos(p.x*1.5-uT*0.7+float(i)*1.3)); v += abs(sin(p.x*2.1)*sin(p.y*2.3)); } return v/3.0; }
      void main(){ vec2 p = vP*1.6; float v = pow(1.0 - c(p), 6.0); float fade = smoothstep(18.0, 4.0, length(vP));
        gl_FragColor = vec4(vec3(0.75,1.0,0.95)*v*0.55*uK*fade, 1.0); }`,
  });
const surfaceMat = () =>
  new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    fog: false,
    uniforms: { uT: { value: 0 } },
    vertexShader: `varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0);} `,
    fragmentShader: `uniform float uT; varying vec2 vP;
      void main(){ float w = sin(vP.x*1.3+uT*1.2)*sin(vP.y*1.1-uT)*0.5+0.5; float w2 = sin((vP.x+vP.y)*2.7+uT*2.0)*0.5+0.5;
        float d = smoothstep(40.0, 0.0, length(vP));
        vec3 c = mix(vec3(0.16,0.55,0.62), vec3(0.75,0.98,1.0), (w*0.55+w2*0.25)*d + d*0.25);
        gl_FragColor = vec4(c,1.0); }`,
  });
const shaftMat = () =>
  new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: { uO: { value: 0.18 } },
    vertexShader: `varying vec2 vU; void main(){ vU = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0);} `,
    fragmentShader: `uniform float uO; varying vec2 vU; void main(){ float a = smoothstep(0.0,0.5,vU.x)*smoothstep(1.0,0.5,vU.x)*vU.y; gl_FragColor = vec4(vec3(0.8,1.0,0.95)*a*uO,1.0);} `,
  });

const weedGeo = (() => {
  let g: THREE.BufferGeometry | null = null;
  return () => {
    if (g) return g;
    const v: number[] = [];
    const N = 10;
    for (let i = 0; i < N; i++) {
      const y0 = i / N, y1 = (i + 1) / N;
      const w0 = 0.05 * (1 - y0 * 0.7), w1 = 0.05 * (1 - y1 * 0.7);
      const b0 = Math.sin(y0 * 2.5) * 0.15, b1 = Math.sin(y1 * 2.5) * 0.15;
      v.push(-w0 + b0, y0, 0, w0 + b0, y0, 0, -w1 + b1, y1, 0, w0 + b0, y0, 0, w1 + b1, y1, 0, -w1 + b1, y1, 0);
    }
    g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(v, 3));
    g.computeVertexNormals();
    return g;
  };
})();

export const FundoDoRio: React.FC<FundoProps> = ({ t, superficie = 2.6, centro = [0, 0], luz = 1, livre = [] }) => {
  const [cx, cz] = centro;
  const floor = useMemo(() => {
    const g = new THREE.PlaneGeometry(90, 90, 150, 150);
    g.rotateX(-Math.PI / 2);
    const p = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i) + cx, z = p.getZ(i) + cz;
      p.setXYZ(i, x, fundoAltura(x, z), z);
    }
    const ng = g.toNonIndexed();
    ng.computeVertexNormals();
    const n = ng.attributes.position.count;
    const col = new Float32Array(n * 3);
    const sand = [new THREE.Color("#C9B48A"), new THREE.Color("#B8A27A"), new THREE.Color("#A9936E"), new THREE.Color("#8E8064")];
    for (let f = 0; f < n / 3; f++) {
      const x = ng.attributes.position.getX(f * 3), z = ng.attributes.position.getZ(f * 3);
      const k = fbm(x * 0.3, z * 0.3);
      const c = sand[Math.min(3, Math.floor(k * 3 + rnd(f, 2) * 1.2))].clone();
      for (let j = 0; j < 3; j++) col.set([c.r, c.g, c.b], (f * 3 + j) * 3);
    }
    ng.setAttribute("color", new THREE.BufferAttribute(col, 3));
    return ng;
  }, [cx, cz]);
  const sp = useMemo(() => {
    const A = (r: number) => ({ x0: cx - r, x1: cx + r, z0: cz - r, z1: cz + r });
    const clear = (s: Spot[], k = 1) => s.filter((q) => !livre.some((l) => Math.hypot(q.x - l.x, q.z - l.z) < l.r * k));
    const h = fundoAltura;
    return {
      pebble: spread(2600, 61, A(9), h, () => true, 0.02, 0.09),
      rock: clear(spread(40, 62, A(22), h, () => true, 0.25, 1.1)),
      weed: clear(spread(260, 63, A(18), h, (x, z) => fbm(x * 0.2 + 9, z * 0.2) > 0.48, 0.6, 1.8)),
      leaf: spread(220, 64, A(10), (x, z) => h(x, z) + 0.012, () => true, 0.08, 0.16),
    };
  }, [cx, cz, JSON.stringify(livre)]);
  const caus = useMemo(causticMat, []);
  const surf = useMemo(surfaceMat, []);
  const shaft = useMemo(shaftMat, []);
  caus.uniforms.uT.value = t;
  caus.uniforms.uK.value = luz;
  surf.uniforms.uT.value = t;
  shaft.uniforms.uO.value = 0.16 * luz;
  const weedMat = useMemo(() => new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.7 }), []);
  const leafGeo = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(0, -1);
    s.quadraticCurveTo(0.45, 0, 0, 1);
    s.quadraticCurveTo(-0.45, 0, 0, -1);
    const g = new THREE.ShapeGeometry(s, 4);
    g.rotateX(-Math.PI / 2);
    return g;
  }, []);
  const branch = useMemo(() => new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(-6, 0.1, -3), new THREE.Vector3(-2, 0.25, -3.6), new THREE.Vector3(1, 0.2, -4.5), new THREE.Vector3(4, 0.35, -4)]), 30, 0.18, 7), []);
  // partículas em suspensão
  const pts = useRef<THREE.Points>(null);
  const base = useMemo(() => Float32Array.from({ length: 900 }, (_, i) => rnd(Math.floor(i / 3), 70 + (i % 3))), []);
  useLayoutEffect(() => {
    const g = pts.current?.geometry;
    if (!g) return;
    const arr = new Float32Array(900);
    for (let i = 0; i < 300; i++) {
      arr[i * 3] = cx + (base[i * 3] - 0.5) * 14 + Math.sin(t * 0.3 + i) * 0.2;
      arr[i * 3 + 1] = 0.1 + ((base[i * 3 + 1] * superficie + t * 0.05) % superficie);
      arr[i * 3 + 2] = cz + (base[i * 3 + 2] - 0.5) * 14 + Math.cos(t * 0.25 + i) * 0.2;
    }
    g.setAttribute("position", new THREE.BufferAttribute(arr, 3));
  }, [t, cx, cz, superficie, base]);
  return (
    <group>
      <fog attach="fog" args={["#2E8798", 1.5, 26]} />
      <SkyDome top="#86DCE6" horizon="#2E8798" bottom="#1F6475" />
      <mesh geometry={floor} receiveShadow>
        <meshStandardMaterial vertexColors roughness={0.95} flatShading />
      </mesh>
      <mesh material={caus} position={[cx, 0.03, cz]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={1}>
        <planeGeometry args={[40, 40, 1, 1]} />
      </mesh>
      <mesh material={surf} position={[cx, superficie, cz]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[120, 120, 1, 1]} />
      </mesh>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <mesh key={i} material={shaft} position={[cx - 6 + i * 2.6 + Math.sin(t * 0.2 + i) * 0.3, superficie / 2, cz - 4 - (i % 3) * 2]} rotation={[0, 0.3, 0.22]} renderOrder={9}>
          <planeGeometry args={[0.9 + (i % 2) * 0.6, superficie * 1.6]} />
        </mesh>
      ))}
      <Inst geo={rockGeo()} spots={sp.pebble} material={plainMat("#9A8F7E", { flatShading: true })} castShadow={false} color={(s) => ["#8C8274", "#A39887", "#6F685D", "#B7AA92", "#7D6B57"][Math.floor(s.k * 5)]} />
      <Inst geo={rockGeo()} spots={sp.rock} material={plainMat("#7E7A70", { flatShading: true })} color={(s) => (s.k < 0.5 ? "#6D6B63" : "#86817A")} />
      <Inst geo={weedGeo()} spots={sp.weed} material={weedMat} scale={[1, 1, 1]} sway={{ t, amp: 0.18 }} castShadow={false} color={(s) => (s.k < 0.4 ? "#4E8F3E" : s.k < 0.8 ? "#5FA347" : "#7DB356")} />
      <Inst geo={leafGeo} spots={sp.leaf} material={plainMat("#7A5A33", { side: THREE.DoubleSide })} castShadow={false} color={(s) => (s.k < 0.5 ? "#6E4F2C" : "#8C6B3A")} />
      <mesh geometry={branch} material={plainMat("#4E3A2A", { flatShading: true })} castShadow />
      <points ref={pts}>
        <bufferGeometry />
        <pointsMaterial color="#D8F4F0" size={0.025} transparent opacity={0.7} depthWrite={false} />
      </points>
    </group>
  );
};
