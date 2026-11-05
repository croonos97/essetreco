import { AbsoluteFill, Audio, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Key } from "../engine/Camera";
import { BigText, CoverCtx, TopLabel } from "../engine/Overlays";
import { useContext } from "react";
import { interpolate, spring } from "remotion";
import { C, ease, FONT, spring as SP } from "../theme";
import { Cam, Shot } from "../engine/Shot";
import { cena, prog, Timeline, TimelineCtx, wordAt } from "../engine/timeline";
import {
  Arrow,
  Battens,
  Boards,
  LoadArrows,
  Puffs,
  Sawdust,
  DemoFrames,
  Drips,
  EaveFall,
  Foil,
  G,
  Gutter,
  HeatArrows,
  HeatWaves,
  House,
  Neighborhood,
  RidgeCap,
  RoofFlow,
  RoofPuddle,
  rpt,
  Stream,
  Thermometer,
  TileAnim,
  Tiles,
  Trusses,
  boardZ,
} from "../three/Telhado";
import { Mood, Pose, Tiao } from "../three/Tiao";
import { RainStreaks } from "../three/World";
import * as THREE from "three";
import timelineJson from "../../public/telhado/timeline.json";

const TL = timelineJson as Timeline;
const S = (id: string) => cena(TL, id).start;
const W = (id: string, w: string, nth = 0) => wordAt(TL, id, w, nth);
type V3 = [number, number, number];

const A = {
  pregar: W("gancho", "pregar"),
  telhado: W("gancho", "telhado"),
  numa: W("peso", "numa"),
  tabuasP: W("peso", "tábuas"),
  que: W("manta", "que"),
  essaManta: W("manta", "essa"),
  chuva: W("empoca", "chuva"),
  empoca: W("empoca", "empoça"),
  pinga: W("empoca", "pinga"),
  cama: W("empoca", "cama"),
  inclina: W("caimento", "inclina"),
  escorre: W("caimento", "escorre"),
  caimento: W("caimento", "caimento"),
  fresta: W("fresta", "fresta"),
  entra: W("fresta", "entra"),
  cobre: W("telhas", "cobre"),
  telhas: W("telhas", "telhas"),
  escama: W("telhas", "escama"),
  pesa: W("peso", "pesa"),
  tres: W("peso", "três"),
  envergam: W("peso", "envergam"),
  monta: W("tesoura", "monta"),
  parece: W("tesoura", "parece"),
  triangulo: W("tesoura", "triângulo"),
  entorta: W("tesoura", "entorta"),
  essaTes: W("tesoura", "essa"),
  tesoura: W("tesoura", "tesoura"),
  escorregar: W("escorrega", "escorregar"),
  troca: W("ripas", "troca"),
  ripas: W("ripas", "ripas"),
  engancha: W("ripas", "engancha"),
  ripas2: W("ripas", "ripas", 1),
  topo: W("topo", "topo"),
  rasgo: W("topo", "rasgo"),
  fecha: W("cumeeira", "fecha"),
  cumeeira: W("cumeeira", "cumeeira"),
  chuva2: W("cortina", "chuva"),
  cai: W("cortina", "cai"),
  porta: W("cortina", "porta"),
  pendura: W("calha", "pendura"),
  leva: W("calha", "leva"),
  essaCalha: W("calha", "essa"),
  calha: W("calha", "calha"),
  sol: W("forno", "sol"),
  esquenta: W("forno", "esquenta"),
  sessenta: W("forno", "sessenta"),
  casaForno: W("forno", "casa"),
  forno: W("forno", "forno"),
  estica: W("manta", "estica"),
  rebate: W("manta", "rebate"),
  manta2: W("manta", "manta", 1),
  parabens: W("final", "parabéns"),
};
const END = TL.duration + 4.6;

const bump = (t: number, at: number, len = 0.75) => (t < at - 0.05 || t > at + len ? 0 : Math.sin((Math.PI * (t - at + 0.05)) / (len + 0.05)));
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

