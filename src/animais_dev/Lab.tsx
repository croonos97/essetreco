import { AbsoluteFill } from "remotion";
import { Cam, Shot } from "../engine/Shot";
import { Ornitorrinco } from "../three/animais/Ornitorrinco";
import { Riacho, riachoAltura, rioZ } from "../three/animais/Riacho";

// Laboratório do personagem: cada segundo é uma pose/câmera diferente (só para prévias).
const RZ = rioZ(0);
const BX = 0.5, BZ = RZ - 6.2; // ponto na margem
const BY = riachoAltura(BX, BZ);
type S = { cam: { pos: [number, number, number]; look: [number, number, number]; fov?: number }; props: Record<string, unknown>; at: [number, number, number]; rot?: number };
const SETUPS: S[] = [
  { cam: { pos: [-3.5, 1.6, RZ - 4.5], look: [0, 0, RZ], fov: 45 }, props: { nadar: 1 }, at: [0, -0.16, RZ], rot: 1.2 },
  { cam: { pos: [BX + 0.75, BY + 0.42, BZ + 1.05], look: [BX, BY + 0.22, BZ + 0.2], fov: 36 }, props: { macho: true }, at: [BX, BY, BZ], rot: 0.3 },
  { cam: { pos: [BX + 0.32, BY + 0.38, BZ + 0.92], look: [BX, BY + 0.2, BZ + 0.45], fov: 30 }, props: { sensores: 0.7, fecharOlhos: 1, fecharOuvidos: 1, fecharNarinas: 1 }, at: [BX, BY, BZ], rot: 0 },
  { cam: { pos: [BX + 1.0, BY + 0.6, BZ + 0.9], look: [BX, BY + 0.15, BZ], fov: 38 }, props: { enrolar: 1, ovos: 2 }, at: [BX, BY, BZ], rot: 0.6 },
];
export const Lab: React.FC = () => (
  <AbsoluteFill>
    {SETUPS.map((s, i) => (
      <Shot key={i} from={i} to={i + 1} shadowSize={4} sun={[s.at[0] + 4, 9, s.at[2] + 3]} sunPower={2.6}>
        {(t) => (
          <>
            <Cam from={i} keys={[{ t: i, ...s.cam }]} />
            <Riacho t={t} livre={[{ x: BX, z: BZ, r: 1.2 }, { x: s.cam.pos[0], z: s.cam.pos[2], r: 1.0 }]} />
            <Ornitorrinco t={t} position={s.at} rotation={[0, s.rot ?? 0, 0]} {...s.props} />
          </>
        )}
      </Shot>
    ))}
  </AbsoluteFill>
);
