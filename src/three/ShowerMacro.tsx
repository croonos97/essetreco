import { useMemo } from "react";
import * as THREE from "three";
import { C } from "../theme";
import { FlowParticles, Glow, Pipe, RBox } from "./basics";

type V3 = [number, number, number];

class Helix extends THREE.Curve<THREE.Vector3> {
  constructor(private r: number, private y0: number, private y1: number, private turns: number, private u0: number, private u1: number) {
    super();
  }
  getPoint(t: number, target = new THREE.Vector3()) {
    const u = this.u0 + (this.u1 - this.u0) * t;
    const a = u * this.turns * Math.PI * 2;
    return target.set(Math.cos(a) * this.r, this.y0 + (this.y1 - this.y0) * u, Math.sin(a) * this.r);
  }
}

// Geometria da mola em trechos (u = 0 no topo, 1 na base).
export const COIL = { r: 0.55, top: 2.12, bottom: 1.2, turns: 6.5 };
export const BREAK_U = 0.1923; // trecho de frente para a câmera
export const coilPoint = (u: number): V3 => {
  const a = u * COIL.turns * Math.PI * 2;
  return [Math.cos(a) * COIL.r, COIL.top + (COIL.bottom - COIL.top) * u, Math.sin(a) * COIL.r];
};

// Água fria (azul) -> quente (laranja) sem passar por cinza/roxo.
export const tempColor = (p: number) => {
  const cold = new THREE.Color(C.water);
  const mid1 = new THREE.Color("#9FDcFF");
  const mid2 = new THREE.Color("#FFC27A");
  const hot = new THREE.Color(C.warm);
  const c = p < 0.5 ? cold.lerp(mid1, p * 2) : mid2.lerp(hot, (p - 0.5) * 2);
  return "#" + c.getHexString();
};

const heatColor = (h: number) => {
  // cinza -> vermelho (patamar longo) -> laranja -> quase branco
  const g = new THREE.Color(C.nichrome);
  if (h <= 0) return { color: "#" + g.getHexString(), emissive: "#000000", ei: 0 };
  const red = new THREE.Color("#D8240F");
  const orange = new THREE.Color("#FF7A1A");
  const white = new THREE.Color("#FFF1CF");
  let col: THREE.Color;
  if (h < 0.55) col = g.clone().lerp(red, h / 0.55);
  else if (h < 0.8) col = red.clone();
  else if (h < 0.92) col = red.clone().lerp(orange, (h - 0.8) / 0.12);
  else col = orange.clone().lerp(white, (h - 0.92) / 0.08);
  return { color: "#" + col.getHexString(), emissive: "#" + col.getHexString(), ei: h < 0.8 ? h * 0.9 : 0.72 + (h - 0.8) * 6 };
};

const CoilPiece: React.FC<{ u0: number; u1: number; heat: number; radius?: number }> = ({ u0, u1, heat, radius = 0.045 }) => {
  const geo = useMemo(() => new THREE.TubeGeometry(new Helix(COIL.r, COIL.top, COIL.bottom, COIL.turns, u0, u1), Math.max(8, Math.round((u1 - u0) * 260)), radius, 10, false), [u0, u1, radius]);
  const hc = heatColor(heat);
  return (
    <mesh geometry={geo} castShadow>
      <meshStandardMaterial color={hc.color} emissive={hc.emissive} emissiveIntensity={hc.ei} roughness={0.45} metalness={0.3} />
    </mesh>
  );
};

const helixPoints = (u0: number, u1: number, n = 60): V3[] => Array.from({ length: n }, (_, i) => coilPoint(u0 + ((u1 - u0) * i) / (n - 1)));

