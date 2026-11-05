import * as THREE from "three";
import { C } from "../theme";
import { Box, Glow, RBox } from "./basics";

type V3 = [number, number, number];
const STEEL = "#D3DADF";
const STEEL_DARK = "#9AA4AC";

// Cozinha simples: parede de azulejo, bancada, armários e janela.
export const Kitchen: React.FC = () => (
  <group>
    <Box size={[16, 0.1, 10]} position={[0, -0.05, 0]} color="#D9CBB4" cast={false} />
    {Array.from({ length: 10 }, (_, i) => (
      <Box key={i} size={[16, 0.012, 0.02]} position={[0, 0.01, -4 + i]} color="#C8B89E" cast={false} />
    ))}
    <Box size={[16, 7, 0.2]} position={[0, 3.5, -2.2]} color="#F2EDE2" cast={false} />
    {/* faixa de azulejos */}
    <Box size={[16, 1.6, 0.04]} position={[0, 2.2, -2.08]} color="#BFE0D9" cast={false} />
    {Array.from({ length: 40 }, (_, i) => (
      <Box key={`v${i}`} size={[0.015, 1.6, 0.01]} position={[-8 + i * 0.4, 2.2, -2.05]} color="#A3CBC3" cast={false} />
    ))}
    {[1.6, 2.0, 2.4, 2.8].map((y) => (
      <Box key={y} size={[16, 0.015, 0.01]} position={[0, y, -2.05]} color="#A3CBC3" cast={false} />
    ))}
    {/* bancada e armários */}
    <RBox size={[16, 1.3, 1.6]} position={[0, 0.65, -1.35]} color="#E2D2B8" radius={0.04} />
    <RBox size={[16, 0.1, 1.7]} position={[0, 1.33, -1.32]} color="#6F6A64" radius={0.03} />
    {[-6, -4, -2, 2, 4, 6].map((x) => (
      <RBox key={x} size={[1.8, 1.0, 0.04]} position={[x, 0.65, -0.53]} color="#E9DCC6" radius={0.02} />
    ))}
    <RBox size={[16, 1.2, 0.8]} position={[0, 4.6, -1.8]} color="#E2D2B8" radius={0.04} />
    {/* janela */}
    <RBox size={[2.4, 1.4, 0.06]} position={[-4.5, 3.5, -2.08]} color="#BFE3F7" radius={0.03} />
    <RBox size={[2.6, 0.1, 0.12]} position={[-4.5, 2.78, -2.05]} color="#FFFFFF" radius={0.02} />
  </group>
);

// Fogão com boca acesa.
export const Stove: React.FC<{ position: V3; flame: number; t: number }> = ({ position, flame, t }) => (
  <group position={position}>
    <RBox size={[2.6, 1.34, 1.6]} position={[0, 0.67, 0]} color="#F4F4F0" radius={0.05} />
    <RBox size={[2.6, 0.06, 1.6]} position={[0, 1.37, 0]} color="#2B2E33" radius={0.02} />
    <RBox size={[1.8, 0.6, 0.04]} position={[0, 0.55, 0.81]} color="#3A3F45" radius={0.03} />
    {[-0.6, 0.6].map((x) =>
      [-0.35, 0.35].map((z) => (
        <mesh key={`${x}${z}`} position={[x, 1.41, z]}>
          <cylinderGeometry args={[0.22, 0.22, 0.04, 20]} />
          <meshStandardMaterial color="#1A1C1F" />
        </mesh>
      )),
    )}
    {flame > 0.01
      ? Array.from({ length: 14 }, (_, i) => {
          const a = (i / 14) * Math.PI * 2;
          const h = 0.12 + Math.abs(Math.sin(t * 9 + i)) * 0.05;
          return (
            <mesh key={i} position={[0.6 + Math.cos(a) * 0.2, 1.46 + h / 2, 0.35 + Math.sin(a) * 0.2]}>
              <coneGeometry args={[0.035, h * flame, 6]} />
              <meshStandardMaterial color="#5AA8FF" emissive="#3D8BFF" emissiveIntensity={1.6} transparent opacity={0.9} />
            </mesh>
          );
        })
      : null}
    {[-0.7, -0.25, 0.25, 0.7].map((x) => (
      <mesh key={x} position={[x, 1.2, 0.82]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.07, 0.07, 0.06, 16]} />
        <meshStandardMaterial color="#2B2E33" />
      </mesh>
    ))}
  </group>
);

