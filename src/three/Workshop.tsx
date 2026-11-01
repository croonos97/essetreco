import { C } from "../theme";
import { Box, RBox } from "./basics";

// Bancada de oficina: cenário fixo das cenas de "raio-x".
export const Workshop: React.FC<{ width?: number }> = ({ width = 14 }) => {
  const holes = [];
  for (let x = -width / 2 + 0.4; x < width / 2; x += 0.4) {
    for (let y = 0.6; y < 6.5; y += 0.4) {
      holes.push(
        <mesh key={`${x}_${y}`} position={[x, y, -3.39]}>
          <circleGeometry args={[0.035, 8]} />
          <meshStandardMaterial color="#A88E6B" />
        </mesh>,
      );
    }
  }
  return (
    <group>
      {/* parede de painel perfurado */}
      <Box size={[width + 6, 9, 0.2]} position={[0, 3.5, -3.5]} color="#E9D9BC" cast={false} />
      {holes}
      {/* ferramentas penduradas */}
      <group position={[-4.6, 4.6, -3.3]} rotation={[0, 0, 0.5]}>
        <RBox size={[0.18, 1.2, 0.1]} color={C.wood} radius={0.05} />
        <RBox size={[0.7, 0.3, 0.16]} position={[0, 0.65, 0]} color="#7D858C" radius={0.05} metalness={0.4} />
      </group>
      <group position={[4.8, 4.3, -3.3]} rotation={[0, 0, -0.3]}>
        <RBox size={[0.16, 1.0, 0.1]} color="#D8463A" radius={0.06} />
        <RBox size={[0.08, 0.9, 0.06]} position={[0, -0.9, 0]} color="#A7B0B7" radius={0.03} metalness={0.5} />
      </group>
      <RBox size={[1.6, 0.12, 0.5]} position={[3.8, 2.6, -3.15]} color={C.wood} radius={0.03} />
      <RBox size={[0.35, 0.45, 0.35]} position={[3.4, 2.9, -3.1]} color="#4F86C6" radius={0.05} />
      <RBox size={[0.3, 0.3, 0.3]} position={[4.1, 2.82, -3.1]} color="#F2C230" radius={0.05} />
      {/* bancada */}
      <RBox size={[width, 0.3, 6]} position={[0, -0.15, -0.4]} color="#C68A55" radius={0.06} />
      <Box size={[width, 0.02, 6]} position={[0, 0.005, -0.4]} color="#CF955F" cast={false} />
      <Box size={[width + 6, 0.2, 14]} position={[0, -3.0, 0]} color="#8C7A66" cast={false} />
    </group>
  );
};
