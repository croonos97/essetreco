import { AbsoluteFill, Audio, staticFile } from "remotion";
import { BigText, Captions, CTA, Finish, Flash, Mark, Tag, TopLabel } from "../engine/Overlays";
import { Cam, Shot } from "../engine/Shot";
import { cena, pop, prog, Timeline, TimelineCtx, wordAt } from "../engine/timeline";
import { CrashCar, CrashLab, Inflator, Pump, SteeringWheel } from "../three/Airbag";
import { Glow } from "../three/basics";
import { Tiao } from "../three/Tiao";
import { Workshop } from "../three/Workshop";
import { ease } from "../theme";
import timelineJson from "../../public/airbag/timeline.json";

const TL = timelineJson as Timeline;
const S = (id: string) => cena(TL, id).start;
const E = (id: string) => cena(TL, id).end;
const W = (id: string, w: string, nth = 0) => wordAt(TL, id, w, nth);
const LAB: [string, string] = ["#E9EDF0", "#DDE3E7"];
const WORK: [string, string] = ["#F3E6CF", "#E9D7B8"];
const STOP_X = -0.3;

const A = {
  para: W("gancho", "para"),
  volante: W("inercia", "volante"),
  cinto: W("cinto", "cinto"),
  ajuda: W("cinto", "Ajuda"),
  cabeca: W("cinto", "cabeça"),
  frente: W("cinto", "frente"),
  almofada: W("almofada", "almofada"),
  pancada: W("almofada", "pancada"),
  macia: W("almofada", "macia"),
  ninguem: W("almofada", "ninguém"),
  cara: W("almofada", "cara"),
  dobradinha: W("guardar", "dobradinha"),
  volante2: W("guardar", "volante"),
  acontece: W("rapido", "acontece"),
  bomba: W("rapido", "bomba"),
  sensor: W("sensor", "sensor"),
  brusca: W("sensor", "brusca"),
  manda: W("sensor", "manda"),
  hora: W("sensor", "hora"),
  freada2: W("sensor", "freada", 1),
  dispara: W("sensor", "dispara"),
  cheia: W("dura", "cheia"),
  durap: W("dura", "dura"),
  voltar: W("dura", "voltar"),
  furinhos: W("furos", "furinhos"),
  momento: W("furos", "momento"),
  encosta: W("furos", "encosta"),
  saindo: W("furos", "saindo"),
  murcha: W("furos", "murcha"),
  calma: W("furos", "calma"),
  cintoFim: W("revelacao", "cinto"),
};

// Cada batida: o carro chega rápido e para na barreira.
const IMPACTS = [A.para, A.ajuda, A.pancada, A.acontece, A.brusca, A.cheia, A.momento];
const approach = (t: number, tImp: number, from = -14, dur = 0.55, stop = STOP_X) => stop + (from - stop) * Math.pow(1 - prog(t, tImp - dur, tImp, (u) => u), 1.6);
// janelas em que o boneco volta a ficar ereto (entre uma batida e outra)
const UPRIGHT: [number, number][] = [
  [S("guardar"), A.acontece - 0.6],
  [S("sensor"), A.brusca - 0.6],
  [S("dura"), A.cheia - 0.6],
  [S("furos"), A.momento - 0.6],
];

type Crash = { carX: number; crumple: number; lean: number; headLean: number; shake: number; hit: number };

