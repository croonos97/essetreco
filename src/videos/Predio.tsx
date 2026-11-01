// "Como construir um prédio" v4 — 30 cenas, câmera cravada nas palavras do timeline.
// Cada plano (PLANS) monta o seu palco 3D; t = segundos absolutos do vídeo.
import { AbsoluteFill, Audio, getInputProps, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
const OFF = String((getInputProps() as { off?: string }).off ?? "");
import { useContext } from "react";
import { CoverCtx, TopLabel } from "../engine/Overlays";
import { Cam, Shot } from "../engine/Shot";
import { cena, prog, Timeline, TimelineCtx, wordAt } from "../engine/timeline";
import type { Key } from "../engine/Camera";
import { C, ease, FONT, spring as SP } from "../theme";
import {
  Arrow3D,
  B,
  Bolt,
  Building,
  BuildState,
  CityWorld,
  Dust,
  EL,
  Elevator,
  FacadeSparks,
  GroundCracks,
  GroundRings,
  HouseTower,
  LightningRod,
  OtisScene,
  Piles,
  Pump,
  RainStreaks,
  RodPath,
  ShadowFix,
  SoilBlock,
  SparkSpray,
  StairScene,
  stairPos,
  Tank,
  TiaoWalk,
  WaterLine,
  WindLines,
} from "../three/Predio";
import {
  AugerRig,
  BathSection,
  BEAM,
  BeamSet,
  BoredPile,
  BreakWall,
  CISTERN,
  CutSoil,
  DropStack,
  FireSection,
  Flushes,
  GardenTap,
  InfillWalls,
  LeakRoom,
  Lobby,
  OpenTank,
  Puffs,
  RoofWork,
  ShowerSet,
  SinkUnit,
  stairWalk,
  Tag3D,
  ThinArrow,
  ToiletColumn,
  WeightFlow,
} from "../three/Predio4";
import { Glow } from "../three/basics";
import timelineJson from "../../public/predio/timeline.json";

type V3 = [number, number, number];
const TL = timelineJson as Timeline;
const S = (id: string) => cena(TL, id).start;
const W = (id: string, w: string, nth = 0) => wordAt(TL, id, w, nth);
const END = TL.duration + 1.5;
const fr = (x: number) => Math.round(x * 30) / 30;

const bump = (t: number, at: number, len = 0.6) => prog(t, at - 0.1, at + 0.15) * (1 - prog(t, at + len, at + len + 0.4));
const showFrom = (t: number, a: number, b = 999) => prog(t, a, a + 0.35, (x) => x) * (1 - prog(t, b, b + 0.25, (x) => x));

// keys: [t, pos, look, fov, corte seco?]
type KK = [number, V3, V3, number, boolean?];
const K = (list: KK[]): Key[] => {
  const out: Key[] = [];
  list.forEach(([t, pos, look, fov, isCut], i) => {
    if (isCut && i > 0) {
      const p = out[out.length - 1];
      out.push({ t: t - 0.002, pos: p.pos, look: p.look, fov: p.fov });
    }
    out.push({ t, pos, look, fov });
  });
  return out;
};
const cutFirst = (x: KK, i: number): KK => (i === 0 ? [x[0], x[1], x[2], x[3], true] : x);
const samples = (a: number, b: number, dt: number, f: (t: number) => KK): KK[] => {
  const out: KK[] = [];
  for (let t = a; t < b - 1e-4; t += dt) out.push(f(t));
  out.push(f(b));
  return out;
};

// ======================================================================
// Visuais
// ======================================================================
type Look = { sky: [string, string]; sun: V3; power?: number; amb?: number; shadow: number; exp?: number };
const LOOK: Record<string, Look> = {
  day: { sky: ["#4C9FE0", "#D6EBF5"], sun: [70, 100, 60], shadow: 75, exp: 1.08 },
  daySide: { sky: ["#4C9FE0", "#D6EBF5"], sun: [60, 90, 80], shadow: 75, exp: 1.08 },
  close: { sky: ["#4C9FE0", "#D6EBF5"], sun: [40, 60, 50], shadow: 18, exp: 1.08 },
  storm: { sky: ["#1D232C", "#46505C"], sun: [-40, 90, 60], power: 0.7, amb: 0.6, shadow: 75, exp: 1.0 },
  sunset: { sky: ["#4E62A6", "#F6B98C"], sun: [-110, 45, 70], power: 2.6, amb: 0.75, shadow: 75, exp: 1.05 },
  stair: { sky: ["#3A3F46", "#5A6069"], sun: [6, 40, 30], amb: 1.25, shadow: 12, exp: 1.1 },
  sepia: { sky: ["#CDBB98", "#E9DCC0"], sun: [12, 32, 18], shadow: 22, exp: 1.05 },
  room: { sky: ["#BFD9E8", "#E9F2F5"], sun: [6, 14, 10], amb: 1.15, shadow: 12, exp: 1.1 },
  fire: { sky: ["#2A2F38", "#4A505A"], sun: [-8, 20, 22], amb: 1.1, power: 1.6, shadow: 22, exp: 1.08 },
  dim: { sky: ["#2B3344", "#46506A"], sun: [6, 14, 10], amb: 0.7, power: 0.9, shadow: 12, exp: 1.0 },
};

// ======================================================================
// Tempos-chave (palavras)
// ======================================================================
const A = {
  pilares: W("estrutura", "pilares"),
  vigas: W("estrutura", "vigas"),
  derruba: W("reforma", "derruba"),
  pilar: W("reforma", "Pilar"),
  nunca: W("reforma", "nunca"),
  aperto: W("puxao", "aperto"),
  puxao: W("puxao", "puxão"),
  enverga: W("puxao", "enverga"),
  estica: W("puxao", "estica"),
  racha: W("puxao", "racha"),
  barras: W("armado", "barras"),
  embaixo: W("armado", "embaixo"),
  armado: W("armado", "armado"),
  toneladas: W("afunda", "toneladas"),
  fofa: W("afunda", "fofa"),
  afunda: W("afunda", "afunda"),
  tomba: W("afunda", "tomba"),
  firme: W("estacas", "firme"),
  estacas: W("estacas", "estacas"),
  vento: W("balanca", "vento"),
  balanca: W("balanca", "balança"),
  torre: W("nucleo", "torre"),
  nucleo: W("nucleo", "núcleo"),
  escada: W("escada", "escada"),
  degraus: W("escada", "degraus"),
  cabine: W("elevador", "cabine"),
  cabo: W("elevador", "cabo"),
  trilhos: W("elevador", "trilhos"),
  motor: W("elevador", "motor"),
  puxa: W("elevador", "puxa"),
  elevador: W("elevador", "elevador"),
  gigante: W("pesado", "gigante"),
  bloco: W("contrapeso", "bloco"),
  sobe: W("contrapeso", "sobe"),
  contrapeso: W("contrapeso", "contrapeso"),
  arrebentar: W("cabos", "arrebentar"),
  varios: W("cabos", "vários"),
  sozinho: W("cabos", "sozinho"),
  todos: W("freio", "todos"),
  naoCai: W("freio", "cai"),
  garras: W("freio", "Garras"),
  travam: W("freio", "travam"),
  freio: W("freio", "freio"),
  subiu: W("otis", "subiu"),
  cortar: W("otis", "cortar"),
  corda: W("otis", "corda"),
  parado: W("otis", "parado"),
  bomba: W("bomba", "bomba"),
  vizinhos: W("bomba", "vizinhos"),
  subsolo: W("cisterna", "subsolo"),
  cisterna: W("cisterna", "cisterna"),
  luz: W("faltaluz", "luz"),
  para: W("faltaluz", "para"),
  acaba: W("faltaluz", "acaba"),
  topo: W("caixa", "topo"),
  desce: W("caixa", "desce"),
  caixa: W("caixa", "caixa"),
  descarga: W("tubo", "descarga"),
  cano: W("tubo", "cano"),
  queda: W("tubo", "tubo"),
  fedor: W("sifao", "fedor"),
  curva: W("sifao", "curva"),
  guarda: W("sifao", "guarda"),
  sifao: W("sifao", "sifão"),
  vizinho: W("ventilacao", "vizinho"),
  chupa: W("ventilacao", "chupa"),
  volta: W("ventilacao", "volta"),
  segundo: W("ventilacao", "segundo"),
  ar: W("ventilacao", "ar"),
  ventilacao: W("ventilacao", "ventilação"),
  fogo: W("fogo", "fogo"),
  elevF: W("fogo", "Elevador"),
  fumaca: W("fogo", "fumaça"),
  chamine: W("fogo", "chaminé"),
  fecha: W("fogo", "fecha"),
  portas: W("fogo", "portas"),
  emergencia: W("fogo", "emergência"),
  laje: W("laje", "laje"),
  rachaL: W("laje", "racha"),
  chuva: W("laje", "chuva"),
  ultimo: W("laje", "último"),
  cobre: W("laje", "cobre"),
  manta: W("laje", "manta"),
  inclinada: W("laje", "inclinada"),
  ralos: W("laje", "ralos"),
  imper: W("laje", "impermeabilização"),
  alto: W("raio", "alto"),
  raio: W("raio", "raio"),
  ponta: W("raio", "ponta"),
  raio2: W("raio", "raio", 1),
  caboR: W("raio", "cabo"),
  terra: W("raio", "terra"),
  pararaios: W("raio", "para-raios"),
  portaria: W("acabamento", "portaria"),
  interfone: W("acabamento", "interfone"),
  grupo: W("acabamento", "grupo"),
  se1: W("final", "Se"),
  se2: W("final", "Se", 1),
};

// ======================================================================
// 1-2) GANCHO e RACHA: pilha de casas desaba
// ======================================================================
const HOOK_TC = 3.55;
const SetHook: React.FC<{ t: number }> = ({ t }) => {
  const run = Math.max(0, t - 3.4);
  const pos: V3 = run > 0 ? [-5 - 5 * Math.min(run, 2), 0.26, 9 + 7 * Math.min(run, 2)] : [-5, 0.26, 9];
  return (
    <group>
      <ShadowFix size={t < 3.6 ? 75 : 90} />
      <CityWorld t={t} mood="day" plot="dirt" />
      <HouseTower t={t} landK={0.8} brick crush={prog(t, 3.0, 3.45, ease.in)} tilt={0.45 * ease.in(prog(t, 3.2, 3.6))} collapse={t > HOOK_TC ? 1 : 0} tc={HOOK_TC} crack={prog(t, 2.85, 3.45)} />
      <TiaoWalk t={t} position={pos} rotation={run > 0 ? -0.62 : 2.63} mood={t > 1.0 ? "shock" : "neutral"} pose={run > 0 ? "up" : "down"} look={[0, run > 0 ? 0 : 1]} headLean={run > 0 ? 0 : -0.35} legL={run > 0 ? Math.sin(t * 16) * 0.7 : 0} legR={run > 0 ? -Math.sin(t * 16) * 0.7 : 0} helmet />
      <Dust t={t} t0={3.1} origin={[0, 0.3, 4.2]} n={16} spread={6} size={0.9} seed={3} dur={1.4} color="#CDBA98" />
      <Dust t={t} t0={HOOK_TC + 0.45} origin={[18, 0.3, 0]} n={30} spread={30} size={3.5} seed={7} dur={2} color="#D2C3A6" />
      <Dust t={t} t0={HOOK_TC + 0.9} origin={[34, 0.3, 4]} n={36} spread={40} size={4.5} seed={9} dur={2.5} color="#CDBFA4" />
    </group>
  );
};
const RACHA_T0 = S("racha");
const RACHA_SLOW = 11.3;
const tRacha = (t: number) => (t < RACHA_SLOW ? 3.0 + (t - RACHA_T0) : 3.0 + (RACHA_SLOW - RACHA_T0) + (t - RACHA_SLOW) * 0.42);
const RACHA_TC = 3.0 + (RACHA_SLOW - RACHA_T0);
const SetRacha: React.FC<{ t: number }> = ({ t }) => {
  const tt = tRacha(t);
  const telhado = W("racha", "telhado,");
  const vinte = W("racha", "vinte");
  const rachaW = W("racha", "racha,");
  return (
    <group>
      <ShadowFix size={t < 10.25 && t > 8.6 ? 90 : t < 8.6 ? 18 : 90} />
      <CityWorld t={t} mood="day" plot="dirt" />
      <HouseTower t={tt} landK={0.8} brick crush={prog(t, rachaW, rachaW + 0.6, ease.in)} tilt={0.45 * ease.in(prog(t, 11.05, 11.7))} collapse={t > RACHA_SLOW ? 1 : 0} tc={RACHA_TC} crack={prog(t, rachaW - 0.2, rachaW + 0.45)} slow={1} />
      {/* peso das casas de cima descendo na parede de baixo */}
      {[12, 24, 36, 48].map((y, i) => (
        <Arrow3D key={y} position={[4.6, y + ((t * 6) % 6) * -1, 3.2]} dir={[0, -1, 0]} len={5} scale={0.8 * showFrom(t, vinte - 0.2 + i * 0.08, rachaW - 0.3)} color="#FF6A2B" />
      ))}
      <Tag3D position={[0.3, 2.2, 2.7]} text="PAREDE DE TIJOLO" show={showFrom(t, RACHA_T0 + 0.2, telhado - 0.1)} dot="#FF8A1E" />
      <Tag3D position={[0, 4.6, 2.7]} text="TELHADO" show={showFrom(t, telhado, vinte - 0.1)} dot="#3DBE5A" />
      <Tag3D position={[5.6, 40, 3]} text="29 CASAS" show={showFrom(t, vinte, rachaW - 0.3)} dot="#FF3B2B" />
      <Dust t={t} t0={rachaW + 0.1} origin={[0, 0.3, 3.2]} n={14} spread={3} size={0.28} seed={13} dur={1.0} color="#C9A27E" />
      <Dust t={tt} t0={RACHA_TC + 0.45} origin={[18, 0.3, 0]} n={30} spread={30} size={3.5} seed={7} dur={2} color="#D2C3A6" />
      <Dust t={tt} t0={RACHA_TC + 0.9} origin={[34, 0.3, 4]} n={36} spread={40} size={4.5} seed={9} dur={2.5} color="#CDBFA4" />
    </group>
  );
};

// ======================================================================
// 3-4) ESTRUTURA e REFORMA
// ======================================================================
const floorsE = (t: number) => {
  if (t < 14.9) return 0;
  if (t < 15.95) return 0.45 * ease.out(prog(t, 14.95, 15.6));
  if (t < 16.85) return 0.45 + 0.55 * ease.inOut(prog(t, 16.0, 16.7));
  return 1 + 29 * ease.inOut(prog(t, 16.9, 17.9));
};
const SetEstrutura: React.FC<{ t: number }> = ({ t }) => (
  <group>
    <ShadowFix size={75} />
    <CityWorld t={t} mood="day" plot="dirt" />
    <Building t={t} s={{ floors: floorsE(t), glowC: bump(t, A.pilares, 0.7), glowB: bump(t, A.vigas, 0.8) }} />
    <Tag3D position={[6, 3.3, 6.5]} text="COLUNA EM PÉ" show={showFrom(t, 15.0, 16.0)} dot="#FF8A1E" />
    <Tag3D position={[4, 3.4, 6.5]} text="BARRA DEITADA" show={showFrom(t, 16.0, 17.1)} dot="#FF8A1E" />
    <TiaoWalk t={t} position={[10, 0.26, 10]} rotation={-0.8} mood={t > 17 ? "happy" : "neutral"} look={[0, 0.6]} headLean={-0.3} helmet pose={t > A.pilares ? "point" : "down"} />
  </group>
);
const SetReformaFora: React.FC<{ t: number }> = ({ t }) => {
  const seg = W("reforma", "segura");
  return (
    <group>
      <ShadowFix size={40} />
      <CityWorld t={t} mood="day" plot="dirt" />
      <Building t={t} s={{ floors: 30 }} />
      <InfillWalls floors={4} z={6.0} />
      <WeightFlow t={t} amount={prog(t, S("reforma") + 0.05, S("reforma") + 0.5)} floors={4} z={6.45} />
      <Tag3D position={[-0.1, 12.6, 6.6]} text="PESO" show={showFrom(t, S("reforma") + 0.1)} dot="#FFD23F" />
      <Tag3D position={[-1.0, 4.4, 6.6]} text="PAREDE: NÃO SEGURA NADA" show={showFrom(t, seg)} dot="#FF3B2B" />
    </group>
  );
};
const SetReformaDentro: React.FC<{ t: number }> = ({ t }) => {
  const sw = A.derruba - 0.6;
  const armX = t < sw ? -0.25 : t < A.derruba - 0.15 ? -0.25 - 2.65 * ease.out(prog(t, sw, A.derruba - 0.2)) : t < A.pilar ? -2.9 + 1.8 * ease.in(prog(t, A.derruba - 0.15, A.derruba + 0.05)) : t < A.nunca ? -1.1 - 1.8 * ease.out(prog(t, A.pilar, A.pilar + 0.35)) : -2.9 + 2.4 * ease.inOut(prog(t, A.nunca + 0.3, A.nunca + 0.9));
  const turn = prog(t, A.pilar - 0.25, A.pilar + 0.15);
  const p: V3 = [-4 + 1.3 * turn, 0.27, 4.3 + 0.5 * turn];
  const warn = t > A.pilar + 0.2 ? 0.5 + 0.5 * Math.sin(t * 16) : 0;
  return (
    <group>
      <ShadowFix size={20} />
      <CityWorld t={t} mood="day" plot="dirt" />
      <Building t={t} s={{ floors: 30 }} />
      <InfillWalls floors={4} z={6.0} skip={[0]} />
      {/* o vão da esquerda (x -6..-2) do térreo é a parede que será derrubada */}
      <mesh position={[-4, 1.5, 6.0]} visible={false} />
      <BreakWall t={t} tb={A.derruba} position={[-4, 0.27, 6.12]} w={3.3} h={2.45} dir={1} hit={[0.6, 1.3, 0]} />
      <Dust t={t} t0={A.derruba} origin={[-4, 0.3, 6.4]} n={12} spread={2.6} size={0.32} seed={41} dur={1.2} color="#C9A27E" />
      {/* pilar que não se toca: pulsa em vermelho */}
      <mesh position={[-2, 1.6, 6]}>
        <boxGeometry args={[0.74, 2.62, 0.74]} />
        <meshStandardMaterial color="#C6C3BB" emissive="#FF2A1A" emissiveIntensity={warn * 0.7} transparent opacity={warn > 0 ? 1 : 0} depthWrite={warn > 0} />
      </mesh>
      <TiaoWalk
        t={t}
        position={p}
        rotation={0.55 * turn}
        mood={t > A.nunca ? "shock" : t > A.derruba ? "happy" : "neutral"}
        hammer
        helmet
        armROverride={[armX, 0, -0.15]}
        armLOverride={t > A.nunca ? [0, 0, -0.5] : [-0.6, 0, 0.2]}
        legL={turn > 0 && turn < 1 ? 0.3 : 0}
      />
      <Tag3D position={[-2, 2.95, 6.5]} text="PILAR" show={showFrom(t, A.pilar)} dot="#FF3B2B" />
      <pointLight position={[-3, 2.4, 3]} intensity={18} distance={12} color="#FFF4E0" />
    </group>
  );
};

// ======================================================================
// 5-6) VIGA: aperto, puxão, racha — e o concreto armado
// ======================================================================
const beamState = (t: number) => {
  const inArm = t >= S("armado");
  const sag0 = 0.3 * ease.inOut(prog(t, A.enverga - 0.1, A.estica)) + 0.12 * prog(t, A.estica, A.racha);
  const sag = inArm ? 0.42 * (1 - ease.inOut(prog(t, A.embaixo, A.embaixo + 0.7))) : sag0;
  const crack = inArm ? 1 - prog(t, A.embaixo, A.embaixo + 0.6) : ease.out(prog(t, A.racha - 0.1, A.racha + 0.45));
  return {
    sag,
    crack,
    xray: inArm ? prog(t, S("armado") + 0.15, S("armado") + 0.6) * (1 - 0.45 * prog(t, A.armado + 0.3, A.armado + 0.8)) : 0,
    rebar: inArm ? prog(t, A.barras - 0.05, A.barras + 0.95, (x) => x) : 0,
    stirrup: inArm ? prog(t, A.barras + 0.8, A.embaixo + 0.1) : 0,
    load: prog(t, S("puxao") - 0.05, S("puxao") + 0.5, (x) => x),
  };
};
const SetBeam: React.FC<{ t: number }> = ({ t }) => {
  const s = beamState(t);
  const inArm = t >= S("armado");
  const yTop = BEAM.y0 + BEAM.h - 0.08, yBot = BEAM.y0 + 0.1;
  const sg = s.sag * 0.75;
  const ap = inArm ? 0.9 : prog(t, A.aperto - 0.2, A.aperto + 0.3);
  const pu = inArm ? 1 : prog(t, A.puxao - 0.2, A.puxao + 0.3);
  const stretch = 1 + (inArm ? 0 : 0.35 * prog(t, A.estica - 0.2, A.estica + 0.4));
  const zf = BEAM.d / 2 + 0.12;
  return (
    <group>
      <ShadowFix size={16} />
      <CityWorld t={t} mood="day" plot="dirt" />
      <group position={[0, 0.27, 2]}>
        <BeamSet t={t} sag={s.sag} crack={s.crack} xray={s.xray} rebar={s.rebar} stirrup={s.stirrup} load={s.load} glowBeam={bump(t, A.armado, 0.8)} glowSteel={bump(t, A.barras, 0.7) + bump(t, A.armado, 0.8)} />
        <ThinArrow a={[-3.7, yTop - sg, zf]} b={[-0.5, yTop - sg, zf]} p={ap} color="#2F7BFF" />
        <ThinArrow a={[3.7, yTop - sg, zf]} b={[0.5, yTop - sg, zf]} p={ap} color="#2F7BFF" />
        <ThinArrow a={[-0.4, yBot - sg, zf]} b={[-3.2 * stretch, yBot - sg, zf]} p={pu} color="#FF3B2B" />
        <ThinArrow a={[0.4, yBot - sg, zf]} b={[3.2 * stretch, yBot - sg, zf]} p={pu} color="#FF3B2B" />
        <Tag3D position={[0, yTop + 0.5 - sg, zf]} text="APERTO" show={inArm ? 0 : showFrom(t, A.aperto)} dot="#2F7BFF" />
        <Tag3D position={[0, yBot - 0.55 - sg, zf]} text="PUXÃO" show={showFrom(t, A.puxao)} dot="#FF3B2B" />
        <Tag3D position={[1.4, yBot - 0.25 - sg, zf]} text="RACHOU!" show={inArm ? 0 : showFrom(t, A.racha + 0.1)} dot="#FF3B2B" dark />
        <Tag3D position={[-1.6, yBot - 0.5, zf]} text="AÇO" show={showFrom(t, A.embaixo - 0.1)} dot="#FF8A1E" />
        {t < S("armado") ? <Dust t={t} t0={A.racha} origin={[0, BEAM.y0 - 0.1, 0.4]} n={6} spread={1.0} size={0.08} seed={51} dur={0.5} color="#BDB6A8" /> : null}
        <TiaoWalk t={t} position={[2.3, 0, 0.6]} rotation={-0.5} helmet mood={t > A.racha && !inArm ? "shock" : inArm && t > A.armado ? "happy" : "neutral"} look={[-0.4, 1]} headLean={-0.45} pose={inArm && t > A.armado ? "up" : "down"} />
      </group>
    </group>
  );
};

// ======================================================================
// 7-8) SOLO: afunda e tomba; estacas escavadas
// ======================================================================
const SetSoil: React.FC<{ t: number }> = ({ t }) => {
  const inE = t >= S("estacas");
  const sink = inE ? -8 : -8 * ease.in(prog(t, A.afunda - 0.1, A.tomba + 0.2));
  const tiltA = 0.2 * ease.in(prog(t, A.tomba - 0.25, A.tomba + 0.45));
  const lift = prog(t, S("estacas") + 0.05, S("estacas") + 0.6);
  const land = prog(t, A.estacas - 0.45, A.estacas - 0.05, ease.in);
  const y = !inE ? sink : t < A.estacas - 0.45 ? -8 + 24 * ease.inOut(lift) : 16 - 16 * land;
  const tilt = !inE ? tiltA : 0.2 * (1 - lift);
  const ghost = !inE ? 1 : 1 - 0.72 * prog(t, S("estacas"), S("estacas") + 0.35) + 0.72 * prog(t, A.estacas - 0.3, A.estacas - 0.05);
  const drill0 = W("estacas", "enche"), metros = W("estacas", "metros,");
  const hole = 23.5 * prog(t, drill0 + 0.15, A.firme, (x) => x);
  const out = prog(t, A.firme + 0.05, A.firme + 0.5);
  const fillMain = 23.5 * prog(t, A.firme + 0.25, A.firme + 0.85, (x) => x);
  const others = (k: number) => 23.5 * prog(t, A.firme + 0.55 + k * 0.15, A.firme + 0.95 + k * 0.15, (x) => x);
  const rigX = -18 + 16 * ease.out(prog(t, S("estacas") + 0.2, drill0 + 0.2)) - 16 * ease.in(prog(t, A.firme + 0.55, A.firme + 1.0));
  const pushDown = !inE ? prog(t, A.toneladas, A.toneladas + 0.4) * (1 - prog(t, A.afunda - 0.2, A.afunda)) : 0;
  return (
    <group>
      <ShadowFix size={90} />
      <CityWorld t={t} mood="day" zMax={6} ground={false} />
      <SoilBlock glowRock={bump(t, A.firme, 0.9)} settle={!inE ? prog(t, A.fofa, A.fofa + 0.5) : 0} />
      <group position={[-7.2, y, 0]} rotation={[0, 0, -tilt]}>
        <group position={[7.2, 0, 0]}>
          <Building s={{ floors: 30, ghost }} t={t} />
        </group>
      </group>
      {inE ? (
        <>
          <BoredPile x={-2} hole={t < A.firme + 1.2 ? hole : 0} fill={fillMain} glow={bump(t, A.estacas, 0.9)} />
          {[-6, 2, 6].map((x, k) => (
            <BoredPile key={x} x={x} hole={0} fill={others(k)} glow={bump(t, A.estacas, 0.9)} />
          ))}
          {t < A.firme + 1.1 ? <AugerRig x={rigX} depth={hole} t={t} spin={t < A.firme ? 1 : 0.3} lift={23.5 * ease.inOut(out)} /> : null}
          {t > drill0 && t < A.firme ? <Dust t={t} t0={drill0 + 0.2} origin={[-2, 0.4, 6.6]} n={12} spread={2} size={0.6} seed={33} dur={3} color="#8A6648" /> : null}
          <Tag3D position={[-14, -30, 6.4]} text="CHÃO FIRME" show={showFrom(t, A.firme)} dot="#3DBE5A" />
          <Tag3D position={[2.4, -12, 6.4]} text="DEZENAS DE METROS" show={showFrom(t, metros - 0.4, A.firme)} dot="#FF8A1E" />
        </>
      ) : (
        <>
          <Piles depths={[0, 0, 0, 0]} />
          {[-4, 0, 4].map((x, i) => (
            <Arrow3D key={x} position={[x, 108 - ((t * 5 + i) % 4), 7]} dir={[0, -1, 0]} len={8} scale={1.6 * showFrom(t, A.toneladas - 0.2, A.afunda - 0.2)} color="#FF6A2B" />
          ))}
          {[-5, 0, 5].map((x, i) => (
            <Arrow3D key={`s${x}`} position={[x, -3 - ((t * 3 + i * 0.4) % 2), 6.6]} dir={[0, -1, 0]} len={4} scale={0.7 * pushDown} color="#FF3B2B" />
          ))}
          <Tag3D position={[0, 104, 7]} text="MILHARES DE TONELADAS" show={showFrom(t, A.toneladas - 0.1, A.afunda)} dot="#FF8A1E" />
          <Tag3D position={[-13, -9, 6.4]} text="TERRA FOFA" show={showFrom(t, A.fofa - 0.2)} dot="#FF3B2B" />
          <GroundCracks p={prog(t, A.afunda, A.tomba + 0.3)} />
          <Dust t={t} t0={A.afunda + 0.05} origin={[0, 0.4, 6.6]} n={20} spread={12} size={2.2} seed={45} dur={1.4} color="#BCA98C" />
        </>
      )}
    </group>
  );
};

// ======================================================================
// 9-10) VENTO e NÚCLEO
// ======================================================================
const swayT = (t: number) => {
  const e1 = prog(t, A.vento, A.vento + 0.6) * (1 - prog(t, S("nucleo") + 0.3, A.torre));
  const e2 = prog(t, 52.4, 52.7) * (1 - prog(t, 54.6, 55.0));
  return 6.5 * Math.sin(2 * Math.PI * 0.62 * (t - A.vento)) * e1 + 0.35 * Math.sin(2 * Math.PI * 1.2 * (t - 52.4)) * e2;
};
const SetWind: React.FC<{ t: number }> = ({ t }) => {
  const inN = t >= S("nucleo");
  const sw = swayT(t);
  const wind = inN ? prog(t, 52.3, 52.5) * (1 - prog(t, 54.5, 54.8)) : prog(t, A.vento - 0.2, A.vento + 0.2);
  const core = inN ? B.coreTop * ease.inOut(prog(t, S("nucleo") + 0.4, 52.1)) : 0;
  const sick = inN ? 1 - prog(t, 52.6, 53.4) : prog(t, A.balanca - 0.5, A.balanca + 0.2);
  return (
    <group>
      <ShadowFix size={75} />
      <CityWorld t={t} mood="day" plot="dirt" />
      <Building t={t} s={{ floors: 30, sway: sw, core, coreGlow: bump(t, A.nucleo, 0.8) }} />
      <group position={[sw + 1.2, B.top, 4.6]} rotation={[0, 0, -Math.atan2(sw * 2 / B.top, 1) * 0.8]}>
        <TiaoWalk t={t} rotation={0.4} mood={sick > 0.4 ? "sad" : inN && t > 53 ? "happy" : "neutral"} sick={sick} sweat={sick} armLOverride={sick > 0.4 ? [-1.0, 0, 0.5] : undefined} armROverride={sick > 0.4 ? [-1.0, 0, -0.5] : undefined} lean={sick * 0.3} pose={inN && t > 53.5 ? "up" : "down"} helmet />
      </group>
      {wind > 0 ? (
        <group>
          <WindLines t={t} amount={wind} />
          {[58, 72, 86].map((y, i) => (
            <Arrow3D key={y} position={[-22 + ((t * 1.3 + i * 0.3) % 1) * 5, y, 4]} dir={[1, 0, 0]} len={7} scale={2.0 * wind} color="#2F7BFF" />
          ))}
          <Tag3D position={[-26, 92, 4]} text="VENTO" show={wind} dot="#2F7BFF" />
        </group>
      ) : null}
      {inN ? <Tag3D position={[0, core + 2, 2.4]} text="TORRE OCA" show={showFrom(t, A.torre, 52.3)} dot="#FF8A1E" /> : null}
    </group>
  );
};

// ======================================================================
// 11) ESCADA: 500 degraus
// ======================================================================
const uStair = (t: number) => {
  const m = A.degraus;
  if (t < 56.6) return 0.5;
  if (t < m) return 0.5 + 1.3 * prog(t, 56.6, m, (x) => x);
  if (t < 58.45) return 14.6 + 0.9 * prog(t, m, 58.45, (x) => x);
  if (t < 58.8) return 29.2 + 0.6 * prog(t, 58.45, 58.8, (x) => x);
  return 29.8;
};
const degrauN = (t: number) => Math.max(0, Math.round((uStair(t) - 0.5) * 16.83));
const SetStair: React.FC<{ t: number }> = ({ t }) => {
  const u = uStair(t);
  const climbing = t > 56.6 && t < 58.8;
  return (
    <group>
      <StairScene t={t} u={u} sit={t > 58.8 ? 1 : 0} sweat={t < 57.9 ? 0.2 : t < 58.45 ? 0.7 : 1} mood={t > 58.4 ? "sad" : t > 57.9 ? "sad" : "neutral"} walk={climbing ? 1 : 0} />
      <pointLight position={[0.5, stairPos(u).p[1] + 3, 3]} intensity={40} distance={20} color="#FFF4E0" />
      
    </group>
  );
};

// ======================================================================
// 12-16) ELEVADOR: cabine, cabo, trilhos, motor; gente; contrapeso; cabos; freio
// ======================================================================
const BREAK_Y = 60 + EL.cabH + 0.55 + 1.6;
const STR = [75.0, 75.1, 75.18, 75.25, 75.31, 75.36, 75.41];
const ROPE_SNAP = [80.0, 80.08, 80.16, 80.25, 80.34, 80.43];
const FALL0 = 80.5, BRK0 = 82.2, BRK1 = 82.6;
const RPL0 = S("freio") + 3.4; // replay do freio (Garras)
const ycT = (t: number) => {
  if (t < S("elevador")) return 40;
  if (t < S("pesado")) return t < A.puxa ? 40 : 40 + 18 * ease.inOut(prog(t, A.puxa, A.puxa + 1.5));
  if (t < S("contrapeso")) return 10 + (t > 67.2 ? Math.sin(t * 40) * 0.03 : 0) + 0.15 * prog(t, 67.2, 67.9);
  if (t < S("cabos")) return 10.15 + 49.85 * ease.inOut(prog(t, A.sobe - 0.2, A.sobe + 1.7));
  if (t < S("freio")) {
    if (t < STR[6] + 0.03) return 60;
    if (t < S("cabos") + 1.6) return 60 - 3 * (t - STR[6] - 0.03) ** 2;
    return 60;
  }
  if (t < FALL0) return 60;
  if (t < BRK0) return 60 - 3.5 * (t - FALL0) ** 2;
  const y1 = 60 - 3.5 * (BRK0 - FALL0) ** 2, v1 = 7 * (BRK0 - FALL0);
  if (t < BRK1) {
    const d = t - BRK0, a = v1 / (BRK1 - BRK0);
    return y1 - v1 * d + 0.5 * a * d * d;
  }
  const yStop = y1 - (v1 * (BRK1 - BRK0)) / 2;
  if (t < RPL0) return yStop;
  // replay em câmera lenta das garras
  const r0 = yStop + 2.4;
  const tb = A.travam - 0.2;
  if (t < tb) return r0 - 1.5 * (t - RPL0);
  const yb = r0 - 1.5 * (tb - RPL0);
  if (t < tb + 0.35) {
    const d = t - tb, a = 1.5 / 0.35;
    return yb - 1.5 * d + 0.5 * a * d * d;
  }
  return yb - (1.5 * 0.35) / 2;
};
// janelas de "raio-x" (prédio e núcleo translúcidos) nos planos abertos do elevador
const XR: [number, number, number, number][] = [
  [S("elevador"), S("elevador") + 1.45, 0.3, 0.22],
  [A.trilhos - 0.45, A.motor - 0.2, 1, 0.3],
  [63.0, S("pesado"), 1, 0.25],
  [67.0, 69.75, 1, 0.25],
  [71.6, S("cabos"), 0.4, 0.22],
  [81.28, BRK0 - 0.11, 0.4, 0.22],
  [A.freio - 0.35, S("otis"), 0.45, 0.25],
];
const xrayT = (t: number) => {
  const w = XR.find(([a, b]) => t >= a && t < b);
  return w ? { b: w[2], c: w[3] } : { b: 1, c: 1 };
};
const SetElevator: React.FC<{ t: number }> = ({ t }) => {
  const yc = ycT(t);
  const xr = xrayT(t);
  const sE = S("elevador"), sP = S("pesado"), sC = S("contrapeso"), sK = S("cabos"), sF = S("freio");
  const inCabos = t >= sK && t < sF;
  const inFreio = t >= sF;
  const replay = t >= RPL0;
  // cabos
  let ropes = 3;
  let alive: number[] | undefined;
  let rglow: number[] | undefined;
  let strands: number[] | undefined;
  let broken = 0;
  if (inCabos) {
    if (t < A.varios - 0.5) {
      strands = STR;
      broken = 0;
    } else {
      ropes = 6;
      alive = Array.from({ length: 6 }, (_, i) => {
        const pin = prog(t, A.varios - 0.3 + i * 0.12, A.varios - 0.1 + i * 0.12, (x) => x);
        const fade = i === 2 ? 0 : 0.85 * prog(t, A.sozinho - 0.4, A.sozinho + 0.2);
        return pin * (1 - fade);
      });
      rglow = Array.from({ length: 6 }, (_, i) => bump(t, A.varios - 0.2 + i * 0.12, 0.3) + (i === 2 ? prog(t, A.sozinho - 0.4, A.sozinho) * 1.2 : 0));
    }
  }
  if (inFreio) {
    ropes = 6;
    alive = ROPE_SNAP.map((s2) => (t < s2 ? 1 : 0));
    broken = 0;
  }
  const strandsBroken = inCabos && t >= STR[6] && t < A.varios - 0.5;
  const claw = !inFreio ? 0 : !replay ? prog(t, BRK0 - 0.05, BRK0 + 0.05) : prog(t, A.garras + 0.3, A.travam - 0.15, ease.out);
  const sparks = !inFreio ? 0 : !replay ? (t >= BRK0 && t < BRK1 ? 1 : t >= BRK1 ? 1 - prog(t, BRK1, BRK1 + 0.3) : 0) : t >= A.travam - 0.25 && t < A.travam + 0.15 ? 1 : t >= A.travam + 0.15 ? 1 - prog(t, A.travam + 0.15, A.travam + 0.6) : 0;
  const speed = inFreio && !replay && t > FALL0 && t < BRK1 ? Math.min(1, (t - FALL0) * 1.2) : replay && t < A.travam ? 0.6 : inCabos && t > STR[6] && t < A.varios - 0.5 ? 0.6 : 0;
  const full = t >= sP;
  const falling = inFreio && !replay && t > FALL0 && t < BRK1;
  const rider = !full
    ? { mood: "neutral" as const, pose: "down" as const }
    : falling
      ? { mood: "shock" as const, pose: "up" as const, arms: true, hop: 0.35 + Math.sin(t * 9) * 0.05 }
      : inFreio && t >= BRK1
        ? { mood: (t > A.freio ? "happy" : "relaxed") as "happy", pose: "down" as const, sit: 1, sweat: 1 }
        : inFreio && t < FALL0 && t > A.todos
          ? { mood: "shock" as const, pose: "down" as const, look: [0, 1] as [number, number] }
          : { mood: "sad" as const, pose: "down" as const, sweat: 0.8 };
  const cw = t < sC ? 0 : prog(t, A.bloco - 0.4, A.bloco + 0.3);
  const motorScale = t >= sP && t < sC + 0.6 ? 1 + 2.2 * ease.out(prog(t, A.gigante - 0.1, A.gigante + 0.4)) * (1 - ease.inOut(prog(t, sC, sC + 0.5))) : 1;
  const heat = t >= sP && t < sC + 0.4 ? prog(t, 66.9, 67.6) * (1 - prog(t, sC, sC + 0.4)) : 0;
  return (
    <group>
      <ShadowFix size={75} />
      {OFF.includes("city") ? null : <CityWorld t={t} mood="day" plot="dirt" />}
      {OFF.includes("bld") ? null : <Building t={t} s={{ floors: 30, core: B.coreTop, cut: true, cutLeft: inFreio && (t > BRK0 - 0.1 || replay), ghost: xr.b, coreGhost: xr.c, coreDark: true }} />}
      {OFF.includes("elev") ? null : <Elevator
        t={t}
        yc={yc}
        appear={t < sP ? prog(t, sE + 0.3, sE + 0.7, ease.out) : 1}
        ropeLen={t < sP ? prog(t, A.cabo - 0.15, A.cabo + 0.6) : 1}
        rails={t < sP ? prog(t, A.trilhos - 0.5, A.trilhos + 0.1) : 1}
        claw={claw}
        broken={broken}
        breakAt={BREAK_Y}
        whip={strandsBroken ? Math.min(22, (t - STR[6]) * 7) : 0}
        strands={strands}
        ropes={ropes}
        ropeAlive={alive}
        ropeGlowArr={rglow}
        glowCab={bump(t, A.cabine) + bump(t, A.elevador, 0.8)}
        glowCable={bump(t, A.cabo, 0.7) + bump(t, A.elevador, 0.8) + bump(t, W("contrapeso", "cabo"), 0.6)}
        glowCw={bump(t, A.bloco + 0.2, 0.7) + bump(t, A.contrapeso, 0.8)}
        glowClaw={bump(t, A.garras, 0.8) + bump(t, A.freio, 0.9)}
        glowRail={bump(t, A.trilhos, 0.8) + bump(t, W("freio", "trilhos"), 0.7)}
        sparks={sparks}
        speed={speed}
        crowd={full && !OFF.includes("crowd") ? 5 : 0}
        cw={cw}
        motorScale={motorScale}
        motorHeat={heat}
        motorGlow={bump(t, A.motor, 0.8)}
        rider={OFF.includes("crowd") ? undefined : rider}
      />}
      {/* fumaça do motor */}
      {heat > 0.05 ? <Puffs t={t} pts={[[0.35, 92.2, -0.7], [0.5, 95, -0.4], [1.2, 99, 0]]} amount={heat} n={26} size={0.55 * motorScale} color="#5A5D62" speed={0.5} seed={61} wobble={1.2} /> : null}
      {/* faíscas dos cabos estourando */}
      {inFreio && !replay
        ? ROPE_SNAP.map((s2, i) => (t > s2 && t < s2 + 0.3 ? <SparkSpray key={i} t={t} origin={[EL.sheaveX - EL.sheaveR, BREAK_Y, (i / 5 - 0.5) * 0.5]} amount={1} n={14} spread={0.4} scale={0.4} seed={70 + i} /> : null))
        : null}
      {inFreio && !replay && t > ROPE_SNAP[0] && t < ROPE_SNAP[5] + 0.25 ? <Glow position={[EL.sheaveX - EL.sheaveR, BREAK_Y, 0.2]} size={1.2} color="#FFE2A0" opacity={0.9} /> : null}
      {/* luzes do poço */}
      <pointLight position={[-0.5, yc + 6, 1.4]} intensity={80} distance={20} color="#FFF2DD" />
      {t >= sP && t < sC + 0.6 ? <pointLight position={[3, 93, 4]} intensity={30} distance={14} color="#FFF2DD" /> : null}
      {/* etiquetas */}
      <Tag3D position={[EL.railL - 0.3, yc + 1.4, 0.4]} text="TRILHO" show={t < sP ? showFrom(t, A.trilhos, A.trilhos + 1.0) : replay ? showFrom(t, W("freio", "trilhos")) : 0} dot="#2F7BFF" />
      <Tag3D position={[EL.sheaveX, EL.sheaveY + 1.8, 0]} text="MOTOR" show={t < sP ? showFrom(t, A.motor, A.puxa + 0.5) : 0} dot="#FF8A1E" />
      <Tag3D position={[EL.cwX + 0.6, cw > 0 ? 86.2 - yc - 1.2 : 0, 0.8]} text="BLOCO DE FERRO" show={t >= sC && t < 71.6 ? showFrom(t, A.bloco, 71.6) : 0} dot="#FF8A1E" />
      <Tag3D position={[EL.sheaveX - EL.sheaveR + 0.4, yc + 6.2, 0.4]} text="1 CABO AGUENTA" show={inCabos ? showFrom(t, A.sozinho - 0.2) : 0} dot="#3DBE5A" />
      <Tag3D position={[EL.cabX - 1.6, yc + 1.3, 1.3]} text="CABINE" show={t < sP ? showFrom(t, A.cabine - 0.1, A.cabo - 0.1) : t >= 71.6 && t < S("cabos") ? showFrom(t, 71.7) : 0} dot="#FF8A1E" />
      <Tag3D position={[EL.cwX + 1.4, 86.2 - yc - 1.3, 1.0]} text="CONTRAPESO" show={t >= 71.6 && t < S("cabos") ? showFrom(t, 71.8) : 0} dot="#FF3B2B" />
      <Tag3D position={[-1.6, yc - 0.5, 0.5]} text="GARRAS" show={replay ? showFrom(t, A.garras) : 0} dot="#FF3B2B" />
    </group>
  );
};

// ======================================================================
// 17) OTIS, 1854 (sépia)
// ======================================================================
const SetOtis: React.FC<{ t: number }> = ({ t }) => {
  const up0 = A.subiu + 0.1;
  const tCut = A.corda;
  const hp = t < up0 ? 0.35 : t < tCut ? 0.35 + 10.7 * ease.inOut(prog(t, up0, up0 + 1.3)) : 11.05 - 0.5 * ease.in(prog(t, tCut, tCut + 0.12)) + (t > tCut + 0.12 ? Math.exp(-(t - tCut - 0.12) * 10) * Math.sin((t - tCut - 0.12) * 40) * 0.04 : 0);
  const axe = t < A.cortar ? 0 : t < tCut - 0.25 ? -0.45 * ease.out(prog(t, A.cortar, tCut - 0.25)) : -0.45 + 0.75 * ease.in(prog(t, tCut - 0.25, tCut));
  return (
    <group>
      <ShadowFix size={24} far={120} />
      <OtisScene t={t} hp={hp} cut={t >= tCut ? 1 : 0} tCut={tCut} axe={axe} lock={prog(t, tCut + 0.1, tCut + 0.18)} cheer={prog(t, A.parado - 0.1, A.parado + 0.3)} hat={t > tCut + 0.4 ? 1 : 0} />
    </group>
  );
};

// ======================================================================
// 18-22) ÁGUA: rua, bomba, vizinhos, cisterna, apagão, caixa d'água
// ======================================================================
const PA: V3[] = [
  [-3, 0.5, 21.0],
  [-3, 0.5, 10.0],
  [-3, 0.5, 2.7],
  [-3, 87.55, 2.7],
  [-3, 87.55, 1.95],
];
const PCX: V3[] = [
  [-3, 0.5, 21.0],
  [-3, 0.5, 10.0],
  [-3, 0.5, 2.7],
  [-3, 97.4, 2.7],
  [-3, 97.4, 1.0],
  [-1.6, 97.4, 1.0],
];
const PB: V3[] = [
  [2.9, 94.2, 1.2],
  [3.0, 94.2, 2.7],
  [3.0, 1.0, 2.7],
];
const lenOf = (p: V3[]) => p.slice(1).reduce((s, q, i) => s + Math.hypot(q[0] - p[i][0], q[1] - p[i][1], q[2] - p[i][2]), 0);
const LA = lenOf(PA), LCX = lenOf(PCX), LB = lenOf(PB);
const STOP = 11 + 7.3 + 9.0;
const fillPA = (t: number) => {
  const a0 = W("agua", "rua") - 0.3;
  if (t < A.bomba) return STOP * prog(t, a0, a0 + 0.9, ease.out);
  return STOP + (LA - STOP) * ease.inOut(prog(t, A.bomba + 0.5, A.bomba + 1.4));
};
const sinkFlow = (t: number) => (t < S("bomba") ? 0 : prog(t, A.bomba + 1.35, A.bomba + 1.5));
const fillCX = (t: number) => LCX * ease.inOut(prog(t, W("caixa", "enche") - 0.2, A.topo + 0.1));
const fillPB = (t: number) => LB * ease.inOut(prog(t, A.desce - 0.2, A.desce + 1.1));

const Branches: React.FC<{ front: number }> = ({ front }) => (
  <group>
    {Array.from({ length: 29 }).map((_, i) => {
      const y = (i + 1) * 3 + 1.0;
      const wet = front <= y;
      return (
        <group key={i}>
          <mesh position={[3.9, y, 2.7]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.11, 0.11, 1.8, 8]} />
            <meshStandardMaterial color={wet ? "#3FA8F0" : "#A9B4BC"} emissive={wet ? "#1E8ED6" : "#000"} emissiveIntensity={wet ? 0.6 : 0} roughness={0.3} />
          </mesh>
          {wet ? <Glow position={[4.8, y, 2.8]} size={1.1} color="#7FD3FF" opacity={0.55} /> : null}
        </group>
      );
    })}
  </group>
);

