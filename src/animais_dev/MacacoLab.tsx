import { AbsoluteFill } from "remotion";
import { Cam, Shot } from "../engine/Shot";
import { SkyDome } from "../three/World";
import { Macaco, Mao } from "../three/animais/Macaco";
import { Bigorna, BIGORNA_TOPO, Coquinho, Graveto, Pedra, PEDRA_R } from "../three/animais/MacacoObjetos";
import { GaviaoReal } from "../three/animais/MacacoCenarios";

// Laboratório do macaco-prego: cada segundo é uma pose/câmera (só para prévias).
type V3 = [number, number, number];
type S = { cam: { pos: V3; look: V3; fov?: number }; el: (t: number) => React.ReactNode };
const chao = (
  <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
    <planeGeometry args={[40, 40]} />
    <meshStandardMaterial color="#C98E5E" roughness={0.95} />
  </mesh>
);
const B: V3 = [0, 0, 0.42]; // bigorna à frente do macaco
const SETUPS: S[] = [
  // 0: sentado de frente, pedra na mão direita apoiada na bigorna
  {
    cam: { pos: [0.25, 0.55, 2.1], look: [0, 0.38, 0.1], fov: 34 },
    el: (t) => (
      <Macaco t={t} maoD={{ alvo: [-0.08, BIGORNA_TOPO + PEDRA_R * 1.75, 0.36], palma: [0.1, -1, 0.15], fechar: 0.55 }} cabeca={[0.1, 0.05]}>
        <Bigorna position={B} />
        <Pedra position={[-0.08, BIGORNA_TOPO + PEDRA_R * 0.85, 0.36]} />
        <Coquinho position={[0.06, BIGORNA_TOPO, 0.44]} />
      </Macaco>
    ),
  },
  // 1: close das mãos pegando a pedra com as duas mãos
  {
    cam: { pos: [0.35, 0.42, 0.95], look: [0, 0.24, 0.3], fov: 30 },
    el: (t) => {
      const c: V3 = [0, BIGORNA_TOPO + PEDRA_R * 0.85, 0.34];
      const mD: Mao = { alvo: [c[0] - PEDRA_R * 0.95, c[1] + 0.02, c[2]], palma: [1, -0.3, 0], fechar: 0.75 };
      const mE: Mao = { alvo: [c[0] + PEDRA_R * 0.95, c[1] + 0.02, c[2]], palma: [-1, -0.3, 0], fechar: 0.75 };
      return (
        <Macaco t={t} maoD={mD} maoE={mE} inclinar={0.25} cabeca={[0, 0.45]}>
          <Bigorna position={B} />
          <Pedra position={c} />
        </Macaco>
      );
    },
  },
  // 2: de pé erguendo a pedra acima da cabeça (contra-plongée)
  {
    cam: { pos: [0.5, 0.25, 1.6], look: [0, 0.75, 0], fov: 44 },
    el: (t) => {
      const c: V3 = [0, 1.02, 0.08];
      return (
        <Macaco t={t} sentar={0} maoD={{ alvo: [-PEDRA_R * 0.95, c[1], c[2]], palma: [1, 0, 0], fechar: 0.8 }} maoE={{ alvo: [PEDRA_R * 0.95, c[1], c[2]], palma: [-1, 0, 0], fechar: 0.8 }} cabeca={[0, -0.35]} rabo={0.8}>
          <Pedra position={c} />
        </Macaco>
      );
    },
  },
  // 3: levando a castanha à boca, mastigando
  {
    cam: { pos: [0.4, 0.62, 1.1], look: [0, 0.5, 0.05], fov: 32 },
    el: (t) => (
      <Macaco t={t} maoD={{ alvo: [0.0, 0.47, 0.27], palma: [0.2, 0.1, -1], fechar: 0.9 }} boca={0.4 + 0.3 * Math.sin(t * 18)} cabeca={[0.15, 0.1]}>
        <Coquinho quebrar={1} position={[0.05, 0, 0.35]} />
      </Macaco>
    ),
  },
  // 4: grito de alarme olhando para o céu
  {
    cam: { pos: [0.2, 0.62, 0.95], look: [0, 0.55, 0], fov: 34 },
    el: (t) => <Macaco t={t} grito={1} cabeca={[0, -0.45]} maoD={{ alvo: [-0.12, 0.25, 0.2], palma: [0, -1, 0], fechar: 0.4 }} />,
  },
  // 5: graveto no canto da boca, convencido (perfil 3/4)
  {
    cam: { pos: [0.85, 0.6, 0.95], look: [0, 0.5, 0.05], fov: 32 },
    el: (t) => (
      <Macaco t={t} convencido={1} cabeca={[0.35, 0.05]} maoD={{ alvo: [-0.06, 0.44, 0.2], palma: [0.6, 0, -0.4], fechar: 0.85 }}>
        <Graveto folhas={0} position={[-0.06, 0.44, 0.2]} rotation={[0.2, 0, -1.9]} scale={0.8} />
      </Macaco>
    ),
  },
  // 6: gavião-real pousado, crista em pé
  {
    cam: { pos: [1.6, 1.5, 3.2], look: [0, 1.25, 0], fov: 40 },
    el: (t) => <GaviaoReal t={t} crista={1} cabeca={[0.4, 0.2]} rotation={[0, 0.5, 0]} />,
  },
  // 7: gavião-real voando
  {
    cam: { pos: [0.5, 0.2, 4.5], look: [0, 1.6, 0], fov: 44 },
    el: (t) => <GaviaoReal t={t} voar={1} crista={0.5} position={[0, 1.6, 0]} rotation={[0.2, 0.6, 0.25]} />,
  },
];
export const MacacoLab: React.FC = () => (
  <AbsoluteFill>
    {SETUPS.map((s, i) => (
      <Shot key={i} from={i} to={i + 1} shadowSize={3} sun={[3, 7, 4]} sunPower={2.6}>
        {(t) => (
          <>
            <Cam from={i} keys={[{ t: i, ...s.cam }]} />
            <SkyDome top="#3E8FD6" horizon="#CFE6F2" bottom="#CFE6F2" />
            {chao}
            {s.el(t)}
          </>
        )}
      </Shot>
    ))}
  </AbsoluteFill>
);
export const MACACO_LAB_DUR = SETUPS.length;