// Estado completo do mundo em função do tempo
export const world = (t: number) => {
  const p = prog(t, A.inclina - 0.05, A.inclina + 0.95);
  const trussFix = prog(t, A.monta + 0.2, A.monta + 1.55);
  const sag = (0.06 * prog(t, A.pesa - 0.1, A.pesa + 0.5) + 1.0 * prog(t, A.tabuasP - 1.0, A.envergam + 0.3, ease.in)) * (1 - trussFix);
  const st = { p, sag };
  const rain1 = prog(t, A.chuva - 0.3, A.chuva + 0.4) * (1 - prog(t, S("telhas") - 0.2, S("telhas") + 0.3));
  const rainTop = prog(t, S("topo") + 1.0, S("topo") + 1.8) * (1 - prog(t, A.fecha, A.fecha + 1.2));
  const rain2 = prog(t, A.chuva2 - 0.6, A.chuva2 + 0.3) * (1 - prog(t, A.calha + 0.2, S("forno") + 0.2));
  const rain = Math.max(rain1, rainTop * 0.8, rain2);
  const heat = prog(t, A.esquenta, A.sessenta + 0.2) * (1 - 0.3 * prog(t, A.rebate, A.rebate + 1.2)) * (1 - prog(t, A.parabens - 0.2, A.parabens + 0.4));
  const hot = prog(t, A.sol - 0.8, A.sol + 0.2) * (1 - prog(t, A.parabens - 0.2, A.parabens + 0.4));
  const sunset = prog(t, A.parabens - 0.2, A.parabens + 0.6);
  const tiles: TileAnim = {
    layStart: A.cobre - 0.1,
    layDur: 3.1,
    slideStart: S("escorrega") + 0.8,
    slideSpread: 2.2,
    backStart: A.ripas + 0.25,
    liftUp: [A.troca - 0.2, A.troca + 0.25],
    liftDown: [A.engancha - 0.5, A.engancha - 0.15],
    heat,
    glow: bump(t, A.telhas),
  };
  return {
    st,
    rain,
    rain1,
    rain2,
    rainTop,
    heat,
    hot,
    sunset,
    tiles,
    puddle: prog(t, A.empoca - 0.5, A.empoca + 0.7) * (1 - prog(t, A.inclina, A.inclina + 0.6)),
    bedDrip: prog(t, A.pinga - 0.25, A.pinga - 0.1) * (t < S("caimento") ? 1 : 0),
    wetBed: prog(t, A.pinga + 0.2, A.cama + 0.6) * (t < S("caimento") + 0.5 ? 1 : 0),
    roofFlow: Math.max(rain1 * prog(t, A.inclina + 0.8, A.escorre), rain2 * 1.0),
    eaveFall: rain1 * prog(t, A.escorre - 0.3, A.escorre + 0.2),
    curtain: rain2 * prog(t, A.cai - 0.3, A.cai + 0.3) * (1 - prog(t, A.pendura + 1.1, A.pendura + 1.7)),
    streams: prog(t, A.fresta - 0.1, A.fresta + 0.4) * (t < S("telhas") ? 1 : 0),
    floorPuddles: prog(t, A.fresta + 0.3, A.entra + 0.5) * (t < S("telhas") ? 1 : 0),
    gutter: prog(t, A.pendura - 0.05, A.pendura + 0.55),
    pipe: prog(t, A.leva - 0.1, A.leva + 0.9, ease.out),
    gutterWater: prog(t, A.pendura + 1.1, A.pendura + 1.7) * rain2,
    foil: prog(t, A.estica - 0.05, A.estica + 2.2, ease.inOut),
    front: prog(t, A.parabens - 0.1, A.parabens + 0.7, ease.out),
    gableBack: p * Math.max(0, 1 - sag / 1.7),
  };
};

