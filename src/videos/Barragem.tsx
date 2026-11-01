import { AbsoluteFill, Audio, staticFile } from "remotion";
import { BigText, Captions, CTA, Finish, Flash, Mark, TopLabel } from "../engine/Overlays";
import { Cam, Shot } from "../engine/Shot";
import { cena, prog, Timeline, TimelineCtx, wordAt } from "../engine/timeline";
import { B, Dam, DirtDrops, Lake, Mound, Overtop, PowerPlant, PressureArrows, Riverbed, Scenery, Seepage, Spillway, Splash } from "../three/Barragem";
import { Rain } from "../three/Bunker";
import { Tiao } from "../three/Tiao";
import { ease } from "../theme";
import timelineJson from "../../public/barragem/timeline.json";

const TL = timelineJson as Timeline;
const S = (id: string) => cena(TL, id).start;
const E = (id: string) => cena(TL, id).end;
const W = (id: string, w: string, nth = 0) => wordAt(TL, id, w, nth);
const SKY: [string, string] = ["#6EBDE8", "#CFEAF6"];

const A = {
  terra: W("gancho", "terra"),
  trava: W("gancho", "trava"),
  lago: W("gancho", "lago"),
  subindo: W("transborda", "subindo"),
  cima: W("transborda", "cima"),
  arrasta: W("transborda", "arrasta"),
  levanta: W("paredao", "levanta"),
  nivel: W("paredao", "nível"),
  paredao: W("paredao", "paredão"),
  empurra: W("racha", "empurra"),
  trinca: W("racha", "trinca"),
  pe: W("racha", "pé"),
  fundo: W("racha", "fundo"),
  forte: W("racha", "forte"),
  fino: W("base", "fino"),
  largo: W("base", "largo"),
  triangulo: W("base", "triângulo"),
  caminho: W("infiltra", "caminho"),
  tunel: W("infiltra", "túnel"),
  finca: W("cortina", "finca"),
  rocha: W("cortina", "rocha"),
  atravessa: W("cortina", "atravessa"),
  chuvarada: W("cheia", "chuvarada"),
  borda: W("cheia", "borda"),
  tudo: W("cheia", "tudo"),
  canal: W("vertedouro", "canal"),
  desce: W("vertedouro", "desce"),
  vertedouro: W("vertedouro", "vertedouro"),
  rapido: W("erosao", "rápido"),
  buraco: W("erosao", "buraco"),
  escada: W("degraus", "escada"),
  degrau: W("degraus", "degrau"),
  mansinha: W("degraus", "mansinha"),
  turbinas: W("bonus", "turbinas"),
  cidade: W("bonus", "cidade"),
  barragem: W("revelacao", "barragem"),
};

const world = (t: number) => {
  const moundH = 2.0 * prog(t, 0.2, A.terra + 0.8, ease.out);
  const wash = prog(t, A.cima - 0.2, A.arrasta + 0.8, ease.in) * (t < S("paredao") ? 1 : 0);
  const damRise = prog(t, A.levanta - 0.2, A.nivel + 0.3, ease.out);
  const wide = prog(t, A.fino - 0.2, A.largo + 0.3, ease.inOut);
  const tilt = -0.025 * prog(t, A.trinca - 0.2, A.pe + 0.3) * (1 - prog(t, S("base"), A.fino));
  const crack = prog(t, A.trinca - 0.2, A.pe + 0.2) * (1 - prog(t, A.largo - 0.2, A.largo + 0.3));
  const cutoff = prog(t, A.finca - 0.2, A.rocha + 0.2, ease.out);
  const spill = prog(t, A.canal - 0.3, A.canal + 0.8, ease.out);
  const steps = prog(t, A.escada - 0.3, A.escada + 0.8);
  // nível do lago
  let level = 0;
  if (t < S("paredao")) level = Math.min(2.25, 0.2 + 2.05 * prog(t, A.trava - 0.4, A.cima + 0.2)) * (1 - 0.7 * wash);
  else if (t < S("cheia")) level = 0.6 + 2.9 * prog(t, A.levanta, A.paredao + 0.3);
  else if (t < S("vertedouro")) level = 3.5 + 0.55 * prog(t, A.chuvarada - 0.2, A.borda + 0.3);
  else level = 4.05 - 0.75 * prog(t, A.desce - 0.4, A.desce + 1.2);
  const overtop = t < S("paredao") ? prog(t, A.cima - 0.4, A.cima + 0.2) * (1 - prog(t, E("transborda") - 0.3, E("transborda"))) : 0;
  const nearTop = prog(t, A.borda - 0.3, A.tudo) * (1 - prog(t, A.desce - 0.4, A.desce + 0.6));
  const seep = prog(t, A.caminho - 0.3, A.caminho + 0.4) * (1 - prog(t, E("cortina") - 0.2, E("cortina")));
  const pipe = prog(t, A.caminho, A.tunel + 0.4) * (1 - prog(t, A.finca, A.rocha));
  const flow = prog(t, A.desce - 0.6, A.desce);
  const scour = prog(t, A.rapido - 0.2, A.buraco + 0.6) * (1 - prog(t, A.degrau, A.mansinha));
  const splash = prog(t, A.rapido - 0.4, A.rapido) * (1 - prog(t, A.escada, A.degrau));
  const plant = prog(t, A.turbinas - 0.6, A.turbinas + 0.3, ease.out);
  const lit = prog(t, A.cidade - 0.4, A.cidade + 0.4);
  const rain = prog(t, A.chuvarada - 0.6, A.chuvarada) * (1 - prog(t, A.vertedouro, A.vertedouro + 0.8));
  return { moundH, wash, damRise, wide, tilt, crack, cutoff, spill, steps, level, overtop, nearTop, seep, pipe, flow, scour, splash, plant, lit, rain };
};

