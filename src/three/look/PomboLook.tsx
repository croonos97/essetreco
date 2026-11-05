import { createContext, useContext } from "react";
import * as THREE from "three";
import { AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig } from "remotion";
import { matrizRaiz, pontaBicoLocal, pontoCabeca } from "../pombo/Ave";
import { NINHO, NINHO_FUNDO } from "../pombo/Beiral";
import { Falcao, poseFalcao } from "../pombo/Falcao";
import { especieFilhote, Filhote } from "../pombo/Filhote";
import { LKey, LuzDia, PalcoDia, PomboCam, seg01, V3 } from "../pombo/PomboComum";
import { Pombo, POSE_PARADO } from "../pombo/Pombo";
import { cenaAlimentar } from "../pombo/PomboLab";
import { ANTENA_MQ_POUSO, NINHO_Q, Quarteirao } from "../pombo/Quarteirao";
import { LookAve, LookConcreto } from "./LookMateriais";
import { LookPalco } from "./LookPalco";
import { LookPlano, PLANOS, TipoPlano } from "./presets";

// =====================================================================
// POMBO — TESTE DE LOOK (ANTES × DEPOIS, mesma câmera, mesma cena, mesmos modelos do kit).
//   ANTES  = PalcoDia + LuzDia do kit (ACES + direcional + hemisfério, sem pós)
//   DEPOIS = LookPalco (IBL + key/fill/rim/bounce + AO + DOF + bloom + grading + tone map) + LookAve + LookConcreto
// Cada plano dura PLANO_S segundos com um dolly lento (para testar flicker de AO/DOF/sombra em movimento).
// =====================================================================
export const PLANO_S = 2;
const OFF: V3 = [NINHO_Q[0] - NINHO[0], NINHO_Q[1] - NINHO[1], NINHO_Q[2] - NINHO[2]]; // cena de alimentação do kit → ninho do quarteirão
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const MACHO_Q: V3 = [-22, NINHO_Q[1], 30]; // pombo em cima do ar de janela, ao lado do ninho
const OLHA_NINHO: V3 = [0, -Math.PI / 2, 0];

type Plano = { nome: string; tipo: TipoPlano; cam: LKey[]; near: number; foco: V3; raio: number; alvo: V3; el: (t: number, tl: number) => React.ReactNode };

const Alimentando: React.FC<{ t: number }> = ({ t }) => {
  const c = cenaAlimentar(t, 1);
  const NX = NINHO[0], NZ = NINHO[2];
  const fpos: V3 = [NX + 2, NINHO_FUNDO, NZ + 1];
  const frot: V3 = [0, -Math.PI / 2 - 0.25, 0];
  return (
    <group position={OFF}>
      <Pombo t={t} pose={c.pp} position={c.posP} rotation={c.rotP} />
      <Filhote idade={6} t={t} pose={c.pf} position={fpos} rotation={frot} />
    </group>
  );
};
const ponta0 = (() => {
  const p = cenaAlimentar(0).ponta;
  return add(p.toArray() as V3, OFF);
})();
void especieFilhote;
void pontoCabeca;
void pontaBicoLocal;
void matrizRaiz;

export const PLANOS_POMBO: Plano[] = [
  {
    nome: "1 close: pai alimentando",
    tipo: "close",
    near: 0.1,
    cam: [
      { t: 0, pos: add(ponta0, [16, 7, 27]), look: add(ponta0, [0, 1, 0]), fov: 30, lin: true },
      { t: PLANO_S, pos: add(ponta0, [12, 6.5, 28]), look: add(ponta0, [0, 1, 0]), fov: 30 },
    ],
    foco: ponta0,
    raio: 30,
    alvo: ponta0,
    el: (t) => (
      <>
        <LookConcretoOuNao><Quarteirao detalhe={false} /></LookConcretoOuNao>
        <LookAveOuNao><Alimentando t={t} /></LookAveOuNao>
      </>
    ),
  },
  {
    nome: "2 papo (raio-x, leite)",
    tipo: "close",
    near: 0.2,
    cam: [
      { t: 0, pos: add(MACHO_Q, [-8, 16, 31]), look: add(MACHO_Q, [-6.5, 13.5, 0]), fov: 30, lin: true },
      { t: PLANO_S, pos: add(MACHO_Q, [-10, 16, 29]), look: add(MACHO_Q, [-6.5, 13.5, 0]), fov: 30 },
    ],
    foco: add(MACHO_Q, [-6, 10, 0]),
    raio: 35,
    alvo: add(MACHO_Q, [-6.5, 13.5, 0]),
    el: (t, tl) => (
      <>
        <LookConcretoOuNao><Quarteirao detalhe={false} /></LookConcretoOuNao>
        <LookAveOuNao>
          <Pombo t={t} pose={POSE_PARADO} position={MACHO_Q} rotation={OLHA_NINHO} raioX={{ corte: new THREE.Vector4(0, 0, 0, 1), papo: { parede: 1, soltar: 0.8, leite: 0.45 + 0.1 * seg01(tl, 0, PLANO_S) } }} />
        </LookAveOuNao>
      </>
    ),
  },
  {
    nome: "3 aberto: marquise, cidade ao fundo",
    tipo: "aberto",
    near: 0.5,
    cam: [
      { t: 0, pos: [-72, 283, 4], look: [314, 262, 205], fov: 50, lin: true },
      { t: PLANO_S, pos: [-69, 283, 6], look: [314, 262, 215], fov: 50 },
    ],
    foco: [-20, 270, 60],
    raio: 160,
    alvo: add(MACHO_Q, [0, 12, 0]),
    el: (t) => (
      <>
        <LookConcretoOuNao><Quarteirao /></LookConcretoOuNao>
        <LookAveOuNao>
          <Pombo t={t} pose={POSE_PARADO} position={MACHO_Q} rotation={[0, -2.3, 0]} />
          <Filhote idade={20} t={t} position={[NINHO_Q[0], NINHO_Q[1] + 1.6, NINHO_Q[2]]} rotation={[0, 0.6, 0]} />
        </LookAveOuNao>
      </>
    ),
  },
  {
    nome: "4 falcão na antena da marquise",
    tipo: "medio",
    near: 0.5,
    cam: [
      { t: 0, pos: add(ANTENA_MQ_POUSO, [62, 2, -80]), look: add(ANTENA_MQ_POUSO, [0, 16, 0]), fov: 32, lin: true },
      { t: PLANO_S, pos: add(ANTENA_MQ_POUSO, [56, 3, -82]), look: add(ANTENA_MQ_POUSO, [0, 16, 0]), fov: 32 },
    ],
    foco: add(ANTENA_MQ_POUSO, [0, 0, 0]),
    raio: 90,
    alvo: add(ANTENA_MQ_POUSO, [0, 18, 0]),
    el: (t) => (
      <>
        <LookConcretoOuNao><Quarteirao /></LookConcretoOuNao>
        <LookAveOuNao>
          <Falcao t={t} pose={poseFalcao(0.2, 4)} position={ANTENA_MQ_POUSO} rotation={[0, -Math.PI / 2 - 0.5, 0]} />
        </LookAveOuNao>
      </>
    ),
  },
];

