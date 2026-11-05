import { AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig } from "remotion";
import { Lagartixa, LagartixaProps, pontoColuna, RaboSolto, S_FIM, sAnel } from "./Lagartixa";
import { Gato, GatoProps } from "./LagartixaGato";
import { CM, LagCam, LKey, localParaMundo, mundoParaLocal, noPlano, PalcoNoite, seg01, sm, V3 } from "./LagartixaComum";
import { Mariposa, VAR, Varanda } from "./LagartixaVaranda";
import { LupaDedo } from "./LagartixaLupa";

// LABORATÓRIO DO KIT LAGARTIXA — cada setup tem a sua duração; LAB_INI[i] = segundo em que começa.
type S = { nome: string; dur?: number; cam: LKey[]; el: (t: number, tl: number) => React.ReactNode; overlay?: (tl: number) => React.ReactNode };
export const PAREDE = noPlano([0, 0, 1], [0, 1, 0]); // na parede, cabeça para cima
export const TETO = noPlano([0, -1, 0], [1, 0, 0]); // no forro, de cabeça para baixo
export const LZ: V3 = [0.25, 1.62, 0.0]; // posição padrão na parede (cloaca)
const cmW = (p: V3, x: number, y: number, z: number): V3 => [p[0] + x * CM, p[1] + y * CM, p[2] + z * CM];

// ----- quadro 0: lagartixa na parede + gato no banco com a pata na ponta do rabo -----
export const LZ_Q0: V3 = [0.3, 1.74, 0];
export const ROT_Q0 = noPlano([0, 0, 1], [0.45, 0.9, 0]);
export const GATO_Q0 = { position: [-0.2, VAR.banco.y, 0.3] as V3, rotation: [0, Math.PI / 2, 0] as V3 };
export const quadro0 = (t: number, extra: { lag?: Partial<LagartixaProps>; gato?: Partial<GatoProps> } = {}) => {
  const LP: LagartixaProps = { t, position: LZ_Q0, rotation: ROT_Q0, curva: 0.3, raboCurva: -0.7, cabeca: [-0.25, 0.1], rabo: 0.1, ...extra.lag };
  const ponta = localParaMundo(pontoColuna(LP, 9.6), LP.position, LP.rotation);
  const alvo = mundoParaLocal([ponta[0], ponta[1], 0.004], GATO_Q0.position, GATO_Q0.rotation);
  return (
    <>
      <Lagartixa {...LP} />
      <Gato t={t} {...GATO_Q0} cabeca={[0.55, -0.3, 0.1]} orelhas={1} pupila={0.8} pataE={{ alvo, apertar: 0.6, unhas: 0.6, normal: [1, 0, 0] }} {...extra.gato} />
    </>
  );
};

