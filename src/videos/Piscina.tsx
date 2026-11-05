import { useContext } from "react";
import { AbsoluteFill, Audio, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { CoverCtx } from "../engine/Overlays";
import { Cam, Shot } from "../engine/Shot";
import type { Key } from "../engine/Camera";
import { cena, lerp, prog, Timeline, TimelineCtx, wordAt } from "../engine/timeline";
import { RainStreaks } from "../three/World";
import { Pipe } from "../three/basics";
import { Tiao } from "../three/Tiao";
import {
  Arrow3,
  Chute,
  clamp01,
  CutPoly,
  Debris,
  FallingDirt,
  Turf,
  DirtPile,
  GroundCracks,
  Hose,
  House,
  Lawn,
  leakPts,
  Leaf,
  Lounger,
  MachineHut,
  mixHex,
  Muro,
  NeighborHouse,
  Patio,
  PG,
  Pipes,
  PitWater,
  Pool,
  PoolState,
  PoolWorld,
  popS,
  Pores,
  ShovelP,
  Soil,
  Suction,
  Tablet,
  Umbrella,
  waterTablePts,
  wetPts,
  YardTrees,
} from "../three/Piscina";
import { C, ease, FONT, spring as SP } from "../theme";
import timelineJson from "../../public/piscina/timeline.json";

const TL = timelineJson as Timeline;
const S = (id: string) => cena(TL, id).start;
const E = (id: string) => cena(TL, id).end;
const W = (id: string, w: string, nth = 0) => wordAt(TL, id, w, nth);
type V3 = [number, number, number];

const A = {
  buraco: W("gancho", "buraco"),
  quintal: W("gancho", "quintal"),
  encher: W("gancho", "encher"),
  piscina: W("gancho", "piscina"),
  seguinte: W("some", "seguinte"),
  bebeu: W("some", "bebeu"),
  lama: W("some", "lama"),
  forra: W("casco", "forra"),
  ferro: W("casco", "ferro"),
  concreto: W("casco", "concreto"),
  casco: W("casco", "casco"),
  furinhos: W("vaza", "furinhos"),
  atravessa: W("vaza", "atravessa"),
  brotar: W("vaza", "brotar"),
  muro: W("vaza", "muro"),
  vizinho: W("vaza", "vizinho"),
  passa: W("impermeabiliza", "passa"),
  borracha: W("impermeabiliza", "borracha"),
  cobre: W("impermeabiliza", "cobre"),
  azulejo: W("impermeabiliza", "azulejo"),
  imper: W("impermeabiliza", "impermeabilização"),
  semana: W("verde", "semana"),
  verde: W("verde", "verde"),
  algas: W("verde", "algas"),
  sujeira: W("verde", "sujeira"),
  joga: W("filtro", "joga"),
  cloro: W("filtro", "cloro"),
  bomba: W("filtro", "bomba"),
  tanque: W("filtro", "tanque"),
  areia: W("filtro", "areia"),
  filtro: W("filtro", "filtro"),
  folha: W("boia", "folha"),
  ralo0: W("boia", "ralo"),
  fundo: W("boia", "fundo"),
  nunca: W("boia", "nunca"),
  abre: W("skimmer", "abre"),
  boca: W("skimmer", "boca"),
  linha: W("skimmer", "linha"),
  engole: W("skimmer", "engole"),
  flutua: W("skimmer", "flutua"),
  skimmer: W("skimmer", "skimmer"),
  puxa: W("suga", "puxa"),
  forte: W("suga", "forte"),
  prende: W("suga", "prende"),
  cabelo: W("suga", "cabelo"),
  mergulha: W("suga", "mergulha"),
  divide: W("ralo", "divide"),
  dois: W("ralo", "dois"),
  separados: W("ralo", "separados"),
  tapa: W("ralo", "tapa"),
  outro: W("ralo", "outro"),
  alivia: W("ralo", "alivia"),
  antissuccao: W("ralo", "antissucção"),
  esvazia: W("flutua", "esvazia"),
  lavar: W("flutua", "lavar"),
  muita: W("flutua", "muita"),
  chuva: W("flutua", "chuva"),
  parece: W("flutua", "Parece"),
  chao: W("flutua", "chão"),
  empurra: W("flutua", "empurra"),
  cima: W("flutua", "cima"),
  inteira: W("flutua", "inteira"),
  sai: W("flutua", "sai"),
  terra: W("flutua", "terra"),
  poe: W("valvula", "põe"),
  valvula: W("valvula", "válvula"),
  deixa: W("valvula", "deixa"),
  entrar: W("valvula", "entrar"),
  aliviaP: W("valvula", "alivia"),
  pressao: W("valvula", "pressão"),
  hidro: W("valvula", "hidrostática"),
  parabens: W("final", "Parabéns"),
  dentro: W("impermeabiliza", "dentro"),
  ralo1: W("suga", "ralo"),
  agua2: W("valvula", "água"),
  segura: W("filtro", "segura"),
};
const END = TL.duration + 4.6;

// brilho rápido quando a narração diz "Esse é o ___"
const flashAt = (t: number, at: number) => prog(t, at - 0.1, at + 0.15) * (1 - prog(t, at + 0.55, at + 0.95));

// ---------- folhas ----------
const LEAF_BASE = Array.from({ length: 11 }).map((_, i) => {
  const x = -3.2 + ((i * 0.618) % 1) * 6.6;
  const z = -1.75 + ((i * 0.37 + 0.2) % 1) * 2.9;
  return { x, z, r: i * 1.3, s: 1.3 + (i % 3) * 0.25, c: ["#7A8F2A", "#9A7A2A", "#5E8A2E", "#A5662B"][i % 4], fall: A.semana + (i / 11) * 2.8 };
});
const leavesAt = (t: number, cut: boolean, level: number): Leaf[] => {
  if (t < A.semana - 0.1 || t > E("skimmer") + 0.2) return [];
  return LEAF_BASE.filter((l) => !cut || l.z < -0.1).map((l, i) => {
    const fallP = clamp01((t - l.fall) / 1.6);
    let x = l.x + Math.sin(t * 0.5 + i) * 0.15;
    let z = l.z + Math.cos(t * 0.4 + i * 2) * 0.12;
    let y = level + 0.035;
    if (fallP < 1) {
      y = level + 0.035 + (1 - fallP) * 4.5;
      x += Math.sin(fallP * 9 + i) * (1 - fallP) * 0.8;
    }
    // skimmer engole
    let vis = t < l.fall ? 0 : 1;
    const k = clamp01((t - (A.engole - 0.6 + i * 0.09)) / 1.1);
    if (k > 0) {
      const e = ease.inOut(k);
      x = lerp(x, PG.skimX + (i % 3 - 1) * 0.1, e);
      z = lerp(z, -PG.zi + 0.05, e);
      if (k > 0.92) vis = 0;
    }
    return { x, y, z, r: l.r + Math.sin(t + i) * 0.3, s: l.s * 1.45, c: l.c, vis };
  });
};

// ---------- estado do mundo em função do tempo ----------
const state = (t: number, cut: boolean): PoolState & { foot: number; wt: number; rain: number; stain: number; pile: number; wet: number; leak: number; pores: number; hose: number; chute: number; tablet: number; pump: number; tank: number; tankDirt: number; tankGlow: number; pipes: number; push: number; gapWater: number; lights: number; dusk: number } => {
  const dig = prog(t, 0.15, A.quintal + 0.5, ease.out);
  const foot = prog(t, 0.0, A.buraco + 0.3, ease.out);
  const fill = prog(t, A.encher, A.piscina - 0.2);
  const drain = prog(t, A.seguinte, A.lama - 0.1, ease.inOut);
  const pitWater = PG.floorOut + 1.62 * fill * (1 - drain);
  const shellOn = t >= A.concreto - 0.3;
  const build = prog(t, A.concreto - 0.3, A.casco - 0.15, ease.out);
  const rebarDrop = 3 * (1 - prog(t, A.forra, A.ferro + 0.3, ease.out));
  const rebarVis = t > A.forra - 0.2 && t < A.casco ? 1 : 0;
  const imperOn = t >= S("impermeabiliza");
  const rubber = prog(t, A.passa - 0.1, A.dentro + 0.3);
  const tiles = prog(t, A.cobre - 0.15, A.imper - 0.25);
  const coping = prog(t, A.azulejo, A.imper + 0.2);
  const ladder = prog(t, A.imper - 0.4, A.imper + 0.1);
  // nível d'água no casco
  let water = -99;
  if (t >= S("vaza") - 0.05 && t < S("impermeabiliza")) water = PG.wl;
  if (t >= S("verde") - 0.05) water = PG.wl;
  if (t >= S("flutua")) water = lerp(PG.wl, PG.floorIn + 0.08, prog(t, A.esvazia, A.lavar + 0.5));
  if (t >= A.muita) water = PG.floorIn + 0.1;
  if (t >= S("valvula")) water = PG.floorIn + 0.1 + 0.6 * prog(t, A.deixa + 0.2, A.pressao + 0.5);
  if (t >= S("final") - 0.05) water = PG.wl;
  // cor: verde por algas, limpa com cloro + filtro
  const green = prog(t, A.semana + 0.6, A.verde + 0.5) * (1 - prog(t, A.cloro + 0.3, A.filtro));
  const algae = prog(t, A.verde, A.algas + 0.4) * (1 - prog(t, A.cloro + 0.2, A.areia));
  const dirt = prog(t, A.algas, A.sujeira + 0.3) * (1 - prog(t, A.bomba, A.filtro));
  const muddy = t >= S("flutua") && t < S("final") ? 1 : 0;
  const waterColor = mixHex(mixHex("#5CCBF5", "#56702A", green), "#8FB7C9", muddy * 0.5);
  const finalBlue = t >= S("final") ? prog(t, A.parabens - 0.3, A.parabens + 0.6) : 0;
  const waterDeep = mixHex("#1E8ED6", "#2E4412", green);
  const waterOpacity = cut ? 0.55 + green * 0.25 : 0.62 + green * 0.2;
  const volOpacity = 0.3 + green * 0.32;
  // drenos
  const split = prog(t, A.divide, A.separados + 0.2, ease.inOut);
  const drains = t < A.bomba - 0.3 ? [] : t < A.divide ? [0] : [0, 2.6 * split];
  // flutuação
  const wt = t < A.muita - 0.2 || t >= S("final") ? -99 : t < S("valvula") ? lerp(-4.0, -0.35, prog(t, A.muita - 0.2, A.empurra + 0.4)) : lerp(-0.35, -4.0, prog(t, A.hidro, S("final")));
  const lift = t < S("flutua") ? 0 : (0.25 * prog(t, A.empurra, A.cima) + 1.65 * prog(t, A.cima + 0.15, A.terra + 0.55, ease.out)) * (1 - prog(t, A.aliviaP, A.pressao + 1.3, ease.inOut));
  const s: PoolState = {
    dig,
    cut,
    pitWater: shellOn ? -99 : pitWater,
    pitColor: mixHex("#5CC4F0", "#7E6A4E", drain),
    mud: shellOn ? 0 : prog(t, A.bebeu, A.lama + 0.2),
    rebarDrop,
    rebarVis,
    build: shellOn ? build : 0,
    shellGlow: flashAt(t, A.casco),
    rubber: imperOn ? rubber : 0,
    rubberGlow: flashAt(t, A.imper),
    tiles: imperOn ? tiles : 0,
    coping: imperOn ? coping : 0,
    deck: imperOn ? coping : 0,
    ladder: imperOn ? ladder : 0,
    water,
    waterColor: mixHex(waterColor, "#22A9EE", finalBlue),
    waterDeep,
    waterOpacity,
    volOpacity,
    algae,
    dirt,
    leaves: leavesAt(t, cut, PG.wl),
    drains,
    drainGlow: flashAt(t, A.antissuccao),
    skimmer: prog(t, A.boca - 0.3, A.boca + 0.25),
    skimGlow: flashAt(t, A.skimmer),
    ret: prog(t, A.bomba - 0.2, A.bomba + 0.4),
    lights: prog(t, A.parabens - 0.2, A.parabens + 0.8),
    flow: t > A.bomba && t < S("flutua") ? prog(t, A.bomba + 0.2, A.bomba + 0.6) : 0,
    valve: prog(t, A.valvula - 0.25, A.valvula + 0.2),
    valveOpen: prog(t, A.deixa - 0.1, A.deixa + 0.35) * (1 - prog(t, A.hidro + 0.4, A.hidro + 0.9)),
    valveGlow: flashAt(t, A.hidro),
    valveJet: prog(t, A.deixa, A.agua2) * (1 - prog(t, A.pressao, A.hidro)),
    lift,
    tilt: lift * 0.03,
    skimOpen: t > A.flutua + 0.4 && t < S("suga") ? prog(t, S("skimmer") + 4.6, S("skimmer") + 5.0) : 0,
    skimIn: prog(t, A.engole, A.flutua + 0.3),
    caustic: water > PG.floorIn + 0.6 ? 1 - green : 0,
  };
  return {
    ...s,
    foot,
    wt,
    rain: t >= S("flutua") ? prog(t, A.muita - 0.6, A.muita) * (1 - 0.45 * prog(t, A.cima - 0.3, A.cima)) * (1 - prog(t, A.poe, A.deixa)) : 0,
    stain: t < S("impermeabiliza") ? prog(t, A.brotar - 0.3, A.vizinho + 0.5) : 0,
    pile: dig * (t < S("impermeabiliza") ? 1 : 0),
    wet: t < S("casco") ? prog(t, A.seguinte, A.lama) : 0,
    leak: t >= S("vaza") && t < S("impermeabiliza") ? prog(t, A.atravessa - 0.3, A.muro) : 0,
    pores: t >= S("vaza") && t < S("impermeabiliza") ? prog(t, A.furinhos - 0.4, A.furinhos) : 0,
    hose: t < S("some") ? prog(t, A.encher - 0.1, A.encher + 0.2) * (1 - prog(t, A.piscina, A.piscina + 0.4)) : 0,
    chute: t > A.concreto - 0.5 && t < A.casco ? prog(t, A.concreto - 0.5, A.concreto - 0.2) * (1 - prog(t, A.casco - 0.4, A.casco)) : 0,
    tablet: (t - A.joga + 0.1) / 0.55,
    pump: prog(t, A.bomba - 0.5, A.bomba),
    tank: prog(t, A.tanque - 0.5, A.tanque),
    tankDirt: prog(t, A.segura, A.filtro),
    tankGlow: flashAt(t, A.filtro),
    pipes: prog(t, A.bomba - 0.5, A.bomba + 0.3),
    push: t >= S("flutua") && t < S("final") ? prog(t, A.empurra - 0.5, A.empurra) * (1 - prog(t, A.aliviaP - 0.2, A.aliviaP + 0.4)) : 0,
    gapWater: lift,
    dusk: t >= S("final") ? 1 : 0,
  };
};
// ---------- Tião ----------
const Diver: React.FC<{ P: V3; th: number; s: number; t: number; mood: "neutral" | "happy" | "shock" | "sad"; pose?: "down" | "up" | "wave" }> = ({ P, th, s, t, mood, pose = "down" }) => (
  <group position={P} rotation={[0, 0, th]}>
    <Tiao position={[0, 0, 0]} scale={s} mood={mood} pose={pose} t={t} wet />
  </group>
);
const headOf = (P: V3, th: number, s: number): V3 => [P[0] - Math.sin(th) * 1.75 * s, P[1] + Math.cos(th) * 1.75 * s, P[2]];

const TiaoLayer: React.FC<{ t: number; cut: boolean }> = ({ t, cut }) => {
  const st = state(t, cut);
  const L = st.lift;
  // gancho: cava com a pá na borda de trás
  if (t < S("some")) {
    const digging = t < A.quintal + 0.5;
    const swing = digging ? Math.sin(t * 9) : 0;
    const happy = t > A.piscina - 0.3;
    return (
      <group>
        <Tiao position={[1.2, 0, -3.05]} rotation={-0.25} scale={0.85} t={t} mood={happy ? "happy" : "neutral"} pose={happy ? "wave" : "down"} armROverride={digging ? [-0.9 + swing * 0.5, 0, -0.25] : undefined} armLOverride={digging ? [-0.9 + swing * 0.5, 0, 0.25] : undefined} lean={digging ? 0.25 + swing * 0.12 : 0} />
        {digging ? <ShovelP position={[1.1, 0.35 + swing * 0.15, -2.35 + swing * 0.08]} rot={[0.9 + swing * 0.35, 0.0, 0.1]} /> : <ShovelP position={[2.6, 0.55, -3.3]} rot={[0.15, 0, -0.25]} />}
        {digging
          ? Array.from({ length: 5 }).map((_, i) => {
              const u = ((t * 1.5 + i / 5) % 1 + 1) % 1;
              const a: V3 = [1.0, -0.4, -1.8];
              const b: V3 = [5.4, 0.7, -3.9];
              return (
                <mesh key={i} position={[lerp(a[0], b[0], u), lerp(a[1], b[1], u) + Math.sin(u * Math.PI) * 1.6, lerp(a[2], b[2], u)]} rotation={[u * 9, u * 6, i]} scale={0.13}>
                  <icosahedronGeometry args={[1, 0]} />
                  <meshStandardMaterial color="#7A4B2C" flatShading />
                </mesh>
              );
            })
          : null}
      </group>
    );
  }
  if (t < S("casco")) return <Tiao position={[-1.4, 0, -3.1]} rotation={0.15} scale={0.85} t={t} mood="sad" />;
  if (t >= S("verde") && t < S("filtro")) return <Tiao position={[2.6, 0.06, -3.0]} rotation={-0.2} scale={0.85} t={t} mood={t > A.verde ? "sad" : "neutral"} />;
  if (t >= S("filtro") && t < A.bomba) {
    const throwP = prog(t, A.joga - 0.35, A.joga + 0.15);
    return <Tiao position={[-1.2, 0.06, -3.05]} rotation={0.25} scale={0.85} t={t} mood="happy" armROverride={throwP < 0.75 ? [-0.4 - throwP * 3.0, 0, -0.25] : [-1.2, 0, -0.2]} />;
  }
  if (t >= S("suga") && t < S("flutua")) {
    // mergulha, o rabo de cavalo é puxado para o ralo; tapa o ralo com a mão, solta e sobe sorrindo
    const s = 0.8;
    const d = prog(t, S("suga") + 0.05, A.puxa + 0.7, ease.inOut);
    const thStuck = Math.PI - 0.85;
    const reach = prog(t, A.tapa - 0.35, A.tapa + 0.1);
    const headT: V3 = [lerp(0.75, 0.42, reach), PG.floorIn + lerp(1.0, 0.62, reach), PG.drainZ];
    const off = headOf([0, 0, 0], thStuck, s);
    const Pstuck: V3 = [headT[0] - off[0], headT[1] - off[1], PG.drainZ];
    const up = prog(t, A.alivia + 0.1, A.antissuccao - 0.2, ease.inOut);
    const held = t < A.alivia;
    const tug = held ? Math.sin(t * 8) * 0.05 * prog(t, A.forte, A.prende) : 0;
    const P0: V3 = [2.6, 0.7, PG.drainZ];
    const Pup: V3 = [1.3, -1.32, PG.drainZ];
    let P: V3 = [lerp(P0[0], Pstuck[0], d) + tug, lerp(P0[1], Pstuck[1], d), PG.drainZ];
    let th = lerp(Math.PI * 0.7, thStuck, d) + tug * 1.5;
    if (up > 0) {
      P = [lerp(Pstuck[0], Pup[0], up), lerp(Pstuck[1], Pup[1], up), PG.drainZ];
      th = lerp(thStuck, 0.08, up);
    }
    const crown = headOf(P, th, s * 1.13);
    const pulled = prog(t, A.forte - 0.2, A.ralo1) * (held ? 1 : 0);
    const drainC: V3 = [0, PG.floorIn + 0.1, PG.drainZ + 0.04];
    const loose: V3 = [crown[0] + Math.sin(th) * 0.45 + Math.sin(t * 3) * 0.05, crown[1] - Math.cos(th) * 0.45, PG.drainZ + 0.05];
    const tip: V3 = [lerp(loose[0], drainC[0], pulled), lerp(loose[1], drainC[1], pulled), PG.drainZ + 0.05];
    const mid: V3 = [(crown[0] + tip[0]) / 2 + Math.sin(t * 11) * 0.03 * pulled, (crown[1] + tip[1]) / 2, PG.drainZ + 0.06];
    const happy = up > 0.3;
    return (
      <group>
        <Diver P={P} th={th} s={s} t={t} mood={happy ? "happy" : t > A.forte ? "shock" : "neutral"} pose={happy ? (up > 0.95 ? "wave" : "down") : t > A.forte ? "up" : "down"} />
        <Pipe points={[[crown[0], crown[1], PG.drainZ + 0.04], mid, tip]} radius={0.06} color="#3A2A20" segments={20} />
        <mesh position={[crown[0], crown[1], PG.drainZ + 0.05]}>
          <torusGeometry args={[0.07, 0.025, 6, 14]} />
          <meshStandardMaterial color="#FF5FA2" />
        </mesh>
        <Bubbles from={headOf(P, th, s)} t={t} />
        <DiveSplash t={t} at={S("suga") + 0.25} pos={[2.3, PG.wl, PG.drainZ]} />
        <DiveSplash t={t} at={A.antissuccao - 0.15} pos={[1.3, PG.wl, PG.drainZ]} />
      </group>
    );
  }
  if (t >= S("flutua") && t < A.muita - 0.3) {
    const sweep = Math.sin(t * 5) * 0.3;
    return (
      <group>
        <Tiao position={[1.6, PG.floorIn + 0.04, -0.9]} rotation={0.3} scale={0.85} t={t} mood="neutral" armROverride={[-0.7 + sweep * 0.4, 0, -0.3]} armLOverride={[-0.7 + sweep * 0.4, 0, 0.3]} />
        <group position={[1.6 + sweep, PG.floorIn + 0.04, -0.3]} rotation={[0.5, 0, 0]}>
          <mesh position={[0, 0.6, 0]}>
            <cylinderGeometry args={[0.025, 0.025, 1.3, 6]} />
            <meshStandardMaterial color="#C8935C" />
          </mesh>
          <mesh position={[0, 0.0, 0]}>
            <boxGeometry args={[0.5, 0.08, 0.12]} />
            <meshStandardMaterial color="#E8352B" />
          </mesh>
        </group>
      </group>
    );
  }
  if (t >= A.cima - 0.2 && t < A.aliviaP && !cut) {
    const fall = prog(t, A.sai - 0.1, A.sai + 0.35, ease.in);
    return <Tiao position={[-4.0, -0.5 * fall, 5.9]} rotation={2.4} scale={0.85} t={t} mood="shock" pose="up" sit={fall} lean={-0.25 * fall} />;
  }
  if (t >= S("final")) return <Tiao position={[1.6, -0.24, 5.0]} rotation={Math.PI} scale={0.8} t={t} mood="relaxed" sit={1} pose={t > E("final") - 0.6 ? "wave" : "down"} />;
  void L;
  return null;
};

const DiveSplash: React.FC<{ t: number; at: number; pos: V3 }> = ({ t, at, pos }) => {
  const u = (t - at) / 0.8;
  if (u < 0 || u > 1) return null;
  return (
    <group position={pos}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} scale={0.3 + u * 1.6}>
        <ringGeometry args={[0.75, 1, 32]} />
        <meshStandardMaterial color="#FFFFFF" transparent opacity={0.7 * (1 - u)} depthWrite={false} />
      </mesh>
      {Array.from({ length: 16 }).map((_, i) => {
        const a = (i / 16) * Math.PI * 2;
        const r = u * (0.5 + (i % 3) * 0.2);
        return (
          <mesh key={i} position={[Math.cos(a) * r, Math.sin(u * Math.PI) * (0.5 + (i % 4) * 0.15), Math.sin(a) * r]} scale={0.05 * (1 - u * 0.6)}>
            <sphereGeometry args={[1, 6, 5]} />
            <meshStandardMaterial color="#F2FBFF" />
          </mesh>
        );
      })}
      <mesh position={[0, Math.sin(u * Math.PI) * 0.35, 0]} scale={[0.2, 0.5 * Math.sin(u * Math.PI) + 0.01, 0.2]}>
        <cylinderGeometry args={[0.6, 1, 1, 12, 1, true]} />
        <meshStandardMaterial color="#E6F7FF" transparent opacity={0.6} side={2} depthWrite={false} />
      </mesh>
    </group>
  );
};