export const DamScene: React.FC<{ t: number }> = ({ t }) => {
  const w = world(t);
  const preDam = t < S("paredao");
  const lakeX0 = preDam ? 1.4 : B.up;
  const mood = (t > A.arrasta - 0.4 && t < A.levanta) || (t > A.trinca && t < A.largo) || (t > A.tunel - 0.3 && t < A.rocha) || (t > A.tudo - 0.3 && t < A.vertedouro) || (t > A.buraco - 0.3 && t < A.mansinha) ? "shock" : t > A.barragem - 0.4 ? "happy" : "neutral";
  return (
    <group>
      <Riverbed scour={w.scour} pipe={w.pipe} />
      <Scenery t={t} />
      {preDam ? (
        <>
          <Mound h={w.moundH} wash={w.wash} />
          <DirtDrops p={prog(t, 0.2, A.terra + 0.8)} />
        </>
      ) : (
        <Dam rise={w.damRise} wide={w.wide} tilt={w.tilt} crack={w.crack} cutoff={w.cutoff} />
      )}
      <Lake level={w.level} x0={lakeX0} t={t} />
      <PressureArrows p={prog(t, A.empurra - 0.3, A.forte) * (1 - prog(t, A.fino - 0.3, A.fino + 0.2))} level={w.level} t={t} />
      <Overtop t={t} amount={w.overtop} top={w.moundH * (1 - w.wash * 0.6)} x={0} />
      <Overtop t={t} amount={w.nearTop * 0.25} top={B.crest} x={B.up - 0.3} />
      <Seepage t={t} amount={w.seep} blocked={w.cutoff > 0.9 ? 1 : 0} />
      <Spillway p={w.spill} steps={w.steps} t={t} flow={w.flow} />
      <Splash t={t} amount={w.splash} />
      <PowerPlant p={w.plant} t={t} lit={w.lit} />
      <Rain t={t} amount={w.rain} x0={-9} x1={9} z0={-9} z1={1} top={10} />
      <Tiao position={[-4.6, 0.06, -1.2]} rotation={0.55} scale={0.9} mood={mood} pose={t > S("cta") ? "wave" : t > A.barragem ? "up" : "down"} t={t} />
    </group>
  );
};

const side = (dx = 0, dy = 0, dz = 0, fov = 46) => ({ pos: [-0.6 + dx, 2.6 + dy, 15.5 + dz] as [number, number, number], look: [0.6 + dx * 0.7, 0.4 + dy * 0.6, -2.2] as [number, number, number], fov });

