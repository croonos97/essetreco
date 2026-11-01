import { AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { CameraRig, Key } from "../engine/Camera";
import { BigText, Captions, CTA, Finish, Flash, Mark, Tag, TopLabel } from "../engine/Overlays";
import { Stage } from "../engine/Stage";
import { cena, prog, Timeline, TimelineCtx, wordAt } from "../engine/timeline";
import { BreakerPanel, Meter, Sparks } from "../three/Extras";
import { HOUSE, House, Steam } from "../three/House";
import { ShowerMacro } from "../three/ShowerMacro";
import { Workshop } from "../three/Workshop";
import timelineJson from "../../public/chuveiro/timeline.json";

const TL = timelineJson as Timeline;
type V3 = [number, number, number];

const S = (id: string) => cena(TL, id).start;
const E = (id: string) => cena(TL, id).end;
const W = (id: string, w: string, nth = 0) => wordAt(TL, id, w, nth);

const WORKSHOP_SKY: [string, string] = ["#F3E6CF", "#E9D7B8"];

// Cada "shot" monta o seu palco 3D; t = segundos absolutos do vídeo.
const Shot: React.FC<{ from: number; to: number; children: (t: number) => React.ReactNode; sky?: [string, string]; sun?: V3; shadowSize?: number }> = ({
  from,
  to,
  children,
  sky,
  sun,
  shadowSize,
}) => {
  const { fps } = useVideoConfig();
  const f0 = Math.round(from * fps);
  const f1 = Math.round(to * fps);
  return (
    <Sequence from={f0} durationInFrames={Math.max(1, f1 - f0)} layout="none">
      <Inner from={from} sky={sky} sun={sun} shadowSize={shadowSize}>
        {children}
      </Inner>
    </Sequence>
  );
};

const Inner: React.FC<{ from: number; children: (t: number) => React.ReactNode; sky?: [string, string]; sun?: V3; shadowSize?: number }> = ({ from, children, sky, sun, shadowSize }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = from + frame / fps;
  return (
    <AbsoluteFill>
      <Stage sky={sky} sun={sun} shadowSize={shadowSize}>
        {children(t)}
      </Stage>
    </AbsoluteFill>
  );
};

// Câmera: as chaves usam tempo absoluto; o rig recebe offset = início do shot.
const Cam: React.FC<{ from: number; keys: Key[]; shake?: number }> = ({ from, keys, shake }) => <CameraRig keys={keys} offset={from} shake={shake} />;

export const Chuveiro: React.FC = () => {
  const cuts = [S("abertura"), S("gravidade"), S("diafragma"), S("virada"), W("virada", "sete"), S("queima"), S("dica"), S("seguranca"), S("fechamento")];
  const tSete = W("virada", "sete");
  const tMudar = W("queima", "Mudar");

  return (
    <TimelineCtx.Provider value={TL}>
      <AbsoluteFill style={{ background: "#9FD6F2" }}>
        {/* 1. GANCHO — Tião congelando no banho */}
        <Shot from={0} to={S("abertura")}>
          {(t) => {
            const cut = W("gancho", "queima");
            const fr = W("gancho", "frio");
            return (
              <>
                <Cam
                  from={0}
                  keys={[
                    { t: 0, pos: [2.15, 1.55, 2.3], look: [1.95, 1.35, -1.8], fov: 54 },
                    { t: S("abertura"), pos: [2.0, 1.85, 1.1], look: [1.92, 1.85, -1.9], fov: 48 },
                  ]}
                  shake={t > cut && t < cut + 0.4 ? 0.012 : 0}
                />
                <House
                  t={t}
                  stream={1 - prog(t, cut, cut + 0.25)}
                  hot={0}
                  frost={prog(t, 0, 0.6)}
                  mood={t > fr ? "shock" : "cold"}
                  pose="hug"
                  cold={0.32}
                  steam={0}
                  tiaoRot={0.35}
                />
                <Steam origin={[HOUSE.shower[0], HOUSE.shower[1] + 0.05, HOUSE.shower[2] + 0.1]} t={t} amount={prog(t, cut, cut + 0.3) * 0.8} spread={0.25} />
                <Sparks origin={[HOUSE.shower[0], HOUSE.shower[1], HOUSE.shower[2] + 0.2]} t={t} amount={t > cut && t < cut + 0.5 ? 0.6 : 0} />
              </>
            );
          }}
        </Shot>

        {/* 2. ABERTURA — chuveiro se desmonta na bancada */}
        <Shot from={S("abertura")} to={S("gravidade")} sky={WORKSHOP_SKY} sun={[4, 10, 8]} shadowSize={8}>
          {(t) => (
            <>
              <Cam
                from={S("abertura")}
                keys={[
                  { t: S("abertura"), pos: [1.4, 3.2, 8.4], look: [0, 2.7, 0], fov: 46 },
                  { t: S("gravidade"), pos: [-1.4, 3.9, 10.2], look: [0, 3.1, 0], fov: 46 },
                ]}
              />
              <Workshop />
              <ShowerMacro t={t} position={[0, 0.6, 0]} explode={prog(t, W("abertura", "abrir") - 0.1, E("abertura") - 0.2)} />
            </>
          )}
        </Shot>

        {/* 3. GRAVIDADE — da caixa d'água até o chuveiro */}
        <Shot from={S("gravidade")} to={S("diafragma")}>
          {(t) => (
            <>
              <Cam
                from={S("gravidade")}
                keys={[
                  { t: S("gravidade"), pos: [3.0, 3.8, 2.4], look: [2.35, 3.5, -1.6], fov: 44 },
                  { t: W("gravidade", "desce"), pos: [2.9, 2.7, 3.6], look: [2.5, 2.3, -2.2], fov: 48 },
                  { t: E("gravidade"), pos: [2.1, 1.95, 1.5], look: [2.15, 1.8, -2.0], fov: 52 },
                ]}
              />
              <House t={t} water={1} waterSpeed={0.45} mood="neutral" pose="down" cold={0.25} tiaoRot={0.3} />
            </>
          )}
        </Shot>

        {/* 4–6. MECANISMO — diafragma, resistência, água */}
        <Shot from={S("diafragma")} to={S("virada")} sky={WORKSHOP_SKY} sun={[4, 10, 8]} shadowSize={8}>
          {(t) => {
            const open = W("diafragma", "registro");
            const sobe = W("diafragma", "sobe");
            const encosta = W("diafragma", "encosta");
            const energia = W("diafragma", "energia");
            const calor = W("resistencia", "calor");
            const vermelha = W("resistencia", "vermelha");
            const entra = W("agua", "entra");
            const quente = W("agua", "quente");
            return (
              <>
                <Cam
                  from={S("diafragma")}
                  keys={[
                    { t: S("diafragma"), pos: [0, 3.7, 8.2], look: [0, 3.0, 0], fov: 46 },
                    { t: open + 0.6, pos: [0.3, 3.6, 6.0], look: [0, 3.2, 0], fov: 46 },
                    { t: encosta, pos: [0.6, 3.6, 4.7], look: [0, 3.35, 0], fov: 46 },
                    { t: E("diafragma") - 0.8, pos: [-0.5, 3.4, 5.6], look: [0, 3.0, 0], fov: 46 },
                    { t: S("resistencia") + 1.0, pos: [0.7, 2.6, 4.6], look: [0, 2.3, 0], fov: 46 },
                    { t: E("resistencia"), pos: [-0.6, 2.5, 4.2], look: [0, 2.25, 0], fov: 46 },
                    { t: entra, pos: [0.8, 2.5, 5.0], look: [0, 2.0, 0], fov: 46 },
                    { t: E("agua"), pos: [0.2, 1.7, 5.6], look: [0, 1.5, 0], fov: 48 },
                  ]}
                />
                <Workshop />
                <ShowerMacro
                  t={t}
                  position={[0, 0.6, 0]}
                  explode={1 - prog(t, S("diafragma"), S("diafragma") + 0.7)}
                  water={prog(t, open - 0.2, open + 0.8)}
                  diaphragm={prog(t, sobe - 0.1, encosta + 0.1)}
                  sparkContacts={t > encosta && t < encosta + 0.5 ? 1 - (t - encosta) / 0.5 : 0}
                  energy={prog(t, energia - 0.1, energia + 0.4)}
                  heatA={prog(t, calor - 0.6, vermelha + 0.4) * 0.72}
                  heatB={prog(t, calor - 0.6, vermelha + 0.4) * 0.72}
                  flow={prog(t, S("agua") - 0.2, S("agua") + 0.8)}
                  hotOut={prog(t, entra, quente + 0.3)}
                />
              </>
            );
          }}
        </Shot>

        {/* 7a. VIRADA — verão × inverno lado a lado */}
        <Shot from={S("virada")} to={tSete} sky={WORKSHOP_SKY} sun={[4, 10, 8]} shadowSize={8}>
          {(t) => {
            const ver = W("virada", "verão");
            const inv = W("virada", "inverno");
            const mais = W("virada", "muito");
            return (
              <>
                <Cam
                  from={S("virada")}
                  keys={[
                    { t: S("virada"), pos: [0, 2.3, 9.6], look: [0, 1.8, 0], fov: 46 },
                    { t: ver, pos: [-0.2, 2.25, 9.0], look: [-0.1, 1.8, 0], fov: 46 },
                    { t: inv, pos: [0.2, 2.25, 9.0], look: [0.1, 1.8, 0], fov: 46 },
                    { t: tSete, pos: [0, 2.2, 8.6], look: [0, 1.8, 0], fov: 46 },
                  ]}
                />
                <Workshop />
                <ShowerMacro t={t} bare housing={0} position={[-1.0, -0.35, 0]} scale={1.2} energy={prog(t, ver, ver + 0.4)} heatA={prog(t, ver, ver + 1) * 0.62} heatB={prog(t, ver, ver + 1) * 0.62} />
                <ShowerMacro
                  t={t}
                  bare
                  housing={0}
                  winterTap
                  position={[1.0, -0.35, 0]}
                  scale={1.2}
                  energy={prog(t, inv, inv + 0.4)}
                  heatA={prog(t, inv, mais + 0.6) * 0.98}
                  heatB={0}
                />
              </>
            );
          }}
        </Shot>

        {/* 7b. VIRADA — relógio de luz disparando */}
        <Shot from={tSete} to={S("queima")} sky={WORKSHOP_SKY} sun={[4, 10, 8]} shadowSize={8}>
          {(t) => (
            <>
              <Cam
                from={tSete}
                keys={[
                  { t: tSete, pos: [0.7, 2.4, 6.0], look: [0, 1.55, -0.4], fov: 46 },
                  { t: E("virada"), pos: [-0.5, 2.2, 4.8], look: [0, 1.6, -0.4], fov: 46 },
                ]}
              />
              <Workshop />
              <Meter position={[0, 2.0, -0.4]} t={t} speed={0.4 + prog(t, tSete, tSete + 2) * 2.4} />
            </>
          )}
        </Shot>

        {/* 8a. QUEIMA — bolha de ar e ruptura da mola */}
        <Shot from={S("queima")} to={tMudar} sky={WORKSHOP_SKY} sun={[4, 10, 8]} shadowSize={8}>
          {(t) => {
            const bolha = W("queima", "bolha");
            const arrebenta = W("queima", "arrebenta");
            return (
              <>
                <Cam
                  from={S("queima")}
                  keys={[
                    { t: S("queima"), pos: [0, 3.3, 7.2], look: [0, 2.6, 0], fov: 46 },
                    { t: bolha, pos: [0.5, 2.8, 4.4], look: [0, 2.5, 0.3], fov: 44 },
                    { t: arrebenta, pos: [0.3, 2.65, 3.3], look: [0, 2.5, 0.5], fov: 42 },
                    { t: tMudar, pos: [-0.4, 3.0, 5.0], look: [0, 2.5, 0], fov: 46 },
                  ]}
                  shake={t > arrebenta && t < arrebenta + 0.5 ? 0.02 : 0}
                />
                <Workshop />
                <ShowerMacro
                  t={t}
                  position={[0, 0.6, 0]}
                  housing={1}
                  water={1}
                  diaphragm={1}
                  winterTap
                  energy={t < arrebenta ? 1 : 0}
                  heatA={t < arrebenta ? 0.95 : 0.95 * (1 - prog(t, arrebenta, arrebenta + 2.5))}
                  flow={1 - prog(t, bolha - 0.4, bolha + 0.6) * 0.6}
                  hotOut={t < arrebenta ? 0.9 : 0.9 * (1 - prog(t, arrebenta, arrebenta + 2))}
                  burn={prog(t, bolha, arrebenta, (x) => x) * 0.8 + (t >= arrebenta ? 0.2 : 0)}
                />
                <Sparks origin={[0, 2.54, 0.6]} t={t} amount={t > arrebenta && t < arrebenta + 0.8 ? 1 : 0} />
              </>
            );
          }}
        </Shot>

        {/* 8b. QUEIMA — mudar a chave ligado faz faísca */}
        <Shot from={tMudar} to={S("dica")} sky={WORKSHOP_SKY} sun={[4, 10, 8]} shadowSize={8}>
          {(t) => {
            const chave = W("queima", "chave");
            return (
              <>
                <Cam
                  from={tMudar}
                  keys={[
                    { t: tMudar, pos: [4.2, 3.0, 4.8], look: [0.9, 2.5, 0], fov: 46 },
                    { t: E("queima"), pos: [3.3, 2.8, 3.4], look: [1.1, 2.35, 0], fov: 42 },
                  ]}
                />
                <Workshop />
                <ShowerMacro
                  t={t}
                  position={[0, 0.6, 0]}
                  water={1}
                  diaphragm={1}
                  energy={1}
                  heatA={0.7}
                  heatB={0.7}
                  flow={1}
                  hotOut={0.7}
                  knob={prog(t, chave - 0.2, chave + 0.3) * 1.6}
                  sparkContacts={t > chave && t < chave + 0.9 ? 0.6 + Math.sin(t * 40) * 0.4 : 0}
                />
                <Sparks origin={[1.3, 2.25, 0.25]} t={t} amount={t > chave && t < chave + 0.9 ? 1 : 0} seed={7} />
              </>
            );
          }}
        </Shot>

        {/* 9. DICA — fechar um pouco o registro */}
        <Shot from={S("dica")} to={S("seguranca")}>
          {(t) => {
            const feche = W("dica", "Feche");
            return (
              <>
                <Cam
                  from={S("dica")}
                  keys={[
                    { t: S("dica"), pos: [2.05, 1.8, 1.7], look: [2.05, 1.6, -2.0], fov: 54 },
                    { t: feche, pos: [2.8, 1.45, -0.6], look: [2.6, 1.3, -2.45], fov: 42 },
                    { t: E("dica"), pos: [2.1, 1.9, 1.2], look: [2.0, 1.8, -2.0], fov: 52 },
                  ]}
                />
                <House t={t} stream={1 - prog(t, feche, feche + 0.8) * 0.5} hot={0.55 + prog(t, feche + 0.4, feche + 2) * 0.4} steam={0.15 + prog(t, feche + 1, feche + 2.5) * 0.35} mood="relaxed" pose="down" tiaoRot={0.3} registroAngle={-prog(t, feche - 0.1, feche + 0.6) * 1.2} />
              </>
            );
          }}
        </Shot>

        {/* 10. SEGURANÇA — disjuntor próprio e fio terra */}
        <Shot from={S("seguranca")} to={S("fechamento")} sky={WORKSHOP_SKY} sun={[4, 10, 8]} shadowSize={8}>
          {(t) => (
            <>
              <Cam
                from={S("seguranca")}
                keys={[
                  { t: S("seguranca"), pos: [0.3, 2.4, 5.4], look: [0.2, 1.6, -1.5], fov: 48 },
                  { t: W("seguranca", "terra"), pos: [1.5, 1.3, 2.6], look: [1.25, 0.9, -1.2], fov: 44 },
                  { t: W("seguranca", "disjuntor"), pos: [1.4, 2.3, 2.6], look: [1.1, 2.0, -1.3], fov: 44 },
                  { t: E("seguranca"), pos: [0, 2.3, 5.2], look: [0.2, 1.7, -1.5], fov: 48 },
                ]}
              />
              <Workshop />
              <BreakerPanel position={[0, 2.0, -1.5]} t={t} highlight={prog(t, W("seguranca", "disjuntor") - 0.2, W("seguranca", "disjuntor") + 0.3)} ground={prog(t, W("seguranca", "terra") - 0.2, W("seguranca", "terra") + 0.3)} />
            </>
          )}
        </Shot>

        {/* 11–12. FECHAMENTO + CTA — casa inteira funcionando */}
        <Shot from={S("fechamento")} to={TL.duration + 1}>
          {(t) => (
            <>
              <Cam
                from={S("fechamento")}
                keys={[
                  { t: S("fechamento"), pos: [2.0, 1.85, 1.5], look: [1.95, 1.6, -1.8], fov: 52 },
                  { t: S("fechamento") + 2.2, pos: [2.2, 2.6, 5.0], look: [1.3, 1.8, -1.0], fov: 50 },
                  { t: E("fechamento"), pos: [3.6, 6.0, 12.5], look: [0.3, 1.9, -0.6], fov: 46 },
                  { t: TL.duration + 1, pos: [4.2, 6.4, 13.6], look: [0.3, 2.0, -0.6], fov: 46 },
                ]}
              />
              <House t={t} water={1} stream={1} hot={0.75} steam={0.7} mood="happy" pose={t > S("cta") ? "up" : "down"} tiaoRot={0.5} />
            </>
          )}
        </Shot>

        {/* camada de texto e acabamento */}
        <Tag at={W("virada", "verão")} until={tSete} text="VERÃO" x={318} y={1330} color="#E08A2A" />
        <Tag at={W("virada", "inverno")} until={tSete} text="INVERNO" x={762} y={1330} color="#D2402E" />
        <BigText at={tSete} until={E("virada")} count={{ to: 7500, suffix: " W" }} y={1420} color={"#FFD23F"} />
        <Mark at={W("queima", "queimou")} kind="x" y={760} until={tMudar} />
        <Mark at={W("dica", "quente", 1)} kind="ok" y={760} until={E("dica")} />
        <Mark at={W("seguranca", "eletricista")} kind="ok" y={760} until={E("seguranca")} />
        <Finish />
        <Flash at={cuts} />
        <TopLabel />
        <Captions />
        <CTA at={S("cta")} />

        <Audio src={staticFile("chuveiro/narracao.wav")} />
        <Audio src={staticFile("chuveiro/trilha.wav")} volume={0.9} />
      </AbsoluteFill>
    </TimelineCtx.Provider>
  );
};

export const chuveiroDuration = (fps: number) => Math.ceil((TL.duration + 0.8) * fps);