const Bubbles: React.FC<{ from: V3; t: number }> = ({ from, t }) => (
  <group>
    {Array.from({ length: 6 }).map((_, i) => {
      const u = ((t * 0.7 + i / 6) % 1 + 1) % 1;
      return (
        <mesh key={i} position={[from[0] + Math.sin(u * 8 + i) * 0.1, from[1] + u * 1.4, from[2] + 0.2]} scale={0.03 + i * 0.006}>
          <sphereGeometry args={[1, 8, 6]} />
          <meshStandardMaterial color="#F2FBFF" transparent opacity={0.7 * (1 - u)} />
        </mesh>
      );
    })}
  </group>
);

const band = (x0: number, x1: number, wt: number, t: number): [number, number][] => {
  const top: [number, number][] = [];
  const bot: [number, number][] = [];
  for (let k = 0; k <= 24; k++) {
    const x = x0 + ((x1 - x0) * k) / 24;
    const y = wt + Math.sin(x * 1.3 + t * 2) * 0.05 + Math.sin(x * 0.4 - t) * 0.04;
    top.push([x, y]);
    bot.push([x, y - 0.06]);
  }
  return [...bot, ...top.reverse()];
};

// corte seco com um clarão leve (nunca estoura o quadro)
const SoftFlash: React.FC<{ at: number[] }> = ({ at }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const o = Math.max(0, ...at.map((s) => interpolate(frame, [s * fps - 1, s * fps, s * fps + 4], [0, 0.22, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })));
  if (o <= 0) return null;
  return <AbsoluteFill style={{ background: "#FFF6E0", opacity: o, pointerEvents: "none" }} />;
};