// elevador parado no prédio cortado (cenas de água/esgoto)
const IdleElevator: React.FC<{ t: number }> = ({ t }) => <Elevator t={t} yc={30} ropes={6} cw={1} />;

const SetWaterCity: React.FC<{ t: number }> = ({ t }) => {
  const sA = S("agua"), sB = S("bomba"), sX = S("caixa");
  const inCaixa = t >= sX;
  const pumpShow = t < sB ? 0 : prog(t, A.bomba - 0.3, A.bomba + 0.1, ease.out);
  const pumpOn = inCaixa ? prog(t, sX, sX + 0.3) * (1 - prog(t, A.desce - 0.4, A.desce - 0.1)) : t < sB ? 0 : prog(t, A.bomba, A.bomba + 0.3);
  const dark = inCaixa ? prog(t, A.desce - 0.4, A.desce - 0.1) : 0;
  const nb0 = W("bomba", "Mas");
  const dry = prog(t, W("bomba", "seca") - 0.1, W("bomba", "seca") + 0.4);
  const tankShow = inCaixa ? prog(t, A.topo - 0.5, A.topo - 0.1, ease.out) : 0;
  const tankLevel = inCaixa ? 0.05 + 0.75 * prog(t, A.topo + 0.1, A.topo + 0.8) - 0.15 * prog(t, A.desce, A.desce + 1.2) : 0;
  const tiaoMood = t < W("agua", "trinta") + 0.2 ? "neutral" : t < A.bomba + 1.5 ? "sad" : "happy";
  const angry = prog(t, A.vizinhos - 0.3, A.vizinhos);
  return (
    <group>
      <ShadowFix size={75} />
      <CityWorld t={t} mood="day" plot="dirt" />
      <Building t={t} s={{ floors: 30, core: B.coreTop, cut: true, lit: 0 }} />
      <IdleElevator t={t} />
      {/* rede da rua */}
      <WaterLine pts={[[-60, 0.42, 21.0], [-3, 0.42, 21.0], [24, 0.42, 21.0]]} fill={84} t={t} r={0.32} speed={t > nb0 && !inCaixa ? 9 : 4} />
      {!inCaixa ? (
        <>
          <WaterLine pts={PA} fill={fillPA(t)} t={t} wobble={t < A.bomba ? 0.25 : 0} />
          {t < A.bomba ? (
            <mesh position={[-3, STOP - 18.3 + 0.5, 2.7]} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.42, 0.06, 8, 24]} />
              <meshBasicMaterial color="#FF3B2B" toneMapped={false} transparent opacity={prog(t, W("agua", "não"), W("agua", "não") + 0.3)} />
            </mesh>
          ) : null}
          <Tag3D position={[-3, 10.6, 3.1]} text="PAROU NO 3º ANDAR" show={t < A.bomba ? showFrom(t, W("agua", "não")) : 0} dot="#FF3B2B" />
        </>
      ) : (
        <>
          <WaterLine pts={PCX} fill={fillCX(t)} t={t} />
          <WaterLine pts={PB} fill={fillPB(t)} t={t} glow={bump(t, A.caixa, 0.7) * 0.5} />
          <Branches front={fillPB(t) > 3 ? 94.2 - (fillPB(t) - 1.5) : 999} />
          {fillCX(t) > LCX - 0.3 && t < A.desce ? (
            <mesh position={[-1.6, 96.8, 1.0]}>
              <cylinderGeometry args={[0.16, 0.2, 1.4, 10]} />
              <meshStandardMaterial color="#5BB8F2" transparent opacity={0.8} emissive="#1E8ED6" emissiveIntensity={0.3} />
            </mesh>
          ) : null}
          <group position={[0, B.coreTop + 0.3, 0]} scale={[1, Math.max(0.001, tankShow), 1]}>
            <Tank level={tankLevel} t={t} glow={bump(t, A.caixa, 0.8)} position={[0, 0, 0]} size={[5.8, 2.6, 4.6]} open />
          </group>
          <Tag3D position={[4.6, 60, 3.4]} text="DESCE SOZINHA" show={showFrom(t, A.desce + 0.2)} dot="#2F7BFF" />
        </>
      )}
      {/* hidrômetro */}
      <mesh position={[-3, 0.55, 17.0]} castShadow>
        <boxGeometry args={[1.0, 0.8, 0.7]} />
        <meshStandardMaterial color="#3B7DC4" roughness={0.5} />
      </mesh>
      {/* pia do último andar + Tião */}
      {!inCaixa ? (
        <group>
          <SinkUnit t={t} position={[-3, B.top - 3 + 0.02, 1.55]} flow={sinkFlow(t)} />
          <TiaoWalk t={t} position={[-3, B.top - 3 + 0.02, 0.6]} rotation={0} mood={tiaoMood} look={[0, -0.6]} headLean={0.25} armROverride={t > W("agua", "trinta") ? [-1.3, 0, -0.1] : undefined} sweat={tiaoMood === "sad" ? 0.5 : 0} />
          <pointLight position={[-3, B.top - 0.6, 4]} intensity={14} distance={9} color="#FFF4E0" />
        </group>
      ) : null}
      {/* bomba */}
      {pumpShow > 0.01 ? (
        <group scale={1}>
          <group position={[-3.0, 0.26, 13.4]} scale={pumpShow}>
            <Pump t={t} on={pumpOn} position={[0, 0, 0]} scale={1.1} />
            <mesh position={[0.5, 1.9, 0.3]}>
              <boxGeometry args={[0.5, 0.5, 0.2]} />
              <meshStandardMaterial color="#2B3138" emissive={pumpOn > 0.5 ? "#3DBE5A" : "#FF2A1A"} emissiveIntensity={1.2} />
            </mesh>
          </group>
          <Tag3D position={[-3, 2.6, 13.4]} text="BOMBA" show={!inCaixa ? showFrom(t, A.bomba, nb0) : 0} dot="#FF8A1E" />
        </group>
      ) : null}
      {/* vizinhos do outro lado da rua */}
      {!inCaixa
        ? [
            [-2.6, "#3DAA66"],
            [3.4, "#2E6FD8"],
          ].map(([x, shirt], i) => (
            <group key={i}>
              <WaterLine pts={[[x as number, 0.42, 21.0], [x as number, 0.42, 27.2]]} fill={6.2 * (1 - dry)} t={t} r={0.14} />
              <GardenTap t={t} position={[x as number, 0.26, 27.4]} flow={1 - dry} rot={Math.PI} />
              <TiaoWalk t={t + i} position={[(x as number) + 0.9, 0.26, 28.0]} rotation={Math.PI - 0.5} shirt={shirt as string} mood={angry > 0.3 ? "shock" : dry > 0.3 ? "sad" : "happy"} pose={angry > 0.6 ? "up" : "down"} look={[0.4, 0]} />
            </group>
          ))
        : null}
      {!inCaixa ? (
        <>
          {[-28, -18, 12, 20].map((x, i) => (
            <ThinArrow key={x} a={[x + (x < -3 ? 0 : 0), 1.3, 21]} b={[x + (x < -3 ? 5 : -5), 1.3, 21]} p={showFrom(t, nb0 + 0.1 + i * 0.05, sX)} color="#2F7BFF" r={0.09} head={0.5} />
          ))}
          <Tag3D position={[0.4, 3.2, 27.6]} text="VIZINHOS SEM ÁGUA" show={showFrom(t, A.vizinhos - 0.1)} dot="#FF3B2B" />
        </>
      ) : null}
      {dark > 0 ? <pointLight position={[3, 50, 12]} intensity={0} /> : null}
    </group>
  );
};

