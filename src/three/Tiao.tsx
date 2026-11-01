import * as THREE from "three";
import { C } from "../theme";
import { RBox } from "./basics";

export type Mood = "neutral" | "happy" | "cold" | "shock" | "sad" | "relaxed";
export type Pose = "down" | "up" | "hug" | "wave" | "point";

const mixColor = (a: string, b: string, p: number) => "#" + new THREE.Color(a).lerp(new THREE.Color(b), p).getHexString();

// Mascote do canal: Tião, boneco de blocos expressivo.
export const Tiao: React.FC<{
  position?: [number, number, number];
  rotation?: number;
  scale?: number;
  mood?: Mood;
  pose?: Pose;
  outfit?: "casual" | "towel" | "dummy";
  cold?: number; // 0..1 tom azulado + tremedeira
  t: number; // segundos (para piscar, respirar)
  look?: [number, number]; // olhar (x,y) -1..1
  wet?: boolean;
  phone?: boolean;
  armROverride?: [number, number, number];
  armLOverride?: [number, number, number];
  sweat?: number;
  sit?: number; // 0..1 sentado
  lean?: number; // inclinação do tronco para frente (rad)
  headLean?: number; // inclinação extra da cabeça (rad)
  belt?: number; // cinto visível 0..1
  beltGlow?: number;
}> = ({ position = [0, 0, 0], rotation = 0, scale = 1, mood = "neutral", pose = "down", outfit = "casual", cold = 0, t, look = [0, 0], wet = false, phone = false, armROverride, armLOverride, sweat = 0, sit = 0, lean = 0, headLean = 0, belt = 0, beltGlow = 0 }) => {
  const dummy = outfit === "dummy";
  const skin = dummy ? "#F2C94C" : mixColor(C.skin, C.skinCold, cold);
  const hair = dummy ? "#E3B63A" : C.hair;
  const shiver = cold > 0.2 ? Math.sin(t * 60) * 0.012 * cold : 0;
  const breathe = Math.sin(t * 2.2) * 0.012;
  const blink = (t * 1000) % 3400 < 120 ? 0.12 : 1;
  const torsoColor = outfit === "towel" ? skin : dummy ? "#2F3540" : C.shirt;
  const legColor = outfit === "towel" ? skin : dummy ? "#2F3540" : C.jeans;
  const sleeve = outfit === "towel" ? skin : dummy ? "#2F3540" : C.shirt;

  // braços (rotação no ombro: z abre para os lados, x levanta para frente)
  let armL: [number, number, number] = [0, 0, 0.12];
  let armR: [number, number, number] = [0, 0, -0.12];
  if (pose === "up") {
    const w = Math.sin(t * 8) * 0.12;
    armL = [0, 0, -2.35 - w];
    armR = [0, 0, 2.35 + w];
  } else if (pose === "hug") {
    armL = [-1.25, 0.0, 1.0];
    armR = [-1.25, 0.0, -1.0];
  } else if (pose === "wave") {
    armL = [0, 0, 0.12];
    armR = [0, 0, 2.5 + Math.sin(t * 9) * 0.35];
  } else if (pose === "point") {
    armL = [0, 0, 0.12];
    armR = [-1.4, 0, -0.2];
  }

  if (phone) armR = [-1.1, 0, 0.35];
  if (armROverride) armR = armROverride;
  if (armLOverride) armL = armLOverride;
  const eyeY = 1.77 + look[1] * 0.012;
  const eyeX = look[0] * 0.018;
  const happyEyes = mood === "happy" || mood === "relaxed";

  // sobrancelhas por humor
  const brow = { neutral: 0, happy: 0.1, relaxed: 0.05, cold: -0.35, shock: 0.25, sad: -0.4 }[mood];
  const browY = { neutral: 1.88, happy: 1.9, relaxed: 1.88, cold: 1.885, shock: 1.93, sad: 1.885 }[mood];

  return (
    <group position={[position[0] + shiver, position[1], position[2]]} rotation={[0, rotation, 0]} scale={scale}>
      {/* pernas (giram no quadril quando sentado) */}
      <group position={[0, 0.78, 0]} rotation={[(-Math.PI / 2) * sit, 0, 0]}>
        <group position={[0, -0.78, 0]}>
          <RBox size={[0.24, 0.78, 0.26]} position={[-0.14, 0.39, 0]} color={legColor} radius={0.05} />
          <RBox size={[0.24, 0.78, 0.26]} position={[0.14, 0.39, 0]} color={legColor} radius={0.05} />
          <RBox size={[0.26, 0.1, 0.34]} position={[-0.14, 0.05, 0.04]} color={outfit === "towel" ? skin : C.ink} radius={0.04} />
          <RBox size={[0.26, 0.1, 0.34]} position={[0.14, 0.05, 0.04]} color={outfit === "towel" ? skin : C.ink} radius={0.04} />
        </group>
      </group>
      {outfit === "towel" ? <RBox size={[0.66, 0.42, 0.36]} position={[0, 0.72, 0]} color={C.towel} radius={0.08} /> : null}

      {/* corpo de cima: gira no quadril */}
      <group position={[0, 0.78, 0]} rotation={[lean, 0, 0]}>
      <group position={[0, -0.78, 0]}>
      {/* tronco */}
      <group position={[0, 1.13 + breathe, 0]}>
        <RBox size={[0.62, 0.66, 0.34]} color={torsoColor} radius={0.09} />
        {outfit === "casual" ? <RBox size={[0.3, 0.06, 0.02]} position={[0, 0.3, 0.171]} color={"#E0A91C"} radius={0.01} /> : null}
        {dummy
          ? [-0.16, 0.16].map((x) => (
              <group key={x} position={[x, 0.12, 0.172]}>
                <mesh>
                  <circleGeometry args={[0.07, 16]} />
                  <meshStandardMaterial color="#F2C94C" />
                </mesh>
                <mesh position={[0, 0, 0.002]}>
                  <circleGeometry args={[0.07, 16, 0, Math.PI / 2]} />
                  <meshStandardMaterial color={C.ink} />
                </mesh>
                <mesh position={[0, 0, 0.002]}>
                  <circleGeometry args={[0.07, 16, Math.PI, Math.PI / 2]} />
                  <meshStandardMaterial color={C.ink} />
                </mesh>
              </group>
            ))
          : null}
        {belt > 0.01 ? (
          <group scale={[1, 1, 1]}>
            <RBox size={[0.12, 0.86, 0.04]} position={[0, 0.02, 0.19]} rotation={[0, 0, 0.72]} color="#2E3138" radius={0.02} emissive="#FFD23F" emissiveIntensity={beltGlow} />
            <RBox size={[0.68, 0.11, 0.04]} position={[0, -0.27, 0.19]} color="#2E3138" radius={0.02} emissive="#FFD23F" emissiveIntensity={beltGlow} />
            <RBox size={[0.1, 0.08, 0.05]} position={[0.26, -0.27, 0.21]} color="#A9B1B8" radius={0.02} />
          </group>
        ) : null}
      </group>

      {/* braços */}
      <group position={[-0.39, 1.38 + breathe, 0]} rotation={armL}>
        <RBox size={[0.18, 0.56, 0.2]} position={[0, -0.27, 0]} color={sleeve} radius={0.06} />
        <RBox size={[0.17, 0.15, 0.19]} position={[0, -0.6, 0]} color={skin} radius={0.06} />
      </group>
      <group position={[0.39, 1.38 + breathe, 0]} rotation={armR}>
        <RBox size={[0.18, 0.56, 0.2]} position={[0, -0.27, 0]} color={sleeve} radius={0.06} />
        <RBox size={[0.17, 0.15, 0.19]} position={[0, -0.6, 0]} color={skin} radius={0.06} />
        {phone ? <RBox size={[0.2, 0.04, 0.34]} position={[0, -0.7, 0.05]} color={C.ink} radius={0.03} emissive={"#5FF3FF"} emissiveIntensity={0.3} /> : null}
      </group>

      {/* cabeça: gira no pescoço */}
      <group position={[0, 1.48, 0]} rotation={[headLean, 0, 0]}>
      <group position={[0, -1.48 + breathe * 1.2, 0]}>
        {sweat > 0.01
          ? [0, 1, 2].map((i) => {
              const u = ((t * 0.9 + i / 3) % 1 + 1) % 1;
              return (
                <mesh key={`sw${i}`} position={[i === 1 ? -0.3 : 0.3, 2.0 - u * 0.5, 0.15 + i * 0.03]} scale={[0.045 * sweat, 0.07 * sweat, 0.045 * sweat]}>
                  <sphereGeometry args={[1, 10, 8]} />
                  <meshStandardMaterial color="#7FD3FF" emissive="#7FD3FF" emissiveIntensity={0.3} transparent opacity={1 - u} />
                </mesh>
              );
            })
          : null}
        <RBox size={[0.52, 0.5, 0.46]} position={[0, 1.74, 0]} color={skin} radius={0.12} />
        <RBox size={[0.55, 0.14, 0.5]} position={[0, 1.98, -0.01]} color={hair} radius={0.06} />
        <RBox size={[0.55, 0.3, 0.12]} position={[0, 1.86, -0.2]} color={hair} radius={0.05} />
        {wet ? <RBox size={[0.56, 0.06, 0.52]} position={[0, 2.06, -0.01]} color={C.water} radius={0.03} opacity={0.6} /> : null}
        {/* orelhas */}
        <RBox size={[0.06, 0.12, 0.1]} position={[-0.28, 1.74, 0]} color={skin} radius={0.03} />
        <RBox size={[0.06, 0.12, 0.1]} position={[0.28, 1.74, 0]} color={skin} radius={0.03} />

        {/* olhos */}
        {[-0.11, 0.11].map((x) => (
          <group key={x} position={[x, eyeY, 0.232]}>
            {happyEyes ? (
              <mesh rotation={[0, 0, 0]} position={[0, -0.01, 0.005]}>
                <torusGeometry args={[0.045, 0.014, 6, 12, Math.PI]} />
                <meshStandardMaterial color={C.ink} />
              </mesh>
            ) : (
              <group scale={[1, mood === "shock" ? 1.25 * blink : blink, 1]}>
                <mesh>
                  <boxGeometry args={[0.105, 0.125, 0.012]} />
                  <meshStandardMaterial color="#fff" roughness={0.4} />
                </mesh>
                <mesh position={[eyeX, -0.008, 0.008]}>
                  <boxGeometry args={[0.055, 0.075, 0.01]} />
                  <meshStandardMaterial color={C.ink} roughness={0.3} />
                </mesh>
                <mesh position={[eyeX + 0.012, 0.012, 0.014]}>
                  <boxGeometry args={[0.016, 0.016, 0.004]} />
                  <meshStandardMaterial color="#fff" emissive="#fff" emissiveIntensity={0.4} />
                </mesh>
              </group>
            )}
          </group>
        ))}
        {/* sobrancelhas */}
        <mesh position={[-0.11, browY, 0.236]} rotation={[0, 0, -brow]}>
          <boxGeometry args={[0.13, 0.03, 0.012]} />
          <meshStandardMaterial color={dummy ? C.ink : C.hair} />
        </mesh>
        <mesh position={[0.11, browY, 0.236]} rotation={[0, 0, brow]}>
          <boxGeometry args={[0.13, 0.03, 0.012]} />
          <meshStandardMaterial color={dummy ? C.ink : C.hair} />
        </mesh>
        {/* boca */}
        {mood === "happy" || mood === "relaxed" ? (
          <mesh position={[0, 1.63, 0.232]} rotation={[0, 0, Math.PI]}>
            <torusGeometry args={[mood === "happy" ? 0.075 : 0.055, 0.018, 6, 14, Math.PI]} />
            <meshStandardMaterial color={C.ink} />
          </mesh>
        ) : mood === "sad" ? (
          <mesh position={[0, 1.6, 0.232]}>
            <torusGeometry args={[0.06, 0.016, 6, 14, Math.PI]} />
            <meshStandardMaterial color={C.ink} />
          </mesh>
        ) : mood === "shock" ? (
          <mesh position={[0, 1.62, 0.231]} rotation={[Math.PI / 2, 0, 0]} scale={[1, 1, 1.35]}>
            <cylinderGeometry args={[0.05, 0.05, 0.012, 16]} />
            <meshStandardMaterial color={C.ink} />
          </mesh>
        ) : mood === "cold" ? (
          <group position={[0, 1.62, 0.232]}>
            <mesh>
              <boxGeometry args={[0.16, 0.06, 0.01]} />
              <meshStandardMaterial color={C.ink} />
            </mesh>
            <mesh position={[0, 0, 0.006]}>
              <boxGeometry args={[0.14, 0.022, 0.006]} />
              <meshStandardMaterial color="#fff" />
            </mesh>
          </group>
        ) : (
          <mesh position={[0, 1.63, 0.232]}>
            <boxGeometry args={[0.13, 0.025, 0.01]} />
            <meshStandardMaterial color={C.ink} />
          </mesh>
        )}
      </group>
      </group>
      </group>
      </group>
    </group>
  );
};