const pitOutline = (hx: number, pb: number): [number, number][] => {
  const w = 0.07;
  return [[-hx - w, 0], [-hx - w, pb - w], [hx + w, pb - w], [hx + w, 0], [hx, 0], [hx, pb], [-hx, pb], [-hx, 0]];
};

// ---------- cena completa ----------
const Scene: React.FC<{ t: number; cut: boolean; sky?: { top?: string; horizon?: string }; fog?: [string, number, number]; flat?: boolean }> = ({ t, cut, sky, fog, flat = false }) => {
  const st = state(t, cut);
  const pitBottom = PG.floorOut * st.dig;
  const roller = st.rubber > 0 && st.rubber < 1;
  const rx = -PG.xi + 2 * PG.xi * st.rubber;
  // sucção
  const sucBoia = t >= S("boia") && t < S("skimmer") ? prog(t, A.ralo0 - 0.4, A.ralo0) : 0;
  const inSR = t >= S("suga") && t < S("flutua");
  const share = prog(t, A.divide, A.separados);
  const covered = prog(t, A.tapa - 0.1, A.tapa + 0.3) * (1 - prog(t, A.alivia + 0.6, A.alivia + 1.2));
  const after = prog(t, A.alivia + 0.6, A.alivia + 1.2);
  const sucD0 = inSR ? prog(t, A.puxa - 0.3, A.forte) * 1.2 * (1 - 0.5 * share) * (1 - covered) * (1 - prog(t, E("ralo") - 0.5, E("ralo"))) : 0;
  const sucD1 = inSR ? share * (0.6 + 0.7 * covered) * (1 - 0.3 * after) * (1 - prog(t, E("ralo") - 0.5, E("ralo"))) : 0;
  return (
    <group>
      <PoolWorld t={t} cut={cut} sky={sky} fog={fog} />
      <Soil cut={cut} dig={st.dig} wet={cut ? 0 : st.wet} foot={st.foot} bed={t >= S("valvula")} />
      <Lawn cut={cut} deck={st.deck} foot={st.foot} />
      <House lit={st.dusk ? prog(t, S("final"), A.parabens + 0.6) : 0} />
      <Patio />
      <Muro cut={cut} stain={st.stain} t={t} />
      <NeighborHouse position={[15.5, 0, -6]} />
      <YardTrees cut={cut} />
      <MachineHut cut={cut} pump={st.pump} tank={st.tank} dirt={st.tankDirt} glow={st.tankGlow} t={t} flow={st.flow} />
      <DirtPile p={st.pile} />
      <Hose on={st.hose} t={t} level={st.pitWater} />
      <PitWater s={st} t={t} />
      <Chute on={st.chute} t={t} level={PG.floorIn + 1.4 * prog(t, A.concreto - 0.3, A.casco - 0.15)} />
      <Pool s={st} t={t}>
        {roller ? (
          <group position={[rx, PG.floorIn + 0.1, 0]}>
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.09, 0.09, 1.0, 14]} />
              <meshStandardMaterial color="#1E2022" roughness={0.6} />
            </mesh>
            <Pipe points={[[0, 0, 0], [-0.2, 0.3, 0], [-1.2, 1.9, -0.3]]} radius={0.025} color="#E8B23A" segments={10} />
          </group>
        ) : null}
        <Suction x={0} amt={sucBoia} t={t} color="#FF8A1E" reach={0.6} flat={flat} />
        <Suction x={0} amt={sucD0} t={t} color="#FF8A1E" reach={1} flat={flat} />
        <Suction x={2.6 * prog(t, A.divide, A.separados + 0.2)} amt={sucD1} t={t} color="#FF8A1E" reach={0.9} flat={flat} />
      </Pool>
      <Pipes p={cut && (t < S("flutua") || t >= S("final")) ? st.pipes : 0} t={t} flow={st.flow} drains={st.drains} />
      <Tablet p={st.tablet} from={[-0.6, 2.0, -3.0]} to={[-0.4, PG.wl, -0.6]} t={t} />
      <TiaoLayer t={t} cut={cut} />
      {/* fenômenos do corte */}
      {cut ? (
        <group>
          {st.wt > -6.5 ? (
            <>
              <CutPoly pts={waterTablePts(st.wt, pitBottom, t)} color="#2F86D6" opacity={0.42} z={0.008} />
              <CutPoly pts={band(-40, -PG.xo, st.wt, t)} color="#9ADBFF" opacity={0.85} z={0.009} />
              <CutPoly pts={band(PG.xo, 40, st.wt, t)} color="#9ADBFF" opacity={0.85} z={0.009} />
            </>
          ) : null}
          {st.dig > 0.05 && st.build <= 0 ? (
            <>
              <CutPoly pts={pitOutline(PG.xo * (0.2 + 0.8 * st.foot), pitBottom)} color="#3B2414" opacity={1} z={0.014} />
              <mesh position={[0, pitBottom / 2, -PG.zo + 0.01]}>
                <planeGeometry args={[2 * PG.xo, -pitBottom]} />
                <meshBasicMaterial color="#000" transparent opacity={0.22} depthWrite={false} />
              </mesh>
            </>
          ) : null}
          {st.wet > 0.01 ? <CutPoly pts={wetPts(0.25 + 2.6 * st.wet, pitBottom)} color="#3A2416" opacity={0.45 * st.wet + 0.1} z={0.012} /> : null}
          {st.leak > 0.01 ? <CutPoly pts={leakPts(st.leak, t)} color="#2C4F78" opacity={0.55} z={0.012} /> : null}
          <Pores t={t} amt={st.pores} />
          {st.gapWater > 0.01 ? (
            <mesh position={[0, PG.floorOut + st.gapWater / 2, -PG.zo / 2]}>
              <boxGeometry args={[2 * PG.xo, st.gapWater, PG.zo]} />
              <meshStandardMaterial color="#4FA8E8" transparent opacity={0.38} depthWrite={false} />
            </mesh>
          ) : null}
          {st.push > 0.01
            ? [-3.2, -1.6, 0, 1.6, 3.2].map((x, i) => {
                const ph = ((t * 1.2 + i * 0.3) % 1 + 1) % 1;
                const y0 = -3.6 + ph * 0.5;
                return <Arrow3 key={i} from={[x, y0, 0.15]} to={[x, y0 + 1.1, 0.15]} color="#FF7A1A" r={0.09} opacity={st.push} />;
              })
            : null}
        </group>
      ) : (
        <group>
          {/* água do chão aparece no buraco quando a piscina sai */}
          {st.lift > 0.05 ? (
            <mesh position={[0, PG.floorOut + 0.3, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[2 * PG.xo, 2 * PG.zo]} />
              <meshStandardMaterial color="#5E7F86" roughness={0.1} metalness={0.2} />
            </mesh>
          ) : null}
          <GroundCracks p={Math.min(1, st.lift / 1.4)} cut={cut} />
          <Debris p={t >= S("flutua") && t < S("valvula") ? prog(t, A.cima + 0.1, A.terra + 1.0) : 0} />
          <Turf p={t >= S("flutua") && t < S("final") ? clamp01(st.lift / 1.4) : 0} />
          <FallingDirt t={t} lift={st.lift} on={t >= S("flutua") && t < S("final") ? 1 : 0} />
        </group>
      )}
      {st.rain > 0.01 ? <RainStreaks t={t} amount={st.rain} box={[-14, 14, -10, cut ? 1.5 : 10]} top={14} n={900} /> : null}
      {t >= S("final") ? (
        <group>
          <directionalLight position={[-30, 8, 14]} color="#FF9C45" intensity={1.6} />
          <Lounger position={[1.6, 0, 4.9]} rot={Math.PI} />
          <Lounger position={[-0.2, 0, 4.9]} rot={Math.PI} />
          <Umbrella position={[-3.6, 0, 5.4]} />
        </group>
      ) : null}
    </group>
  );
};

