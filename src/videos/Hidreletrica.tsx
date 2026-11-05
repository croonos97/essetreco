import { AbsoluteFill, Audio, staticFile } from "remotion";
import { BigText, Captions, CTA, Finish, Flash, Mark, TopLabel } from "../engine/Overlays";
import { Cam, Shot } from "../engine/Shot";
import { cena, pop, prog, spin, Timeline, TimelineCtx, wordAt } from "../engine/timeline";
import { FlowParticles, Pipe, RBox } from "../three/basics";
import { BenchGenerator, City, CITY, Lamp, LAMP_POS, PorchHouse, Powerhouse, sag, Tower, towerPhases, TOWERS, Transformer, Valley, VALLEY } from "../three/Hidro";
import { Appear } from "../three/Jato";
import { Tiao } from "../three/Tiao";
import { Workshop } from "../three/Workshop";
import timelineJson from "../../public/hidreletrica/timeline.json";

const TL = timelineJson as Timeline;
const S = (id: string) => cena(TL, id).start;
const E = (id: string) => cena(TL, id).end;
const W = (id: string, w: string, nth = 0) => wordAt(TL, id, w, nth);
type V3 = [number, number, number];
const NIGHT: [string, string] = ["#232741", "#383D5C"];
const DUSK: [string, string] = ["#5B4F8C", "#F2A774"];
const ENERGY = "#FFD23F";

// ---------- bancada ----------
const B = {
  mexer: W("ima", "mexer"),
  ima: W("ima", "ímã"),
  fio: W("ima", "fio"),
  corrente: W("ima", "corrente"),
  parou: W("para", "Parou"),
  prende: W("gerador", "prende"),
  eixo: W("gerador", "eixo"),
  girar: W("gerador", "girar"),
  bobinas: W("gerador", "bobinas"),
  precisa: W("cansa", "precisa"),
  manivela: W("cansa", "manivela"),
  minutos: W("cansa", "minutos"),
  aguenta: W("cansa", "aguenta"),
};
const OMEGA = Math.PI * 2 * 1.1;
const shakeY = (t: number) => (t < B.mexer ? -0.35 : t < B.parou ? -0.18 - 0.17 * Math.cos(OMEGA * (t - B.mexer)) : -0.18 - 0.17 * Math.cos(OMEGA * (B.parou - B.mexer)));
const genSpeed = (s: number) => {
  if (s < B.girar) return 0;
  const run = prog(s, B.girar, B.girar + 0.8) * 7;
  const slow = s < B.precisa ? run : 7 - prog(s, B.precisa, B.precisa + 0.8) * 5.5;
  if (s < B.manivela) return slow;
  const crank = 1.5 + prog(s, B.manivela, B.manivela + 0.4) * 4.5 - prog(s, B.minutos, B.aguenta + 0.3) * 4.3;
  return crank;
};
const benchLight = (t: number) => {
  if (t < B.mexer) return 0;
  if (t < B.girar) {
    if (t > B.parou) return 0;
    const v = Math.abs(Math.sin(OMEGA * (t - B.mexer)));
    return prog(t, B.corrente - 0.6, B.corrente) * Math.pow(v, 1.5);
  }
  return Math.min(1, genSpeed(t) / 6.5);
};

// ---------- vale ----------
const V = {
  roda: W("roda", "roda"),
  correnteza: W("roda", "correnteza"),
  gira: W("roda", "gira", 1),
  fraca: W("fraco", "fraca"),
  falha: W("fraco", "falha"),
  muro: W("represa", "muro"),
  gigante: W("represa", "gigante"),
  acumulando: W("represa", "acumulando"),
  esperando: W("represa", "esperando"),
  abre: W("turbina", "abre"),
  tunel: W("turbina", "túnel"),
  despenca: W("turbina", "despenca"),
  turbina: W("turbina", "turbina"),
  gerador: W("turbina", "gerador"),
  cidade: W("longe", "cidade"),
  fio: W("longe", "fio"),
  calor: W("longe", "calor"),
  aumenta: W("tensao", "aumenta"),
  tensao: W("tensao", "tensão"),
  pendura: W("tensao", "pendura"),
  alta: W("tensao", "alta"),
  trafos: W("chegada", "transformadores"),
  baixando: W("chegada", "baixando"),
  tomada: W("chegada", "tomada"),
};
const riverFlow = (s: number) => {
  if (s < V.roda) return 0.9;
  if (s < S("fraco")) return 1;
  if (s < S("represa")) return 0.45 + 0.25 * Math.sin(s * 2.6) - (s > V.falha - 0.2 && s < V.falha + 0.6 ? 0.4 : 0);
  return Math.max(0.12, 0.6 - prog(s, V.muro, V.gigante + 0.8) * 0.5);
};
const wheelSpeed = (s: number) => (s < V.correnteza - 0.3 ? 0 : prog(s, V.correnteza - 0.3, V.correnteza + 0.6) * riverFlow(s) * 1.6);
const turbSpeed = (s: number) => prog(s, V.turbina - 0.4, V.turbina + 0.8) * 7;
const GEN_POS: V3 = [7.0, 0.45, 15];