const SetCistern: React.FC<{ t: number }> = ({ t }) => {
  const sC = S("cisterna"), sL = S("faltaluz");
  const level = 0.1 + 0.75 * prog(t, W("cisterna", "enche") - 0.1, A.subsolo + 0.4);
  const off = t >= sL ? prog(t, A.luz - 0.05, A.luz + 0.1) : 0;
  const pumpOn = t < A.subsolo ? 0 : prog(t, A.subsolo, A.subsolo + 0.3) * (1 - prog(t, A.para - 0.1, A.para + 0.3));
  const riser = t < A.subsolo ? 0 : 14 * prog(t, A.subsolo + 0.1, A.subsolo + 0.8) * (1 - prog(t, A.para + 0.2, A.acaba + 0.3));
  return (
    <group>
      <ShadowFix size={40} />
      <CityWorld t={t} mood="day" zMax={6} ground={false} />
      <CutSoil />
      <Building t={t} s={{ floors: 30, core: B.coreTop }} />
      <Piles depths={[23.5, 23.5, 23.5, 23.5]} />
      <OpenTank t={t} box={{ x0: CISTERN.x0, x1: CISTERN.x1, y0: CISTERN.y0, y1: CISTERN.y1, z0: CISTERN.z0, z1: 6.0 }} level={level} glow={bump(t, A.cisterna, 0.8)} />
      {/* rede da rua chegando na cisterna */}
      <WaterLine pts={[[-60, -1.4, 5.2], [-16.4, -1.4, 5.2], [-15.4, -1.4, 4.6]]} fill={60} t={t} r={0.25} />
      {t < A.subsolo + 0.6 ? (
        <mesh position={[-15.2, -1.4 - (1.6 - 3.4 * level) / 2 - 1.0, 4.6]}>
          <cylinderGeometry args={[0.13, 0.18, Math.max(0.2, 2.4 - 3.0 * level), 10]} />
          <meshStandardMaterial color="#5BB8F2" transparent opacity={0.8} emissive="#1E8ED6" emissiveIntensity={0.3} />
        </mesh>
      ) : null}
      {/* sucção da bomba + recalque subindo */}
      <WaterLine pts={[[-10.2, -4.0, 4.4], [-10.2, 0.3, 4.4], [-9.4, 0.3, 4.4]]} fill={pumpOn > 0.1 || riser > 0.5 ? 6 : 0} t={t} r={0.16} />
      <WaterLine pts={[[-7.9, 0.6, 4.4], [-7.6, 0.6, 5.0], [-7.6, 16, 5.0]]} fill={riser} t={t} r={0.18} />
      <Pump t={t} on={pumpOn} position={[-8.8, 0.0, 4.4]} scale={0.9} />
      <mesh position={[-8.5, 1.6, 5.0]}>
        <boxGeometry args={[0.5, 0.5, 0.2]} />
        <meshStandardMaterial color="#2B3138" emissive={pumpOn > 0.5 ? "#3DBE5A" : off > 0.5 ? "#330000" : "#FF2A1A"} emissiveIntensity={1.2} />
      </mesh>
      {/* poste de luz da rua (apaga) */}
      <group position={[-12.5, 0, 5.5]}>
        <mesh position={[0, 3.6, 0]}>
          <boxGeometry args={[0.16, 7.2, 0.16]} />
          <meshStandardMaterial color="#5E646C" />
        </mesh>
        <mesh position={[-0.7, 7.0, 0]}>
          <boxGeometry args={[1.4, 0.2, 0.5]} />
          <meshStandardMaterial color="#DDE3E8" emissive="#FFD48A" emissiveIntensity={(1 - off) * 1.6} />
        </mesh>
      </group>
      {off > 0 && off < 1 ? <SparkSpray t={t} origin={[-13.2, 6.9, 5.5]} amount={1} n={14} seed={81} scale={0.6} /> : null}
      <Tag3D position={[-12.5, 0.6, 6.4]} text="SUBSOLO" show={showFrom(t, A.subsolo - 0.1)} dot="#FF8A1E" />
      <Tag3D position={[-8.8, 2.4, 5.4]} text="SEM LUZ" show={t >= sL ? showFrom(t, A.luz) : 0} dot="#FF3B2B" dark />
      {t < sC ? null : null}
    </group>
  );
};

