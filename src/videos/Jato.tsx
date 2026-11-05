import { AbsoluteFill, Audio, staticFile } from "remotion";
import { Key } from "../engine/Camera";
import { BigText, Captions, CTA, Finish, Flash, Mark, TopLabel } from "../engine/Overlays";
import { Cam, Shot } from "../engine/Shot";
import { cena, pop, prog, spin, Timeline, TimelineCtx, wordAt } from "../engine/timeline";
import { Airliner, FanCart, JetEngine, JetState, Runway } from "../three/Jato";
import { FlowParticles } from "../three/basics";
import { Tiao } from "../three/Tiao";
import { Workshop } from "../three/Workshop";
import timelineJson from "../../public/jato/timeline.json";

const TL = timelineJson as Timeline;
const S = (id: string) => cena(TL, id).start;
const E = (id: string) => cena(TL, id).end;
const W = (id: string, w: string, nth = 0) => wordAt(TL, id, w, nth);
const WORK: [string, string] = ["#F3E6CF", "#E9D7B8"];
type V3 = [number, number, number];
const ENG: V3 = [0, 1.75, 0];
const PLANE: V3 = [4, 6.85, -6];

// ---------- linha do tempo da montagem (uma só, usada por todos os planos da bancada) ----------
const T = {
  stands: W("compressor", "Então"),
  core: W("compressor", "aperta"),
  stages: W("compressor", "fileiras"),
  entra: W("compressor", "entra"),
  chamber: W("camara", "joga"),
  fuel: W("camara", "combustível"),
  acende: W("camara", "acende"),
  nozzle: W("bocal", "trás"),
  jato: W("bocal", "jato"),
  pararem: W("problema", "pararem"),
  apaga: W("problema", "apaga"),
  cataVento: W("turbina", "cata-vento"),
  jatoGira: W("turbina", "jato", 1),
  gira: W("turbina", "gira"),
  eixo: W("turbina", "eixo"),
  leva: W("turbina", "leva"),
  girando: W("turbina", "girando"),
  barulhento: W("gasta", "barulhento"),
  fan: W("fan", "ventilador"),
  frente: W("fan", "frente"),
  girado: W("fan", "girado"),
  cataVentos: W("fan", "cata-ventos"),
  fora: W("fan", "fora"),
  barulho: W("fan", "barulho"),
};

const compSpeed = (s: number) => {
  const start = prog(s, T.stages + 0.4, T.entra) * 7;
  const stop = 1 - prog(s, T.pararem, T.pararem + 1.2);
  const restart = prog(s, T.girando - 0.3, T.girando + 0.9) * 9;
  return s < T.pararem + 1.2 ? start * stop : restart;
};
const turbSpeed = (s: number) => (s < T.gira ? 0 : prog(s, T.gira - 0.2, T.gira + 0.8) * 9);
const fanSpeed = (s: number) => prog(s, T.girado - 0.2, T.girado + 1.2) * 4.5;

const jetState = (t: number): JetState => {
  const off = 1 - prog(t, T.apaga - 0.4, T.apaga + 0.2);
  const relight = prog(t, T.jatoGira - 0.3, T.jatoGira + 0.3);
  const burning = t < T.apaga + 0.3 ? prog(t, T.acende, T.acende + 0.3) * off : relight;
  const airIn = t < T.pararem ? prog(t, T.entra - 0.3, T.entra + 0.6) : t < T.girando ? 1 - prog(t, T.pararem + 0.5, T.pararem + 1.4) : prog(t, T.girando, T.girando + 0.8);
  return {
    stands: pop(prog(t, T.stands, T.stands + 0.5)),
    core: pop(prog(t, T.core - 0.1, T.core + 0.5)),
    comp: [0, 1, 2, 3, 4, 5].map((i) => pop(prog(t, T.stages + i * 0.27, T.stages + i * 0.27 + 0.45))),
    chamber: pop(prog(t, T.chamber, T.chamber + 0.5)),
    fuel: t < T.apaga ? prog(t, T.fuel, T.fuel + 0.4) : prog(t, T.jatoGira - 0.4, T.jatoGira),
    flame: burning,
    hotGas: burning * Math.max(0.35, airIn),
    nozzle: pop(prog(t, T.nozzle - 0.3, T.nozzle + 0.3)),
    jet: t < T.apaga + 0.3 ? prog(t, T.jato - 0.2, T.jato + 0.3) * off : relight,
    turbine: [pop(prog(t, T.cataVento, T.cataVento + 0.5)), pop(prog(t, T.cataVentos, T.cataVentos + 0.45)), pop(prog(t, T.cataVentos + 0.25, T.cataVentos + 0.7))],
    shaft: pop(prog(t, T.eixo - 0.1, T.eixo + 0.5)),
    shaftGlow: prog(t, T.leva, T.leva + 0.4) * (1 - prog(t, S("gasta"), S("gasta") + 0.6)),
    fan: pop(prog(t, T.fan, T.fan + 0.6)),
    nacelle: pop(prog(t, T.frente - 0.1, T.frente + 0.5)),
    bypass: prog(t, T.fora - 0.4, T.fora + 0.4),
    noise: prog(t, T.barulhento - 0.2, T.barulhento + 0.3) * (1 - 0.75 * prog(t, T.barulho - 0.4, T.barulho + 0.4)) * (t < E("fan") ? 1 : 0),
    compAngle: spin(compSpeed, T.stages, t),
    fanAngle: spin(fanSpeed, T.girado - 0.3, t),
    cut: true,
  };
};

