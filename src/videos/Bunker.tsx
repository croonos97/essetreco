import { AbsoluteFill, Audio, staticFile } from "remotion";
import { BigText, Captions, CTA, Finish, Flash, Mark, TopLabel } from "../engine/Overlays";
import { Cam, Shot } from "../engine/Shot";
import { cena, prog, Timeline, TimelineCtx, wordAt } from "../engine/timeline";
import {
  ArchFill,
  ArchFlow,
  archInner,
  Collapse,
  Crack,
  Earth,
  FallingTree,
  Flood,
  G,
  Hatch,
  Hole,
  Interior,
  Ladder,
  LoadArrows,
  Pebbles,
  Rain,
  Rebar,
  Seep,
  Shaft,
  Shell,
  Shovel,
  Tunnel,
  Vents,
  Yard,
} from "../three/Bunker";
import { Tiao } from "../three/Tiao";
import { ease } from "../theme";
import timelineJson from "../../public/bunker/timeline.json";

const TL = timelineJson as Timeline;
const S = (id: string) => cena(TL, id).start;
const E = (id: string) => cena(TL, id).end;
const W = (id: string, w: string, nth = 0) => wordAt(TL, id, w, nth);
const SKY: [string, string] = ["#6EBDE8", "#CFEAF6"];

const A = {
  buraco: W("gancho", "buraco"),
  esconder: W("gancho", "esconder"),
  abrigo: W("gancho", "abrigo"),
  chuva: W("desaba", "chuva"),
  cedem: W("desaba", "cedem"),
  desabam: W("desaba", "desabam"),
  ergue: W("caixa", "ergue"),
  ferro: W("caixa", "ferro"),
  armado: W("caixa", "armado"),
  metro: W("peso", "metro"),
  toneladas: W("peso", "toneladas"),
  teto: W("peso", "teto"),
  trincar: W("trinca", "trincar"),
  ceder: W("trinca", "ceder"),
  arco: W("abobada", "arco"),
  aguenta: W("abobada", "aguenta"),
  laterais: W("abobada", "laterais"),
  paredes: W("abobada", "paredes"),
  abobada: W("abobada", "abóbada"),
  atravessa: W("pinga", "atravessa"),
  pingar: W("pinga", "pingar"),
  envolve: W("manta", "envolve"),
  borracha: W("manta", "borracha"),
  acabando: W("vela", "acabando"),
  sumir: W("vela", "sumir"),
  canos: W("respiros", "canos"),
  entra: W("respiros", "entra"),
  filtro: W("respiros", "filtro"),
  sai: W("respiros", "sai"),
  entrada: W("enxurrada", "entrada"),
  enxurrada: W("enxurrada", "enxurrada"),
  abaixo: W("enxurrada", "abaixo"),
  sobe: W("escotilha", "sobe"),
  chao: W("escotilha", "chão"),
  fecha: W("escotilha", "fecha"),
  escotilha: W("escotilha", "escotilha"),
  arvore: W("arvore", "árvore"),
  cair: W("arvore", "cair"),
  escotilha2: W("arvore", "escotilha"),
  trancado: W("arvore", "trancado"),
  tunel: W("saida", "túnel"),
  quintal: W("saida", "quintal"),
  emergencia: W("saida", "emergência"),
  bunker: W("revelacao", "bunker"),
};

const mid = (G.shaftX0 + G.shaftX1) / 2;

