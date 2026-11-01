import { AbsoluteFill, Audio, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { BigText, Captions, CTA, Finish, Flash, Mark, TopLabel } from "../engine/Overlays";
import { Cam, Shot } from "../engine/Shot";
import { cena, prog, Timeline, TimelineCtx, wordAt } from "../engine/timeline";
import { Kitchen, PressureCooker, Stove, Thermometer, WallClock } from "../three/Panela";
import { Tiao } from "../three/Tiao";
import { C, FONT, spring as SP } from "../theme";
import timelineJson from "../../public/panela/timeline.json";

const TL = timelineJson as Timeline;
const S = (id: string) => cena(TL, id).start;
const E = (id: string) => cena(TL, id).end;
const W = (id: string, w: string, nth = 0) => wordAt(TL, id, w, nth);
const KITCHEN: [string, string] = ["#F6EBDD", "#EEDFCB"];
const POT: [number, number, number] = [0.6, 1.62, -1.0];

// As 3 regras, desenhadas em SVG (sem emoji).
const Rules: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const items = [
    { at: W("dicas", "encha"), text: "NO MÁXIMO 2/3", icon: "level" },
    { at: W("dicas", "limpe"), text: "VÁLVULA LIMPA", icon: "valve" },
    { at: W("dicas", "abra"), text: "SÓ ABRA SEM VAPOR", icon: "wait" },
  ];
  if (frame < S("dicas") * fps || frame > E("dicas") * fps + 6) return null;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div style={{ position: "absolute", top: 330, left: 90, right: 90, display: "flex", flexDirection: "column", gap: 34 }}>
        {items.map((it, i) => {
          const p = spring({ frame: frame - Math.round(it.at * fps), fps, config: SP.bouncy });
          const ck = spring({ frame: frame - Math.round(it.at * fps) - 8, fps, config: SP.snappy });
          return (
            <div
              key={it.text}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 30,
                padding: "22px 30px",
                borderRadius: 34,
                background: "rgba(255,255,255,0.94)",
                boxShadow: "0 12px 0 rgba(0,0,0,0.18)",
                transform: `translateX(${interpolate(p, [0, 1], [-120, 0])}px) scale(${interpolate(p, [0, 1], [0.8, 1])})`,
                opacity: Math.min(1, p * 1.5),
              }}
            >
              <svg width={110} height={110} viewBox="0 0 100 100">
                {it.icon === "level" ? (
                  <>
                    <rect x="18" y="20" width="64" height="66" rx="10" fill="none" stroke={C.ink} strokeWidth="7" />
                    <rect x="24" y="44" width="52" height="36" rx="5" fill={C.water} />
                    <line x1="10" y1="42" x2="90" y2="42" stroke={C.accent} strokeWidth="5" strokeDasharray="8 6" />
                  </>
                ) : it.icon === "valve" ? (
                  <>
                    <rect x="44" y="50" width="12" height="36" fill={C.ink} />
                    <path d="M28 52 Q50 14 72 52 Z" fill="#3B3F45" />
                    <circle cx="50" cy="26" r="7" fill="#3B3F45" />
                    <path d="M18 30 l8 -8 M82 30 l-8 -8 M50 6 v6" stroke={C.good} strokeWidth="5" strokeLinecap="round" />
                  </>
                ) : (
                  <>
                    <circle cx="50" cy="52" r="34" fill="none" stroke={C.ink} strokeWidth="7" />
                    <path d="M50 52 V30 M50 52 L66 62" stroke={C.ink} strokeWidth="7" strokeLinecap="round" />
                  </>
                )}
              </svg>
              <div style={{ flex: 1, fontFamily: FONT, fontWeight: 800, fontSize: 56, color: C.ink, lineHeight: 1 }}>{it.text}</div>
              <svg width={80} height={80} viewBox="0 0 100 100" style={{ transform: `scale(${ck})` }}>
                <circle cx="50" cy="50" r="44" fill={C.good} />
                <path d="M28 52 L44 68 L74 34" fill="none" stroke="#fff" strokeWidth="11" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span style={{ display: "none" }}>{i}</span>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

export const Panela: React.FC = () => {
  const cuts = [S("aberta"), S("feijao"), S("valvula"), S("perigo"), S("dicas"), S("fechamento")];
  const tCem = W("aberta", "cem");
  const tVinte = W("pressao", "vinte");
  return (
    <TimelineCtx.Provider value={TL}>
      <AbsoluteFill style={{ background: "#F6EBDD" }}>
        {/* 1. GANCHO — panela chiando, Tião desconfiado */}
        <Shot from={0} to={S("aberta")} sky={KITCHEN} sun={[3, 9, 7]} shadowSize={8}>
          {(t) => {
            const perigo = W("gancho", "perigo");
            return (
              <>
                <Cam
                  from={0}
                  keys={[
                    { t: 0, pos: [1.4, 2.7, 6.0], look: [-0.2, 1.8, -0.6], fov: 48 },
                    { t: perigo, pos: [1.5, 2.6, 3.2], look: [0.6, 2.1, -1.0], fov: 46 },
                    { t: S("aberta"), pos: [1.3, 2.5, 2.9], look: [0.6, 2.1, -1.0], fov: 44 },
                  ]}
                  shake={t > perigo && t < perigo + 0.8 ? 0.012 : 0}
                />
                <Kitchen />
                <Stove position={[0, 0, -1.35]} flame={1} t={t} />
                <PressureCooker position={POT} t={t} scale={0.55} cut={false} lid={1} water={0.6} boil={1} pressure={0.8} hot={0.8} weightLift={1} jet={1} clog={0} safety={0} danger={prog(t, perigo - 0.2, perigo + 0.3) * (1 - prog(t, perigo + 0.9, perigo + 1.4))} />
                <Tiao position={[-0.75, 0, 0.6]} rotation={0.5} mood={t > perigo ? "shock" : "neutral"} t={t} look={[1, 0]} />
              </>
            );
          }}
        </Shot>

        {/* 2–4. PANELA ABERTA → TAMPA → PRESSÃO (mesmo cenário em corte) */}
        <Shot from={S("aberta")} to={S("feijao")} sky={KITCHEN} sun={[3, 9, 7]} shadowSize={8}>
          {(t) => {
            const tampa = W("tampa", "tampa");
            const veda = W("tampa", "veda");
            const empurra = W("pressao", "empurra");
            const level = t < tampa ? 0.5 * prog(t, S("aberta"), tCem + 0.5) : 0.5 + 0.17 * prog(t, empurra, tVinte + 0.5);
            return (
              <>
                <Cam
                  from={S("aberta")}
                  keys={[
                    { t: S("aberta"), pos: [0.3, 3.1, 5.2], look: [0.3, 2.0, -1.0], fov: 46 },
                    { t: tCem, pos: [0.9, 2.5, 3.6], look: [0.5, 1.95, -1.0], fov: 44 },
                    { t: tampa, pos: [0.3, 2.9, 4.2], look: [0.5, 2.3, -1.0], fov: 46 },
                    { t: veda, pos: [1.6, 2.7, 2.6], look: [1.0, 2.35, -1.0], fov: 42 },
                    { t: empurra, pos: [0.4, 2.6, 3.8], look: [0.5, 2.0, -1.0], fov: 44 },
                    { t: S("feijao"), pos: [-0.2, 2.6, 4.2], look: [0.5, 2.0, -1.0], fov: 46 },
                  ]}
                />
                <Kitchen />
                <Stove position={[0, 0, -1.35]} flame={1} t={t} />
                <PressureCooker
                  position={POT}
                  t={t}
                  scale={0.75}
                  lid={prog(t, tampa - 0.2, tampa + 0.8)}
                  water={0.62}
                  boil={t < tampa ? prog(t, S("aberta"), tCem) : 1 - prog(t, empurra, empurra + 1.2) * 0.7}
                  pressure={prog(t, veda, empurra + 1)}
                  hot={prog(t, S("aberta"), tVinte)}
                  weightLift={0}
                  jet={0}
                  clog={0}
                  safety={0}
                  danger={0}
                />
                <Thermometer position={[1.45, 1.4, -0.5]} level={level} />
              </>
            );
          }}
        </Shot>

        {/* 5. FEIJÃO — muito mais rápido */}
        <Shot from={S("feijao")} to={S("valvula")} sky={KITCHEN} sun={[3, 9, 7]} shadowSize={8}>
          {(t) => (
            <>
              <Cam
                from={S("feijao")}
                keys={[
                  { t: S("feijao"), pos: [-0.4, 2.9, 4.4], look: [-0.4, 2.6, -1.0], fov: 46 },
                  { t: W("feijao", "horas"), pos: [0.0, 2.6, 5.0], look: [0.0, 2.1, -0.8], fov: 48 },
                  { t: E("feijao"), pos: [0.4, 2.4, 5.4], look: [0.0, 1.9, -0.6], fov: 50 },
                ]}
              />
              <Kitchen />
              <WallClock position={[-0.7, 3.25, -2.0]} t={t} speed={2 + prog(t, W("feijao", "rápido"), W("feijao", "rápido") + 1) * 30} />
              <Stove position={[0, 0, -1.35]} flame={1} t={t} />
              <PressureCooker position={POT} t={t} scale={0.55} cut={false} lid={1} water={0.6} boil={0.4} pressure={0.8} hot={0.9} weightLift={1} jet={0.7} clog={0} safety={0} danger={0} />
              <Tiao position={[-0.9, 0, 0.9]} rotation={0.4} mood={t > W("feijao", "pronto") - 0.3 ? "happy" : "neutral"} pose={t > W("feijao", "pronto") ? "up" : "down"} t={t} />
            </>
          )}
        </Shot>

        {/* 6. VÁLVULA — o peso sobe e solta vapor (chiado) */}
        <Shot from={S("valvula")} to={S("perigo")} sky={KITCHEN} sun={[3, 9, 7]} shadowSize={8}>
          {(t) => {
            const levanta = W("valvula", "levanta");
            const lift = t < levanta ? 0 : 0.5 + 0.5 * Math.sin((t - levanta) * 9);
            return (
              <>
                <Cam
                  from={S("valvula")}
                  keys={[
                    { t: S("valvula"), pos: [0.2, 3.4, 4.6], look: [0.5, 2.6, -1.0], fov: 46 },
                    { t: W("valvula", "peso"), pos: [0.9, 3.3, 2.0], look: [0.6, 2.95, -1.0], fov: 40 },
                    { t: E("valvula"), pos: [0.1, 3.3, 2.5], look: [0.6, 3.0, -1.0], fov: 42 },
                  ]}
                />
                <Kitchen />
                <Stove position={[0, 0, -1.35]} flame={1} t={t} />
                <PressureCooker position={POT} t={t} scale={0.75} lid={1} water={0.62} boil={0.4} pressure={0.85} hot={0.9} weightLift={lift} jet={t > levanta ? lift : 0} clog={0} safety={0} danger={0} />
              </>
            );
          }}
        </Shot>

        {/* 7–8. PERIGO + SEGURANÇA */}
        <Shot from={S("perigo")} to={S("dicas")} sky={KITCHEN} sun={[3, 9, 7]} shadowSize={8}>
          {(t) => {
            const entope = W("perigo", "entope");
            const subir = W("perigo", "subir");
            const estoura = W("seguranca", "estoura");
            return (
              <>
                <Cam
                  from={S("perigo")}
                  keys={[
                    { t: S("perigo"), pos: [0.4, 3.0, 4.2], look: [0.5, 2.4, -1.0], fov: 46 },
                    { t: entope, pos: [0.7, 3.25, 2.4], look: [0.6, 2.9, -1.0], fov: 42 },
                    { t: subir, pos: [0.3, 2.9, 3.6], look: [0.5, 2.4, -1.0], fov: 46 },
                    { t: estoura, pos: [-0.2, 3.1, 2.8], look: [0.2, 2.8, -1.0], fov: 44 },
                    { t: E("seguranca"), pos: [0.2, 3.1, 4.4], look: [0.4, 2.5, -1.0], fov: 46 },
                  ]}
                  shake={t > subir - 1 && t < estoura ? 0.008 : 0}
                />
                <Kitchen />
                <Stove position={[0, 0, -1.35]} flame={1} t={t} />
                <PressureCooker
                  position={POT}
                  t={t}
                  scale={0.75}
                  lid={1}
                  water={0.85}
                  boil={1}
                  pressure={1}
                  hot={0.95}
                  weightLift={0}
                  jet={0}
                  clog={prog(t, S("perigo"), entope + 0.8) * (1 - prog(t, estoura, estoura + 1.5) * 0.6)}
                  safety={prog(t, estoura - 0.1, estoura + 0.4)}
                  danger={prog(t, entope, subir + 0.5) * (1 - prog(t, estoura, estoura + 0.6))}
                />
              </>
            );
          }}
        </Shot>

        {/* 9. DICAS — fundo calmo com as 3 regras */}
        <Shot from={S("dicas")} to={S("fechamento")} sky={KITCHEN} sun={[3, 9, 7]} shadowSize={8}>
          {(t) => (
            <>
              <Cam
                from={S("dicas")}
                keys={[
                  { t: S("dicas"), pos: [0.6, 1.9, 4.6], look: [0.6, 2.1, -1.0], fov: 48 },
                  { t: E("dicas"), pos: [0.2, 1.8, 3.8], look: [0.5, 2.0, -1.0], fov: 48 },
                ]}
              />
              <Kitchen />
              <Stove position={[0, 0, -1.35]} flame={0} t={t} />
              <PressureCooker position={POT} t={t} scale={0.55} cut={false} lid={1} water={0.6} boil={0} pressure={0} hot={0.3} weightLift={0} jet={0} clog={0} safety={0} danger={0} />
            </>
          )}
        </Shot>

        {/* 10–11. FECHAMENTO + CTA */}
        <Shot from={S("fechamento")} to={TL.duration + 1} sky={KITCHEN} sun={[3, 9, 7]} shadowSize={8}>
          {(t) => (
            <>
              <Cam
                from={S("fechamento")}
                keys={[
                  { t: S("fechamento"), pos: [2.6, 2.6, 4.4], look: [0.0, 1.8, -0.6], fov: 48 },
                  { t: TL.duration + 1, pos: [3.4, 3.4, 6.8], look: [0.0, 1.8, -0.6], fov: 48 },
                ]}
              />
              <Kitchen />
              <Stove position={[0, 0, -1.35]} flame={1} t={t} />
              <PressureCooker position={POT} t={t} scale={0.55} cut={false} lid={1} water={0.6} boil={0.3} pressure={0.7} hot={0.9} weightLift={0.5 + 0.5 * Math.sin(t * 9)} jet={0.7} clog={0} safety={0} danger={0} />
              <Tiao position={[-1.1, 0, 0.4]} rotation={0.5} mood="happy" pose={t > S("cta") ? "up" : "wave"} t={t} />
            </>
          )}
        </Shot>

        <BigText at={tCem} until={W("tampa", "tampa")} text="100 °C" y={1380} color="#FFD23F" size={140} />
        <BigText at={tVinte} until={E("pressao")} text="120 °C" y={1380} color={C.accent} size={140} />
        <BigText at={W("feijao", "horas")} until={E("feijao")} text="HORAS → 30 MIN" y={1380} color="#FFFFFF" size={110} />
        <Mark at={W("perigo", "subir")} kind="x" y={760} until={S("seguranca")} />
        <Mark at={W("seguranca", "libera")} kind="ok" y={760} until={E("seguranca")} />
        <Rules />
        <Finish />
        <Flash at={cuts} />
        <TopLabel />
        <Captions />
        <CTA at={S("cta")} />
        <Audio src={staticFile("panela/narracao.wav")} />
        <Audio src={staticFile("panela/trilha.wav")} volume={0.9} />
      </AbsoluteFill>
    </TimelineCtx.Provider>
  );
};

export const panelaDuration = (fps: number) => Math.ceil((TL.duration + 0.8) * fps);