// Panela de pressão em corte (metade de trás) com conteúdo animado.
export const PressureCooker: React.FC<{
  position: V3;
  t: number;
  scale?: number;
  lid: number; // 0 = tampa no alto, 1 = encaixada
  water: number; // nível 0..1
  boil: number; // bolhas
  pressure: number; // 0..1 (setas, vapor preso)
  hot: number; // cor da água
  weightLift: number; // 0..1 peso da válvula levantando
  jet: number; // jato de vapor na válvula
  clog: number; // 0..1 espuma subindo e entupindo
  safety: number; // 0..1 pino de segurança saindo
  danger: number; // tremor + brilho vermelho
  cut?: boolean;
}> = ({ position, t, scale = 1, lid, water, boil, pressure, hot, weightLift, jet, clog, safety, danger, cut = true }) => {
  const shake = danger > 0.01 ? Math.sin(t * 70) * 0.02 * danger : 0;
  const lidY = 1.32 + (1 - lid) * 1.6;
  const waterH = 0.9 * water;
  const waterCol = "#" + new THREE.Color(C.water).lerp(new THREE.Color("#F0A35A"), hot).getHexString();
  const steamCount = Math.round(6 + pressure * 30);
  const beans = [];
  for (let i = 0; i < 26; i++) {
    const a = i * 2.39;
    const r = 0.15 + ((i * 37) % 10) / 14;
    const yb = 0.12 + ((i * 53) % 10) / 30 + (boil > 0 ? Math.sin(t * 4 + i) * 0.04 * boil : 0);
    beans.push(
      <mesh key={i} position={[Math.cos(a) * r * 0.85, yb, Math.sin(a) * r * 0.85]} rotation={[a, a * 0.5, 0]} scale={[1, 0.65, 0.65]}>
        <sphereGeometry args={[0.07, 10, 8]} />
        <meshStandardMaterial color="#5A2E1F" roughness={0.6} />
      </mesh>,
    );
  }
  return (
    <group position={[position[0] + shake, position[1], position[2]]} scale={scale}>
      {/* corpo */}
      <mesh position={[0, 0.65, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[1.0, 0.95, 1.3, 56, 1, true, cut ? Math.PI / 2 : 0, cut ? Math.PI : Math.PI * 2]} />
        <meshStandardMaterial color={STEEL} metalness={0.55} roughness={0.3} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.95, 48]} />
        <meshStandardMaterial color={STEEL_DARK} metalness={0.5} roughness={0.35} side={THREE.DoubleSide} />
      </mesh>
      {cut ? (
        <>
          <RBox size={[2.04, 0.05, 0.05]} position={[0, 1.3, 0]} color={STEEL_DARK} radius={0.02} />
          <RBox size={[0.05, 1.3, 0.05]} position={[-1.0, 0.65, 0]} color={STEEL_DARK} radius={0.02} />
          <RBox size={[0.05, 1.3, 0.05]} position={[1.0, 0.65, 0]} color={STEEL_DARK} radius={0.02} />
        </>
      ) : null}
      {/* cabos */}
      <RBox size={[0.9, 0.12, 0.2]} position={[-1.4, 1.15, 0]} color="#1C1E21" radius={0.05} />
      {/* água + feijão */}
      {water > 0.01 ? (
        <mesh position={[0, 0.03 + waterH / 2, 0]}>
          <cylinderGeometry args={[0.93, 0.93, waterH, 40]} />
          <meshStandardMaterial color={waterCol} transparent opacity={0.4} roughness={0.1} depthWrite={false} />
        </mesh>
      ) : null}
      {beans}
      {/* bolhas */}
      {boil > 0.01
        ? Array.from({ length: Math.round(30 * boil) }, (_, i) => {
            const r1 = Math.abs(Math.sin(i * 12.9898) * 43758.5453) % 1;
            const u = (r1 + t * 0.9) % 1;
            const a = i * 2.4;
            const r = 0.1 + (i % 6) * 0.13;
            return (
              <mesh key={i} position={[Math.cos(a) * r, 0.05 + u * waterH, Math.sin(a) * r]} scale={0.03 + u * 0.04}>
                <sphereGeometry args={[1, 8, 6]} />
                <meshStandardMaterial color="#FFFFFF" transparent opacity={0.7} roughness={0.05} />
              </mesh>
            );
          })
        : null}
      {/* vapor preso (moléculas batendo) */}
      {Array.from({ length: steamCount }, (_, i) => {
        const r1 = Math.abs(Math.sin(i * 91.7) * 43758.5) % 1;
        const r2 = Math.abs(Math.sin(i * 17.3) * 1234.5) % 1;
        const fx = Math.sin(t * (1.5 + r1 * 2) + i) * 0.75;
        const fz = Math.cos(t * (1.2 + r2 * 2) + i * 2) * 0.75;
        const top = 1.26;
        const bot = 0.08 + waterH;
        const fy = bot + (top - bot) * (0.5 + 0.5 * Math.sin(t * (2 + r2 * 3) + i * 1.3));
        return (
          <mesh key={i} position={[fx, fy, fz]} scale={0.05}>
            <sphereGeometry args={[1, 8, 6]} />
            <meshStandardMaterial color="#FFFFFF" emissive="#FFFFFF" emissiveIntensity={0.2} transparent opacity={0.35 + pressure * 0.5} />
          </mesh>
        );
      })}
      {/* setas de pressão empurrando a água */}
      {pressure > 0.05
        ? [-0.5, 0, 0.5].map((x) => (
            <group key={x} position={[x, 0.2 + waterH + 0.25 + Math.sin(t * 6 + x) * 0.03, 0.2]} scale={0.6 + pressure * 0.5}>
              <mesh position={[0, 0.12, 0]}>
                <cylinderGeometry args={[0.04, 0.04, 0.22, 10]} />
                <meshStandardMaterial color={danger > 0.3 ? C.bad : "#FF8A1E"} emissive={danger > 0.3 ? C.bad : "#FF8A1E"} emissiveIntensity={0.5} />
              </mesh>
              <mesh position={[0, -0.02, 0]} rotation={[Math.PI, 0, 0]}>
                <coneGeometry args={[0.1, 0.16, 12]} />
                <meshStandardMaterial color={danger > 0.3 ? C.bad : "#FF8A1E"} emissive={danger > 0.3 ? C.bad : "#FF8A1E"} emissiveIntensity={0.5} />
              </mesh>
            </group>
          ))
        : null}
      {/* espuma subindo até a válvula */}
      {clog > 0.01
        ? Array.from({ length: 40 }, (_, i) => {
            const a = i * 2.4;
            const r = 0.05 + (i % 7) * 0.12;
            const y = 0.05 + waterH + clog * (1.25 - waterH) * (0.4 + ((i * 13) % 10) / 16);
            return (
              <mesh key={i} position={[Math.cos(a) * r, Math.min(1.25, y), Math.sin(a) * r]} scale={0.08 + (i % 3) * 0.03}>
                <sphereGeometry args={[1, 10, 8]} />
                <meshStandardMaterial color="#F7EFE2" roughness={0.9} />
              </mesh>
            );
          })
        : null}
      {clog > 0.6 ? (
        <mesh position={[0, 1.25 + (clog - 0.6) * 0.35, 0]} scale={[1, 0.65, 0.65]}>
          <sphereGeometry args={[0.08, 10, 8]} />
          <meshStandardMaterial color="#5A2E1F" />
        </mesh>
      ) : null}

      {/* tampa */}
      <group position={[0, lidY, 0]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.95, 1.04, 0.1, 48, 1, false, cut ? Math.PI / 2 : 0, cut ? Math.PI : Math.PI * 2]} />
          <meshStandardMaterial color={STEEL} metalness={0.55} roughness={0.3} side={THREE.DoubleSide} />
        </mesh>
        {/* borracha de vedação */}
        <mesh position={[0, -0.03, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.98, 0.04, 8, 48]} />
          <meshStandardMaterial color="#C0392B" roughness={0.8} />
        </mesh>
        <RBox size={[1.6, 0.14, 0.24]} position={[1.0, 0.1, 0]} color="#1C1E21" radius={0.06} />
        {/* pino central + peso */}
        <mesh position={[0, 0.15, 0]}>
          <cylinderGeometry args={[0.05, 0.05, 0.22, 12]} />
          <meshStandardMaterial color={STEEL_DARK} metalness={0.6} roughness={0.3} />
        </mesh>
        <group position={[0, 0.28 + weightLift * 0.12, 0]} rotation={[0, t * 6 * weightLift, 0]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.13, 0.18, 0.18, 16]} />
            <meshStandardMaterial color="#3B3F45" metalness={0.4} roughness={0.4} />
          </mesh>
          <mesh position={[0, 0.12, 0]}>
            <sphereGeometry args={[0.07, 12, 10]} />
            <meshStandardMaterial color="#3B3F45" metalness={0.4} roughness={0.4} />
          </mesh>
        </group>
        {/* válvula de segurança */}
        <group position={[-0.5 - safety * 0.5, 0.1 + safety * 0.9, 0.0]} rotation={[0, 0, safety * 2]}>
          <mesh>
            <cylinderGeometry args={[0.07, 0.09, 0.12, 14]} />
            <meshStandardMaterial color="#E8352B" roughness={0.7} />
          </mesh>
        </group>
        {/* jatos de vapor */}
        {jet > 0.01
          ? Array.from({ length: 16 }, (_, i) => {
              const u = ((i / 16 + t * 1.6) % 1 + 1) % 1;
              return (
                <mesh key={i} position={[Math.sin(i * 3.1) * 0.05 * u * 4, 0.45 + u * 1.4, Math.cos(i * 2.3) * 0.05 * u * 4]} scale={(0.05 + u * 0.18) * jet}>
                  <icosahedronGeometry args={[1, 1]} />
                  <meshStandardMaterial color="#FFFFFF" transparent opacity={(1 - u) * 0.75} depthWrite={false} />
                </mesh>
              );
            })
          : null}
        {safety > 0.2
          ? Array.from({ length: 16 }, (_, i) => {
              const u = ((i / 16 + t * 1.8) % 1 + 1) % 1;
              return (
                <mesh key={i} position={[-0.5 - u * 1.4, 0.15 + u * 0.8, Math.sin(i) * 0.1 * u * 3]} scale={0.06 + u * 0.22}>
                  <icosahedronGeometry args={[1, 1]} />
                  <meshStandardMaterial color="#FFFFFF" transparent opacity={(1 - u) * 0.75} depthWrite={false} />
                </mesh>
              );
            })
          : null}
      </group>
      <Glow position={[0, 0.8, 1.2]} size={4 * danger} color={C.bad} opacity={danger * 0.5 * (0.6 + 0.4 * Math.sin(t * 10))} />
    </group>
  );
};