// ---------- planos ----------
type Plan = { from: number; to: number; cut: boolean; keys: Key[]; look?: "day" | "rain" | "raincut" | "storm" | "dusk"; shake?: (t: number) => number; flat?: boolean; under?: boolean };
const k = (t: number, pos: V3, look: V3, fov = 50): Key => ({ t, pos, look, fov });

const PLANS: Plan[] = [
  // gancho: drone alto descendo sobre o quintal
  { from: 0, to: S("some"), cut: false, keys: [k(0, [14.5, 10.5, 21], [0, 1.6, -4], 54), k(A.quintal, [10, 9, 15], [0, -0.3, -1.5], 50), k(A.encher + 0.4, [7, 6.5, 11], [0, -0.6, -1], 50), k(S("some"), [5.2, 5, 9.5], [0, -0.8, -1], 50)] },
  // some: corte, timelapse (câmera desce e anda de lado)
  { from: S("some"), to: S("casco"), cut: true, keys: [k(S("some"), [3.6, 1.6, 11.0], [2.6, -1.1, -1], 56), k(A.bebeu, [2.6, 0.7, 9.2], [2.2, -1.4, -1], 54), k(S("casco"), [1.4, 0.2, 7.6], [1.6, -1.6, -1], 52)] },
  // casco: órbita 3/4 aérea
  { from: S("casco"), to: S("vaza"), cut: false, keys: [k(S("casco"), [-10, 8, 9], [0, -1, 0], 50), k(A.concreto, [-6, 6.5, 10.5], [0.5, -1, 0], 50), k(S("vaza"), [-1.5, 6.5, 11], [0.5, -1, -0.3], 50)] },
  // vaza: close no poro → trilho até o muro
  { from: S("vaza"), to: A.vizinho - 0.15, cut: true, keys: [k(S("vaza"), [4.3, -0.7, 3.2], [4.2, -0.8, 0], 46), k(A.furinhos + 0.4, [4.4, -0.8, 2.4], [4.25, -0.85, 0], 46), k(A.atravessa + 0.3, [5.4, -0.5, 4.6], [5.4, -0.7, 0], 48), k(A.vizinho - 0.15, [7.0, 0.4, 6.2], [7.4, 0.2, 0], 50)] },
  // vizinho: contra-plano do lado de lá do muro
  { from: A.vizinho - 0.15, to: S("impermeabiliza"), cut: false, keys: [k(A.vizinho - 0.15, [11.5, 0.9, 1.5], [7.5, 0.9, -1.0], 50), k(S("impermeabiliza"), [10.6, 0.8, 0.6], [7.5, 0.8, -1.0], 50)] },
  // impermeabiliza: de cima → órbita
  { from: S("impermeabiliza"), to: S("verde"), cut: false, keys: [k(S("impermeabiliza"), [5, 14, 0.5], [0, -1.2, 0], 50), k(A.cobre, [6.5, 9.5, 3.5], [0, -1, -0.2], 50), k(S("verde"), [7.5, 5.5, 8], [0, -0.8, -0.5], 50)] },
  // verde: de cima e de lado, vendo a água e as folhas
  { from: S("verde"), to: S("filtro"), cut: false, keys: [k(S("verde"), [-6.0, 3.6, 5.6], [0, -0.4, -0.8], 50), k(A.algas, [-3.0, 3.0, 4.6], [0.5, -0.6, -0.8], 50), k(S("filtro"), [-2.0, 2.6, 5.4], [1, -0.5, -1.0], 50)] },
  // filtro (cloro): close no Tião
  { from: S("filtro"), to: A.bomba - 0.25, cut: false, keys: [k(S("filtro"), [1.6, 1.4, 3.6], [-0.9, 0.5, -2.3], 50), k(A.bomba - 0.25, [0.8, 1.1, 3.4], [-0.6, 0.1, -1.6], 50)] },
  // filtro (bomba e tanque inteiro): corte na casa de máquinas
  { from: A.bomba - 0.25, to: S("boia"), cut: true, keys: [k(A.bomba - 0.25, [-6.2, 0.4, 6.4], [-6.0, -0.4, -0.6], 50), k(A.tanque, [-7.4, 0.7, 4.8], [-7.5, 0.55, -0.7], 50), k(A.filtro - 0.2, [-7.1, 0.85, 4.3], [-7.4, 0.7, -0.7], 48), k(S("boia"), [-7.0, 0.9, 4.1], [-7.35, 0.75, -0.7], 48)] },
  // boia 1: de cima, folhas boiando longe do ralo
  { from: S("boia"), to: W("boia", "e"), cut: false, flat: true, keys: [k(S("boia"), [1.4, 8.2, 0.4], [0, -1.3, -0.4], 52), k(W("boia", "e"), [0.6, 7.2, 0.8], [0, -1.3, -0.4], 52)] },
  // boia 2: corte de lado, setas no fundo, folhas lá em cima
  { from: W("boia", "e"), to: S("skimmer"), cut: true, keys: [k(W("boia", "e"), [0.2, 2.0, 6.2], [0, -0.7, -0.8], 52), k(A.fundo + 0.2, [0.3, 0.5, 5.4], [0, -1.2, -0.8], 52), k(S("skimmer"), [0.4, 0.3, 5.0], [0, -1.3, -0.8], 52)] },
  // skimmer 1: diagonal de cima para a parede (a boca aparece)
  { from: S("skimmer"), to: W("skimmer", "na"), cut: false, keys: [k(S("skimmer"), [3.6, 1.8, 0.9], [1.6, -0.15, -2], 46), k(W("skimmer", "na"), [2.7, 1.1, 0.2], [1.6, -0.15, -2], 46)] },
  // skimmer 2: rente à água seguindo a folha até a boca
  { from: W("skimmer", "na"), to: S("skimmer") + 4.65, cut: false, keys: [k(W("skimmer", "na"), [-0.2, 0.3, 0.9], [1.4, -0.1, -1.4], 50), k(A.engole + 0.3, [1.0, 0.22, -0.4], [1.6, -0.12, -2], 50), k(S("skimmer") + 4.65, [1.3, 0.25, -0.9], [1.6, -0.12, -2], 50)] },
  // skimmer 3: de cima, tampa aberta mostrando o cesto com as folhas
  { from: S("skimmer") + 4.65, to: S("suga"), cut: false, keys: [k(S("skimmer") + 4.65, [1.7, 1.9, -1.9], [1.6, 0.05, -2.5], 50), k(S("suga"), [1.66, 1.6, -2.05], [1.6, 0.05, -2.55], 48)] },
  // suga 1: câmera subaquática, Tião mergulha
  { from: S("suga"), to: W("suga", "que"), cut: false, under: true, keys: [k(S("suga"), [3.4, -1.25, 1.5], [1.4, -0.6, -0.7], 62), k(W("suga", "que"), [2.6, -1.3, 1.3], [0.5, -1.0, -0.7], 60)] },
  // suga 2: corte de perto no rabo de cavalo preso
  { from: W("suga", "que"), to: S("ralo"), cut: true, keys: [k(W("suga", "que"), [1.6, -0.6, 3.0], [0.4, -1.1, -0.7], 50), k(A.mergulha, [1.1, -0.85, 2.3], [0.3, -1.15, -0.7], 48), k(S("ralo"), [1.0, -0.8, 2.4], [0.3, -1.15, -0.7], 48)] },
  // ralo 1: de cima, o ralo se divide em dois
  { from: S("ralo"), to: W("ralo", "Se"), cut: false, flat: true, keys: [k(S("ralo"), [2.6, 8.6, 0.0], [1.0, -1.6, -0.7], 52), k(W("ralo", "Se"), [3.4, 8.0, 1.0], [1.2, -1.6, -0.7], 52)] },
  // ralo 2: corte em diagonal — mão tapa um ralo, setas vão para o outro
  { from: W("ralo", "Se"), to: W("ralo", "Esse"), cut: true, keys: [k(W("ralo", "Se"), [-1.8, -0.3, 4.4], [0.9, -1.2, -0.7], 52), k(A.alivia, [-1.2, -0.2, 4.8], [1.0, -1.1, -0.7], 52), k(W("ralo", "Esse"), [-0.6, 0.0, 5.4], [1.1, -0.9, -0.7], 52)] },
  // ralo 3: 3/4 acima d'água, Tião sobe sorrindo, os dois ralos brilham
  { from: W("ralo", "Esse"), to: S("flutua"), cut: false, keys: [k(W("ralo", "Esse"), [-4.6, 3.0, 4.6], [0.9, -1.0, -0.7], 50), k(S("flutua"), [-3.6, 2.6, 5.2], [1.0, -0.9, -0.7], 50)] },
  // flutua a: esvaziando
  { from: S("flutua"), to: A.muita - 0.3, cut: false, keys: [k(S("flutua"), [-8, 6, 8], [0, -1, -0.5], 50), k(A.muita - 0.3, [-6, 5.2, 9], [0.5, -1, -0.5], 50)] },
  // flutua b: chuva, baixo
  { from: A.muita - 0.3, to: A.parece, cut: false, look: "rain", keys: [k(A.muita - 0.3, [7.0, 1.6, 7.5], [0, -0.4, -1], 50), k(A.parece, [6.5, 1.3, 8.5], [0, -0.3, -1], 50)] },
  // flutua c: corte, lençol subindo e empurrando
  { from: A.parece, to: A.cima, cut: true, look: "raincut", keys: [k(A.parece, [2.6, 0.6, 10], [2.2, -1.6, -1], 52), k(A.empurra, [1.8, -0.2, 9.5], [1.6, -1.9, -1], 52), k(A.cima, [1.2, 0.2, 10.5], [1.0, -1.4, -1], 52)] },
  // flutua d: plano aberto, elevado e lateral — a piscina inteira sai da terra (desacelera no ápice)
  { from: A.cima, to: S("valvula") + 0.6, cut: false, look: "storm", keys: [k(A.cima, [-11.5, 6.8, 10.5], [0, -0.2, -0.5], 50), k(A.terra, [-9.8, 5.6, 9.2], [0, 0.4, -0.5], 50), k(S("valvula") + 0.6, [-9.4, 5.4, 8.9], [0, 0.5, -0.5], 50)], shake: (t) => 0.03 * prog(t, A.cima + 0.1, A.cima + 0.4) * (1 - prog(t, A.terra, A.terra + 0.6)) },
  // valvula: close no fundo (válvula grande no quadro)
  { from: S("valvula") + 0.6, to: A.aliviaP - 0.2, cut: true, keys: [k(S("valvula") + 0.6, [1.4, 2.4, 5.8], [0, 0.2, -0.3], 50), k(A.valvula + 0.3, [0.35, 1.25, 2.4], [0, 0.0, 0], 46), k(A.aliviaP - 0.2, [0.3, 1.0, 2.6], [0, -0.1, 0], 46)] },
  // valvula: de fora, o casco desce de volta para o lugar
  { from: A.aliviaP - 0.2, to: S("final"), cut: false, keys: [k(A.aliviaP - 0.2, [-9.2, 5.6, 8.6], [0, 0.2, -0.5], 50), k(S("final"), [-7.4, 4.4, 9.6], [0, -0.4, -0.8], 50)] },
  // final: drone de ~7 s recuando e orbitando ao entardecer
  { from: S("final"), to: END, cut: false, look: "dusk", keys: [k(S("final"), [6.5, 4.0, 8.5], [0, -0.4, -1], 50), k(S("final") + 2.2, [6.5, 7.5, 14], [0, -0.2, -2], 52), k(S("final") + 4.6, [-4, 10.5, 17], [0, 0.2, -3], 54), k(END, [-14, 12, 10], [0, 0.2, -2.5], 54)] },
];