// ======================================================================
// 23) TUBO DE QUEDA
// ======================================================================
const DROPS_NO = [28, 24, 20, 16, 12, 8].map((k, i) => ({ k, t0: 116.5 + i * 0.16 }));
const DROPS_IN = [29, 23, 17, 11, 26, 14, 5].map((k, i) => ({ k, t0: 121.0 + i * 0.22 }));
const SetTubo: React.FC<{ t: number }> = ({ t }) => {
  const grow = prog(t, A.cano - 0.1, W("tubo", "andares", 1) + 0.1, (x) => x);
  const floors = Array.from({ length: 30 }, (_, k) => k);
  return (
    <group>
      <ShadowFix size={75} />
      <CityWorld t={t} mood="day" plot="dirt" />
      <Building t={t} s={{ floors: 30, core: B.coreTop, cut: true }} />
      <IdleElevator t={t} />
      <Tank level={0.6} t={t} position={[0, B.coreTop + 0.3, 0]} size={[5.8, 2.6, 4.6]} open />
      <ToiletColumn t={t} floors={floors} rot={-Math.PI / 2} flushAt={(k) => (t < A.cano ? DROPS_NO.find((d) => d.k === k)?.t0 ?? 999 : DROPS_IN.find((d) => d.k === k)?.t0 ?? 999)} />
      <DropStack grow={grow} glow={bump(t, A.queda, 0.8)} />
      {grow > 0.99 ? (
        <mesh position={[5.4, -0.6, 11]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.32, 0.32, 19.6, 14]} />
          <meshStandardMaterial color="#C9CFD3" roughness={0.4} />
        </mesh>
      ) : null}
      {t < A.cano ? <Flushes t={t} drops={DROPS_NO} inPipe={false} /> : <Flushes t={t} drops={DROPS_IN} inPipe />}
      {grow > 0.01 && grow < 0.99 ? <Glow position={[5.4, B.top + 1.5 - (B.top + 2.7) * grow, 1.4]} size={2.2} color="#FFD27A" opacity={0.9} /> : null}
      <Tag3D position={[3.2, 62, 2.2]} text="DESCARGA" show={showFrom(t, A.descarga, A.cano - 0.5)} dot="#7A5230" />
      <Tag3D position={[6.6, 30, 1.8]} text="ATRAVESSA OS 30 ANDARES" show={showFrom(t, W("tubo", "atravessa"), A.queda + 0.8)} dot="#FF8A1E" />
    </group>
  );
};