// Termômetro de coluna ao lado da panela.
export const Thermometer: React.FC<{ position: V3; level: number }> = ({ position, level }) => (
  <group position={position}>
    <RBox size={[0.42, 2.4, 0.16]} position={[0, 1.2, 0]} color="#FFFFFF" radius={0.08} />
    <mesh position={[0, 1.25, 0.09]}>
      <cylinderGeometry args={[0.05, 0.05, 1.9, 12]} />
      <meshStandardMaterial color="#E8EEF2" transparent opacity={0.8} />
    </mesh>
    <mesh position={[0, 0.3 + (1.8 * level) / 2, 0.1]}>
      <cylinderGeometry args={[0.04, 0.04, Math.max(0.01, 1.8 * level), 12]} />
      <meshStandardMaterial color="#E8352B" emissive="#E8352B" emissiveIntensity={0.4} />
    </mesh>
    <mesh position={[0, 0.25, 0.1]}>
      <sphereGeometry args={[0.1, 16, 12]} />
      <meshStandardMaterial color="#E8352B" emissive="#E8352B" emissiveIntensity={0.4} />
    </mesh>
    {Array.from({ length: 9 }, (_, i) => (
      <mesh key={i} position={[0.12, 0.45 + i * 0.2, 0.09]}>
        <boxGeometry args={[0.08, 0.012, 0.01]} />
        <meshStandardMaterial color="#5A646C" />
      </mesh>
    ))}
  </group>
);