const crashState = (t: number): Crash => {
  // escolhe a batida mais recente (ou a próxima, se estiver chegando)
  let tImp = IMPACTS[0];
  for (const ti of IMPACTS) if (t >= ti - 0.6) tImp = ti;
  // freada forte sem batida
  if (t >= A.freada2 - 0.7 && t < S("dura")) {
    const x = approach(t, A.freada2, -14, 0.7, -1.6);
    return { carX: x, crumple: 0, lean: 0.12 * Math.sin(prog(t, A.freada2 - 0.1, A.freada2 + 0.5) * Math.PI), headLean: 0, shake: 0, hit: 0 };
  }
  const carX = t < tImp ? approach(t, tImp, -14, tImp === A.para ? 1.5 : 0.55) : STOP_X;
  const crumple = prog(t, tImp, tImp + 0.15);
  const shake = t > tImp && t < tImp + 0.35 ? 0.04 : 0;
  let lean = 0;
  let headLean = 0;
  let hit = 0;
  if (tImp === A.para) {
    // sem proteção: câmera lenta até bater no volante
    lean = 0.98 * prog(t, tImp + 0.1, A.volante, ease.in);
    headLean = 0.25 * prog(t, A.volante - 1.5, A.volante, ease.in);
    hit = prog(t, A.volante - 0.05, A.volante + 0.05) * (1 - prog(t, A.volante + 0.4, A.volante + 1.2));
  } else if (tImp === A.ajuda) {
    lean = 0.28 * prog(t, tImp, tImp + 0.35, ease.out);
    headLean = 0.95 * prog(t, A.cabeca - 0.3, A.frente, ease.in);
    hit = prog(t, A.frente - 0.05, A.frente + 0.05) * (1 - prog(t, A.frente + 0.4, A.frente + 1.0));
  } else if (tImp === A.pancada) {
    lean = 0.28 * prog(t, tImp, tImp + 0.35, ease.out);
    headLean = 0.62 * prog(t, tImp + 0.1, A.macia + 0.2, ease.out);
  } else if (tImp === A.acontece) {
    lean = 0.28 * prog(t, tImp, tImp + 0.2, ease.out);
    headLean = 0.95 * prog(t, tImp + 0.1, tImp + 0.55, ease.in);
    hit = prog(t, tImp + 0.5, tImp + 0.6) * (1 - prog(t, tImp + 0.9, tImp + 1.5));
  } else if (tImp === A.brusca) {
    lean = 0.28 * prog(t, tImp, tImp + 0.35, ease.out);
    headLean = 0.5 * prog(t, A.hora, A.hora + 0.6, ease.out) * (1 - 0.3 * prog(t, A.hora + 0.8, A.hora + 1.6));
  } else if (tImp === A.cheia) {
    lean = 0.28 * prog(t, tImp, tImp + 0.35, ease.out);
    const fwd = 0.48 * prog(t, tImp + 0.2, A.durap, ease.in);
    const back = 0.85 * prog(t, A.durap, A.voltar, ease.out);
    headLean = fwd - back;
    hit = prog(t, A.durap - 0.05, A.durap + 0.05) * (1 - prog(t, A.durap + 0.3, A.durap + 0.8));
  } else {
    lean = 0.28 * prog(t, tImp, tImp + 0.35, ease.out);
    headLean = 0.55 * prog(t, tImp + 0.2, A.calma, ease.out);
  }
  const up = UPRIGHT.some(([a, b]) => t >= a && t < b) ? 0 : 1;
  const relax = 1 - prog(t, S("revelacao") + 0.3, S("revelacao") + 1.5);
  return { carX, crumple, lean: lean * up * relax, headLean: headLean * up * relax, shake, hit };
};

const bagState = (t: number) => {
  // tempos em que a bolsa está cheia (após "guardar")
  if (t < A.hora - 0.05) return { bag: 0, hard: 0, deflate: 0, vents: 0, vent: 0, hub: 0 };
  if (t < A.freada2 - 0.7) return { bag: pop(prog(t, A.hora - 0.05, A.hora + 0.15)), hard: 0, deflate: prog(t, A.hora + 1.0, A.hora + 1.8) * 0.6, vents: 0, vent: 0, hub: 1 };
  if (t < A.cheia) return { bag: 0, hard: 0, deflate: 0, vents: 0, vent: 0, hub: 0 };
  if (t < S("furos")) return { bag: pop(prog(t, A.cheia + 0.05, A.cheia + 0.25)), hard: 1, deflate: 0, vents: 0, vent: 0, hub: 1 };
  if (t < A.momento - 0.1) return { bag: 1, hard: 0, deflate: 0, vents: pop(prog(t, A.furinhos - 0.1, A.furinhos + 0.3)), vent: 0, hub: 1 };
  return {
    bag: t < A.momento + 0.1 ? pop(prog(t, A.momento - 0.1, A.momento + 0.1)) : 1,
    hard: 0,
    deflate: prog(t, A.murcha - 0.4, A.calma),
    vents: 1,
    vent: prog(t, A.saindo - 0.2, A.saindo + 0.2) * (1 - prog(t, A.calma, A.calma + 0.8)),
    hub: 1,
  };
};