const SMALL_POLES: V3[] = TOWERS.map(([x, y, z]) => [x - 5, y, z - 4] as V3);
const towerP = (t: number, i: number) => pop(prog(t, V.pendura + i * 0.3, V.pendura + i * 0.3 + 0.5));

const Grid: React.FC<{ t: number; dusk?: boolean }> = ({ t, dusk }) => {
  const thinP = (i: number) => pop(prog(t, V.fio + i * 0.18, V.fio + i * 0.18 + 0.4)) * (1 - prog(t, V.aumenta - 0.2, V.aumenta + 0.4));
  const phases = TOWERS.map((p) => towerPhases(p, 0));
  const yardPh = towerPhases([VALLEY.yard[0] + 1, -6, VALLEY.yard[2]], 0);
  const subPh = towerPhases([CITY.sub[0], -6, CITY.sub[2] - 2], 0);
  const chain = [yardPh, ...phases, subPh];
  const flowOn = dusk ? 1 : prog(t, V.alta - 0.4, V.alta + 0.3);
  const thinPts: V3[] = [[VALLEY.yard[0], 3.6, VALLEY.yard[2]], ...SMALL_POLES.map(([x, , z]) => [x, 3.6, z] as V3)];
  const thinPath: V3[] = thinPts.slice(0, -1).flatMap((a, i) => sag(a, thinPts[i + 1], 0.5, 6).slice(0, -1));
  const heat = prog(t, V.calor - 0.3, V.calor + 0.4);
  return (
    <group>
      {/* fio comum em postes baixos */}
      {SMALL_POLES.map((p, i) => (
        <group key={i} position={p}>
          <Appear p={thinP(i)} from={[0, 3, 0]}>
            <RBox size={[0.25, 4.0, 0.25]} position={[0, 2.0, 0]} color="#8A6440" radius={0.05} />
          </Appear>
        </group>
      ))}
      {thinP(SMALL_POLES.length - 1) > 0.5 ? <Pipe points={thinPath} radius={0.05} color={heat > 0.1 ? "#E05A2B" : "#2E2F33"} emissive="#FF4A1C" emissiveIntensity={heat * 1.2} segments={160} /> : null}
      <FlowParticles points={thinPath.slice(0, Math.floor(thinPath.length / 2))} t={t} count={16} speed={0.5} size={0.18} color={ENERGY} emissive={1.5} visible={thinP(SMALL_POLES.length - 1) > 0.5 ? 1 : 0} />
      <FlowParticles points={thinPath.slice(Math.floor(thinPath.length / 2) - 1)} t={t} count={16} speed={0.5} size={0.12} color="#FF6A2B" emissive={1.5} visible={thinP(SMALL_POLES.length - 1) > 0.5 ? 0.25 + 0.75 * (1 - heat) : 0} />

      {/* subestação elevadora */}
      <Transformer position={VALLEY.yard} p={dusk ? 1 : pop(prog(t, V.tensao - 0.2, V.tensao + 0.4))} glow={flowOn} />
      {/* torres + cabos */}
      {TOWERS.map((p, i) => (
        <Tower key={i} position={p} p={dusk ? 1 : towerP(t, i)} />
      ))}
      {chain.slice(0, -1).map((ph, i) => {
        const ready = dusk ? 1 : i === 0 ? towerP(t, 0) : i >= TOWERS.length ? towerP(t, TOWERS.length - 1) : towerP(t, i);
        if (ready < 0.95) return null;
        return ph.map((a, k) => {
          const b = chain[i + 1][k];
          const pts = sag(i === 0 ? [VALLEY.yard[0] + (k - 1) * 0.7, 3.4, VALLEY.yard[2]] : a, i === chain.length - 2 ? [CITY.sub[0] + (k - 1) * 0.7, 3.4, CITY.sub[2]] : b, 1.4);
          return (
            <group key={`${i}${k}`}>
              <Pipe points={pts} radius={0.07} color="#2E2F33" />
              <FlowParticles points={pts} t={t} count={6} speed={0.7} size={0.16} color={ENERGY} emissive={1.6} visible={flowOn} seed={i * 3 + k} />
            </group>
          );
        });
      })}
    </group>
  );
};

