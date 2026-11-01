import { AbsoluteFill, Audio, staticFile } from "remotion";
import { BigText, Captions, CTA, Finish, Flash, Mark, Tag, TopLabel } from "../engine/Overlays";
import { Cam, Shot } from "../engine/Shot";
import { cena, prog, Timeline, TimelineCtx, wordAt } from "../engine/timeline";
import { Sparks } from "../three/Extras";
import { Beam, FiberCable, GlassGuide, LIGHT, LivingRoom, OltRoom, Pliers, SplitterBox, Street, STREET } from "../three/Fibra";
import { Tiao } from "../three/Tiao";
import { Workshop } from "../three/Workshop";
import timelineJson from "../../public/fibra/timeline.json";

const TL = timelineJson as Timeline;
const S = (id: string) => cena(TL, id).start;
const E = (id: string) => cena(TL, id).end;
const W = (id: string, w: string, nth = 0) => wordAt(TL, id, w, nth);
const WORK: [string, string] = ["#F3E6CF", "#E9D7B8"];
const DARK: [string, string] = ["#0E1A2B", "#16263D"];
const ROOM: [string, string] = ["#E9DCC6", "#DCC9AB"];

export const Fibra: React.FC = () => {
  const cuts = [S("vidro"), S("reflexao"), S("central"), S("rua"), S("splitter"), S("casa"), S("virada"), S("fechamento")];
  return (
    <TimelineCtx.Provider value={TL}>
      <AbsoluteFill style={{ background: "#9FD6F2" }}>
        {/* 1. GANCHO — Tião corta o cabo e sai luz */}
        <Shot from={0} to={S("vidro")} sky={WORK} sun={[4, 10, 8]} shadowSize={8}>
          {(t) => {
            const corta = W("gancho", "cortasse");
            const luz = W("gancho", "luz");
            const choque = W("gancho", "choque");
            return (
              <>
                <Cam
                  from={0}
                  keys={[
                    { t: 0, pos: [0.4, 2.3, 6.8], look: [0, 1.5, 0], fov: 48 },
                    { t: luz, pos: [0.9, 2.0, 5.2], look: [0.3, 1.45, 0], fov: 48 },
                    { t: S("vidro"), pos: [1.1, 1.9, 4.6], look: [0.4, 1.4, 0], fov: 46 },
                  ]}
                  shake={t > corta + 0.3 && t < corta + 0.6 ? 0.015 : 0}
                />
                <Workshop />
                <FiberCable position={[-0.6, 1.1, 0.6]} reveal={0} glow={prog(t, corta + 0.3, corta + 0.6)} scale={0.25} cut />
                <Beam position={[0.42, 1.1, 0.6]} length={3.5} power={prog(t, luz - 0.5, luz + 0.1)} />
                <Pliers position={[0.45, 1.45, 0.75]} close={prog(t, corta, corta + 0.3)} />
                <Tiao position={[-0.6, 0, -0.9]} rotation={0.35} mood={t > luz - 0.4 ? "shock" : t > choque - 0.2 ? "neutral" : "neutral"} t={t} look={[0.8, -0.4]} />
                <Sparks origin={[0.42, 1.1, 0.6]} t={t} amount={t > corta + 0.3 && t < corta + 0.8 ? 0.6 : 0} />
              </>
            );
          }}
        </Shot>

        {/* 2. VIDRO — camadas do cabo */}
        <Shot from={S("vidro")} to={S("reflexao")} sky={WORK} sun={[4, 10, 8]} shadowSize={8}>
          {(t) => (
            <>
              <Cam
                from={S("vidro")}
                keys={[
                  { t: S("vidro"), pos: [-1.0, 2.6, 6.4], look: [0.6, 1.6, 0], fov: 46 },
                  { t: W("vidro", "cabelo"), pos: [2.6, 2.0, 3.4], look: [1.6, 1.6, 0], fov: 44 },
                  { t: E("vidro"), pos: [3.2, 1.9, 3.0], look: [2.2, 1.6, 0], fov: 42 },
                ]}
              />
              <Workshop />
              <FiberCable position={[0, 1.6, 0]} reveal={prog(t, S("vidro") + 0.2, W("vidro", "vidro") + 0.6)} glow={prog(t, W("vidro", "passa") - 0.2, W("vidro", "passa") + 0.4) * 0.8 + 0.2} scale={0.7} />
            </>
          )}
        </Shot>

        {/* 3. REFLEXÃO — luz quicando dentro do vidro */}
        <Shot from={S("reflexao")} to={S("central")} sky={DARK} sun={[4, 10, 8]} exposure={1.1} ambient={0.7}>
          {(t) => {
            const curva = W("reflexao", "curva");
            return (
              <>
                <Cam
                  from={S("reflexao")}
                  keys={[
                    { t: S("reflexao"), pos: [-5, 1.2, 4.5], look: [-3, 0, 0], fov: 46 },
                    { t: curva - 0.5, pos: [0.5, 1.0, 5.5], look: [1.0, 0, 0], fov: 46 },
                    { t: E("reflexao"), pos: [3.0, 1.5, 8.5], look: [2.0, -1.2, 0.6], fov: 48 },
                  ]}
                />
                <GlassGuide t={t} bend={prog(t, curva - 0.4, curva + 0.8) * 0.55} colors={0} />
              </>
            );
          }}
        </Shot>

        {/* 4. CENTRAL — OLT transforma dados em piscadas de laser */}
        <Shot from={S("central")} to={S("rua")} sky={["#D7DDE2", "#C9D0D6"]} sun={[3, 9, 6]} shadowSize={9}>
          {(t) => (
            <>
              <Cam
                from={S("central")}
                keys={[
                  { t: S("central"), pos: [2.5, 2.8, 7.5], look: [0, 2.0, -2.2], fov: 48 },
                  { t: W("central", "OLT"), pos: [0.4, 2.3, 2.6], look: [0, 2.2, -1.4], fov: 44 },
                  { t: W("central", "laser"), pos: [-0.2, 2.2, 1.0], look: [-0.5, 2.15, -1.4], fov: 40 },
                  { t: E("central"), pos: [-0.9, 2.0, 1.3], look: [-0.5, 2.1, -1.4], fov: 40 },
                ]}
              />
              <OltRoom t={t} laser={prog(t, W("central", "laser") - 0.6, W("central", "laser"))} />
            </>
          )}
        </Shot>

        {/* 5. RUA — luz pelos postes até a caixa */}
        <Shot from={S("rua")} to={S("splitter")}>
          {(t) => (
            <>
              <Cam
                from={S("rua")}
                keys={[
                  { t: S("rua"), pos: [-6, 6.5, 13], look: [-2, 4.0, 1.2], fov: 46 },
                  { t: E("rua"), pos: [1.6, 5.2, 4.6], look: [STREET.cto[0], STREET.cto[1], STREET.cto[2]], fov: 42 },
                ]}
              />
              <Street t={t} light={1} />
            </>
          )}
        </Shot>

        {/* 6. SPLITTER — uma luz vira várias */}
        <Shot from={S("splitter")} to={S("casa")} sky={DARK} exposure={1.1} ambient={0.8}>
          {(t) => (
            <>
              <Cam
                from={S("splitter")}
                keys={[
                  { t: S("splitter"), pos: [-1.5, 0.6, 7.2], look: [0.4, 0, 0], fov: 46 },
                  { t: W("splitter", "divide"), pos: [0.6, 0.4, 6.4], look: [1.2, 0, 0], fov: 46 },
                  { t: E("splitter"), pos: [1.8, 0.6, 6.0], look: [2.0, 0, 0], fov: 46 },
                ]}
              />
              <SplitterBox t={t} input={1} split={prog(t, W("splitter", "divide") - 0.2, W("splitter", "divide") + 0.6)} />
            </>
          )}
        </Shot>

        {/* 7. CASA — ONU, roteador e Wi-Fi */}
        <Shot from={S("casa")} to={S("virada")} sky={ROOM} sun={[3, 8, 6]} shadowSize={8}>
          {(t) => {
            const onu = W("casa", "ONU");
            const wifi = W("casa", "roteador", 1);
            return (
              <>
                <Cam
                  from={S("casa")}
                  keys={[
                    { t: S("casa"), pos: [-1.6, 3.2, 2.2], look: [-1.5, 2.8, -2.4], fov: 46 },
                    { t: onu, pos: [0.9, 1.6, 0.6], look: [0.8, 1.3, -2.0], fov: 40 },
                    { t: wifi, pos: [1.0, 2.1, 4.6], look: [-0.2, 1.3, -0.6], fov: 48 },
                    { t: E("casa"), pos: [0.0, 2.2, 5.4], look: [-0.5, 1.3, -0.4], fov: 50 },
                  ]}
                />
                <LivingRoom t={t} fiber={1} onu={prog(t, onu - 0.2, onu + 0.3)} wifi={prog(t, wifi - 0.2, wifi + 0.6)} />
                <Tiao position={[-1.2, 0, 0.9]} rotation={0.3} mood={t > wifi ? "happy" : "neutral"} phone t={t} />
              </>
            );
          }}
        </Shot>

        {/* 8. VIRADA — download e upload no mesmo fio */}
        <Shot from={S("virada")} to={S("dica")} sky={DARK} exposure={1.1} ambient={0.7}>
          {(t) => (
            <>
              <Cam
                from={S("virada")}
                keys={[
                  { t: S("virada"), pos: [-3, 1.4, 6.0], look: [-1, 0, 0], fov: 46 },
                  { t: E("virada"), pos: [2.0, 0.8, 4.4], look: [1.0, 0, 0], fov: 44 },
                ]}
              />
              <GlassGuide t={t} bend={0} colors={prog(t, W("virada", "upload") - 0.2, W("virada", "upload") + 0.4)} />
            </>
          )}
        </Shot>

        {/* 9. DICA — dobra forte faz a luz vazar */}
        <Shot from={S("dica")} to={S("fechamento")} sky={DARK} exposure={1.1} ambient={0.7}>
          {(t) => {
            const dobra = W("dica", "dobra");
            return (
              <>
                <Cam
                  from={S("dica")}
                  keys={[
                    { t: S("dica"), pos: [1.0, 1.5, 9.5], look: [0.5, -0.8, 0], fov: 48 },
                    { t: E("dica"), pos: [3.5, 0.5, 8.0], look: [1.6, -1.8, 0.6], fov: 48 },
                  ]}
                />
                <GlassGuide t={t} bend={0.15 + prog(t, S("dica"), dobra + 0.4) * 0.85} leak={prog(t, dobra, dobra + 0.8)} colors={0} />
              </>
            );
          }}
        </Shot>

        {/* 10–11. FECHAMENTO + CTA — bairro todo ligado por luz */}
        <Shot from={S("fechamento")} to={TL.duration + 1} sky={["#F6B98A", "#FBD9A8"]} sun={[-8, 6, 6]} exposure={1.1}>
          {(t) => (
            <>
              <Cam
                from={S("fechamento")}
                keys={[
                  { t: S("fechamento"), pos: [0, 4.2, 10], look: [0, 3.2, 0], fov: 48 },
                  { t: TL.duration + 1, pos: [0, 7.5, 17], look: [0, 3.0, -0.5], fov: 48 },
                ]}
              />
              <Street t={t} light={1} allHouses={1} />
              <Tiao position={[1.6, 0, 1.6]} rotation={-0.2} mood="happy" pose={t > S("cta") ? "up" : "wave"} t={t} />
            </>
          )}
        </Shot>

        {/* camada de texto */}
        <BigText at={W("reflexao", "duzentos")} until={E("reflexao")} text="200.000 km/s" y={1400} color={LIGHT} size={110} />
        <BigText at={W("central", "acesa")} until={W("central", "apagada")} text="1" y={360} color="#4CFF7A" size={220} />
        <BigText at={W("central", "apagada")} until={E("central")} text="0" y={360} color="#FF5A5A" size={220} />
        <Tag at={W("virada", "download")} until={E("virada")} text="DOWNLOAD" x={300} y={1400} color="#1C9DB5" />
        <Tag at={W("virada", "upload")} until={E("virada")} text="UPLOAD" x={780} y={1400} color="#C2389B" />
        <Mark at={W("dica", "cai")} kind="x" y={760} until={E("dica")} />
        <Finish />
        <Flash at={cuts} />
        <TopLabel />
        <Captions />
        <CTA at={S("cta")} />
        <Audio src={staticFile("fibra/narracao.wav")} />
        <Audio src={staticFile("fibra/trilha.wav")} volume={0.9} />
      </AbsoluteFill>
    </TimelineCtx.Provider>
  );
};

export const fibraDuration = (fps: number) => Math.ceil((TL.duration + 0.8) * fps);