// ======================================================================
// 24-25) SIFÃO e VENTILAÇÃO
// ======================================================================
const plugAt = (t: number, t0: number) => {
  const u = t - t0;
  if (u < 0) return -99;
  const y = 2.65 - 2 * u - 8 * u * u;
  return y < -4.5 ? -99 : y;
};
const SetBath: React.FC<{ t: number }> = ({ t }) => {
  const inV = t >= S("ventilacao");
  const trap = inV ? 1 : prog(t, A.curva - 0.6, A.curva + 0.3, (x) => x);
  const plug1 = W("ventilacao", "descarga,") + 0.6;
  const plug2 = A.ar + 0.6;
  const suck = inV ? prog(t, A.chupa - 0.2, A.chupa + 0.7) * (1 - (t > W("ventilacao", "Então") ? 1 : 0)) : 0;
  const trapWater = !inV ? prog(t, A.guarda - 0.3, A.guarda + 0.3) : t < A.chupa - 0.2 ? 1 : t < W("ventilacao", "Então") ? 1 - 0.85 * prog(t, A.chupa - 0.2, A.chupa + 0.7) : prog(t, W("ventilacao", "Então"), W("ventilacao", "Então") + 0.5);
  const gasThrough = !inV ? t < A.guarda + 0.2 : t > A.volta - 0.4 && t < W("ventilacao", "Então") + 0.3;
  const gas = !inV ? prog(t, S("sifao"), A.fedor) : 1;
  const sick = !inV ? prog(t, A.fedor, A.fedor + 0.4) * (1 - prog(t, A.guarda + 0.3, A.guarda + 0.8)) : prog(t, A.volta - 0.3, A.volta + 0.2) * (1 - prog(t, A.ar, A.ar + 0.5));
  const plugY = !inV ? -99 : Math.max(plugAt(t, plug1), plugAt(t, plug2));
  const vent = inV ? prog(t, A.segundo - 0.2, A.segundo + 0.9, (x) => x) : 0;
  const air = inV ? prog(t, A.ar - 0.2, A.ar + 0.1) : 0;
  return (
    <group>
      <BathSection t={t} trap={trap} trapWater={trapWater} gas={gas} gasThrough={gasThrough} upper={inV} plugY={plugY} vent={vent} air={air} glowTrap={bump(t, A.sifao, 0.8)} glowVent={bump(t, A.ventilacao, 0.8)} suck={suck} />
      <TiaoWalk t={t} position={[-0.6, 0, 1.0]} rotation={0.25} mood={sick > 0.3 ? "sad" : "happy"} sick={sick} armLOverride={sick > 0.3 ? [-2.2, 0, 0.55] : undefined} armROverride={sick > 0.3 ? [-2.2, 0, -0.55] : undefined} lean={sick * 0.15} />
      {inV ? <TiaoWalk t={t + 2} position={[-1.0, 3.2, -0.6]} rotation={0.6} shirt="#2E6FD8" mood="happy" armROverride={t > plug1 - 0.9 && t < plug1 ? [-1.2, 0, -0.3] : undefined} /> : null}
      <Tag3D position={[-0.1, 2.5, 1.0]} text="FEDOR" show={!inV ? showFrom(t, A.fedor, A.guarda + 0.4) : showFrom(t, A.volta - 0.1, A.segundo)} dot="#7FBF3A" />
      <Tag3D position={[0.6, 0.35, 1.0]} text="RALO" show={!inV ? showFrom(t, W("sifao", "ralo") - 0.1, A.curva + 0.3) : 0} dot="#FF8A1E" />
      <Tag3D position={[0.85, -1.55, 0.9]} text="ÁGUA GUARDADA" show={!inV ? showFrom(t, A.guarda) : 0} dot="#2F7BFF" />
      <Tag3D position={[-0.6, 4.9, -0.6]} text="VIZINHO DE CIMA" show={inV ? showFrom(t, A.vizinho, A.chupa) : 0} dot="#FF8A1E" />
      <Tag3D position={[1.6, -1.5, 0.8]} text="CHUPA O SIFÃO" show={inV ? showFrom(t, A.chupa, A.segundo) : 0} dot="#FF3B2B" />
      <Tag3D position={[3.25, 9.8, 0.6]} text="AR DO TOPO" show={inV ? showFrom(t, A.ar - 0.1) : 0} dot="#2F7BFF" />
      <pointLight position={[0, 2.6, 3]} intensity={12} distance={10} color="#FFF4E0" />
      <pointLight position={[1.5, -1.5, 3]} intensity={6} distance={6} color="#E8F2FF" />
    </group>
  );
};

// ======================================================================
// 26) FOGO: fumaça pela escada; portas corta-fogo
// ======================================================================
const SetFire: React.FC<{ t: number }> = ({ t }) => {
  const fire = prog(t, A.fogo - 0.3, A.fogo + 0.2);
  const smokeCor = prog(t, A.fumaca - 1.0, A.fumaca);
  const smokeStair = prog(t, A.fumaca - 0.1, A.chamine + 0.2) * (1 - prog(t, A.portas + 0.4, A.emergencia - 0.2));
  const doors = prog(t, A.fecha - 0.1, A.portas + 0.4);
  const k = 2 * 3;
  let tiao: Parameters<typeof FireSection>[0]["tiao"];
  if (t < A.fumaca - 0.2) {
    const back = prog(t, W("fogo", "nem") - 0.2, W("fogo", "pensar,") + 0.2);
    tiao = { p: [-0.6 + 0.9 * back, k + 0.0, -1.0 + 1.2 * back], rot: Math.PI + 0.6 * back, mood: t > A.elevF + 0.3 ? "shock" : "neutral", arms: t > W("fogo", "nem") ? "up" : "none" };
  } else if (t < A.fecha - 0.1) {
    const w = stairWalk(3.25 + 0.15 * prog(t, A.fumaca, A.chamine + 0.5));
    tiao = { p: w.p, rot: w.rot, mood: "sad", cough: 1, arms: "nose", walk: 0.3 };
  } else if (t < A.emergencia - 1.2) {
    const w = stairWalk(3.45);
    tiao = { p: w.p, rot: w.rot, mood: "neutral", cough: 1 - prog(t, A.portas + 0.4, A.portas + 1.2) };
  } else {
    const w = stairWalk(3.45 - 1.0 * prog(t, A.emergencia - 1.2, END_FOGO, (x) => x));
    tiao = { p: w.p, rot: w.rot + Math.PI, mood: "happy", walk: 1 };
  }
  return (
    <group>
      <FireSection t={t} fire={fire} smokeCor={smokeCor} smokeStair={smokeStair} doors={doors} glowDoors={bump(t, W("fogo", "portas"), 0.8)} glowStair={bump(t, A.emergencia - 0.3, 0.9)} elevAlarm={t > A.elevF - 0.2 && t < A.fumaca ? 1 : 0} tiao={tiao} />
      <Tag3D position={[-0.8, k + 2.75, -2.2]} text="ELEVADOR: NEM PENSAR" show={showFrom(t, A.elevF, A.fumaca - 0.3)} dot="#FF3B2B" />
      <Tag3D position={[3.0, k + 8.8, 0.2]} text="FUMAÇA" show={showFrom(t, A.fumaca, A.fecha)} dot="#55595F" />
      <Tag3D position={[1.3, k + 2.6, -1.0]} text="PORTA CORTA-FOGO" show={showFrom(t, A.portas)} dot="#FF3B2B" />
      <pointLight position={[2, 10, 8]} intensity={40} distance={30} color="#FFF4E0" />
      <pointLight position={[-4, 4, 8]} intensity={25} distance={25} color="#FFF4E0" />
    </group>
  );
};
const END_FOGO = cena(TL, "fogo").end + 0.2;

// ======================================================================
// 27) LAJE: racha no sol, pinga, manta, ralos
// ======================================================================
const SetLaje: React.FC<{ t: number }> = ({ t }) => {
  const crack = prog(t, A.rachaL - 0.1, A.rachaL + 0.7);
  const heat = prog(t, A.laje, A.rachaL) * (1 - prog(t, A.chuva - 0.3, A.chuva));
  const rain = prog(t, A.chuva - 0.3, A.chuva) * (1 - 0.6 * prog(t, A.cobre, A.cobre + 1));
  const wet = prog(t, A.chuva, A.chuva + 0.6) * (1 - prog(t, A.cobre, A.manta + 0.6));
  const manta = prog(t, A.cobre - 0.1, W("laje", "rasgar,") + 0.1, (x) => x);
  const drains = prog(t, A.inclinada - 0.1, A.inclinada + 0.3);
  const flow = prog(t, A.ralos - 0.3, A.ralos + 0.2);
  const arrowsP = prog(t, A.inclinada, A.ralos);
  const Y = B.top + 0.3;
  return (
    <group>
      <ShadowFix size={40} />
      <CityWorld t={t} mood="day" plot="plaza" />
      <Building t={t} s={{ floors: 30, core: B.coreTop, facade: 1, lit: 0, roof: true }} />
      <Tank level={0.8} t={t} position={[0, B.coreTop + 0.3, 0]} size={[5.8, 2.6, 4.6]} open={false} />
      <RoofWork t={t} crack={crack} wet={wet} manta={manta} drains={drains} flow={flow} glow={bump(t, A.imper, 0.9)} heat={heat} />
      {rain > 0 ? <RainStreaks t={t} amount={rain} box={[-20, 20, -20, 24]} top={112} floor={88} n={1200} /> : null}
      {[
        [-1.5, -1.5, -6.3, -6.3],
        [1.5, -1.5, 6.3, -6.3],
        [-1.5, 1.5, -6.3, 6.3],
        [1.5, 1.5, 6.3, 6.3],
      ].map(([x0, z0, x1, z1], i) => (
        <ThinArrow key={i} a={[x0 * 2.2, Y, z0 * 2.2]} b={[x1 * 0.88, Y, z1 * 0.88]} p={arrowsP} color="#2F7BFF" r={0.09} head={0.6} />
      ))}
      <Tag3D position={[3.5, Y + 0.6, 3.6]} text="RACHA NO SOL" show={showFrom(t, A.rachaL, A.chuva)} dot="#FF3B2B" />
      <Tag3D position={[-1.5, Y + 0.6, 4.5]} text="MANTA" show={showFrom(t, A.manta, W("laje", "estica") - 0.05)} dot="#16181D" />
      <Tag3D position={[1.5, Y + 0.6, 5.8]} text="ESTICA SEM RASGAR" show={showFrom(t, W("laje", "estica"), A.inclinada)} dot="#3DBE5A" />
      <Tag3D position={[6.3, Y + 0.8, 6.3]} text="RALO" show={showFrom(t, A.ralos - 0.1)} dot="#2F7BFF" />
      {heat > 0.02 ? <Glow position={[30, 140, -60]} size={60} color="#FFC060" opacity={0.6 * heat} /> : null}
    </group>
  );
};
const SetLeak: React.FC<{ t: number }> = ({ t }) => (
  <group>
    <LeakRoom t={t} drip={1} stain={1} />
    {/* balde */}
    <group position={[0.2, 0, 0]}>
      <mesh position={[0, 0.25, 0]}>
        <cylinderGeometry args={[0.3, 0.24, 0.5, 16, 1, true]} />
        <meshStandardMaterial color="#2E7BD6" side={2} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.02, 0]}>
        <cylinderGeometry args={[0.24, 0.24, 0.03, 16]} />
        <meshStandardMaterial color="#2E7BD6" />
      </mesh>
      <mesh position={[0, 0.3, 0]}>
        <cylinderGeometry args={[0.27, 0.27, 0.02, 16]} />
        <meshStandardMaterial color="#5BB8F2" emissive="#1E8ED6" emissiveIntensity={0.3} />
      </mesh>
    </group>
    <TiaoWalk t={t} position={[1.0, 0, 0.6]} rotation={-0.6} mood="sad" look={[-0.5, 1]} headLean={-0.4} armLOverride={[-1.2, 0, 0.3]} armROverride={[-1.2, 0, -0.3]} />
    <Tag3D position={[0.2, 2.6, 0]} text="PINGA" show={showFrom(t, A.ultimo - 0.5)} dot="#2F7BFF" />
  </group>
);