const Scene: React.FC<{ t: number }> = ({ t }) => {
  const w = world(t);
  const skyTop = new THREE.Color("#4FA9E6").lerp(new THREE.Color("#6E8597"), w.rain).lerp(new THREE.Color("#2F93E8"), w.hot).lerp(new THREE.Color("#4F78C0"), w.sunset);
  const skyHor = new THREE.Color("#D8EEF8").lerp(new THREE.Color("#B4C2CB"), w.rain).lerp(new THREE.Color("#FFE6BA"), w.hot).lerp(new THREE.Color("#FFBE80"), w.sunset);
  const hex = (c: THREE.Color) => `#${c.getHexString()}`;
  const tiao = tiaoAt(t, w);
  const demoShow = prog(t, A.parece - 0.6, A.parece - 0.2) * (t < S("escorrega") ? 1 : 0);
  return (
    <group>
      <Neighborhood t={t} sky={{ top: hex(skyTop), hor: hex(skyHor) }} fog={hex(skyHor)} />
      <directionalLight position={[6, 22, 4]} intensity={1.3 * w.hot} color="#FFE2A0" />
      <directionalLight position={[-40, 8, 18]} intensity={2.6 * w.sunset} color="#FF8A3A" />
      {w.heat > 0.01 && ((t > A.casaForno - 1 && t < S("manta") + 0.1) || (t > A.essaManta - 0.1 && t < A.essaManta + 1)) ? <pointLight position={[1, 2, 0]} intensity={6 * w.heat * (t > S("manta") ? 1 - prog(t, A.essaManta, A.essaManta + 1.0) : 1)} distance={8} color="#FF7A30" /> : null}
      {t > A.essaManta - 0.1 && t < A.parabens ? <pointLight position={[1, 2, 0]} intensity={4 * prog(t, A.essaManta, A.essaManta + 1.0)} distance={8} color="#7FC4FF" /> : null}
      <House wetBed={w.wetBed} front={w.front} gableBack={w.gableBack} gableFront={w.front} puddles={w.floorPuddles} />
      <Boards
        t={t}
        st={w.st}
        drop={(i) => clamp01((t - (A.pregar + i * 0.13)) / 0.32)}
        gone={(i) => prog(t, A.troca + 0.25 + i * 0.03, A.troca + 0.7 + i * 0.03)}
        glow={bump(t, A.telhado) + bump(t, A.caimento)}
        wet={Math.max(w.rain1, 0) * 0.8}
      />
      <Puffs t={t} land={(i) => A.pregar + i * 0.13 + 0.32} />
      <Sawdust t={t} amount={w.st.sag > 0.15 && t < S("tesoura") + 0.8 ? 1 : 0} st={w.st} />
      <LoadArrows t={t} amount={prog(t, A.numa - 0.6, A.numa) * (1 - prog(t, A.tabuasP - 1.05, A.tabuasP - 1.0))} st={w.st} />
      <RoofPuddle t={t} amount={w.puddle} y={G.H + 0.035} />
      <Tiles t={t} st={w.st} a={w.tiles} />
      <Battens st={w.st} appear={(r, s) => prog(t, A.ripas - 0.35 + r * 0.05 + (s < 0 ? 0.1 : 0), A.ripas - 0.05 + r * 0.05 + (s < 0 ? 0.1 : 0))} glow={bump(t, A.ripas2)} />
      <Trusses piece={(k, j) => clamp01((t - (A.monta - 0.1 + k * 0.2 + j * 0.16)) / 0.3)} glow={bump(t, A.tesoura) + bump(t, A.triangulo) * 0.5} />
      <RidgeCap q={(i) => prog(t, A.fecha + i * 0.09, A.fecha + 0.3 + i * 0.09)} glow={bump(t, A.cumeeira)} heat={w.heat} />
      <Gutter t={t} slide={w.gutter} pipe={w.pipe} water={w.gutterWater} glow={bump(t, A.calha)} />
      <Foil q={w.foil} glow={bump(t, A.manta2)} />
      {/* água */}
      <RoofFlow t={t} st={w.st} amount={t > S("telhas") ? w.rain2 * (t < A.fecha + 0.5 ? 0 : 1) : w.roofFlow} lift={t > S("telhas") ? 0.29 : 0.03} />
      <EaveFall t={t} amount={w.eaveFall} st={w.st} />
      <EaveFall t={t} amount={w.curtain} st={w.st} sides={[1, -1]} heavy={1} />
      <Drips t={t} from={[G.bedX + 0.05, G.H - 0.03, G.bedZ + 0.42]} to={0.74} amount={w.bedDrip} rate={1.7} />
      {[
        [10, 0.9],
        [12, 1.7],
        [13, 2.5],
        [9, 2.1],
      ].map(([i, x], k) => {
        const y = rpt(1, x / Math.cos(G.A), w.st, -0.06).y;
        return <Stream key={k} t={t} from={[x, y, boardZ(i) + 0.15]} to={0.14} amount={w.streams * clamp01(w.streams * 3 - k * 0.4)} seed={k} />;
      })}
      {/* chuva entrando pelo rasgo da cumeeira */}
      {w.rainTop > 0.01 ? <RainStreaks t={t} amount={w.rainTop} box={[-0.18, 0.18, -3.3, 3.3]} top={G.H + 2.2} floor={0.15} n={220} /> : null}
      {w.rain > 0.01 ? <RainStreaks t={t} amount={w.rain} box={[-14, 14, -10, 12]} top={15} floor={0} n={w.rain2 > 0.1 ? 1500 : 900} /> : null}
      {/* splash da cortina */}
      {w.curtain > 0.05
        ? Array.from({ length: 22 }).map((_, i) => {
            const ph = (t * 2.3 + i * 0.137) % 1;
            const z = -3.3 + ((i * 0.31) % 6.6);
            return (
              <mesh key={i} position={[4.15 + Math.sin(i) * 0.2 * ph, 0.05 + Math.sin(ph * Math.PI) * 0.35, z]} scale={0.04 * (1 - ph) * w.curtain}>
                <sphereGeometry args={[1, 6, 5]} />
                <meshStandardMaterial color="#BDE6FF" transparent opacity={0.85} />
              </mesh>
            );
          })
        : null}
      {w.curtain > 0.05 || w.gutterWater > 0.05 ? (
        <mesh position={[4.15, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.9, 7]} />
          <meshStandardMaterial color="#5FB8F0" transparent opacity={0.55 * Math.max(w.curtain, w.rain2 * 0.4)} roughness={0.05} />
        </mesh>
      ) : null}
      {/* calor */}
      <HeatWaves t={t} amount={w.heat * (1 - 0.6 * prog(t, A.estica, A.estica + 1.5)) * (1 - prog(t, A.parabens - 0.5, A.parabens))} area={[-3.8, 3.8, -3.3, 3.3]} y0={RIDGE_Y - 1.4} h={2.2} n={18} />
      <HeatWaves t={t} amount={0.6 * w.heat * prog(t, A.casaForno - 0.6, A.casaForno) * (t < S("manta") ? 1 : t > A.essaManta ? 1 - prog(t, A.essaManta + 0.2, A.essaManta + 1.0) : 0)} area={[-0.3, 3.2, -2.8, -0.9]} y0={0.3} h={1.6} n={10} color="#FF9A3C" />
      <HeatArrows t={t} amount={prog(t, A.esquenta, A.sessenta) * (1 - prog(t, S("manta") - 0.1, S("manta") + 0.3))} mode="through" z={0.6} />
      <HeatArrows t={t} amount={prog(t, A.que - 0.2, A.que + 0.2) * (1 - prog(t, A.essaManta - 0.1, A.essaManta))} mode="bounce" />
      <Thermometer position={[-0.95, 4.25, 2.7]} level={0.2 + 0.75 * prog(t, A.esquenta, A.sessenta + 0.4)} show={prog(t, A.sol, A.sol + 0.4) * (t < S("manta") ? 1 : 0)} scale={1.25} />
      {/* demonstração da tesoura */}
      <DemoFrames
        position={[5.0, 0, 4.4]}
        show={demoShow}
        rack={prog(t, A.parece + 0.35, A.parece + 0.95, ease.in)}
        fallOver={prog(t, A.parece + 0.9, A.parece + 1.25, ease.in)}
        nudge={prog(t, A.triangulo - 0.1, A.triangulo + 0.5)}
        glowTri={0}
      />
      {demoShow > 0 && t < A.parece + 1.0 ? (
        <Arrow position={[4.45 + 0.3 * prog(t, A.parece + 0.1, A.parece + 0.9), 1.25, 4.45]} rot={-Math.PI / 2} color="#E8352B" opacity={prog(t, A.parece, A.parece + 0.2)} scale={0.8} />
      ) : null}
      {demoShow > 0 && t < A.essaTes ? (
        <Arrow
          position={[7.05 + 0.2 * Math.sin(Math.PI * prog(t, A.triangulo - 0.1, A.triangulo + 0.5)), 0.7, 4.45]}
          rot={-Math.PI / 2}
          color="#E8352B"
          opacity={prog(t, A.triangulo - 0.6, A.triangulo - 0.3)}
          scale={0.9}
        />
      ) : null}
      {tiao ? (
        tiao.lying ? (
          <group position={[G.bedX + 0.95, 0.84 + tiao.jump, G.bedZ]} rotation={[0, Math.PI / 2, 0]}>
            <group rotation={[-Math.PI / 2, 0, 0]}>
              <Tiao t={t} scale={0.8} mood={tiao.mood} headLean={tiao.headLean} pose={tiao.pose} />
            </group>
          </group>
        ) : (
          <Tiao
            t={t}
            position={tiao.pos}
            rotation={tiao.rot}
            scale={0.8}
            mood={tiao.mood}
            pose={tiao.pose}
            sit={tiao.sit}
            sweat={tiao.sweat}
            wet={tiao.wet}
            headLean={tiao.headLean}
            armROverride={tiao.push ? [-1.45, 0, 0.1] : undefined}
            armLOverride={tiao.push ? [-1.45, 0, -0.1] : undefined}
          />
        )
      ) : null}
    </group>
  );
};
const RIDGE_Y = rpt(1, 0, { p: 1, sag: 0 }).y;