// Estado do mundo em função do tempo.
const world = (t: number) => {
  const pit = t < S("caixa");
  const arch = t >= A.arco - 0.05;
  const build = pit ? 0 : prog(t, A.ferro + 0.5, A.armado + 0.2, ease.out);
  const rebar = pit ? 0 : prog(t, A.ergue - 0.2, A.ferro + 0.3, ease.out);
  const rain =
    Math.max(
      prog(t, A.chuva - 0.4, A.chuva) * (1 - prog(t, E("desaba"), S("caixa"))),
      prog(t, S("pinga"), A.atravessa - 0.2) * (1 - prog(t, A.envolve, A.borracha)),
      prog(t, A.entrada, A.enxurrada - 0.3) * (1 - prog(t, A.escotilha, E("escotilha"))),
    );
  const sag = arch ? 0 : 0.11 * prog(t, A.trincar - 0.1, A.ceder + 0.3, ease.in);
  const crack = arch ? 0 : prog(t, A.trincar - 0.2, A.ceder);
  const manta = prog(t, A.envolve - 0.2, A.borracha + 0.5);
  const seep = prog(t, A.atravessa - 0.3, A.atravessa + 0.4) * (1 - prog(t, A.envolve + 0.3, A.borracha));
  const flame = t < S("vela") ? 1 : t < S("respiros") ? 1 - prog(t, A.acabando - 0.2, A.sumir + 0.2) : prog(t, A.entra, A.entra + 0.8);
  const haze = t < S("vela") ? 0 : t < S("respiros") ? prog(t, A.acabando - 0.4, A.sumir) : 1 - prog(t, A.sai, A.sai + 1.5);
  const vents = prog(t, A.canos - 0.2, A.canos + 0.9, ease.out);
  const flow = prog(t, A.entra - 0.3, A.entra + 0.2);
  const flood = prog(t, A.enxurrada - 0.4, A.enxurrada + 0.2) * (1 - prog(t, S("escotilha"), S("escotilha") + 0.6));
  const level = 0.3 * prog(t, A.enxurrada, E("enxurrada")) * (1 - prog(t, S("escotilha") + 0.3, A.fecha));
  const collar = 0.5 * prog(t, A.sobe - 0.2, A.chao + 0.2, ease.out);
  const hatchOn = t >= A.sobe;
  const hatchOpen = 1 - prog(t, A.fecha - 0.1, A.fecha + 0.5, ease.in);
  const fall = prog(t, A.cair - 0.2, A.escotilha2 + 0.1, ease.in);
  const hatchShake = t > A.trancado - 0.3 && t < E("arvore") ? 1 : 0;
  const tunnel = prog(t, A.tunel - 0.3, A.quintal + 0.3);
  const holes: Hole[] = pit
    ? [{ x0: -1.7, x1: 1.7, y0: -2.3 * prog(t, 0.2, A.buraco + 0.8, ease.out) - 0.001, y1: 0.01, d: 2.6 }]
    : [
        { x0: -G.xo, x1: G.xo, y0: G.floorBot - (manta > 0 ? 0.07 : 0), y1: G.roofTop, d: G.D + (manta > 0 ? 0.07 : 0) },
        { x0: G.shaftX0, x1: G.shaftX1, y0: G.roofTop - 0.01, y1: 0.01, d: -G.shaftZ },
        ...(vents > 0
          ? [
              { x0: G.pipeIn - 0.13, x1: G.pipeIn + 0.13, y0: G.roofTop - 0.2, y1: 0.01, d: 0.5 },
              { x0: G.pipeOut - 0.13, x1: G.pipeOut + 0.13, y0: G.roofTop - 0.2, y1: 0.01, d: 0.5 },
            ]
          : []),
        ...(tunnel > 0
          ? [
              { x0: G.xo - 0.01, x1: G.xo + (G.tunX1 - G.tunX0) * Math.min(1, tunnel * 1.4), y0: G.tunY0 - 0.14, y1: G.tunY1 + 0.14, d: -G.tunZ },
              ...(tunnel > 0.7 ? [{ x0: G.exitX0, x1: G.exitX1, y0: G.tunY1, y1: 0.01, d: -G.tunZ }] : []),
            ]
          : []),
      ];
  return { pit, arch, build, rebar, rain, sag, crack, manta, seep, flame, haze, vents, flow, flood, level, collar, hatchOn, hatchOpen, fall, hatchShake, tunnel, holes };
};