// ======================================================================
// 28) RAIO e PARA-RAIOS
// ======================================================================
const FLICK = (t: number, s: number) => (t < s || t > s + 0.62 || (t > s + 0.13 && t < s + 0.18) ? 0 : 0.6 + 0.4 * Math.abs(Math.sin((t - s) * 47)));
const PULSE0 = A.raio2 + 0.15, PULSE1 = A.terra;
const rodLen = (() => RodPath.slice(1).reduce((s, q, i) => s + Math.hypot(q[0] - RodPath[i][0], q[1] - RodPath[i][1], q[2] - RodPath[i][2]), 0))();
const rodAt = (u: number): V3 => {
  let s = u * rodLen;
  for (let i = 0; i < RodPath.length - 1; i++) {
    const a = RodPath[i], b = RodPath[i + 1];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    if (s <= L) return [a[0] + ((b[0] - a[0]) * s) / L, a[1] + ((b[1] - a[1]) * s) / L, a[2] + ((b[2] - a[2]) * s) / L];
    s -= L;
  }
  return RodPath[RodPath.length - 1];
};
const SetStorm: React.FC<{ t: number }> = ({ t }) => {
  const hit = A.raio - 0.02;
  const lit = t < hit + 0.08 ? 0.5 : t < A.ponta ? 0.04 : 0.5;
  const rainTop = t < 163.3 ? 40 : t < 164.6 ? 70 : 112;
  const box: [number, number, number, number] = t < 163.3 ? [-40, 10, 20, 70] : t < 164.6 ? [-60, -5, 30, 90] : [0, 25, 5, 35];
  const pulse = t >= PULSE0 && t <= PULSE1 + 0.1 ? prog(t, PULSE0, PULSE1, (x) => x) : -1;
  return (
    <group>
      <ShadowFix size={75} />
      <CityWorld t={t} mood="storm" plot="plaza" />
      <Building t={t} s={{ floors: 30, core: B.coreTop, facade: 1, lit, roof: true }} />
      <Tank level={0.8} t={t} position={[0, B.coreTop + 0.3, 0]} size={[5.8, 2.6, 4.6]} open={false} />
      <RainStreaks t={t} amount={1} box={box} top={rainTop} floor={rainTop - 30} n={1400} />
      <Bolt from={[-30, 185, -40]} to={[2.5, B.top + 1.5, 6.5]} seed={5} on={FLICK(t, hit)} width={0.9} />
      <Bolt from={[40, 180, -50]} to={[0, B.coreTop + 9.2, 0]} seed={11} on={FLICK(t, A.raio2 - 0.05)} width={0.9} />
      {FLICK(t, hit) || FLICK(t, A.raio2 - 0.05) ? <pointLight position={[0, 120, 20]} intensity={900 * (FLICK(t, hit) + FLICK(t, A.raio2 - 0.05))} distance={300} color="#DCE8FF" /> : null}
      {t > hit + 0.05 && t < A.ponta ? <Glow position={[2.5, B.top + 2, 6.5]} size={7 + Math.sin(t * 23) * 1.5} color="#FF7A1E" opacity={0.9} /> : null}
      <FacadeSparks t={t} t0={hit + 0.05} amount={t < A.ponta ? 1 : 0} />
      {t < A.ponta - 0.6 ? <Dust t={t} t0={hit + 0.08} origin={[2.5, B.top + 1, 6]} n={10} spread={4} size={1.6} seed={21} color="#4A4E54" dur={0.9} /> : null}
      <LightningRod t={t} rod={prog(t, A.ponta - 0.15, A.ponta + 0.45)} cable={prog(t, A.ponta + 0.5, A.raio2 - 0.1)} glow={bump(t, A.pararaios, 0.8)} pulse={pulse} />
      <GroundRings t={t} t0={A.terra - 0.05} position={[8.4, 0.35, 8.4]} />
      <Tag3D position={[1.2, B.coreTop + 9.4, 0.4]} text="PONTA DE METAL" show={showFrom(t, A.ponta + 0.1, A.raio2 + 0.6)} dot="#FF8A1E" />
      <Tag3D position={[9.0, 46, 8.4]} text="CABO" show={showFrom(t, A.caboR - 0.1)} dot="#FF8A1E" />
      <Tag3D position={[9.0, 2.4, 9.4]} text="TERRA" show={showFrom(t, A.terra - 0.1)} dot="#3DBE5A" />
      {pulse >= 0 ? <Glow position={rodAt(pulse)} size={5} color="#FFE07A" opacity={1} /> : null}
    </group>
  );
};

// ======================================================================
// 29) PORTARIA
// ======================================================================
const SetLobby: React.FC<{ t: number }> = ({ t }) => (
  <group>
    <Lobby t={t} desk={prog(t, A.portaria - 0.25, A.portaria + 0.1)} intercom={prog(t, A.interfone - 0.25, A.interfone + 0.1)} buzz={t > A.interfone + 0.1 && t < A.grupo ? 1 : 0} glowDesk={bump(t, A.portaria, 0.6)} glowInter={bump(t, A.interfone, 0.6)} />
    {t > A.portaria - 0.1 ? <TiaoWalk t={t} position={[2.6, 0, -1.55]} rotation={0} cap shirt="#1F3A66" mood="happy" pose={t < A.portaria + 0.8 ? "wave" : "down"} /> : null}
    <TiaoWalk t={t + 1} position={[-1.4, 0, 1.4]} rotation={0.5} phone={t > A.grupo - 0.3} mood={t > A.grupo + 0.6 ? "shock" : "neutral"} look={[0, -0.6]} headLean={t > A.grupo - 0.3 ? 0.35 : 0} />
    <Tag3D position={[2.6, 2.5, -0.4]} text="PORTARIA" show={showFrom(t, A.portaria)} dot="#FF8A1E" />
    <Tag3D position={[-5.6, 2.2, 1.6]} text="INTERFONE" show={showFrom(t, A.interfone)} dot="#FF8A1E" />
    <pointLight position={[0, 2.8, 2]} intensity={25} distance={14} color="#FFF0D8" />
  </group>
);

// ======================================================================
// 30) FINAL: drone ao pôr do sol, janelas acendendo
// ======================================================================
const SetFinal: React.FC<{ t: number }> = ({ t }) => (
  <group>
    <ShadowFix size={90} />
    <CityWorld t={t} mood="sunset" plot="plaza" />
    <Building t={t} s={{ floors: 30, core: B.coreTop, facade: 1, lit: 0.15 + 0.75 * prog(t, S("final") + 0.3, S("final") + 4.5, (x) => x), roof: true }} />
    <Tank level={0.8} t={t} position={[0, B.coreTop + 0.3, 0]} size={[5.8, 2.6, 4.6]} open={false} />
    <LightningRod t={t} rod={1} cable={1} />
  </group>
);

// chuveiro: apagão
const SetShower: React.FC<{ t: number }> = ({ t }) => {
  const stop = prog(t, A.acaba - 0.1, A.acaba + 0.25);
  return <ShowerSet t={t} flow={1 - stop} dark={1} foam={1} mood={stop > 0.5 ? "shock" : "neutral"} look={stop > 0.3 ? 1 : 0} />;
};

// ======================================================================
// PLANOS (cortes) e câmeras
// ======================================================================
type Plan = { from: number; to: number; look: keyof typeof LOOK; keys: Key[]; render: (t: number) => React.ReactNode; shake?: (t: number) => number; sepia?: boolean };
const e = (id: string) => cena(TL, id).end;
const P = (from: number, to: number, look: keyof typeof LOOK, kk: KK[], render: (t: number) => React.ReactNode, shake?: (t: number) => number, sepia?: boolean): Plan => ({ from: fr(from), to: fr(to), look, keys: K(kk), render, shake, sepia });

const tcam = (t: number, dx: number, dy: number, dz: number, fov: number): KK => {
  const p = stairPos(uStair(t)).p;
  return [t, [p[0] + dx, p[1] + dy, p[2] + dz], [p[0], p[1] + 1.1, 0.4], fov];
};
const cabCam = (t: number, dx = 0.4, dy = 1.5, dz = 3.4, fov = 50): KK => [t, [EL.cabX + dx, ycT(t) + dy, dz], [EL.cabX, ycT(t) + dy - 0.35, 0], fov];
const clawCam = (t: number, fov = 42): KK => [t, [-2.5, ycT(t) - 0.05, 2.5], [-1.45, ycT(t) - 0.4, 0], fov];

const T = {
  racha: S("racha"),
  estrutura: S("estrutura"),
  reforma: S("reforma"),
  porIsso: W("reforma", "Por"),
  puxao: S("puxao"),
  afunda: S("afunda"),
  balanca: S("balanca"),
  escada: S("escada"),
  elevador: S("elevador"),
  otis: S("otis"),
  agua: S("agua"),
  cisterna: S("cisterna"),
  chuveiro: A.acaba - 0.45,
  caixa: S("caixa"),
  tubo: S("tubo"),
  sifao: S("sifao"),
  fogo: S("fogo"),
  laje: S("laje"),
  raio: S("raio"),
  acab: S("acabamento"),
  final: S("final"),
};

