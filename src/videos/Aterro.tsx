import { AbsoluteFill, Audio, staticFile } from "remotion";
import { BigText, Captions, CTA, Finish, Flash, Mark, TopLabel } from "../engine/Overlays";
import { Cam, Shot } from "../engine/Shot";
import { cena, prog, Timeline, TimelineCtx, wordAt } from "../engine/timeline";
import { Boom, Cap, Compactor, Critters, Drains, Fill, Finds, Gas, GasWells, Ground, H, Layer, Leak, Liner, Litter, Pebbles, Pool, Stink, Town, Truck, Well, xr } from "../three/Aterro";
import { Rain } from "../three/Bunker";
import { Tiao } from "../three/Tiao";
import { ease } from "../theme";
import timelineJson from "../../public/aterro/timeline.json";

const TL = timelineJson as Timeline;
const S = (id: string) => cena(TL, id).start;
const E = (id: string) => cena(TL, id).end;
const W = (id: string, w: string, nth = 0) => wordAt(TL, id, w, nth);
const SKY: [string, string] = ["#6EBDE8", "#CFEAF6"];

const A = {
  buraco: W("gancho", "buraco"),
  despejar: W("gancho", "despejar"),
  aterro: W("gancho", "aterro"),
  ratos: W("ratos", "ratos"),
  cheiro: W("ratos", "cheiro"),
  casas: W("ratos", "casas"),
  camada: W("cobertura", "camada"),
  bichos: W("cobertura", "bichos"),
  comida: W("cobertura", "comida"),
  espaco: W("lota", "espaço"),
  lota: W("lota", "lota"),
  voar: W("lota", "voar"),
  estrada: W("lota", "estrada"),
  passa: W("compactador", "passa"),
  esmaga: W("compactador", "esmaga"),
  compacta: W("compactador", "compacta"),
  chove: W("chorume", "chove"),
  escorre: W("chorume", "escorre"),
  poco: W("chorume", "poço"),
  vizinho: W("chorume", "vizinho"),
  forra: W("manta", "forra"),
  argila: W("manta", "argila"),
  lona: W("manta", "lona"),
  mantaW: W("manta", "manta"),
  ir: W("banheira", "ir"),
  enchendo: W("banheira", "enchendo"),
  transbordar: W("banheira", "transbordar"),
  canos: W("drenos", "canos"),
  brita: W("drenos", "brita"),
  bomba: W("drenos", "bomba"),
  tratado: W("drenos", "tratado"),
  apodrece: W("gas", "apodrece"),
  gas: W("gas", "gás"),
  fogo: W("gas", "fogo"),
  escapa: W("gas", "escapa"),
  casas2: W("gas", "casas"),
  faisca: W("gas", "faísca"),
  explodir: W("gas", "explodir"),
  crava: W("poco", "crava"),
  queima: W("poco", "queima"),
  pocoW: W("poco", "poço"),
  toa: W("usina", "toa"),
  motores: W("usina", "motores"),
  energia: W("usina", "energia"),
  curioso: W("conserva", "curioso"),
  pote: W("conserva", "pote"),
  jornal: W("conserva", "jornal"),
  ler: W("conserva", "ler"),
  plastico: W("tampa", "plástico"),
  grama: W("tampa", "grama"),
  sanitario: W("revelacao", "sanitário"),
};

const stack = (base: number, items: { kind: Layer["kind"]; th: number }[]): Layer[] => {
  let y = base;
  const out: Layer[] = [];
  for (const it of items) {
    if (it.th <= 0.001) continue;
    out.push({ kind: it.kind, y0: y, y1: y + it.th });
    y += it.th;
  }
  return out;
};