export const BunkerScene: React.FC<{ t: number }> = ({ t }) => {
  const w = world(t);
  const tiaoIn = !w.pit && t >= A.armado - 0.2;
  // Tião: dentro do buraco no começo, depois dentro do bunker, depois foge pelo túnel
  const digging = t < A.esconder - 0.2;
  const hop = prog(t, A.esconder - 0.2, A.esconder + 0.5, ease.inOut);
  const pitY = -2.3 * prog(t, 0.2, A.buraco + 0.8, ease.out);
  const crawl = prog(t, A.tunel, A.quintal + 0.4);
  const climb = prog(t, A.emergencia - 0.6, S("revelacao") + 0.3, ease.out);
  let tiao: { pos: [number, number, number]; rot: number; mood: "neutral" | "happy" | "shock" | "sad"; pose: "down" | "up" | "wave" | "point"; scale: number; sit?: number } = {
    pos: [0, 0, -1.2],
    rot: 0,
    mood: "neutral",
    pose: "down",
    scale: 0.85,
  };
  if (w.pit) {
    const y = digging ? 0 : pitY * hop;
    const x = digging ? 2.4 : 2.4 - 2.4 * hop;
    tiao = { pos: [x, y + Math.sin(hop * Math.PI) * 0.9, -1.2], rot: digging ? -0.5 : 0.2, mood: t > A.cedem - 0.2 ? "shock" : t > A.abrigo ? "happy" : "neutral", pose: t > A.cedem - 0.2 ? "up" : "down", scale: 0.85 };
  } else if (tiaoIn) {
    if (t < A.tunel) {
      const sad = (t > A.acabando && t < A.entra) || (t > A.enxurrada && t < A.fecha) || (t > A.trincar && t < A.arco) || (t > A.pingar && t < A.borracha) || (t > A.trancado - 0.2);
      const atLadder = t > A.cair - 0.4;
      tiao = {
        pos: atLadder ? [mid + 0.75, G.floor, -0.95] : [-0.75, G.floor, -1.15],
        rot: atLadder ? -0.9 : 0.35,
        mood: sad ? (t > A.enxurrada && t < A.fecha ? "shock" : "sad") : "neutral",
        pose: atLadder && t > A.trancado - 0.3 ? "up" : "down",
        scale: 0.85,
      };
    } else if (t < A.emergencia - 0.6) {
      const x = 1.2 + crawl * (G.exitX0 + 0.55 - 1.2);
      tiao = { pos: [x, G.floor, -0.6], rot: Math.PI / 2, mood: "neutral", pose: "down", scale: 0.6 };
    } else {
      tiao = { pos: [(G.exitX0 + G.exitX1) / 2, G.tunY0 + (0.15 - G.tunY0) * climb, -0.6], rot: 0.2, mood: "happy", pose: t > S("revelacao") ? (t > S("cta") ? "wave" : "up") : "down", scale: 0.75 };
    }
  }
  const archCracks = prog(t, A.atravessa - 0.2, A.pingar) * (1 - prog(t, A.borracha, A.borracha + 0.8));
  return (
    <group>
      <Earth holes={w.holes} />
      <Pebbles holes={w.holes.filter((h) => h.y1 < 0.5 && h.d > 0.6)} />
      <Yard t={t} />
      {w.pit ? (
        <>
          <Shovel position={[2.9, 0.2, -1.6]} />
          <Collapse p={prog(t, A.cedem - 0.3, A.desabam + 0.6, ease.in)} />
        </>
      ) : null}
      <Rebar p={w.rebar * (1 - prog(t, A.armado, A.armado + 0.3))} />
      {!w.pit ? (
        <group>
          {w.arch ? <ArchFill /> : null}
          <Shell build={w.build} arch={w.arch} sag={w.sag} crack={w.crack} manta={w.manta} />
          <Shaft arch={w.arch} collar={w.collar} p={w.build > 0.9 ? 1 : 0} />
          {w.build > 0.9 ? <Ladder top={w.collar} /> : null}
          {w.hatchOn ? <Hatch collar={w.collar} open={w.hatchOpen} shake={w.hatchShake} t={t} /> : null}
          {w.build > 0.85 ? <Interior t={t} flame={w.flame} haze={w.haze} arch={w.arch} /> : null}
          <Vents t={t} p={w.vents} flow={w.flow} arch={w.arch} />
          <Seep t={t} amount={w.seep} arch={w.arch} />
          {w.arch ? (
            <>
              <Crack p={archCracks} points={[[-0.4, archInner(-0.4)], [-0.3, archInner(-0.4) + 0.12], [-0.42, archInner(-0.4) + 0.24]]} />
              <Crack p={archCracks} points={[[0.55, archInner(0.55)], [0.65, archInner(0.55) + 0.12], [0.52, archInner(0.55) + 0.25]]} />
              <Crack p={archCracks} points={[[1.25, archInner(1.25)], [1.18, archInner(1.25) + 0.13], [1.3, archInner(1.25) + 0.24]]} />
            </>
          ) : null}
          <Flood t={t} amount={w.flood} level={w.level} />
          <Tunnel p={w.tunnel} />
          <LoadArrows p={prog(t, A.metro - 0.2, A.metro + 0.4) * (1 - prog(t, A.arco - 0.3, A.arco + 0.2))} t={t} />
          <ArchFlow t={t} p={prog(t, A.laterais - 0.8, A.laterais) * (1 - prog(t, E("abobada") - 0.4, E("abobada")))} />
        </group>
      ) : null}
      {t > A.cair - 1.5 ? <FallingTree fall={w.fall} position={[-4.05, 0, -0.75]} /> : null}
      {w.pit || tiaoIn ? (
        <Tiao position={tiao.pos} rotation={tiao.rot} scale={tiao.scale} mood={tiao.mood} pose={tiao.pose} t={t} armROverride={w.pit && digging ? [-0.8 + Math.sin(t * 7) * 0.5, 0, -0.3] : undefined} />
      ) : null}
      <Rain t={t} amount={w.rain} />
    </group>
  );
};