const PLANS: Plan[] = [
  // 1 — gancho
  P(0, T.racha, "day", [
    [0, [24, 15, 24], [0, 7, 0], 52],
    [1.0, [10, 6, 21], [0, 14, 0], 58],
    [2.0, [-8, 2.2, 26], [0, 24, 0], 68],
    [3.0, [-15, 1.4, 25], [0, 34, 0], 76],
    [3.55, [-15.5, 1.3, 26], [0, 36, 0], 76],
    [3.62, [-20, 26, 92], [22, 24, 0], 62, true],
    [4.6, [-26, 20, 96], [26, 12, 0], 62],
    [4.7, [70, 58, 66], [20, 2, 0], 50, true],
    [T.racha, [62, 46, 70], [18, 2, 0], 50],
  ], (t) => <SetHook t={t} />, (t) => (t > 3.0 && t < 3.55 ? 0.04 : 0) + (t > 3.8 && t < 4.7 ? 0.25 : 0)),
  // 2 — racha
  P(T.racha, T.estrutura, "day", [
    [T.racha, [3.2, 1.5, 9.5], [0, 1.6, 2.5], 50],
    [7.5, [4.2, 2.6, 11], [0, 2.6, 2.5], 50],
    [8.6, [5, 3.8, 12.5], [0, 4.5, 0], 52],
    [9.6, [14, 30, 52], [0, 62, 0], 54],
    [10.2, [16, 34, 56], [0, 66, 0], 54],
    [10.3, [2.6, 1.4, 7.4], [0, 1.3, 2.5], 46, true],
    [11.2, [2.2, 1.3, 6.6], [0, 1.2, 2.5], 46],
    [11.25, [-24, 18, 70], [20, 30, 0], 62, true],
    [T.estrutura, [-28, 14, 76], [26, 12, 0], 62],
  ], (t) => <SetRacha t={t} />, (t) => (t > 10.5 && t < 11.2 ? 0.03 : 0) + (t > 11.6 && t < 12.2 ? 0.12 : 0)),
  // 3 — estrutura
  P(T.estrutura, T.reforma, "day", [
    [T.estrutura, [44, 30, 62], [0, 4, 0], 50],
    [13.7, [30, 14, 40], [0, 3, 0], 50],
    [15.0, [11, 2.2, 15], [4, 2.2, 4], 48],
    [16.0, [10, 3.6, 13], [3, 2.6, 4], 48],
    [16.8, [16, 7, 12], [0, 5, 0], 50],
    [17.9, [30, 38, 62], [0, 38, 0], 52],
    [A.pilares - 0.05, [26, 24, 46], [0, 18, 0], 50],
    [T.reforma, [32, 28, 54], [0, 22, 0], 50],
  ], (t) => <SetEstrutura t={t} />),
  // 4a — reforma (fora): peso desce pelos pilares
  P(T.reforma, T.porIsso, "close", [
    [T.reforma, [7, 6.5, 25], [-0.5, 6, 6], 46],
    [T.porIsso, [5, 5.5, 22], [-1, 5.5, 6], 46],
  ], (t) => <SetReformaFora t={t} />),
  // 4b — reforma (dentro): marreta
  P(T.porIsso, T.puxao, "close", [
    [T.porIsso, [-1.9, 2.5, -0.4], [-4.3, 1.0, 6], 54],
    [22.6, [-2.1, 2.4, 0.0], [-4.3, 1.0, 6], 54],
    [A.derruba - 0.05, [-2.2, 2.3, 0.3], [-4.2, 1.0, 6.5], 56],
    [A.pilar - 0.05, [-2.3, 2.4, 0.4], [-4.0, 0.8, 7.5], 58],
    [A.pilar, [-4.8, 1.7, 10.6], [-2.4, 1.4, 5.2], 50, true],
    [T.puxao, [-4.5, 1.7, 11.0], [-2.4, 1.5, 5.2], 46],
  ], (t) => <SetReformaDentro t={t} />, (t) => (t > A.derruba && t < A.derruba + 0.3 ? 0.03 : 0)),
  // 5-6 — viga e concreto armado
  P(T.puxao, T.afunda, "close", [
    [T.puxao, [0, 4.4, 10.5], [0, 3.1, 2], 46],
    [26.0, [0, 2.4, 9.2], [0, 3.0, 2], 50],
    [27.4, [-0.6, 2.2, 8.8], [0, 3.0, 2], 50],
    [A.enverga, [0.5, 2.1, 8.2], [0, 3.0, 2], 48],
    [29.6, [0.2, 2.5, 6.8], [0, 3.1, 2], 44],
    [A.racha, [0, 2.8, 5.9], [0, 3.25, 2], 40],
    [S("armado"), [0, 2.8, 5.8], [0, 3.25, 2], 40],
    [32.0, [2.6, 2.4, 6.4], [0.6, 3.3, 2], 46],
    [A.embaixo, [1.0, 2.3, 5.0], [0, 3.35, 2], 50],
    [A.armado, [0, 2.6, 8.6], [0, 3.2, 2], 48],
    [T.afunda, [-1.5, 2.8, 9.4], [0, 3.2, 2], 48],
  ], (t) => <SetBeam t={t} />, (t) => (t > T.puxao + 0.45 && t < T.puxao + 0.65 ? 0.03 : 0) + (t > A.racha && t < A.racha + 0.35 ? 0.025 : 0)),
  // 7-8 — solo
  P(T.afunda, T.balanca, "daySide", [
    [T.afunda, [16, 40, 150], [0, 40, 0], 52],
    [37.3, [12, -2, 62], [0, -6, 6], 52],
    [38.5, [14, 8, 90], [0, 10, 4], 52],
    [39.6, [24, 30, 150], [0, 32, 0], 54],
    [S("estacas"), [26, 32, 156], [0, 32, 0], 54],
    [40.9, [8, 5, 36], [-2, 2, 6], 52],
    [41.6, [5, 0, 26], [-2, -3, 6], 50],
    [42.8, [3, -10, 20], [-2, -13, 6], 50],
    [A.firme, [2, -20, 18], [-2, -22, 6], 50],
    [44.6, [6, -9, 40], [0, -10, 6], 52],
    [A.estacas, [12, 10, 110], [0, 8, 0], 54],
    [T.balanca, [14, 14, 124], [0, 12, 0], 54],
  ], (t) => <SetSoil t={t} />, (t) => (t > A.afunda && t < A.tomba + 0.4 ? 0.15 : 0) + (t > A.estacas - 0.1 && t < A.estacas + 0.2 ? 0.1 : 0)),
  // 9-10 — vento e núcleo
  P(T.balanca, T.escada, "day", [
    [T.balanca, [21, 2.5, 24], [0, 60, 0], 66],
    [A.vento - 0.05, [20, 3, 23], [0, 64, 0], 66],
    [A.vento, [-70, 58, 110], [0, 55, 0], 52, true],
    [48.3, [-74, 60, 116], [0, 56, 0], 52],
    ...samples(48.35, S("nucleo"), 0.1, (t) => [t, [8 + 0.5 * swayT(t), 93.5, 13], [1.2 + 0.7 * swayT(t), 90.6, 3.5], 48] as KK).map(cutFirst),
    [50.0, [-24, 108, 30], [0, 66, 0], 58],
    [A.torre - 0.05, [-20, 110, 26], [0, 70, 0], 58],
    [A.torre, [0.6, 132, 4], [0, 0, 0], 28, true],
    [52.3, [0.6, 124, 4], [0, 0, 0], 28],
    [52.35, [36, 40, 100], [0, 50, 0], 52, true],
    [53.8, [44, 46, 108], [0, 50, 0], 52],
    [53.85, [16, 99, 26], [0, 90, 0], 50, true],
    [T.escada, [18, 101, 29], [0, 90, 0], 50],
  ], (t) => <SetWind t={t} />),
  // 11 — escada
  P(T.escada, T.elevador, "stair", [
    [T.escada, [2, 14, 34], [0, 10, 0], 52],
    [56.5, [1.6, 3.4, 6.5], [0, 1.8, 0], 50],
    ...samples(56.6, A.degraus - 0.03, 0.15, (t) => tcam(t, 1.6, 1.2, 4.6, 50)),
    ...samples(A.degraus, 58.43, 0.1, (t) => tcam(t, -1.2, 1.6, 4.4, 50)).map(cutFirst),
    ...samples(58.45, 58.8, 0.07, (t) => tcam(t, 0.8, 1.4, 4.2, 48)).map(cutFirst),
    tcam(T.elevador, 1.4, 1.6, 4.8, 50),
  ], (t) => <SetStair t={t} />),
  // 12 — elevador
  P(T.elevador, S("pesado"), "day", [
    [T.elevador, [0.3, 48, 82], [0.3, 47, 0], 66],
    [S("elevador") + 1.4, [0.3, 46, 46], [0.0, 44, 0], 60],
    [S("elevador") + 1.45, [-0.5, 70, 1.45], [-0.5, 38, 0.6], 62, true],
    [A.cabo - 0.1, [-0.5, 54, 1.45], [-0.5, 40, 0.5], 62],
    [A.cabo - 0.05, [2.4, 45, 7.5], [-0.4, 49, 0], 48, true],
    [A.trilhos - 0.5, [2.6, 46.5, 8], [-0.4, 52, 0], 48],
    [A.trilhos - 0.45, [2.8, 41.6, 6.5], [-0.5, 42.4, 0], 50, true],
    [A.motor - 0.25, [2.4, 42.4, 6.0], [-0.5, 42.8, 0], 50],
    [A.motor - 0.2, [6.5, 93.4, 10], [0.35, 91.6, -0.6], 40, true],
    [64.4, [5, 92.8, 8], [0.35, 91.6, -0.6], 40],
    [64.45, [36, 52, 120], [0, 48, 0], 46, true],
    [S("pesado"), [40, 56, 124], [0, 50, 0], 46],
  ], (t) => <SetElevator t={t} />),
  // 13-14 — gente / contrapeso
  P(S("pesado"), S("cabos"), "day", [
    [S("pesado"), [EL.cabX + 0.3, 11.6, 4.0], [EL.cabX, 11.1, 0], 54],
    [66.9, [EL.cabX + 0.6, 11.8, 4.6], [EL.cabX, 11.2, 0], 54],
    [67.0, [6.5, 93.4, 10], [0.35, 91.6, -0.6], 42, true],
    [A.gigante - 0.1, [6, 93.2, 9.5], [0.35, 91.6, -0.6], 42],
    [68.4, [10, 95, 18], [0.4, 92, 0], 50],
    [69.75, [4.5, 92.5, 9], [1.0, 90, 0], 46],
    [69.8, [3.2, 91.6, 6.5], [1.0, 89.5, 0], 44, true],
    [70.6, [3.6, 84, 9], [1.2, 80, 0], 48],
    [71.55, [3.8, 83, 9.4], [1.2, 79, 0], 48],
    [71.6, [0.6, 44, 40], [0.4, 44, 0], 60, true],
    [73.4, [0.8, 46, 38], [0.4, 46, 0], 60],
    [S("cabos"), [0.6, 50, 64], [0.3, 48, 0], 62],
  ], (t) => <SetElevator t={t} />, (t) => (t > 67.2 && t < 68.6 ? 0.012 : 0)),
  // 15 — vários cabos
  P(S("cabos"), S("freio"), "day", [
    [S("cabos"), [-0.2, BREAK_Y + 1.6, 0.95], [-0.5, BREAK_Y - 2.2, 0], 44],
    [STR[6] + 0.03, [-0.22, BREAK_Y + 1.45, 0.92], [-0.5, BREAK_Y - 2.4, 0], 44],
    ...samples(STR[6] + 0.06, A.varios - 0.52, 0.1, (t) => cabCam(t)).map(cutFirst),
    [A.varios - 0.5, [1.3, 67.5, 2.8], [-0.5, 66.2, 0], 40, true],
    [77.4, [1.0, 66.8, 2.4], [-0.5, 66.0, 0], 40],
    [78.6, [3.2, 61.5, 8], [-0.3, 62, 0], 48],
    [S("freio"), [3.4, 61.5, 8.4], [-0.3, 62, 0], 48],
  ], (t) => <SetElevator t={t} />, (t) => (t > STR[6] && t < STR[6] + 0.25 ? 0.01 : 0)),
  // 16 — freio de segurança
  P(S("freio"), T.otis, "day", [
    [S("freio"), [-0.2, BREAK_Y + 1.6, 1.2], [-0.5, BREAK_Y - 2.2, 0], 46],
    [FALL0 - 0.05, [-0.22, BREAK_Y + 1.5, 1.1], [-0.5, BREAK_Y - 2.4, 0], 46],
    ...samples(FALL0, 81.25, 0.1, (t) => cabCam(t)).map(cutFirst),
    ...samples(81.3, BRK0 - 0.12, 0.1, (t) => [t, [1.0, ycT(t) + 2, 22], [-0.3, ycT(t) - 1, 0], 54] as KK).map(cutFirst),
    ...samples(BRK0 - 0.1, RPL0 - 0.05, 0.1, (t) => clawCam(t, 46)).map(cutFirst),
    ...samples(RPL0, A.travam + 0.8, 0.1, (t) => clawCam(t, 40)).map(cutFirst),
    [A.freio - 0.3, [3, ycT(86) + 2.5, 9], [-0.5, ycT(86) + 1.2, 0], 46],
    [T.otis, [6, ycT(86) + 3, 15], [-0.5, ycT(86) + 1.3, 0], 46],
  ], (t) => <SetElevator t={t} />, (t) => (t > FALL0 && t < FALL0 + 0.25 ? 0.01 : 0) + (t > BRK0 && t < BRK1 + 0.1 ? 0.04 : 0) + (t > A.travam - 0.2 && t < A.travam + 0.2 ? 0.025 : 0)),
  // 17 — Otis 1854
  P(T.otis, T.agua, "sepia", [
    [T.otis, [3.2, 1.7, 13.5], [0, 6.5, 0], 58],
    [A.subiu - 0.05, [4.2, 2.1, 12.2], [0, 7.5, 0], 58],
    [A.subiu + 0.1, [4.5, 4.5, 13], [0, 3, 0], 48],
    [A.subiu + 1.4, [4.5, 11.5, 13], [0, 10.6, 0], 48],
    [A.cortar - 0.3, [0.2, 15.5, 4.2], [-0.5, 14.5, 0.6], 50, true],
    [A.corda - 0.02, [0.1, 15.4, 4.0], [-0.5, 14.5, 0.6], 50],
    [A.corda, [3.0, 12.7, 7.6], [0, 12.3, 0], 46, true],
    [A.parado - 0.1, [3.5, 12.3, 8.6], [0, 12.0, 0], 46],
    [94.2, [5.5, 6.5, 22], [0, 8, 0], 54],
    [T.agua, [7.5, 5.5, 26], [0, 8, 0], 54],
  ], (t) => <SetOtis t={t} />, (t) => (t > A.corda + 0.1 && t < A.corda + 0.35 ? 0.03 : 0), true),
  // 18-19 — água da rua, bomba, vizinhos
  P(T.agua, T.cisterna, "day", [
    [T.agua, [-16, 3.5, 30], [-3, 1.0, 17], 52],
    [95.6, [-13, 6, 27], [-3, 4.5, 8], 52],
    [96.2, [-11, 9.5, 22], [-3, 9, 3], 48],
    [W("agua", "trinta") + 0.3, [-9, 86, 14], [-3, 88, 1.5], 46],
    [S("bomba"), [-7.5, 88.4, 9], [-3, 88.2, 1.2], 44],
    [S("bomba") + 0.05, [-8.5, 6, 18.5], [-3, 0.8, 13], 50, true],
    [A.bomba + 0.45, [-8, 6.5, 18], [-3, 1.2, 12.5], 50],
    [A.bomba + 1.3, [-9, 86, 14], [-3, 88, 1.5], 46],
    [99.8, [-8, 88.5, 10], [-3, 88.2, 1.2], 44],
    [99.85, [0.4, 4.4, 15], [0.4, 1.3, 27], 60, true],
    [101.5, [0.4, 3.8, 16.5], [0.4, 1.3, 27], 58],
    [102.3, [0.4, 2.8, 19.5], [0.4, 1.4, 28], 56],
    [T.cisterna, [0.4, 2.7, 20], [0.4, 1.5, 28], 56],
  ], (t) => <SetWaterCity t={t} />),
  // 20-21a — cisterna e apagão (bomba para)
  P(T.cisterna, T.chuveiro, "daySide", [
    [T.cisterna, [-9, 6, 40], [-11, -1, 4], 50],
    [104.6, [-11.5, -0.8, 22], [-12.5, -2.4, 4], 48],
    [106.0, [-10, -1.5, 17.5], [-12.5, -2.4, 4], 46],
    [S("faltaluz"), [-9, 0.5, 19], [-11.5, -1.5, 4], 46],
    [A.para, [-6.5, 2.4, 12.5], [-9.2, 0.6, 4.6], 44],
    [T.chuveiro, [-6.6, 2.6, 11.5], [-9.0, 0.7, 4.6], 42],
  ], (t) => <SetCistern t={t} />),
  // 21b — chuveiro sem água
  P(T.chuveiro, T.caixa, "dim", [
    [T.chuveiro, [0.35, 1.7, 2.8], [0.35, 1.7, -0.2], 48],
    [T.caixa, [0.6, 1.85, 2.3], [0.35, 1.95, -0.3], 46],
  ], (t) => <SetShower t={t} />),
  // 22 — caixa d'água
  P(T.caixa, T.tubo, "day", [
    [T.caixa, [-8.5, 6, 18.5], [-3, 0.8, 13], 50],
    [111.6, [-14, 97, 26], [-2, 95, 4], 50],
    [112.4, [-11, 101, 18], [0, 95, 0], 46],
    [A.desce - 0.3, [12, 99, 24], [2, 94, 2], 48],
    [A.desce + 1.1, [13, 10, 29], [3, 5, 3], 52],
    [A.caixa - 0.1, [46, 106, 60], [0, 90, 0], 46, true],
    [T.tubo, [40, 108, 58], [0, 91, 0], 46],
  ], (t) => <SetWaterCity t={t} />),
  // 23 — tubo de queda
  P(T.tubo, T.sifao, "day", [
    [T.tubo, [8.6, 62.6, 6.4], [4.6, 61.0, 1.4], 50],
    [117.0, [12, 64, 14], [4.6, 59.5, 1.4], 52],
    [117.8, [40, 50, 70], [3, 45, 0], 48],
    [A.cano - 0.15, [42, 48, 72], [3, 45, 0], 48],
    [A.cano - 0.1, [10, 96, 9], [5.4, 92, 1.4], 50, true],
    [120.0, [10, 50, 10], [5.4, 47, 1.4], 52],
    [120.9, [10, 5, 11], [5.4, 2, 1.4], 52],
    [121.0, [38, 48, 64], [4, 45, 0], 50, true],
    [122.4, [30, 40, 52], [4, 40, 0], 50],
    [T.sifao, [30, 40, 52], [4, 40, 0], 50],
  ], (t) => <SetTubo t={t} />),
  // 24-25 — sifão e ventilação
  P(T.sifao, T.fogo, "room", [
    [T.sifao, [1.5, 2.2, 6.5], [0.2, 1.0, 0], 48],
    [125.0, [1.0, 1.6, 5.0], [0.4, 0.6, 0.4], 46],
    [125.9, [1.3, 0.2, 4.6], [0.8, -0.5, 0.6], 46],
    [127.6, [1.4, -0.6, 3.6], [0.9, -0.85, 0.6], 44],
    [128.6, [1.3, -0.7, 3.2], [0.9, -0.9, 0.6], 42],
    [129.6, [1.6, 0.0, 4.8], [0.85, -0.6, 0.5], 46],
    [S("ventilacao"), [1.8, 0.6, 5.6], [0.7, 0.0, 0.4], 46],
    [130.9, [0.5, 4.6, 7.5], [-1.2, 4.0, -0.5], 48],
    [131.9, [0.6, 4.4, 7.2], [-1.0, 4.0, -0.5], 48],
    [132.6, [4.8, 1.5, 7.5], [2.6, 1.0, 0.6], 50],
    [133.4, [3.6, -0.2, 4.8], [1.8, -0.85, 0.6], 44],
    [134.7, [2.4, 0.8, 5.6], [0.6, 0.2, 0.4], 46],
    [135.8, [6.5, 2.5, 11], [2.8, 1.5, 0.6], 52],
    [137.2, [6.0, 8.6, 8], [3.25, 8.4, 0.6], 46],
    [138.0, [4.8, 0.6, 7], [2.2, -0.4, 0.6], 48],
    [138.6, [6, 1.5, 10], [2.2, 0.5, 0.6], 50],
    [T.fogo, [6.4, 1.8, 10.6], [2.2, 0.6, 0.6], 50],
  ], (t) => <SetBath t={t} />),
  // 26 — fogo
  P(T.fogo, T.laje, "fire", [
    [T.fogo, [-6, 7.8, 7.5], [-6.3, 6.8, -0.6], 50],
    [A.elevF - 0.05, [-5, 7.5, 7], [-6, 7, -0.6], 50],
    [A.elevF, [0.6, 7.6, 5.0], [-0.8, 7.2, -2.2], 50, true],
    [142.3, [0.4, 7.4, 4.4], [-0.8, 7.2, -2.2], 50],
    [142.35, [-1, 10, 30], [-0.5, 9, 0], 54, true],
    [143.4, [-0.5, 10.5, 29], [0, 9.5, 0], 54],
    [143.45, [4.0, 11.2, 6.0], [3.0, 10.4, 0], 50, true],
    [144.7, [4.2, 11.0, 6.4], [3.0, 10.4, 0], 50],
    [144.75, [-3.2, 8.3, 9.0], [1.0, 7.3, -1.9], 46, true],
    [146.9, [-3.0, 8.2, 9.4], [1.0, 7.3, -1.9], 46],
    [146.95, [4, 10, 22], [2.5, 9, 0], 52, true],
    [A.emergencia - 0.6, [3.5, 10.5, 20], [2.5, 9, 0], 52],
    [A.emergencia - 0.55, [6.0, 11.8, 7.0], [3.0, 10.6, 0], 50, true],
    [T.laje, [6.2, 11.0, 7.5], [3.0, 9.8, 0], 50],
  ], (t) => <SetFire t={t} />),
  // 27a — laje no sol / chuva
  P(T.laje, A.ultimo - 0.2, "day", [
    [T.laje, [30, 118, 46], [0, 90, 0], 50],
    [150.4, [22, 110, 30], [2, 90, 2], 48],
    [A.laje, [12, 104, 12], [4, 90, 4], 50],
    [152.6, [10, 95.5, 12], [4.5, 90, 4.5], 50],
    [A.ultimo - 0.2, [11, 96.5, 13], [4, 90, 4], 50],
  ], (t) => <SetLaje t={t} />),
  // 27b — último andar pingando
  P(A.ultimo - 0.2, A.cobre - 0.45, "dim", [
    [A.ultimo - 0.2, [3.2, 1.7, 4.2], [0.4, 1.6, 0], 50],
    [A.cobre - 0.45, [3.0, 1.8, 3.8], [0.3, 1.9, 0], 50],
  ], (t) => <SetLeak t={t} />),
  // 27c — manta, inclinação, ralos
  P(A.cobre - 0.45, T.raio, "day", [
    [A.cobre - 0.45, [-9, 106, 13], [-1, 90, 1], 50],
    [157.2, [-7, 108, 12], [-0.5, 90, 0.5], 50],
    [158.3, [0.5, 112, 9], [0, 90, 0], 50],
    [A.imper, [2, 116, 12], [0, 90, 0], 50],
    [T.raio, [4, 118, 14], [0, 90, 0], 50],
  ], (t) => <SetLaje t={t} />),
  // 28 — raio
  P(T.raio, T.acab, "storm", [
    [T.raio, [-22, 2.2, 52], [0, 46, 0], 60],
    [162.4, [-28, 10, 76], [0, 50, 0], 56],
    [A.raio - 0.5, [-70, 55, 150], [0, 52, 0], 52],
    [A.raio, [-72, 58, 153], [0, 56, 0], 52],
    [A.ponta - 0.55, [-50, 76, 112], [0, 82, 0], 50],
    [A.ponta - 0.5, [15, 104, 24], [0, 99, 0], 44, true],
    [A.raio2 + 0.1, [11, 106, 20], [0, 100.5, 0], 44],
    ...samples(PULSE0 + 0.05, PULSE1, 0.15, (t) => {
      const p = rodAt(prog(t, PULSE0, PULSE1, (x) => x));
      return [t, [p[0] + 18, p[1] + 5, p[2] + 22], [p[0], p[1] - 3, p[2]], 52] as KK;
    }),
    [A.terra + 0.3, [44, 40, 96], [4, 50, 4], 58],
    [T.acab, [48, 38, 102], [4, 46, 4], 58],
  ], (t) => <SetStorm t={t} />, (t) => (t > A.raio && t < A.raio + 0.5 ? 0.25 : 0) + (t > A.raio2 && t < A.raio2 + 0.35 ? 0.2 : 0)),
  // 29 — portaria
  P(T.acab, T.final, "room", [
    [T.acab, [0.5, 1.9, 9.0], [2, 1.2, -1], 50],
    [170.8, [1.2, 1.8, 6.6], [2.4, 1.3, -1], 48],
    [A.interfone - 0.05, [-1.5, 1.7, 6.5], [-4.5, 1.5, 1.0], 48],
    [171.8, [-2.6, 1.6, 5.0], [-5.9, 1.45, 1.6], 44],
    [172.4, [0.5, 1.8, 6.0], [-1.4, 1.4, 1.4], 44],
    [T.final, [0.2, 1.75, 5.2], [-1.4, 1.5, 1.4], 42],
  ], (t) => <SetLobby t={t} />),
  // 30 — final
  P(T.final, END, "sunset", [
    [T.final, [Math.sin(-0.25) * 40, 62, Math.cos(-0.25) * 40], [0, 66, 0], 56],
    [176.6, [Math.sin(-0.5) * 80, 66, Math.cos(-0.5) * 80], [0, 66, 0], 54],
    [178.6, [Math.sin(-0.8) * 150, 80, Math.cos(-0.8) * 150], [0, 72, 0], 52],
    [180.6, [Math.sin(-1.05) * 205, 96, Math.cos(-1.05) * 205], [0, 76, 0], 52],
    [END, [Math.sin(-1.15) * 220, 100, Math.cos(-1.15) * 220], [0, 78, 0], 52],
  ], (t) => <SetFinal t={t} />),
];

