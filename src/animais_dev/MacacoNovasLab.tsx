import { AbsoluteFill, useCurrentFrame } from "remotion";
import * as THREE from "three";
import { Cam, Shot } from "../engine/Shot";
import { Macaco as Mac } from "../three/animais/Macaco";
import { SerraCapivara } from "../three/animais/MacacoCenarios";
import { caminhoCobra, corpoNoCaminho, OndasGrito, passada, pontoCabeca, QUATRO, Serpente, BOCA_L, frenteCabeca } from "../three/animais/MacacoCobra";

// Laboratório das cenas novas: cada segundo é um setup (só para conferir poses/modelos em still).
type V3 = [number, number, number];
type S = { cam: { pos: V3; look: V3; fov?: number }; el: (t: number) => React.ReactNode };
const serra = (t: number) => <SerraCapivara t={t} livre={[{ x: 0, z: 0, r: 2.4 }, { x: 0.2, z: 2.2, r: 2 }]} />;
const SETUPS: S[] = [
  // 0: jararaca rastejando (close lateral)
  {
    cam: { pos: [0.9, 0.35, 3.1], look: [0.2, 0.05, 2.2], fov: 34 },
    el: (t) => {
      const c = caminhoCobra([2.4, 0, 2.0], Math.PI, 0.09, 0.75);
      return (
        <>
          {serra(t)}
          <Serpente t={t} tipo="jararaca" corpo={corpoNoCaminho(c, 2.0, 1.7, 0.036, 0.6)} />
        </>
      );
    },
  },
  // 1: close da cabeça da jararaca
  {
    cam: { pos: [0.05, 0.2, 2.65], look: [0.35, 0.1, 2.2], fov: 30 },
    el: (t) => {
      const c = caminhoCobra([2.4, 0, 2.0], Math.PI, 0.09, 0.75);
      return (
        <>
          {serra(t)}
          <Serpente t={t + 0.2} tipo="jararaca" corpo={corpoNoCaminho(c, 2.0, 1.7, 0.036, 0.7)} giroCabeca={0.5} />
        </>
      );
    },
  },
  // 2: macaco em pé andando (bípede) gritando com braços abertos
  {
    cam: { pos: [1.4, 0.7, 3.3], look: [0.2, 0.45, 2.2], fov: 34 },
    el: (t) => {
      const ps = passada(0.12, 1, "bipede");
      const P = { sentar: 0, quadril: [0, -0.03 + ps.bob, 0] as V3, cabeca: [0, 0.1] as [number, number], position: [0.2, 0, 2.2] as V3, rotation: [0, 0.6, 0] as V3 };
      return (
        <>
          {serra(t)}
          <Mac t={t} {...P} grito={1} peD={ps.peD} peE={ps.peE} maoD={{ alvo: [-0.2, 0.58, 0.16], palma: [0, 0, 1], fechar: 0.15 }} maoE={{ alvo: [0.2, 0.58, 0.16], palma: [0, 0, 1], fechar: 0.15 }} rabo={0.6} />
          <OndasGrito t={t} forca={1} position={pontoCabeca(P, BOCA_L)} dir={frenteCabeca(P)} />
        </>
      );
    },
  },
  // 3: macaco correndo em 4 apoios
  {
    cam: { pos: [1.6, 0.6, 3.0], look: [0.2, 0.3, 2.2], fov: 34 },
    el: (t) => {
      const ps = passada(0.2, 1, "quatro");
      return (
        <>
          {serra(t)}
          <Mac t={t} sentar={0} inclinar={QUATRO.inclinar} quadril={[QUATRO.quadril[0], QUATRO.quadril[1] + ps.bob, QUATRO.quadril[2]]} cabeca={[0, QUATRO.cabecaPitch]} peD={ps.peD} peE={ps.peE} maoD={{ alvo: ps.maoD!, palma: [0, -1, 0.3], fechar: 0.4 }} maoE={{ alvo: ps.maoE!, palma: [0, -1, 0.3], fechar: 0.4 }} rabo={0.5} position={[0.2, 0, 2.2]} rotation={[0, 1.2, 0]} />
        </>
      );
    },
  },
  // 4: cobra-cipó (lisa, verde) no chão
  {
    cam: { pos: [0.7, 0.4, 3.0], look: [0.2, 0.05, 2.2], fov: 32 },
    el: (t) => {
      const c = caminhoCobra([1.6, 0, 2.1], Math.PI, 0.06, 0.5);
      return (
        <>
          {serra(t)}
          <Serpente t={t} tipo="cipo" corpo={corpoNoCaminho(c, 1.5, 1.2, 0.016, 0.3)} />
        </>
      );
    },
  },
];

export const MACACO_NOVAS_LAB_DUR = SETUPS.length;
export const MacacoNovasLab: React.FC = () => {
  const f = useCurrentFrame();
  void f;
  void THREE;
  return (
    <AbsoluteFill>
      {SETUPS.map((s, i) => (
        <Shot key={i} from={i} to={i + 1}>
          {(t) => (
            <>
              <Cam from={i} keys={[{ t: i, ...s.cam }]} />
              {s.el(t)}
            </>
          )}
        </Shot>
      ))}
    </AbsoluteFill>
  );
};