export const Hidreletrica: React.FC = () => {
  const cuts = [S("roda"), S("chegada")];
  return (
    <TimelineCtx.Provider value={TL}>
      <AbsoluteFill style={{ background: "#232741" }}>
        {/* 1–5. BANCADA À NOITE: lâmpada, ímã, bobina, gerador, manivela */}
        <Shot from={0} to={S("roda")} sky={NIGHT} ambient={0.35} sunPower={0.5} exposure={0.8} sun={[4, 10, 8]} shadowSize={8}>
          {(t) => {
            const angle = spin(genSpeed, B.girar - 0.1, t);
            const light = benchLight(t);
            const shaftUp = prog(t, B.prende, B.eixo + 0.2);
            const magnetY = shakeY(t) * (1 - shaftUp);
            const crankAngle = angle;
            return (
              <>
                <Cam
                  from={0}
                  keys={[
                    { t: 0, pos: [0.0, 3.6, 9.4], look: [0.9, 1.2, 0.4], fov: 46 },
                    { t: S("ima"), pos: [-0.2, 3.2, 7.6], look: [0.5, 1.2, 0.3], fov: 46 },
                    { t: B.fio + 0.3, pos: [-0.3, 2.6, 4.6], look: [0.3, 1.55, 0], fov: 46 },
                    { t: B.parou, pos: [-0.1, 2.5, 4.4], look: [0.3, 1.5, 0], fov: 46 },
                    { t: B.eixo, pos: [-0.6, 3.1, 6.0], look: [0.6, 1.4, 0], fov: 46 },
                    { t: E("gerador"), pos: [-0.5, 3.2, 6.6], look: [0.4, 1.3, 0.2], fov: 46 },
                    { t: B.manivela, pos: [-0.3, 3.9, 9.6], look: [1.0, 1.3, 0], fov: 46 },
                    { t: S("roda"), pos: [0.2, 3.4, 8.4], look: [1.4, 1.3, 0], fov: 46 },
                  ]}
                />
                <Workshop />
                <BenchGenerator
                  t={t}
                  magnetY={magnetY}
                  magnetP={pop(prog(t, B.ima - 0.4, B.ima + 0.2))}
                  shaft={pop(prog(t, B.eixo - 0.2, B.eixo + 0.4))}
                  coils={[pop(prog(t, B.fio - 0.2, B.fio + 0.3)), pop(prog(t, B.bobinas - 0.2, B.bobinas + 0.3)), pop(prog(t, B.bobinas + 0.05, B.bobinas + 0.55))]}
                  angle={angle}
                  crank={pop(prog(t, B.manivela - 0.2, B.manivela + 0.3))}
                  base={1}
                  current={light}
                />
                <Lamp position={LAMP_POS} on={light} />
                <Tiao
                  position={t < B.manivela - 0.3 ? [2.3, 0.2, 1.3] : [2.95, 0.2, 0.3]}
                  rotation={t < B.manivela - 0.3 ? -0.9 : -Math.PI / 2}
                  mood={t < S("ima") ? "neutral" : t > B.minutos ? "sad" : t > B.girar + 1 && t < S("cansa") ? "happy" : "neutral"}
                  t={t}
                  look={[-1, -0.3]}
                  sweat={prog(t, B.minutos, B.aguenta)}
                  armROverride={t > B.manivela - 0.3 ? [-(1.3 + 0.45 * Math.sin(crankAngle)), 0, 0.15] : undefined}
                />
              </>
            );
          }}
        </Shot>

        {/* 6–12. O VALE: roda d'água → represa → turbina → linhas */}
        <Shot from={S("roda")} to={S("chegada")} sun={[30, 50, 30]} shadowSize={60}>
          {(t) => {
            const wa = spin(wheelSpeed, V.correnteza - 0.4, t);
            const wheelLight = Math.min(1, wheelSpeed(t) / 1.4) * (t > V.falha - 0.1 && t < V.falha + 0.5 ? 0.1 : 1);
            const penP = pop(prog(t, V.tunel - 0.3, V.tunel + 0.4));
            const ta = spin(turbSpeed, V.turbina - 0.5, t);
            return (
              <>
                <Cam
                  from={S("roda")}
                  keys={[
                    { t: S("roda"), pos: [13, 4.6, 27], look: [5.8, 1.8, 15], fov: 46 },
                    { t: V.correnteza, pos: [11, 3.4, 23], look: [5.6, 1.8, 15], fov: 46 },
                    { t: W("roda", "ímã"), pos: [9.8, 3.0, 20.2], look: [6.4, 1.7, 15], fov: 46 },
                    { t: V.falha, pos: [10.4, 3.2, 21], look: [6.2, 1.7, 15], fov: 46 },
                    { t: S("represa") + 0.4, pos: [12, 6, 30], look: [4, 2, 12], fov: 46 },
                    { t: V.gigante, pos: [10, 18, 62], look: [0, 5, -4], fov: 46 },
                    { t: V.esperando, pos: [6, 24, 54], look: [0, 6, -12], fov: 46 },
                    { t: V.tunel, pos: [-10, 13, 32], look: [0, 6, 2], fov: 46 },
                    { t: V.despenca + 0.3, pos: [-8, 8, 22], look: [0, 4, 4], fov: 46 },
                    { t: V.turbina, pos: [-4.5, 4.6, 17], look: [0, 2.3, 6], fov: 46 },
                    { t: V.gerador, pos: [-4, 6.6, 16.5], look: [0, 4.8, 6], fov: 46 },
                    { t: V.cidade, pos: [-14, 32, -6], look: [14, 0, 72], fov: 46 },
                    { t: V.fio + 0.8, pos: [-4, 18, 14], look: [12, 2, 48], fov: 46 },
                    { t: V.calor, pos: [3, 11, 40], look: [13, 3, 56], fov: 46 },
                    { t: V.aumenta, pos: [16, 13, 34], look: [11, 2.2, 10], fov: 46 },
                    { t: V.tensao, pos: [19, 8, 19], look: [11, 2.2, 8], fov: 46 },
                    { t: V.pendura + 0.6, pos: [-6, 22, 8], look: [16, 6, 50], fov: 46 },
                    { t: S("chegada"), pos: [-10, 28, 14], look: [18, 5, 74], fov: 46 },
                  ]}
                  shake={t > V.muro && t < V.gigante + 0.6 ? 0.02 : 0}
                />
                <Valley t={t} river={riverFlow(t)} dam={prog(t, V.muro - 0.3, V.gigante + 0.8)} reservoir={prog(t, V.acumulando - 0.3, V.esperando + 0.5)} wheelP={pop(prog(t, V.roda - 0.3, V.roda + 0.3))} wheelAngle={wa} />
                {/* gerador da roda d'água na margem */}
                <group position={GEN_POS}>
                  <RBox size={[3.6, 0.45, 2.0]} position={[0.4, -0.25, 0]} color="#7A6A58" radius={0.05} />
                  <BenchGenerator t={t} magnetY={0} shaft={1} coils={[1, 1, 1]} angle={wa * 3} crank={0} base={1} current={wheelLight} />
                  <Lamp position={LAMP_POS} on={wheelLight} light={false} />
                </group>
                <Tiao position={[10.2, 0, 18.2]} rotation={-0.9} mood={t > V.fraca ? "sad" : t > W("roda", "ímã") ? "happy" : "neutral"} t={t} look={[-1, 0]} />
                {/* tubulação forçada */}
                <Appear p={penP} from={[0, 6, 0]}>
                  <Pipe points={VALLEY.penstock} radius={0.95} color="#9FB4C4" opacity={0.55} />
                </Appear>
                <FlowParticles points={VALLEY.penstock} t={t} count={40} speed={0.9} size={0.28} color="#7FD3FF" emissive={0.4} visible={prog(t, V.despenca - 0.3, V.despenca + 0.3)} jitter={0.9} />
                <Powerhouse p={pop(prog(t, V.abre - 0.3, V.abre + 0.4))} turbAngle={ta} genGlow={prog(t, V.gerador - 0.2, V.gerador + 0.4)} t={t} flow={prog(t, V.turbina - 0.4, V.turbina + 0.6)} />
                <Grid t={t} />
                <City lit={0} />
                <PorchHouse position={CITY.house} on={0} />
              </>
            );
          }}
        </Shot>

        {/* 13–15. CIDADE AO ENTARDECER + REVELAÇÃO */}
        <Shot from={S("chegada")} to={TL.duration + 1} sky={DUSK} sun={[-40, 30, 60]} sunPower={1.4} ambient={0.75} shadowSize={80}>
          {(t) => {
            const lit = prog(t, V.baixando - 0.2, V.baixando + 1.4);
            const porch = prog(t, V.tomada - 0.1, V.tomada + 0.2);
            const ta = spin(() => 7, 0, t);
            return (
              <>
                <Cam
                  from={S("chegada")}
                  keys={[
                    { t: S("chegada"), pos: [34, 13, 72], look: [21, 3, 88], fov: 46 },
                    { t: V.trafos + 0.8, pos: [30, 8, 80], look: [20, 3, 89], fov: 46 },
                    { t: V.tomada - 0.6, pos: [17, 4.0, 113], look: [12.6, 2.4, 101], fov: 46 },
                    { t: W("revelacao", "acabou"), pos: [16, 5, 116], look: [12, 2.6, 100], fov: 46 },
                    { t: W("revelacao", "Brasil"), pos: [-10, 32, 172], look: [6, 4, 22], fov: 44 },
                    { t: TL.duration + 1, pos: [-20, 72, 228], look: [6, 0, 40], fov: 40 },
                  ]}
                />
                <Valley t={t} river={0.2} dam={1} reservoir={1} wheelP={1} wheelAngle={t * 0.3} />
                <Pipe points={VALLEY.penstock} radius={0.95} color="#9FB4C4" opacity={0.55} />
                <FlowParticles points={VALLEY.penstock} t={t} count={40} speed={0.9} size={0.28} color="#7FD3FF" emissive={0.4} visible={1} jitter={0.9} />
                <Powerhouse p={1} turbAngle={ta} genGlow={1} t={t} flow={1} />
                <Grid t={t} dusk />
                <Transformer position={CITY.sub} p={pop(prog(t, V.trafos - 0.2, V.trafos + 0.4))} glow={1} scale={1.2} />
                <Pipe points={sag([CITY.sub[0], 3.0, CITY.sub[2]], [CITY.house[0] + 0.1, 2.9, CITY.house[2] + 2.2], 0.8, 12)} radius={0.05} color="#2E2F33" />
                <FlowParticles points={sag([CITY.sub[0], 3.0, CITY.sub[2]], [CITY.house[0] + 0.1, 2.9, CITY.house[2] + 2.2], 0.8, 12)} t={t} count={10} speed={0.7} size={0.12} color={ENERGY} emissive={1.6} visible={prog(t, V.baixando, V.baixando + 0.5)} />
                <City lit={lit} />
                <PorchHouse position={CITY.house} on={porch} />
                <Tiao position={[CITY.house[0] + 1.6, 0, CITY.house[2] + 4.0]} rotation={0.2} mood={porch > 0.5 ? "happy" : "neutral"} pose={t > S("cta") ? "up" : porch > 0.5 ? "wave" : "down"} t={t} look={[0, 0.5]} />
              </>
            );
          }}
        </Shot>

        <Mark kind="q" at={W("gancho", "faria")} until={S("ima")} y={760} />
        <Mark kind="x" at={W("para", "apagou")} until={S("gerador")} y={760} />
        <Mark kind="ok" at={W("gerador", "acesa")} until={S("cansa")} y={760} />
        <Mark kind="x" at={W("cansa", "aguenta")} until={S("roda")} y={760} />
        <Mark kind="ok" at={W("roda", "você", 1)} until={S("fraco")} y={760} />
        <Mark kind="x" at={V.falha} until={S("represa")} y={760} />
        <BigText at={W("longe", "centenas")} until={W("longe", "Num")} text="CENTENAS DE KM" y={1400} color="#FFFFFF" size={100} />
        <Mark kind="x" at={V.calor} until={S("tensao")} y={760} />
        <BigText at={V.tensao} until={V.pendura} text="ALTA TENSÃO" y={1400} color={ENERGY} size={120} />
        <Mark kind="ok" at={W("tensao", "pequena")} until={S("chegada")} y={760} />
        <Finish />
        <Flash at={cuts} />
        <TopLabel />
        <Captions />
        <CTA at={S("cta")} />
        <Audio src={staticFile("hidreletrica/narracao.wav")} />
        <Audio src={staticFile("hidreletrica/trilha.wav")} volume={0.9} />
      </AbsoluteFill>
    </TimelineCtx.Provider>
  );
};

export const hidreletricaDuration = (fps: number) => Math.ceil((TL.duration + 0.8) * fps);