type TiaoSt = { pos: V3; rot: number; mood: Mood; pose: Pose; sit?: number; sweat?: number; wet?: boolean; headLean?: number; lying?: boolean; jump: number; push?: boolean };
const tiaoAt = (t: number, w: ReturnType<typeof world>): TiaoSt | null => {
  const base = { jump: 0 };
  const floor = 0.13;
  if (t < S("empoca")) return { ...base, pos: [-4.7, 0, 4.9], rot: 2.4, mood: t > A.telhado - 0.2 ? "happy" : "neutral", pose: t > 1.6 && t < A.telhado + 0.6 ? "point" : "down" };
  if (t < S("caimento")) {
    const awake = t > A.pinga + 0.35;
    return { ...base, lying: true, mood: awake ? "shock" : "relaxed", pose: awake ? "up" : "down", headLean: awake ? 0.35 : 0, jump: awake ? 0.12 * Math.max(0, Math.sin((t - A.pinga - 0.35) * 9)) * (t < A.pinga + 0.7 ? 1 : 0) : 0, pos: [0, 0, 0], rot: 0 };
  }
  if (t < S("fresta")) return { ...base, pos: [1.6, floor, 0.2], rot: 0.4, mood: t > A.caimento - 0.3 ? "happy" : "neutral", pose: "down" };
  if (t < S("telhas")) return { ...base, pos: [0.4, floor, -1.1], rot: 0.6, mood: "sad", pose: "down", headLean: -0.35 };
  if (t < S("peso")) return { ...base, pos: [5.4, 0, 4.4], rot: -2.2, mood: "happy", pose: t > A.escama ? "wave" : "down" };
  if (t < S("tesoura")) {
    const scared = t > A.tabuasP - 0.6;
    return { ...base, pos: [-1.75, floor, 0.75], rot: 0.3, mood: scared ? "shock" : "neutral", pose: t > A.envergam ? "up" : "down", headLean: -0.45 };
  }
  if (t < A.parece) {
    const scared = t > A.envergam - 0.2 && t < A.monta + 1.2;
    return { ...base, pos: [1.2, floor, 0.6], rot: 0.3, mood: scared ? "shock" : t > A.monta + 1.2 ? "happy" : "neutral", pose: scared ? "up" : "down", headLean: -0.3 };
  }
  if (t < A.essaTes) {
    const fell = t > A.parece + 1.0;
    return { ...base, pos: [4.45, 0, 4.55], rot: Math.PI / 2, mood: fell ? "shock" : "neutral", pose: "down", push: t > A.parece + 0.2 && t < A.parece + 1.0 };
  }
  if (t < S("escorrega")) return { ...base, pos: [1.9, floor, -1.2], rot: 0.4, mood: "happy", pose: "down", headLean: -0.3 };
  if (t < S("ripas")) {
    const scared = t > A.escorregar - 0.4;
    return { ...base, pos: [6.6, 0, 2.2], rot: -Math.PI / 2 - 0.3, mood: scared ? "shock" : "neutral", pose: scared ? "up" : "down", headLean: -0.2 };
  }
  if (t < S("topo")) return { ...base, pos: [6.0, 0, 3.4], rot: -2.0, mood: "happy", pose: "down" };
  if (t < S("cortina")) {
    const wet = t > S("topo") + 1.6 && t < A.fecha + 1;
    return { ...base, pos: [0.05, floor, 0.9], rot: 0.15, mood: wet ? "sad" : "happy", pose: "down", wet, headLean: -0.35 };
  }
  if (t < S("calha")) {
    const out = prog(t, A.cai, A.cai + 0.9);
    return { ...base, pos: [3.0 + out * 1.3, out > 0.6 ? 0 : floor, 0.8], rot: Math.PI / 2, mood: t > A.cai + 0.6 ? "sad" : "neutral", pose: "down", wet: t > A.cai + 0.6, headLean: t > A.cai + 0.6 ? 0.25 : 0 };
  }
  if (t < S("forno")) {
    const out = prog(t, A.leva + 0.6, A.essaCalha + 0.2);
    return { ...base, pos: [3.0 + out * 2.6, out > 0.3 ? 0 : floor, 0.8 + out * 0.6], rot: Math.PI / 2 - out * 0.9, mood: out > 0.5 ? "happy" : "neutral", pose: t > A.calha - 0.2 ? "wave" : "down" };
  }
  if (t < A.parabens - 0.05) {
    const cool = prog(t, A.essaManta + 0.3, A.essaManta + 1.0);
    return { ...base, pos: [1.25, -0.02, -1.95], rot: 0, mood: cool > 0.5 ? "relaxed" : "sad", pose: "down", sit: 1, sweat: w.heat > 0.3 && cool < 0.5 ? 1 : 0, headLean: 0 };
  }
  return { ...base, pos: [5.6, 0, 5.0], rot: -2.4, mood: "happy", pose: "wave" };
};