// ======================================================================
// Overlays 2D
// ======================================================================
const capY = (t: number) => {
  if (t >= T.final) return 1520;
  if (t >= A.grupo - 0.3 && t < T.final) return 1560;
  if (t >= T.escada + 1.5 && t < T.elevador) return 1450;
  if (t >= T.sifao && t < T.fogo) return 1450;
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

// contador de degraus (escada)
const Degraus: React.FC = () => {
  const cover = useContext(CoverCtx);
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  if (cover || t < 56.6 || t >= T.elevador) return null;
  const n = Math.max(1, degrauN(t));
  const p = spring({ frame: frame - Math.round(56.6 * fps), fps, config: SP.bouncy });
  const top = n > 450;
  const shake = top ? Math.sin(frame * 1.7) * 5 : 0;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div style={{ position: "absolute", top: 300, width: "100%", textAlign: "center", fontFamily: FONT, fontWeight: 800, transform: `scale(${p}) translateX(${shake}px)` }}>
        <div style={{ fontSize: 58, color: "#fff", WebkitTextStroke: `12px ${C.ink}`, paintOrder: "stroke fill", letterSpacing: 2 }}>DEGRAU</div>
        <div style={{ fontSize: 180, lineHeight: 0.95, WebkitTextStroke: `18px ${C.ink}`, paintOrder: "stroke fill", textShadow: "0 10px 0 rgba(0,0,0,0.25)", fontVariantNumeric: "tabular-nums" }}>
          <span style={{ color: top ? C.bad : C.accent }}>{n}</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// cartela de época
const Era: React.FC = () => {
  const cover = useContext(CoverCtx);
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  if (cover || t < T.otis + 0.1 || t > A.subiu) return null;
  const p = spring({ frame: frame - Math.round((T.otis + 0.1) * fps), fps, config: SP.smooth });
  const o = 1 - prog(t, A.subiu - 0.4, A.subiu);
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div style={{ position: "absolute", top: 300, width: "100%", textAlign: "center", fontFamily: "Georgia, 'Times New Roman', serif", opacity: o * p, transform: `scale(${0.9 + 0.1 * p})` }}>
        <div style={{ display: "inline-block", padding: "18px 44px", border: "5px double #F3E6C8", background: "rgba(50,32,14,0.55)", color: "#F8EED6", letterSpacing: 6 }}>
          <div style={{ fontSize: 44, fontStyle: "italic" }}>Nova York</div>
          <div style={{ fontSize: 120, fontWeight: 700, lineHeight: 1 }}>1854</div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// película antiga (Otis)
const OldFilm: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  if (t < T.otis || t >= T.agua) return null;
  const flick = 0.06 + 0.05 * Math.abs(Math.sin(frame * 2.3) * Math.sin(frame * 0.7));
  const lines = [0, 1, 2].map((i) => ((Math.sin(frame * (0.9 + i) + i * 7) + 1) / 2) * 1080);
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at center, transparent 45%, rgba(40,25,10,0.65) 100%)" }} />
      <AbsoluteFill style={{ background: "#2A1A08", opacity: flick }} />
      {lines.map((x, i) => ((frame + i) % 5 < 3 ? <div key={i} style={{ position: "absolute", left: x, top: 0, width: 2, height: 1920, background: "rgba(255,240,210,0.35)" }} /> : null))}
    </AbsoluteFill>
  );
};

// escurecimento (apagão, chuva) por cima do 3D
const Tint: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const blackout = t >= S("faltaluz") && t < T.chuveiro ? prog(t, A.luz - 0.05, A.luz + 0.15) * 0.5 : t >= T.caixa && t < T.tubo ? prog(t, A.desce - 0.4, A.desce - 0.1) * (1 - prog(t, A.caixa - 0.15, A.caixa)) * 0.45 : 0;
  const rain = t >= T.laje && t < T.raio && !(t >= A.ultimo - 0.2 && t < A.cobre - 0.45) ? prog(t, A.chuva - 0.3, A.chuva) * (1 - 0.7 * prog(t, A.cobre, A.cobre + 1.0)) * 0.5 : 0;
  const sun = t >= T.laje && t < A.ultimo - 0.2 ? prog(t, A.laje, A.rachaL) * (1 - prog(t, A.chuva - 0.3, A.chuva)) : 0;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {blackout > 0 ? <AbsoluteFill style={{ background: "#0B1636", opacity: blackout, mixBlendMode: "multiply" }} /> : null}
      {rain > 0 ? <AbsoluteFill style={{ background: "#33414E", opacity: rain, mixBlendMode: "multiply" }} /> : null}
      {sun > 0 ? <AbsoluteFill style={{ background: "radial-gradient(ellipse at 80% 5%, rgba(255,190,90,0.55), rgba(255,140,40,0.12) 60%)", opacity: sun }} /> : null}
    </AbsoluteFill>
  );
};

// celular do grupo do condomínio
const Phone: React.FC = () => {
  const cover = useContext(CoverCtx);
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  if (cover || t < A.grupo - 0.1 || t >= T.final) return null;
  const p = spring({ frame: frame - Math.round((A.grupo - 0.1) * fps), fps, config: SP.bouncy });
  const out = 1 - prog(t, T.final - 0.25, T.final);
  const vib = Math.sin(frame * 2.6) * 6 * (Math.floor(t * 4) % 2);
  const count = Math.min(999, Math.round(interpolate(t, [A.grupo, A.grupo + 1.6], [12, 999], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })));
  const msgs = ["Quem deixou o lixo no corredor??", "Barulho de furadeira de novo!!", "Alguém viu meu gato?", "REUNIÃO DE CONDOMÍNIO HOJE", "Bom dia grupo", "A vaga 12 é MINHA", "Quem pegou minha encomenda?"];
  const shown = Math.min(msgs.length, Math.floor((t - A.grupo + 0.2) / 0.28) + 1);
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div style={{ position: "absolute", left: 540 - 250, top: 330, width: 500, height: 860, transform: `translateY(${(1 - p) * 900}px) translateX(${vib}px) rotate(${vib * 0.4}deg)`, opacity: out }}>
        <div style={{ position: "absolute", inset: 0, borderRadius: 56, background: "#16181D", boxShadow: "0 30px 60px rgba(0,0,0,0.45)" }} />
        <div style={{ position: "absolute", left: 18, top: 18, right: 18, bottom: 18, borderRadius: 42, background: "#ECE5DD", overflow: "hidden", fontFamily: FONT }}>
          <div style={{ height: 120, background: "#1F6E5C", color: "#fff", display: "flex", alignItems: "center", padding: "30px 24px 0", gap: 16 }}>
            <div style={{ width: 62, height: 62, borderRadius: 31, background: "#F2C230", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 34, fontWeight: 800, color: C.ink }}>ED</div>
            <div>
              <div style={{ fontSize: 34, fontWeight: 800, lineHeight: 1 }}>Condomínio Ed. Treco</div>
              <div style={{ fontSize: 22, opacity: 0.85 }}>412 participantes</div>
            </div>
          </div>
          <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
            {msgs.slice(0, shown).map((m, i) => (
              <div key={i} style={{ alignSelf: i % 3 === 2 ? "flex-end" : "flex-start", maxWidth: "86%", background: i % 3 === 2 ? "#D9FDD3" : "#FFFFFF", borderRadius: 18, padding: "10px 16px", fontSize: 27, fontWeight: 700, color: "#22262B", boxShadow: "0 2px 0 rgba(0,0,0,0.08)" }}>
                {m}
              </div>
            ))}
          </div>
        </div>
        <div style={{ position: "absolute", right: -26, top: -26, minWidth: 130, height: 92, borderRadius: 46, background: C.bad, color: "#fff", fontFamily: FONT, fontWeight: 800, fontSize: 58, display: "flex", alignItems: "center", justifyContent: "center", padding: "6px 22px 0", border: `7px solid ${C.ink}`, transform: `scale(${1 + Math.sin(frame * 0.9) * 0.06})` }}>
          {count >= 999 ? "999+" : count}
        </div>
      </div>
    </AbsoluteFill>
  );
};

// card final: "Sabia? comente SÍNDICO / Não sabia? comente MORADOR"
const Card: React.FC = () => {
  const cover = useContext(CoverCtx);
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (cover) return null;
  const t = frame / fps;
  if (t < A.se1 - 0.05) return null;
  const a = spring({ frame: frame - Math.round((A.se1 - 0.05) * fps), fps, config: SP.bouncy });
  const b = spring({ frame: frame - Math.round((A.se2 - 0.05) * fps), fps, config: SP.bouncy });
  const line = (txt: string, s: number, size: number, color: string, stroke: number) => (
    <div style={{ fontSize: size, lineHeight: 1.02, color, WebkitTextStroke: `${stroke}px ${C.ink}`, paintOrder: "stroke fill", textShadow: "0 8px 0 rgba(0,0,0,0.3)", transform: `scale(${s})`, opacity: Math.min(1, s * 2) }}>{txt}</div>
  );
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div style={{ position: "absolute", top: 210, width: "100%", textAlign: "center", fontFamily: FONT, fontWeight: 800 }}>
        {line("SABIA? COMENTE", a, 60, "#FFFFFF", 12)}
        {line("“SÍNDICO”", a, 128, "#FFD23F", 18)}
        {t >= A.se2 - 0.05 ? <div style={{ height: 22 }} /> : null}
        {t >= A.se2 - 0.05 ? line("NÃO SABIA? COMENTE", b, 52, "#FFFFFF", 11) : null}
        {t >= A.se2 - 0.05 ? line("“MORADOR”", b, 112, "#FFD23F", 17) : null}
      </div>
    </AbsoluteFill>
  );
};

// flash suave nos cortes de cenário
const SoftFlash: React.FC<{ at: number[] }> = ({ at }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const o = Math.max(0, ...at.map((s) => interpolate(frame, [s * fps - 2, s * fps, s * fps + 6], [0, 0.55, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })));
  if (o <= 0) return null;
  return <AbsoluteFill style={{ background: "#fff", opacity: o, pointerEvents: "none" }} />;
};

// ======================================================================
// Composição
// ======================================================================
export const Predio: React.FC = () => {
  const cuts = [T.racha, T.puxao, T.afunda, T.escada, T.elevador, T.otis, T.agua, T.cisterna, T.chuveiro, T.caixa, T.sifao, T.fogo, T.laje, T.raio, T.acab, T.final, A.varios - 0.5];
  return (
    <TimelineCtx.Provider value={TL}>
      <AbsoluteFill style={{ background: "#D6EBF5" }}>
        {PLANS.map((p, i) => {
          const L = LOOK[p.look];
          const shot = (
            <Shot key={i} from={p.from} to={p.to} sky={L.sky} sun={L.sun} sunPower={L.power} ambient={L.amb} shadowSize={L.shadow} exposure={L.exp}>
              {(t) => (
                <>
                  <Cam from={p.from} keys={p.keys} shake={p.shake ? p.shake(t) : 0} />
                  {p.render(t)}
                </>
              )}
            </Shot>
          );
          return p.sepia ? (
            <AbsoluteFill key={i} style={{ filter: "sepia(0.9) saturate(0.85) contrast(1.08) brightness(1.02)" }}>
              {shot}
            </AbsoluteFill>
          ) : (
            shot
          );
        })}
        <OldFilm />
        <Tint />
        <SoftFlash at={cuts} />
        <Era />
        <Degraus />
        <Phone />
        <Card />
        <TopLabel />
        <Legenda />
        <Audio src={staticFile("predio/narracao.wav")} />
        <Audio src={staticFile("predio/trilha.wav")} volume={0.9} />
      </AbsoluteFill>
    </TimelineCtx.Provider>
  );
};

export const predioDuration = (fps: number) => Math.ceil((TL.duration + 1.5) * fps);