const world = (t: number) => {
  const phase2 = t >= S("manta");
  let layers: Layer[];
  let squash = 1;
  if (!phase2) {
    squash = 1 - 0.45 * prog(t, A.passa, A.compacta + 0.6);
    layers = stack(H.inDepth, [
      { kind: "trash", th: 1.3 * squash * prog(t, A.despejar - 0.3, A.aterro + 0.4, ease.out) },
      { kind: "soil", th: 0.22 * prog(t, A.camada - 0.3, A.camada + 0.6) },
      { kind: "trash", th: 1.0 * squash * prog(t, S("lota"), A.espaco + 0.2) },
      { kind: "soil", th: 0.2 * prog(t, A.espaco, A.lota) },
      { kind: "trash", th: 1.0 * squash * prog(t, A.lota - 0.2, A.lota + 0.6) },
      { kind: "trash", th: 0.55 * squash * prog(t, A.lota + 0.4, A.voar) * (1 - prog(t, A.passa, A.compacta)) },
    ]);
  } else {
    const gravel = 0.32 * prog(t, A.brita - 0.3, A.brita + 0.5);
    layers = stack(H.inDepth, [
      { kind: "gravel", th: gravel },
      { kind: "trash", th: 1.25 * prog(t, S("banheira") - 0.2, A.ir + 0.2) },
      { kind: "soil", th: 0.2 * prog(t, A.ir, A.ir + 0.5) },
      { kind: "trash", th: 1.0 * prog(t, A.ir + 0.3, A.enchendo + 0.3) },
      { kind: "soil", th: 0.2 * prog(t, S("gas"), S("gas") + 0.6) },
      { kind: "trash", th: 0.3 * prog(t, S("gas") + 0.3, A.apodrece + 0.3) },
    ]);
  }
  const top = layers.length ? layers[layers.length - 1].y1 : H.inDepth;
  const gravelTop = phase2 && layers[0]?.kind === "gravel" ? layers[0].y1 : H.inDepth;
  const pool = phase2 ? Math.min(0.1, H.inDepth + (0.1 - H.inDepth) * prog(t, A.ir - 0.2, A.transbordar)) * (1 - prog(t, A.bomba, E("drenos") + 0.2)) + H.inDepth * prog(t, A.bomba, E("drenos") + 0.2) : H.inDepth;
  const overflow = prog(t, A.transbordar - 0.5, A.transbordar) * (1 - prog(t, S("drenos"), A.canos));
  return { phase2, layers, squash, top, gravelTop, pool, overflow };
};

export const LandfillScene: React.FC<{ t: number }> = ({ t }) => {
  const w = world(t);
  const liner = w.phase2 ? prog(t, A.forra - 0.2, A.lona + 0.4, ease.out) : 0;
  const rain = Math.max(prog(t, A.chove - 0.6, A.chove) * (1 - prog(t, E("chorume") - 0.3, S("manta") + 0.3)), prog(t, S("banheira"), A.ir) * (1 - prog(t, A.transbordar + 0.5, E("banheira"))));
  const critters = prog(t, A.ratos - 0.4, A.ratos + 0.3) * (t < S("lota") ? 1 : 0);
  const flee = prog(t, A.bichos - 0.4, A.comida);
  const stink = prog(t, A.cheiro - 0.5, A.casas) * (1 - prog(t, A.comida, E("cobertura")));
  const litter = prog(t, A.voar - 0.5, A.estrada) * (1 - prog(t, S("compactador"), S("compactador") + 0.6));
  const comp = t > S("compactador") - 0.3 && t < E("compactador") + 0.2;
  const cp = prog(t, S("compactador"), E("compactador"), (u) => u);
  const tri = cp < 0.5 ? cp * 2 : 2 - cp * 2;
  const leak = prog(t, A.escorre - 0.3, A.escorre + 0.8) * (t < S("manta") ? 1 : 0);
  const dirty = prog(t, A.poco - 0.6, A.vizinho + 0.3) * (1 - prog(t, S("manta"), S("manta") + 0.4));
  const drains = prog(t, A.canos - 0.3, A.canos + 0.6, ease.out);
  const dflow = prog(t, A.bomba - 0.3, A.bomba + 0.3) * (1 - 0.6 * prog(t, S("gas"), S("gas") + 1));
  const bubbles = prog(t, A.apodrece - 0.3, A.gas + 0.3);
  const migrate = prog(t, A.escapa - 0.3, A.casas2) * (1 - prog(t, S("poco"), S("poco") + 0.6));
  const boom = t < S("poco") ? prog(t, A.explodir - 0.15, A.explodir + 1.3, (u) => u) : 0;
  const wells = prog(t, A.crava - 0.3, A.crava + 1.0, ease.out);
  const toEngine = prog(t, A.motores - 0.3, A.motores + 0.5);
  const flare = prog(t, A.queima - 0.3, A.queima + 0.3) * (1 - 0.85 * toEngine);
  const lit = prog(t, A.energia - 0.5, A.energia + 0.3);
  const finds = prog(t, A.pote - 0.4, A.pote + 0.2, ease.out) * (1 - prog(t, S("tampa"), S("tampa") + 0.5));
  const cap = prog(t, A.plastico - 0.4, A.grama + 0.4);
  const truckIn = t < E("gancho") + 0.3;
  const mood =
    (t > A.cheiro - 0.3 && t < A.comida) || (t > A.voar - 0.3 && t < S("compactador")) || (t > A.poco - 0.5 && t < S("manta")) || (t > A.transbordar - 0.4 && t < A.bomba)
      ? "sad"
      : t > A.faisca - 0.3 && t < S("poco")
        ? "shock"
        : t > A.sanitario - 0.3 || (t > A.energia && t < S("conserva"))
          ? "happy"
          : "neutral";
  return (
    <group>
      <Ground />
      <Pebbles />
      <Liner p={liner} />
      <Fill layers={w.layers} squash={w.squash} topTrash={cap < 0.3} />
      <Pool level={w.pool} base={w.gravelTop} />
      {w.overflow > 0.01 ? (
        <group>
          {[-1, 1].map((k) => (
            <mesh key={k} position={[k * (xr(0) + 0.5), 0.06, -2.5]} scale={[1.2 * w.overflow, 1, 3 * w.overflow]}>
              <cylinderGeometry args={[1, 1, 0.05, 20]} />
              <meshStandardMaterial color="#3B2414" transparent opacity={0.8} />
            </mesh>
          ))}
        </group>
      ) : null}
      <Drains p={drains} t={t} flow={dflow} base={w.gravelTop - 0.32} />
      <Gas t={t} bubbles={bubbles} migrate={migrate} top={w.top} />
      <GasWells p={wells} t={t} flare={flare} toEngine={toEngine} top={Math.max(w.top, 0)} />
      <Cap p={cap} />
      <Finds p={finds} y={H.inDepth + 1.0} />
      <Critters t={t} p={critters} y={w.top} flee={flee} />
      <Stink t={t} amount={stink} />
      <Litter t={t} amount={litter} />
      <Leak t={t} amount={leak} />
      <Well dirty={dirty} />
      <Town t={t} lit={lit} boom={boom} />
      <Boom p={boom} position={[-9.6, 0, -2.6]} />
      {comp ? <Compactor x={(xr(w.top) - 1.4) * (1 - 2 * tri)} y={w.top} z={-3.2} t={t} dir={cp < 0.5 ? -1 : 1} /> : null}
      {truckIn ? <Truck x={6.4} tilt={0.65 * prog(t, A.despejar - 0.6, A.despejar + 0.2)} t={t} dump={prog(t, A.despejar - 0.2, A.despejar + 0.2) * (1 - prog(t, A.aterro + 0.4, E("gancho")))} /> : null}
      <Tiao position={[-7.6, 0.02, -1.0]} rotation={0.5} scale={0.85} mood={mood} pose={t > S("cta") ? "wave" : t > A.sanitario ? "up" : "down"} t={t} />
      <Rain t={t} amount={rain} x0={-10} x1={8} z0={-8} z1={1} top={9} />
    </group>
  );
};