// ---------- câmera: planos (cortes secos entre listas) ----------
const k = (t: number, pos: V3, look: V3, fov = 46): Key => ({ t, pos, look, fov });
const shots: Key[][] = [
  [k(0, [13.5, 3.6, 13.0], [0, 1.7, 0], 42), k(2.6, [10.5, 5.2, 10.6], [0, 2.1, 0], 42), k(S("empoca") - 0.03, [7.0, 6.4, 8.6], [0, 2.5, 0], 44)],
  [k(S("empoca"), [5.2, 9.6, 9.2], [-0.3, 2.5, -0.2], 46), k(A.pinga - 0.25, [2.6, 8.4, 7.4], [-0.5, 2.6, -0.4], 44)],
  [k(A.pinga - 0.2, [-0.9, 2.45, 3.9], [-2.2, 0.8, -0.9], 52), k(S("caimento") - 0.03, [-1.3, 2.2, 3.1], [-2.2, 0.85, -0.9], 48)],
  [k(S("caimento"), [3.6, 4.4, 14], [0, 3.0, 0], 52), k(A.escorre - 0.2, [2.4, 4.8, 12.4], [0, 3.3, 0], 52), k(S("fresta") - 0.03, [8.8, 3.3, 8.0], [3.0, 2.5, 0], 48)],
  [k(S("fresta"), [4.2, 5.6, 4.6], [1.5, 3.7, 0.3], 44), k(A.fresta - 0.05, [3.0, 4.9, 2.6], [1.3, 3.75, 0.1], 38)],
  [k(A.fresta, [3.0, 1.5, 2.8], [1.3, 1.7, -0.4], 56), k(S("telhas") - 0.03, [2.8, 1.3, 2.4], [1.3, 1.8, -0.4], 54)],
  [k(S("telhas"), [11.5, 10, 9], [0, 3.3, 0], 50), k(A.escama - 0.2, [4.5, 11.5, 12.5], [0, 3.4, 0], 50)],
  [k(A.escama - 0.15, [4.7, 4.5, 5.3], [1.8, 4.0, -1.2], 36), k(S("peso") - 0.03, [4.4, 4.75, 4.0], [1.5, 4.1, -2.2], 34)],
  [k(S("peso"), [10, 10, 12], [0, 3.3, 0], 48), k(A.tabuasP - 1.03, [6.0, 6.6, 8.4], [0, 3.8, 0], 46)],
  [k(A.tabuasP - 1.0, [1.4, 1.8, 3.2], [0.5, 3.6, 0.2], 56), k(A.envergam - 0.03, [0.9, 1.55, 2.6], [0.3, 3.5, 0], 54)],
  [k(A.envergam, [-0.9, 1.6, 3.7], [-1.9, 2.0, -0.4], 58), k(S("tesoura") - 0.03, [-1.3, 1.4, 3.2], [-1.9, 2.1, -0.4], 56)],
  [k(S("tesoura"), [1.2, 3.7, 10.5], [0, 3.3, 0], 56), k(A.parece - 0.03, [-0.8, 3.4, 9.0], [0, 3.4, 0], 56)],
  [
    k(A.parece, [5.2, 1.5, 8.4], [5.3, 0.8, 4.4], 52),
    k(A.parece + 1.1, [5.6, 1.5, 8.3], [5.7, 0.8, 4.4], 52),
    k(A.triangulo - 0.4, [8.1, 1.45, 8.2], [8.3, 0.8, 4.4], 50),
    k(A.essaTes - 0.03, [8.4, 1.7, 8.0], [8.35, 0.85, 4.4], 48),
  ],
  [k(A.essaTes, [0.9, 2.1, 5.6], [0, 3.6, -3], 62), k(S("escorrega") - 0.03, [-0.7, 2.4, 5.3], [0, 3.6, -3], 62)],
  [k(S("escorrega"), [10.5, 4.2, 6.6], [3.0, 3.3, 0], 48), k(A.escorregar, [10, 3.0, 6.2], [3.8, 2.4, 0.5], 50), k(S("ripas") - 0.03, [9.6, 1.9, 6.6], [4.8, 1.2, 0.5], 52)],
  [k(S("ripas"), [4.4, 4.7, 10.5], [1.8, 3.6, 0], 50), k(A.engancha - 0.03, [3.7, 4.3, 9.0], [2.0, 3.6, 1], 48)],
  [k(A.engancha, [2.9, 3.85, 5.6], [2.25, 3.45, 3.3], 28), k(A.ripas2 - 0.6, [3.0, 3.95, 5.9], [2.25, 3.45, 3.3], 30), k(S("topo") - 0.03, [3.8, 4.6, 7.8], [1.8, 3.7, 1.5], 46)],
  [k(S("topo"), [6.5, 3.0, 7.0], [2, 3.4, 0], 46), k(W("topo", "encontram"), [3.2, 7.0, 5.5], [0, 4.5, 0], 46), k(A.rasgo - 0.03, [1.5, 6.5, 3.4], [0, 4.6, 0.2], 40)],
  [k(A.rasgo, [0.9, 1.9, 6.6], [0, 4.3, 0.8], 56), k(S("cumeeira") - 0.03, [0.5, 2.1, 6.0], [0, 4.4, 0.6], 54)],
  [k(S("cumeeira"), [4.6, 7.8, 7.6], [0, 4.5, -0.5], 46), k(A.cumeeira, [3.0, 7.4, 6.4], [0, 4.5, -1], 44), k(S("cortina") - 0.03, [6.5, 8.5, 8], [0, 4, 0], 48)],
  [k(S("cortina"), [8.6, 1.5, 4.3], [3.6, 1.5, 0.5], 50), k(W("cortina", "cortina"), [7.6, 1.4, 3.3], [3.8, 1.5, 0.6], 48), k(S("calha") - 0.03, [7.1, 1.35, 2.7], [3.9, 1.4, 0.6], 46)],
  [k(S("calha"), [7.3, 3.5, 4.7], [4.0, 2.6, 0], 46), k(A.leva - 0.2, [6.9, 3.3, 1.0], [4.1, 2.4, -1.5], 46), k(A.essaCalha - 0.03, [7.7, 1.4, -0.4], [4.2, 1.0, -3.0], 48)],
  [k(A.essaCalha, [11.2, 3.4, 5.6], [3.5, 2.0, -0.5], 48), k(S("forno") - 0.03, [10.5, 3.8, 4.0], [3.5, 2.3, -0.5], 48)],
  [k(S("forno"), [12.5, 12.5, 12.5], [0, 3, 0], 48), k(A.sessenta, [8.4, 9.4, 10.2], [0.8, 3.0, 0.5], 48), k(A.casaForno - 0.33, [7.4, 7.2, 9.2], [1.0, 2.9, 0.5], 46)],
  [k(A.casaForno - 0.3, [1.9, 1.7, 3.0], [1.3, 1.4, -1.6], 52), k(S("manta") - 0.03, [1.65, 1.45, 2.3], [1.3, 1.3, -1.6], 50)],
  [k(S("manta"), [0.6, 2.1, 1.14], [2.6, 3.7, 1.14], 62), k(A.que - 0.03, [1.0, 2.3, 1.14], [2.8, 3.6, 1.0], 58)],
  [k(A.que, [8.5, 7.8, 10.5], [0, 3.8, 0.5], 48), k(A.essaManta - 0.03, [3.0, 7.4, 12.2], [0, 3.8, 0.8], 48)],
  [k(A.essaManta, [-0.2, 1.45, 2.7], [1.3, 2.0, -1.8], 60), k(A.parabens - 0.03, [0.1, 1.35, 2.2], [1.3, 2.1, -1.8], 58)],
  [k(A.parabens, [9, 6.5, 11], [0, 2.6, 0], 48), k(A.parabens + 2, [12, 7.2, 16.5], [0, 2.8, 0], 50), k(A.parabens + 4.5, [2, 8.6, 23], [0, 2.8, 0], 50), k(END, [-12, 9.2, 21], [0, 2.8, 0], 50)],
];
const KEYS = shots.flat();