const Car: React.FC<{ t: number }> = ({ t }) => {
  const c = crashState(t);
  const b = bagState(t);
  const belt = t < A.cinto ? 0 : 1;
  const pillow =
    t < A.almofada - 0.2 ? 0 : t < A.dobradinha ? pop(prog(t, A.almofada - 0.2, A.almofada + 0.3)) : Math.max(0, 1 - prog(t, A.dobradinha, A.volante2 + 0.2));
  const pillowFace = t > A.ninguem - 0.3 && t < S("guardar");
  const pump = t > A.bomba - 0.3 && t < S("quimica");
  const sensor = t < A.sensor - 0.2 ? 0 : pop(prog(t, A.sensor - 0.2, A.sensor + 0.3));
  const sensorFlash = (t > A.brusca && t < A.hora + 0.6) ? 0.6 + 0.4 * Math.sin(t * 30) : 0;
  const signal = prog(t, A.manda - 0.3, A.manda) * (1 - prog(t, A.hora + 0.2, A.hora + 0.6));
  const resetUpright = pillowFace ? { lean: 0, headLean: 0 } : null;
  const mood = c.hit > 0.2 ? "shock" : t > S("revelacao") ? "happy" : "neutral";
  return (
    <CrashCar x={c.carX} crumple={c.crumple} t={t} sensor={sensor} sensorFlash={sensorFlash} signal={signal} brake={t > A.freada2 - 0.4 && t < S("dura") ? 1 : 0}>
      <SteeringWheel
        bag={b.bag}
        bagHard={b.hard}
        deflate={b.deflate}
        vents={b.vents}
        vent={b.vent}
        t={t}
        pillow={pillowFace ? 0 : pillow}
        hubOpen={Math.max(b.hub, t > A.dobradinha && t < A.volante2 + 0.6 ? 1 - prog(t, A.volante2, A.volante2 + 0.5) : 0)}
        pumpBag={pump ? 0.22 * prog(t, A.bomba, E("rapido")) : 0}
      />
      {/* travesseiro na cara: ninguém dirige assim */}
      {pillowFace ? (
        <group position={[0.15, 1.95, -0.38]}>
          <mesh scale={[0.18, 0.4, 0.42]}>
            <sphereGeometry args={[1, 24, 16]} />
            <meshStandardMaterial color="#FFFFFF" roughness={0.8} />
          </mesh>
        </group>
      ) : null}
      <Pump position={[0.95, 0.47, 0.55]} p={pump ? pop(prog(t, A.bomba - 0.3, A.bomba + 0.2)) : 0} t={t} pumping={pump ? 1 : 0} />
      <Tiao
        position={[-0.45, 0.04, -0.38]}
        rotation={Math.PI / 2}
        sit={1}
        lean={resetUpright ? 0 : c.lean}
        headLean={resetUpright ? 0 : c.headLean}
        belt={belt}
        beltGlow={prog(t, A.cinto - 0.2, A.cinto + 0.2) * (1 - prog(t, A.cinto + 1, A.cinto + 1.6)) + prog(t, A.cintoFim - 0.2, A.cintoFim + 0.2)}
        outfit="dummy"
        mood={pillowFace ? "sad" : mood}
        pose={t > S("cta") ? "up" : "down"}
        t={t}
        armROverride={t > S("cta") ? undefined : [-1.05 - c.lean * 0.5, 0, -0.05]}
        armLOverride={t > S("cta") ? undefined : [-1.05 - c.lean * 0.5, 0, 0.05]}
      />
      <Glow position={[0.25, 1.85, -0.2]} size={1.6 * c.hit} color="#FF3B2F" opacity={0.7 * c.hit} />
    </CrashCar>
  );
};

// Câmera lateral fixa na cabine, com variações por cena.
const cab = (dx = 0, dy = 0, dz = 0, fov = 44) => ({ pos: [1.0 + dx, 2.65 + dy, 4.6 + dz] as [number, number, number], look: [0.0 + dx * 0.2, 1.55, -0.38] as [number, number, number], fov });