const ov = (dx = 0, dy = 0, dz = 0, fov = 48) => ({ pos: [0 + dx, 1.4 + dy, 16.5 + dz] as [number, number, number], look: [0 + dx * 0.8, -1.3 + dy * 0.6, -2] as [number, number, number], fov });

export const Aterro: React.FC = () => {
  const cuts = [S("manta"), S("drenos"), S("poco"), S("conserva"), S("tampa")];
  return (
    <TimelineCtx.Provider value={TL}>
      <AbsoluteFill style={{ background: SKY[1] }}>
        <Shot from={0} to={TL.duration + 1} sky={SKY} sun={[6, 14, 9]} shadowSize={22}>
          {(t) => {
            const shake = t > A.explodir - 0.1 && t < A.explodir + 0.7 ? 0.06 : t > A.passa && t < A.compacta + 0.5 ? 0.012 : 0;
            return (
              <>
                <Cam
                  from={0}
                  shake={shake}
                  keys={[
                    { t: 0, pos: [5.5, 8.0, 12.0], look: [1.0, -1.0, -3.0], fov: 46 },
                    { t: A.despejar, pos: [4.0, 5.5, 13.5], look: [1.5, -1.2, -2.5], fov: 46 },
                    { t: A.aterro, ...ov(0, 0.4, 0) },
                    { t: S("ratos"), pos: [-0.5, 1.8, 9.5], look: [-0.5, -0.6, -2.5], fov: 46 },
                    { t: A.cheiro, pos: [-5.5, 2.2, 12.5], look: [-6.5, 0.2, -2.5], fov: 46 },
                    { t: S("cobertura"), ...ov(0, 0.6, -1) },
                    { t: A.comida, ...ov(0, 0.3, 0) },
                    { t: S("lota"), ...ov(0, 0.5, 0) },
                    { t: A.voar, pos: [-4.5, 2.6, 14.0], look: [-5.0, 0.4, -3.0], fov: 48 },
                    { t: S("compactador"), pos: [3.0, 3.6, 12.0], look: [0.5, 0.0, -3.0], fov: 46 },
                    { t: A.compacta, ...ov(0, 0.4, 0) },
                    { t: S("chorume"), ...ov(-2.0, 0.2, 0.5) },
                    { t: A.escorre, pos: [-3.0, -1.0, 13.5], look: [-3.2, -2.9, -1.0], fov: 48 },
                    { t: A.vizinho, pos: [-4.5, -1.2, 12.0], look: [-5.0, -2.8, -1.0], fov: 46 },
                    { t: S("manta"), ...ov(0, -0.4, -1.0) },
                    { t: A.mantaW, ...ov(0, 0, 0) },
                    { t: S("banheira"), ...ov(0, 0.2, 0) },
                    { t: S("drenos"), pos: [1.0, -0.8, 12.0], look: [1.0, -2.4, -1.0], fov: 48 },
                    { t: A.bomba, ...ov(2.2, 0.6, 1.0) },
                    { t: S("gas"), ...ov(0, 0.2, 0) },
                    { t: A.escapa, pos: [-5.0, 0.8, 15.0], look: [-6.0, -0.4, -2.0], fov: 48 },
                    { t: A.explodir + 1.5, pos: [-5.5, 1.5, 16.5], look: [-6.5, 0.0, -2.0], fov: 50 },
                    { t: S("poco"), pos: [2.0, 2.4, 16.0], look: [1.8, 0.4, -2.2], fov: 48 },
                    { t: A.queima, pos: [3.2, 3.0, 16.5], look: [3.0, 1.4, -2.5], fov: 48 },
                    { t: S("usina"), pos: [4.0, 3.4, 16.5], look: [4.0, 1.4, -3.0], fov: 48 },
                    { t: A.motores, pos: [6.0, 3.2, 15.5], look: [6.2, 1.2, -3.5], fov: 48 },
                    { t: A.energia - 0.3, pos: [-1.0, 5.5, 21.0], look: [-1.5, 1.2, -3.5], fov: 52 },
                    { t: E("usina"), pos: [-5.5, 3.8, 17.0], look: [-7.5, 0.6, -3.0], fov: 50 },
                    { t: S("conserva"), ...ov(0, -0.6, -3.0) },
                    { t: A.pote, pos: [0.0, -2.2, 5.0], look: [0.0, -2.3, 0.0], fov: 42 },
                    { t: A.ler, pos: [-0.3, -2.25, 3.8], look: [-0.3, -2.3, 0.0], fov: 40 },
                    { t: S("tampa"), ...ov(0, 1.0, 1.0) },
                    { t: S("revelacao"), pos: [-2.0, 5.5, 22.0], look: [-1.5, -0.8, -3.0], fov: 52 },
                    { t: TL.duration + 1, pos: [-2.0, 6.5, 24.0], look: [-1.5, -0.8, -3.0], fov: 52 },
                  ]}
                />
                <LandfillScene t={t} />
              </>
            );
          }}
        </Shot>

        <Mark kind="ok" at={A.aterro} until={S("ratos")} y={760} />
        <Mark kind="x" at={A.casas} until={S("cobertura")} y={760} />
        <Mark kind="ok" at={A.comida} until={S("lota")} y={760} />
        <Mark kind="x" at={A.estrada} until={S("compactador")} y={760} />
        <Mark kind="ok" at={A.compacta} until={S("chorume")} y={760} />
        <Mark kind="x" at={A.vizinho} until={S("manta")} y={760} />
        <Mark kind="ok" at={A.mantaW} until={S("banheira")} y={760} />
        <Mark kind="x" at={A.transbordar} until={S("drenos")} y={760} />
        <Mark kind="ok" at={A.tratado} until={S("gas")} y={760} />
        <Mark kind="x" at={A.explodir + 0.6} until={S("poco")} y={760} />
        <Mark kind="ok" at={A.pocoW} until={S("usina")} y={760} />
        <Mark kind="x" at={A.toa} until={A.motores} y={760} />
        <Mark kind="ok" at={A.energia} until={S("conserva")} y={760} />
        <BigText at={A.jornal} until={E("conserva")} text="JORNAL DE DÉCADAS" y={1380} color="#FFD23F" size={100} />
        <Finish />
        <Flash at={cuts} />
        <TopLabel />
        <Captions />
        <CTA at={S("cta")} />
        <Audio src={staticFile("aterro/narracao.wav")} />
        <Audio src={staticFile("aterro/trilha.wav")} volume={0.9} />
      </AbsoluteFill>
    </TimelineCtx.Provider>
  );
};

export const aterroDuration = (fps: number) => Math.ceil((TL.duration + 0.8) * fps);