// Relógio de parede com ponteiros girando rápido.
export const WallClock: React.FC<{ position: V3; t: number; speed: number }> = ({ position, t, speed }) => (
  <group position={position}>
    <mesh rotation={[Math.PI / 2, 0, 0]}>
      <cylinderGeometry args={[0.6, 0.6, 0.1, 40]} />
      <meshStandardMaterial color="#FFFFFF" />
    </mesh>
    <mesh position={[0, 0, 0.0]}>
      <torusGeometry args={[0.6, 0.06, 8, 40]} />
      <meshStandardMaterial color="#E8352B" />
    </mesh>
    <group rotation={[0, 0, -t * speed]} position={[0, 0, 0.06]}>
      <RBox size={[0.04, 0.42, 0.02]} position={[0, 0.2, 0]} color={C.ink} radius={0.01} />
    </group>
    <group rotation={[0, 0, -t * speed / 12]} position={[0, 0, 0.07]}>
      <RBox size={[0.06, 0.3, 0.02]} position={[0, 0.14, 0]} color={C.ink} radius={0.01} />
    </group>
  </group>
);

// Grão de feijão grande em corte, amolecendo.
export const BigBean: React.FC<{ position: V3; soft: number; t: number }> = ({ position, soft, t }) => {
  const wob = soft * Math.sin(t * 5) * 0.04;
  return (
    <group position={position} scale={[1 + wob, 1 - wob, 1]}>
      <mesh scale={[1.6, 1, 1]} castShadow>
        <sphereGeometry args={[0.7, 32, 24, 0, Math.PI]} />
        <meshStandardMaterial color="#5A2E1F" roughness={0.5} side={THREE.DoubleSide} />
      </mesh>
      <mesh scale={[1.55, 0.95, 0.02]} position={[0, 0, 0]}>
        <sphereGeometry args={[0.7, 32, 16]} />
        <meshStandardMaterial color={"#" + new THREE.Color("#E9D9B4").lerp(new THREE.Color("#C99A6B"), soft).getHexString()} roughness={0.9} />
      </mesh>
    </group>
  );
};