export const Airbag: React.FC = () => {
  const cuts = [S("cinto"), S("almofada"), S("guardar"), S("quimica"), S("sensor"), S("dura"), S("furos")];
  return (
    <TimelineCtx.Provider value={TL}>
      <AbsoluteFill style={{ background: "#E9EDF0" }}>
        <Shot from={0} to={S("quimica")} sky={LAB} sun={[6, 12, 10]} shadowSize={12}>
          {(t) => {
            const c = crashState(t);
            return (
              <>
                <Cam
                  from={0}
                  keys={[
                    { t: 0, pos: [-3.0, 2.8, 11.5], look: [-1.2, 1.3, 0], fov: 46 },
                    { t: A.para + 0.4, pos: [-1.5, 2.5, 8.4], look: [-0.2, 1.4, 0], fov: 46 },
                    { t: S("inercia"), ...cab(0, 0, 0.6) },
                    { t: W("inercia", "velocidade"), ...cab(0.9, 0.2, -0.6, 42) },
                    { t: A.volante, ...cab(1.3, -0.1, -1.2, 42) },
                    { t: S("cinto"), ...cab(0, 0, 0.4) },
                    { t: A.cinto + 0.4, ...cab(-0.4, -0.2, -1.0, 42) },
                    { t: A.frente, ...cab(0.8, 0, -0.6, 42) },
                    { t: S("almofada"), ...cab(0, 0, 0.3) },
                    { t: A.macia, ...cab(0.9, 0, -0.9, 42) },
                    { t: A.ninguem, pos: [2.2, 2.2, 1.6], look: [-0.2, 1.9, -0.38], fov: 44 },
                    { t: S("guardar"), pos: [1.7, 2.2, 1.9], look: [0.4, 1.65, -0.38], fov: 42 },
                    { t: A.volante2, pos: [1.4, 2.0, 1.6], look: [0.5, 1.62, -0.38], fov: 40 },
                    { t: S("rapido"), ...cab(0, 0, 0.5) },
                    { t: A.bomba, pos: [1.7, 1.8, 4.0], look: [0.6, 1.2, 0], fov: 46 },
                    { t: S("quimica"), pos: [1.7, 1.8, 4.0], look: [0.6, 1.2, 0], fov: 46 },
                  ]}
                  shake={c.shake}
                />
                <CrashLab />
                <Car t={t} />
              </>
            );
          }}
        </Shot>

        {/* QUÍMICA — gerador de gás na bancada */}
        <Shot from={S("quimica")} to={S("sensor")} sky={WORK} sun={[4, 10, 8]} shadowSize={8}>
          {(t) => {
            const spark = t > W("quimica", "faísca") && t < W("quimica", "faísca") + 0.6 ? 0.6 + 0.4 * Math.sin(t * 40) : 0;
            return (
              <>
                <Cam
                  from={S("quimica")}
                  keys={[
                    { t: S("quimica"), pos: [1.0, 2.8, 6.4], look: [0, 0.8, 0], fov: 44 },
                    { t: W("quimica", "faísca"), pos: [0.6, 2.0, 4.4], look: [0, 0.5, 0], fov: 44 },
                    { t: W("quimica", "gás"), pos: [0.5, 2.4, 5.0], look: [0, 1.2, 0], fov: 46 },
                    { t: S("sensor"), pos: [0.2, 3.0, 6.8], look: [0, 1.6, 0], fov: 46 },
                  ]}
                  shake={t > W("quimica", "queima") && t < W("quimica", "queima") + 0.4 ? 0.015 : 0}
                />
                <Workshop />
                <Inflator
                  t={t}
                  p={pop(prog(t, W("quimica", "pastilha") - 0.3, W("quimica", "pastilha") + 0.2))}
                  spark={spark}
                  burn={prog(t, W("quimica", "queima") - 0.1, W("quimica", "queima") + 0.2)}
                  gas={prog(t, W("quimica", "queima"), W("quimica", "gás")) * (1 - 0.6 * prog(t, W("quimica", "enche") + 0.4, E("quimica")))}
                  bag={pop(prog(t, W("quimica", "enche") - 0.1, W("quimica", "enche") + 0.2))}
                />
              </>
            );
          }}
        </Shot>

        {/* SENSOR → BOLSA DURA → FUROS → REVELAÇÃO */}
        <Shot from={S("sensor")} to={TL.duration + 1} sky={LAB} sun={[6, 12, 10]} shadowSize={12}>
          {(t) => {
            const c = crashState(t);
            return (
              <>
                <Cam
                  from={S("sensor")}
                  keys={[
                    { t: S("sensor"), pos: [2.8, 2.6, 6.0], look: [1.2, 1.0, 0.8], fov: 44 },
                    { t: A.sensor + 0.8, pos: [2.2, 1.6, 3.7], look: [1.25, 0.95, 0.9], fov: 42 },
                    { t: A.manda, pos: [1.6, 2.4, 3.8], look: [0.9, 1.3, 0.0], fov: 44 },
                    { t: A.hora + 0.4, ...cab(0.4, 0, 0.2) },
                    { t: A.freada2 - 0.8, pos: [-3.2, 2.6, 10.5], look: [-1.4, 1.3, 0], fov: 46 },
                    { t: S("dura"), ...cab(0, 0, 0.5) },
                    { t: A.durap, pos: [0.0, 2.0, 6.6], look: [0.05, 1.75, -0.38], fov: 36 },
                    { t: A.voltar + 0.4, pos: [-0.1, 2.0, 6.8], look: [0.0, 1.75, -0.38], fov: 36 },
                    { t: S("furos"), pos: [1.5, 2.2, 1.9], look: [0.2, 1.7, -0.38], fov: 42 },
                    { t: A.momento, ...cab(0, 0, 0.3) },
                    { t: A.murcha, ...cab(0.9, 0, -0.8, 42) },
                    { t: S("revelacao"), ...cab(0.3, 0.2, 0.8) },
                    { t: A.cintoFim, pos: [-1.2, 2.8, 7.6], look: [-0.2, 1.4, -0.2], fov: 46 },
                    { t: TL.duration + 1, pos: [-2.2, 3.2, 9.4], look: [-0.3, 1.4, -0.2], fov: 46 },
                  ]}
                  shake={c.shake}
                />
                <CrashLab />
                <Car t={t} />
              </>
            );
          }}
        </Shot>

        <BigText at={W("gancho", "sessenta")} until={A.para + 0.3} text="60 KM/H" y={1380} color="#FFD23F" size={130} />
        <Tag at={W("inercia", "mesma")} until={W("inercia", "E")} text="VOCÊ: 60 KM/H" x={540} y={420} color="#D2402E" />
        <Mark kind="x" at={A.volante} until={S("cinto")} y={760} />
        <Mark kind="ok" at={W("cinto", "muito")} until={A.cabeca} y={760} />
        <Mark kind="x" at={A.frente} until={S("almofada")} y={760} />
        <Mark kind="ok" at={A.macia} until={A.ninguem} y={760} />
        <Mark kind="x" at={A.cara} until={S("guardar")} y={760} />
        <Mark kind="ok" at={W("guardar", "batida")} until={S("rapido")} y={760} />
        <Mark kind="x" at={W("rapido", "rápido")} until={S("quimica")} y={760} />
        <BigText at={W("quimica", "trinta")} until={E("quimica")} text="0,03 SEGUNDO" y={1380} color="#FFD23F" size={110} />
        <Tag at={A.dispara - 0.4} until={S("dura")} text="NÃO DISPARA" x={540} y={420} color="#2BA84A" />
        <Mark kind="x" at={W("dura", "tudo")} until={S("furos")} y={760} />
        <Mark kind="ok" at={A.calma} until={S("revelacao")} y={760} />
        <Finish />
        <Flash at={cuts} />
        <TopLabel />
        <Captions />
        <CTA at={S("cta")} />
        <Audio src={staticFile("airbag/narracao.wav")} />
        <Audio src={staticFile("airbag/trilha.wav")} volume={0.9} />
      </AbsoluteFill>
    </TimelineCtx.Provider>
  );
};

export const airbagDuration = (fps: number) => Math.ceil((TL.duration + 0.8) * fps);
