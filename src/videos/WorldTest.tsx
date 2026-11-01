import { AbsoluteFill } from "remotion";
import { Cam, Shot } from "../engine/Shot";
import { World } from "../three/World";
import { Casinha } from "../three/Bunker";

const FLAT = { x0: -14, x1: 14, z0: -16, z1: 12, margin: 18 };
export const WorldTest = () => (
  <AbsoluteFill>
    <Shot from={0} to={4} shadowSize={20} sun={[30, 40, 20]}>
      {(t) => (
        <>
          <Cam from={0} keys={[{ t: 0, pos: [10, 7, 22], look: [0, 1.5, -4], fov: 50 }, { t: 4, pos: [4, 4, 14], look: [0, 1.5, -4], fov: 50 }]} />
          <World t={t} flat={FLAT} grass={{ x0: -26, x1: 26, z0: -26, z1: 24 }} grassAvoid={[{ x0: -3.5, x1: 1.5, z0: -11, z1: -6 }]} town={{ center: [-40, -150], n: 50, spread: 70 }} />
          <Casinha position={[-1.2, 0, -8.5]} rotation={0.18} />
        </>
      )}
    </Shot>
  </AbsoluteFill>
);