const LOOKS = {
  day: { sun: [20, 30, 14] as V3, sky: { top: "#4FA9E6", horizon: "#D8EEF8" }, fog: ["#D8EEF8", 60, 380] as [string, number, number], power: 2.4, amb: 1 },
  rain: { sun: [10, 30, 10] as V3, sky: { top: "#7E8E9E", horizon: "#B9C3CB" }, fog: ["#B9C3CB", 40, 260] as [string, number, number], power: 1.0, amb: 0.85 },
  storm: { sun: [-12, 26, 18] as V3, sky: { top: "#8796A6", horizon: "#C3CCD3" }, fog: ["#C3CCD3", 50, 300] as [string, number, number], power: 1.9, amb: 1 },
  raincut: { sun: [14, 30, 16] as V3, sky: { top: "#7E8E9E", horizon: "#B9C3CB" }, fog: ["#B9C3CB", 40, 260] as [string, number, number], power: 2.0, amb: 1 },
  dusk: { sun: [-28, 9, 16] as V3, sky: { top: "#4F74B8", horizon: "#FFB673" }, fog: ["#F5B47E", 55, 340] as [string, number, number], power: 1.4, amb: 0.7 },
};

// timelapse de dia/noite (sobreposição de cor)
const Timelapse: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const night = Math.max(
    t > A.seguinte - 0.4 && t < A.bebeu + 0.3 ? Math.sin(clamp01((t - (A.seguinte - 0.4)) / (A.bebeu + 0.7 - A.seguinte)) * Math.PI) : 0,
    t > A.semana - 0.3 && t < A.verde + 0.3 ? 0.8 * Math.abs(Math.sin(((t - (A.semana - 0.3)) / (A.verde + 0.6 - A.semana)) * Math.PI * 2)) : 0,
  );
  const rain = t > A.muita - 0.3 && t < A.parece ? 0.18 : t > A.cima && t < S("valvula") + 0.6 ? 0.08 : 0;
  const dusk = t >= S("final") ? 1 : 0;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {night > 0.01 ? <AbsoluteFill style={{ background: "#0B1636", opacity: night * 0.42, mixBlendMode: "multiply" }} /> : null}
      {rain > 0 ? <AbsoluteFill style={{ background: "#33414E", opacity: rain, mixBlendMode: "multiply" }} /> : null}
      {dusk > 0 ? <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(255,160,70,0.42), rgba(255,150,60,0.12) 55%, rgba(60,30,70,0.28))", opacity: interpolate(t, [S("final"), S("final") + 0.6], [0, 1], { extrapolateRight: "clamp" }) }} /> : null}
    </AbsoluteFill>
  );
};