export const ShowerMacro: React.FC<{
  t: number;
  position?: V3;
  rotation?: V3;
  scale?: number;
  explode?: number;
  housing?: number; // opacidade da carcaça (0 some)
  water?: number;
  diaphragm?: number;
  energy?: number;
  heatA?: number; // trecho de cima (usado no inverno)
  heatB?: number; // trecho de baixo
  flow?: number; // água passando pela mola
  hotOut?: number;
  winterTap?: boolean;
  burn?: number; // 0..1 bolha e ruptura
  knob?: number; // rotação do seletor
  sparkContacts?: number;
  bare?: boolean; // só a mola (cenas de comparação)
}> = ({
  t,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1,
  explode = 0,
  housing = 1,
  water = 0,
  diaphragm = 0,
  energy = 0,
  heatA = 0,
  heatB = 0,
  flow = 0,
  hotOut = 0,
  winterTap = false,
  burn = 0,
  knob = 0,
  sparkContacts = 0,
  bare = false,
}) => {
  const ex = (k: number) => explode * k;
  const diaY = 2.5 + diaphragm * 0.22 + ex(1.1);
  const contactY = 2.91 + ex(1.9);
  const coilDY = ex(-0.4);
  const crivoDY = ex(-1.2);
  const broken = burn > 0.8;
  const heatBreak = broken ? 0 : Math.max(heatA, burn > 0.3 ? 0.85 + (burn - 0.3) * 0.3 : 0);

  // cores da água: entra azul, sai laranja conforme hotOut
  const waterCol = (u: number) => tempColor(Math.min(1, u * 1.4) * hotOut);

  const housingMat = (
    <meshStandardMaterial color={C.plastic} roughness={0.55} side={THREE.DoubleSide} transparent={housing < 1} opacity={housing} depthWrite={housing >= 1} />
  );

  return (
    <group position={position} rotation={rotation} scale={scale}>
      {/* carcaça em corte (metade de trás) */}
      {housing > 0.01 ? (
        <group position={[0, ex(0.3), 0]}>
          <mesh position={[0, 2.0, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[1.15, 1.15, 2.2, 56, 1, true, Math.PI / 2, Math.PI]} />
            {housingMat}
          </mesh>
          <mesh position={[0, 3.1, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <circleGeometry args={[1.15, 48, 0, Math.PI]} />
            {housingMat}
          </mesh>
          {/* borda do corte, para ler a espessura */}
          <RBox size={[2.36, 0.06, 0.06]} position={[0, 3.1, 0]} color="#DCDCD5" radius={0.02} />
          <RBox size={[0.06, 2.2, 0.06]} position={[-1.15, 2.0, 0]} color="#DCDCD5" radius={0.02} />
          <RBox size={[0.06, 2.2, 0.06]} position={[1.15, 2.0, 0]} color="#DCDCD5" radius={0.02} />
          {/* divisória entre câmara de água e câmara da mola */}
          <mesh position={[0, 2.38, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[1.12, 48, 0, Math.PI]} />
            <meshStandardMaterial color="#E4E4DE" side={THREE.DoubleSide} transparent={housing < 1} opacity={housing} />
          </mesh>
          {/* seletor verão/inverno */}
          <group position={[1.18, 1.65, 0.0]} rotation={[0, 0, -Math.PI / 2]}>
            <mesh castShadow>
              <cylinderGeometry args={[0.24, 0.26, 0.16, 24]} />
              <meshStandardMaterial color="#E9E9E2" />
            </mesh>
            <group rotation={[0, knob, 0]}>
              <RBox size={[0.08, 0.1, 0.36]} position={[0, 0.1, 0]} color="#C7462F" radius={0.03} />
            </group>
          </group>
        </group>
      ) : null}

      {bare ? null : (
        <>
      {/* cano de entrada */}
      <Pipe points={[[0, 4.6 + ex(1.5), 0], [0, 3.05 + ex(1.5), 0]]} radius={0.12} color={C.chrome} />
      <FlowParticles points={[[0, 4.7 + ex(1.5), 0], [0, 3.0, 0], [0.4, 2.75, 0.2]]} t={t} count={18} speed={0.6} size={0.06} color={C.water} visible={water} emissive={0.2} jitter={0.08} />

      {/* água na câmara de cima */}
      {water > 0.01 ? (
        <mesh position={[0, 2.42 + 0.33 * water + ex(1.1), 0]}>
          <cylinderGeometry args={[1.08, 1.08, 0.66 * water, 40]} />
          <meshStandardMaterial color={C.water} transparent opacity={0.32} roughness={0.1} depthWrite={false} />
        </mesh>
      ) : null}

      {/* diafragma de borracha + ponte de contato */}
      <group position={[0, diaY, 0]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.85, 0.85, 0.07, 40]} />
          <meshStandardMaterial color={C.rubber} roughness={0.9} />
        </mesh>
        <RBox size={[1.25, 0.06, 0.16]} position={[0, 0.1, 0]} color={C.copper} radius={0.02} metalness={0.5} roughness={0.35} emissive={C.energy} emissiveIntensity={energy * 0.4} />
      </group>
      {/* contatos fixos */}
      {[-0.5, 0.5].map((x) => (
        <RBox key={x} size={[0.26, 0.12, 0.26]} position={[x, contactY, 0]} color={C.copper} radius={0.03} metalness={0.5} roughness={0.35} emissive={C.energy} emissiveIntensity={energy * 0.5} />
      ))}
      {sparkContacts > 0.01 ? (
        <>
          <Glow position={[-0.5, contactY - 0.08, 0.2]} size={0.9 * sparkContacts} color={C.energy} opacity={0.9 * sparkContacts} />
          <Glow position={[0.5, contactY - 0.08, 0.2]} size={0.9 * sparkContacts} color={C.energy} opacity={0.9 * sparkContacts} />
        </>
      ) : null}

      {/* fios: contato esquerdo -> topo da mola; contato direito -> base (ou meio, no inverno) */}
      <group position={[0, 0, 0]}>
        <Pipe points={[[-0.5, contactY, 0.15], [-0.85, contactY - 0.3, 0.4], [-0.85, 2.2 + coilDY, 0.4], coilPoint(0).map((v, i) => (i === 1 ? v + coilDY : v)) as V3]} radius={0.03} color="#C9472F" emissive={C.energy} emissiveIntensity={energy * 0.6} />
        <Pipe
          points={[
            [0.5, contactY, 0.15],
            [0.9, contactY - 0.3, 0.4],
            [0.9, 1.4 + coilDY, 0.45],
            (winterTap ? coilPoint(0.5) : coilPoint(1)).map((v, i) => (i === 1 ? v + coilDY : v)) as V3,
          ]}
          radius={0.03}
          color="#2F4C8F"
          emissive={C.energy}
          emissiveIntensity={energy * 0.6}
        />
      </group>

        </>
      )}
      {/* mola de níquel-cromo */}
      <group position={[0, coilDY, 0]}>
        <CoilPiece u0={0} u1={0.17} heat={heatA} />
        {broken ? (
          <>
            <CoilPiece u0={0.17} u1={0.185} heat={0.2} />
            <CoilPiece u0={0.2} u1={0.215} heat={0.2} />
          </>
        ) : (
          <CoilPiece u0={0.17} u1={0.215} heat={heatBreak} />
        )}
        <CoilPiece u0={0.215} u1={0.5} heat={heatA} />
        <CoilPiece u0={0.5} u1={1} heat={heatB} />
        {/* base cerâmica no meio da mola */}
        <mesh position={[0, (COIL.top + COIL.bottom) / 2, 0]} castShadow>
          <cylinderGeometry args={[0.18, 0.18, 1.15, 16]} />
          <meshStandardMaterial color="#EDE6D6" roughness={0.9} />
        </mesh>
        {/* brilho de calor */}
        <Glow position={[0, 1.9, 0.6]} size={2.4} color={C.hot} opacity={Math.min(heatA, 1) * 0.35} />
        <Glow position={[0, 1.4, 0.6]} size={2.4} color={C.hot} opacity={Math.min(heatB, 1) * 0.35} />
        {/* bolha de ar e ruptura */}
        {burn > 0.05 && !broken ? (
          <mesh position={coilPoint(BREAK_U)} scale={0.15 + burn * 0.25}>
            <sphereGeometry args={[1, 20, 16]} />
            <meshStandardMaterial color="#FFFFFF" transparent opacity={0.45} roughness={0.05} />
          </mesh>
        ) : null}
        {burn > 0.4 ? <Glow position={coilPoint(BREAK_U)} size={0.8 + (broken ? 1.2 : 0)} color={broken ? C.energy : "#FFE9C2"} opacity={broken ? Math.max(0, 1 - (burn - 0.8) * 5) : burn} /> : null}
        {/* energia passando pela mola */}
        <FlowParticles points={helixPoints(0, winterTap ? 0.5 : 1)} t={t} count={winterTap ? 34 : 60} speed={winterTap ? 0.34 : 0.17} size={0.032} color={C.energy} emissive={1.4} visible={broken ? 0 : energy} />
      </group>
      {bare ? null : (
        <>
      {/* água envolvendo a mola: desce em espiral e esquenta */}
      <FlowParticles
        points={[
          [0.9, 2.3, 0.6],
          [0.75, 2.0, -0.3],
          [-0.75, 1.75, 0.35],
          [-0.7, 1.45, -0.35],
          [0.75, 1.2, 0.3],
          [0.3, 0.95 + crivoDY, 0.1],
        ]}
        t={t}
        count={46}
        speed={0.32}
        size={0.055}
        color={(u) => waterCol(u)}
        emissive={0.25}
        visible={flow}
        jitter={0.5}
      />

      {/* crivo */}
      <group position={[0, 0.92 + crivoDY, 0]}>
        <mesh castShadow receiveShadow>
          <cylinderGeometry args={[1.08, 1.08, 0.08, 48]} />
          <meshStandardMaterial color="#F1F1EC" roughness={0.5} />
        </mesh>
        {Array.from({ length: 30 }, (_, i) => {
          const a = i * 2.4;
          const r = 0.2 + (i % 5) * 0.17;
          return (
            <mesh key={i} position={[Math.cos(a) * r, -0.045, Math.sin(a) * r]} rotation={[Math.PI / 2, 0, 0]}>
              <circleGeometry args={[0.035, 8]} />
              <meshStandardMaterial color="#7E8A92" side={THREE.DoubleSide} />
            </mesh>
          );
        })}
      </group>
      {/* gotas saindo */}
      {flow > 0.01
        ? Array.from({ length: Math.round(28 * flow) }, (_, i) => {
            const r1 = Math.abs(Math.sin(i * 12.9898) * 43758.5453) % 1;
            const u = (r1 + t * 1.4) % 1;
            const a = i * 2.4;
            const r = 0.2 + (i % 5) * 0.17;
            const col = tempColor(hotOut);
            return (
              <mesh key={i} position={[Math.cos(a) * r * (1 + u * 0.4), 0.85 + crivoDY - u * 0.95, Math.sin(a) * r * (1 + u * 0.4)]} scale={[1, 1.8, 1]}>
                <sphereGeometry args={[0.04, 8, 6]} />
                <meshStandardMaterial color={col} emissive={col} emissiveIntensity={0.2} roughness={0.2} />
              </mesh>
            );
          })
        : null}
        </>
      )}
    </group>
  );
};