export const Barragem: React.FC = () => {
  const cuts = [S("paredao"), S("base"), S("cortina"), S("vertedouro"), S("degraus")];
  return (
    <TimelineCtx.Provider value={TL}>
      <AbsoluteFill style={{ background: SKY[1] }}>
        <Shot from={0} to={TL.duration + 1} sky={SKY} sun={[-6, 14, 10]} shadowSize={22}>
          {(t) => {
            const shake = (t > A.arrasta - 0.2 && t < A.arrasta + 0.6 ? 0.03 : 0) + (t > A.trinca && t < A.trinca + 0.4 ? 0.02 : 0);
            return (
              <>
                <Cam
                  from={0}
                  shake={shake}
                  keys={[
                    { t: 0, pos: [-5.5, 8.5, 10.5], look: [0.6, 0.6, -3.6], fov: 44 },
                    { t: A.lago, pos: [-4.0, 7.0, 12.5], look: [1.5, 0.6, -3.8], fov: 46 },
                    { t: A.cima, pos: [-3.5, 5.0, 13.5], look: [-1.0, 0.6, -3.2], fov: 46 },
                    { t: A.arrasta, pos: [-5.5, 5.0, 14.5], look: [-3.0, 0.4, -3.0], fov: 48 },
                    { t: S("paredao"), ...side(0, 0.6, 0) },
                    { t: A.paredao, ...side(0.3, 0.2, -1) },
                    { t: A.empurra, pos: [1.6, 1.6, 11.0], look: [1.4, 1.2, -0.5], fov: 46 },
                    { t: A.pe, pos: [0.6, 0.0, 6.8], look: [0.2, 0.1, -0.5], fov: 44 },
                    { t: A.fundo, pos: [1.8, 1.6, 11.0], look: [1.5, 1.2, -0.5], fov: 46 },
                    { t: S("base"), ...side(0, 0, -1.5) },
                    { t: A.triangulo, ...side(-0.5, 0, -2.2) },
                    { t: S("infiltra"), ...side(0, -2.2, 0, 48) },
                    { t: A.tunel, ...side(-0.5, -2.6, -1.5, 48) },
                    { t: A.rocha, ...side(0, -2.6, -1.0, 48) },
                    { t: S("cheia"), ...side(0, 1.2, 1.0) },
                    { t: A.tudo, ...side(0.5, 0.8, -1.5) },
                    { t: S("vertedouro"), pos: [-9.0, 9.0, 4.0], look: [-1.0, 2.0, -7.6], fov: 48 },
                    { t: A.canal + 0.6, pos: [-14.0, 6.5, -5.6], look: [-1.0, 1.8, -7.7], fov: 48 },
                    { t: A.vertedouro, pos: [-13.5, 6.0, -5.0], look: [-1.5, 1.6, -7.7], fov: 48 },
                    { t: S("erosao"), pos: [-12.0, 3.4, -4.6], look: [-7.2, 0.4, -7.7], fov: 46 },
                    { t: A.buraco, pos: [-11.2, 2.8, -5.2], look: [-7.6, 0.2, -7.7], fov: 44 },
                    { t: S("degraus"), pos: [-14.0, 6.5, -5.6], look: [-1.5, 1.6, -7.7], fov: 48 },
                    { t: A.mansinha, pos: [-12.5, 4.5, -5.0], look: [-4.0, 1.2, -7.7], fov: 48 },
                    { t: S("bonus"), pos: [-7.5, 5.0, 9.0], look: [-3.8, 1.2, -3.0], fov: 48 },
                    { t: A.turbinas + 0.3, pos: [-7.0, 4.2, 7.5], look: [-4.2, 1.0, -2.8], fov: 46 },
                    { t: A.cidade, pos: [-9.0, 10.5, 12.0], look: [-9.0, 3.5, -10.0], fov: 50 },
                    { t: S("revelacao"), pos: [-6.0, 15.0, 14.0], look: [-2.0, 1.2, -6.0], fov: 52 },
                    { t: TL.duration + 1, pos: [-6.0, 17.0, 16.5], look: [-2.0, 1.2, -6.0], fov: 52 },
                  ]}
                />
                <DamScene t={t} />
              </>
            );
          }}
        </Shot>

        <Mark kind="ok" at={A.lago} until={S("transborda")} y={760} />
        <Mark kind="x" at={A.arrasta} until={S("paredao")} y={760} />
        <Mark kind="ok" at={A.paredao} until={S("racha")} y={760} />
        <Mark kind="x" at={A.pe} until={A.fundo - 0.3} y={760} />
        <BigText at={A.fundo} until={E("racha")} text="+ FUNDO = + FORÇA" y={1380} color="#FFD23F" size={100} />
        <Mark kind="ok" at={A.triangulo} until={S("infiltra")} y={760} />
        <Mark kind="x" at={A.tunel} until={S("cortina")} y={760} />
        <Mark kind="ok" at={A.atravessa} until={S("cheia")} y={760} />
        <Mark kind="x" at={A.tudo} until={S("vertedouro")} y={760} />
        <Mark kind="ok" at={A.vertedouro} until={S("erosao")} y={760} />
        <Mark kind="x" at={A.buraco} until={S("degraus")} y={760} />
        <Mark kind="ok" at={A.mansinha} until={S("bonus")} y={760} />
        <Finish />
        <Flash at={cuts} />
        <TopLabel />
        <Captions />
        <CTA at={S("cta")} />
        <Audio src={staticFile("barragem/narracao.wav")} />
        <Audio src={staticFile("barragem/trilha.wav")} volume={0.9} />
      </AbsoluteFill>
    </TimelineCtx.Provider>
  );
};

export const barragemDuration = (fps: number) => Math.ceil((TL.duration + 0.8) * fps);