// no modo ANTES os wrappers de material não atuam (mesmos modelos crus do kit)
const Modo = createContext<"antes" | "depois">("depois");
const Real = createContext(true);
const LookAveOuNao: React.FC<{ children: React.ReactNode }> = ({ children }) => (useContext(Modo) === "depois" ? <LookAve>{children}</LookAve> : <>{children}</>);
const LookConcretoOuNao: React.FC<{ children: React.ReactNode }> = ({ children }) => (useContext(Modo) === "depois" ? <LookConcreto real={useContext(Real)}>{children}</LookConcreto> : <>{children}</>);

const Setup: React.FC<{ p: Plano; i: number; modo: "antes" | "depois"; rotulo: boolean; economico?: boolean; proc?: boolean }> = ({ p, i, modo, rotulo, economico, proc }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const tl = f / fps;
  const t = i * PLANO_S + tl;
  const conteudo = (
    <Modo.Provider value={modo}><Real.Provider value={!proc}>
      <PomboCam t={tl} keys={p.cam} near={p.near} far={12000} />
      {p.el(t, tl)}
    </Real.Provider></Modo.Provider>
  );
  return (
    <AbsoluteFill>
      {modo === "antes" ? (
        <PalcoDia>
          <LuzDia foco={p.foco} raio={p.raio} />
          {conteudo}
        </PalcoDia>
      ) : (
        <LookPalco cena={proc ? "marquise_proc" : "marquise_dia"} plano={p.tipo} foco={p.foco} raio={p.raio} alvo={p.alvo} msaa={economico ? 0 : 4} ajuste={economico ? ECON[p.tipo] : undefined}>
          {conteudo}
        </LookPalco>
      )}
      {rotulo ? (
        <div style={{ position: "absolute", left: 30, top: 30, color: "#fff", font: "bold 40px sans-serif", textShadow: "0 0 6px #000" }}>
          {modo === "antes" ? "KIT" : proc ? "LOOK v1 (procedural)" : "LOOK v2 (HDRI + texturas)"} · {p.nome}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

// modo econômico: AO em meia resolução + sem MSAA (para medir custo)
const ECON: Record<TipoPlano, Partial<LookPlano>> = Object.fromEntries(
  (Object.keys(PLANOS) as TipoPlano[]).map((k) => [k, { ao: PLANOS[k].ao ? { ...(PLANOS[k].ao as Exclude<LookPlano["ao"], false>), halfRes: true } : false }]),
) as Record<TipoPlano, Partial<LookPlano>>;
export const POMBO_LOOK_DUR = PLANOS_POMBO.length * PLANO_S;
export const PomboLook: React.FC<{ modo?: "antes" | "depois"; rotulo?: boolean; so?: number; economico?: boolean; proc?: boolean }> = ({ modo = "depois", rotulo = true, so, economico, proc }) => {
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill>
      {PLANOS_POMBO.map((p, i) =>
        so !== undefined && so !== i ? null : (
          <Sequence key={i} from={Math.round(i * PLANO_S * fps)} durationInFrames={Math.round(PLANO_S * fps)} layout="none">
            <Setup p={p} i={i} modo={modo} rotulo={rotulo} economico={economico} proc={proc} />
          </Sequence>
        ),
      )}
    </AbsoluteFill>
  );
};