// Legenda local: igual à comum, mas com contorno mais grosso, halo escuro e altura por trecho
const capY = (t: number) => ((t > A.envergam - 0.05 && t < S("tesoura")) || (t > A.casaForno - 0.3 && t < S("manta")) ? 420 : t > S("cortina") && t < S("calha") ? 1480 : t > A.essaManta && t < A.parabens ? 1500 : 1180);
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
          fontSize: w.kw ? 116 : 100,
          lineHeight: 1,
          letterSpacing: -1,
          color: w.kw ? C.accent : "#FFFFFF",
          WebkitTextStroke: `22px ${C.ink}`,
          paintOrder: "stroke fill",
          textShadow: "0 0 26px rgba(0,0,0,0.55), 0 8px 0 rgba(0,0,0,0.35)",
          transform: `translateY(${interpolate(p, [0, 1], [24, 0])}px) scale(${interpolate(p, [0, 1], [0.75, 1])})`,
          opacity: interpolate(p, [0, 0.2], [0, 1], { extrapolateRight: "clamp" }),
        }}
      >
        {text}
      </div>
    </AbsoluteFill>
  );
};

const Tint: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const w = world(t);
  const inC = t > A.essaManta && t < A.parabens;
  const inside = t > A.casaForno - 0.3 && t < S("manta") ? 1 : inC ? 1 - prog(t, A.essaManta + 0.2, A.essaManta + 1.0) : 0;
  const cool = inC ? prog(t, A.essaManta + 0.2, A.essaManta + 1.0) : 0;
  return (
    <>
      <AbsoluteFill style={{ background: `rgba(40,60,85,${0.24 * w.rain})`, mixBlendMode: "multiply" }} />
      <AbsoluteFill style={{ background: `rgba(255,120,40,${0.22 * w.hot + 0.18 * inside * w.heat})`, mixBlendMode: "soft-light" }} />
      <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% 70%, rgba(255,90,30,${0.35 * inside * w.heat}), transparent 70%)` }} />
      <AbsoluteFill style={{ background: `rgba(90,170,255,${0.16 * cool})`, mixBlendMode: "soft-light" }} />
      <AbsoluteFill style={{ background: `linear-gradient(180deg, rgba(255,170,90,${0.12 * w.sunset}), rgba(120,80,150,${0.06 * w.sunset}))`, mixBlendMode: "soft-light" }} />
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at center, transparent 62%, rgba(0,0,0,0.18) 100%)" }} />
    </>
  );
};

export const Telhado: React.FC = () => (
  <TimelineCtx.Provider value={TL}>
    <AbsoluteFill style={{ background: "#CFE6EF" }}>
      <Shot from={0} to={END} sun={[9, 16, 8]} shadowSize={14}>
        {(t) => {
          const shake =
            (t > A.envergam - 0.6 && t < A.envergam + 0.9 ? 0.035 : 0) +
            (t > A.escorregar && t < A.escorregar + 1.2 ? 0.012 : 0) +
            (t > A.parece + 1.15 && t < A.parece + 1.4 ? 0.03 : 0);
          return (
            <>
              <Cam from={0} keys={KEYS} shake={shake} />
              <Scene t={t} />
            </>
          );
        }}
      </Shot>
      <Tint />
      <BigText at={A.telhado} until={A.telhado + 1.45} text="O TELHADO MAIS SIMPLES DO MUNDO?" y={380} color="#FFD23F" size={104} />
      <BigText at={A.numa} until={A.tabuasP - 1.0} count={{ to: 3, suffix: " TONELADAS" }} y={430} color="#FFD23F" size={112} />
      <BigText at={A.sessenta} until={A.casaForno - 0.3} text="60°C+" y={620} color="#FF6A2A" size={170} />
      <TopLabel />
      <Legenda />
      <Audio src={staticFile("telhado/narracao.wav")} />
      <Audio src={staticFile("telhado/trilha.wav")} volume={0.9} />
    </AbsoluteFill>
  </TimelineCtx.Provider>
);

export const telhadoDuration = (fps: number) => Math.ceil((TL.duration + 4.6) * fps);