// ---------- legenda própria (contorno grosso + halo escuro, entrada rápida, altura por trecho) ----------
const capY = (t: number) => {
  const p = PLANS.find((q) => t >= q.from && t < q.to);
  if (!p) return 1180;
  if (p.flat || (p.cut && t > S("boia"))) return 1240;
  return 1180;
};
const Legenda: React.FC = () => {
  const cover = useContext(CoverCtx);
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (cover) return null;
  const sec = frame / fps;
  const words = TL.cenas.flatMap((c) => c.words);
  const idx = words.findIndex((w, i) => sec >= w.s && sec < (words.at(i + 1)?.s ?? w.e + 0.35));
  const w = idx >= 0 ? words.at(idx) : undefined;
  if (!w || sec > w.e + 0.6) return null;
  const p = spring({ frame: frame - Math.round(w.s * fps), fps, config: SP.snappy });
  const text = w.w.replace(/[.,:;!?"]+$/g, "").replace(/^["]+/, "");
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          top: capY(sec),
          left: 50,
          right: 50,
          textAlign: "center",
          fontFamily: FONT,
          fontWeight: 800,
          fontSize: w.kw ? 118 : 102,
          lineHeight: 1,
          letterSpacing: -1,
          color: w.kw ? C.accent : "#FFFFFF",
          WebkitTextStroke: `22px ${C.ink}`,
          paintOrder: "stroke fill",
          textShadow: "0 0 28px rgba(0,0,0,0.6), 0 8px 0 rgba(0,0,0,0.35)",
          transform: `translateY(${interpolate(p, [0, 1], [20, 0])}px) scale(${interpolate(p, [0, 1], [0.8, 1])})`,
          opacity: interpolate(frame - Math.round(w.s * fps), [0, 2], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
        }}
      >
        {text}
      </div>
    </AbsoluteFill>
  );
};