const LAB: S[] = [
  { nome: "quadro0-aberto", cam: [{ t: 0, pos: [1.0, 1.7, 2.3], look: [0.05, 1.45, 0], fov: 42 }], el: (t) => (<><Varanda t={t} />{quadro0(t)}</>) },
  { nome: "quadro0-reenquadrado", cam: [{ t: 0, pos: [0.66, 1.74, 0.74], look: [0.24, 1.66, 0.02], fov: 38 }], el: (t) => (<><Varanda t={t} />{quadro0(t)}</>) },
  { nome: "cabeca-lagartixa", cam: [{ t: 0, pos: cmW(LZ, 4.5, 7.2, 5.5), look: cmW(LZ, 0, 5, 0.6), fov: 30 }], el: (t) => (<><Varanda t={t} /><Lagartixa t={t} position={LZ} rotation={PAREDE} cabeca={[0.45, 0.1]} /></>) },
  { nome: "andar-parede", dur: 2, cam: [{ t: 0, pos: [0.25, 1.7, 0.55], look: [0.25, 1.7, 0], fov: 34 }, { t: 2, pos: [0.25, 1.7 + 8 * CM, 0.55], look: [0.25, 1.7 + 8 * CM, 0], fov: 34 }], el: (t, tl) => (<><Varanda t={t} /><Lagartixa t={t} position={[0.25, 1.62 + tl * 4 * CM, 0]} rotation={PAREDE} andar={1} dist={tl * 4} /></>) },
  { nome: "teto-de-baixo", cam: [{ t: 0, pos: [0.4, VAR.teto - 0.45, 0.62], look: [0.4, VAR.teto, 0.42], fov: 36 }], el: (t, tl) => (<><Varanda t={t} /><Lagartixa t={t} position={[0.3 + tl * 4 * CM, VAR.teto - 0.001, 0.42]} rotation={TETO} andar={1} dist={tl * 4} /></>) },
  { nome: "correr", dur: 2, cam: [{ t: 0, pos: [0.25, 1.62, 0.7], look: [0.25, 1.62, 0], fov: 36 }, { t: 2, pos: [0.25, 1.62 + 24 * CM, 0.7], look: [0.25, 1.62 + 24 * CM, 0], fov: 36 }], el: (t, tl) => (<><Varanda t={t} /><Lagartixa t={t} position={[0.25, 1.55 + tl * 12 * CM, 0]} rotation={PAREDE} andar={1} correr={1} dist={tl * 12} rabo={0} /></>) },
  { nome: "parada-cabeca-virando", dur: 2, cam: [{ t: 0, pos: cmW(LZ, -9, 4, 14), look: cmW(LZ, 0, 3, 0), fov: 32 }], el: (t, tl) => (<><Varanda t={t} /><Lagartixa t={t} position={LZ} rotation={PAREDE} cabeca={[0.6 * Math.sin(tl * Math.PI), 0.1]} lingua={seg01(tl, 1.2, 1.4) * (1 - seg01(tl, 1.6, 1.8))} /></>) },
  {
    nome: "comer-mariposa",
    cam: [{ t: 0, pos: cmW(LZ, 6, 6, 9), look: cmW(LZ, 0, 5, 0.5), fov: 30 }],
    el: (t) => (
      <>
        <Varanda t={t} />
        <Lagartixa t={t} position={LZ} rotation={PAREDE} boca={0.45} cabeca={[0.15, 0.2]} naBoca={<group scale={1 / CM} rotation={[0.3, 0, 1.2]}><Mariposa t={t} bater={0.2} escala={0.7} /></group>} />
      </>
    ),
  },
  { nome: "soltar-anel3", cam: [{ t: 0, pos: cmW(LZ, -4, -3, 8), look: cmW(LZ, 0, -2, 0), fov: 30 }], el: (t) => (<><Varanda t={t} /><Lagartixa t={t} position={LZ} rotation={PAREDE} soltar={{ anel: 3, afastar: 1.0, tSolta: t - 0.2 }} /></>) },
  {
    nome: "rabo-solto-cambalhota",
    dur: 3,
    cam: [{ t: 0, pos: [-0.3, 1.22, 0.78], look: [-0.27, 0.97, 0.4], fov: 34 }],
    el: (t, tl) => (
      <>
        <Varanda t={t} />
        <RaboSolto t={t} anel={3} tSolta={t - tl - 0.1} position={[-0.25, VAR.banco.y, 0.4]} rotation={[0, 1.2, 0]} salto={{ t0: t - tl + 0.9, dur: 1.8, altura: 3 }} />
      </>
    ),
  },
  { nome: "raio-x-varrendo", cam: [{ t: 0, pos: cmW(LZ, 0, -2.5, 10), look: cmW(LZ, 0, -2.6, 0), fov: 30 }], el: (t) => (<><Varanda t={t} /><Lagartixa t={t} position={LZ} rotation={PAREDE} raioX={{ ate: 0.65, tracejados: 3 }} /></>) },
  { nome: "raio-x-musculo-quebra", cam: [{ t: 0, pos: cmW(LZ, 0, -2.0, 5), look: cmW(LZ, 0, -2.1, 0), fov: 30 }], el: (t) => (<><Varanda t={t} /><Lagartixa t={t} position={LZ} rotation={PAREDE} rabo={0} raioX={{ ate: 1, tracejados: 9, musculo: 1, quebraAnel: 5, quebra: 1 }} /></>) },
  { nome: "regen-cinza", cam: [{ t: 0, pos: cmW(LZ, 0, -1.5, 13), look: cmW(LZ, 0, -1.5, 0), fov: 30 }], el: (t) => (<><Varanda t={t} /><Lagartixa t={t} position={LZ} rotation={PAREDE} regen={{ anel: 4 }} /></>) },
  { nome: "regen-fita", cam: [{ t: 0, pos: cmW(LZ, 0, -1.5, 13), look: cmW(LZ, 0, -1.5, 0), fov: 30 }], el: (t) => (<><Varanda t={t} /><Lagartixa t={t} position={LZ} rotation={PAREDE} regen={{ anel: 4, fita: 1 }} /></>) },
  { nome: "regen-raio-x", cam: [{ t: 0, pos: cmW(LZ, 0, -1.5, 13), look: cmW(LZ, 0, -1.5, 0), fov: 30 }], el: (t) => (<><Varanda t={t} /><Lagartixa t={t} position={LZ} rotation={PAREDE} regen={{ anel: 4 }} raioX={{ ate: 1, tracejados: 0, falha: 1 }} /></>) },
  { nome: "regen-crescendo", cam: [{ t: 0, pos: cmW(LZ, 0, -1.5, 13), look: cmW(LZ, 0, -1.5, 0), fov: 30 }], el: (t) => (<><Varanda t={t} /><Lagartixa t={t} position={LZ} rotation={PAREDE} regen={{ anel: 4, comp: 1.2 }} /></>) },
  {
    nome: "filhote-e-adulta",
    cam: [{ t: 0, pos: cmW(LZ, 2, 2, 22), look: cmW(LZ, 2, 1, 0), fov: 34 }],
    el: (t) => (
      <>
        <Varanda t={t} />
        <Lagartixa t={t} position={LZ} rotation={noPlano([0, 0, 1], [0.6, 0.8, 0])} cabeca={[-0.3, 0]} />
        <Lagartixa t={t} filhote position={cmW(LZ, 3.5, -4.5, 0)} rotation={PAREDE} cabeca={[0.2, 0]} />
      </>
    ),
  },
  { nome: "gato-inteiro", cam: [{ t: 0, pos: [1.6, 1.4, 1.9], look: [-0.4, 1.15, 0.4], fov: 40 }], el: (t) => (<><Varanda t={t} /><Gato t={t} position={[-0.5, VAR.banco.y, 0.42]} rotation={[0, -1.5, 0]} cabeca={[0.3, 0.1]} rabo={0.6} /></>) },
  {
    nome: "gato-close-mastigando",
    dur: 2,
    cam: [{ t: 0, pos: [-1.5, 1.62, 1.3], look: [-0.97, 1.45, 0.55], fov: 30 }],
    el: (t) => (
      <>
        <Varanda t={t} />
        <pointLight position={[-1.4, 1.9, 1.4]} intensity={0.5} distance={0} decay={2} color="#FFE2C0" />
        <Gato t={t} position={[-0.5, VAR.banco.y, 0.42]} rotation={[0, -1.25, 0]} cabeca={[0.55, 0.1, 0]} mastigar={1} naBoca={<group rotation={[0, 1.5, 0.2]}><RaboSolto t={t} anel={3} tSolta={t - 2} escala={50} position={[0, 0, 0]} apoiado={false} /></group>} />
      </>
    ),
  },
  { nome: "gato-agachado-rebolando", dur: 1, cam: [{ t: 0, pos: [1.0, 1.3, 1.6], look: [-0.4, 1.1, 0.4], fov: 40 }], el: (t) => (<><Varanda t={t} /><Gato t={t} position={[-0.9, VAR.banco.y, 0.42]} rotation={[0, 1.57, 0]} agachar={1} rebolar={1} pupila={1} orelhas={0.5} /></>) },
  { nome: "gato-bote", dur: 2, cam: [{ t: 0, pos: [0.0, 1.4, 2.0], look: [-0.4, 1.15, 0.4], fov: 42 }], el: (t, tl) => (<><Varanda t={t} /><Gato t={t} position={[-1.3, VAR.banco.y, 0.42]} rotation={[0, 1.57, 0]} agachar={1 - sm(tl - 0.3)} bote={seg01(tl, 0.4, 1.2)} boca={seg01(tl, 0.6, 1.0) * 0.8} pupila={1} /></>) },
  { nome: "quadro-aquarela", cam: [{ t: 0, pos: [VAR.quadro.c[0], VAR.quadro.c[1], 1.0], look: [VAR.quadro.c[0], VAR.quadro.c[1], 0], fov: 40 }], el: (t) => <Varanda t={t} /> },
  { nome: "cenario-geral", cam: [{ t: 0, pos: [0.3, 2.6, 3.9], look: [0.2, 2.4, 0], fov: 62 }], el: (t) => (<><Varanda t={t} />{quadro0(t)}</>) },
  { nome: "forro-quina-fresta", cam: [{ t: 0, pos: [-0.3, 4.6, 0.8], look: [-0.5, 5.0, 0], fov: 40 }], el: (t) => <Varanda t={t} /> },
  { nome: "lupa-lamelas", cam: [{ t: 0, pos: [0.4, VAR.teto - 0.45, 0.62], look: [0.4, VAR.teto, 0.42], fov: 36 }], el: (t: number) => (<><Varanda t={t} /><Lagartixa t={t} position={[0.36, VAR.teto - 0.001, 0.42]} rotation={TETO} cabeca={[0.2, 0]} /></>), overlay: (tl) => <LupaDedo t={tl} nivel={0} cx={560} cy={1350} raio={330} ancora={[640, 820]} /> },
  { nome: "lupa-pelinhos", cam: [{ t: 0, pos: [0.4, VAR.teto - 0.45, 0.62], look: [0.4, VAR.teto, 0.42], fov: 36 }], el: (t: number) => (<><Varanda t={t} /><Lagartixa t={t} position={[0.36, VAR.teto - 0.001, 0.42]} rotation={TETO} cabeca={[0.2, 0]} /></>), overlay: (tl) => <LupaDedo t={tl} nivel={1} cx={560} cy={1350} raio={330} ancora={[640, 820]} /> },
  { nome: "lupa-pontinhas-cola", cam: [{ t: 0, pos: [0.4, VAR.teto - 0.45, 0.62], look: [0.4, VAR.teto, 0.42], fov: 36 }], el: (t: number) => (<><Varanda t={t} /><Lagartixa t={t} position={[0.36, VAR.teto - 0.001, 0.42]} rotation={TETO} cabeca={[0.2, 0]} /></>), overlay: (tl) => <LupaDedo t={tl} nivel={2} cx={560} cy={1350} raio={330} ancora={[640, 820]} cola={1} /> },
  { nome: "lupa-zoom-animado", dur: 4, cam: [{ t: 0, pos: [0.4, VAR.teto - 0.45, 0.62], look: [0.4, VAR.teto, 0.42], fov: 36 }], el: (t: number) => (<><Varanda t={t} /><Lagartixa t={t} position={[0.36, VAR.teto - 0.001, 0.42]} rotation={TETO} cabeca={[0.2, 0]} /></>), overlay: (tl) => <LupaDedo t={tl} abrir={seg01(tl, 0, 0.5)} nivel={2 * seg01(tl, 0.6, 3.0)} cola={seg01(tl, 3.0, 3.8)} cx={560} cy={1350} raio={330} ancora={[640, 820]} /> },
  {
    nome: "soltura-animada",
    dur: 3,
    cam: [{ t: 0, pos: cmW(LZ, 0, 1, 26), look: cmW(LZ, 0, 1, 0), fov: 34 }, { t: 1.0, pos: cmW(LZ, 0, 1, 26), look: cmW(LZ, 0, 1, 0), fov: 34 }, { t: 3, pos: cmW(LZ, 0, 9, 30), look: cmW(LZ, 0, 9, 0), fov: 34 }],
    el: (t, tl) => {
      const LP: LagartixaProps = { t, position: LZ, rotation: PAREDE, rabo: 0 };
      const corte = localParaMundo(pontoColuna(LP, sAnel(3)), LZ, PAREDE);
      const solto = tl >= 0.8;
      const sobe = seg01(tl, 0.8, 1.0) * 1.0 + Math.max(0, tl - 1.0) * 6;
      return (
        <>
          <Varanda t={t} />
          <Lagartixa {...LP} position={[LZ[0], LZ[1] + sobe * CM, LZ[2]]} andar={solto ? 1 : 0} correr={solto ? 1 : 0} dist={Math.max(0, tl - 1.0) * 6} soltar={solto ? { anel: 3, pedaco: false } : undefined} />
          {solto ? <RaboSolto t={t} anel={3} tSolta={t - tl + 0.8} position={corte} rotation={PAREDE} /> : null}
        </>
      );
    },
  },
  {
    nome: "raio-x-animado",
    dur: 5,
    cam: [{ t: 0, pos: cmW(LZ, 0, -2.6, 11), look: cmW(LZ, 0, -2.6, 0), fov: 30 }],
    el: (t, tl) => (
      <>
        <Varanda t={t} />
        <Lagartixa t={t} position={LZ} rotation={PAREDE} rabo={0} raioX={{ ate: seg01(tl, 0, 1.2), tracejados: 9 * seg01(tl, 1.3, 2.8), musculo: seg01(tl, 3.0, 3.5), quebraAnel: 5, quebra: seg01(tl, 3.6, 4.0) }} soltar={tl > 4.2 ? { anel: 5, afastar: seg01(tl, 4.2, 4.6) * 0.8, tSolta: t - tl + 4.2 } : undefined} />
      </>
    ),
  },
  {
    nome: "regen-animado",
    dur: 3,
    cam: [{ t: 0, pos: cmW(LZ, 0, -1.5, 13), look: cmW(LZ, 0, -1.5, 0), fov: 30 }],
    el: (t, tl) => (<><Varanda t={t} /><Lagartixa t={t} position={LZ} rotation={PAREDE} regen={{ anel: 4, comp: 0.1 + seg01(tl, 0, 2) * (S_FIM - sAnel(4) - 0.1), fita: seg01(tl, 2.1, 2.9) }} /></>),
  },
  {
    nome: "gato-pata-prendendo",
    dur: 2,
    cam: [{ t: 0, pos: [0.66, 1.74, 0.74], look: [0.24, 1.66, 0.02], fov: 38 }],
    el: (t, tl) => {
      const LP: LagartixaProps = { t, position: LZ_Q0, rotation: ROT_Q0, curva: 0.3, raboCurva: -0.7, cabeca: [-0.25, 0.1], rabo: 0.1 };
      const ponta = localParaMundo(pontoColuna(LP, 9.6), LZ_Q0, ROT_Q0);
      const k = seg01(tl, 0.3, 0.8);
      const alvo = mundoParaLocal([ponta[0], ponta[1] + (1 - k) * 0.05, (1 - k) * 0.12], GATO_Q0.position, GATO_Q0.rotation);
      return (
        <>
          <Varanda t={t} />
          <Lagartixa {...LP} />
          <Gato t={t} {...GATO_Q0} cabeca={[0.55, -0.3, 0.1]} orelhas={1} pupila={0.8} pataE={{ alvo, apertar: k * 0.6, unhas: k * 0.6, normal: [1, 0, 0] }} />
        </>
      );
    },
  },
];
export const SETUPS = LAB;
export const LAB_INI = LAB.reduce<number[]>((a, s) => (a.push(a[a.length - 1] + (s.dur ?? 1)), a), [0]);
export const LAB_DUR = LAB_INI[LAB_INI.length - 1];
export const LAG_LAB_DUR = 1;

export const LagartixaLab: React.FC = () => {
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill>
      {LAB.map((s, i) => (
        <Sequence key={i} from={Math.round(LAB_INI[i] * fps)} durationInFrames={Math.round((s.dur ?? 1) * fps)} layout="none">
          <Setup s={s} t0={LAB_INI[i]} i={i} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
const Setup: React.FC<{ s: S; t0: number; i: number }> = ({ s, t0, i }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const tl = f / fps;
  const t = t0 + tl;
  const keys = s.cam.map((k) => ({ ...k, t: k.t + t0 }));
  return (
    <AbsoluteFill>
      <PalcoNoite>
        <LagCam t={t} keys={keys} />
        {s.el(t, tl)}
      </PalcoNoite>
      {s.overlay ? s.overlay(tl) : null}
      <div style={{ position: "absolute", left: 30, top: 30, color: "#fff", font: "bold 40px sans-serif", textShadow: "0 0 6px #000" }}>
        {i} · {s.nome} · t={t0.toFixed(0)}s
      </div>
    </AbsoluteFill>
  );
};
void sAnel;
