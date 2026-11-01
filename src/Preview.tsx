import { useCurrentFrame } from "remotion";
import { Stage } from "./engine/Stage";
import { CameraRig } from "./engine/Camera";
import { CrashLab, CrashCar, SteeringWheel, Inflator } from "./three/Airbag";
import { Workshop } from "./three/Workshop";
import { Tiao } from "./three/Tiao";
export const Preview = () => {
  const f = useCurrentFrame(); const t = f / 30; const s = Math.floor(f / 10);
  if (s === 2) return <Stage sky={["#F3E6CF", "#E9D7B8"]} sun={[4, 10, 8]} shadowSize={8}>
    <CameraRig keys={[{ t: 0, pos: [0.4, 2.6, 6.0], look: [0, 1.2, 0], fov: 46 }]} drift={0} />
    <Workshop />
    <Inflator t={t} spark={1} burn={1} gas={1} bag={0.6} p={1} />
  </Stage>;
  return <Stage sky={["#E9EDF0", "#DDE3E7"]} sun={[6, 12, 10]} shadowSize={10}>
    <CameraRig keys={[s === 0 ? { t: 0, pos: [-0.4, 2.2, 7.4], look: [0.1, 1.3, -0.3], fov: 42 } : { t: 0, pos: [1.6, 2.0, 3.4], look: [0.2, 1.6, -0.38], fov: 42 }]} drift={0} />
    <CrashLab />
    <CrashCar x={0} crumple={s === 0 ? 0 : 1} sensor={1} sensorFlash={1} signal={1} t={t}>
      <SteeringWheel bag={s === 0 ? 0 : 1} bagHard={0} deflate={0} vents={1} vent={1} t={t} pillow={0} hubOpen={s === 0 ? 0 : 1} pumpBag={0} />
      <Tiao position={[-0.45, 0.04, -0.38]} rotation={Math.PI / 2} sit={1} lean={s === 0 ? 0 : 0.35} headLean={s === 0 ? 0 : 0.3} belt={1} outfit="dummy" t={t} armROverride={[-1.1, 0, 0]} armLOverride={[-1.1, 0, 0]} />
    </CrashCar>
  </Stage>;
};