// pílula do topo: só a partir do momento em que a peça surge/é nomeada
const PILLS: { label: string; from: number; to: number }[] = [
  { label: "CASCO", from: A.concreto, to: E("casco") + 0.2 },
  { label: "IMPERMEABILIZAÇÃO", from: A.borracha, to: E("impermeabiliza") + 0.2 },
  { label: "FILTRO", from: A.bomba, to: E("filtro") + 0.2 },
  { label: "SKIMMER", from: A.boca, to: E("skimmer") + 0.2 },
  { label: "RALO ANTISSUCÇÃO", from: A.dois, to: E("ralo") + 0.2 },
  { label: "VÁLVULA HIDROSTÁTICA", from: A.valvula, to: E("valvula") + 0.2 },
];
const Pill: React.FC = () => {
  const cover = useContext(CoverCtx);
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (cover) return null;
  const sec = frame / fps;
  const c = PILLS.find((x) => sec >= x.from && sec < x.to);
  if (!c) return null;
  const p = spring({ frame: frame - Math.round(c.from * fps), fps, config: SP.bouncy });
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div style={{ position: "absolute", top: 150, width: "100%", display: "flex", justifyContent: "center" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 18,
            padding: "16px 36px 14px 26px",
            borderRadius: 999,
            background: "rgba(22,24,29,0.9)",
            boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
            fontFamily: FONT,
            fontWeight: 800,
            fontSize: 46,
            letterSpacing: 2,
            color: "#fff",
            transform: `translateY(${interpolate(p, [0, 1], [-40, 0])}px) scale(${interpolate(p, [0, 1], [0.6, 1])})`,
            opacity: interpolate(p, [0, 0.3], [0, 1], { extrapolateRight: "clamp" }),
          }}
        >
          <div style={{ width: 22, height: 22, borderRadius: 11, background: C.accent, boxShadow: `0 0 18px ${C.accent}` }} />
          {c.label}
        </div>
      </div>
    </AbsoluteFill>
  );
};