// Câmera de corte padrão (enquadra superfície + bunker).
const ov = (dx = 0, dy = 0, dz = 0, fov = 46) => ({ pos: [0.5 + dx, -0.6 + dy, 12.8 + dz] as [number, number, number], look: [0.5 + dx * 0.6, -1.9 + dy * 0.7, -1.2] as [number, number, number], fov });
const room = (dx = 0, dz = 0, fov = 44) => ({ pos: [0.2 + dx, -2.5, 6.6 + dz] as [number, number, number], look: [0.0 + dx * 0.5, -2.6, -1.6] as [number, number, number], fov });

export const Bunker: React.FC = () => {
  const cuts = [S("caixa"), S("abobada"), S("respiros"), S("escotilha"), S("saida")];
  return (
    <TimelineCtx.Provider value={TL}>
      <AbsoluteFill style={{ background: SKY[1] }}>
        <Shot from={0} to={TL.duration + 1} sky={SKY} sun={[7, 14, 9]} shadowSize={16}>
          {(t) => {
            const w = world(t);
            const shake = (t > A.desabam - 0.4 && t < A.desabam + 0.5 ? 0.03 : 0) + (t > A.ceder - 0.2 && t < A.ceder + 0.5 ? 0.02 : 0) + (t > A.escotilha2 && t < A.escotilha2 + 0.4 ? 0.04 : 0);
            return (
              <>
                <Cam
                  from={0}
                  shake={shake}
                  keys={[
                    { t: 0, pos: [6.9, 5.6, 9.4], look: [1.6, -0.4, -1.6], fov: 44 },
                    { t: A.buraco + 0.4, pos: [4.0, 3.4, 7.8], look: [0.2, -0.8, -1.4], fov: 44 },
                    { t: A.abrigo, pos: [1.2, 0.6, 8.8], look: [0.0, -1.0, -1.2], fov: 46 },
                    { t: A.cedem, pos: [0.8, 0.2, 7.6], look: [0.0, -1.2, -1.2], fov: 46 },
                    { t: S("caixa"), ...ov(0, 0.8, -0.8) },
                    { t: A.ferro + 0.3, ...ov(0.2, -0.3, -1.6, 44) },
                    { t: A.armado + 0.4, ...ov() },
                    { t: A.metro, ...ov(0, 0.6, -0.6) },
                    { t: A.teto, ...ov(0, 0.3, -1.2) },
                    { t: A.trincar, pos: [0.3, -1.1, 6.4], look: [0.2, -1.6, -1.0], fov: 44 },
                    { t: S("abobada"), pos: [0.3, -1.1, 6.6], look: [0.2, -1.7, -1.0], fov: 44 },
                    { t: A.laterais, ...ov(0, 0, -0.6) },
                    { t: S("pinga"), ...ov(0, 0.6, 0) },
                    { t: A.pingar, ...room(0.3, 0.4) },
                    { t: S("manta"), ...ov(1.2, -0.4, 1.0) },
                    { t: A.borracha + 0.4, ...ov() },
                    { t: S("vela"), ...room(0.3, -0.6, 42) },
                    { t: A.sumir, pos: [0.4, -2.85, 3.6], look: [0.25, -2.85, -1.85], fov: 40 },
                    { t: S("respiros"), ...ov(0.3, 0.3, -0.8) },
                    { t: A.filtro, pos: [1.5, -2.6, 5.6], look: [1.1, -2.9, -0.6], fov: 42 },
                    { t: A.sai, ...ov(0.4, 0.6, -0.6) },
                    { t: S("enxurrada"), ...ov(-0.4, 0.8, -0.4) },
                    { t: A.abaixo, pos: [-0.6, -1.4, 7.6], look: [-0.9, -2.0, -1.0], fov: 44 },
                    { t: S("escotilha"), pos: [-1.0, 1.6, 7.4], look: [-1.2, -0.4, -1.2], fov: 44 },
                    { t: A.escotilha, pos: [-1.0, 1.2, 6.6], look: [-1.3, -0.1, -1.0], fov: 42 },
                    { t: S("arvore"), pos: [-1.6, 1.4, 9.0], look: [-1.6, 0.2, -1.2], fov: 46 },
                    { t: A.trancado, ...ov(-0.6, 0.2, -1.0) },
                    { t: S("saida"), pos: [2.6, -0.8, 13.8], look: [2.6, -2.0, -1.2], fov: 48 },
                    { t: A.emergencia, pos: [3.2, -0.6, 14.6], look: [3.2, -1.8, -1.2], fov: 48 },
                    { t: S("revelacao"), pos: [2.2, 0.2, 18.0], look: [2.2, -1.7, -1.2], fov: 48 },
                    { t: TL.duration + 1, pos: [2.2, 0.6, 19.5], look: [2.2, -1.6, -1.2], fov: 48 },
                  ]}
                />
                <BunkerScene t={t} />
              </>
            );
          }}
        </Shot>

        <Mark kind="ok" at={A.abrigo} until={S("desaba")} y={760} />
        <Mark kind="x" at={A.desabam} until={S("caixa")} y={760} />
        <Mark kind="ok" at={A.armado} until={S("peso")} y={760} />
        <BigText at={A.metro} until={A.toneladas - 0.1} text="1 METRO DE TERRA" y={1380} color="#FFD23F" size={100} />
        <BigText at={A.toneladas} until={E("peso")} text="≈ 2 TONELADAS / m²" y={1380} color="#FFD23F" size={100} />
        <Mark kind="x" at={A.ceder} until={S("abobada")} y={760} />
        <Mark kind="q" at={W("abobada", "esquisito")} until={A.aguenta} y={760} />
        <Mark kind="ok" at={A.aguenta} until={S("pinga")} y={760} />
        <Mark kind="x" at={A.pingar} until={S("manta")} y={760} />
        <Mark kind="ok" at={A.borracha} until={S("vela")} y={760} />
        <Mark kind="x" at={A.sumir} until={S("respiros")} y={760} />
        <Mark kind="ok" at={A.sai} until={S("enxurrada")} y={760} />
        <Mark kind="x" at={A.abaixo} until={S("escotilha")} y={760} />
        <Mark kind="ok" at={A.fecha + 0.3} until={S("arvore")} y={760} />
        <Mark kind="x" at={A.trancado} until={S("saida")} y={760} />
        <Mark kind="ok" at={A.emergencia} until={S("revelacao")} y={760} />
        <Finish />
        <Flash at={cuts} />
        <TopLabel />
        <Captions />
        <CTA at={S("cta")} />
        <Audio src={staticFile("bunker/narracao.wav")} />
        <Audio src={staticFile("bunker/trilha.wav")} volume={0.9} />
      </AbsoluteFill>
    </TimelineCtx.Provider>
  );
};

export const bunkerDuration = (fps: number) => Math.ceil((TL.duration + 0.8) * fps);