// O 1º estágio da turbina gira separado até o eixo ligar tudo.
const BenchEngine: React.FC<{ t: number }> = ({ t }) => {
  const s = jetState(t);
  const ta = t < T.cataVento ? s.compAngle ?? 0 : spin(turbSpeed, T.gira - 0.3, t);
  return <JetEngine t={t} position={ENG} s={{ ...s, turbAngle: ta }} />;
};
const benchKeysWide: Key = { t: 0, pos: [-5.4, 3.4, 7.6], look: [-0.2, 1.6, 0], fov: 46 };

export const Jato: React.FC = () => {
  const tO = W("revelacao", "O");
  const cuts = [S("ventilador"), S("compressor"), tO];
  return (
    <TimelineCtx.Provider value={TL}>
      <AbsoluteFill style={{ background: "#9FD6F2" }}>
        {/* 1–2. GANCHO + ASAS — avião gigante sem motores */}
        <Shot from={0} to={S("ventilador")}>
          {(t) => {
            const correndo = W("asas", "correndo");
            const lift = prog(t, correndo, W("asas", "rápido") + 0.5) * (1 - prog(t, W("asas", "Então"), W("asas", "outro")));
            return (
              <>
                <Cam
                  from={0}
                  keys={[
                    { t: 0, pos: [-14, 2.0, 22], look: [2, 6.5, -6], fov: 50 },
                    { t: S("asas") + 0.6, pos: [-13.5, 2.2, 21], look: [2, 6.4, -6], fov: 50 },
                    { t: W("asas", "ar"), pos: [-9, 8.5, 17], look: [3, 5.4, 2], fov: 48 },
                    { t: W("asas", "Então"), pos: [-6, 7.6, 15], look: [3, 5.0, 2], fov: 48 },
                    { t: W("asas", "empurrar"), pos: [-2.0, 3.4, 9.5], look: [3.0, 4.1, 3], fov: 46 },
                    { t: S("ventilador"), pos: [-1.5, 3.3, 8.8], look: [3.0, 4.0, 3], fov: 46 },
                  ]}
                />
                <Runway t={t} />
                <Airliner t={t} engines={0} position={[PLANE[0], PLANE[1] + lift * 0.25, PLANE[2]]} rotation={[0, 0, -lift * 0.02]} scale={3} />
                {[3, 6, 9, 12].map((z, i) => (
                  <group key={z}>
                    <FlowParticles points={[[-14, 5.9, z], [0, 6.0, z], [8, 5.75, z], [20, 5.5, z]]} t={t} count={26} speed={0.35 + lift * 0.5} size={0.08} color="#FFFFFF" emissive={0.5} visible={prog(t, correndo - 0.5, correndo + 0.3) * (1 - prog(t, W("asas", "outro"), W("asas", "empurrar")))} seed={i} />
                    <FlowParticles points={[[-14, 4.6, z], [0, 4.6, z], [20, 4.65, z]]} t={t} count={18} speed={0.25 + lift * 0.3} size={0.07} color="#FFFFFF" emissive={0.5} visible={prog(t, correndo - 0.5, correndo + 0.3) * (1 - prog(t, W("asas", "outro"), W("asas", "empurrar")))} seed={i + 7} />
                  </group>
                ))}
                <Tiao position={[-12.3, 0, 17.3]} rotation={-0.5} mood={t > W("gancho", "pedissem") ? "shock" : "neutral"} t={t} look={[0.8, 1]} />
              </>
            );
          }}
        </Shot>

        {/* 3–4. VENTILADOR — empurra, mas é fraco */}
        <Shot from={S("ventilador")} to={S("compressor")} sky={WORK} sun={[4, 10, 8]} shadowSize={8}>
          {(t) => {
            const joga = W("ventilador", "joga");
            const fs = (s: number) => prog(s, S("ventilador") + 0.4, joga) * 14;
            const x = 1.2 - prog(t, W("ventilador", "empurra"), W("fraco", "fraco"), (u) => 1 - (1 - u) * (1 - u)) * 0.7;
            return (
              <>
                <Cam
                  from={S("ventilador")}
                  keys={[
                    { t: S("ventilador"), pos: [-0.9, 2.9, 7.4], look: [1.2, 1.0, 0.6], fov: 46 },
                    { t: W("ventilador", "empurra"), pos: [-0.3, 2.5, 6.4], look: [1.1, 1.0, 0.6], fov: 46 },
                    { t: W("fraco", "fraco"), pos: [0.4, 2.3, 5.8], look: [0.9, 1.0, 0.6], fov: 46 },
                    { t: S("compressor"), pos: [-0.2, 2.5, 6.4], look: [0.9, 1.0, 0.6], fov: 46 },
                  ]}
                />
                <Workshop />
                <FanCart t={t} x={x} fanAngle={spin(fs, S("ventilador"), t)} air={prog(t, joga - 0.2, joga + 0.3)} />
              </>
            );
          }}
        </Shot>

        {/* 5–11. A MONTAGEM NA BANCADA */}
        <Shot from={S("compressor")} to={tO} sky={WORK} sun={[4, 10, 8]} shadowSize={9}>
          {(t) => (
            <>
              <Cam
                from={S("compressor")}
                keys={[
                  { ...benchKeysWide, t: S("compressor") },
                  { t: W("compressor", "aperta"), pos: [-4.4, 3.1, 6.0], look: [-0.9, 1.7, 0], fov: 46 },
                  { t: W("compressor", "outra"), pos: [-3.4, 2.5, 3.8], look: [-1.1, 1.75, 0], fov: 46 },
                  { t: E("compressor"), pos: [-2.7, 2.3, 3.3], look: [-0.7, 1.75, 0], fov: 46 },
                  // câmara
                  { t: T.fuel, pos: [-1.6, 2.6, 3.2], look: [0.1, 1.75, 0], fov: 46 },
                  { t: T.acende + 0.4, pos: [-0.5, 2.4, 2.7], look: [0.3, 1.75, 0], fov: 46 },
                  { t: E("camara"), pos: [0.6, 2.6, 3.1], look: [0.5, 1.75, 0], fov: 46 },
                  // bocal
                  { t: T.nozzle, pos: [1.6, 2.8, 4.0], look: [1.6, 1.75, 0], fov: 46 },
                  { t: T.jato + 0.3, pos: [4.4, 2.6, 4.8], look: [2.6, 1.75, 0], fov: 48 },
                  { t: E("bocal"), pos: [4.8, 3.0, 6.0], look: [2.0, 1.7, 0], fov: 48 },
                  // problema
                  { t: S("problema") + 0.8, pos: [-4.6, 3.2, 6.6], look: [-0.4, 1.7, 0], fov: 46 },
                  { t: T.pararem, pos: [-3.2, 2.5, 3.7], look: [-1.0, 1.75, 0], fov: 46 },
                  { t: T.apaga, pos: [-1.4, 2.4, 3.0], look: [0.2, 1.75, 0], fov: 46 },
                  // turbina
                  { t: T.cataVento, pos: [2.9, 2.6, 3.6], look: [1.1, 1.75, 0], fov: 46 },
                  { t: T.gira + 0.4, pos: [2.5, 2.4, 3.0], look: [1.1, 1.75, 0], fov: 46 },
                  { t: T.eixo + 0.6, pos: [-0.4, 3.3, 5.2], look: [-0.4, 1.7, 0], fov: 48 },
                  { t: T.girando + 0.4, pos: [-3.3, 2.6, 3.7], look: [-1.0, 1.75, 0], fov: 46 },
                  { t: E("turbina"), pos: [-5.0, 3.3, 7.2], look: [-0.2, 1.6, 0], fov: 46 },
                  // gasta
                  { t: T.barulhento, pos: [5.0, 3.0, 6.0], look: [2.6, 1.6, 0], fov: 48 },
                  { t: E("gasta"), pos: [4.4, 3.4, 7.2], look: [1.6, 1.6, 0], fov: 48 },
                  // fan
                  { t: T.fan + 0.2, pos: [-7.2, 3.0, 6.2], look: [-2.2, 1.75, 0], fov: 48 },
                  { t: T.frente + 0.6, pos: [-7.6, 3.6, 7.6], look: [-1.8, 1.7, 0], fov: 48 },
                  { t: T.cataVentos + 0.6, pos: [3.4, 2.6, 3.6], look: [1.4, 1.75, 0], fov: 46 },
                  { t: T.fora + 0.3, pos: [-2.4, 3.8, 10.2], look: [0, 1.7, 0], fov: 48 },
                  { t: E("fan"), pos: [-3.2, 4.0, 10.6], look: [0, 1.7, 0], fov: 48 },
                  // revelação: recua
                  { t: tO, pos: [-7.5, 4.6, 12.5], look: [0, 1.6, 0], fov: 48 },
                ]}
                shake={(t > W("camara", "violência") - 0.1 && t < W("camara", "violência") + 0.5) || (t > T.jato && t < T.jato + 0.4) ? 0.01 : 0}
              />
              <Workshop />
              <BenchEngine t={t} />
            </>
          )}
        </Shot>

        {/* 12–13. REVELAÇÃO NO AVIÃO + CTA */}
        <Shot from={tO} to={TL.duration + 1}>
          {(t) => {
            const r = t - tO;
            const px = PLANE[0] + 8 - 1.6 * r * r;
            const up = Math.max(0, r - 2.6);
            const py = PLANE[1] + up * up * 1.1;
            const pitch = -0.2 * prog(t, tO + 2.3, tO + 3.4);
            return (
              <>
                <Cam from={tO} keys={[{ t: 0, pos: [-40, 3.2, 33], look: [px - 2, py - 1, -6], fov: 44 }]} />
                <Runway t={t} />
                <Airliner t={t} engines={1} fanAngle={t * 14} jet={1} position={[px, py, PLANE[2]]} rotation={[0, 0, pitch]} scale={3} gear={up < 1.2} />
                <Tiao position={[-35.5, 0, 22.5]} rotation={-0.3} mood="happy" pose={t > S("cta") ? "up" : "wave"} t={t} look={[0.5, 1]} />
              </>
            );
          }}
        </Shot>

        <BigText at={W("gancho", "trezentas")} until={W("gancho", "Se")} text="+300 TONELADAS" y={1400} color="#FFD23F" size={110} />
        <Mark kind="q" at={W("gancho", "começaria")} until={S("asas")} y={760} />
        <Mark kind="q" at={W("asas", "empurrar")} until={S("ventilador")} y={760} />
        <Mark kind="x" at={W("fraco", "fraco")} until={S("compressor")} y={760} />
        <Mark kind="q" at={W("problema", "Quem")} until={T.pararem} y={760} />
        <Mark kind="x" at={T.apaga} until={S("turbina")} y={760} />
        <Mark kind="ok" at={W("turbina", "sozinho")} until={E("turbina")} y={760} />
        <Mark kind="x" at={W("gasta", "demais")} until={E("gasta")} y={760} />
        <Mark kind="ok" at={W("fan", "economia")} until={E("fan")} y={760} />
        <Finish />
        <Flash at={cuts} />
        <TopLabel />
        <Captions />
        <CTA at={S("cta")} />
        <Audio src={staticFile("jato/narracao.wav")} />
        <Audio src={staticFile("jato/trilha.wav")} volume={0.9} />
      </AbsoluteFill>
    </TimelineCtx.Provider>
  );
};

export const jatoDuration = (fps: number) => Math.ceil((TL.duration + 0.8) * fps);