// tom subaquático nos planos com câmera dentro d'água
const Underwater: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const p = PLANS.find((q) => t >= q.from && t < q.to);
  if (!p?.under) return null;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(120,220,255,0.28), rgba(20,110,190,0.32))", mixBlendMode: "multiply" }} />
      <AbsoluteFill style={{ background: `repeating-linear-gradient(${100 + Math.sin(t) * 4}deg, rgba(255,255,255,0.06) 0 40px, transparent 40px 120px)` }} />
    </AbsoluteFill>
  );
};

export const Piscina: React.FC = () => {
  const cuts = PLANS.slice(1).map((p) => p.from);
  return (
    <TimelineCtx.Provider value={TL}>
      <AbsoluteFill style={{ background: "#CFE6EF" }}>
        {PLANS.map((p, i) => {
          const L = LOOKS[p.look ?? "day"];
          return (
            <Shot key={i} from={p.from} to={p.to} sun={L.sun} shadowSize={p.cut ? 14 : 22} sunPower={L.power} ambient={L.amb} sky={[L.sky.top, L.fog[0]]}>
              {(t) => (
                <>
                  <Cam from={p.from} keys={p.keys} shake={p.shake ? p.shake(t) : 0} />
                  <Scene t={t} cut={p.cut} sky={L.sky} fog={L.fog} flat={p.flat} />
                </>
              )}
            </Shot>
          );
        })}
        <Timelapse />
        <Underwater />
        <SoftFlash at={cuts} />
        <Pill />
        <Legenda />
        <Audio src={staticFile("piscina/narracao.wav")} />
        <Audio src={staticFile("piscina/trilha.wav")} volume={0.9} />
      </AbsoluteFill>
    </TimelineCtx.Provider>
  );
};

export const piscinaDuration = (fps: number) => Math.ceil((TL.duration + 4.6) * fps);
